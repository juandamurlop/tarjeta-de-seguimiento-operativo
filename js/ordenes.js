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

async function cargarOrdenes() {
  const lista = document.getElementById('lista-ordenes');
  if (!lista) return;
  lista.innerHTML = '<div class="loading-state">Cargando órdenes...</div>';
  try {
    const data = await api(`/ordenes?estado=eq.${filtroEstado}${filtroEstado==='Activa'?'&pulmon=eq.false':''}&order=creado_en.desc&limit=60`);
    if (!data?.length) {
      lista.innerHTML = `<div class="empty-state"><div class="empty-state-icon">📋</div>No hay órdenes ${filtroEstado.toLowerCase()}s.</div>`;
      return;
    }
    const ids = data.map(o => o.id).join(',');
    const etapas = await api(`/etapas?orden_id=in.(${ids})&select=orden_id,servicio,fin`).catch(() => []) || [];

    lista.innerHTML = data.map(o => {
      const etapasO  = etapas.filter(e => e.orden_id === o.id);
      const total    = etapasO.length;
      const comp     = etapasO.filter(e => e.fin).length;
      const pct      = total ? Math.round((comp / total) * 100) : 0;
      const completa = total > 0 && comp === total;
      const srvs     = [...new Set(etapasO.map(e => e.servicio).filter(Boolean))];
      const chips    = srvs.map(s => `<span class="badge badge-${s}">${CATALOGO[s]?.nombre || s}</span>`).join('');
      const estadoBadge = o.pulmon
        ? `<span class="badge badge-pulmon">En Pulmón</span>`
        : `<span class="badge badge-${o.estado?.toLowerCase() || 'activa'}">${o.estado || 'Activa'}</span>`;
      const tcBadge = o.tipo_cliente ? `<span class="badge badge-${o.tipo_cliente}">${o.tipo_cliente}</span>` : '';

      return `<div class="orden-card" draggable="true" id="card-${o.id}"
        ondragstart="dragStart(event,'${o.id}')"
        ondragover="dragOver(event)"
        ondragleave="dragLeave(event)"
        ondrop="dragDrop(event,'${o.id}')"
        ondragend="dragEnd(event)"
        onclick="abrirOrden(${o.id})">
        <div class="orden-card-top">
          <div>
            <div class="orden-placa">${o.placa}</div>
            <div class="orden-vehiculo">${[o.marca,o.linea,o.modelo].filter(Boolean).join(' · ')} ${o.propietario ? '— '+o.propietario : ''}</div>
          </div>
          <div class="orden-badges">${estadoBadge}${tcBadge}</div>
        </div>
        ${total > 0 ? `<div class="progreso-bar-wrap">
          <div class="progreso-labels"><span>${comp} / ${total} etapas</span><span>${pct}%</span></div>
          <div class="progreso-track"><div class="progreso-fill ${completa?'completa':''}" style="width:${pct}%"></div></div>
        </div>` : ''}
        <div class="orden-card-bottom">
          <div class="srv-chips">${chips || '<span style="font-size:12px;color:var(--gris-mid)">Sin etapas</span>'}</div>
          <div class="orden-fecha">${formatFecha(o.creado_en)}${o.fecha_entrega_1 ? '<br>Entrega: '+formatFecha(o.fecha_entrega_1) : ''}</div>
        </div>
      </div>`;
    }).join('');
  } catch(e) { lista.innerHTML = `<div class="empty-state">Error cargando órdenes: ${e.message}</div>`; }
}

