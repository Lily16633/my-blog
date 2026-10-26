-- ============================================================
--  Personal Blog - Supabase setup script
--  How to use: Supabase console -> SQL Editor -> New query -> paste -> Run
--  ONLY change: replace 'you@example.com' in is_admin() with your email
--  (that email is your login account, and the only one who can post)
-- ============================================================

create extension if not exists pgcrypto;

-- 1) posts table
create table if not exists public.posts (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  content text not null default '',
  category text not null,
  tags text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 2) likes table
create table if not exists public.likes (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  user_key text not null,
  created_at timestamptz not null default now(),
  unique (post_id, user_key)
);

-- 3) comments table
create table if not exists public.comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  author text not null,
  content text not null,
  created_at timestamptz not null default now()
);

-- 4) count views (for showing like / comment counts)
create or replace view public.post_like_counts as
  select post_id, count(*) as cnt from public.likes group by post_id;

create or replace view public.post_comment_counts as
  select post_id, count(*) as cnt from public.comments group by post_id;

-- 5) enable row level security
alter table public.posts enable row level security;
alter table public.likes enable row level security;
alter table public.comments enable row level security;

-- 6) public can read
create policy "posts_public_read" on public.posts for select using (true);
create policy "comments_public_read" on public.comments for select using (true);
create policy "likes_public_read" on public.likes for select using (true);

-- 7) admin check function (CHANGE THE EMAIL BELOW)
create or replace function public.is_admin()
returns boolean
language sql stable security definer set search_path = public
as $$
  select coalesce(auth.jwt() ->> 'email', '') = 'you@example.com';
$$;

-- 8) only the owner can write / update / delete posts
create policy "posts_owner_insert" on public.posts for insert with check (public.is_admin());
create policy "posts_owner_update" on public.posts for update
  using (public.is_admin()) with check (public.is_admin());
create policy "posts_owner_delete" on public.posts for delete using (public.is_admin());

-- 9) anyone can comment; owner can delete comments
create policy "comments_public_insert" on public.comments for insert with check (true);
create policy "comments_owner_delete" on public.comments for delete using (public.is_admin());

-- 10) like / unlike (atomic, called from the browser)
create or replace function public.toggle_like(p_post_id uuid, p_user_key text)
returns bigint
language plpgsql security definer set search_path = public
as $$
declare existed boolean;
begin
  select exists(select 1 from public.likes where post_id = p_post_id and user_key = p_user_key) into existed;
  if existed then
    delete from public.likes where post_id = p_post_id and user_key = p_user_key;
  else
    insert into public.likes (post_id, user_key) values (p_post_id, p_user_key);
  end if;
  return (select count(*) from public.likes where post_id = p_post_id);
end;
$$;

-- 11) list the posts a visitor has liked (to light up the heart)
create or replace function public.get_user_likes(p_user_key text)
returns setof uuid
language sql security definer set search_path = public
as $$
  select post_id from public.likes where user_key = p_user_key;
$$;

-- 12) explicit grants
grant select on public.posts to anon, authenticated;
grant insert, update, delete on public.posts to authenticated;

grant select on public.likes to anon, authenticated;

grant select on public.comments to anon, authenticated;
grant insert on public.comments to anon, authenticated;
grant delete on public.comments to authenticated;

grant select on public.post_like_counts to anon, authenticated;
grant select on public.post_comment_counts to anon, authenticated;

grant execute on function public.toggle_like(uuid, text) to anon, authenticated;
grant execute on function public.get_user_likes(text) to anon, authenticated;
grant execute on function public.is_admin() to anon, authenticated;
