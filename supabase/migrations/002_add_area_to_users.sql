-- =============================================
-- Prodeteca — Agregar área a usuarios
-- Ejecutar en Supabase SQL Editor
-- =============================================

-- Columna área en la tabla de usuarios
alter table users
  add column if not exists area text
  check (area in (
    'Implementacion', 'Comercial', 'Desarrollo',
    'Producto', 'Soporte', 'Customer Success', 'Administración'
  ));

-- Política para que admins puedan actualizar cualquier usuario (rol, área, etc.)
do $$
begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'users' and policyname = 'admin_update_all_users'
  ) then
    create policy "admin_update_all_users" on users for update
      using (exists (select 1 from users where id = auth.uid() and role = 'admin'));
  end if;
end $$;

-- Política para que todos los usuarios autenticados puedan ver info de otros
-- (necesario para que el ranking sea visible para todos, no solo admins)
do $$
begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'users' and policyname = 'users_select_all_authenticated'
  ) then
    create policy "users_select_all_authenticated" on users for select
      using (auth.role() = 'authenticated');
  end if;
end $$;
