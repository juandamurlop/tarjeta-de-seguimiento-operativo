// ═══════════════════════════════════════════════════════════
// ASEGURADORAS — Dashboard y workflow
// ═══════════════════════════════════════════════════════════

const ESTADOS_ASEG = {
  peritaje_pendiente:    { label: 'Peritaje pendiente',   color: '#6B7280', bg: '#F3F4F6' },
  peritaje_enviado:      { label: 'Peritaje enviado',     color: '#7C3AED', bg: '#F5F3FF' },
  en_pulmon:             { label: 'En pulmón',            color: '#D97706', bg: '#FEF3C7' },
  repuestos_incompletos: { label: 'Pendiente repuestos',  color: '#DC2626', bg: '#FEE2E2' },
  repuestos_completos:   { label: 'Repuestos listos',     color: '#2563EB', bg: '#EBF2FF' },
  en_reparacion:         { label: 'En reparación',        color: '#059669', bg: '#E6F5EF' },
  terminado:             { label: 'Terminado',            color: '#16A34A', bg: '#DCFCE7' }
};

const ESTADOS_ASEG_ORDER = [
  'peritaje_pendiente','peritaje_enviado','en_pulmon',
  'repuestos_incompletos','repuestos_completos','en_reparacion','terminado'
];

let _asegOrdenesCache = [];

// ─── Dashboard principal ──────────────────────────────────

async function montarAseguradoras() {
  await cargarModuloAseguradoras();
}

// ─── Módulo completo de aseguradoras ─────────────────────

async function cargarModuloAseguradoras() {
  const cont = document.getElementById('pag-aseguradoras');
  if (!cont) return;
  cont.innerHTML = '<div class="loading-state">Cargando aseguradoras...</div>';

  try {
    // Fetch principal: órdenes con aseguradora (campo aseguradora o tipo_cliente=aseguradora)
    const [ordenesAseg, ordenesConAseg] = await Promise.all([
      api('/ordenes?aseguradora=not.is.null&order=creado_en.desc&select=*').catch(() => []),
      api('/ordenes?tipo_cliente=eq.aseguradora&order=creado_en.desc&limit=200&select=*').catch(() => [])
    ]);

    // Merge sin duplicados
    const idsVistas = new Set();
    const todasOrdenes = [...ordenesAseg, ...ordenesConAseg].filter(o => {
      if (idsVistas.has(o.id)) return false;
      idsVistas.add(o.id);
      return true;
    }).sort((a,b) => new Date(b.creado_en) - new Date(a.creado_en));

    _asegOrdenesCache = todasOrdenes;

    const fmt = n => n != null ? new Intl.NumberFormat('es-CO',{style:'currency',currency:'COP',minimumFractionDigits:0}).format(n) : '—';
    const today = new Date();
    const inicioMes = new Date(today.getFullYear(), today.getMonth(), 1);

    // KPIs
    const activas   = todasOrdenes.filter(o => o.estado === 'Activa');
    const enPulmon  = todasOrdenes.filter(o => o.pulmon);
    const pendRep   = todasOrdenes.filter(o => o.estado_aseguradora === 'repuestos_incompletos');
    const enRep     = todasOrdenes.filter(o => o.estado_aseguradora === 'en_reparacion');

    const entregadasMes = todasOrdenes.filter(o =>
      o.entregada_en && new Date(o.entregada_en) >= inicioMes
    );
    const promCiclo = entregadasMes.length
      ? Math.round(entregadasMes.reduce((s,o) => s + (new Date(o.entregada_en) - new Date(o.creado_en)) / 86400000, 0) / entregadasMes.length)
      : 0;

    const pendAprobacion = todasOrdenes.filter(o =>
      ['peritaje_enviado','en_pulmon'].includes(o.estado_aseguradora)
    );
    const promAprobDias = pendAprobacion.length
      ? Math.round(pendAprobacion.reduce((s,o) => {
          const desde = o.peritaje_enviado_en || o.creado_en;
          return s + (today - new Date(desde)) / 86400000;
        }, 0) / pendAprobacion.length)
      : 0;

    // Agrupar por aseguradora
    const porAseg = {};
    todasOrdenes.forEach(o => {
      const nombre = o.aseguradora || 'Sin aseguradora';
      if (!porAseg[nombre]) porAseg[nombre] = { nombre, ordenes: [], total: 0, dias: [] };
      porAseg[nombre].ordenes.push(o);
    });
    Object.values(porAseg).forEach(g => {
      g.count = g.ordenes.length;
      const conDias = g.ordenes.filter(o => o.entregada_en && o.creado_en);
      g.promDias = conDias.length
        ? Math.round(conDias.reduce((s,o) => s + (new Date(o.entregada_en) - new Date(o.creado_en)) / 86400000, 0) / conDias.length)
        : 0;
    });
    const asegArray = Object.values(porAseg).sort((a,b) => b.count - a.count);

    cont.innerHTML = `
      <div style="padding:0 0 24px">

        <!-- KPI STRIP -->
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:12px;margin-bottom:24px">
          ${_asegKpi('Activos', activas.length, '#2563EB')}
          ${_asegKpi('En pulmón', enPulmon.length, '#D97706')}
          ${_asegKpi('Pend. repuestos', pendRep.length, '#DC2626')}
          ${_asegKpi('En reparación', enRep.length, '#059669')}
          ${_asegKpi('Ciclo prom. (mes)', promCiclo + 'd', '#7C3AED')}
          ${_asegKpi('Días prom. aprobac.', promAprobDias + 'd', '#0891B2')}
        </div>

        <!-- FILTROS -->
        <div style="display:flex;gap:10px;margin-bottom:16px;flex-wrap:wrap">
          <input id="aseg-buscar" type="text" placeholder="Placa, aseguradora, propietario..."
            style="flex:1;min-width:200px;padding:9px 12px;border:1.5px solid var(--gris-borde);border-radius:8px;font-size:13px;outline:none"
            oninput="filtrarAseguradoras()">
          <select id="aseg-filtro-estado" onchange="filtrarAseguradoras()"
            style="padding:9px 12px;border:1.5px solid var(--gris-borde);border-radius:8px;font-size:13px;background:white;color:var(--texto)">
            <option value="">Todos los estados</option>
            ${Object.entries(ESTADOS_ASEG).map(([k,v]) => `<option value="${k}">${v.label}</option>`).join('')}
          </select>
          <select id="aseg-filtro-aseg" onchange="filtrarAseguradoras()"
            style="padding:9px 12px;border:1.5px solid var(--gris-borde);border-radius:8px;font-size:13px;background:white;color:var(--texto)">
            <option value="">Todas las aseguradoras</option>
            ${asegArray.map(g => `<option value="${escapeHtml(g.nombre)}">${escapeHtml(g.nombre)} (${g.count})</option>`).join('')}
          </select>
        </div>

        <!-- LISTA -->
        <div id="aseg-lista"></div>

        <!-- PANEL POR ASEGURADORA -->
        ${asegArray.length > 1 ? `
        <div style="margin-top:24px;border-top:1.5px solid var(--gris-borde);padding-top:18px">
          <div style="font-size:13px;font-weight:700;color:var(--gris-mid);text-transform:uppercase;letter-spacing:.5px;margin-bottom:12px">Resumen por aseguradora</div>
          <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:10px">
            ${asegArray.map(g => `
            <div style="background:white;border:1px solid var(--gris-borde);border-radius:10px;padding:14px 16px;cursor:pointer;transition:box-shadow .15s"
              onclick="document.getElementById('aseg-filtro-aseg').value='${escapeHtml(g.nombre)}';filtrarAseguradoras()"
              onmouseenter="this.style.boxShadow='0 4px 16px rgba(0,0,0,0.10)'"
              onmouseleave="this.style.boxShadow='none'">
              <div style="font-size:14px;font-weight:700;color:#5B21B6;margin-bottom:6px">${escapeHtml(g.nombre)}</div>
              <div style="display:flex;gap:16px;font-size:12px">
                <div><div style="font-weight:700;font-size:20px;color:#1E3A5F">${g.count}</div><div style="color:var(--gris-mid)">órdenes</div></div>
                ${g.promDias > 0 ? `<div><div style="font-weight:700;font-size:20px;color:#7C3AED">${g.promDias}d</div><div style="color:var(--gris-mid)">ciclo prom.</div></div>` : ''}
              </div>
            </div>`).join('')}
          </div>
        </div>` : ''}
      </div>`;

    filtrarAseguradoras();
  } catch(e) {
    const c = document.getElementById('pag-aseguradoras');
    if (c) c.innerHTML = `<div class="empty-state">Error: ${e.message}</div>`;
  }
}

