-- ═══════════════════════════════════════════════════════════════════════════
-- Subrol "Asesor" para encuestas
-- ═══════════════════════════════════════════════════════════════════════════
-- Los roles de mecanicos describen el OFICIO (Pintura, Mecánico, detailing...),
-- no quién atiende clientes. Este "subrol" marca, aparte del oficio, quién es
-- asesor de servicio, para llenar el selector "Asesor que atendió" de la encuesta.
-- ═══════════════════════════════════════════════════════════════════════════

-- Subrol: marca un operario como asesor de servicio (independiente de su rol/oficio)
ALTER TABLE mecanicos
  ADD COLUMN IF NOT EXISTS es_asesor BOOLEAN NOT NULL DEFAULT false;

-- Atribución del asesor en la encuesta por NOMBRE (no solo FK), porque un asesor
-- puede no ser operario — ej. el jefe de taller, que vive en `configuracion`.
ALTER TABLE encuestas
  ADD COLUMN IF NOT EXISTS asesor_nombre TEXT;

-- Marcar los asesores actuales (por cédula para no depender del id):
--   Camilo Hernández (79881552) · Patricia Moyano (52013731)
-- El jefe de taller (Rafael Bejarano) se incluye automáticamente desde
-- `configuracion`, no necesita esta marca.
UPDATE mecanicos SET es_asesor = true WHERE cedula IN ('79881552', '52013731');
