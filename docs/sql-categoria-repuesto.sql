-- Categoría del repuesto (Frenos, Motor, Suspensión, etc.) para rankear
-- proveedores por TIPO: a qué proveedor le compras más de esa categoría.
-- Se auto-detecta por el nombre y el mecánico la confirma al solicitar.
-- Si no se corre, la solicitud funciona igual (la categoría se ignora) y el
-- ranking de proveedores cae al global.

ALTER TABLE solicitudes_repuesto
  ADD COLUMN IF NOT EXISTS categoria text;