async function cargarDashboardAseguradoras() {
  const cont = document.getElementById('pag-aseguradoras');
  if (!cont) return;
  cont.innerHTML = '<div class="loading-state">Cargando aseguradoras...</div>';

  try {
    const ordenes = await api(
      '/ordenes?aseguradora=not.is.null&order=creado_en.desc&select=*'
    ).catch(() => []) || [];

    _asegOrdenesCache = ordenes;

    const fmt  = n => n != null
      ? new Intl.NumberFormat('es-CO', { style:'currency', currency:'COP', minimumFractionDigits:0 }).format(n)
      : '—';
    const today = new Date();

    // ── KPIs ────────────────────────────────────────────────
    const activas              = ordenes.filter(o => o.estado === 'Activa');
    const enPulmon             = ordenes.filter(o => o.pulmon);
    const pendRep              = ordenes.filter(o => o.estado_aseguradora === 'repuestos_incompletos');
    const enRep                = ordenes.filter(o => o.estado_aseguradora === 'en_reparacion');
    const entregadas           = ordenes.filter(o => o.entregada_en && o.creado_en);
    const promCiclo            = entregadas.length
      ? Math.round(entregadas.reduce((s, o) => s + (new Date(o.entregada_en) - new Date(o.creado_en)) / 86400000, 0) / entregadas.length)
      : 0;
    const totalEstadia         = activas.filter(o => o.pulmon_desde).reduce((s, o) => {
      const dias    = Math.floor((today - new Date(o.pulmon_desde)) / 86400000);
      const gracia  = o.dias_gracia_estadia ?? 3;
      const tarifa  = o.valor_estadia_dia   ?? 0;
      return s + Math.max(0, dias - gracia) * tarifa;
    }, 0);
    const pendAprobacion       = ordenes.filter(o =>
      ['peritaje_enviado','en_pulmon'].includes(o.estado_aseguradora)
    );
    const promAprobDias        = pendAprobacion.length
      ? Math.round(pendAprobacion.reduce((s, o) => {
          const desde = o.peritaje_enviado_en || o.creado_en;
          return s + (today - new Date(desde)) / 86400000;
        }, 0) / pendAprobacion.length)
      : 0;

    cont.innerHTML = `
      <div style="padding:0 0 24px">

        <!-- KPI STRIP -->
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:12px;margin-bottom:24px">
          ${_asegKpi('Total activos', activas.length, '#2563EB')}
          ${_asegKpi('En pulmón', enPulmon.length, '#D97706')}
          ${_asegKpi('Pend. repuestos', pendRep.length, '#DC2626')}
          ${_asegKpi('En reparación', enRep.length, '#059669')}
          ${_asegKpi('Ciclo prom.', promCiclo + 'd', '#7C3AED')}
          ${_asegKpi('Prom. días aprobación', promAprobDias + 'd', '#0891B2')}
          ${totalEstadia > 0 ? _asegKpi('Estadía acum.', fmt(totalEstadia), '#EA580C') : ''}
        </div>

        <!-- FILTROS -->
        <div style="display:flex;gap:10px;margin-bottom:16px;flex-wrap:wrap">
          <input id="aseg-buscar" type="text" placeholder="🔍  Placa, aseguradora, propietario..."
            style="flex:1;min-width:200px;padding:9px 12px;border:1.5px solid var(--gris-borde);border-radius:8px;font-size:13px;outline:none"
            oninput="filtrarAseguradoras()">
          <select id="aseg-filtro-estado" onchange="filtrarAseguradoras()"
            style="padding:9px 12px;border:1.5px solid var(--gris-borde);border-radius:8px;font-size:13px;background:white;color:var(--texto)">
            <option value="">Todos los estados</option>
            ${Object.entries(ESTADOS_ASEG).map(([k,v]) => `<option value="${k}">${v.label}</option>`).join('')}
          </select>
        </div>

        <!-- LISTA -->
        <div id="aseg-lista"></div>
      </div>`;

    filtrarAseguradoras();
  } catch(e) {
    const cont2 = document.getElementById('pag-aseguradoras');
    if (cont2) cont2.innerHTML = `<div class="empty-state">Error: ${e.message}</div>`;
  }
}

