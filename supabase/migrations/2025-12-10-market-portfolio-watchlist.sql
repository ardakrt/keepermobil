-- Market Portfolio ve Watchlist tablolarını ekle
-- Tarih: 2025-12-10
-- Web'deki piyasalar sayfası özelliklerini mobil'e geçirme

-- market_assets tablosu (Portfolio için)
CREATE TABLE IF NOT EXISTS public.market_assets (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  symbol text not null,
  name text not null,
  icon text,
  color text,
  amount numeric not null,
  price numeric not null,
  change24h numeric default 0,
  category text check (category in ('currency', 'gold', 'crypto')),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- market_watchlist tablosuna position kolonu ekle (drag-drop sıralaması için)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'market_watchlist' AND column_name = 'position') THEN
        ALTER TABLE public.market_watchlist ADD COLUMN position integer default 0;
    END IF;
END $$;

-- Enable RLS
ALTER TABLE public.market_assets ENABLE ROW LEVEL SECURITY;

-- Policies for market_assets (idempotent)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'market_assets' AND policyname = 'Users can view their own assets') THEN
        CREATE POLICY "Users can view their own assets" ON public.market_assets FOR SELECT USING (auth.uid() = user_id);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'market_assets' AND policyname = 'Users can insert their own assets') THEN
        CREATE POLICY "Users can insert their own assets" ON public.market_assets FOR INSERT WITH CHECK (auth.uid() = user_id);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'market_assets' AND policyname = 'Users can update their own assets') THEN
        CREATE POLICY "Users can update their own assets" ON public.market_assets FOR UPDATE USING (auth.uid() = user_id);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'market_assets' AND policyname = 'Users can delete their own assets') THEN
        CREATE POLICY "Users can delete their own assets" ON public.market_assets FOR DELETE USING (auth.uid() = user_id);
    END IF;
END $$;

-- Watchlist sıralama güncellemesi için RPC fonksiyonu
CREATE OR REPLACE FUNCTION update_watchlist_positions(updates jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  update_item jsonb;
BEGIN
  FOR update_item IN SELECT * FROM jsonb_array_elements(updates)
  LOOP
    UPDATE public.market_watchlist
    SET position = (update_item->>'position')::integer
    WHERE user_id = auth.uid()
      AND symbol = update_item->>'symbol';
  END LOOP;
END;
$$;
