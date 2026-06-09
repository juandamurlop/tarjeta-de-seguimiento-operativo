// ═══════════════════════════════════════════════════════════
// DASHBOARD DE METAS
// ═══════════════════════════════════════════════════════════

let _metasData = [];

async function cargarDashboardMetas() {
  // Reemplazado por el módulo de Ventas (cuadro del contador).
  if (typeof cargarVistaVentas === 'function') return cargarVistaVentas();
  // Fallback al render anterior si ventas.js no cargó:
  const cont = document.getElementById('dash-metas-contenido');
  if (!cont) return;
  mostrarCargandoSiVacio(cont, '<div class="loading-state">Cargando metas...</div>');

  try {
    const metas = await api('/metas_taller?order=ano.desc,mes_num.desc&limit=24').catch(()=>[]) || [];
    _metasData  = metas;

    const ahora      = new Date();
    const inicioMes  = new Date(ahora.getFullYear(), ahora.getMonth(), 1).toISOString();
    const mesesNombres = ['Enero','Febrero','Marzo','Abril','Mayo','Junio',
                          'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
    const mesActualNombre = mesesNombres[ahora.getMonth()];
    const anioActual      = ahora.getFullYear();
    const mesNumActual    = ahora.getMonth() + 1;

    const [ordenesEnt, etapasMes] = await Promise.all([
      api(`/ordenes?estado=eq.Entregada&creado_en=gte.${inicioMes}&select=id,placa,creado_en`).catch(()=>[]) || [],
      api(`/etapas?fin=gte.${inicioMes}&select=orden_id,valor&fin=not.is.null`).catch(()=>[]) || []
    ]);

    const ingresosMes = etapasMes.reduce((s,e) => s+(e.valor||0), 0);
    const ordenesMes  = ordenesEnt.length;
    const metaMes     = metas.find(m => m.ano === anioActual && m.mes_num === mesNumActual);

    const fmt      = n => n != null ? new Intl.NumberFormat('es-CO',{style:'currency',currency:'COP',minimumFractionDigits:0}).format(n) : '—';
    const pct      = (real, meta) => meta > 0 ? Math.min(Math.round((real/meta)*100), 999) : 0;
    const colorBar = p => p >= 100 ? '#059669' : p >= 70 ? '#D97706' : '#DC2626';

    const pctOrd = metaMes ? pct(ordenesMes, metaMes.meta_ordenes) : null;
    const pctIng = metaMes ? pct(ingresosMes, metaMes.meta_ingresos) : null;

    // ── KPIs del mes ─────────────────────────────────────
    const kpisHtml = metaMes ? `
      <div class="dash-metas-kpi" style="display:grid;grid-template-columns:1.4fr 1fr;gap:8px;margin-bottom:10px">
        <!-- Ingresos — dark blue -->
        <div style="background:#1E3A5F;border-radius:12px;padding:14px 16px;color:white">
          <div style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:1.2px;opacity:.55;margin-bottom:6px">Ingresos del mes</div>
          <div style="font-size:22px;font-weight:800;font-family:'DM Mono',monospace;line-height:1.1">${fmt(ingresosMes)}</div>
          <div style="margin-top:8px">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
              <span style="font-size:10px;opacity:.6">Meta: ${fmt(metaMes.meta_ingresos)}</span>
              <span style="font-size:11px;font-weight:700;color:${pctIng>=100?'#34D399':pctIng>=70?'#FCD34D':'#F87171'}">${pctIng}%</span>
            </div>
            <div style="height:3px;background:rgba(255,255,255,.15);border-radius:99px;overflow:hidden">
              <div style="height:100%;width:${Math.min(pctIng,100)}%;background:${pctIng>=100?'#34D399':pctIng>=70?'#FCD34D':'#F87171'};border-radius:99px"></div>
            </div>
          </div>
        </div>
        <!-- Órdenes -->
        <div style="background:white;border:1px solid var(--gris-borde);border-radius:12px;padding:12px;display:flex;flex-direction:column;gap:6px">
          <div style="width:28px;height:28px;background:#EBF2FF;border-radius:7px;display:flex;align-items:center;justify-content:center;flex-shrink:0">
            <svg width="14" height="14" fill="none" stroke="#2563EB" stroke-width="2" viewBox="0 0 24 24"><rect x="2" y="3" width="20" height="18" rx="2"/><line x1="2" y1="9" x2="22" y2="9"/></svg>
          </div>
          <div style="display:flex;align-items:baseline;gap:4px">
            <div style="font-size:26px;font-weight:800;color:#2563EB;line-height:1">${ordenesMes}</div>
            <div style="font-size:12px;font-weight:600;color:var(--gris-mid)">/ ${metaMes.meta_ordenes}</div>
          </div>
          <div><div style="font-size:11px;font-weight:600;color:var(--texto)">Órdenes cerradas</div><div style="font-size:10px;color:var(--gris-mid)">Este mes</div></div>
          <div>
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:3px">
              <span style="font-size:10px;color:var(--gris-mid)">Progreso</span>
              <span style="font-size:10px;font-weight:700;color:${colorBar(pctOrd)}">${pctOrd}%</span>
            </div>
            <div style="height:3px;background:var(--gris-borde);border-radius:99px;overflow:hidden">
              <div style="height:100%;width:${Math.min(pctOrd,100)}%;background:${colorBar(pctOrd)};border-radius:99px"></div>
            </div>
          </div>
        </div>
      </div>
      ${metaMes.nota ? `
        <div style="background:#FEF3C7;border:1px solid #FDE68A;border-radius:8px;padding:8px 12px;font-size:11px;color:#92400E;margin-bottom:10px">
          <strong>Nota del contador:</strong> ${metaMes.nota}
        </div>` : ''}
    ` : `
      <div style="background:var(--gris-bg);border:1px dashed var(--gris-borde);border-radius:10px;padding:20px;text-align:center;color:var(--gris-mid);margin-bottom:10px">
        <svg width="24" height="24" fill="none" stroke="var(--gris-mid)" stroke-width="1.5" viewBox="0 0 24 24" style="display:block;margin:0 auto 8px"><path d="M13 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V9z"/><polyline points="13 2 13 9 20 9"/></svg>
        <div style="font-size:12px;font-weight:600;margin-bottom:3px">Sin meta para este mes</div>
        <div style="font-size:11px">Descarga la plantilla, el contador la completa y la sube aquí.</div>
      </div>`;

    // ── Historial ─────────────────────────────────────────
    const historialHtml = metas.length ? `
      <div class="card" style="padding:12px 14px">
        <div style="font-size:12px;font-weight:700;color:var(--texto);margin-bottom:10px">Historial de metas</div>
        <div style="overflow-x:auto">
          <table style="width:100%;border-collapse:collapse;font-size:11px;min-width:400px">
            <thead><tr style="background:var(--gris-bg)">
              ${['Período','Meta órdenes','Meta ingresos','Nota'].map(h=>`<th style="padding:6px 10px;text-align:left;font-size:9px;font-weight:700;letter-spacing:.8px;text-transform:uppercase;color:var(--gris-mid);border-bottom:1px solid var(--gris-borde)">${h}</th>`).join('')}
            </tr></thead>
            <tbody>
              ${metas.map(m => {
                const esActual = m.ano === anioActual && m.mes_num === mesNumActual;
                return `<tr style="border-bottom:1px solid var(--gris-borde);${esActual?'background:#EBF2FF;':''}" onmouseenter="this.style.background='var(--gris-bg)'" onmouseleave="this.style.background='${esActual?'#EBF2FF':''}'" >
                  <td style="padding:6px 10px;font-weight:${esActual?'700':'500'};color:${esActual?'#2563EB':'var(--texto)'}">${m.mes||''} ${m.ano}</td>
                  <td style="padding:6px 10px;font-weight:600">${m.meta_ordenes}</td>
                  <td style="padding:6px 10px;font-family:'DM Mono',monospace;font-weight:600">${fmt(m.meta_ingresos)}</td>
                  <td style="padding:6px 10px;color:var(--gris-mid)">${m.nota||'—'}</td>
                </tr>`;
              }).join('')}
            </tbody>
          </table>
        </div>
      </div>
    ` : '';

    // ── Mes siguiente para la plantilla ──────────────────
    const mesSig       = new Date(ahora.getFullYear(), ahora.getMonth()+1, 1);
    const mesSigNombre = mesesNombres[mesSig.getMonth()];
    const mesSigAnio   = mesSig.getFullYear();

    renderSinParpadeo(cont, `
      <!-- Header -->
      <div style="margin-bottom:10px;display:flex;align-items:baseline;gap:10px">
        <div style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:1.2px;color:var(--gris-mid)">Metas del taller</div>
        <div style="font-size:18px;font-weight:800;color:var(--texto)">${mesActualNombre} ${anioActual}</div>
      </div>

      ${kpisHtml}

      <!-- Historial + Cargar meta: 2 columnas en desktop -->
      <div class="dash-metas-bottom" style="display:grid;grid-template-columns:2fr 1fr;gap:10px;align-items:start">
        ${historialHtml}

        <!-- Cargar meta -->
        <div class="card" style="padding:12px 14px">
        <div style="font-size:12px;font-weight:700;color:var(--texto);margin-bottom:2px">Cargar meta mensual</div>
        <div style="font-size:10px;color:var(--gris-mid);margin-bottom:10px">El contador descarga la plantilla, completa los valores y la sube aquí.</div>

        <button class="btn btn-outline btn-sm" onclick="descargarPlantillaCSV()" style="display:inline-flex;align-items:center;gap:6px;font-size:12px;margin-bottom:10px">
          <svg width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
          Descargar plantilla (${mesSigNombre} ${mesSigAnio})
        </button>

        <div style="font-size:10px;background:var(--gris-bg);border:1px solid var(--gris-borde);border-radius:6px;padding:8px 12px;color:var(--gris-mid);margin-bottom:10px;font-family:'DM Mono',monospace">
          Formato CSV: mes, mes_num, ano, meta_ordenes, meta_ingresos, nota
        </div>

        <div class="upload-zone" onclick="document.getElementById('csv-meta-input').click()" style="padding:16px">
          <input type="file" id="csv-meta-input" accept=".csv" style="display:none" onchange="procesarCSVMeta(this)">
          <svg width="20" height="20" fill="none" stroke="var(--gris-mid)" stroke-width="1.5" viewBox="0 0 24 24" style="display:block;margin:0 auto 6px"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
          <p style="margin:0;font-size:12px;color:var(--gris-mid)">Clic para subir CSV de metas</p>
        </div>
      </div>
      </div><!-- /dash-metas-bottom -->
    `);
  } catch(e) {
    cont.innerHTML = `<div class="empty-state">Error: ${e.message}</div>`;
  }
}

function descargarPlantillaCSV() {
  const ahora    = new Date();
  const mesSig   = new Date(ahora.getFullYear(), ahora.getMonth()+1, 1);
  const mesesNombres = ['Enero','Febrero','Marzo','Abril','Mayo','Junio',
                        'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
  const mesNombre = mesesNombres[mesSig.getMonth()];
  const mesNum    = mesSig.getMonth() + 1;
  const anio      = mesSig.getFullYear();

  const cabecera = 'mes,mes_num,ano,meta_ordenes,meta_ingresos,nota';
  const fila     = `${mesNombre},${mesNum},${anio},0,0,Nota del contador aquí`;
  const blob     = new Blob([cabecera+'\n'+fila], { type:'text/csv;charset=utf-8;' });
  const url      = URL.createObjectURL(blob);
  const a        = document.createElement('a');
  a.href         = url;
  a.download     = `meta_${mesNombre.toLowerCase()}_${anio}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  toast('Plantilla descargada ✓');
}

async function procesarCSVMeta(input) {
  const file = input.files[0];
  if (!file) return;
  const text    = await file.text();
  const lines   = text.trim().split('\n').filter(l=>l.trim());
  const headers = lines[0].split(',').map(h=>h.trim().toLowerCase());
  const rows    = lines.slice(1).map(line => {
    const vals = line.split(',').map(v=>v.trim());
    const obj  = {};
    headers.forEach((h,i) => obj[h] = vals[i]||'');
    return obj;
  }).filter(r => r.mes && r.ano);

  if (!rows.length) { toast('CSV vacío o formato incorrecto','err'); return; }

  const mesesMap = {
    enero:1,febrero:2,marzo:3,abril:4,mayo:5,junio:6,
    julio:7,agosto:8,septiembre:9,octubre:10,noviembre:11,diciembre:12
  };

  try {
    for (const r of rows) {
      const mesNum = parseInt(r.mes_num) || mesesMap[r.mes?.toLowerCase()] || null;
      await api('/metas_taller', 'POST', {
        mes:           r.mes,
        mes_num:       mesNum,
        ano:           parseInt(r.ano),
        meta_ordenes:  parseInt(r.meta_ordenes)  || 0,
        meta_ingresos: parseFloat(r.meta_ingresos) || 0,
        nota:          r.nota || null
      }, { Prefer:'resolution=merge-duplicates,return=minimal' });
    }
    toast(`${rows.length} meta(s) cargada(s) ✓`);
    input.value = '';
    cargarDashboardMetas();
  } catch(e) {
    toast('Error guardando metas: '+e.message,'err');
  }
}