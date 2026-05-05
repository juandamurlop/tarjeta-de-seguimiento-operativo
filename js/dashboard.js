// ═══════════════════════════════════════════════════════════
// DASHBOARD - ESTADO DEL TALLER
// ═══════════════════════════════════════════════════════════

function actualizarCapacidad(activas) {
  const cap   = document.getElementById('sidebar-capacidad');
  const fill  = document.getElementById('cap-fill');
  const pctEl = document.getElementById('cap-pct');
  const subEl = document.getElementById('cap-sub');
  if (!cap) return;
  cap.style.display = 'block';
  const pct   = Math.min(Math.round((activas / CAPACIDAD_TALLER) * 100), 100);
  const circ  = 2 * Math.PI * 30;
  const color = pct <= 65 ? '#EAB308' : pct <= 80 ? '#F97316' : '#EF4444';
  if (fill)  { fill.style.strokeDasharray = `${(pct/100)*circ} ${circ}`; fill.style.stroke = color; }
  if (pctEl) pctEl.textContent = pct + '%';
  if (subEl) subEl.textContent = `${activas} de ${CAPACIDAD_TALLER} cupos`;
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

// ── Dashboard principal ───────────────────────────────────
async function cargarDashboard() {
  const cont = document.getElementById('dash-contenido');
  if (!cont) return;
  cont.innerHTML = '<div class="loading-state">Cargando...</div>';

  try {
    const [ordenes, todasEtapas] = await Promise.all([
      api(`/ordenes?select=id,placa,marca,linea,modelo,propietario,estado,pulmon,creado_en,fecha_entrega_1,fecha_entrega_2`).catch(() => []) || [],
      api(`/etapas?select=id,orden_id,servicio,etapa,etapa_key,inicio,fin,mecanico_id,tecnico`).catch(() => []) || []
    ]);

    // ── Métricas base ─────────────────────────────────────
    const activas    = ordenes.filter(o => o.estado === 'Activa' && !o.pulmon).length;
    const pulmon     = ordenes.filter(o => o.pulmon).length;
    const entregadas = ordenes.filter(o => o.estado === 'Entregada').length;
    const total      = ordenes.length;

    actualizarCapacidad(activas + pulmon);

    const etapasActivas = todasEtapas.filter(e => e.inicio && !e.fin);

    const srvColor  = { latoneria:'#DC2626', pintura:'#D97706', mecanica:'#2563EB', adicionales:'#059669' };
    const srvNombre = { latoneria:'Latonería', pintura:'Pintura', mecanica:'Mecánica', adicionales:'Adicionales' };

    // ── 1. TIEMPO PROMEDIO POR SERVICIO ──────────────────
    const etapasConDur = todasEtapas.filter(e => e.inicio && e.fin);
    const tiemposPorSrv = {};
    etapasConDur.forEach(e => {
      const srv = e.servicio || 'sin_servicio';
      if (!tiemposPorSrv[srv]) tiemposPorSrv[srv] = [];
      const mins = Math.round((new Date(e.fin) - new Date(e.inicio)) / 60000);
      if (mins > 0) tiemposPorSrv[srv].push(mins);
    });

    const promedios = Object.fromEntries(
      Object.entries(tiemposPorSrv).map(([srv, arr]) => [srv, Math.round(arr.reduce((a,b)=>a+b,0)/arr.length)])
    );
    const maxProm = Math.max(...Object.values(promedios), 1);

    const tiemposHtml = Object.entries(promedios).length
      ? Object.entries(promedios).sort((a,b)=>b[1]-a[1]).map(([srv, prom]) => {
          const h = Math.floor(prom / 60), m = prom % 60;
          const label = h >= 24 ? `${Math.floor(h/24)}d ${h%24}h` : h > 0 ? `${h}h ${m}m` : `${m}m`;
          const color = srvColor[srv] || '#6B7280';
          const barW  = Math.round((prom / maxProm) * 100);
          const n     = tiemposPorSrv[srv].length;
          return `<div class="dash-tiempo-row">
            <div class="dash-tiempo-label" style="color:${color}">${srvNombre[srv] || srv}</div>
            <div class="dash-tiempo-bar-wrap">
              <div class="dash-tiempo-bar" style="width:${barW}%;background:${color}22;border-left:3px solid ${color}"></div>
            </div>
            <div class="dash-tiempo-val" style="color:${color}">${label}</div>
            <div class="dash-tiempo-n">${n} etapas</div>
          </div>`;
        }).join('')
      : '<div style="font-size:13px;color:var(--gris-mid);padding:8px 0">Sin datos históricos aún.</div>';

    // ── 2. PRÓXIMAS ENTREGAS ──────────────────────────────
    const hoy = new Date();
    hoy.setHours(0,0,0,0);
    const ordenesConFecha = ordenes
      .filter(o => (o.estado === 'Activa' || o.pulmon) && (o.fecha_entrega_1 || o.fecha_entrega_2))
      .map(o => {
        const f1 = o.fecha_entrega_1 ? new Date(o.fecha_entrega_1) : null;
        const f2 = o.fecha_entrega_2 ? new Date(o.fecha_entrega_2) : null;
        const fechaRef = f1 || f2;
        const dias = Math.round((fechaRef - hoy) / 86400000);
        return { ...o, fechaRef, dias };
      })
      .sort((a,b) => a.dias - b.dias)
      .slice(0, 8);

    const entregasHtml = ordenesConFecha.length
      ? ordenesConFecha.map(o => {
          const urgente = o.dias <= 0;
          const pronto  = o.dias > 0 && o.dias <= 3;
          const color   = urgente ? 'var(--rojo)' : pronto ? '#D97706' : 'var(--verde)';
          const bg      = urgente ? 'var(--rojo-bg)' : pronto ? '#FEF3C7' : 'var(--verde-bg)';
          const label   = urgente
            ? (o.dias === 0 ? 'Hoy' : `${Math.abs(o.dias)}d vencida`)
            : o.dias === 1 ? 'Mañana' : `${o.dias} días`;
          return `<div class="dash-entrega-row" onclick="abrirOrden(${o.id})">
            <div style="flex:1;min-width:0">
              <div style="font-family:'DM Mono',monospace;font-weight:600;font-size:13px;letter-spacing:1px">${o.placa}</div>
              <div style="font-size:11px;color:var(--gris-mid);margin-top:1px">${[o.marca,o.linea].filter(Boolean).join(' ')||'—'} · ${o.propietario||'—'}</div>
            </div>
            <div style="text-align:right;flex-shrink:0">
              <div style="font-size:12px;font-weight:700;color:${color};background:${bg};padding:3px 8px;border-radius:99px">${label}</div>
              <div style="font-size:10px;color:var(--gris-mid);margin-top:2px">${o.fechaRef.toLocaleDateString('es-CO')}</div>
            </div>
          </div>`;
        }).join('')
      : '<div style="font-size:13px;color:var(--gris-mid);padding:8px 0">No hay fechas de entrega registradas.</div>';

    // ── 3. ÓRDENES POR SEMANA (últimas 8) ────────────────
    const ahora = new Date();
    const semanas = {};
    for (let i = 7; i >= 0; i--) {
      const d = new Date(ahora);
      d.setDate(d.getDate() - i * 7);
      const key = `${d.getFullYear()}-S${String(semanaNum(d)).padStart(2,'0')}`;
      semanas[key] = { iniciadas: 0, finalizadas: 0, label: `S${semanaNum(d)}` };
    }
    ordenes.forEach(o => {
      if (!o.creado_en) return;
      const key = `${new Date(o.creado_en).getFullYear()}-S${String(semanaNum(o.creado_en)).padStart(2,'0')}`;
      if (semanas[key]) semanas[key].iniciadas++;
    });
    ordenes.filter(o => o.estado === 'Entregada').forEach(o => {
      if (!o.creado_en) return;
      const key = `${new Date(o.creado_en).getFullYear()}-S${String(semanaNum(o.creado_en)).padStart(2,'0')}`;
      if (semanas[key]) semanas[key].finalizadas++;
    });

    const semArr = Object.values(semanas);
    const maxSem = Math.max(...semArr.map(s => Math.max(s.iniciadas, s.finalizadas)), 1);

    const semanasHtml = semArr.map(s => {
      const hI = Math.round((s.iniciadas / maxSem) * 72);
      const hF = Math.round((s.finalizadas / maxSem) * 72);
      return `<div class="dash-bar-col">
        <div class="dash-bar-group">
          <div class="dash-bar" style="height:${hI}px;background:var(--azul-mid)" title="Iniciadas: ${s.iniciadas}"></div>
          <div class="dash-bar" style="height:${hF}px;background:var(--verde)" title="Finalizadas: ${s.finalizadas}"></div>
        </div>
        <div class="dash-bar-label">${s.label}</div>
      </div>`;
    }).join('');

    // ── 4. SERVICIOS MÁS POPULARES ───────────────────────
    const conteoSrv = {};
    todasEtapas.forEach(e => {
      const s = e.servicio || 'sin_servicio';
      conteoSrv[s] = (conteoSrv[s] || 0) + 1;
    });
    const maxSrv = Math.max(...Object.values(conteoSrv), 1);

    const popularesHtml = Object.entries(conteoSrv).length
      ? Object.entries(conteoSrv).sort((a,b) => b[1]-a[1]).map(([srv, count]) => {
          const color = srvColor[srv] || '#6B7280';
          const pct   = Math.round((count / maxSrv) * 100);
          return `<div style="margin-bottom:12px">
            <div style="display:flex;justify-content:space-between;margin-bottom:5px">
              <span style="font-size:12px;font-weight:600;color:${color}">${srvNombre[srv] || srv}</span>
              <span style="font-size:12px;color:var(--gris-mid)">${count} etapas</span>
            </div>
            <div style="height:6px;background:var(--gris-borde);border-radius:99px;overflow:hidden">
              <div style="height:100%;width:${pct}%;background:${color};border-radius:99px;transition:width 0.6s ease"></div>
            </div>
          </div>`;
        }).join('')
      : '<div style="font-size:13px;color:var(--gris-mid)">Sin datos aún.</div>';

    // ── 5. PROCESOS ACTIVOS ───────────────────────────────
    const porEtapa = {};
    etapasActivas.forEach(e => {
      const k = e.etapa || e.etapa_key || 'Sin nombre';
      if (!porEtapa[k]) porEtapa[k] = [];
      porEtapa[k].push(e);
    });

    const procesosHtml = Object.entries(porEtapa).length
      ? Object.entries(porEtapa).sort((a,b) => b[1].length - a[1].length).map(([etapaNombre, ets]) => {
          const srv   = ets[0]?.servicio || '';
          const color = srvColor[srv] || '#6B7280';
          const filasHtml = ets.slice(0,5).map(e => {
            const o = ordenes.find(ord => ord.id === e.orden_id);
            const dias = e.inicio ? diasEntre(e.inicio, new Date()) : 0;
            return `<div class="proceso-orden-row" onclick="abrirOrden(${e.orden_id})">
              <div>
                <div class="proceso-orden-placa">${o?.placa || '—'}</div>
                <div class="proceso-orden-vehiculo">${[o?.marca, o?.linea].filter(Boolean).join(' ')||'—'}</div>
              </div>
              <div style="text-align:right;margin-left:auto">
                ${e.tecnico ? `<div style="font-size:10px;color:var(--gris-mid)">👤 ${e.tecnico}</div>` : ''}
                <div style="font-size:10px;color:${dias >= 3 ? 'var(--rojo)' : 'var(--gris-mid)'};font-weight:${dias>=3?'700':'400'}">${dias}d</div>
              </div>
            </div>`;
          }).join('');
          const masHtml = ets.length > 5 ? `<div class="proceso-vacio" style="color:var(--azul-mid)">+${ets.length-5} más</div>` : '';
          return `<div class="proceso-col">
            <div class="proceso-col-header">
              <span class="proceso-col-nombre" style="color:${color}">${etapaNombre}</span>
              <span class="proceso-col-count" style="color:${color}">${ets.length}</span>
            </div>
            ${ets.length ? filasHtml + masHtml : '<div class="proceso-vacio">Sin carros</div>'}
          </div>`;
        }).join('')
      : '<div class="empty-state"><div class="empty-state-icon">🔧</div><p>No hay etapas activas ahora.</p></div>';

    // ── Render ────────────────────────────────────────────
    cont.innerHTML = `
      <div class="dash-grid">
        <div class="dash-card">
          <div class="dash-card-icon" style="background:#c5dbf0;color:#01459E">
            <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="20" height="18" rx="2"/><line x1="2" y1="9" x2="22" y2="9"/><line x1="7" y1="3" x2="7" y2="9"/><line x1="12" y1="3" x2="12" y2="9"/></svg>
          </div>
          <div class="dash-card-val" style="color:var(--azul)">${activas}</div>
          <div class="dash-card-label">Órdenes activas</div>
          <div class="dash-card-sub">${total > 0 ? Math.round((activas/total)*100) : 0}% del total</div>
        </div>
        <div class="dash-card">
          <div class="dash-card-icon" style="background:#f0d7bd;color:#D97706">
            <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="10" x2="14" y1="2" y2="2"/><line x1="12" x2="15" y1="14" y2="11"/><circle cx="12" cy="14" r="8"/></svg>
          </div>
          <div class="dash-card-val" style="color:#D97706">${pulmon}</div>
          <div class="dash-card-label">En pulmón</div>
          <div class="dash-card-sub">Esperando aprobación</div>
        </div>
        <div class="dash-card">
          <div class="dash-card-icon" style="background:#ccedc0;color:#16A34A">
            <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 7 17l-5-5"/><path d="m22 10-7.5 7.5L13 16"/></svg>
          </div>
          <div class="dash-card-val" style="color:#16A34A">${entregadas}</div>
          <div class="dash-card-label">Entregadas</div>
          <div class="dash-card-sub">Historial total</div>
        </div>
        <div class="dash-card">
          <div class="dash-card-icon" style="background:#d7beeb;color:#7C3AED">
            <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M7 12h10"/><path d="M10 18h4"/></svg>
          </div>
          <div class="dash-card-val" style="color:#7C3AED">${total}</div>
          <div class="dash-card-label">Total órdenes</div>
          <div class="dash-card-sub">Todas las registradas</div>
        </div>
      </div>

      <div class="dash-row-2">
        <div class="dash-panel">
          <div class="dash-panel-titulo">
            <svg width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
            Tiempo promedio por servicio
          </div>
          <div class="dash-tiempos">${tiemposHtml}</div>
        </div>
        <div class="dash-panel">
          <div class="dash-panel-titulo">
            <svg width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
            Próximas entregas
          </div>
          <div class="dash-entregas">${entregasHtml}</div>
        </div>
      </div>

      <div class="dash-row-2">
        <div class="dash-panel">
          <div class="dash-panel-titulo">
            <svg width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
            Órdenes — últimas 8 semanas
          </div>
          <div class="dash-legend">
            <span class="dash-legend-dot" style="background:var(--azul-mid)"></span><span>Iniciadas</span>
            <span class="dash-legend-dot" style="background:var(--verde);margin-left:12px"></span><span>Finalizadas</span>
          </div>
          <div class="dash-bars">${semanasHtml}</div>
        </div>
        <div class="dash-panel">
          <div class="dash-panel-titulo">
            <svg width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>
            Servicios más demandados
          </div>
          <div style="margin-top:12px">${popularesHtml}</div>
        </div>
      </div>

      <div class="dash-section-title">Procesos activos en el taller</div>
      <div class="dash-procesos-grid">${procesosHtml}</div>
    `;

  } catch(e) {
    const c = document.getElementById('dash-contenido');
    if (c) c.innerHTML = `<div class="empty-state">Error: ${e.message}</div>`;
  }
}