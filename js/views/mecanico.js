// ═══════════════════════════════════════════════════════════
// PERFIL MECÁNICO - MIS ETAPAS
// ═══════════════════════════════════════════════════════════

function montarMecanico() {
  const sidebarNav = document.getElementById('sidebar-nav');
  if (sidebarNav) {
    sidebarNav.innerHTML = `
      <div class="nav-section-label">Mis asignaciones</div>
      <button class="nav-item active" id="nav-mec-ordenes" onclick="navMec('ordenes')">
        <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z"/></svg>
        Mis órdenes
      </button>
      <button class="nav-item" id="nav-mec-historial" onclick="navMec('historial')">
        <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
        Mi historial
      </button>
    `;
  }
  
  const bottomNav = document.getElementById('bottom-nav-inner');
  if (bottomNav) {
    bottomNav.innerHTML = `
      <button class="bnav-item active" id="bnav-mec-ordenes" onclick="navMec('ordenes')">
        <svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z"/></svg>
        <span>Mis órdenes</span>
      </button>
      <button class="bnav-item" id="bnav-mec-historial" onclick="navMec('historial')">
        <svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
        <span>Historial</span>
      </button>
    `;
  }
  navMec('ordenes');
  // Verificar repuestos llegados cada 30 segundos
  actualizarBadgeMecRepuestos();
  setInterval(actualizarBadgeMecRepuestos, 30000);
}

async function actualizarBadgeMecRepuestos() {
  if (!sesion?.nombre) return;
  try {
    const llegados = await api(
      `/solicitudes_repuesto?solicitado_por=eq.${encodeURIComponent(sesion.nombre)}&estado=eq.recibido_taller&select=id`
    ).catch(() => []) || [];
    // Indicador neón en "Mis órdenes" cuando hay repuestos llegados
    if (typeof _setNavBadge === 'function') _setNavBadge('nav-mec-ordenes', llegados.length);
  } catch(e) {}
}

function navMec(pag) {
  if (typeof _navMarcarVisto === 'function') _navMarcarVisto('nav-mec-' + pag);
  ['ordenes','historial'].forEach(p => {
    const nb = document.getElementById('nav-mec-'+p);
    const bb = document.getElementById('bnav-mec-'+p);
    if (nb) nb.classList.toggle('active', p===pag);
    if (bb) bb.classList.toggle('active', p===pag);
  });
  const titles = { ordenes:'Mis Órdenes', historial:'Mi Historial' };
  const pages  = { ordenes:'pag-mecanico', historial:'pag-mec-historial' };
  mostrarPagina(pages[pag]||'pag-mecanico');
  const title = document.getElementById('topbar-title');
  if (title) title.textContent = titles[pag]||'Mis Órdenes';
  if (pag==='ordenes') cargarEtapasMecanico();
  if (pag==='historial') cargarHistorialMecanico();
  closeSidebar();
}

// Estado del repuesto en lenguaje simple para el técnico, con mini barra de
// progreso para que entienda en qué punto va su solicitud.
function _repuestoEstadoTecnico(sol) {
  const MAP = {
    pendiente_jefe:    { txt: 'Solicitado',        sub: 'Esperando que el jefe lo apruebe',         step: 1 },
    enviado_repuestos: { txt: 'En cotización',     sub: 'Repuestos está buscando el precio',        step: 2 },
    cotizado:          { txt: 'Cotizado',          sub: 'Esperando que el jefe apruebe el precio',  step: 3 },
    pedido:            { txt: 'Pedido',            sub: 'Pedido al proveedor, viene en camino',     step: 4 },
    recibido_taller:   { txt: '¡Llegó al taller!', sub: 'Pídeselo al jefe para continuar',          step: 5 }
  };
  const m = MAP[sol.estado] || MAP.pendiente_jefe;
  const total = 5;
  const segs = Array.from({ length: total }, (_, i) =>
    `<div style="flex:1;height:5px;border-radius:99px;background:${i < m.step ? '#D97706' : '#FDE68A'}"></div>`
  ).join('');
  return `<div style="width:100%;background:#FFFBEB;border:1px solid #FDE68A;border-radius:8px;padding:7px 10px">
    <div style="font-size:12.5px;font-weight:700;color:#92400E;display:flex;align-items:center;gap:5px">📦 Repuesto: ${m.txt}</div>
    <div style="font-size:11px;color:#B45309;margin-top:1px">${m.sub} · paso ${m.step}/${total}</div>
    <div style="display:flex;gap:3px;margin-top:6px">${segs}</div>
  </div>`;
}