function _asegKpi(label, value, color) {
  return `<div style="background:white;border:1px solid var(--gris-borde);border-radius:10px;padding:14px 16px;box-shadow:0 1px 3px rgba(0,0,0,0.05)">
    <div style="font-size:24px;font-weight:800;color:${color};line-height:1;margin-bottom:5px">${value}</div>
    <div style="font-size:10px;font-weight:700;color:var(--gris-mid);text-transform:uppercase;letter-spacing:.5px">${label}</div>
  </div>`;
}

function filtrarAseguradoras() {
  const q    = (document.getElementById('aseg-buscar')?.value || '').toLowerCase().trim();
  const est  = document.getElementById('aseg-filtro-estado')?.value || '';
  const aseg = document.getElementById('aseg-filtro-aseg')?.value || '';
  const data = _asegOrdenesCache.filter(o => {
    const matchQ    = !q    || [o.placa, o.aseguradora, o.propietario, o.marca].some(f => (f||'').toLowerCase().includes(q));
    const matchEst  = !est  || (o.estado_aseguradora || 'peritaje_pendiente') === est;
    const matchAseg = !aseg || (o.aseguradora || 'Sin aseguradora') === aseg;
    return matchQ && matchEst && matchAseg;
  });
  renderListaAseguradoras(data);
}

function renderListaAseguradoras(ordenes) {
  const lista = document.getElementById('aseg-lista');
  if (!lista) return;
  if (!ordenes.length) {
    lista.innerHTML = '<div class="empty-state"><div class="empty-state-icon">🏢</div><p>No hay órdenes de aseguradoras.</p></div>';
    return;
  }

  const fmt   = n => n != null ? new Intl.NumberFormat('es-CO',{style:'currency',currency:'COP',minimumFractionDigits:0}).format(n) : '—';
  const today = new Date();

  lista.innerHTML = ordenes.map(o => {
    const est      = o.estado_aseguradora || 'peritaje_pendiente';
    const estInfo  = ESTADOS_ASEG[est] || ESTADOS_ASEG.peritaje_pendiente;
    const diasSist = o.creado_en ? Math.floor((today - new Date(o.creado_en)) / 86400000) : 0;

    // Estadía
    let estadiaHtml = '';
    if (o.pulmon_desde) {
      const diasP   = Math.floor((today - new Date(o.pulmon_desde)) / 86400000);
      const gracia  = o.dias_gracia_estadia ?? 3;
      const tarifa  = o.valor_estadia_dia   ?? 0;
      const cobro   = Math.max(0, diasP - gracia) * tarifa;
      estadiaHtml   = `<span style="font-size:11px;background:#E0F2FE;color:#0369A1;padding:2px 8px;border-radius:99px;font-weight:600">
        🕐 ${diasP}d pulmón${tarifa > 0 ? ' · ' + fmt(cobro) + ' estadía' : ''}
      </span>`;
    }

    // Timeline
    const steps = [
      { label:'Peritaje',  date: o.peritaje_enviado_en,    key:'peritaje_enviado' },
      { label:'Pulmón',    date: o.pulmon_desde,           key:'en_pulmon' },
      { label:'Repuestos', date: o.repuestos_completos_en, key:'repuestos_completos' },
      { label:'Reparación',date: o.reparacion_iniciada_en, key:'en_reparacion' },
      { label:'Entrega',   date: o.entregada_en,           key:'terminado' }
    ];
    const curIdx = ESTADOS_ASEG_ORDER.indexOf(est);
    const timelineHtml = steps.map((step, i) => {
      const stepIdx = ESTADOS_ASEG_ORDER.indexOf(step.key);
      const done    = curIdx >= stepIdx;
      const active  = est === step.key;
      const dotCol  = done ? (active ? '#2563EB' : '#10B981') : '#D1D5DB';
      const lineCol = done && stepIdx < curIdx ? '#10B981' : '#E5E7EB';
      return `<div style="display:flex;align-items:center;flex:1">
        <div style="display:flex;flex-direction:column;align-items:center;gap:2px;min-width:50px">
          <div style="width:10px;height:10px;border-radius:50%;background:${dotCol};flex-shrink:0;${active?'box-shadow:0 0 0 3px '+dotCol+'44':''}"></div>
          <div style="font-size:9px;color:${done?'#374151':'#9CA3AF'};font-weight:${done?'600':'400'};text-align:center">${step.label}</div>
          ${step.date ? `<div style="font-size:8px;color:var(--gris-mid)">${new Date(step.date).toLocaleDateString('es-CO',{day:'2-digit',month:'2-digit'})}</div>` : ''}
        </div>
        ${i < steps.length - 1 ? `<div style="flex:1;height:2px;background:${lineCol};margin-bottom:20px"></div>` : ''}
      </div>`;
    }).join('');

    // Repuestos checklist resumen
    let repHtml = '';
    try {
      const rep = typeof o.repuestos_aseguradora === 'string'
        ? JSON.parse(o.repuestos_aseguradora) : (o.repuestos_aseguradora || []);
      if (rep.length) {
        const comp = rep.filter(r => r.estado === 'completo').length;
        const incomp = rep.filter(r => r.estado === 'incompleto').length;
        const sinProv = rep.filter(r => r.estado === 'sin_proveedor').length;
        repHtml = `<div style="font-size:11px;color:var(--gris-mid);margin-top:4px">
          Repuestos: <span style="color:#059669;font-weight:600">${comp} ✓</span>
          ${incomp > 0 ? ` · <span style="color:#DC2626;font-weight:600">${incomp} incompleto${incomp>1?'s':''}</span>` : ''}
          ${sinProv > 0 ? ` · <span style="color:#D97706;font-weight:600">${sinProv} sin proveedor</span>` : ''}
        </div>`;
      }
    } catch(e) {}

    return `<div style="background:white;border:1px solid var(--gris-borde);border-radius:10px;padding:16px;margin-bottom:12px;box-shadow:0 1px 3px rgba(0,0,0,0.04);cursor:pointer;transition:box-shadow .15s"
      onclick="abrirOrden(${o.id})"
      onmouseenter="this.style.boxShadow='0 4px 16px rgba(0,0,0,0.10)'"
      onmouseleave="this.style.boxShadow='0 1px 3px rgba(0,0,0,0.04)'">
      <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-bottom:12px">
        <div style="flex:1;min-width:0">
          <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:3px">
            <span style="font-family:'DM Mono',monospace;font-size:18px;font-weight:700;letter-spacing:2px">${escapeHtml(o.placa||'—')}</span>
            <span style="font-family:'DM Mono',monospace;font-size:11px;color:var(--gris-mid)">${formatOT(o.id)}</span>
            ${estadiaHtml}
          </div>
          <div style="font-size:12px;color:var(--gris-mid)">${[o.marca,o.linea].filter(Boolean).map(escapeHtml).join(' ') || '—'} · ${escapeHtml(o.propietario||'—')}</div>
          <div style="font-size:12px;font-weight:700;color:#5B21B6;margin-top:2px">🏢 ${escapeHtml(o.aseguradora)}</div>
          ${repHtml}
        </div>
        <div style="display:flex;flex-direction:column;align-items:flex-end;gap:6px;flex-shrink:0">
          <span style="background:${estInfo.bg};color:${estInfo.color};padding:4px 10px;border-radius:99px;font-size:11px;font-weight:700;white-space:nowrap">${estInfo.label}</span>
          <span style="font-size:11px;color:var(--gris-mid)">${diasSist}d en sistema</span>
        </div>
      </div>
      <!-- Timeline -->
      <div style="display:flex;align-items:flex-start;padding-top:10px;border-top:1px solid var(--gris-borde)">
        ${timelineHtml}
      </div>
    </div>`;
  }).join('');
}

