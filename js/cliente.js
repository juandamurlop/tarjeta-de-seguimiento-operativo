// ═══════════════════════════════════════════════════════════
// PERFIL CLIENTE - MIS ÓRDENES
// ═══════════════════════════════════════════════════════════

function montarCliente() {
  const sidebarNav = document.getElementById('sidebar-nav');
  if (sidebarNav) {
    sidebarNav.innerHTML = `
      <div class="nav-section-label">Mi vehículo</div>
      <button class="nav-item active">
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="1.25" stroke-linecap="round" stroke-linejoin="round">
          <path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2"/>
          <circle cx="7" cy="17" r="2"/>
          <path d="M9 17h6"/>
          <circle cx="17" cy="17" r="2"/>
        </svg>
        Estado de mi orden
      </button>
    `;
  }
  
  const bottomNav = document.getElementById('bottom-nav-inner');
  if (bottomNav) {
    bottomNav.innerHTML = `
      <button class="bnav-item active">
        <svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M3 17l2-7h14l2 7H3zM5 17v2a1 1 0 002 0v-2M17 17v2a1 1 0 002 0v-2"/></svg>
        <span>Mi orden</span>
      </button>
    `;
  }
  
  const title = document.getElementById('topbar-title');
  if (title) title.textContent = 'Estado de mi vehículo';
  mostrarPagina('pag-cliente');
  cargarOrdenesCliente();
}

