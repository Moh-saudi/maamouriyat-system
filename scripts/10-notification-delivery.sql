-- Notification delivery helpers for assignment workflow and future PWA push/email delivery.

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS email TEXT;

CREATE INDEX IF NOT EXISTS idx_users_email
  ON users(email);

CREATE TABLE IF NOT EXISTS push_subscriptions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  endpoint TEXT NOT NULL UNIQUE,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  user_agent TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user
  ON push_subscriptions(user_id, is_active);

CREATE TABLE IF NOT EXISTS email_outbox (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  notification_id UUID REFERENCES notifications(id) ON DELETE SET NULL,
  to_email TEXT NOT NULL,
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed')),
  attempts INTEGER DEFAULT 0,
  last_error TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  sent_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_email_outbox_status
  ON email_outbox(status, created_at);

ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_outbox ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "push_subscriptions_own_select" ON push_subscriptions;
CREATE POLICY "push_subscriptions_own_select" ON push_subscriptions
  FOR SELECT USING (user_id = (SELECT id FROM users WHERE auth_id = auth.uid()));

DROP POLICY IF EXISTS "push_subscriptions_own_insert" ON push_subscriptions;
CREATE POLICY "push_subscriptions_own_insert" ON push_subscriptions
  FOR INSERT WITH CHECK (user_id = (SELECT id FROM users WHERE auth_id = auth.uid()));

DROP POLICY IF EXISTS "notifications_insert_mission_assignments" ON notifications;
CREATE POLICY "notifications_insert_mission_assignments" ON notifications
  FOR INSERT WITH CHECK (
    (SELECT level FROM users WHERE auth_id = auth.uid()) <= 6
  );

DROP POLICY IF EXISTS "email_outbox_manager_select" ON email_outbox;
CREATE POLICY "email_outbox_manager_select" ON email_outbox
  FOR SELECT USING ((SELECT level FROM users WHERE auth_id = auth.uid()) <= 2);
