-- Add position column to market_watchlist table
ALTER TABLE public.market_watchlist 
ADD COLUMN IF NOT EXISTS position INTEGER DEFAULT 0;

-- Create a function to update watchlist positions
CREATE OR REPLACE FUNCTION update_watchlist_positions(updates jsonb[])
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  update_item jsonb;
BEGIN
  FOREACH update_item IN ARRAY updates
  LOOP
    UPDATE public.market_watchlist
    SET position = (update_item->>'position')::integer
    WHERE symbol = (update_item->>'symbol')::text
    AND user_id = auth.uid();
  END LOOP;
END;
$$;
