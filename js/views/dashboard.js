// ═══════════════════════════════════════════════════════════
// DASHBOARD - ESTADO DEL TALLER
// ═══════════════════════════════════════════════════════════

function actualizarCapacidad(activas, pulmonInterno = 0, pulmonExterno = 0) {
  activas = Number(activas) || 0;
  pulmonInterno = Number(pulmonInterno) || 0;
  pulmonExterno = Number(pulmonExterno) || 0;
  const cap   = document.getElementById('sidebar-capacidad');
  const fillA = document.getElementById('cap-fill-activas');
  const fillP = document.getElementById('cap-fill-pulmon');
  const pctEl = document.getElementById('cap-pct');
  const subEl = document.getElementById('cap-sub');
  const pulmonSubEl = document.getElementById('cap-pulmon-sub');
  if (!cap) return;
  cap.style.display = 'block';

  const circ     = 2 * Math.PI * 30;
  const pulmonTotal = pulmonInterno + pulmonExterno;
  const total    = activas + pulmonInterno;
  const pctA     = Math.min(Math.round((activas / CAPACIDAD_TALLER) * 100), 100);
  const pctP     = Math.min(Math.round((pulmonInterno / CAPACIDAD_TALLER) * 100), 100);
  const pctTotal = Math.min(pctA + pctP, 100);

  // Barra activas (amarillo)
  if (fillA) {
    fillA.style.display = activas > 0 ? '' : 'none';
    fillA.style.strokeDasharray = `${(pctA/100)*circ} ${circ}`;
    fillA.style.strokeDashoffset = '0';
  }
  // Barra pulmón (naranja) — desplazada por el arco de activas
  if (fillP) {
    fillP.style.display = pulmonInterno > 0 ? '' : 'none';
    fillP.style.strokeDasharray = `${(pctP/100)*circ} ${circ}`;
    fillP.style.strokeDashoffset = `-${(pctA/100)*circ}`;
  }
  if (pctEl) pctEl.textContent = pctTotal + '%';
  if (subEl) subEl.textContent = `${total} de ${CAPACIDAD_TALLER} cupos`;
  if (pulmonSubEl) {
    const partes = [];
    if (pulmonInterno > 0) partes.push(`${pulmonInterno} pulmon interno`);
    if (pulmonExterno > 0) partes.push(`${pulmonExterno} pulmon externo`);
    pulmonSubEl.textContent = partes.join(' · ');
    pulmonSubEl.style.display = pulmonTotal > 0 ? 'block' : 'none';
  }
}

// ── Helpers ──────────────────────────────────────────────
function semanaNum(fecha) {
  const d = new Date(fecha);
  d.setHours(0,0,0,0);
  d.setDate(d.getDate() + 3 - (d.getDay() + 6) % 7);
  const w = new Date(d.getFullYear(), 0, 4);
  return 1 + Math.round(((d - w) / 86400000 - 3 + (w.getDay() + 6) % 7) / 7);
}

function diasEntre(a, b) {
  return Math.round((new Date(b) - new Date(a)) / 86400000);
}

