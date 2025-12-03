-- Public function to get user display info by email (for login screen)
-- This allows showing user's name and avatar before login

create or replace function public.get_user_info_by_email(user_email text)
returns table (
  first_name text,
  avatar_url text
)
security definer
language plpgsql
as $$
begin
  return query
  select
    (au.raw_user_meta_data->>'first_name')::text as first_name,
    (au.raw_user_meta_data->>'avatar_url')::text as avatar_url
  from auth.users au
  where au.email = user_email
  limit 1;
end;
$$;

-- Grant execute permission to anonymous and authenticated users
grant execute on function public.get_user_info_by_email(text) to anon, authenticated;

-- Add comment
comment on function public.get_user_info_by_email is 'Returns public user info (name, avatar) for login screen display';