async function cargarEtapasMecanico() {
  const cont = document.getElementById('mec-contenido');
  if (!cont) return;
  cont.innerHTML = '<div class="loading-state">Cargando tus órdenes...</div>';
  try {
    const etapas = await api(`/etapas?mecanico_id=eq.${sesion.id}&order=creado_en.asc`) || [];
    if (!etapas.length) {
      cont.innerHTML = `<div class="empty-state"><div class="empty-state-icon">${ico('check', 32)}</div><p>No tienes etapas asignadas por el momento.</p></div>`;
      return;
    }

    const ids = [...new Set(etapas.map(e => e.orden_id))];
    const etapaIds = etapas.map(e => e.id).join(',');
    const [ordenes, solicitudes, aprobaciones] = await Promise.all([
      api(`/ordenes?id=in.(${ids.join(',')})`).catch(() => []),
      api(`/solicitudes_repuesto?orden_id=in.(${ids.join(',')})&order=creado_en.desc&select=*`).catch(() => []),
      etapaIds ? api(`/aprobaciones_etapa?etapa_id=in.(${etapaIds})&order=creado_en.desc&select=etapa_id,estado,observacion`).catch(() => []) : []
    ]);
    // Mapa: etapa_id → última aprobación
    const aprobMap = {};
    (aprobaciones || []).forEach(a => { if (!aprobMap[a.etapa_id]) aprobMap[a.etapa_id] = a; });

    const porOrden = {};
    etapas.forEach(e => {
      if (!porOrden[e.orden_id]) porOrden[e.orden_id] = [];
      porOrden[e.orden_id].push(e);
    });


    cont.innerHTML = Object.entries(porOrden).map(([oid, ets]) => {
      const orden = ordenes.find(o => o.id == oid) || {};
      const etapsHtml = ets.map(e => {
        const esPausado = e.pausado && !e.fin;
        const ultimaAprob = aprobMap[e.id] || null;
        const fueRechazada = ultimaAprob?.estado === 'rechazado';
        const badge = !e.inicio ? 'Pendiente'
          : e.fin ? (fueRechazada ? '✗ Rechazada' : 'Completada')
          : esPausado ? 'Pausado ⏸' : 'En proceso';
        const bCls  = !e.inicio ? 'pendiente'
          : e.fin ? (fueRechazada ? 'rechazado' : 'completada')
          : esPausado ? 'pendiente' : 'iniciada';
        const hayActiva = ets.some(x => x.inicio && !x.fin);
        let acc = '';
        const placa = escapeHtml(orden.placa || '');
        if (!e.inicio && !hayActiva)
          acc = `<button class="btn btn-success btn-sm" data-eid="${e.id}" data-etapa="${escapeHtml(e.etapa || '')}" data-oid="${oid}" onclick="event.stopPropagation();mecIniciarEtapa(+this.dataset.eid,this.dataset.etapa,+this.dataset.oid)">▶ Iniciar</button>`;
        else if (e.inicio && !e.fin && esPausado) {
          const solPend = solicitudes.find(s => s.orden_id == oid && s.etapa_id == e.id && ['pendiente_jefe','enviado_repuestos','cotizado','pedido','recibido_taller'].includes(s.estado));
          acc = solPend
            ? _repuestoEstadoTecnico(solPend)
            : `<button class="btn btn-success btn-sm" onclick="event.stopPropagation();mecReanudarEtapa(${e.id},${oid})">▶ Reanudar</button>`;
        } else if (e.inicio && !e.fin) {
          const avisoRechazo = fueRechazada
            ? `<div style="background:#FEE2E2;border:1px solid #FECACA;border-radius:6px;padding:6px 10px;font-size:12px;color:#DC2626;font-weight:600;margin-bottom:6px;width:100%">
                ✗ El jefe rechazó esta etapa — corrígela y finaliza de nuevo
                ${ultimaAprob?.observacion ? `<div style="font-weight:400;margin-top:2px;color:#B91C1C">"${escapeHtml(ultimaAprob.observacion)}"</div>` : ''}
               </div>` : '';
          acc = avisoRechazo + `<button class="btn btn-danger btn-sm" data-eid="${e.id}" data-etapa="${escapeHtml(e.etapa || '')}" data-srv="${escapeHtml(e.servicio || '')}" data-oid="${oid}" onclick="event.stopPropagation();mecFinalizarEtapa(+this.dataset.eid,this.dataset.etapa,this.dataset.srv,+this.dataset.oid)">${fueRechazada ? '■ Reenviar a calidad' : '■ Finalizar'}</button>`;
        } else if (e.fin)
          acc = `<span class="badge badge-completada">Completada ✓</span>`;
        else
          acc = `<span style="font-size:12px;color:var(--gris-mid)">Esperando turno</span>`;

        // Tiempo trabajado (descontando pausas)
        let tiempoStr = '';
        if (e.inicio && !e.fin) {
          let pausadoAcum = e.tiempo_pausado_min || 0;
          if (esPausado && e.pausa_inicio) {
            pausadoAcum += Math.max(0, Math.round((Date.now() - new Date(e.pausa_inicio).getTime()) / 60000));
          }
          const m = Math.max(0, Math.round((Date.now() - new Date(e.inicio).getTime()) / 60000) - pausadoAcum);
          tiempoStr = ` · ${Math.floor(m/60)}h ${m%60}m trabajados`;
        }

        return `<div class="mec-etapa-item" style="${esPausado ? 'background:rgba(254,243,199,.35);border-left:3px solid #F59E0B' : ''}">
          <div style="flex:1">
            <div style="font-weight:600;font-size:14px">${escapeHtml(e.etapa) || '—'}</div>
            <div style="font-size:11px;color:var(--gris-mid);margin-top:2px">
              ${escapeHtml(CATALOGO[e.servicio]?.nombre || e.servicio) || '—'}
              ${e.inicio ? ' · Inicio: ' + formatTS(e.inicio) : ''}
              ${e.fin ? ' · Fin: ' + formatTS(e.fin) : tiempoStr}
            </div>
            ${e.descripcion ? `<div style="font-size:12px;color:#1E40AF;background:#EFF6FF;border-radius:5px;padding:5px 9px;margin-top:5px;line-height:1.4;white-space:pre-wrap">${escapeHtml(e.descripcion)}</div>` : ''}
            ${e.valor ? `<div style="display:inline-flex;align-items:center;gap:5px;font-size:12px;color:var(--verde);font-weight:700;background:var(--verde-bg);border-radius:5px;padding:3px 9px;margin-top:5px">💵 Tu precio: ${new Intl.NumberFormat('es-CO',{style:'currency',currency:'COP',minimumFractionDigits:0}).format(e.valor)}</div>` : ''}
            ${esPausado ? `<div style="font-size:11px;color:#D97706;margin-top:3px;font-weight:600">⏸ Etapa pausada — esperando repuesto del jefe de taller</div>` : ''}
          </div>
          <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap">
            <span class="badge badge-${bCls}">${badge}</span>
            ${acc}
            ${e.inicio && !e.fin && !esPausado ? `<button class="btn btn-ghost btn-xs" style="border:1.5px solid #D97706;color:#D97706" onclick="event.stopPropagation();abrirNovedadMenu(${e.id},${oid},'${placa}')">⚑ Novedad</button>` : ''}
            <button class="btn btn-ghost btn-xs" onclick="event.stopPropagation();abrirMecDetalle(${e.id},${oid})">🖼 Fotos</button>
          </div>
        </div>`;
      }).join('');


      return `<div class="mec-orden-card" onclick="abrirOrdenMecanico(${oid})" style="cursor:pointer">
        <div class="mec-orden-header">
          <div>
            <div style="font-family:'DM Mono',monospace;font-size:20px;font-weight:500;letter-spacing:2px">${escapeHtml(orden.placa) || '—'}</div>
            <div style="font-family:'DM Mono',monospace;font-size:11px;color:var(--gris-mid);letter-spacing:.05em">OT-${String(oid).padStart(4,'0')}</div>
            <div style="font-size:13px;color:var(--gris-mid);margin-top:3px">${[orden.marca, orden.linea, orden.modelo].filter(Boolean).map(escapeHtml).join(' · ') || 'Sin datos'}</div>
          </div>
          <div style="text-align:right">
            ${orden.pulmon ? '<span class="badge badge-pulmon">En Pulmón</span>' : ''}
            <div style="font-size:11px;color:var(--gris-mid);font-family:'DM Mono',monospace;margin-top:4px">${formatFecha(orden.creado_en)}</div>
          </div>
        </div>
        ${etapsHtml}
      </div>`;
    }).join('');
  } catch(e) {
    cont.innerHTML = `<div class="empty-state">Error: ${e.message}</div>`;
  }
}

