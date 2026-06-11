// ═══════════════════════════════════════════════════════════
// ACCESO DE CLIENTE (URL aparte: ?cliente  o  ?cliente=<cédula/NIT>)
// Reusa la pantalla de login pero en "modo cliente": sin contraseña, con
// cédula o NIT. Si la URL trae el documento (enlace de WhatsApp), entra solo.
// ═══════════════════════════════════════════════════════════
function montarLoginCliente(cedula) {
  const pl  = document.getElementById('pantalla-login');
  const app = document.getElementById('app');
  if (app) app.classList.remove('show');
  if (pl)  pl.style.display = 'flex';

  const logo = document.querySelector('.login-logo');
  if (logo) logo.innerHTML = `<img src="assets/icons/Logo_Fondo_Taller.png" alt="Freimanautos" style="height:72px;width:auto;object-fit:contain">`;
  const titulo = document.querySelector('.login-titulo'); if (titulo) titulo.textContent = 'Tu vehículo';
  const sub = document.getElementById('login-sub');
  if (sub) sub.textContent = 'Ingresa tu cédula o NIT para ver el estado de tu vehículo';
  const lbl = document.querySelector('label[for="login-cedula"]');
  if (lbl) lbl.textContent = 'Cédula o NIT';
  const passWrap = document.getElementById('login-pass-wrap');
  if (passWrap) passWrap.style.display = 'none';
  const btn = document.getElementById('login-btn');
  if (btn) { btn.textContent = 'Ver mi vehículo'; btn.onclick = loginClientePortal; }
  const inp = document.getElementById('login-cedula');
  if (inp) inp.onkeydown = (e) => { if (e.key === 'Enter') loginClientePortal(); };

  if (cedula && String(cedula).trim()) {
    if (inp) inp.value = String(cedula).trim().replace(/\D/g, '');
    loginClientePortal();
  }
}

async function loginClientePortal() {
  const doc   = (document.getElementById('login-cedula')?.value || '').trim();
  const errEl = document.getElementById('login-error');
  const btn   = document.getElementById('login-btn');
  const _err  = (m) => { if (errEl) { errEl.textContent = m; errEl.classList.add('show'); } };
  if (!doc) { _err('Ingresa tu cédula o NIT.'); return; }
  if (btn) { btn.disabled = true; btn.textContent = 'Buscando...'; }
  if (errEl) errEl.classList.remove('show');
  try {
    const perfil = await detectarPerfil(doc);
    // Solo entran CLIENTES (un documento de personal no abre nada aquí).
    if (!perfil || perfil.perfil !== 'cliente') {
      _err('No encontramos un vehículo con ese documento. Verifica el número o comunícate con el taller.');
      return;
    }
    iniciarSesion({ ...perfil, cedula: doc });
  } catch (e) {
    _err('Error de conexión. Intenta de nuevo.');
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = 'Ver mi vehículo'; }
  }
}

// Encabezado y pie de marca para el portal del cliente.
function _cliBrandHeader() {
  return `<div class="cli-brand">
    <img src="assets/icons/Logo_Fondo_Taller.png" alt="Freimanautos" class="cli-brand-logo">
    <div class="cli-brand-txt">
      <div class="cli-brand-name">Servicio Freimanautos</div>
      <div class="cli-brand-tag">Seguimiento de tu vehículo en tiempo real</div>
    </div>
  </div>`;
}
function _cliBrandFooter() {
  return `<div class="cli-brand-footer">
    <img src="assets/icons/Logo_Fondo_Taller.png" alt="" class="cli-foot-logo">
    <div>Un servicio de <b>Freimanautos</b><br><span>Simplemente profesional</span></div>
  </div>`;
}

