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
