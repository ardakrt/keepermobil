-- ============================================
-- CRITICAL FIX: Push to Login RLS Policy
-- ============================================
-- Run this in Supabase SQL Editor NOW!

-- Step 1: Drop ALL existing policies on login_requests
DROP POLICY IF EXISTS "Allow insert login requests for all users" ON public.login_requests;
DROP POLICY IF EXISTS "Users can insert their own login requests" ON public.login_requests;
DROP POLICY IF EXISTS "Users can view their own login requests" ON public.login_requests;
DROP POLICY IF EXISTS "Users can update their own login requests" ON public.login_requests;
DROP POLICY IF EXISTS "Users can delete their own login requests" ON public.login_requests;

-- Step 2: Create NEW policy that allows anonymous users to INSERT
CREATE POLICY "anon_can_insert_login_requests"
  ON public.login_requests
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- Step 3: Authenticated users can SELECT their own requests
CREATE POLICY "auth_can_select_own_login_requests"
  ON public.login_requests
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Step 4: Authenticated users can UPDATE their own requests
CREATE POLICY "auth_can_update_own_login_requests"
  ON public.login_requests
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Step 5: Authenticated users can DELETE their own requests
CREATE POLICY "auth_can_delete_own_login_requests"
  ON public.login_requests
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Step 6: Verify policies are created
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies
WHERE tablename = 'login_requests';

-- Expected output:
-- You should see 4 policies:
-- 1. anon_can_insert_login_requests (INSERT, {anon,authenticated})
-- 2. auth_can_select_own_login_requests (SELECT, {authenticated})
-- 3. auth_can_update_own_login_requests (UPDATE, {authenticated})
-- 4. auth_can_delete_own_login_requests (DELETE, {authenticated})
