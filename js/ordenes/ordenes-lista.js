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
    const etapas = await api(`/etapas?orden_id=in.(${ids})&select=orden_id,servicio,inicio,fin,tecnico,valor_venta`).catch(() => []) || [];
    _ordenesTablaData = data;
    _etapasTablaData  = etapas;
    renderTablaOrdenes(data, etapas);
  } catch(e) { lista.innerHTML = `<div class="empty-state">Error cargando órdenes: ${e.message}</div>`; }
}

function _buildOrdenRow(o, etapas) {
  const comentario = o.descripcion_general || '';
  const etapasO  = etapas.filter(e => e.orden_id === o.id);
  // "Sin valor": la orden no tiene precio de venta (ni en etapas ni el total de
  // aseguradora). Solo aplica a órdenes reales (no programadas).
  const valorVenta = etapasO.reduce((s, e) => s + (e.valor_venta || 0), 0);
  const sinValor = o.estado !== 'Programada' && !valorVenta && !o.precio_venta_cliente;
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

  return `<tr class="ord-row" onclick="abrirOrden(${o.id})" data-oid="${o.id}" data-search="${escapeHtml(searchStr)}">
    <td>
      <div class="ord-placa">${escapeHtml(o.placa)}</div>
      <div class="ord-ot">${otDe(o)}${contactAlert}</div>
      ${sinValor ? `<div style="margin-top:3px"><span title="La orden no tiene precio de venta asignado" style="display:inline-block;font-size:9px;font-weight:800;letter-spacing:.03em;color:#B45309;background:#FEF3C7;border:1px solid #FDE68A;padding:1px 6px;border-radius:99px">💲 SIN VALOR</span></div>` : ''}
    </td>
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
      const comentario = o.descripcion_general || '';
      const searchStr  = [(o.placa||''), (o.propietario||''), (tecnico||''), (o.marca||''), (o.linea||''), (comentario||'')].join(' ').toLowerCase();
      return `<tr class="ord-row" onclick="abrirOrden(${o.id})" data-search="${escapeHtml(searchStr)}">
        <td>
          <div class="ord-placa">${escapeHtml(o.placa)}</div>
          <div class="ord-ot">${otDe(o)}</div>
        </td>
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
