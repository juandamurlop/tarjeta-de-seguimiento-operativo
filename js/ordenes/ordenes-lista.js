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
  // Limpiar modo board anterior
  if (window._ordBoardRotInterval) { clearInterval(window._ordBoardRotInterval); window._ordBoardRotInterval = null; }
  lista.classList.remove('board-mode');
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
  // Chip sobrio (neutro): el color del tipo lo lleva la barra lateral de la fila.
  // Un punto pequeño del color da la pista visual sin saturar.
  return `<span style="display:inline-flex;align-items:center;gap:5px;font-size:10px;font-weight:700;letter-spacing:.02em;color:var(--gris-texto);background:var(--gris-bg);border:1px solid var(--gris-borde);padding:2px 9px;border-radius:99px;white-space:nowrap"><span style="width:6px;height:6px;border-radius:50%;background:${ti.color};flex-shrink:0"></span>${ti.label}</span>`;
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
  const subtotalEtapas = valorVenta + _valItems('insumos') + _valItems('repuestos_simple');
  // Si hay precio_venta_cliente (total manual para aseguradora u otro), ese manda.
  const subtotalOrden = (o.precio_venta_cliente > 0) ? o.precio_venta_cliente : subtotalEtapas;
  const _fmtCOProw = n => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(n || 0);
  const sinValor = o.estado !== 'Programada' && !subtotalEtapas && !o.precio_venta_cliente;
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
    const atrasada    = o.fecha_entrega_1 && new Date(o.fecha_entrega_1) < hoy;
    const todoListo   = (comp === total && total > 0) || !!o.entrega_avisada_en;
    if (todoListo) {
      pillCls = 'pill-listo';
      pillTxt = 'Listo p/entrega';
    } else if (atrasada) {
      pillCls = 'pill-atrasada';
      pillTxt = 'Atrasada';
    } else {
      pillCls = 'pill-a-tiempo';
      pillTxt = 'A tiempo';
    }
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
  return `<tr class="ord-row" onclick="abrirOrden(${o.id})" data-oid="${o.id}" data-search="${escapeHtml(searchStr)}" style="--tipo:${ti.color}">
    <td style="text-align:center">
      <div class="ord-placa">${escapeHtml(o.placa)}</div>
      <div class="ord-ot">${otDe(o)}${contactAlert}</div>
      ${(() => { const mismaPlaca = _ordenesTablaData.filter(x => x.placa === o.placa && x.id !== o.id); return mismaPlaca.length > 0 ? `<div style="font-size:9.5px;font-weight:700;color:#D97706;background:#FFFBEB;border:1px solid #FDE68A;padding:1px 6px;border-radius:99px;margin-top:2px">↩ Reingreso</div>` : ''; })()}
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
      const _subtotalPEtapas = etapasO.reduce((s, e) => s + (e.valor_venta || 0), 0) + _valItemsP('insumos') + _valItemsP('repuestos_simple');
      const subtotalP = (o.precio_venta_cliente > 0) ? o.precio_venta_cliente : _subtotalPEtapas;
      const _fmtP = n => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(n || 0);
      const ti = _tipoOrdenInfo(o);
      return `<tr class="ord-row" onclick="abrirOrden(${o.id})" data-search="${escapeHtml(searchStr)}" style="--tipo:${ti.color}">
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
    const data = await api('/ordenes?order=creado_en.desc&limit=1000&select=id,numero_ot,placa,marca,linea,modelo,propietario,tipo_cliente,aseguradora,estado,pulmon,creado_en,entregada_en,fecha_entrega_1,precio_venta_cliente').catch(() => []) || [];
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
    return `<button onclick="_setHistTipo('${t.key}')" style="display:inline-flex;align-items:center;gap:6px;font-size:12.5px;font-weight:700;padding:6px 13px;border-radius:99px;cursor:pointer;border:1.5px solid ${t.color}${act ? '' : '33'};background:${act ? t.color : 'var(--surface)'};color:${act ? '#fff' : t.color}">${t.label}<span style="font-size:11px;font-weight:800;opacity:.85">${cuenta(t.key)}</span></button>`;
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

  // Una fila de orden (tarjeta clicable).
  const filaHtml = o => {
    const veh = [o.marca, o.linea, o.modelo].filter(Boolean).map(escapeHtml).join(' ');
    const org = o.aseguradora ? ` · ${escapeHtml(o.aseguradora)}` : '';
    const search = [(o.placa || ''), (o.propietario || ''), (o.aseguradora || ''), (o.marca || ''), (o.linea || ''), otDe(o)].join(' ').toLowerCase();
    const _hFmt = n => '$' + new Intl.NumberFormat('es-CO', { maximumFractionDigits: 0 }).format(n);
    return `<div class="hover-lift" data-hsearch="${escapeHtml(search)}" style="display:flex;align-items:center;gap:10px;padding:10px 14px;border:1px solid var(--gris-borde);border-radius:9px;margin-bottom:7px;background:var(--surface);cursor:pointer" onclick="abrirOrden(${o.id})">
      <div style="flex:1;min-width:0">
        <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
          <span style="font-family:'DM Mono',monospace;font-weight:800;font-size:14px">${escapeHtml(o.placa || '—')}</span>
          <span style="font-size:11px;font-family:'DM Mono',monospace;color:var(--gris-mid)">${otDe(o)}</span>
          ${_chipTipoOrden(o)}
          ${o.precio_venta_cliente > 0
            ? `<span style="font-size:11px;font-weight:800;color:#047857;font-family:'DM Mono',monospace">${_hFmt(o.precio_venta_cliente)}</span>`
            : `<span style="font-size:9px;font-weight:800;letter-spacing:.03em;color:#B45309;background:#FEF3C7;border:1px solid #FDE68A;padding:1px 6px;border-radius:99px">SIN VALOR</span>`}
        </div>
        <div style="font-size:12px;color:var(--gris-mid);margin-top:2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${veh || '—'}${o.propietario ? ` · ${escapeHtml(o.propietario)}` : ''}${org}</div>
        <div style="font-size:11px;color:var(--gris-mid);margin-top:1px">
          📅 Ingreso: <strong>${formatFecha(o.creado_en)}</strong>
          ${o.fecha_entrega_1 ? ` · Entrega est.: <strong>${formatFecha(o.fecha_entrega_1)}</strong>` : ''}
          ${o.entregada_en ? ` · Cerrada: <strong style="color:#059669">${formatFecha(o.entregada_en)}</strong>${(() => { const d = Math.round((new Date(o.entregada_en) - new Date(o.creado_en)) / 86400000); return ` (${d}d)`; })()}` : ''}
        </div>
      </div>
      <div style="flex-shrink:0;display:flex;flex-direction:column;align-items:flex-end;gap:6px">
        ${_histEstadoPill(o)}
      </div>
    </div>`;
  };

  // Agrupar por mes/año del ingreso (creado_en), respetando el orden (desc).
  const grupos = [];
  const idx = {};
  data.forEach(o => {
    const d = o.creado_en ? new Date(o.creado_en) : null;
    const key = d ? `${d.getFullYear()}-${d.getMonth()}` : 'sin-fecha';
    const label = d ? d.toLocaleDateString('es-CO', { month: 'long', year: 'numeric' }) : 'Sin fecha';
    if (idx[key] == null) { idx[key] = grupos.length; grupos.push({ label, items: [] }); }
    grupos[idx[key]].items.push(o);
  });

  const html = grupos.map((g, i) => {
    const titulo = g.label.charAt(0).toUpperCase() + g.label.slice(1);
    return `<div class="hist-mes">
      <div class="hist-mes-head" style="display:flex;align-items:center;gap:10px;margin:${i === 0 ? '2px' : '18px'} 0 9px;font-size:11px;font-weight:700;letter-spacing:.8px;text-transform:uppercase;color:var(--gris-mid)">
        <span>${escapeHtml(titulo)}</span>
        <span style="flex:1;height:1px;background:var(--gris-borde)"></span>
        <span style="font-weight:800;color:var(--gris-texto)">${g.items.length}</span>
      </div>
      ${g.items.map(filaHtml).join('')}
    </div>`;
  }).join('');

  renderSinParpadeo(cont, html);
}

