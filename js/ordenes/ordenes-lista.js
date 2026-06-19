// ═══════════════════════════════════════════════════════════
// ÓRDENES — LISTA
// ═══════════════════════════════════════════════════════════
// ═══════════════════════════════════════════════════════════
// ÓRDENES - LISTA, DETALLE, NUEVA ORDEN, ETAPAS
// ═══════════════════════════════════════════════════════════

// ============================================================
// LISTA DE ÓRDENES (JEFE)
// ============================================================
function setFiltro(estado, btn) {
  filtroEstado = estado;
  _busqOrdGlobalCache = null;
  const s = document.getElementById('ord-search'); if (s) s.value = '';
  document.querySelectorAll('.filtro-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  cargarOrdenes();
}

function setFiltroPulmon(btn) {
  filtroEstado = null;
  _busqOrdGlobalCache = null;
  const s = document.getElementById('ord-search'); if (s) s.value = '';
  document.querySelectorAll('.filtro-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  cargarOrdenesPulmon();
}

// Búsqueda GLOBAL del apartado Órdenes: busca en TODAS las órdenes (cualquier
// estado: activas, programadas, entregadas, en pulmón, archivadas), no solo la
// pestaña activa. Al borrar el texto, vuelve a la pestaña seleccionada.
let _busqOrdGlobalCache = null;
async function buscarOrdenesGlobal(q) {
  q = (q || '').trim().toLowerCase();
  const lista = document.getElementById('lista-ordenes');
  if (!q) {
    _busqOrdGlobalCache = null;
    if (typeof filtroEstado !== 'undefined' && filtroEstado === null) cargarOrdenesPulmon();
    else cargarOrdenes();
    return;
  }
  if (!_busqOrdGlobalCache) {
    if (lista) mostrarCargandoSiVacio(lista, '<div class="loading-state">Buscando en todas las órdenes...</div>');
    try {
      const data = await api('/ordenes?order=creado_en.desc&limit=600') || [];
      const ids = data.map(o => o.id).join(',');
      const etapas = ids ? (await api(`/etapas?orden_id=in.(${ids})&select=orden_id,servicio,inicio,fin,tecnico,tercero,valor_venta`).catch(() => []) || []) : [];
      _busqOrdGlobalCache = { data, etapas };
    } catch (e) {
      if (lista) lista.innerHTML = `<div class="empty-state">Error buscando: ${e.message}</div>`;
      return;
    }
  }
  // Si ya cambió el texto mientras cargaba, no pisar la vista.
  if (((document.getElementById('ord-search')?.value) || '').trim().toLowerCase() !== q) return;
  const { data, etapas } = _busqOrdGlobalCache;
  const filtradas = data.filter(o => {
    const ets = etapas.filter(e => e.orden_id === o.id);
    const tec = ets.map(e => (typeof nombreTec === 'function' ? nombreTec(e) : (e.tecnico || e.tercero || ''))).join(' ');
    const s = [(o.placa || ''), (o.propietario || ''), tec, (o.marca || ''), (o.linea || ''), (o.descripcion_general || ''), (o.aseguradora || ''), (typeof otDe === 'function' ? otDe(o) : '')].join(' ').toLowerCase();
    return s.includes(q);
  });
  renderTablaOrdenes(filtradas, etapas, { ubicacion: true });
  document.getElementById('ord-busq-nota')?.remove();
  if (lista) lista.insertAdjacentHTML('afterbegin', `<div id="ord-busq-nota" style="font-size:12px;color:var(--gris-mid);margin-bottom:8px">🔎 Resultados en <strong>todos los estados</strong> · ${filtradas.length} · cada uno muestra 📍 dónde está</div>`);
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
    const etapas = await api(`/etapas?orden_id=in.(${ids})&select=orden_id,servicio,inicio,fin,tecnico,tercero,valor_venta`).catch(() => []) || [];
    _ordenesTablaData = data;
    _etapasTablaData  = etapas;
    renderTablaOrdenes(data, etapas);
  } catch(e) { lista.innerHTML = `<div class="empty-state">Error cargando órdenes: ${e.message}</div>`; }
}

// Tipo de orden → color característico (para distinguir de un vistazo en la lista).
//  Aseguradora = violeta · Flotilla = cian · Empresa = ámbar · Particular = azul.
function _tipoOrdenInfo(o) {
  const t = (o?.tipo_cliente || '').toLowerCase();
  if (t === 'aseguradora') return { key: 'aseguradora', label: 'Aseguradora', color: '#7C3AED', bg: '#F5F3FF' };
  if (t === 'flotilla')    return { key: 'flotilla',    label: 'Flotilla',    color: '#0891B2', bg: '#ECFEFF' };
  if (t === 'empresa')     return { key: 'empresa',     label: 'Empresa',     color: '#D97706', bg: '#FFFBEB' };
  return { key: 'particular', label: 'Particular', color: '#2563EB', bg: '#EFF6FF' };
}
function _chipTipoOrden(o) {
  const ti = _tipoOrdenInfo(o);
  return `<span style="display:inline-block;font-size:10px;font-weight:800;letter-spacing:.02em;color:${ti.color};background:${ti.bg};border:1px solid ${ti.color}44;padding:2px 8px;border-radius:99px;white-space:nowrap">${ti.label}</span>`;
}

// Ubicación de una orden = en qué pestaña/sección del apartado Órdenes vive.
// Se muestra en los resultados de la búsqueda global para saber de un vistazo
// dónde está la orden (Activas, Programada, En pulmón, Entregada o Archivada).
function _ubicacionOrden(o) {
  if (o.pulmon)                  return { label: 'En pulmón',  color: '#92400E', bg: '#FEF3C7' };
  if (o.estado === 'Programada') return { label: 'Programada', color: '#6D28D9', bg: '#EDE9FE' };
  if (o.estado === 'Entregada')  return { label: 'Entregada',  color: '#0D7A4E', bg: '#E6F5EF' };
  if (o.estado === 'Archivada')  return { label: 'Archivada',  color: '#64748B', bg: '#F1F5F9' };
  return { label: 'Activas', color: '#1D4ED8', bg: '#DBEAFE' };
}
function _badgeUbicacion(o) {
  const u = _ubicacionOrden(o);
  return `<div style="margin-top:4px"><span style="display:inline-block;font-size:9.5px;font-weight:800;letter-spacing:.02em;color:${u.color};background:${u.bg};padding:2px 7px;border-radius:99px;white-space:nowrap">📍 ${u.label}</span></div>`;
}

function _buildOrdenRow(o, etapas, opts) {
  const comentario = o.descripcion_general || '';
  const etapasO  = etapas.filter(e => e.orden_id === o.id);
  // "Sin valor": la orden no tiene precio de venta (ni en etapas ni el total de
  // aseguradora). Solo aplica a órdenes reales (no programadas).
  const valorVenta = etapasO.reduce((s, e) => s + (e.valor_venta || 0), 0);
  // Subtotal de la orden (sin IVA): mano de obra + insumos + repuestos simples.
  const _valItems = (campo) => { try { const raw = o[campo]; const a = Array.isArray(raw) ? raw : (typeof raw === 'string' && raw ? JSON.parse(raw) : []); return a.reduce((s, i) => s + (((+i.cantidad) || 0) * ((+i.valor) || 0)), 0); } catch (e) { return 0; } };
  const subtotalOrden = valorVenta + _valItems('insumos') + _valItems('repuestos_simple');
  const _fmtCOProw = n => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(n || 0);
  const sinValor = o.estado !== 'Programada' && !valorVenta && !o.precio_venta_cliente;
  const total    = etapasO.length;
  const comp     = etapasO.filter(e => e.fin).length;
  const pct      = total ? Math.round((comp / total) * 100) : 0;
  const activa   = etapasO.find(e => e.inicio && !e.fin);
  const srvNombre = activa
    ? (CATALOGO[activa.servicio]?.nombre || activa.servicio)
    : (comp === total && total > 0 ? 'Completada' : null);
  const tecnico  = (typeof nombreTec === 'function') ? nombreTec(activa) : (activa?.tecnico || '');

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
  const searchStr = [(o.placa||''), (o.propietario||''), (tecnico||''), (o.marca||''), (o.linea||''), (comentario||'')].join(' ').toLowerCase();

  // Alerta de contacto / datos faltantes
  const camposFaltantes = [];
  if (!o.propietario)   camposFaltantes.push('nombre');
  if (!o.marca)         camposFaltantes.push('marca');
  if (!o.linea)         camposFaltantes.push('línea');
  if (!o.telefono)      camposFaltantes.push('teléfono');
  const contactAlert = camposFaltantes.length
    ? `<span class="ord-alert-contact" title="Faltan datos: ${camposFaltantes.join(', ')}">⚠</span>`
    : '';

  const ti = _tipoOrdenInfo(o);
  return `<tr class="ord-row" onclick="abrirOrden(${o.id})" data-oid="${o.id}" data-search="${escapeHtml(searchStr)}" style="background:${ti.color}12">
    <td style="text-align:center">
      <div class="ord-placa">${escapeHtml(o.placa)}</div>
      <div class="ord-ot">${otDe(o)}${contactAlert}</div>
      ${opts && opts.ubicacion ? _badgeUbicacion(o) : ''}
    </td>
    <td><div style="display:flex;flex-direction:column;gap:4px;align-items:flex-start">${_chipTipoOrden(o)}<button class="btn btn-ghost btn-xs" style="font-size:10px;padding:1px 6px;color:var(--azul)" title="Mover a una organización" onclick="event.stopPropagation();abrirMoverOrganizacion(${o.id})">🏢 Mover</button></div></td>
    <td>
      <div class="ord-veh-nombre">${[o.marca,o.linea].filter(Boolean).map(escapeHtml).join(' ') || '—'}</div>
      <div class="ord-veh-cliente">${escapeHtml(o.propietario || '—')}${o.modelo ? ` · ${escapeHtml(o.modelo)}` : ''}</div>
      ${comentario ? `<div class="ord-coment" title="${escapeHtml(comentario)}" style="font-size:11px;color:#2563EB;margin-top:3px;max-width:260px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">📝 ${escapeHtml(comentario)}</div>` : ''}
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
    <td class="ord-valor" style="text-align:right;white-space:nowrap">${sinValor
      ? `<span title="La orden no tiene precio de venta asignado" style="display:inline-block;font-size:9px;font-weight:800;letter-spacing:.03em;color:#B45309;background:#FEF3C7;border:1px solid #FDE68A;padding:1px 6px;border-radius:99px">SIN VALOR</span>`
      : (subtotalOrden ? `<span style="font-size:12.5px;font-weight:800;color:#047857;font-family:'DM Mono',monospace" title="Subtotal sin IVA: mano de obra + insumos + repuestos">${_fmtCOProw(subtotalOrden)}</span>` : '<span style="color:var(--gris-mid)">—</span>')}</td>
    <td><span class="ord-pill ${pillCls}">${pillTxt}</span>${o.estado === 'Archivada' ? `<button class="btn btn-ghost btn-xs" style="color:#DC2626;margin-left:6px;padding:2px 6px" onclick="event.stopPropagation();eliminarOrdenPermanente(${o.id})" title="Eliminar permanentemente">🗑️</button>` : ''}</td>
  </tr>`;
}

function renderTablaOrdenes(data, etapas, opts) {
  const lista = document.getElementById('lista-ordenes');
  if (!lista) return;
  if (!data.length) {
    lista.innerHTML = `<div class="empty-state"><div class="empty-state-icon">${ico('clipboard',32)}</div>No hay órdenes.</div>`;
    return;
  }
  const rows = data.map(o => _buildOrdenRow(o, etapas, opts)).join('');
  renderSinParpadeo(lista, `<div class="ordenes-tabla-wrap"><table class="ordenes-tabla">
    <thead><tr>
      <th>Orden</th><th>Tipo</th><th>Vehículo</th><th>Etapa actual</th>
      <th>Responsable</th><th>Entrega est.</th><th>Días</th><th style="text-align:right">Valor</th><th>Estado</th>
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
    const etapas = await api(`/etapas?orden_id=in.(${ids})&select=orden_id,servicio,inicio,fin,tecnico,tercero,valor_venta`).catch(() => []) || [];
    _ordenesTablaData = data;
    _etapasTablaData  = etapas;

    const rows = data.map(o => {
      const etapasO   = etapas.filter(e => e.orden_id === o.id);
      const total     = etapasO.length;
      const comp      = etapasO.filter(e => e.fin).length;
      const pct       = total ? Math.round((comp / total) * 100) : 0;
      const activa    = etapasO.find(e => e.inicio && !e.fin);
      const srvNombre = activa ? (CATALOGO[activa.servicio]?.nombre || activa.servicio) : (comp===total&&total>0?'Completada':null);
      const tecnico   = (typeof nombreTec === 'function') ? nombreTec(activa) : (activa?.tecnico || '');
      const diasPulmon = o.pulmon_desde ? Math.floor((Date.now() - new Date(o.pulmon_desde)) / 86400000) : null;
      const diasTaller = o.creado_en ? Math.floor((Date.now() - new Date(o.creado_en)) / 86400000) : 0;
      const comentario = o.descripcion_general || '';
      const searchStr  = [(o.placa||''), (o.propietario||''), (tecnico||''), (o.marca||''), (o.linea||''), (comentario||'')].join(' ').toLowerCase();
      const _valItemsP = (campo) => { try { const raw = o[campo]; const a = Array.isArray(raw) ? raw : (typeof raw === 'string' && raw ? JSON.parse(raw) : []); return a.reduce((s, i) => s + (((+i.cantidad) || 0) * ((+i.valor) || 0)), 0); } catch (e) { return 0; } };
      const subtotalP = etapasO.reduce((s, e) => s + (e.valor_venta || 0), 0) + _valItemsP('insumos') + _valItemsP('repuestos_simple');
      const _fmtP = n => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(n || 0);
      const ti = _tipoOrdenInfo(o);
      return `<tr class="ord-row" onclick="abrirOrden(${o.id})" data-search="${escapeHtml(searchStr)}" style="background:${ti.color}12">
        <td style="text-align:center">
          <div class="ord-placa">${escapeHtml(o.placa)}</div>
          <div class="ord-ot">${otDe(o)}</div>
        </td>
        <td><div style="display:flex;flex-direction:column;gap:4px;align-items:flex-start">${_chipTipoOrden(o)}<button class="btn btn-ghost btn-xs" style="font-size:10px;padding:1px 6px;color:var(--azul)" title="Mover a una organización" onclick="event.stopPropagation();abrirMoverOrganizacion(${o.id})">🏢 Mover</button></div></td>
        <td>
          <div class="ord-veh-nombre">${[o.marca,o.linea].filter(Boolean).map(escapeHtml).join(' ') || '—'}</div>
          <div class="ord-veh-cliente">${escapeHtml(o.propietario || '—')}${o.modelo ? ` · ${escapeHtml(o.modelo)}` : ''}</div>
          ${comentario ? `<div class="ord-coment" title="${escapeHtml(comentario)}" style="font-size:11px;color:#2563EB;margin-top:3px;max-width:260px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">📝 ${escapeHtml(comentario)}</div>` : ''}
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
        <td class="ord-valor" style="text-align:right;white-space:nowrap">${subtotalP ? `<span style="font-size:12.5px;font-weight:800;color:#047857;font-family:'DM Mono',monospace">${_fmtP(subtotalP)}</span>` : '<span style="color:var(--gris-mid)">—</span>'}</td>
        <td><span class="ord-pill pill-pulmon">En pulmón</span></td>
      </tr>`;
    }).join('');

    lista.innerHTML = `<div class="ordenes-tabla-wrap"><table class="ordenes-tabla">
      <thead><tr>
        <th>Orden</th><th>Tipo</th><th>Vehículo</th><th>Etapa actual</th>
        <th>Responsable</th><th>Tiempo pulmón</th><th>Días</th><th style="text-align:right">Valor</th><th>Estado</th>
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
  // "Volver" regresa a la página DESDE donde se abrió la orden (dashboard,
  // calendario, repuestos, aseguradoras, etc.), no siempre a Órdenes.
  // navJefe guarda en sessionStorage 'ultima_pag_jefe' la última página real
  // (excluye 'detalle' y 'nueva'), así que ahí está el origen.
  const prev = sessionStorage.getItem('ultima_pag_jefe') || 'ordenes';
  if (typeof navJefe === 'function' && (esJefe() || sesion?.permisos)) {
    navJefe(prev);
  } else {
    navJefe('ordenes');
  }
}

// ═══════════════════════════════════════════════════════════
// HISTORIAL DE ÓRDENES — todas las órdenes con buscador. Se puede abrir cada
// una y moverla a una organización (aseguradora / flotilla / empresa).
// ═══════════════════════════════════════════════════════════
let _historialData = [];

async function montarHistorialOrdenes() {
  const cont = document.getElementById('pag-historial');
  if (!cont) return;
  mostrarCargandoSiVacio(cont, '<div class="loading-state">Cargando historial...</div>');
  try {
    const data = await api('/ordenes?order=creado_en.desc&limit=1000&select=id,numero_ot,placa,marca,linea,modelo,propietario,tipo_cliente,aseguradora,estado,pulmon,creado_en,entregada_en').catch(() => []) || [];
    _historialData = data;
    cont.innerHTML = `<div style="padding:18px 20px">
      <div style="font-size:16px;font-weight:700;margin-bottom:12px">Historial de órdenes <span style="font-size:13px;color:var(--gris-mid);font-weight:500">(${data.length})</span></div>
      <input id="hist-buscar" type="text" oninput="_filtrarHistorial(this.value)" autocomplete="off" placeholder="🔎 Buscar por placa, cliente, organización, N° de orden..." style="width:100%;padding:9px 13px;border:1.5px solid var(--gris-borde);border-radius:8px;font-size:13px;outline:none;margin-bottom:12px;box-sizing:border-box">
      <div id="hist-tabs" style="display:flex;gap:7px;flex-wrap:wrap;margin-bottom:14px"></div>
      <div id="hist-lista"></div>
    </div>`;
    _renderHistTabs();
    _renderHistorial(_histFiltrarTipo(data));
  } catch (e) { cont.innerHTML = `<div class="empty-state">Error: ${e.message}</div>`; }
}

// Pestañas del historial por tipo de cliente. "Todas" + un tab por categoría,
// cada uno con su contador. Al cambiar de tab se re-renderiza la lista filtrada
// y se vuelve a aplicar el texto de búsqueda actual.
let _histTipoActual = 'todas';
function _renderHistTabs() {
  const cont = document.getElementById('hist-tabs'); if (!cont) return;
  const data = _historialData || [];
  const tipos = [
    { key: 'todas',       label: 'Todas',       color: '#334155' },
    { key: 'particular',  label: 'Particular',  color: '#2563EB' },
    { key: 'empresa',     label: 'Empresa',     color: '#D97706' },
    { key: 'flotilla',    label: 'Flotilla',    color: '#0891B2' },
    { key: 'aseguradora', label: 'Aseguradora', color: '#7C3AED' }
  ];
  const cuenta = k => k === 'todas' ? data.length : data.filter(o => _tipoOrdenInfo(o).key === k).length;
  cont.innerHTML = tipos.map(t => {
    const act = _histTipoActual === t.key;
    return `<button onclick="_setHistTipo('${t.key}')" style="display:inline-flex;align-items:center;gap:6px;font-size:12.5px;font-weight:700;padding:6px 13px;border-radius:99px;cursor:pointer;border:1.5px solid ${t.color}${act ? '' : '33'};background:${act ? t.color : '#fff'};color:${act ? '#fff' : t.color}">${t.label}<span style="font-size:11px;font-weight:800;opacity:.85">${cuenta(t.key)}</span></button>`;
  }).join('');
}
function _histFiltrarTipo(data) {
  if (_histTipoActual === 'todas') return data;
  return (data || []).filter(o => _tipoOrdenInfo(o).key === _histTipoActual);
}
function _setHistTipo(tipo) {
  _histTipoActual = tipo;
  _renderHistTabs();
  _renderHistorial(_histFiltrarTipo(_historialData || []));
  const q = document.getElementById('hist-buscar')?.value;
  if (q) _filtrarHistorial(q);
}

function _histEstadoPill(o) {
  if (o.pulmon) return '<span class="ord-pill pill-pulmon">En pulmón</span>';
  if (o.estado === 'Entregada') return '<span class="ord-pill pill-entregada">Entregada</span>';
  if (o.estado === 'Archivada') return '<span class="ord-pill" style="background:#F1F5F9;color:#64748B">Archivada</span>';
  if (o.estado === 'Programada') return '<span class="ord-pill pill-programada">Programada</span>';
  return '<span class="ord-pill pill-a-tiempo">Activa</span>';
}

function _renderHistorial(data) {
  const cont = document.getElementById('hist-lista');
  if (!cont) return;
  if (!data.length) { cont.innerHTML = '<div class="empty-state"><p>Sin órdenes.</p></div>'; return; }
  const rows = data.map(o => {
    const veh = [o.marca, o.linea, o.modelo].filter(Boolean).map(escapeHtml).join(' ');
    const org = o.aseguradora ? ` · ${escapeHtml(o.aseguradora)}` : '';
    const search = [(o.placa || ''), (o.propietario || ''), (o.aseguradora || ''), (o.marca || ''), (o.linea || ''), otDe(o)].join(' ').toLowerCase();
    return `<div data-hsearch="${escapeHtml(search)}" style="display:flex;align-items:center;gap:10px;padding:10px 14px;border:1px solid var(--gris-borde);border-radius:9px;margin-bottom:7px;background:var(--surface);cursor:pointer" onclick="abrirOrden(${o.id})">
      <div style="flex:1;min-width:0">
        <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
          <span style="font-family:'DM Mono',monospace;font-weight:800;font-size:14px">${escapeHtml(o.placa || '—')}</span>
          <span style="font-size:11px;font-family:'DM Mono',monospace;color:var(--gris-mid)">${otDe(o)}</span>
          ${_chipTipoOrden(o)}
        </div>
        <div style="font-size:12px;color:var(--gris-mid);margin-top:2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${veh || '—'}${o.propietario ? ` · ${escapeHtml(o.propietario)}` : ''}${org}</div>
        <div style="font-size:11px;color:var(--gris-mid);margin-top:1px">Ingreso ${formatFecha(o.creado_en)}${o.entregada_en ? ` · Entregada ${formatFecha(o.entregada_en)}` : ''}</div>
      </div>
      <div style="flex-shrink:0;display:flex;flex-direction:column;align-items:flex-end;gap:6px">
        ${_histEstadoPill(o)}
      </div>
    </div>`;
  }).join('');
  renderSinParpadeo(cont, rows);
}

function _filtrarHistorial(q) {
  q = (q || '').trim().toLowerCase();
  document.querySelectorAll('#hist-lista [data-hsearch]').forEach(el => {
    el.style.display = (!q || el.dataset.hsearch.includes(q)) ? '' : 'none';
  });
}

// ── Mover una orden a una organización (aseguradora / flotilla / empresa) ──
async function abrirMoverOrganizacion(ordenId) {
  let o = (typeof ordenActual !== 'undefined' && ordenActual && ordenActual.id === ordenId) ? ordenActual
        : (_historialData || []).find(x => x.id === ordenId)
        || (typeof _ordenesTablaData !== 'undefined' ? (_ordenesTablaData || []).find(x => x.id === ordenId) : null);
  if (!o) o = await api(`/ordenes?id=eq.${ordenId}&select=id,placa,tipo_cliente,aseguradora`).then(r => r && r[0]).catch(() => null);
  if (!o) { toast('Orden no encontrada', 'err'); return; }
  const [asegs, flots] = await Promise.all([
    api('/aseguradoras?activo=eq.true&order=nombre.asc').catch(() => []) || [],
    api('/flotillas?activo=eq.true&order=nombre.asc').catch(() => []) || []
  ]);
  window._movAsegs = asegs; window._movFlots = flots; window._movActual = o.aseguradora || '';
  const tipoActual = o.tipo_cliente || 'particular';
  document.getElementById('modal-mover-org')?.remove();
  const ov = document.createElement('div');
  ov.id = 'modal-mover-org';
  ov.style.cssText = 'position:fixed;inset:0;z-index:10001;background:rgba(0,0,0,.45);display:flex;align-items:center;justify-content:center;padding:18px';
  ov.innerHTML = `
    <div style="background:var(--surface);border-radius:14px;max-width:440px;width:100%;padding:20px;box-shadow:0 10px 40px rgba(0,0,0,.25);font-family:'DM Sans',sans-serif">
      <div style="font-size:16px;font-weight:800;color:var(--azul);margin-bottom:2px">Mover orden a organización</div>
      <div style="font-size:12px;color:var(--gris-mid);margin-bottom:14px">${escapeHtml(o.placa || '')}</div>
      <label style="font-size:11px;font-weight:700;color:var(--gris-mid);display:block;margin-bottom:4px">Tipo de cliente</label>
      <select id="mov-tipo" onchange="_movToggle()" style="width:100%;box-sizing:border-box;padding:9px 10px;border:1px solid var(--gris-borde);border-radius:7px;font-size:13px;margin-bottom:11px">
        <option value="particular" ${tipoActual === 'particular' || !tipoActual ? 'selected' : ''}>Particular (sin organización)</option>
        <option value="aseguradora" ${tipoActual === 'aseguradora' ? 'selected' : ''}>Aseguradora</option>
        <option value="flotilla" ${tipoActual === 'flotilla' ? 'selected' : ''}>Flotilla</option>
        <option value="empresa" ${tipoActual === 'empresa' ? 'selected' : ''}>Empresa</option>
      </select>
      <div id="mov-org-wrap" style="display:none">
        <label style="font-size:11px;font-weight:700;color:var(--gris-mid);display:block;margin-bottom:4px">Organización</label>
        <select id="mov-org" style="width:100%;box-sizing:border-box;padding:9px 10px;border:1px solid var(--gris-borde);border-radius:7px;font-size:13px"></select>
      </div>
      <div style="display:flex;gap:8px;margin-top:18px;justify-content:flex-end">
        <button class="btn btn-ghost btn-sm" onclick="document.getElementById('modal-mover-org').remove()">Cancelar</button>
        <button class="btn btn-primary btn-sm" onclick="_guardarMoverOrganizacion(${ordenId})">Guardar</button>
      </div>
    </div>`;
  ov.addEventListener('click', e => { if (e.target === ov) ov.remove(); });
  document.body.appendChild(ov);
  _movToggle();
}

function _movToggle() {
  const tipo = document.getElementById('mov-tipo')?.value;
  const wrap = document.getElementById('mov-org-wrap');
  const sel = document.getElementById('mov-org');
  if (!wrap || !sel) return;
  if (tipo === 'particular') { wrap.style.display = 'none'; return; }
  wrap.style.display = '';
  const list = tipo === 'aseguradora' ? (window._movAsegs || []) : (window._movFlots || []);
  sel.innerHTML = '<option value="">— Seleccionar —</option>' +
    list.map(x => `<option value="${escapeHtml(x.nombre)}" ${x.nombre === window._movActual ? 'selected' : ''}>${escapeHtml(x.nombre)}</option>`).join('');
}

async function _guardarMoverOrganizacion(ordenId) {
  const tipo = document.getElementById('mov-tipo')?.value || 'particular';
  const org = (tipo === 'particular') ? null : (document.getElementById('mov-org')?.value || null);
  if (tipo !== 'particular' && !org) { toast('Selecciona la organización', 'err'); return; }
  try {
    await api(`/ordenes?id=eq.${ordenId}`, 'PATCH', { tipo_cliente: tipo, aseguradora: org });
    if (typeof ordenActual !== 'undefined' && ordenActual && ordenActual.id === ordenId) { ordenActual.tipo_cliente = tipo; ordenActual.aseguradora = org; }
    document.getElementById('modal-mover-org')?.remove();
    toast('Orden movida ✓');
    if (document.getElementById('hist-lista')) montarHistorialOrdenes();
    else if (typeof filtroEstado !== 'undefined' && filtroEstado !== null && typeof cargarOrdenes === 'function') cargarOrdenes();
  } catch (e) { toast('Error: ' + e.message, 'err'); }
}
