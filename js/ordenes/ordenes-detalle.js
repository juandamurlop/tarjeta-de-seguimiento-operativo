// ═══════════════════════════════════════════════════════════
// ÓRDENES — DETALLE Y ETAPAS
// ═══════════════════════════════════════════════════════════

// El panel "Datos del vehículo y cliente" arranca COLAPSADO (la info que más se
// mira es Servicios/Etapas). Guardamos si el usuario lo abrió para no volver a
// cerrarlo en cada refresco del detalle (que se re-renderiza con el polling).
let _datosOrdenAbierto = false;
// El panel "Descripción y estado" también arranca colapsado (compacto). Se
// recuerda si el usuario lo abrió para no cerrarlo en cada refresco del polling.
let _comentOrdenAbierto = false;
function _toggleComentBar(ordenId) {
  _comentOrdenAbierto = !_comentOrdenAbierto;
  const body = document.getElementById('coment-bar-body-' + ordenId);
  const chev = document.getElementById('coment-bar-chev-' + ordenId);
  if (body) body.style.display = _comentOrdenAbierto ? '' : 'none';
  if (chev) chev.style.transform = `rotate(${_comentOrdenAbierto ? '90' : '0'}deg)`;
  // Oculta/muestra el preview de una línea del encabezado según el estado.
  const prev = document.getElementById('coment-bar-prev-' + ordenId);
  if (prev) prev.style.visibility = _comentOrdenAbierto ? 'hidden' : 'visible';
}
function _toggleDatosOrden() {
  _datosOrdenAbierto = !_datosOrdenAbierto;
  const body = document.getElementById('det-datos-body');
  const chev = document.getElementById('det-datos-chev');
  if (body) body.style.display = _datosOrdenAbierto ? '' : 'none';
  if (chev) chev.style.transform = `rotate(${_datosOrdenAbierto ? '90' : '0'}deg)`;
}

// "Estado de la orden" — minimizable; arranca CERRADO (como los demás paneles).
let _estadoOrdenAbierto = false;
function _toggleEstadoOrden() {
  _estadoOrdenAbierto = !_estadoOrdenAbierto;
  const body = document.getElementById('estado-orden-body');
  const chev = document.getElementById('estado-orden-chev');
  if (body) body.style.display = _estadoOrdenAbierto ? '' : 'none';
  if (chev) chev.style.transform = `rotate(${_estadoOrdenAbierto ? '90' : '0'}deg)`;
}

// "Valor total de la orden" — minimizable, CERRADO por defecto; el total se ve
// en el encabezado.
let _valorTotalAbierto = false;
function _toggleValorTotal() {
  _valorTotalAbierto = !_valorTotalAbierto;
  const body = document.getElementById('valor-total-body');
  const chev = document.getElementById('valor-total-chev');
  if (body) body.style.display = _valorTotalAbierto ? '' : 'none';
  if (chev) chev.style.transform = `rotate(${_valorTotalAbierto ? '90' : '0'}deg)`;
}

// "Servicios y etapas" también arranca colapsado; se recuerda el estado entre
// refrescos del polling.
let _serviciosAbierto = false;
function _toggleServiciosOrden() {
  _serviciosAbierto = !_serviciosAbierto;
  const body = document.getElementById('serv-body');
  const chev = document.getElementById('serv-chev');
  if (body) body.style.display = _serviciosAbierto ? '' : 'none';
  if (chev) chev.style.transform = `rotate(${_serviciosAbierto ? '90' : '0'}deg)`;
}

// Tarjetas laterales plegables (cerradas por defecto): Precio venta y Consumibles.
let _precioVentaAbierto = false;
function _togglePrecioVenta() {
  _precioVentaAbierto = !_precioVentaAbierto;
  const body = document.getElementById('precio-venta-body');
  const chev = document.getElementById('precio-venta-chev');
  if (body) body.style.display = _precioVentaAbierto ? '' : 'none';
  if (chev) chev.style.transform = `rotate(${_precioVentaAbierto ? '90' : '0'}deg)`;
}

let _consumiblesAbierto = false;
function _toggleConsumibles() {
  _consumiblesAbierto = !_consumiblesAbierto;
  const body = document.getElementById('consumibles-sidebar-body');
  const chev = document.getElementById('consumibles-chev');
  const head = document.getElementById('consumibles-sidebar-header');
  const pill = document.getElementById('consumibles-pill');
  if (body) body.style.display = _consumiblesAbierto ? '' : 'none';
  if (chev) chev.style.transform = `rotate(${_consumiblesAbierto ? '90' : '0'}deg)`;
  // Cerrado = header ámbar con pastilla de estado; abierto = header normal.
  if (head) { head.style.background = _consumiblesAbierto ? '' : '#FEF3C7'; head.style.color = _consumiblesAbierto ? '' : '#B45309'; }
  if (pill) pill.style.display = _consumiblesAbierto ? 'none' : '';
}