async function cargarOrdenesCliente() {
  const cont = document.getElementById('cliente-contenido');
  if (!cont) return;
  cont.innerHTML = '<div class="loading-state">Cargando tu vehículo...</div>';
  try {
    const ordenes = await api(`/ordenes?cliente_id=eq.${sesion.id}&order=creado_en.desc`) || [];
    if (!ordenes.length) {
      cont.innerHTML = `<div class="empty-state">
        <div class="empty-state-icon">🚗</div>
        <p style="font-size:16px;font-weight:600;color:var(--texto);margin-bottom:6px">No tienes órdenes registradas</p>
        <p>Usted no cuenta con órdenes registradas en el sistema.<br>Si crees que es un error, comunícate con el taller.</p>
      </div>`;
      return;
    }

    const ids = ordenes.map(o => o.id).join(',');
    const etapas = await api(`/etapas?orden_id=in.(${ids})&order=creado_en.asc`).catch(() => []) || [];
    const novedades = await api(`/novedades?orden_id=in.(${ids})&order=creado_en.desc`).catch(() => []) || [];
    const fotosEt = await api(`/fotos_etapas?orden_id=in.(${ids})&order=creado_en.desc&limit=12`).catch(() => []) || [];

    cont.innerHTML = ordenes.map(orden => {
      const ets = etapas.filter(e => e.orden_id === orden.id);
      const novs = novedades.filter(n => n.orden_id === orden.id);
      const fotos = fotosEt.filter(f => f.orden_id === orden.id).slice(0, 6);
      const total = ets.length;
      const comp = ets.filter(e => e.fin).length;
      const pct = total ? Math.round((comp / total) * 100) : 0;

      const etapasHtml = ets.map(e => {
        const done = !!e.fin;
        const active = !!e.inicio && !e.fin;
        const cls = done ? 'done' : active ? 'active' : 'pending';
        return `<div class="cliente-etapa-row">
          <div class="cliente-dot ${cls}"></div>
          <div style="flex:1">
            <div style="font-size:13px;font-weight:600">${e.etapa || '—'}</div>
            <div style="font-size:11px;color:var(--gris-mid)">${CATALOGO[e.servicio]?.nombre || e.servicio || '—'}</div>
          </div>
          <div style="text-align:right">
            <span class="badge badge-${done ? 'completada' : active ? 'iniciada' : 'pendiente'}">${done ? 'Completada' : active ? 'En proceso' : 'Pendiente'}</span>
            ${done ? `<div style="font-size:10px;color:var(--gris-mid);font-family:'DM Mono',monospace;margin-top:3px">${formatTS(e.fin)}</div>` : ''}
          </div>
        </div>`;
      }).join('');

      const novsHtml = novs.length ? `
        <div style="margin-top:16px;border-top:1px solid var(--gris-borde);padding-top:16px">
          <div class="seccion-titulo">Novedades / Imprevistos</div>
          ${novs.map(n => `<div class="novedad-item" style="margin-bottom:8px">
            <div class="novedad-item-top">
              <span class="novedad-tipo ${(n.tipo || '').toLowerCase()}">${n.tipo}</span>
              <span class="novedad-fecha">${formatTS(n.creado_en)}</span>
            </div>
            <div class="novedad-motivo">${n.motivo || '—'}</div>
          </div>`).join('')}
        </div>` : '';

      const fotosHtml = fotos.length ? `
        <div style="margin-top:16px;border-top:1px solid var(--gris-borde);padding-top:16px">
          <div class="seccion-titulo">Fotos del proceso</div>
          <div class="fotos-grid">${fotos.map(f => `<div class="foto-thumb" onclick="abrirLightbox('${f.url}')"><img src="${f.url}" alt="" loading="lazy"></div>`).join('')}</div>
        </div>` : '';

      return `<div class="cliente-orden-card">
        <div class="cliente-header">
          <div class="cliente-placa">${orden.placa}</div>
          <div class="cliente-vehiculo">${[orden.marca, orden.linea, orden.modelo, orden.color].filter(Boolean).join(' · ') || 'Sin datos'}</div>
          <div style="display:flex;align-items:center;gap:10px;margin-top:12px">
            <div style="flex:1">
              <div style="font-size:11px;opacity:0.6;margin-bottom:4px">${comp} de ${total} etapas completadas</div>
              <div style="height:4px;background:rgba(255,255,255,0.2);border-radius:99px;overflow:hidden">
                <div style="height:100%;width:${pct}%;background:white;border-radius:99px;transition:width 0.4s"></div>
              </div>
            </div>
            <div style="font-size:20px;font-weight:700;font-family:'DM Mono',monospace">${pct}%</div>
          </div>
          ${orden.pulmon ? `<div style="margin-top:10px;background:rgba(255,255,255,0.15);border-radius:6px;padding:8px 12px;font-size:12px">⏸ En espera de aprobación — Pulmón activo desde ${formatFecha(orden.pulmon_desde)}</div>` : ''}
        </div>
        <div class="cliente-body">
          <div class="info-chips" style="margin-bottom:16px">
            <div class="info-chip"><div class="info-chip-label">Ingreso</div><div class="info-chip-val">${formatFecha(orden.creado_en)}</div></div>
            <div class="info-chip"><div class="info-chip-label">Fecha entrega</div><div class="info-chip-val">${formatFecha(orden.fecha_entrega_1) || '—'}</div></div>
            ${orden.aseguradora ? `<div class="info-chip"><div class="info-chip-label">Aseguradora</div><div class="info-chip-val">${orden.aseguradora}</div></div>` : ''}
            <div class="info-chip"><div class="info-chip-label">Estado</div><div class="info-chip-val">${orden.estado || 'Activa'}</div></div>
          </div>
          ${orden.cotizacion_url ? `
          <div style="margin-bottom:16px;padding:12px 14px;background:var(--gris-bg);border-radius:8px;border:1px solid var(--gris-borde);display:flex;align-items:center;justify-content:space-between">
            <div>
              <div style="font-size:12px;font-weight:600;color:var(--texto)">📄 Cotización</div>
              <div style="font-size:11px;color:var(--gris-mid);margin-top:2px">Documento de tu vehículo</div>
            </div>
            <a href="${orden.cotizacion_url}" target="_blank" class="btn btn-outline btn-sm" style="font-size:12px">Ver PDF →</a>
          </div>` : ''}
          <div class="seccion-titulo">Avance del proceso</div>
          ${etapasHtml}
          ${novsHtml}
          ${fotosHtml}
        </div>
      </div>`;
    }).join('');
  } catch(e) { 
    cont.innerHTML = `<div class="empty-state">Error: ${e.message}</div>`; 
  }
}