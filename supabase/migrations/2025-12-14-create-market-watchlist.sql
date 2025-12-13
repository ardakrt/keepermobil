-- Create market_watchlist table if not exists (for market tracking feature)
-- Date: 2025-12-14

-- market_watchlist tablosunu oluştur
CREATE TABLE IF NOT EXISTS public.market_watchlist (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  symbol text NOT NULL,
  category text CHECK (category IN ('currency', 'gold', 'crypto')),
  position integer DEFAULT 0,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(user_id, symbol)
);

-- Enable RLS
ALTER TABLE public.market_watchlist ENABLE ROW LEVEL SECURITY;

-- Policies for market_watchlist (idempotent)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'market_watchlist' AND policyname = 'Users can view their own watchlist') THEN
        CREATE POLICY "Users can view their own watchlist" ON public.market_watchlist FOR SELECT USING (auth.uid() = user_id);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'market_watchlist' AND policyname = 'Users can insert their own watchlist') THEN
        CREATE POLICY "Users can insert their own watchlist" ON public.market_watchlist FOR INSERT WITH CHECK (auth.uid() = user_id);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'market_watchlist' AND policyname = 'Users can update their own watchlist') THEN
        CREATE POLICY "Users can update their own watchlist" ON public.market_watchlist FOR UPDATE USING (auth.uid() = user_id);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'market_watchlist' AND policyname = 'Users can delete their own watchlist') THEN
        CREATE POLICY "Users can delete their own watchlist" ON public.market_watchlist FOR DELETE USING (auth.uid() = user_id);
    END IF;
END $$;

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_market_watchlist_user_id ON public.market_watchlist(user_id);
CREATE INDEX IF NOT EXISTS idx_market_watchlist_position ON public.market_watchlist(user_id, position);
