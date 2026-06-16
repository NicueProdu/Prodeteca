-- =============================================
-- Fix: prevenir escalada de privilegios vía PATCH /users
-- Un usuario podía enviarse { "role": "admin" } y volverse admin.
-- =============================================

-- Función SECURITY DEFINER para leer el rol del usuario actual
-- sin que la consulta interna quede atrapada en RLS (recursión).
create or replace function get_current_user_role()
returns text
language sql
security definer
stable
as $$
  select role from public.users where id = auth.uid()
$$;

-- Reemplazar la policy de update sin restricciones por una que
-- impide que un no-admin cambie su role a 'admin'.
drop policy if exists "users_update_own" on users;

create policy "users_update_own" on users for update
  using (auth.uid() = id)
  with check (
    auth.uid() = id
    and (
      -- El campo role no cambia a admin, o quien actualiza ya es admin
      role != 'admin' or get_current_user_role() = 'admin'
    )
  );

-- Permitir a admins actualizar cualquier usuario (ej: promover/degradar roles)
create policy "admin_update_all_users" on users for update
  using (get_current_user_role() = 'admin');
