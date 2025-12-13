-- Create a secure function to approve login requests bypassing RLS
CREATE OR REPLACE FUNCTION public.approve_login_request(request_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER -- This makes the function run with admin privileges
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_request_owner uuid;
BEGIN
  -- Get the current authenticated user ID
  v_user_id := auth.uid();
  
  -- If no session, return error
  IF v_user_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Oturum açık değil');
  END IF;

  -- Check if the request belongs to this user
  SELECT user_id INTO v_request_owner FROM public.login_requests WHERE id = request_id;
  
  IF v_request_owner IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'İstek bulunamadı');
  END IF;

  IF v_request_owner != v_user_id THEN
    RETURN json_build_object('success', false, 'error', 'Bu isteği onaylama yetkiniz yok');
  END IF;

  -- Perform the update securely
  UPDATE public.login_requests
  SET status = 'approved',
      updated_at = now()
  WHERE id = request_id;

  RETURN json_build_object('success', true);
END;
$$;

-- Create a secure function to reject login requests
CREATE OR REPLACE FUNCTION public.reject_login_request(request_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_request_owner uuid;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN RETURN json_build_object('success', false, 'error', 'Oturum açık değil'); END IF;

  SELECT user_id INTO v_request_owner FROM public.login_requests WHERE id = request_id;
  IF v_request_owner IS NULL THEN RETURN json_build_object('success', false, 'error', 'İstek bulunamadı'); END IF;
  IF v_request_owner != v_user_id THEN RETURN json_build_object('success', false, 'error', 'Yetkisiz işlem'); END IF;

  UPDATE public.login_requests
  SET status = 'rejected',
      updated_at = now()
  WHERE id = request_id;

  RETURN json_build_object('success', true);
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.approve_login_request(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reject_login_request(uuid) TO authenticated;