async function cargarOrdenesPulmon() {
  const lista = document.getElementById('lista-ordenes');
  if (!lista) return;
  lista.innerHTML = '<div class="loading-state">Cargando órdenes...</div>';
  try {
    const data = await api(`/ordenes?pulmon=eq.true&order=pulmon_desde.asc&limit=60`);
    if (!data?.length) {
      lista.innerHTML = `<div class="empty-state"><div class="empty-state-icon"></div>No hay órdenes en pulmón.</div>`;
      return;
    }
    const ids = data.map(o => o.id).join(',');
    const etapas = await api(`/etapas?orden_id=in.(${ids})&select=orden_id,servicio,fin`).catch(() => []) || [];

    lista.innerHTML = data.map(o => {
      const etapasO  = etapas.filter(e => e.orden_id === o.id);
      const total    = etapasO.length;
      const comp     = etapasO.filter(e => e.fin).length;
      const pct      = total ? Math.round((comp / total) * 100) : 0;
      const completa = total > 0 && comp === total;
      const srvs     = [...new Set(etapasO.map(e => e.servicio).filter(Boolean))];
      const chips    = srvs.map(s => `<span class="badge badge-${s}">${CATALOGO[s]?.nombre || s}</span>`).join('');
      const diasPulmon = o.pulmon_desde
        ? Math.floor((new Date() - new Date(o.pulmon_desde)) / 86400000)
        : null;
      return `<div class="orden-card" draggable="true" id="card-${o.id}"
        ondragstart="dragStart(event,'${o.id}')"
        ondragover="dragOver(event)"
        ondragleave="dragLeave(event)"
        ondrop="dragDrop(event,'${o.id}')"
        ondragend="dragEnd(event)"
        onclick="abrirOrden(${o.id})">
        <div class="orden-card-top">
          <div>
            <div class="orden-placa">${o.placa}</div>
            <div class="orden-vehiculo">${[o.marca,o.linea,o.modelo].filter(Boolean).join(' · ')} ${o.propietario ? '— '+o.propietario : ''}</div>
          </div>
          <div class="orden-badges">
            <span class="badge badge-pulmon">En Pulmón${diasPulmon !== null ? ` · ${diasPulmon}d` : ''}</span>
            ${o.tipo_cliente ? `<span class="badge badge-${o.tipo_cliente}">${o.tipo_cliente}</span>` : ''}
          </div>
        </div>
        ${total > 0 ? `<div class="progreso-bar-wrap">
          <div class="progreso-labels"><span>${comp} / ${total} etapas</span><span>${pct}%</span></div>
          <div class="progreso-track"><div class="progreso-fill ${completa?'completa':''}" style="width:${pct}%"></div></div>
        </div>` : ''}
        <div class="orden-card-bottom">
          <div class="srv-chips">${chips || '<span style="font-size:12px;color:var(--gris-mid)">Sin etapas</span>'}</div>
          <div class="orden-fecha">${diasPulmon !== null ? `${diasPulmon} días en pulmón` : ''}</div>
        </div>
      </div>`;
    }).join('');
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
  if (sesion?.perfil === 'jefe') navJefe('ordenes');
}

async function abrirOrden(id) {
  mostrarPagina('pag-detalle');
  document.getElementById('topbar-title').textContent = 'Detalle de Orden';
  const detalleCont = document.getElementById('detalle-contenido');
  if (!detalleCont) return;
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
    const comp = etapas.filter(e => e.fin).length;
    const pct = total ? Math.round((comp / total) * 100) : 0;
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
      ? todasFotos.map(f=>`<div class="foto-thumb" onclick="abrirLightbox('${f.url}')"><img src="${f.url}" alt="" loading="lazy"></div>`).join('')
      : '<span style="font-size:12px;color:var(--gris-mid)">Sin fotos.</span>';

    // Timeline
    const tlHtml = etapas.length ? etapas.map((e,i) => {
      const done = !!e.fin;
      const active = !!e.inicio && !e.fin;
      const cls = done ? 'done' : active ? 'active' : 'pending';
      const icon = done ? '✓' : active ? '●' : (i+1);
      return `<div class="timeline-step ${done?'done':''}">
        <div class="timeline-dot ${cls}">${icon}</div>
        <div class="timeline-label ${cls}">${e.etapa||'—'}</div>
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
          '<div class="empty-state-icon">🔧</div>' +
          '<p>No hay etapas registradas aún.</p>' +
          '<button class="btn btn-primary" style="margin-top:14px" onclick="abrirModalAgregar()">+ Asignar servicios y etapas</button>' +
        '</div>';


    detalleCont.innerHTML = `
      <div class="detalle-grid">
        <div>
          <div class="detalle-header-card">
            <div class="detalle-placa-row">
              <div>
                <div class="detalle-placa">${orden.placa}</div>
                <div class="detalle-vehiculo">${[orden.marca,orden.linea,orden.modelo,orden.color].filter(Boolean).join(' · ')}</div>
              </div>
              <div style="display:flex;flex-direction:column;align-items:flex-end;gap:6px">
                <span class="badge badge-${estadoClase}">${estadoTexto}</span>
                ${orden.tipo_cliente ? `<span class="badge badge-${orden.tipo_cliente}">${orden.tipo_cliente}</span>` : ''}
              </div>
            </div>
            <div class="donut-section">
              <svg class="donut-svg" width="56" height="56" viewBox="0 0 56 56">
                <circle class="donut-track" cx="28" cy="28" r="22"/>
                <circle class="donut-fill ${pct===100?'completa':'proceso'}" cx="28" cy="28" r="22"
                  style="stroke-dasharray:${(pct/100)*circ} ${circ}"/>
                <text class="donut-pct" x="28" y="32" text-anchor="middle">${pct}%</text>
              </svg>
              <div class="donut-info">
                <div class="donut-label">Progreso general</div>
                <div class="donut-val">${comp} / ${total} etapas</div>
                <div style="display:flex;gap:16px;flex-wrap:wrap">
                  <div><div class="donut-label">Etapa activa</div><div style="font-size:13px;font-weight:600">${tiempoEtapa}</div></div>
                  <div><div class="donut-label">Tiempo total</div><div style="font-size:13px;font-weight:600">${tiempoTotal}</div></div>
                </div>
              </div>
            </div>
            <div class="timeline-wrap">
              <div class="etapas-timeline" id="d-timeline">${tlHtml}</div>
            </div>
          </div>
          <div class="info-chips" style="margin-bottom:16px">
            <div class="info-chip"><div class="info-chip-label">Propietario</div><div class="info-chip-val">${orden.propietario||'—'}</div></div>
            <div class="info-chip"><div class="info-chip-label">Teléfono</div><div class="info-chip-val">${orden.telefono||'—'}</div></div>
            <div class="info-chip"><div class="info-chip-label">Aseguradora</div><div class="info-chip-val">${orden.aseguradora||'—'}</div></div>
            <div class="info-chip"><div class="info-chip-label">Nivel daño</div><div class="info-chip-val">${orden.nivel_dano||'—'}</div></div>
            <div class="info-chip"><div class="info-chip-label">Kilometraje</div><div class="info-chip-val">${orden.kilometraje?orden.kilometraje.toLocaleString('es-CO')+' km':'—'}</div></div>
            <div class="info-chip"><div class="info-chip-label">Ingreso</div><div class="info-chip-val">${formatFecha(orden.creado_en)}</div></div>
            <div class="info-chip"><div class="info-chip-label">Fecha entrega 1</div><div class="info-chip-val">${formatFecha(orden.fecha_entrega_1)}</div></div>
            <div class="info-chip"><div class="info-chip-label">Fecha entrega 2</div><div class="info-chip-val">${formatFecha(orden.fecha_entrega_2)}</div></div>
          </div>
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">
            <div class="seccion-titulo" style="margin-bottom:0">Servicios y Etapas</div>
            <button class="btn btn-ghost btn-sm" onclick="abrirModalAgregar()">+ Agregar etapas</button>
          </div>
          ${serviciosHtml}
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
                  '<div style="display:flex;justify-content:space-between;font-size:12px;padding:4px 0;border-bottom:1px solid var(--gris-borde)"><span style="color:var(--gris-mid)">' + (e.etapa||'') + '</span><span style="font-weight:600">' + fmt(e.valor) + '</span></div>'
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
          ${orden.tipo_cliente === 'aseguradora' ? `<div id="pulmon-card" class="pulmon-card ${orden.pulmon?'':'inactivo'}">` : `<div id="pulmon-card" style="display:none">`}
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
              <div style="font-size:12px;font-weight:700;font-family:'DM Mono',monospace;letter-spacing:1px;text-transform:uppercase;color:${orden.pulmon?'var(--amarillo)':'var(--gris-mid)'}">Pulmón</div>
              <button class="btn btn-sm ${orden.pulmon?'btn-ghost':'btn-ghost'}" id="btn-pulmon" onclick="togglePulmon()">
                ${orden.pulmon ? 'Sacar de pulmón' : 'Activar Pulmón'}
              </button>
            </div>
            <div id="d-pulmon-badge" style="font-size:13px;color:${orden.pulmon?'var(--amarillo)':'var(--gris-mid)'}">
              ${orden.pulmon ? `En pulmón desde ${formatFecha(orden.pulmon_desde)}` : 'Sin pulmón activo'}
            </div>
          </div>
          <div class="sidebar-card">
            <div class="sidebar-card-header">Cotización PDF</div>
            <div class="sidebar-card-body">
              <div id="d-cotizacion-link" style="margin-bottom:12px;font-size:13px">
                ${orden.cotizacion_url
                  ? `<a href="${orden.cotizacion_url}" target="_blank" style="color:var(--azul-mid);text-decoration:underline">Ver PDF →</a>`
                  : '<span style="color:var(--gris-mid)">Sin cotización adjunta</span>'}
              </div>
              <div class="upload-zone" onclick="document.getElementById('fi-cotizacion').click()">
                <input type="file" id="fi-cotizacion" accept=".pdf,application/pdf" onchange="subirCotizacion(this)">
                <div style="font-size:16px">📄</div>
                <p>${orden.cotizacion_url ? 'Reemplazar PDF' : 'Subir PDF'}</p>
                <div class="upload-prog" id="prog-cotizacion"></div>
              </div>
            </div>
          </div>
          ${sesion?.perfil === 'jefe' ? `
          <div class="sidebar-card">
            <div class="sidebar-card-header">Estado de la orden</div>
            <div class="sidebar-card-body">
              ${(comp === total && total > 0 && orden.estado !== 'Entregada' && orden.estado !== 'Archivada')
                ? `<button class="btn btn-success" style="width:100%" onclick="cambiarEstado('Entregada')">✓ Marcar como Finalizada</button>
                   <div style="font-size:11px;color:var(--gris-mid);margin-top:8px;text-align:center">Todas las etapas completadas</div>`
                : `<div style="display:inline-flex;align-items:center;gap:8px;padding:8px 14px;background:var(--azul-light);border-radius:20px">
                     <span style="width:8px;height:8px;border-radius:50%;background:var(--azul-mid);display:inline-block"></span>
                     <span style="font-size:13px;font-weight:700;color:var(--azul)">${orden.estado === 'Entregada' ? 'Finalizada' : orden.estado === 'Archivada' ? 'Archivada' : 'Activa'}</span>
                   </div>`
              }
            </div>
          </div>` : ''}
        </div>
      </div>`;
  } catch(e) {
    detalleCont.innerHTML = `<div class="empty-state">Error: ${e.message}</div>`;
  }
}

function renderEtapa(e, fotos, novedades, hayActiva, aprobaciones = []) {
  const eid = e.id;
  const k = kid(eid);
  const nombre = e.etapa || '—';
  const badge = !e.inicio ? 'Pendiente' : (e.fin ? 'Completada' : 'En proceso');
  const bCls = !e.inicio ? 'pendiente' : (e.fin ? 'completada' : 'iniciada');
  const eFotos = fotos.filter(f => f.etapa_id === eid);
  const eNovs = novedades.filter(n => n.etapa_id === eid);
  const aprobEtapa = aprobaciones.filter(a => a.etapa_id === eid);
  const ultimaAprob = aprobEtapa.length ? aprobEtapa[aprobEtapa.length - 1] : null;

  let dur = '';
  if (e.inicio && e.fin) {
    const m = Math.round((new Date(e.fin) - new Date(e.inicio)) / 60000);
    dur = `<div class="ts-chip">Duración: <strong>${Math.floor(m/60)}h ${m%60}m</strong></div>`;
  }

  let acc = '';
  if (!e.inicio)
    acc = `<button class="btn btn-success btn-sm" onclick="iniciarEtapa(${eid},'${nombre}')">▶ Iniciar</button>`;
  else if (e.inicio && !e.fin)
    acc = `<button class="btn btn-danger btn-sm" onclick="finalizarEtapa(${eid},'${nombre}','${e.servicio||''}')">■ Finalizar</button>`;
  else if (e.fin) {
    const aprobBtn = ultimaAprob
      ? `<button class="btn btn-ghost btn-sm" onclick="abrirModalAprobacion(${eid},'${nombre.replace(/'/g,"\\'")}')">↻ Revisar calidad</button>`
      : `<button class="btn btn-primary btn-sm" onclick="abrirModalAprobacion(${eid},'${nombre.replace(/'/g,"\\'")}')">✓ Aprobar calidad</button>`;
    acc = aprobBtn;
  } else {
    acc = `<span style="font-size:12px;color:var(--gris-mid);font-style:italic">Esperando turno</span>`;
  }

  const fotosHtml = eFotos.map(f => `
    <div class="foto-thumb" onclick="abrirLightbox('${f.url}')">
      <img src="${f.url}" alt="">
      <button class="foto-delete" onclick="event.stopPropagation();eliminarFoto(${f.id},'${f.url}')">✕</button>
    </div>`).join('');

  const novsHtml = eNovs.length ? eNovs.map(n => `
    <div class="novedad-item">
      <div class="novedad-item-top">
        <span class="novedad-tipo ${(n.tipo||'').toLowerCase()}">${n.tipo}</span>
        <span class="novedad-fecha">${formatTS(n.creado_en)}</span>
      </div>
      <div class="novedad-motivo">${n.motivo||'—'}</div>
      <div class="novedad-resp">Resp: ${n.responsable||'—'}</div>
    </div>`).join('')
    : '<div style="font-size:12px;color:var(--gris-mid);padding:4px 0">Sin novedades.</div>';

  return `
    <div class="etapa-card">
      <div class="etapa-header" onclick="toggleEtapa('eb-${k}')">
        <div style="flex:1;min-width:0">
          <div class="etapa-nombre">${nombre}${e.tercero?` <span style="font-size:11px;color:var(--gris-mid);font-weight:400">(${e.tercero})</span>`:''}</div>
          ${e.tecnico||e.mecanico_id ? `<div class="etapa-tecnico">👤 ${e.tecnico||'Asignado'}</div>` : ''}
        </div>
        <div style="display:flex;align-items:center;gap:5px;flex-shrink:0">
          ${ultimaAprob ? `<span class="badge badge-${ultimaAprob.estado}">${ultimaAprob.estado==='aprobado'?'✓ Aprobada':'✗ Rechazada'}</span>` : ''}
          <span class="badge badge-${bCls}">${badge}</span>
          <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" style="opacity:0.4"><path d="M6 9l6 6 6-6"/></svg>
        </div>
      </div>
      <div class="etapa-body" id="eb-${k}">
        <div class="etapa-actions">${acc}</div>
        <div class="timestamps">
          <div class="ts-chip">Inicio: <strong>${e.inicio?formatTS(e.inicio):'—'}</strong></div>
          <div class="ts-chip">Fin: <strong>${e.fin?formatTS(e.fin):'—'}</strong></div>
          ${dur}
        </div>
        <div class="grid-2" style="margin-bottom:12px">
          <div class="field"><label>Técnico asignado</label>
            <select id="tec-${k}" onchange="asignarMecanico(${eid},'${k}')">
              <option value="">— Sin asignar —</option>
              ${mecanicos.map(m=>`<option value="${m.id}" ${e.mecanico_id===m.id?'selected':''}>${m.nombre}${m.rol?` (${m.rol})`:''}</option>`).join('')}
            </select>
          </div>
          <div style="display:flex;gap:8px">
            <div class="field" style="flex:1"><label>H. Facturadas</label>
              <input id="hf-${k}" type="number" step="0.5" value="${e.horas_facturadas||''}" placeholder="0" onblur="patchHoras(${eid},'${k}')">
            </div>
            <div class="field" style="flex:1"><label>H. Adicionales</label>
              <input id="ha-${k}" type="number" step="0.5" value="${e.horas_adicionales||''}" placeholder="0" onblur="patchHoras(${eid},'${k}')">
            </div>
          </div>
        </div>

        <div class="field" style="margin-bottom:12px">
          <label style="font-size:11px;font-weight:600;letter-spacing:1px;text-transform:uppercase;color:var(--gris-mid)"> Valor </label>
          <input id="val-${k}" type="number" step="1000" value="${e.valor||''}" placeholder="0"
            style="font-size:14px;font-weight:600;color:var(--verde)"
            onblur="patchValor(${eid},'${k}')">
          ${e.valor ? '<div style="font-size:11px;color:var(--gris-mid);margin-top:3px">' + new Intl.NumberFormat('es-CO',{style:'currency',currency:'COP',minimumFractionDigits:0}).format(e.valor) + '</div>' : '' }
        </div>

        <div class="fotos-section" style="margin-top:0">
          <label style="font-size:11px;font-weight:600;letter-spacing:1px;text-transform:uppercase;color:var(--gris-mid)">Fotos (${eFotos.length})</label>
          <div class="fotos-grid" style="margin-top:6px">${fotosHtml}</div>
          <div class="upload-zone" onclick="document.getElementById('fi-${k}').click()" style="margin-top:8px">
            <input type="file" id="fi-${k}" accept="image/*" multiple onchange="subirFotos(this,'${nombre}',${eid},'${k}')">
            <div style="font-size:18px">📷</div>
            <p>Clic para subir fotos</p>
            <div class="upload-prog" id="prog-${k}"></div>
          </div>
        </div>
        <div class="novedad-section">
          <div class="novedad-section-titulo">Novedades</div>
          <div id="nlist-${eid}">${novsHtml}</div>
          <div class="grid-2" style="margin-top:10px">
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
          <div class="btn-row" style="margin-top:8px">
            <button class="btn btn-danger btn-sm" onclick="guardarNovedad(${eid})">Guardar novedad</button>
          </div>
        </div>
        ${ultimaAprob ? `
        <div class="aprob-box ${ultimaAprob.estado==='rechazado'?'rechazado':''}" style="margin-top:14px">
          <div class="aprob-box-top">
            <span class="aprob-box-estado">${ultimaAprob.estado==='aprobado'?'✓ Aprobada':'✗ Rechazada'}</span>
            <span class="aprob-box-fecha">${formatTS(ultimaAprob.creado_en)}</span>
          </div>
          <div style="font-size:12px;color:var(--gris-mid)">Por: ${ultimaAprob.registrado_por}</div>
          ${ultimaAprob.observacion?`<div style="font-size:12px;margin-top:4px">${ultimaAprob.observacion}</div>`:''}
        </div>` : ''}
      </div>
    </div>`;
}

function togglePanel(id) { 
  const el = document.getElementById(id);
  if (el) el.classList.toggle('open'); 
}
function toggleEtapa(id) { 
  const el = document.getElementById(id);
  if (el) el.classList.toggle('open'); 
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
      if (inicio && fin) { const m = Math.round((fin - inicio) / 60000); duracion = `${Math.floor(m/60)}h ${m%60}m`; } 
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
    if (ordenActual) abrirOrden(ordenActual.id);
  } catch(e) { toast('Error: '+e.message, 'err'); }
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

// ============================================================
// NUEVA ORDEN
// ============================================================
function resetNuevaOrden() {
  const fields = ['n-placa', 'n-marca', 'n-linea', 'n-modelo', 'n-color', 'n-propietario', 'n-telefono', 'n-km', 'n-fecha1', 'n-fecha2', 'n-inv-obs', 'n-cedula-cliente'];
  fields.forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
  const aseguradora = document.getElementById('n-aseguradora');
  const dano = document.getElementById('n-dano');
  const tipoCliente = document.getElementById('n-tipo-cliente');
  if (aseguradora) aseguradora.value = '';
  if (dano) dano.value = '';
  if (tipoCliente) tipoCliente.value = '';
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
  if (sesion?.perfil === 'jefe') navJefe('ordenes'); 
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

async function buscarPorPlaca() {
  const placa = document.getElementById('n-placa')?.value.trim().toUpperCase();
  const resultDiv = document.getElementById('placa-resultado');
  const histDiv = document.getElementById('historial-previo');
  if (!placa || placa.length < 3) { 
    if (resultDiv) resultDiv.style.display = 'none'; 
    if (histDiv) histDiv.style.display = 'none'; 
    return; 
  }
  try {
    const ordenes = await api(`/ordenes?placa=eq.${placa}&order=creado_en.desc&limit=5`);
    if (ordenes?.length) {
      const u = ordenes[0];
      const marca = document.getElementById('n-marca');
      const linea = document.getElementById('n-linea');
      const propietario = document.getElementById('n-propietario');
      const telefono = document.getElementById('n-telefono');
      const modelo = document.getElementById('n-modelo');
      if (marca) marca.value = u.marca || '';
      if (linea) linea.value = u.linea || '';
      if (propietario) propietario.value = u.propietario || '';
      if (telefono) telefono.value = u.telefono || '';
      if (modelo && u.modelo) modelo.value = u.modelo;
      if (resultDiv) {
        resultDiv.className = 'placa-resultado encontrado';
        resultDiv.innerHTML = '✔ Vehículo encontrado — datos autocompletados.';
        resultDiv.style.display = 'block';
      }
      const historialLista = document.getElementById('historial-lista');
      if (historialLista && histDiv) {
        historialLista.innerHTML = ordenes.map(o => `
          <div class="historial-item" onclick="abrirOrden(${o.id})">
            <div><span class="historial-placa">${o.placa}</span> <span style="color:var(--gris-mid);margin-left:8px">${o.aseguradora || '—'} · ${o.nivel_dano || '—'}</span></div>
            <div style="font-size:11px;color:var(--gris-mid);text-align:right">${formatFecha(o.creado_en)}</div>
          </div>`).join('');
        histDiv.style.display = 'block';
      }
    } else {
      if (resultDiv) {
        resultDiv.className = 'placa-resultado nuevo';
        resultDiv.innerHTML = 'ℹ Placa nueva — sin registros anteriores.';
        resultDiv.style.display = 'block';
      }
      if (histDiv) histDiv.style.display = 'none';
    }
  } catch(e) { 
    if (resultDiv) resultDiv.style.display = 'none'; 
  }
}

async function crearOrden() {
  const placa = document.getElementById('n-placa')?.value.trim().toUpperCase();
  if (!placa) { toast('La placa es obligatoria', 'err'); return; }
  const cedulaCliente = document.getElementById('n-cedula-cliente')?.value.trim() || '';

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
    aseguradora: document.getElementById('n-aseguradora')?.value || null,
    marca: document.getElementById('n-marca')?.value || null,
    linea: document.getElementById('n-linea')?.value || null,
    modelo: document.getElementById('n-modelo')?.value || null,
    color: document.getElementById('n-color')?.value || null,
    propietario: document.getElementById('n-propietario')?.value || null,
    telefono: document.getElementById('n-telefono')?.value || null,
    tipo_cliente: document.getElementById('n-tipo-cliente')?.value || null,
    nivel_dano: document.getElementById('n-dano')?.value || null,
    kilometraje: parseInt(document.getElementById('n-km')?.value) || null,
    fecha_entrega_1: document.getElementById('n-fecha1')?.value || null,
    fecha_entrega_2: document.getElementById('n-fecha2')?.value || null,
    inventario: JSON.stringify({ items: invItems, observaciones: document.getElementById('n-inv-obs')?.value.trim() || null }),
    estado: 'Activa',
    cliente_id: clienteId
  };

  try {
    const res = await api('/ordenes?select=id', 'POST', body, { Prefer: 'return=representation' });
    const ordenId = res[0].id;

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
    toast('Orden creada ✓');
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
  const cont = document.getElementById('srv-descripciones');
  if (cont) cont.style.display = srvSeleccionados.length ? 'block' : 'none';
  ['latoneria', 'pintura', 'mecanica', 'adicionales'].forEach(s => {
    const el = document.getElementById('srv-desc-' + s);
    if (el) el.style.display = srvSeleccionados.includes(s) ? 'grid' : 'none';
  });
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

function buildChecklist(containerId, servicios, existentes) {
  const container = document.getElementById(containerId);
  if (!container) return;
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
      const mecHtml = !iniciada ? `<div class="mec-select-wrap" id="mec-${et.key}" style="margin-top:6px;display:${checked ? 'block' : 'none'}">
        <select id="mec-sel-${et.key}" style="font-size:13px">
          <option value="">— Asignar mecánico * —</option>
          ${mecanicos.map(m => `<option value="${m.id}" ${m.id == mecSelected ? ' selected' : ''}>${m.nombre}${m.rol ? ` (${m.rol})` : ''}</option>`).join('')}
        </select>
      </div>` : `<div style="font-size:11px;color:var(--gris-mid);margin-top:4px">Mecánico ya asignado</div>`;
      const camposHtml = !iniciada ? `
        <div class="etapa-extra-campos" id="campos-${et.key}" style="display:${checked ? 'block' : 'none'};margin-top:8px;padding:10px;background:var(--gris-bg);border-radius:6px;border:1px solid var(--gris-borde)">
          <div style="display:grid;grid-template-columns:1fr 80px 110px;gap:8px">
            <div><label style="font-size:10px;font-weight:600;letter-spacing:1px;text-transform:uppercase;color:var(--gris-mid);display:block;margin-bottom:3px">Descripción</label>
              <input id="desc-et-${et.key}" type="text" placeholder="Detalle..." style="width:100%;padding:7px 9px;border:1.5px solid var(--gris-borde);border-radius:5px;font-size:12px" value="${ex?.descripcion||''}"></div>
            <div><label style="font-size:10px;font-weight:600;letter-spacing:1px;text-transform:uppercase;color:var(--gris-mid);display:block;margin-bottom:3px"># Piezas</label>
              <input id="piezas-et-${et.key}" type="number" min="0" placeholder="0" style="width:100%;padding:7px 9px;border:1.5px solid var(--gris-borde);border-radius:5px;font-size:12px" value="${ex?.num_piezas||''}"></div>
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
  if (document.getElementById('modal-agregar')?.classList.contains('show')) {
    actualizarDescripcionesAgregar();
  }
}

function actualizarDescripcionesAgregar() {
  const etapas = recogerChecklist('checklist-agregar');
  const srvActivos = [...new Set(etapas.map(e => e.servicio).filter(Boolean))];
  ['latoneria', 'pintura', 'mecanica', 'adicionales'].forEach(s => {
    const div = document.getElementById('agregar-desc-' + s);
    if (div) div.style.display = srvActivos.includes(s) ? 'grid' : 'none';
  });
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
      num_piezas:  piezasEl?.value ? parseInt(piezasEl.value) : null,
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
  const sinValor = etapas.filter(et => !et.valor || et.valor <= 0);
  if (sinValor.length) { toast(`Ingresa el valor de: ${sinValor.map(e => e.nombre).join(', ')}`, 'err'); return; }
  try {
    const descripciones = {
      latoneria: document.getElementById('desc-latoneria')?.value?.trim() || null,
      pintura: document.getElementById('desc-pintura')?.value?.trim() || null,
      mecanica: document.getElementById('desc-mecanica')?.value?.trim() || null,
      adicionales: document.getElementById('desc-adicionales')?.value?.trim() || null,
    };
    for (const et of etapas) {
      const mec = mecanicos.find(m => m.id === et.mecanico_id);
      await api('/etapas', 'POST', { 
        orden_id: modalOrdenId, servicio: et.servicio, etapa_key: et.key, etapa: et.nombre, 
        tercero: et.tercero || null, mecanico_id: et.mecanico_id || null, tecnico: mec?.nombre || null, 
        descripcion: et.descripcion || descripciones[et.servicio] || null,
        num_piezas: et.num_piezas || null,
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
            evento: 'etapa_finalizada', 
            orden: { id: ord.id, placa: ord.placa, propietario: ord.propietario, marca: ord.marca, linea: ord.linea, aseguradora: ord.aseguradora }, 
            etapa_finalizada: null, 
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
  const existentes = await api(`/etapas?orden_id=eq.${ordenActual.id}&order=creado_en.asc`).catch(() => []) || [];
  const todos = Object.keys(CATALOGO);
  buildChecklist('checklist-agregar', todos, existentes);
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
  const sinValor = etapas.filter(et => !et.valor || et.valor <= 0);
  if (sinValor.length) { toast(`Ingresa el valor de: ${sinValor.map(e => e.nombre).join(', ')}`, 'err'); return; }
  try {
    for (const et of etapas) {
      const mec = mecanicos.find(m => m.id === et.mecanico_id);
      await api('/etapas', 'POST', { 
        orden_id: ordenActual.id, servicio: et.servicio, etapa_key: et.key, etapa: et.nombre, 
        tercero: et.tercero || null, mecanico_id: et.mecanico_id || null, tecnico: mec?.nombre || null,
        descripcion: et.descripcion || null,
        num_piezas: et.num_piezas || null,
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
async function subirFotos(input, nombre, eid, k) {
  const files = Array.from(input.files);
  if (!files.length) return;
  const prog = document.getElementById(`prog-${k}`);
  let sub = 0;
  for (const file of files) {
    try {
      const ext = file.name.split('.').pop();
      const path = `${ordenActual.id}/etapas/${eid}_${Date.now()}.${ext}`;
      const url = await storageUpload(file, path);
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
    if (path) await fetch(`${SUPABASE_URL}/storage/v1/object/${BUCKET}/${path}`, { method: 'DELETE', headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } });
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
  try {
    await api('/novedades', 'POST', { 
      orden_id: ordenActual.id, etapa_id: eid, 
      tipo: document.getElementById(`ntype-${eid}`).value, 
      responsable: document.getElementById(`nresp-${eid}`).value, 
      motivo, desde: new Date().toISOString() 
    }, { Prefer: 'return=minimal' });
    toast('Novedad registrada ✓');
    const input = document.getElementById(`nmot-${eid}`);
    if (input) input.value = '';
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
        <div style="font-size:12px;color:var(--gris-mid)">Por: ${h.registrado_por}</div>
        ${h.observacion ? `<div style="font-size:12px;margin-top:4px">${h.observacion}</div>` : ''}
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
    if (ordenActual) abrirOrden(ordenActual.id);
  } catch(e) { toast('Error: ' + e.message, 'err'); }
}

// ============================================================
// PULMÓN
// ============================================================
async function togglePulmon() {
  const enPulmon = ordenActual.pulmon;
  const ahora = new Date().toISOString();
  const patch = enPulmon ? { pulmon: false, pulmon_desde: null } : { pulmon: true, pulmon_desde: ahora };
  try {
    await api(`/ordenes?id=eq.${ordenActual.id}`, 'PATCH', patch);
    ordenActual.pulmon = patch.pulmon;
    ordenActual.pulmon_desde = patch.pulmon_desde;
    const card = document.getElementById('pulmon-card');
    const badge = document.getElementById('d-pulmon-badge');
    const btn = document.getElementById('btn-pulmon');
    if (patch.pulmon) {
      if (card) card.classList.remove('inactivo');
      if (badge) {
        badge.textContent = `En pulmón desde ${formatFecha(ahora)}`;
        badge.style.color = 'var(--amarillo)';
      }
      if (btn) btn.textContent = 'Sacar de pulmón';
      toast('Orden en pulmón ✓');
    } else {
      if (card) card.classList.add('inactivo');
      if (badge) {
        badge.textContent = 'Sin pulmón activo';
        badge.style.color = 'var(--gris-mid)';
      }
      if (btn) btn.textContent = 'Activar Pulmón';
      toast('Pulmón desactivado ✓');
    }
  } catch(e) { toast('Error: ' + e.message, 'err'); }
}

// ============================================================
// COTIZACIÓN (subir PDF)
// ============================================================
async function subirCotizacion(input) {
  const file = input.files[0];
  if (!file) return;
  const prog = document.getElementById('prog-cotizacion');
  if (prog) prog.textContent = 'Subiendo...';
  try {
    const ext = file.name.split('.').pop();
    const path = `${ordenActual.id}/cotizacion/cotizacion_${Date.now()}.${ext}`;
    const url = await storageUpload(file, path);
    await api(`/ordenes?id=eq.${ordenActual.id}`, 'PATCH', { cotizacion_url: url });
    ordenActual.cotizacion_url = url;
    const linkDiv = document.getElementById('d-cotizacion-link');
    if (linkDiv) linkDiv.innerHTML = `<a href="${url}" target="_blank" style="color:var(--azul-mid);text-decoration:underline">Ver PDF de cotización →</a>`;
    if (prog) prog.textContent = '';
    input.value = '';
    toast('Cotización subida ✓');
    fetch(N8N_WEBHOOK, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        evento: 'cotizacion_subida', 
        orden: { id: ordenActual.id, placa: ordenActual.placa, propietario: ordenActual.propietario, marca: ordenActual.marca, linea: ordenActual.linea, aseguradora: ordenActual.aseguradora }, 
        cotizacion_url: url, 
        link: `${window.location.origin}${window.location.pathname}` 
      }) 
    }).catch(() => {});
  } catch(e) { 
    if (prog) prog.textContent = ''; 
    toast('Error subiendo PDF: ' + e.message, 'err'); 
  }
}

// ============================================================
// ESTADO ORDEN (JEFE)
// ============================================================
async function cambiarEstado(v) {
  try { 
    await api(`/ordenes?id=eq.${ordenActual.id}`, 'PATCH', { estado: v }); 
    ordenActual.estado = v; 
    toast(`Estado: ${v} ✓`); 
    cargarOrdenes(); 
    if (ordenActual) abrirOrden(ordenActual.id); 
  } catch(e) { toast('Error: ' + e.message, 'err'); }
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
    sidebarNav.innerHTML = `
      <button class="nav-item" id="nav-dashboard" onclick="navJefe('dashboard')">
        <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>
        Estado del taller
      </button>
      <button class="nav-item active" id="nav-ordenes" onclick="navJefe('ordenes')">
        <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/></svg>
        Todas las órdenes
      </button>
      <button class="nav-item" id="nav-nueva" onclick="navJefe('nueva')">
        <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 8v8M8 12h8"/></svg>
        Nueva orden
      </button>
      <button class="nav-item" id="nav-cotizaciones" onclick="navJefe('cotizaciones')">
        <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><path d="M14 2v6h6M16 13H8M16 17H8M10 9H8"/></svg>
        Cotizaciones
      </button>
      <button class="nav-item" id="nav-calendario" onclick="navJefe('calendario')">
        <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
        Calendario entregas
      </button>
      <button class="nav-item" id="nav-mecanicos" onclick="navJefe('mecanicos')">
        <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/></svg>
        Mecánicos
      </button>
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
        <span>Cotizaciones</span>
      </button>
    `;
  }

  // Cargar la lista de mecánicos para los selects
  cargarMecanicos().finally(() => {
    navJefe('ordenes');
  });
  
  // Cargar capacidad al inicio
  api('/ordenes?estado=eq.Activa&pulmon=eq.false&select=id,pulmon').then(data => {
    actualizarCapacidad((data || []).length);
  }).catch(() => {});
}

function navJefe(pag) {
  // Actualizar clases active en sidebar y bottom nav
  const pages = ['ordenes', 'nueva', 'dashboard', 'cotizaciones', 'calendario', 'mecanicos'];
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
      break;
    case 'dashboard':
      pagId = 'pag-dashboard';
      titulo = 'Estado del Taller';
      cargarDashboard();
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
    case 'mecanicos':
      pagId = 'pag-mecanicos';
      titulo = 'Mecánicos';
      cargarMecanicosVista();
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
      `/ordenes?select=id,placa,marca,linea,propietario,estado,pulmon,fecha_entrega_1,fecha_entrega_2&or=(estado.eq.Activa,pulmon.eq.true)&order=fecha_entrega_1.asc`
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

  // Indexar órdenes por fecha (fecha_entrega_1 o fecha_entrega_2)
  const porDia = {};
  ordenes.forEach(o => {
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
  const headHtml = diasSem.map(d => `<div class="cal-head">${d}</div>`).join('');

  let celdas = '';
  // Celdas vacías antes del primer día
  for (let i = 0; i < offset; i++) celdas += `<div class="cal-cell cal-empty"></div>`;

  for (let d = 1; d <= diasMes; d++) {
    const fecha  = new Date(año, mes, d);
    const esHoy  = fecha.getTime() === hoy.getTime();
    const ords   = porDia[d] || [];
    const pasado = fecha < hoy;

    const ordsHtml = ords.slice(0, 3).map(o => {
      const urgente = !o.esFecha2 && new Date(o.fecha_entrega_1) <= hoy;
      const color = urgente ? '#DC2626' : o.esFecha2 ? '#D97706' : '#2A5298';
      const bg    = urgente ? '#FEE2E2' : o.esFecha2 ? '#FEF3C7' : '#EBF2FF';
      return `<div class="cal-orden" style="background:${bg};color:${color}" onclick="abrirOrden(${o.id})" title="${o.placa} — ${o.propietario||''}">
        <span style="font-family:'DM Mono',monospace;font-weight:700;font-size:10px">${o.placa}</span>
        ${o.esFecha2 ? '<span style="font-size:9px;opacity:0.7"> F2</span>' : ''}
      </div>`;
    }).join('');
    const masHtml = ords.length > 3
      ? `<div style="font-size:9px;color:var(--gris-mid);text-align:center">+${ords.length-3} más</div>` : '';

    celdas += `<div class="cal-cell${esHoy?' cal-hoy':''}${pasado&&!esHoy?' cal-pasado':''}">
      <div class="cal-dia">${d}</div>
      ${ordsHtml}${masHtml}
    </div>`;
  }

  cont.innerHTML = `
    <div class="cal-nav">
      <button class="btn btn-ghost btn-sm" onclick="calCambiarMes(-1)">← Anterior</button>
      <div class="cal-mes-titulo">${mesLabel.charAt(0).toUpperCase() + mesLabel.slice(1)}</div>
      <button class="btn btn-ghost btn-sm" onclick="calCambiarMes(1)">Siguiente →</button>
    </div>
    <div class="cal-leyenda">
      <span class="cal-ley-dot" style="background:#EBF2FF;border:1px solid #2A5298"></span><span style="font-size:11px;color:var(--gris-mid)">Fecha 1</span>
      <span class="cal-ley-dot" style="background:#FEF3C7;border:1px solid #D97706;margin-left:12px"></span><span style="font-size:11px;color:var(--gris-mid)">Fecha 2</span>
      <span class="cal-ley-dot" style="background:#FEE2E2;border:1px solid #DC2626;margin-left:12px"></span><span style="font-size:11px;color:var(--gris-mid)">Vencida</span>
    </div>
    <div class="cal-grid">
      ${headHtml}
      ${celdas}
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
      `/ordenes?select=id,placa,marca,linea,propietario,estado,pulmon,fecha_entrega_1,fecha_entrega_2&or=(estado.eq.Activa,pulmon.eq.true)`
    ).catch(() => []) || [];
    renderCalendario(cont, ordenes, calMesActual);
  } catch(e) {
    cont.innerHTML = `<div class="empty-state">Error: ${e.message}</div>`;
  }
}

// ═══════════════════════════════════════════════════════════
// VISTA MECÁNICOS
// ═══════════════════════════════════════════════════════════
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
      ? await api(`/ordenes?id=in.(${ids.join(',')})&select=id,placa,marca,linea`).catch(() => []) || []
      : [];

    const srvColor = { latoneria:'#DC2626', pintura:'#D97706', mecanica:'#2563EB', adicionales:'#059669' };

    cont.innerHTML = `
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:14px">
        ${mecsData.map(m => {
          const etapas = etapasActivas.filter(e => e.mecanico_id === m.id);
          const etapsHtml = etapas.length
            ? etapas.map(e => {
                const ord = ordenes.find(o => o.id === e.orden_id);
                const color = srvColor[e.servicio] || '#6B7280';
                const mins  = e.inicio ? Math.round((new Date() - new Date(e.inicio)) / 60000) : 0;
                const dur   = mins < 60 ? `${mins}m` : mins < 1440 ? `${Math.floor(mins/60)}h ${mins%60}m` : `${Math.floor(mins/1440)}d`;
                return `<div style="display:flex;align-items:center;gap:8px;padding:8px 0;border-bottom:1px solid var(--gris-borde)">
                  <div style="width:3px;height:32px;background:${color};border-radius:99px;flex-shrink:0"></div>
                  <div style="flex:1;min-width:0">
                    <div style="font-size:12px;font-weight:600;color:var(--texto)">${e.etapa||'—'}</div>
                    <div style="font-size:11px;color:var(--gris-mid);font-family:'DM Mono',monospace">${ord?.placa||'—'} · ${[ord?.marca,ord?.linea].filter(Boolean).join(' ')||'—'}</div>
                  </div>
                  <div style="font-size:11px;color:var(--gris-mid);font-family:'DM Mono',monospace;flex-shrink:0">${dur}</div>
                </div>`;
              }).join('')
            : `<div style="font-size:12px;color:var(--gris-mid);padding:12px 0;text-align:center">Sin etapas activas</div>`;

          return `<div style="background:white;border:1.5px solid var(--gris-borde);border-radius:var(--radio);overflow:hidden">
            <div style="padding:14px 16px;border-bottom:1px solid var(--gris-borde);display:flex;align-items:center;gap:10px">
              <div style="width:36px;height:36px;border-radius:50%;background:var(--azul-light);display:flex;align-items:center;justify-content:center;font-weight:700;font-size:14px;color:var(--azul);flex-shrink:0">${m.nombre.charAt(0).toUpperCase()}</div>
              <div>
                <div style="font-weight:600;font-size:14px">${m.nombre}</div>
                <div style="font-size:11px;color:var(--gris-mid)">${m.rol||'Técnico'} · ${etapas.length} etapa${etapas.length!==1?'s':''} activa${etapas.length!==1?'s':''}</div>
              </div>
            </div>
            <div style="padding:0 16px 8px">${etapsHtml}</div>
          </div>`;
        }).join('')}
      </div>
    `;
  } catch(e) {
    cont.innerHTML = `<div class="empty-state">Error: ${e.message}</div>`;
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