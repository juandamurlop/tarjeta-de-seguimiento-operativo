-- ─────────────────────────────────────────────────────────────
-- Cita de recogida del vehículo (entrega al cliente).
--   entrega_avisada_en : cuándo se le avisó por WhatsApp que está listo.
--   cita_entrega       : fecha/hora acordada en que el cliente vendrá a recoger.
-- Sirve para la cuenta regresiva en la orden y en la pantalla del taller, y
-- para avisar al jefe cuando llega la hora de la cita.
-- Ejecutar en el SQL Editor de Supabase.
-- ─────────────────────────────────────────────────────────────

ALTER TABLE public.ordenes
  ADD COLUMN IF NOT EXISTS entrega_avisada_en timestamptz,
  ADD COLUMN IF NOT EXISTS cita_entrega       timestamptz;