async function cargarDashboardMes() {
  const cont = document.getElementById('dash-mes-contenido');
  if (!cont) return;
  if (typeof mostrarCargandoSiVacio === 'function') mostrarCargandoSiVacio(cont, '<div class="loading-state">Cargando...</div>');
  else if (!cont.innerHTML.trim()) cont.innerHTML = '<div class="loading-state">Cargando...</div>';

  try {
    const ahora        = new Date();
    const inicioMesDate = new Date(ahora.getFullYear(), ahora.getMonth(), 1);
    const finMesDate    = new Date(ahora.getFullYear(), ahora.getMonth() + 1, 1);
    const inicioMes    = inicioMesDate.toISOString();
    const finMes       = finMesDate.toISOString();
    const hoy          = new Date(); hoy.setHours(0,0,0,0);

    const [ordenesMes, ordenesActivas, todasEtapas, solicitudesPend, aprobaciones, metasMes] = await Promise.all([
      api(`/ordenes?creado_en=gte.${inicioMes}&creado_en=lt.${finMes}&select=id,numero_ot,placa,marca,linea,modelo,propietario,estado,pulmon,pulmon_tipo,creado_en,fecha_entrega_1,fecha_entrega_2,entregada_en&order=creado_en.desc`).catch(()=>[]) || [],
      api(`/ordenes?estado=eq.Activa&select=id,numero_ot,placa,marca,linea,modelo,propietario,estado,pulmon,pulmon_tipo,creado_en,fecha_entrega_1,fecha_entrega_2`).catch(()=>[]) || [],
      api(`/etapas?select=id,orden_id,servicio,etapa,inicio,fin,valor,tecnico,mecanico_id,tiempo_pausado_min`).catch(()=>[]) || [],
      api(`/solicitudes_repuesto?estado=in.(pendiente_jefe,enviado_repuestos,cotizado,pedido,recibido_taller)&select=id,orden_id,estado,repuesto`).catch(()=>[]) || [],
      api(`/aprobaciones_etapa?select=id,etapa_id,estado&order=creado_en.desc`).catch(()=>[]) || [],
      api(`/metas_taller?ano=eq.${ahora.getFullYear()}&mes_num=eq.${ahora.getMonth()+1}&limit=1`).catch(()=>[]) || []
    ]);
    const metaMes = Array.isArray(metasMes) ? metasMes[0] : null;

    // ── Helpers ──────────────────────────────────────────────
    const fmt     = n => new Intl.NumberFormat('es-CO',{style:'currency',currency:'COP',minimumFractionDigits:0}).format(n||0);
    const mesLabel = ahora.toLocaleDateString('es-CO',{month:'long',year:'numeric'});
    const srvColor  = { latoneria:'#DC2626', pintura:'#D97706', mecanica:'#2563EB', adicionales:'#059669' };
    const srvNombre = { latoneria:'Latonería', pintura:'Pintura', mecanica:'Mecánica', adicionales:'Adicionales' };
    const srvBgMap  = { latoneria:'#FEE2E2', pintura:'#FEF3C7', mecanica:'#EBF2FF', adicionales:'#E6F5EF' };

    // ── Métricas KPI ─────────────────────────────────────────
    const activasNormales = ordenesActivas.filter(o => !o.pulmon).length;
    const pulmonInterno   = ordenesActivas.filter(o => o.pulmon && o.pulmon_tipo === 'interno').length;
    const pulmonExterno   = ordenesActivas.filter(o => o.pulmon && o.pulmon_tipo === 'externo').length;
    const entregadasMes   = ordenesMes.filter(o =>
      o.estado === 'Entregada' || (o.entregada_en && new Date(o.entregada_en) >= inicioMesDate)
    ).length;
    const etapasMesFin = todasEtapas.filter(e => e.fin && new Date(e.fin) >= inicioMesDate && new Date(e.fin) < finMesDate);
    const valorMes     = etapasMesFin.reduce((s,e) => s + (e.valor||0), 0);

    // ── Etapas indexadas por orden ────────────────────────────
    const etapasPorOrden = {};
    todasEtapas.forEach(e => {
      if (!etapasPorOrden[e.orden_id]) etapasPorOrden[e.orden_id] = [];
      etapasPorOrden[e.orden_id].push(e);
    });

    // ── Retrasos ─────────────────────────────────────────────
    const ordenesRetraso = ordenesActivas
      .filter(o => o.fecha_entrega_1 && new Date(o.fecha_entrega_1) < hoy)
      .map(o => {
        const f = new Date(o.fecha_entrega_1); f.setHours(0,0,0,0);
        return { ...o, diasRetraso: Math.round((hoy - f) / 86400000) };
      })
      .sort((a,b) => b.diasRetraso - a.diasRetraso);

    // ── Próximas entregas ─────────────────────────────────────
    const proximas = ordenesActivas
      .filter(o => o.fecha_entrega_1 || o.fecha_entrega_2)
      .map(o => {
        const f = o.fecha_entrega_1 ? new Date(o.fecha_entrega_1) : new Date(o.fecha_entrega_2);
        const fDia = new Date(f); fDia.setHours(0,0,0,0);
        // Hora si fue guardada con tiempo (no medianoche exacta)
        const tieneHora = o.fecha_entrega_1 && (f.getHours() !== 0 || f.getMinutes() !== 0);
        const horaStr = tieneHora ? f.toLocaleTimeString('es-CO', { hour:'2-digit', minute:'2-digit', hour12:false }) : null;
        return { ...o, fechaRef: fDia, dias: Math.round((fDia - hoy) / 86400000), horaStr };
      })
      .filter(o => o.dias >= 0)
      .sort((a,b) => a.dias - b.dias || (a.horaStr||'99:99').localeCompare(b.horaStr||'99:99'))
      .slice(0, 7);

    // ── Flujo operativo (pipeline) ────────────────────────────
    const aprobPorEtapa = {};
    aprobaciones.forEach(a => { if (!aprobPorEtapa[a.etapa_id]) aprobPorEtapa[a.etapa_id] = a.estado; });

    const creadas    = ordenesMes.length;
    const asignadas  = ordenesActivas.filter(o => (etapasPorOrden[o.id]||[]).some(e => e.mecanico_id)).length;
    const enLat      = ordenesActivas.filter(o => (etapasPorOrden[o.id]||[]).some(e => e.servicio==='latoneria' && e.inicio && !e.fin)).length;
    const enPintura  = ordenesActivas.filter(o => (etapasPorOrden[o.id]||[]).some(e => e.servicio==='pintura'   && e.inicio && !e.fin)).length;
    const enMec      = ordenesActivas.filter(o => (etapasPorOrden[o.id]||[]).some(e => e.servicio==='mecanica'  && e.inicio && !e.fin)).length;
    const conCalidad = ordenesActivas.filter(o => {
      const ets = etapasPorOrden[o.id] || [];
      return ets.length > 0 && ets.every(e => aprobPorEtapa[e.id] === 'aprobado');
    }).length;
    const listaEntrega = ordenesActivas.filter(o => {
      const ets = etapasPorOrden[o.id] || [];
      return ets.length > 0 && ets.every(e => !!e.fin) && ets.every(e => aprobPorEtapa[e.id] === 'aprobado');
    }).length;

    // ── Tiempo promedio por servicio ──────────────────────────
    const tiemposPorSrv = {};
    todasEtapas.filter(e => e.inicio && e.fin).forEach(e => {
      const srv  = e.servicio || 'adicionales';
      const mins = Math.max(0, Math.round((new Date(e.fin) - new Date(e.inicio)) / 60000) - (e.tiempo_pausado_min||0));
      if (mins > 0) { if (!tiemposPorSrv[srv]) tiemposPorSrv[srv] = []; tiemposPorSrv[srv].push(mins); }
    });

    // ────────────────────────────────────────────────────────
    // HTML BLOCKS
    // ────────────────────────────────────────────────────────

    // — KPI chips (van en la barra de tabs, no en el contenido) —
    const chipsEl = document.getElementById('dash-kpi-chips');
    if (chipsEl) {
      const pctFact = metaMes?.meta_ingresos ? Math.min(Math.round((valorMes / metaMes.meta_ingresos) * 100), 100) : null;
      const barColor = pctFact !== null ? (pctFact >= 100 ? '#34D399' : pctFact >= 70 ? '#FCD34D' : '#F87171') : null;
      const pctOrd  = metaMes?.meta_ordenes  ? Math.min(Math.round((ordenesMes.length / metaMes.meta_ordenes) * 100), 100) : null;

      const chip = (num, label, sub, color, bg, onclick) =>
        `<div class="kpi-chip" onclick="${onclick}" style="background:${bg};border:1px solid ${bg === 'white' ? 'var(--gris-borde)' : 'transparent'};border-radius:8px;padding:6px 10px;cursor:${onclick ? 'pointer' : 'default'};text-align:center;transition:opacity .15s" onmouseenter="this.style.opacity='.8'" onmouseleave="this.style.opacity='1'">
          <div class="kpi-chip-num" style="font-size:17px;font-weight:800;color:${color};line-height:1;font-family:'DM Mono',monospace">${num}</div>
          <div class="kpi-chip-label" style="font-size:10px;font-weight:600;color:${color};opacity:.75;margin-top:2px;white-space:nowrap">${label}</div>
          ${sub ? `<div class="kpi-chip-sub" style="font-size:9px;color:${color};opacity:.5;white-space:nowrap">${sub}</div>` : ''}
        </div>`;

      chipsEl.innerHTML =
        chip(activasNormales, 'Activas', 'En proceso', '#2563EB', 'white', "navJefe('ordenes')") +
        chip(ordenesMes.length + (pctOrd !== null ? `<span style='font-size:12px;opacity:.6'>/${metaMes.meta_ordenes}</span>` : ''), 'Creadas', 'Este mes', '#7C3AED', 'white', "dashFiltrarOrdenes('creadas')") +
        chip(entregadasMes, 'Entregadas', 'Este mes', '#059669', 'white', "dashFiltrarOrdenes('entregadas')") +
        chip(pulmonInterno + pulmonExterno, 'En pulmón', pulmonInterno + ' int · ' + pulmonExterno + ' ext', '#D97706', 'white', "dashFiltrarOrdenes('pulmon')");
    }

    // — Retrasos —
    const retrasosHtml = ordenesRetraso.length ? `
      <div style="display:inline-flex;align-items:center;gap:6px;background:#FEF2F2;border:1px solid #FECACA;border-radius:99px;padding:4px 10px;margin-bottom:10px;flex-wrap:wrap">
        <svg width="11" height="11" fill="none" stroke="#DC2626" stroke-width="2.5" viewBox="0 0 24 24" style="flex-shrink:0"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
        <span style="font-size:11px;font-weight:700;color:#DC2626;white-space:nowrap">${ordenesRetraso.length} con retraso:</span>
        ${ordenesRetraso.map(o => `
          <span style="font-family:'DM Mono',monospace;font-weight:700;font-size:10px;color:#DC2626;background:var(--surface);border:1px solid #FECACA;border-radius:99px;padding:1px 7px;cursor:pointer;letter-spacing:.3px" onclick="abrirOrden(${o.id})">${escapeHtml(o.placa)} <span style="opacity:.7">+${o.diasRetraso}d</span></span>`).join('')}
      </div>` : '';

    // — Pipeline —
    const pasos = [
      { label:'Creadas',    val:creadas,     color:'#2563EB', bg:'#EBF2FF' },
      { label:'Asignadas',  val:asignadas,   color:'#7C3AED', bg:'#F5F3FF' },
      { label:'Latonería',  val:enLat,       color:'#DC2626', bg:'#FEE2E2' },
      { label:'Pintura',    val:enPintura,   color:'#D97706', bg:'#FEF3C7' },
      { label:'Mecánica',   val:enMec,       color:'#0891B2', bg:'#E0F2FE' },
      { label:'Calidad',    val:conCalidad,  color:'#059669', bg:'#E6F5EF' },
      { label:'Lista',      val:listaEntrega,color:'#16A34A', bg:'#DCFCE7' },
    ];
    const pipelineHtml = pasos.map((p, i) => `
      <div style="flex:1;min-width:0;display:flex;align-items:center;gap:3px">
        <div style="flex:1;min-width:0;background:${p.bg};border-radius:8px;padding:8px 4px;text-align:center">
          <div style="font-size:20px;font-weight:800;color:${p.color};line-height:1">${p.val}</div>
          <div style="font-size:9px;font-weight:600;color:${p.color};margin-top:3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${p.label}</div>
        </div>
        ${i < pasos.length-1 ? `<svg width="10" height="10" fill="none" stroke="var(--gris-mid)" stroke-width="2" viewBox="0 0 24 24" style="flex-shrink:0"><polyline points="9 18 15 12 9 6"/></svg>` : ''}
      </div>`).join('');

    // — Próximas entregas —
    const proximasHtml = proximas.length ? proximas.map(o => {
      const color = o.dias === 0 ? 'var(--rojo)' : o.dias <= 2 ? '#D97706' : '#059669';
      const bg    = o.dias === 0 ? '#FEE2E2'     : o.dias <= 2 ? '#FEF3C7' : '#E6F5EF';
      const label = o.dias === 0 ? 'Hoy' : o.dias === 1 ? 'Mañana' : `${o.dias}d`;
      return `<div style="display:flex;align-items:center;gap:8px;padding:5px 0;border-bottom:1px solid var(--gris-borde);cursor:pointer" onclick="abrirOrden(${o.id})">
        <div style="flex:1;min-width:0;overflow:hidden">
          <div style="font-family:'DM Mono',monospace;font-weight:700;font-size:11px;letter-spacing:.5px">${escapeHtml(o.placa)}</div>
          <div style="font-size:10px;color:var(--gris-mid);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escapeHtml(o.propietario||'—')}</div>
        </div>
        <div style="text-align:right;flex-shrink:0">
          <span style="font-size:10px;font-weight:700;color:${color};background:${bg};padding:2px 6px;border-radius:99px;display:block">${label}</span>
          ${o.horaStr ? `<span style="font-family:'DM Mono',monospace;font-size:9px;color:${color};opacity:.75;display:block;margin-top:2px">${o.horaStr}</span>` : ''}
        </div>
      </div>`;
    }).join('') : '<div style="font-size:12px;color:var(--gris-mid);padding:8px 0">Sin próximas entregas programadas.</div>';

    // — Tabla órdenes activas (máx 3, luego "Ver todas") —
    const buildFila = o => {
      const ets         = etapasPorOrden[o.id] || [];
      const etapaActiva = ets.find(e => e.inicio && !e.fin);
      const responsable = etapaActiva?.tecnico || null;
      const srv         = etapaActiva?.servicio || null;
      const srvLabel    = srv ? (srvNombre[srv]||srv) : (ets.length ? 'Sin iniciar' : 'Sin etapas');
      const srvC        = srv ? (srvColor[srv]||'#6B7280') : '#9CA3AF';
      const srvBg       = srv ? (srvBgMap[srv]||'#F3F4F6') : '#F3F4F6';
      const diasTaller  = Math.round((ahora - new Date(o.creado_en)) / 86400000);
      const fEnt        = o.fecha_entrega_1 ? (() => { const d=new Date(o.fecha_entrega_1);d.setHours(0,0,0,0);return d; })() : null;
      const diasDelay   = fEnt ? Math.round((hoy - fEnt) / 86400000) : null;
      const riesgo      = diasDelay === null ? null : diasDelay > 0 ? 'Alto' : diasDelay >= -2 ? 'Medio' : 'Bajo';
      const rC = { Alto:'#DC2626', Medio:'#D97706', Bajo:'#059669' };
      const rB = { Alto:'#FEE2E2', Medio:'#FEF3C7', Bajo:'#E6F5EF' };
      const barColor = riesgo === 'Alto' ? '#DC2626' : riesgo === 'Medio' ? '#D97706' : srvC;
      return `<div class="row-hover" style="display:flex;align-items:center;gap:10px;padding:7px 8px;border-bottom:1px solid var(--gris-borde);cursor:pointer;border-radius:6px" onclick="abrirOrden(${o.id})">
        <div style="width:3px;align-self:stretch;border-radius:99px;background:${barColor};flex-shrink:0"></div>
        <div style="flex:1;min-width:0">
          <div style="display:flex;align-items:baseline;gap:8px;margin-bottom:2px">
            <span style="font-family:'DM Mono',monospace;font-size:13px;font-weight:800;color:var(--texto);letter-spacing:.5px">${escapeHtml(o.placa)}</span>
            <span style="font-size:11px;font-weight:700;color:${diasTaller>10?'#DC2626':diasTaller>5?'#D97706':'var(--gris-mid)'}">${diasTaller}d</span>
          </div>
          <div style="font-size:11px;color:var(--gris-mid)">${[o.marca,o.linea].filter(Boolean).map(escapeHtml).join(' ')||'—'}</div>
          <div style="font-size:9px;color:var(--gris-mid);opacity:.65;margin-top:1px">${otDe(o)}${responsable?' · '+responsable.split(' ')[0]:''}</div>
        </div>
        <div style="display:flex;flex-direction:column;align-items:flex-end;gap:4px;flex-shrink:0">
          <span style="font-size:10px;font-weight:600;color:${srvC};background:${srvBg};padding:2px 8px;border-radius:5px">${srvLabel}</span>
          ${riesgo==='Alto'
            ? `<span style="font-size:10px;font-weight:800;color:#DC2626;letter-spacing:.3px">RETRASADA</span>`
            : riesgo==='Medio'
              ? `<span style="font-size:10px;font-weight:700;color:#D97706">En riesgo</span>`
              : `<span style="font-size:9px;color:#9CA3AF">En tiempo</span>`
          }
        </div>
      </div>`;
    };
    const filasOrdenes    = ordenesActivas.slice(0,3).map(buildFila).join('');
    const restanteOrdenes = ordenesActivas.length - 3;

    const tablaHtml = ordenesActivas.length ? `
      <div>${filasOrdenes}</div>
      ${restanteOrdenes > 0 ? `
        <div style="text-align:center;margin-top:10px">
          <button onclick="switchTab('ordenes')" style="background:none;border:1px solid var(--gris-borde);border-radius:8px;padding:6px 16px;font-size:11px;font-weight:600;color:var(--gris-mid);cursor:pointer">
            Ver todas las órdenes (${restanteOrdenes} más)
          </button>
        </div>` : ''}
      ` : '<div class="empty-state"><p>Sin órdenes activas.</p></div>';

    // — Tiempo promedio —
    const tiemposHtml = Object.entries(tiemposPorSrv).length
      ? Object.entries(tiemposPorSrv)
          .sort((a,b) => (b[1].reduce((x,y)=>x+y,0)/b[1].length) - (a[1].reduce((x,y)=>x+y,0)/a[1].length))
          .map(([srv, arr]) => {
            const avg = Math.round(arr.reduce((a,b)=>a+b,0)/arr.length);
            const h   = Math.floor(avg/60), m = avg%60;
            const dias = Math.floor(h/8);
            const label = dias > 0 ? `${dias}d ${h%8}h` : h > 0 ? `${h}h ${m}m` : `${m}m`;
            const color = srvColor[srv]||'#6B7280';
            return `<div style="display:flex;align-items:center;justify-content:space-between;padding:5px 0;border-bottom:1px solid var(--gris-borde)">
              <div style="display:flex;align-items:center;gap:6px">
                <div style="width:7px;height:7px;border-radius:50%;background:${color};flex-shrink:0"></div>
                <span style="font-size:11px;color:var(--texto)">${srvNombre[srv]||srv}</span>
              </div>
              <span style="font-size:11px;font-weight:700;color:${color};font-family:'DM Mono',monospace">${label}</span>
            </div>`;
          }).join('')
      : '<div style="font-size:12px;color:var(--gris-mid);padding:8px 0">Sin datos históricos aún.</div>';

    // ────────────────────────────────────────────────────────
    // RENDER
    // ────────────────────────────────────────────────────────
    cont.innerHTML = `
      <!-- Indicador de período + alertas de retraso en la misma fila -->
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px;flex-wrap:wrap">
        <span style="font-size:11px;font-weight:700;color:var(--gris-mid);flex-shrink:0">${mesLabel.charAt(0).toUpperCase() + mesLabel.slice(1)}</span>
        ${retrasosHtml.replace('margin-bottom:10px','margin-bottom:0')}
      </div>

      <!-- Fila 1: tabla órdenes | próximas entregas -->
      <div class="dash-mes-grid" style="display:grid;grid-template-columns:1fr 260px;gap:10px;align-items:start;margin-bottom:10px">

        <!-- Columna izquierda: tabla de órdenes activas -->
        <div class="card" style="padding:12px 14px">
          <div style="font-size:12px;font-weight:700;color:var(--texto);margin-bottom:1px">Órdenes de trabajo activas</div>
          <div style="font-size:10px;color:var(--gris-mid);margin-bottom:10px">Seguimiento en tiempo real</div>
          ${tablaHtml}
        </div>

        <!-- Columna derecha: solo próximas entregas -->
        <div class="card" style="padding:12px 14px">
          <div style="font-size:12px;font-weight:700;color:var(--texto);margin-bottom:8px">Próximas entregas</div>
          ${proximasHtml}
        </div>

      </div>

      <!-- Fila 2: tiempo promedio | repuestos pendientes -->
      <div class="dash-mes-bottom" style="display:grid;grid-template-columns:1fr 1fr;gap:10px;align-items:start">

        <!-- Tiempo promedio por servicio -->
        <div class="card" style="padding:12px 14px">
          <div style="font-size:12px;font-weight:700;color:var(--texto);margin-bottom:1px">Tiempo promedio por servicio</div>
          <div style="font-size:10px;color:var(--gris-mid);margin-bottom:10px">Histórico general</div>
          ${tiemposHtml}
        </div>

        <!-- Repuestos pendientes -->
        <div class="card" style="padding:12px 14px">
          <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:8px">
            <div>
              <div style="font-size:12px;font-weight:700;color:var(--texto);margin-bottom:1px">Repuestos pendientes</div>
              <div style="font-size:10px;color:var(--gris-mid);margin-bottom:12px">Solicitudes activas</div>
              <div style="font-size:26px;font-weight:800;color:${solicitudesPend.length>0?'var(--rojo)':'var(--verde)'};line-height:1">${solicitudesPend.length}</div>
              <div style="font-size:11px;font-weight:600;color:${solicitudesPend.length>0?'var(--rojo)':'var(--verde)'};margin-top:6px">${solicitudesPend.length>0?'Atención requerida':'Todo al día'}</div>
              ${solicitudesPend.length>0?`<div style="font-size:10px;color:var(--gris-mid);margin-top:3px">${solicitudesPend.length} ${solicitudesPend.length===1?'solicitud pendiente':'solicitudes pendientes'}</div>`:'<div style="font-size:10px;color:var(--gris-mid);margin-top:3px">Sin pendientes</div>'}
            </div>
            <div style="width:44px;height:44px;background:${solicitudesPend.length>0?'var(--rojo-bg)':'var(--verde-bg)'};border-radius:11px;display:flex;align-items:center;justify-content:center;flex-shrink:0">
              <svg width="20" height="20" fill="none" stroke="${solicitudesPend.length>0?'var(--rojo)':'var(--verde)'}" stroke-width="2" viewBox="0 0 24 24"><path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>
            </div>
          </div>
        </div>

      </div>`;

  } catch(e) {
    cont.innerHTML = `<div class="empty-state">Error: ${e.message}</div>`;
  }
}

