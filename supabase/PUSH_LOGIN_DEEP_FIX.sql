-- ============================================
-- DEEP FIX: Push to Login RLS + Permissions
-- ============================================
-- This addresses the persistent 401/42501 error despite correct policies

-- Step 1: Check current RLS status
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public' AND tablename = 'login_requests';

-- Step 2: Grant explicit table permissions to anon role
GRANT USAGE ON SCHEMA public TO anon;
GRANT INSERT ON public.login_requests TO anon;
GRANT SELECT ON public.login_requests TO authenticated;
GRANT UPDATE ON public.login_requests TO authenticated;
GRANT DELETE ON public.login_requests TO authenticated;

-- Step 3: Drop ALL existing policies completely
DROP POLICY IF EXISTS "anon_can_insert_login_requests" ON public.login_requests;
DROP POLICY IF EXISTS "auth_can_select_own_login_requests" ON public.login_requests;
DROP POLICY IF EXISTS "auth_can_update_own_login_requests" ON public.login_requests;
DROP POLICY IF EXISTS "auth_can_delete_own_login_requests" ON public.login_requests;
DROP POLICY IF EXISTS "Allow insert login requests for all users" ON public.login_requests;
DROP POLICY IF EXISTS "Users can insert their own login requests" ON public.login_requests;
DROP POLICY IF EXISTS "Users can view their own login requests" ON public.login_requests;
DROP POLICY IF EXISTS "Users can update their own login requests" ON public.login_requests;
DROP POLICY IF EXISTS "Users can delete their own login requests" ON public.login_requests;

-- Step 4: Temporarily disable RLS to clean state
ALTER TABLE public.login_requests DISABLE ROW LEVEL SECURITY;

-- Step 5: Re-enable RLS
ALTER TABLE public.login_requests ENABLE ROW LEVEL SECURITY;

-- Step 6: Create PERMISSIVE policies (not restrictive)
CREATE POLICY "anon_insert_login_requests"
  ON public.login_requests
  AS PERMISSIVE
  FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "authenticated_insert_login_requests"
  ON public.login_requests
  AS PERMISSIVE
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "authenticated_select_own_login_requests"
  ON public.login_requests
  AS PERMISSIVE
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "authenticated_update_own_login_requests"
  ON public.login_requests
  AS PERMISSIVE
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "authenticated_delete_own_login_requests"
  ON public.login_requests
  AS PERMISSIVE
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Step 7: Verify all policies are created
SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename = 'login_requests'
ORDER BY policyname;

-- Step 8: Verify table permissions
SELECT
  grantee,
  privilege_type
FROM information_schema.table_privileges
WHERE table_schema = 'public'
  AND table_name = 'login_requests'
ORDER BY grantee, privilege_type;

-- Expected output:
-- Policies:
-- 1. anon_insert_login_requests (INSERT, {anon}, PERMISSIVE)
-- 2. authenticated_delete_own_login_requests (DELETE, {authenticated}, PERMISSIVE)
-- 3. authenticated_insert_login_requests (INSERT, {authenticated}, PERMISSIVE)
-- 4. authenticated_select_own_login_requests (SELECT, {authenticated}, PERMISSIVE)
-- 5. authenticated_update_own_login_requests (UPDATE, {authenticated}, PERMISSIVE)
--
-- Permissions:
-- anon - INSERT
-- authenticated - SELECT, UPDATE, DELETE
