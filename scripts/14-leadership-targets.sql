-- ====================================================================
-- 14-leadership-targets.sql
-- Table for Leadership Inspection Plan & Targets (خطة مرور القيادات والمستهدفات)
-- ====================================================================

CREATE TABLE IF NOT EXISTS public.leadership_targets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(255) NOT NULL,
    sector_head_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    sector_name VARCHAR(255) DEFAULT 'قطاع الطب العلاجي',
    undersecretary_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    undersecretary_name VARCHAR(255) NOT NULL,
    governorate VARCHAR(100) NOT NULL,
    target_missions INT NOT NULL DEFAULT 15,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    status VARCHAR(50) DEFAULT 'active', -- 'active', 'completed', 'expired'
    instructions TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexing for fast queries
CREATE INDEX IF NOT EXISTS idx_leadership_targets_undersecretary ON public.leadership_targets(undersecretary_id);
CREATE INDEX IF NOT EXISTS idx_leadership_targets_dates ON public.leadership_targets(start_date, end_date);
