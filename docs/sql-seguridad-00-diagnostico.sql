-- ═══════════════════════════════════════════════════════════════════════════
-- SEGURIDAD · FASE 0 — DIAGNÓSTICO (solo LECTURA, no cambia nada)
-- ═══════════════════════════════════════════════════════════════════════════
-- Corre cada bloque en el editor SQL de Supabase y copia el resultado.
-- Objetivo: confirmar el estado real antes de cerrar el acceso público.
-- NINGUNA consulta de aquí modifica datos ni permisos. Es seguro correrlo.
-- ═══════════════════════════════════════════════════════════════════════════


-- ─────────────────────────────────────────────────────────────────────────
-- 1) ¿Qué tablas hay en 'public' y cuáles tienen RLS activado?
--    (rowsecurity = true significa que RLS está encendido)
-- ─────────────────────────────────────────────────────────────────────────
SELECT
  c.relname                         AS tabla,
  c.relrowsecurity                  AS rls_activo,
  c.relforcerowsecurity             AS rls_forzado
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relkind = 'r'            -- solo tablas
ORDER BY c.relname;


-- ─────────────────────────────────────────────────────────────────────────
-- 2) TODAS las políticas RLS actuales, con el rol al que aplican y la regla.
--    Aquí confirmamos el "TO anon ... USING(true)" que abre la base.
--    'roles' = a qué rol aplica (anon, authenticated...).
--    'qual'  = condición de lectura (USING). 'with_check' = condición de escritura.
-- ─────────────────────────────────────────────────────────────────────────
SELECT
  tablename                         AS tabla,
  policyname                        AS politica,
  cmd                               AS operacion,      -- ALL / SELECT / INSERT / ...
  roles                             AS roles,
  qual                              AS regla_lectura,  -- USING
  with_check                        AS regla_escritura -- WITH CHECK
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;


-- ─────────────────────────────────────────────────────────────────────────
-- 3) Permisos DIRECTOS (GRANT) sobre tablas para los roles anon / authenticated.
--    Aunque RLS limite filas, un GRANT da el permiso base. Conviene verlo.
-- ─────────────────────────────────────────────────────────────────────────
SELECT
  table_name                        AS tabla,
  grantee                           AS rol,
  string_agg(privilege_type, ', ' ORDER BY privilege_type) AS permisos
FROM information_schema.role_table_grants
WHERE table_schema = 'public'
  AND grantee IN ('anon', 'authenticated')
GROUP BY table_name, grantee
ORDER BY table_name, grantee;


-- ─────────────────────────────────────────────────────────────────────────
-- 4) CRÍTICO — ¿Todo el personal ACTIVO tiene cuenta en Supabase Auth?
--    La app autentica al personal con email = '<cedula>@freimanautos.com'.
--    Si alguien activo NO tiene cuenta auth, al cerrar RLS se quedaría afuera.
--
--    'tiene_cuenta_auth' = false  → HAY QUE CREARLE CUENTA antes de cortar.
-- ─────────────────────────────────────────────────────────────────────────

-- 4a) Técnicos / repuestos / taller (tabla mecanicos)
SELECT
  m.cedula,
  m.nombre,
  m.rol,
  (u.id IS NOT NULL)                AS tiene_cuenta_auth
FROM mecanicos m
LEFT JOIN auth.users u
  ON lower(u.email) = lower(m.cedula || '@freimanautos.com')
WHERE m.activo = true
ORDER BY tiene_cuenta_auth, m.nombre;

-- 4b) Gerente y Jefe (guardados en configuracion)
SELECT
  cfg.clave,
  cfg.valor                         AS cedula,
  (u.id IS NOT NULL)                AS tiene_cuenta_auth
FROM configuracion cfg
LEFT JOIN auth.users u
  ON lower(u.email) = lower(cfg.valor || '@freimanautos.com')
WHERE cfg.clave IN ('gerente_cedula', 'jefe_cedula');


-- ─────────────────────────────────────────────────────────────────────────
-- 5) ¿Cuántas cuentas auth hay en total? (referencia)
--    Si hay MUCHAS más que personal, probablemente son clientes con
--    cuenta creada (password = cédula). Esas cuentas dejarán de usarse
--    cuando el portal del cliente pase a usar la función RPC.
-- ─────────────────────────────────────────────────────────────────────────
SELECT count(*) AS total_cuentas_auth FROM auth.users;


-- ─────────────────────────────────────────────────────────────────────────
-- 6) ¿Existe ya alguna función RPC propia? (referencia del patrón)
--    Debería aparecer 'admin_cambiar_contrasena'. Las nuevas funciones de
--    seguridad seguirán este mismo patrón (SECURITY DEFINER).
-- ─────────────────────────────────────────────────────────────────────────
SELECT
  p.proname                         AS funcion,
  pg_get_function_identity_arguments(p.oid) AS argumentos,
  p.prosecdef                       AS es_security_definer
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
ORDER BY p.proname;


-- ═══════════════════════════════════════════════════════════════════════════
-- NOTA sobre la Edge Function 'ocr-tarjeta' (no se ve por SQL):
-- En el Dashboard → Edge Functions → ocr-tarjeta → Details, revisa si
-- "Verify JWT" está ON u OFF. Anótalo. (Lo aseguramos en la Fase 2.)
-- ═══════════════════════════════════════════════════════════════════════════