// ─── Panel "Datos aseguradora" en sidebar de orden ────────

function renderDatosAseguradora(orden) {
  // Leer datos_aseguradora desde JSON guardado en observaciones o campo propio
  let datos = {};
  try {
    if (orden.datos_aseguradora) {
      datos = typeof orden.datos_aseguradora === 'string'
        ? JSON.parse(orden.datos_aseguradora)
        : orden.datos_aseguradora;
    }
  } catch(e) {}

  const v = s => escapeHtml(datos[s] || '');

  return `
    <div style="display:flex;flex-direction:column;gap:10px;font-size:12px">
      <div class="field" style="margin:0">
        <label style="font-size:10px;font-weight:700;color:var(--gris-mid);text-transform:uppercase;letter-spacing:.5px">Ajustador</label>
        <input id="da-ajustador-${orden.id}" value="${v('ajustador')}" placeholder="Nombre del ajustador"
          style="width:100%;padding:6px 8px;border:1.5px solid var(--gris-borde);border-radius:6px;font-size:12px;box-sizing:border-box">
      </div>
      <div class="field" style="margin:0">
        <label style="font-size:10px;font-weight:700;color:var(--gris-mid);text-transform:uppercase;letter-spacing:.5px">Fecha peritaje</label>
        <input id="da-peritaje-${orden.id}" type="date" value="${v('fecha_peritaje')}"
          style="width:100%;padding:6px 8px;border:1.5px solid var(--gris-borde);border-radius:6px;font-size:12px;box-sizing:border-box">
      </div>
      <div class="field" style="margin:0">
        <label style="font-size:10px;font-weight:700;color:var(--gris-mid);text-transform:uppercase;letter-spacing:.5px">Fecha autorización</label>
        <input id="da-autorizacion-${orden.id}" type="date" value="${v('fecha_autorizacion')}"
          style="width:100%;padding:6px 8px;border:1.5px solid var(--gris-borde);border-radius:6px;font-size:12px;box-sizing:border-box">
      </div>
      <div class="field" style="margin:0">
        <label style="font-size:10px;font-weight:700;color:var(--gris-mid);text-transform:uppercase;letter-spacing:.5px">Valor autorizado (COP)</label>
        <input id="da-valor-${orden.id}" type="number" value="${datos.valor_autorizado||''}" placeholder="0"
          style="width:100%;padding:6px 8px;border:1.5px solid var(--gris-borde);border-radius:6px;font-size:12px;box-sizing:border-box">
      </div>
      <div class="field" style="margin:0">
        <label style="font-size:10px;font-weight:700;color:var(--gris-mid);text-transform:uppercase;letter-spacing:.5px">Estado pago</label>
        <select id="da-pago-${orden.id}"
          style="width:100%;padding:6px 8px;border:1.5px solid var(--gris-borde);border-radius:6px;font-size:12px;background:white;box-sizing:border-box">
          <option value="pendiente" ${(datos.estado_pago||'pendiente')==='pendiente'?'selected':''}>Pendiente</option>
          <option value="parcial"   ${datos.estado_pago==='parcial'?'selected':''}>Parcial</option>
          <option value="pagado"    ${datos.estado_pago==='pagado'?'selected':''}>Pagado</option>
        </select>
      </div>
      <button onclick="guardarDatosAseguradora(${orden.id})"
        style="padding:7px 12px;background:#5B21B6;color:white;border:none;border-radius:6px;font-size:12px;font-weight:600;cursor:pointer;width:100%">
        Guardar datos aseguradora
      </button>
    </div>`;
}

