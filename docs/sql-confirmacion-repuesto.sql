-- Confirmación del repuesto por el cliente (vía WhatsApp Business API).
-- El jefe/gerente envía la pregunta; el cliente toca un botón; la respuesta
-- vuelve sola al sistema (webhook de Meta -> n8n -> aquí).
--
-- cliente_respuesta:
--   NULL       = nunca se pidió confirmación
--   pendiente  = enviada, esperando respuesta del cliente
--   aceptado   = el cliente autorizó
--   rechazado  = el cliente NO autorizó (dispara aviso por Telegram a los 3 del taller)

ALTER TABLE solicitudes_repuesto
  ADD COLUMN IF NOT EXISTS cliente_respuesta        text,
  ADD COLUMN IF NOT EXISTS confirmacion_enviada_por text,         -- nombre del jefe/gerente que la envió
  ADD COLUMN IF NOT EXISTS confirmacion_enviada_en  timestamptz,
  ADD COLUMN IF NOT EXISTS cliente_respondio_en     timestamptz,
  ADD COLUMN IF NOT EXISTS confirmacion_wamid       text;         -- id del mensaje de WhatsApp enviado (para correlacionar la respuesta del cliente)
