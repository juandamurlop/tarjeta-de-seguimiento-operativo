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
    `;
  }
  
  const bottomNav = document.getElementById('bottom-nav-inner');
  if (bottomNav) {
    bottomNav.innerHTML = `
      <button class="bnav-item active" id="bnav-mec-ordenes" onclick="navMec('ordenes')">
        <svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z"/></svg>
        <span>Mis órdenes</span>
      </button>
    `;
  }
  navMec('ordenes');
}

function navMec(pag) {
  mostrarPagina(pag === 'ordenes' ? 'pag-mecanico' : 'pag-mec-detalle');
  const title = document.getElementById('topbar-title');
  if (title) title.textContent = pag === 'ordenes' ? 'Mis Órdenes' : 'Detalle';
  if (pag === 'ordenes') cargarEtapasMecanico();
  closeSidebar();
}

async function cargarEtapasMecanico() {
  const cont = document.getElementById('mec-contenido');
  if (!cont) return;
  cont.innerHTML = '<div class="loading-state">Cargando tus órdenes...</div>';
  try {
    const etapas = await api(`/etapas?mecanico_id=eq.${sesion.id}&order=creado_en.asc`) || [];
    if (!etapas.length) {
      cont.innerHTML = `<div class="empty-state"><div class="empty-state-icon">✅</div><p>No tienes etapas asignadas por el momento.</p></div>`;
      return;
    }

    const ids = [...new Set(etapas.map(e => e.orden_id))];
    const ordenes = await api(`/ordenes?id=in.(${ids.join(',')})`).catch(() => []) || [];

    const porOrden = {};
    etapas.forEach(e => {
      if (!porOrden[e.orden_id]) porOrden[e.orden_id] = [];
      porOrden[e.orden_id].push(e);
    });

    cont.innerHTML = Object.entries(porOrden).map(([oid, ets]) => {
      const orden = ordenes.find(o => o.id == oid) || {};
      const etapsHtml = ets.map(e => {
        const badge = !e.inicio ? 'Pendiente' : (e.fin ? 'Completada' : 'En proceso');
        const bCls = !e.inicio ? 'pendiente' : (e.fin ? 'completada' : 'iniciada');
        const hayActiva = ets.some(x => x.inicio && !x.fin);
        let acc = '';
        if (!e.inicio && !hayActiva)
          acc = `<button class="btn btn-success btn-sm" onclick="mecIniciarEtapa(${e.id},'${e.etapa || ''}',${oid})">▶ Iniciar</button>`;
        else if (e.inicio && !e.fin)
          acc = `<button class="btn btn-danger btn-sm" onclick="mecFinalizarEtapa(${e.id},'${e.etapa || ''}','${e.servicio || ''}',${oid})">■ Finalizar</button>`;
        else if (e.fin)
          acc = `<span class="badge badge-completada">Completada ✓</span>`;
        else
          acc = `<span style="font-size:12px;color:var(--gris-mid)">Esperando turno</span>`;

        return `<div class="mec-etapa-item">
          <div style="flex:1">
            <div style="font-weight:600;font-size:14px">${e.etapa || '—'}</div>
            <div style="font-size:11px;color:var(--gris-mid);margin-top:2px">
              ${CATALOGO[e.servicio]?.nombre || e.servicio || '—'}
              ${e.inicio ? ' · Inicio: ' + formatTS(e.inicio) : ''}
              ${e.fin ? ' · Fin: ' + formatTS(e.fin) : ''}
            </div>
          </div>
          <div style="display:flex;align-items:center;gap:8px">
            <span class="badge badge-${bCls}">${badge}</span>
            ${acc}
            ${!e.fin ? `<button class="btn btn-ghost btn-xs" onclick="abrirMecDetalle(${e.id},${oid})">Fotos / novedades</button>` : ''}
          </div>
        </div>`;
      }).join('');

      return `<div class="mec-orden-card">
        <div class="mec-orden-header">
          <div>
            <div style="font-family:'DM Mono',monospace;font-size:20px;font-weight:500;letter-spacing:2px">${orden.placa || '—'}</div>
            <div style="font-size:13px;color:var(--gris-mid);margin-top:3px">${[orden.marca, orden.linea, orden.modelo].filter(Boolean).join(' · ') || 'Sin datos'}</div>
          </div>
          <div style="text-align:right">
            ${orden.pulmon ? '<span class="badge badge-pulmon">En Pulmón</span>' : ''}
            <div style="font-size:11px;color:var(--gris-mid);font-family:\'DM Mono\',monospace;margin-top:4px">${formatFecha(orden.creado_en)}</div>
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
        siguiente_etapa: siguiente ? { id: siguiente.id, nombre: siguiente.etapa, servicio: siguiente.servicio, mecanico_id: siguiente.mecanico_id, tecnico: siguiente.tecnico } : null,
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
  if (title) title.textContent = 'Fotos y Novedades';
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
      <div class="foto-thumb" onclick="abrirLightbox('${f.url}')">
        <img src="${f.url}" alt="">
        <button class="foto-delete" onclick="event.stopPropagation();eliminarFotoMec(${f.id},'${f.url}',${eid},${oid})">✕</button>
      </div>`).join('');

    const novsHtml = novedades.length ? novedades.map(n => `
      <div class="novedad-item">
        <div class="novedad-item-top">
          <span class="novedad-tipo ${(n.tipo || '').toLowerCase()}">${n.tipo}</span>
          <span class="novedad-fecha">${formatTS(n.creado_en)}</span>
        </div>
        <div class="novedad-motivo">${n.motivo || '—'}</div>
      </div>`).join('')
      : '<div style="font-size:12px;color:var(--gris-mid);padding:4px 0">Sin novedades.</div>';

    cont.innerHTML = `
      <div class="card" style="padding:24px;margin-bottom:14px">
        <div style="font-family:'DM Mono',monospace;font-size:20px;letter-spacing:2px;font-weight:500;margin-bottom:4px">${orden.placa || '—'}</div>
        <div style="font-size:13px;color:var(--gris-mid);margin-bottom:16px">${etapa.etapa || '—'} · ${CATALOGO[etapa.servicio]?.nombre || etapa.servicio || '—'}</div>
        <div class="seccion-titulo">Fotos (${fotos.length})</div>
        <div class="fotos-grid" id="mec-fotos-grid">${fotosHtml}</div>
        <div class="upload-zone" onclick="document.getElementById('mec-fi-${k}').click()" style="margin-top:10px">
          <input type="file" id="mec-fi-${k}" accept="image/*" multiple onchange="mecSubirFotos(this,${eid},'${etapa.etapa || ''}',${oid})">
          <div style="font-size:20px">📷</div>
          <p>Subir fotos</p>
          <div class="upload-prog" id="mec-prog-${k}"></div>
        </div>
      </div>
      <div class="card" style="padding:24px">
        <div class="seccion-titulo">Novedades</div>
        <div id="mec-novs-${eid}">${novsHtml}</div>
        <div class="grid-2" style="margin-top:12px">
          <div class="field"><label>Tipo</label>
            <select id="mec-ntype-${eid}">
              <option value="Detenido">Detenido</option>
              <option value="Reproceso">Reproceso</option>
              <option value="Garantia">Garantía</option>
            </select>
          </div>
          <div class="field full"><label>Motivo</label>
            <textarea id="mec-nmot-${eid}" placeholder="Describe la novedad..." style="min-height:52px"></textarea>
          </div>
        </div>
        <div class="btn-row">
          <button class="btn btn-danger btn-sm" onclick="mecGuardarNovedad(${eid},${oid})">Guardar novedad</button>
        </div>
      </div>`;
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
      const ext = file.name.split('.').pop();
      const path = `${oid}/etapas/${eid}_${Date.now()}.${ext}`;
      const url = await storageUpload(file, path);
      await api('/fotos_etapas', 'POST', { etapa_id: eid, orden_id: oid, etapa_nombre: nombre, url, nombre: file.name }, { Prefer: 'return=minimal' });
      sub++;
      if (prog) prog.textContent = `Subiendo ${sub}/${files.length}...`;
    } catch(e) { toast(`Error: ${file.name}`, 'err'); }
  }
  if (prog) prog.textContent = '';
  input.value = '';
  toast(`${sub} foto(s) subida(s) ✓`);
  abrirMecDetalle(eid, oid);
}

async function eliminarFotoMec(fotoId, url, eid, oid) {
  if (!confirm('¿Eliminar esta foto?')) return;
  try {
    await api(`/fotos_etapas?id=eq.${fotoId}`, 'DELETE');
    const path = url.split(`/object/public/${BUCKET}/`)[1];
    if (path) await fetch(`${SUPABASE_URL}/storage/v1/object/${BUCKET}/${path}`, { method: 'DELETE', headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } });
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