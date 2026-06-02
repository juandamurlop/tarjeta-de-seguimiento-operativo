// ═══════════════════════════════════════════════════════════
// VENTAS Y METAS — Cuadro de seguimiento del contador
// ───────────────────────────────────────────────────────────
// Reemplaza la pestaña "Metas". Vista GENERAL (metas del dashboard) +
// apartado "Análisis detallado" (por servicio, pacing, facturas, crédito).
// Datos: tablas ventas_mensuales, ventas_servicio y credito (Supabase),
// que el contador alimenta por CSV. La app deriva sola "mejor año",
// "año anterior" y el pacing desde la historia almacenada.
// ═══════════════════════════════════════════════════════════

const _MESES_VENTAS = ['Enero','Febrero','Marzo','Abril','Mayo','Junio',
  'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

const _CONCEPTOS_VENTAS = ['ELECTRICIDAD','LATONERIA','MECANICA','PINTURA','TAPICERIA','OTROS','ASEGURADORA'];

let _ventasData  = { vm: [], vs: [], cr: null, ok: false };
let _ventasVista = 'general'; // 'general' | 'detalle'

const _fmtV  = n => n != null ? new Intl.NumberFormat('es-CO',{style:'currency',currency:'COP',minimumFractionDigits:0}).format(Math.round(n)) : '—';
const _fmtVc = n => n != null ? new Intl.NumberFormat('es-CO',{notation:'compact',maximumFractionDigits:1}).format(n) : '—';
const _pctV  = (real, meta) => meta > 0 ? Math.round((real/meta)*100) : 0;
const _colPct = p => p >= 100 ? 'var(--verde)' : p >= 70 ? 'var(--amarillo)' : 'var(--rojo)';

// ── Carga de datos ───────────────────────────────────────────
async function _cargarDatosVentas() {
  try {
    const [vm, vs, cr] = await Promise.all([
      api('/ventas_mensuales?order=ano.asc,mes_num.asc').catch(() => []),
      api('/ventas_servicio?order=ano.asc,mes_num.asc').catch(() => []),
      api('/credito?order=id.asc').catch(() => [])
    ]);
    _ventasData = { vm: vm || [], vs: vs || [], cr: (cr && cr[0]) || null, ok: true };
  } catch (e) {
    _ventasData = { vm: [], vs: [], cr: null, ok: false };
  }
  return _ventasData;
}

// ── Derivar métricas a partir de los datos ──────────────────
function _ventasDerivar(d) {
  const anos = [...new Set(d.vm.map(r => r.ano))].sort((a,b) => a-b);
  const anoActual = anos.length ? Math.max(...anos) : new Date().getFullYear();
  const anoAnt    = anoActual - 1;

  const byAnoMes = {};
  d.vm.forEach(r => { (byAnoMes[r.ano] = byAnoMes[r.ano] || {})[r.mes_num] = r; });

  // Suma de ventas por servicio (respaldo para años sin fila en ventas_mensuales,
  // p.ej. 2023/2024) — permite derivar "mejor año" desde la historia completa.
  const vsSum = {};
  d.vs.forEach(r => { (vsSum[r.ano] = vsSum[r.ano] || {})[r.mes_num] = (vsSum[r.ano][r.mes_num] || 0) + (+r.valor || 0); });
  const allAnos = [...new Set([...d.vm.map(r => r.ano), ...d.vs.map(r => r.ano)])].sort((a,b) => a-b);
  const ventasDe = (a, m) => (+(byAnoMes[a]?.[m]?.ventas)) || vsSum[a]?.[m] || 0;

  const filas = [];
  for (let m = 1; m <= 12; m++) {
    const cur = byAnoMes[anoActual]?.[m] || {};
    const ant = byAnoMes[anoAnt]?.[m]   || {};
    let mejor = { ano: null, ventas: 0 };
    allAnos.forEach(a => {
      const v = ventasDe(a, m);
      if (v > mejor.ventas) mejor = { ano: a, ventas: v };
    });
    filas.push({
      mes_num: m, mes: _MESES_VENTAS[m-1],
      ventas:   +cur.ventas   || 0,
      facturas: +cur.facturas || 0,
      metaBase: +cur.meta_base  || 0,
      metaIdeal:+cur.meta_ideal || 0,
      ventasAnt:   +ant.ventas   || 0,
      facturasAnt: +ant.facturas || 0,
      mejorAno: mejor.ano, mejorVentas: mejor.ventas
    });
  }

  const sum = (arr, k) => arr.reduce((s,f) => s + (f[k]||0), 0);
  const metaBaseAnual  = sum(filas, 'metaBase');
  const metaIdealAnual = sum(filas, 'metaIdeal');

  // Último mes con ventas registradas (mes "en curso")
  let ultimoMes = 0;
  filas.forEach((f,i) => { if (f.ventas > 0) ultimoMes = i+1; });
  if (!ultimoMes) ultimoMes = Math.min(new Date().getMonth()+1, 12);

  // Acumulados hasta el último mes
  const hasta = filas.slice(0, ultimoMes);
  const ventasYTD   = sum(hasta, 'ventas');
  const metaYTD     = sum(hasta, 'metaBase');
  const facturasYTD = sum(hasta, 'facturas');
  const ventasAntYTD= sum(hasta, 'ventasAnt');

  // Pacing: esperado (distribución de la meta) vs logrado (ventas / meta anual)
  filas.forEach(f => {
    f.expectedPct = metaBaseAnual > 0 ? (f.metaBase / metaBaseAnual) * 100 : 0;
    f.achievedPct = metaBaseAnual > 0 ? (f.ventas   / metaBaseAnual) * 100 : 0;
  });
  let accE = 0, accA = 0;
  filas.forEach(f => { accE += f.expectedPct; accA += f.achievedPct; f.expectedAcum = accE; f.achievedAcum = accA; });
  const expectedAcum = filas[ultimoMes-1]?.expectedAcum || 0;
  const achievedAcum = filas[ultimoMes-1]?.achievedAcum || 0;

  return {
    anos, anoActual, anoAnt, byAnoMes, filas,
    metaBaseAnual, metaIdealAnual, ultimoMes,
    ventasYTD, metaYTD, facturasYTD, ventasAntYTD,
    expectedAcum, achievedAcum
  };
}

// ── Entrada principal (pestaña Metas) ───────────────────────
async function cargarVistaVentas() {
  const cont = document.getElementById('dash-metas-contenido');
  if (!cont) return;
  mostrarCargandoSiVacio(cont, '<div class="loading-state">Cargando ventas...</div>');
  await _cargarDatosVentas();

  if (!_ventasData.vm.length) { _renderVentasOnboarding(cont); return; }

  if (_ventasVista === 'detalle') _renderVentasDetalle(cont, _ventasDerivar(_ventasData));
  else                           _renderVentasGeneral(cont, _ventasDerivar(_ventasData));
}

function verAnalisisVentas()  { _ventasVista = 'detalle'; cargarVistaVentas(); }
function volverVentasGeneral(){ _ventasVista = 'general'; cargarVistaVentas(); }

// ═══════════════════════════════════════════════════════════
// VISTA GENERAL — metas del dashboard
// ═══════════════════════════════════════════════════════════
function _renderVentasGeneral(cont, D) {
  const mesIdx   = D.ultimoMes - 1;
  const fMes     = D.filas[mesIdx] || {};
  const pctMes   = _pctV(fMes.ventas, fMes.metaBase);
  const pctIdeal = _pctV(fMes.ventas, fMes.metaIdeal);
  const pctYTD   = _pctV(D.ventasYTD, D.metaYTD);
  const crecAnt  = D.ventasAntYTD > 0 ? Math.round(((D.ventasYTD - D.ventasAntYTD) / D.ventasAntYTD) * 100) : null;
  const ticket   = D.facturasYTD > 0 ? D.ventasYTD / D.facturasYTD : 0;
  const pacingDelta = D.achievedAcum - D.expectedAcum;

  const kpi = (label, valor, color, sub) => `
    <div class="card" style="padding:14px 16px">
      <div style="font-size:10px;font-weight:700;color:var(--gris-mid);text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px">${label}</div>
      <div style="font-size:22px;font-weight:800;color:${color};line-height:1.05">${valor}</div>
      ${sub ? `<div style="font-size:11px;color:var(--gris-mid);margin-top:4px">${sub}</div>` : ''}
    </div>`;

  cont.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;flex-wrap:wrap;margin-bottom:14px">
      <div>
        <div style="font-size:18px;font-weight:800;color:var(--texto)">Metas y ventas · ${D.anoActual}</div>
        <div style="font-size:12px;color:var(--gris-mid)">Mes en curso: ${fMes.mes || '—'} · acumulado a ${D.filas[mesIdx]?.mes || '—'}</div>
      </div>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <button class="btn btn-outline btn-sm" onclick="abrirCargaVentas()">Cargar datos (contador)</button>
        <button class="btn btn-primary btn-sm" onclick="verAnalisisVentas()">Análisis detallado →</button>
      </div>
    </div>

    <div id="ventas-carga" style="display:none"></div>

    <!-- KPIs principales -->
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px;margin-bottom:16px">
      ${kpi('Ventas del mes', _fmtV(fMes.ventas), _colPct(pctMes),
            `Meta base ${_fmtV(fMes.metaBase)} · <b style="color:${_colPct(pctMes)}">${pctMes}%</b>`)}
      ${kpi('Meta ideal', _fmtV(fMes.metaIdeal), '#7C3AED',
            `Cumplimiento ideal <b>${pctIdeal}%</b>`)}
      ${kpi('Acumulado año', _fmtV(D.ventasYTD), _colPct(pctYTD),
            `Meta acum. ${_fmtV(D.metaYTD)} · <b style="color:${_colPct(pctYTD)}">${pctYTD}%</b>`)}
      ${kpi('vs Año anterior', crecAnt == null ? '—' : (crecAnt >= 0 ? '+' : '') + crecAnt + '%',
            crecAnt == null ? '#6B7280' : (crecAnt >= 0 ? '#059669' : '#DC2626'),
            `${D.anoAnt}: ${_fmtV(D.ventasAntYTD)}`)}
      ${kpi('Facturas / ticket', D.facturasYTD + ' fact.', '#1E3A5F',
            `Ticket prom. ${_fmtV(ticket)}`)}
    </div>

    <!-- Pacing -->
    <div class="card" style="padding:14px 16px;margin-bottom:16px">
      <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:8px">
        <div style="font-size:13px;font-weight:700;color:var(--texto)">Ritmo del año (pacing)</div>
        <div style="font-size:12px;font-weight:700;color:${pacingDelta >= 0 ? '#059669' : '#DC2626'}">
          ${pacingDelta >= 0 ? '▲ Adelantado' : '▼ Atrasado'} ${Math.abs(Math.round(pacingDelta))} pts
        </div>
      </div>
      <div style="position:relative;height:14px;background:var(--gris-bg);border-radius:99px;overflow:hidden">
        <div style="position:absolute;inset:0 auto 0 0;width:${Math.min(D.achievedAcum,100)}%;background:${pacingDelta >= 0 ? '#059669' : '#D97706'};border-radius:99px"></div>
        <div title="Esperado a hoy" style="position:absolute;top:-3px;bottom:-3px;left:${Math.min(D.expectedAcum,100)}%;width:2px;background:#1E3A5F"></div>
      </div>
      <div style="display:flex;justify-content:space-between;font-size:11px;color:var(--gris-mid);margin-top:6px">
        <span>Logrado: <b>${Math.round(D.achievedAcum)}%</b> del año</span>
        <span>Esperado a hoy: <b>${Math.round(D.expectedAcum)}%</b></span>
      </div>
    </div>

    <!-- Mini tabla mensual -->
    <div class="card" style="padding:0;overflow:hidden">
      <table style="width:100%;border-collapse:collapse;font-size:13px">
        <thead>
          <tr style="background:var(--gris-bg)">
            <th style="padding:8px 12px;text-align:left;font-size:11px;color:var(--gris-mid);text-transform:uppercase">Mes</th>
            <th style="padding:8px 12px;text-align:right;font-size:11px;color:var(--gris-mid);text-transform:uppercase">Meta base</th>
            <th style="padding:8px 12px;text-align:right;font-size:11px;color:var(--gris-mid);text-transform:uppercase">Ventas</th>
            <th style="padding:8px 12px;text-align:right;font-size:11px;color:var(--gris-mid);text-transform:uppercase">Ejec.</th>
          </tr>
        </thead>
        <tbody>
          ${D.filas.map((f,i) => {
            const p = _pctV(f.ventas, f.metaBase);
            const enCurso = (i+1) === D.ultimoMes;
            return `<tr class="row-hover" style="border-top:1px solid var(--gris-borde);${enCurso?'background:#EBF2FF':''}">
              <td style="padding:7px 12px;font-weight:${enCurso?'700':'400'}">${f.mes}${enCurso?' ·':''}</td>
              <td style="padding:7px 12px;text-align:right;color:var(--gris-mid)">${f.metaBase?_fmtV(f.metaBase):'—'}</td>
              <td style="padding:7px 12px;text-align:right;font-weight:600">${f.ventas?_fmtV(f.ventas):'—'}</td>
              <td style="padding:7px 12px;text-align:right;font-weight:700;color:${f.ventas?_colPct(p):'var(--gris-mid)'}">${f.ventas?p+'%':'—'}</td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>
    </div>`;
}

// ═══════════════════════════════════════════════════════════
// VISTA DETALLE — análisis a fondo
// ═══════════════════════════════════════════════════════════
function _renderVentasDetalle(cont, D) {
  // ── Desglose por servicio (interanual) ──
  const porServ = {};
  _CONCEPTOS_VENTAS.forEach(c => porServ[c] = {});
  D.vsAnos = [...new Set(_ventasData.vs.map(r => r.ano))].sort((a,b)=>a-b);
  _ventasData.vs.forEach(r => {
    const c = (r.concepto || '').toUpperCase();
    if (!porServ[c]) porServ[c] = {};
    porServ[c][r.ano] = (porServ[c][r.ano] || 0) + (+r.valor || 0);
  });
  const totalAnoActualServ = _CONCEPTOS_VENTAS.reduce((s,c) => s + (porServ[c][D.anoActual]||0), 0);

  const servHtml = _CONCEPTOS_VENTAS.map(c => {
    const valAct = porServ[c][D.anoActual] || 0;
    const part = totalAnoActualServ > 0 ? Math.round((valAct/totalAnoActualServ)*100) : 0;
    const cols = D.vsAnos.map(a => `<td style="padding:7px 10px;text-align:right;color:${a===D.anoActual?'var(--texto)':'var(--gris-mid)'};font-weight:${a===D.anoActual?'700':'400'}">${porServ[c][a]?_fmtVc(porServ[c][a]):'—'}</td>`).join('');
    return `<tr class="row-hover" style="border-top:1px solid var(--gris-borde)">
      <td style="padding:7px 10px;font-weight:600;text-transform:capitalize">${c.toLowerCase()}</td>
      ${cols}
      <td style="padding:7px 10px;text-align:right">
        <div style="display:flex;align-items:center;gap:6px;justify-content:flex-end">
          <div style="width:46px;height:6px;background:var(--gris-bg);border-radius:99px;overflow:hidden"><div style="width:${part}%;height:100%;background:#2A5298"></div></div>
          <span style="font-size:11px;color:var(--gris-mid);min-width:30px">${part}%</span>
        </div>
      </td>
    </tr>`;
  }).join('');

  // ── Crédito ──
  const cr = _ventasData.cr;
  const credHtml = cr ? `
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px">
      ${_vCredItem('Desembolsado', _fmtV(cr.monto_desembolsado))}
      ${_vCredItem('Cuotas', `${cr.cuotas_pagadas||0} / ${cr.total_cuotas||0}`)}
      ${_vCredItem('Capital pendiente', _fmtV(cr.capital_pendiente), '#DC2626')}
      ${_vCredItem('Capital pagado', _fmtV(cr.capital_pagado), '#059669')}
      ${_vCredItem('Intereses pagados', _fmtV(cr.intereses_pagados), '#D97706')}
    </div>` : `<div style="font-size:12px;color:var(--gris-mid)">Sin datos de crédito. Cárgalos en "Cargar datos (contador)".</div>`;

  cont.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;margin-bottom:14px">
      <div style="display:flex;align-items:center;gap:12px">
        <button class="btn btn-ghost btn-sm" onclick="volverVentasGeneral()">← Volver</button>
        <div style="font-size:18px;font-weight:800;color:var(--texto)">Análisis detallado · ${D.anoActual}</div>
      </div>
      <button class="btn btn-outline btn-sm" onclick="abrirCargaVentas()">Cargar datos (contador)</button>
    </div>

    <div id="ventas-carga" style="display:none;margin-bottom:16px"></div>

    <!-- Tabla mensual completa -->
    <div class="dash-section-title">Seguimiento mensual</div>
    <div class="card" style="padding:0;overflow:auto;margin-bottom:20px">
      <table style="width:100%;border-collapse:collapse;font-size:12px;min-width:680px">
        <thead><tr style="background:var(--gris-bg)">
          ${['Mes','Meta base','Meta ideal','Ventas','Ejec.','Var. vs meta','Fact.','Ticket'].map(h=>`<th style="padding:8px 10px;text-align:${h==='Mes'?'left':'right'};font-size:11px;color:var(--gris-mid);text-transform:uppercase">${h}</th>`).join('')}
        </tr></thead>
        <tbody>
          ${D.filas.map((f,i) => {
            const p = _pctV(f.ventas, f.metaBase);
            const varMeta = f.ventas - f.metaBase;
            const tk = f.facturas > 0 ? f.ventas/f.facturas : 0;
            const enCurso = (i+1) === D.ultimoMes;
            return `<tr class="row-hover" style="border-top:1px solid var(--gris-borde);${enCurso?'background:#EBF2FF':''}">
              <td style="padding:7px 10px;font-weight:${enCurso?'700':'500'}">${f.mes}</td>
              <td style="padding:7px 10px;text-align:right;color:var(--gris-mid)">${f.metaBase?_fmtVc(f.metaBase):'—'}</td>
              <td style="padding:7px 10px;text-align:right;color:var(--gris-mid)">${f.metaIdeal?_fmtVc(f.metaIdeal):'—'}</td>
              <td style="padding:7px 10px;text-align:right;font-weight:700">${f.ventas?_fmtVc(f.ventas):'—'}</td>
              <td style="padding:7px 10px;text-align:right;font-weight:700;color:${f.ventas?_colPct(p):'var(--gris-mid)'}">${f.ventas?p+'%':'—'}</td>
              <td style="padding:7px 10px;text-align:right;color:${varMeta>=0?'#059669':'#DC2626'}">${f.ventas?(varMeta>=0?'+':'')+_fmtVc(varMeta):'—'}</td>
              <td style="padding:7px 10px;text-align:right;color:var(--gris-mid)">${f.facturas||'—'}</td>
              <td style="padding:7px 10px;text-align:right;color:var(--gris-mid)">${tk?_fmtVc(tk):'—'}</td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>
    </div>

    <!-- Desglose por servicio -->
    <div class="dash-section-title">Ventas por servicio (interanual)</div>
    <div class="card" style="padding:0;overflow:auto;margin-bottom:20px">
      <table style="width:100%;border-collapse:collapse;font-size:12px;min-width:560px">
        <thead><tr style="background:var(--gris-bg)">
          <th style="padding:8px 10px;text-align:left;font-size:11px;color:var(--gris-mid);text-transform:uppercase">Servicio</th>
          ${D.vsAnos.map(a=>`<th style="padding:8px 10px;text-align:right;font-size:11px;color:var(--gris-mid)">${a}</th>`).join('')}
          <th style="padding:8px 10px;text-align:right;font-size:11px;color:var(--gris-mid);text-transform:uppercase">Part. ${D.anoActual}</th>
        </tr></thead>
        <tbody>${servHtml || `<tr><td style="padding:14px;color:var(--gris-mid)">Sin datos por servicio.</td></tr>`}</tbody>
      </table>
    </div>

    <!-- Crédito -->
    <div class="dash-section-title">Crédito</div>
    <div class="card" style="padding:16px">${credHtml}</div>`;
}

function _vCredItem(label, valor, color) {
  return `<div>
    <div style="font-size:11px;color:var(--gris-mid);text-transform:uppercase;letter-spacing:.3px;margin-bottom:3px">${label}</div>
    <div style="font-size:18px;font-weight:800;color:${color||'var(--texto)'}">${valor}</div>
  </div>`;
}

// ═══════════════════════════════════════════════════════════
// ONBOARDING / CARGA DE DATOS (CSV del contador)
// ═══════════════════════════════════════════════════════════
function _renderVentasOnboarding(cont) {
  cont.innerHTML = `
    <div style="max-width:620px;margin:0 auto;text-align:center;padding:30px 16px">
      <div style="font-size:40px;margin-bottom:10px">📊</div>
      <div style="font-size:18px;font-weight:800;color:var(--texto);margin-bottom:6px">Aún no hay datos de ventas</div>
      <div style="font-size:13px;color:var(--gris-mid);margin-bottom:20px;line-height:1.6">
        Carga el cuadro del contador para ver las metas del mes y el análisis detallado.
        Descarga las plantillas, pásalas al contador para que las complete desde su Excel y súbelas aquí.
      </div>
      <div id="ventas-carga"></div>
    </div>`;
  _renderPanelCargaVentas(document.getElementById('ventas-carga'), true);
}

function abrirCargaVentas() {
  const panel = document.getElementById('ventas-carga');
  if (!panel) return;
  const abierto = panel.style.display !== 'none' && panel.innerHTML.trim();
  if (abierto) { panel.style.display = 'none'; panel.innerHTML = ''; return; }
  panel.style.display = '';
  _renderPanelCargaVentas(panel, false);
}

function _renderPanelCargaVentas(panel, _onboarding) {
  if (!panel) return;
  panel.innerHTML = `
    <div class="card" style="padding:16px;text-align:left">
      <div style="font-size:13px;font-weight:700;color:var(--texto);margin-bottom:4px">Cargar datos del contador</div>
      <div style="font-size:11px;color:var(--gris-mid);margin-bottom:14px">El contador completa las plantillas desde su Excel y las sube. Reemplaza valores del mismo mes/servicio.</div>

      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:14px">
        <!-- Ventas mensuales -->
        <div style="border:1px solid var(--gris-borde);border-radius:8px;padding:12px">
          <div style="font-size:12px;font-weight:700;margin-bottom:6px">1 · Ventas mensuales</div>
          <div style="font-size:10px;color:var(--gris-mid);margin-bottom:10px;font-family:'DM Mono',monospace">ano, mes_num, mes, ventas, facturas, meta_base, meta_ideal</div>
          <button class="btn btn-outline btn-sm" onclick="descargarPlantillaVentasMensuales()" style="margin-bottom:8px">Descargar plantilla</button>
          <div class="upload-zone" onclick="document.getElementById('csv-vm-input').click()" style="padding:12px">
            <input type="file" id="csv-vm-input" accept=".csv" style="display:none" onchange="procesarCSVVentasMensuales(this)">
            <p style="margin:0;font-size:12px;color:var(--gris-mid)">Subir CSV de ventas mensuales</p>
          </div>
        </div>

        <!-- Ventas por servicio -->
        <div style="border:1px solid var(--gris-borde);border-radius:8px;padding:12px">
          <div style="font-size:12px;font-weight:700;margin-bottom:6px">2 · Ventas por servicio</div>
          <div style="font-size:10px;color:var(--gris-mid);margin-bottom:10px;font-family:'DM Mono',monospace">concepto, ano, mes_num, valor</div>
          <button class="btn btn-outline btn-sm" onclick="descargarPlantillaVentasServicio()" style="margin-bottom:8px">Descargar plantilla</button>
          <div class="upload-zone" onclick="document.getElementById('csv-vs-input').click()" style="padding:12px">
            <input type="file" id="csv-vs-input" accept=".csv" style="display:none" onchange="procesarCSVVentasServicio(this)">
            <p style="margin:0;font-size:12px;color:var(--gris-mid)">Subir CSV por servicio</p>
          </div>
        </div>

        <!-- Crédito -->
        <div style="border:1px solid var(--gris-borde);border-radius:8px;padding:12px">
          <div style="font-size:12px;font-weight:700;margin-bottom:10px">3 · Crédito</div>
          ${_formCreditoHtml(_ventasData.cr)}
        </div>
      </div>
    </div>`;
}

function _formCreditoHtml(cr) {
  cr = cr || {};
  const f = (id, ph, val) => `<input id="cr-${id}" type="${id==='nombre'?'text':'number'}" placeholder="${ph}" value="${val ?? ''}"
    style="width:100%;padding:6px 8px;border:1.5px solid var(--gris-borde);border-radius:6px;font-size:12px;margin-bottom:6px;box-sizing:border-box">`;
  return `
    ${f('nombre','Nombre (ej. Crédito Occidente)', cr.nombre)}
    ${f('monto_desembolsado','Monto desembolsado', cr.monto_desembolsado)}
    ${f('total_cuotas','Total cuotas', cr.total_cuotas)}
    ${f('cuotas_pagadas','Cuotas pagadas', cr.cuotas_pagadas)}
    ${f('capital_pendiente','Capital pendiente', cr.capital_pendiente)}
    ${f('capital_pagado','Capital pagado', cr.capital_pagado)}
    ${f('intereses_pagados','Intereses pagados', cr.intereses_pagados)}
    <button class="btn btn-primary btn-sm" style="width:100%" onclick="guardarCredito()">Guardar crédito</button>`;
}

// ── CSV: plantillas ─────────────────────────────────────────
function _descargarCSV(nombre, contenido) {
  const blob = new Blob([contenido], { type:'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url; a.download = nombre;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  URL.revokeObjectURL(url);
  toast('Plantilla descargada ✓');
}

function descargarPlantillaVentasMensuales() {
  const ano = new Date().getFullYear();
  const filas = _MESES_VENTAS.map((m,i) => `${ano},${i+1},${m},0,0,0,0`);
  _descargarCSV(`ventas_mensuales_${ano}.csv`,
    'ano,mes_num,mes,ventas,facturas,meta_base,meta_ideal\n' + filas.join('\n'));
}

function descargarPlantillaVentasServicio() {
  const ano = new Date().getFullYear();
  const filas = [];
  _CONCEPTOS_VENTAS.forEach(c => _MESES_VENTAS.forEach((_,i) => filas.push(`${c},${ano},${i+1},0`)));
  _descargarCSV(`ventas_servicio_${ano}.csv`,
    'concepto,ano,mes_num,valor\n' + filas.join('\n'));
}

// ── CSV: parsers ────────────────────────────────────────────
function _parseCSV(text) {
  const lines = text.trim().split(/\r?\n/).filter(l => l.trim());
  if (!lines.length) return [];
  const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
  return lines.slice(1).map(line => {
    const vals = line.split(',').map(v => v.trim());
    const obj = {}; headers.forEach((h,i) => obj[h] = vals[i] ?? '');
    return obj;
  });
}

async function procesarCSVVentasMensuales(input) {
  const file = input.files[0]; if (!file) return;
  const rows = _parseCSV(await file.text()).filter(r => r.ano && r.mes_num);
  if (!rows.length) { toast('CSV vacío o formato incorrecto','err'); return; }
  try {
    for (const r of rows) {
      await api('/ventas_mensuales?on_conflict=ano,mes_num', 'POST', {
        ano:        parseInt(r.ano),
        mes_num:    parseInt(r.mes_num),
        mes:        r.mes || _MESES_VENTAS[(parseInt(r.mes_num)||1)-1],
        ventas:     parseFloat(r.ventas)     || 0,
        facturas:   parseInt(r.facturas)     || 0,
        meta_base:  parseFloat(r.meta_base)  || 0,
        meta_ideal: parseFloat(r.meta_ideal) || 0
      }, { Prefer: 'resolution=merge-duplicates,return=minimal' });
    }
    toast(`${rows.length} mes(es) cargados ✓`);
    input.value = ''; cargarVistaVentas();
  } catch (e) { toast('Error guardando: ' + e.message, 'err'); }
}

async function procesarCSVVentasServicio(input) {
  const file = input.files[0]; if (!file) return;
  const rows = _parseCSV(await file.text()).filter(r => r.concepto && r.ano && r.mes_num);
  if (!rows.length) { toast('CSV vacío o formato incorrecto','err'); return; }
  try {
    for (const r of rows) {
      await api('/ventas_servicio?on_conflict=concepto,ano,mes_num', 'POST', {
        concepto: (r.concepto || '').toUpperCase(),
        ano:      parseInt(r.ano),
        mes_num:  parseInt(r.mes_num),
        valor:    parseFloat(r.valor) || 0
      }, { Prefer: 'resolution=merge-duplicates,return=minimal' });
    }
    toast(`${rows.length} registro(s) por servicio cargados ✓`);
    input.value = ''; cargarVistaVentas();
  } catch (e) { toast('Error guardando: ' + e.message, 'err'); }
}

async function guardarCredito() {
  const num = id => parseFloat(document.getElementById('cr-'+id)?.value) || 0;
  const nombre = document.getElementById('cr-nombre')?.value.trim() || 'Crédito';
  try {
    await api('/credito?on_conflict=nombre', 'POST', {
      nombre,
      monto_desembolsado: num('monto_desembolsado'),
      total_cuotas:       parseInt(document.getElementById('cr-total_cuotas')?.value) || 0,
      cuotas_pagadas:     parseInt(document.getElementById('cr-cuotas_pagadas')?.value) || 0,
      capital_pendiente:  num('capital_pendiente'),
      capital_pagado:     num('capital_pagado'),
      intereses_pagados:  num('intereses_pagados')
    }, { Prefer: 'resolution=merge-duplicates,return=minimal' });
    toast('Crédito guardado ✓');
    cargarVistaVentas();
  } catch (e) { toast('Error guardando crédito: ' + e.message, 'err'); }
}
