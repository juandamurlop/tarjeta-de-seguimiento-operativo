-- ════════════════════════════════════════════════════════════════
-- CAMBIOS DE BASE DE DATOS — BLOQUE A (etapas y precios)
-- Cómo aplicarlo:
--   Supabase → SQL Editor → New query → pegar TODO esto → Run.
-- Es seguro volver a correrlo (usa IF NOT EXISTS).
-- ════════════════════════════════════════════════════════════════

-- 1) Técnicos externos (Mecánica / Adicionales)
--    Guarda el nombre de cada técnico externo ligado a la placa y la orden
--    en que trabajó, para llevar historial.
create table if not exists tecnicos_externos (
  id         bigint generated always as identity primary key,
  nombre     text not null,
  servicio   text,
  etapa      text,
  placa      text,
  orden_id   bigint references ordenes(id) on delete set null,
  creado_en  timestamptz not null default now()
);

create index if not exists idx_tecnicos_externos_nombre on tecnicos_externos (lower(nombre));
create index if not exists idx_tecnicos_externos_placa  on tecnicos_externos (placa);

-- Permitir lectura/escritura con la API (PostgREST). Si usas RLS, agrega las
-- políticas correspondientes; si tus otras tablas no usan RLS, no hace falta.
-- alter table tecnicos_externos enable row level security;


-- 2) Precio de venta al cliente (solo aseguradoras)
--    Lo fija el jefe/gerente. Es el total que se imprime en la orden de
--    trabajo de aseguradora (sin mostrar el detalle de procesos).
alter table ordenes add column if not exists precio_venta_cliente numeric;


-- 3) Dirección del cliente en la orden (Bloque B)
alter table ordenes add column if not exists direccion text;