async function mecIniciarEtapa(eid, nombre, oid) {
  try {
    await api(`/etapas?id=eq.${eid}`, 'PATCH', { inicio: new Date().toISOString() });
    toast(`${nombre} iniciada ✓`);
    await new Promise(r => setTimeout(r, 250));
    cargarEtapasMecanico();
  } catch(e) { toast('Error: ' + e.message, 'err'); }
}

async function mecFinalizarEtapa(eid, nombre, servicio, oid) {
  try {
    await api(`/etapas?id=eq.${eid}`, 'PATCH', { fin: new Date().toISOString() });
    toast(`${nombre} finalizada ✓`);
    
    const etapasOrden = await api(`/etapas?orden_id=eq.${oid}&order=creado_en.asc`);
    const etapaActual = etapasOrden.find(e => e.id === eid);
    const etapasMismoSrv = etapasOrden.filter(e => e.servicio === (etapaActual?.servicio || servicio));
    const idxEnSrv = etapasMismoSrv.findIndex(e => e.id === eid);
    const siguiente = etapasMismoSrv.slice(idxEnSrv + 1).find(e => !e.fin) || null;
    const todasComp = etapasOrden.every(e => e.fin || e.id === eid);
    const orden = await api(`/ordenes?id=eq.${oid}`).then(d => d[0]).catch(() => ({}));
    
    fetch(N8N_WEBHOOK, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        evento: todasComp ? 'orden_completada' : 'etapa_finalizada',
        orden: { id: oid, placa: orden.placa, propietario: orden.propietario, marca: orden.marca, linea: orden.linea, aseguradora: orden.aseguradora },
        etapa_finalizada: { id: eid, nombre, servicio: etapaActual?.servicio || servicio, tecnico: etapaActual?.tecnico || null },
        siguiente_etapa: siguiente ? { id: siguiente.id, nombre: siguiente.etapa, servicio: siguiente.servicio, mecanico_id: siguiente.mecanico_id, tecnico: siguiente.tecnico, precio_tecnico: siguiente.valor || null, precio_tecnico_fmt: siguiente.valor ? new Intl.NumberFormat('es-CO',{style:'currency',currency:'COP',minimumFractionDigits:0}).format(siguiente.valor) : null } : null,
        todas_completadas: todasComp,
        link: `${window.location.origin}${window.location.pathname}`
      })
    }).catch(() => {});
    
    cargarEtapasMecanico();
  } catch(e) { toast('Error: ' + e.message, 'err'); }
}

let mecEtapaActual = null;

