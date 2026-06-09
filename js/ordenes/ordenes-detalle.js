// ═══════════════════════════════════════════════════════════
// ÓRDENES — DETALLE Y ETAPAS
// ═══════════════════════════════════════════════════════════

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
                <div class="det-dato-fila"><span class="det-dato-lbl">Dirección</span><span class="det-dato-val${!orden.direccion?' det-dato-vacio':''}">${escapeHtml(orden.direccion||'')||'—'}</span></div>
                <div class="det-dato-fila"><span class="det-dato-lbl">Tipo cliente</span><span class="det-dato-val">${escapeHtml(orden.tipo_cliente||'')||'—'}</span></div>
                <div class="det-dato-fila"><span class="det-dato-lbl">${orden.tipo_cliente==='flotilla'?'Flotilla':orden.tipo_cliente==='empresa'?'Empresa':'Aseguradora'}</span><span class="det-dato-val">${escapeHtml(orden.aseguradora||'')||'—'}</span></div>
              </div>
            </div>
          </div>
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">
            <div class="seccion-titulo" style="margin-bottom:0">Servicios y Etapas</div>
            ${esJefe() && orden.estado !== 'Programada' && orden.estado !== 'Entregada' && orden.estado !== 'Archivada' ? '<button class="btn btn-ghost btn-sm" onclick="abrirModalAgregar()">+ Agregar etapas</button>' : ''}
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
          ${orden.tipo_cliente === 'aseguradora' && esJefe() ? `
          <div class="sidebar-card">
            <div class="sidebar-card-header" style="background:#ECFDF5;color:#047857">Precio venta a cliente</div>
            <div class="sidebar-card-body">
              <div style="font-size:11px;color:var(--gris-mid);margin-bottom:8px">Es el total que verá la <strong>aseguradora</strong> en la orden de trabajo (sin detalle de procesos). Solo lo ven jefe y gerente.</div>
              <div style="display:flex;gap:6px">
                <input id="precio-venta-${orden.id}" type="number" min="0" step="1000" placeholder="0" value="${orden.precio_venta_cliente||''}" style="flex:1;min-width:0;padding:7px 9px;border:1.5px solid var(--gris-borde);border-radius:6px;font-size:13px;font-family:'DM Mono',monospace">
                <button class="btn btn-primary btn-sm" onclick="guardarPrecioVentaCliente(${orden.id})">Guardar</button>
              </div>
              ${orden.precio_venta_cliente ? `<div style="font-size:12px;color:var(--verde);font-weight:600;margin-top:8px">Total a cliente: ${new Intl.NumberFormat('es-CO',{style:'currency',currency:'COP',minimumFractionDigits:0}).format(orden.precio_venta_cliente)}</div>` : ''}
            </div>
          </div>` : ''}
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

