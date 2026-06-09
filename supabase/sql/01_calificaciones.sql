-- ═══════════════════════════════════════════════════════════════════════════
-- FASE 0 — Encuestas de satisfacción y calificación de mecánicos
-- ═══════════════════════════════════════════════════════════════════════════
-- Ejecutar en el SQL Editor de Supabase.
--
-- Modelo:
--   • encuestas                → 1 fila por orden encuestada (dato crudo, fuente de verdad)
--   • encuesta_items_mecanico  → 1 fila por (encuesta, mecánico) = evento de calificación
--                                del trabajo de ese mecánico en esa orden.
--   • ordenes.asesor_id        → quién atendió la orden (para calificar al asesor)
--
-- El puntaje del mecánico NO se guarda: se calcula como promedio móvil sobre
-- encuesta_items_mecanico.puntos. Por eso 'puntos' se guarda como snapshot al
-- momento de registrar, para que recalibrar pesos no reescriba el historial.
-- ═══════════════════════════════════════════════════════════════════════════


-- ── 1. Columna de asesor en órdenes ─────────────────────────────────────────
-- El asesor es un usuario del taller (vive en la tabla 'mecanicos', igual que
-- los roles personalizados). Nullable: órdenes viejas no lo tienen.
ALTER TABLE ordenes
  ADD COLUMN IF NOT EXISTS asesor_id BIGINT REFERENCES mecanicos(id);


-- ── 2. Tabla de encuestas ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS encuestas (
  id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  orden_id        BIGINT NOT NULL REFERENCES ordenes(id) ON DELETE CASCADE,
  cliente_id      BIGINT REFERENCES clientes(id),

  -- Personas evaluadas (snapshot al momento de la encuesta)
  asesor_id       BIGINT REFERENCES mecanicos(id),   -- atención del asesor
  jefe_id         BIGINT REFERENCES mecanicos(id),   -- atención del jefe de taller

  -- Control de la llamada
  estado          TEXT NOT NULL DEFAULT 'pendiente', -- pendiente | completada | no_contesta | rechazada
  continuada      BOOLEAN NOT NULL DEFAULT FALSE,    -- ¿se pasó al bloque extendido?
  cliente_molesto BOOLEAN NOT NULL DEFAULT FALSE,    -- corte manual por cliente molesto
  fecha_llamada   TIMESTAMPTZ,

  -- Bloque inicial (obligatorio) — escala 1..5
  satisfaccion_general SMALLINT CHECK (satisfaccion_general BETWEEN 1 AND 5),
  calif_asesor         SMALLINT CHECK (calif_asesor BETWEEN 1 AND 5),
  calif_jefe           SMALLINT CHECK (calif_jefe BETWEEN 1 AND 5),

  -- Bloque extendido (solo si continuada = true) — escala 1..5 / boolean
  calif_instalaciones  SMALLINT CHECK (calif_instalaciones BETWEEN 1 AND 5),
  cumplio_fecha        BOOLEAN,                       -- ¿se cumplió la fecha de entrega?
  calif_limpieza       SMALLINT CHECK (calif_limpieza BETWEEN 1 AND 5),
  recomendaria         BOOLEAN,                       -- ¿recomendaría el taller?
  -- Preguntas adicionales configurables sin tocar el esquema: { "clave": valor }
  respuestas_extra     JSONB NOT NULL DEFAULT '{}'::jsonb,

  comentarios     TEXT,
  registrado_por  BIGINT REFERENCES mecanicos(id),   -- quién (atención al cliente) capturó
  creado_en       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Una orden se encuesta una sola vez
CREATE UNIQUE INDEX IF NOT EXISTS uq_encuestas_orden ON encuestas(orden_id);
CREATE INDEX IF NOT EXISTS ix_encuestas_creado     ON encuestas(creado_en);
CREATE INDEX IF NOT EXISTS ix_encuestas_asesor     ON encuestas(asesor_id);


-- ── 3. Eventos de calificación por mecánico ─────────────────────────────────
CREATE TABLE IF NOT EXISTS encuesta_items_mecanico (
  id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  encuesta_id BIGINT NOT NULL REFERENCES encuestas(id) ON DELETE CASCADE,
  orden_id    BIGINT NOT NULL REFERENCES ordenes(id),       -- denormalizado para consultar fácil
  etapa_id    BIGINT REFERENCES etapas(id),                 -- etapa concreta (opcional)
  mecanico_id BIGINT NOT NULL REFERENCES mecanicos(id),
  servicio    TEXT,                                         -- mecanica | latoneria | pintura | adicionales

  resultado   TEXT NOT NULL,                                -- bien | regular | queja | no_aplica
  -- Snapshot del puntaje mapeado al registrar (no_aplica => NULL = no cuenta en el promedio).
  -- Pesos por defecto: bien=5, regular=3, queja=1. Calibrables en configuración.
  puntos      NUMERIC,
  comentario  TEXT,
  creado_en   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_items_mecanico  ON encuesta_items_mecanico(mecanico_id);
CREATE INDEX IF NOT EXISTS ix_items_encuesta  ON encuesta_items_mecanico(encuesta_id);
CREATE INDEX IF NOT EXISTS ix_items_orden     ON encuesta_items_mecanico(orden_id);


-- ── 4. Rol "Atención al Cliente" ────────────────────────────────────────────
-- Reutiliza el sistema de roles personalizados existente (roles_config).
-- Las personas de atención al cliente se crean como usuarios (mecanicos) con
-- este rol; entran al shell del jefe pero solo ven las secciones permitidas.
INSERT INTO roles_config (nombre, color, permisos)
SELECT 'Atención al Cliente', '#8B5CF6', jsonb_build_object(
         'ver_encuestas',      true,
         'gestionar_encuestas', true,
         'ver_calificaciones', true
       )
WHERE NOT EXISTS (
  SELECT 1 FROM roles_config WHERE nombre = 'Atención al Cliente'
);


-- ── 5. (Opcional) RLS ───────────────────────────────────────────────────────
-- Descomentar SOLO si tus otras tablas usan RLS. Si en tu proyecto las tablas
-- tienen RLS deshabilitado, omite este bloque para mantener la consistencia.
--
-- ALTER TABLE encuestas               ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE encuesta_items_mecanico ENABLE ROW LEVEL SECURITY;
--
-- CREATE POLICY enc_all  ON encuestas
--   FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
-- CREATE POLICY item_all ON encuesta_items_mecanico
--   FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