async function abrirMecDetalle(eid, oid) {
  mostrarPagina('pag-mec-detalle');
  const title = document.getElementById('topbar-title');
  if (title) title.textContent = 'Fotos';
  const cont = document.getElementById('mec-detalle-contenido');
  if (!cont) return;
  cont.innerHTML = '<div class="loading-state">Cargando...</div>';
  try {
    const [etapa, orden, fotos, novedades] = await Promise.all([
      api(`/etapas?id=eq.${eid}`).then(d => d[0]),
      api(`/ordenes?id=eq.${oid}`).then(d => d[0]),
      api(`/fotos_etapas?etapa_id=eq.${eid}&order=creado_en.desc`).catch(() => []) || [],
      api(`/novedades?etapa_id=eq.${eid}&order=creado_en.desc`).catch(() => []) || []
    ]);
    mecEtapaActual = { eid, oid, etapa, orden };
    const k = kid(eid);

    const fotosHtml = fotos.map(f => `
      <div class="foto-thumb" data-url="${escapeHtml(f.url)}" onclick="abrirLightbox(this.dataset.url)">
        <img src="${escapeHtml(f.url)}" alt="">
        <button class="foto-delete" data-fid="${f.id}" data-url="${escapeHtml(f.url)}" data-eid="${eid}" data-oid="${oid}" onclick="event.stopPropagation();eliminarFotoMec(+this.dataset.fid,this.dataset.url,+this.dataset.eid,+this.dataset.oid)">✕</button>
      </div>`).join('');

    const novsHtml = novedades.length ? novedades.map(n => `
      <div class="novedad-item">
        <div class="novedad-item-top">
          <span class="novedad-tipo ${escapeHtml((n.tipo || '').toLowerCase())}">${escapeHtml(n.tipo)}</span>
          <span class="novedad-fecha">${formatTS(n.creado_en)}</span>
        </div>
        <div class="novedad-motivo">${escapeHtml(n.motivo) || '—'}</div>
        ${n.foto_url ? `<img src="${escapeHtml(n.foto_url)}" class="novedad-foto" loading="lazy" onclick="abrirLightbox(this.src)" alt="Foto de la novedad">` : ''}
      </div>`).join('')
      : '<div style="font-size:12px;color:var(--gris-mid);padding:4px 0">Sin novedades.</div>';

    cont.innerHTML = `
      <div class="card" style="padding:24px;margin-bottom:14px">
        <div style="font-family:'DM Mono',monospace;font-size:20px;letter-spacing:2px;font-weight:500;margin-bottom:4px">${escapeHtml(orden.placa) || '—'}</div>
        <div style="font-size:13px;color:var(--gris-mid);margin-bottom:16px">${escapeHtml(etapa.etapa) || '—'} · ${escapeHtml(CATALOGO[etapa.servicio]?.nombre || etapa.servicio) || '—'}</div>
        <div class="seccion-titulo">Fotos (${fotos.length})</div>
        <div class="fotos-grid" id="mec-fotos-grid">${fotosHtml}</div>
        <div class="upload-zone" onclick="document.getElementById('mec-fi-${k}').click()" style="margin-top:10px">
          <input type="file" id="mec-fi-${k}" accept="image/*" multiple onchange="mecSubirFotos(this,${eid},'${etapa.etapa || ''}',${oid})">
          <div style="opacity:0.45">${ico('camera', 20)}</div>
          <p>Subir fotos</p>
          <div class="upload-prog" id="mec-prog-${k}"></div>
        </div>
      </div>
      ${novedades.length ? `<div class="card" style="padding:24px">
        <div class="seccion-titulo">Novedades registradas</div>
        <div id="mec-novs-${eid}">${novsHtml}</div>
      </div>` : ''}`;
  } catch(e) { 
    cont.innerHTML = `<div class="empty-state">Error: ${e.message}</div>`; 
  }
}

function volverAMecOrdenes() {
  navMec('ordenes');
}

async function mecSubirFotos(input, eid, nombre, oid) {
  const files = Array.from(input.files);
  if (!files.length) return;
  const k = kid(eid);
  const prog = document.getElementById(`mec-prog-${k}`);
  let sub = 0;
  for (const file of files) {
    try {
      const comp = await comprimirImagenFile(file);
      const path = `${oid}/etapas/${eid}_${Date.now()}.jpg`;
      const url = await storageUpload(comp, path);
      await api('/fotos_etapas', 'POST', { etapa_id: eid, orden_id: oid, etapa_nombre: nombre, url, nombre: file.name }, { Prefer: 'return=minimal' });
      sub++;
      if (prog) prog.textContent = `Subiendo ${sub}/${files.length}...`;
    } catch(e) { toast(`Error: ${file.name}`, 'err'); }
  }
  if (prog) prog.textContent = '';
  input.value = '';
  toast(`${sub} foto(s) subida(s) ✓`);
  // Si la etapa aún no estaba "iniciada", marcarla EN PROCESO al documentar
  // trabajo (subir fotos), para que el cliente vea el avance aunque el técnico
  // no haya pulsado "Iniciar". Solo si no hay otra etapa activa en la orden.
  if (sub > 0) {
    try {
      const et = await api(`/etapas?id=eq.${eid}&select=inicio,fin`).then(r => r?.[0]).catch(() => null);
      if (et && !et.inicio && !et.fin) {
        const otras = await api(`/etapas?orden_id=eq.${oid}&inicio=not.is.null&fin=is.null&select=id`).catch(() => []) || [];
        if (!otras.length) await api(`/etapas?id=eq.${eid}`, 'PATCH', { inicio: new Date().toISOString() });
      }
    } catch(e) {}
  }
  abrirMecDetalle(eid, oid);
}