async function guardarDatosAseguradora(ordenId) {
  const datos = {
    ajustador:         document.getElementById(`da-ajustador-${ordenId}`)?.value.trim()   || '',
    fecha_peritaje:    document.getElementById(`da-peritaje-${ordenId}`)?.value           || '',
    fecha_autorizacion:document.getElementById(`da-autorizacion-${ordenId}`)?.value       || '',
    valor_autorizado:  parseFloat(document.getElementById(`da-valor-${ordenId}`)?.value)  || 0,
    estado_pago:       document.getElementById(`da-pago-${ordenId}`)?.value               || 'pendiente'
  };

  try {
    // Intentar guardar en campo datos_aseguradora si existe; si no, en observaciones como JSON tag
    let patch = {};
    try {
      // Try JSONB field first
      await api(`/ordenes?id=eq.${ordenId}`, 'PATCH', { datos_aseguradora: datos });
      patch = { datos_aseguradora: datos };
    } catch(e1) {
      // Fallback: store JSON tag in observaciones
      const arr = await api(`/ordenes?id=eq.${ordenId}&select=observaciones`).catch(()=>[]);
      const obs = arr?.[0]?.observaciones || '';
      const tag = `[DATOS_ASEG:${JSON.stringify(datos)}]`;
      const obsLimpia = obs.replace(/\[DATOS_ASEG:.*?\]/s, '').trim();
      await api(`/ordenes?id=eq.${ordenId}`, 'PATCH', {
        observaciones: (obsLimpia ? obsLimpia + '\n' : '') + tag
      });
    }
    toast('Datos de aseguradora guardados ✓');
    if (typeof abrirOrden === 'function') abrirOrden(ordenId);
  } catch(e) {
    toast('Error guardando: ' + e.message, 'err');
  }
}

// ─── Sección aseguradoras en sidebar de orden ─────────────

function renderSeccionAseguradora(orden) {
  if (!orden?.aseguradora) return '';
  const est     = orden.estado_aseguradora || 'peritaje_pendiente';
  const estInfo = ESTADOS_ASEG[est] || ESTADOS_ASEG.peritaje_pendiente;
  const fmt     = n => n != null ? new Intl.NumberFormat('es-CO',{style:'currency',currency:'COP',minimumFractionDigits:0}).format(n) : '—';
  const today   = new Date();

  // Estadía
  let estadiaHtml = '';
  if (orden.pulmon_desde) {
    const diasP  = Math.floor((today - new Date(orden.pulmon_desde)) / 86400000);
    const gracia = orden.dias_gracia_estadia ?? 3;
    const tarifa = orden.valor_estadia_dia   ?? 0;
    const cobro  = Math.max(0, diasP - gracia) * tarifa;
    estadiaHtml  = `<div class="info-chip">
      <div class="info-chip-label">Días en pulmón</div>
      <div class="info-chip-val" style="color:#D97706;font-weight:700">${diasP}d${tarifa > 0 ? ' · ' + fmt(cobro) : ''}</div>
    </div>`;
  }

  // Timestamps
  const tsChip = (label, val) => val ? `<div class="info-chip">
    <div class="info-chip-label">${label}</div>
    <div class="info-chip-val" style="font-size:11px">${new Date(val).toLocaleString('es-CO',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'})}</div>
  </div>` : '';

  // Repuestos resumen
  let repuestos = [];
  try { repuestos = typeof orden.repuestos_aseguradora === 'string' ? JSON.parse(orden.repuestos_aseguradora) : (orden.repuestos_aseguradora || []); } catch(e) {}

  const puedeEnviarPeritaje = ['jefe','gerente','mecanico'].includes(sesion?.perfil) &&
    !['peritaje_enviado','en_pulmon','repuestos_incompletos','repuestos_completos','en_reparacion','terminado'].includes(est);

  return `
    <!-- Estado actual -->
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">
      <span style="background:${estInfo.bg};color:${estInfo.color};padding:4px 12px;border-radius:99px;font-size:12px;font-weight:700">${estInfo.label}</span>
      ${orden.valor_estadia_dia > 0 ? `<span style="font-size:11px;color:var(--gris-mid)">Tarifa: ${fmt(orden.valor_estadia_dia)}/día</span>` : ''}
    </div>

    <!-- Chips de fechas -->
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:14px">
      ${tsChip('Peritaje enviado', orden.peritaje_enviado_en)}
      ${tsChip('Entra a pulmón', orden.pulmon_desde)}
      ${estadiaHtml}
      ${tsChip('Repuestos completos', orden.repuestos_completos_en)}
      ${tsChip('Inicio reparación', orden.reparacion_iniciada_en)}
    </div>

    <!-- Acciones según estado -->
    <div style="display:flex;flex-direction:column;gap:8px">

      ${puedeEnviarPeritaje ? `
      <button class="btn btn-primary btn-sm" onclick="marcarPeritajeEnviado(${orden.id})"
        style="display:flex;align-items:center;gap:6px">
        <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
        Enviar peritaje a aseguradora
      </button>` : ''}

      ${['peritaje_enviado','en_pulmon','repuestos_incompletos'].includes(est) ? `
      <button class="btn btn-outline btn-sm" onclick="abrirModalRepuestosAseg(${orden.id})"
        style="display:flex;align-items:center;gap:6px">
        <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/></svg>
        Registrar respuesta aseguradora (${repuestos.length} ítems)
      </button>` : ''}

      ${est === 'repuestos_completos' ? `
      <button class="btn btn-success btn-sm" onclick="iniciarReparacionAseg(${orden.id})"
        style="display:flex;align-items:center;gap:6px">
        <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
        Comenzar reparación
      </button>` : ''}

      ${est !== 'peritaje_pendiente' ? `
      <button class="btn btn-ghost btn-sm" onclick="abrirModalConfigEstadia(${orden.id})"
        style="font-size:11px;color:var(--gris-mid)">
        ⚙ Configurar tarifa de estadía
      </button>` : ''}
    </div>

    <!-- Repuestos checklist resumen -->
    ${repuestos.length ? `
    <div style="margin-top:14px;border-top:1px solid var(--gris-borde);padding-top:12px">
      <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:var(--gris-mid);margin-bottom:8px">Checklist de repuestos</div>
      ${repuestos.map(r => {
        const icon = r.estado === 'completo' ? '✓' : r.estado === 'incompleto' ? '✗' : '?';
        const col  = r.estado === 'completo' ? '#059669' : r.estado === 'incompleto' ? '#DC2626' : '#D97706';
        return `<div style="display:flex;align-items:flex-start;gap:8px;padding:5px 0;border-bottom:1px solid var(--gris-borde)">
          <span style="color:${col};font-weight:700;font-size:13px;flex-shrink:0">${icon}</span>
          <div style="flex:1;min-width:0">
            <div style="font-size:12px;font-weight:600">${escapeHtml(r.item||'—')}</div>
            ${r.descripcion ? `<div style="font-size:11px;color:var(--gris-mid)">${escapeHtml(r.descripcion)}</div>` : ''}
          </div>
        </div>`;
      }).join('')}
    </div>` : ''}`;
}

