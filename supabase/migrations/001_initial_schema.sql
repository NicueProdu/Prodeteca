-- =============================================
-- Prodeteca — Schema inicial
-- Ejecutar en Supabase SQL Editor
-- =============================================

-- USUARIOS
create table if not exists users (
  id uuid references auth.users(id) primary key,
  email text unique not null,
  name text,
  avatar_url text,
  role text default 'user' check (role in ('user', 'admin')),
  created_at timestamptz default now()
);

-- PARTIDOS
create table if not exists matches (
  id serial primary key,
  home_team text not null,
  away_team text not null,
  home_flag text,
  away_flag text,
  match_datetime_utc timestamptz not null,
  lock_time_utc timestamptz,
  phase text not null check (phase in (
    'group', 'round_of_32', 'round_of_16',
    'quarterfinal', 'semifinal', 'third_place', 'final'
  )),
  group_name text,
  matchday int,
  venue text,
  home_score int,
  away_score int,
  status text default 'upcoming' check (
    status in ('upcoming', 'locked', 'live', 'finished')
  )
);

-- PREDICCIONES
create table if not exists predictions (
  id serial primary key,
  user_id uuid references users(id) on delete cascade,
  match_id int references matches(id) on delete cascade,
  home_score_pred int not null check (home_score_pred >= 0),
  away_score_pred int not null check (away_score_pred >= 0),
  points_earned int,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(user_id, match_id)
);

-- PREDICCIÓN DE CAMPEÓN Y SUBCAMPEÓN
create table if not exists champion_predictions (
  id serial primary key,
  user_id uuid references users(id) on delete cascade unique,
  champion_team text not null,
  runner_up_team text not null,
  champion_points int,
  runner_up_points int,
  bonus_points int,
  total_points int,
  submitted_at timestamptz default now(),
  constraint different_teams check (champion_team != runner_up_team)
);

-- Índices
create index if not exists idx_predictions_user on predictions(user_id);
create index if not exists idx_predictions_match on predictions(match_id);
create index if not exists idx_matches_datetime on matches(match_datetime_utc);
create index if not exists idx_matches_status on matches(status);

-- Trigger: calcular lock_time_utc automáticamente
create or replace function set_lock_time()
returns trigger as $$
begin
  new.lock_time_utc := new.match_datetime_utc - interval '10 minutes';
  return new;
end;
$$ language plpgsql;

create trigger matches_set_lock_time
  before insert or update of match_datetime_utc on matches
  for each row execute function set_lock_time();

-- Trigger: updated_at automático en predictions
create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger predictions_updated_at
  before update on predictions
  for each row execute function update_updated_at();

-- Trigger: crear perfil automáticamente al registrarse
create or replace function handle_new_user()
returns trigger as $$
begin
  insert into public.users (id, email, name, avatar_url)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data->>'avatar_url', new.raw_user_meta_data->>'picture')
  )
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer;

create or replace trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- =============================================
-- RLS — Row Level Security
-- =============================================

alter table users enable row level security;
alter table predictions enable row level security;
alter table champion_predictions enable row level security;
alter table matches enable row level security;

-- USERS
create policy "users_select_own" on users for select
  using (auth.uid() = id);

create policy "users_update_own" on users for update
  using (auth.uid() = id);

create policy "admin_select_all_users" on users for select
  using (exists (select 1 from users where id = auth.uid() and role = 'admin'));

-- MATCHES: todos leen, solo admins modifican
create policy "matches_select_all" on matches for select
  using (true);

create policy "matches_update_admin" on matches for update
  using (exists (select 1 from users where id = auth.uid() and role = 'admin'));

create policy "matches_insert_admin" on matches for insert
  with check (exists (select 1 from users where id = auth.uid() and role = 'admin'));

-- PREDICTIONS: crear/editar solo las propias y antes del lock
create policy "predictions_insert_own" on predictions for insert
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from matches
      where id = match_id
      and now() < lock_time_utc
    )
  );

create policy "predictions_update_own" on predictions for update
  using (
    auth.uid() = user_id
    and exists (
      select 1 from matches
      where id = match_id
      and now() < lock_time_utc
    )
  );

-- Ver propias: siempre
create policy "predictions_select_own" on predictions for select
  using (auth.uid() = user_id);

-- Ver ajenas: solo después del lock_time
create policy "predictions_select_others" on predictions for select
  using (
    exists (
      select 1 from matches
      where id = match_id
      and now() >= lock_time_utc
    )
  );

-- CHAMPION PREDICTIONS
create policy "champion_insert_own" on champion_predictions for insert
  with check (
    auth.uid() = user_id
    and now() < (select min(lock_time_utc) from matches where phase = 'group')
  );

create policy "champion_update_own" on champion_predictions for update
  using (
    auth.uid() = user_id
    and now() < (select min(lock_time_utc) from matches where phase = 'group')
  );

create policy "champion_select_own" on champion_predictions for select
  using (auth.uid() = user_id);

-- =============================================
-- Storage: bucket para avatares
-- =============================================

insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

create policy "avatar_upload_own" on storage.objects for insert
  with check (bucket_id = 'avatars' and auth.uid()::text = split_part(name, '/', 1));

create policy "avatar_update_own" on storage.objects for update
  using (bucket_id = 'avatars' and auth.uid()::text = split_part(name, '/', 1));

create policy "avatar_public_read" on storage.objects for select
  using (bucket_id = 'avatars');