// Enlace de seguimiento para enviar al cliente por WhatsApp.
function _linkClienteSeguimiento(cedula) {
  if (!cedula) return '';
  return `${location.origin}${location.pathname}?cliente=${encodeURIComponent(String(cedula).trim())}`;
}

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
    // Match por cliente_id Y por cédula/NIT: muchas órdenes tienen cliente_id
    // vacío (se crean con cedula_cliente), así que filtrar solo por id dejaba
    // al cliente sin ver sus vehículos. La cédula siempre está, así que busca
    // por ambos para no perder ninguna orden suya.
    const doc = String(sesion.cedula || sesion.datos?.cedula_nit || '').trim();
    let _qs;
    if (sesion.id != null && doc) {
      _qs = `or=(cliente_id.eq.${sesion.id},cedula_cliente.eq.${encodeURIComponent(doc)})`;
    } else if (doc) {
      _qs = `cedula_cliente=eq.${encodeURIComponent(doc)}`;
    } else {
      _qs = `cliente_id=eq.${sesion.id}`;
    }
    const ordenes = await api(`/ordenes?${_qs}&order=creado_en.desc`) || [];
    if (!ordenes.length) {
      cont.innerHTML = _cliBrandHeader() + `<div class="empty-state">
        <div class="empty-state-icon">${ico('car', 32)}</div>
        <p style="font-size:16px;font-weight:600;color:var(--texto);margin-bottom:6px">No tienes órdenes registradas</p>
        <p>Usted no cuenta con órdenes registradas en el sistema.<br>Si crees que es un error, comunícate con el taller.</p>
      </div>` + _cliBrandFooter();
      return;
    }

    const ids = ordenes.map(o => o.id).join(',');
    const etapas = await api(`/etapas?orden_id=in.(${ids})&order=creado_en.asc`).catch(() => []) || [];
    const novedades = await api(`/novedades?orden_id=in.(${ids})&order=creado_en.desc`).catch(() => []) || [];
    const fotosEt = await api(`/fotos_etapas?orden_id=in.(${ids})&order=creado_en.desc&limit=12`).catch(() => []) || [];

    cont.innerHTML = _cliBrandHeader() + ordenes.map(orden => {
      const ets = etapas.filter(e => e.orden_id === orden.id);
      const novs = novedades.filter(n => n.orden_id === orden.id);
      const fotos = fotosEt.filter(f => f.orden_id === orden.id).slice(0, 6);
      const total = ets.length;
      const comp = ets.filter(e => e.fin).length;
      const pct = total ? Math.round((comp / total) * 100) : 0;

      // Proceso activo (iniciado y sin terminar) — para resaltarlo y el banner.
      const activa = ets.find(e => e.inicio && !e.fin);

      const etapasHtml = ets.map(e => {
        const done = !!e.fin;
        const active = !!e.inicio && !e.fin;
        const paus = active && e.pausado;
        const cls = done ? 'done' : active ? (paus ? 'paused' : 'active') : 'pending';
        const marker = done ? '✓' : '';
        return `<div class="cli-tl-item ${cls}">
          <div class="cli-tl-marker">${marker}</div>
          <div class="cli-tl-content">
            <div class="cli-tl-head">
              <span class="cli-tl-title">${escapeHtml(e.etapa) || '—'}</span>
              <span class="cli-tl-badge ${cls}">${done ? 'Listo' : active ? (paus ? 'En pausa' : 'En proceso') : 'Pendiente'}</span>
            </div>
            <div class="cli-tl-sub">${escapeHtml(CATALOGO[e.servicio]?.nombre || e.servicio) || '—'}</div>
            ${e.descripcion ? `<div class="cli-tl-desc">${escapeHtml(e.descripcion)}</div>` : ''}
            ${done ? `<div class="cli-tl-fecha">${formatTS(e.fin)}</div>` : ''}
          </div>
        </div>`;
      }).join('');

      // Banner prominente con "lo que está pasando AHORA" con su descripción.
      let estadoBanner = '';
      if ((orden.estado || '') === 'Entregada') {
        estadoBanner = `<div style="background:#ECFDF5;border:1px solid #6EE7B7;border-radius:10px;padding:12px 14px;margin-bottom:16px"><div style="font-weight:700;color:#065F46;font-size:14px">✅ Vehículo entregado</div></div>`;
      } else if (orden.pulmon) {
        estadoBanner = `<div style="background:#FFFBEB;border:1px solid #FDE68A;border-radius:10px;padding:12px 14px;margin-bottom:16px"><div style="font-weight:700;color:#92400E;font-size:14px">⏸ En espera de aprobación</div><div style="font-size:12px;color:#B45309;margin-top:2px">Tu vehículo está pausado pendiente de aprobación.</div></div>`;
      } else if (activa) {
        const paus = activa.pausado;
        estadoBanner = `<div style="background:${paus ? '#FFFBEB' : '#ECFDF5'};border:1px solid ${paus ? '#FDE68A' : '#6EE7B7'};border-radius:10px;padding:12px 14px;margin-bottom:16px">
          <div style="font-weight:700;color:${paus ? '#92400E' : '#065F46'};font-size:14px">🔧 ${paus ? 'En pausa' : 'En proceso ahora'}: ${escapeHtml(activa.etapa)}</div>
          <div style="font-size:12px;color:var(--gris-mid);margin-top:2px">${escapeHtml(CATALOGO[activa.servicio]?.nombre || activa.servicio || '')}</div>
          ${activa.descripcion ? `<div style="font-size:12.5px;color:#1E293B;margin-top:6px;line-height:1.4;white-space:pre-wrap">📝 ${escapeHtml(activa.descripcion)}</div>` : ''}
          ${paus ? `<div style="font-size:11.5px;color:#B45309;margin-top:6px;font-weight:600">⏸ En pausa, esperando un repuesto.</div>` : ''}
        </div>`;
      } else if (total > 0 && comp === total) {
        estadoBanner = `<div style="background:#ECFDF5;border:1px solid #6EE7B7;border-radius:10px;padding:12px 14px;margin-bottom:16px"><div style="font-weight:700;color:#065F46;font-size:14px">✅ Todos los procesos terminados</div><div style="font-size:12px;color:#047857;margin-top:2px">Tu vehículo está en revisión final / listo para entrega.</div></div>`;
      } else {
        const prox = ets.find(e => !e.inicio);
        estadoBanner = `<div style="background:var(--gris-bg);border:1px solid var(--gris-borde);border-radius:10px;padding:12px 14px;margin-bottom:16px"><div style="font-weight:700;color:var(--texto);font-size:14px">⏳ ${prox ? 'Próximo: ' + escapeHtml(prox.etapa) : 'En cola de trabajo'}</div><div style="font-size:12px;color:var(--gris-mid);margin-top:2px">Tu vehículo está en el taller; pronto inicia el trabajo.</div></div>`;
      }

      const novsHtml = novs.length ? `
        <div style="margin-top:16px;border-top:1px solid var(--gris-borde);padding-top:16px">
          <div class="seccion-titulo">Novedades / Imprevistos</div>
          ${novs.map(n => `<div class="novedad-item" style="margin-bottom:8px">
            <div class="novedad-item-top">
              <span class="novedad-tipo ${escapeHtml((n.tipo || '').toLowerCase())}">${escapeHtml(n.tipo)}</span>
              <span class="novedad-fecha">${formatTS(n.creado_en)}</span>
            </div>
            <div class="novedad-motivo">${escapeHtml(n.motivo) || '—'}</div>
            ${n.foto_url ? `<img src="${escapeHtml(n.foto_url)}" class="novedad-foto" loading="lazy" onclick="abrirLightbox(this.src)" alt="Foto de la novedad">` : ''}
          </div>`).join('')}
        </div>` : '';

      const fotosHtml = fotos.length ? `
        <div style="margin-top:16px;border-top:1px solid var(--gris-borde);padding-top:16px">
          <div class="seccion-titulo">Fotos del proceso</div>
          <div class="fotos-grid">${fotos.map(f => `<div class="foto-thumb" data-url="${escapeHtml(f.url)}" onclick="abrirLightbox(this.dataset.url)"><img src="${escapeHtml(f.url)}" alt="" loading="lazy"></div>`).join('')}</div>
        </div>` : '';

      // Pill de estado (resumen de una palabra arriba a la izquierda).
      let pill = { txt: 'En taller', cls: 'idle' };
      if ((orden.estado || '') === 'Entregada') pill = { txt: 'Entregado', cls: 'ok' };
      else if (orden.pulmon) pill = { txt: 'En espera', cls: 'wait' };
      else if (activa) pill = activa.pausado ? { txt: 'En pausa', cls: 'wait' } : { txt: 'En proceso', cls: 'go' };
      else if (total > 0 && comp === total) pill = { txt: 'Listo p/ entrega', cls: 'ok' };

      // Anillo de progreso (SVG): r=24 → circunferencia ≈ 150.8.
      const _circ = 150.8;
      const _off = (_circ * (1 - pct / 100)).toFixed(1);
      const veh = [orden.marca, orden.linea, orden.modelo, orden.color].filter(Boolean).map(escapeHtml).join(' · ') || 'Sin datos';

      return `<div class="cliente-orden-card">
        <div class="cliente-header">
          <div class="cli-head-top">
            <div class="cli-head-info">
              <span class="cli-pill cli-pill-${pill.cls}">${pill.txt}</span>
              <div class="cliente-placa">${escapeHtml(orden.placa)}</div>
              <div class="cliente-vehiculo">${veh}</div>
            </div>
            <div class="cli-ring">
              <svg viewBox="0 0 58 58" width="58" height="58">
                <circle cx="29" cy="29" r="24" fill="none" stroke="rgba(255,255,255,0.18)" stroke-width="5"/>
                <circle cx="29" cy="29" r="24" fill="none" stroke="#fff" stroke-width="5" stroke-linecap="round"
                  stroke-dasharray="${_circ}" stroke-dashoffset="${_off}" transform="rotate(-90 29 29)" class="cli-ring-prog"/>
              </svg>
              <div class="cli-ring-num">${pct}<span>%</span></div>
            </div>
          </div>
          <div class="cli-head-meta">
            <span>${ico('calendar',12)} Ingreso ${formatFecha(orden.creado_en)}</span>
            <span>🏁 Entrega ${formatFecha(orden.fecha_entrega_1) || '—'}</span>
            ${orden.aseguradora ? `<span>🛡 ${escapeHtml(orden.aseguradora)}</span>` : ''}
          </div>
        </div>
        <div class="cliente-body">
          ${estadoBanner}
          ${orden.cotizacion_url ? `
          <a href="${safeUrl(orden.cotizacion_url)}" target="_blank" rel="noopener noreferrer" class="cli-doc-link">
            <span class="cli-doc-ico">${ico('file',16)}</span>
            <span style="flex:1"><b>Cotización</b><br><span style="color:var(--gris-mid);font-size:11px">Documento de tu vehículo</span></span>
            <span class="cli-doc-cta">Ver PDF →</span>
          </a>` : ''}
          <div class="seccion-titulo">Avance del proceso</div>
          <div class="cli-timeline">${etapasHtml}</div>
          ${novsHtml}
          ${fotosHtml}
        </div>
      </div>`;
    }).join('') + _cliBrandFooter();
  } catch(e) {
    cont.innerHTML = `<div class="empty-state">Error: ${e.message}</div>`;
  }
}