// ─── Acciones del workflow ────────────────────────────────

async function marcarPeritajeEnviado(ordenId) {
  if (!confirm('¿Confirmas que el peritaje fue realizado y enviado a la aseguradora?\n\nEl vehículo entrará a pulmón automáticamente.')) return;

  try {
    const now = new Date().toISOString();
    await api(`/ordenes?id=eq.${ordenId}`, 'PATCH', {
      peritaje_realizado_en: now,
      peritaje_enviado_en:   now,
      estado_aseguradora:    'peritaje_enviado'
    });

    // Preguntar tipo de pulmón
    const tipoPulmon = await _elegirTipoPulmon();
    if (tipoPulmon) {
      await api(`/ordenes?id=eq.${ordenId}`, 'PATCH', {
        pulmon:            true,
        pulmon_desde:      now,
        pulmon_tipo:       tipoPulmon,
        estado_aseguradora:'en_pulmon'
      });
      toast(`Peritaje enviado ✓ — Vehículo en pulmón (${tipoPulmon})`);
    } else {
      toast('Peritaje enviado ✓');
    }

    if (typeof abrirOrden === 'function') abrirOrden(ordenId);
    if (typeof cargarDashboardAseguradoras === 'function') cargarDashboardAseguradoras();
  } catch(e) {
    toast('Error: ' + e.message, 'err');
  }
}

function _elegirTipoPulmon() {
  return new Promise(resolve => {
    const m = document.createElement('div');
    m.className = 'modal-overlay show';
    m.style.zIndex = '600';
    m.innerHTML = `
      <div class="modal" style="max-width:380px">
        <div class="modal-header">
          <h2>¿Dónde está el vehículo?</h2>
        </div>
        <div class="modal-body" style="display:flex;flex-direction:column;gap:10px">
          <p style="font-size:13px;color:var(--gris-mid);margin:0">Selecciona la ubicación del vehículo mientras espera respuesta de la aseguradora:</p>
          ${[
            { val:'interno', label:'🏭 Interno — Permanece en el taller', color:'#2563EB' },
            { val:'externo_cliente', label:'🏠 Externo — En casa del cliente', color:'#059669' },
            { val:'externo_aseguradora', label:'🏢 Externo — En manos de la aseguradora', color:'#7C3AED' }
          ].map(op => `
            <button onclick="this.closest('.modal-overlay')._resolve('${op.val}')"
              style="padding:12px 16px;border:2px solid ${op.color}20;border-radius:8px;background:white;cursor:pointer;text-align:left;font-size:13px;font-weight:600;color:${op.color};display:flex;align-items:center;gap:8px;transition:background .15s"
              onmouseenter="this.style.background='${op.color}10'"
              onmouseleave="this.style.background='white'">
              ${op.label}
            </button>`).join('')}
        </div>
        <div class="modal-footer">
          <button class="btn btn-ghost" onclick="this.closest('.modal-overlay')._resolve(null)">Omitir por ahora</button>
        </div>
      </div>`;
    m._resolve = val => { m.remove(); resolve(val); };
    document.body.appendChild(m);
  });
}

// ─── Modal checklist de repuestos ────────────────────────

