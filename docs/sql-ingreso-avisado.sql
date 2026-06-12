-- Marca de cuándo se le envió al cliente el link de seguimiento al ingresar
-- el vehículo (botón "Enviar link al cliente" en el detalle de la orden).
-- Opcional: si no se corre, el botón funciona igual, solo que no muestra el
-- "✓ Link enviado el ...".

ALTER TABLE ordenes
  ADD COLUMN IF NOT EXISTS ingreso_avisado_en timestamptz;