// ── Dashboard principal (General) ────────────────────────
async function cargarDashboard() {
  const cont = document.getElementById('dash-contenido');
  if (!cont) return;
  if (typeof mostrarCargandoSiVacio === 'function') mostrarCargandoSiVacio(cont, '<div class="loading-state">Cargando...</div>');
  else if (!cont.innerHTML.trim()) cont.innerHTML = '<div class="loading-state">Cargando...</div>';

  try {
    const ahora  = new Date();
    const hoy    = new Date(); hoy.setHours(0,0,0,0);
    const manana = new Date(hoy); manana.setDate(hoy.getDate()+1);
    const hace60 = new Date(hoy); hace60.setDate(hoy.getDate()-60);
    const inicioMes = new Date(ahora.getFullYear(), ahora.getMonth(), 1);

    const [ordenes, todasEtapas, etapasActArr, aprobaciones, solicitudesPend] = await Promise.all([
      api(`/ordenes?select=id,numero_ot,placa,marca,linea,modelo,propietario,estado,pulmon,pulmon_tipo,creado_en,fecha_entrega_1,entregada_en`).catch(()=>[]) || [],
      api(`/etapas?select=id,orden_id,servicio,etapa,inicio,fin,tecnico,valor,tiempo_pausado_min&order=creado_en.asc`).catch(()=>[]) || [],
      api(`/etapas?fin=is.null&inicio=not.is.null&select=id,orden_id,servicio,etapa,tecnico,inicio`).catch(()=>[]) || [],
      api(`/aprobaciones_etapa?estado=eq.aprobado&select=etapa_id`).catch(()=>[]) || [],
      api(`/solicitudes_repuesto?estado=in.(pendiente_jefe,enviado_repuestos,cotizado,pedido,recibido_taller)&select=id,orden_id`).catch(()=>[]) || []
    ]);

    // ── Helpers ──────────────────────────────────────────
    const fmt       = n => new Intl.NumberFormat('es-CO',{style:'currency',currency:'COP',minimumFractionDigits:0}).format(n||0);
    const srvColor  = { latoneria:'#DC2626', pintura:'#D97706', mecanica:'#2563EB', adicionales:'#059669' };
    const srvNombre = { latoneria:'Latonería', pintura:'Pintura', mecanica:'Mecánica', adicionales:'Adicionales' };
    const srvBg     = { latoneria:'#FEE2E2', pintura:'#FEF3C7', mecanica:'#EBF2FF', adicionales:'#E6F5EF' };

    // ── KPIs ─────────────────────────────────────────────
    const activasArr     = ordenes.filter(o => o.estado === 'Activa' && !o.pulmon);
    const pulmonInt      = ordenes.filter(o => o.pulmon && o.pulmon_tipo === 'interno').length;
    const pulmonExt      = ordenes.filter(o => o.pulmon && o.pulmon_tipo === 'externo').length;
    const pulmonTotal    = pulmonInt + pulmonExt;
    const entregadasArr  = ordenes.filter(o => o.estado === 'Entregada');
    const entregadasHoy  = entregadasArr.filter(o => o.entregada_en && new Date(o.entregada_en) >= hoy && new Date(o.entregada_en) < manana);
    const totalOrdenes   = ordenes.length;
    const pctActivas     = totalOrdenes > 0 ? Math.round((activasArr.length / totalOrdenes) * 100) : 0;

    actualizarCapacidad(activasArr.length, pulmonInt, pulmonExt);

    // Facturación del mes
    const valorMes = todasEtapas.filter(e => e.fin && new Date(e.fin) >= inicioMes).reduce((s,e)=>s+(e.valor||0),0);

    // ── Etapas indexadas ─────────────────────────────────
    const etapasPorOrden = {};
    todasEtapas.forEach(e => { if (!etapasPorOrden[e.orden_id]) etapasPorOrden[e.orden_id] = []; etapasPorOrden[e.orden_id].push(e); });
    const aprobSet = new Set(aprobaciones.map(a => a.etapa_id));

    // ── Retrasos ─────────────────────────────────────────
    const retrasos = activasArr.filter(o => o.fecha_entrega_1 && new Date(o.fecha_entrega_1) < hoy);

    // ── Pipeline ─────────────────────────────────────────
    const enLat  = activasArr.filter(o => (etapasPorOrden[o.id]||[]).some(e=>e.servicio==='latoneria'&&e.inicio&&!e.fin)).length;
    const enPin  = activasArr.filter(o => (etapasPorOrden[o.id]||[]).some(e=>e.servicio==='pintura'&&e.inicio&&!e.fin)).length;
    const enMec  = activasArr.filter(o => (etapasPorOrden[o.id]||[]).some(e=>e.servicio==='mecanica'&&e.inicio&&!e.fin)).length;
    const enAdd  = activasArr.filter(o => (etapasPorOrden[o.id]||[]).some(e=>e.servicio==='adicionales'&&e.inicio&&!e.fin)).length;
    const listaEnt = activasArr.filter(o => { const ets=etapasPorOrden[o.id]||[]; return ets.length>0&&ets.every(e=>!!e.fin&&aprobSet.has(e.id)); }).length;
    const asignadas = activasArr.filter(o => (etapasPorOrden[o.id]||[]).some(e=>e.tecnico)).length;

    // ── Próximas entregas ─────────────────────────────────
    const proximas = activasArr
      .filter(o => o.fecha_entrega_1)
      .map(o => {
        const f = new Date(o.fecha_entrega_1); const fD = new Date(f); fD.setHours(0,0,0,0);
        const dias = Math.round((fD - hoy) / 86400000);
        const th = f.getHours()!==0||f.getMinutes()!==0;
        return { ...o, dias, horaStr: th ? f.toLocaleTimeString('es-CO',{hour:'2-digit',minute:'2-digit',hour12:false}) : null };
      })
      .filter(o => o.dias >= -1).sort((a,b)=>a.dias-b.dias).slice(0,5);

    // ── Carga por área (etapas activas) ──────────────────
    const srvActivos = {};
    etapasActArr.forEach(e => { const s=e.servicio||'adicionales'; srvActivos[s]=(srvActivos[s]||0)+1; });
    const totalActivos = Math.max(Object.values(srvActivos).reduce((a,b)=>a+b,0),1);

    // ── Tiempo promedio por servicio ──────────────────────
    const tiemposPorSrv = {};
    todasEtapas.filter(e=>e.inicio&&e.fin).forEach(e => {
      const srv = e.servicio||'adicionales';
      const mins = Math.max(0,Math.round((new Date(e.fin)-new Date(e.inicio))/60000)-(e.tiempo_pausado_min||0));
      if (mins>0) { if (!tiemposPorSrv[srv]) tiemposPorSrv[srv]=[]; tiemposPorSrv[srv].push(mins); }
    });

    // ── Eficiencia (entregas a tiempo, últimos 60 días) ───
    const entRec   = entregadasArr.filter(o=>o.entregada_en&&o.fecha_entrega_1&&new Date(o.entregada_en)>=hace60);
    const aTiempo  = entRec.filter(o=>new Date(o.entregada_en)<=new Date(o.fecha_entrega_1));
    const eficiencia = entRec.length>0 ? Math.round((aTiempo.length/entRec.length)*100) : null;
    const efColor = eficiencia===null?'#6B7280':eficiencia>=80?'#059669':eficiencia>=60?'#D97706':'#DC2626';

    // ── Servicios más demandados ──────────────────────────
    const conteoSrv = {};
    todasEtapas.forEach(e => { const s=e.servicio||'adicionales'; conteoSrv[s]=(conteoSrv[s]||0)+1; });
    const totalSrv  = Math.max(Object.values(conteoSrv).reduce((a,b)=>a+b,0),1);

    // ── Técnicos activos ──────────────────────────────────
    const tecActivos = new Set(etapasActArr.map(e=>e.tecnico).filter(Boolean));

    // ── Procesos activos en taller (tabla top 6) ──────────
    const procesosTabla = activasArr
      .filter(o => etapasActArr.some(e=>e.orden_id===o.id))
      .slice(0,6)
      .map(o => {
        const ea = etapasActArr.find(e=>e.orden_id===o.id);
        const diasTaller = Math.round((ahora-new Date(o.creado_en))/86400000);
        const vencida = o.fecha_entrega_1 && new Date(o.fecha_entrega_1)<ahora;
        return { o, ea, diasTaller, vencida };
      });

    // ════════════════════════════════════════════════════
    // HTML BLOCKS
    // ════════════════════════════════════════════════════

    // — Donut SVG helper —
    const buildDonut = (slices, sz=90, sw=16) => {
      const r=(sz-sw)/2, cx=sz/2, cy=sz/2, circ=2*Math.PI*r;
      let cum=0;
      const hasData = slices.some(s=>s.pct>0);
      if (!hasData) return `<svg width="${sz}" height="${sz}" viewBox="0 0 ${sz} ${sz}"><circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="var(--gris-borde)" stroke-width="${sw}"/></svg>`;
      const paths = slices.filter(s=>s.pct>0).map(s => {
        const len=(s.pct/100)*circ;
        const p=`<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${s.color}" stroke-width="${sw}" stroke-dasharray="${len.toFixed(2)} ${(circ-len).toFixed(2)}" stroke-dashoffset="${(-cum).toFixed(2)}" transform="rotate(-90 ${cx} ${cy})" stroke-linecap="butt"/>`;
        cum+=len; return p;
      });
      return `<svg width="${sz}" height="${sz}" viewBox="0 0 ${sz} ${sz}">${paths.join('')}</svg>`;
    };

    // — Donut data —
    const donutSlices = Object.entries(srvActivos).map(([srv,n]) => ({
      srv, n, color: srvColor[srv]||'#6B7280', pct: Math.round((n/totalActivos)*100)
    }));

    // — Carga por área HTML —
    const donutLeyenda = Object.entries(srvActivos).length
      ? Object.entries(srvActivos).sort((a,b)=>b[1]-a[1]).map(([srv,n]) => {
          const pct = Math.round((n/totalActivos)*100);
          const color = srvColor[srv]||'#6B7280';
          return `<div style="display:flex;align-items:center;gap:8px;padding:4px 0;cursor:pointer" onclick="switchTab('ordenes')">
            <div style="width:8px;height:8px;border-radius:2px;background:${color};flex-shrink:0"></div>
            <span style="font-size:11px;font-weight:600;color:${color};flex:1">${srvNombre[srv]||srv}</span>
            <span style="font-size:11px;font-weight:700;color:${color}">${n}</span>
            <span style="font-size:10px;color:var(--gris-mid);width:28px;text-align:right">${pct}%</span>
          </div>`;
        }).join('')
      : '<div style="font-size:11px;color:var(--gris-mid);padding:8px 0">Sin procesos activos</div>';

    // — Procesos activos tabla HTML —
    const procesosTablaHtml = procesosTabla.length ? `
      <div>
        ${procesosTabla.map(({o,ea,diasTaller,vencida})=>{
          const srv    = ea?.servicio||null;
          const etLabel = ea?.etapa || (srv ? srvNombre[srv]||srv : 'En proceso');
          const sC     = srv ? srvColor[srv]||'#6B7280' : '#9CA3AF';
          const sB     = srv ? srvBg[srv]||'#F3F4F6'   : '#F3F4F6';
          const tec    = ea?.tecnico || null;
          return `<div class="row-hover" style="display:flex;align-items:center;gap:10px;padding:7px 8px;border-bottom:1px solid var(--gris-borde);cursor:pointer;border-radius:6px" onclick="abrirOrden(${o.id})">
            <div style="width:3px;align-self:stretch;border-radius:99px;background:${vencida?'#DC2626':sC};flex-shrink:0"></div>
            <div style="flex:1;min-width:0">
              <div style="display:flex;align-items:baseline;gap:8px;margin-bottom:2px">
                <span style="font-family:'DM Mono',monospace;font-size:13px;font-weight:800;color:var(--texto);letter-spacing:.5px">${escapeHtml(o.placa)}</span>
                <span style="font-size:11px;font-weight:700;color:${diasTaller>10?'#DC2626':diasTaller>5?'#D97706':'var(--gris-mid)'}">${diasTaller}d</span>
              </div>
              <div style="font-size:11px;color:var(--gris-mid)">${escapeHtml([o.marca,o.linea].filter(Boolean).join(' ')||'—')}</div>
              <div style="font-size:9px;color:var(--gris-mid);opacity:.65;margin-top:1px">${otDe(o)}${tec?' · '+tec.split(' ')[0]:''}</div>
            </div>
            <div style="display:flex;flex-direction:column;align-items:flex-end;gap:4px;flex-shrink:0">
              <span style="font-size:10px;font-weight:600;color:${sC};background:${sB};padding:2px 8px;border-radius:5px">${etLabel}</span>
              ${vencida
                ? `<span style="font-size:10px;font-weight:800;color:#DC2626;letter-spacing:.3px">RETRASADA</span>`
                : `<span style="font-size:9px;color:#9CA3AF">En tiempo</span>`
              }
            </div>
          </div>`;
        }).join('')}
      </div>
      <div style="text-align:center;margin-top:10px">
        <button onclick="switchTab('ordenes')" style="background:none;border:1px solid var(--gris-borde);border-radius:7px;padding:5px 14px;font-size:11px;font-weight:600;color:var(--gris-mid);cursor:pointer">Ver todas las órdenes</button>
      </div>`
      : '<div class="empty-state"><p>Sin procesos activos.</p></div>';

    // — Servicios más demandados HTML —
    const demandadosHtml = Object.entries(conteoSrv).length
      ? Object.entries(conteoSrv).sort((a,b)=>b[1]-a[1]).map(([srv,n]) => {
          const pct   = Math.round((n/totalSrv)*100);
          const color = srvColor[srv]||'#6B7280';
          return `<div style="margin-bottom:10px">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
              <div style="display:flex;align-items:center;gap:6px">
                <div style="width:8px;height:8px;border-radius:2px;background:${color}"></div>
                <span style="font-size:12px;font-weight:600;color:var(--texto)">${srvNombre[srv]||srv}</span>
              </div>
              <div style="display:flex;gap:8px;align-items:center">
                <span style="font-size:10px;color:var(--gris-mid)">${n} etapas</span>
                <span style="font-size:11px;font-weight:700;color:${color}">${pct}%</span>
              </div>
            </div>
            <div style="height:5px;background:var(--gris-borde);border-radius:99px;overflow:hidden">
              <div style="height:100%;width:${pct}%;background:${color};border-radius:99px"></div>
            </div>
          </div>`;
        }).join('')
      : '<div style="font-size:11px;color:var(--gris-mid)">Sin datos aún.</div>';

    // — Tiempo promedio HTML —
    const tiempoHtml = Object.entries(tiemposPorSrv).length
      ? Object.entries(tiemposPorSrv).sort((a,b)=>(b[1].reduce((x,y)=>x+y,0)/b[1].length)-(a[1].reduce((x,y)=>x+y,0)/a[1].length)).map(([srv,arr])=>{
          const avg=Math.round(arr.reduce((a,b)=>a+b,0)/arr.length);
          const h=Math.floor(avg/60),m=avg%60,dias=Math.floor(h/8);
          const label=dias>0?`${dias}d ${h%8}h`:h>0?`${h}h ${m}m`:`${m}m`;
          const color=srvColor[srv]||'#6B7280';
          const maxAvg=Math.max(...Object.entries(tiemposPorSrv).map(([,a])=>Math.round(a.reduce((x,y)=>x+y,0)/a.length)),1);
          const barW=Math.round((avg/maxAvg)*100);
          return `<div style="margin-bottom:10px">
            <div style="display:flex;justify-content:space-between;margin-bottom:4px">
              <span style="font-size:12px;font-weight:600;color:${color}">${srvNombre[srv]||srv}</span>
              <span style="font-family:'DM Mono',monospace;font-size:12px;font-weight:700;color:${color}">${label}</span>
            </div>
            <div style="height:5px;background:var(--gris-borde);border-radius:99px;overflow:hidden">
              <div style="height:100%;width:${barW}%;background:${color};border-radius:99px"></div>
            </div>
            <div style="font-size:10px;color:var(--gris-mid);margin-top:2px">${arr.length} etapas completadas</div>
          </div>`;
        }).join('')
      : '<div style="font-size:11px;color:var(--gris-mid)">Sin datos históricos.</div>';

    // — Próximas entregas HTML (timeline por día) —
    const _prxGroups = {};
    proximas.forEach(o => {
      const k = o.dias < 0 ? 'Vencidas' : o.dias === 0 ? 'Hoy' : o.dias === 1 ? 'Mañana' : `${o.dias}d`;
      if (!_prxGroups[k]) _prxGroups[k] = [];
      _prxGroups[k].push(o);
    });
    const proximasHtml = proximas.length
      ? Object.entries(_prxGroups).map(([grp, items]) => {
          const gC = grp==='Vencidas'?'#DC2626':grp==='Hoy'?'#D97706':'var(--gris-mid)';
          return `<div style="margin-bottom:10px">
            <div style="font-size:8px;font-weight:800;text-transform:uppercase;letter-spacing:1.4px;color:${gC};margin-bottom:5px">${grp}</div>
            ${items.map(o => `
              <div style="display:flex;align-items:center;gap:8px;padding:5px 0;cursor:pointer" onclick="abrirOrden(${o.id})">
                <span style="font-family:'DM Mono',monospace;font-size:9px;color:var(--gris-mid);flex-shrink:0;min-width:34px">${o.horaStr||''}</span>
                <span style="font-family:'DM Mono',monospace;font-weight:800;font-size:12px;color:var(--texto)">${escapeHtml(o.placa)}</span>
                <span style="font-size:10px;color:var(--gris-mid);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1">${escapeHtml(o.propietario||'')}</span>
              </div>`).join('')}
          </div>`;
        }).join('')
      : '<div style="font-size:11px;color:var(--gris-mid)">Sin entregas próximas.</div>';

    // — Retrasos banner —
    const retrasosHtml = retrasos.length ? `
      <div style="background:#FEF2F2;border:1px solid #FECACA;border-radius:8px;padding:8px 14px;margin-bottom:10px;display:flex;align-items:center;gap:10px;flex-wrap:wrap">
        <svg width="14" height="14" fill="none" stroke="#DC2626" stroke-width="2.5" viewBox="0 0 24 24"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
        <span style="font-size:12px;font-weight:700;color:#DC2626">${retrasos.length} ${retrasos.length===1?'vehículo':'vehículos'} con retraso en el proceso</span>
        ${retrasos.map(o=>`<span onclick="abrirOrden(${o.id})" style="font-family:'DM Mono',monospace;font-size:11px;font-weight:700;color:#DC2626;background:var(--surface);border:1px solid #FECACA;border-radius:6px;padding:2px 8px;cursor:pointer">${escapeHtml(o.placa)}</span>`).join('')}
      </div>` : '';

    // ════════════════════════════════════════════════════
    // RENDER
    // ════════════════════════════════════════════════════
    cont.innerHTML = `
      ${retrasosHtml}

      <!-- Fila main: Procesos activos | Próximas entregas -->
      <div class="dash-gen-main" style="display:grid;grid-template-columns:1fr 260px;gap:10px;margin-bottom:10px;align-items:start">
        <!-- Procesos activos tabla -->
        <div class="card" style="padding:12px 14px">
          <div style="font-size:12px;font-weight:700;color:var(--texto);margin-bottom:2px">Procesos activos en el taller</div>
          <div style="font-size:10px;color:var(--gris-mid);margin-bottom:10px">Órdenes en proceso</div>
          ${procesosTablaHtml}
        </div>
        <!-- Próximas entregas -->
        <div class="card" style="padding:12px 14px">
          <div style="font-size:12px;font-weight:700;color:var(--texto);margin-bottom:8px">Próximas entregas</div>
          ${proximasHtml}
        </div>
      </div>

      <!-- Carga por área + Servicios — una tarjeta, layout flex interno -->
      <div class="card" style="padding:12px 14px;margin-bottom:10px">
        <div class="dash-gen-info" style="display:flex;gap:0;align-items:start">
          <div style="flex:0 0 42%;min-width:0;padding-right:16px">
            <div style="font-size:12px;font-weight:700;color:var(--texto);margin-bottom:2px">Carga por área</div>
            <div style="font-size:10px;color:var(--gris-mid);margin-bottom:10px">Ocupación actual</div>
            <div style="height:10px;border-radius:5px;overflow:hidden;display:flex;gap:1px;margin-bottom:10px">
              ${Object.entries(srvActivos).length > 0
                ? Object.entries(srvActivos).sort((a,b)=>b[1]-a[1]).map(([srv,n]) => {
                    const pct = Math.round((n/totalActivos)*100);
                    return `<div style="flex:${pct} 0 0%;background:${srvColor[srv]||'#6B7280'}" title="${srvNombre[srv]||srv}: ${n}"></div>`;
                  }).join('')
                : `<div style="flex:1 0 0%;background:var(--gris-borde)"></div>`
              }
            </div>
            ${donutLeyenda}
          </div>
          <div class="dash-gen-divider" style="width:1px;background:var(--gris-borde);align-self:stretch;margin-right:16px;flex-shrink:0"></div>
          <div style="flex:1;min-width:0">
            <div style="font-size:12px;font-weight:700;color:var(--texto);margin-bottom:2px">Servicios más demandados</div>
            <div style="font-size:10px;color:var(--gris-mid);margin-bottom:10px">Histórico de etapas</div>
            ${demandadosHtml}
          </div>
        </div>
      </div>

      <!-- Fila 4: Tiempo promedio | Stats compactos -->
      <div class="dash-gen-row4" style="display:grid;grid-template-columns:2fr 1fr;gap:10px;align-items:start">
        <div class="card" style="padding:12px 14px">
          <div style="font-size:12px;font-weight:700;color:var(--texto);margin-bottom:2px">Tiempo promedio por servicio</div>
          <div style="font-size:10px;color:var(--gris-mid);margin-bottom:10px">Histórico general</div>
          ${tiempoHtml}
        </div>
        <!-- Operación hoy -->
        <div class="card" style="padding:12px 14px">
          <div style="font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:1.2px;color:var(--gris-mid);margin-bottom:12px">Operación hoy</div>

          <div style="margin-bottom:12px">
            <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:3px">
              <span style="font-size:11px;color:var(--gris-mid)">Eficiencia</span>
              <span style="font-size:18px;font-weight:800;color:${efColor}">${eficiencia!==null?eficiencia+'%':'—'}</span>
            </div>
            ${eficiencia!==null?`<div style="height:2px;background:var(--gris-borde);border-radius:99px;overflow:hidden;margin-bottom:2px"><div style="height:100%;width:${eficiencia}%;background:${efColor}"></div></div>`:''}
            <div style="font-size:9px;color:var(--gris-mid)">Entregas a tiempo · 60 días</div>
          </div>

          <div style="margin-bottom:12px">
            <div style="font-size:9px;color:var(--gris-mid);margin-bottom:5px">Técnicos</div>
            ${tecActivos.size > 0
              ? [...tecActivos].slice(0,4).map(t => {
                  const eAct   = etapasActArr.find(e => e.tecnico === t);
                  const srv    = eAct?.servicio;
                  const srvLbl = srv ? (srvNombre[srv]||srv) : null;
                  const sC2    = srv ? (srvColor[srv]||'#6B7280') : 'var(--gris-mid)';
                  return `<div style="display:flex;align-items:center;justify-content:space-between;padding:3px 0">
                    <span style="font-size:11px;font-weight:600;color:var(--texto)">${t.split(' ')[0]}</span>
                    ${srvLbl?`<span style="font-size:10px;font-weight:600;color:${sC2}">${srvLbl}</span>`:`<span style="font-size:10px;color:var(--gris-mid)">—</span>`}
                  </div>`;
                }).join('')
              : '<div style="font-size:11px;color:var(--gris-mid)">Sin activos</div>'
            }
          </div>

          <div style="margin-bottom:${retrasos.length>0?'12px':'0'}">
            <div style="display:flex;justify-content:space-between;align-items:center">
              <span style="font-size:11px;color:var(--gris-mid)">Repuestos</span>
              <span style="font-size:12px;font-weight:700;color:${solicitudesPend.length>0?'#DC2626':'#059669'}">${solicitudesPend.length>0?solicitudesPend.length+' pend.':'Al día'}</span>
            </div>
          </div>

          ${retrasos.length > 0 ? `
            <div style="background:#FEF2F2;border-left:3px solid #DC2626;border-radius:0 4px 4px 0;padding:6px 8px;font-size:11px;color:#DC2626;font-weight:700">
              ${retrasos.length} ${retrasos.length===1?'vehículo':'vehículos'} con retraso
            </div>
          ` : ''}
        </div>
      </div>
    `;

  } catch(e) {
    const c = document.getElementById('dash-contenido');
    if (c) c.innerHTML = `<div class="empty-state">Error: ${e.message}</div>`;
  }
}
// ═══════════════════════════════════════════════════════════
// GRÁFICO DINÁMICO POR PERÍODO
// ═══════════════════════════════════════════════════════════
async function cargarGraficoPeriodo() {
  const sel = document.getElementById('dash-periodo-sel');
  const periodo = sel?.value || 'semana';
  const cont = document.getElementById('dash-grafico-bars');
  if (!cont) return;
  cont.innerHTML = '<div style="font-size:12px;color:var(--gris-mid)">Cargando...</div>';

  try {
    const ordenes = await api(
      `/ordenes?select=id,creado_en,entregada_en,estado&order=creado_en.asc`
    ).catch(()=>[]) || [];

    const ahora = new Date();
    let buckets = {};

    if (periodo === 'semana') {
      for (let i = 11; i >= 0; i--) {
        const d = new Date(ahora);
        d.setDate(d.getDate() - i * 7);
        const key = `${d.getFullYear()}-S${String(semanaNum(d)).padStart(2,'0')}`;
        buckets[key] = { label: `S${semanaNum(d)}`, iniciadas: 0, finalizadas: 0 };
      }
      ordenes.forEach(o => {
        if (!o.creado_en) return;
        const key = `${new Date(o.creado_en).getFullYear()}-S${String(semanaNum(o.creado_en)).padStart(2,'0')}`;
        if (buckets[key]) buckets[key].iniciadas++;
      });
      ordenes.filter(o=>o.estado==='Entregada'&&o.entregada_en).forEach(o => {
        const key = `${new Date(o.entregada_en).getFullYear()}-S${String(semanaNum(o.entregada_en)).padStart(2,'0')}`;
        if (buckets[key]) buckets[key].finalizadas++;
      });

    } else if (periodo === 'mes') {
      for (let i = 11; i >= 0; i--) {
        const d = new Date(ahora.getFullYear(), ahora.getMonth() - i, 1);
        const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
        const label = d.toLocaleDateString('es-CO',{month:'short'});
        buckets[key] = { label, iniciadas: 0, finalizadas: 0 };
      }
      ordenes.forEach(o => {
        if (!o.creado_en) return;
        const d = new Date(o.creado_en);
        const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
        if (buckets[key]) buckets[key].iniciadas++;
      });
      ordenes.filter(o=>o.estado==='Entregada'&&o.entregada_en).forEach(o => {
        const d = new Date(o.entregada_en);
        const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
        if (buckets[key]) buckets[key].finalizadas++;
      });

    } else { // año
      const minYear = ordenes.length ? new Date(ordenes[0].creado_en).getFullYear() : ahora.getFullYear();
      for (let y = minYear; y <= ahora.getFullYear(); y++) {
        buckets[y] = { label: String(y), iniciadas: 0, finalizadas: 0 };
      }
      ordenes.forEach(o => {
        if (!o.creado_en) return;
        const y = new Date(o.creado_en).getFullYear();
        if (buckets[y]) buckets[y].iniciadas++;
      });
      ordenes.filter(o=>o.estado==='Entregada'&&o.entregada_en).forEach(o => {
        const y = new Date(o.entregada_en).getFullYear();
        if (buckets[y]) buckets[y].finalizadas++;
      });
    }

    const arr = Object.values(buckets);
    const maxV = Math.max(...arr.map(b=>Math.max(b.iniciadas,b.finalizadas)), 1);

    cont.innerHTML = arr.map(b => {
      const hI = Math.round((b.iniciadas/maxV)*72);
      const hF = Math.round((b.finalizadas/maxV)*72);
      return `<div class="dash-bar-col" style="min-width:18px;flex:0 0 auto">
        <div class="dash-bar-group">
          <div class="dash-bar" style="height:${hI}px;background:var(--azul-mid)" title="Iniciadas: ${b.iniciadas}"></div>
          <div class="dash-bar" style="height:${hF}px;background:var(--verde)" title="Finalizadas: ${b.finalizadas}"></div>
        </div>
        <div class="dash-bar-label">${b.label}</div>
      </div>`;
    }).join('');
  } catch(e) {
    const cont2 = document.getElementById('dash-grafico-bars');
    if (cont2) cont2.innerHTML = `<div style="font-size:12px;color:var(--rojo)">Error: ${e.message}</div>`;
  }
}