async function abrirModalRepuestosAseg(ordenId) {
  let orden = null;
  try {
    const arr = await api(`/ordenes?id=eq.${ordenId}&limit=1`).catch(() => []);
    orden = arr?.[0];
  } catch(e) {}
  if (!orden) { toast('No se pudo cargar la orden', 'err'); return; }

  let repuestos = [];
  try {
    repuestos = typeof orden.repuestos_aseguradora === 'string'
      ? JSON.parse(orden.repuestos_aseguradora)
      : (orden.repuestos_aseguradora || []);
  } catch(e) { repuestos = []; }

  // Garantizar al menos 1 fila
  if (!repuestos.length) repuestos = [{ item:'', estado:'sin_proveedor', descripcion:'' }];

  document.getElementById('modal-repuestos-aseg')?.remove();
  const m = document.createElement('div');
  m.id = 'modal-repuestos-aseg';
  m.className = 'modal-overlay show';
  m.innerHTML = `
    <div class="modal" style="max-width:620px;max-height:90vh;display:flex;flex-direction:column">
      <div class="modal-header">
        <h2>Respuesta aseguradora — Repuestos</h2>
        <button class="btn btn-ghost btn-sm" onclick="document.getElementById('modal-repuestos-aseg').remove()">✕</button>
      </div>
      <div class="modal-body" style="flex:1;overflow-y:auto">
        <p style="font-size:13px;color:var(--gris-mid);margin:0 0 14px">
          Registra la respuesta de <strong>${escapeHtml(orden.aseguradora)}</strong> para cada repuesto.
          El estado global se actualizará automáticamente.
        </p>
        <div id="aseg-rep-lista" style="display:flex;flex-direction:column;gap:8px">
          ${repuestos.map((r, i) => _filaRepuesto(r, i)).join('')}
        </div>
        <button class="btn btn-ghost btn-sm" onclick="_agregarFilaRepuesto()"
          style="margin-top:10px;display:flex;align-items:center;gap:6px;font-size:12px">
          <svg width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Agregar repuesto
        </button>
      </div>
      <div class="modal-footer">
        <button class="btn btn-ghost" onclick="document.getElementById('modal-repuestos-aseg').remove()">Cancelar</button>
        <button class="btn btn-primary" onclick="guardarChecklistRepuestos(${ordenId})">Guardar respuesta</button>
      </div>
    </div>`;
  m.addEventListener('click', e => { if (e.target === m) m.remove(); });
  document.body.appendChild(m);
}

function _filaRepuesto(r, i) {
  const opciones = [
    { val:'completo',      label:'✓ Completo',      color:'#059669' },
    { val:'incompleto',    label:'✗ Incompleto',    color:'#DC2626' },
    { val:'sin_proveedor', label:'? Sin proveedor', color:'#D97706' }
  ];
  return `<div class="aseg-rep-fila" style="display:grid;grid-template-columns:1fr auto 1fr auto;gap:8px;align-items:center;background:var(--gris-bg);border-radius:8px;padding:10px">
    <input type="text" placeholder="Nombre del repuesto" value="${escapeHtml(r.item||'')}"
      class="aseg-rep-item" style="padding:7px 10px;border:1.5px solid var(--gris-borde);border-radius:6px;font-size:13px;outline:none;background:white">
    <select class="aseg-rep-estado" style="padding:7px 10px;border:1.5px solid var(--gris-borde);border-radius:6px;font-size:12px;background:white">
      ${opciones.map(op => `<option value="${op.val}" ${r.estado===op.val?'selected':''}>${op.label}</option>`).join('')}
    </select>
    <input type="text" placeholder="Observación (opcional)" value="${escapeHtml(r.descripcion||'')}"
      class="aseg-rep-desc" style="padding:7px 10px;border:1.5px solid var(--gris-borde);border-radius:6px;font-size:13px;outline:none;background:white">
    <button onclick="this.closest('.aseg-rep-fila').remove()" style="width:28px;height:28px;border:1.5px solid var(--gris-borde);border-radius:6px;background:white;cursor:pointer;display:flex;align-items:center;justify-content:center;color:var(--rojo);flex-shrink:0">
      <svg width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
    </button>
  </div>`;
}

function _agregarFilaRepuesto() {
  const lista = document.getElementById('aseg-rep-lista');
  if (!lista) return;
  const div = document.createElement('div');
  div.innerHTML = _filaRepuesto({ item:'', estado:'sin_proveedor', descripcion:'' }, lista.children.length);
  lista.appendChild(div.firstElementChild);
}

async function guardarChecklistRepuestos(ordenId) {
  const filas = document.querySelectorAll('.aseg-rep-fila');
  const repuestos = [...filas].map(f => ({
    item:        f.querySelector('.aseg-rep-item')?.value.trim()  || '',
    estado:      f.querySelector('.aseg-rep-estado')?.value       || 'sin_proveedor',
    descripcion: f.querySelector('.aseg-rep-desc')?.value.trim()  || ''
  })).filter(r => r.item);

  // Determinar estado global
  const hayIncompletos  = repuestos.some(r => r.estado === 'incompleto' || r.estado === 'sin_proveedor');
  const estadoAseg      = hayIncompletos ? 'repuestos_incompletos' : 'repuestos_completos';
  const repCompletoEn   = !hayIncompletos ? new Date().toISOString() : null;

  try {
    const patch = {
      repuestos_aseguradora: repuestos,
      estado_aseguradora:    estadoAseg
    };
    if (repCompletoEn) patch.repuestos_completos_en = repCompletoEn;

    await api(`/ordenes?id=eq.${ordenId}`, 'PATCH', patch);
    document.getElementById('modal-repuestos-aseg')?.remove();

    const label = estadoAseg === 'repuestos_completos'
      ? 'Repuestos completos ✓ — ya puedes iniciar la reparación'
      : 'Registrado — orden marcada como "Pendiente por repuestos"';
    toast(label, estadoAseg === 'repuestos_incompletos' ? 'warn' : undefined);

    if (typeof abrirOrden === 'function') abrirOrden(ordenId);
    if (typeof cargarDashboardAseguradoras === 'function') cargarDashboardAseguradoras();
  } catch(e) {
    toast('Error: ' + e.message, 'err');
  }
}