function _filtrarHistorial(q) {
  q = (q || '').trim().toLowerCase();
  document.querySelectorAll('#hist-lista [data-hsearch]').forEach(el => {
    el.style.display = (!q || el.dataset.hsearch.includes(q)) ? '' : 'none';
  });
  // Ocultar los encabezados de mes que se quedaron sin resultados visibles.
  document.querySelectorAll('#hist-lista .hist-mes').forEach(g => {
    const algunoVisible = [...g.querySelectorAll('[data-hsearch]')].some(el => el.style.display !== 'none');
    g.style.display = algunoVisible ? '' : 'none';
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

// ═══════════════════════════════════════════════════════════
// BOARD DE ÓRDENES POR COLUMNAS (vista Activas)
// ═══════════════════════════════════════════════════════════
const _BOARD_COLS = [
  { key: 'particular',  label: 'Particular',  acc: '#3B82F6', grad: '#3B82F6,#60A5FA' },
  { key: 'aseguradora', label: 'Aseguradora', acc: '#8B5CF6', grad: '#8B5CF6,#A78BFA' },
  { key: 'flotilla',    label: 'Flotilla',    acc: '#F59E0B', grad: '#F59E0B,#FCD34D' },
  { key: 'empresa',     label: 'Empresa',     acc: '#10B981', grad: '#10B981,#34D399' },
];

function _boardInjectCSS() {
  if (document.getElementById('ord-board-css')) return;
  const st = document.createElement('style');
  st.id = 'ord-board-css';
  st.textContent = `
    /* ── Contenedor principal ── */
    #lista-ordenes.board-mode { padding:0 !important; overflow:hidden; display:flex; flex-direction:column; flex:1; min-height:0; }
    .ord-board { display:flex; flex:1; min-height:0; overflow:hidden; background:var(--gris-bg); }
    /* ── Columnas ── */
    .ord-board-col { flex:1; display:flex; flex-direction:column; border-right:1px solid var(--gris-borde); min-width:0; overflow:hidden; background:var(--gris-bg); }
    .ord-board-col:last-child { border-right:none; }
    .ord-board-col-header { display:flex; align-items:center; justify-content:space-between; padding:7px 12px 6px; background:var(--surface); border-bottom:1px solid var(--gris-borde); flex-shrink:0; position:relative; }
    .ord-board-col-header::before { content:''; position:absolute; top:0; left:0; right:0; height:3px; background:var(--col-acc); }
    .ord-board-col-name { font-size:12px; font-weight:900; letter-spacing:.07em; text-transform:uppercase; color:var(--texto); }
    .ord-board-col-badge { font-size:12px; font-weight:800; border-radius:20px; padding:2px 10px; background:var(--col-acc); color:#fff; }
    .ord-board-list { flex:1; overflow:hidden; padding:4px 5px 6px; display:flex; flex-direction:column; gap:3px; }
    /* ── Card ultra-compacta ── */
    .ord-bc { background:var(--surface); border:1px solid var(--gris-borde); border-radius:7px; padding:5px 8px; cursor:pointer; flex-shrink:0; overflow:hidden; transition:background .15s,border-color .15s; box-sizing:border-box; }
    .ord-bc:hover { border-color:var(--gris-mid,#8A94A6); background:var(--surface-2); }
    .ord-bc.con-alertas { border-left:3px solid #D97706; padding-left:6px; }
    @keyframes obcSlide { from{opacity:0;transform:translateY(-12px) scale(.98)} to{opacity:1;transform:none} }
    .ord-bc.entering { animation:obcSlide .35s cubic-bezier(.34,1.3,.64,1) both; }
    @keyframes obcShake { 0%,100%{transform:none} 20%{transform:translateX(-5px)} 40%{transform:translateX(5px)} 60%{transform:translateX(-4px)} 80%{transform:translateX(4px)} }
    @keyframes obcGlow { 0%,100%{box-shadow:0 0 0 0 rgba(239,68,68,0)} 50%{box-shadow:0 0 0 5px rgba(239,68,68,.12)} }
    .ord-bc.novedad { background:#1C0F12 !important; border-color:rgba(239,68,68,.65) !important; animation:obcShake .5s ease,obcGlow 2s ease .5s infinite; }
    .ord-bc.novedad.entering { animation:obcSlide .35s cubic-bezier(.34,1.3,.64,1) both,obcGlow 2s ease .35s infinite; }
    /* fila 1: placa + pill */
    .ord-bc-top { display:flex; align-items:center; justify-content:space-between; gap:5px; line-height:1; }
    .ord-bc-placa { font-family:'DM Mono',monospace; font-size:17px; font-weight:900; letter-spacing:.08em; color:var(--texto); }
    .ord-bc-ot { display:none; }
    .ord-bc-pill { font-size:10px; font-weight:800; letter-spacing:.04em; text-transform:uppercase; border-radius:20px; padding:2px 8px; white-space:nowrap; flex-shrink:0; }
    .obc-act  { background:#1D4ED8; color:#BFDBFE; }
    .obc-list { background:#166534; color:#BBF7D0; }
    .obc-atr  { background:#991B1B; color:#FECACA; }
    .obc-paus { background:#78350F; color:#FDE68A; }
    .obc-prog { background:#5B21B6; color:#E9D5FF; }
    /* fila 2: propietario */
    .ord-bc-prop { font-size:13px; font-weight:800; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; color:var(--texto); line-height:1.3; margin-top:1px; }
    /* fila 3: vehículo */
    .ord-bc-veh  { font-size:11px; color:var(--gris-texto,#4A5568); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; line-height:1.3; }
    /* org (aseguradora/flotilla) */
    .ord-bc-org  { font-size:11px; font-weight:700; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
    /* novedad banner */
    .ord-bc-novbanner { display:flex; align-items:center; gap:4px; background:#7F1D1D; border-radius:4px; padding:2px 6px; margin-bottom:3px; font-size:10px; font-weight:800; color:#FECACA; overflow:hidden; }
    .ord-bc-novdot { width:6px; height:6px; border-radius:50%; background:#EF4444; flex-shrink:0; animation:obcDotP 1.1s ease infinite; }
    @keyframes obcDotP { 0%,100%{opacity:1} 50%{opacity:.2} }
    /* barra de progreso + pie: una sola fila */
    .ord-bc-prog { display:none; }
    .ord-bc-dots { display:none; }
    .ord-bc-foot { display:flex; align-items:center; justify-content:space-between; gap:5px; margin-top:2px; }
    .ord-bc-etxt { font-size:11px; color:var(--gris-mid,#8A94A6); font-weight:600; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
    .ord-bc-time { font-size:11px; color:var(--gris-mid,#8A94A6); font-weight:700; font-family:'DM Mono',monospace; flex-shrink:0; }
    /* barra de progreso integrada en el pie */
    .ord-bc-bar-inline { flex:1; height:3px; background:var(--gris-borde); border-radius:99px; overflow:hidden; }
    .ord-bc-fill-inline { height:100%; border-radius:99px; }
    /* Alertas - modo oscuro */
    .ord-bc-alertas { display:flex; flex-wrap:wrap; gap:3px; margin-top:3px; }
    .ord-bc-achip { display:inline-flex; align-items:center; gap:3px; font-size:10px; font-weight:800; border-radius:4px; padding:1px 6px; white-space:nowrap; line-height:1.5; }
    .ach-datos    { background:#3B1505; color:#FDBA74; border:1px solid rgba(251,146,60,.28); }
    .ach-vehiculo { background:#1E1047; color:#C4B5FD; border:1px solid rgba(167,139,250,.28); }
    .ach-asignar  { background:#0C2340; color:#7DD3FC; border:1px solid rgba(56,189,248,.28); }
    .ach-iniciar  { background:#111827; color:#9CA3AF; border:1px solid rgba(156,163,175,.22); }
    /* Alertas - modo claro */
    html:not([data-theme="dark"]) .ach-datos    { background:#FEF3C7; color:#92400E; border:1px solid rgba(217,119,6,.3); }
    html:not([data-theme="dark"]) .ach-vehiculo { background:#EDE9FE; color:#5B21B6; border:1px solid rgba(139,92,246,.3); }
    html:not([data-theme="dark"]) .ach-asignar  { background:#E0F2FE; color:#0369A1; border:1px solid rgba(14,165,233,.3); }
    html:not([data-theme="dark"]) .ach-iniciar  { background:#F1F5F9; color:#475569; border:1px solid rgba(100,116,139,.25); }
    html[data-theme="dark"] .ach-datos    { background:#3B1505; color:#FDBA74; border:1px solid rgba(251,146,60,.28); }
    html[data-theme="dark"] .ach-vehiculo { background:#1E1047; color:#C4B5FD; border:1px solid rgba(167,139,250,.28); }
    html[data-theme="dark"] .ach-asignar  { background:#0C2340; color:#7DD3FC; border:1px solid rgba(56,189,248,.28); }
    html[data-theme="dark"] .ach-iniciar  { background:#111827; color:#9CA3AF; border:1px solid rgba(156,163,175,.22); }
  `;
  document.head.appendChild(st);
}

const _WARN_SVG = `<svg width="9" height="9" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24" style="flex-shrink:0"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`;

function _boardAlertas(o, etapas) {
  const chips = [];
  // Datos personales faltantes
  const fP = [];
  if (!o.propietario)    fP.push('nombre');
  if (!o.cedula_cliente) fP.push('cédula');
  if (!o.telefono)       fP.push('teléfono');
  if (fP.length) chips.push({ cls: 'ach-datos', label: `Sin ${fP[0]}${fP.length > 1 ? ' +' + (fP.length - 1) : ''}` });
  // Vehículo incompleto
  if (!o.marca || !o.linea) chips.push({ cls: 'ach-vehiculo', label: 'Vehículo incompleto' });
  // Etapas
  const etO = etapas.filter(e => e.orden_id === o.id);
  if (etO.length === 0) {
    chips.push({ cls: 'ach-iniciar', label: 'Sin etapas' });
  } else {
    if (etO.every(e => !e.inicio)) chips.push({ cls: 'ach-iniciar', label: 'Sin iniciar' });
    if (etO.every(e => !e.tecnico && !e.tercero)) chips.push({ cls: 'ach-asignar', label: 'Sin operario' });
  }
  return chips;
}

function _boardMkCard(o, etapas, grad, entering) {
  const etO  = etapas.filter(e => e.orden_id === o.id);
  const total = etO.length;
  const comp  = etO.filter(e => e.fin).length;
  const pct   = total ? Math.round((comp / total) * 100) : 0;
  const activa = etO.find(e => e.inicio && !e.fin);
  const srvNom = activa
    ? (typeof CATALOGO !== 'undefined' && CATALOGO?.[activa.servicio]?.nombre || activa.servicio || '—')
    : (comp === total && total > 0 ? 'Completada' : (total === 0 ? 'Sin etapas' : '—'));
  const diasT = o.creado_en ? Math.floor((Date.now() - new Date(o.creado_en)) / 86400000) : 0;
  const _bcValEtapas = etO.reduce((s, e) => s + (e.valor_venta || 0), 0);
  const _bcVal = (o.precio_venta_cliente > 0) ? o.precio_venta_cliente : _bcValEtapas;
  const _bcFmt = n => '$' + new Intl.NumberFormat('es-CO', { maximumFractionDigits: 0 }).format(n);
  // Pill
  const hoy = new Date(); hoy.setHours(0,0,0,0);
  const atrasada = o.fecha_entrega_1 && new Date(o.fecha_entrega_1) < hoy;
  const listo    = (comp === total && total > 0) || !!o.entrega_avisada_en;
  let pillCls, pillTxt;
  if (o.estado === 'Programada')  { pillCls = 'obc-prog'; pillTxt = 'Programada'; }
  else if (listo)                  { pillCls = 'obc-list'; pillTxt = 'Listo ✓'; }
  else if (atrasada)               { pillCls = 'obc-atr';  pillTxt = 'Atrasada'; }
  else                             { pillCls = 'obc-act';  pillTxt = 'Activa'; }
  const fillC = listo ? '#16A34A,#4ADE80' : atrasada ? '#DC2626,#F87171' : grad;
  // Org
  const orgColor = o.tipo_cliente === 'aseguradora' ? '#C4B5FD'
                 : o.tipo_cliente === 'flotilla'    ? '#FDE68A' : '#6EE7B7';
  const orgHtml = o.aseguradora
    ? `<div class="ord-bc-org" style="color:${orgColor}">${escapeHtml(o.aseguradora)}</div>` : '';
  // Dots
  // Novedad banner
  const novHtml = o._novedad
    ? `<div class="ord-bc-novbanner"><div class="ord-bc-novdot"></div><span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escapeHtml(o._novedad)}</span></div>` : '';
  // Alertas
  const alertas = _boardAlertas(o, etapas);
  const tieneAlertas = alertas.length > 0;
  const alertasHtml = tieneAlertas
    ? `<div class="ord-bc-alertas">${alertas.map(a => `<span class="ord-bc-achip ${a.cls}">${_WARN_SVG}${a.label}</span>`).join('')}</div>` : '';

  const cls = ['ord-bc',
    tieneAlertas ? 'con-alertas' : '',
    o._novedad   ? 'novedad'     : '',
    entering     ? 'entering'    : ''
  ].filter(Boolean).join(' ');

  return `<div class="${cls}" onclick="abrirOrden(${o.id})">
    ${novHtml}
    <div class="ord-bc-top">
      <span class="ord-bc-placa">${escapeHtml(o.placa || '—')}</span>
      <span class="ord-bc-pill ${pillCls}">${pillTxt}</span>
    </div>
    <div class="ord-bc-prop">${escapeHtml(o.propietario || '—')}</div>
    <div class="ord-bc-veh">${escapeHtml([o.marca, o.linea].filter(Boolean).join(' ') || '—')}</div>
    ${orgHtml}
    <div class="ord-bc-foot">
      <span class="ord-bc-etxt">⚙ ${escapeHtml(srvNom)}</span>
      ${_bcVal ? `<span class="ord-bc-valor" style="font-size:10px;font-weight:800;color:#047857;font-family:'DM Mono',monospace">${_bcFmt(_bcVal)}</span>` : ''}
      <div class="ord-bc-bar-inline"><div class="ord-bc-fill-inline" style="width:${pct}%;background:linear-gradient(90deg,${fillC})"></div></div>
      <span class="ord-bc-time">${diasT}d</span>
    </div>
    ${alertasHtml}
  </div>`;
}

function _renderOrdenesBoard(data, etapas) {
  _boardInjectCSS();
  const lista = document.getElementById('lista-ordenes');
  if (!lista) return;
  lista.classList.add('board-mode');

  // Agrupar por tipo_cliente
  const grupos = {};
  _BOARD_COLS.forEach(c => { grupos[c.key] = []; });
  data.forEach(o => {
    const key = (o.tipo_cliente || 'particular').toLowerCase();
    (grupos[key] || grupos['particular']).push(o);
  });

  const colsActivas = _BOARD_COLS.filter(c => grupos[c.key]?.length > 0);
  if (!colsActivas.length) {
    lista.classList.remove('board-mode');
    lista.innerHTML = `<div class="empty-state"><div class="empty-state-icon">${ico('clipboard', 32)}</div>No hay órdenes activas.</div>`;
    return;
  }

  // Estado de rotación por columna
  const colState = {};

  const boardHtml = colsActivas.map(col => {
    const orders = grupos[col.key];
    // Órdenes con alertas primero, luego atrasadas
    orders.sort((a, b) => {
      const aA = _boardAlertas(a, etapas).length;
      const bA = _boardAlertas(b, etapas).length;
      if (aA && !bA) return -1; if (!aA && bA) return 1;
      const aAt = a.fecha_entrega_1 && new Date(a.fecha_entrega_1) < new Date() ? 1 : 0;
      const bAt = b.fecha_entrega_1 && new Date(b.fecha_entrega_1) < new Date() ? 1 : 0;
      return bAt - aAt;
    });
    colState[col.key] = { orders, idx: 0, grad: col.grad };
    const cardsHtml = orders.map(o => _boardMkCard(o, etapas, col.grad, false)).join('');
    return `<div class="ord-board-col" style="--col-acc:${col.acc}">
      <div class="ord-board-col-header">
        <span class="ord-board-col-name">${col.label}</span>
        <span class="ord-board-col-badge">${orders.length}</span>
      </div>
      <div class="ord-board-list" id="ordbc-${col.key}">${cardsHtml}</div>
    </div>`;
  }).join('');

  lista.innerHTML = `<div class="ord-board">${boardHtml}</div>`;

  // Rotación cada 5 s
  if (window._ordBoardRotInterval) clearInterval(window._ordBoardRotInterval);
  window._ordBoardRotInterval = setInterval(() => {
    colsActivas.forEach(col => {
      const st = colState[col.key];
      if (!st || st.orders.length <= 1) return;
      st.idx = (st.idx + 1) % st.orders.length;
      const listEl = document.getElementById(`ordbc-${col.key}`);
      if (!listEl) return;
      // Sacar el último con fade
      const cards = listEl.querySelectorAll('.ord-bc');
      if (cards.length) {
        const last = cards[cards.length - 1];
        last.style.transition = 'opacity .22s,transform .22s';
        last.style.opacity = '0';
        last.style.transform = 'translateY(8px)';
        setTimeout(() => last.remove(), 230);
      }
      // Insertar al tope
      setTimeout(() => {
        if (!document.getElementById(`ordbc-${col.key}`)) return;
        const wrap = document.createElement('div');
        wrap.innerHTML = _boardMkCard(st.orders[st.idx], etapas, col.grad, true);
        const nc = wrap.firstElementChild;
        listEl.insertBefore(nc, listEl.firstChild);
        setTimeout(() => nc.classList.remove('entering'), 450);
      }, 240);
    });
  }, 5000);
}
