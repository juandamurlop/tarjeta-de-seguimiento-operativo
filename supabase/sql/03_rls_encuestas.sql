-- ═══════════════════════════════════════════════════════════════════════════
-- RLS (Row-Level Security) para las tablas de encuestas
-- ═══════════════════════════════════════════════════════════════════════════
-- Tu proyecto tiene RLS activado. Las tablas nuevas quedaron con RLS habilitado
-- pero SIN políticas → cualquier INSERT/SELECT es rechazado
-- ("new row violates row-level security policy").
--
-- Estas políticas permiten a la app (anon + usuarios autenticados) leer y
-- escribir, igual que el resto de tablas operativas del sistema.
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE encuestas               ENABLE ROW LEVEL SECURITY;
ALTER TABLE encuesta_items_mecanico ENABLE ROW LEVEL SECURITY;

-- encuestas: acceso completo para anon y authenticated
DROP POLICY IF EXISTS enc_all ON encuestas;
CREATE POLICY enc_all ON encuestas
  FOR ALL TO anon, authenticated
  USING (true) WITH CHECK (true);

-- encuesta_items_mecanico: acceso completo para anon y authenticated
DROP POLICY IF EXISTS enc_items_all ON encuesta_items_mecanico;
CREATE POLICY enc_items_all ON encuesta_items_mecanico
  FOR ALL TO anon, authenticated
  USING (true) WITH CHECK (true);