// ═══════════════════════════════════════════════════════════
// GRÁFICO FINANCIERO — FACTURACIÓN POR PERÍODO
// ═══════════════════════════════════════════════════════════
async function cargarGraficoFinanciero(periodo = 'mensual') {
  ['semanal','mensual','anual'].forEach(p => {
    const btn = document.getElementById(`fin-btn-${p}`);
    if (!btn) return;
    const activo = p === periodo;
    btn.style.background = activo ? '#1E3A5F' : 'white';
    btn.style.color      = activo ? 'white'   : 'var(--gris-mid)';
    btn.style.border     = '1px solid ' + (activo ? '#1E3A5F' : 'var(--gris-borde)');
  });

  const cont = document.getElementById('dash-fin-grafico');
  if (!cont) return;
  cont.innerHTML = '<div style="text-align:center;padding:28px 0;font-size:12px;color:var(--gris-mid)">Cargando...</div>';

  try {
    const ahora = new Date();
    const since = periodo === 'diario'  ? (() => { const d=new Date(); d.setDate(d.getDate()-30); return d.toISOString().slice(0,10); })()
               : periodo === 'semanal' ? (() => { const d=new Date(); d.setDate(d.getDate()-85); return d.toISOString().slice(0,10); })()
               : periodo === 'mensual' ? (() => { const d=new Date(ahora.getFullYear(), ahora.getMonth()-12, 1); return d.toISOString().slice(0,10); })()
               : null;

    const etapas = await api(
      `/etapas?fin=not.is.null&valor=gt.0&select=fin,valor&order=fin.asc${since?`&fin=gte.${since}`:''}&limit=3000`
    ).catch(()=>[]) || [];

    const buckets = {};

    if (periodo === 'diario') {
      for (let i=29; i>=0; i--) {
        const d = new Date(ahora); d.setDate(d.getDate()-i);
        const key = d.toISOString().slice(0,10);
        buckets[key] = { label:`${d.getDate()}/${d.getMonth()+1}`, valor:0 };
      }
      etapas.forEach(e => {
        const key = new Date(e.fin).toISOString().slice(0,10);
        if (buckets[key]) buckets[key].valor += (e.valor||0);
      });

    } else if (periodo === 'semanal') {
      for (let i=11; i>=0; i--) {
        const d = new Date(ahora); d.setDate(d.getDate()-i*7);
        const sw = semanaNum(d);
        const key = `${d.getFullYear()}-S${String(sw).padStart(2,'0')}`;
        buckets[key] = { label:`S${sw}`, valor:0 };
      }
      etapas.forEach(e => {
        const d = new Date(e.fin);
        const sw = semanaNum(d);
        const key = `${d.getFullYear()}-S${String(sw).padStart(2,'0')}`;
        if (buckets[key]) buckets[key].valor += (e.valor||0);
      });

    } else if (periodo === 'mensual') {
      for (let i=11; i>=0; i--) {
        const d = new Date(ahora.getFullYear(), ahora.getMonth()-i, 1);
        const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
        buckets[key] = { label:d.toLocaleDateString('es-CO',{month:'short'}), valor:0 };
      }
      etapas.forEach(e => {
        const d = new Date(e.fin);
        const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
        if (buckets[key]) buckets[key].valor += (e.valor||0);
      });

    } else {
      const years = [...new Set(etapas.map(e => new Date(e.fin).getFullYear()))];
      const minY  = years.length ? Math.min(...years) : ahora.getFullYear()-2;
      for (let y=minY; y<=ahora.getFullYear(); y++) buckets[y] = { label:String(y), valor:0 };
      etapas.forEach(e => {
        const y = new Date(e.fin).getFullYear();
        if (buckets[y]) buckets[y].valor += (e.valor||0);
      });
    }

    const arr    = Object.values(buckets);
    const total  = arr.reduce((s,b)=>s+b.valor, 0);
    const maxVal = Math.max(...arr.map(b=>b.valor), 1);
    const fmtS   = v => v>=1000000?`$${(v/1000000).toFixed(1)}M`:v>=1000?`$${Math.round(v/1000)}K`:`$${Math.round(v)}`;
    const fmtF   = v => new Intl.NumberFormat('es-CO',{style:'currency',currency:'COP',minimumFractionDigits:0}).format(v);

    if (total === 0) { cont.innerHTML='<div style="text-align:center;padding:28px 0;font-size:12px;color:var(--gris-mid)">Sin datos para este período.</div>'; return; }

    const W=800, H=160, PL=62, PR=14, PT=10, PB=28;
    const cW=W-PL-PR, cH=H-PT-PB, n=arr.length;
    const yT = [0,.33,.67,1].map(f=>({ y:(PT+cH*(1-f)).toFixed(1), l:f===0?'0':fmtS(maxVal*f) }));
    const pts = arr.map((b,i)=>({
      x:(n>1?PL+(i/(n-1))*cW:PL+cW/2).toFixed(1),
      y:(PT+cH*(1-(b.valor/maxVal))).toFixed(1),
      lbl:b.label
    }));
    const linePath = n>1 ? pts.map((p,i)=>`${i===0?'M':'L'}${p.x},${p.y}`).join(' ') : '';
    const areaPath = n>1 ? `${linePath} L${pts[n-1].x},${PT+cH} L${pts[0].x},${PT+cH} Z` : '';
    const xStep = Math.max(1, Math.ceil(n/7));

    cont.innerHTML = `
      <svg viewBox="0 0 ${W} ${H}" style="width:100%;height:160px;display:block" xmlns="http://www.w3.org/2000/svg">
        <defs><linearGradient id="finGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#2563EB" stop-opacity=".15"/>
          <stop offset="100%" stop-color="#2563EB" stop-opacity="0"/>
        </linearGradient></defs>
        ${yT.filter((_,i)=>i>0).map(t=>`<line x1="${PL}" y1="${t.y}" x2="${W-PR}" y2="${t.y}" stroke="#E8EBF0" stroke-width="1"/>`).join('')}
        ${yT.map(t=>`<text x="${PL-6}" y="${(+t.y+4).toFixed(1)}" text-anchor="end" font-size="11" font-weight="500" fill="#94A3B8" font-family="'DM Sans',sans-serif">${t.l}</text>`).join('')}
        ${areaPath?`<path d="${areaPath}" fill="url(#finGrad)"/>`:''}
        ${linePath?`<path d="${linePath}" fill="none" stroke="#2563EB" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>`:''}
        ${pts.map(p=>`<circle cx="${p.x}" cy="${p.y}" r="3" fill="white" stroke="#2563EB" stroke-width="2"/>`).join('')}
        ${pts.filter((_,i)=>i%xStep===0||i===n-1).map(p=>`<text x="${p.x}" y="${H-4}" text-anchor="middle" font-size="11" font-weight="500" fill="#94A3B8" font-family="'DM Sans',sans-serif">${p.lbl}</text>`).join('')}
        <line x1="${PL}" y1="${PT+cH}" x2="${W-PR}" y2="${PT+cH}" stroke="#E8EBF0" stroke-width="1"/>
      </svg>
      <div style="display:flex;gap:20px;margin-top:8px;padding-top:8px;border-top:1px solid var(--gris-borde)">
        <div>
          <div style="font-size:10px;font-weight:600;color:var(--gris-mid);margin-bottom:2px">Total período</div>
          <div style="font-size:13px;font-weight:800;color:var(--texto);font-family:'DM Sans',sans-serif">${fmtF(total)}</div>
        </div>
        <div>
          <div style="font-size:10px;font-weight:600;color:var(--gris-mid);margin-bottom:2px">Promedio</div>
          <div style="font-size:13px;font-weight:800;color:var(--texto);font-family:'DM Sans',sans-serif">${fmtF(Math.round(total/n))}</div>
        </div>
      </div>`;

  } catch(e2) {
    const c2 = document.getElementById('dash-fin-grafico');
    if (c2) c2.innerHTML = `<div style="font-size:12px;color:var(--rojo);padding:12px 0">Error: ${e2.message}</div>`;
  }
}

