-- ═══════════════════════════════════════════════════════════════════════════
-- SEGURIDAD · FASE 1 (paso 2 de 2) — EL CIERRE
-- ═══════════════════════════════════════════════════════════════════════════
-- Esto CIERRA el acceso público a la base. Córrelo SOLO después de:
--   ✔ haber corrido sql-seguridad-01-rpcs.sql,
--   ✔ haber desplegado el código JS nuevo en EasyPanel,
--   ✔ haber verificado que la app funciona (login, TV, cliente).
--
-- Qué hace:
--   1) ELIMINA las políticas "abiertas" (anon/public USING(true)) que anulaban
--      la seguridad. Quedan solo las políticas por rol (jefe, staff, cliente).
--   2) RELLENA los huecos: tablas que solo tenían política abierta y ninguna
--      por rol → se les pone una política para el personal logueado.
--   3) QUITA los permisos directos del rol público (anon) sobre las tablas.
--   4) Cierra funciones sensibles para que el público no pueda ejecutarlas.
--
-- El modelo de identidad ya existía: auth_cedula()/es_jefe()/rol_mecanico()/
-- id_cliente() leen la cédula del login. Aquí solo se añade es_staff().
--
-- REVERSA: si algo del personal deja de funcionar, corre el bloque "REVERSA"
-- del final (reabre temporalmente) y avísame para corregir la política puntual.
-- ═══════════════════════════════════════════════════════════════════════════


-- ─────────────────────────────────────────────────────────────────────────
-- 0) Helper: ¿el usuario logueado es PERSONAL del taller? (jefe/gerente o
--    cualquier rol de la tabla mecanicos: técnico, repuestos, asesor, taller).
--    Para un visitante anónimo devuelve false (no rompe nada del público).
-- ─────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.es_staff()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.es_jefe() OR public.rol_mecanico() IS NOT NULL;
$$;
GRANT EXECUTE ON FUNCTION public.es_staff() TO anon, authenticated;


-- ─────────────────────────────────────────────────────────────────────────
-- 1) ELIMINAR las políticas ABIERTAS (las que dejaban entrar a cualquiera)
-- ─────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Lectura publica aprobaciones_aseguradora" ON aprobaciones_aseguradora;
DROP POLICY IF EXISTS "Lectura publica aprobaciones_etapa"       ON aprobaciones_etapa;
DROP POLICY IF EXISTS "allow_all"                                 ON aseguradoras;
DROP POLICY IF EXISTS "Lectura publica clientes"                 ON clientes;
DROP POLICY IF EXISTS "config_app_acceso"                        ON config_app;
DROP POLICY IF EXISTS "Lectura publica configuracion"           ON configuracion;
DROP POLICY IF EXISTS "contactos_all"                            ON contactos_repuesto;
DROP POLICY IF EXISTS "Lectura publica cotizaciones"            ON cotizaciones;
DROP POLICY IF EXISTS "acceso_total_cotizaciones"               ON cotizaciones_repuesto;
DROP POLICY IF EXISTS "credito_read"                            ON credito;
DROP POLICY IF EXISTS "credito_write"                           ON credito;
DROP POLICY IF EXISTS "empresas_acceso"                         ON empresas;
DROP POLICY IF EXISTS "enc_items_all"                           ON encuesta_items_mecanico;
DROP POLICY IF EXISTS "enc_all"                                 ON encuestas;
DROP POLICY IF EXISTS "Lectura publica etapas"                 ON etapas;
DROP POLICY IF EXISTS "allow_all"                                ON flotillas;
DROP POLICY IF EXISTS "Lectura publica fotos_etapas"           ON fotos_etapas;
DROP POLICY IF EXISTS "Lectura publica fotos_ingreso"          ON fotos_ingreso;
DROP POLICY IF EXISTS "Lectura publica mecanicos"              ON mecanicos;
DROP POLICY IF EXISTS "allow_all"                                ON metas_taller;
DROP POLICY IF EXISTS "Lectura publica novedades"             ON novedades;
DROP POLICY IF EXISTS "Lectura publica ordenes"               ON ordenes;
DROP POLICY IF EXISTS "acceso_total_proveedores"              ON proveedores;
DROP POLICY IF EXISTS "allow_all"                               ON repuestos_items;
DROP POLICY IF EXISTS "allow_all"                               ON repuestos_solicitud;
DROP POLICY IF EXISTS "allow_all_roles_config"                 ON roles_config;
DROP POLICY IF EXISTS "Allow all solicitud_items"             ON solicitud_items;
DROP POLICY IF EXISTS "acceso_total_solicitudes"              ON solicitudes_repuesto;
DROP POLICY IF EXISTS "Lectura publica vehiculos"            ON vehiculos;
DROP POLICY IF EXISTS "ventas_mensuales_read"                 ON ventas_mensuales;
DROP POLICY IF EXISTS "ventas_mensuales_write"                ON ventas_mensuales;
DROP POLICY IF EXISTS "ventas_servicio_read"                  ON ventas_servicio;
DROP POLICY IF EXISTS "ventas_servicio_write"                 ON ventas_servicio;


-- ─────────────────────────────────────────────────────────────────────────
-- 2) RELLENAR huecos — política de PERSONAL (es_staff) en las tablas
--    operativas que la necesitan (acceso completo a cualquier personal logueado).
--    Las tablas con políticas por rol ya suficientes (configuracion, mecanicos,
--    aprobaciones_etapa, solicitudes_repuesto, proveedores) NO se tocan aquí.
-- ─────────────────────────────────────────────────────────────────────────
DO $$
DECLARE
  t text;
  tablas text[] := ARRAY[
    'ordenes','etapas','clientes','cotizaciones','vehiculos','novedades',
    'fotos_etapas','fotos_ingreso','aprobaciones_aseguradora','solicitud_items',
    'cotizaciones_repuesto','repuestos_items','repuestos_solicitud',
    'contactos_repuesto','aseguradoras','flotillas','empresas',
    'vehiculo_consumibles','vehiculo_documentos','tecnicos_externos',
    'config_app','encuestas','encuesta_items_mecanico'
  ];