async function eliminarFotoMec(fotoId, url, eid, oid) {
  if (!confirm('¿Eliminar esta foto?')) return;
  try {
    await api(`/fotos_etapas?id=eq.${fotoId}`, 'DELETE');
    const path = url.split(`/object/public/${BUCKET}/`)[1];
    if (path) await fetch(`${SUPABASE_URL}/storage/v1/object/${BUCKET}/${path}`, { method: 'DELETE', headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${_getBearer()}` } });
    toast('Foto eliminada ✓');
    abrirMecDetalle(eid, oid);
  } catch(e) { toast('Error: ' + e.message, 'err'); }
}

async function mecGuardarNovedad(eid, oid) {
  const motivo = document.getElementById(`mec-nmot-${eid}`)?.value?.trim();
  if (!motivo) { toast('El motivo es obligatorio', 'err'); return; }
  try {
    await api('/novedades', 'POST', {
      orden_id: oid, etapa_id: eid,
      tipo: document.getElementById(`mec-ntype-${eid}`).value,
      responsable: sesion.nombre,
      motivo, desde: new Date().toISOString()
    }, { Prefer: 'return=minimal' });
    toast('Novedad registrada ✓');
    const input = document.getElementById(`mec-nmot-${eid}`);
    if (input) input.value = '';
    abrirMecDetalle(eid, oid);
  } catch(e) { toast('Error: ' + e.message, 'err'); }
}
// ═══════════════════════════════════════════════════════════
// SOLICITUD RÁPIDA DE REPUESTO (desde tarjeta de orden)
// ═══════════════════════════════════════════════════════════

// Abre el formulario multi-ítem de repuestos (delegado a repuestos.js)
function abrirSolicitudRapida(ordenId, placa) {
  abrirModalSolicitudRepuesto(ordenId, null, placa);
}

// ── Menú de Novedad (detener / solicitar repuesto) ────────
function abrirNovedadMenu(etapaId, ordenId, placa) {
  const existing = document.getElementById('_novedadMenu');
  if (existing) existing.remove();

  const overlay = document.createElement('div');
  overlay.id = '_novedadMenu';
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:9999;display:flex;align-items:center;justify-content:center;padding:16px';
  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
  overlay.innerHTML = `
    <div style="background:white;border-radius:14px;padding:24px;width:100%;max-width:380px;box-shadow:0 20px 60px rgba(0,0,0,.25)" onclick="event.stopPropagation()">
      <div style="font-family:'DM Mono',monospace;font-size:16px;font-weight:700;margin-bottom:4px">${escapeHtml(placa)}</div>
      <div style="font-size:12px;color:var(--gris-mid);margin-bottom:20px">¿Por qué se detiene la etapa?</div>

      <button class="btn btn-primary" style="width:100%;margin-bottom:10px;display:flex;align-items:center;gap:10px;padding:14px 16px;justify-content:flex-start"
        onclick="document.getElementById('_novedadMenu').remove();abrirModalSolicitudRepuesto(${ordenId},${etapaId||'null'},'${escapeHtml(placa).replace(/'/g,'\\x27')}')">
        <span style="font-size:20px">📦</span>
        <div style="text-align:left">
          <div style="font-weight:700;font-size:14px">Solicitar repuesto</div>
          <div style="font-size:11px;opacity:.8;margin-top:1px">Pedir pieza al jefe de taller — pausa el timer</div>
        </div>
      </button>

      <button class="btn btn-ghost" style="width:100%;margin-bottom:10px;display:flex;align-items:center;gap:10px;padding:14px 16px;justify-content:flex-start;border:1.5px solid var(--gris-borde)"
        onclick="_mostrarFormDetenerOtro(${etapaId||'null'},${ordenId})">
        <span style="font-size:20px">⛔</span>
        <div style="text-align:left">
          <div style="font-weight:700;font-size:14px">Otro motivo de detención</div>
          <div style="font-size:11px;color:var(--gris-mid);margin-top:1px">Daño, espera, cliente, etc.</div>
        </div>
      </button>

      <div id="_detenerOtroForm" style="display:none;margin-top:4px">
        <div class="field" style="margin-bottom:10px">
          <label>Motivo *</label>
          <textarea id="_detMotivo" placeholder="Describe el motivo de la detención..." style="min-height:60px"></textarea>
        </div>
        <div class="field" style="margin-bottom:10px">
          <label>Foto (opcional) — la verá el cliente</label>
          <input type="file" id="_detFotoInput" accept="image/*" style="display:none" onchange="_subirFotoDetencion(this)">
          <div id="_detFotoZona">
            <button type="button" class="btn btn-ghost btn-sm" style="width:100%;border:1.5px dashed var(--gris-borde)" onclick="document.getElementById('_detFotoInput').click()">📷 Adjuntar foto</button>
          </div>
        </div>
        <div style="display:flex;gap:8px;justify-content:flex-end">
          <button class="btn btn-ghost btn-sm" onclick="document.getElementById('_novedadMenu').remove()">Cancelar</button>
          <button class="btn btn-danger btn-sm" onclick="_confirmarDetencion(${etapaId||'null'},${ordenId})">Detener etapa</button>
        </div>
      </div>

      <button class="btn btn-ghost btn-sm" style="width:100%;margin-top:4px" onclick="document.getElementById('_novedadMenu').remove()">Cancelar</button>
    </div>`;
  document.body.appendChild(overlay);
}

// Foto opcional de la novedad/detención (URL en Storage; la BD solo guarda el link).
let _detFotoUrl = null;
let _detCtx = {};

function _mostrarFormDetenerOtro(etapaId, ordenId) {
  _detFotoUrl = null;
  _detCtx = { etapaId, ordenId };
  const form = document.getElementById('_detenerOtroForm');
  if (form) { form.style.display = 'block'; document.getElementById('_detMotivo')?.focus(); }
}

// Sube la foto de la novedad COMPRIMIDA (~150-300KB) a Storage y guarda el link.
async function _subirFotoDetencion(input) {
  const file = input.files && input.files[0];
  if (!file) return;
  const zona = document.getElementById('_detFotoZona');
  if (zona) zona.innerHTML = '<div style="font-size:12px;color:var(--gris-mid);padding:8px 0">Subiendo foto…</div>';
  try {
    const comprimida = await comprimirImagenFile(file, 1400, 0.72);
    const path = `${_detCtx.ordenId || 'sin'}/novedades/${Date.now()}.jpg`;
    _detFotoUrl = await storageUpload(comprimida, path);
    if (zona) zona.innerHTML = `
      <div style="display:flex;align-items:center;gap:10px">
        <img src="${escapeHtml(_detFotoUrl)}" style="width:54px;height:54px;object-fit:cover;border-radius:8px">
        <span style="font-size:12px;color:var(--verde);font-weight:600">✓ Foto lista</span>
        <button type="button" class="btn btn-ghost btn-xs" style="margin-left:auto" onclick="_quitarFotoDetencion()">Quitar</button>
      </div>`;
  } catch (e) {
    _detFotoUrl = null;
    if (zona) zona.innerHTML = `<button type="button" class="btn btn-ghost btn-sm" style="width:100%;border:1.5px dashed var(--rojo)" onclick="document.getElementById('_detFotoInput').click()">⚠ Error — reintentar</button>`;
    toast('No se pudo subir la foto', 'err');
  }
}
function _quitarFotoDetencion() {
  _detFotoUrl = null;
  const input = document.getElementById('_detFotoInput'); if (input) input.value = '';
  const zona = document.getElementById('_detFotoZona');
  if (zona) zona.innerHTML = `<button type="button" class="btn btn-ghost btn-sm" style="width:100%;border:1.5px dashed var(--gris-borde)" onclick="document.getElementById('_detFotoInput').click()">📷 Adjuntar foto</button>`;
}

async function _confirmarDetencion(etapaId, ordenId) {
  const motivo = document.getElementById('_detMotivo')?.value?.trim();
  if (!motivo) { toast('Escribe el motivo', 'err'); return; }
  try {
    if (etapaId) {
      await api(`/etapas?id=eq.${etapaId}`, 'PATCH', {
        pausado: true, pausa_inicio: new Date().toISOString()
      });
      // foto_url solo se incluye si hay foto, para no romper si aún no se corrió
      // el ALTER TABLE (docs/sql-novedades-foto.sql).
      const _nov = {
        orden_id: ordenId, etapa_id: etapaId,
        tipo: 'Detenido', responsable: sesion.nombre,
        motivo, desde: new Date().toISOString()
      };
      if (_detFotoUrl) _nov.foto_url = _detFotoUrl;
      await api('/novedades', 'POST', _nov, { Prefer: 'return=minimal' }).catch(() => {});
    }
    _detFotoUrl = null;
    document.getElementById('_novedadMenu')?.remove();
    toast('Etapa pausada — ⏸ ' + motivo.slice(0, 40));
    cargarEtapasMecanico();
  } catch(e) { toast('Error: ' + e.message, 'err'); }
}

async function mecReanudarEtapa(etapaId, ordenId) {
  try {
    const etapa = await api(`/etapas?id=eq.${etapaId}`).then(r=>r?.[0]);
    if (!etapa) return;
    const pausaMs  = etapa.pausa_inicio ? Date.now() - new Date(etapa.pausa_inicio).getTime() : 0;
    const pausaMin = Math.max(0, Math.round(pausaMs / 60000));
    await api(`/etapas?id=eq.${etapaId}`, 'PATCH', {
      pausado: false, pausa_inicio: null,
      tiempo_pausado_min: (etapa.tiempo_pausado_min || 0) + pausaMin
    });
    toast('▶ Etapa reanudada');
    cargarEtapasMecanico();
  } catch(e) { toast('Error: ' + e.message, 'err'); }
}

// ═══════════════════════════════════════════════════════════
// HISTORIAL DEL MECÁNICO
// ═══════════════════════════════════════════════════════════
async function cargarHistorialMecanico() {
  const cont = document.getElementById('mec-historial-contenido');
  if (!cont) return;
  cont.innerHTML = '<div class="loading-state">Cargando historial...</div>';
  try {
    const etapas = await api(`/etapas?mecanico_id=eq.${sesion.id}&fin=not.is.null&order=fin.desc&limit=100`) || [];
    if (!etapas.length) {
      cont.innerHTML = `<div class="empty-state"><div class="empty-state-icon">${ico('clipboard', 32)}</div><p style="font-size:15px;font-weight:600;margin-bottom:6px">Sin historial aún</p><p>Cuando finalices etapas aparecerán aquí.</p></div>`;
      return;
    }
    const oids = [...new Set(etapas.map(e => e.orden_id))];
    const ordenes = await api(`/ordenes?id=in.(${oids.join(',')})&select=id,placa,marca,linea`).catch(()=>[]) || [];

    // Tarjeta de satisfacción (calificación del cliente sobre su trabajo).
    // El cálculo vive en el módulo Encuestas (js/views/encuestas.js).
    const satItems = await api(`/encuesta_items_mecanico?mecanico_id=eq.${sesion.id}&select=puntos,resultado,creado_en`)
      .catch(e => { console.error('[Mecanico.historial.satItems]', e); return []; }) || [];
    const sat = (typeof Encuestas !== 'undefined') ? Encuestas.statsMecanico(satItems) : null;
    const satCard = (sat && sat.evaluadas) ? `
      <div style="background:white;border:1.5px solid var(--gris-borde);border-radius:var(--radio);padding:16px 18px;margin-bottom:16px;display:flex;align-items:center;gap:18px">
        <div style="text-align:center;flex-shrink:0">
          <div style="font-size:34px;font-weight:800;font-family:'DM Mono',monospace;line-height:1;color:${Encuestas.colorScore(sat.promedio)}">${sat.promedio!=null?sat.promedio.toFixed(1):'—'}<span style="font-size:16px;color:var(--gris-mid)">/5</span></div>
          <div style="font-size:10px;color:var(--gris-mid);text-transform:uppercase;letter-spacing:.5px;margin-top:3px">Satisfacción</div>
        </div>
        <div style="flex:1">
          <div style="font-size:13px;font-weight:700;color:var(--texto);margin-bottom:4px">Calificación de tu trabajo</div>
          <div style="font-size:12px;color:var(--gris-mid)">Según ${sat.evaluadas} evaluación${sat.evaluadas>1?'es':''} de clientes · ${sat.quejas} queja${sat.quejas===1?'':'s'}</div>
          <div style="margin-top:5px;font-size:12px;color:var(--gris-mid)">Tendencia: ${Encuestas.tendHtml(sat.tendencia)}</div>
        </div>
      </div>` : '';
    // Descontar el tiempo pausado (esperas de repuestos) del tiempo real trabajado
    const totalMins = etapas.reduce((acc, e) => {
      if (!e.inicio || !e.fin) return acc;
      const bruto = Math.round((new Date(e.fin)-new Date(e.inicio))/60000);
      return acc + Math.max(0, bruto - (e.tiempo_pausado_min || 0));
    }, 0);
    const hTot = Math.floor(totalMins/60), mTot = totalMins%60;
    const promMin = etapas.length ? Math.round(totalMins/etapas.length) : 0;
    const hProm = Math.floor(promMin/60), mProm = promMin%60;
    const srvConteo = {};
    etapas.forEach(e => { const s = e.servicio||'otro'; srvConteo[s]=(srvConteo[s]||0)+1; });
    const srvTop = Object.entries(srvConteo).sort((a,b)=>b[1]-a[1])[0];
    const srvColor = { latoneria:'#DC2626', pintura:'#D97706', mecanica:'#2563EB', adicionales:'#059669' };

    cont.innerHTML = `
      ${satCard}
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:20px">
        <div style="background:white;border:1.5px solid var(--gris-borde);border-radius:var(--radio);padding:16px;text-align:center">
          <div style="font-size:26px;font-weight:700;color:var(--azul);font-family:'DM Mono',monospace">${etapas.length}</div>
          <div style="font-size:11px;color:var(--gris-mid);margin-top:2px;text-transform:uppercase;letter-spacing:0.5px">Etapas hechas</div>
        </div>
        <div style="background:white;border:1.5px solid var(--gris-borde);border-radius:var(--radio);padding:16px;text-align:center">
          <div style="font-size:26px;font-weight:700;color:var(--verde);font-family:'DM Mono',monospace">${hTot}h ${mTot}m</div>
          <div style="font-size:11px;color:var(--gris-mid);margin-top:2px;text-transform:uppercase;letter-spacing:0.5px">Tiempo total</div>
        </div>
        <div style="background:white;border:1.5px solid var(--gris-borde);border-radius:var(--radio);padding:16px;text-align:center">
          <div style="font-size:26px;font-weight:700;color:#D97706;font-family:'DM Mono',monospace">${hProm>0?hProm+'h ':''}${mProm}m</div>
          <div style="font-size:11px;color:var(--gris-mid);margin-top:2px;text-transform:uppercase;letter-spacing:0.5px">Prom. por etapa</div>
        </div>
      </div>
      ${srvTop ? `<div style="background:white;border:1.5px solid var(--gris-borde);border-radius:var(--radio);padding:14px 18px;margin-bottom:16px;display:flex;align-items:center;gap:12px">
        <div style="width:10px;height:10px;border-radius:50%;background:${srvColor[srvTop[0]]||'#6B7280'};flex-shrink:0"></div>
        <div><div style="font-size:12px;color:var(--gris-mid)">Especialidad más frecuente</div>
          <div style="font-size:15px;font-weight:600">${CATALOGO[srvTop[0]]?.nombre||srvTop[0]} · ${srvTop[1]} etapa${srvTop[1]>1?'s':''}</div></div>
      </div>` : ''}
      <div style="display:grid;grid-template-columns:100px 1fr 80px 70px;gap:12px;padding:6px 0;border-bottom:2px solid var(--gris-borde);margin-bottom:4px">
        <div style="font-size:10px;font-weight:700;color:var(--gris-mid);text-transform:uppercase;letter-spacing:1px">Placa</div>
        <div style="font-size:10px;font-weight:700;color:var(--gris-mid);text-transform:uppercase;letter-spacing:1px">Etapa</div>
        <div style="font-size:10px;font-weight:700;color:var(--gris-mid);text-transform:uppercase;letter-spacing:1px">Fecha</div>
        <div style="font-size:10px;font-weight:700;color:var(--gris-mid);text-transform:uppercase;letter-spacing:1px;text-align:right">Duración</div>
      </div>
      ${etapas.map(e => {
        const o = ordenes.find(ord => ord.id === e.orden_id)||{};
        const brutoMins = e.inicio&&e.fin ? Math.round((new Date(e.fin)-new Date(e.inicio))/60000) : 0;
        const mins = Math.max(0, brutoMins - (e.tiempo_pausado_min || 0));
        const dur = mins<60?`${mins}m`:`${Math.floor(mins/60)}h ${mins%60}m`;
        const color = srvColor[e.servicio]||'#6B7280';
        return `<div style="display:grid;grid-template-columns:100px 1fr 80px 70px;align-items:center;gap:12px;padding:10px 0;border-bottom:1px solid var(--gris-borde)">
          <div style="font-family:'DM Mono',monospace;font-weight:700;font-size:13px;letter-spacing:1px">${escapeHtml(o.placa)||'—'}</div>
          <div><div style="font-weight:600;font-size:13px">${escapeHtml(e.etapa)||'—'}</div>
            <div style="font-size:11px;color:${color}">${escapeHtml(CATALOGO[e.servicio]?.nombre||e.servicio)||'—'}</div></div>
          <div style="font-size:12px;color:var(--gris-mid)">${formatFecha(e.fin)}</div>
          <div style="font-size:13px;font-weight:600;color:var(--azul);text-align:right">${dur}</div>
        </div>`;
      }).join('')}`;
  } catch(e) { cont.innerHTML = `<div class="empty-state">Error: ${e.message}</div>`; }
}

// ═══════════════════════════════════════════════════════════
// LISTA DE REPUESTOS DEL TÉCNICO (lee solicitudes_repuesto = sistema real)
// ═══════════════════════════════════════════════════════════
async function cargarRepuestosMecanico() {
  const cont = document.getElementById('mec-repuestos-contenido');
  if (!cont) return;
  cont.innerHTML = '<div class="loading-state">Cargando...</div>';
  try {
    const solicitudes = await api(`/solicitudes_repuesto?solicitado_por=eq.${encodeURIComponent(sesion.nombre)}&order=creado_en.desc&limit=80&select=*`).catch(()=>[]) || [];
    const ordenIds = [...new Set(solicitudes.map(s => s.orden_id).filter(Boolean))];
    const ordenes = ordenIds.length ? await api(`/ordenes?id=in.(${ordenIds.join(',')})&select=id,placa,propietario,marca,linea,estado`).catch(()=>[]) || [] : [];
    // Estados desde la fuente ÚNICA (REPUESTO_ESTADOS en utils.js): mismo nombre
    // y color que ve el jefe en el detalle de la orden → consistencia total.
    const conteos = solicitudes.reduce((acc, s) => {
      const estado = s.estado || 'pendiente_jefe';
      acc[estado] = (acc[estado] || 0) + 1;
      return acc;
    }, {});

    cont.innerHTML = `
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:10px;margin-bottom:16px">
        <div class="info-chip"><div class="info-chip-label">Pendientes</div><div class="info-chip-val">${(conteos.pendiente_jefe||0) + (conteos.enviado_repuestos||0) + (conteos.cotizado||0) + (conteos.pedido||0)}</div></div>
        <div class="info-chip"><div class="info-chip-label">Entregadas</div><div class="info-chip-val">${conteos.entregado||0}</div></div>
        <div class="info-chip"><div class="info-chip-label">Rechazadas</div><div class="info-chip-val">${conteos.rechazado||0}</div></div>
      </div>
      ${solicitudes.length ? solicitudes.map(s => {
        const o = ordenes.find(ord => ord.id === s.orden_id) || {};
        const estado = s.estado || 'pendiente_jefe';
        const _inf = repuestoEstadoInfo(estado);
        const color = _inf.color;
        const bg = _inf.bg;
        return `<div class="solicitud-card">
          <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-bottom:10px">
            <div style="min-width:0">
              <div style="font-family:'DM Mono',monospace;font-weight:800;font-size:15px">${escapeHtml(o.placa) || 'Orden #' + s.orden_id}</div>
              <div style="font-size:12px;color:var(--gris-mid);margin-top:2px">${[o.marca,o.linea].filter(Boolean).map(escapeHtml).join(' ') || escapeHtml(o.propietario) || 'Sin datos'} · ${formatTS(s.creado_en)}</div>
            </div>
            <span style="font-size:11px;font-weight:800;color:${color};background:${bg};padding:4px 10px;border-radius:99px;text-transform:uppercase;white-space:nowrap">${_inf.icon} ${_inf.label}</span>
          </div>
          <div style="font-weight:700;margin-bottom:4px">${escapeHtml(s.repuesto) || 'Repuesto sin nombre'}</div>
          <div style="font-size:12px;color:var(--gris-mid)">Cantidad: ${s.unidades || 1}${s.observaciones ? ' · ' + escapeHtml(s.observaciones) : ''}</div>
          ${estado === 'recibido_taller' ? `
            <div style="background:#E6F5EF;border:1.5px solid #34D399;border-radius:8px;padding:10px 14px;margin-top:10px;display:flex;align-items:center;gap:10px">
              <span style="font-size:20px">📦</span>
              <div>
                <div style="font-weight:700;color:#065F46;font-size:13px">¡Tu repuesto llegó al taller!</div>
                <div style="font-size:12px;color:#047857;margin-top:2px">El jefe te lo entregará en breve — tu tiempo continúa al recibirlo.</div>
              </div>
            </div>` : ''}
          ${s.nota_jefe ? `
            <div style="
              font-size:12px;padding:10px 12px;border-radius:8px;margin-top:10px;line-height:1.6;
              ${estado === 'cotizado'
                ? 'background:#E6F5EF;border:1px solid #A7F3D0;color:#065F46;'
                : estado === 'rechazado'
                ? 'background:#FEE2E2;border:1px solid #FCA5A5;color:#991B1B;'
                : 'background:var(--gris-bg);border:1px solid var(--gris-borde);color:var(--texto);'}
            ">${escapeHtml(s.nota_jefe)}</div>` : ''}
          <div class="btn-row" style="margin-top:10px">
            <button class="btn btn-ghost btn-sm" onclick="abrirOrdenMecanico(${s.orden_id})">Ver orden</button>
          </div>
        </div>`;
      }).join('') : '<div class="empty-state"><p>No tienes solicitudes de repuestos todavía.</p></div>'}
    `;
  } catch(e) { cont.innerHTML = `<div class="empty-state">Error: ${e.message}</div>`; }
}

// (Sistema viejo de repuestos eliminado: las funciones renderMecRepItem/
//  agregarMecRepItem/quitarMecRepItem/enviarMecRepuestos/marcarRepuestoRecibido
//  escribían en las tablas muertas repuestos_solicitud/repuestos_items y NO
//  estaban conectadas a ningún botón. El flujo real usa solicitudes_repuesto/
//  solicitud_items — ver js/views/repuestos.js y el panel del detalle de orden.)
