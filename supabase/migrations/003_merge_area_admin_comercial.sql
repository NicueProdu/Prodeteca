-- =============================================
-- Prodeteca — Fusionar Administración y Comercial en un solo área
-- Ejecutar en Supabase SQL Editor
-- =============================================

-- Unificar valores existentes
update users
set area = 'Administracion/Comercial'
where area in ('Administración', 'Comercial');

-- Eliminar el constraint anterior (ignorar si no existe)
do $$
begin
  begin
    alter table users drop constraint users_area_check;
  exception when undefined_object then
    null;
  end;
end $$;

-- Agregar constraint actualizado
alter table users
  add constraint users_area_check check (area in (
    'Implementacion', 'Administracion/Comercial', 'Desarrollo',
    'Producto', 'Soporte', 'Customer Success'
  ));
