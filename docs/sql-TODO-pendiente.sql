-- ════════════════════════════════════════════════════════════════════
--  TODO LO PENDIENTE EN UN SOLO ARCHIVO
--  Córrelo completo en Supabase → SQL Editor. Es seguro: usa IF NOT EXISTS,
--  así que puedes ejecutarlo varias veces sin dañar nada.
-- ════════════════════════════════════════════════════════════════════

-- 1) Fotos en novedades (las ve el cliente)
ALTER TABLE novedades
  ADD COLUMN IF NOT EXISTS foto_url text;

-- 2) Confirmación de repuesto por el cliente (WhatsApp API) + categoría
ALTER TABLE solicitudes_repuesto
  ADD COLUMN IF NOT EXISTS cliente_respuesta        text,
  ADD COLUMN IF NOT EXISTS confirmacion_enviada_por text,
  ADD COLUMN IF NOT EXISTS confirmacion_enviada_en  timestamptz,
  ADD COLUMN IF NOT EXISTS cliente_respondio_en     timestamptz,
  ADD COLUMN IF NOT EXISTS confirmacion_wamid       text,
  ADD COLUMN IF NOT EXISTS categoria                text;

-- 3) Aviso de ingreso enviado al cliente
ALTER TABLE ordenes
  ADD COLUMN IF NOT EXISTS ingreso_avisado_en timestamptz;

-- 4) Categorías que maneja cada proveedor
ALTER TABLE proveedores
  ADD COLUMN IF NOT EXISTS categorias text[] DEFAULT '{}';

-- 5) Contactos a proveedores (fallback por tiempo)
CREATE TABLE IF NOT EXISTS contactos_repuesto (
  id            bigserial PRIMARY KEY,
  solicitud_id  bigint NOT NULL,
  proveedor_id  bigint,
  contactado_en timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE contactos_repuesto ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS contactos_all ON contactos_repuesto;
CREATE POLICY contactos_all ON contactos_repuesto FOR ALL USING (true) WITH CHECK (true);

-- NOTA: el ingreso de vehículos (docs/sql-ingreso-vehiculos.sql) es aparte;
-- córrelo si aún no lo has hecho.
