-- Foto opcional de una novedad / detención.
-- La imagen se sube COMPRIMIDA a Supabase Storage (bucket de la app) y aquí
-- solo se guarda el LINK (texto corto), para no inflar la base de datos.
-- La ve el mecánico, el jefe/gerente (detalle de orden) y el cliente (portal).

ALTER TABLE novedades
  ADD COLUMN IF NOT EXISTS foto_url text;
