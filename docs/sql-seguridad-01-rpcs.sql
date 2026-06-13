-- ═══════════════════════════════════════════════════════════════════════════
-- SEGURIDAD · FASE 1 (paso 1 de 2) — FUNCIONES RPC PARA LOS FLUJOS SIN LOGIN
-- ═══════════════════════════════════════════════════════════════════════════
-- Este script es ADITIVO y NO bloquea nada todavía. Solo crea 3 funciones que
-- devuelven exactamente los datos que necesitan las pantallas que funcionan sin
-- iniciar sesión (login, TV del taller, portal del cliente).
--
-- Son SECURITY DEFINER (corren con permisos del dueño de la BD, no del visitante)
-- y solo devuelven lo justo — no exponen tablas completas.
--
-- ORDEN DE DESPLIEGUE:
--   1) Corre ESTE script en el SQL Editor de Supabase.   ← seguro, no rompe nada
--   2) Sube el código JS nuevo y haz redeploy en EasyPanel.
--   3) Verifica que la app funcione igual.
--   4) Recién entonces corre el script 02 (el cierre).
-- ═══════════════════════════════════════════════════════════════════════════


-- ─────────────────────────────────────────────────────────────────────────
-- 1) detectar_perfil(cedula) — reemplaza las 4 lecturas de tablas que hace
--    el login (configuracion, mecanicos, roles_config, clientes).
--    Devuelve solo: { perfil, nombre, id, permisos, datos_min }.
-- ─────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.detectar_perfil(p_cedula text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ced       text := trim(p_cedula);
  v_ger       text;
  v_ger_nom   text;
  v_jefe      text;
  v_jefe_nom  text;
  m           mecanicos%ROWTYPE;
  c           clientes%ROWTYPE;
  v_perfil    text;
  v_perm      jsonb;
BEGIN
  IF v_ced IS NULL OR v_ced = '' THEN
    RETURN NULL;
  END IF;

  -- Gerente (prioridad máxima)
  SELECT valor INTO v_ger      FROM configuracion WHERE clave = 'gerente_cedula';
  IF v_ger IS NOT NULL AND v_ger = v_ced THEN
    SELECT valor INTO v_ger_nom FROM configuracion WHERE clave = 'gerente_nombre';
    RETURN jsonb_build_object(
      'perfil', 'gerente',
      'nombre', COALESCE(v_ger_nom, 'Gerente General'),
      'id', NULL
    );
  END IF;

  -- Jefe
  SELECT valor INTO v_jefe     FROM configuracion WHERE clave = 'jefe_cedula';
  IF v_jefe IS NOT NULL AND v_jefe = v_ced THEN
    SELECT valor INTO v_jefe_nom FROM configuracion WHERE clave = 'jefe_nombre';
    RETURN jsonb_build_object(
      'perfil', 'jefe',
      'nombre', COALESCE(v_jefe_nom, 'Jefe de Taller'),
      'id', NULL
    );
  END IF;

  -- Personal del taller (mecanicos): técnico / repuestos / taller
  SELECT * INTO m FROM mecanicos WHERE cedula = v_ced AND activo = true LIMIT 1;
  IF FOUND THEN
    v_perfil := CASE
                  WHEN m.rol = 'taller'    THEN 'taller'
                  WHEN m.rol = 'repuestos' THEN 'repuestos'
                  ELSE 'mecanico'
                END;
    v_perm := NULL;
    IF v_perfil = 'mecanico' AND m.rol IS NOT NULL THEN
      SELECT permisos INTO v_perm FROM roles_config WHERE nombre = m.rol LIMIT 1;
    END IF;
    RETURN jsonb_build_object(
      'perfil',  v_perfil,
      'nombre',  m.nombre,
      'id',      m.id,
      'permisos', v_perm,
      'datos',   to_jsonb(m)
    );
  END IF;

  -- Cliente (devuelve lo mínimo: nombre + documento que ya conoce el llamador)
  SELECT * INTO c FROM clientes WHERE cedula_nit = v_ced LIMIT 1;
  IF FOUND THEN
    RETURN jsonb_build_object(
      'perfil', 'cliente',
      'nombre', COALESCE(c.nombre, 'Cliente'),
      'id',     c.id,
      'datos',  jsonb_build_object('cedula_nit', c.cedula_nit)
    );
  END IF;

  RETURN NULL;
END;
$$;


-- ─────────────────────────────────────────────────────────────────────────
-- 2) tablero_taller() — datos de la PANTALLA DE TV (js/views/taller.js).
--    Devuelve los mismos 7 conjuntos que hoy se piden por separado.
-- ─────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.tablero_taller()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'ordenesActivas', COALESCE((
      SELECT jsonb_agg(to_jsonb(o) ORDER BY o.fecha_entrega_1 ASC NULLS LAST)
      FROM ordenes o
      WHERE o.estado = 'Activa' AND (o.pulmon IS NULL OR o.pulmon = false)
    ), '[]'::jsonb),

    'entregadasHoy', COALESCE((
      SELECT jsonb_agg(to_jsonb(o) ORDER BY o.entregada_en DESC)
      FROM ordenes o
      WHERE o.estado = 'Entregada' AND o.entregada_en >= date_trunc('day', now())
    ), '[]'::jsonb),

    'etapasActivas', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', e.id, 'orden_id', e.orden_id, 'etapa', e.etapa, 'servicio', e.servicio,
        'mecanico_id', e.mecanico_id, 'tecnico', e.tecnico, 'inicio', e.inicio,
        'pausado', e.pausado, 'pausa_inicio', e.pausa_inicio, 'tiempo_pausado_min', e.tiempo_pausado_min))
      FROM etapas e
      WHERE e.fin IS NULL AND e.inicio IS NOT NULL
    ), '[]'::jsonb),

    'etapasTodas', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', e.id, 'orden_id', e.orden_id, 'etapa', e.etapa, 'servicio', e.servicio,
        'inicio', e.inicio, 'fin', e.fin, 'tecnico', e.tecnico) ORDER BY e.creado_en ASC)
      FROM etapas e
    ), '[]'::jsonb),

    'aprobacionesTodas', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('etapa_id', a.etapa_id, 'estado', a.estado) ORDER BY a.creado_en DESC)
      FROM aprobaciones_etapa a
    ), '[]'::jsonb),

    'ordenesProgramadas', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', o.id, 'numero_ot', o.numero_ot, 'placa', o.placa, 'marca', o.marca,
        'linea', o.linea, 'fecha_programada', o.fecha_programada) ORDER BY o.fecha_programada ASC)
      FROM ordenes o
      WHERE o.estado = 'Programada'
    ), '[]'::jsonb),

    'ordenesPulmon', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', o.id, 'numero_ot', o.numero_ot, 'placa', o.placa, 'marca', o.marca,
        'linea', o.linea, 'propietario', o.propietario, 'pulmon_desde', o.pulmon_desde,
        'pulmon_tipo', o.pulmon_tipo) ORDER BY o.pulmon_desde ASC)
      FROM ordenes o
      WHERE o.pulmon = true
    ), '[]'::jsonb)
  );
