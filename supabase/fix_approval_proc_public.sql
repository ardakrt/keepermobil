-- Create a PUBLIC secure function to approve login requests bypassing auth checks
-- This relies on the secrecy of the request_id (UUID) which serves as the authentication token
CREATE OR REPLACE FUNCTION public.approve_login_request_public(p_request_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER -- Runs with admin privileges
SET search_path = public
AS $$
DECLARE
  v_request_status text;
BEGIN
  -- Check if request exists and get status
  SELECT status INTO v_request_status FROM public.login_requests WHERE id = p_request_id;
  
  IF v_request_status IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'İstek bulunamadı');
  END IF;

  IF v_request_status != 'pending' THEN
    RETURN json_build_object('success', false, 'error', 'İstek zaten işlenmiş veya süresi dolmuş');
  END IF;

  -- Perform the update securely without checking auth.uid()
  -- Security relies on the caller knowing the valid UUID
  UPDATE public.login_requests
  SET status = 'approved',
      updated_at = now()
  WHERE id = p_request_id;

  RETURN json_build_object('success', true);
END;
$$;

-- Create similar function for reject
CREATE OR REPLACE FUNCTION public.reject_login_request_public(p_request_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_request_status text;
BEGIN
  SELECT status INTO v_request_status FROM public.login_requests WHERE id = p_request_id;
  
  IF v_request_status IS NULL THEN RETURN json_build_object('success', false, 'error', 'İstek bulunamadı'); END IF;
  
  -- Rejection is okay even if already processed, but let's be consistent
  IF v_request_status != 'pending' THEN
    RETURN json_build_object('success', false, 'error', 'İstek zaten işlenmiş');
  END IF;

  UPDATE public.login_requests
  SET status = 'rejected',
      updated_at = now()
  WHERE id = p_request_id;

  RETURN json_build_object('success', true);
END;
$$;

-- GRANT EXECUTE TO ANON (Public) and AUTHENTICATED
-- This is crucial: allowing 'anon' role to execute means we don't need a valid user session
GRANT EXECUTE ON FUNCTION public.approve_login_request_public(uuid) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.reject_login_request_public(uuid) TO anon, authenticated, service_role;