// ═══════════════════════════════════════════════════════════
// DASHBOARD FINANCIERO
// ═══════════════════════════════════════════════════════════
async function cargarDashboardFinanciero() {
  const cont = document.getElementById('dash-financiero-contenido');
  if (!cont) return;
  mostrarCargandoSiVacio(cont, '<div class="loading-state">Cargando datos financieros...</div>');

  try {
    const [ordenes, etapas, cotsRep, solsRep] = await Promise.all([
      api(`/ordenes?select=id,placa,marca,linea,propietario,estado,pulmon,creado_en,entregada_en`).catch(()=>[]) || [],
      api(`/etapas?select=id,orden_id,servicio,etapa,mecanico_id,tecnico,valor,inicio,fin,horas_estimadas`).catch(()=>[]) || [],
      // Sistema real de repuestos: precio de venta que fijó el jefe por solicitud.
      api(`/cotizaciones_repuesto?select=solicitud_id,precio_venta_jefe`).catch(()=>[]) || [],
      api(`/solicitudes_repuesto?select=id,orden_id,estado`).catch(()=>[]) || []
    ]);

    const fmt       = n => n!=null ? new Intl.NumberFormat('es-CO',{style:'currency',currency:'COP',minimumFractionDigits:0}).format(n) : '—';
    const srvColor  = { latoneria:'#DC2626', pintura:'#D97706', mecanica:'#2563EB', adicionales:'#059669' };
    const srvNombre = { latoneria:'Latonería', pintura:'Pintura', mecanica:'Mecánica', adicionales:'Adicionales' };
    const srvBg     = { latoneria:'#FEE2E2', pintura:'#FEF3C7', mecanica:'#EBF2FF', adicionales:'#E6F5EF' };

    // ── Valores mano de obra por orden ───────────────────
    const valorMOPorOrden = {};
    etapas.forEach(e => {
      if (e.valor) valorMOPorOrden[e.orden_id] = (valorMOPorOrden[e.orden_id]||0) + e.valor;
    });

    // ── Valores repuestos por orden (sistema real) ───────
    // Precio de venta elegido por el jefe (precio_venta_jefe) por solicitud,
    // contando solo repuestos ya pedidos/recibidos/entregados.
    const ventaPorSolicitud = {};
    cotsRep.forEach(c => {
      if (c.precio_venta_jefe != null) ventaPorSolicitud[c.solicitud_id] = (ventaPorSolicitud[c.solicitud_id]||0) + Number(c.precio_venta_jefe);
    });
    const valorRepPorOrden = {};
    solsRep.filter(s => ['pedido','recibido_taller','entregado'].includes(s.estado)).forEach(s => {
      valorRepPorOrden[s.orden_id] = (valorRepPorOrden[s.orden_id]||0) + (ventaPorSolicitud[s.id]||0);
    });

    // ── WIP — órdenes activas ────────────────────────────
    const ordenesActivas   = ordenes.filter(o=>o.estado==='Activa'&&!o.pulmon);
    const wipMO            = ordenesActivas.reduce((s,o)=>(valorMOPorOrden[o.id]||0)+s, 0);
    const wipRep           = ordenesActivas.reduce((s,o)=>(valorRepPorOrden[o.id]||0)+s, 0);
    const wipTotal         = wipMO + wipRep;

    // ── Entregadas ───────────────────────────────────────
    const ordenesEntregadas = ordenes.filter(o=>o.estado==='Entregada');
    const totalFacturado    = ordenesEntregadas.reduce((s,o)=>(valorMOPorOrden[o.id]||0)+(valorRepPorOrden[o.id]||0)+s, 0);
    const ticketProm        = ordenesEntregadas.length ? Math.round(totalFacturado/ordenesEntregadas.length) : 0;

    // ── Tiempo real vs estimado por servicio ─────────────
    const tiempoSrv = {};
    etapas.filter(e=>e.inicio&&e.fin&&e.servicio).forEach(e => {
      if (!tiempoSrv[e.servicio]) tiempoSrv[e.servicio] = { realMins:[], estHoras:[] };
      const mins = Math.round((new Date(e.fin)-new Date(e.inicio))/60000);
      tiempoSrv[e.servicio].realMins.push(mins);
      if (e.horas_estimadas) tiempoSrv[e.servicio].estHoras.push(e.horas_estimadas*60);
    });

    // ── Órdenes demoradas ────────────────────────────────
    const promedioSrv = {};
    Object.entries(tiempoSrv).forEach(([srv, data]) => {
      promedioSrv[srv] = Math.round(data.realMins.reduce((a,b)=>a+b,0)/data.realMins.length);
    });
    const demoradas = [];
    ordenes.filter(o=>o.estado==='Activa'&&!o.pulmon).forEach(o => {
      etapas.filter(e=>e.orden_id===o.id&&e.inicio&&!e.fin).forEach(e => {
        const minsTrans = Math.round((new Date()-new Date(e.inicio))/60000);
        const prom = promedioSrv[e.servicio];
        if (prom && minsTrans > prom*1.3) {
          demoradas.push({ o, e, minsTrans, prom, pctDem: Math.round(((minsTrans-prom)/prom)*100) });
        }
      });
    });
    demoradas.sort((a,b)=>b.pctDem-a.pctDem);

    // ── Productividad técnicos ───────────────────────────
    const porTecnico = {};
    etapas.filter(e=>e.tecnico&&e.fin).forEach(e => {
      if (!porTecnico[e.tecnico]) porTecnico[e.tecnico] = { etapas:0, mins:0, valor:0 };
      porTecnico[e.tecnico].etapas++;
      if (e.inicio&&e.fin) porTecnico[e.tecnico].mins += Math.round((new Date(e.fin)-new Date(e.inicio))/60000);
      if (e.valor) porTecnico[e.tecnico].valor += e.valor;
    });

    // ════════════════════════════════════════════════════
    // HTML BLOCKS
    // ════════════════════════════════════════════════════

    // — Tiempo real vs estimado —
    const tiempoSrvHtml = Object.entries(tiempoSrv).length
      ? Object.entries(tiempoSrv).map(([srv, data]) => {
          const promReal = Math.round(data.realMins.reduce((a,b)=>a+b,0)/data.realMins.length);
          const promEst  = data.estHoras.length ? Math.round(data.estHoras.reduce((a,b)=>a+b,0)/data.estHoras.length) : null;
          const hR = Math.floor(promReal/60), mR = promReal%60;
          const color = srvColor[srv]||'#6B7280';
          const bg    = srvBg[srv]||'#F3F4F6';
          const diff  = promEst ? Math.round(((promReal-promEst)/promEst)*100) : null;
          const maxR  = Math.max(...Object.entries(tiempoSrv).map(([,d])=>Math.round(d.realMins.reduce((a,b)=>a+b,0)/d.realMins.length)),1);
          const barW  = Math.round((promReal/maxR)*100);
          return `<div style="margin-bottom:10px">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
              <div style="display:flex;align-items:center;gap:6px">
                <div style="width:8px;height:8px;border-radius:2px;background:${color}"></div>
                <span style="font-size:12px;font-weight:600;color:${color}">${srvNombre[srv]||srv}</span>
                <span style="font-size:10px;color:var(--gris-mid)">${data.realMins.length} etapas</span>
              </div>
              <div style="display:flex;align-items:center;gap:6px">
                <span style="font-family:'DM Mono',monospace;font-size:12px;font-weight:700;color:${color}">${hR>0?hR+'h ':''} ${mR}m</span>
                ${diff!=null ? `<span style="font-size:10px;font-weight:700;color:${diff>20?'#DC2626':diff>0?'#D97706':'#059669'};background:${diff>20?'#FEE2E2':diff>0?'#FEF3C7':'#E6F5EF'};padding:1px 6px;border-radius:99px">${diff>0?'+':''}${diff}%</span>` : ''}
              </div>
            </div>
            <div style="height:4px;background:var(--gris-borde);border-radius:99px;overflow:hidden">
              <div style="height:100%;width:${barW}%;background:${color};border-radius:99px"></div>
            </div>
          </div>`;
        }).join('')
      : '<div style="font-size:11px;color:var(--gris-mid);padding:8px 0">Sin datos aún.</div>';

    // — Órdenes demoradas —
    const demoradasHtml = demoradas.length
      ? demoradas.slice(0,8).map(({o,e,minsTrans,prom,pctDem}) => {
          const hT=Math.floor(minsTrans/60), mT=minsTrans%60;
          const hP=Math.floor(prom/60),      mP=prom%60;
          const color = pctDem>60?'#DC2626':pctDem>30?'#D97706':'#F59E0B';
          const bg    = pctDem>60?'#FEE2E2':pctDem>30?'#FEF3C7':'#FEF9C3';
          const srv   = e.servicio;
          const sC    = srvColor[srv]||'#6B7280';
          const sB    = srvBg[srv]||'#F3F4F6';
          return `<div style="display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid var(--gris-borde);cursor:pointer" onclick="abrirOrden(${o.id})">
            <div style="flex:1;min-width:0">
              <div style="font-family:'DM Mono',monospace;font-weight:700;font-size:12px;letter-spacing:.5px">${escapeHtml(o.placa)}</div>
              <div style="display:flex;align-items:center;gap:4px;margin-top:2px">
                <span style="font-size:10px;font-weight:600;color:${sC};background:${sB};padding:1px 6px;border-radius:4px">${srvNombre[srv]||srv}</span>
                <span style="font-size:10px;color:var(--gris-mid)">${escapeHtml(e.etapa||'')}</span>
              </div>
            </div>
            <div style="text-align:right;flex-shrink:0">
              <div style="font-size:10px;color:var(--gris-mid)">Actual: <strong>${hT>0?hT+'h ':''} ${mT}m</strong></div>
              <div style="font-size:10px;color:var(--gris-mid)">Prom: ${hP>0?hP+'h ':''} ${mP}m</div>
              <span style="font-size:10px;font-weight:700;color:${color};background:${bg};padding:1px 6px;border-radius:99px">+${pctDem}%</span>
            </div>
          </div>`;
        }).join('')
      : '<div style="font-size:11px;color:#059669;padding:8px 0;display:flex;align-items:center;gap:6px"><svg width="12" height="12" fill="none" stroke="#059669" stroke-width="2.5" viewBox="0 0 24 24"><path d="M20 6L9 17l-5-5"/></svg>Sin órdenes demoradas.</div>';

    // — Técnicos —
    const tecnicoHtml = Object.entries(porTecnico).length
      ? Object.entries(porTecnico).sort((a,b)=>b[1].valor-a[1].valor).map(([tec, data]) => {
          const h=Math.floor(data.mins/60), m=data.mins%60;
          const maxVal = Math.max(...Object.values(porTecnico).map(d=>d.valor),1);
          const barW   = Math.round((data.valor/maxVal)*100);
          return `<div style="display:flex;align-items:center;gap:10px;padding:7px 0;border-bottom:1px solid var(--gris-borde)">
            <div style="width:28px;height:28px;border-radius:50%;background:#EBF2FF;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:12px;color:#2563EB;flex-shrink:0">${tec.charAt(0).toUpperCase()}</div>
            <div style="flex:1;min-width:0">
              <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:3px">
                <span style="font-size:12px;font-weight:600;color:var(--texto)">${escapeHtml(tec)}</span>
                <span style="font-size:12px;font-weight:700;color:#059669;font-family:'DM Mono',monospace">${fmt(data.valor)}</span>
              </div>
              <div style="display:flex;align-items:center;gap:8px">
                <div style="flex:1;height:3px;background:var(--gris-borde);border-radius:99px;overflow:hidden">
                  <div style="height:100%;width:${barW}%;background:#059669;border-radius:99px"></div>
                </div>
                <span style="font-size:10px;color:var(--gris-mid);white-space:nowrap">${data.etapas} etapas · ${h>0?h+'h ':''} ${m}m</span>
              </div>
            </div>
          </div>`;
        }).join('')
      : '<div style="font-size:11px;color:var(--gris-mid)">Sin datos aún.</div>';

    // ════════════════════════════════════════════════════
    // RENDER
    // ════════════════════════════════════════════════════
    renderSinParpadeo(cont, `
      <!-- Header -->
      <div style="margin-bottom:10px;display:flex;align-items:baseline;gap:10px">
        <div style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:1.2px;color:var(--gris-mid)">Análisis Financiero</div>
      </div>

      <!-- KPI row -->
      <div class="dash-fin-kpi" style="display:grid;grid-template-columns:1.4fr 1fr 1fr 1fr;gap:8px;margin-bottom:10px">
        <div style="background:#1E3A5F;border-radius:12px;padding:14px 16px;color:white">
          <div style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:1.2px;opacity:.55;margin-bottom:6px">WIP — Trabajo en proceso</div>
          <div style="font-size:20px;font-weight:800;font-family:'DM Mono',monospace;line-height:1.1">${fmt(wipTotal)}</div>
          <div style="font-size:10px;opacity:.5;margin-top:4px">MO: ${fmt(wipMO)} · Rep: ${fmt(wipRep)}</div>
          <div style="font-size:10px;opacity:.4;margin-top:2px">${ordenesActivas.length} órdenes activas</div>
        </div>
        <div style="background:var(--surface);border:1px solid var(--gris-borde);border-radius:12px;padding:12px;display:flex;flex-direction:column;gap:5px">
          <div style="width:28px;height:28px;background:#E6F5EF;border-radius:7px;display:flex;align-items:center;justify-content:center;flex-shrink:0">
            <svg width="14" height="14" fill="none" stroke="#059669" stroke-width="2" viewBox="0 0 24 24"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
          </div>
          <div style="font-size:18px;font-weight:800;color:#059669;line-height:1;font-family:'DM Mono',monospace">${fmt(totalFacturado)}</div>
          <div style="font-size:11px;font-weight:600;color:var(--texto)">Total facturado</div>
          <div style="font-size:10px;color:var(--gris-mid)">${ordenesEntregadas.length} órdenes entregadas</div>
        </div>
        <div style="background:var(--surface);border:1px solid var(--gris-borde);border-radius:12px;padding:12px;display:flex;flex-direction:column;gap:5px">
          <div style="width:28px;height:28px;background:#FEF3C7;border-radius:7px;display:flex;align-items:center;justify-content:center;flex-shrink:0">
            <svg width="14" height="14" fill="none" stroke="#D97706" stroke-width="2" viewBox="0 0 24 24"><path d="M20 12V22H4V12"/><path d="M22 7H2v5h20V7z"/><path d="M12 22V7"/></svg>
          </div>
          <div style="font-size:18px;font-weight:800;color:#D97706;line-height:1;font-family:'DM Mono',monospace">${fmt(ticketProm)}</div>
          <div style="font-size:11px;font-weight:600;color:var(--texto)">Ticket promedio</div>
          <div style="font-size:10px;color:var(--gris-mid)">Por orden entregada</div>
        </div>
        <div style="background:var(--surface);border:1px solid var(--gris-borde);border-radius:12px;padding:12px;display:flex;flex-direction:column;gap:5px">
          <div style="width:28px;height:28px;background:#FEE2E2;border-radius:7px;display:flex;align-items:center;justify-content:center;flex-shrink:0">
            <svg width="14" height="14" fill="none" stroke="#DC2626" stroke-width="2" viewBox="0 0 24 24"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
          </div>
          <div style="font-size:26px;font-weight:800;color:#DC2626;line-height:1">${demoradas.length}</div>
          <div style="font-size:11px;font-weight:600;color:var(--texto)">Demoradas</div>
          <div style="font-size:10px;color:var(--gris-mid)">>30% sobre promedio</div>
        </div>
      </div>

      <!-- Gráfico de ingresos con selector de período -->
      <div class="card" style="padding:12px 14px;margin-bottom:10px">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;flex-wrap:wrap;gap:6px">
          <div>
            <div style="font-size:12px;font-weight:700;color:var(--texto)">Ingresos en el tiempo</div>
            <div style="font-size:10px;color:var(--gris-mid)">Basado en etapas completadas</div>
          </div>
          <div style="display:flex;gap:4px;flex-wrap:wrap">
            ${['semanal','mensual','anual'].map(p => `
              <button id="fin-btn-${p}" onclick="cargarGraficoFinanciero('${p}')"
                style="padding:4px 10px;border-radius:20px;border:1px solid var(--gris-borde);background:var(--surface);font-size:10px;font-weight:600;color:var(--gris-mid);cursor:pointer;transition:all .15s"
                onmouseenter="if(!this.dataset.active)this.style.background='var(--gris-bg)'"
                onmouseleave="if(!this.dataset.active)this.style.background='white'">
                ${{semanal:'Semanal',mensual:'Mensual',anual:'Anual'}[p]}
              </button>`).join('')}
          </div>
        </div>
        <div id="dash-fin-grafico" style="width:100%"></div>
      </div>

      ${demoradas.length > 0 ? `
      <!-- Tiempo vs estimado | Demoradas (layout 2 col cuando hay demoradas) -->
      <div class="dash-fin-row2" style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px;align-items:start">
        <div class="card" style="padding:12px 14px">
          <div style="font-size:12px;font-weight:700;color:var(--texto);margin-bottom:2px">Tiempo real vs estimado</div>
          <div style="font-size:10px;color:var(--gris-mid);margin-bottom:10px">Promedio por tipo de servicio</div>
          ${tiempoSrvHtml}
        </div>
        <div class="card" style="padding:12px 14px">
          <div style="font-size:12px;font-weight:700;color:var(--texto);margin-bottom:2px">Órdenes demoradas</div>
          <div style="font-size:10px;color:var(--gris-mid);margin-bottom:10px">Activas que superan el promedio histórico</div>
          ${demoradasHtml}
        </div>
      </div>
      ` : `
      <!-- Tiempo vs estimado (ancho completo cuando no hay demoradas) -->
      <div class="card" style="padding:12px 14px;margin-bottom:10px">
        <div style="font-size:12px;font-weight:700;color:var(--texto);margin-bottom:2px">Tiempo real vs estimado</div>
        <div style="font-size:10px;color:var(--gris-mid);margin-bottom:10px">Promedio por tipo de servicio</div>
        ${tiempoSrvHtml}
      </div>
      `}

      <!-- Productividad técnicos -->
      <div class="card" style="padding:12px 14px">
        <div style="font-size:12px;font-weight:700;color:var(--texto);margin-bottom:2px">Productividad por técnico</div>
        <div style="font-size:10px;color:var(--gris-mid);margin-bottom:10px">Etapas completadas e ingresos generados</div>
        ${tecnicoHtml}
      </div>
    `);
    cargarGraficoFinanciero('mensual');
  } catch(e) {
    cont.innerHTML = `<div class="empty-state">Error: ${e.message}</div>`;
  }
}

