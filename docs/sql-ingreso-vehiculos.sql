-- ════════════════════════════════════════════════════════════
-- INGRESO DE VEHÍCULOS UNIFICADO (jun 2026)
-- Correr en Supabase → SQL Editor ANTES de hacer el redeploy.
-- Agrega a la tabla "vehiculos" el tipo de cliente y las referencias
-- de empresa / aseguradora (flotilla_id ya existía).
-- Idempotente: se puede correr varias veces sin error.
-- ════════════════════════════════════════════════════════════

ALTER TABLE vehiculos ADD COLUMN IF NOT EXISTS tipo_cliente text DEFAULT 'particular';
ALTER TABLE vehiculos ADD COLUMN IF NOT EXISTS empresa_id   bigint REFERENCES empresas(id);
ALTER TABLE vehiculos ADD COLUMN IF NOT EXISTS aseguradora  text;

-- Los vehículos ya existentes que pertenecen a una flotilla quedan marcados
-- como tipo 'flotilla'; el resto como 'particular'.
UPDATE vehiculos SET tipo_cliente = 'flotilla'
  WHERE flotilla_id IS NOT NULL AND (tipo_cliente IS NULL OR tipo_cliente = 'particular');
UPDATE vehiculos SET tipo_cliente = 'particular'
  WHERE tipo_cliente IS NULL;
