-- Registro de cuándo se contactó a un proveedor por una solicitud de repuesto.
-- Sirve para el "fallback por tiempo": si un proveedor no responde en X horas,
-- la app lo resalta en el modal de cotizar para probar el siguiente.

CREATE TABLE IF NOT EXISTS contactos_repuesto (
  id            bigserial PRIMARY KEY,
  solicitud_id  bigint NOT NULL,
  proveedor_id  bigint,
  contactado_en timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE contactos_repuesto ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS contactos_all ON contactos_repuesto;
CREATE POLICY contactos_all ON contactos_repuesto FOR ALL USING (true) WITH CHECK (true);
