-- ═══════════════════════════════════════════════════════════
-- ESQUEMA: Seguimiento de ventas (cuadro del contador)
-- Correr UNA vez en el editor SQL de Supabase (mismo proyecto donde
-- están metas_taller, ordenes, etapas, etc.).
-- ═══════════════════════════════════════════════════════════

-- ── 1) Ventas mensuales (totales, facturas y metas por mes/año) ──
-- El contador sube un CSV por año. La app deriva "mejor año", "año
-- anterior" y el pacing a partir de la historia almacenada aquí.
create table if not exists public.ventas_mensuales (
  id          bigint generated always as identity primary key,
  ano         int  not null,
  mes_num     int  not null check (mes_num between 1 and 12),
  mes         text,
  ventas      numeric default 0,   -- ventas reales facturadas del mes
  facturas    int     default 0,   -- # de facturas del mes
  meta_base   numeric,             -- meta realista (solo año en curso)
  meta_ideal  numeric,             -- meta ambiciosa (solo año en curso)
  actualizado_en timestamptz default now(),
  unique (ano, mes_num)
);

-- ── 2) Ventas por servicio (desglose para el análisis detallado) ──
-- Conceptos: ELECTRICIDAD, LATONERIA, MECANICA, PINTURA, TAPICERIA,
-- OTROS (repuestos/insumos), ASEGURADORA.
create table if not exists public.ventas_servicio (
  id        bigint generated always as identity primary key,
  concepto  text not null,
  ano       int  not null,
  mes_num   int  not null check (mes_num between 1 and 12),
  valor     numeric default 0,
  actualizado_en timestamptz default now(),
  unique (concepto, ano, mes_num)
);

-- ── 3) Crédito (seguimiento de préstamos, ej. Crédito Occidente) ──
create table if not exists public.credito (
  id        bigint generated always as identity primary key,
  nombre    text not null,
  monto_desembolsado numeric default 0,
  total_cuotas       int     default 0,
  cuotas_pagadas     int     default 0,
  capital_pendiente  numeric default 0,
  capital_pagado     numeric default 0,
  intereses_pagados  numeric default 0,
  otros_conceptos    numeric default 0,
  actualizado_en timestamptz default now(),
  unique (nombre)
);

-- ── Permisos / RLS ───────────────────────────────────────────────
-- Lectura para cualquier sesión; escritura solo para usuarios logueados.
-- (Ajusta a tu política si manejas roles más finos.)
alter table public.ventas_mensuales enable row level security;
alter table public.ventas_servicio  enable row level security;
alter table public.credito          enable row level security;

create policy "ventas_mensuales_read"  on public.ventas_mensuales for select using (true);
create policy "ventas_mensuales_write" on public.ventas_mensuales for all
  to authenticated using (true) with check (true);

create policy "ventas_servicio_read"  on public.ventas_servicio for select using (true);
create policy "ventas_servicio_write" on public.ventas_servicio for all
  to authenticated using (true) with check (true);

create policy "credito_read"  on public.credito for select using (true);
create policy "credito_write" on public.credito for all
  to authenticated using (true) with check (true);