BEGIN
  FOREACH t IN ARRAY tablas LOOP
    EXECUTE format('DROP POLICY IF EXISTS sec_staff_all ON public.%I', t);
    EXECUTE format(
      'CREATE POLICY sec_staff_all ON public.%I FOR ALL TO authenticated '
      || 'USING (public.es_staff()) WITH CHECK (public.es_staff())', t);
  END LOOP;
END $$;


-- ─────────────────────────────────────────────────────────────────────────
-- 3) Tablas ADMIN/ROLES — el personal LEE, pero solo el jefe/gerente ESCRIBE
--    (evita que un técnico se ponga a sí mismo como jefe o cambie permisos).
-- ─────────────────────────────────────────────────────────────────────────
-- roles_config
DROP POLICY IF EXISTS sec_staff_read ON roles_config;
DROP POLICY IF EXISTS sec_jefe_all   ON roles_config;
CREATE POLICY sec_staff_read ON roles_config FOR SELECT TO authenticated USING (public.es_staff());
CREATE POLICY sec_jefe_all   ON roles_config FOR ALL    TO authenticated USING (public.es_jefe()) WITH CHECK (public.es_jefe());

-- metas_taller (metas de venta — lectura del personal, edición del jefe)
DROP POLICY IF EXISTS sec_staff_read ON metas_taller;
DROP POLICY IF EXISTS sec_jefe_all   ON metas_taller;
CREATE POLICY sec_staff_read ON metas_taller FOR SELECT TO authenticated USING (public.es_staff());
CREATE POLICY sec_jefe_all   ON metas_taller FOR ALL    TO authenticated USING (public.es_jefe()) WITH CHECK (public.es_jefe());


-- ─────────────────────────────────────────────────────────────────────────
-- 4) Tablas FINANCIERAS sensibles — SOLO jefe/gerente (ni lectura para el resto)
-- ─────────────────────────────────────────────────────────────────────────
DO $$
DECLARE t text; tablas text[] := ARRAY['credito','ventas_mensuales','ventas_servicio'];
BEGIN
  FOREACH t IN ARRAY tablas LOOP
    EXECUTE format('DROP POLICY IF EXISTS sec_jefe_all ON public.%I', t);
    EXECUTE format(
      'CREATE POLICY sec_jefe_all ON public.%I FOR ALL TO authenticated '
      || 'USING (public.es_jefe()) WITH CHECK (public.es_jefe())', t);
  END LOOP;
END $$;


-- ─────────────────────────────────────────────────────────────────────────
-- 5) QUITAR los permisos directos del rol PÚBLICO (anon) sobre TODAS las tablas
--    y vistas. A partir de aquí, sin login NO se puede tocar ninguna tabla;
--    el público solo conserva EJECUTAR las 3 funciones (detectar_perfil, etc.).
-- ─────────────────────────────────────────────────────────────────────────
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT format('%I.%I', schemaname, tablename) AS obj FROM pg_tables  WHERE schemaname='public'
    UNION ALL
    SELECT format('%I.%I', schemaname, viewname)  AS obj FROM pg_views   WHERE schemaname='public'
  LOOP
    EXECUTE format('REVOKE ALL ON %s FROM anon', r.obj);
  END LOOP;
END $$;


-- ─────────────────────────────────────────────────────────────────────────
-- 6) HALLAZGO IMPORTANTE — funciones sensibles abiertas al público.
--    Por defecto Postgres deja las funciones EJECUTABLES por TODOS (public),
--    así que HOY un visitante anónimo podría llamar /rpc/admin_cambiar_contrasena
--    y resetear contraseñas. Aquí se cierra: solo personal logueado.
--    (Recomendado además: que admin_cambiar_contrasena valide es_jefe() por
--     dentro — pendiente Fase 2; pégame su definición si quieres que lo haga.)
-- ─────────────────────────────────────────────────────────────────────────
REVOKE ALL ON FUNCTION public.admin_cambiar_contrasena(text, text) FROM public, anon;
GRANT  EXECUTE ON FUNCTION public.admin_cambiar_contrasena(text, text) TO authenticated;

REVOKE ALL ON FUNCTION public.crear_orden_desde_cotizacion() FROM public, anon;
GRANT  EXECUTE ON FUNCTION public.crear_orden_desde_cotizacion() TO authenticated;


-- ═══════════════════════════════════════════════════════════════════════════
-- VERIFICACIÓN (corre esto después; debería dar 0 filas / acceso denegado):
--   -- ¿Quedó alguna política abierta a anon/public con USING(true)?
--   SELECT tablename, policyname, roles, qual
--   FROM pg_policies
--   WHERE schemaname='public' AND qual='true'
--     AND (roles @> '{anon}' OR roles @> '{public}');
-- ═══════════════════════════════════════════════════════════════════════════


-- ═══════════════════════════════════════════════════════════════════════════
-- REVERSA DE EMERGENCIA (NO correr salvo que algo del personal deje de andar).
-- Reabre TEMPORALMENTE una tabla concreta mientras se corrige (ej. ordenes):
--   CREATE POLICY tmp_reabrir ON ordenes FOR ALL TO anon, authenticated
--     USING (true) WITH CHECK (true);
--   GRANT ALL ON ordenes TO anon;
-- Cuando se corrija, borrar: DROP POLICY tmp_reabrir ON ordenes;
-- ═══════════════════════════════════════════════════════════════════════════
