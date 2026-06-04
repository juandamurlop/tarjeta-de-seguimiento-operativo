-- Valor de plaza por día propio de cada aseguradora (para rentabilidad).
-- Si una aseguradora no lo tiene, se usa el valor global (manual o meta).
-- Ejecutar en el SQL Editor de Supabase.

ALTER TABLE aseguradoras
  ADD COLUMN IF NOT EXISTS valor_plaza_dia numeric;

COMMENT ON COLUMN aseguradoras.valor_plaza_dia IS
  'Valor de la plaza (cupo) por día para calcular renta/pérdida de las órdenes de esta aseguradora. NULL = usar el valor global.';