// ═══════════════════════════════════════════════════════════
// TABS DEL DASHBOARD
// ═══════════════════════════════════════════════════════════
function switchDashTab(tab) {
  const mesCont = document.getElementById('dash-mes-contenido');
  const opCont  = document.getElementById('dash-contenido');
  const finCont = document.getElementById('dash-financiero-contenido');
  const metCont = document.getElementById('dash-metas-contenido');
  const btnMes  = document.getElementById('dash-tab-mes');
  const btnOp   = document.getElementById('dash-tab-operativo');
  const btnFin  = document.getElementById('dash-tab-financiero');
  const btnMet  = document.getElementById('dash-tab-metas');

  [mesCont, opCont, finCont, metCont].forEach(c => { if (c) c.style.display = 'none'; });
  [btnMes, btnOp, btnFin, btnMet].forEach(b => { if (b) b.classList.remove('active'); });

  if (tab === 'mes') {
    if (mesCont) { mesCont.style.display = ''; }
    if (btnMes)  btnMes.classList.add('active');
    // Siempre re-consulta para reflejar cambios al instante (sin parpadeo: el
    // loader solo aparece la primera vez, cuando el contenedor está vacío).
    if (typeof cargarDashboardMes === 'function') cargarDashboardMes();
  } else if (tab === 'operativo') {
    if (opCont)  { opCont.style.display = ''; }
    if (btnOp)   btnOp.classList.add('active');
    cargarDashboard();
  } else if (tab === 'financiero') {
    if (finCont) { finCont.style.display = ''; }
    if (btnFin)  btnFin.classList.add('active');
    cargarDashboardFinanciero();
  } else if (tab === 'metas') {
    if (metCont) { metCont.style.display = ''; }
    if (btnMet)  btnMet.classList.add('active');
    if (typeof cargarDashboardMetas === 'function') cargarDashboardMetas();
  }
}

