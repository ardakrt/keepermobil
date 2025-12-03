-- Migration: Add completion tracking to reminders table
-- Date: 2025-11-04

-- Add is_completed column to reminders table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'reminders'
      AND column_name = 'is_completed'
  ) THEN
    ALTER TABLE public.reminders
    ADD COLUMN is_completed boolean NOT NULL DEFAULT false;

    -- Add index for faster filtering by completion status
    CREATE INDEX IF NOT EXISTS idx_reminders_is_completed
    ON public.reminders(user_id, is_completed);

    RAISE NOTICE 'Added is_completed column to reminders table';
  ELSE
    RAISE NOTICE 'Column is_completed already exists in reminders table';
  END IF;
END $$;

-- Add completed_at column for tracking when reminder was completed
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'reminders'
      AND column_name = 'completed_at'
  ) THEN
    ALTER TABLE public.reminders
    ADD COLUMN completed_at timestamptz;

    RAISE NOTICE 'Added completed_at column to reminders table';
  ELSE
    RAISE NOTICE 'Column completed_at already exists in reminders table';
  END IF;
END $$;