// Para órdenes de organización (aseguradora / flotilla / empresa) trae el
// registro de la organización (nombre, NIT, dirección, teléfono, correo) para
// mostrar SUS datos en la tarjeta del cliente. La persona pasa a ser "contacto".
// Devuelve null si es particular o si no se encuentra la organización.
async function _cargarOrgDeOrden(orden) {
  const tipo = (orden?.tipo_cliente || '').toLowerCase();
  const nombre = orden?.aseguradora;
  if (!nombre || !['aseguradora', 'flotilla', 'empresa'].includes(tipo)) return null;
  const enc = encodeURIComponent(nombre);
  try {
    if (tipo === 'aseguradora') {
      const r = await api(`/aseguradoras?nombre=eq.${enc}&limit=1`).catch(() => []);
      return (r && r[0]) || null;
    }
    // Flotilla y empresa comparten la tabla flotillas; fallback a /empresas.
    let r = await api(`/flotillas?nombre=eq.${enc}&limit=1`).catch(() => []);
    if (r && r[0]) return r[0];
    r = await api(`/empresas?nombre=eq.${enc}&limit=1`).catch(() => []);
    return (r && r[0]) || null;
  } catch (e) { return null; }
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
    const [orden, etapas, fotosEt, fotosIng, novedades, aprobaciones, solicitudesRep] = await Promise.all([
      api(`/ordenes?id=eq.${id}`).then(d => d[0]),
      api(`/etapas?orden_id=eq.${id}&order=creado_en.asc`).catch(() => []) || [],
      api(`/fotos_etapas?orden_id=eq.${id}&order=creado_en.desc`).catch(() => []) || [],
      api(`/fotos_ingreso?orden_id=eq.${id}&order=creado_en.asc`).catch(() => []) || [],
      api(`/novedades?orden_id=eq.${id}&order=creado_en.desc`).catch(() => []) || [],
      api(`/aprobaciones_etapa?orden_id=eq.${id}&order=creado_en.asc`).catch(() => []) || [],
      api(`/solicitudes_repuesto?orden_id=eq.${id}&order=creado_en.asc`).catch(() => []) || []
    ]);
    ordenActual = orden;

    // Datos de la organización (si la orden es de aseguradora/flotilla/empresa).
    const orgCliente = await _cargarOrgDeOrden(orden);

    // Ítems de cada solicitud de repuesto (para el panel de repuestos de la orden)
    const _repIds = solicitudesRep.map(s => s.id).filter(Boolean);
    const repItems = _repIds.length
      ? (await api(`/solicitud_items?solicitud_id=in.(${_repIds.join(',')})&order=creado_en.asc`).catch(() => []) || [])
      : [];

    // Valor de los REPUESTOS que entra al total de la orden: precio de venta que
    // fijó el jefe (precio_venta_jefe), solo de los que ya están aprobados Y
    // recibidos en el taller (recibido_taller) o entregados.
    let valorRepuestos = 0;
    if (_repIds.length) {
      const _cots = await api(`/cotizaciones_repuesto?solicitud_id=in.(${_repIds.join(',')})&precio_venta_jefe=not.is.null&select=solicitud_id,precio_venta_jefe`).catch(() => []) || [];
      const _ventaPorSol = {};
      _cots.forEach(c => { if (c.precio_venta_jefe != null) _ventaPorSol[c.solicitud_id] = (_ventaPorSol[c.solicitud_id] || 0) + Number(c.precio_venta_jefe); });
      valorRepuestos = solicitudesRep
        .filter(s => s.estado === 'recibido_taller' || s.estado === 'entregado')
        .reduce((sum, s) => sum + (_ventaPorSol[s.id] || 0), 0);
    }

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
    let _hayInv = false;
    try {
      const inv = orden.inventario ? JSON.parse(orden.inventario) : null;
      if (inv?.items) {
        const activos = Object.entries(inv.items).filter(([,v])=>v).map(([k])=>INV_LABELS[k]||k);
        _hayInv = activos.length > 0;
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

    // Etapas en ORDEN DE INSERCIÓN (no agrupadas por servicio): se respeta el
    // orden en que se agregaron.
    const hayActiva = etapas.some(x=>x.inicio&&!x.fin);
    const etapasOrden = [...etapas].sort((a,b) =>
      (new Date(a.creado_en||0) - new Date(b.creado_en||0)) || ((a.id||0) - (b.id||0)));

    const _srvNombres = { latoneria:'Latonería', pintura:'Pintura', mecanica:'Mecánica', adicionales:'Adicionales' };
    const _srvColor   = { latoneria:'#BC5A57', pintura:'#BE8A3D', mecanica:'#5A7CB3', adicionales:'#4F9079' };
    const _srvBg      = { latoneria:'#FEF2F2', pintura:'#FFFBEB', mecanica:'#EFF6FF', adicionales:'#ECFDF5' };
    const _fmtCOP = n => new Intl.NumberFormat('es-CO',{style:'currency',currency:'COP',minimumFractionDigits:0}).format(n||0);

    // Cuadritos de resumen por servicio (precio VENTA real)
    const _resumen = {};
    etapas.forEach(e => {
      const s = e.servicio || 'otros';
      if (!_resumen[s]) _resumen[s] = { n:0, total:0 };
      _resumen[s].n++;
      _resumen[s].total += (e.valor_venta || 0);
    });
    // Siempre 3 recuadros en horizontal: los servicios presentes ocupan su
    // espacio y, si hay menos de 3, se rellena con recuadros vacíos para que
    // la fila respete siempre las 3 columnas (placeholder gris punteado).
    const _entriesResumen = Object.entries(_resumen);
    const boxesHtml = _entriesResumen.length
      ? (() => {
          const cajas = _entriesResumen.map(([s,r]) =>
            '<div style="background:' + (_srvBg[s]||'#F1F5F9') + ';border:1px solid ' + (_srvColor[s]||'#CBD5E1') + '55;border-radius:8px;padding:7px 10px">' +
              '<div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.04em;color:' + (_srvColor[s]||'#475569') + '">' + (_srvNombres[s]||s) + ' · ' + r.n + '</div>' +
              '<div style="font-size:14px;font-weight:800;color:var(--texto);font-family:\'DM Mono\',monospace">' + _fmtCOP(r.total) + '</div>' +
            '</div>');
          // Rellenar hasta completar la última fila de 3
          const faltan = (3 - (cajas.length % 3)) % 3;
          for (let k = 0; k < faltan; k++) {
            cajas.push('<div style="border:1px dashed #D7DCE5;border-radius:8px;background:#FAFBFC"></div>');
          }
          return '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:12px">' + cajas.join('') + '</div>';
        })()
      : '';

    const serviciosHtml = etapasOrden.length
      ? boxesHtml + '<div id="etapas-lista">' +
        etapasOrden.map(e => {
          const s = e.servicio || 'otros';
          const lbl = '<div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.04em;color:' + (_srvColor[s]||'#475569') + ';margin:0 0 4px 2px">' + (_srvNombres[s]||s) + '</div>';
          return '<div style="margin-bottom:12px">' + lbl + renderEtapa(e, fotosEt, novedades, hayActiva, aprobaciones) + '</div>';
        }).join('') + '</div>'
      : '<div class="empty-state">' +
          `<div class="empty-state-icon">${ico('wrench', 32)}</div>` +
          '<p>No hay etapas registradas aún.</p>' +
          '<button class="btn btn-primary" style="margin-top:14px" onclick="abrirModalAgregar()">+ Asignar servicios y etapas</button>' +
        '</div>';


    detalleCont.innerHTML = `
      <div class="detalle-grid">
        <div>
          ${typeof _panelComentariosOrden === 'function' ? _panelComentariosOrden(orden, novedades, etapas) : ''}
          <div class="detalle-header-card">
            <!-- Fila placa + badges -->
            <div class="detalle-placa-row">
              <div style="min-width:0;flex:1">
                <div style="display:flex;align-items:baseline;gap:8px;flex-wrap:wrap">
                  <div class="detalle-placa">${escapeHtml(orden.placa)}</div>
                  <div style="font-family:'DM Mono',monospace;font-size:12px;font-weight:600;color:var(--gris-mid);letter-spacing:.5px">${otDe(orden)}</div>
                </div>
                <div style="display:flex;align-items:center;gap:6px;margin-top:5px;min-width:0">
                  <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" style="flex-shrink:0;color:var(--gris-mid)"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                  <span style="font-size:14px;font-weight:600;color:#334155;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${orden.propietario ? escapeHtml(orden.propietario) : '<span style="color:var(--gris-mid)">Sin nombre de cliente</span>'}</span>
                </div>
                <div class="detalle-vehiculo" style="margin-top:3px">${[orden.marca,orden.linea,orden.modelo,orden.color].filter(Boolean).map(escapeHtml).join(' · ') || '—'}</div>
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
          <div class="det-sec-box" style="border:1px solid #9FE1CB;border-radius:10px;overflow:hidden;margin-bottom:12px">
            <div class="det-sec-bar" onclick="_toggleDatosOrden()" style="display:flex;align-items:center;gap:8px;padding:9px 12px;background:#E1F5EE;cursor:pointer;user-select:none">
              <svg id="det-datos-chev" width="15" height="15" fill="none" stroke="#0F6E56" stroke-width="2.5" viewBox="0 0 24 24" style="flex-shrink:0;transition:transform .18s ease;transform:rotate(${_datosOrdenAbierto?'90':'0'}deg)"><polyline points="9 18 15 12 9 6"/></svg>
              <svg width="16" height="16" fill="none" stroke="#0F6E56" stroke-width="2" viewBox="0 0 24 24" style="flex-shrink:0"><rect x="1" y="3" width="15" height="13" rx="2"/><path d="M16 8h4l3 3v5h-7V8z"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>
              <div class="seccion-titulo" style="margin-bottom:0;color:#085041">Datos del vehículo y cliente</div>
              <span style="margin-left:auto;font-size:12px;color:#0F6E56;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escapeHtml([(['aseguradora','flotilla','empresa'].includes((orden.tipo_cliente||'').toLowerCase()) && orden.aseguradora) ? orden.aseguradora : orden.propietario, [orden.marca,orden.linea].filter(Boolean).join(' ')].filter(Boolean).join(' · ')) || '—'}</span>
            </div>
            <div id="det-datos-body" style="${_datosOrdenAbierto?'':'display:none;'}padding:12px">
              <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:10px">
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
          <div class="det-datos-grid" id="det-datos-grid">
            <!-- Vehículo -->
            <div class="det-datos-card" style="border-left:3px solid #2563EB">
              <div class="det-datos-card-titulo" style="color:#2563EB">
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
            <!-- Cliente / Organización -->
            ${(() => {
              const tipo = (orden.tipo_cliente || '').toLowerCase();
              const esOrg = ['aseguradora','flotilla','empresa'].includes(tipo) && orden.aseguradora;
              const fila = (lbl, valHtml) => `<div class="det-dato-fila"><span class="det-dato-lbl">${lbl}</span><span class="det-dato-val${valHtml?'':' det-dato-vacio'}">${valHtml||'—'}</span></div>`;
              const tel  = v => v ? `<a href="tel:${escapeHtml(v)}" style="color:var(--azul-mid)">${escapeHtml(v)}</a>` : '';
              const mail = v => v ? `<a href="mailto:${escapeHtml(v)}" style="color:var(--azul-mid)">${escapeHtml(v)}</a>` : '';
              const mono = v => v ? `<span style="font-family:'DM Mono',monospace;font-size:12px">${escapeHtml(v)}</span>` : '';
              const txt  = v => v ? escapeHtml(v) : '';
              if (esOrg) {
                const titulo = tipo === 'flotilla' ? 'Flotilla' : tipo === 'empresa' ? 'Empresa' : 'Aseguradora';
                const o = orgCliente || {};
                return `<div class="det-datos-card" style="border-left:3px solid #7C3AED">
                <div class="det-datos-card-titulo" style="color:#7C3AED">
                  <svg width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M3 21h18M6 21V8l6-4 6 4v13M10 9h0M14 9h0M10 13h0M14 13h0"/></svg>
                  ${titulo}
                </div>
                <div class="det-datos-filas">
                  ${fila('Nombre', txt(orden.aseguradora))}
                  ${fila('NIT', mono(o.nit))}
                  ${fila('Dirección', txt(o.direccion))}
                  ${fila('Teléfono', tel(o.telefono))}
                  ${fila('Correo', mail(o.correo))}
                  <div class="det-dato-fila" style="border-top:1px dashed var(--gris-borde);margin-top:3px;padding-top:7px"><span class="det-dato-lbl">👤 Contacto</span><span class="det-dato-val${orden.propietario?'':' det-dato-vacio'}">${txt(orden.propietario) || '—'}</span></div>
                  ${fila('Tel. contacto', tel(orden.telefono))}
                  ${fila('Cédula / NIT', mono(orden.cedula_cliente))}
                </div>
              </div>`;
              }
              return `<div class="det-datos-card" style="border-left:3px solid #059669">
                <div class="det-datos-card-titulo" style="color:#059669">
                  <svg width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                  Cliente
                </div>
                <div class="det-datos-filas">
                  ${fila('Nombre', txt(orden.propietario))}
                  ${fila('Teléfono', tel(orden.telefono))}
                  ${fila('Correo', mail(orden.correo_cliente))}
                  ${fila('Cédula / NIT', mono(orden.cedula_cliente))}
                  ${fila('Dirección', txt(orden.direccion))}
                  ${fila('Tipo cliente', txt(orden.tipo_cliente))}
                </div>
              </div>`;
            })()}
          </div>
            </div>
          </div>
          <div class="det-sec-box" style="border:1px solid #DDD6FE;border-radius:10px;overflow:hidden;margin-bottom:12px">
            <div class="det-sec-bar" onclick="_toggleServiciosOrden()" style="display:flex;align-items:center;gap:8px;padding:9px 12px;background:#EEEDFE;cursor:pointer;user-select:none">
              <svg id="serv-chev" width="15" height="15" fill="none" stroke="#534AB7" stroke-width="2.5" viewBox="0 0 24 24" style="flex-shrink:0;transition:transform .18s ease;transform:rotate(${_serviciosAbierto?'90':'0'}deg)"><polyline points="9 18 15 12 9 6"/></svg>
              <svg width="16" height="16" fill="none" stroke="#534AB7" stroke-width="2" viewBox="0 0 24 24" style="flex-shrink:0"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>
              <div class="seccion-titulo" style="margin-bottom:0;color:#3C3489">Servicios y etapas</div>
              <span style="margin-left:auto;font-size:12px;color:#534AB7;white-space:nowrap">${total === 0 ? 'Sin etapas' : (comp === 0 ? `0 / ${total} · sin iniciar` : `${comp} / ${total} etapas`)}</span>
              ${esJefe() && orden.estado !== 'Programada' && orden.estado !== 'Entregada' && orden.estado !== 'Archivada' ? `<button class="btn btn-ghost btn-sm" style="flex-shrink:0;color:#4338CA;padding:3px 8px" onclick="event.stopPropagation();abrirModalAgregar()">+ Agregar</button>` : ''}
            </div>
            <div id="serv-body" style="${_serviciosAbierto?'':'display:none;'}padding:12px">
              ${orden.estado === 'Programada'
                ? `<div style="display:flex;flex-direction:column;align-items:center;gap:10px;padding:24px 20px;background:var(--surface-2);border:1.5px dashed var(--gris-borde);border-radius:10px;text-align:center">
                     <svg width="32" height="32" fill="none" stroke="#94A3B8" stroke-width="1.5" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/><circle cx="12" cy="16" r="1"/></svg>
                     <div style="font-size:13px;font-weight:600;color:#64748B">Vehículo aún no ha ingresado</div>
                     <div style="font-size:12px;color:#94A3B8">Las etapas de trabajo estarán disponibles cuando el vehículo llegue al taller y el jefe confirme su ingreso.</div>
                   </div>`
                : serviciosHtml}
            </div>
          </div>
            ${/* [Oculto] Panel "Repuestos de la orden" (flujo con proveedores) — retirado de la UI por pedido; el código se conserva. */ ''}
        </div>
        <div class="detalle-sidebar">
          ${(!(orden.numero_ot && String(orden.numero_ot).trim()) && orden.estado !== 'Programada') ? `
          <div style="background:#FEF3C7;border:1px solid #FDE68A;border-radius:9px;padding:8px 10px;margin-bottom:10px">
            <div style="display:flex;align-items:center;gap:5px;font-size:11px;font-weight:700;color:#92400E;margin-bottom:6px">
              <svg width="13" height="13" fill="none" stroke="#92400E" stroke-width="2.4" viewBox="0 0 24 24" style="flex-shrink:0"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
              Falta el N° de orden
            </div>
            <div style="display:flex;gap:5px">
              <input id="ot-num-${orden.id}" placeholder="N° de orden" autocomplete="off" style="flex:1;min-width:0;padding:6px 8px;border:1.5px solid #FCD34D;border-radius:6px;font-size:12.5px;font-family:'DM Mono',monospace" onkeydown="if(event.key==='Enter')_guardarNumeroOT(${orden.id})">
              <button class="btn btn-sm" style="flex-shrink:0;background:#D97706;color:#fff;border-color:#D97706;padding:6px 10px" onclick="_guardarNumeroOT(${orden.id})">Guardar</button>
            </div>
          </div>` : ''}
          ${(() => {
            const fmt = n => new Intl.NumberFormat('es-CO',{style:'currency',currency:'COP',minimumFractionDigits:0}).format(n||0);
            const manoObra = etapas.reduce((s,e) => s + (e.valor_venta||0), 0);
            let insumos = [];
            try { const raw = orden.insumos; insumos = Array.isArray(raw) ? raw : (typeof raw === 'string' && raw ? JSON.parse(raw) : []); } catch(e) { insumos = []; }
            const valorInsumos = insumos.reduce((s,i) => s + (((+i.cantidad)||0) * ((+i.valor)||0)), 0);
            let repSimple = [];
            try { const raw = orden.repuestos_simple; repSimple = Array.isArray(raw) ? raw : (typeof raw === 'string' && raw ? JSON.parse(raw) : []); } catch(e) { repSimple = []; }
            const valorRepSimple = repSimple.reduce((s,i) => s + (((+i.cantidad)||0) * ((+i.valor)||0)), 0);
            const subtotal = manoObra + valorRepuestos + valorInsumos + valorRepSimple;
            const iva = subtotal ? Math.round(subtotal * 0.19) : 0;
            const total = subtotal + iva;
            // Cuerpo del detalle (solo se ve al desplegar). Letras grandes y oscuras.
            let cuerpo;
            if (!subtotal) {
              cuerpo = '<div style="font-size:14px;color:var(--texto)">Sin precio de venta aún.</div>';
            } else {
              const sub = (txt,col) => '<div style="font-size:12px;font-weight:800;text-transform:uppercase;letter-spacing:.04em;color:'+col+';margin:10px 0 3px">' + txt + '</div>';
              const fila = (lbl,val) => '<div style="display:flex;justify-content:space-between;gap:8px;font-size:14.5px;padding:5px 0;border-bottom:1px solid var(--gris-borde)"><span style="color:var(--texto);min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + lbl + '</span><span style="font-weight:700;color:var(--texto);flex-shrink:0">' + fmt(val) + '</span></div>';
              const filasMO = etapas.filter(e=>e.valor_venta).map(e => fila(escapeHtml(e.etapa||''), e.valor_venta)).join('');
              const bloqueMO = filasMO ? sub('🔧 Mano de obra','#1D4ED8') + filasMO : '';
              const bloqueRep = (valorRepuestos || repSimple.length)
                ? sub('🧰 Repuestos','#0F766E')
                  + (valorRepuestos ? fila('Repuestos recibidos', valorRepuestos) : '')
                  + repSimple.map(i => { const cant=(+i.cantidad)||0, val=(+i.valor)||0; return fila(escapeHtml(i.nombre||'Repuesto') + (cant && cant !== 1 ? ' ×'+cant : ''), cant*val); }).join('')
                : '';
              const bloqueIns = insumos.length
                ? sub('🛢 Insumos','#B45309') + insumos.map(i => {
                    const cant = (+i.cantidad)||0, val = (+i.valor)||0;
                    return fila(escapeHtml(i.nombre||'Insumo') + (cant && cant !== 1 ? ' ×'+cant : ''), cant*val);
                  }).join('')
                : '';
              cuerpo = bloqueMO + bloqueRep + bloqueIns +
                '<div style="display:flex;justify-content:space-between;font-size:14.5px;padding:7px 0 2px"><span style="color:var(--texto)">Subtotal</span><span style="font-weight:700;color:var(--texto)">' + fmt(subtotal) + '</span></div>' +
                '<div style="display:flex;justify-content:space-between;font-size:14.5px;padding:2px 0"><span style="color:var(--texto)">IVA (19%)</span><span style="font-weight:700;color:var(--texto)">' + fmt(iva) + '</span></div>' +
                '<div style="display:flex;justify-content:space-between;margin-top:6px;padding-top:8px;border-top:2px solid var(--azul-mid)"><span style="font-size:15px;font-weight:800;color:var(--azul)">Total con IVA</span><span style="font-size:17px;font-weight:800;color:var(--azul)">' + fmt(total) + '</span></div>';
            }
            const pill = subtotal
              ? `<span style="flex-shrink:0;font-size:14px;font-weight:800;color:var(--azul);background:var(--surface);border:1px solid var(--azul-mid);border-radius:99px;padding:2px 11px;white-space:nowrap">${fmt(total)}</span>`
              : `<span style="flex-shrink:0;font-size:11px;font-weight:700;color:#B45309;background:#FEF3C7;border-radius:99px;padding:2px 9px;white-space:nowrap">Sin valor</span>`;
            return `
          <div class="sidebar-card">
            <div onclick="_toggleValorTotal()" class="sidebar-card-header" style="background:var(--azul-light);color:var(--azul);display:flex;align-items:center;gap:8px;cursor:pointer;user-select:none">
              <svg id="valor-total-chev" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24" style="flex-shrink:0;transition:transform .18s ease;transform:rotate(${_valorTotalAbierto?'90':'0'}deg)"><polyline points="9 18 15 12 9 6"/></svg>
              <span style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:14px">Valor total de la orden</span>
              ${pill}
            </div>
            <div id="valor-total-body" class="sidebar-card-body" style="${_valorTotalAbierto?'':'display:none'}">
              ${esJefe() ? `<div style="text-align:right;margin-bottom:6px"><button class="btn btn-ghost btn-xs" style="color:var(--azul)" onclick="abrirEditorValor(${orden.id})">✏️ Editar</button></div>` : ''}
              ${cuerpo}
            </div>
          </div>`;
          })()}
          ${typeof _panelItemsOrden === 'function' ? _panelItemsOrden(orden, 'insumos') + _panelItemsOrden(orden, 'repuestos') : ''}
          ${orden.tipo_cliente === 'aseguradora' && esJefe() ? `
          <div class="sidebar-card">
            <div onclick="_togglePrecioVenta()" class="sidebar-card-header" style="background:#ECFDF5;color:#047857;gap:8px;cursor:pointer;user-select:none">
              <svg id="precio-venta-chev" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24" style="flex-shrink:0;transition:transform .18s ease;transform:rotate(${_precioVentaAbierto?'90':'0'}deg)"><polyline points="9 18 15 12 9 6"/></svg>
              <span style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">Precio venta a cliente</span>
              ${orden.precio_venta_cliente
                ? `<span style="flex-shrink:0;font-size:10px;font-weight:700;text-transform:none;letter-spacing:0;color:#047857;background:#D1FAE5;border-radius:99px;padding:2px 8px;white-space:nowrap">${new Intl.NumberFormat('es-CO',{style:'currency',currency:'COP',minimumFractionDigits:0}).format(orden.precio_venta_cliente)}</span>`
                : `<span style="flex-shrink:0;font-size:10px;font-weight:700;text-transform:none;letter-spacing:0;color:#B45309;background:#FEF3C7;border-radius:99px;padding:2px 8px;white-space:nowrap">Pendiente</span>`}
            </div>
            <div id="precio-venta-body" class="sidebar-card-body" style="${_precioVentaAbierto?'':'display:none'}">
              <div style="font-size:11px;color:var(--gris-mid);margin-bottom:8px">Es el total que verá la <strong>aseguradora</strong> en la orden de trabajo (sin detalle de procesos). Solo lo ven jefe y gerente.</div>
              <div style="display:flex;gap:6px">
                <input id="precio-venta-${orden.id}" type="number" min="0" step="1000" placeholder="0" value="${orden.precio_venta_cliente||''}" style="flex:1;min-width:0;padding:7px 9px;border:1.5px solid var(--gris-borde);border-radius:6px;font-size:13px;font-family:'DM Mono',monospace">
                <button class="btn btn-primary btn-sm" onclick="guardarPrecioVentaCliente(${orden.id})">Guardar</button>
              </div>
              ${orden.precio_venta_cliente ? `<div style="font-size:12px;color:var(--verde);font-weight:600;margin-top:8px">Total a cliente: ${new Intl.NumberFormat('es-CO',{style:'currency',currency:'COP',minimumFractionDigits:0}).format(orden.precio_venta_cliente)}</div>` : ''}
            </div>
          </div>` : ''}
          ${todasFotos.length ? `
          <div class="sidebar-card">
            <div class="sidebar-card-header">Fotos recientes</div>
            <div class="sidebar-card-body">
              <div class="fotos-grid">${fotosRecHtml}</div>
            </div>
          </div>` : ''}
          ${_hayInv ? `
          <div class="sidebar-card">
            <div class="sidebar-card-header">Inventario</div>
            <div class="sidebar-card-body">
              <div>${invHtml}</div>
            </div>
          </div>` : ''}
          ${orden.placa ? `
          <div class="sidebar-card" id="consumibles-sidebar-card">
            <div onclick="_toggleConsumibles()" id="consumibles-sidebar-header" class="sidebar-card-header" style="gap:8px;cursor:pointer;user-select:none;${_consumiblesAbierto?'':'background:#FEF3C7;color:#B45309'}">
              <svg id="consumibles-chev" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24" style="flex-shrink:0;transition:transform .18s ease;transform:rotate(${_consumiblesAbierto?'90':'0'}deg)"><polyline points="9 18 15 12 9 6"/></svg>
              <span style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">🔧 Consumibles</span>
              <span id="consumibles-pill" style="flex-shrink:0;font-size:10px;font-weight:700;text-transform:none;letter-spacing:0;color:#B45309;background:#FDE68A;border-radius:99px;padding:2px 8px;white-space:nowrap;${_consumiblesAbierto?'display:none':''}">Pendiente</span>
            </div>
            <div class="sidebar-card-body" id="consumibles-sidebar-body" style="${_consumiblesAbierto?'':'display:none'}">
              <div style="font-size:12px;color:var(--gris-mid)">Cargando...</div>
            </div>
          </div>` : ''}
          <div id="pulmon-card" class="pulmon-card ${orden.pulmon?'':'inactivo'}" style="padding:9px 11px">
            <div style="display:flex;align-items:center;gap:8px">
              <span style="width:7px;height:7px;border-radius:50%;flex-shrink:0;background:${orden.pulmon?'var(--amarillo)':'var(--gris-borde)'}"></span>
              <span style="font-size:11px;font-weight:700;font-family:'DM Mono',monospace;letter-spacing:1px;text-transform:uppercase;color:${orden.pulmon?'var(--amarillo)':'var(--gris-mid)'};flex-shrink:0">Pulmón</span>
              <span id="d-pulmon-badge" style="font-size:12px;color:${orden.pulmon?'#92400e':'var(--gris-mid)'};min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1">
                ${orden.pulmon
                  ? `${orden.pulmon_tipo ? `<strong>${orden.pulmon_tipo.charAt(0).toUpperCase()+orden.pulmon_tipo.slice(1)}</strong> · ` : ''}desde ${formatFecha(orden.pulmon_desde)}`
                  : (orden.pulmon_fin && orden.pulmon_desde)
                    ? `<span style="color:var(--verde,#10B981)">✓</span> estuvo <strong>${_calcPulmonTiempo(orden.pulmon_desde, orden.pulmon_fin)}</strong>`
                    : 'Sin pulmón'}
              </span>
              ${orden.estado !== 'Entregada' && orden.estado !== 'Archivada' ? `
              <button class="btn btn-xs btn-ghost" id="btn-pulmon" style="flex-shrink:0;font-size:11px;padding:3px 8px" onclick="togglePulmon()">
                ${orden.pulmon ? 'Sacar' : 'Activar'}
              </button>` : `<span id="btn-pulmon" style="font-size:10px;color:var(--gris-mid);flex-shrink:0">cerrada</span>`}
            </div>
          </div>
          ${false ? `
          <div class="sidebar-card">
            <div class="sidebar-card-header" style="background:#F5F3FF;color:#6D28D9;display:flex;align-items:center;gap:6px">
              <svg width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
              Seguimiento Aseguradora
            </div>
            <div class="sidebar-card-body">
              ${(() => {
                const ingreso = orden.ingreso_en || orden.creado_en;
                let diasPulmon = '—';
                if (orden.pulmon_desde) {
                  const ref = orden.pulmon_fin ? new Date(orden.pulmon_fin) : new Date();
                  diasPulmon = Math.max(0, Math.floor((ref - new Date(orden.pulmon_desde)) / 86400000)) + ' día(s)';
                }
                return `<div class="det-datos-filas">
                  <div class="det-dato-fila"><span class="det-dato-lbl">Día de ingreso</span><span class="det-dato-val">${ingreso ? formatFecha(ingreso) : '—'}</span></div>
                  <div class="det-dato-fila"><span class="det-dato-lbl">Días en pulmón</span><span class="det-dato-val">${diasPulmon}</span></div>
                </div>`;
              })()}
            </div>
          </div>` : ''}
          ${esJefe() ? `
          <div class="sidebar-card">
            <div onclick="_toggleEstadoOrden()" id="estado-orden-header" class="sidebar-card-header" style="gap:8px;cursor:pointer;user-select:none">
              <svg id="estado-orden-chev" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24" style="flex-shrink:0;transition:transform .18s ease;transform:rotate(${_estadoOrdenAbierto?'90':'0'}deg)"><polyline points="9 18 15 12 9 6"/></svg>
              <span style="flex:1;min-width:0">Estado de la orden</span>
              <span style="flex-shrink:0;font-size:10px;font-weight:800;text-transform:none;letter-spacing:0;color:${orden.pulmon?'#92400E':'#1D4ED8'};background:${orden.pulmon?'#FEF3C7':'#EFF6FF'};border-radius:99px;padding:2px 8px">${orden.pulmon?'En pulmón':(orden.estado||'Activa')}</span>
            </div>
            <div id="estado-orden-body" class="sidebar-card-body" style="${_estadoOrdenAbierto?'':'display:none'}">
              ${typeof _barraAccionesEstado === 'function' ? _barraAccionesEstado(orden) : ''}
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
                     <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.04em;color:var(--gris-mid);margin:2px 0 -2px">📄 Generar orden de trabajo</div>
                     <div style="display:flex;gap:6px;width:100%">
                       <button class="btn btn-ghost btn-sm" style="flex:1" onclick="generarPreliquidacion(${orden.id},false)">📋 Sin precios</button>
                       <button class="btn btn-ghost btn-sm" style="flex:1" onclick="generarPreliquidacion(${orden.id},true)">💰 Con precios</button>
                     </div>
                     ${orden.estado === 'Archivada' && esJefe() ? `<button class="btn btn-ghost btn-sm" style="width:100%;color:#DC2626;border:1px solid #FECACA" onclick="eliminarOrdenPermanente(${orden.id})">🗑️ Eliminar permanentemente</button>` : ''}
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
                     ${typeof _bloqueIngreso === 'function' ? _bloqueIngreso(orden) : ''}
                     <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.04em;color:var(--gris-mid);margin:2px 0 -2px">📄 Generar orden de trabajo</div>
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

    // Destello del apartado que cambió, si venimos desde una alerta de Gestión
    // Operativa (taller-kpi deja la pista en window._kpiFlashEtapa).
    if (window._kpiFlashEtapa && window._kpiFlashEtapa.ordenId === id) {
      const _tgt = window._kpiFlashEtapa.etapaId;
      window._kpiFlashEtapa = null;
      setTimeout(() => { if (typeof _flashEtapaDetalle === 'function') _flashEtapaDetalle(_tgt); }, 140);
    }

  } catch(e) {
    detalleCont.innerHTML = `<div class="empty-state">Error: ${e.message}</div>`;
  }
}

// Resalta (destella) la etapa que cambió cuando se abre la orden desde una
// alerta de Gestión Operativa. Si no hay etapa concreta, usa la primera.
function _flashEtapaDetalle(etapaId) {
  if (!document.getElementById('kpi-det-flash-style')) {
    const st = document.createElement('style'); st.id = 'kpi-det-flash-style';
    st.textContent =
      '@keyframes kpiDetFlash{0%{box-shadow:0 0 0 0 rgba(245,158,11,0);background:transparent}10%{box-shadow:0 0 0 3px #F59E0B;background:rgba(245,158,11,.12)}45%{box-shadow:0 0 0 3px #3B82F6;background:rgba(37,99,235,.10)}100%{box-shadow:0 0 0 0 rgba(59,130,246,0);background:transparent}}' +
      '.kpi-det-flash{animation:kpiDetFlash 2.8s ease forwards;border-radius:12px;position:relative;z-index:1}';
    document.head.appendChild(st);
  }
  let card = etapaId ? document.querySelector(`.etapa-card[data-eid="${etapaId}"]`) : null;
  if (!card) card = document.querySelector('#etapas-lista .etapa-card');
  if (!card) return;
  const body = card.querySelector('.etapa-body');
  if (body && !body.classList.contains('open')) body.classList.add('open');
  try { card.scrollIntoView({ behavior: 'smooth', block: 'center' }); } catch (e) {}
  card.classList.remove('kpi-det-flash'); void card.offsetWidth; card.classList.add('kpi-det-flash');
  setTimeout(() => card.classList.remove('kpi-det-flash'), 3000);
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

  const sinTecnico = !e.mecanico_id && !e.tercero;

  let acc = '';
  if (!e.inicio) {
    if (sinTecnico) {
      // No se puede iniciar hasta asignar un técnico. Aviso visible + botón
      // deshabilitado que apunta al selector "Técnico asignado" de abajo.
      acc = `<div style="background:#FFFBEB;border:1px solid #FCD34D;border-radius:7px;padding:8px 11px;font-size:12.5px;color:#92400E;font-weight:600;display:flex;align-items:center;gap:6px;width:100%;margin-bottom:8px">
          <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
          Falta asignar técnico — asígnalo abajo para poder iniciar.
        </div>
        <button class="btn btn-success btn-sm" disabled style="opacity:.45;cursor:not-allowed" title="Asigna un técnico para poder iniciar">▶ Iniciar</button>`;
    } else {
      acc = `<button class="btn btn-success btn-sm" data-eid="${eid}" data-nombre="${escapeHtml(nombre)}" onclick="iniciarEtapa(+this.dataset.eid,this.dataset.nombre)">▶ Iniciar</button>`;
    }
  }
  else if (e.inicio && !e.fin && esPausado)
    acc = `<span style="font-size:12px;color:#D97706;font-weight:600;display:flex;align-items:center;gap:5px">
      <svg width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
      En pausa
    </span>
    <button class="btn btn-success btn-sm" data-eid="${eid}" onclick="reanudarEtapa(+this.dataset.eid)">▶ Reanudar</button>`;
  else if (e.inicio && !e.fin) {
    // Si fue reabierta por rechazo, mostrar aviso
    const avisoRechazo = fueRechazada
      ? `<div style="background:#FEE2E2;border:1px solid #FECACA;border-radius:6px;padding:6px 10px;font-size:12px;color:#DC2626;font-weight:600;margin-bottom:6px;display:flex;align-items:center;gap:5px">
          <svg width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          Etapa rechazada — corrígela y finaliza de nuevo
          ${ultimaAprob?.observacion ? `<span style="font-weight:400;color:#B91C1C;display:block;margin-top:3px">"${escapeHtml(ultimaAprob.observacion)}"</span>` : ''}
        </div>` : '';
    acc = avisoRechazo + `<button class="btn btn-danger btn-sm" data-eid="${eid}" data-nombre="${escapeHtml(nombre)}" data-srv="${escapeHtml(e.servicio||'')}" onclick="finalizarEtapa(+this.dataset.eid,this.dataset.nombre,this.dataset.srv)">${fueRechazada ? '■ Reenviar a calidad' : '■ Finalizar'}</button>
    <button class="btn btn-ghost btn-sm" data-eid="${eid}" onclick="_mostrarPausa(+this.dataset.eid)" style="color:#92400E;border-color:#FCD34D;background:#FFFBEB">⏸ Pausar</button>`;
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
      ${n.foto_url ? `<img src="${escapeHtml(n.foto_url)}" class="novedad-foto" loading="lazy" onclick="abrirLightbox(this.src)" alt="Foto de la novedad">` : ''}
      <div class="novedad-resp">Resp: ${escapeHtml(n.responsable)||'—'}</div>
      ${n.valor ? '<div style="font-size:12px;font-weight:600;color:var(--rojo);margin-top:3px;display:flex;align-items:center;gap:4px">' + ico('money',12) + ' Valor adicional: ' + new Intl.NumberFormat('es-CO',{style:'currency',currency:'COP',minimumFractionDigits:0}).format(n.valor) + '</div>' : ''}
    </div>`).join('')
    : '<div style="font-size:12px;color:var(--gris-mid);padding:4px 0">Sin novedades.</div>';

  return `
    <div class="etapa-card" data-eid="${eid}">
      <div class="etapa-header" onclick="toggleEtapa('eb-${k}')">
        <div style="flex:1;min-width:0">
          <div class="etapa-nombre">${escapeHtml(nombre)}${e.tercero?` <span style="font-size:11px;color:var(--gris-mid);font-weight:400">(${escapeHtml(e.tercero)}${e.tercero_desc?' · '+escapeHtml(e.tercero_desc):''})</span>`:''}</div>
          ${!sinTecnico ? `<div class="etapa-tecnico">${ico('user',12)} ${escapeHtml(nombreTec(e))||'Asignado'}</div>` : `<div class="etapa-tecnico" style="color:#B45309;font-weight:700">⚠ Falta asignar técnico</div>`}
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
          <!-- [Oculto] Botón "Pedir repuesto" (flujo de repuestos con proveedores).
               Se retira de la UI por pedido; el código del flujo se conserva. -->
        </div>
        ${(() => {
          const _esJ = (typeof esJefe === 'function') && esJefe();
          if (!e.descripcion && !_esJ) return '';   // técnicos: solo si hay descripción
          return `<div style="background:var(--azul-light);border:1px solid var(--gris-borde);border-radius:7px;padding:9px 12px;margin-bottom:10px;font-size:12.5px;color:var(--texto);line-height:1.5">
            <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:8px">
              <span style="font-size:10px;font-weight:700;color:var(--azul);text-transform:uppercase;letter-spacing:.06em">Descripción</span>
              ${_esJ ? `<button class="btn btn-ghost btn-xs" style="flex-shrink:0;font-size:10.5px;padding:2px 8px" onclick="_editarDescEtapa('${k}')">✏ Editar</button>` : ''}
            </div>
            <div id="desc-etapa-text-${k}" style="margin-top:3px;white-space:pre-wrap">${e.descripcion ? escapeHtml(e.descripcion) : '<span style="color:var(--gris-mid)">Sin descripción</span>'}</div>
            ${_esJ ? `<div id="desc-etapa-editor-${k}" style="display:none;margin-top:8px">
              <textarea id="desc-etapa-input-${k}" placeholder="Descripción del servicio / etapa" style="width:100%;min-height:50px;resize:vertical;box-sizing:border-box">${escapeHtml(e.descripcion || '')}</textarea>
              <div class="btn-row" style="margin-top:6px;justify-content:flex-end;gap:8px">
                <button class="btn btn-ghost btn-sm" onclick="_editarDescEtapa('${k}')">Cancelar</button>
                <button class="btn btn-primary btn-sm" onclick="_guardarDescEtapa(${eid},'${k}')">Guardar</button>
              </div>
            </div>` : ''}
          </div>`;
        })()}
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
                // Se muestran TODOS los técnicos (no se filtra por rol/servicio).
                // Solo se excluyen perfiles que no son técnicos (TV/repuestos/asesor).
                const _noTecnicos = ['taller', 'repuestos', 'asesor previsora'];
                return mecanicos
                  .filter(m => {
                    if (e.mecanico_id && Number(e.mecanico_id) === Number(m.id)) return true;
                    return !_noTecnicos.includes((m.rol || '').toLowerCase());
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
            // Indicador: ¿el técnico asignado puede recibir su precio por Telegram personal?
            const _mecAsig = (typeof mecanicos !== 'undefined' && e.mecanico_id) ? mecanicos.find(m => Number(m.id) === Number(e.mecanico_id)) : null;
            const _tgInd = !e.mecanico_id
              ? ''  // sin técnico interno asignado (o externo): no aplica aviso personal
              : (_mecAsig && _mecAsig.telegram_chat_id)
                ? `<span title="El técnico tiene Telegram personal: recibirá su precio" style="font-size:9px;font-weight:700;color:var(--verde);background:var(--verde-bg);border:1px solid var(--verde);border-radius:99px;padding:0 6px;white-space:nowrap;text-transform:none;letter-spacing:0">✓ Telegram</span>`
                : `<span title="El técnico NO tiene Telegram personal configurado (Operarios). No recibirá su precio." style="font-size:9px;font-weight:700;color:var(--amarillo);background:var(--amarillo-bg);border:1px solid var(--amarillo);border-radius:99px;padding:0 6px;white-space:nowrap;text-transform:none;letter-spacing:0">⚠ sin Telegram</span>`;
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
                <label style="display:flex;align-items:center;gap:4px;flex-wrap:wrap">Precio técnico <span style="color:var(--gris-mid);font-size:10px">🔒</span> ${_tgInd}</label>
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
              <div class="field etapa-campo-sm"><label style="display:flex;align-items:center;gap:5px;flex-wrap:wrap">Precio técnico ${_tgInd}</label>
                <input id="val-${k}" type="number" step="1000" value="${e.valor||''}" placeholder="0" style="font-weight:600;color:var(--verde)">
              </div>
              ${esJefe() ? `<div class="field etapa-campo-sm"><label>Precio venta</label>
                <input id="vv-${k}" type="number" step="1000" value="${e.valor_venta||''}" placeholder="0" style="font-weight:600;color:var(--azul-mid)">
              </div>` : ''}
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
        ${eNovs.length || (e.inicio && !e.fin) ? `
        <div class="novedad-section">
          ${eNovs.length ? `<div class="novedad-section-titulo" style="margin:0 0 8px">Historial de pausas</div><div id="nlist-${eid}">${novsHtml}</div>` : ''}
          <div id="pausa-form-${eid}" style="display:none;margin-top:${eNovs.length?'10px':'0'};${eNovs.length?'border-top:1px solid var(--gris-borde);padding-top:10px;':''}">
            <label style="font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:1px;color:var(--gris-mid)">Motivo de la pausa</label>
            <textarea id="pausa-motivo-${eid}" placeholder="¿Por qué se pausa la etapa?" style="width:100%;min-height:44px;margin-top:5px;resize:vertical;box-sizing:border-box"></textarea>
            <div class="btn-row" style="margin-top:8px;justify-content:flex-end">
              <button class="btn btn-ghost btn-xs" onclick="_ocultarPausa(${eid})">Cancelar</button>
              <button class="btn btn-primary btn-sm" onclick="confirmarPausa(${eid})">⏸ Confirmar pausa</button>
            </div>
          </div>
        </div>` : ''}
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

// ── Pausa / Reanudar de etapa ───────────────────────────────
function _mostrarPausa(eid) {
  const f = document.getElementById('pausa-form-' + eid);
  if (f) { f.style.display = 'block'; document.getElementById('pausa-motivo-' + eid)?.focus(); }
}
function _ocultarPausa(eid) {
  const f = document.getElementById('pausa-form-' + eid);
  if (f) f.style.display = 'none';
}

// Pausa la etapa (detiene el cronómetro) y registra el motivo en el historial.
async function confirmarPausa(eid) {
  const motivo = document.getElementById('pausa-motivo-' + eid)?.value?.trim() || 'Pausa manual';
  try {
    await api(`/etapas?id=eq.${eid}`, 'PATCH', { pausado: true, pausa_inicio: new Date().toISOString() });
    if (ordenActual) {
      await api('/novedades', 'POST', {
        orden_id: ordenActual.id, etapa_id: eid, tipo: 'Detenido', motivo,
        responsable: sesion?.nombre || '—', desde: new Date().toISOString()
      }, { Prefer: 'return=minimal' }).catch(() => {});
    }
    toast('Etapa pausada ⏸');
    if (ordenActual) abrirOrden(ordenActual.id);
  } catch (e) { toast('Error: ' + e.message, 'err'); }
}

// Reanuda la etapa: suma el tiempo que estuvo en pausa para no contarlo como trabajo.
async function reanudarEtapa(eid) {
  try {
    const prev = await api(`/etapas?id=eq.${eid}&select=pausa_inicio,tiempo_pausado_min`).then(r => r?.[0]).catch(() => null);
    const min = prev?.pausa_inicio ? Math.max(0, Math.round((Date.now() - new Date(prev.pausa_inicio)) / 60000)) : 0;
    await api(`/etapas?id=eq.${eid}`, 'PATCH', {
      pausado: false, pausa_inicio: null, tiempo_pausado_min: (prev?.tiempo_pausado_min || 0) + min
    });
    toast('Etapa reanudada ▶');
    if (ordenActual) abrirOrden(ordenActual.id);
  } catch (e) { toast('Error: ' + e.message, 'err'); }
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
// ESTADO DEL CARRO — panel fijo arriba del detalle. Tiene 2 partes:
//  1) DESCRIPCIÓN (descripcion_general): el daño/trabajo inicial, editable.
//  2) ESTADO / HISTORIAL: novedades a nivel de orden (novedades.tipo='Comentario',
//     etapa_id NULL) que NO se sobrescriben — cada nueva queda como estado actual
//     y las anteriores pasan al historial, con fecha/hora y autor. Además, botones
//     para Pausar etapa, Pulmón y Continuar, que se registran solos en el historial.
// ============================================================
function _panelComentariosOrden(orden, novedades, etapas) {
  const ordenId = orden?.id;
  const desc = (orden && orden.descripcion_general) ? String(orden.descripcion_general) : '';
  novedades = novedades || [];
  etapas = etapas || [];

  // Historial de estado: se guarda en orden.estado_historial (lista JSON en la
  // propia orden). La entrada más reciente = estado actual. Cada una: {texto,en,por}.
  let hist = [];
  try { const raw = orden && orden.estado_historial; hist = Array.isArray(raw) ? raw.slice() : (typeof raw === 'string' && raw ? JSON.parse(raw) : []); } catch (e) { hist = []; }
  hist.sort((a, b) => new Date(b.en || 0) - new Date(a.en || 0));
  const ultimo = hist[0];
  // Botón ✕ para eliminar una novedad (se identifica por su marca de tiempo 'en').
  const _delNov = n => `<button class="btn btn-ghost btn-xs" title="Eliminar novedad" style="flex-shrink:0;color:#DC2626;padding:1px 6px;font-size:13px;line-height:1" onclick="event.stopPropagation();_eliminarNovedadEstado(${ordenId},'${encodeURIComponent(n.en || '')}')">✕</button>`;
  const histHtml = hist.map(n => `<div style="display:flex;align-items:flex-start;gap:6px;border-left:3px solid #7C3AED;background:var(--surface-2);border-radius:6px;padding:7px 10px;margin-bottom:6px">
      <div style="flex:1;min-width:0">
        <div style="font-size:15px;color:var(--texto);white-space:pre-wrap">${escapeHtml(n.texto || '—')}</div>
        <div style="font-size:12.5px;color:var(--gris-mid);margin-top:2px">${escapeHtml(n.por || '—')} · ${formatTS(n.en)}</div>
      </div>
      ${_delNov(n)}
    </div>`).join('');

  // Estado operativo (para los botones contextuales).
  const activaEnProceso = etapas.find(e => e.inicio && !e.fin && !e.pausado);
  const pausada = etapas.find(e => e.inicio && !e.fin && e.pausado);
  const enPulmon = !!orden.pulmon;
  // Botones neutros y compactos (sin colores llamativos: el color lo dan los íconos).
  const _b = (txt, onclick) => `<button class="btn" style="background:var(--surface);color:#475569;border:1px solid var(--gris-borde);padding:4px 9px;border-radius:7px;font-size:11.5px;font-weight:600;cursor:pointer" onclick="${onclick}">${txt}</button>`;
  let acciones = '';
  if (activaEnProceso) acciones += _b('⏸ Pausar', `_estadoPausar(${ordenId})`);
  if (pausada || enPulmon) acciones += _b('▶ Continuar', `_estadoContinuar(${ordenId})`);
  acciones += _b(enPulmon ? '↩ Sacar de pulmón' : '🫁 Pulmón', `_estadoPulmon(${ordenId})`);

  // Preview de una línea para cuando está colapsado (lo último relevante).
  const _preview = ((ultimo && ultimo.texto) || desc || '').replace(/\s+/g, ' ').trim().slice(0, 70);
  const _ab = _comentOrdenAbierto;

  return `
    <div class="orden-coment-bar det-sec-box" style="background:var(--surface);border:1px solid #B5D4F4;border-radius:10px;overflow:hidden;margin-bottom:14px;box-shadow:0 1px 6px rgba(37,99,235,.08)">
      <!-- ENCABEZADO COLAPSABLE -->
      <div class="det-sec-bar" onclick="_toggleComentBar(${ordenId})" style="display:flex;align-items:center;gap:8px;padding:9px 12px;background:#E6F1FB;cursor:pointer;user-select:none">
        <svg id="coment-bar-chev-${ordenId}" width="15" height="15" fill="none" stroke="#185FA5" stroke-width="2.5" viewBox="0 0 24 24" style="flex-shrink:0;transition:transform .18s ease;transform:rotate(${_ab ? '90' : '0'}deg)"><polyline points="9 18 15 12 9 6"/></svg>
        <span style="font-size:12px;font-weight:800;text-transform:uppercase;letter-spacing:.06em;color:#0C447C;flex-shrink:0">📝 Descripción y estado</span>
        <span id="coment-bar-prev-${ordenId}" style="font-size:13.5px;color:#185FA5;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1;${_ab ? 'visibility:hidden' : ''}">${_preview ? escapeHtml(_preview) : 'Sin descripción'}</span>
      </div>
      <div id="coment-bar-body-${ordenId}" style="${_ab ? '' : 'display:none;'}padding:0 12px 11px">
      <!-- DESCRIPCIÓN -->
      <div style="display:flex;align-items:flex-start;gap:10px">
        <div style="flex:1;min-width:0">
          <div style="font-size:16px;color:${desc ? 'var(--texto)' : 'var(--gris-mid)'};white-space:pre-wrap;line-height:1.45">${desc ? escapeHtml(desc) : 'Sin descripción. Toca “Editar” para escribirla.'}</div>
        </div>
        <button class="btn btn-ghost btn-sm" style="flex-shrink:0" onclick="event.stopPropagation();_toggleComentOrden(${ordenId})">✏ Editar</button>
      </div>
      <div id="coment-orden-editor-${ordenId}" style="display:none;margin-top:8px;border-top:1px solid var(--gris-borde);padding-top:8px">
        <textarea id="coment-orden-${ordenId}" placeholder="Descripción del carro (daños, trabajo a realizar...)" style="width:100%;min-height:50px;resize:vertical;box-sizing:border-box">${escapeHtml(desc)}</textarea>
        <div class="btn-row" style="margin-top:8px;justify-content:flex-end;gap:8px">
          <button class="btn btn-ghost btn-sm" onclick="_toggleComentOrden(${ordenId})">Cancelar</button>
          <button class="btn btn-primary btn-sm" onclick="_guardarComentarioOrden(${ordenId})">Guardar descripción</button>
        </div>
      </div>

      <!-- ESTADO / HISTORIAL -->
      <div style="margin-top:10px;border-top:1px solid var(--gris-borde);padding-top:10px">
        <div style="font-size:12px;font-weight:800;text-transform:uppercase;letter-spacing:.06em;color:#7C3AED;margin-bottom:4px">🔄 Estado del proceso</div>
        ${ultimo
          ? `<div style="display:flex;align-items:flex-start;gap:6px">
               <div style="flex:1;min-width:0">
                 <div style="font-size:16px;color:var(--texto);white-space:pre-wrap;line-height:1.45">${escapeHtml(ultimo.texto || '—')}</div>
                 <div style="font-size:12.5px;color:var(--gris-mid);margin-top:2px">${escapeHtml(ultimo.por || '—')} · ${formatTS(ultimo.en)}</div>
               </div>
               ${_delNov(ultimo)}
             </div>`
          : `<div style="font-size:14px;color:var(--gris-mid)">Sin novedades de estado todavía.</div>`}
        <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:8px">
          ${acciones}
          ${_b('+ Agregar novedad', `_toggleNovedadEstado(${ordenId})`)}
        </div>
        <div id="nov-estado-form-${ordenId}" style="display:none;margin-top:8px">
          <textarea id="nov-estado-${ordenId}" placeholder="Novedad del estado (ej. esperando aprobación, listo para entrega, cliente avisado...)" style="width:100%;min-height:44px;resize:vertical;box-sizing:border-box"></textarea>
          <div class="btn-row" style="margin-top:6px;justify-content:flex-end;gap:8px">
            <button class="btn btn-ghost btn-sm" onclick="_toggleNovedadEstado(${ordenId})">Cancelar</button>
            <button class="btn btn-primary btn-sm" onclick="_agregarNovedadEstado(${ordenId})">Guardar novedad</button>
          </div>
        </div>
        ${hist.length > 1 ? `<details style="margin-top:8px"><summary style="cursor:pointer;font-size:12px;color:var(--gris-mid);font-weight:600">Ver historial (${hist.length})</summary><div style="margin-top:8px">${histHtml}</div></details>` : ''}
      </div>
      </div>
    </div>`;
}

// Agrega una entrada al historial de estado (orden.estado_historial). Lee la
// lista actual, le suma {texto, en, por} y guarda la orden. Lanza si falla.
async function _appendEstadoHistorial(ordenId, texto) {
  const o = await api(`/ordenes?id=eq.${ordenId}&select=estado_historial`).then(r => r?.[0]).catch(() => null);
  let h = [];
  try { const raw = o && o.estado_historial; h = Array.isArray(raw) ? raw : (typeof raw === 'string' && raw ? JSON.parse(raw) : []); } catch (e) { h = []; }
  h.push({ texto, en: new Date().toISOString(), por: sesion?.nombre || '—' });
  await api(`/ordenes?id=eq.${ordenId}`, 'PATCH', { estado_historial: h });
  if (ordenActual && ordenActual.id === ordenId) ordenActual.estado_historial = h;
}

// Elimina una novedad de estado del historial (se identifica por su marca de
// tiempo 'en', que es única). Pide confirmación y refresca el detalle.
async function _eliminarNovedadEstado(ordenId, enEnc) {
  const en = decodeURIComponent(enEnc || '');
  if (!confirm('¿Eliminar esta novedad de estado?')) return;
  try {
    const o = await api(`/ordenes?id=eq.${ordenId}&select=estado_historial`).then(r => r?.[0]).catch(() => null);
    let h = [];
    try { const raw = o && o.estado_historial; h = Array.isArray(raw) ? raw : (typeof raw === 'string' && raw ? JSON.parse(raw) : []); } catch (e) { h = []; }
    const nueva = h.filter(n => (n.en || '') !== en);
    await api(`/ordenes?id=eq.${ordenId}`, 'PATCH', { estado_historial: nueva });
    if (ordenActual && ordenActual.id === ordenId) ordenActual.estado_historial = nueva;
    toast('Novedad eliminada ✓');
    abrirOrden(ordenId);
  } catch (e) { toast('Error: ' + e.message, 'err'); }
}

// Registro AUTOMÁTICO desde las acciones (pausar/pulmón/continuar): best-effort,
// no rompe la acción si el guardado del historial falla.
async function _logEstado(ordenId, texto) {
  try { await _appendEstadoHistorial(ordenId, texto); } catch (e) { console.warn('[logEstado]', e?.message); }
}

function _toggleNovedadEstado(ordenId) {
  const f = document.getElementById('nov-estado-form-' + ordenId);
  if (!f) return;
  const mostrar = f.style.display === 'none';
  f.style.display = mostrar ? 'block' : 'none';
  if (mostrar) document.getElementById('nov-estado-' + ordenId)?.focus();
}

async function _agregarNovedadEstado(ordenId) {
  const txt = document.getElementById('nov-estado-' + ordenId)?.value?.trim();
  if (!txt) { toast('Escribe la novedad', 'err'); return; }
  try {
    await _appendEstadoHistorial(ordenId, txt);
    toast('Novedad agregada ✓');
    const _placa = ordenActual?.id === ordenId ? (ordenActual?.placa || null) : null;
    _logEvento('novedad', '📝', `Novedad: ${txt}${_placa ? ' — ' + _placa : ''}`, ordenId, _placa, '#6366F1');
    abrirOrden(ordenId);
  } catch (e) {
    console.error('[novedadEstado]', e);
    const hint = /estado_historial|column|does not exist|schema cache|PGRST/i.test(e?.message || '')
      ? ' — falta correr el SQL docs/sql-estado-historial.sql (agrega la columna estado_historial)'
      : '';
    toast('No se pudo guardar: ' + (e?.message || 'error') + hint, 'err');
  }
}

// Pausa la etapa que esté EN PROCESO (con un motivo) y lo registra en el historial.
async function _estadoPausar(ordenId) {
  const et = await api(`/etapas?orden_id=eq.${ordenId}&inicio=not.is.null&fin=is.null&pausado=eq.false&order=inicio.desc&limit=1&select=id,etapa`).then(r => r?.[0]).catch(() => null);
  if (!et) { toast('No hay una etapa en proceso para pausar', 'err'); return; }
  const motivo = (typeof prompt === 'function') ? prompt('¿Por qué se pausa? (ej. falta repuesto)') : '';
  if (motivo === null) return; // canceló
  try {
    await api(`/etapas?id=eq.${et.id}`, 'PATCH', { pausado: true, pausa_inicio: new Date().toISOString() });
    await _logEstado(ordenId, `⏸ Pausado · ${et.etapa || 'etapa'}${(motivo || '').trim() ? ': ' + motivo.trim() : ''}`);
    toast('Etapa pausada ⏸');
    abrirOrden(ordenId);
  } catch (e) { toast('Error: ' + e.message, 'err'); }
}

// Reanuda lo que esté detenido: la etapa pausada y/o saca la orden de pulmón.
async function _estadoContinuar(ordenId) {
  let hizo = false;
  try {
    const etP = await api(`/etapas?orden_id=eq.${ordenId}&fin=is.null&pausado=eq.true&order=inicio.desc&limit=1&select=id,etapa,pausa_inicio,tiempo_pausado_min`).then(r => r?.[0]).catch(() => null);
    if (etP) {
      const min = etP.pausa_inicio ? Math.max(0, Math.round((Date.now() - new Date(etP.pausa_inicio)) / 60000)) : 0;
      await api(`/etapas?id=eq.${etP.id}`, 'PATCH', { pausado: false, pausa_inicio: null, tiempo_pausado_min: (etP.tiempo_pausado_min || 0) + min });
      await _logEstado(ordenId, `▶ Continuó el proceso · ${etP.etapa || 'etapa'}`);
      hizo = true;
    }
    const o = await api(`/ordenes?id=eq.${ordenId}&select=pulmon`).then(r => r?.[0]).catch(() => null);
    if (o?.pulmon) {
      await api(`/ordenes?id=eq.${ordenId}`, 'PATCH', { pulmon: false, pulmon_fin: new Date().toISOString() });
      if (ordenActual && ordenActual.id === ordenId) ordenActual.pulmon = false;
      await _logEstado(ordenId, '▶ Salió de pulmón');
      hizo = true;
    }
    if (!hizo) { toast('No hay nada pausado ni en pulmón', 'info'); return; }
    if (typeof _refrescarCapacidad === 'function') _refrescarCapacidad();
    toast('Proceso reanudado ▶');
    abrirOrden(ordenId);
  } catch (e) { toast('Error: ' + e.message, 'err'); }
}

// Abre el flujo de pulmón (interno/externo) o lo saca. El registro en el
// historial lo hacen activarPulmonCon / _desactivarPulmon.
function _estadoPulmon() {
  if (typeof togglePulmon === 'function') togglePulmon();
}

// Guarda el N° de orden de trabajo (manual) de la orden. Al guardarlo, el aviso
// de "falta agregar el N° de orden" desaparece (se vuelve a renderizar el detalle).
async function _guardarNumeroOT(ordenId) {
  const v = document.getElementById('ot-num-' + ordenId)?.value?.trim();
  if (!v) { toast('Escribe el número de orden', 'err'); return; }
  try {
    await api(`/ordenes?id=eq.${ordenId}`, 'PATCH', { numero_ot: v });
    if (ordenActual && ordenActual.id === ordenId) ordenActual.numero_ot = v;
    toast('N° de orden guardado ✓');
    abrirOrden(ordenId);
  } catch (e) { toast('Error: ' + e.message, 'err'); }
}

// Abre/cierra el editor del comentario general de la orden.
function _toggleComentOrden(ordenId) {
  // Si la barra está colapsada, ábrela primero para que se vea el editor.
  if (!_comentOrdenAbierto) _toggleComentBar(ordenId);
  const ed = document.getElementById('coment-orden-editor-' + ordenId);
  if (!ed) return;
  const mostrar = ed.style.display === 'none';
  ed.style.display = mostrar ? 'block' : 'none';
  if (mostrar) document.getElementById('coment-orden-' + ordenId)?.focus();
}

// Guarda la "Descripción general" (estado del carro) de la orden. Refresca.
async function _guardarComentarioOrden(ordenId) {
  const txt = document.getElementById('coment-orden-' + ordenId)?.value?.trim() || '';
  try {
    await api(`/ordenes?id=eq.${ordenId}`, 'PATCH', { descripcion_general: txt || null });
    if (ordenActual && ordenActual.id === ordenId) ordenActual.descripcion_general = txt || null;
    toast('Estado del carro actualizado ✓');
    abrirOrden(ordenId);
  } catch (e) { toast('Error: ' + e.message, 'err'); }
}

// ============================================================
// PANELES DE INSUMOS y REPUESTOS (simples) DE LA ORDEN — solo jefe/gerente.
// Lista con buscador (datalist de frecuentes): nombre + cantidad + valor unitario.
// Cada uno se agrega a la lista al instante. Insumos → ordenes.insumos;
// Repuestos → ordenes.repuestos_simple. (docs/sql-insumos.sql, docs/sql-repuestos.sql)
// ============================================================
const ITEM_CFG = {
  insumos:   { campo: 'insumos',          icono: '🛢', titulo: 'Insumos',   singular: 'Insumo',   color: '#B45309', headBg: '#FEF3C7', lsKey: 'insumos_frecuentes',   ph: 'Ej. Aceite 15W40',
               def: ['Aceite de motor', 'Filtro de aceite', 'Filtro de aire', 'Filtro de combustible', 'Gasolina', 'Refrigerante', 'Líquido de frenos', 'Grasa'] },
  repuestos: { campo: 'repuestos_simple', icono: '🔧', titulo: 'Repuestos', singular: 'Repuesto', color: '#0F766E', headBg: '#CCFBF1', lsKey: 'repuestos_frecuentes', ph: 'Ej. Pastillas de freno',
               def: ['Pastillas de freno', 'Discos de freno', 'Bujías', 'Batería', 'Amortiguador', 'Rótula', 'Terminal de dirección', 'Correa', 'Banda', 'Filtro de cabina'] }
};
const _itemsAbierto = { insumos: false, repuestos: false };

function _itemFrecuentes(tipo) {
  const cfg = ITEM_CFG[tipo]; let custom = [];
  try { custom = JSON.parse(localStorage.getItem(cfg.lsKey) || '[]'); } catch (e) { custom = []; }
  if (!Array.isArray(custom)) custom = [];
  const seen = new Set(); const out = [];
  [...cfg.def, ...custom].forEach(n => { const k = String(n || '').trim().toLowerCase(); if (k && !seen.has(k)) { seen.add(k); out.push(String(n).trim()); } });
  return out.slice(0, 40);
}
function _recordarItemFrecuente(tipo, nombre) {
  const cfg = ITEM_CFG[tipo]; const k = String(nombre || '').trim();
  if (!k || cfg.def.some(d => d.toLowerCase() === k.toLowerCase())) return;
  let custom = []; try { custom = JSON.parse(localStorage.getItem(cfg.lsKey) || '[]'); } catch (e) { custom = []; }
  if (!Array.isArray(custom)) custom = [];
  if (custom.some(c => String(c).toLowerCase() === k.toLowerCase())) return;
  custom.push(k);
  try { localStorage.setItem(cfg.lsKey, JSON.stringify(custom.slice(-50))); } catch (e) {}
}
function _leerItems(orden, campo) {
  try { const raw = orden && orden[campo]; return Array.isArray(raw) ? raw : (typeof raw === 'string' && raw ? JSON.parse(raw) : []); } catch (e) { return []; }
}

function _panelItemsOrden(orden, tipo) {
  if (typeof esJefe === 'function' && !esJefe()) return '';
  const cfg = ITEM_CFG[tipo]; const oid = orden.id;
  const arr = _leerItems(orden, cfg.campo);
  const fmt = n => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(n || 0);
  const total = arr.reduce((s, i) => s + (((+i.cantidad) || 0) * ((+i.valor) || 0)), 0);
  const abierto = _itemsAbierto[tipo];

  const lista = arr.length
    ? arr.map((i, idx) => {
        const cant = (+i.cantidad) || 0, val = (+i.valor) || 0;
        return `<div style="display:flex;align-items:center;gap:8px;padding:7px 9px;border:1px solid var(--gris-borde);border-radius:8px;margin-bottom:6px">
          <div style="flex:1;min-width:0">
            <div style="font-size:14px;font-weight:700;color:var(--texto);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escapeHtml(i.nombre || cfg.singular)}</div>
            <div style="font-size:13px;color:var(--texto)">${cant} × ${fmt(val)} = <strong>${fmt(cant * val)}</strong></div>
          </div>
          <button class="btn btn-ghost btn-xs" style="flex-shrink:0;color:#DC2626" title="Quitar" onclick="_eliminarItem(${oid},'${tipo}',${idx})">✕</button>
        </div>`;
      }).join('')
    : `<div style="font-size:13.5px;color:var(--gris-mid);padding:2px 0 6px">Aún no hay ${cfg.titulo.toLowerCase()}.</div>`;

  return `<div class="sidebar-card">
      <div onclick="_toggleItems('${tipo}')" id="${tipo}-header" class="sidebar-card-header" style="gap:8px;cursor:pointer;user-select:none;${abierto ? '' : `background:${cfg.headBg};color:${cfg.color}`}">
        <svg id="${tipo}-chev" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24" style="flex-shrink:0;transition:transform .18s ease;transform:rotate(${abierto ? '90' : '0'}deg)"><polyline points="9 18 15 12 9 6"/></svg>
        <span style="flex:1;min-width:0;font-size:14px">${cfg.icono} ${cfg.titulo}</span>
        <span style="flex-shrink:0;font-size:12.5px;font-weight:800;text-transform:none;letter-spacing:0;color:${total ? cfg.color : 'var(--gris-mid)'}">${total ? fmt(total) : (arr.length ? '' : 'Ninguno')}</span>
      </div>
      <div id="${tipo}-body" class="sidebar-card-body" style="${abierto ? '' : 'display:none'}">
        ${lista}
        <button class="btn btn-ghost btn-sm" style="width:100%;margin-top:6px;color:${cfg.color};border:1px dashed var(--gris-borde)" onclick="abrirModalAgregarItems(${oid},'${tipo}')">➕ Agregar ${cfg.titulo.toLowerCase()}</button>
      </div>
    </div>`;
}

// Modal para agregar UNO o VARIOS items (insumos/repuestos) de una sola vez.
let _maiState = { oid: null, tipo: null, rows: [] };
function abrirModalAgregarItems(oid, tipo) {
  _itemsAbierto[tipo] = true;  // que la tarjeta quede abierta tras guardar
  _maiState = { oid, tipo, rows: [{ nombre: '', cantidad: 1, valor: 0 }, { nombre: '', cantidad: 1, valor: 0 }] };
  const cfg = ITEM_CFG[tipo];
  document.getElementById('modal-agregar-items')?.remove();
  const ov = document.createElement('div');
  ov.id = 'modal-agregar-items';
  ov.style.cssText = 'position:fixed;inset:0;z-index:10001;background:rgba(0,0,0,.45);display:flex;align-items:center;justify-content:center;padding:16px';
  ov.innerHTML = `
    <div style="background:var(--surface);border-radius:14px;max-width:520px;width:100%;max-height:90vh;display:flex;flex-direction:column;box-shadow:0 10px 40px rgba(0,0,0,.28);font-family:'DM Sans',sans-serif">
      <div style="padding:16px 18px 8px"><div style="font-size:16px;font-weight:800;color:var(--azul)">${cfg.icono} Agregar ${cfg.titulo.toLowerCase()}</div>
        <div style="font-size:11.5px;color:var(--gris-mid);margin-top:2px">Agrega uno o varios a la vez. Usa el desplegable para elegir de los frecuentes o escribe.</div></div>
      <datalist id="mai-dl">${_itemFrecuentes(tipo).map(n => `<option value="${escapeHtml(n)}"></option>`).join('')}</datalist>
      <div id="mai-rows" style="padding:6px 18px;overflow:auto;flex:1"></div>
      <div style="padding:6px 18px"><button class="btn btn-ghost btn-sm" style="width:100%;color:${cfg.color};border:1px dashed var(--gris-borde)" onclick="_maiAddRow()">＋ Agregar otra fila</button></div>
      <div style="padding:12px 18px;border-top:1px solid var(--gris-borde);display:flex;gap:8px;justify-content:flex-end">
        <button class="btn btn-ghost btn-sm" onclick="document.getElementById('modal-agregar-items').remove()">Cancelar</button>
        <button class="btn btn-primary btn-sm" onclick="_guardarModalItems()">Guardar</button>
      </div>
    </div>`;
  ov.addEventListener('click', e => { if (e.target === ov) ov.remove(); });
  document.body.appendChild(ov);
  _maiRender();
}
function _maiSync() {
  const cont = document.getElementById('mai-rows'); if (!cont) return;
  _maiState.rows = [...cont.querySelectorAll('[data-mai]')].map(row => ({
    nombre: row.querySelector('.mai-nom')?.value || '',
    cantidad: parseFloat(row.querySelector('.mai-cant')?.value) || 1,
    valor: parseFloat(row.querySelector('.mai-val')?.value) || 0
  }));
}
function _maiRender() {
  const cont = document.getElementById('mai-rows'); if (!cont) return;
  const cfg = ITEM_CFG[_maiState.tipo];
  const inCss = 'box-sizing:border-box;padding:7px 9px;border:1px solid var(--gris-borde);border-radius:6px;font-size:13px';
  cont.innerHTML = _maiState.rows.map((r, i) => `<div data-mai="${i}" style="display:flex;gap:5px;margin-bottom:7px;align-items:center">
      <input class="mai-nom" list="mai-dl" value="${escapeHtml(r.nombre)}" placeholder="${cfg.ph}" autocomplete="off" style="${inCss};flex:2;min-width:0">
      <input class="mai-cant" type="number" min="0" step="1" value="${r.cantidad}" title="Cantidad" style="${inCss};flex:.6;min-width:46px">
      <input class="mai-val" type="number" min="0" step="1000" value="${r.valor || ''}" placeholder="Valor c/u" title="Valor unitario" style="${inCss};flex:1.1;min-width:80px;font-family:'DM Mono',monospace">
      <button class="btn btn-ghost btn-xs" style="flex-shrink:0;color:#DC2626" onclick="_maiDelRow(${i})">✕</button>
    </div>`).join('');
}
function _maiAddRow() { _maiSync(); _maiState.rows.push({ nombre: '', cantidad: 1, valor: 0 }); _maiRender(); setTimeout(() => { const rows = document.querySelectorAll('#mai-rows .mai-nom'); rows[rows.length - 1]?.focus(); }, 20); }
function _maiDelRow(i) { _maiSync(); _maiState.rows.splice(i, 1); if (!_maiState.rows.length) _maiState.rows.push({ nombre: '', cantidad: 1, valor: 0 }); _maiRender(); }
async function _guardarModalItems() {
  _maiSync();
  const { oid, tipo } = _maiState; const cfg = ITEM_CFG[tipo];
  const nuevos = _maiState.rows
    .filter(r => r.nombre.trim() && (+r.valor) > 0)
    .map(r => ({ nombre: r.nombre.trim(), cantidad: (+r.cantidad) || 1, valor: (+r.valor) || 0 }));
  if (!nuevos.length) { toast(`Agrega al menos un ${cfg.singular.toLowerCase()} con nombre y valor`, 'err'); return; }
  try {
    const o = await api(`/ordenes?id=eq.${oid}&select=${cfg.campo}`).then(r => r?.[0]).catch(() => null);
    const arr = _leerItems(o || {}, cfg.campo);
    nuevos.forEach(n => { arr.push(n); _recordarItemFrecuente(tipo, n.nombre); });
    await api(`/ordenes?id=eq.${oid}`, 'PATCH', { [cfg.campo]: arr });
    if (ordenActual && ordenActual.id === oid) ordenActual[cfg.campo] = arr;
    document.getElementById('modal-agregar-items')?.remove();
    toast(`${nuevos.length} ${nuevos.length === 1 ? cfg.singular.toLowerCase() + ' agregado' : cfg.titulo.toLowerCase() + ' agregados'} ✓`);
    abrirOrden(oid);
  } catch (e) { toast(`Error agregando (¿falta la columna ${cfg.campo}? corre el SQL): ` + e.message, 'err'); }
}

function _toggleItems(tipo) {
  _itemsAbierto[tipo] = !_itemsAbierto[tipo];
  const cfg = ITEM_CFG[tipo]; const ab = _itemsAbierto[tipo];
  const body = document.getElementById(tipo + '-body');
  const chev = document.getElementById(tipo + '-chev');
  const head = document.getElementById(tipo + '-header');
  if (body) body.style.display = ab ? '' : 'none';
  if (chev) chev.style.transform = `rotate(${ab ? '90' : '0'}deg)`;
  if (head) { head.style.background = ab ? '' : cfg.headBg; head.style.color = ab ? '' : cfg.color; }
}

async function _agregarItem(ordenId, tipo) {
  const cfg = ITEM_CFG[tipo];
  const nom = (document.getElementById(`item-nom-${tipo}-${ordenId}`)?.value || '').trim();
  const cant = parseFloat(document.getElementById(`item-cant-${tipo}-${ordenId}`)?.value) || 1;
  const val = parseFloat(document.getElementById(`item-val-${tipo}-${ordenId}`)?.value) || 0;
  if (!nom) { toast(`Escribe el nombre del ${cfg.singular.toLowerCase()}`, 'err'); return; }
  if (!val) { toast('Escribe el valor', 'err'); return; }
  _itemsAbierto[tipo] = true;
  try {
    const o = await api(`/ordenes?id=eq.${ordenId}&select=${cfg.campo}`).then(r => r?.[0]).catch(() => null);
    const arr = _leerItems(o || {}, cfg.campo);
    arr.push({ nombre: nom, cantidad: cant, valor: val });
    await api(`/ordenes?id=eq.${ordenId}`, 'PATCH', { [cfg.campo]: arr });
    if (ordenActual && ordenActual.id === ordenId) ordenActual[cfg.campo] = arr;
    _recordarItemFrecuente(tipo, nom);
    toast(`${cfg.singular} agregado ✓`);
    abrirOrden(ordenId);
  } catch (e) { toast(`Error agregando (¿falta la columna ${cfg.campo}? corre el SQL): ` + e.message, 'err'); }
}

async function _eliminarItem(ordenId, tipo, idx) {
  const cfg = ITEM_CFG[tipo];
  _itemsAbierto[tipo] = true;
  try {
    const o = await api(`/ordenes?id=eq.${ordenId}&select=${cfg.campo}`).then(r => r?.[0]).catch(() => null);
    const arr = _leerItems(o || {}, cfg.campo);
    arr.splice(idx, 1);
    await api(`/ordenes?id=eq.${ordenId}`, 'PATCH', { [cfg.campo]: arr });
    if (ordenActual && ordenActual.id === ordenId) ordenActual[cfg.campo] = arr;
    toast('Eliminado');
    abrirOrden(ordenId);
  } catch (e) { toast('Error: ' + e.message, 'err'); }
}

// ============================================================
// EDITOR DE VALOR DE LA ORDEN (solo jefe/gerente) — en una pantalla edita el
// precio de cada servicio/etapa, los insumos y los repuestos, con sumatoria viva.
// ============================================================
let _edvState = { ordenId: null, etapas: [], insumos: [], repuestos: [] };
const _edvFmt = n => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(n || 0);

async function abrirEditorValor(ordenId) {
  const etapas = await api(`/etapas?orden_id=eq.${ordenId}&order=creado_en.asc&select=id,etapa,servicio,valor_venta`).catch(() => []) || [];
  const o = (ordenActual && ordenActual.id === ordenId) ? ordenActual : await api(`/ordenes?id=eq.${ordenId}&select=insumos,repuestos_simple`).then(r => r?.[0]).catch(() => null);
  _edvState = {
    ordenId,
    etapas: etapas.map(e => ({ id: e.id, nombre: e.etapa || (typeof CATALOGO !== 'undefined' && CATALOGO[e.servicio]?.nombre) || e.servicio || 'Servicio', valor: +e.valor_venta || 0 })),
    insumos: _leerItems(o || {}, 'insumos').map(i => ({ nombre: i.nombre || '', cantidad: +i.cantidad || 1, valor: +i.valor || 0 })),
    repuestos: _leerItems(o || {}, 'repuestos_simple').map(i => ({ nombre: i.nombre || '', cantidad: +i.cantidad || 1, valor: +i.valor || 0 }))
  };
  document.getElementById('modal-editor-valor')?.remove();
  const ov = document.createElement('div');
  ov.id = 'modal-editor-valor';
  ov.style.cssText = 'position:fixed;inset:0;z-index:10001;background:rgba(0,0,0,.45);display:flex;align-items:center;justify-content:center;padding:16px';
  ov.innerHTML = `
    <div style="background:var(--surface);border-radius:14px;max-width:560px;width:100%;max-height:90vh;display:flex;flex-direction:column;box-shadow:0 10px 40px rgba(0,0,0,.28);font-family:'DM Sans',sans-serif">
      <div style="padding:16px 18px 10px;border-bottom:1px solid var(--gris-borde)">
        <div style="font-size:16px;font-weight:800;color:var(--azul)">Editar valor de la orden</div>
      </div>
      <div id="edv-body" style="padding:14px 18px;overflow:auto;flex:1"></div>
      <div style="padding:12px 18px;border-top:1px solid var(--gris-borde);display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap">
        <div id="edv-tot" style="font-size:12.5px;color:var(--gris-mid)"></div>
        <div style="display:flex;gap:8px">
          <button class="btn btn-ghost btn-sm" onclick="document.getElementById('modal-editor-valor').remove()">Cancelar</button>
          <button class="btn btn-primary btn-sm" onclick="_guardarEditorValor()">Guardar</button>
        </div>
      </div>
    </div>`;
  ov.addEventListener('click', e => { if (e.target === ov) ov.remove(); });
  document.body.appendChild(ov);
  _edvRender();
}

function _edvSync() {
  document.querySelectorAll('#edv-body [data-edv-et]').forEach(inp => {
    const i = +inp.dataset.edvEt; if (_edvState.etapas[i]) _edvState.etapas[i].valor = parseFloat(inp.value) || 0;
  });
  ['insumos', 'repuestos'].forEach(tipo => {
    document.querySelectorAll(`#edv-body [data-edv-row="${tipo}"]`).forEach(row => {
      const it = _edvState[tipo][+row.dataset.edvIdx]; if (!it) return;
      it.nombre = row.querySelector('.edv-nom')?.value.trim() || '';
      it.cantidad = parseFloat(row.querySelector('.edv-cant')?.value) || 0;
      it.valor = parseFloat(row.querySelector('.edv-val')?.value) || 0;
    });
  });
}
function _edvTotales() {
  const mo = _edvState.etapas.reduce((s, e) => s + (+e.valor || 0), 0);
  const ins = _edvState.insumos.reduce((s, i) => s + ((+i.cantidad || 0) * (+i.valor || 0)), 0);
  const rep = _edvState.repuestos.reduce((s, i) => s + ((+i.cantidad || 0) * (+i.valor || 0)), 0);
  const sub = mo + ins + rep, iva = Math.round(sub * 0.19);
  return { sub, iva, tot: sub + iva };
}
function _edvActualizarTot() {
  _edvSync();
  const t = _edvTotales(); const el = document.getElementById('edv-tot');
  if (el) el.innerHTML = `Subtotal <strong>${_edvFmt(t.sub)}</strong> · IVA <strong>${_edvFmt(t.iva)}</strong> · Total <strong style="color:var(--azul)">${_edvFmt(t.tot)}</strong>`;
}
function _edvRender() {
  const body = document.getElementById('edv-body'); if (!body) return;
  const lbl = (txt, col) => `<div style="font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.04em;color:${col};margin:10px 0 6px">${txt}</div>`;
  const inCss = 'box-sizing:border-box;padding:6px 8px;border:1px solid var(--gris-borde);border-radius:6px;font-size:12.5px';
  const mo = _edvState.etapas.length
    ? _edvState.etapas.map((e, i) => `<div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
        <span style="flex:1;min-width:0;font-size:13px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escapeHtml(e.nombre)}</span>
        <input data-edv-et="${i}" type="number" min="0" step="1000" value="${e.valor || ''}" placeholder="0" oninput="_edvActualizarTot()" style="${inCss};width:120px;font-family:'DM Mono',monospace;text-align:right">
      </div>`).join('')
    : '<div style="font-size:12px;color:var(--gris-mid)">Sin servicios.</div>';
  const listaItems = (tipo, color) => {
    const arr = _edvState[tipo];
    const filas = arr.length ? arr.map((it, idx) => `<div data-edv-row="${tipo}" data-edv-idx="${idx}" style="display:flex;gap:5px;margin-bottom:6px">
        <input class="edv-nom" value="${escapeHtml(it.nombre)}" placeholder="Nombre" oninput="_edvActualizarTot()" style="${inCss};flex:2;min-width:0">
        <input class="edv-cant" type="number" min="0" step="1" value="${it.cantidad}" oninput="_edvActualizarTot()" style="${inCss};flex:.6;min-width:42px" title="Cantidad">
        <input class="edv-val" type="number" min="0" step="1000" value="${it.valor || ''}" placeholder="Valor" oninput="_edvActualizarTot()" style="${inCss};flex:1;min-width:70px;font-family:'DM Mono',monospace" title="Valor unitario">
        <button class="btn btn-ghost btn-xs" style="flex-shrink:0;color:#DC2626" onclick="_edvDelItem('${tipo}',${idx})">✕</button>
      </div>`).join('') : `<div style="font-size:12px;color:var(--gris-mid);margin-bottom:4px">Ninguno.</div>`;
    return filas + `<button class="btn btn-ghost btn-sm" style="width:100%;color:${color};border:1px dashed var(--gris-borde)" onclick="_edvAddItem('${tipo}')">➕ Agregar</button>`;
  };
  body.innerHTML =
    lbl('🔧 Mano de obra (servicios)', '#1D4ED8') + mo +
    lbl('🛢 Insumos', '#B45309') + listaItems('insumos', '#B45309') +
    lbl('🔧 Repuestos', '#0F766E') + listaItems('repuestos', '#0F766E');
  _edvActualizarTot();
}
function _edvAddItem(tipo) { _edvSync(); _edvState[tipo].push({ nombre: '', cantidad: 1, valor: 0 }); _edvRender(); }
function _edvDelItem(tipo, idx) { _edvSync(); _edvState[tipo].splice(idx, 1); _edvRender(); }
async function _guardarEditorValor() {
  _edvSync();
  const oid = _edvState.ordenId;
  try {
    for (const e of _edvState.etapas) { await api(`/etapas?id=eq.${e.id}`, 'PATCH', { valor_venta: +e.valor || 0 }); }
    const insumos = _edvState.insumos.filter(i => i.nombre || i.valor);
    const repuestos = _edvState.repuestos.filter(i => i.nombre || i.valor);
    await api(`/ordenes?id=eq.${oid}`, 'PATCH', { insumos, repuestos_simple: repuestos });
    if (ordenActual && ordenActual.id === oid) { ordenActual.insumos = insumos; ordenActual.repuestos_simple = repuestos; }
    document.getElementById('modal-editor-valor')?.remove();
    toast('Valor actualizado ✓');
    abrirOrden(oid);
  } catch (e) { toast('Error guardando: ' + e.message, 'err'); }
}

// ============================================================
// [Obsoleto] Panel de insumos anterior (modal). Reemplazado por _panelItemsOrden.
// ============================================================
const _INSUMOS_FRECUENTES_DEFAULT = ['Aceite de motor', 'Filtro de aceite', 'Filtro de aire', 'Filtro de combustible', 'Gasolina', 'Refrigerante', 'Líquido de frenos', 'Grasa'];

function _insumosFrecuentes() {
  let custom = [];
  try { custom = JSON.parse(localStorage.getItem('insumos_frecuentes') || '[]'); } catch (e) { custom = []; }
  if (!Array.isArray(custom)) custom = [];
  const seen = new Set(); const out = [];
  [..._INSUMOS_FRECUENTES_DEFAULT, ...custom].forEach(n => {
    const k = String(n || '').trim().toLowerCase();
    if (k && !seen.has(k)) { seen.add(k); out.push(String(n).trim()); }
  });
  return out.slice(0, 16);
}
function _recordarInsumoFrecuente(nombre) {
  const k = String(nombre || '').trim();
  if (!k || _INSUMOS_FRECUENTES_DEFAULT.some(d => d.toLowerCase() === k.toLowerCase())) return;
  let custom = [];
  try { custom = JSON.parse(localStorage.getItem('insumos_frecuentes') || '[]'); } catch (e) { custom = []; }
  if (!Array.isArray(custom)) custom = [];
  if (custom.some(c => String(c).toLowerCase() === k.toLowerCase())) return;
  custom.push(k);
  try { localStorage.setItem('insumos_frecuentes', JSON.stringify(custom.slice(-20))); } catch (e) {}
}

function _panelInsumosOrden(orden) {
  if (typeof esJefe === 'function' && !esJefe()) return '';
  const oid = orden.id;
  let insumos = [];
  try { const raw = orden.insumos; insumos = Array.isArray(raw) ? raw : (typeof raw === 'string' && raw ? JSON.parse(raw) : []); } catch (e) { insumos = []; }
  const fmt = n => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(n || 0);
  const totalIns = insumos.reduce((s, i) => s + (((+i.cantidad) || 0) * ((+i.valor) || 0)), 0);

  const lista = insumos.length
    ? insumos.map((i, idx) => {
        const cant = (+i.cantidad) || 0, val = (+i.valor) || 0;
        return `<div style="display:flex;align-items:center;gap:8px;padding:7px 9px;border:1px solid var(--gris-borde);border-radius:8px;margin-bottom:6px">
          <div style="flex:1;min-width:0">
            <div style="font-size:12.5px;font-weight:600;color:var(--texto);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escapeHtml(i.nombre || 'Insumo')}</div>
            <div style="font-size:11px;color:var(--gris-mid)">${cant} × ${fmt(val)} = <strong>${fmt(cant * val)}</strong></div>
          </div>
          <button class="btn btn-ghost btn-xs" style="flex-shrink:0;color:#DC2626" title="Quitar" onclick="_eliminarInsumo(${oid},${idx})">✕</button>
        </div>`;
      }).join('')
    : '<div style="font-size:12px;color:var(--gris-mid);padding:2px 0 8px">Aún no hay insumos.</div>';

  // Tarjeta lateral PLEGABLE (cerrada por defecto). El formulario se abre en un
  // popup al tocar "Agregar insumo" (no queda apretado en la barra angosta).
  return `<div class="sidebar-card">
      <div onclick="_toggleInsumos()" id="insumos-header" class="sidebar-card-header" style="gap:8px;cursor:pointer;user-select:none;${_insumosAbierto?'':'background:#FEF3C7;color:#B45309'}">
        <svg id="insumos-chev" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24" style="flex-shrink:0;transition:transform .18s ease;transform:rotate(${_insumosAbierto?'90':'0'}deg)"><polyline points="9 18 15 12 9 6"/></svg>
        <span style="flex:1;min-width:0">🛢 Insumos</span>
        <span style="flex-shrink:0;font-size:10.5px;font-weight:700;text-transform:none;letter-spacing:0;color:${totalIns?'#B45309':'var(--gris-mid)'}">${totalIns ? fmt(totalIns) : (insumos.length ? '' : 'Ninguno')}</span>
      </div>
      <div id="insumos-body" class="sidebar-card-body" style="${_insumosAbierto?'':'display:none'}">
        ${lista}
        <button class="btn btn-ghost btn-sm" style="width:100%;margin-top:6px;color:var(--azul);border:1px dashed var(--gris-borde)" onclick="abrirModalInsumo(${oid})">➕ Agregar insumo</button>
      </div>
    </div>`;
}

let _insumosAbierto = false;
function _toggleInsumos() {
  _insumosAbierto = !_insumosAbierto;
  const body = document.getElementById('insumos-body');
  const chev = document.getElementById('insumos-chev');
  const head = document.getElementById('insumos-header');
  if (body) body.style.display = _insumosAbierto ? '' : 'none';
  if (chev) chev.style.transform = `rotate(${_insumosAbierto ? '90' : '0'}deg)`;
  if (head) { head.style.background = _insumosAbierto ? '' : '#FEF3C7'; head.style.color = _insumosAbierto ? '' : '#B45309'; }
}

// Popup para agregar un insumo: frecuentes + nombre + cantidad + valor unitario.
function abrirModalInsumo(oid) {
  _insumosAbierto = true; // que la tarjeta quede abierta tras agregar
  const inLbl = 'font-size:10px;font-weight:700;color:var(--gris-mid);display:block;margin-bottom:3px';
  const inCss = 'width:100%;box-sizing:border-box;padding:8px 10px;border:1px solid var(--gris-borde);border-radius:7px;font-size:13px';
  const chips = _insumosFrecuentes().map(n =>
    `<button type="button" class="btn btn-ghost btn-xs" style="font-size:11px" onclick="_insumoQuick(${oid},'${encodeURIComponent(n)}')">${escapeHtml(n)}</button>`).join('');
  document.getElementById('modal-insumo')?.remove();
  const ov = document.createElement('div');
  ov.id = 'modal-insumo';
  ov.style.cssText = 'position:fixed;inset:0;z-index:10001;background:rgba(0,0,0,.45);display:flex;align-items:center;justify-content:center;padding:18px';
  ov.innerHTML = `
    <div style="background:var(--surface);border-radius:14px;max-width:440px;width:100%;padding:20px;box-shadow:0 10px 40px rgba(0,0,0,.25);font-family:'DM Sans',sans-serif">
      <div style="font-size:16px;font-weight:800;color:var(--azul);margin-bottom:12px">🛢 Agregar insumo</div>
      ${chips ? `<div style="font-size:11px;color:var(--gris-mid);margin-bottom:5px">Frecuentes:</div><div style="display:flex;flex-wrap:wrap;gap:5px;margin-bottom:12px">${chips}</div>` : ''}
      <div style="margin-bottom:11px"><label style="${inLbl}">Insumo</label><input id="insumo-nom-${oid}" placeholder="Ej. Aceite 15W40" style="${inCss}"></div>
      <div style="display:flex;gap:8px">
        <div style="flex:1"><label style="${inLbl}">Cantidad</label><input id="insumo-cant-${oid}" type="number" min="0" step="1" value="1" style="${inCss}"></div>
        <div style="flex:1.4"><label style="${inLbl}">Valor c/u</label><input id="insumo-val-${oid}" type="number" min="0" step="1000" placeholder="0" style="${inCss};font-family:'DM Mono',monospace" onkeydown="if(event.key==='Enter')_agregarInsumo(${oid})"></div>
      </div>
      <div style="display:flex;gap:8px;margin-top:18px;justify-content:flex-end">
        <button class="btn btn-ghost btn-sm" onclick="document.getElementById('modal-insumo').remove()">Cancelar</button>
        <button class="btn btn-primary btn-sm" onclick="_agregarInsumo(${oid})">Agregar</button>
      </div>
    </div>`;
  ov.addEventListener('click', e => { if (e.target === ov) ov.remove(); });
  document.body.appendChild(ov);
  setTimeout(() => document.getElementById('insumo-nom-' + oid)?.focus(), 30);
}

function _insumoQuick(oid, enc) {
  const inp = document.getElementById('insumo-nom-' + oid);
  if (inp) inp.value = decodeURIComponent(enc);
  document.getElementById('insumo-val-' + oid)?.focus();
}
async function _agregarInsumo(ordenId) {
  const nom = (document.getElementById('insumo-nom-' + ordenId)?.value || '').trim();
  const cant = parseFloat(document.getElementById('insumo-cant-' + ordenId)?.value) || 1;
  const val = parseFloat(document.getElementById('insumo-val-' + ordenId)?.value) || 0;
  if (!nom) { toast('Escribe el nombre del insumo', 'err'); return; }
  if (!val) { toast('Escribe el valor del insumo', 'err'); return; }
  try {
    const o = await api(`/ordenes?id=eq.${ordenId}&select=insumos`).then(r => r?.[0]).catch(() => null);
    let arr = [];
    try { const raw = o && o.insumos; arr = Array.isArray(raw) ? raw : (typeof raw === 'string' && raw ? JSON.parse(raw) : []); } catch (e) { arr = []; }
    arr.push({ nombre: nom, cantidad: cant, valor: val });
    await api(`/ordenes?id=eq.${ordenId}`, 'PATCH', { insumos: arr });
    if (ordenActual && ordenActual.id === ordenId) ordenActual.insumos = arr;
    _recordarInsumoFrecuente(nom);
    document.getElementById('modal-insumo')?.remove();
    toast('Insumo agregado ✓');
    abrirOrden(ordenId);
  } catch (e) { toast('Error agregando insumo (¿falta correr docs/sql-insumos.sql?): ' + e.message, 'err'); }
}
async function _eliminarInsumo(ordenId, idx) {
  try {
    const o = await api(`/ordenes?id=eq.${ordenId}&select=insumos`).then(r => r?.[0]).catch(() => null);
    let arr = [];
    try { const raw = o && o.insumos; arr = Array.isArray(raw) ? raw : (typeof raw === 'string' && raw ? JSON.parse(raw) : []); } catch (e) { arr = []; }
    arr.splice(idx, 1);
    await api(`/ordenes?id=eq.${ordenId}`, 'PATCH', { insumos: arr });
    if (ordenActual && ordenActual.id === ordenId) ordenActual.insumos = arr;
    toast('Insumo eliminado');
    abrirOrden(ordenId);
  } catch (e) { toast('Error: ' + e.message, 'err'); }
}

// ============================================================
// PANEL DE REPUESTOS DENTRO DE LA ORDEN (visible para todos los perfiles)
// Muestra cada repuesto con su estado, mini-barra de pasos, etapa y quién lo
// pidió. Usa la fuente única de estados (REPUESTO_ESTADOS en utils.js) para que
// se vea igual en toda la app. Se refresca cada vez que se abre/recarga la orden.
// ============================================================
function _panelRepuestosOrden(solicitudes, items, etapas) {
  solicitudes = solicitudes || [];
  items = items || [];
  etapas = etapas || [];

  const tituloHtml = (extra) => `<div class="seccion-titulo" style="margin:18px 0 8px;display:flex;align-items:center;justify-content:space-between;gap:10px">
      <span>🔧 Repuestos de la orden</span>${extra || ''}</div>`;

  if (!solicitudes.length) {
    return tituloHtml('') + `<div style="font-size:13px;color:var(--gris-mid);background:var(--surface-2);border:1px dashed var(--gris-borde);border-radius:8px;padding:14px;text-align:center">Sin repuestos solicitados en esta orden.</div>`;
  }

  const activos     = solicitudes.filter(s => s.estado !== 'rechazado');
  const pendientes  = activos.filter(s => REPUESTO_ESTADOS_PENDIENTES.includes(s.estado));
  const resumen = pendientes.length
    ? `<span style="color:#B45309;font-weight:800">⚠ ${pendientes.length} sin completar</span>`
    : `<span style="color:#059669;font-weight:800">✓ Todos entregados</span>`;

  const filas = solicitudes.map(s => {
    const inf = repuestoEstadoInfo(s.estado);
    const its = items.filter(i => i.solicitud_id === s.id);
    const listaItems = its.length
      ? its.map(i => `${escapeHtml(i.repuesto)}${i.unidades > 1 ? ` ×${i.unidades}` : ''}`).join(', ')
      : `${escapeHtml(s.repuesto || 'Repuesto')}${s.unidades > 1 ? ` ×${s.unidades}` : ''}`;
    const et = etapas.find(e => e.id === s.etapa_id);
    const etLabel = et ? ((typeof CATALOGO !== 'undefined' && CATALOGO[et.servicio]?.nombre) || et.etapa || et.servicio) : null;
    const pasos = [1, 2, 3, 4, 5, 6].map(p => {
      const on = s.estado !== 'rechazado' && inf.paso >= p;
      return `<span style="width:14px;height:5px;border-radius:3px;background:${on ? inf.color : '#E5E7EB'};display:inline-block"></span>`;
    }).join('');
    return `<div style="border:1px solid var(--gris-borde);border-left:3px solid ${inf.color};border-radius:8px;padding:10px 12px;margin-bottom:8px;background:var(--surface)">
      <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:6px">
        <div style="font-weight:700;font-size:13px;min-width:0">${listaItems}</div>
        <span style="flex-shrink:0;font-size:11px;font-weight:800;color:${inf.color};background:${inf.bg};padding:3px 10px;border-radius:99px;white-space:nowrap">${inf.icon} ${inf.label}</span>
      </div>
      ${s.estado !== 'rechazado' ? `<div style="display:flex;align-items:center;gap:3px;margin-bottom:6px">${pasos}</div>` : ''}
      <div style="font-size:11px;color:var(--gris-mid)">
        ${etLabel ? `🔧 ${escapeHtml(etLabel)} · ` : ''}Pedido por ${escapeHtml(s.solicitado_por || '—')} · ${formatTS(s.creado_en)}
      </div>
    </div>`;
  }).join('');

  return tituloHtml(`<span style="font-size:12px;font-weight:600">${activos.length} repuesto${activos.length !== 1 ? 's' : ''} · ${resumen}</span>`) + filas;
}

// ============================================================
// ACCIONES DE ETAPAS (JEFE)
// ============================================================
async function iniciarEtapa(eid, nombre) {
  try {
    // Guardia: no iniciar sin técnico asignado (interno o externo).
    const et = await api(`/etapas?id=eq.${eid}&select=mecanico_id,tercero`).then(r => r?.[0]).catch(() => null);
    if (et && !et.mecanico_id && !et.tercero) {
      toast('Asigna un técnico antes de iniciar esta etapa', 'err');
      return;
    }
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
        siguiente_etapa: siguiente ? { id: siguiente.id, nombre: siguiente.etapa, servicio: siguiente.servicio, mecanico_id: siguiente.mecanico_id, tecnico: siguiente.tecnico, precio_tecnico: siguiente.valor || null, precio_tecnico_fmt: siguiente.valor ? new Intl.NumberFormat('es-CO',{style:'currency',currency:'COP',minimumFractionDigits:0}).format(siguiente.valor) : null } : null,
        todas_completadas: todasComp,
        tiempos_etapas: todasComp ? tiemposEtapas : null,
        link: `${window.location.origin}${window.location.pathname}` 
      }) 
    }).catch(() => {});
    // Auto-actualizar consumible si el nombre de la etapa coincide — sin confirmación
    const _kwConsumibles = { aceite: 'aceite', llantas: 'llanta', frenos: 'freno', filtro_aire: 'filtro aire', filtro_combustible: 'filtro combust', bateria: 'bater' };
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
          tecnico:        sesion?.nombre || null,
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
  const vv  = parseFloat(document.getElementById(`vv-${k}`)?.value) || null; // precio venta
  const guardar = async () => {
    try {
      await api(`/etapas?id=eq.${eid}`, 'PATCH', { horas_facturadas: hf, horas_adicionales: ha, valor: val, valor_venta: vv });
      toast('Guardado ✓');
      // Si se asignó/cambió el PRECIO TÉCNICO, avisar al técnico a su chat
      // PERSONAL de Telegram (no al grupo) con el valor.
      if (val != null && (!prev || prev.valor != val)) _notificarPrecioTecnico(eid, val);
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

// Editar la descripción de una etapa/servicio (solo jefe/gerente). Abre/cierra
// el editor en línea dentro de la tarjeta de la etapa.
function _editarDescEtapa(k) {
  const ed = document.getElementById('desc-etapa-editor-' + k);
  const tx = document.getElementById('desc-etapa-text-' + k);
  if (!ed) return;
  const abrir = ed.style.display === 'none';
  ed.style.display = abrir ? 'block' : 'none';
  if (tx) tx.style.display = abrir ? 'none' : '';
}
async function _guardarDescEtapa(eid, k) {
  if (typeof esJefe === 'function' && !esJefe()) { toast('Solo jefe/gerente puede editar la descripción', 'err'); return; }
  const inp = document.getElementById('desc-etapa-input-' + k);
  const txt = inp ? inp.value.trim() : '';
  try {
    await api(`/etapas?id=eq.${eid}`, 'PATCH', { descripcion: txt || null });
    toast('Descripción guardada ✓');
    if (ordenActual) abrirOrden(ordenActual.id);
  } catch (e) { toast('Error: ' + e.message, 'err'); }
}

// Notifica al técnico, a su chat PERSONAL de Telegram (n8n usa telegram_chat_id
// para mandarlo solo a él, no al grupo), el precio técnico que el jefe asignó.
async function _notificarPrecioTecnico(eid, valor) {
  const fmtCOP = n => new Intl.NumberFormat('es-CO', { style:'currency', currency:'COP', minimumFractionDigits:0 }).format(n || 0);
  try {
    const et = await api(`/etapas?id=eq.${eid}&select=mecanico_id,etapa,servicio,orden_id,tecnico`).then(r => r?.[0]).catch(() => null);
    if (!et) return;
    // Técnico externo: no tiene chat personal → avisar al jefe para que no quede en silencio.
    if (!et.mecanico_id) {
      toast(`⚠ ${et.tecnico || 'Técnico externo'}: no tiene Telegram personal, no se le pudo avisar el precio (${fmtCOP(valor)})`, 'warn');
      return;
    }
    const mec = await api(`/mecanicos?id=eq.${et.mecanico_id}&select=nombre,telegram_chat_id`).then(r => r?.[0]).catch(() => null);
    // Sin chat personal configurado → avisar al jefe con acción clara.
    if (!mec?.telegram_chat_id) {
      toast(`⚠ ${mec?.nombre || 'El técnico'} no tiene Telegram personal configurado. Configúralo en Operarios para que reciba su precio.`, 'warn');
      return;
    }
    const orden = (ordenActual && ordenActual.id === et.orden_id)
      ? ordenActual
      : await api(`/ordenes?id=eq.${et.orden_id}&select=placa,marca,linea`).then(r => r?.[0]).catch(() => null);
    await fetch(N8N_WEBHOOK, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        evento: 'precio_tecnico',
        telegram_chat_id: mec.telegram_chat_id,         // PERSONAL — n8n NO lo manda al grupo
        tecnico: mec.nombre || et.tecnico || '',
        etapa: et.etapa || et.servicio || '',
        placa: orden?.placa || '',
        vehiculo: [orden?.marca, orden?.linea].filter(Boolean).join(' ') || '',
        ot: (typeof formatOT === 'function') ? formatOT(et.orden_id) : ('OT-' + et.orden_id),
        precio_tecnico: valor,
        precio_tecnico_fmt: fmtCOP(valor)
      })
    });
    // Confirmación al jefe + registro persistente en el historial de la orden.
    toast(`✓ Precio ${fmtCOP(valor)} enviado al Telegram de ${mec.nombre}`, 'ok');
    _logEstado(et.orden_id, `💰 Precio técnico ${fmtCOP(valor)} avisado a ${mec.nombre} por Telegram · ${et.etapa || et.servicio || 'etapa'}`);
  } catch (e) {
    console.warn('[precio técnico] notif:', e);
    toast('⚠ No se pudo enviar el aviso de precio al técnico (revisa la conexión/automatización).', 'err');
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

