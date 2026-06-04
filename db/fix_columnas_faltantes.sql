-- ════════════════════════════════════════════════════════════════
-- FIX de columnas faltantes (auditoría jun 2026)
-- Estas columnas las escribe/lee la app pero NO existían en la BD,
-- por lo que varios guardados fallaban con error 400.
-- Es seguro de correr varias veces (IF NOT EXISTS). No borra nada.
-- Ejecutar en Supabase → SQL Editor.
-- ════════════════════════════════════════════════════════════════

-- 1) REGISTRO DE VEHÍCULOS (Ingreso Particular / Flotillas)
--    Faltaban: línea, propietario y teléfono → registrar/editar vehículo fallaba.
ALTER TABLE vehiculos ADD COLUMN IF NOT EXISTS linea       text;
ALTER TABLE vehiculos ADD COLUMN IF NOT EXISTS propietario text;
ALTER TABLE vehiculos ADD COLUMN IF NOT EXISTS telefono    text;
ALTER TABLE vehiculos ADD COLUMN IF NOT EXISTS kilometraje integer;

-- 2) CATÁLOGO DE ASEGURADORAS
--    Faltaba: nit → crear una aseguradora nueva fallaba.
ALTER TABLE aseguradoras ADD COLUMN IF NOT EXISTS nit text;

-- 3) ÓRDENES — flujo aseguradoras
--    aceptacion_contratista: aceptación de latonería/pintura del contratista.
--    datos_aseguradora: datos (ajustador, valor autorizado, pago...) en JSON.
--    Hasta ahora datos_aseguradora se guardaba camuflado en "observaciones";
--    con esta columna queda limpio y consultable.
ALTER TABLE ordenes ADD COLUMN IF NOT EXISTS aceptacion_contratista text;
ALTER TABLE ordenes ADD COLUMN IF NOT EXISTS datos_aseguradora       jsonb;

-- 4) COTIZACIONES DE REPUESTOS (perfil Repuestos)
--    Faltaban: referencia y dias_entrega → guardar la cotización fallaba
--    y el puntaje de proveedores no se calculaba.
ALTER TABLE cotizaciones_repuesto ADD COLUMN IF NOT EXISTS referencia   text;
ALTER TABLE cotizaciones_repuesto ADD COLUMN IF NOT EXISTS dias_entrega integer;

-- Fin del fix.
