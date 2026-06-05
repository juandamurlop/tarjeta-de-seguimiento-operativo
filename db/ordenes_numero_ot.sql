-- ─────────────────────────────────────────────────────────────
-- Número de OT manual.
-- Permite escribir a mano el número de Orden de Trabajo al crear/recibir
-- un vehículo. Si queda vacío, el sistema muestra el automático OT-####.
-- Ejecutar en el SQL Editor de Supabase.
-- ─────────────────────────────────────────────────────────────

ALTER TABLE public.ordenes
  ADD COLUMN IF NOT EXISTS numero_ot text;
