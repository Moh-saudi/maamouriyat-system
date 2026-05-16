// ==========================================
// نظام إدارة المأموريات - إعداد عميل Supabase
// ==========================================

// 1. تثبيت الحزم (تشغيل في التيرمنال):
// npm install @supabase/supabase-js @supabase/ssr

// 2. إعداد Client في JavaScript (lib/supabase.js)
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabasePublishableKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

export const supabase = createClient(supabaseUrl, supabasePublishableKey)

// 3. الاشتراك في التحديثات الفورية (Realtime)
export const subscribeToNotifications = async (currentUserId, showNotificationToast) => {
  const { data: { user } } = await supabase.auth.getUser()
  
  const channel = supabase
    .channel('user-notifications')
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications',
        filter: \user_id=eq.\\
      },
      (payload) => {
        console.log('إشعار جديد:', payload.new)
        showNotificationToast(payload.new)
      }
    )
    .subscribe()
    
  return channel
}

export const subscribeToMissions = (refreshMissionsTable) => {
  const missionsChannel = supabase
    .channel('missions-updates')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'missions' },
      (payload) => {
        console.log('تحديث مأمورية:', payload)
        refreshMissionsTable()
      }
    )
    .subscribe()
    
  return missionsChannel
}
