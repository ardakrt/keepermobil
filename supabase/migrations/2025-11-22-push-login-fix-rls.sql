-- ============================================
-- FIX: RLS Policies for Push to Login
-- ============================================
-- Problem: Anonymous users cannot create login requests
-- Solution: Allow anonymous users to INSERT login requests

-- Drop existing INSERT policy
DROP POLICY IF EXISTS "Users can insert their own login requests" ON public.login_requests;

-- Create new INSERT policy that allows BOTH authenticated AND anonymous users
CREATE POLICY "Allow insert login requests for all users"
  ON public.login_requests
  FOR INSERT
  TO authenticated, anon
  WITH CHECK (true);

-- Note: We still keep the SELECT/UPDATE policies restricted to authenticated users
-- because only the owner should be able to see and update their requests

-- Authenticated users can only SELECT their own requests
DROP POLICY IF EXISTS "Users can view their own login requests" ON public.login_requests;
CREATE POLICY "Users can view their own login requests"
  ON public.login_requests
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Authenticated users can only UPDATE their own requests
DROP POLICY IF EXISTS "Users can update their own login requests" ON public.login_requests;
CREATE POLICY "Users can update their own login requests"
  ON public.login_requests
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Authenticated users can DELETE their own requests
DROP POLICY IF EXISTS "Users can delete their own login requests" ON public.login_requests;
CREATE POLICY "Users can delete their own login requests"
  ON public.login_requests
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- ============================================
-- IMPORTANT: Auto-cleanup function
-- ============================================
-- Function to automatically expire old pending requests
CREATE OR REPLACE FUNCTION expire_old_login_requests()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.login_requests
  SET status = 'expired',
      updated_at = now()
  WHERE status = 'pending'
    AND expires_at < now();
END;
$$;

-- Grant execute to authenticated users (for manual cleanup)
GRANT EXECUTE ON FUNCTION expire_old_login_requests() TO authenticated;

COMMENT ON FUNCTION expire_old_login_requests() IS 'Expires pending login requests that have exceeded their expiration time';
