// ═══════════════════════════════════════════════════════════
// ÓRDENES - LISTA, DETALLE, NUEVA ORDEN, ETAPAS
// ═══════════════════════════════════════════════════════════

// ============================================================
// LISTA DE ÓRDENES (JEFE)
// ============================================================
function setFiltro(estado, btn) {
  filtroEstado = estado;
  document.querySelectorAll('.filtro-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  cargarOrdenes();
}

function setFiltroPulmon(btn) {
  filtroEstado = null;
  document.querySelectorAll('.filtro-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  cargarOrdenesPulmon();
}

let _ordenesTablaData  = [];
let _etapasTablaData   = [];

async function cargarOrdenes() {
  if (filtroEstado === null) return; // tab pulmón activo
  const lista = document.getElementById('lista-ordenes');
  if (!lista) return;
  mostrarCargandoSiVacio(lista, '<div class="loading-state">Cargando órdenes...</div>');
  try {
    let query;
    if (filtroEstado === 'Activa') {
      query = `/ordenes?or=(estado.eq.Activa,estado.is.null)&pulmon=not.eq.true&order=creado_en.desc&limit=100`;
    } else if (filtroEstado === 'Programada') {
      query = `/ordenes?estado=eq.Programada&order=fecha_programada.asc&limit=100`;
    } else {
      query = `/ordenes?estado=eq.${filtroEstado}&order=creado_en.desc&limit=100`;
    }
    const data = await api(query);
    if (!data?.length) {
      lista.innerHTML = `<div class="empty-state"><div class="empty-state-icon">${ico('clipboard', 32)}</div>No hay órdenes.</div>`;
      return;
    }
    const ids = data.map(o => o.id).join(',');
    const etapas = await api(`/etapas?orden_id=in.(${ids})&select=orden_id,servicio,inicio,fin,tecnico`).catch(() => []) || [];
    _ordenesTablaData = data;
    _etapasTablaData  = etapas;
    renderTablaOrdenes(data, etapas);
  } catch(e) { lista.innerHTML = `<div class="empty-state">Error cargando órdenes: ${e.message}</div>`; }
}

function _buildOrdenRow(o, etapas) {
  const etapasO  = etapas.filter(e => e.orden_id === o.id);
  const total    = etapasO.length;
  const comp     = etapasO.filter(e => e.fin).length;
  const pct      = total ? Math.round((comp / total) * 100) : 0;
  const activa   = etapasO.find(e => e.inicio && !e.fin);
  const srvNombre = activa
    ? (CATALOGO[activa.servicio]?.nombre || activa.servicio)
    : (comp === total && total > 0 ? 'Completada' : null);
  const tecnico  = activa?.tecnico || '';

  // Días en taller
  const diasTaller = o.creado_en ? Math.floor((Date.now() - new Date(o.creado_en)) / 86400000) : 0;

  // Pill estado
  let pillCls, pillTxt;
  if (o.pulmon) { pillCls = 'pill-pulmon'; pillTxt = 'En pulmón'; }
  else if (o.estado === 'Entregada') { pillCls = 'pill-entregada'; pillTxt = 'Entregada'; }
  else if (o.estado === 'Programada') { pillCls = 'pill-programada'; pillTxt = 'Programada'; }
  else {
    const hoy = new Date(); hoy.setHours(0,0,0,0);
    const atrasada = o.fecha_entrega_1 && new Date(o.fecha_entrega_1) < hoy;
    pillCls = atrasada ? 'pill-atrasada' : 'pill-a-tiempo';
    pillTxt = atrasada ? 'Atrasada' : 'A tiempo';
  }

  const fechaEnt = o.fecha_entrega_1 ? formatFecha(o.fecha_entrega_1) : '—';
  const searchStr = [(o.placa||''), (o.propietario||''), (tecnico||''), (o.marca||''), (o.linea||'')].join(' ').toLowerCase();

  // Alerta de contacto / datos faltantes
  const camposFaltantes = [];
  if (!o.propietario)   camposFaltantes.push('nombre');
  if (!o.marca)         camposFaltantes.push('marca');
  if (!o.linea)         camposFaltantes.push('línea');
  if (!o.telefono)      camposFaltantes.push('teléfono');
  const contactAlert = camposFaltantes.length
    ? `<span class="ord-alert-contact" title="Faltan datos: ${camposFaltantes.join(', ')}">⚠</span>`
    : '';

  return `<tr class="ord-row" onclick="abrirOrden(${o.id})" data-oid="${o.id}" data-search="${escapeHtml(searchStr)}">
    <td>
      <div class="ord-placa">${escapeHtml(o.placa)}</div>
      <div class="ord-ot">${otDe(o)}${contactAlert}</div>
    </td>
    <td>
      <div class="ord-veh-nombre">${[o.marca,o.linea].filter(Boolean).map(escapeHtml).join(' ') || '—'}</div>
      <div class="ord-veh-cliente">${escapeHtml(o.propietario || '—')}${o.modelo ? ` · ${escapeHtml(o.modelo)}` : ''}</div>
    </td>
    <td>
      ${total > 0 ? `
        <div class="ord-etapa-nombre">${escapeHtml(srvNombre || '—')}</div>
        <div class="ord-prog-wrap">
          <div class="ord-prog-track"><div class="ord-prog-fill" style="width:${pct}%"></div></div>
          <span class="ord-prog-lbl">${comp}/${total}</span>
        </div>` : `<span class="ord-sin-etapas">Sin etapas</span>`}
    </td>
    <td class="ord-resp">${escapeHtml(tecnico) || '<span style="color:var(--gris-mid)">—</span>'}</td>
    <td class="ord-fecha-ent">${fechaEnt}</td>
    <td class="ord-dias">${diasTaller}d</td>
    <td><span class="ord-pill ${pillCls}">${pillTxt}</span>${o.estado === 'Archivada' ? `<button class="btn btn-ghost btn-xs" style="color:#DC2626;margin-left:6px;padding:2px 6px" onclick="event.stopPropagation();eliminarOrdenPermanente(${o.id})" title="Eliminar permanentemente">🗑️</button>` : ''}</td>
  </tr>`;
}

function renderTablaOrdenes(data, etapas) {
  const lista = document.getElementById('lista-ordenes');
  if (!lista) return;
  if (!data.length) {
    lista.innerHTML = `<div class="empty-state"><div class="empty-state-icon">${ico('clipboard',32)}</div>No hay órdenes.</div>`;
    return;
  }
  const rows = data.map(o => _buildOrdenRow(o, etapas)).join('');
  renderSinParpadeo(lista, `<div class="ordenes-tabla-wrap"><table class="ordenes-tabla">
    <thead><tr>
      <th>Orden</th><th>Vehículo</th><th>Etapa actual</th>
      <th>Responsable</th><th>Entrega est.</th><th>Días</th><th>Estado</th>
    </tr></thead>
    <tbody>${rows}</tbody>
  </table></div>`);
  // Destellar las órdenes nuevas desde el último refresco (por pestaña)
  if (typeof destellarNuevos === 'function') {
    destellarNuevos('ordenes-' + (typeof filtroEstado !== 'undefined' ? filtroEstado : ''), lista, 'tr.ord-row');
  }
}

function filtrarTablaOrdenes(q) {
  const tbody = document.querySelector('#lista-ordenes .ordenes-tabla tbody');
  if (!tbody) return;
  const term = q.toLowerCase().trim();
  tbody.querySelectorAll('tr.ord-row').forEach(tr => {
    tr.style.display = (!term || (tr.dataset.search||'').includes(term)) ? '' : 'none';
  });
}

async function cargarOrdenesPulmon() {
  const lista = document.getElementById('lista-ordenes');
  if (!lista) return;
  lista.innerHTML = '<div class="loading-state">Cargando órdenes...</div>';
  try {
    const data = await api(`/ordenes?pulmon=eq.true&order=pulmon_desde.asc&limit=100`);
    if (!data?.length) {
      lista.innerHTML = `<div class="empty-state"><div class="empty-state-icon"></div>No hay órdenes en pulmón.</div>`;
      return;
    }
    const ids = data.map(o => o.id).join(',');
    const etapas = await api(`/etapas?orden_id=in.(${ids})&select=orden_id,servicio,inicio,fin,tecnico`).catch(() => []) || [];
    _ordenesTablaData = data;
    _etapasTablaData  = etapas;

    const rows = data.map(o => {
      const etapasO   = etapas.filter(e => e.orden_id === o.id);
      const total     = etapasO.length;
      const comp      = etapasO.filter(e => e.fin).length;
      const pct       = total ? Math.round((comp / total) * 100) : 0;
      const activa    = etapasO.find(e => e.inicio && !e.fin);
      const srvNombre = activa ? (CATALOGO[activa.servicio]?.nombre || activa.servicio) : (comp===total&&total>0?'Completada':null);
      const tecnico   = activa?.tecnico || '';
      const diasPulmon = o.pulmon_desde ? Math.floor((Date.now() - new Date(o.pulmon_desde)) / 86400000) : null;
      const diasTaller = o.creado_en ? Math.floor((Date.now() - new Date(o.creado_en)) / 86400000) : 0;
      const searchStr  = [(o.placa||''), (o.propietario||''), (tecnico||''), (o.marca||''), (o.linea||'')].join(' ').toLowerCase();
      return `<tr class="ord-row" onclick="abrirOrden(${o.id})" data-search="${escapeHtml(searchStr)}">
        <td>
          <div class="ord-placa">${escapeHtml(o.placa)}</div>
          <div class="ord-ot">${otDe(o)}</div>
        </td>
        <td>
          <div class="ord-veh-nombre">${[o.marca,o.linea].filter(Boolean).map(escapeHtml).join(' ') || '—'}</div>
          <div class="ord-veh-cliente">${escapeHtml(o.propietario || '—')}${o.modelo ? ` · ${escapeHtml(o.modelo)}` : ''}</div>
        </td>
        <td>
          ${total > 0 ? `
            <div class="ord-etapa-nombre">${escapeHtml(srvNombre || '—')}</div>
            <div class="ord-prog-wrap">
              <div class="ord-prog-track"><div class="ord-prog-fill" style="width:${pct}%"></div></div>
              <span class="ord-prog-lbl">${comp}/${total}</span>
            </div>` : `<span class="ord-sin-etapas">En pulmón</span>`}
        </td>
        <td class="ord-resp">${escapeHtml(tecnico) || '<span style="color:var(--gris-mid)">—</span>'}</td>
        <td class="ord-fecha-ent">${diasPulmon !== null ? `${diasPulmon}d en pulmón` : '—'}</td>
        <td class="ord-dias">${diasTaller}d</td>
        <td><span class="ord-pill pill-pulmon">En pulmón</span></td>
      </tr>`;
    }).join('');

    lista.innerHTML = `<div class="ordenes-tabla-wrap"><table class="ordenes-tabla">
      <thead><tr>
        <th>Orden</th><th>Vehículo</th><th>Etapa actual</th>
        <th>Responsable</th><th>Tiempo pulmón</th><th>Días</th><th>Estado</th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table></div>`;
  } catch(e) { lista.innerHTML = `<div class="empty-state">Error cargando órdenes: ${e.message}</div>`; }
}

// DRAG & DROP
let dragSrcId = null;

function dragStart(e, id) {
  dragSrcId = id;
  e.currentTarget.classList.add('dragging');
  e.dataTransfer.effectAllowed = 'move';
}

function dragOver(e) {
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
  e.currentTarget.classList.add('drag-over');
}

function dragLeave(e) {
  e.currentTarget.classList.remove('drag-over');
}

function dragDrop(e, targetId) {
  e.preventDefault();
  e.currentTarget.classList.remove('drag-over');
  if (dragSrcId === targetId) return;
  const src = document.getElementById('card-' + dragSrcId);
  const tgt = document.getElementById('card-' + targetId);
  if (!src || !tgt) return;
  const srcRect = src.getBoundingClientRect();
  const tgtRect = tgt.getBoundingClientRect();
  if (srcRect.top < tgtRect.top) {
    tgt.parentNode.insertBefore(src, tgt.nextSibling);
  } else {
    tgt.parentNode.insertBefore(src, tgt);
  }
}

function dragEnd(e) {
  e.currentTarget.classList.remove('dragging');
  document.querySelectorAll('.orden-card').forEach(c => c.classList.remove('drag-over'));
  dragSrcId = null;
}

// ============================================================
// DETALLE DE ORDEN
// ============================================================
function volverALista() {
  if (esJefe()) navJefe('ordenes');
}

async function abrirOrden(id) {
  mostrarPagina('pag-detalle');
  document.getElementById('topbar-title').textContent = 'Detalle de Orden';
  const detalleCont = document.getElementById('detalle-contenido');
  if (!detalleCont) return;

  // Guardar qué etapas están abiertas y qué inputs tienen foco
  // para no interrumpir al usuario si ya estaba viendo el detalle
  const etapasAbiertas = new Set(
    [...document.querySelectorAll('.etapa-body.open')].map(el => el.id)
  );
  const focusedId = document.activeElement?.id || null;

  detalleCont.innerHTML = '<div class="loading-state">Cargando...</div>';

  try {
    const [orden, etapas, fotosEt, fotosIng, novedades, aprobaciones] = await Promise.all([
      api(`/ordenes?id=eq.${id}`).then(d => d[0]),
      api(`/etapas?orden_id=eq.${id}&order=creado_en.asc`).catch(() => []) || [],
      api(`/fotos_etapas?orden_id=eq.${id}&order=creado_en.desc`).catch(() => []) || [],
      api(`/fotos_ingreso?orden_id=eq.${id}&order=creado_en.asc`).catch(() => []) || [],
      api(`/novedades?orden_id=eq.${id}&order=creado_en.desc`).catch(() => []) || [],
      api(`/aprobaciones_etapa?orden_id=eq.${id}&order=creado_en.asc`).catch(() => []) || []
    ]);
    ordenActual = orden;

    const total = etapas.length;
    // Calidad: verificar si todas las etapas completadas tienen aprobación
    const _ultAprobPorEtapa = {};
    aprobaciones.forEach(a => { _ultAprobPorEtapa[a.etapa_id] = a.estado; }); // última aprobación por etapa
    // Una etapa cuenta como completada solo si tiene fin Y su última aprobación no es 'rechazado'
    const comp = etapas.filter(e => e.fin && _ultAprobPorEtapa[e.id] !== 'rechazado').length;
    const pct = total ? Math.round((comp / total) * 100) : 0;
    const todasCalidadAprobada = total > 0 && comp === total &&
      etapas.every(e => _ultAprobPorEtapa[e.id] === 'aprobado');
    const circ = 2 * Math.PI * 22;

    // Inventario
    let invHtml = '—';
    try {
      const inv = orden.inventario ? JSON.parse(orden.inventario) : null;
      if (inv?.items) {
        const activos = Object.entries(inv.items).filter(([,v])=>v).map(([k])=>INV_LABELS[k]||k);
        invHtml = activos.length
          ? activos.map(a=>`<span class="badge" style="background:var(--verde-bg);color:var(--verde);margin:2px">${a}</span>`).join('')
          : '<span style="color:var(--gris-mid)">Sin ítems</span>';
      }
    } catch(e) {}

    // Fotos
    const todasFotos = [...fotosEt, ...fotosIng];
    const fotosRecHtml = todasFotos.length
      ? todasFotos.map(f=>`<div class="foto-thumb" data-url="${escapeHtml(f.url)}" onclick="abrirLightbox(this.dataset.url)"><img src="${escapeHtml(f.url)}" alt="" loading="lazy"></div>`).join('')
      : '<span style="font-size:12px;color:var(--gris-mid)">Sin fotos.</span>';

    // Timeline
    const tlHtml = etapas.length ? etapas.map((e,i) => {
      const done = !!e.fin;
      const active = !!e.inicio && !e.fin;
      const cls = done ? 'done' : active ? 'active' : 'pending';
      const icon = done ? '✓' : active ? '●' : (i+1);
      return `<div class="timeline-step ${done?'done':''}">
        <div class="timeline-dot ${cls}">${icon}</div>
        <div class="timeline-label ${cls}">${escapeHtml(e.etapa)||'—'}</div>
      </div>`;
    }).join('') : '<span style="font-size:12px;color:var(--gris-mid)">Sin etapas.</span>';

    const estadoClase = orden.pulmon ? 'pulmon' : (orden.estado||'activa').toLowerCase();
    const estadoTexto = orden.pulmon ? 'En Pulmón' : (orden.estado||'Activa');

    const primera = etapas.find(e=>e.inicio);
    const activa = etapas.find(e=>e.inicio&&!e.fin);
    const ahora = new Date();
    const tiempoEtapa = activa ? durHumana(ahora - new Date(activa.inicio)) : (comp===total&&total>0?'Completada':'Sin iniciar');
    const tiempoTotal = primera ? durHumana(ahora - new Date(primera.inicio)) : '—';

    // Servicios
    const porServicio = {};
    etapas.forEach(e=>{ const s=e.servicio||'sin_servicio'; if(!porServicio[s])porServicio[s]=[]; porServicio[s].push(e); });
    const hayActiva = etapas.some(x=>x.inicio&&!x.fin);
    // Orden de servicios persistido en localStorage
    const ordenSrvKey = 'srv_orden_' + id;
    let ordenSrv = [];
    try { ordenSrv = JSON.parse(localStorage.getItem(ordenSrvKey) || '[]'); } catch(ee) {}
    const srvKeys = Object.keys(porServicio);
    const srvKeysSorted = ordenSrv.length
      ? [...ordenSrv.filter(k => srvKeys.includes(k)), ...srvKeys.filter(k => !ordenSrv.includes(k))]
      : srvKeys;

    const serviciosHtml = srvKeysSorted.length
      ? '<div id="srv-drag-container">' +
        srvKeysSorted.map((srvKey) => {
          const ets = porServicio[srvKey];
          const srv = CATALOGO[srvKey];
          const srvNombre = srv ? srv.nombre : srvKey;
          const srvClase  = srv ? srv.clase : 'latoneria';
          const compS = ets.filter(e => e.fin).length;
          const etapaOrdenKey = 'etapa_orden_' + id + '_' + srvKey;
          let etapaOrden = [];
          try { etapaOrden = JSON.parse(localStorage.getItem(etapaOrdenKey) || '[]'); } catch(ee) {}
          const etsSorted = etapaOrden.length
            ? [...etapaOrden.map(eid2 => ets.find(e => e.id === eid2)).filter(Boolean),
               ...ets.filter(e => !etapaOrden.includes(e.id))]
            : ets;
          const etapsHtml = '<div class="etapas-drag-container" id="edc-' + srvKey + '">' +
            etsSorted.map(e => {
              const eHtml = renderEtapa(e, fotosEt, novedades, hayActiva, aprobaciones);
              return eHtml.replace(
                '<div class="etapa-card">',
                '<div class="etapa-card" draggable="true" data-eid="' + e.id + '" ' +
                  'ondragstart="etapaDragStart(event,' + e.id + ',\'' + srvKey + '\')" ' +
                  'ondragover="etapaDragOver(event)" ' +
                  'ondragleave="etapaDragLeave(event)" ' +
                  'ondrop="etapaDragDrop(event,' + e.id + ',\'' + srvKey + '\',' + id + ')" ' +
                  'ondragend="etapaDragEnd(event)">'
              );
            }).join('') + '</div>';
          return '<div class="srv-panel" draggable="true" data-srv="' + srvKey + '" ' +
            'ondragstart="srvDragStart(event,\'' + srvKey + '\')" ' +
            'ondragover="srvDragOver(event)" ' +
            'ondragleave="srvDragLeave(event)" ' +
            'ondrop="srvDragDrop(event,\'' + srvKey + '\',' + id + ')" ' +
            'ondragend="srvDragEnd(event)">' +
            '<div class="srv-panel-header ' + srvClase + '">' +
              '<span class="srv-drag-handle" onclick="event.stopPropagation()" title="Arrastrar servicio">⠮⠮</span>' +
              '<span class="srv-panel-titulo ' + srvClase + '" onclick="togglePanel(\'sp-' + srvKey + '\')" style="cursor:pointer;flex:1">' + srvNombre + '</span>' +
              '<span style="font-size:11px;font-family:\'DM Mono\',monospace;opacity:0.7;cursor:pointer" onclick="togglePanel(\'sp-' + srvKey + '\')"> ' + compS + '/' + ets.length + ' ▾</span>' +
            '</div>' +
            '<div class="srv-panel-body open" id="sp-' + srvKey + '">' + etapsHtml + '</div>' +
          '</div>';
        }).join('') + '</div>'
      : '<div class="empty-state">' +
          `<div class="empty-state-icon">${ico('wrench', 32)}</div>` +
          '<p>No hay etapas registradas aún.</p>' +
          '<button class="btn btn-primary" style="margin-top:14px" onclick="abrirModalAgregar()">+ Asignar servicios y etapas</button>' +
        '</div>';


    detalleCont.innerHTML = `
      <div class="detalle-grid">
        <div>
          <div class="detalle-header-card">
            <!-- Fila placa + badges -->
            <div class="detalle-placa-row">
              <div>
                <div style="display:flex;align-items:baseline;gap:8px;flex-wrap:wrap">
                  <div class="detalle-placa">${escapeHtml(orden.placa)}</div>
                  <div style="font-family:'DM Mono',monospace;font-size:12px;font-weight:600;color:var(--gris-mid);letter-spacing:.5px">${otDe(orden)}</div>
                </div>
                <div class="detalle-vehiculo">${[orden.marca,orden.linea,orden.modelo,orden.color].filter(Boolean).map(escapeHtml).join(' · ')}</div>
              </div>
              <div style="display:flex;flex-wrap:wrap;align-items:center;gap:5px;justify-content:flex-end">
                <span class="badge badge-${estadoClase}">${estadoTexto}</span>
                ${orden.tipo_cliente ? `<span class="badge badge-${orden.tipo_cliente}">${orden.tipo_cliente}</span>` : ''}
              </div>
            </div>
            <!-- Strip de progreso compacto -->
            <div class="det-progress-strip">
              <div class="det-ps-cell det-ps-progress">
                <div style="display:flex;align-items:center;justify-content:space-between">
                  <div class="det-ps-label">Progreso general</div>
                  <div style="font-family:'DM Mono',monospace;font-size:12px;font-weight:800;color:${pct===100?'var(--verde)':'var(--azul-mid)'};background:${pct===100?'var(--verde-bg)':'var(--azul-light)'};padding:1px 7px;border-radius:20px">${pct}%</div>
                </div>
                <div class="det-pbar-track">
                  <div class="det-pbar-fill ${pct===100?'completa':''}" style="width:${pct===0?'0':pct+'%'}"></div>
                </div>
                <div class="det-ps-val">${comp} / ${total} etapas</div>
              </div>
              <div class="det-ps-divider"></div>
              <div class="det-ps-cell">
                <div class="det-ps-label">Etapa activa</div>
                <div class="det-ps-val">${tiempoEtapa}</div>
              </div>
              <div class="det-ps-divider"></div>
              <div class="det-ps-cell">
                <div class="det-ps-label">Tiempo total</div>
                <div class="det-ps-val">${tiempoTotal}</div>
              </div>
            </div>
            <!-- Timeline de etapas -->
            ${tlHtml ? `<div class="timeline-wrap" style="padding:10px 0 2px"><div class="etapas-timeline" id="d-timeline">${tlHtml}</div></div>` : ''}
          </div>
          ${(() => {
            const faltantes = [];
            if (!orden.propietario)    faltantes.push('Nombre del cliente');
            if (!orden.telefono)       faltantes.push('Teléfono');
            if (!orden.correo_cliente) faltantes.push('Correo');
            if (!orden.cedula_cliente) faltantes.push('Cédula / NIT');
            if (!orden.marca)          faltantes.push('Marca');
            if (!orden.linea)          faltantes.push('Línea');
            if (!faltantes.length) return '';
            return `<div class="det-datos-faltantes-banner">
              <svg width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24" style="flex-shrink:0"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
              <div>
                <strong>Faltan datos por completar</strong>
                <div class="det-datos-faltantes-list">${faltantes.join(' · ')}</div>
              </div>
              ${esJefe() && orden.estado !== 'Entregada' ? `<button class="btn btn-sm" style="margin-left:auto;flex-shrink:0;background:#FEF3C7;color:#B45309;border:1px solid #FDE68A" onclick="abrirEditarOrden(${orden.id})">Completar datos</button>` : ''}
            </div>`;
          })()}
          <div class="det-datos-header">
            <div class="seccion-titulo" style="margin-bottom:0">Datos del vehículo y cliente</div>
            <button class="btn btn-ghost btn-sm" style="color:var(--azul)" onclick="verHistorialVehiculo('${escapeHtml(orden.placa)}')" title="Ver visitas anteriores de este vehículo">
              <svg width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
              Historial
            </button>
            ${esJefe() && orden.estado !== 'Entregada' ? `<button class="btn btn-ghost btn-sm" onclick="abrirEditarOrden(${orden.id})">
              <svg width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
              Editar datos
            </button>` : ''}
            ${esJefe() && orden.estado !== 'Archivada' ? `<button class="btn btn-ghost btn-sm" style="color:#DC2626" onclick="archivarOrden(${orden.id})" title="Archivar orden (con PIN)">
              <svg width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="4" rx="1"/><path d="M5 7v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7"/><line x1="10" y1="12" x2="14" y2="12"/></svg>
              Archivar
            </button>` : ''}
          </div>
          <div class="det-datos-grid">
            <!-- Vehículo -->
            <div class="det-datos-card">
              <div class="det-datos-card-titulo">
                <svg width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><rect x="1" y="3" width="15" height="13" rx="2"/><path d="M16 8h4l3 3v5h-7V8z"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>
                Vehículo
              </div>
              <div class="det-datos-filas">
                <div class="det-dato-fila"><span class="det-dato-lbl">Marca</span><span class="det-dato-val${!orden.marca?' det-dato-vacio':''}">${escapeHtml(orden.marca)||'—'}</span></div>
                <div class="det-dato-fila"><span class="det-dato-lbl">Línea</span><span class="det-dato-val${!orden.linea?' det-dato-vacio':''}">${escapeHtml(orden.linea)||'—'}</span></div>
                <div class="det-dato-fila"><span class="det-dato-lbl">Año</span><span class="det-dato-val">${escapeHtml(orden.modelo||'')||'—'}</span></div>
                <div class="det-dato-fila"><span class="det-dato-lbl">Color</span><span class="det-dato-val">${escapeHtml(orden.color||'')||'—'}</span></div>
                <div class="det-dato-fila"><span class="det-dato-lbl">Kilometraje</span><span class="det-dato-val">${orden.kilometraje?orden.kilometraje.toLocaleString('es-CO')+' km':'—'}</span></div>
                <div class="det-dato-fila"><span class="det-dato-lbl">VIN</span><span class="det-dato-val" style="font-family:'DM Mono',monospace;font-size:11px">${escapeHtml(orden.vin||'')||'—'}</span></div>
                <div class="det-dato-fila"><span class="det-dato-lbl">Ingreso</span><span class="det-dato-val">${formatFecha(orden.creado_en)}</span></div>
                <div class="det-dato-fila"><span class="det-dato-lbl">Entrega 1</span><span class="det-dato-val">${formatFecha(orden.fecha_entrega_1)||'—'}</span></div>
                ${orden.fecha_entrega_2 ? `<div class="det-dato-fila"><span class="det-dato-lbl">Entrega 2</span><span class="det-dato-val">${formatFecha(orden.fecha_entrega_2)}</span></div>` : ''}
              </div>
            </div>
            <!-- Cliente -->
            <div class="det-datos-card">
              <div class="det-datos-card-titulo">
                <svg width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                Cliente
              </div>
              <div class="det-datos-filas">
                <div class="det-dato-fila"><span class="det-dato-lbl">Nombre</span><span class="det-dato-val${!orden.propietario?' det-dato-vacio':''}">${escapeHtml(orden.propietario||'')||'—'}</span></div>
                <div class="det-dato-fila"><span class="det-dato-lbl">Teléfono</span><span class="det-dato-val${!orden.telefono?' det-dato-vacio':''}">${orden.telefono?`<a href="tel:${escapeHtml(orden.telefono)}" style="color:var(--azul-mid)">${escapeHtml(orden.telefono)}</a>`:'—'}</span></div>
                <div class="det-dato-fila"><span class="det-dato-lbl">Correo</span><span class="det-dato-val${!orden.correo_cliente?' det-dato-vacio':''}">${orden.correo_cliente?`<a href="mailto:${escapeHtml(orden.correo_cliente)}" style="color:var(--azul-mid)">${escapeHtml(orden.correo_cliente)}</a>`:'—'}</span></div>
                <div class="det-dato-fila"><span class="det-dato-lbl">Cédula / NIT</span><span class="det-dato-val${!orden.cedula_cliente?' det-dato-vacio':''}" style="font-family:'DM Mono',monospace;font-size:12px">${escapeHtml(orden.cedula_cliente||'')||'—'}</span></div>
                <div class="det-dato-fila"><span class="det-dato-lbl">Tipo cliente</span><span class="det-dato-val">${escapeHtml(orden.tipo_cliente||'')||'—'}</span></div>
                <div class="det-dato-fila"><span class="det-dato-lbl">${orden.tipo_cliente==='flotilla'?'Flotilla':orden.tipo_cliente==='empresa'?'Empresa':'Aseguradora'}</span><span class="det-dato-val">${escapeHtml(orden.aseguradora||'')||'—'}</span></div>
              </div>
            </div>
          </div>
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">
            <div class="seccion-titulo" style="margin-bottom:0">Servicios y Etapas</div>
            ${esJefe() && !todasCalidadAprobada && orden.estado !== 'Programada' ? '<button class="btn btn-ghost btn-sm" onclick="abrirModalAgregar()">+ Agregar etapas</button>' : ''}
          </div>
          ${orden.estado === 'Programada'
            ? `<div style="display:flex;flex-direction:column;align-items:center;gap:10px;padding:28px 20px;background:#F8FAFC;border:1.5px dashed #CBD5E1;border-radius:10px;text-align:center;margin-bottom:12px">
                 <svg width="32" height="32" fill="none" stroke="#94A3B8" stroke-width="1.5" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/><circle cx="12" cy="16" r="1"/></svg>
                 <div style="font-size:13px;font-weight:600;color:#64748B">Vehículo aún no ha ingresado</div>
                 <div style="font-size:12px;color:#94A3B8">Las etapas de trabajo estarán disponibles cuando el vehículo llegue al taller y el jefe confirme su ingreso.</div>
               </div>`
            : serviciosHtml}
        </div>
        <div class="detalle-sidebar">
          <div class="sidebar-card">
            <div class="sidebar-card-header" style="background:var(--azul-light);color:var(--azul)">Valor total de la orden</div>
            <div class="sidebar-card-body">
              ${(() => {
                const totalEtapas = etapas.reduce((s,e) => s + (e.valor||0), 0);
                if (!totalEtapas) return '<div style="font-size:13px;color:var(--gris-mid)">Sin valores en etapas.</div>';
                const fmt = n => new Intl.NumberFormat('es-CO',{style:'currency',currency:'COP',minimumFractionDigits:0}).format(n);
                const filas = etapas.filter(e=>e.valor).map(e =>
                  '<div style="display:flex;justify-content:space-between;font-size:12px;padding:4px 0;border-bottom:1px solid var(--gris-borde)"><span style="color:var(--gris-mid)">' + escapeHtml(e.etapa||'') + '</span><span style="font-weight:600">' + fmt(e.valor) + '</span></div>'
                ).join('');
                return filas + '<div style="display:flex;justify-content:space-between;margin-top:10px;padding-top:8px;border-top:2px solid var(--azul-mid)"><span style="font-size:13px;font-weight:700;color:var(--azul)">Total</span><span style="font-size:15px;font-weight:700;color:var(--azul)">' + fmt(totalEtapas) + '</span></div>';
              })()}
            </div>
          </div>
          <div class="sidebar-card">
            <div class="sidebar-card-header">Fotos recientes</div>
            <div class="sidebar-card-body">
              <div class="fotos-grid">${fotosRecHtml}</div>
            </div>
          </div>
          <div class="sidebar-card">
            <div class="sidebar-card-header">Inventario</div>
            <div class="sidebar-card-body">
              <div>${invHtml}</div>
            </div>
          </div>
          ${orden.placa ? `
          <div class="sidebar-card" id="consumibles-sidebar-card">
            <div class="sidebar-card-header" style="display:flex;align-items:center;justify-content:space-between">
              <span>🔧 Consumibles</span>
              <button class="btn btn-ghost btn-xs" onclick="abrirPopupConsumibles('${escapeHtml(orden.placa)}',${orden.kilometraje||0})">Ver todo</button>
            </div>
            <div class="sidebar-card-body" id="consumibles-sidebar-body">
              <div style="font-size:12px;color:var(--gris-mid)">Cargando...</div>
            </div>
          </div>` : ''}
          <div id="pulmon-card" class="pulmon-card ${orden.pulmon?'':'inactivo'}">
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
              <div style="font-size:12px;font-weight:700;font-family:'DM Mono',monospace;letter-spacing:1px;text-transform:uppercase;color:${orden.pulmon?'var(--amarillo)':'var(--gris-mid)'}">Pulmón</div>
              ${orden.estado !== 'Entregada' && orden.estado !== 'Archivada' ? `
              <button class="btn btn-sm btn-ghost" id="btn-pulmon" onclick="togglePulmon()">
                ${orden.pulmon ? 'Sacar de pulmón' : 'Activar Pulmón'}
              </button>` : `<span id="btn-pulmon" style="font-size:11px;color:var(--gris-mid)">Orden cerrada</span>`}
            </div>
            <div id="d-pulmon-badge" style="font-size:13px;color:${orden.pulmon?'var(--amarillo)':'var(--gris-mid)'}">
              ${orden.pulmon
                ? `En pulmón${orden.pulmon_tipo ? ` · <strong>${orden.pulmon_tipo.charAt(0).toUpperCase()+orden.pulmon_tipo.slice(1)}</strong>` : ''} desde ${formatFecha(orden.pulmon_desde)}`
                : (orden.pulmon_fin && orden.pulmon_desde)
                  ? `<span style="color:var(--verde,#10B981)">✓ Salió de pulmón</span> · estuvo <strong>${_calcPulmonTiempo(orden.pulmon_desde, orden.pulmon_fin)}</strong>${orden.pulmon_tipo ? ` (${orden.pulmon_tipo})` : ''}`
                  : 'Sin pulmón activo'}
            </div>
          </div>
          ${orden.tipo_cliente === 'aseguradora' ? `
          <div class="sidebar-card" id="datos-aseg-card-${orden.id}">
            <div class="sidebar-card-header" style="background:#EDE9FE;color:#5B21B6;display:flex;align-items:center;gap:6px">
              <svg width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
              Datos Aseguradora
            </div>
            <div class="sidebar-card-body">
              ${typeof renderDatosAseguradora === 'function' ? renderDatosAseguradora(orden) : ''}
            </div>
          </div>` : ''}
          ${orden.aseguradora ? `
          <div class="sidebar-card">
            <div class="sidebar-card-header" style="background:#F5F3FF;color:#6D28D9;display:flex;align-items:center;gap:6px">
              <svg width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
              Seguimiento Aseguradora
            </div>
            <div class="sidebar-card-body">
              ${typeof renderSeccionAseguradora === 'function' ? renderSeccionAseguradora(orden) : ''}
            </div>
          </div>` : ''}
          ${esJefe() ? `
          <div class="sidebar-card">
            <div class="sidebar-card-header">Estado de la orden</div>
            <div class="sidebar-card-body">
              ${orden.estado === 'Programada'
                ? `<div style="display:flex;flex-direction:column;gap:10px">
                     <div style="display:inline-flex;align-items:center;gap:8px;padding:8px 14px;background:#F1F5F9;border-radius:20px">
                       <span style="width:8px;height:8px;border-radius:50%;background:#6366F1;display:inline-block"></span>
                       <span style="font-size:13px;font-weight:700;color:#4338CA">Programada</span>
                     </div>
                     ${orden.fecha_programada ? `<div style="font-size:12px;color:var(--gris-mid);text-align:center">📅 Fecha esperada: <strong>${formatFecha(orden.fecha_programada)}</strong></div>` : ''}
                     <button class="btn btn-primary" style="width:100%;background:#059669;border-color:#059669" onclick="recibirVehiculo(${orden.id})">
                       <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
                       Vehículo llegó — Activar orden
                     </button>
                   </div>`
                : orden.estado === 'Entregada' || orden.estado === 'Archivada'
                ? `<div style="display:flex;flex-direction:column;gap:8px">
                     <div style="display:inline-flex;align-items:center;gap:8px;padding:8px 14px;background:var(--azul-light);border-radius:20px">
                       <span style="width:8px;height:8px;border-radius:50%;background:var(--azul-mid);display:inline-block"></span>
                       <span style="font-size:13px;font-weight:700;color:var(--azul)">${orden.estado === 'Entregada' ? 'Finalizada' : 'Archivada'}</span>
                     </div>
                     <div style="display:flex;gap:6px;width:100%">
                       <button class="btn btn-ghost btn-sm" style="flex:1" onclick="generarPreliquidacion(${orden.id},false)">📋 Sin precios</button>
                       <button class="btn btn-ghost btn-sm" style="flex:1" onclick="generarPreliquidacion(${orden.id},true)">💰 Con precios</button>
                     </div>
                   </div>`
                : todasCalidadAprobada
                ? `${_bloqueEntrega(orden)}${_bloquePreliqCierre(orden)}`
                : `<div style="display:flex;flex-direction:column;gap:8px">
                     ${comp === total && total > 0
                       ? `<div style="background:#FEF3C7;border:1px solid #FDE68A;border-radius:8px;padding:10px 12px;font-size:12px;color:#92400E;font-weight:600;text-align:center">
                            ⏳ Esperando aprobación de calidad para poder finalizar
                          </div>`
                       : `<div style="display:inline-flex;align-items:center;gap:8px;padding:8px 14px;background:var(--azul-light);border-radius:20px">
                            <span style="width:8px;height:8px;border-radius:50%;background:var(--azul-mid);display:inline-block"></span>
                            <span style="font-size:13px;font-weight:700;color:var(--azul)">Activa</span>
                          </div>`
                     }
                     <div style="display:flex;gap:6px;width:100%">
                       <button class="btn btn-ghost btn-sm" style="flex:1" onclick="generarPreliquidacion(${orden.id},false)">📋 Sin precios</button>
                       <button class="btn btn-ghost btn-sm" style="flex:1" onclick="generarPreliquidacion(${orden.id},true)">💰 Con precios</button>
                     </div>
                   </div>`
              }
            </div>
          </div>` : ''}
        </div>
      </div>`;

    // Restaurar etapas que estaban abiertas antes del re-render
    if (etapasAbiertas.size) {
      etapasAbiertas.forEach(bodyId => {
        const el = document.getElementById(bodyId);
        if (el) el.classList.add('open');
      });
    }

    // Cargar mini-panel consumibles en sidebar
    if (orden.placa && typeof _cargarConsumiblesSidebar === 'function') {
      _cargarConsumiblesSidebar(orden.placa, orden.kilometraje || 0);
    }

  } catch(e) {
    detalleCont.innerHTML = `<div class="empty-state">Error: ${e.message}</div>`;
  }
}

function renderEtapa(e, fotos, novedades, hayActiva, aprobaciones = []) {
  const eid = e.id;
  const k = kid(eid);
  const nombre = e.etapa || '—';
  const esPausado = e.pausado && !e.fin;
  const ultAprobEtapa = aprobaciones.filter(a => a.etapa_id === eid).slice(-1)[0];
  const esReproceso   = e.fin && ultAprobEtapa?.estado === 'rechazado';
  const badge = !e.inicio ? 'Pendiente' : (e.fin ? (esReproceso ? 'Reproceso' : 'Completada') : esPausado ? 'Pausado' : 'En proceso');
  const bCls  = !e.inicio ? 'pendiente'  : (e.fin ? (esReproceso ? 'pendiente' : 'completada') : esPausado ? 'pendiente' : 'iniciada');
  const eFotos = fotos.filter(f => f.etapa_id === eid);
  const eNovs = novedades.filter(n => n.etapa_id === eid);
  const aprobEtapa = aprobaciones.filter(a => a.etapa_id === eid);
  const ultimaAprob = aprobEtapa.length ? aprobEtapa[aprobEtapa.length - 1] : null;

  // ── Cálculo de duración descontando tiempo pausado ──
  let dur = '';
  if (e.inicio) {
    const finRef = e.fin ? new Date(e.fin) : new Date();
    const totalMs = finRef - new Date(e.inicio);
    let pausadoAcum = e.tiempo_pausado_min || 0;
    // Si está actualmente pausada, añadir la pausa en curso
    if (esPausado && e.pausa_inicio) {
      pausadoAcum += Math.max(0, Math.round((Date.now() - new Date(e.pausa_inicio).getTime()) / 60000));
    }
    const m = Math.max(0, Math.round(totalMs / 60000) - pausadoAcum);
    const durStr = `${Math.floor(m/60)}h ${m%60}m`;
    const pausaStr = pausadoAcum > 0
      ? ` <span style="font-size:10px;color:var(--gris-mid)">(⏸ ${pausadoAcum}m en espera de repuesto)</span>`
      : '';
    if (e.fin) {
      dur = `<div class="ts-chip">Duración: <strong>${durStr}</strong>${pausaStr}</div>`;
    } else if (esPausado) {
      dur = `<div class="ts-chip" style="color:#D97706;font-weight:600">⏸ Pausado · tiempo trabajado: <strong>${durStr}</strong>${pausaStr}</div>`;
    }
  }

  const fueRechazada = ultimaAprob?.estado === 'rechazado';

  let acc = '';
  if (!e.inicio)
    acc = `<button class="btn btn-success btn-sm" data-eid="${eid}" data-nombre="${escapeHtml(nombre)}" onclick="iniciarEtapa(+this.dataset.eid,this.dataset.nombre)">▶ Iniciar</button>`;
  else if (e.inicio && !e.fin && esPausado)
    acc = `<span style="font-size:12px;color:#D97706;font-weight:600;display:flex;align-items:center;gap:5px">
      <svg width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
      Esperando repuesto...
    </span>`;
  else if (e.inicio && !e.fin) {
    // Si fue reabierta por rechazo, mostrar aviso
    const avisoRechazo = fueRechazada
      ? `<div style="background:#FEE2E2;border:1px solid #FECACA;border-radius:6px;padding:6px 10px;font-size:12px;color:#DC2626;font-weight:600;margin-bottom:6px;display:flex;align-items:center;gap:5px">
          <svg width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          Etapa rechazada — corrígela y finaliza de nuevo
          ${ultimaAprob?.observacion ? `<span style="font-weight:400;color:#B91C1C;display:block;margin-top:3px">"${escapeHtml(ultimaAprob.observacion)}"</span>` : ''}
        </div>` : '';
    acc = avisoRechazo + `<button class="btn btn-danger btn-sm" data-eid="${eid}" data-nombre="${escapeHtml(nombre)}" data-srv="${escapeHtml(e.servicio||'')}" onclick="finalizarEtapa(+this.dataset.eid,this.dataset.nombre,this.dataset.srv)">${fueRechazada ? '■ Reenviar a calidad' : '■ Finalizar'}</button>`;
  } else if (e.fin) {
    const esRechazada = fueRechazada;
    const aprobBtn = esRechazada
      ? `<div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center">
          <button class="btn btn-sm" style="background:#FEF3C7;color:#D97706;border:1px solid #FCD34D" data-eid="${eid}" onclick="reabrirEtapa(+this.dataset.eid)">↩ Reabrir para corrección</button>
          <button class="btn btn-ghost btn-sm" data-eid="${eid}" data-nombre="${escapeHtml(nombre)}" onclick="abrirModalAprobacion(+this.dataset.eid,this.dataset.nombre)">↻ Revisar calidad</button>
        </div>`
      : ultimaAprob?.estado === 'aprobado'
        ? `<button class="btn btn-ghost btn-sm" data-eid="${eid}" data-nombre="${escapeHtml(nombre)}" onclick="abrirModalAprobacion(+this.dataset.eid,this.dataset.nombre)">↻ Revisar calidad</button>`
        : `<button class="btn btn-primary btn-sm" data-eid="${eid}" data-nombre="${escapeHtml(nombre)}" onclick="abrirModalAprobacion(+this.dataset.eid,this.dataset.nombre)">✓ Aprobar calidad</button>`;
    acc = aprobBtn;
  } else {
    acc = `<span style="font-size:12px;color:var(--gris-mid);font-style:italic">Esperando turno</span>`;
  }

  const fotosHtml = eFotos.map(f => `
    <div class="foto-thumb" data-url="${escapeHtml(f.url)}" onclick="abrirLightbox(this.dataset.url)">
      <img src="${escapeHtml(f.url)}" alt="">
      <button class="foto-delete" data-fid="${f.id}" data-url="${escapeHtml(f.url)}" onclick="event.stopPropagation();eliminarFoto(+this.dataset.fid,this.dataset.url)">✕</button>
    </div>`).join('');

  const novsHtml = eNovs.length ? eNovs.map(n => `
    <div class="novedad-item">
      <div class="novedad-item-top">
        <span class="novedad-tipo ${escapeHtml((n.tipo||'').toLowerCase())}">${escapeHtml(n.tipo)}</span>
        <span class="novedad-fecha">${formatTS(n.creado_en)}</span>
      </div>
      <div class="novedad-motivo">${escapeHtml(n.motivo)||'—'}</div>
      <div class="novedad-resp">Resp: ${escapeHtml(n.responsable)||'—'}</div>
      ${n.valor ? '<div style="font-size:12px;font-weight:600;color:var(--rojo);margin-top:3px;display:flex;align-items:center;gap:4px">' + ico('money',12) + ' Valor adicional: ' + new Intl.NumberFormat('es-CO',{style:'currency',currency:'COP',minimumFractionDigits:0}).format(n.valor) + '</div>' : ''}
    </div>`).join('')
    : '<div style="font-size:12px;color:var(--gris-mid);padding:4px 0">Sin novedades.</div>';

  return `
    <div class="etapa-card">
      <div class="etapa-header" onclick="toggleEtapa('eb-${k}')">
        <div style="flex:1;min-width:0">
          <div class="etapa-nombre">${escapeHtml(nombre)}${e.tercero?` <span style="font-size:11px;color:var(--gris-mid);font-weight:400">(${escapeHtml(e.tercero)})</span>`:''}</div>
          ${e.tecnico||e.mecanico_id ? `<div class="etapa-tecnico">${ico('user',12)} ${escapeHtml(e.tecnico)||'Asignado'}</div>` : ''}
        </div>
        <div style="display:flex;align-items:center;gap:5px;flex-shrink:0">
          ${ultimaAprob ? `<span class="badge badge-${ultimaAprob.estado}">${ultimaAprob.estado==='aprobado'?'✓ Aprobada':'✗ Rechazada'}</span>` : ''}
          ${esJefe() && !e.inicio ? `<button class="btn btn-ghost btn-xs" style="color:var(--rojo);padding:2px 7px" title="Eliminar etapa" onclick="event.stopPropagation();eliminarEtapa(${eid},'${escapeHtml(nombre)}')">
            <svg width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6M14 11v6"/></svg>
          </button>` : ''}
          ${esPausado ? `<span class="badge" style="background:#FEF3C7;color:#92400E;border:1px solid #F59E0B">⏸ Pausado</span>` : ''}
          <span class="badge badge-${bCls}">${badge}</span>
          <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" style="opacity:0.4"><path d="M6 9l6 6 6-6"/></svg>
        </div>
      </div>
      <div class="etapa-body" id="eb-${k}">
        <div class="etapa-actions" style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">
          ${acc}
          <button class="btn btn-ghost btn-sm" style="display:flex;align-items:center;gap:5px;color:#92400E;border-color:#FCD34D;background:#FFFBEB"
            data-eid="${eid}" data-placa="${escapeHtml(ordenActual?.placa||'')}"
            onclick="abrirModalSolicitudRepuesto(${ordenActual?.id||0},+this.dataset.eid,this.dataset.placa)">
            <svg width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>
            Pedir repuesto
          </button>
        </div>
        ${e.descripcion ? `<div style="background:#F0F7FF;border:1px solid #BFDBFE;border-radius:7px;padding:9px 12px;margin-bottom:10px;font-size:12.5px;color:#1E293B;line-height:1.5;white-space:pre-wrap"><span style="font-size:10px;font-weight:700;color:#2563EB;text-transform:uppercase;letter-spacing:.06em;display:block;margin-bottom:3px">Descripción</span>${escapeHtml(e.descripcion)}</div>` : ''}
        <div class="timestamps">
          <div class="ts-chip">Inicio: <strong>${e.inicio?formatTS(e.inicio):'—'}</strong></div>
          <div class="ts-chip">Fin: <strong>${e.fin?formatTS(e.fin):'—'}</strong></div>
          ${dur}
        </div>
        <div class="etapa-campos-row">
          <div class="field etapa-campo-tec"><label>Técnico asignado</label>
            <select id="tec-${k}" onchange="asignarMecanico(${eid},'${k}')">
              <option value="">— Sin asignar —</option>
              ${(() => {
                const _srvRoles = { latoneria:['latonero','tot'], pintura:['pintor','tot'], mecanica:['mecanico','tot'], adicionales:['detailing','mecanico','latonero','pintor','tot'] };
                const _rolesValidos = _srvRoles[e.servicio] || null;
                return mecanicos
                  .filter(m => {
                    if (e.mecanico_id && Number(e.mecanico_id) === Number(m.id)) return true;
                    if (['taller','repuestos','Asesor Previsora'].includes(m.rol)) return false;
                    if (_rolesValidos && !_rolesValidos.map(r=>r.toLowerCase()).includes((m.rol||'').toLowerCase())) return false;
                    return true;
                  })
                  .map(m=>`<option value="${m.id}" ${Number(e.mecanico_id)===Number(m.id)?'selected':''}>${escapeHtml(m.nombre)}</option>`)
                  .join('');
              })()}
            </select>
          </div>

          ${/* Horas y valor — bloqueados para técnicos, siempre editables para jefe/gerente */''}
          ${(() => {
            const yaGuardado = (e.horas_facturadas || e.horas_adicionales || e.valor) && !esJefe();
            const fmt = n => n != null && n !== '' ? new Intl.NumberFormat('es-CO',{style:'currency',currency:'COP',minimumFractionDigits:0}).format(n) : '—';
            const lbl1 = e.servicio==='pintura'?'Piezas a pintar':'H. Facturadas';
            const lbl2 = e.servicio==='pintura'?'Piezas adic.':'H. Adicionales';
            if (yaGuardado) {
              return `
              <div class="field etapa-campo-sm">
                <label style="display:flex;align-items:center;gap:4px">${lbl1} <span style="color:var(--gris-mid);font-size:10px">🔒</span></label>
                <div style="font-size:14px;font-weight:700;padding:6px 0;color:var(--texto)">${e.horas_facturadas||'—'}</div>
              </div>
              <div class="field etapa-campo-sm">
                <label style="display:flex;align-items:center;gap:4px">${lbl2} <span style="color:var(--gris-mid);font-size:10px">🔒</span></label>
                <div style="font-size:14px;font-weight:700;padding:6px 0;color:var(--texto)">${e.horas_adicionales||'—'}</div>
              </div>
              <div class="field etapa-campo-sm">
                <label style="display:flex;align-items:center;gap:4px">Valor COP <span style="color:var(--gris-mid);font-size:10px">🔒</span></label>
                <div style="font-size:13px;font-weight:700;padding:6px 0;color:var(--verde)">${fmt(e.valor)}</div>
              </div>
              ${esJefe() ? `<div class="field etapa-campo-sm" style="display:flex;align-items:flex-end;padding-bottom:4px">
                <button class="btn btn-ghost btn-xs" style="font-size:11px" onclick="_desbloquearCamposEtapa(${eid},'${k}')">✏ Editar</button>
              </div>` : ''}`;
            } else {
              return `
              <div class="field etapa-campo-sm"><label>${lbl1}</label>
                <input id="hf-${k}" type="number" step="${e.servicio==='pintura'?'1':'0.5'}" value="${e.horas_facturadas||''}" placeholder="0">
              </div>
              <div class="field etapa-campo-sm"><label>${lbl2}</label>
                <input id="ha-${k}" type="number" step="${e.servicio==='pintura'?'1':'0.5'}" value="${e.horas_adicionales||''}" placeholder="0">
              </div>
              <div class="field etapa-campo-sm"><label>Valor COP</label>
                <input id="val-${k}" type="number" step="1000" value="${e.valor||''}" placeholder="0" style="font-weight:600;color:var(--verde)">
              </div>
              <div class="field etapa-campo-sm" style="display:flex;align-items:flex-end;padding-bottom:4px">
                ${esJefe()
                  ? `<button class="btn btn-primary btn-sm" onclick="guardarCamposEtapaJefe(${eid},'${k}')">Guardar</button>`
                  : `<button class="btn btn-primary btn-sm" onclick="guardarCamposEtapa(${eid},'${k}')">Guardar ✓</button>`
                }
              </div>`;
            }
          })()}
        </div>

        <div class="fotos-section" style="margin-top:0">
          <label style="font-size:11px;font-weight:600;letter-spacing:1px;text-transform:uppercase;color:var(--gris-mid)">Fotos (${eFotos.length})</label>
          <div class="fotos-grid" style="margin-top:6px">${fotosHtml}</div>
          <div class="upload-zone" onclick="document.getElementById('fi-${k}').click()" style="margin-top:8px">
            <input type="file" id="fi-${k}" accept="image/*" multiple data-nombre="${escapeHtml(nombre)}" data-eid="${eid}" data-k="${k}" onchange="subirFotos(this,this.dataset.nombre,+this.dataset.eid,this.dataset.k)">
            <div style="opacity:0.45">${ico('camera', 20)}</div>
            <p>Clic para subir fotos</p>
            <div class="upload-prog" id="prog-${k}"></div>
          </div>
        </div>
        <div class="novedad-section">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:${eNovs.length?'8px':'0'}">
            <div class="novedad-section-titulo" style="margin:0">Novedades</div>
            <button class="btn btn-ghost btn-xs" onclick="_toggleNovForm(${eid})" style="font-size:11px">+ Agregar</button>
          </div>
          ${eNovs.length ? `<div id="nlist-${eid}" style="margin-bottom:8px">${novsHtml}</div>` : `<div id="nlist-${eid}"></div>`}
          <div id="nov-form-${eid}" style="display:none;border-top:1px solid var(--gris-borde);padding-top:10px;margin-top:${eNovs.length?'8px':'0'}">
            <div class="grid-2" style="margin-top:4px">
              <div class="field"><label>Tipo</label>
                <select id="ntype-${eid}">
                  <option value="Detenido">Detenido</option>
                  <option value="Reproceso">Reproceso</option>
                  <option value="Garantia">Garantía</option>
                </select>
              </div>
              <div class="field"><label>Responsable</label>
                <select id="nresp-${eid}">
                  <option value="S.C.">Servicio al Cliente</option>
                  <option value="A.S.">Asesor de Servicio</option>
                  <option value="C.P.">Control de Producción</option>
                  <option value="A">Almacén</option>
                </select>
              </div>
              <div class="field full"><label>Motivo</label>
                <textarea id="nmot-${eid}" placeholder="Describe la novedad..." style="min-height:52px"></textarea>
              </div>
            </div>
            <div class="field" style="margin-top:8px"><label style="font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:1px;color:var(--gris-mid)">Valor adicional COP</label><input id="nvalor-${eid}" type="number" step="1000" min="0" placeholder="0 (opcional)"></div>
            <div class="btn-row" style="margin-top:8px">
              <button class="btn btn-ghost btn-xs" onclick="_toggleNovForm(${eid})">Cancelar</button>
              <button class="btn btn-danger btn-sm" onclick="guardarNovedad(${eid})">Guardar novedad</button>
            </div>
          </div>
        </div>
        ${ultimaAprob ? `
        <div class="aprob-box ${ultimaAprob.estado==='rechazado'?'rechazado':''}" style="margin-top:14px">
          <div class="aprob-box-top">
            <span class="aprob-box-estado">${ultimaAprob.estado==='aprobado'?'✓ Aprobada':'✗ Rechazada'}</span>
            <span class="aprob-box-fecha">${formatTS(ultimaAprob.creado_en)}</span>
          </div>
          <div style="font-size:12px;color:var(--gris-mid)">Por: ${escapeHtml(ultimaAprob.registrado_por)}</div>
          ${ultimaAprob.observacion?`<div style="font-size:12px;margin-top:4px">${escapeHtml(ultimaAprob.observacion)}</div>`:''}
        </div>` : ''}
      </div>
    </div>`;
}

function togglePanel(id) {
  const el = document.getElementById(id);
  if (el) el.classList.toggle('open');
}

async function eliminarEtapa(eid, nombre) {
  if (!confirm(`¿Eliminar la etapa "${nombre}"?\nEsta acción no se puede deshacer.`)) return;
  try {
    await api(`/etapas?id=eq.${eid}`, 'DELETE');
    toast('Etapa eliminada ✓');
    if (ordenActual) abrirOrden(ordenActual.id);
  } catch(e) { toast('Error al eliminar: ' + e.message, 'err'); }
}

async function reabrirEtapa(eid) {
  if (!confirm('¿Reabrir esta etapa para que el técnico realice las correcciones?')) return;
  try {
    await api(`/etapas?id=eq.${eid}`, 'PATCH', { fin: null });
    toast('Etapa reabierta — el técnico puede corregir ✓');
    if (ordenActual) abrirOrden(ordenActual.id);
  } catch(e) { toast('Error: ' + e.message, 'err'); }
}
function toggleEtapa(id) {
  const el = document.getElementById(id);
  if (el) el.classList.toggle('open');
}
function _toggleNovForm(eid) {
  const form = document.getElementById(`nov-form-${eid}`);
  if (!form) return;
  const visible = form.style.display !== 'none';
  form.style.display = visible ? 'none' : 'block';
  if (!visible) setTimeout(() => document.getElementById(`nmot-${eid}`)?.focus(), 60);
}

// ============================================================
// ACCIONES DE ETAPAS (JEFE)
// ============================================================
async function iniciarEtapa(eid, nombre) {
  try {
    await api(`/etapas?id=eq.${eid}`, 'PATCH', { inicio: new Date().toISOString() });
    toast(`${nombre} iniciada ✓`);
    if (ordenActual) abrirOrden(ordenActual.id);
  } catch(e) { toast('Error: '+e.message, 'err'); }
}

async function finalizarEtapa(eid, nombre, servicio) {
  try {
    const repPend = await api(`/solicitudes_repuesto?etapa_id=eq.${eid}&estado=in.(pendiente_jefe,enviado_repuestos,cotizado,pedido)&select=id,repuesto`).catch(()=>[]) || [];
    if (repPend.length) {
      toast(`No puedes finalizar. Hay ${repPend.length} repuesto(s) pendiente(s): ${repPend.map(r=>r.repuesto).join(', ')}`, 'err');
      return;
    }
    await api(`/etapas?id=eq.${eid}`, 'PATCH', { fin: new Date().toISOString() });
    toast(`${nombre} finalizada ✓`);
    const etapasOrden = await api(`/etapas?orden_id=eq.${ordenActual.id}&order=creado_en.asc`);
    const etapaActual = etapasOrden.find(e => e.id === eid);
    const etapasMismoSrv = etapasOrden.filter(e => e.servicio === (etapaActual?.servicio || servicio));
    const idxEnSrv = etapasMismoSrv.findIndex(e => e.id === eid);
    const siguiente = etapasMismoSrv.slice(idxEnSrv + 1).find(e => !e.fin) || null;
    const todasComp = etapasOrden.every(e => e.fin || e.id === eid);
    const tiemposEtapas = etapasOrden.map(e => {
      const inicio = e.inicio ? new Date(e.inicio) : null;
      const fin = (e.id === eid) ? new Date() : (e.fin ? new Date(e.fin) : null);
      let duracion = null;
      if (inicio && fin) {
        const bruto = Math.round((fin - inicio) / 60000);
        const m = Math.max(0, bruto - (e.tiempo_pausado_min || 0));
        duracion = `${Math.floor(m/60)}h ${m%60}m`;
      }
      return { etapa: e.etapa, servicio: e.servicio, tecnico: e.tecnico, duracion };
    });
    fetch(N8N_WEBHOOK, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        evento: todasComp ? 'orden_completada' : 'etapa_finalizada', 
        orden: { id: ordenActual.id, placa: ordenActual.placa, propietario: ordenActual.propietario, marca: ordenActual.marca, linea: ordenActual.linea, aseguradora: ordenActual.aseguradora }, 
        etapa_finalizada: { id: eid, nombre, servicio: etapaActual?.servicio || servicio, tecnico: etapaActual?.tecnico || null }, 
        siguiente_etapa: siguiente ? { id: siguiente.id, nombre: siguiente.etapa, servicio: siguiente.servicio, mecanico_id: siguiente.mecanico_id, tecnico: siguiente.tecnico } : null, 
        todas_completadas: todasComp, 
        tiempos_etapas: todasComp ? tiemposEtapas : null, 
        link: `${window.location.origin}${window.location.pathname}` 
      }) 
    }).catch(() => {});
    // Auto-actualizar consumible si el nombre de la etapa coincide — sin confirmación
    const _kwConsumibles = { aceite: 'aceite', llantas: 'llanta', frenos: 'freno', filtro_aire: 'filtro aire', filtro_combustible: 'filtro combust', distribucion: 'distribuci', bateria: 'bater' };
    const _nombreLower = nombre.toLowerCase();
    for (const [_tipo, _kw] of Object.entries(_kwConsumibles)) {
      if (_nombreLower.includes(_kw) && ordenActual?.placa) {
        const _km = ordenActual?.kilometraje || 0;
        const _cfg = typeof CONSUMIBLES_CONFIG !== 'undefined' ? CONSUMIBLES_CONFIG[_tipo] : null;
        api('/vehiculo_consumibles', 'POST', {
          placa:          ordenActual.placa,
          tipo:           _tipo,
          km_instalacion: _km,
          km_vida_util:   _cfg?.kmDefault || null,
          fecha_cambio:   new Date().toISOString().split('T')[0],
          orden_id:       ordenActual.id,
          tecnico:        e?.tecnico || sesion?.nombre || null,
          notas:          `Auto-registrado al finalizar etapa: ${nombre}`
        }, { Prefer: 'return=minimal' }).catch(() => {});
        toast(`✓ Consumible actualizado: ${_cfg?.label || _tipo}`);
        break;
      }
    }
    if (ordenActual) abrirOrden(ordenActual.id);
  } catch(e) { toast('Error: '+e.message, 'err'); }
}

// ── Guardar para jefe/gerente — siempre editable ──
// Si se MODIFICA un valor de mano de obra que ya estaba guardado (corrección),
// se exige el PIN. La primera vez que se ingresa NO pide PIN (no estorba).
async function guardarCamposEtapaJefe(eid, k) {
  const hf  = parseFloat(document.getElementById(`hf-${k}`)?.value) || null;
  const ha  = parseFloat(document.getElementById(`ha-${k}`)?.value) || null;
  const val = parseFloat(document.getElementById(`val-${k}`)?.value) || null;
  const guardar = async () => {
    try {
      await api(`/etapas?id=eq.${eid}`, 'PATCH', { horas_facturadas: hf, horas_adicionales: ha, valor: val });
      toast('Guardado ✓');
      if (ordenActual) abrirOrden(ordenActual.id);
    } catch(e) { toast('Error: ' + e.message, 'err'); }
  };
  const prev = await api(`/etapas?id=eq.${eid}&select=horas_facturadas,horas_adicionales,valor`).then(r => r && r[0]).catch(() => null);
  const yaTenia = prev && (prev.valor != null || prev.horas_facturadas != null || prev.horas_adicionales != null);
  const cambio  = !prev || (prev.valor != val || prev.horas_facturadas != hf || prev.horas_adicionales != ha);
  if (yaTenia && cambio && typeof pedirPin === 'function') {
    pedirPin(guardar, 'Editar mano de obra', 'Estás modificando un valor ya guardado. Ingresa el PIN.');
  } else {
    guardar();
  }
}

// ── Guardar horas+valor de una sola vez y bloquear (técnico) ─
async function guardarCamposEtapa(eid, k) {
  const hf  = parseFloat(document.getElementById(`hf-${k}`)?.value) || null;
  const ha  = parseFloat(document.getElementById(`ha-${k}`)?.value) || null;
  const val = parseFloat(document.getElementById(`val-${k}`)?.value) || null;
  if (hf == null && ha == null && val == null) {
    toast('Ingresa al menos un valor antes de guardar', 'err'); return;
  }
  try {
    await api(`/etapas?id=eq.${eid}`, 'PATCH', { horas_facturadas: hf, horas_adicionales: ha, valor: val });
    toast('Datos guardados y bloqueados ✓');
    if (ordenActual) abrirOrden(ordenActual.id);
  } catch(e) { toast('Error: ' + e.message, 'err'); }
}

// ── Desbloquear para editar (solo jefe) ─────────────────────
async function _desbloquearCamposEtapa(eid, k) {
  if (!esJefe()) return;
  const etapa = window._tvEtapasTodas?.find?.(e=>e.id===eid) ||
    (await api(`/etapas?id=eq.${eid}&select=horas_facturadas,horas_adicionales,valor`).then(r=>r?.[0]).catch(()=>null));
  // Reemplazar los spans por inputs temporalmente
  const campos = document.querySelectorAll(`#etapa-campos-${eid} .etapa-campo-sm`);
  if (ordenActual) {
    await api(`/etapas?id=eq.${eid}`, 'PATCH', { horas_facturadas: null, horas_adicionales: null, valor: null });
    toast('Campos desbloqueados — vuelve a guardar cuando termines');
    abrirOrden(ordenActual.id);
  }
}

async function patchHoras(eid, k) {
  const hf = parseFloat(document.getElementById(`hf-${k}`)?.value) || null;
  const ha = parseFloat(document.getElementById(`ha-${k}`)?.value) || null;
  await api(`/etapas?id=eq.${eid}`, 'PATCH', { horas_facturadas: hf, horas_adicionales: ha }).catch(() => {});
}

async function asignarMecanico(eid, k) {
  const sel = document.getElementById(`tec-${k}`);
  const mecId = sel?.value ? parseInt(sel.value) : null;
  const mec = mecanicos.find(m => m.id === mecId);
  try {
    await api(`/etapas?id=eq.${eid}`, 'PATCH', { mecanico_id: mecId || null, tecnico: mec?.nombre || null });
    toast('Técnico asignado ✓');
  } catch(e) { toast('Error: '+e.message, 'err'); }
}

// ── Toggle KM omitir ────────────────────────────────────────
function _toggleKmOmitir(chk) {
  const kmInput = document.getElementById('n-km');
  if (!kmInput) return;
  kmInput.disabled  = chk.checked;
  kmInput.value     = chk.checked ? '' : kmInput.value;
  kmInput.style.opacity = chk.checked ? '0.4' : '1';
}

// ── Editar descripción general desde el detalle de orden ────
function abrirEditDescripcion(ordenId, textoActual) {
  const box = document.getElementById('desc-edit-box-' + ordenId);
  if (!box) return;
  box.style.display = 'block';
  const ta = document.getElementById('desc-edit-ta-' + ordenId);
  if (ta) { ta.value = textoActual || ''; ta.focus(); }
}

async function guardarDescripcion(ordenId) {
  const ta = document.getElementById('desc-edit-ta-' + ordenId);
  const texto = ta?.value?.trim() ?? null;
  try {
    await api(`/ordenes?id=eq.${ordenId}`, 'PATCH', { descripcion_general: texto || null });
    toast('Descripción actualizada ✓');
    if (ordenActual) { ordenActual.descripcion_general = texto || null; abrirOrden(ordenId); }
  } catch(e) { toast('Error: ' + e.message, 'err'); }
}

// ============================================================
// NUEVA ORDEN
// ============================================================
// Si tiene un id, el formulario está "completando" una orden agendada
// (Programada) en vez de crear una nueva → al guardar hace PATCH + activa.
let _ordenCompletandoId = null;

function resetNuevaOrden() {
  const fields = ['n-placa', 'n-marca', 'n-linea', 'n-modelo', 'n-color', 'n-propietario', 'n-telefono', 'n-km', 'n-fecha1', 'n-fecha2', 'n-inv-obs', 'n-cedula-cliente', 'n-vin', 'n-correo-cliente', 'n-descripcion-general'];
  fields.forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
  const aseguradora = document.getElementById('n-aseguradora');
  const dano = document.getElementById('n-dano');
  const tipoCliente = document.getElementById('n-tipo-cliente');
  const tipoCarroceria = document.getElementById('n-tipo-carroceria');
  if (aseguradora) aseguradora.value = '';
  if (dano) dano.value = '';
  if (tipoCliente) tipoCliente.value = '';
  if (tipoCarroceria) tipoCarroceria.value = '';
  const _kmChk = document.getElementById('n-km-omitir');
  if (_kmChk) { _kmChk.checked = false; }
  const _kmInp = document.getElementById('n-km');
  if (_kmInp) { _kmInp.disabled = false; _kmInp.style.opacity = '1'; }
  document.querySelectorAll('.dano-cb').forEach(cb => { cb.checked = false; });
  document.querySelectorAll('.inv-item').forEach(el => {
    el.classList.remove('checked');
    const chk = el.querySelector('input[type=checkbox]');
    if (chk) chk.checked = false;
  });
  fotosIngresoPendientes = [];
  renderPreviewIngreso();
  const resultado = document.getElementById('placa-resultado');
  const historial = document.getElementById('historial-previo');
  if (resultado) resultado.style.display = 'none';
  if (historial) historial.style.display = 'none';
}

function cancelarNuevaOrden() {
  if (esJefe()) navJefe('ordenes');
}

// ── Wizard nueva orden ──────────────────────────────────────
let _wizardPaso = 1;

function irPasoWizard(paso) {
  if (paso === 2 && !_validarPaso1()) return;
  _wizardPaso = paso;
  const s1 = document.getElementById('wizard-s1');
  const s2 = document.getElementById('wizard-s2');
  const ws1 = document.getElementById('ws-1');
  const ws2 = document.getElementById('ws-2');
  const btnPrev = document.getElementById('wizard-btn-prev');
  const btnNext = document.getElementById('wizard-btn-next');
  const btnSave = document.getElementById('wizard-btn-save');
  if (s1) s1.style.display = paso === 1 ? '' : 'none';
  if (s2) s2.style.display = paso === 2 ? '' : 'none';
  if (ws1) { ws1.classList.toggle('active', paso === 1); ws1.classList.toggle('done', paso > 1); }
  if (ws2) { ws2.classList.toggle('active', paso === 2); }
  if (btnPrev) btnPrev.style.display = paso > 1 ? '' : 'none';
  if (btnNext) btnNext.style.display = paso < 2 ? '' : 'none';
  if (btnSave) btnSave.style.display = paso === 2 ? '' : 'none';
  // Scroll al inicio del formulario
  const pag = document.getElementById('pag-nueva');
  if (pag) pag.scrollTop = 0;
}

function _validarPaso1() {
  const placa = document.getElementById('n-placa')?.value.trim();
  if (!placa) { toast('Ingresa la placa del vehículo', 'err'); return false; }
  const tipo = document.getElementById('n-tipo-cliente')?.value;
  if (!tipo) {
    const errEl = document.getElementById('n-tipo-cliente-error');
    if (errEl) errEl.style.display = 'block';
    toast('Selecciona el tipo de cliente', 'err');
    return false;
  }
  return true;
}

function _resetWizard() {
  _wizardPaso = 1;
  const s1 = document.getElementById('wizard-s1');
  const s2 = document.getElementById('wizard-s2');
  const ws1 = document.getElementById('ws-1');
  const ws2 = document.getElementById('ws-2');
  const btnPrev = document.getElementById('wizard-btn-prev');
  const btnNext = document.getElementById('wizard-btn-next');
  const btnSave = document.getElementById('wizard-btn-save');
  if (s1) s1.style.display = '';
  if (s2) s2.style.display = 'none';
  if (ws1) { ws1.classList.add('active'); ws1.classList.remove('done'); }
  if (ws2) { ws2.classList.remove('active'); }
  if (btnPrev) btnPrev.style.display = 'none';
  if (btnNext) btnNext.style.display = '';
  if (btnSave) btnSave.style.display = 'none';
}

function toggleInv(el, key) {
  el.classList.toggle('checked');
  const chk = el.querySelector('input[type=checkbox]');
  if (chk) chk.checked = el.classList.contains('checked');
}

function agregarFotosIngreso(input) {
  fotosIngresoPendientes = [...fotosIngresoPendientes, ...Array.from(input.files)];
  renderPreviewIngreso();
}

function renderPreviewIngreso() {
  const g = document.getElementById('fotos-ingreso-preview');
  if (!g) return;
  g.innerHTML = fotosIngresoPendientes.map((f, i) => `
    <div class="foto-thumb">
      <img src="${URL.createObjectURL(f)}" style="width:100%;height:100%;object-fit:cover">
      <button class="foto-delete" style="opacity:1" onclick="quitarFotoIngreso(${i})">✕</button>
    </div>`).join('');
}

function quitarFotoIngreso(i) { 
  fotosIngresoPendientes.splice(i, 1); 
  renderPreviewIngreso(); 
}

// ── Autocompletado de placa en tiempo real ──────────────────
let _placaDebounce = null;
let _placaRegistry = {};

function seleccionarPlacaById(placa) {
  seleccionarPlaca(placa, _placaRegistry[placa] || {});
}

async function autocompletarPlaca(val) {
  clearTimeout(_placaDebounce);
  const sugDiv = document.getElementById('placa-sugerencias');
  if (!sugDiv) return;
  if (!val || val.length < 2) { sugDiv.style.display = 'none'; return; }

  _placaDebounce = setTimeout(async () => {
    try {
      const [deVehiculos, deOrdenes] = await Promise.all([
        api(`/vehiculos?placa=ilike.${val}*&select=placa,marca,linea,modelo&limit=6`).catch(()=>[]) || [],
        api(`/ordenes?placa=ilike.${val}*&select=placa,marca,linea,modelo,propietario,telefono,color&order=creado_en.desc&limit=6`).catch(()=>[]) || []
      ]);

      // Deduplicar por placa, priorizar vehículos
      const mapa = {};
      deOrdenes.forEach(o => { mapa[o.placa] = o; });
      deVehiculos.forEach(v => { mapa[v.placa] = { ...mapa[v.placa], ...v }; });
      const sugerencias = Object.values(mapa).slice(0, 6);

      if (!sugerencias.length) { sugDiv.style.display = 'none'; return; }

      _placaRegistry = {};
      sugerencias.forEach(s => { _placaRegistry[s.placa] = s; });

      sugDiv.innerHTML = sugerencias.map(s => `
        <div class="placa-sug-item" data-placa="${escapeHtml(s.placa)}" onmousedown="seleccionarPlacaById(this.dataset.placa)">
          <span class="placa-sug-placa">${escapeHtml(s.placa)}</span>
          <span class="placa-sug-veh">${[s.marca,s.linea,s.modelo].filter(Boolean).map(escapeHtml).join(' ')||'—'}</span>
        </div>`).join('');
      sugDiv.style.display = 'block';
    } catch(e) { sugDiv.style.display = 'none'; }
  }, 250);
}

function seleccionarPlaca(placa, datos) {
  const input = document.getElementById('n-placa');
  if (input) input.value = placa;
  cerrarSugerenciasPlaca();
  // Pre-llenar campos del vehículo
  const campos = { 'n-marca': datos.marca, 'n-linea': datos.linea, 'n-modelo': datos.modelo, 'n-color': datos.color };
  Object.entries(campos).forEach(([id, val]) => {
    const el = document.getElementById(id);
    if (el && val) el.value = val;
  });
  // Pre-llenar propietario si es particular
  if (datos.propietario) {
    const prop = document.getElementById('n-propietario');
    const tel  = document.getElementById('n-telefono');
    if (prop && !prop.value) prop.value = datos.propietario;
    if (tel  && !tel.value  && datos.telefono) tel.value = datos.telefono;
  }
  buscarPorPlaca(); // Mostrar historial
}

function cerrarSugerenciasPlaca() {
  const s = document.getElementById('placa-sugerencias');
  if (s) s.style.display = 'none';
}

let _placaSugIdx = -1;
function navSugerenciasPlaca(e) {
  const items = document.querySelectorAll('.placa-sug-item');
  if (!items.length) return;
  if (e.key === 'ArrowDown') { e.preventDefault(); _placaSugIdx = Math.min(_placaSugIdx+1, items.length-1); }
  else if (e.key === 'ArrowUp') { e.preventDefault(); _placaSugIdx = Math.max(_placaSugIdx-1, 0); }
  else if (e.key === 'Enter' && _placaSugIdx >= 0) { e.preventDefault(); items[_placaSugIdx]?.dispatchEvent(new MouseEvent('mousedown')); return; }
  else if (e.key === 'Escape') { cerrarSugerenciasPlaca(); return; }
  items.forEach((item, i) => item.classList.toggle('active', i === _placaSugIdx));
}

async function buscarPorPlaca() {
  const placa = document.getElementById('n-placa')?.value.trim().toUpperCase();
  const resultDiv = document.getElementById('placa-resultado');
  const histDiv = document.getElementById('historial-previo');
  cerrarSugerenciasPlaca();
  if (!placa || placa.length < 3) {
    if (resultDiv) resultDiv.style.display = 'none';
    if (histDiv) histDiv.style.display = 'none';
    return;
  }
  try {
    // Consultar vehículos registrados Y historial de órdenes en paralelo
    const [vehiculo, ordenes] = await Promise.all([
      api(`/vehiculos?placa=eq.${placa}&limit=1`).then(r => r?.[0]).catch(() => null),
      api(`/ordenes?placa=eq.${placa}&order=creado_en.desc&limit=5`).catch(() => []) || []
    ]);

    // Prioridad: tabla vehiculos > última orden
    const fuente = vehiculo || (ordenes?.length ? ordenes[0] : null);

    if (fuente) {
      const flds = { 'n-marca': fuente.marca, 'n-linea': fuente.linea, 'n-modelo': fuente.modelo, 'n-color': fuente.color };
      Object.entries(flds).forEach(([id, val]) => {
        const el = document.getElementById(id);
        if (el && val && !el.value) el.value = val;
      });
      const prop = document.getElementById('n-propietario');
      const tel  = document.getElementById('n-telefono');
      const ced  = document.getElementById('n-cedula-cliente');
      if (prop && !prop.value && fuente.propietario) prop.value = fuente.propietario;
      if (tel  && !tel.value  && fuente.telefono)    tel.value  = fuente.telefono;
      if (ced  && !ced.value  && fuente.cedula_nit)  ced.value  = fuente.cedula_nit;

      // Si el vehículo pertenece a una flotilla, pre-seleccionar
      if (vehiculo?.flotilla_id) {
        const tabFlot = document.getElementById('tcb-flotilla');
        if (tabFlot && typeof selTipoCliente === 'function') {
          const tipoActual = document.getElementById('n-tipo-cliente')?.value;
          if (!tipoActual) {
            selTipoCliente(tabFlot, 'flotilla');
            setTimeout(() => {
              const sel = document.getElementById('n-flotilla-sel');
              if (sel) sel.value = vehiculo.flotilla_id;
            }, 300);
          }
        }
      }

      if (resultDiv) {
        const origen = vehiculo ? '🚗 Vehículo en flotilla registrada' : '✔ Vehículo encontrado';
        resultDiv.className = 'placa-resultado encontrado';
        resultDiv.innerHTML = `${origen} — datos autocompletados.`;
        resultDiv.style.display = 'block';
      }
    }

    if (ordenes?.length) {
      const historialLista = document.getElementById('historial-lista');
      if (historialLista && histDiv) {
        historialLista.innerHTML = ordenes.map(o => `
          <div class="historial-item" onclick="abrirOrden(${o.id})">
            <div><span class="historial-placa">${escapeHtml(o.placa)}</span>
            <span style="color:var(--gris-mid);margin-left:8px">${escapeHtml(o.aseguradora)||'—'}</span></div>
            <div style="font-size:11px;color:var(--gris-mid);text-align:right">${formatFecha(o.creado_en)}</div>
          </div>`).join('');
        histDiv.style.display = 'block';
      }
    } else if (!fuente) {
      if (resultDiv) {
        resultDiv.className = 'placa-resultado nuevo';
        resultDiv.innerHTML = 'ℹ Placa nueva — sin registros anteriores.';
        resultDiv.style.display = 'block';
      }
      if (histDiv) histDiv.style.display = 'none';
    }
  } catch(e) { if (resultDiv) resultDiv.style.display = 'none'; }
}

// ── OCR Tarjeta de Propiedad ─────────────────────────────────
async function ocrTarjetaPropiedad(input) {
  const file = input.files?.[0];
  if (!file) return;
  const estado = document.getElementById('ocr-estado');
  if (estado) { estado.style.display = 'block'; estado.innerHTML = '⏳ Leyendo tarjeta de propiedad...'; }

  try {
    const parsed = await ocrLeerTarjeta(file);

    const mapa = {
      'n-placa':  parsed.placa?.toUpperCase(),
      'n-marca':  parsed.marca,
      'n-linea':  parsed.linea,
      'n-modelo': parsed.modelo,
      'n-color':  parsed.color,
      'n-vin':    parsed.vin?.toUpperCase()
    };

    let encontrados = [];
    Object.entries(mapa).forEach(([id, val]) => {
      if (!val) return;
      const el = document.getElementById(id);
      if (el) { el.value = val; encontrados.push(id.replace('n-','').replace('-',' ')); }
    });

    // Propietario va al campo correcto según tipo cliente seleccionado
    if (parsed.propietario) {
      const tipo = document.getElementById('n-tipo-cliente')?.value;
      const targetId = tipo === 'aseguradora' ? 'n-propietario-aseg' : 'n-propietario';
      const el = document.getElementById(targetId);
      if (el && !el.value) { el.value = parsed.propietario; encontrados.push('propietario'); }
    }

    // Cédula / NIT del propietario (extraída de la tarjeta)
    const cedulaParsed = parsed.cedula_nit || parsed.cedula || parsed.documento;
    if (cedulaParsed) {
      const tipo = document.getElementById('n-tipo-cliente')?.value;
      const cedId = tipo === 'aseguradora' ? 'n-cedula-aseg' : 'n-cedula-cliente';
      const cedEl = document.getElementById(cedId);
      if (cedEl && !cedEl.value) { cedEl.value = cedulaParsed; encontrados.push('cédula'); }
    }

    // Si encontró placa, buscar historial
    if (parsed.placa) buscarPorPlaca();

    if (estado) {
      if (encontrados.length) {
        estado.innerHTML = `${ico('check',14)} Datos extraídos: <strong>${encontrados.join(', ')}</strong>. Revisa y corrige si es necesario.`;
        estado.style.background = 'var(--verde-bg)';
        estado.style.borderColor = 'var(--verde)';
        estado.style.color = 'var(--verde)';
      } else {
        estado.innerHTML = ico('warning',14) + ' No se pudieron extraer datos. La imagen puede estar borrosa o mal enfocada. Intenta con mejor iluminación.';
        estado.style.background = '#FEF3C7';
        estado.style.borderColor = '#FDE68A';
        estado.style.color = '#92400E';
      }
    }
  } catch(e) {
    if (estado) {
      estado.innerHTML = ico('x',14) + ' Error al leer la tarjeta: ' + e.message;
      estado.style.background = 'var(--rojo-bg,#FEE2E2)';
    }
    console.error('OCR error:', e);
  } finally {
    input.value = ''; // Reset para poder volver a subir
  }
}

// ── Toggle persona natural / empresa en nueva orden ─────────
function toggleTipoPersonaNueva(tipo) {
  const lblNombre = document.getElementById('lbl-n-propietario');
  const lblDoc    = document.getElementById('lbl-n-cedula');
  if (tipo === 'empresa') {
    if (lblNombre) lblNombre.textContent = 'Razón social *';
    if (lblDoc)    lblDoc.textContent    = 'NIT';
  } else {
    if (lblNombre) lblNombre.textContent = 'Nombre completo *';
    if (lblDoc)    lblDoc.textContent    = 'Cédula';
  }
}

function toggleTipoClienteNueva(tipo) {
  ['n-wrap-particular','n-wrap-aseg','n-wrap-flot','n-wrap-empresa'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = 'none';
  });
  const mapaBloque = {
    particular:  'n-wrap-particular',
    aseguradora: 'n-wrap-aseg',
    flotilla:    'n-wrap-flot',
    empresa:     'n-wrap-empresa'
  };
  const el = document.getElementById(mapaBloque[tipo]);
  if (el) el.style.display = 'block';
  const hidden = document.getElementById('n-tipo-cliente');
  if (hidden) hidden.value = tipo;
}

function selTipoCliente(label, tipo) {
  document.querySelectorAll('.tipo-cliente-btn').forEach(b => b.classList.remove('selected'));
  label.classList.add('selected');
  // Ocultar error de tipo si estaba visible
  const errEl = document.getElementById('n-tipo-cliente-error');
  if (errEl) errEl.style.display = 'none';
  toggleTipoClienteNueva(tipo);
}

function toggleNuevaAseg(val) {
  const el = document.getElementById('n-wrap-aseg-extra');
  if (el) el.style.display = val ? 'none' : 'block';
}
function toggleNuevaFlot(val) {
  const el = document.getElementById('n-wrap-flot-extra');
  if (el) el.style.display = val ? 'none' : 'block';
}
function toggleNuevaEmpresa(val) {
  const el = document.getElementById('n-wrap-empresa-extra');
  if (el) el.style.display = val ? 'none' : 'block';
}
async function agregarNuevaEmpresaNueva() {
  const n = document.getElementById('n-emp-nombre')?.value.trim() || prompt('Razón social:')?.trim();
  if (!n) return;
  const nit = document.getElementById('n-emp-nit')?.value.trim() || null;
  try {
    await api('/flotillas', 'POST', { nombre: n, nit, activo: true }, { Prefer:'return=minimal' });
    toast('Empresa agregada ✓');
    await recargarListasNuevaOrden();
    const sel = document.getElementById('n-empresa-sel');
    if (sel) sel.value = n;
  } catch(e) { toast('Error: '+e.message,'err'); }
}

function agregarNuevaAsegNueva(onSaved) {
  // Eliminar modal previo
  document.getElementById('modal-nueva-aseg')?.remove();

  // Contador de contactos
  let _contactoIdx = 0;

  const m = document.createElement('div');
  m.id = 'modal-nueva-aseg';
  m.className = 'modal-overlay show';
  m.innerHTML = `
    <div class="modal" style="max-width:560px">
      <div class="modal-header">
        <div class="modal-titulo">
          <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
          Nueva aseguradora
        </div>
        <button class="modal-close" onclick="document.getElementById('modal-nueva-aseg').remove()">
          <svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M18 6L6 18M6 6l12 12"/></svg>
        </button>
      </div>
      <div class="modal-body" style="display:flex;flex-direction:column;gap:12px">

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
          <div class="field" style="margin:0"><label>Nombre *</label><input id="naseg-nombre" placeholder="HDI Seguros, Sura..."></div>
          <div class="field" style="margin:0"><label>NIT</label><input id="naseg-nit" placeholder="900123456-7"></div>
          <div class="field" style="margin:0"><label>Teléfono</label><input id="naseg-tel" type="tel" placeholder="6011234567"></div>
          <div class="field" style="margin:0"><label>Correo</label><input id="naseg-mail" type="email" placeholder="contacto@aseguradora.com"></div>
          <div class="field" style="margin:0;grid-column:1/-1"><label>Dirección</label><input id="naseg-dir" placeholder="Cra 7 #32-16, Bogotá"></div>
          <div class="field" style="margin:0"><label>Valor hora estadía (COP)</label><input id="naseg-hora" type="number" min="0" placeholder="0" style="font-family:'DM Mono',monospace"></div>
        </div>

        <div style="border-top:1px solid var(--gris-borde);padding-top:12px">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">
            <span style="font-size:11px;font-weight:700;color:var(--gris-mid);text-transform:uppercase;letter-spacing:.5px">Contactos</span>
            <button class="btn btn-ghost btn-xs" onclick="_nasegAgregarContacto()" style="display:flex;align-items:center;gap:4px">
              <svg width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              Agregar contacto
            </button>
          </div>
          <div id="naseg-contactos-wrap" style="display:flex;flex-direction:column;gap:8px"></div>
        </div>

        <div id="naseg-error" style="display:none;background:var(--rojo-bg);color:var(--rojo);border-radius:6px;padding:9px 12px;font-size:13px"></div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-ghost" onclick="document.getElementById('modal-nueva-aseg').remove()">Cancelar</button>
        <button class="btn btn-primary" id="naseg-btn-save" onclick="_guardarNuevaAsegModal()">Guardar aseguradora</button>
      </div>
    </div>`;
  m.addEventListener('click', e => { if (e.target === m) m.remove(); });
  document.body.appendChild(m);

  // Agregar primer contacto vacío
  window._nasegContactoIdx = 0;
  window._nasegAgregarContacto = function() {
    const wrap = document.getElementById('naseg-contactos-wrap');
    if (!wrap) return;
    const idx = window._nasegContactoIdx++;
    const div = document.createElement('div');
    div.id = `naseg-contacto-${idx}`;
    div.style.cssText = 'display:grid;grid-template-columns:1fr 1fr 1fr auto;gap:7px;align-items:end;background:var(--gris-bg);border-radius:7px;padding:8px 10px';
    div.innerHTML = `
      <div class="field" style="margin:0"><label style="font-size:10px">Nombre</label><input placeholder="Carlos López" style="font-size:13px"></div>
      <div class="field" style="margin:0"><label style="font-size:10px">Teléfono</label><input placeholder="3001234567" style="font-size:13px"></div>
      <div class="field" style="margin:0"><label style="font-size:10px">Correo</label><input placeholder="carlos@seg.com" style="font-size:13px"></div>
      <button class="btn btn-ghost btn-xs" style="color:var(--rojo);flex-shrink:0;margin-bottom:0" onclick="document.getElementById('naseg-contacto-${idx}').remove()" title="Quitar">
        <svg width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M18 6L6 18M6 6l12 12"/></svg>
      </button>`;
    wrap.appendChild(div);
  };
  window._nasegAgregarContacto();

  window._guardarNuevaAsegModal = async function() {
    const nombre = document.getElementById('naseg-nombre')?.value.trim();
    const errEl  = document.getElementById('naseg-error');
    if (!nombre) { errEl.textContent = 'El nombre es obligatorio.'; errEl.style.display = 'block'; return; }
    errEl.style.display = 'none';
    const btn = document.getElementById('naseg-btn-save');
    if (btn) { btn.disabled = true; btn.textContent = 'Guardando...'; }

    // Recoger contactos
    const contactos = [];
    document.querySelectorAll('#naseg-contactos-wrap > div').forEach(div => {
      const inputs = div.querySelectorAll('input');
      const n = inputs[0]?.value.trim();
      const t = inputs[1]?.value.trim();
      const c = inputs[2]?.value.trim();
      if (n || t || c) contactos.push({ nombre: n, telefono: t, correo: c });
    });

    const body = {
      nombre,
      activo: true,
      nit:       document.getElementById('naseg-nit')?.value.trim() || null,
      telefono:  document.getElementById('naseg-tel')?.value.trim() || null,
      correo:    document.getElementById('naseg-mail')?.value.trim() || null,
      direccion: document.getElementById('naseg-dir')?.value.trim() || null,
      valor_hora: parseFloat(document.getElementById('naseg-hora')?.value) || null,
      contactos: contactos.length ? JSON.stringify(contactos) : null,
    };

    try {
      try {
        await api('/aseguradoras', 'POST', body, { Prefer:'return=minimal' });
      } catch (e1) {
        // Reintento sin columnas que podrían no existir aún en la BD (ej. nit)
        const { nit, ...bodySinNit } = body;
        await api('/aseguradoras', 'POST', bodySinNit, { Prefer:'return=minimal' });
      }
      toast('Aseguradora creada ✓');
      document.getElementById('modal-nueva-aseg').remove();
      await recargarListasNuevaOrden();
      if (typeof onSaved === 'function') onSaved();
    } catch(e) {
      errEl.textContent = 'Error: ' + e.message;
      errEl.style.display = 'block';
      if (btn) { btn.disabled = false; btn.textContent = 'Guardar aseguradora'; }
    }
  };

  setTimeout(() => document.getElementById('naseg-nombre')?.focus(), 80);
}

async function agregarNuevaFlotNueva() {
  const nombre = prompt('Nombre de la nueva flotilla:')?.trim();
  if (!nombre) return;
  try {
    await api('/flotillas', 'POST', { nombre, activo: true }, { Prefer:'return=minimal' });
    toast('Flotilla agregada ✓');
    await recargarListasNuevaOrden();
  } catch(e) { toast('Error: '+e.message,'err'); }
}

async function recargarListasNuevaOrden() {
  const [aseg, flot] = await Promise.all([
    api('/aseguradoras?activo=eq.true&order=nombre.asc').catch(()=>[]) || [],
    api('/flotillas?activo=eq.true&order=nombre.asc').catch(()=>[]) || []
  ]);
  const selA = document.getElementById('n-aseguradora-sel');
  const selF = document.getElementById('n-flotilla-sel');
  if (selA) selA.innerHTML = '<option value="">— Seleccionar —</option>' +
    aseg.map(a=>`<option value="${escapeHtml(a.nombre)}">${escapeHtml(a.nombre)}</option>`).join('');
  if (selF) selF.innerHTML = '<option value="">— Seleccionar —</option>' +
    flot.map(f=>`<option value="${escapeHtml(f.nombre)}">${escapeHtml(f.nombre)}</option>`).join('');
}

// Normaliza un teléfono a formato WhatsApp (solo dígitos con indicativo país).
// Colombia: celular de 10 dígitos -> se antepone 57.
function _waNumero(raw) {
  if (!raw) return '';
  let d = String(raw).replace(/\D/g, '').replace(/^00/, '');
  if (!d) return '';
  if (d.length === 10) return '57' + d;        // celular CO sin indicativo
  if (d.startsWith('57') && d.length >= 12) return d; // ya trae 57
  return d;                                     // otro país / ya con indicativo
}

// ── Mensaje de WhatsApp "listo para entrega" (editable por el usuario) ──
const _WA_ENTREGA_DEFAULT = 'Hola {nombre}, le saluda {taller}. Su {vehiculo} de placa {placa} ya está LISTO para entrega. Puede pasar a recogerlo en nuestro taller. ¡Gracias por confiar en nosotros! 🚗';
function _waEntregaTemplate() {
  try { return localStorage.getItem('wa_entrega_msg') || _WA_ENTREGA_DEFAULT; } catch (e) { return _WA_ENTREGA_DEFAULT; }
}
function _waEntregaMsg(o) {
  const taller  = (typeof _cotPdfConfig === 'function' && _cotPdfConfig().nombre) || 'Freimanautos';
  const veh     = [o.marca, o.linea].filter(Boolean).join(' ') || 'vehículo';
  const nombre  = (o.propietario || '').trim().split(' ')[0] || '';
  return _waEntregaTemplate()
    .replace(/\{nombre\}/g, nombre)
    .replace(/\{taller\}/g, taller)
    .replace(/\{vehiculo\}/g, veh)
    .replace(/\{placa\}/g, o.placa || '');
}
// Editor del mensaje de WhatsApp
function editarMensajeEntrega() {
  const prev = document.getElementById('wa-msg-modal'); if (prev) prev.remove();
  const ov = document.createElement('div');
  ov.id = 'wa-msg-modal';
  ov.style.cssText = 'position:fixed;inset:0;z-index:10001;background:rgba(0,0,0,.45);display:flex;align-items:center;justify-content:center;padding:18px';
  ov.innerHTML = `
    <div style="background:#fff;border-radius:14px;max-width:460px;width:100%;padding:20px;box-shadow:0 10px 40px rgba(0,0,0,.25);font-family:'DM Sans',sans-serif">
      <div style="font-size:16px;font-weight:800;color:var(--azul);margin-bottom:4px">Mensaje de WhatsApp al cliente</div>
      <div style="font-size:12px;color:var(--gris-mid);margin-bottom:12px">Se envía cuando el vehículo está listo para entrega.</div>
      <textarea id="wa-msg-text" rows="6" style="width:100%;border:1px solid var(--gris-borde);border-radius:8px;padding:10px;font-size:13px;font-family:inherit;resize:vertical">${escapeHtml(_waEntregaTemplate())}</textarea>
      <div style="font-size:11px;color:var(--gris-mid);margin-top:8px;line-height:1.6">
        Etiquetas que puedes usar (se reemplazan solas):<br>
        <code>{nombre}</code> · <code>{vehiculo}</code> · <code>{placa}</code> · <code>{taller}</code>
      </div>
      <div style="display:flex;gap:8px;margin-top:16px;justify-content:flex-end">
        <button class="btn btn-ghost btn-sm" onclick="document.getElementById('wa-msg-modal').remove()">Cancelar</button>
        <button class="btn btn-ghost btn-sm" onclick="localStorage.removeItem('wa_entrega_msg');document.getElementById('wa-msg-text').value=_waEntregaTemplate()">Restaurar</button>
        <button class="btn btn-primary btn-sm" onclick="_guardarMensajeEntrega()">Guardar</button>
      </div>
    </div>`;
  ov.addEventListener('click', e => { if (e.target === ov) ov.remove(); });
  document.body.appendChild(ov);
}
function _guardarMensajeEntrega() {
  const v = document.getElementById('wa-msg-text')?.value.trim();
  if (v) { try { localStorage.setItem('wa_entrega_msg', v); } catch (e) {} }
  document.getElementById('wa-msg-modal')?.remove();
  toast('Mensaje guardado ✓');
}

// Abre WhatsApp con el mensaje "listo para entrega", marca la orden como
// avisada (para activar el agendamiento de la cita) y refresca el detalle.
// (No envía solo: el usuario da "Enviar" — gratis, sin API de WhatsApp Business.)
async function avisarClienteWhatsapp(ordenId) {
  try {
    const arr = await api(`/ordenes?id=eq.${ordenId}&select=placa,marca,linea,propietario,telefono`).catch(() => []);
    const o = arr && arr[0];
    if (!o) { toast('No se encontró la orden', 'err'); return; }
    const tel = _waNumero(o.telefono);
    if (!tel) { toast('El cliente no tiene celular registrado en la orden', 'err'); return; }
    window.open(`https://wa.me/${tel}?text=${encodeURIComponent(_waEntregaMsg(o))}`, '_blank');
    try { await api(`/ordenes?id=eq.${ordenId}`, 'PATCH', { entrega_avisada_en: new Date().toISOString() }); } catch (e) {}
    abrirOrden(ordenId); // refrescar para mostrar el agendamiento de la cita
  } catch (e) { toast('Error: ' + e.message, 'err'); }
}

// Información de la cita: texto de cuenta regresiva + si está vencida.
function _citaInfo(citaISO) {
  if (!citaISO) return null;
  const t = new Date(citaISO).getTime();
  const diff = t - Date.now();
  const min = Math.round(Math.abs(diff) / 60000);
  const fmt = m => m < 60 ? `${m} min` : `${Math.floor(m / 60)}h ${m % 60}m`;
  const cuando = new Date(citaISO).toLocaleString('es-CO', { weekday: 'short', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: true });
  if (diff > 60000)  return { vencida: false, texto: `Recoge en ${fmt(min)}`, cuando, diffMs: diff };
  if (diff > -60000) return { vencida: true,  texto: 'Cliente debería estar llegando', cuando, diffMs: diff };
  return { vencida: true, texto: `Cita vencida hace ${fmt(min)}`, cuando, diffMs: diff };
}

// Bloque "listo para entrega" del detalle: avisar + agendar cita + cuenta regresiva.
function _bloqueEntrega(orden) {
  const tel = orden.telefono ? _waNumero(orden.telefono) : '';
  const avisado = !!orden.entrega_avisada_en;
  const ci = _citaInfo(orden.cita_entrega);
  let h = `<div style="font-size:11px;color:var(--verde);font-weight:600;margin-bottom:8px;text-align:center">✓ Calidad aprobada — listo para entrega</div>`;
  // Botón avisar (o reenviar) + editar mensaje
  h += `<div style="display:flex;gap:6px;margin-bottom:6px">
    <button class="btn" style="flex:1;background:#25D366;border-color:#25D366;color:#fff" onclick="avisarClienteWhatsapp(${orden.id})">📲 ${avisado ? 'Reenviar' : 'Avisar al cliente'} (WhatsApp)</button>
    <button class="btn btn-ghost btn-sm" title="Editar mensaje" onclick="editarMensajeEntrega()">✏️</button>
  </div>`;
  if (avisado) {
    h += `<div style="font-size:11px;color:var(--gris-mid);margin-bottom:8px">✓ Cliente avisado el ${formatTS(orden.entrega_avisada_en)}</div>`;
    // Agendar / re-agendar cita
    const val = orden.cita_entrega ? _toLocalInput(orden.cita_entrega) : '';
    h += `<div style="background:#F8FAFC;border:1px solid var(--gris-borde);border-radius:8px;padding:10px;margin-bottom:6px">
      <label style="font-size:11px;font-weight:700;color:var(--gris-mid);display:block;margin-bottom:5px">¿Cuándo recoge el cliente?</label>
      <div style="display:flex;gap:6px">
        <input type="datetime-local" id="cita-input-${orden.id}" value="${val}" style="flex:1;font-size:12px;padding:6px 8px;border:1px solid var(--gris-borde);border-radius:6px">
        <button class="btn btn-primary btn-sm" onclick="guardarCitaEntrega(${orden.id})">Guardar</button>
      </div>`;
    if (ci) {
      const col = ci.vencida ? '#DC2626' : '#0369A1';
      const bg  = ci.vencida ? '#FEF2F2' : '#EFF6FF';
      h += `<div style="margin-top:8px;background:${bg};border-radius:6px;padding:8px;text-align:center">
        <div style="font-size:13px;font-weight:800;color:${col}">${ci.vencida ? '⏰ ' : '🚗 '}${ci.texto}</div>
        <div style="font-size:11px;color:var(--gris-mid);margin-top:2px">Cita: ${ci.cuando}</div>
      </div>`;
    }
    h += `</div>`;
    // Llamar cliente
    if (tel) h += `<a href="tel:+${tel}" class="btn btn-ghost btn-sm" style="width:100%;margin-bottom:6px;text-align:center;display:block">📞 Llamar al cliente</a>`;
  }
  return h;
}
function _toLocalInput(iso) {
  const d = new Date(iso);
  const p = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}
async function guardarCitaEntrega(ordenId) {
  const inp = document.getElementById('cita-input-' + ordenId);
  const val = inp && inp.value;
  if (!val) { toast('Selecciona fecha y hora', 'err'); return; }
  try {
    await api(`/ordenes?id=eq.${ordenId}`, 'PATCH', { cita_entrega: new Date(val).toISOString() });
    document.querySelectorAll(`.cita-popup[data-cita-id="${ordenId}"]`).forEach(p => p.remove());
    toast('Cita de recogida guardada ✓');
    abrirOrden(ordenId);
  } catch (e) { toast('Error: ' + e.message, 'err'); }
}

// ══════════════════════════════════════════════════════════════
// CIERRE DE ORDEN: preliquidación enviada obligatoria + PIN
// ══════════════════════════════════════════════════════════════

// Envía la preliquidación al cliente por WhatsApp y la marca como enviada
// (requisito para poder cerrar la orden).
async function enviarPreliquidacionCliente(ordenId) {
  try {
    const arr = await api(`/ordenes?id=eq.${ordenId}&select=placa,marca,linea,propietario,telefono`).catch(() => []);
    const o = arr && arr[0];
    if (!o) { toast('No se encontró la orden', 'err'); return; }
    const tel = _waNumero(o.telefono);
    if (!tel) { toast('El cliente no tiene celular registrado en la orden', 'err'); return; }
    const taller = (typeof _cotPdfConfig === 'function' && _cotPdfConfig().nombre) || 'Freimanautos';
    const nombre = (o.propietario || '').trim().split(' ')[0] || '';
    const veh    = [o.marca, o.linea].filter(Boolean).join(' ') || 'vehículo';
    const saludo = nombre ? `Hola ${nombre}, ` : 'Hola, ';
    const msg = `${saludo}le saluda ${taller}. Le compartimos la preliquidación de su ${veh} de placa ${o.placa} con el detalle de los trabajos y valores. Quedamos atentos a cualquier inquietud antes de la entrega. ¡Gracias! 📄`;
    window.open(`https://wa.me/${tel}?text=${encodeURIComponent(msg)}`, '_blank');
    await api(`/ordenes?id=eq.${ordenId}`, 'PATCH', { preliquidacion_enviada_en: new Date().toISOString() });
    toast('Preliquidación marcada como enviada ✓');
    abrirOrden(ordenId);
  } catch (e) { toast('Error: ' + e.message, 'err'); }
}

// Bloque del detalle: enviar preliquidación + cerrar con PIN.
function _bloquePreliqCierre(orden) {
  const enviada = !!orden.preliquidacion_enviada_en;
  let h = `<div style="background:#F8FAFC;border:1px solid var(--gris-borde);border-radius:8px;padding:10px;margin:8px 0">
    <div style="font-size:11px;font-weight:700;color:var(--gris-mid);margin-bottom:6px">Preliquidación al cliente</div>
    <div style="display:flex;gap:6px;margin-bottom:6px">
      <button class="btn btn-ghost btn-sm" style="flex:1" onclick="generarPreliquidacion(${orden.id},false)">📋 Sin precios</button>
      <button class="btn btn-ghost btn-sm" style="flex:1" onclick="generarPreliquidacion(${orden.id},true)">💰 Con precios</button>
    </div>
    <button class="btn btn-sm" style="width:100%;background:#25D366;border-color:#25D366;color:#fff" onclick="enviarPreliquidacionCliente(${orden.id})">📲 ${enviada ? 'Reenviar' : 'Enviar'} preliquidación (WhatsApp)</button>`;
  h += enviada
    ? `<div style="font-size:11px;color:var(--verde);font-weight:600;margin-top:6px">✓ Preliquidación enviada el ${formatTS(orden.preliquidacion_enviada_en)}</div>`
    : `<div style="font-size:11px;color:#B45309;margin-top:6px">⚠ Debes enviar la preliquidación al cliente antes de cerrar la orden.</div>`;
  h += `</div>`;
  // Botón cerrar (bloqueado hasta enviar la preliquidación) — requiere PIN
  h += enviada
    ? `<button class="btn btn-success" style="width:100%" onclick="intentarCerrarOrden(${orden.id})">🔒 Cerrar orden (con PIN)</button>`
    : `<button class="btn" style="width:100%;opacity:.45;cursor:not-allowed" disabled>🔒 Cerrar orden (con PIN)</button>`;
  h += `<div style="text-align:center;margin-top:4px"><button class="btn btn-ghost btn-sm" style="font-size:10px;color:var(--gris-mid)" onclick="configurarPinCierre()">⚙ Configurar PIN de cierre</button></div>`;
  return h;
}

// Verifica preliquidación enviada + abre el modal de PIN para cerrar.
async function intentarCerrarOrden(ordenId) {
  let o = (ordenActual && ordenActual.id === ordenId) ? ordenActual : null;
  if (!o) o = await api(`/ordenes?id=eq.${ordenId}`).then(r => r && r[0]).catch(() => null);
  if (!o) { toast('Orden no encontrada', 'err'); return; }
  if (!o.preliquidacion_enviada_en) { toast('Primero envía la preliquidación al cliente', 'err'); return; }
  pedirPin(() => cambiarEstado('Entregada'), 'Cerrar orden', 'Ingresa el PIN del jefe / gerente para cerrar.');
}

// Archivar orden (eliminación reversible) — requiere PIN.
function archivarOrden(ordenId) {
  pedirPin(async () => {
    try {
      await api(`/ordenes?id=eq.${ordenId}`, 'PATCH', { estado: 'Archivada' });
      toast('Orden archivada ✓');
      if (typeof navJefe === 'function') navJefe('ordenes');
    } catch (e) { toast('Error: ' + e.message, 'err'); }
  }, 'Archivar orden', 'Se ocultará de las listas (reversible). Ingresa el PIN.');
}

// Historial del vehículo: todas las visitas (órdenes) de una placa, con fechas
// y qué se le hizo. Incluye las archivadas/entregadas.
async function verHistorialVehiculo(placa) {
  if (!placa) return;
  try {
    const ords = await api(`/ordenes?placa=eq.${encodeURIComponent(placa)}&order=creado_en.desc&select=id,numero_ot,estado,ingreso_en,creado_en,entregada_en,marca,linea`).catch(() => []) || [];
    if (!ords.length) { toast('Sin historial para esta placa'); return; }
    const ids = ords.map(o => o.id).join(',');
    const etapas = await api(`/etapas?orden_id=in.(${ids})&select=orden_id,servicio,valor`).catch(() => []) || [];
    const porOrden = {};
    etapas.forEach(e => { (porOrden[e.orden_id] = porOrden[e.orden_id] || []).push(e); });
    const srvNom = { latoneria: 'Latonería', pintura: 'Pintura', mecanica: 'Mecánica', adicionales: 'Adicionales' };
    const filas = ords.map(o => {
      const ini  = o.ingreso_en || o.creado_en;
      const fin  = o.entregada_en;
      const dias = ini ? Math.max(0, Math.round(((fin ? new Date(fin) : new Date()) - new Date(ini)) / 86400000)) : null;
      const ets  = porOrden[o.id] || [];
      const srvs = [...new Set(ets.map(e => srvNom[e.servicio] || e.servicio).filter(Boolean))];
      const valor = ets.reduce((s, e) => s + (e.valor || 0), 0);
      return `<div style="border:1px solid var(--gris-borde);border-radius:8px;padding:10px 12px;margin-bottom:8px;cursor:pointer" onclick="document.getElementById('hist-veh-modal')?.remove();abrirOrden(${o.id})">
        <div style="display:flex;justify-content:space-between;align-items:center;gap:8px">
          <span style="font-weight:700;font-family:'DM Mono',monospace">${otDe(o)}</span>
          <span style="font-size:11px;color:var(--gris-mid)">${formatFecha(ini)}${fin ? ` → ${formatFecha(fin)}` : ''}</span>
        </div>
        <div style="font-size:12px;color:var(--gris-mid);margin-top:4px">${o.estado || '—'}${dias != null ? ` · ${dias} día(s)` : ''}${valor > 0 ? ` · ${formatCOP(valor)}` : ''}</div>
        ${srvs.length ? `<div style="margin-top:5px">${srvs.map(s => `<span style="background:#EEF2FF;color:#3730A3;border-radius:5px;padding:1px 7px;margin-right:4px;font-size:11px">${escapeHtml(s)}</span>`).join('')}</div>` : ''}
      </div>`;
    }).join('');
    const veh = [ords[0].marca, ords[0].linea].filter(Boolean).join(' ');
    document.getElementById('hist-veh-modal')?.remove();
    const ov = document.createElement('div');
    ov.id = 'hist-veh-modal';
    ov.style.cssText = 'position:fixed;inset:0;z-index:10002;background:rgba(0,0,0,.5);display:flex;align-items:center;justify-content:center;padding:18px';
    ov.innerHTML = `
      <div style="background:#fff;border-radius:14px;max-width:480px;width:100%;max-height:85vh;display:flex;flex-direction:column;font-family:'DM Sans',sans-serif;box-shadow:0 10px 40px rgba(0,0,0,.3)">
        <div style="padding:16px 18px;border-bottom:1px solid var(--gris-borde);display:flex;justify-content:space-between;align-items:center">
          <div>
            <div style="font-size:16px;font-weight:800;color:var(--azul)">Historial · ${escapeHtml(placa)}</div>
            <div style="font-size:12px;color:var(--gris-mid)">${escapeHtml(veh || '')}${veh ? ' · ' : ''}${ords.length} visita(s)</div>
          </div>
          <button onclick="document.getElementById('hist-veh-modal').remove()" style="background:none;border:none;font-size:22px;cursor:pointer;color:var(--gris-mid);line-height:1">×</button>
        </div>
        <div style="padding:14px 18px;overflow-y:auto">${filas}</div>
      </div>`;
    ov.addEventListener('click', e => { if (e.target === ov) ov.remove(); });
    document.body.appendChild(ov);
  } catch (e) { toast('Error cargando historial: ' + e.message, 'err'); }
}

// Eliminar PERMANENTEMENTE una orden archivada (con PIN + confirmación).
// Borra primero los registros hijos para evitar conflictos de llaves foráneas.
function eliminarOrdenPermanente(ordenId) {
  pedirPin(async () => {
    if (!confirm('¿ELIMINAR PERMANENTEMENTE esta orden y todos sus datos (etapas, fotos, repuestos)?\n\nEsta acción NO se puede deshacer.')) return;
    try {
      // Repuestos: borrar hijos de cada solicitud primero
      const sols = await api(`/solicitudes_repuesto?orden_id=eq.${ordenId}&select=id`).catch(() => []) || [];
      if (sols.length) {
        const ids = sols.map(s => s.id).join(',');
        await api(`/cotizaciones_repuesto?solicitud_id=in.(${ids})`, 'DELETE').catch(() => {});
        await api(`/solicitud_items?solicitud_id=in.(${ids})`, 'DELETE').catch(() => {});
      }
      await api(`/solicitudes_repuesto?orden_id=eq.${ordenId}`, 'DELETE').catch(() => {});
      // Hijos directos de la orden
      await api(`/aprobaciones_etapa?orden_id=eq.${ordenId}`, 'DELETE').catch(() => {});
      await api(`/fotos_etapas?orden_id=eq.${ordenId}`, 'DELETE').catch(() => {});
      await api(`/fotos_ingreso?orden_id=eq.${ordenId}`, 'DELETE').catch(() => {});
      await api(`/novedades?orden_id=eq.${ordenId}`, 'DELETE').catch(() => {});
      await api(`/etapas?orden_id=eq.${ordenId}`, 'DELETE').catch(() => {});
      // Cotizaciones del cliente: desligar (conservar el histórico)
      await api(`/cotizaciones?orden_id=eq.${ordenId}`, 'PATCH', { orden_id: null }).catch(() => {});
      // Finalmente, la orden
      await api(`/ordenes?id=eq.${ordenId}`, 'DELETE');
      toast('Orden eliminada permanentemente ✓');
      if (typeof navJefe === 'function') navJefe('ordenes');
      else cargarOrdenes();
    } catch (e) { toast('Error eliminando: ' + e.message, 'err'); }
  }, 'Eliminar orden', 'ELIMINACIÓN PERMANENTE. Ingresa el PIN para confirmar.');
}

async function _getPinCierre() {
  try {
    const r = await api(`/config_app?clave=eq.pin_cierre&select=valor`).catch(() => []);
    return (r && r[0] && r[0].valor) ? String(r[0].valor) : null;
  } catch (e) { return null; }
}
async function _setPinCierre(pin) {
  await api(`/config_app`, 'POST', { clave: 'pin_cierre', valor: String(pin) }, { Prefer: 'resolution=merge-duplicates' });
}

// PIN reutilizable: verifica el PIN y, si es correcto, ejecuta onOk().
let _pinCallback = null;
async function pedirPin(onOk, titulo, subtitulo) {
  const pin = await _getPinCierre();
  if (!pin) { toast('Primero configura el PIN'); configurarPinCierre(); return; }
  _pinCallback = onOk;
  document.getElementById('pin-cierre-modal')?.remove();
  const ov = document.createElement('div');
  ov.id = 'pin-cierre-modal';
  ov.style.cssText = 'position:fixed;inset:0;z-index:10002;background:rgba(0,0,0,.5);display:flex;align-items:center;justify-content:center;padding:18px';
  ov.innerHTML = `
    <div style="background:#fff;border-radius:14px;max-width:340px;width:100%;padding:22px;text-align:center;font-family:'DM Sans',sans-serif;box-shadow:0 10px 40px rgba(0,0,0,.3)">
      <div style="font-size:34px">🔒</div>
      <div style="font-size:16px;font-weight:800;color:var(--azul);margin:6px 0 2px">${titulo || 'Confirmar con PIN'}</div>
      <div style="font-size:12px;color:var(--gris-mid);margin-bottom:14px">${subtitulo || 'Ingresa el PIN del jefe de taller / gerente.'}</div>
      <input id="pin-cierre-input" type="password" inputmode="numeric" maxlength="8" autocomplete="off"
        style="width:100%;text-align:center;font-size:22px;letter-spacing:6px;padding:10px;border:1px solid var(--gris-borde);border-radius:8px;font-family:'DM Mono',monospace">
      <div id="pin-cierre-err" style="font-size:12px;color:#DC2626;height:16px;margin-top:6px"></div>
      <div style="display:flex;gap:8px;margin-top:8px">
        <button class="btn btn-ghost btn-sm" style="flex:1" onclick="document.getElementById('pin-cierre-modal').remove()">Cancelar</button>
        <button class="btn btn-primary btn-sm" style="flex:1" onclick="_confirmarPin()">Confirmar</button>
      </div>
    </div>`;
  ov.addEventListener('click', e => { if (e.target === ov) ov.remove(); });
  document.body.appendChild(ov);
  const inp = document.getElementById('pin-cierre-input');
  setTimeout(() => inp?.focus(), 50);
  inp?.addEventListener('keydown', e => { if (e.key === 'Enter') _confirmarPin(); });
}
async function _confirmarPin() {
  const inp = document.getElementById('pin-cierre-input');
  const err = document.getElementById('pin-cierre-err');
  const val = (inp && inp.value || '').trim();
  const pin = await _getPinCierre();
  if (val && pin && val === pin) {
    document.getElementById('pin-cierre-modal')?.remove();
    const cb = _pinCallback; _pinCallback = null;
    if (typeof cb === 'function') await cb();
  } else {
    if (err) err.textContent = 'PIN incorrecto';
    if (inp) { inp.value = ''; inp.focus(); }
  }
}

// Configurar / cambiar el PIN (requiere el PIN actual si ya existe).
async function configurarPinCierre() {
  const actual = await _getPinCierre();
  document.getElementById('pin-config-modal')?.remove();
  const ov = document.createElement('div');
  ov.id = 'pin-config-modal';
  ov.style.cssText = 'position:fixed;inset:0;z-index:10003;background:rgba(0,0,0,.5);display:flex;align-items:center;justify-content:center;padding:18px';
  ov.innerHTML = `
    <div style="background:#fff;border-radius:14px;max-width:360px;width:100%;padding:22px;font-family:'DM Sans',sans-serif;box-shadow:0 10px 40px rgba(0,0,0,.3)">
      <div style="font-size:16px;font-weight:800;color:var(--azul);margin-bottom:2px">${actual ? 'Cambiar' : 'Configurar'} PIN de cierre</div>
      <div style="font-size:12px;color:var(--gris-mid);margin-bottom:14px">Solo el jefe de taller y el gerente deben conocerlo.</div>
      ${actual ? `<input id="pin-cfg-actual" type="password" inputmode="numeric" maxlength="8" placeholder="PIN actual" style="width:100%;padding:9px;border:1px solid var(--gris-borde);border-radius:8px;font-family:'DM Mono',monospace;margin-bottom:8px">` : ''}
      <input id="pin-cfg-nuevo" type="password" inputmode="numeric" maxlength="8" placeholder="Nuevo PIN (4 a 8 dígitos)" style="width:100%;padding:9px;border:1px solid var(--gris-borde);border-radius:8px;font-family:'DM Mono',monospace">
      <div id="pin-cfg-err" style="font-size:12px;color:#DC2626;height:16px;margin-top:6px"></div>
      <div style="display:flex;gap:8px;margin-top:8px;justify-content:flex-end">
        <button class="btn btn-ghost btn-sm" onclick="document.getElementById('pin-config-modal').remove()">Cancelar</button>
        <button class="btn btn-primary btn-sm" onclick="_guardarPinCierre(${actual ? 1 : 0})">Guardar</button>
      </div>
    </div>`;
  ov.addEventListener('click', e => { if (e.target === ov) ov.remove(); });
  document.body.appendChild(ov);
}
async function _guardarPinCierre(requiereActual) {
  const err = document.getElementById('pin-cfg-err');
  const setErr = m => { if (err) err.textContent = m; };
  if (requiereActual) {
    const act = (document.getElementById('pin-cfg-actual')?.value || '').trim();
    const cur = await _getPinCierre();
    if (act !== cur) { setErr('PIN actual incorrecto'); return; }
  }
  const nuevo = (document.getElementById('pin-cfg-nuevo')?.value || '').trim();
  if (!/^\d{4,8}$/.test(nuevo)) { setErr('El PIN debe tener de 4 a 8 dígitos'); return; }
  try {
    await _setPinCierre(nuevo);
    document.getElementById('pin-config-modal')?.remove();
    toast('PIN de cierre guardado ✓');
  } catch (e) { setErr('Error guardando: ' + e.message); }
}

async function crearOrden() {
  const placa = document.getElementById('n-placa')?.value.trim().toUpperCase();
  if (!placa) { toast('La placa es obligatoria', 'err'); document.getElementById('n-placa')?.focus(); return; }

  // Tipo de cliente OBLIGATORIO
  const tipoClienteVal = document.getElementById('n-tipo-cliente')?.value;
  if (!tipoClienteVal) {
    const errEl = document.getElementById('n-tipo-cliente-error');
    if (errEl) errEl.style.display = 'block';
    document.getElementById('tipo-cliente-grid')?.scrollIntoView({ behavior:'smooth', block:'center' });
    toast('Selecciona el tipo de cliente', 'err');
    return;
  }
  const errElTc = document.getElementById('n-tipo-cliente-error');
  if (errElTc) errElTc.style.display = 'none';

  // KM (opcional si se marcó "Sin odómetro")
  const kmOmitir = document.getElementById('n-km-omitir')?.checked || false;
  const kmVal = document.getElementById('n-km')?.value;
  if (!kmOmitir && (!kmVal || parseInt(kmVal) < 0)) { toast('El kilometraje es obligatorio (o marca "Sin odómetro")', 'err'); document.getElementById('n-km')?.focus(); return; }

  const cedulaCliente = document.getElementById('n-cedula-cliente')?.value.trim() || '';
  const vin = document.getElementById('n-vin')?.value.trim().toUpperCase() || null;
  const correoCliente = document.getElementById('n-correo-cliente')?.value.trim() || null;

  // Validar VIN si fue ingresado
  if (vin && vin.length !== 17) { toast('El VIN debe tener exactamente 17 caracteres', 'err'); return; }
  if (vin && !/^[A-HJ-NPR-Z0-9]{17}$/.test(vin)) { toast('VIN inválido — solo mayúsculas y números (sin I, O, Q)', 'err'); return; }
  if (correoCliente && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correoCliente)) { toast('Correo electrónico inválido', 'err'); return; }

  const invItems = {};
  document.querySelectorAll('.inv-item input[type=checkbox]').forEach(chk => { invItems[chk.value] = chk.checked; });

  let clienteId = null;
  if (cedulaCliente) {
    try {
      let cl = await api(`/clientes?cedula_nit=eq.${cedulaCliente}`);
      if (cl?.length) {
        clienteId = cl[0].id;
      } else {
        const nombre = document.getElementById('n-propietario')?.value || null;
        const telefono = document.getElementById('n-telefono')?.value || null;
        const nuevo = await api('/clientes?select=id', 'POST', { cedula_nit: cedulaCliente, nombre, celular: telefono }, { Prefer: 'return=representation' });
        clienteId = nuevo[0].id;
      }
    } catch(e) { console.warn('Error creando cliente:', e); }
  }

  const body = {
    placa,
    // Número de OT manual (opcional). Si queda vacío, se muestra el automático
    // OT-#### basado en el id de la orden.
    numero_ot: document.getElementById('n-numero-ot')?.value.trim() || null,
    // Campo "aseguradora" = nombre de la organización (aseguradora / flotilla /
    // empresa). El tipo real lo distingue tipo_cliente. Así el vehículo queda
    // ligado a su empresa/flotilla aunque el propietario sea una persona.
    aseguradora: (() => {
      const tipo = document.getElementById('n-tipo-cliente')?.value || '';
      if (tipo === 'aseguradora') return document.getElementById('n-aseguradora-sel')?.value || null;
      if (tipo === 'flotilla')    return document.getElementById('n-flotilla-sel')?.value || null;
      if (tipo === 'empresa')     return document.getElementById('n-empresa-sel')?.value || null;
      return null;
    })(),
    marca: document.getElementById('n-marca')?.value || null,
    linea: document.getElementById('n-linea')?.value || null,
    modelo: document.getElementById('n-modelo')?.value || null,
    color: document.getElementById('n-color')?.value || null,
    propietario: document.getElementById('n-propietario')?.value || null,
    telefono: document.getElementById('n-telefono')?.value || null,
    tipo_cliente: (() => {
      const persona = document.querySelector('input[name="n-tipo-persona"]:checked')?.value || 'natural';
      if (persona === 'empresa') return 'empresa';
      return document.getElementById('n-tipo-cliente')?.value || null;
    })(),
    nivel_dano: document.getElementById('n-dano')?.value || null,
    kilometraje: kmOmitir ? null : (parseInt(document.getElementById('n-km')?.value) || null),
    fecha_entrega_1: document.getElementById('n-fecha1')?.value || null,
    fecha_entrega_2: document.getElementById('n-fecha2')?.value || null,
    descripcion_general: document.getElementById('n-descripcion-general')?.value.trim() || null,
    tipo_carroceria: document.getElementById('n-tipo-carroceria')?.value || null,
    danos_vehiculo: (() => {
      const d = {};
      document.querySelectorAll('.dano-cb:checked').forEach(cb => {
        const [zona, tipo] = cb.value.split(':');
        if (!d[zona]) d[zona] = [];
        d[zona].push(tipo);
      });
      return Object.keys(d).length ? JSON.stringify(d) : null;
    })(),
    inventario: JSON.stringify({ items: invItems, observaciones: document.getElementById('n-inv-obs')?.value.trim() || null }),
    // Nueva orden = vehículo que ingresa ahora (Activa). Para programar un
    // ingreso futuro se usa "Agendar ingreso" en el Calendario.
    estado: 'Activa',
    ingreso_en: new Date().toISOString(),
    cliente_id: clienteId,
    vin: vin || null,
    correo_cliente: correoCliente || null
  };

  try {
    const completando = _ordenCompletandoId;
    let ordenId;
    if (completando) {
      // Completar una orden agendada (Programada): actualizar con todos los
      // datos y activarla (el body ya trae estado:'Activa' e ingreso_en:ahora).
      await api(`/ordenes?id=eq.${completando}`, 'PATCH', body);
      ordenId = completando;
      _ordenCompletandoId = null;
    } else {
      const res = await api('/ordenes?select=id', 'POST', body, { Prefer: 'return=representation' });
      ordenId = res[0].id;
    }

    if (fotosIngresoPendientes.length) {
      const prog = document.getElementById('prog-ingreso');
      if (prog) prog.textContent = `Subiendo fotos 0/${fotosIngresoPendientes.length}...`;
      let sub = 0;
      for (const file of fotosIngresoPendientes) {
        try {
          const ext = file.name.split('.').pop();
          const path = `${ordenId}/ingreso/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
          const url = await storageUpload(file, path);
          await api('/fotos_ingreso', 'POST', { orden_id: ordenId, url, nombre: file.name }, { Prefer: 'return=minimal' });
          sub++;
          if (prog) prog.textContent = `Subiendo fotos ${sub}/${fotosIngresoPendientes.length}...`;
        } catch(e) { console.error(e); }
      }
      if (prog) prog.textContent = '';
    }

    resetNuevaOrden();
    fotosIngresoPendientes = [];
    modalOrdenId = ordenId;
    toast(completando ? '✓ Vehículo recibido — orden activada' : 'Orden creada ✓');
    abrirModalServicios();
  } catch(e) { toast('Error: ' + e.message, 'err'); }
}

// ============================================================
// MODAL SERVICIOS
// ============================================================
function abrirModalServicios() {
  srvSeleccionados = [];
  modalPaso = 1;
  document.querySelectorAll('.srv-card-select').forEach(c => c.classList.remove('selected'));
  const errorDiv = document.getElementById('srv-error');
  if (errorDiv) errorDiv.style.display = 'none';
  const titulo = document.getElementById('modal-srv-titulo');
  if (titulo) titulo.textContent = 'Paso 1 — Servicios';
  const backBtn = document.getElementById('btn-back');
  if (backBtn) backBtn.style.display = 'none';
  const nextBtn = document.getElementById('btn-next');
  if (nextBtn) nextBtn.textContent = 'Continuar →';
  const paso1 = document.getElementById('paso-1');
  const paso2 = document.getElementById('paso-2');
  if (paso1) paso1.classList.add('active');
  if (paso2) paso2.classList.remove('active');
  const modal = document.getElementById('modal-servicios');
  if (modal) modal.classList.add('show');
}

function cerrarModalServicios() {
  const modal = document.getElementById('modal-servicios');
  if (modal) modal.classList.remove('show');
  if (modalOrdenId) { 
    cargarOrdenes(); 
    abrirOrden(modalOrdenId); 
    modalOrdenId = null; 
  }
}

function toggleServicio(srv) {
  const card = document.getElementById('srv-' + srv);
  if (card) card.classList.toggle('selected');
  if (srvSeleccionados.includes(srv)) {
    srvSeleccionados = srvSeleccionados.filter(s => s !== srv);
  } else {
    srvSeleccionados.push(srv);
  }
}

function modalNext() {
  if (modalPaso === 1) {
    if (!srvSeleccionados.length) { 
      const error = document.getElementById('srv-error');
      if (error) error.style.display = 'block';
      return; 
    }
    const error = document.getElementById('srv-error');
    if (error) error.style.display = 'none';
    buildChecklist('checklist-nuevo', srvSeleccionados, []);
    const paso1 = document.getElementById('paso-1');
    const paso2 = document.getElementById('paso-2');
    if (paso1) paso1.classList.remove('active');
    if (paso2) paso2.classList.add('active');
    const backBtn = document.getElementById('btn-back');
    if (backBtn) backBtn.style.display = '';
    const nextBtn = document.getElementById('btn-next');
    if (nextBtn) nextBtn.textContent = 'Guardar etapas ✓';
    modalPaso = 2;
  } else {
    guardarEtapasNueva();
  }
}

function modalBack() {
  const paso1 = document.getElementById('paso-1');
  const paso2 = document.getElementById('paso-2');
  if (paso1) paso1.classList.add('active');
  if (paso2) paso2.classList.remove('active');
  const backBtn = document.getElementById('btn-back');
  if (backBtn) backBtn.style.display = 'none';
  const nextBtn = document.getElementById('btn-next');
  if (nextBtn) nextBtn.textContent = 'Continuar →';
  const titulo = document.getElementById('modal-srv-titulo');
  if (titulo) titulo.textContent = 'Paso 1 — Servicios';
  modalPaso = 1;
}

const ROLES_EXCLUIR = ['taller', 'repuestos', 'Asesor Previsora'];

function buildChecklist(containerId, servicios, existentes) {
  const container = document.getElementById(containerId);
  if (!container) return;
  const mecElegibles = mecanicos.filter(m => !ROLES_EXCLUIR.includes(m.rol));
  container.innerHTML = servicios.map(srvKey => {
    const srv = CATALOGO[srvKey];
    if (!srv) return '';
    const items = srv.etapas.map(et => {
      const ex = existentes.find(e => e.etapa_key === et.key);
      const iniciada = !!ex?.inicio;
      const checked = !!ex;
      const dis = iniciada ? 'disabled' : '';
      const mecSelected = ex?.mecanico_id ?? '';
      const extraHtml = (et.tot || et.otro) ? `<div class="extra-input${checked ? ' show' : ''}" id="extra-${et.key}">
        <input type="text" placeholder="${et.tot ? '¿Quién es el tercero?' : 'Especifica cuál...'}" style="font-size:13px;margin-top:4px">
      </div>` : '';
      const mecsFiltrados = mecElegibles;
      // Para "Desarmado": al cambiar técnico, auto-rellena "Armado" con el mismo
      const onChangeArmado = et.esDesarmado
        ? `onchange="_autoFillArmado(this.value,'${containerId}')"`
        : '';
      const mecHtml = !iniciada ? `<div class="mec-select-wrap" id="mec-${et.key}" style="margin-top:6px;display:${checked ? 'block' : 'none'}">
        <select id="mec-sel-${et.key}" style="font-size:13px" ${onChangeArmado}>
          <option value="">— Asignar técnico * —</option>
          ${mecsFiltrados.map(m => `<option value="${m.id}" ${m.id == mecSelected ? ' selected' : ''}>${escapeHtml(m.nombre)}</option>`).join('')}
        </select>
      </div>` : `<div style="font-size:11px;color:var(--gris-mid);margin-top:4px">Técnico ya asignado</div>`;
      const camposHtml = !iniciada ? `
        <div class="etapa-extra-campos" id="campos-${et.key}" style="display:${checked ? 'block' : 'none'};margin-top:8px;padding:10px;background:var(--gris-bg);border-radius:6px;border:1px solid var(--gris-borde)">
          <div style="display:grid;grid-template-columns:1fr 80px 110px;gap:8px">
            <div><label style="font-size:10px;font-weight:600;letter-spacing:1px;text-transform:uppercase;color:var(--gris-mid);display:block;margin-bottom:3px">Descripción</label>
              <textarea id="desc-et-${et.key}" placeholder="Detalle del trabajo a realizar..." style="width:100%;padding:7px 9px;border:1.5px solid var(--gris-borde);border-radius:5px;font-size:12px;min-height:72px;resize:vertical;box-sizing:border-box;line-height:1.4;font-family:inherit">${ex?.descripcion||''}</textarea></div>
            <div><label style="font-size:10px;font-weight:600;letter-spacing:1px;text-transform:uppercase;color:var(--gris-mid);display:block;margin-bottom:3px"># Horas</label>
              <input id="piezas-et-${et.key}" type="number" min="0" step="0.5" placeholder="0" style="width:100%;padding:7px 9px;border:1.5px solid var(--gris-borde);border-radius:5px;font-size:12px" value="${ex?.horas_estimadas||''}"></div>
            <div><label style="font-size:10px;font-weight:600;letter-spacing:1px;text-transform:uppercase;color:var(--gris-mid);display:block;margin-bottom:3px">Valor COP</label>
              <input id="valor-et-${et.key}" type="number" min="0" step="1000" placeholder="0" style="width:100%;padding:7px 9px;border:1.5px solid var(--gris-borde);border-radius:5px;font-size:12px" value="${ex?.valor||''}"></div>
          </div>
        </div>` : '';
      return `<div class="check-item">
        <input type="checkbox" id="chk-${et.key}" value="${et.key}" ${checked ? 'checked' : ''} ${dis}
          onchange="onChkChange('${et.key}', this.checked)">
        <div style="flex:1">
          <div class="check-item-label">${et.nombre}${iniciada ? ' <span style="font-size:10px;color:var(--gris-mid)">(ya iniciada)</span>' : ''}</div>
          ${extraHtml}${mecHtml}${camposHtml}
        </div>
      </div>`;
    }).join('');
    const cls = srv.clase;
    return `<div class="etapas-grupo">
      <span class="etapas-grupo-label badge-${cls}" style="background:var(--${cls === 'latoneria' ? 'rojo' : cls === 'pintura' ? 'amarillo' : cls === 'mecanica' ? 'azul' : 'verde'}-bg);color:${cls === 'latoneria' ? '#991B1B' : cls === 'pintura' ? 'var(--amarillo)' : cls === 'mecanica' ? 'var(--azul)' : 'var(--verde)'}">${srv.nombre}</span>
      ${items}
    </div>`;
  }).join('');
}

function onChkChange(key, checked) {
  const extra = document.getElementById('extra-' + key);
  if (extra) extra.classList.toggle('show', checked);
  const mecDiv = document.getElementById('mec-' + key);
  if (mecDiv) {
    mecDiv.classList.toggle('show', checked);
    mecDiv.style.display = checked ? 'block' : 'none';
  }
  const camposDiv = document.getElementById('campos-' + key);
  if (camposDiv) camposDiv.style.display = checked ? 'block' : 'none';

  // Si se selecciona "Desarmado", marcar "Armado" automáticamente al final
  if (key === 'lat_desarmado' && checked) {
    const chkArm = document.getElementById('chk-lat_armado');
    if (chkArm && !chkArm.checked && !chkArm.disabled) {
      chkArm.checked = true;
      onChkChange('lat_armado', true);
    }
  }
}

// Auto-rellena el técnico de "Armado" con el mismo de "Desarmado"
function _autoFillArmado(mecId, containerId) {
  const armSel = document.getElementById('mec-sel-lat_armado');
  if (!armSel) return;
  const chkArm = document.getElementById('chk-lat_armado');
  if (!chkArm?.checked) return;
  // Pre-llena si Armado no tiene técnico asignado aún
  if (!armSel.value || armSel.value === '') {
    armSel.value = mecId;
  }
}

function recogerChecklist(containerId) {
  const result = [];
  document.querySelectorAll(`#${containerId} input[type=checkbox]:checked:not(:disabled)`).forEach(chk => {
    const key = chk.value;
    let srvKey = null, etDef = null;
    for (const [sk, sv] of Object.entries(CATALOGO)) {
      const et = sv.etapas.find(e => e.key === key);
      if (et) { srvKey = sk; etDef = et; break; }
    }
    if (!etDef) return;
    const inp = document.querySelector(`#extra-${key} input`);
    const mecSel   = document.getElementById(`mec-sel-${key}`);
    const descEl   = document.getElementById(`desc-et-${key}`);
    const piezasEl = document.getElementById(`piezas-et-${key}`);
    const valorEl  = document.getElementById(`valor-et-${key}`);
    result.push({ 
      key, servicio: srvKey, nombre: etDef.nombre, 
      tercero:     inp?.value?.trim() || null, 
      mecanico_id: mecSel?.value ? parseInt(mecSel.value) : null,
      descripcion: descEl?.value?.trim() || null,
      horas_estimadas: piezasEl?.value ? parseFloat(piezasEl.value) : null,
      valor:       valorEl?.value ? parseFloat(valorEl.value) : null
    });
  });
  return result;
}

async function guardarEtapasNueva() {
  const etapas = recogerChecklist('checklist-nuevo');
  if (!etapas.length) { toast('Selecciona al menos una etapa', 'err'); return; }
  const sinMec = etapas.filter(et => !et.mecanico_id && !et.tercero);
  if (sinMec.length) { toast(`Asigna un mecánico a: ${sinMec.map(e => e.nombre).join(', ')}`, 'err'); return; }
  const sinValor = etapas.filter(et => et.valor == null || et.valor === '');
  if (sinValor.length) { toast(`Ingresa el valor de: ${sinValor.map(e => e.nombre).join(', ')}`, 'err'); return; }
  try {
    for (const et of etapas) {
      const mec = mecanicos.find(m => m.id === et.mecanico_id);
      await api('/etapas', 'POST', {
        orden_id: modalOrdenId, servicio: et.servicio, etapa_key: et.key, etapa: et.nombre,
        tercero: et.tercero || null, mecanico_id: et.mecanico_id || null, tecnico: mec?.nombre || null,
        descripcion: et.descripcion || null,
        horas_estimadas: et.horas_estimadas || null,
        valor: et.valor || null
      }, { Prefer: 'return=minimal' });
    }
    toast('Etapas guardadas ✓');
    document.getElementById('modal-servicios')?.classList.remove('show');

    const ordenData = await api(`/ordenes?id=eq.${modalOrdenId}`).catch(() => []);
    if (ordenData?.[0]) {
      const ord = ordenData[0];
      const primerasPorSrv = {};
      etapas.forEach(et => { if (!primerasPorSrv[et.servicio]) primerasPorSrv[et.servicio] = et; });
      for (const et of Object.values(primerasPorSrv)) {
        if (!et.mecanico_id) continue;
        fetch(N8N_WEBHOOK, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            evento: 'tecnico_asignado',
            orden: { id: ord.id, placa: ord.placa, propietario: ord.propietario, marca: ord.marca, linea: ord.linea, aseguradora: ord.aseguradora },
            siguiente_etapa: { id: null, nombre: et.nombre, servicio: et.servicio, mecanico_id: et.mecanico_id, tecnico: mecanicos.find(m => m.id === et.mecanico_id)?.nombre || null },
            todas_completadas: false,
            link: `${window.location.origin}${window.location.pathname}`
          }) 
        }).catch(() => {});
      }
      const fotosIng = await api(`/fotos_ingreso?orden_id=eq.${modalOrdenId}&order=creado_en.asc&limit=1`).catch(() => []) || [];
      fetch(N8N_WEBHOOK, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          evento: 'orden_creada', 
          orden: { id: ord.id, placa: ord.placa, propietario: ord.propietario, marca: ord.marca, linea: ord.linea, modelo: ord.modelo, color: ord.color, tipo_cliente: ord.tipo_cliente, aseguradora: ord.aseguradora, nivel_dano: ord.nivel_dano, fecha_entrega_1: ord.fecha_entrega_1 }, 
          etapas: etapas.map(et => ({ servicio: et.servicio, etapa: et.nombre, tecnico: mecanicos.find(m => m.id === et.mecanico_id)?.nombre || et.tercero || 'Sin asignar' })), 
          foto_url: fotosIng[0]?.url || null, 
          link: `${window.location.origin}${window.location.pathname}` 
        }) 
      }).catch(() => {});
    }
    cargarOrdenes(); 
    if (modalOrdenId) abrirOrden(modalOrdenId); 
    modalOrdenId = null;
  } catch(e) { toast('Error: ' + e.message, 'err'); }
}

// ============================================================
// MODAL AGREGAR ETAPAS
// ============================================================
async function abrirModalAgregar() {
  if (!ordenActual) return;
  const [existentes] = await Promise.all([
    api(`/etapas?orden_id=eq.${ordenActual.id}&order=creado_en.asc`).catch(() => []),
    cargarMecanicos(),
  ]);
  buildChecklist('checklist-agregar', Object.keys(CATALOGO), existentes || []);
  const modal = document.getElementById('modal-agregar');
  if (modal) modal.classList.add('show');
}

function cerrarModalAgregar() { 
  const modal = document.getElementById('modal-agregar');
  if (modal) modal.classList.remove('show'); 
}

async function confirmarAgregarEtapas() {
  const etapas = recogerChecklist('checklist-agregar');
  if (!etapas.length) { toast('Selecciona al menos una etapa', 'err'); return; }
  const sinMec = etapas.filter(et => !et.mecanico_id && !et.tercero);
  if (sinMec.length) { toast(`Asigna un mecánico a: ${sinMec.map(e => e.nombre).join(', ')}`, 'err'); return; }
  const sinValor = etapas.filter(et => et.valor == null || et.valor === '');
  if (sinValor.length) { toast(`Ingresa el valor de: ${sinValor.map(e => e.nombre).join(', ')}`, 'err'); return; }
  try {
    for (const et of etapas) {
      const mec = mecanicos.find(m => m.id === et.mecanico_id);
      await api('/etapas', 'POST', { 
        orden_id: ordenActual.id, servicio: et.servicio, etapa_key: et.key, etapa: et.nombre, 
        tercero: et.tercero || null, mecanico_id: et.mecanico_id || null, tecnico: mec?.nombre || null,
        descripcion: et.descripcion || null,
        horas_estimadas: et.horas_estimadas || null,
        valor: et.valor || null
      }, { Prefer: 'return=minimal' });
    }
    toast('Etapas agregadas ✓');
    cerrarModalAgregar();
    if (ordenActual) abrirOrden(ordenActual.id);
  } catch(e) { toast('Error: ' + e.message, 'err'); }
}

// ============================================================
// FOTOS
// ============================================================

// Comprime una imagen usando Canvas antes de subirla.
// maxW: ancho máximo en px (alto se escala proporcionalmente)
// quality: 0-1 para JPEG
function comprimirImagen(file, maxW = 1280, quality = 0.82) {
  return new Promise((resolve, reject) => {
    // Si no es imagen o es muy pequeña, devolver sin cambios
    if (!file.type.startsWith('image/')) { resolve(file); return; }
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      let { width, height } = img;
      // Solo redimensionar si supera el máximo
      if (width > maxW) {
        height = Math.round((height * maxW) / width);
        width = maxW;
      }
      const canvas = document.createElement('canvas');
      canvas.width  = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, width, height);
      canvas.toBlob(blob => {
        if (!blob) { resolve(file); return; }
        // Crear un nuevo File con el blob comprimido
        const compressed = new File([blob], file.name.replace(/\.[^.]+$/, '.jpg'), { type: 'image/jpeg', lastModified: Date.now() });
        resolve(compressed);
      }, 'image/jpeg', quality);
    };
    img.onerror = () => { URL.revokeObjectURL(url); resolve(file); };
    img.src = url;
  });
}

async function subirFotos(input, nombre, eid, k) {
  const files = Array.from(input.files);
  if (!files.length) return;
  const prog = document.getElementById(`prog-${k}`);
  let sub = 0;
  for (const file of files) {
    try {
      if (prog) prog.textContent = `Comprimiendo ${sub + 1}/${files.length}...`;
      const fileComprimido = await comprimirImagen(file);
      const path = `${ordenActual.id}/etapas/${eid}_${Date.now()}.jpg`;
      const url = await storageUpload(fileComprimido, path);
      await api('/fotos_etapas', 'POST', { etapa_id: eid, orden_id: ordenActual.id, etapa_nombre: nombre, url, nombre: file.name }, { Prefer: 'return=minimal' });
      sub++;
      if (prog) prog.textContent = `Subiendo ${sub}/${files.length}...`;
    } catch(e) { toast(`Error: ${file.name}`, 'err'); }
  }
  if (prog) prog.textContent = '';
  input.value = '';
  toast(`${sub} foto(s) subida(s) ✓`);
  if (ordenActual) abrirOrden(ordenActual.id);
}

async function eliminarFoto(fotoId, url) {
  if (!confirm('¿Eliminar esta foto?')) return;
  try {
    await api(`/fotos_etapas?id=eq.${fotoId}`, 'DELETE');
    const path = url.split(`/object/public/${BUCKET}/`)[1];
    if (path) await fetch(`${SUPABASE_URL}/storage/v1/object/${BUCKET}/${path}`, { method: 'DELETE', headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${_getBearer()}` } });
    toast('Foto eliminada ✓');
    if (ordenActual) abrirOrden(ordenActual.id);
  } catch(e) { toast('Error: ' + e.message, 'err'); }
}

// ============================================================
// NOVEDADES
// ============================================================
async function guardarNovedad(eid) {
  const motivo = document.getElementById(`nmot-${eid}`)?.value?.trim();
  if (!motivo) { toast('El motivo es obligatorio', 'err'); return; }
  const tipo        = document.getElementById(`ntype-${eid}`)?.value;
  const responsable = document.getElementById(`nresp-${eid}`)?.value;
  const valorRaw    = parseFloat(document.getElementById(`nvalor-${eid}`)?.value);
  const valor       = valorRaw > 0 ? valorRaw : null;

  try {
    // Si tipo es Detenido, pausar la etapa primero
    if (tipo === 'Detenido') {
      await api(`/etapas?id=eq.${eid}`, 'PATCH', {
        pausado: true, pausa_inicio: new Date().toISOString()
      });
    }

    const payload = { orden_id: ordenActual.id, etapa_id: eid, tipo, responsable, motivo, desde: new Date().toISOString() };
    if (valor !== null) payload.valor_adicional = valor;

    await api('/novedades', 'POST', payload, { Prefer: 'return=minimal' });
    toast(tipo === 'Detenido' ? 'Etapa pausada y novedad registrada ✓' : 'Novedad registrada ✓');

    const input = document.getElementById(`nmot-${eid}`);
    if (input) input.value = '';
    const vinput = document.getElementById(`nvalor-${eid}`);
    if (vinput) vinput.value = '';
    if (ordenActual) abrirOrden(ordenActual.id);
  } catch(e) { toast('Error: ' + e.message, 'err'); }
}

// ============================================================
// APROBACIÓN DE CALIDAD
// ============================================================
async function abrirModalAprobacion(eid, nombre) {
  aprobEtapaId = eid;
  const titulo = document.getElementById('modal-aprob-titulo');
  if (titulo) titulo.textContent = `Calidad — ${nombre}`;
  const obs = document.getElementById('aprob-obs');
  if (obs) obs.value = '';
  document.querySelectorAll('input[name="aprob-estado"]').forEach(r => r.checked = false);
  const hist = await api(`/aprobaciones_etapa?etapa_id=eq.${eid}&order=creado_en.desc`).catch(() => []) || [];
  const histDiv = document.getElementById('aprob-historial');
  const histList = document.getElementById('aprob-historial-lista');
  if (hist.length && histList) {
    histList.innerHTML = hist.map(h => `
      <div class="aprob-box ${h.estado === 'rechazado' ? 'rechazado' : ''}" style="margin-bottom:8px">
        <div class="aprob-box-top">
          <span class="aprob-box-estado">${h.estado === 'aprobado' ? '✓ Aprobado' : '✗ Rechazado'}</span>
          <span class="aprob-box-fecha">${formatTS(h.creado_en)}</span>
        </div>
        <div style="font-size:12px;color:var(--gris-mid)">Por: ${escapeHtml(h.registrado_por)}</div>
        ${h.observacion ? `<div style="font-size:12px;margin-top:4px">${escapeHtml(h.observacion)}</div>` : ''}
      </div>`).join('');
    if (histDiv) histDiv.style.display = 'block';
  } else if (histDiv) {
    histDiv.style.display = 'none';
  }
  const modal = document.getElementById('modal-aprobacion');
  if (modal) modal.classList.add('show');
}

function cerrarModalAprobacion() { 
  const modal = document.getElementById('modal-aprobacion');
  if (modal) modal.classList.remove('show'); 
  aprobEtapaId = null; 
}

async function guardarAprobacion() {
  const estado = document.querySelector('input[name="aprob-estado"]:checked')?.value;
  const obs = document.getElementById('aprob-obs')?.value.trim() || '';
  if (!estado) { toast('Selecciona Aprobado o Rechazado', 'err'); return; }
  try {
    await api('/aprobaciones_etapa', 'POST', {
      etapa_id: aprobEtapaId, orden_id: ordenActual.id, estado,
      registrado_por: sesion?.nombre || 'Jefe', observacion: obs || null
    });
    toast(`Etapa ${estado} ✓`);
    cerrarModalAprobacion();

    // Si rechazó: notificar al mecánico que debe corregir
    if (estado === 'rechazado') {
      const etapaRech = await api(`/etapas?id=eq.${aprobEtapaId}&select=id,etapa,servicio,mecanico_id,tecnico`).then(r=>r?.[0]).catch(()=>null);
      if (etapaRech?.mecanico_id) {
        const mecRech = await api(`/mecanicos?id=eq.${etapaRech.mecanico_id}&select=nombre,telegram_chat_id`).then(r=>r?.[0]).catch(()=>null);
        fetch(N8N_WEBHOOK, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            evento: 'etapa_rechazada',
            telegram_chat_id: mecRech?.telegram_chat_id || null,
            orden: { id: ordenActual.id, placa: ordenActual.placa, propietario: ordenActual.propietario, marca: ordenActual.marca, linea: ordenActual.linea },
            etapa: { id: aprobEtapaId, nombre, servicio: etapaRech.servicio, tecnico: etapaRech.tecnico, mecanico_id: etapaRech.mecanico_id },
            observacion: document.getElementById('aprob-obs')?.value.trim() || '',
            rechazado_por: sesion?.nombre || 'Jefe',
            link: `${window.location.origin}${window.location.pathname}`
          })
        }).catch(() => {});
      }
    }

    // Si aprobó, verificar si TODAS las etapas de la orden quedaron aprobadas
    if (estado === 'aprobado') {
      const [etapas, aprobaciones] = await Promise.all([
        api(`/etapas?orden_id=eq.${ordenActual.id}&select=id`).catch(() => []),
        api(`/aprobaciones_etapa?orden_id=eq.${ordenActual.id}&order=creado_en.desc&select=etapa_id,estado`).catch(() => [])
      ]);
      // Tomar el estado más reciente por etapa
      const ultimaPorEtapa = {};
      aprobaciones.forEach(a => { if (!ultimaPorEtapa[a.etapa_id]) ultimaPorEtapa[a.etapa_id] = a.estado; });
      const todasAprobadas = etapas.length > 0 && etapas.every(e => ultimaPorEtapa[e.id] === 'aprobado');
      if (todasAprobadas) {
        fetch(N8N_WEBHOOK, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            evento: 'orden_calidad_aprobada',
            orden: { id: ordenActual.id, placa: ordenActual.placa, propietario: ordenActual.propietario, marca: ordenActual.marca, linea: ordenActual.linea },
            aprobado_por: sesion?.nombre || 'Jefe',
            link: `${window.location.origin}${window.location.pathname}`
          })
        }).catch(() => {});
      }
    }

    if (ordenActual) abrirOrden(ordenActual.id);
  } catch(e) { toast('Error: ' + e.message, 'err'); }
}

// ============================================================
// CAPACIDAD (helper)
// ============================================================
function _refrescarCapacidad() {
  const ok = [true, true, true];
  Promise.all([
    api('/ordenes?estado=eq.Activa&pulmon=eq.false&select=id').catch(() => { ok[0] = false; return []; }),
    api('/ordenes?pulmon=eq.true&pulmon_tipo=eq.interno&select=id').catch(() => { ok[1] = false; return []; }),
    api('/ordenes?pulmon=eq.true&pulmon_tipo=eq.externo&select=id').catch(() => { ok[2] = false; return []; })
  ]).then(([activas, pulmonInterno, pulmonExterno]) => {
    if (ok[0] && ok[1] && ok[2]) actualizarCapacidad(activas.length, pulmonInterno.length, pulmonExterno.length);
  });
}

function _setPulmonUI(activo, tipo) {
  const card  = document.getElementById('pulmon-card');
  const badge = document.getElementById('d-pulmon-badge');
  const btn   = document.getElementById('btn-pulmon');
  if (card)  card.classList.toggle('inactivo', !activo);
  if (badge) {
    if (activo) {
      badge.innerHTML = `En pulmón${tipo ? ` · <strong>${tipo.charAt(0).toUpperCase()+tipo.slice(1)}</strong>` : ''} desde ${formatFecha(ordenActual.pulmon_desde)}`;
      badge.style.color = 'var(--amarillo)';
    } else if (ordenActual.pulmon_fin && ordenActual.pulmon_desde) {
      const tiempo = _calcPulmonTiempo(ordenActual.pulmon_desde, ordenActual.pulmon_fin);
      badge.innerHTML = `<span style="color:var(--verde,#10B981)">✓ Salió de pulmón</span> · estuvo <strong>${tiempo}</strong>${tipo ? ` (${tipo})` : ''}`;
      badge.style.color = 'var(--gris-mid)';
    } else {
      badge.textContent = 'Sin pulmón activo';
      badge.style.color = 'var(--gris-mid)';
    }
  }
  if (btn) btn.textContent = activo ? 'Sacar de pulmón' : 'Activar Pulmón';
}

// ============================================================
// PULMÓN
// ============================================================
function _calcPulmonTiempo(desde, fin) {
  const min = Math.round((new Date(fin) - new Date(desde)) / 60000);
  if (min < 1) return '< 1m';
  const d = Math.floor(min / 1440);
  const h = Math.floor((min % 1440) / 60);
  const m = min % 60;
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function togglePulmon() {
  if (ordenActual.pulmon) {
    _desactivarPulmon();
  } else {
    document.getElementById('modal-pulmon-tipo')?.classList.add('show');
  }
}

function cerrarModalPulmonTipo() {
  document.getElementById('modal-pulmon-tipo')?.classList.remove('show');
}

async function activarPulmonCon(tipo) {
  cerrarModalPulmonTipo();
  const ahora = new Date().toISOString();
  const patch = { pulmon: true, pulmon_desde: ahora, pulmon_tipo: tipo };
  try {
    await api(`/ordenes?id=eq.${ordenActual.id}`, 'PATCH', patch);
    ordenActual.pulmon = true;
    ordenActual.pulmon_desde = ahora;
    ordenActual.pulmon_tipo = tipo;
    _setPulmonUI(true, tipo);
    toast(`Orden en pulmón ${tipo.charAt(0).toUpperCase()+tipo.slice(1)} ✓`);
    _refrescarCapacidad();
  } catch(e) { toast('Error: ' + e.message, 'err'); }
}

async function _desactivarPulmon() {
  const ahora = new Date().toISOString();
  // Guardamos pulmon_fin y NO borramos pulmon_desde — queda el historial
  const patch = { pulmon: false, pulmon_fin: ahora };
  try {
    await api(`/ordenes?id=eq.${ordenActual.id}`, 'PATCH', patch);
    ordenActual.pulmon     = false;
    ordenActual.pulmon_fin = ahora;
    // pulmon_desde y pulmon_tipo se conservan para mostrar historial
    _setPulmonUI(false, ordenActual.pulmon_tipo || '');
    toast('Pulmón desactivado ✓');
    _refrescarCapacidad();
    cargarOrdenesPulmon(); // refrescar lista pulmón para que desaparezca
  } catch(e) { toast('Error: ' + e.message, 'err'); }
}


// ============================================================
// ESTADO ORDEN (JEFE)
// ============================================================
async function cambiarEstado(v) {
  try {
    const patch = { estado: v };
    if (v === 'Entregada') patch.entregada_en = new Date().toISOString();
    await api(`/ordenes?id=eq.${ordenActual.id}`, 'PATCH', patch);
    ordenActual.estado = v;
    toast(`Estado: ${v} ✓`);
    if (filtroEstado === null) await cargarOrdenesPulmon();
    else await cargarOrdenes();
    if (ordenActual) abrirOrden(ordenActual.id);
  } catch(e) { toast('Error: ' + e.message, 'err'); }
}

async function recibirVehiculo(ordenId) {
  // Abre el formulario completo PRE-LLENADO con lo agendado, para completar
  // kilometraje, inventario, daños, etc. Al guardar, activa la orden (PATCH).
  let orden;
  try {
    orden = (await api(`/ordenes?id=eq.${ordenId}&limit=1`).catch(() => []))?.[0];
  } catch(e) { toast('Error: ' + e.message, 'err'); return; }
  if (!orden) { toast('Orden no encontrada', 'err'); return; }

  navJefe('nueva'); // abre y resetea el formulario (resetNuevaOrden limpia el modo)

  setTimeout(() => {
    _ordenCompletandoId = ordenId; // activar modo "completar" DESPUÉS del reset

    const set = (id, val) => { const el = document.getElementById(id); if (el && val != null && val !== '') el.value = val; };
    set('n-placa', orden.placa);
    set('n-numero-ot', orden.numero_ot);
    set('n-marca', orden.marca);
    set('n-linea', orden.linea);
    set('n-modelo', orden.modelo);
    set('n-color', orden.color);
    set('n-vin', orden.vin);
    set('n-propietario', orden.propietario);
    set('n-telefono', orden.telefono);
    set('n-cedula-cliente', orden.cedula_cliente);
    set('n-correo-cliente', orden.correo_cliente);

    // Tipo de cliente
    const tipo  = orden.tipo_cliente || 'particular';
    const tabId = tipo === 'aseguradora' ? 'tcb-aseguradora'
                : tipo === 'flotilla'    ? 'tcb-flotilla'
                : tipo === 'empresa'     ? 'tcb-empresa'
                : 'tcb-particular';
    const tab = document.getElementById(tabId);
    if (tab && typeof selTipoCliente === 'function') selTipoCliente(tab, tipo);
    if (orden.aseguradora) {
      const selId = tipo === 'aseguradora' ? 'n-aseguradora-sel' : tipo === 'flotilla' ? 'n-flotilla-sel' : tipo === 'empresa' ? 'n-empresa-sel' : null;
      if (selId) setTimeout(() => { const sel = document.getElementById(selId); if (sel) sel.value = orden.aseguradora; }, 250);
    }

    const resultDiv = document.getElementById('placa-resultado');
    if (resultDiv) {
      resultDiv.className = 'placa-resultado encontrado';
      resultDiv.innerHTML = `📥 Completando ingreso de <strong>${escapeHtml(orden.placa || '')}</strong>. Agrega kilometraje, inventario y daños; al guardar se activará la orden.`;
      resultDiv.style.display = 'block';
    }
    toast(`Completa los datos de ${orden.placa} para activar`);
  }, 320);
}

// ============================================================
// MECÁNICOS (cargar lista)
// ============================================================
async function cargarMecanicos() {
  try {
    mecanicos = await api('/mecanicos?activo=eq.true&order=nombre.asc') || [];
  } catch(e) { 
    mecanicos = []; 
  }
}
// ============================================================
// NAVEGACIÓN JEFE
// ============================================================
function montarJefe() {
  const sidebarNav = document.getElementById('sidebar-nav');
  if (sidebarNav) {
    // Estado guardado de grupos abiertos/cerrados
    const _grupAbiertos = JSON.parse(localStorage.getItem('nav_grupos') || '{"operaciones":true,"comercial":true,"registro":false,"informes":false,"aseguradoras":false}');

    const _toggleGrupo = (id) => {
      _grupAbiertos[id] = !_grupAbiertos[id];
      localStorage.setItem('nav_grupos', JSON.stringify(_grupAbiertos));
      const cont = document.getElementById('nav-grupo-' + id);
      const chevron = document.getElementById('nav-chevron-' + id);
      if (cont) {
        clearTimeout(cont._animT);
        if (_grupAbiertos[id]) {
          // Abrir: 0 → altura real (suave), luego liberar a 'none'
          cont.style.display = 'block';
          cont.style.maxHeight = '0px';
          cont.style.opacity = '0';
          void cont.offsetHeight; // forzar reflow
          cont.style.maxHeight = cont.scrollHeight + 'px';
          cont.style.opacity = '1';
          cont._animT = setTimeout(() => { if (_grupAbiertos[id]) cont.style.maxHeight = 'none'; }, 340);
        } else {
          // Cerrar: fijar altura actual → 0
          cont.style.maxHeight = cont.scrollHeight + 'px';
          void cont.offsetHeight; // forzar reflow
          cont.style.maxHeight = '0px';
          cont.style.opacity = '0';
          cont._animT = setTimeout(() => { if (!_grupAbiertos[id]) cont.style.display = 'none'; }, 340);
        }
      }
      if (chevron) chevron.style.transform = _grupAbiertos[id] ? 'rotate(0deg)' : 'rotate(-90deg)';
    };
    window._navToggleGrupo = _toggleGrupo;

    const _grupoHeader = (id, label) => `
      <button onclick="_navToggleGrupo('${id}')" style="width:100%;display:flex;align-items:center;justify-content:space-between;padding:14px 12px 5px;background:none;border:none;cursor:pointer;transition:opacity .15s" onmouseover="this.style.opacity='.75'" onmouseout="this.style.opacity='1'">
        <span class="nav-section-label">${label}</span>
        <svg id="nav-chevron-${id}" width="13" height="13" fill="none" stroke="white" stroke-width="2.5" viewBox="0 0 24 24" style="flex-shrink:0;transition:transform .2s;transform:rotate(${_grupAbiertos[id]?'0':'-90'}deg);opacity:.8"><polyline points="6 9 12 15 18 9"/></svg>
      </button>
      <div id="nav-grupo-${id}" class="nav-grupo-body"${_grupAbiertos[id]?'':' style="display:none"'}>`;

    sidebarNav.innerHTML = `
      ${_grupoHeader('operaciones','Gestión Operativa')}
        <button class="nav-item" id="nav-taller-kpi" onclick="navJefe('taller-kpi')">
          <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>
          <span class="nav-label">Gestión Operativa</span>
        </button>
        <button class="nav-item active" id="nav-ordenes" onclick="navJefe('ordenes')">
          <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/></svg>
          <span class="nav-label">Órdenes</span>
        </button>
        <button class="nav-item" id="nav-nueva" onclick="navJefe('nueva')">
          <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 8v8M8 12h8"/></svg>
          <span class="nav-label">Nueva orden</span>
        </button>
        <button class="nav-item" id="nav-calendario" onclick="navJefe('calendario')">
          <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
          <span class="nav-label">Calendario</span>
        </button>
        <button class="nav-item" id="nav-mecanicos" onclick="navJefe('mecanicos')">
          <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/></svg>
          <span class="nav-label">Operarios</span>
        </button>
      </div>

      ${_grupoHeader('comercial','Comercial')}
        <button class="nav-item" id="nav-cotizaciones" onclick="navJefe('cotizaciones')">
          <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><path d="M14 2v6h6M16 13H8M16 17H8M10 9H8"/></svg>
          <span class="nav-label">Cotizaciones</span>
        </button>
        <button class="nav-item" id="nav-repuestos" onclick="navJefe('repuestos')">
          <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M20 7H4a2 2 0 00-2 2v6a2 2 0 002 2h16a2 2 0 002-2V9a2 2 0 00-2-2z"/><path d="M16 21V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v16"/></svg>
          <span class="nav-label">Repuestos</span>
        </button>
      </div>

      ${_grupoHeader('registro','Registro')}
        <button class="nav-item" id="nav-vehiculos-lista" onclick="navJefe('vehiculos-lista')">
          <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>
          <span class="nav-label">Vehículos ingresados</span>
        </button>
        <button class="nav-item" id="nav-vehiculos" onclick="navJefe('vehiculos')">
          <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M5 17H3a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11a2 2 0 0 1 2 2v3"/><rect x="9" y="11" width="14" height="10" rx="2"/><circle cx="12" cy="21" r="1"/><circle cx="20" cy="21" r="1"/></svg>
          <span class="nav-label">Ingreso Particular</span>
        </button>
        <button class="nav-item" id="nav-flotillas" onclick="navJefe('flotillas')">
          <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>
          <span class="nav-label">Ingreso Flotilla</span>
        </button>
      </div>

      ${_grupoHeader('informes','Informes')}
        <button class="nav-item" id="nav-dashboard" onclick="navJefe('dashboard')">
          <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>
          <span class="nav-label">Dashboard mes actual</span>
        </button>
        <button class="nav-item" id="nav-metas" onclick="navJefe('metas')">
          <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
          <span class="nav-label">Metas</span>
        </button>
        <button class="nav-item" id="nav-reportes" onclick="navJefe('reportes')">
          <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
          <span class="nav-label">Reportes</span>
        </button>
      </div>

      ${_grupoHeader('aseguradoras','Carteras')}
        <button class="nav-item" id="nav-aseguradoras" onclick="navJefe('aseguradoras')">
          <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
          <span class="nav-label">Aseguradoras</span>
        </button>
        <button class="nav-item" id="nav-cartera-flotillas" onclick="navJefe('cartera-flotillas')">
          <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>
          <span class="nav-label">Flotillas</span>
        </button>
        <button class="nav-item" id="nav-cartera-empresas" onclick="navJefe('cartera-empresas')">
          <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M3 21h18M5 21V7l8-4v18M19 21V11l-6-3"/><path d="M9 9v.01M9 12v.01M9 15v.01M9 18v.01"/></svg>
          <span class="nav-label">Empresas</span>
        </button>
      </div>

      ${_grupoHeader('seguridad','Seguridad')}
        <button class="nav-item" id="nav-pin" onclick="configurarPinCierre()">
          <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
          <span class="nav-label">PIN de seguridad</span>
        </button>
      </div>
    `;
  }

  const bottomNav = document.getElementById('bottom-nav-inner');
  if (bottomNav) {
    bottomNav.innerHTML = `
      <button class="bnav-item" id="bnav-dashboard" onclick="navJefe('dashboard')">
        <svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>
        <span>Taller</span>
      </button>
      <button class="bnav-item active" id="bnav-ordenes" onclick="navJefe('ordenes')">
        <svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/></svg>
        <span>Órdenes</span>
      </button>
      <button class="bnav-item" id="bnav-nueva" onclick="navJefe('nueva')">
        <svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 8v8M8 12h8"/></svg>
        <span>Nueva</span>
      </button>
      <button class="bnav-item" id="bnav-cotizaciones" onclick="navJefe('cotizaciones')">
        <svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><path d="M14 2v6h6M16 13H8M16 17H8M10 9H8"/></svg>
        <span>Cotiz.</span>
      </button>
      <button class="bnav-item" id="bnav-mas" onclick="openSidebar()">
        <svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
        <span>Más</span>
      </button>
    `;
  }

  // Cargar la lista de mecánicos para los selects
  cargarMecanicos().finally(() => {
    // Al abrir la app / iniciar sesión → Gestión Operativa por defecto.
    // En F5 dentro de la misma sesión se conserva la página (sessionStorage).
    const ultimaPag = sessionStorage.getItem('ultima_pag_jefe') || 'taller-kpi';
    navJefe(ultimaPag);
  });
  
  // Cargar capacidad al inicio
  _refrescarCapacidad();
  setTimeout(() => { if (typeof actualizarBadgesNav === 'function') actualizarBadgesNav(); }, 1500);
  if (!window._navBadgeInterval) {
    window._navBadgeInterval = setInterval(() => {
      if (typeof actualizarBadgesNav === 'function') actualizarBadgesNav();
    }, 45000);
  }

  // Activar Realtime (pendiente de implementar)
  if (typeof iniciarRealtime === 'function') iniciarRealtime();

  // Sistema de alertas de etapas sin movimiento
  iniciarSistemaAlertas();
}

// ─── Badges de notificación del menú lateral ──────────────
function _navBadgePrevGet() { try { return JSON.parse(localStorage.getItem('nav_badge_prev') || '{}'); } catch (e) { return {}; } }
function _navBadgePrevSet(o) { try { localStorage.setItem('nav_badge_prev', JSON.stringify(o)); } catch (e) {} }
function _navSeenGet() { try { return JSON.parse(localStorage.getItem('nav_badge_seen') || '{}'); } catch (e) { return {}; } }
function _navSeenSet(o) { try { localStorage.setItem('nav_badge_seen', JSON.stringify(o)); } catch (e) {} }

// Crea/actualiza el indicador de un ítem del menú.
// Ilumina (punto + borde + destello) solo si hay pendientes NO atendidos
// (conteo mayor al ya visto). Si ya se atendió la sección, queda en calma.
function _setNavBadge(navId, count) {
  const item = document.getElementById(navId);
  if (!item) return;
  let b = item.querySelector('.nav-badge');
  const n = Number(count) || 0;
  const seenAll = _navSeenGet();
  const seen = seenAll[navId] || 0;
  const esNuevo = n > seen;          // hay algo nuevo sin atender

  if (n > 0) {
    if (!b) { b = document.createElement('span'); b.className = 'nav-badge'; item.appendChild(b); }
    b.style.display = 'inline-block';
    b.title = `${n} pendiente${n === 1 ? '' : 's'}`;
    b.classList.toggle('visto', !esNuevo);
    item.classList.toggle('nav-notif', esNuevo);
  } else {
    if (b) b.style.display = 'none';
    item.classList.remove('nav-notif');
    if (seenAll[navId]) { delete seenAll[navId]; _navSeenSet(seenAll); } // reset al quedar en 0
  }

  // ¿Subió respecto al último refresco y es nuevo? → abrir grupo + destellar
  const prevAll = _navBadgePrevGet();
  const prev = prevAll[navId] || 0;
  if (n > prev && esNuevo) _revealNavItem(navId);
  prevAll[navId] = n;
  _navBadgePrevSet(prevAll);
}

// Marca una sección como atendida: apaga su iluminación (la deja en calma).
function _navMarcarVisto(navId) {
  if (!navId) return;
  const prevAll = _navBadgePrevGet();
  const n = prevAll[navId] || 0;
  const seenAll = _navSeenGet();
  seenAll[navId] = n;
  _navSeenSet(seenAll);
  const item = document.getElementById(navId);
  if (!item) return;
  item.classList.remove('nav-notif', 'nav-flash');
  const b = item.querySelector('.nav-badge');
  if (b) { if (n > 0) b.classList.add('visto'); else b.style.display = 'none'; }
}

// Abre el grupo del ítem (si está colapsado) y destella su ícono.
function _revealNavItem(navId) {
  const item = document.getElementById(navId);
  if (!item) return;
  // Abrir el grupo contenedor si está cerrado
  const groupBody = item.closest('.nav-grupo-body');
  if (groupBody && getComputedStyle(groupBody).display === 'none') {
    const gid = groupBody.id.replace('nav-grupo-', '');
    if (typeof window._navToggleGrupo === 'function') window._navToggleGrupo(gid);
  }
  // Destello del ícono (reinicia la animación si ya estaba corriendo)
  item.classList.remove('nav-flash');
  void item.offsetWidth;
  item.classList.add('nav-flash');
  clearTimeout(item._flashT);
  item._flashT = setTimeout(() => item.classList.remove('nav-flash'), 2800);
}

// Refresca todos los badges del menú (pendientes que requieren atención).
async function actualizarBadgesNav() {
  try {
    const [rep, cot, aseg] = await Promise.all([
      api('/solicitudes_repuesto?estado=eq.pendiente_jefe&select=id').catch(() => []),
      api('/cotizaciones?estado=eq.pendiente&select=id').catch(() => []),
      api('/ordenes?aseguradora=not.is.null&estado_aseguradora=eq.peritaje_pendiente&select=id').catch(() => [])
    ]);
    _setNavBadge('nav-repuestos',    (rep  || []).length);
    _setNavBadge('nav-cotizaciones', (cot  || []).length);
    _setNavBadge('nav-aseguradoras', (aseg || []).length);
  } catch (e) {}
}

function navJefe(pag) {
  // Al entrar a una sección, apagar su iluminación de notificación
  if (typeof _navMarcarVisto === 'function') _navMarcarVisto('nav-' + pag);
  // Actualizar clases active en sidebar y bottom nav
  // Detener polling KPI al salir de esa pantalla
  if (pag !== 'taller-kpi' && window._kpiInterval) { clearInterval(window._kpiInterval); window._kpiInterval = null; }
  const pages = ['ordenes', 'nueva', 'dashboard', 'taller-kpi', 'cotizaciones', 'calendario', 'mecanicos', 'repuestos', 'reportes', 'flotillas', 'aseguradoras', 'cartera-flotillas', 'cartera-empresas', 'vehiculos', 'vehiculos-lista', 'metas'];
  pages.forEach(p => {
    const navBtn = document.getElementById('nav-' + p);
    const bnavBtn = document.getElementById('bnav-' + p);
    if (navBtn) navBtn.classList.remove('active');
    if (bnavBtn) bnavBtn.classList.remove('active');
  });
  
  const currentNav = document.getElementById('nav-' + pag);
  const currentBnav = document.getElementById('bnav-' + pag);
  if (currentNav) currentNav.classList.add('active');
  if (currentBnav) currentBnav.classList.add('active');

  // Ocultar/mostrar botón de detalle si existe
  const navDetalle = document.getElementById('nav-detalle');
  if (navDetalle && pag !== 'detalle') navDetalle.style.display = 'none';

  // Mostrar la página correspondiente
  let pagId = '';
  let titulo = '';
  
  switch(pag) {
    case 'ordenes':
      pagId = 'pag-ordenes';
      titulo = 'Órdenes';
      break;
    case 'nueva':
      pagId = 'pag-nueva';
      titulo = 'Nueva Orden';
      resetNuevaOrden();
      setTimeout(() => { if (typeof recargarListasNuevaOrden === 'function') recargarListasNuevaOrden(); }, 50);
      break;
    case 'dashboard':
      pagId = 'pag-dashboard';
      titulo = 'Dashboard – Mes actual';
      setTimeout(() => { if (typeof switchDashTab === 'function') switchDashTab('mes'); }, 50);
      break;
    case 'metas':
      pagId = 'pag-dashboard';
      titulo = 'Metas';
      setTimeout(() => { if (typeof switchDashTab === 'function') switchDashTab('metas'); }, 50);
      break;
    case 'cotizaciones':
      pagId = 'pag-cotizaciones';
      titulo = 'Cotizaciones';
      cargarCotizaciones();
      break;
    case 'calendario':
      pagId = 'pag-calendario';
      titulo = 'Calendario de Entregas';
      cargarCalendario();
      break;
    case 'taller-kpi':
      pagId = 'pag-taller-kpi';
      titulo = 'Gestión Operativa';
      if (window._kpiInterval) clearInterval(window._kpiInterval);
      setTimeout(() => { if (typeof cargarKPITaller === 'function') cargarKPITaller(); }, 50);
      window._kpiInterval = setInterval(() => { if (typeof cargarKPITaller === 'function') cargarKPITaller(); }, 60000);
      break;
    case 'mecanicos':
      pagId = 'pag-mecanicos';
      titulo = 'Operarios';
      cargarMecanicosVista();
      break;
    case 'repuestos':
      pagId = 'pag-repuestos-jefe';
      titulo = 'Repuestos';
      setTimeout(() => { if (typeof cargarRepuestosJefe === 'function') cargarRepuestosJefe(); }, 50);
      break;
    case 'reportes':
      pagId = 'pag-reportes';
      titulo = 'Reportes';
      setTimeout(() => { if (typeof montarReportes === 'function') montarReportes(); }, 50);
      break;
    case 'flotillas':
      pagId = 'pag-flotillas';
      titulo = 'Ingreso Flotilla';
      setTimeout(() => { if (typeof montarFlotillas === 'function') montarFlotillas(); }, 50);
      break;
    case 'aseguradoras':
      pagId = 'pag-aseguradoras';
      titulo = 'Aseguradoras';
      if (typeof resetVistaAseguradoras === 'function') resetVistaAseguradoras();
      setTimeout(() => {
        if (typeof cargarModuloAseguradoras === 'function') cargarModuloAseguradoras();
        else if (typeof montarAseguradoras === 'function') montarAseguradoras();
      }, 50);
      break;
    case 'cartera-flotillas':
      pagId = 'pag-cartera-flotillas';
      titulo = 'Flotillas';
      if (typeof resetVistaCartera === 'function') resetVistaCartera('flotilla');
      setTimeout(() => { if (typeof montarCarteraFlotillas === 'function') montarCarteraFlotillas(); }, 50);
      break;
    case 'cartera-empresas':
      pagId = 'pag-cartera-empresas';
      titulo = 'Empresas';
      if (typeof resetVistaCartera === 'function') resetVistaCartera('empresa');
      setTimeout(() => { if (typeof montarCarteraEmpresas === 'function') montarCarteraEmpresas(); }, 50);
      break;
    case 'vehiculos':
      pagId = 'pag-vehiculos';
      titulo = 'Ingreso Particular';
      setTimeout(() => {
        if (typeof montarIngresoParticular === 'function') montarIngresoParticular();
        else if (typeof cargarVehiculos === 'function') cargarVehiculos();
      }, 50);
      break;
    case 'vehiculos-lista':
      pagId = 'pag-vehiculos';
      titulo = 'Vehículos ingresados';
      setTimeout(() => { if (typeof cargarVehiculos === 'function') cargarVehiculos(); }, 50);
      break;
    default:
      pagId = 'pag-ordenes';
      titulo = 'Órdenes';
  }

  mostrarPagina(pagId);

  const titleEl = document.getElementById('topbar-title');
  if (titleEl) titleEl.textContent = titulo;

  const actionsEl = document.getElementById('topbar-actions');
  if (actionsEl) actionsEl.innerHTML = '';

  // Guardar última página para restaurar en F5 (solo durante la sesión)
  const pagsSinGuardar = ['nueva', 'detalle'];
  if (!pagsSinGuardar.includes(pag)) sessionStorage.setItem('ultima_pag_jefe', pag);

  // Si es la página de órdenes, cargar las órdenes
  if (pag === 'ordenes') cargarOrdenes();

  closeSidebar();
}
// ═══════════════════════════════════════════════════════════
// CALENDARIO DE ENTREGAS
// ═══════════════════════════════════════════════════════════
let calMesActual = new Date();
calMesActual.setDate(1);
calMesActual.setHours(0,0,0,0);

async function cargarCalendario() {
  const cont = document.getElementById('pag-calendario');
  if (!cont) return;
  cont.innerHTML = '<div class="loading-state">Cargando...</div>';
  try {
    const ordenes = await api(
      `/ordenes?select=id,placa,marca,linea,propietario,estado,pulmon,fecha_entrega_1,fecha_entrega_2,fecha_programada&or=(estado.eq.Activa,pulmon.eq.true,estado.eq.Programada)&order=fecha_entrega_1.asc`
    ).catch(() => []) || [];
    renderCalendario(cont, ordenes, calMesActual);
  } catch(e) {
    cont.innerHTML = `<div class="empty-state">Error: ${e.message}</div>`;
  }
}

function renderCalendario(cont, ordenes, mesDate) {
  const año  = mesDate.getFullYear();
  const mes  = mesDate.getMonth();
  const hoy  = new Date(); hoy.setHours(0,0,0,0);

  const mesLabel = mesDate.toLocaleDateString('es-CO', { month: 'long', year: 'numeric' });
  const diasMes  = new Date(año, mes + 1, 0).getDate();
  const primerDia = new Date(año, mes, 1).getDay(); // 0=dom
  const offset = (primerDia + 6) % 7; // lunes primero

  // Indexar órdenes por fecha. Las Programadas (agendadas) se ubican por su
  // fecha_programada (día de ingreso); el resto por sus fechas de entrega.
  const porDia = {};
  ordenes.forEach(o => {
    if (o.estado === 'Programada') {
      if (o.fecha_programada) {
        const d = new Date(o.fecha_programada + 'T00:00:00');
        if (d.getFullYear() === año && d.getMonth() === mes) {
          const key = d.getDate();
          (porDia[key] = porDia[key] || []).push({ ...o, esProgramada: true });
        }
      }
      return;
    }
    [o.fecha_entrega_1, o.fecha_entrega_2].filter(Boolean).forEach((f, fi) => {
      const d = new Date(f);
      if (d.getFullYear() === año && d.getMonth() === mes) {
        const key = d.getDate();
        if (!porDia[key]) porDia[key] = [];
        porDia[key].push({ ...o, esFecha2: fi === 1 });
      }
    });
  });

  // Build grid
  const diasSem = ['Lun','Mar','Mié','Jue','Vie','Sáb','Dom'];
  const totalMes = Object.values(porDia).reduce((sum, items) => sum + items.length, 0);
  const headHtml = diasSem.map(d => `<div class="cal-head">${d}</div>`).join('');

  let celdas = '';
  // Celdas vacías antes del primer día
  for (let i = 0; i < offset; i++) celdas += `<div class="cal-cell cal-empty"></div>`;

  for (let d = 1; d <= diasMes; d++) {
    const fecha  = new Date(año, mes, d);
    const esHoy  = fecha.getTime() === hoy.getTime();
    const ords   = porDia[d] || [];
    const pasado = fecha < hoy;

    const ordsHtml = ords.slice(0, 4).map(o => {
      const prog    = o.esProgramada;
      const urgente = !prog && !o.esFecha2 && o.fecha_entrega_1 && new Date(o.fecha_entrega_1) <= hoy;
      const color = prog ? '#7C3AED' : urgente ? '#DC2626' : o.esFecha2 ? '#D97706' : '#2A5298';
      const bg    = prog ? '#F3E8FF' : urgente ? '#FEE2E2' : o.esFecha2 ? '#FEF3C7' : '#EBF2FF';
      return `<div class="cal-orden" style="background:${bg};color:${color};border-left-color:${color}" onclick="abrirOrden(${o.id})">
        <div style="display:flex;align-items:center;justify-content:space-between;gap:6px">
          <span style="font-family:'DM Mono',monospace;font-weight:700;font-size:11px">${escapeHtml(o.placa) || '---'}</span>
          ${prog ? '<span style="font-size:9px;font-weight:800;opacity:0.85">📅</span>' : o.esFecha2 ? '<span style="font-size:9px;font-weight:800;opacity:0.75">F2</span>' : ''}
        </div>
        <div class="cal-orden-meta">${[o.marca,o.linea].filter(Boolean).map(escapeHtml).join(' ') || escapeHtml(o.propietario) || 'Orden activa'}</div>
      </div>`;
    }).join('');
    const masHtml = ords.length > 4
      ? `<div class="cal-mas">+${ords.length-4} mas</div>` : '';

    celdas += `<div class="cal-cell${esHoy?' cal-hoy':''}${pasado&&!esHoy?' cal-pasado':''}${ords.length?' cal-con-ordenes':''}">
      <div class="cal-dia"><span>${d}</span>${ords.length ? `<strong>${ords.length}</strong>` : ''}</div>
      ${ordsHtml}${masHtml}
    </div>`;
  }

  // ── Vista AGENDA (lista por día) — se muestra solo en móvil ──
  let agendaHtml = '';
  for (let d = 1; d <= diasMes; d++) {
    const ords = porDia[d] || [];
    if (!ords.length) continue;
    const fecha = new Date(año, mes, d);
    const esHoy = fecha.getTime() === hoy.getTime();
    const wd    = diasSem[(fecha.getDay() + 6) % 7];
    const filas = ords.map(o => {
      const prog    = o.esProgramada;
      const urgente = !prog && !o.esFecha2 && o.fecha_entrega_1 && new Date(o.fecha_entrega_1) <= hoy;
      const color = prog ? '#7C3AED' : urgente ? '#DC2626' : o.esFecha2 ? '#D97706' : '#2A5298';
      const bg    = prog ? '#F3E8FF' : urgente ? '#FEE2E2' : o.esFecha2 ? '#FEF3C7' : '#EBF2FF';
      const tag   = prog ? '📅 Agendada' : urgente ? 'Vencida' : o.esFecha2 ? 'Entrega 2' : 'Entrega 1';
      return `<div class="cal-ag-orden" style="border-left-color:${color}" onclick="abrirOrden(${o.id})">
        <span class="cal-ag-placa">${escapeHtml(o.placa) || '---'}</span>
        <span class="cal-ag-veh">${[o.marca,o.linea].filter(Boolean).map(escapeHtml).join(' ') || escapeHtml(o.propietario) || 'Orden'}</span>
        <span class="cal-ag-tag" style="background:${bg};color:${color}">${tag}</span>
      </div>`;
    }).join('');
    agendaHtml += `<div class="cal-ag-dia${esHoy ? ' cal-ag-hoy' : ''}">
      <div class="cal-ag-fecha"><span class="n">${d}</span> ${wd}${esHoy ? ' · Hoy' : ''} <span class="c">${ords.length}</span></div>
      <div class="cal-ag-lista">${filas}</div>
    </div>`;
  }
  if (!agendaHtml) agendaHtml = '<div class="empty-state" style="padding:30px 16px"><p>No hay entregas ni ingresos programados este mes.</p></div>';

  cont.innerHTML = `
    <div class="cal-shell">
    <div style="display:flex;justify-content:flex-end;margin-bottom:12px">
      <button class="btn btn-primary btn-sm" onclick="abrirModalAgendar()">
        <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>
        Agendar ingreso
      </button>
    </div>
    <div class="cal-nav">
      <button class="btn btn-ghost btn-sm" onclick="calCambiarMes(-1)">← Anterior</button>
      <div>
        <div class="cal-mes-titulo">${mesLabel.charAt(0).toUpperCase() + mesLabel.slice(1)}</div>
        <div style="font-size:12px;color:var(--gris-mid);text-align:center">${totalMes} entregas programadas</div>
      </div>
      <button class="btn btn-ghost btn-sm" onclick="calCambiarMes(1)">Siguiente →</button>
    </div>
    <div class="cal-leyenda">
      <span class="cal-ley-dot" style="background:#F3E8FF;border:1px solid #7C3AED"></span><span style="font-size:11px;color:var(--gris-mid)">📅 Agendada</span>
      <span class="cal-ley-dot" style="background:#EBF2FF;border:1px solid #2A5298;margin-left:12px"></span><span style="font-size:11px;color:var(--gris-mid)">Entrega 1</span>
      <span class="cal-ley-dot" style="background:#FEF3C7;border:1px solid #D97706;margin-left:12px"></span><span style="font-size:11px;color:var(--gris-mid)">Entrega 2</span>
      <span class="cal-ley-dot" style="background:#FEE2E2;border:1px solid #DC2626;margin-left:12px"></span><span style="font-size:11px;color:var(--gris-mid)">Vencida</span>
    </div>
    <div class="cal-grid">
      ${headHtml}
      ${celdas}
    </div>
    <div class="cal-agenda">${agendaHtml}</div>
    </div>
  `;
}

async function calCambiarMes(delta) {
  calMesActual.setMonth(calMesActual.getMonth() + delta);
  const cont = document.getElementById('pag-calendario');
  if (!cont) return;
  cont.innerHTML = '<div class="loading-state">Cargando...</div>';
  try {
    const ordenes = await api(
      `/ordenes?select=id,placa,marca,linea,propietario,estado,pulmon,fecha_entrega_1,fecha_entrega_2,fecha_programada&or=(estado.eq.Activa,pulmon.eq.true,estado.eq.Programada)`
    ).catch(() => []) || [];
    renderCalendario(cont, ordenes, calMesActual);
  } catch(e) {
    cont.innerHTML = `<div class="empty-state">Error: ${e.message}</div>`;
  }
}

// ═══════════════════════════════════════════════════════════
// AGENDAR INGRESO — registro ligero de un vehículo que llegará
// (crea la orden como Programada; el resto se completa al llegar)
// ═══════════════════════════════════════════════════════════
async function abrirModalAgendar() {
  document.getElementById('modal-agendar')?.remove();
  const [aseg, flot] = await Promise.all([
    api('/aseguradoras?activo=eq.true&order=nombre.asc').catch(() => []) || [],
    api('/flotillas?activo=eq.true&order=nombre.asc').catch(() => []) || []
  ]);
  const hoyStr = (() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; })();

  const ov = document.createElement('div');
  ov.id = 'modal-agendar';
  ov.className = 'modal-overlay show';
  ov.style.display = 'flex';
  ov.addEventListener('click', e => { if (e.target === ov) ov.remove(); });
  ov.innerHTML = `
    <div class="modal" style="max-width:460px">
      <div class="modal-header">
        <h2>Agendar ingreso</h2>
        <button class="modal-close" onclick="document.getElementById('modal-agendar').remove()">✕</button>
      </div>
      <div class="modal-body" style="display:flex;flex-direction:column;gap:13px">
        <div style="font-size:12px;color:var(--gris-mid);line-height:1.5">Registro rápido de un vehículo que ingresará próximamente. Los demás datos (kilometraje, inventario, daños…) se completan cuando llegue al taller.</div>
        <div class="field" style="margin:0"><label>Placa *</label><input id="ag-placa" placeholder="ABC123" style="text-transform:uppercase" oninput="this.value=this.value.toUpperCase()"></div>
        <div class="field" style="margin:0"><label>Fecha programada *</label><input id="ag-fecha" type="date" min="${hoyStr}" value="${hoyStr}"></div>
        <div class="field" style="margin:0"><label>Tipo de cliente</label>
          <select id="ag-tipo" onchange="_agendarToggleTipo(this.value)">
            <option value="particular">Particular</option>
            <option value="aseguradora">Aseguradora</option>
            <option value="flotilla">Flotilla / Empresa</option>
          </select>
        </div>
        <div class="field" id="ag-aseg-wrap" style="margin:0;display:none"><label>Aseguradora</label>
          <select id="ag-aseg"><option value="">— Seleccionar —</option>${aseg.map(a => `<option value="${escapeHtml(a.nombre)}">${escapeHtml(a.nombre)}</option>`).join('')}</select>
        </div>
        <div class="field" id="ag-flot-wrap" style="margin:0;display:none"><label>Flotilla / Empresa</label>
          <select id="ag-flot"><option value="">— Seleccionar —</option>${flot.map(f => `<option value="${escapeHtml(f.nombre)}">${escapeHtml(f.nombre)}</option>`).join('')}</select>
        </div>
        <div class="field" style="margin:0"><label>Cliente — nombre</label><input id="ag-nombre" placeholder="Nombre del cliente"></div>
        <div class="field" style="margin:0"><label>Cliente — teléfono</label><input id="ag-tel" placeholder="Teléfono" inputmode="numeric" oninput="this.value=this.value.replace(/[^\\d]/g,'')"></div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-ghost" onclick="document.getElementById('modal-agendar').remove()">Cancelar</button>
        <button class="btn btn-primary" id="ag-guardar" onclick="guardarAgendamiento()">Agendar →</button>
      </div>
    </div>`;
  document.body.appendChild(ov);
  setTimeout(() => document.getElementById('ag-placa')?.focus(), 80);
}

function _agendarToggleTipo(tipo) {
  const a = document.getElementById('ag-aseg-wrap');
  const f = document.getElementById('ag-flot-wrap');
  if (a) a.style.display = tipo === 'aseguradora' ? '' : 'none';
  if (f) f.style.display = tipo === 'flotilla' ? '' : 'none';
}

async function guardarAgendamiento() {
  const placa = document.getElementById('ag-placa')?.value.trim().toUpperCase();
  const fecha = document.getElementById('ag-fecha')?.value;
  if (!placa) { toast('La placa es obligatoria', 'err'); document.getElementById('ag-placa')?.focus(); return; }
  if (!fecha) { toast('La fecha programada es obligatoria', 'err'); return; }
  const tipo = document.getElementById('ag-tipo')?.value || 'particular';
  let aseguradora = null;
  if (tipo === 'aseguradora')   aseguradora = document.getElementById('ag-aseg')?.value || null;
  else if (tipo === 'flotilla') aseguradora = document.getElementById('ag-flot')?.value || null;

  const body = {
    placa,
    propietario:      document.getElementById('ag-nombre')?.value.trim() || null,
    telefono:         document.getElementById('ag-tel')?.value.trim()    || null,
    tipo_cliente:     tipo,
    aseguradora,
    fecha_programada: fecha,
    estado:           'Programada',
    ingreso_en:       null
  };

  const btn = document.getElementById('ag-guardar');
  if (btn) { btn.disabled = true; btn.textContent = 'Agendando...'; }
  try {
    await api('/ordenes', 'POST', body, { Prefer: 'return=minimal' });
    toast('Ingreso agendado ✓');
    document.getElementById('modal-agendar')?.remove();
    if (typeof cargarCalendario === 'function') cargarCalendario();
    if (typeof _refrescarCapacidad === 'function') _refrescarCapacidad();
  } catch(e) {
    toast('Error al agendar: ' + e.message, 'err');
    if (btn) { btn.disabled = false; btn.textContent = 'Agendar →'; }
  }
}

// ═══════════════════════════════════════════════════════════
// VISTA OPERARIOS
// ═══════════════════════════════════════════════════════════
const ROL_LABEL = {
  mecanico: 'Mecánico', pintor: 'Pintor', latonero: 'Latonero',
  detailing: 'Detailing', tot: 'T.O.T.', repuestos: 'Repuestos',
  taller: 'Pantalla Taller', 'Asesor Previsora': 'Asesor Previsora'
};

async function cargarMecanicosVista() {
  const cont = document.getElementById('pag-mecanicos');
  if (!cont) return;
  cont.innerHTML = '<div class="loading-state">Cargando...</div>';
  try {
    const [mecsData, etapasActivas] = await Promise.all([
      api('/mecanicos?activo=eq.true&order=nombre.asc').catch(() => []) || [],
      api('/etapas?fin=is.null&inicio=not.is.null&select=id,orden_id,etapa,servicio,mecanico_id,inicio').catch(() => []) || []
    ]);

    const ids = [...new Set(etapasActivas.map(e => e.orden_id))];
    const ordenes = ids.length
      ? await api(`/ordenes?id=in.(${ids.join(',')})&select=id,placa,marca,linea,propietario`).catch(() => []) || []
      : [];

    const srvColor = { latoneria:'#DC2626', pintura:'#D97706', mecanica:'#2563EB', adicionales:'#059669' };
    const esGerente = sesion?.perfil === 'gerente';

    // Agrupar por rol
    const porRol = {};
    mecsData.forEach(m => {
      const rol = ROL_LABEL[m.rol] || m.rol || 'Técnico';
      if (!porRol[rol]) porRol[rol] = [];
      porRol[rol].push(m);
    });

    // Fila compacta por operario
    const filaOp = (m, esJefeTaller = false) => {
      const etapas = etapasActivas.filter(e => e.mecanico_id === m.id);
      const ocupado = etapas.length > 0;
      const primeraEtapa = etapas[0];
      const ord = primeraEtapa ? ordenes.find(o => o.id === primeraEtapa.orden_id) : null;
      const color = primeraEtapa ? (srvColor[primeraEtapa.servicio] || '#6B7280') : null;
      const mins = primeraEtapa?.inicio ? Math.round((new Date() - new Date(primeraEtapa.inicio)) / 60000) : 0;
      const dur = mins < 60 ? `${mins}m` : mins < 1440 ? `${Math.floor(mins/60)}h ${mins%60}m` : `${Math.floor(mins/1440)}d`;

      const indicador = ocupado
        ? `<span style="display:inline-block;width:7px;height:7px;border-radius:50%;background:#22C55E;flex-shrink:0;box-shadow:0 0 0 2px #DCFCE7"></span>`
        : `<span style="display:inline-block;width:7px;height:7px;border-radius:50%;background:#D1D5DB;flex-shrink:0"></span>`;

      const estadoHtml = ocupado
        ? `<div style="display:flex;flex-direction:column;gap:3px;min-width:0;cursor:pointer" onclick="abrirOrden(${ord?.id||0})" title="Abrir orden">
            <div style="display:flex;align-items:center;gap:6px;min-width:0">
              <div style="width:3px;height:14px;background:${color};border-radius:99px;flex-shrink:0"></div>
              <span style="font-size:12px;font-weight:600;color:var(--texto);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escapeHtml(primeraEtapa.etapa)||'—'}</span>
              ${etapas.length > 1 ? `<span style="font-size:10px;color:var(--gris-mid);flex-shrink:0">+${etapas.length-1} más</span>` : ''}
              <span style="font-size:10px;font-weight:700;color:${color};background:${color}18;padding:1px 5px;border-radius:3px;font-family:'DM Mono',monospace;flex-shrink:0">${dur}</span>
            </div>
            ${ord ? `<div style="display:flex;align-items:center;gap:5px;min-width:0">
              <span style="font-family:'DM Mono',monospace;font-size:11px;font-weight:700;color:var(--azul);flex-shrink:0">${escapeHtml(ord.placa)}</span>
              <span style="font-size:9px;color:var(--gris-mid);font-family:'DM Mono',monospace;flex-shrink:0">OT-${String(ord.id).padStart(4,'0')}</span>
              ${ord.marca||ord.linea ? `<span style="font-size:10px;color:var(--gris-mid);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${[ord.marca,ord.linea].filter(Boolean).map(escapeHtml).join(' ')}</span>` : ''}
            </div>` : ''}
            ${ord?.propietario ? `<div style="font-size:10px;color:var(--gris-mid);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:200px">${escapeHtml(ord.propietario)}</div>` : ''}
          </div>`
        : `<span style="font-size:11.5px;color:var(--gris-mid);font-style:italic">Libre</span>`;

      const acciones = esJefeTaller
        ? `<button class="btn btn-ghost btn-xs" onclick="abrirCambiarPassJefe()" title="Cambiar contraseña">
             <svg width="11" height="11" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
           </button>`
        : `<button class="btn btn-ghost btn-xs" onclick="abrirCambiarPassMecanico(${m.id},'${escapeHtml(m.nombre)}')" title="Contraseña">
             <svg width="11" height="11" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
           </button>
           ${esGerente ? `
           <button class="btn btn-ghost btn-xs" onclick="abrirModalOperario(${JSON.stringify(m).replace(/"/g,'&quot;')})" title="Editar">
             <svg width="11" height="11" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
           </button>
           <button class="btn btn-ghost btn-xs" style="color:var(--rojo)" onclick="eliminarOperario(${m.id},'${escapeHtml(m.nombre)}')" title="Desactivar">
             <svg width="11" height="11" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>
           </button>` : ''}`;

      const rolLabel = esJefeTaller ? 'Jefe de taller' : escapeHtml(ROL_LABEL[m.rol]||m.rol||'—');
      return `<div class="op-row">
        <span class="op-col-dot">${indicador}</span>
        <div class="op-col-nombre">
          <div style="width:26px;height:26px;border-radius:50%;background:${esJefeTaller ? '#1E3A5F' : (ocupado ? 'var(--azul)' : '#94A3B8')};display:flex;align-items:center;justify-content:center;font-weight:700;font-size:11px;color:white;flex-shrink:0">${escapeHtml(m.nombre.charAt(0).toUpperCase())}</div>
          <div style="min-width:0">
            <span style="font-size:12.5px;font-weight:${esJefeTaller?'700':'600'};color:var(--texto);overflow:hidden;text-overflow:ellipsis;display:block">${escapeHtml(m.nombre)}</span>
            <span class="op-rol-mobile">${rolLabel}</span>
          </div>
        </div>
        <span class="op-col-rol">${rolLabel}</span>
        <div class="op-col-estado">${estadoHtml}</div>
        <div class="op-col-acc">${acciones}</div>
      </div>`;
    };

    // Leer datos del jefe desde config
    const cfgJefe = await api('/configuracion?clave=in.(jefe_nombre,jefe_cedula)').catch(() => []) || [];
    const jefeNombre = cfgJefe.find(c => c.clave === 'jefe_nombre')?.valor || 'Jefe de Taller';
    const jefeMock = { id: 0, nombre: jefeNombre, rol: 'jefe', telegram_chat_id: null };

    const totalActivos = mecsData.filter(m => etapasActivas.some(e => e.mecanico_id === m.id)).length;

    cont.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:12px;flex-wrap:wrap">
        <div style="display:flex;align-items:center;gap:8px">
          <span style="font-size:13px;font-weight:700;color:var(--texto)">${mecsData.length} operario${mecsData.length!==1?'s':''}</span>
          <span style="font-size:11px;color:#059669;background:#DCFCE7;padding:2px 8px;border-radius:20px;font-weight:700">${totalActivos} activo${totalActivos!==1?'s':''}</span>
          <span style="font-size:11px;color:var(--gris-mid);background:var(--gris-bg);padding:2px 8px;border-radius:20px">${mecsData.length - totalActivos} libre${mecsData.length-totalActivos!==1?'s':''}</span>
        </div>
        ${esGerente ? `
        <div style="display:flex;gap:7px">
          <button class="btn btn-primary btn-sm" onclick="abrirModalOperario(null)" style="display:flex;align-items:center;gap:5px">
            <svg width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>Nuevo
          </button>
          <button class="btn btn-ghost btn-sm" onclick="abrirGestionRoles()" style="color:#7C3AED;border-color:#DDD6FE">Roles</button>
        </div>` : ''}
      </div>

      <div style="border:1.5px solid var(--gris-borde);border-radius:10px;overflow:hidden">
        <!-- Cabecera -->
        <div class="op-header">
          <span></span>
          <span>Nombre</span>
          <span class="op-col-rol">Rol</span>
          <span class="op-col-estado">Estado actual</span>
          <span></span>
        </div>

        <!-- Jefe de taller -->
        <div style="background:#F0F4FF;border-bottom:1.5px solid var(--gris-borde)">
          ${filaOp(jefeMock, true)}
        </div>

        <!-- Operarios agrupados por rol -->
        ${Object.entries(porRol).map(([rol, mecs]) => `
          <div style="background:var(--gris-bg);padding:4px 12px;border-bottom:1px solid var(--gris-borde)">
            <span style="font-size:9.5px;font-weight:700;letter-spacing:1.2px;text-transform:uppercase;color:var(--gris-mid);font-family:'DM Mono',monospace">${escapeHtml(rol)} (${mecs.length})</span>
          </div>
          ${mecs.map(m => filaOp(m)).join('')}
        `).join('')}
      </div>
    `;
  } catch(e) {
    cont.innerHTML = `<div class="empty-state">Error: ${e.message}</div>`;
  }
}

// ─── CRUD OPERARIOS (solo gerente) ───────────────────────

async function abrirModalOperario(mec) {
  // mec = null → crear nuevo, mec = objeto → editar
  document.getElementById('modal-operario')?.remove();
  const esEditar = mec !== null && mec !== undefined;

  // Roles base + roles personalizados de la DB
  const rolesBase = [
    { val:'mecanico',  label:'Mecánico'  },
    { val:'pintor',    label:'Pintor'    },
    { val:'latonero',  label:'Latonero'  },
    { val:'detailing', label:'Detailing' },
    { val:'tot',       label:'T.O.T.'   },
    { val:'repuestos', label:'Repuestos' }
  ];
  const rolesCustom = await api('/roles_config?order=nombre.asc&select=nombre,color').catch(() => []) || [];
  const roles = [
    ...rolesBase,
    ...(rolesCustom.length ? [{ val:'_sep', label:'── Roles personalizados ──', disabled:true }] : []),
    ...rolesCustom.map(r => ({ val: r.nombre, label: r.nombre, color: r.color }))
  ];
  const m = document.createElement('div');
  m.id = 'modal-operario';
  m.className = 'modal-overlay show';
  m.innerHTML = `
    <div class="modal" style="max-width:420px">
      <div class="modal-header">
        <div class="modal-titulo">
          <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/></svg>
          ${esEditar ? 'Editar operario' : 'Nuevo operario'}
        </div>
        <button class="modal-cerrar" onclick="document.getElementById('modal-operario').remove()">✕</button>
      </div>
      <div style="padding:20px;display:flex;flex-direction:column;gap:14px">
        <div class="field">
          <label>Nombre completo</label>
          <input id="op-nombre" type="text" placeholder="Nombre del operario" value="${esEditar ? escapeHtml(mec.nombre||'') : ''}">
        </div>
        <div class="field">
          <label>Cédula</label>
          <input id="op-cedula" type="text" placeholder="Número de cédula"
            value="${esEditar ? escapeHtml(mec.cedula||'') : ''}"
            ${esEditar ? 'readonly style="background:var(--gris-bg);color:var(--gris-mid)"' : ''}>
          ${esEditar ? '<div style="font-size:11px;color:var(--gris-mid);margin-top:3px">La cédula no se puede cambiar. Usa el candado 🔒 para cambiar contraseña.</div>' : ''}
        </div>
        <div class="field">
          <label>Perfil / Rol</label>
          <select id="op-rol">
            ${roles.map(r => r.disabled
              ? `<option value="" disabled>${r.label}</option>`
              : `<option value="${r.val}" ${esEditar && mec.rol===r.val ? 'selected':''}>${r.label}</option>`
            ).join('')}
          </select>
        </div>
        <div class="field">
          <label style="display:flex;align-items:center;gap:6px">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 8.63a19.79 19.79 0 01-3.07-8.67A2 2 0 012 0h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L6.09 7.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z"/></svg>
            Telegram Chat ID
          </label>
          <input id="op-telegram" type="text" placeholder="Ej: 123456789 (dejar vacío si no usa Telegram)"
            value="${esEditar ? escapeHtml(mec.telegram_chat_id||'') : ''}">
          <div style="font-size:11px;color:var(--gris-mid);margin-top:3px">
            Para obtenerlo: que el operario escriba <strong>/start</strong> al bot <strong>@userinfobot</strong> en Telegram y te pase el ID.
          </div>
        </div>
        ${!esEditar ? `
        <div class="field">
          <label>Contraseña inicial</label>
          <div style="display:flex;gap:8px;align-items:center">
            <input id="op-pass" type="password" placeholder="Dejar vacío = usar cédula como clave" style="flex:1">
            <button type="button" onclick="const i=document.getElementById('op-pass');i.type=i.type==='password'?'text':'password'" style="flex-shrink:0;width:38px;height:38px;border:1.5px solid var(--gris-borde);border-radius:6px;background:white;cursor:pointer;display:flex;align-items:center;justify-content:center;color:var(--gris-mid)">
              <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
            </button>
          </div>
          <div style="font-size:11px;color:var(--gris-mid);margin-top:3px">Si lo dejas vacío, la cédula será la contraseña inicial.</div>
        </div>` : ''}
        <div id="op-error" style="display:none;background:var(--rojo-bg);color:var(--rojo);border-radius:6px;padding:10px 14px;font-size:13px"></div>
        <div style="display:flex;gap:8px;justify-content:flex-end">
          <button class="btn btn-ghost" onclick="document.getElementById('modal-operario').remove()">Cancelar</button>
          <button class="btn btn-primary" id="op-btn-save" onclick="guardarOperario(${esEditar ? mec.id : 'null'}, '${esEditar ? escapeHtml(mec.cedula||'') : ''}')">
            ${esEditar ? 'Guardar cambios' : 'Crear operario'}
          </button>
        </div>
      </div>
    </div>`;
  m.addEventListener('click', e => { if (e.target === m) m.remove(); });
  document.body.appendChild(m);
  setTimeout(() => document.getElementById('op-nombre')?.focus(), 80);
}

async function guardarOperario(mecId, cedulaOriginal) {
  const nombre = document.getElementById('op-nombre')?.value.trim();
  const cedula    = mecId ? cedulaOriginal : document.getElementById('op-cedula')?.value.trim();
  const rol       = document.getElementById('op-rol')?.value;
  const pass      = document.getElementById('op-pass')?.value || '';
  const tgChatId  = document.getElementById('op-telegram')?.value.trim() || null;
  const errEl  = document.getElementById('op-error');
  const showErr = msg => { errEl.textContent = msg; errEl.style.display = 'block'; };
  errEl.style.display = 'none';

  if (!nombre) { showErr('Ingresa el nombre del operario.'); return; }
  if (!cedula) { showErr('Ingresa la cédula.'); return; }
  if (!mecId && pass && pass.length < 6) { showErr('La contraseña debe tener al menos 6 caracteres.'); return; }

  const btn = document.getElementById('op-btn-save');
  if (btn) { btn.disabled = true; btn.textContent = 'Guardando...'; }

  try {
    if (mecId) {
      // Editar: actualiza nombre, rol y telegram_chat_id
      await api(`/mecanicos?id=eq.${mecId}`, 'PATCH', { nombre, rol, telegram_chat_id: tgChatId });
      toast(`${nombre} actualizado ✓`);
    } else {
      // Crear: primero registrar en Supabase Auth
      const signupPass = pass.length >= 6 ? pass : cedula;
      const signupRes = await fetch(`${SUPABASE_URL}/auth/v1/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', apikey: SUPABASE_KEY },
        body: JSON.stringify({ email: `${cedula}@freimanautos.com`, password: signupPass })
      });
      const signupData = await signupRes.json().catch(() => ({}));
      if (!signupRes.ok && signupData?.msg !== 'User already registered') {
        console.warn('signup result:', signupData);
        // Continúa igual — puede que ya exista en auth pero no en mecanicos
      }
      // Insertar en tabla mecanicos
      await api('/mecanicos', 'POST', { nombre, cedula, rol, activo: true, telegram_chat_id: tgChatId }, { Prefer: 'return=minimal' });
      toast(`${nombre} creado ✓ — contraseña inicial: ${signupPass === cedula ? 'su cédula' : 'la que configuraste'}`);
    }
    document.getElementById('modal-operario')?.remove();
    cargarMecanicosVista();
  } catch(e) {
    showErr('Error: ' + e.message);
    if (btn) { btn.disabled = false; btn.textContent = mecId ? 'Guardar cambios' : 'Crear operario'; }
  }
}

async function eliminarOperario(mecId, nombre) {
  if (!confirm(`¿Desactivar a ${nombre}?\n\nYa no podrá ingresar al sistema ni aparecerá en la lista de operarios.\nPuedes reactivarlo desde Supabase si es necesario.`)) return;
  try {
    await api(`/mecanicos?id=eq.${mecId}`, 'PATCH', { activo: false });
    toast(`${nombre} desactivado ✓`);
    cargarMecanicosVista();
  } catch(e) { toast('Error: ' + e.message, 'err'); }
}
// ═══════════════════════════════════════════════════════════
// GESTIÓN DE ROLES PERSONALIZADOS (solo gerente)
// ═══════════════════════════════════════════════════════════

async function abrirGestionRoles() {
  document.getElementById('modal-roles')?.remove();
  const roles = await api('/roles_config?order=nombre.asc').catch(() => []) || [];

  const m = document.createElement('div');
  m.id = 'modal-roles';
  m.className = 'modal-overlay show';
  m.innerHTML = `
    <div class="modal" style="max-width:680px;max-height:90vh;display:flex;flex-direction:column">
      <div class="modal-header">
        <div class="modal-titulo">
          <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="M9 12l2 2 4-4"/></svg>
          Roles y permisos
        </div>
        <button class="modal-cerrar" onclick="document.getElementById('modal-roles').remove()">✕</button>
      </div>
      <div style="padding:20px;overflow-y:auto;flex:1">
        <p style="font-size:13px;color:var(--gris-mid);margin-bottom:16px">
          Los roles personalizados permiten dar acceso limitado a ciertas secciones de la app a operarios que no son jefe ni mecánico tradicional.
        </p>
        <div style="display:flex;flex-direction:column;gap:10px;margin-bottom:20px" id="roles-lista">
          ${roles.length ? roles.map(r => _rolFila(r)).join('') : '<div style="font-size:13px;color:var(--gris-mid);text-align:center;padding:20px 0">Sin roles personalizados aún.</div>'}
        </div>
        <button class="btn btn-primary btn-sm" onclick="abrirModalRol(null)" style="width:100%;display:flex;align-items:center;justify-content:center;gap:6px">
          <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Crear nuevo rol
        </button>
      </div>
    </div>`;
  m.addEventListener('click', e => { if (e.target === m) m.remove(); });
  document.body.appendChild(m);
}

function _rolFila(r) {
  const perms = r.permisos || {};
  const cant  = Object.values(perms).filter(Boolean).length;
  return `<div style="background:white;border:1.5px solid var(--gris-borde);border-radius:8px;padding:12px 14px;display:flex;align-items:center;gap:12px">
    <div style="width:10px;height:10px;border-radius:50%;background:${r.color||'#6B7280'};flex-shrink:0"></div>
    <div style="flex:1;min-width:0">
      <div style="font-weight:600;font-size:13px">${escapeHtml(r.nombre)}</div>
      <div style="font-size:11px;color:var(--gris-mid);margin-top:2px">${cant} permiso${cant!==1?'s':''} activado${cant!==1?'s':''}</div>
    </div>
    <div style="display:flex;gap:6px">
      <button class="btn btn-ghost btn-xs" onclick="abrirModalRol(${JSON.stringify(r).replace(/"/g,'&quot;')})">
        <svg width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
      </button>
      <button class="btn btn-ghost btn-xs" style="color:var(--rojo)" onclick="eliminarRol(${r.id},'${escapeHtml(r.nombre)}')">
        <svg width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M9 6V4h6v2"/></svg>
      </button>
    </div>
  </div>`;
}

const _COLORES_ROL = ['#7C3AED','#2563EB','#059669','#D97706','#DC2626','#0891B2','#BE185D','#6B7280'];

function abrirModalRol(rol) {
  document.getElementById('modal-rol-edit')?.remove();
  const esEditar = rol !== null && rol !== undefined;
  const perms    = rol?.permisos || {};

  // Agrupar permisos por grupo
  const grupos = {};
  PERMISOS_CATALOGO.forEach(p => {
    if (!grupos[p.grupo]) grupos[p.grupo] = [];
    grupos[p.grupo].push(p);
  });

  const gruposHtml = Object.entries(grupos).map(([grupo, items]) => `
    <div style="margin-bottom:14px">
      <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--gris-mid);margin-bottom:8px">${grupo}</div>
      <div style="display:flex;flex-direction:column;gap:6px">
        ${items.map(p => `
          <label style="display:flex;align-items:center;gap:10px;padding:8px 12px;background:var(--gris-bg);border-radius:6px;cursor:pointer;font-size:13px">
            <input type="checkbox" id="perm-${p.key}" ${perms[p.key] ? 'checked' : ''} style="width:15px;height:15px;accent-color:#7C3AED">
            <span>${p.label}</span>
          </label>`).join('')}
      </div>
    </div>`).join('');

  const colorPickerHtml = _COLORES_ROL.map(c =>
    `<button type="button" onclick="document.getElementById('rol-color-val').value='${c}';document.querySelectorAll('.rol-color-dot').forEach(d=>d.classList.remove('sel'));this.querySelector('div').classList.add('sel')"
      class="rol-color-dot" style="background:none;border:none;padding:2px;cursor:pointer">
      <div style="width:22px;height:22px;border-radius:50%;background:${c};outline:${(rol?.color||'#7C3AED')===c?'3px solid '+c:'2px solid transparent'};outline-offset:2px" class="${(rol?.color||'#7C3AED')===c?'sel':''}"></div>
    </button>`
  ).join('');

  const m = document.createElement('div');
  m.id = 'modal-rol-edit';
  m.className = 'modal-overlay show';
  m.innerHTML = `
    <div class="modal" style="max-width:500px;max-height:90vh;display:flex;flex-direction:column">
      <div class="modal-header">
        <div class="modal-titulo">${esEditar ? 'Editar rol' : 'Nuevo rol'}</div>
        <button class="modal-cerrar" onclick="document.getElementById('modal-rol-edit').remove()">✕</button>
      </div>
      <div style="padding:20px;overflow-y:auto;flex:1;display:flex;flex-direction:column;gap:16px">
        <div class="field">
          <label>Nombre del rol</label>
          <input id="rol-nombre" type="text" placeholder="Ej: Asesor comercial, Administración..." value="${esEditar ? escapeHtml(rol.nombre) : ''}" ${esEditar ? 'readonly style="background:var(--gris-bg);color:var(--gris-mid)"' : ''}>
          ${esEditar ? '<div style="font-size:11px;color:var(--gris-mid);margin-top:3px">El nombre del rol no se puede cambiar (se usa como identificador).</div>' : ''}
        </div>
        <div class="field">
          <label>Color identificador</label>
          <div style="display:flex;align-items:center;gap:4px;flex-wrap:wrap">${colorPickerHtml}</div>
          <input type="hidden" id="rol-color-val" value="${rol?.color||'#7C3AED'}">
        </div>
        <div>
          <label style="font-size:13px;font-weight:600;color:var(--texto);display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">
            Permisos
            <button type="button" onclick="_rolToggleTodos(true)" class="btn btn-ghost btn-xs">Marcar todos</button>
          </label>
          ${gruposHtml}
        </div>
        <div id="rol-error" style="display:none;background:var(--rojo-bg);color:var(--rojo);border-radius:6px;padding:10px 14px;font-size:13px"></div>
        <div style="display:flex;gap:8px;justify-content:flex-end">
          <button class="btn btn-ghost" onclick="document.getElementById('modal-rol-edit').remove()">Cancelar</button>
          <button class="btn btn-primary" id="rol-btn-save" onclick="guardarRol(${esEditar ? rol.id : 'null'})">
            ${esEditar ? 'Guardar cambios' : 'Crear rol'}
          </button>
        </div>
      </div>
    </div>`;
  m.addEventListener('click', e => { if (e.target === m) m.remove(); });
  document.body.appendChild(m);
  setTimeout(() => document.getElementById('rol-nombre')?.focus(), 80);
}

function _rolToggleTodos(val) {
  PERMISOS_CATALOGO.forEach(p => {
    const el = document.getElementById('perm-' + p.key);
    if (el) el.checked = val;
  });
}

async function guardarRol(rolId) {
  const nombre = document.getElementById('rol-nombre')?.value.trim();
  const color  = document.getElementById('rol-color-val')?.value || '#6B7280';
  const errEl  = document.getElementById('rol-error');
  const showErr = msg => { errEl.textContent = msg; errEl.style.display = 'block'; };
  errEl.style.display = 'none';

  if (!nombre) { showErr('Ingresa un nombre para el rol.'); return; }

  // Leer permisos marcados
  const permisos = {};
  PERMISOS_CATALOGO.forEach(p => {
    permisos[p.key] = !!(document.getElementById('perm-' + p.key)?.checked);
  });
  const algunoActivo = Object.values(permisos).some(Boolean);
  if (!algunoActivo) { showErr('Activa al menos un permiso para este rol.'); return; }

  const btn = document.getElementById('rol-btn-save');
  if (btn) { btn.disabled = true; btn.textContent = 'Guardando...'; }

  try {
    if (rolId) {
      await api(`/roles_config?id=eq.${rolId}`, 'PATCH', { color, permisos });
      toast(`Rol "${nombre}" actualizado ✓`);
    } else {
      await api('/roles_config', 'POST', { nombre, color, permisos }, { Prefer: 'return=minimal' });
      toast(`Rol "${nombre}" creado ✓`);
    }
    document.getElementById('modal-rol-edit')?.remove();
    abrirGestionRoles(); // recargar lista
  } catch(e) {
    showErr('Error: ' + e.message);
    if (btn) { btn.disabled = false; btn.textContent = rolId ? 'Guardar cambios' : 'Crear rol'; }
  }
}

async function eliminarRol(rolId, nombre) {
  if (!confirm(`¿Eliminar el rol "${nombre}"?\n\nLos operarios con este rol quedarán sin permisos especiales hasta que se les asigne otro rol.`)) return;
  try {
    await api(`/roles_config?id=eq.${rolId}`, 'DELETE');
    toast(`Rol "${nombre}" eliminado`);
    abrirGestionRoles();
  } catch(e) { toast('Error: ' + e.message, 'err'); }
}

// ═══════════════════════════════════════════════════════════
// REGISTRO DE VEHÍCULOS
// ═══════════════════════════════════════════════════════════

let _vehiculosBusqueda = '';

async function cargarVehiculos() {
  const cont = document.getElementById('pag-vehiculos');
  if (!cont) return;
  cont.innerHTML = '<div class="loading-state">Cargando vehículos...</div>';
  try {
    // Registro de vehículos (tabla vehiculos) + órdenes. Así la lista muestra
    // los vehículos registrados aunque no tengan órdenes.
    const [registro, ordenes] = await Promise.all([
      api('/vehiculos?select=placa,marca,linea,modelo,color,vin,propietario,cedula_nit,telefono,fecha_ingreso&order=placa.asc&limit=4000').catch(() => []) || [],
      api('/ordenes?select=id,placa,marca,linea,modelo,color,vin,propietario,telefono,correo_cliente,cedula_cliente,tipo_cliente,aseguradora,estado,creado_en,fecha_entrega_1&order=placa.asc,creado_en.desc&limit=2000').catch(() => []) || []
    ]);

    // Mapa por placa: primero el registro, luego las órdenes (sin perder datos del registro)
    const vehiculosMap = {};
    (registro || []).forEach(v => {
      const placa = (v.placa || '').toUpperCase();
      if (!placa) return;
      vehiculosMap[placa] = { info: { ...v, cedula_cliente: v.cedula_nit }, ordenes: [] };
    });
    ordenes.forEach(o => {
      const placa = (o.placa || '').toUpperCase();
      if (!placa) return;
      if (!vehiculosMap[placa]) vehiculosMap[placa] = { info: o, ordenes: [] };
      else vehiculosMap[placa].info = { ...o, ...vehiculosMap[placa].info };
      vehiculosMap[placa].ordenes.push(o);
    });

    const vehiculos = Object.values(vehiculosMap).sort((a, b) =>
      (a.info.placa || '').localeCompare(b.info.placa || '')
    );

    const _renderVehiculos = (lista) => {
      if (!lista.length) return `<div style="padding:40px;text-align:center;color:var(--gris-mid);font-size:13px">Sin vehículos encontrados.</div>`;

      const estadoColor = { Activa:'#2563EB', Entregada:'#059669', Archivada:'#6B7280', Programada:'#7C3AED' };

      // Agrupar por mes/año de la orden más reciente
      const grupos = {};
      lista.forEach(v => {
        const ultima = v.ordenes[0]; // ya viene desc por creado_en
        const dRef = ultima?.creado_en || v.info?.fecha_ingreso || null;
        const d = dRef ? new Date(dRef) : null;
        const key = d
          ? d.toLocaleDateString('es-CO',{month:'long',year:'numeric'})
          : 'Sin fecha';
        if (!grupos[key]) grupos[key] = [];
        grupos[key].push(v);
      });

      return Object.entries(grupos).map(([periodo, gVehiculos]) => {
        const cuadros = gVehiculos.map(v => {
          const info   = v.info;
          const ots    = v.ordenes;
          const activo = ots.some(o => o.estado === 'Activa');
          const vehiculo = [info.marca, info.linea, info.modelo].filter(Boolean).map(escapeHtml).join(' ');
          const ultimaOT = ots[0];
          const badgeCol = activo ? '#2563EB' : '#6B7280';
          const _plEsc = escapeHtml(info.placa || '');
          const clk = ultimaOT ? `abrirOrden(${ultimaOT.id});navJefe('detalle')` : `verHistorialVehiculo('${_plEsc}')`;

          return `<div class="hover-lift" style="background:white;border:1.5px solid var(--gris-borde);border-radius:8px;padding:9px 11px;min-width:0">
            <div style="display:flex;align-items:center;justify-content:space-between;gap:4px;margin-bottom:4px">
              <span onclick="${clk}" style="font-family:'DM Mono',monospace;font-size:13px;font-weight:800;color:var(--texto);letter-spacing:.05em;cursor:pointer">${escapeHtml(info.placa||'—')}</span>
              <span style="font-size:9px;font-weight:700;color:${badgeCol};background:${badgeCol}18;padding:1px 6px;border-radius:3px">${ots.length} OT${ots.length!==1?'s':''}</span>
            </div>
            <div style="font-size:10.5px;color:var(--gris-mid);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;cursor:pointer" onclick="${clk}">${vehiculo || '—'}</div>
            ${info.propietario ? `<div style="font-size:10.5px;font-weight:600;color:var(--gris-texto);margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;cursor:pointer" onclick="${clk}">${escapeHtml(info.propietario)}</div>` : ''}
            <div style="margin-top:6px;padding-top:5px;border-top:1px solid var(--gris-borde);display:flex;align-items:center;gap:4px">
              <button onclick="event.stopPropagation();verHistorialVehiculo('${escapeHtml(info.placa||'')}')"
                style="flex:1;min-width:0;background:none;border:1px solid var(--gris-borde);border-radius:4px;padding:3px 4px;font-size:10px;cursor:pointer;color:var(--azul);display:flex;align-items:center;justify-content:center;gap:3px;white-space:nowrap;overflow:hidden"
                title="Ver historial de visitas">📋 Historial</button>
              <button onclick="event.stopPropagation();abrirPopupConsumibles('${escapeHtml(info.placa||'')}',${info.kilometraje||0})"
                style="flex:1;min-width:0;background:none;border:1px solid var(--gris-borde);border-radius:4px;padding:3px 4px;font-size:10px;cursor:pointer;color:var(--gris-mid);display:flex;align-items:center;justify-content:center;gap:3px;white-space:nowrap;overflow:hidden"
                title="Ver consumibles y documentos">🔧 <span style="overflow:hidden;text-overflow:ellipsis">Consumibles</span></button>
            </div>
          </div>`;
        }).join('');

        return `<div style="margin-bottom:20px">
          <div style="font-size:10px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:var(--gris-mid);font-family:'DM Mono',monospace;margin-bottom:8px;padding-bottom:5px;border-bottom:1px solid var(--gris-borde)">
            ${escapeHtml(periodo.charAt(0).toUpperCase()+periodo.slice(1))}
            <span style="opacity:.6">(${gVehiculos.length})</span>
          </div>
          <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(130px,1fr));gap:8px">
            ${cuadros}
          </div>
        </div>`;
      }).join('');
    };

    cont.innerHTML = `
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:14px;flex-wrap:wrap">
        <div style="flex:1;min-width:200px;position:relative">
          <svg width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" style="position:absolute;left:10px;top:50%;transform:translateY(-50%);color:var(--gris-mid);pointer-events:none"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
          <input type="text" placeholder="Buscar por placa, propietario, marca..." id="veh-buscar"
            style="width:100%;padding:7px 12px 7px 30px;border:1.5px solid var(--gris-borde);border-radius:8px;font-size:13px;outline:none;box-sizing:border-box;background:white"
            oninput="_vehiculosFiltrar(this.value)" value="${escapeHtml(_vehiculosBusqueda)}">
        </div>
        <div style="font-size:12px;color:var(--gris-mid);flex-shrink:0">${vehiculos.length} vehículo${vehiculos.length!==1?'s':''}</div>
      </div>
      <div id="veh-list-inner">${_renderVehiculos(vehiculos)}</div>`;

    // Guardar para filtrado en memoria
    window._vehiculosData = vehiculos;
    window._vehiculosRender = _renderVehiculos;

    // Aplicar búsqueda pendiente si hay
    if (_vehiculosBusqueda) _vehiculosFiltrar(_vehiculosBusqueda);

  } catch(e) {
    cont.innerHTML = `<div class="empty-state">Error: ${e.message}</div>`;
  }
}

function _vehiculosFiltrar(q) {
  _vehiculosBusqueda = q;
  const inner = document.getElementById('veh-list-inner');
  if (!inner || !window._vehiculosData) return;
  const term = q.toLowerCase().trim();
  const filtrados = term
    ? window._vehiculosData.filter(v => {
        const i = v.info;
        return (i.placa||'').toLowerCase().includes(term)
          || (i.propietario||'').toLowerCase().includes(term)
          || (i.marca||'').toLowerCase().includes(term)
          || (i.linea||'').toLowerCase().includes(term)
          || (i.cedula_cliente||'').toLowerCase().includes(term)
          || (i.telefono||'').toLowerCase().includes(term);
      })
    : window._vehiculosData;
  inner.innerHTML = window._vehiculosRender(filtrados);
  const counter = document.querySelector('#pag-vehiculos [style*="registrado"]');
  if (counter) counter.textContent = `${filtrados.length} vehículo${filtrados.length!==1?'s':''} registrado${filtrados.length!==1?'s':''}`;
}

// ═══════════════════════════════════════════════════════════
// GESTIÓN DE CONTRASEÑAS (jefe/gerente)
// ═══════════════════════════════════════════════════════════
function _modalPass(titulo, cedula, nombre) {
  document.getElementById('modal-cambiar-pass')?.remove();
  const m = document.createElement('div');
  m.id = 'modal-cambiar-pass';
  m.className = 'modal-overlay show';
  m.innerHTML = `
    <div class="modal" style="max-width:380px">
      <div class="modal-header">
        <div class="modal-titulo">
          <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
          ${titulo}
        </div>
        <button class="modal-cerrar" onclick="document.getElementById('modal-cambiar-pass').remove()">✕</button>
      </div>
      <div style="padding:20px;display:flex;flex-direction:column;gap:16px">
        <div style="background:var(--gris-bg);border-radius:8px;padding:10px 14px;font-size:13px;color:var(--gris-mid)">
          Usuario: <strong style="color:var(--texto)">${escapeHtml(nombre)}</strong>
        </div>
        <div class="field">
          <label>Nueva contraseña</label>
          <div style="display:flex;gap:8px;align-items:center">
            <input id="pass-nueva" type="password" placeholder="Mínimo 6 caracteres" style="flex:1;min-width:0;padding:10px 13px;border:1.5px solid var(--gris-borde);border-radius:6px;font-size:14px;color:var(--texto);outline:none;transition:border-color 0.15s">
            <button type="button" onclick="const i=document.getElementById('pass-nueva');i.type=i.type==='password'?'text':'password'" style="flex-shrink:0;width:42px;height:42px;border:1.5px solid var(--gris-borde);border-radius:6px;background:white;cursor:pointer;display:flex;align-items:center;justify-content:center;color:var(--gris-mid)">
              <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
            </button>
          </div>
        </div>
        <div class="field">
          <label>Confirmar contraseña</label>
          <input id="pass-confirmar" type="password" placeholder="Repite la contraseña">
        </div>
        <div id="pass-error" style="display:none;background:var(--rojo-bg);color:var(--rojo);border-radius:6px;padding:10px 14px;font-size:13px"></div>
        <div style="display:flex;gap:8px;justify-content:flex-end">
          <button class="btn btn-ghost" onclick="document.getElementById('modal-cambiar-pass').remove()">Cancelar</button>
          <button class="btn btn-primary" onclick="_guardarNuevaPass('${cedula}','${escapeHtml(nombre)}')">Guardar contraseña</button>
        </div>
      </div>
    </div>`;
  document.body.appendChild(m);
  document.getElementById('pass-nueva').focus();
}

function abrirCambiarPassMecanico(mecId, nombre) {
  // Buscar la cédula del mecánico para usarla como identificador de Supabase Auth
  api(`/mecanicos?id=eq.${mecId}&select=cedula,nombre`).then(data => {
    const mec = data?.[0];
    if (!mec?.cedula) { toast('Este técnico no tiene cédula registrada', 'err'); return; }
    _modalPass(`Cambiar contraseña — ${mec.nombre || nombre}`, mec.cedula, mec.nombre || nombre);
  }).catch(() => toast('Error al obtener datos del técnico', 'err'));
}

function abrirCambiarPassJefe() {
  // Solo visible para gerente
  if (sesion?.perfil !== 'gerente') return;
  api(`/configuracion?clave=eq.jefe_cedula`).then(data => {
    const cedula = data?.[0]?.valor;
    const nombre = 'Jefe de Taller';
    if (!cedula) { toast('No se encontró la cédula del jefe', 'err'); return; }
    _modalPass('Cambiar contraseña — Jefe de Taller', cedula, nombre);
  }).catch(() => toast('Error al obtener datos del jefe', 'err'));
}

async function _guardarNuevaPass(cedula, nombre) {
  const nueva    = document.getElementById('pass-nueva')?.value || '';
  const confirma = document.getElementById('pass-confirmar')?.value || '';
  const errEl    = document.getElementById('pass-error');

  const mostrarError = (msg) => { errEl.textContent = msg; errEl.style.display = 'block'; };
  errEl.style.display = 'none';

  if (nueva.length < 6)        { mostrarError('La contraseña debe tener al menos 6 caracteres.'); return; }
  if (nueva !== confirma)       { mostrarError('Las contraseñas no coinciden.'); return; }

  const btn = document.querySelector('#modal-cambiar-pass .btn-primary');
  if (btn) { btn.disabled = true; btn.textContent = 'Guardando...'; }

  try {
    const result = await api('/rpc/admin_cambiar_contrasena', 'POST', {
      p_target_cedula: cedula,
      p_nueva_password: nueva
    });
    if (result === false) throw new Error('Usuario no encontrado en el sistema');
    document.getElementById('modal-cambiar-pass')?.remove();
    toast(`Contraseña de ${nombre} actualizada ✓`);
  } catch(e) {
    mostrarError('Error al cambiar contraseña: ' + (e.message || 'Intenta de nuevo'));
    if (btn) { btn.disabled = false; btn.textContent = 'Guardar contraseña'; }
  }
}

// ═══════════════════════════════════════════════════════════
// DRAG & DROP — PANELES DE SERVICIO
// ═══════════════════════════════════════════════════════════
let srvDragSrc = null;

function srvDragStart(e, srvKey) {
  srvDragSrc = srvKey;
  e.currentTarget.classList.add('dragging');
  e.dataTransfer.effectAllowed = 'move';
  e.stopPropagation();
}
function srvDragOver(e) {
  e.preventDefault(); e.stopPropagation();
  e.dataTransfer.dropEffect = 'move';
  e.currentTarget.classList.add('srv-drag-over');
}
function srvDragLeave(e) {
  e.stopPropagation();
  e.currentTarget.classList.remove('srv-drag-over');
}
function srvDragDrop(e, targetSrv, ordenId) {
  e.preventDefault(); e.stopPropagation();
  e.currentTarget.classList.remove('srv-drag-over');
  if (!srvDragSrc || srvDragSrc === targetSrv) return;
  const container = document.getElementById('srv-drag-container');
  if (!container) return;
  const panels = [...container.querySelectorAll('.srv-panel[data-srv]')];
  const srcEl = panels.find(p => p.dataset.srv === srvDragSrc);
  const tgtEl = panels.find(p => p.dataset.srv === targetSrv);
  if (!srcEl || !tgtEl) return;
  const srcRect = srcEl.getBoundingClientRect();
  const tgtRect = tgtEl.getBoundingClientRect();
  if (srcRect.top < tgtRect.top) {
    tgtEl.parentNode.insertBefore(srcEl, tgtEl.nextSibling);
  } else {
    tgtEl.parentNode.insertBefore(srcEl, tgtEl);
  }
  const newOrder = [...container.querySelectorAll('.srv-panel[data-srv]')].map(p => p.dataset.srv);
  localStorage.setItem('srv_orden_' + ordenId, JSON.stringify(newOrder));
}
function srvDragEnd(e) {
  e.stopPropagation();
  e.currentTarget.classList.remove('dragging');
  document.querySelectorAll('.srv-panel').forEach(p => p.classList.remove('srv-drag-over'));
  srvDragSrc = null;
}

// ═══════════════════════════════════════════════════════════
// DRAG & DROP — ETAPAS DENTRO DE UN SERVICIO
// ═══════════════════════════════════════════════════════════
let etapaDragSrc = null;
let etapaDragSrvKey = null;

function etapaDragStart(e, eid, srvKey) {
  etapaDragSrc = eid;
  etapaDragSrvKey = srvKey;
  e.currentTarget.classList.add('dragging');
  e.dataTransfer.effectAllowed = 'move';
  e.stopPropagation();
}
function etapaDragOver(e) {
  e.preventDefault(); e.stopPropagation();
  e.dataTransfer.dropEffect = 'move';
  e.currentTarget.classList.add('etapa-drag-over');
}
function etapaDragLeave(e) {
  e.stopPropagation();
  e.currentTarget.classList.remove('etapa-drag-over');
}
function etapaDragDrop(e, targetEid, srvKey, ordenId) {
  e.preventDefault(); e.stopPropagation();
  e.currentTarget.classList.remove('etapa-drag-over');
  if (!etapaDragSrc || etapaDragSrc === targetEid || etapaDragSrvKey !== srvKey) return;
  const container = document.getElementById('edc-' + srvKey);
  if (!container) return;
  const cards = [...container.querySelectorAll('.etapa-card[data-eid]')];
  const srcEl = cards.find(c => parseInt(c.dataset.eid) === etapaDragSrc);
  const tgtEl = cards.find(c => parseInt(c.dataset.eid) === targetEid);
  if (!srcEl || !tgtEl) return;
  const srcRect = srcEl.getBoundingClientRect();
  const tgtRect = tgtEl.getBoundingClientRect();
  if (srcRect.top < tgtRect.top) {
    tgtEl.parentNode.insertBefore(srcEl, tgtEl.nextSibling);
  } else {
    tgtEl.parentNode.insertBefore(srcEl, tgtEl);
  }
  const newOrder = [...container.querySelectorAll('.etapa-card[data-eid]')].map(c => parseInt(c.dataset.eid));
  localStorage.setItem('etapa_orden_' + ordenId + '_' + srvKey, JSON.stringify(newOrder));
}
function etapaDragEnd(e) {
  e.stopPropagation();
  e.currentTarget.classList.remove('dragging');
  document.querySelectorAll('.etapa-card').forEach(c => c.classList.remove('etapa-drag-over'));
  etapaDragSrc = null;
  etapaDragSrvKey = null;
}

// ═══════════════════════════════════════════════════════════
// VALOR DE ETAPA
// ═══════════════════════════════════════════════════════════
async function patchValor(eid, k) {
  const val = parseFloat(document.getElementById(`val-${k}`)?.value) || null;
  await api(`/etapas?id=eq.${eid}`, 'PATCH', { valor: val }).catch(() => {});
}
// ═══════════════════════════════════════════════════════════
// MODAL CALENDARIO — info de orden al hacer click
// ═══════════════════════════════════════════════════════════
async function abrirCalModal(ordenId) {
  let modal = document.getElementById('modal-cal-orden');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'modal-cal-orden';
    modal.className = 'modal-overlay';
    modal.innerHTML = `<div class="modal" style="max-width:480px">
      <div class="modal-header">
        <h2 id="mcal-titulo">Orden</h2>
        <button class="btn btn-ghost btn-sm" onclick="document.getElementById('modal-cal-orden').classList.remove('show')">✕</button>
      </div>
      <div class="modal-body" id="mcal-body"><div class="loading-state">Cargando...</div></div>
      <div class="modal-footer">
        <button class="btn btn-ghost" onclick="document.getElementById('modal-cal-orden').classList.remove('show')">Cerrar</button>
        <button class="btn btn-primary" id="mcal-btn-abrir">Ver orden completa</button>
      </div>
    </div>`;
    modal.addEventListener('click', e => { if (e.target === modal) modal.classList.remove('show'); });
    document.body.appendChild(modal);
  }
  modal.classList.add('show');
  document.getElementById('mcal-body').innerHTML = '<div class="loading-state">Cargando...</div>';
  try {
    const [orden, etapas] = await Promise.all([
      api(`/ordenes?id=eq.${ordenId}`).then(d => d[0]),
      api(`/etapas?orden_id=eq.${ordenId}&order=creado_en.asc`).catch(()=>[]) || []
    ]);
    const total = etapas.length;
    const comp  = etapas.filter(e => e.fin).length;
    const pct   = total ? Math.round((comp/total)*100) : 0;
    const activa = etapas.find(e => e.inicio && !e.fin);
    const fmt = n => n != null ? new Intl.NumberFormat('es-CO',{style:'currency',currency:'COP',minimumFractionDigits:0}).format(n) : '—';
    const totalVal = etapas.reduce((s,e) => s+(e.valor||0), 0);
    const srvColor = { latoneria:'#DC2626', pintura:'#D97706', mecanica:'#2563EB', adicionales:'#059669' };
    const srvs = [...new Set(etapas.map(e=>e.servicio).filter(Boolean))];

    document.getElementById('mcal-titulo').textContent = orden.placa;
    document.getElementById('mcal-btn-abrir').onclick = () => {
      modal.classList.remove('show');
      abrirOrden(ordenId);
    };
    document.getElementById('mcal-body').innerHTML = `
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:16px">
        <div style="flex:1">
          <div style="font-size:13px;color:var(--gris-mid)">${[orden.marca,orden.linea,orden.modelo].filter(Boolean).map(escapeHtml).join(' ')||'—'}</div>
          <div style="font-size:12px;color:var(--gris-mid);margin-top:2px;display:flex;align-items:center;gap:4px">${orden.aseguradora?ico('building',12)+' '+escapeHtml(orden.aseguradora):''}</div>
        </div>
        <div style="text-align:right">
          <div style="font-size:28px;font-weight:700;font-family:'DM Mono',monospace;color:${pct===100?'var(--verde)':'var(--azul)'}">${pct}%</div>
          <div style="font-size:11px;color:var(--gris-mid)">${comp}/${total} etapas</div>
        </div>
      </div>
      <div style="height:6px;background:var(--gris-borde);border-radius:99px;overflow:hidden;margin-bottom:16px">
        <div style="height:100%;width:${pct}%;background:${pct===100?'var(--verde)':'var(--azul-mid)'};border-radius:99px;transition:width 0.4s"></div>
      </div>
      <div class="info-chips" style="margin-bottom:14px">
        <div class="info-chip"><div class="info-chip-label">Estado</div><div class="info-chip-val">${orden.pulmon?'En Pulmón':orden.estado||'Activa'}</div></div>
        <div class="info-chip"><div class="info-chip-label">Ingreso</div><div class="info-chip-val">${formatFecha(orden.creado_en)}</div></div>
        <div class="info-chip"><div class="info-chip-label">Entrega 1</div><div class="info-chip-val">${formatFecha(orden.fecha_entrega_1)||'—'}</div></div>
        <div class="info-chip"><div class="info-chip-label">Entrega 2</div><div class="info-chip-val">${formatFecha(orden.fecha_entrega_2)||'—'}</div></div>
        ${totalVal ? `<div class="info-chip"><div class="info-chip-label">Valor MO</div><div class="info-chip-val" style="color:var(--verde);font-weight:700">${fmt(totalVal)}</div></div>` : ''}
      </div>
      ${activa ? `<div style="padding:10px 14px;background:var(--azul-light);border-radius:6px;margin-bottom:10px;font-size:13px">
        <span style="color:var(--gris-mid)">Etapa actual:</span> <strong>${escapeHtml(activa.etapa)}</strong>${activa.tecnico?` · ${ico('user',12)} ${escapeHtml(activa.tecnico)}`:''}
      </div>` : ''}
      <div style="display:flex;gap:6px;flex-wrap:wrap">
        ${srvs.map(s=>`<span style="background:${srvColor[s]||'#6B7280'}15;color:${srvColor[s]||'#6B7280'};border:1px solid ${srvColor[s]||'#6B7280'}30;padding:3px 10px;border-radius:99px;font-size:11px;font-weight:600">${CATALOGO[s]?.nombre||s}</span>`).join('')}
      </div>`;
  } catch(e) {
    document.getElementById('mcal-body').innerHTML = `<div class="empty-state">Error: ${e.message}</div>`;
  }
}

// ═══════════════════════════════════════════════════════════
// VISTA DE ORDEN PARA MECÁNICO (filtrada)
// ═══════════════════════════════════════════════════════════
async function abrirOrdenMecanico(id) {
  mostrarPagina('pag-mec-orden');
  document.getElementById('topbar-title').textContent = 'Detalle de Orden';
  const cont = document.getElementById('mec-orden-contenido');
  if (!cont) return;
  cont.innerHTML = '<div class="loading-state">Cargando...</div>';
  try {
    const [orden, todasEtapas, fotosEt, solicitudes] = await Promise.all([
      api(`/ordenes?id=eq.${id}`).then(d => d[0]),
      api(`/etapas?orden_id=eq.${id}&order=creado_en.asc`).catch(()=>[]) || [],
      api(`/fotos_etapas?orden_id=eq.${id}&order=creado_en.desc`).catch(()=>[]) || [],
      api(`/solicitudes_repuesto?orden_id=eq.${id}&order=creado_en.desc&select=*`).catch(()=>[]) || []
    ]);

    // Solo etapas del mecánico actual
    const misEtapas = todasEtapas.filter(e => e.mecanico_id === sesion.id);
    const total = todasEtapas.length;
    const comp  = todasEtapas.filter(e => e.fin).length;
    const todasMisEtapasFin = misEtapas.length > 0 && misEtapas.every(e => !!e.fin);

    // Mapa solicitudes por etapa
    const _estC  = {pendiente_jefe:'#D97706',enviado_repuestos:'#7C3AED',cotizado:'#2563EB',pedido:'#0891B2',recibido_taller:'#059669',entregado:'#059669',rechazado:'#DC2626'};
    const _estBg = {pendiente_jefe:'#FEF3C7',enviado_repuestos:'#EDE9FE',cotizado:'#EBF2FF',pedido:'#E0F2FE',recibido_taller:'#E6F5EF',entregado:'#E6F5EF',rechazado:'#FEE2E2'};
    const _estL  = {pendiente_jefe:'Pendiente',enviado_repuestos:'En gestión',cotizado:'Cotizado',pedido:'Pedido',recibido_taller:'¡Llegó!',entregado:'Entregado ✓',rechazado:'Rechazado'};
    const pct   = total ? Math.round((comp/total)*100) : 0;
    const circ  = 2 * Math.PI * 22;

    const tlHtml = todasEtapas.map((e,i) => {
      const done = !!e.fin, active = !!e.inicio && !e.fin;
      const cls = done ? 'done' : active ? 'active' : 'pending';
      return `<div class="timeline-step ${done?'done':''}">
        <div class="timeline-dot ${cls}">${done?'✓':active?'●':(i+1)}</div>
        <div class="timeline-label ${cls}">${escapeHtml(e.etapa)||'—'}</div>
      </div>`;
    }).join('');

    // Render solo mis etapas
    const etapasHtml = misEtapas.map(e => {
      const k = kid(e.id);
      const esPausado  = e.pausado && !e.fin;
      const etapaSols  = solicitudes.filter(s => s.etapa_id === e.id);
      const hayRepPend = etapaSols.some(s => ['pendiente_jefe','enviado_repuestos','cotizado','pedido','recibido_taller'].includes(s.estado));
      const badge = !e.inicio ? 'Pendiente' : e.fin ? 'Completada' : esPausado ? (hayRepPend ? '⏸ Esperando repuesto' : 'Pausado ⏸') : 'En proceso';
      const bCls  = !e.inicio ? 'pendiente' : e.fin ? 'completada' : esPausado ? 'pendiente' : 'iniciada';
      const eFotos = fotosEt.filter(f => f.etapa_id === e.id);
      let acc = '';
      if (!e.inicio) acc = `<button class="btn btn-success btn-sm" data-eid="${e.id}" data-etapa="${escapeHtml(e.etapa||'')}" data-oid="${id}" onclick="mecIniciarEtapaDetalle(+this.dataset.eid,this.dataset.etapa,+this.dataset.oid)">▶ Iniciar</button>`;
      else if (esPausado && hayRepPend) acc = `<span style="font-size:12px;color:#D97706;font-weight:600;display:flex;align-items:center;gap:4px"><svg width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>Esperando repuesto</span>`;
      else if (!e.fin) acc = `<button class="btn btn-danger btn-sm" data-eid="${e.id}" data-etapa="${escapeHtml(e.etapa||'')}" data-srv="${escapeHtml(e.servicio||'')}" data-oid="${id}" onclick="mecFinalizarEtapaDetalle(+this.dataset.eid,this.dataset.etapa,this.dataset.srv,+this.dataset.oid)">■ Finalizar</button>`;

      const fotosHtml = eFotos.map(f=>`<div class="foto-thumb" data-url="${escapeHtml(f.url)}" onclick="abrirLightbox(this.dataset.url)"><img src="${escapeHtml(f.url)}" alt="" loading="lazy"></div>`).join('');

      // Solicitudes de repuesto para esta etapa
      const solsRepHtml = etapaSols.length
        ? etapaSols.map(s => {
            const est = s.estado || 'pendiente_jefe';
            const c = _estC[est] || '#6B7280';
            const bg = _estBg[est] || '#F3F4F6';
            const lbl = _estL[est] || est;
            const esperandoMin = (est === 'pedido' || est === 'enviado_repuestos') && s.creado_en
              ? Math.round((Date.now() - new Date(s.creado_en).getTime()) / 60000) : null;
            const esperandoStr = esperandoMin !== null
              ? `⏱ Esperando hace ${esperandoMin >= 60 ? Math.floor(esperandoMin/60)+'h '+esperandoMin%60+'m' : esperandoMin+'m'}`
              : null;
            return `<div style="padding:8px 0;border-bottom:1px solid var(--gris-borde)">
              <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:8px">
                <div style="min-width:0">
                  <div style="font-size:13px;font-weight:600">${escapeHtml(s.repuesto||'Repuesto')}</div>
                  <div style="font-size:11px;color:var(--gris-mid)">x${s.unidades||1}${s.observaciones?' · '+escapeHtml(s.observaciones):''}</div>
                  ${esperandoStr ? `<div style="font-size:11px;color:#D97706;font-weight:600;margin-top:3px">${esperandoStr}</div>` : ''}
                  ${est==='recibido_taller' ? '<div style="font-size:12px;color:#059669;font-weight:600;margin-top:4px">📦 El repuesto llegó al taller. El jefe te lo entregará pronto.</div>' : ''}
                  ${s.nota_jefe && est!=='recibido_taller' ? `<div style="font-size:12px;color:#1E40AF;background:#EBF2FF;border-radius:6px;padding:5px 8px;margin-top:5px">${escapeHtml(s.nota_jefe)}</div>` : ''}
                </div>
                <span style="font-size:10px;font-weight:800;color:${c};background:${bg};padding:3px 8px;border-radius:99px;white-space:nowrap;flex-shrink:0;margin-top:2px">${lbl}</span>
              </div>
            </div>`;
          }).join('')
        : '<div style="font-size:12px;color:var(--gris-mid)">Sin solicitudes.</div>';

      return `<div class="etapa-card" style="margin-bottom:12px${esPausado ? ';border:1.5px solid #F59E0B' : ''}">
        <div class="etapa-header" onclick="toggleEtapa('meb-${k}')" style="${esPausado ? 'background:rgba(254,243,199,.35)' : ''}">
          <div style="flex:1"><div class="etapa-nombre">${escapeHtml(e.etapa)||'—'}</div></div>
          <div style="display:flex;align-items:center;gap:6px">
            <span class="badge badge-${bCls}">${badge}</span>
            ${acc}
          </div>
        </div>
        <div class="etapa-body" id="meb-${k}">
          ${esPausado && hayRepPend ? `<div style="background:#FEF3C7;border:1px solid #FDE68A;border-radius:8px;padding:10px 14px;margin-bottom:12px;display:flex;align-items:center;gap:8px">
            <svg width="14" height="14" fill="none" stroke="#D97706" stroke-width="2.5" viewBox="0 0 24 24"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
            <span style="font-size:13px;color:#92400E;font-weight:600">Timer pausado — el jefe está gestionando tu repuesto</span>
          </div>` : ''}
          <div class="timestamps" style="margin-bottom:12px">
            <div class="ts-chip">Inicio: <strong>${e.inicio?formatTS(e.inicio):'—'}</strong></div>
            <div class="ts-chip">Fin: <strong>${e.fin?formatTS(e.fin):'—'}</strong></div>
          </div>
          <div class="fotos-section">
            <label style="font-size:11px;font-weight:600;letter-spacing:1px;text-transform:uppercase;color:var(--gris-mid)">Fotos (${eFotos.length})</label>
            <div class="fotos-grid" style="margin-top:6px">${fotosHtml}</div>
            <div class="upload-zone" onclick="document.getElementById('mec-fi2-${k}').click()" style="margin-top:8px">
              <input type="file" id="mec-fi2-${k}" accept="image/*" multiple data-eid="${e.id}" data-etapa="${escapeHtml(e.etapa||'')}" data-oid="${id}" onchange="mecSubirFotos(this,+this.dataset.eid,this.dataset.etapa,+this.dataset.oid)">
              <div style="opacity:0.45">${ico('camera', 20)}</div><p>Subir fotos</p>
              <div class="upload-prog" id="mec-prog2-${k}"></div>
            </div>
          </div>
          <div style="margin-top:14px;border-top:1px solid var(--gris-borde);padding-top:12px">
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
              <span style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--gris-mid)">Repuestos</span>
              ${!e.fin ? `<button class="btn btn-ghost btn-xs" style="font-size:11px;padding:3px 10px"
                onclick="event.stopPropagation();abrirModalSolicitudRepuesto(${id},${e.id},'${escapeHtml(orden.placa||'').replace(/'/g,"\\x27")}')">+ Solicitar</button>` : ''}
            </div>
            ${solsRepHtml}
          </div>
        </div>
      </div>`;
    }).join('');

    cont.innerHTML = `
      <button class="back-btn" onclick="navMec('ordenes')">← Volver</button>
      <div class="detalle-header-card" style="margin-bottom:16px">
        <div class="detalle-placa-row">
          <div>
            <div class="detalle-placa">${escapeHtml(orden.placa)}</div>
            <div class="detalle-vehiculo">${[orden.marca,orden.linea,orden.modelo,orden.color].filter(Boolean).map(escapeHtml).join(' · ')||'—'}</div>
          </div>
          <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;justify-content:flex-end">
            <span class="badge badge-${orden.pulmon?'pulmon':(orden.estado||'activa').toLowerCase()}">${orden.pulmon?'En Pulmón':escapeHtml(orden.estado)||'Activa'}</span>
          </div>
        </div>
        <div class="donut-section">
          <svg width="56" height="56" viewBox="0 0 56 56">
            <circle class="donut-track" cx="28" cy="28" r="22"/>
            <circle class="donut-fill ${pct===100?'completa':'proceso'}" cx="28" cy="28" r="22" style="stroke-dasharray:${(pct/100)*circ} ${circ}"/>
            <text class="donut-pct" x="28" y="32" text-anchor="middle">${pct}%</text>
          </svg>
          <div class="donut-info">
            <div class="donut-label">Progreso general</div>
            <div class="donut-val">${comp} / ${total} etapas</div>
            <div class="donut-label" style="margin-top:4px">Fechas de entrega</div>
            <div style="font-size:13px;font-weight:600">${formatFecha(orden.fecha_entrega_1)||'—'}${orden.fecha_entrega_2?' / '+formatFecha(orden.fecha_entrega_2):''}</div>
          </div>
        </div>
        <div class="timeline-wrap"><div class="etapas-timeline">${tlHtml}</div></div>
      </div>
      <div class="seccion-titulo" style="margin-bottom:12px">Mis etapas en esta orden</div>
      ${misEtapas.length ? etapasHtml : '<div class="empty-state"><p>No tenés etapas asignadas en esta orden.</p></div>'}`;
  } catch(e) {
    cont.innerHTML = `<div class="empty-state">Error: ${e.message}</div>`;
  }
}

async function mecFinalizarEtapaDetalle(eid, nombre, servicio, oid) {
  try {
    const repPend = await api(`/solicitudes_repuesto?etapa_id=eq.${eid}&estado=in.(pendiente_jefe,enviado_repuestos,cotizado,pedido)&select=id,repuesto`).catch(()=>[]) || [];
    if (repPend.length) {
      toast(`No puedes finalizar. Hay ${repPend.length} repuesto(s) pendiente(s): ${repPend.map(r=>r.repuesto).join(', ')}`, 'err');
      return;
    }
    await api(`/etapas?id=eq.${eid}`, 'PATCH', { fin: new Date().toISOString() });
    toast(`${nombre} finalizada ✓`);
    const etapasOrden = await api(`/etapas?orden_id=eq.${oid}&order=creado_en.asc`);
    const etapaActual = etapasOrden.find(e => e.id === eid);
    const todasComp   = etapasOrden.every(e => e.fin || e.id === eid);
    const orden = await api(`/ordenes?id=eq.${oid}`).then(d=>d[0]).catch(()=>({}));
    fetch(N8N_WEBHOOK, { method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ evento: todasComp?'orden_completada':'etapa_finalizada',
        orden: {id:oid,placa:orden.placa,propietario:orden.propietario,marca:orden.marca,linea:orden.linea},
        etapa_finalizada: {id:eid,nombre,servicio:etapaActual?.servicio||servicio,tecnico:etapaActual?.tecnico||null},
        todas_completadas:todasComp, link:`${window.location.origin}${window.location.pathname}`})
    }).catch(()=>{});
    abrirOrdenMecanico(oid);
  } catch(e) { toast('Error: '+e.message, 'err'); }
}

async function mecIniciarEtapaDetalle(eid, nombre, oid) {
  try {
    await api(`/etapas?id=eq.${eid}`, 'PATCH', { inicio: new Date().toISOString() });
    toast(`${nombre} iniciada ✓`);
    abrirOrdenMecanico(oid);
  } catch(e) { toast('Error: ' + e.message, 'err'); }
}

async function mecGuardarNovedadDetalle(eid, oid) {
  const motivo = document.getElementById(`mec2-nmot-${eid}`)?.value?.trim();
  if (!motivo) { toast('El motivo es obligatorio', 'err'); return; }
  try {
    await api('/novedades', 'POST', {
      orden_id: oid, etapa_id: eid,
      tipo: document.getElementById(`mec2-ntype-${eid}`).value,
      responsable: sesion.nombre,
      motivo, desde: new Date().toISOString(),
      valor_adicional: parseFloat(document.getElementById(`mec2-nvalor-${eid}`)?.value) || null
    }, { Prefer: 'return=minimal' });
    toast('Novedad registrada ✓');
    abrirOrdenMecanico(oid);
  } catch(e) { toast('Error: '+e.message, 'err'); }
}

// ═══════════════════════════════════════════════════════════
// HELPERS REPORTE DESDE VISTAS
// ═══════════════════════════════════════════════════════════
function abrirReporteTecnico(mecId) {
  const overlay = document.getElementById('modal-reporte');
  if (!overlay) { toast('Modal de reporte no encontrado','err'); return; }
  overlay.dataset.tipo = 'tecnico';
  document.getElementById('modal-rep-titulo').textContent = 'Reporte del técnico';
  const selWrap = document.getElementById('rep-sel-tecnico');
  const selId   = document.getElementById('rep-sel-tecnico-id');
  if (selWrap) selWrap.style.display = 'block';
  if (selId)   selId.value = mecId;
  // Llenar select con nombre del técnico
  _cargarSelectTecnicos(mecId);
  overlay.classList.add('show');
}

function abrirReporteTodosTecnicos() {
  abrirModalReporte('todos_tecnicos');
}

function abrirReporteOrdenes() {
  abrirModalReporte('ordenes');
}

async function _cargarSelectTecnicos(preselect) {
  const sel = document.getElementById('rep-sel-tecnico-id');
  if (!sel) return;
  if (sel.options.length <= 1) {
    const mecs = await api('/mecanicos?activo=eq.true&order=nombre.asc').catch(()=>[]) || [];
    sel.innerHTML = mecs.map(m=>`<option value="${m.id}" ${String(m.id)===String(preselect)?'selected':''}>${escapeHtml(m.nombre)}</option>`).join('');
  } else if (preselect) {
    sel.value = preselect;
  }
}
// ═══════════════════════════════════════════════════════════
// EDITAR DATOS DE ORDEN (solo jefe, solo si no está entregada)
// ═══════════════════════════════════════════════════════════
async function abrirEditarOrden(ordenId) {
  const orden = ordenActual;
  if (!orden) return;

  // Cargar listas dinámicas
  const [aseguradoras, flotillas] = await Promise.all([
    api('/aseguradoras?activo=eq.true&order=nombre.asc').catch(()=>[]) || [],
    api('/flotillas?activo=eq.true&order=nombre.asc').catch(()=>[]) || []
  ]);

  const tipoActual = orden.tipo_cliente || '';
  const esPNatural = !tipoActual || tipoActual === 'particular';
  const esEmpresa  = tipoActual === 'empresa';

  const asegOpts = aseguradoras.map(a =>
    `<option value="${escapeHtml(a.nombre)}" ${orden.aseguradora===a.nombre?'selected':''}>${escapeHtml(a.nombre)}</option>`
  ).join('');
  const flotOpts = flotillas.map(f =>
    `<option value="${escapeHtml(f.nombre)}" ${orden.aseguradora===f.nombre?'selected':''}>${escapeHtml(f.nombre)}</option>`
  ).join('');

  const modal = document.getElementById('modal-editar-orden');
  const body  = document.getElementById('modal-editar-body');
  if (!modal || !body) return;

  body.innerHTML = `
    <div style="display:flex;flex-direction:column;gap:12px">

      <!-- VEHÍCULO -->
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
        <div class="field"><label>Placa</label><input id="ed-placa" value="${escapeHtml(orden.placa||'')}" style="font-family:'DM Mono',monospace;letter-spacing:2px;font-size:16px" oninput="this.value=this.value.toUpperCase()"></div>
        <div class="field"><label>Marca</label><input id="ed-marca" value="${escapeHtml(orden.marca||'')}"></div>
        <div class="field"><label>Línea</label><input id="ed-linea" value="${escapeHtml(orden.linea||'')}"></div>
        <div class="field"><label>Año</label><input id="ed-modelo" type="number" value="${escapeHtml(orden.modelo||'')}"></div>
        <div class="field"><label>Color</label><input id="ed-color" value="${escapeHtml(orden.color||'')}"></div>
        <div class="field"><label>Kilometraje</label><input id="ed-km" type="number" value="${escapeHtml(String(orden.kilometraje||''))}"></div>
      </div>
      <div class="field">
        <label>VIN <span style="font-weight:400;color:var(--gris-mid);font-size:11px">(17 caracteres, opcional)</span></label>
        <input id="ed-vin" value="${escapeHtml(orden.vin||'')}" maxlength="17" style="font-family:'DM Mono',monospace;letter-spacing:1px" oninput="this.value=this.value.toUpperCase()">
      </div>

      <!-- PROPIETARIO / EMPRESA -->
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px" id="ed-bloque-propietario">
        <div class="field" id="ed-wrap-nombre" style="grid-column:1/-1">
          <label id="ed-lbl-nombre">Nombre completo</label>
          <input id="ed-propietario" value="${escapeHtml(orden.propietario||'')}">
        </div>
        <div class="field"><label>Teléfono</label><input id="ed-telefono" value="${escapeHtml(orden.telefono||'')}"></div>
        <div class="field"><label id="ed-lbl-doc">Cédula / NIT</label><input id="ed-cedula" value="${escapeHtml(orden.cedula_cliente||'')}"></div>
        <div class="field" style="grid-column:1/-1"><label>Correo electrónico</label><input id="ed-correo" type="email" value="${escapeHtml(orden.correo_cliente||'')}"></div>
      </div>

      <!-- ORDEN -->
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
        <div class="field"><label>Tipo de cliente</label>
          <select id="ed-tipo-cliente" onchange="toggleTipoClienteEdit(this.value);toggleTipoPersonaEdit(this.value==='empresa'?'empresa':'natural')">
            <option value="">— Seleccionar —</option>
            <option value="particular" ${tipoActual==='particular'||!tipoActual?'selected':''}>Particular</option>
            <option value="aseguradora" ${tipoActual==='aseguradora'?'selected':''}>Aseguradora</option>
            <option value="flotilla" ${tipoActual==='flotilla'?'selected':''}>Flotilla</option>
            <option value="empresa" ${tipoActual==='empresa'?'selected':''}>Empresa</option>
          </select>
        </div>
        <div class="field" id="ed-wrap-aseg" style="display:${tipoActual==='aseguradora'?'block':'none'}">
          <label>Aseguradora</label>
          <div style="display:flex;gap:6px">
            <select id="ed-aseguradora" style="flex:1">
              <option value="">— Seleccionar —</option>
              ${asegOpts}
            </select>
            <button class="btn btn-ghost btn-sm" onclick="agregarNuevaAseg()" title="Agregar nueva">+</button>
          </div>
        </div>
        <div class="field" id="ed-wrap-flot" style="display:${tipoActual==='flotilla'?'block':'none'}">
          <label>Flotilla</label>
          <div style="display:flex;gap:6px">
            <select id="ed-flotilla" style="flex:1">
              <option value="">— Seleccionar —</option>
              ${flotOpts}
            </select>
            <button class="btn btn-ghost btn-sm" onclick="agregarNuevaFlot()" title="Agregar nueva">+</button>
          </div>
        </div>

        <div class="field"><label>Fecha estimada de entrega</label><input id="ed-fecha1" type="datetime-local" value="${orden.fecha_entrega_1 ? orden.fecha_entrega_1.slice(0,16) : ''}"></div>
        <div class="field"><label>Fecha entrega alternativa</label><input id="ed-fecha2" type="datetime-local" value="${orden.fecha_entrega_2 ? orden.fecha_entrega_2.slice(0,16) : ''}"></div>
      </div>
    </div>
  `;

  // Establecer estado visual inicial
  toggleTipoClienteEdit(tipoActual);
  toggleTipoPersonaEdit(esEmpresa ? 'empresa' : 'natural');

  // Banner + campos resaltados si hay datos faltantes
  const _datosFaltantesEdit = [];
  const _resaltarCampo = (id, label) => {
    const el = document.getElementById(id);
    if (el && !el.value.trim()) {
      el.style.borderColor = '#EF4444';
      el.style.boxShadow = '0 0 0 2px rgba(239,68,68,.15)';
      el.addEventListener('input', function _clear() {
        el.style.borderColor = '';
        el.style.boxShadow = '';
        el.removeEventListener('input', _clear);
        // Quitar banner si ya no hay campos vacíos
        const banner = document.getElementById('ed-datos-faltantes-banner');
        if (banner) {
          const aun = ['ed-propietario','ed-marca','ed-linea','ed-telefono'].some(i => {
            const inp = document.getElementById(i);
            return inp && !inp.value.trim();
          });
          if (!aun) banner.remove();
        }
      }, { once: true });
      _datosFaltantesEdit.push(label);
    }
  };
  _resaltarCampo('ed-propietario', 'Nombre del propietario');
  _resaltarCampo('ed-marca',       'Marca del vehículo');
  _resaltarCampo('ed-linea',       'Línea del vehículo');
  _resaltarCampo('ed-telefono',    'Teléfono de contacto');

  if (_datosFaltantesEdit.length) {
    const banner = document.createElement('div');
    banner.id = 'ed-datos-faltantes-banner';
    banner.style.cssText = 'background:#FFFBEB;border:1.5px solid #FDE68A;border-radius:8px;padding:10px 14px;font-size:13px;color:#92400E;display:flex;align-items:flex-start;gap:8px;margin-bottom:4px';
    banner.innerHTML = `<span style="font-size:15px;flex-shrink:0">⚠</span><div><strong>Faltan datos por completar:</strong><div style="margin-top:3px;font-size:12px;color:#B45309">${_datosFaltantesEdit.join(' · ')}</div></div>`;
    body.insertAdjacentElement('afterbegin', banner);
  }

  modal.classList.add('show');
}

function toggleTipoPersonaEdit(tipo) {
  const lblNombre = document.getElementById('ed-lbl-nombre');
  const lblDoc    = document.getElementById('ed-lbl-doc');
  if (tipo === 'empresa') {
    if (lblNombre) lblNombre.textContent = 'Razón social';
    if (lblDoc)    lblDoc.textContent    = 'NIT';
  } else {
    if (lblNombre) lblNombre.textContent = 'Nombre completo';
    if (lblDoc)    lblDoc.textContent    = 'Cédula';
  }
}

function toggleTipoClienteEdit(tipo) {
  const wAseg = document.getElementById('ed-wrap-aseg');
  const wFlot = document.getElementById('ed-wrap-flot');
  if (wAseg) wAseg.style.display = tipo === 'aseguradora' ? 'block' : 'none';
  if (wFlot) wFlot.style.display = tipo === 'flotilla'    ? 'block' : 'none';
}

async function agregarNuevaAseg() {
  const nombre = prompt('Nombre de la nueva aseguradora:')?.trim();
  if (!nombre) return;
  try {
    await api('/aseguradoras', 'POST', { nombre, activo: true }, { Prefer: 'return=minimal' });
    toast('Aseguradora agregada ✓');
    // Recargar select
    const aseg = await api('/aseguradoras?activo=eq.true&order=nombre.asc').catch(()=>[]) || [];
    const sel = document.getElementById('ed-aseguradora');
    if (sel) {
      sel.innerHTML = '<option value="">— Seleccionar —</option>' +
        aseg.map(a=>`<option value="${escapeHtml(a.nombre)}" ${a.nombre===nombre?'selected':''}>${escapeHtml(a.nombre)}</option>`).join('');
    }
  } catch(e) { toast('Error: '+e.message,'err'); }
}

async function agregarNuevaFlot() {
  const nombre = prompt('Nombre de la nueva flotilla:')?.trim();
  if (!nombre) return;
  try {
    await api('/flotillas', 'POST', { nombre, activo: true }, { Prefer: 'return=minimal' });
    toast('Flotilla agregada ✓');
    const flot = await api('/flotillas?activo=eq.true&order=nombre.asc').catch(()=>[]) || [];
    const sel = document.getElementById('ed-flotilla');
    if (sel) {
      sel.innerHTML = '<option value="">— Seleccionar —</option>' +
        flot.map(f=>`<option value="${escapeHtml(f.nombre)}" ${f.nombre===nombre?'selected':''}>${escapeHtml(f.nombre)}</option>`).join('');
    }
  } catch(e) { toast('Error: '+e.message,'err'); }
}

async function guardarEdicionOrden() {
  const btn = document.getElementById('btn-guardar-edicion');
  if (btn) { btn.disabled = true; btn.textContent = 'Guardando...'; }

  try {
    const tipoPersona = document.querySelector('input[name="ed-tipo-persona"]:checked')?.value || 'natural';
    const tipoCliente = document.getElementById('ed-tipo-cliente')?.value || null;
    const vin = document.getElementById('ed-vin')?.value.trim().toUpperCase() || null;
    if (vin && vin.length !== 17) { toast('VIN debe tener 17 caracteres','err'); return; }

    // Aseguradora / flotilla según tipo
    let aseguradora = null;
    if (tipoCliente === 'aseguradora') {
      aseguradora = document.getElementById('ed-aseguradora')?.value || null;
    } else if (tipoCliente === 'flotilla') {
      aseguradora = document.getElementById('ed-flotilla')?.value || null;
    }

    const patch = {
      placa:           (document.getElementById('ed-placa')?.value.trim().toUpperCase()) || ordenActual.placa,
      marca:           document.getElementById('ed-marca')?.value.trim()    || null,
      linea:           document.getElementById('ed-linea')?.value.trim()    || null,
      modelo:          document.getElementById('ed-modelo')?.value          || null,
      color:           document.getElementById('ed-color')?.value.trim()    || null,
      kilometraje:     parseInt(document.getElementById('ed-km')?.value)    || null,
      vin:             vin,
      propietario:     document.getElementById('ed-propietario')?.value.trim() || null,
      telefono:        document.getElementById('ed-telefono')?.value.trim() || null,
      cedula_cliente:  document.getElementById('ed-cedula')?.value.trim()   || null,
      correo_cliente:  document.getElementById('ed-correo')?.value.trim()   || null,
      tipo_cliente:    tipoPersona === 'empresa' ? 'empresa' : (tipoCliente || null),
      aseguradora:     aseguradora,
      nivel_dano:      document.getElementById('ed-dano')?.value            || null,
      fecha_entrega_1: document.getElementById('ed-fecha1')?.value          || null,
      fecha_entrega_2: document.getElementById('ed-fecha2')?.value          || null,
    };

    await api(`/ordenes?id=eq.${ordenActual.id}`, 'PATCH', patch);
    toast('Datos actualizados ✓');
    document.getElementById('modal-editar-orden')?.classList.remove('show');
    abrirOrden(ordenActual.id); // Recargar detalle
  } catch(e) {
    toast('Error: '+e.message,'err');
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = 'Guardar cambios'; }
  }
}
// ── Combustible (dropdown en inventario) ─────────────────────
const _COMB_LABELS = { vacio:'Vacío', '1/4':'1/4 tanque', '1/2':'1/2 tanque', '3/4':'3/4 tanque', lleno:'Lleno' };

function abrirDropdownCombustible(e, el) {
  e.stopPropagation();
  const dd = document.getElementById('comb-dropdown');
  if (!dd) return;
  const rect = el.getBoundingClientRect();
  const scrollY = window.scrollY || document.documentElement.scrollTop;
  dd.style.top      = (rect.bottom + scrollY + 4) + 'px';
  dd.style.left     = rect.left + 'px';
  dd.style.minWidth = rect.width + 'px';
  dd.classList.toggle('open');
}

function seleccionarCombustible(valor) {
  const item   = document.getElementById('inv-combustible-item');
  const label  = document.getElementById('inv-combustible-label');
  const hidden = document.getElementById('n-combustible-val');
  if (hidden) hidden.value = valor;
  if (label)  label.textContent = _COMB_LABELS[valor] || 'Combustible';
  if (item)   item.classList.add('checked');
  document.getElementById('comb-dropdown')?.classList.remove('open');
}

document.addEventListener('click', () => {
  const dd = document.getElementById('comb-dropdown');
  if (dd?.classList.contains('open')) dd.classList.remove('open');
});

// ── Reset nueva orden ────────────────────────────────────────
function resetNuevaOrden() {
  _ordenCompletandoId = null; // formulario fresco = crear, no completar
  ['n-placa','n-numero-ot','n-marca','n-linea','n-modelo','n-color','n-km','n-fecha1','n-fecha2',
   'n-inv-obs','n-vin','n-propietario','n-telefono','n-cedula-cliente','n-correo-cliente',
   'n-direccion','n-propietario-aseg','n-telefono-aseg','n-cedula-aseg','n-correo-aseg',
   'n-aseg-nombre','n-aseg-nit','n-flot-nombre','n-flot-nit','n-flot-dir',
   'n-emp-nombre','n-emp-nit','n-empresa-tel','n-combustible-val'].forEach(id => {
    const el = document.getElementById(id); if (el) el.value = '';
  });
  const _kmChk2 = document.getElementById('n-km-omitir');
  if (_kmChk2) { _kmChk2.checked = false; }
  const _kmInp2 = document.getElementById('n-km');
  if (_kmInp2) { _kmInp2.disabled = false; _kmInp2.style.opacity = '1'; }
  document.querySelectorAll('.inv-item.checked').forEach(el => el.classList.remove('checked'));
  const _ci = document.getElementById('inv-combustible-item');
  const _cl = document.getElementById('inv-combustible-label');
  if (_ci) _ci.classList.remove('checked');
  if (_cl) _cl.textContent = 'Combustible';
  document.querySelectorAll('.tipo-cliente-btn.selected').forEach(el => el.classList.remove('selected'));
  ['n-wrap-particular','n-wrap-aseg','n-wrap-flot','n-wrap-empresa'].forEach(id => {
    const el = document.getElementById(id); if (el) el.style.display = 'none';
  });
  ['n-wrap-aseg-extra','n-wrap-flot-extra','n-wrap-empresa-extra'].forEach(id => {
    const el = document.getElementById(id); if (el) el.style.display = 'none';
  });
  document.getElementById('n-tipo-cliente') && (document.getElementById('n-tipo-cliente').value = '');
  document.getElementById('placa-resultado') && (document.getElementById('placa-resultado').style.display = 'none');
  document.getElementById('historial-previo') && (document.getElementById('historial-previo').style.display = 'none');
  document.getElementById('ocr-estado') && (document.getElementById('ocr-estado').style.display = 'none');
  const tipoErrEl = document.getElementById('n-tipo-cliente-error');
  if (tipoErrEl) tipoErrEl.style.display = 'none';
  cerrarSugerenciasPlaca();
  fotosIngresoPendientes = [];
  if (typeof renderPreviewIngreso === 'function') renderPreviewIngreso();
  // Limpiar daños del vehículo
  document.querySelectorAll('.dano-cb').forEach(cb => { cb.checked = false; });
  const tipoCarEl = document.getElementById('n-tipo-carroceria');
  if (tipoCarEl) tipoCarEl.value = '';
  // Reset wizard al paso 1
  _resetWizard();
}

async function recargarListasNuevaOrden() {
  const [aseg, flot] = await Promise.all([
    api('/aseguradoras?activo=eq.true&order=nombre.asc').catch(()=>[]) || [],
    api('/flotillas?activo=eq.true&order=nombre.asc').catch(()=>[]) || []
  ]);
  ['n-aseguradora-sel','n-flotilla-sel','n-empresa-sel'].forEach((id, i) => {
    const sel = document.getElementById(id);
    const lista = i === 0 ? aseg : flot;
    if (sel) sel.innerHTML = '<option value="">— Seleccionar —</option>' +
      lista.map(x => `<option value="${x.nombre}">${x.nombre}</option>`).join('');
  });
}
// ═══════════════════════════════════════════════════════════
// PRELIQUIDACIÓN — PDF con resumen de la orden
// ═══════════════════════════════════════════════════════════
async function generarPreliquidacion(ordenId, conPrecios = false) {
  try {
    toast('Generando preliquidación...');

    const [orden, etapas, novedades, solicitudes] = await Promise.all([
      api(`/ordenes?id=eq.${ordenId}`).then(r => r?.[0]).catch(()=>null),
      api(`/etapas?orden_id=eq.${ordenId}&order=creado_en.asc&select=*`).catch(()=>[]) || [],
      api(`/novedades?orden_id=eq.${ordenId}&select=*`).catch(()=>[]) || [],
      api(`/solicitudes_repuesto?orden_id=eq.${ordenId}&estado=in.(pedido,recibido_taller,entregado)&select=*`).catch(()=>[]) || []
    ]);

    // Cotizaciones e ítems de cada solicitud de repuesto
    const solIds = solicitudes.map(s => s.id);
    const [cotizaciones, solItems] = solIds.length ? await Promise.all([
      api(`/cotizaciones_repuesto?solicitud_id=in.(${solIds.join(',')})&precio_venta_jefe=not.is.null&select=*,proveedores(nombre)`).catch(()=>[]) || [],
      api(`/solicitud_items?solicitud_id=in.(${solIds.join(',')})&order=creado_en.asc`).catch(()=>[]) || []
    ]) : [[], []];

    if (!orden) { toast('No se encontró la orden', 'err'); return; }

    const fmt = n => n != null
      ? new Intl.NumberFormat('es-CO',{style:'currency',currency:'COP',minimumFractionDigits:0}).format(n)
      : '$0';
    const fmtFecha = iso => iso
      ? new Date(iso).toLocaleDateString('es-CO',{day:'2-digit',month:'long',year:'numeric'})
      : '—';
    const fmtHora = iso => iso
      ? new Date(iso).toLocaleString('es-CO',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit',hour12:false})
      : '—';
    const durMin = (ini, fin) => {
      if (!ini || !fin) return '—';
      const m = Math.round((new Date(fin) - new Date(ini)) / 60000);
      return `${Math.floor(m/60)}h ${m%60}m`;
    };

    const totalManoObra = etapas.reduce((s,e) => s+(e.valor||0), 0);
    const totalHorasFact = etapas.reduce((s,e) => s+(e.horas_facturadas||0), 0);
    const totalHorasAdi  = etapas.reduce((s,e) => s+(e.horas_adicionales||0), 0);

    // Agrupar etapas por servicio
    const servicios = {};
    etapas.forEach(e => {
      const s = e.servicio || 'adicionales';
      if (!servicios[s]) servicios[s] = [];
      servicios[s].push(e);
    });

    const srvNombres = { latoneria:'Latonería', pintura:'Pintura', mecanica:'Mecánica', adicionales:'Adicionales' };
    const srvColor   = { latoneria:'#DC2626', pintura:'#D97706', mecanica:'#2563EB', adicionales:'#059669' };

    const etapasHtml = Object.entries(servicios).map(([srv, ets]) => `
      <div style="margin-bottom:20px">
        <div style="font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:1px;color:${srvColor[srv]||'#374151'};border-bottom:2px solid ${srvColor[srv]||'#374151'};padding-bottom:5px;margin-bottom:10px">
          ${srvNombres[srv]||srv}
        </div>
        <table style="width:100%;border-collapse:collapse;font-size:12px">
          <thead>
            <tr style="background:#F8FAFC">
              <th style="padding:7px 10px;text-align:left;color:#64748B;font-size:10px;text-transform:uppercase;letter-spacing:.5px;border-bottom:1px solid #E2E8F0">Etapa</th>
              <th style="padding:7px 10px;text-align:left;color:#64748B;font-size:10px;text-transform:uppercase;letter-spacing:.5px;border-bottom:1px solid #E2E8F0">Técnico</th>
              <th style="padding:7px 10px;text-align:center;color:#64748B;font-size:10px;text-transform:uppercase;letter-spacing:.5px;border-bottom:1px solid #E2E8F0">Duración</th>
              <th style="padding:7px 10px;text-align:center;color:#64748B;font-size:10px;text-transform:uppercase;letter-spacing:.5px;border-bottom:1px solid #E2E8F0">H. Fact.</th>
              <th style="padding:7px 10px;text-align:right;color:#64748B;font-size:10px;text-transform:uppercase;letter-spacing:.5px;border-bottom:1px solid #E2E8F0">Valor</th>
            </tr>
          </thead>
          <tbody>
            ${ets.map(e => `
              <tr style="border-bottom:1px solid #F1F5F9">
                <td style="padding:8px 10px;font-weight:600;color:#1E293B">${escapeHtml(e.etapa)||'—'}</td>
                <td style="padding:8px 10px;color:#64748B">${escapeHtml(e.tecnico)||'—'}</td>
                <td style="padding:8px 10px;text-align:center;color:#64748B;font-family:monospace">${durMin(e.inicio,e.fin)}</td>
                <td style="padding:8px 10px;text-align:center;color:#64748B">${e.horas_facturadas||'—'}</td>
                <td style="padding:8px 10px;text-align:right;font-weight:600;color:#1E293B;font-family:monospace">${fmt(e.valor)}</td>
              </tr>`).join('')}
            <tr style="background:#F8FAFC;font-weight:700">
              <td colspan="4" style="padding:8px 10px;color:#374151;font-size:12px">Subtotal ${srvNombres[srv]||srv}</td>
              <td style="padding:8px 10px;text-align:right;color:${srvColor[srv]||'#374151'};font-family:monospace">${fmt(ets.reduce((s,e)=>s+(e.valor||0),0))}</td>
            </tr>
          </tbody>
        </table>
      </div>`).join('');

    // ── Repuestos ──────────────────────────────────────────
    const totalRepuestos = solicitudes.reduce((acc, sol) => {
      const cot = cotizaciones.find(c => c.solicitud_id === sol.id);
      return acc + (cot?.precio_venta_jefe || 0);
    }, 0);

    const repuestosHtml = solicitudes.length ? `
      <div style="margin-bottom:20px">
        <div style="font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:1px;color:#7C3AED;border-bottom:2px solid #7C3AED;padding-bottom:5px;margin-bottom:10px">
          Repuestos utilizados
        </div>
        <table style="width:100%;border-collapse:collapse;font-size:12px">
          <thead>
            <tr style="background:#F5F3FF">
              <th style="padding:7px 10px;text-align:left;color:#7C3AED;font-size:10px;text-transform:uppercase;letter-spacing:.5px;border-bottom:1px solid #DDD6FE">Repuesto</th>
              <th style="padding:7px 10px;text-align:center;color:#7C3AED;font-size:10px;text-transform:uppercase;letter-spacing:.5px;border-bottom:1px solid #DDD6FE">Cant.</th>
              <th style="padding:7px 10px;text-align:left;color:#7C3AED;font-size:10px;text-transform:uppercase;letter-spacing:.5px;border-bottom:1px solid #DDD6FE">Proveedor</th>
              <th style="padding:7px 10px;text-align:center;color:#7C3AED;font-size:10px;text-transform:uppercase;letter-spacing:.5px;border-bottom:1px solid #DDD6FE">Tipo</th>
              ${conPrecios ? '<th style="padding:7px 10px;text-align:right;color:#7C3AED;font-size:10px;text-transform:uppercase;letter-spacing:.5px;border-bottom:1px solid #DDD6FE">Precio venta</th>' : ''}
            </tr>
          </thead>
          <tbody>
            ${solicitudes.map(sol => {
              const cot   = cotizaciones.find(c => c.solicitud_id === sol.id);
              const items = solItems.filter(i => i.solicitud_id === sol.id);
              const filas = items.length ? items : [{ repuesto: sol.repuesto, unidades: sol.unidades||1 }];
              return filas.map((item, idx) => `
                <tr style="border-bottom:1px solid #F1F5F9">
                  <td style="padding:7px 10px;font-weight:600;color:#1E293B">${escapeHtml(item.repuesto||'—')}</td>
                  <td style="padding:7px 10px;text-align:center;color:#64748B">${item.unidades||1}</td>
                  <td style="padding:7px 10px;color:#64748B">${escapeHtml(cot?.proveedores?.nombre||'—')}</td>
                  <td style="padding:7px 10px;text-align:center;color:#64748B">${cot?.es_original === false ? 'Genérico' : 'Original'}</td>
                  ${conPrecios ? `<td style="padding:7px 10px;text-align:right;font-family:monospace;font-weight:600;color:#1E293B">${idx === 0 ? fmt(cot?.precio_venta_jefe) : ''}</td>` : ''}
                </tr>`).join('');
            }).join('')}
          </tbody>
          ${conPrecios ? `<tfoot><tr style="background:#F5F3FF">
            <td colspan="4" style="padding:8px 10px;font-weight:700;color:#5B21B6">Total repuestos</td>
            <td style="padding:8px 10px;text-align:right;font-family:monospace;font-weight:700;color:#5B21B6">${fmt(totalRepuestos)}</td>
          </tr></tfoot>` : ''}
        </table>
      </div>` : '';

    const novedadesHtml = novedades.length ? `
      <div style="margin-bottom:20px">
        <div style="font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:1px;color:#DC2626;border-bottom:2px solid #DC2626;padding-bottom:5px;margin-bottom:10px">Novedades</div>
        <table style="width:100%;border-collapse:collapse;font-size:12px">
          <thead><tr style="background:#FEF2F2">
            <th style="padding:7px 10px;text-align:left;color:#DC2626;font-size:10px;text-transform:uppercase;border-bottom:1px solid #FECACA">Tipo</th>
            <th style="padding:7px 10px;text-align:left;color:#DC2626;font-size:10px;text-transform:uppercase;border-bottom:1px solid #FECACA">Motivo</th>
            <th style="padding:7px 10px;text-align:left;color:#DC2626;font-size:10px;text-transform:uppercase;border-bottom:1px solid #FECACA">Responsable</th>
            <th style="padding:7px 10px;text-align:left;color:#DC2626;font-size:10px;text-transform:uppercase;border-bottom:1px solid #FECACA">Fecha</th>
          </tr></thead>
          <tbody>
            ${novedades.map(n=>`<tr style="border-bottom:1px solid #FEE2E2">
              <td style="padding:7px 10px;font-weight:600">${escapeHtml(n.tipo)||'—'}</td>
              <td style="padding:7px 10px;color:#64748B">${escapeHtml(n.motivo)||'—'}</td>
              <td style="padding:7px 10px;color:#64748B">${escapeHtml(n.responsable)||'—'}</td>
              <td style="padding:7px 10px;color:#64748B;font-size:11px">${fmtHora(n.creado_en)}</td>
            </tr>`).join('')}
          </tbody>
        </table>
      </div>` : '';

    // ── SVGs bocetos de vehículo — siluetas reconocibles ─────────────────────
    const S = 'fill="none" stroke="#333"';

    // ── SEDAN LATERAL IZQ (carro de frente a la derecha) ──
    const _svgSL = `<svg viewBox="0 0 200 72" width="190" height="68" xmlns="http://www.w3.org/2000/svg">
      <path ${S} stroke-width="1.6" stroke-linejoin="round"
        d="M 14,54 Q 8,54 8,50 L 8,44 Q 10,38 22,34 Q 34,28 54,22 L 68,12 Q 78,8 96,8 L 124,8 Q 148,8 160,16 L 176,28 Q 184,34 186,44 L 188,50 Q 188,54 184,54 L 163,54 Q 162,68 150,68 Q 138,68 137,54 L 63,54 Q 62,68 50,68 Q 38,68 37,54 Z"/>
      <circle ${S} stroke-width="1.4" cx="50" cy="60" r="10"/>
      <circle ${S} stroke-width="0.9" cx="50" cy="60" r="4"/>
      <circle ${S} stroke-width="1.4" cx="150" cy="60" r="10"/>
      <circle ${S} stroke-width="0.9" cx="150" cy="60" r="4"/>
      <path ${S} stroke-width="1" d="M 68,12 L 62,44 L 97,44 L 102,9"/>
      <path ${S} stroke-width="1" d="M 104,9 L 99,44 L 138,44 L 152,18"/>
      <line ${S} stroke-width="0.7" x1="97" y1="44" x2="102" y2="9"/>
      <rect ${S} stroke-width="1" x="9" y="40" width="10" height="9" rx="1.5"/>
      <rect ${S} stroke-width="1" x="182" y="38" width="10" height="10" rx="1.5"/>
      <line ${S} stroke-width="1" x1="76" y1="30" x2="86" y2="30"/>
      <line ${S} stroke-width="1" x1="112" y1="30" x2="122" y2="30"/>
    </svg>`;

    // ── SEDAN LATERAL DER (espejo) ──
    const _svgSD = `<svg viewBox="0 0 200 72" width="190" height="68" xmlns="http://www.w3.org/2000/svg"><g transform="scale(-1,1) translate(-200,0)">${_svgSL.replace(/<svg[^>]*>/,'').replace('</svg>','')}</g></svg>`;

    // ── SEDAN FRONTAL ──
    const _svgSF = `<svg viewBox="0 0 130 90" width="120" height="83" xmlns="http://www.w3.org/2000/svg">
      <path ${S} stroke-width="1.6" stroke-linejoin="round"
        d="M 8,80 Q 4,80 4,76 L 4,58 Q 4,52 10,50 L 10,26 Q 10,20 16,16 L 30,6 Q 38,2 52,2 L 78,2 Q 92,2 100,6 L 114,16 Q 120,20 120,26 L 120,50 Q 126,52 126,58 L 126,76 Q 126,80 122,80 Z"/>
      <path ${S} stroke-width="1" d="M 30,4 L 26,30 L 104,30 L 100,4 Z"/>
      <path ${S} stroke-width="1" d="M 10,26 L 10,50 Q 11,54 18,54 L 30,54 Q 36,54 38,48 L 38,26 Z"/>
      <path ${S} stroke-width="1" d="M 92,26 L 92,48 Q 94,54 100,54 L 112,54 Q 119,54 120,50 L 120,26 Z"/>
      <rect ${S} stroke-width="1" x="38" y="52" width="54" height="20" rx="2"/>
      <line ${S} stroke-width="0.6" x1="38" y1="59" x2="92" y2="59"/>
      <line ${S} stroke-width="0.6" x1="38" y1="66" x2="92" y2="66"/>
      <line ${S} stroke-width="0.6" x1="57" y1="52" x2="57" y2="72"/>
      <line ${S} stroke-width="0.6" x1="73" y1="52" x2="73" y2="72"/>
      <path ${S} stroke-width="1.2" d="M 4,76 Q 4,88 10,88 L 120,88 Q 126,88 126,76"/>
      <rect ${S} stroke-width="0.8" x="48" y="74" width="34" height="10" rx="1"/>
    </svg>`;

    // ── SEDAN TRASERA ──
    const _svgST = `<svg viewBox="0 0 130 90" width="120" height="83" xmlns="http://www.w3.org/2000/svg">
      <path ${S} stroke-width="1.6" stroke-linejoin="round"
        d="M 8,80 Q 4,80 4,76 L 4,58 Q 4,52 10,50 L 10,26 Q 10,20 16,16 L 30,6 Q 38,2 52,2 L 78,2 Q 92,2 100,6 L 114,16 Q 120,20 120,26 L 120,50 Q 126,52 126,58 L 126,76 Q 126,80 122,80 Z"/>
      <path ${S} stroke-width="1" d="M 34,4 L 30,28 L 100,28 L 96,4 Z"/>
      <rect ${S} stroke-width="1.1" x="6" y="28" width="26" height="22" rx="1"/>
      <line ${S} stroke-width="0.6" x1="19" y1="28" x2="19" y2="50"/>
      <rect ${S} stroke-width="1.1" x="98" y="28" width="26" height="22" rx="1"/>
      <line ${S} stroke-width="0.6" x1="111" y1="28" x2="111" y2="50"/>
      <line ${S} stroke-width="1" x1="32" y1="28" x2="98" y2="28"/>
      <line ${S} stroke-width="0.8" x1="32" y1="50" x2="98" y2="50"/>
      <path ${S} stroke-width="1.2" d="M 4,76 Q 4,88 10,88 L 120,88 Q 126,88 126,76"/>
      <rect ${S} stroke-width="0.8" x="46" y="54" width="38" height="14" rx="1"/>
    </svg>`;

    // ── CAMIONETA / SUV LATERAL IZQ ──
    const _svgCL = `<svg viewBox="0 0 210 75" width="200" height="71" xmlns="http://www.w3.org/2000/svg">
      <path ${S} stroke-width="1.6" stroke-linejoin="round"
        d="M 14,56 Q 8,56 8,52 L 8,44 Q 8,38 14,36 Q 22,32 40,28 L 54,16 Q 62,10 78,8 L 108,8 Q 112,8 112,14 L 112,56 L 67,56 Q 66,70 54,70 Q 42,70 41,56 Z"/>
      <path ${S} stroke-width="1.6" stroke-linejoin="round"
        d="M 112,14 L 112,8 L 192,8 L 196,14 L 196,56 L 171,56 Q 170,70 158,70 Q 146,70 145,56 L 112,56"/>
      <circle ${S} stroke-width="1.4" cx="54" cy="62" r="11"/>
      <circle ${S} stroke-width="0.9" cx="54" cy="62" r="4.5"/>
      <circle ${S} stroke-width="1.4" cx="158" cy="62" r="11"/>
      <circle ${S} stroke-width="0.9" cx="158" cy="62" r="4.5"/>
      <path ${S} stroke-width="1" d="M 54,16 L 48,44 L 90,44 L 94,10"/>
      <path ${S} stroke-width="1" d="M 96,10 L 92,44 L 110,44 L 112,8"/>
      <line ${S} stroke-width="0.7" x1="90" y1="44" x2="94" y2="10"/>
      <line ${S} stroke-width="1" x1="112" y1="8" x2="112" y2="56"/>
      <rect ${S} stroke-width="1" x="9" y="40" width="10" height="10" rx="1.5"/>
      <rect ${S} stroke-width="1" x="193" y="26" width="10" height="22" rx="1.5"/>
      <line ${S} stroke-width="1" x1="72" y1="30" x2="82" y2="30"/>
    </svg>`;

    // ── CAMIONETA LATERAL DER (espejo) ──
    const _svgCD = `<svg viewBox="0 0 210 75" width="200" height="71" xmlns="http://www.w3.org/2000/svg"><g transform="scale(-1,1) translate(-210,0)">${_svgCL.replace(/<svg[^>]*>/,'').replace('</svg>','')}</g></svg>`;

    // ── CAMIONETA FRONTAL ──
    const _svgCF = `<svg viewBox="0 0 130 90" width="120" height="83" xmlns="http://www.w3.org/2000/svg">
      <path ${S} stroke-width="1.6" stroke-linejoin="round"
        d="M 6,82 Q 4,82 4,78 L 4,58 Q 4,52 8,50 L 8,22 Q 8,16 14,14 L 22,6 Q 28,2 40,2 L 90,2 Q 102,2 108,6 L 116,14 Q 122,16 122,22 L 122,50 Q 126,52 126,58 L 126,78 Q 126,82 124,82 Z"/>
      <path ${S} stroke-width="1" d="M 22,4 L 18,28 L 112,28 L 108,4 Z"/>
      <rect ${S} stroke-width="1.1" x="6" y="28" width="28" height="22" rx="1"/>
      <line ${S} stroke-width="0.6" x1="20" y1="28" x2="20" y2="50"/>
      <rect ${S} stroke-width="1.1" x="96" y="28" width="28" height="22" rx="1"/>
      <line ${S} stroke-width="0.6" x1="110" y1="28" x2="110" y2="50"/>
      <rect ${S} stroke-width="1" x="34" y="50" width="62" height="22" rx="2"/>
      <line ${S} stroke-width="0.6" x1="34" y1="58" x2="96" y2="58"/>
      <line ${S} stroke-width="0.6" x1="34" y1="65" x2="96" y2="65"/>
      <line ${S} stroke-width="0.6" x1="55" y1="50" x2="55" y2="72"/>
      <line ${S} stroke-width="0.6" x1="75" y1="50" x2="75" y2="72"/>
      <path ${S} stroke-width="1.2" d="M 4,78 Q 4,88 10,88 L 120,88 Q 126,88 126,78"/>
      <rect ${S} stroke-width="0.8" x="46" y="74" width="38" height="10" rx="1"/>
    </svg>`;

    // ── CAMIONETA TRASERA ──
    const _svgCT = `<svg viewBox="0 0 130 90" width="120" height="83" xmlns="http://www.w3.org/2000/svg">
      <path ${S} stroke-width="1.6" stroke-linejoin="round"
        d="M 6,82 Q 4,82 4,78 L 4,58 Q 4,52 8,50 L 8,22 Q 8,16 14,14 L 22,6 Q 28,2 40,2 L 90,2 Q 102,2 108,6 L 116,14 Q 122,16 122,22 L 122,50 Q 126,52 126,58 L 126,78 Q 126,82 124,82 Z"/>
      <path ${S} stroke-width="1" d="M 30,4 L 26,26 L 104,26 L 100,4 Z"/>
      <rect ${S} stroke-width="1.1" x="6" y="26" width="28" height="24" rx="1"/>
      <line ${S} stroke-width="0.6" x1="20" y1="26" x2="20" y2="50"/>
      <rect ${S} stroke-width="1.1" x="96" y="26" width="28" height="24" rx="1"/>
      <line ${S} stroke-width="0.6" x1="110" y1="26" x2="110" y2="50"/>
      <line ${S} stroke-width="1" x1="34" y1="26" x2="96" y2="26"/>
      <line ${S} stroke-width="0.8" x1="34" y1="50" x2="96" y2="50"/>
      <path ${S} stroke-width="1.2" d="M 4,78 Q 4,88 10,88 L 120,88 Q 126,88 126,78"/>
      <rect ${S} stroke-width="0.8" x="44" y="54" width="42" height="16" rx="1"/>
    </svg>`;

    const _baseUrl = window.location.origin + window.location.pathname.replace(/\/[^/]*$/, '/');
    const _logoUrl  = _baseUrl + 'icons/Logo_Fondo_Taller.png';

    const html = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<base href="${_baseUrl}">
<title>Preliquidación ${escapeHtml(orden.placa)}</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:'Helvetica Neue',Arial,sans-serif;color:#1a1a1a;font-size:9px;line-height:1.35;background:#fff}
@page{size:A4 landscape;margin:5mm 7mm}

/* Tablas */
table{width:100%;border-collapse:collapse;font-size:8.5px}
th{font-size:7px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;padding:3.5px 7px;background:#1a1a1a;color:#fff;text-align:left;border:none}
td{padding:3px 7px;border-bottom:1px solid #E5E7EB;vertical-align:middle}
tr:last-child td{border-bottom:none}
tr:nth-child(even) td{background:#F9FAFB}

/* Etiquetas y valores */
.lbl{font-size:7.5px;color:#6B7280;text-transform:uppercase;letter-spacing:.4px;margin-bottom:2px;font-weight:600}
.val{font-weight:700;font-size:10px;color:#111}
.sh{font-size:7.5px;font-weight:800;text-transform:uppercase;letter-spacing:.8px;background:#1a1a1a;color:#fff;padding:4px 10px}
.money{font-family:'Courier New',monospace;font-weight:700}

/* Totales */
.total-row{display:flex;justify-content:space-between;align-items:center;padding:5px 10px;font-size:9.5px;border-bottom:1px solid #E5E7EB}
.total-final{background:#1a1a1a;color:#fff;font-weight:900;font-size:12px;padding:8px 10px;display:flex;justify-content:space-between;margin-top:4px}

@media print{
  *{-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important}
  body{margin:0}
}
</style>
</head>
<body>
<div style="padding:2px 0 8px">

<!-- ENCABEZADO -->
<div style="display:flex;align-items:center;justify-content:space-between;border-bottom:2.5px solid #1a1a1a;padding-bottom:6px;margin-bottom:8px">
  <div style="display:flex;align-items:center;gap:10px">
    <img src="${_logoUrl}" alt="Logo" style="height:42px;width:42px;object-fit:contain">
    <div>
      <div style="font-weight:900;font-size:14px;color:#1a1a1a;letter-spacing:.3px;line-height:1.15">FREIMANAUTOS S.A.</div>
      <div style="font-size:7.5px;color:#6B7280;margin-top:2px">NIT 860.012.186-5</div>
      <div style="font-size:7.5px;color:#6B7280">Calle 98A #68D-15 Bogotá D.C.</div>
      <div style="font-size:7.5px;color:#6B7280">Tel: (601) 742 6450</div>
    </div>
  </div>
  <div style="text-align:center">
    <div style="font-size:21px;font-weight:900;color:#1a1a1a;letter-spacing:2px">ORDEN DE TRABAJO</div>
    <div style="font-size:8px;color:#6B7280;margin-top:2px">Documento preliminar — no constituye factura</div>
  </div>
  <div style="border:2px solid #1a1a1a;border-radius:4px;padding:5px 12px;text-align:center;min-width:140px">
    <div style="font-size:7px;color:#6B7280;text-transform:uppercase;letter-spacing:.5px">Placa</div>
    <div style="font-size:17px;font-weight:900;letter-spacing:3px;color:#1a1a1a;line-height:1.15">${escapeHtml(orden.placa)}</div>
    <div style="border-top:1px solid #E5E7EB;margin:4px 0 3px"></div>
    <div style="font-size:7px;color:#6B7280;text-transform:uppercase;letter-spacing:.5px">N° Orden</div>
    <div style="font-size:12px;font-weight:900;font-family:'Courier New',monospace;color:#1a1a1a">${otDe(orden)}</div>
    <div style="font-size:7px;color:#6B7280;margin-top:2px">${new Date().toLocaleDateString('es-CO',{day:'2-digit',month:'long',year:'numeric'})} · ${new Date().toLocaleTimeString('es-CO',{hour:'2-digit',minute:'2-digit',hour12:true})}</div>
  </div>
</div>

<!-- FILA INFO: 1.Cliente | 2.Vehículo | 3.Fechas/Daños -->
<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:0;border:1px solid #E5E7EB;border-radius:6px;overflow:hidden;margin-bottom:7px">

  <!-- 1. CLIENTE -->
  <div style="border-right:1px solid #E5E7EB">
    <div class="sh">1. Cliente</div>
    <div style="padding:10px 12px">
      <div style="margin-bottom:6px"><div class="lbl">Nombre</div><div class="val" style="font-size:10px">${escapeHtml(orden.propietario)||'—'}</div></div>
      <div style="margin-bottom:6px"><div class="lbl">Teléfono</div><div class="val" style="font-size:9.5px">${escapeHtml(orden.telefono)||'—'}</div></div>
      <div style="margin-bottom:6px"><div class="lbl">Email</div><div style="font-size:8.5px;color:#374151;word-break:break-all">${escapeHtml(orden.correo_cliente||orden.email||'—')}</div></div>
      <div${orden.aseguradora?' style="margin-bottom:6px"':''}><div class="lbl">Tipo de cliente</div><div style="font-weight:600;color:#374151">${escapeHtml(orden.tipo_cliente)||'Particular'}</div></div>
      ${orden.aseguradora ? `<div style="margin-top:6px;padding-top:6px;border-top:1px solid #E5E7EB"><div class="lbl">Aseguradora</div><div class="val" style="color:#1a1a1a;font-size:9.5px">${escapeHtml(orden.aseguradora)}</div></div>` : ''}
    </div>
  </div>

  <!-- 2. VEHÍCULO -->
  <div style="border-right:1px solid #E5E7EB">
    <div class="sh">2. Vehículo</div>
    <div style="padding:10px 12px">
      <div style="margin-bottom:6px"><div class="lbl">Marca / Línea</div><div class="val" style="font-size:10px">${escapeHtml(orden.marca)||'—'} ${escapeHtml(orden.linea)||''}</div></div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px 8px;margin-bottom:6px">
        <div><div class="lbl">Año / Modelo</div><div style="font-weight:600;color:#374151">${escapeHtml(orden.modelo)||'—'}</div></div>
        <div><div class="lbl">Color</div><div style="font-weight:600;color:#374151">${escapeHtml(orden.color)||'—'}</div></div>
        <div><div class="lbl">Kilometraje</div><div style="font-weight:600;color:#374151">${orden.kilometraje ? orden.kilometraje.toLocaleString('es-CO')+' km' : '—'}</div></div>
        <div><div class="lbl">Carrocería</div><div style="font-weight:600;color:#374151">${escapeHtml(orden.tipo_carroceria||'—')}</div></div>
      </div>
      ${orden.vin ? `<div style="padding-top:6px;border-top:1px solid #E5E7EB"><div class="lbl">VIN / No. Chasis</div><div style="font-family:monospace;font-size:8.5px;color:#374151;letter-spacing:.5px">${escapeHtml(orden.vin)}</div></div>` : ''}
      ${orden.descripcion_general ? `<div style="margin-top:6px;padding-top:6px;border-top:1px solid #E5E7EB"><div class="lbl">Descripción</div><div style="font-size:8.5px;line-height:1.5;color:#374151">${escapeHtml(orden.descripcion_general)}</div></div>` : ''}
    </div>
  </div>

  <!-- 3. FECHAS Y DAÑOS -->
  <div>
    <div class="sh">3. Fechas / Estado</div>
    <div style="padding:10px 12px">
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px 8px;margin-bottom:8px">
        <div><div class="lbl">Fecha de ingreso</div><div class="val" style="font-size:9px">${fmtFecha(orden.creado_en)}</div></div>
        <div><div class="lbl">Entrega prometida</div><div class="val" style="color:#D97706;font-size:9px">${fmtFecha(orden.fecha_entrega_1)}</div></div>
        <div><div class="lbl">Estado</div><div style="font-weight:700;color:#059669;font-size:9.5px">${escapeHtml(orden.estado||'Activa')}</div></div>
        <div><div class="lbl">Nivel de daño</div><div style="font-weight:700;font-size:9.5px">${escapeHtml(orden.nivel_dano||'—')}</div></div>
        ${orden.aseguradora ? `<div style="grid-column:span 2;padding-top:4px;border-top:1px solid #E5E7EB"><div class="lbl">Aseguradora</div><div class="val" style="font-size:9px">${escapeHtml(orden.aseguradora)}</div></div>` : ''}
      </div>
      <div style="border-top:1px solid #E5E7EB;padding-top:7px">
        <div class="lbl" style="margin-bottom:4px">Daños registrados</div>
        ${(() => {
          const danos = (() => { try { return JSON.parse(orden.danos_vehiculo||'null')||{}; } catch{return{};} })();
          const hasDanos = Object.values(danos).some(a=>a?.length>0);
          const tipoLabels = {rayon:'Rayón',golpe:'Golpe',abolladura:'Abolladura',pieza_faltante:'Pieza faltante'};
          const tipoColores = {rayon:'#F59E0B',golpe:'#EF4444',abolladura:'#F97316',pieza_faltante:'#111'};
          if (!hasDanos) return '<div style="font-size:8px;color:#aaa;font-style:italic">Sin daños registrados</div>';
          return ['frontal','trasera','lateral_izq','lateral_der']
            .filter(z=>(danos[z]||[]).length>0)
            .map(z=>'<div style="font-size:8px;margin-bottom:4px;line-height:1.5"><b style="color:#374151">'+{frontal:'Frontal',trasera:'Trasera',lateral_izq:'Lat. Izq.',lateral_der:'Lat. Der.'}[z]+':</b> '+
              (danos[z]||[]).map(t=>'<span style="display:inline-flex;align-items:center;gap:2px;margin-right:5px"><span style="width:7px;height:7px;border-radius:50%;background:'+(tipoColores[t]||'#999')+';display:inline-block"></span>'+(tipoLabels[t]||t)+'</span>').join('')+'</div>'
            ).join('');
        })()}
      </div>
    </div>
  </div>

</div>

<!-- 4. TRABAJOS (tabla) + TOTALES (derecha) -->
<div style="display:grid;grid-template-columns:1fr 175px;gap:0;border:1px solid #E5E7EB;border-radius:6px;overflow:hidden;margin-bottom:6px">
  <div style="border-right:1px solid #E5E7EB">
    <div class="sh">4. Descripción de trabajos</div>
    <table>
      <thead><tr>
        <th style="width:18px;text-align:center">#</th>
        <th>Descripción del trabajo</th>
        <th style="width:75px">Tipo (Mecánica, Elec., etc.)</th>
        <th style="width:85px">Técnico asignado</th>
        <th style="width:50px;text-align:center">Horas est.</th>
        <th style="width:72px;text-align:right">Valor unitario</th>
        <th style="width:72px;text-align:right">Valor total</th>
      </tr></thead>
      <tbody>
        ${etapas.map((e,i) => `<tr>
          <td style="color:#aaa;text-align:center;font-size:8px">${i+1}</td>
          <td style="font-weight:600">${escapeHtml(e.etapa||e.nombre||'—')}</td>
          <td style="font-size:8px;color:${srvColor[e.servicio]||'#374151'};font-weight:700">${srvNombres[e.servicio]||e.servicio||'—'}</td>
          <td>${escapeHtml(e.tecnico||'—')}</td>
          <td style="text-align:center;font-family:monospace;font-size:8px">${e.horas_facturadas||'—'}</td>
          <td style="text-align:right;font-family:monospace">${fmt(e.valor)}</td>
          <td style="text-align:right;font-family:monospace;font-weight:700">${fmt(e.valor)}</td>
        </tr>`).join('')}
        ${Array.from({length:Math.max(0,3-etapas.length)},(_,i)=>`<tr><td style="color:#ddd;text-align:center;font-size:8px">${etapas.length+i+1}</td><td></td><td></td><td></td><td></td><td></td><td></td></tr>`).join('')}
      </tbody>
    </table>
  </div>
  <!-- TOTALES -->
  <div>
    <div class="sh">Totales</div>
    <div style="padding:6px 8px">
      <div style="display:flex;justify-content:space-between;padding:4px 0;border-bottom:0.5px solid #ddd;font-size:8.5px">
        <span>Subtotal trabajos</span><span class="money">$</span>
      </div>
      <div style="display:flex;justify-content:space-between;padding:4px 0;border-bottom:0.5px solid #ddd;font-size:8.5px">
        <span>Subtotal repuestos</span><span class="money">${conPrecios && totalRepuestos > 0 ? fmt(totalRepuestos) : '$'}</span>
      </div>
      <div style="display:flex;justify-content:space-between;padding:4px 0;border-bottom:0.5px solid #ddd;font-size:8.5px">
        <span>IVA (19%)</span><span class="money">$</span>
      </div>
      <div style="display:flex;justify-content:space-between;padding:6px 5px;font-size:10px;font-weight:800;background:#111;color:#fff;margin-top:5px">
        <span>TOTAL A PAGAR</span>
        <span class="money">${conPrecios ? (() => { const s=totalManoObra+totalRepuestos; return '$ '+new Intl.NumberFormat('es-CO',{minimumFractionDigits:0}).format(s+Math.round(s*.19)); })() : '$'}</span>
      </div>
      ${!conPrecios ? `<div style="margin-top:6px;padding:4px 5px;border:0.8px solid #111;font-size:8.5px;font-weight:700;display:flex;justify-content:space-between"><span>M.O. sin IVA</span><span class="money">${fmt(totalManoObra)}</span></div>` : ''}
    </div>
  </div>
</div>

<!-- 5. REPUESTOS + FIRMAS -->
<div style="display:grid;grid-template-columns:1fr 175px;gap:0;border:1px solid #E5E7EB;border-radius:6px;overflow:hidden">
  <div style="border-right:1px solid #E5E7EB">
    <div class="sh">5. Repuestos / Materiales</div>
    <table>
      <thead><tr>
        <th style="width:18px;text-align:center">#</th>
        <th style="width:55px">Código</th>
        <th>Descripción</th>
        <th style="width:35px;text-align:center">Cant.</th>
        <th style="width:75px;text-align:right">Vr. Unitario</th>
        <th style="width:75px;text-align:right">Vr. Total</th>
      </tr></thead>
      <tbody>
        ${solicitudes.length ? solicitudes.map((sol,si) => {
          const cot = cotizaciones.find(c=>c.solicitud_id===sol.id);
          const items = solItems.filter(i=>i.solicitud_id===sol.id);
          const filas = items.length ? items : [{repuesto:sol.repuesto,unidades:sol.unidades||1}];
          return filas.map((item,idx) => `<tr>
            <td style="color:#aaa;text-align:center;font-size:8px">${si+1}</td>
            <td style="font-family:monospace;font-size:8px;color:#777">${escapeHtml(cot?.codigo||'—')}</td>
            <td style="font-weight:600">${escapeHtml(item.repuesto||'—')}</td>
            <td style="text-align:center">${item.unidades||1}</td>
            <td style="text-align:right;font-family:monospace">${conPrecios&&idx===0&&cot?.precio_venta_jefe ? fmt(cot.precio_venta_jefe/(item.unidades||1)) : ''}</td>
            <td style="text-align:right;font-family:monospace;font-weight:700">${conPrecios&&idx===0&&cot?.precio_venta_jefe ? fmt(cot.precio_venta_jefe) : ''}</td>
          </tr>`).join('');
        }).join('') : ''}
        ${Array.from({length:Math.max(0,2-solicitudes.length)},(_,i)=>`<tr><td style="color:#ddd;text-align:center;font-size:8px">${solicitudes.length+i+1}</td><td></td><td></td><td></td><td></td><td></td></tr>`).join('')}
      </tbody>
    </table>
    ${novedades.length ? `<div style="border-top:0.8px solid #ccc;padding:3px 7px;background:#FFF5F5"><b style="font-size:7px;text-transform:uppercase;color:#991B1B">Novedades:</b> ${novedades.map(n=>'<span style="font-size:8px;margin-left:6px">'+escapeHtml(n.tipo||'—')+': '+escapeHtml(n.motivo||'—')+'</span>').join('')}</div>` : ''}
  </div>
  <!-- 6. FIRMAS -->
  <div>
    <div class="sh">6. Firmas</div>
    <div style="padding:8px 10px">
      <div style="margin-top:14px;border-top:1.2px solid #111;padding-top:4px;margin-bottom:14px">
        <div style="font-size:8px;font-weight:600;text-align:center">Firma recepcionista</div>
        <div style="font-size:7.5px;color:#888;margin-top:4px">C.C. ______________________</div>
      </div>
      <div style="margin-top:14px;border-top:1.2px solid #111;padding-top:4px">
        <div style="font-size:8px;font-weight:600;text-align:center">Firma cliente</div>
        <div style="font-size:7.5px;color:#888;margin-top:4px">C.C. ______________________</div>
      </div>
      <div style="margin-top:8px;font-size:6.5px;color:#aaa;text-align:center;line-height:1.4">Documento preliminar · no constituye factura<br>${new Date().toLocaleString('es-CO')}</div>
    </div>
  </div>
</div>

</div>
<script>
// Esperar a que todas las imágenes carguen antes de imprimir
window.addEventListener('load', function() {
  var imgs = document.images;
  var loaded = 0;
  if (imgs.length === 0) { setTimeout(function(){ window.print(); }, 300); return; }
  for (var i = 0; i < imgs.length; i++) {
    if (imgs[i].complete) { loaded++; }
    else { imgs[i].addEventListener('load', function(){ loaded++; if(loaded>=imgs.length) setTimeout(function(){ window.print(); },300); }); }
  }
  if (loaded >= imgs.length) setTimeout(function(){ window.print(); }, 300);
});
</script>
</body>
</html>`;

    // Usar Blob URL para que la ventana tenga origen real y pueda cargar imágenes
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const blobUrl = URL.createObjectURL(blob);
    const win = window.open(blobUrl, '_blank');
    if (win) {
      setTimeout(() => { URL.revokeObjectURL(blobUrl); }, 120000);
      // El print lo dispara el propio onload de la ventana (ver script en el HTML)
      toast('Preliquidación generada ✓');
    } else {
      URL.revokeObjectURL(blobUrl);
      toast('El navegador bloqueó la ventana emergente. Permite ventanas emergentes para este sitio.', 'err');
    }
  } catch(e) {
    toast('Error generando preliquidación: ' + e.message, 'err');
    console.error(e);
  }
}

// ═══════════════════════════════════════════════════════════
// AUTO-REFRESH — Polling para órdenes, capacidad y dashboard
// ═══════════════════════════════════════════════════════════

let _realtimeIntervals = [];
let _realtimeVisibilityHandler = null;
let _ultimoRefresh = 0;

// Devuelve el id de la página activa en el .content
function _paginaActiva() {
  const el = document.querySelector('.pagina.activa');
  return el ? el.id : null;
}

// ¿Hay algún modal abierto? Evitamos refrescar mientras el usuario edita
function _hayModalAbierto() {
  return !![...document.querySelectorAll('.modal-overlay')]
    .some(m => m.style.display !== 'none' && !m.classList.contains('hide') && m.offsetParent !== null);
}

function _tickRefresh() {
  if (!sesion) return;                 // no hay sesión activa
  if (document.hidden) return;        // pestaña oculta
  if (_hayModalAbierto()) return;     // usuario en un modal
  // No refrescar si el usuario está escribiendo/editando en algún input
  const focused = document.activeElement;
  if (focused && ['INPUT','TEXTAREA','SELECT'].includes(focused.tagName)) return;

  const pag = _paginaActiva();

  // Siempre actualizar la barra de capacidad del sidebar
  _refrescarCapacidad();

  // Actualizar lista de órdenes si está visible
  if (pag === 'pag-ordenes') {
    cargarOrdenes();
    return;
  }

  // Actualizar dashboard si está visible
  if (pag === 'pag-dashboard' && typeof switchDashTab === 'function') {
    const tabActivo = document.querySelector('.filtro-btn.active[id^="dash-tab-"]');
    const tab = tabActivo ? tabActivo.id.replace('dash-tab-', '') : 'mes';
    switchDashTab(tab);
    return;
  }
}

function iniciarRealtime() {
  detenerRealtime(); // Limpiar cualquier instancia previa

  // ── Polling cada 30 segundos ────────────────────────────
  const intervalo = setInterval(_tickRefresh, 30_000);
  _realtimeIntervals.push(intervalo);

  // ── Refresh inmediato al volver a la pestaña ────────────
  _realtimeVisibilityHandler = () => {
    if (!document.hidden && sesion) {
      const ahora = Date.now();
      // Evitar doble-refresh si ya se refrescó hace menos de 5 s
      if (ahora - _ultimoRefresh > 5_000) {
        _ultimoRefresh = ahora;
        _tickRefresh();
      }
    }
  };
  document.addEventListener('visibilitychange', _realtimeVisibilityHandler);

  // ── Refresh al recuperar conexión ───────────────────────
  window.addEventListener('online', _tickRefresh);

  console.debug('[Realtime] Polling activo — cada 30 s');
}

function detenerRealtime() {
  _realtimeIntervals.forEach(id => clearInterval(id));
  _realtimeIntervals = [];
  if (_realtimeVisibilityHandler) {
    document.removeEventListener('visibilitychange', _realtimeVisibilityHandler);
    _realtimeVisibilityHandler = null;
  }
  window.removeEventListener('online', _tickRefresh);
}

// ═══════════════════════════════════════════════════════════
// SISTEMA DE ALERTAS — ETAPAS SIN MOVIMIENTO
// ═══════════════════════════════════════════════════════════

const _alertasYaMostradas = new Set();   // ids de etapas cuyo popup ya se mostró
const _alertasRevisadas   = new Set();   // ids marcados "revisado" por el usuario
let   _alertasInterval    = null;

function iniciarSistemaAlertas() {
  if (!esJefe()) return;
  if (_alertasInterval) return; // ya está corriendo
  _chequearAlertas();
  _alertasInterval = setInterval(_chequearAlertas, 5 * 60 * 1000); // cada 5 min
  // Las citas de recogida se revisan más seguido para que el aviso sea
  // persistente (reaparece si el jefe lo cierra y el cliente no ha llegado).
  setInterval(_chequearCitas, 2 * 60 * 1000); // cada 2 min
}

async function _chequearAlertas() {
  _chequearCitas(); // avisar al jefe de las citas de recogida que ya llegaron
  try {
    // Traer etapas activas (iniciadas, no terminadas, no pausadas)
    const etapas = await api(
      '/etapas?select=id,orden_id,etapa,servicio,tecnico,inicio,tiempo_pausado_min' +
      '&inicio=not.is.null&fin=is.null&pausado=eq.false'
    ).catch(() => []) || [];

    if (!etapas.length) {
      _actualizarListaCritica([]);
      return;
    }

    // Necesitamos placa de la orden — traer ordenes referenciadas
    const ordenIds = [...new Set(etapas.map(e => e.orden_id))];
    const ordenes  = await api(
      '/ordenes?select=id,placa,marca,linea&id=in.(' + ordenIds.join(',') + ')'
    ).catch(() => []) || [];
    const ordenMap = {};
    ordenes.forEach(o => { ordenMap[o.id] = o; });

    const ahora = Date.now();
    const amarillas = [];
    const naranjas  = [];
    const criticas  = [];

    etapas.forEach(e => {
      const inicioMs       = new Date(e.inicio).getTime();
      const pausadoMs      = (e.tiempo_pausado_min || 0) * 60 * 1000;
      const tiempoNetoMs   = (ahora - inicioMs) - pausadoMs;
      const minutos        = Math.floor(tiempoNetoMs / 60000);
      const orden          = ordenMap[e.orden_id] || {};

      // Lista crítica persistente a partir de 5h
      if (minutos >= 300) criticas.push({ etapa: e, orden, minutos });
      // Aviso desde los 20 min: amarillo hasta 1h, naranja de 1h en adelante
      if (minutos >= 20) {
        (minutos >= 60 ? naranjas : amarillas).push({ etapa: e, orden, minutos });
      }
    });

    // Popup recurrente: cada 20 min la primera hora (20, 40, 60) y luego cada
    // hora (120, 180, 240, ...), si no fue revisada.
    const _alertaTramo = m => m < 60 ? 'm' + Math.floor(m / 20) : 'h' + Math.floor(m / 60);
    [...amarillas, ...naranjas].forEach(({ etapa, orden, minutos }) => {
      const key = etapa.id + ':' + _alertaTramo(minutos);
      if (_alertasYaMostradas.has(key)) return;
      if (_alertasRevisadas.has(etapa.id)) return;
      _alertasYaMostradas.add(key);
      const color = minutos >= 60 ? 'naranja' : 'amarillo';
      _mostrarPopupAlerta(etapa, orden, minutos, color);
    });

    _actualizarListaCritica(criticas);
  } catch (err) {
    console.warn('[Alertas] Error al chequear:', err);
  }
}

function _fmtMin(min) {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function _mostrarPopupAlerta(etapa, orden, minutos, nivel) {
  // Límite de popups simultáneos: máx 3
  const existentes = document.querySelectorAll('.alerta-popup-etapa');
  if (existentes.length >= 3) return;

  const colores = {
    amarillo: { bg: '#FFF8E1', border: '#F59E0B', icon: '#F59E0B', texto: '#78350F' },
    naranja:  { bg: '#FFF3E0', border: '#EA580C', icon: '#EA580C', texto: '#7C2D12' }
  };
  const c      = colores[nivel] || colores.amarillo;
  const placa  = orden.placa || '—';
  const etNom  = etapa.etapa || etapa.servicio || 'Etapa';
  const tec    = etapa.tecnico || 'Sin técnico';

  const div = document.createElement('div');
  div.className = 'alerta-popup-etapa';
  div.dataset.etapaId = etapa.id;
  div.style.cssText = `
    position:fixed;top:16px;right:16px;z-index:10000;
    background:${c.bg};border:1.5px solid ${c.border};border-radius:12px;
    padding:12px 14px;min-width:240px;max-width:300px;
    box-shadow:0 4px 20px rgba(0,0,0,.15);
    font-family:'DM Sans',sans-serif;font-size:13px;color:${c.texto};
    animation:slideInRight .25s ease-out;
    transition:top .2s;
  `;

  // Desplazar hacia abajo si ya hay otros popups
  const prevPopups = document.querySelectorAll('.alerta-popup-etapa');
  let topOffset = 16;
  prevPopups.forEach(p => { topOffset += p.offsetHeight + 8; });
  div.style.top = topOffset + 'px';

  div.innerHTML = `
    <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:8px">
      <div style="display:flex;align-items:center;gap:6px;font-weight:600;font-size:13px">
        <svg width="15" height="15" fill="none" stroke="${c.icon}" stroke-width="2.5" viewBox="0 0 24 24"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
        Etapa sin movimiento ${_fmtMin(minutos)}
      </div>
      <button onclick="this.closest('.alerta-popup-etapa').remove()" style="background:none;border:none;cursor:pointer;color:${c.texto};opacity:.6;font-size:16px;line-height:1;padding:0;flex-shrink:0">×</button>
    </div>
    <div style="margin-top:6px;font-size:12px;opacity:.85">
      <strong>${placa}</strong> · ${etNom} · ${tec}
    </div>
    <div style="margin-top:8px;display:flex;gap:8px">
      <button onclick="_alertaVerOrden(${etapa.orden_id})" style="flex:1;background:${c.border};color:white;border:none;border-radius:7px;padding:5px 0;font-size:11px;font-weight:600;cursor:pointer;font-family:'DM Sans',sans-serif">Ver orden</button>
      <button onclick="_alertaMarcarRevisado(${etapa.id},this)" style="flex:1;background:none;border:1.5px solid ${c.border};color:${c.texto};border-radius:7px;padding:5px 0;font-size:11px;font-weight:600;cursor:pointer;font-family:'DM Sans',sans-serif">Marcar revisado</button>
    </div>
  `;

  document.body.appendChild(div);

  // Auto-cerrar tras 30 segundos
  setTimeout(() => { if (div.parentNode) div.remove(); }, 30000);
}

function _alertaVerOrden(ordenId) {
  // Cerrar popup y abrir el detalle de la orden
  document.querySelectorAll('.alerta-popup-etapa').forEach(p => p.remove());
  if (ordenId && typeof abrirOrden === 'function') abrirOrden(ordenId);
}

// ── Citas de recogida: avisar al jefe cuando llega la hora del cliente ──
async function _chequearCitas() {
  if (!esJefe()) return;
  try {
    const nowIso = new Date().toISOString();
    const ords = await api(
      `/ordenes?cita_entrega=not.is.null&cita_entrega=lte.${nowIso}&estado=neq.Entregada` +
      `&estado=neq.Archivada&select=id,placa,marca,linea,telefono,cita_entrega`
    ).catch(() => []) || [];
    const vivos = new Set(ords.map(o => o.id));
    // Cerrar avisos de citas ya atendidas (entregadas o reagendadas a futuro).
    document.querySelectorAll('.cita-popup').forEach(p => {
      if (!vivos.has(parseInt(p.dataset.citaId))) p.remove();
    });
    // Aviso PERSISTENTE: mantener un popup por cada cita vencida sin entregar.
    // Si el jefe lo cierra, vuelve a aparecer en el siguiente chequeo hasta que
    // la orden se marque Entregada (o se reprograme la cita).
    ords.forEach(o => {
      if (document.querySelector(`.cita-popup[data-cita-id="${o.id}"]`)) return;
      _mostrarPopupCita(o);
    });
  } catch (e) { console.warn('[Citas] Error:', e); }
}

function _mostrarPopupCita(o) {
  const tel = o.telefono ? _waNumero(o.telefono) : '';
  const veh = [o.marca, o.linea].filter(Boolean).join(' ') || '';
  const ci  = (typeof _citaInfo === 'function') ? _citaInfo(o.cita_entrega) : null;
  const div = document.createElement('div');
  div.className = 'alerta-popup-etapa cita-popup'; // reutiliza apilado/estilos base
  div.dataset.citaId = o.id;
  div.style.cssText = `
    position:fixed;top:16px;right:16px;z-index:10000;
    background:#ECFDF5;border:1.5px solid #10B981;border-radius:12px;
    padding:12px 14px;min-width:240px;max-width:300px;
    box-shadow:0 4px 20px rgba(0,0,0,.15);
    font-family:'DM Sans',sans-serif;font-size:13px;color:#065F46;
    animation:slideInRight .25s ease-out;transition:top .2s;`;
  let topOffset = 16;
  document.querySelectorAll('.alerta-popup-etapa').forEach(p => { topOffset += p.offsetHeight + 8; });
  div.style.top = topOffset + 'px';
  div.innerHTML = `
    <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:8px">
      <div style="display:flex;align-items:center;gap:6px;font-weight:700;font-size:13px">🚗 Cliente por llegar</div>
      <button onclick="this.closest('.alerta-popup-etapa').remove()" style="background:none;border:none;cursor:pointer;color:#065F46;opacity:.6;font-size:16px;line-height:1;padding:0;flex-shrink:0">×</button>
    </div>
    <div style="margin-top:6px;font-size:12px;opacity:.9"><strong>${o.placa || '—'}</strong>${veh ? ' · ' + veh : ''}<br>Cita de recogida: <strong>${formatTS(o.cita_entrega)}</strong>${ci ? `<br><span style="font-weight:700">${ci.texto}</span>` : ''}</div>
    <div style="margin-top:8px;display:flex;gap:8px">
      <button onclick="_alertaVerOrden(${o.id})" style="flex:1;background:#10B981;color:white;border:none;border-radius:7px;padding:5px 0;font-size:11px;font-weight:600;cursor:pointer;font-family:'DM Sans',sans-serif">Ver orden</button>
      ${tel ? `<a href="tel:+${tel}" style="flex:1;background:none;border:1.5px solid #10B981;color:#065F46;border-radius:7px;padding:5px 0;font-size:11px;font-weight:600;text-align:center;text-decoration:none;font-family:'DM Sans',sans-serif">📞 Llamar</a>` : ''}
    </div>`;
  document.body.appendChild(div);
}

function _alertaMarcarRevisado(etapaId, btn) {
  _alertasRevisadas.add(etapaId);
  const popup = btn.closest('.alerta-popup-etapa');
  if (popup) popup.remove();
}

function _actualizarListaCritica(criticas) {
  const cont = document.getElementById('alertas-criticas-container');
  if (!cont) return;

  if (!criticas.length) {
    cont.style.display = 'none';
    return;
  }

  cont.style.display = 'block';
  cont.innerHTML = `
    <div style="display:inline-block;max-width:100%;background:#FEF2F2;border:1px solid #FCA5A5;border-radius:10px;padding:8px 11px;margin-bottom:12px">
      <div style="display:flex;align-items:center;gap:5px;font-weight:700;font-size:11px;color:#991B1B;margin-bottom:7px;text-transform:uppercase;letter-spacing:.4px">
        <svg width="13" height="13" fill="none" stroke="#DC2626" stroke-width="2.5" viewBox="0 0 24 24"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
        Alertas críticas · +5h sin movimiento (${criticas.length})
      </div>
      <div style="display:flex;flex-wrap:wrap;gap:6px">
        ${criticas.map(({ etapa, orden, minutos }) => `
          <div class="hover-lift" onclick="_alertaVerOrden(${etapa.orden_id})" title="${escapeHtml((etapa.etapa||etapa.servicio||'Etapa')+' · '+(etapa.tecnico||'Sin técnico'))}" style="display:inline-flex;align-items:center;gap:6px;background:white;border-radius:7px;padding:5px 9px;cursor:pointer;border:1px solid #FECACA">
            <span style="font-family:'DM Mono',monospace;font-weight:700;font-size:11px;color:#7F1D1D">${orden.placa || '—'}</span>
            <span style="font-size:10px;color:#991B1B;max-width:120px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${etapa.etapa || etapa.servicio || 'Etapa'}</span>
            <span style="font-size:10px;font-weight:700;color:#DC2626">${_fmtMin(minutos)}</span>
          </div>
        `).join('')}
      </div>
    </div>
  `;
}

// ═══════════════════════════════════════════════════════════
// PANEL CAPACIDAD DEL TALLER — DETALLE CLICKEABLE
// ═══════════════════════════════════════════════════════════

function cerrarPanelCapacidad() {
  document.getElementById('panel-capacidad-overlay')?.remove();
}

// Mostrar el listado de una categoría al hacer click en su torta
function _capVer(key) {
  const d = window._capLists?.[key];
  if (!d) return;
  Object.keys(window._capLists || {}).forEach(k => {
    const el = document.getElementById('cap-donut-' + k);
    if (el) el.classList.toggle('cap-donut-sel', k === key);
  });
  const det = document.getElementById('cap-detalle');
  if (det) det.innerHTML = `
    <div class="cap-detalle-head" style="color:${d.color}">
      <span class="cap-dot" style="background:${d.color}"></span>${d.label}
      <span class="cap-detalle-count">${d.count} vehículo${d.count === 1 ? '' : 's'}</span>
    </div>
    <div class="cap-detalle-list">${d.html || '<div class="cap-vacio">No hay vehículos en esta categoría ✓</div>'}</div>`;
}

async function abrirPanelCapacidad() {
  document.getElementById('panel-capacidad-overlay')?.remove();

  const overlay = document.createElement('div');
  overlay.id = 'panel-capacidad-overlay';
  overlay.style.cssText = `
    position:fixed;inset:0;background:rgba(0,0,0,0.55);z-index:800;
    display:flex;align-items:center;justify-content:center;padding:16px;
  `;
  overlay.addEventListener('click', e => { if (e.target === overlay) cerrarPanelCapacidad(); });
  overlay.innerHTML = `
    <div style="background:white;border-radius:16px;width:100%;max-width:780px;max-height:90vh;
      display:flex;flex-direction:column;box-shadow:0 20px 60px rgba(0,0,0,0.3);overflow:hidden">
      <div style="background:#1E3A5F;color:white;padding:16px 20px;display:flex;align-items:center;justify-content:space-between;flex-shrink:0">
        <div>
          <div style="font-size:15px;font-weight:700;letter-spacing:.5px">TALLER · Capacidad y Estado en Tiempo Real</div>
          <div id="cap-panel-progress-text" style="font-size:12px;color:rgba(255,255,255,.65);margin-top:2px">Cargando...</div>
        </div>
        <button onclick="cerrarPanelCapacidad()" style="background:rgba(255,255,255,.15);border:none;border-radius:8px;padding:6px 12px;color:white;cursor:pointer;font-size:13px;font-weight:600">✕ Cerrar</button>
      </div>
      <div style="padding:4px 20px 8px;background:#1E3A5F;flex-shrink:0">
        <div style="background:rgba(255,255,255,.15);border-radius:99px;height:8px;overflow:hidden">
          <div id="cap-panel-bar" style="height:100%;background:#EAB308;border-radius:99px;transition:width .5s;width:0%"></div>
        </div>
      </div>
      <div id="cap-panel-body" style="overflow-y:auto;padding:16px 20px;flex:1">
        <div class="loading-state">Cargando datos del taller...</div>
      </div>
    </div>`;
  document.body.appendChild(overlay);

  try {
    const TOTAL_CUPOS = 34;
    const [ordenesActivas, etapasActivas, ordenesPulmon, programadas] = await Promise.all([
      api('/ordenes?estado=eq.Activa&select=id,placa,marca,linea,propietario,kilometraje,creado_en,pulmon&order=creado_en.desc').catch(() => []),
      api('/etapas?fin=is.null&inicio=not.is.null&select=id,orden_id,etapa,tecnico,inicio,tiempo_pausado_min').catch(() => []),
      api('/ordenes?pulmon=eq.true&select=id,placa,marca,linea,propietario,pulmon_desde,pulmon_tipo&order=pulmon_desde.asc').catch(() => []),
      api('/ordenes?estado=eq.Programada&select=id,placa,marca,linea,propietario,fecha_programada&order=fecha_programada.asc').catch(() => [])
    ]);

    // IDs de órdenes con etapas activas
    const conEtapaActiva = new Set(etapasActivas.map(e => e.orden_id));

    // Clasificar
    const enOperacion = ordenesActivas.filter(o => !o.pulmon && conEtapaActiva.has(o.id));
    const quietos     = ordenesActivas.filter(o => !o.pulmon && !conEtapaActiva.has(o.id));
    const enPulmon    = ordenesPulmon;

    const ocupados = enOperacion.length + quietos.length + enPulmon.filter(p => p.pulmon_tipo !== 'externo').length;
    const pct      = Math.round((ocupados / TOTAL_CUPOS) * 100);

    // Update progress
    const barEl  = document.getElementById('cap-panel-bar');
    const txtEl  = document.getElementById('cap-panel-progress-text');
    if (barEl) { barEl.style.width = pct + '%'; barEl.style.background = pct > 85 ? '#EF4444' : pct > 65 ? '#EAB308' : '#22C55E'; }
    if (txtEl) txtEl.textContent = `${ocupados} de ${TOTAL_CUPOS} cupos ocupados (${pct}%)`;

    // Time helper
    function _tiempoDesde(inicio, pausadoMin) {
      if (!inicio) return '—';
      const minTot = Math.floor((Date.now() - new Date(inicio)) / 60000) - (pausadoMin || 0);
      const h = Math.floor(minTot / 60); const m = minTot % 60;
      return h > 0 ? `${h}h ${m}m` : `${m}m`;
    }

    function _verOrdenBtn(id) {
      return `<button onclick="cerrarPanelCapacidad();abrirOrden(${id});navJefe('detalle')" class="cap-btn-ver">→ Ver</button>`;
    }
    function _asignarBtn(id) {
      return `<button onclick="cerrarPanelCapacidad();abrirOrden(${id});navJefe('detalle');setTimeout(()=>abrirModalAgregar(),600)" class="cap-btn-asignar">Asignar</button>`;
    }
    function _capRow(placa, nombre, meta, tiempo, tColor, btns) {
      return `<div class="cap-row">
        <span class="cap-placa">${escapeHtml(placa||'—')}</span>
        <span class="cap-nombre">${escapeHtml(nombre||'—')}</span>
        <span class="cap-meta">${meta||''}</span>
        <span class="cap-tiempo" style="color:${tColor}">${tiempo||''}</span>
        <span class="cap-acc">${btns||''}</span>
      </div>`;
    }

    // Listas compactas por categoría
    const listaOp = enOperacion.map(o => {
      const etapa = etapasActivas.find(e => e.orden_id === o.id);
      const meta = `${escapeHtml(etapa?.etapa||etapa?.servicio||'—')} · ${escapeHtml(etapa?.tecnico||'Sin técnico')}`;
      return _capRow(o.placa, o.propietario, meta, _tiempoDesde(etapa?.inicio, etapa?.tiempo_pausado_min), '#059669', _verOrdenBtn(o.id));
    }).join('');

    const listaQ = quietos.map(o => {
      const diasQ = o.creado_en ? Math.floor((Date.now() - new Date(o.creado_en)) / 86400000) : 0;
      const meta = [o.marca,o.linea].filter(Boolean).map(escapeHtml).join(' ')||'—';
      return _capRow(o.placa, o.propietario, meta, diasQ+'d', '#D97706', _verOrdenBtn(o.id)+_asignarBtn(o.id));
    }).join('');

    const _pulFila = (col) => (o) => {
      const minsPulmon = o.pulmon_desde ? Math.floor((Date.now() - new Date(o.pulmon_desde)) / 60000) : 0;
      const hP = Math.floor(minsPulmon / 60); const mP = minsPulmon % 60;
      const tiempoPulmon = hP > 24 ? `${Math.floor(hP/24)}d` : hP > 0 ? `${hP}h ${mP}m` : `${mP}m`;
      return _capRow(o.placa, o.propietario, escapeHtml(o.pulmon_tipo||'—'), tiempoPulmon, col, _verOrdenBtn(o.id));
    };
    // Pulmón interno = físicamente en el taller (ocupa cupo). Externo = fuera.
    const enPulmonInt = enPulmon.filter(o => o.pulmon_tipo !== 'externo');
    const enPulmonExt = enPulmon.filter(o => o.pulmon_tipo === 'externo');
    const listaPint = enPulmonInt.map(_pulFila('#F97316')).join('');
    const listaPext = enPulmonExt.map(_pulFila('#0EA5E9')).join('');

    const listaPr = programadas.map(o => {
      const fechaProg = o.fecha_programada ? new Date(o.fecha_programada).toLocaleDateString('es-CO',{day:'2-digit',month:'2-digit',year:'numeric'}) : '—';
      return _capRow(o.placa, o.propietario, 'Programado', fechaProg, '#7C3AED', _verOrdenBtn(o.id));
    }).join('');

    const cats = [
      { key:'op', label:'En operación', color:'#DC2626', count:enOperacion.length, sub:'con etapa',   html:listaOp },
      { key:'q',  label:'Quietos',      color:'#D97706', count:quietos.length,     sub:'sin etapa',   html:listaQ  },
      { key:'p',  label:'Pulmón (taller)', color:'#F97316', count:enPulmonInt.length, sub:'en el taller',     html:listaPint },
      { key:'pe', label:'Pulmón externo',  color:'#0EA5E9', count:enPulmonExt.length, sub:'fuera del taller', html:listaPext },
      { key:'pr', label:'Programados',  color:'#7C3AED', count:programadas.length, sub:'por ingresar',html:listaPr }
    ];
    const totalCat = cats.reduce((s,c)=>s+c.count,0) || 1;
    window._capLists = {};
    cats.forEach(c => { window._capLists[c.key] = { html:c.html, label:c.label, color:c.color, count:c.count }; });

    const donutsHtml = cats.map(c => {
      const pctArc = Math.round(c.count / totalCat * 100);
      return `<div class="cap-donut" id="cap-donut-${c.key}" onclick="_capVer('${c.key}')">
        <svg width="84" height="84" viewBox="0 0 36 36">
          <circle cx="18" cy="18" r="15.9155" fill="none" stroke="#EEF0F3" stroke-width="3.4"/>
          <circle cx="18" cy="18" r="15.9155" fill="none" stroke="${c.color}" stroke-width="3.4"
            stroke-dasharray="${pctArc} 100" stroke-linecap="round" transform="rotate(-90 18 18)"/>
          <text x="18" y="19.6" text-anchor="middle" font-size="11" font-weight="800" fill="${c.color}" font-family="'DM Mono',monospace">${c.count}</text>
        </svg>
        <div class="cap-donut-lbl">${c.label}</div>
        <div class="cap-donut-sub">${c.sub}</div>
      </div>`;
    }).join('');

    const body = document.getElementById('cap-panel-body');
    if (body) {
      body.innerHTML = `
        <div class="cap-donuts">${donutsHtml}</div>
        <div id="cap-detalle" class="cap-detalle"></div>`;
      const def = cats.slice().sort((a,b)=>b.count-a.count)[0]?.key || 'op';
      _capVer(def);
    }
  } catch(e) {
    const body = document.getElementById('cap-panel-body');
    if (body) body.innerHTML = `<div class="empty-state">Error cargando datos: ${e.message}</div>`;
  }
}
