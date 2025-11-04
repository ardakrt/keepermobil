-- Create a new table for user preferences

create table if not exists public.user_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  theme_mode text default 'system' check (theme_mode in ('system', 'light', 'dark')), 
  accent_color text check (accent_color is null or accent_color ~ '^#[0-9a-fA-F]{6}$'),
  updated_at timestamptz not null default now()
);

-- Enable RLS for the new table
alter table public.user_preferences enable row level security;

-- Policies: owner can do everything on their own row
do $$ begin
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='user_preferences' and policyname='user_preferences_owner_all'
  ) then
    create policy user_preferences_owner_all on public.user_preferences for all
      using (auth.uid() = user_id) with check (auth.uid() = user_id);
  end if;
end $$;

-- Move existing theme data from user_tokens to user_preferences
do $$
declare
    r record;
begin
    for r in select user_id, theme_mode, accent_color from public.user_tokens where theme_mode is not null or accent_color is not null
    loop
        insert into public.user_preferences(user_id, theme_mode, accent_color, updated_at)
        values (r.user_id, r.theme_mode, r.accent_color, now())
        on conflict (user_id) do update set
            theme_mode = excluded.theme_mode,
            accent_color = excluded.accent_color,
            updated_at = now();
    end loop;
end;
$$;

-- (Optional but recommended) Remove theme columns from user_tokens table
-- alter table public.user_tokens drop column if exists theme_mode;
-- alter table public.user_tokens drop column if exists accent_color;
