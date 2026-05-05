// ═══════════════════════════════════════════════════════════
// COTIZACIONES
// ═══════════════════════════════════════════════════════════

async function cargarCotizaciones() {
  const lista = document.getElementById('cot-lista');
  if (!lista) return;
  lista.innerHTML = '<div class="loading-state">Cargando cotizaciones...</div>';
  try {
    const data = await api('/cotizaciones?order=created_at.desc&limit=100') || [];
    todasCotizaciones = data;
    renderCotizaciones(data);
  } catch(e) {
    lista.innerHTML = `<div class="empty-state">Error: ${e.message}</div>`;
  }
}

function filtrarCotizaciones() {
  const q = (document.getElementById('cot-buscar')?.value || '').toLowerCase().trim();
  const est = document.getElementById('cot-filtro-estado')?.value || '';
  const filt = todasCotizaciones.filter(c => {
    const matchQ = !q || [c.placa, c.nombre_cliente, c.codigo_cotizacion, c.cedula_cliente].some(f => (f || '').toLowerCase().includes(q));
    const matchEst = !est || (c.estado || 'pendiente') === est;
    return matchQ && matchEst;
  });
  renderCotizaciones(filt);
}

function renderCotizaciones(data) {
  const lista = document.getElementById('cot-lista');
  if (!lista) return;
  if (!data.length) {
    lista.innerHTML = '<div class="empty-state"><div class="empty-state-icon">📄</div><p>No hay cotizaciones.</p></div>';
    return;
  }
  const fmt = n => n != null ? new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(n) : '—';
  
  lista.innerHTML = data.map(c => {
    const estado = c.estado || 'pendiente';
    const badgeCls = `badge-cot-${estado}`;
    let badgeTxt = '';
    if (estado === 'pendiente') {
      badgeTxt = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 6v6l4 2"/><path d="M20 12v5"/><path d="M20 21h.01"/><path d="M21.25 8.2A10 10 0 1 0 16 21.16"/></svg> Pendiente`;
    } else if (estado === 'aprobada') {
      badgeTxt = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg> Aprobada`;
    } else {
      badgeTxt = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg> Rechazada`;
    }
    const tienOrden = c.orden_id != null;
    return `<div class="cot-card">
      <div class="cot-card-top">
        <div>
          <div class="cot-placa">${c.placa || '—'}</div>
          <div class="cot-codigo">${c.codigo_cotizacion || '—'}</div>
          <div class="cot-cliente">${c.nombre_cliente || '—'} · ${c.cedula_cliente || '—'}</div>
        </div>
        <span class="${badgeCls}">${badgeTxt}</span>
      </div>
      <div class="cot-card-mid">
        <div class="cot-chip"><strong>${c.fecha || formatFecha(c.created_at)}</strong></div>
        <div class="cot-chip">Tecnico: <strong>${c.tecnico || '—'}</strong></div>
        <div class="cot-chip"><strong>${[c.marca, c.modelo, c.año].filter(Boolean).join(' ') || '—'}</strong></div>
        <div class="cot-chip">Valor: <strong>${fmt(c.total_general)}</strong></div>
      </div>
      <div class="cot-card-bot">
        ${c.url_pdf ? `<a href="${c.url_pdf}" target="_blank" class="btn btn-outline btn-sm" style="font-size:12px">Ver PDF</a>` : ''}
        ${estado === 'pendiente' ? `
          <button class="btn btn-success btn-sm" onclick="aprobarCotizacion(${c.id})">Aprobar → Crear Orden</button>
          <button class="btn btn-danger btn-sm" onclick="rechazarCotizacion(${c.id})">Rechazar</button>
        ` : ''}
        ${estado === 'aprobada' && !tienOrden ? `
          <button class="btn btn-primary btn-sm" onclick="convertirEnOrden(${c.id})">+ Crear orden desde esta</button>
        ` : ''}
        ${tienOrden ? `<span style="font-size:12px;color:var(--verde);font-weight:600">✓ Orden creada</span>` : ''}
      </div>
    </div>`;
  }).join('');
}

async function aprobarCotizacion(id) {
  if (!confirm('¿Aprobar esta cotización y crear la orden de trabajo?')) return;
  try {
    await api(`/cotizaciones?id=eq.${id}`, 'PATCH', { estado: 'aprobada' });
    const cot = todasCotizaciones.find(c => c.id === id);
    if (cot) await crearOrdenDesdeCotizacion(cot);
    toast('Cotización aprobada y orden creada ✓');
    cargarCotizaciones();
  } catch(e) { toast('Error: ' + e.message, 'err'); }
}

async function rechazarCotizacion(id) {
  if (!confirm('¿Rechazar esta cotización?')) return;
  try {
    await api(`/cotizaciones?id=eq.${id}`, 'PATCH', { estado: 'rechazada' });
    toast('Cotización rechazada ✓');
    cargarCotizaciones();
  } catch(e) { toast('Error: ' + e.message, 'err'); }
}

async function convertirEnOrden(cotId) {
  const cot = todasCotizaciones.find(c => c.id === cotId);
  if (!cot) return;
  try {
    await crearOrdenDesdeCotizacion(cot);
    toast('Orden creada ✓');
    cargarCotizaciones();
  } catch(e) { toast('Error: ' + e.message, 'err'); }
}

async function crearOrdenDesdeCotizacion(cot) {
  let clienteId = null;
  if (cot.cedula_cliente) {
    const cl = await api(`/clientes?cedula_nit=eq.${cot.cedula_cliente}`).catch(() => []) || [];
    clienteId = cl[0]?.id || null;
  }
  let vehiculoId = null;
  if (cot.placa) {
    const vh = await api(`/vehiculos?placa=eq.${cot.placa}`).catch(() => []) || [];
    vehiculoId = vh[0]?.id || null;
  }
  const res = await api('/ordenes?select=id', 'POST', {
    placa: cot.placa,
    marca: cot.marca,
    modelo: cot.modelo,
    propietario: cot.nombre_cliente,
    cotizacion_url: cot.url_pdf,
    cotizacion_id: cot.id,
    cliente_id: clienteId,
    vehiculo_id: vehiculoId,
    estado: 'Activa'
  }, { Prefer: 'return=representation' });
  const ordenId = res[0].id;
  await api(`/cotizaciones?id=eq.${cot.id}`, 'PATCH', { orden_id: ordenId }).catch(() => {});
  return ordenId;
}