// ── Chips KPI clickables ─────────────────────────────────
function dashFiltrarOrdenes(tipo) {
  // Establecer filtroEstado ANTES de navegar: navJefe('ordenes') llama cargarOrdenes()
  // que lee filtroEstado directamente, evitando un segundo fetch y el crash de setFiltro(null).
  if (tipo === 'entregadas') {
    filtroEstado = 'Entregada';
  } else if (tipo === 'pulmon') {
    filtroEstado = null; // cargarOrdenes() retorna temprano cuando es null
  } else {
    filtroEstado = 'Activa';
  }

  navJefe('ordenes'); // llama cargarOrdenes() (o retorna si pulmon)

  // Pulmón: navJefe no carga el listado porque filtroEstado=null → cargar manualmente
  if (tipo === 'pulmon') cargarOrdenesPulmon();

  // Sincronizar estado visual del botón activo (filtros-bar es HTML estático, siempre en DOM)
  requestAnimationFrame(() => {
    const btns = document.querySelectorAll('#filtros-bar .filtro-btn');
    btns.forEach(b => b.classList.remove('active'));
    if (tipo === 'pulmon') {
      const btn = [...btns].find(b => b.textContent.toLowerCase().includes('pulm'));
      if (btn) btn.classList.add('active');
    } else if (tipo === 'entregadas') {
      const btn = [...btns].find(b => b.textContent.includes('Entregada'));
      if (btn) btn.classList.add('active');
    } else {
      if (btns[0]) btns[0].classList.add('active');
    }
  });
}
