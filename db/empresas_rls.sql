-- ─────────────────────────────────────────────────────────────
-- FIX: la tabla "empresas" rechaza inserciones con el error
--   new row violates row-level security policy for table "empresas"
-- Falta la política RLS de acceso (las demás tablas del app sí la tienen).
-- Ejecutar en el SQL Editor de Supabase.
-- ─────────────────────────────────────────────────────────────

-- Asegura RLS habilitado (ya lo está, por eso bloquea)
ALTER TABLE public.empresas ENABLE ROW LEVEL SECURITY;

-- Política permisiva de acceso total (igual que el resto del sistema)
DROP POLICY IF EXISTS "empresas_acceso" ON public.empresas;
CREATE POLICY "empresas_acceso" ON public.empresas
  FOR ALL
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

-- Por si faltaran privilegios de tabla (normalmente ya están)
GRANT ALL ON public.empresas TO anon, authenticated;