async function iniciarReparacionAseg(ordenId) {
  if (!confirm('¿Confirmas el inicio de la reparación?\n\nAhora podrás asignar técnicos a cada proceso.')) return;
  try {
    await api(`/ordenes?id=eq.${ordenId}`, 'PATCH', {
      estado_aseguradora:   'en_reparacion',
      reparacion_iniciada_en: new Date().toISOString(),
      pulmon:               false,
      pulmon_fin:           new Date().toISOString()
    });
    toast('Reparación iniciada ✓ — ahora asigna los técnicos a cada etapa');
    if (typeof abrirOrden === 'function') abrirOrden(ordenId);
    if (typeof cargarDashboardAseguradoras === 'function') cargarDashboardAseguradoras();
  } catch(e) {
    toast('Error: ' + e.message, 'err');
  }
}

// ─── Modal configurar tarifa de estadía ──────────────────

async function abrirModalConfigEstadia(ordenId) {
  const arr = await api(`/ordenes?id=eq.${ordenId}&select=id,aseguradora,valor_estadia_dia,dias_gracia_estadia`).catch(()=>[]);
  const orden = arr?.[0];
  if (!orden) return;

  document.getElementById('modal-estadia-config')?.remove();
  const m = document.createElement('div');
  m.id = 'modal-estadia-config';
  m.className = 'modal-overlay show';
  m.innerHTML = `
    <div class="modal" style="max-width:380px">
      <div class="modal-header">
        <h2>Tarifa de estadía</h2>
        <button class="btn btn-ghost btn-sm" onclick="document.getElementById('modal-estadia-config').remove()">✕</button>
      </div>
      <div class="modal-body" style="display:flex;flex-direction:column;gap:14px">
        <p style="font-size:13px;color:var(--gris-mid);margin:0">
          Configura el cobro de bodegaje por día para <strong>${escapeHtml(orden.aseguradora||'')}</strong>.
        </p>
        <div class="field">
          <label>Valor por día (COP)</label>
          <input id="est-tarifa" type="number" step="1000" min="0" placeholder="0 = sin cobro"
            value="${orden.valor_estadia_dia||0}">
        </div>
        <div class="field">
          <label>Días de gracia (sin cobro)</label>
          <input id="est-gracia" type="number" step="1" min="0" placeholder="3"
            value="${orden.dias_gracia_estadia??3}">
          <div style="font-size:11px;color:var(--gris-mid);margin-top:3px">El cobro inicia después de este número de días en pulmón.</div>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-ghost" onclick="document.getElementById('modal-estadia-config').remove()">Cancelar</button>
        <button class="btn btn-primary" onclick="guardarConfigEstadia(${ordenId})">Guardar</button>
      </div>
    </div>`;
  m.addEventListener('click', e => { if(e.target===m) m.remove(); });
  document.body.appendChild(m);
}

async function guardarConfigEstadia(ordenId) {
  const tarifa = parseFloat(document.getElementById('est-tarifa')?.value) || 0;
  const gracia = parseInt(document.getElementById('est-gracia')?.value) ?? 3;
  try {
    await api(`/ordenes?id=eq.${ordenId}`, 'PATCH', {
      valor_estadia_dia:   tarifa,
      dias_gracia_estadia: gracia
    });
    document.getElementById('modal-estadia-config')?.remove();
    toast('Tarifa de estadía guardada ✓');
    if (typeof abrirOrden === 'function') abrirOrden(ordenId);
    if (typeof cargarDashboardAseguradoras === 'function') cargarDashboardAseguradoras();
  } catch(e) { toast('Error: ' + e.message, 'err'); }
}

// ─── Aceptación de contratistas (latonería / pintura) ────

function mostrarAceptacionContratista(orden, etapaId, servicio) {
  if (!orden?.aseguradora) return '';
  if (!['latoneria','pintura'].includes(servicio)) return '';

  const servicioLabel = servicio === 'latoneria' ? 'Latonería' : 'Pintura';
  return `
    <div style="margin-top:14px;padding:12px 14px;background:#FEF3C7;border:1.5px solid #FDE68A;border-radius:8px">
      <div style="font-size:12px;font-weight:700;color:#92400E;margin-bottom:8px">
        📋 Aceptación de orden de servicio — ${servicioLabel}
      </div>
      <div style="font-size:11px;color:#78350F;line-height:1.5;margin-bottom:10px">
        Al aceptar confirmas que realizarás los trabajos de <strong>${servicioLabel}</strong> para el vehículo
        <strong>${escapeHtml(orden.placa||'')}</strong>, y que entiendes que el pago de estos trabajos está
        condicionado al desembolso de la aseguradora <strong>${escapeHtml(orden.aseguradora)}</strong>
        al taller Freimanautos.
      </div>
      <button class="btn btn-primary btn-sm" onclick="aceptarOrdenContratista(${orden.id}, ${etapaId}, '${servicio}')"
        style="font-size:12px">
        ✓ Acepto esta orden de servicio
      </button>
    </div>`;
}

async function aceptarOrdenContratista(ordenId, etapaId, servicio) {
  try {
    const arr = await api(`/ordenes?id=eq.${ordenId}&select=aceptacion_contratista`).catch(()=>[]);
    let aceptaciones = [];
    try { aceptaciones = JSON.parse(arr?.[0]?.aceptacion_contratista || '[]'); } catch(e) { aceptaciones = []; }

    aceptaciones.push({
      etapa_id:   etapaId,
      servicio,
      aceptado_por: sesion?.nombre || 'Contratista',
      fecha:      new Date().toISOString()
    });

    await api(`/ordenes?id=eq.${ordenId}`, 'PATCH', {
      aceptacion_contratista: JSON.stringify(aceptaciones)
    });
    toast('Orden aceptada ✓ — quedó registrada con fecha y hora');
    if (typeof abrirOrden === 'function') abrirOrden(ordenId);
  } catch(e) {
    toast('Error: ' + e.message, 'err');
  }
}