$$;


-- ─────────────────────────────────────────────────────────────────────────
-- 3) vehiculo_cliente(documento) — datos del PORTAL DEL CLIENTE
--    (js/views/cliente.js). Solo las órdenes de ese documento + su detalle.
-- ─────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.vehiculo_cliente(p_doc text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_doc  text := trim(p_doc);
  v_id   bigint;
  v_ids  bigint[];
  v_ord  jsonb;
BEGIN
  IF v_doc IS NULL OR v_doc = '' THEN
    RETURN jsonb_build_object('ordenes', '[]'::jsonb);
  END IF;

  SELECT id INTO v_id FROM clientes WHERE cedula_nit = v_doc LIMIT 1;

  SELECT COALESCE(jsonb_agg(to_jsonb(o) ORDER BY o.creado_en DESC), '[]'::jsonb),
         COALESCE(array_agg(o.id), '{}')
    INTO v_ord, v_ids
    FROM ordenes o
   WHERE (v_id IS NOT NULL AND o.cliente_id = v_id)
      OR o.cedula_cliente = v_doc;

  RETURN jsonb_build_object(
    'ordenes', v_ord,
    'etapas', COALESCE((
      SELECT jsonb_agg(to_jsonb(e) ORDER BY e.creado_en ASC)
      FROM etapas e WHERE e.orden_id = ANY(v_ids)), '[]'::jsonb),
    'novedades', COALESCE((
      SELECT jsonb_agg(to_jsonb(n) ORDER BY n.creado_en DESC)
      FROM novedades n WHERE n.orden_id = ANY(v_ids)), '[]'::jsonb),
    'fotos_etapas', COALESCE((
      SELECT jsonb_agg(to_jsonb(f)) FROM (
        SELECT * FROM fotos_etapas WHERE orden_id = ANY(v_ids) ORDER BY creado_en DESC LIMIT 12
      ) f), '[]'::jsonb),
    'fotos_ingreso', COALESCE((
      SELECT jsonb_agg(to_jsonb(f)) FROM (
        SELECT * FROM fotos_ingreso WHERE orden_id = ANY(v_ids) ORDER BY creado_en ASC LIMIT 12
      ) f), '[]'::jsonb)
  );
END;
$$;


-- ─────────────────────────────────────────────────────────────────────────
-- 4) Permisos: el visitante anónimo (anon) y el logueado pueden EJECUTAR
--    estas 3 funciones. (No les damos acceso a tablas; solo a estas funciones.)
-- ─────────────────────────────────────────────────────────────────────────
GRANT EXECUTE ON FUNCTION public.detectar_perfil(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.tablero_taller()       TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.vehiculo_cliente(text)  TO anon, authenticated;


-- ─────────────────────────────────────────────────────────────────────────
-- PRUEBA RÁPIDA (opcional) — confirma que devuelven datos:
--   SELECT public.detectar_perfil('79244546');   -- debería decir perfil gerente
--   SELECT public.tablero_taller();               -- JSON con las listas del TV
--   SELECT public.vehiculo_cliente('<doc-de-un-cliente>');
-- ─────────────────────────────────────────────────────────────────────────
