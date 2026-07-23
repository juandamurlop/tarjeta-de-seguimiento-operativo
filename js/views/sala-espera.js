// ═══════════════════════════════════════════════════════════
// SALA DE ESPERA — Tablero TV + galería de fotos
// ═══════════════════════════════════════════════════════════

let _sePollingInterval  = null;
let _seGaleriaInterval  = null;
let _seRelojInterval    = null;
let _seImagenes         = [];
let _seImagenActual     = 0;
let _seSlotActivo       = 0; // 0 o 1 — doble buffer para el fade

function montarSalaEspera() {
  // ── Modo TV: ocultar chrome de la app ──────────────────────
  const sidebar   = document.getElementById('sidebar');
  const overlay   = document.getElementById('sidebar-overlay');
  const hamburger = document.querySelector('.hamburger');
  const bottomNav = document.getElementById('bottom-nav');
  const topbar    = document.querySelector('.topbar');
  const main      = document.querySelector('.main');
  const content   = document.querySelector('.content');

  if (sidebar)   sidebar.style.display   = 'none';
  if (overlay)   overlay.style.display   = 'none';
  if (hamburger) hamburger.style.display = 'none';
  if (bottomNav) bottomNav.style.display = 'none';
  if (topbar)    topbar.style.display    = 'none';
  if (main)   { main.style.marginLeft = '0'; main.style.height = '100vh'; main.style.overflow = 'hidden'; }
  if (content){ content.style.padding = '0'; content.style.maxWidth = '100%'; content.style.height = '100%'; }

  document.body.style.background = '#0F172A';
  document.body.style.overflow   = 'hidden';
  document.body.style.height     = '100vh';

  // ── Inyectar estilos una vez ───────────────────────────────
  if (!document.getElementById('se-styles')) {
    const st = document.createElement('style');
    st.id = 'se-styles';
    st.textContent = `
      #pag-sala-espera {
        background:#0F172A; color:#F1F5F9;
        height:100vh; overflow:hidden;
        display:flex; flex-direction:column;
        font-size:clamp(12px,1.1vw,18px);
      }
      .se-shell {
        display:flex; height:100vh; overflow:hidden; position:relative;
      }

      /* ── COLUMNA IZQUIERDA ── */
      .se-tablero {
        flex: 0 0 65%; display:flex; flex-direction:column;
        border-right:1px solid rgba(255,255,255,.08);
        overflow:hidden;
      }
      .se-header {
        display:flex; align-items:center; justify-content:space-between;
        padding:.8em 1.4em;
        background:rgba(255,255,255,.03);
        border-bottom:1px solid rgba(255,255,255,.06);
        flex-shrink:0;
      }
      .se-header-logo {
        display:flex; align-items:center; gap:.7em;
      }
      .se-header-logo img {
        height:2.4em; width:auto; object-fit:contain;
      }
      .se-header-nombre {
        font-size:1.25em; font-weight:700; letter-spacing:.04em;
        color:#F1F5F9;
      }
      .se-reloj {
        font-family:'DM Mono',monospace; font-size:1.6em; font-weight:700;
        color:#38BDF8; letter-spacing:.06em;
      }

      .se-lista-wrap {
        flex:1; overflow-y:auto; padding:.6em 1em 1em;
      }
      .se-lista-wrap::-webkit-scrollbar { width:4px; }
      .se-lista-wrap::-webkit-scrollbar-thumb { background:rgba(255,255,255,.15); border-radius:2px; }

      .se-orden-card {
        background:rgba(255,255,255,.04);
        border:1px solid rgba(255,255,255,.07);
        border-radius:.6em;
        padding:.75em 1em;
        margin-bottom:.55em;
        display:grid;
        grid-template-columns: auto 1fr auto;
        gap:.5em 1em;
        align-items:center;
        transition:background .3s;
      }
      .se-orden-card:hover {
        background:rgba(255,255,255,.07);
      }

      .se-placa {
        font-family:'DM Mono',monospace;
        font-size:1.7em; font-weight:900;
        letter-spacing:.12em;
        color:#F8FAFC;
        line-height:1;
      }
      .se-propietario {
        font-size:.85em; color:#94A3B8; margin-top:.15em;
        white-space:nowrap; overflow:hidden; text-overflow:ellipsis;
      }

      .se-info { overflow:hidden; }
      .se-info-nombre {
        font-size:1em; font-weight:600; color:#E2E8F0;
        white-space:nowrap; overflow:hidden; text-overflow:ellipsis;
      }
      .se-info-sub {
        font-size:.78em; color:#64748B; margin-top:.1em;
        white-space:nowrap; overflow:hidden; text-overflow:ellipsis;
      }

      /* chips de estado */
      .se-chip {
        font-size:.72em; font-weight:700; letter-spacing:.06em;
        text-transform:uppercase; border-radius:2em;
        padding:.3em .85em; white-space:nowrap;
      }
      .se-chip-azul   { background:rgba(59,130,246,.2);  color:#93C5FD; border:1px solid rgba(59,130,246,.35); }
      .se-chip-verde  { background:rgba(34,197,94,.2);   color:#86EFAC; border:1px solid rgba(34,197,94,.35); }
      .se-chip-gris   { background:rgba(148,163,184,.15); color:#94A3B8; border:1px solid rgba(148,163,184,.25); }
      .se-chip-amarillo { background:rgba(251,191,36,.15); color:#FCD34D; border:1px solid rgba(251,191,36,.3); }

      /* barra de progreso */
      .se-progreso-wrap {
        grid-column: 1 / -1;
        display:flex; align-items:center; gap:.6em;
      }
      .se-progreso-bar {
        flex:1; height:.35em;
        background:rgba(255,255,255,.08); border-radius:1em; overflow:hidden;
      }
      .se-progreso-fill {
        height:100%; border-radius:1em;
        background:linear-gradient(90deg,#3B82F6,#38BDF8);
        transition:width .5s ease;
      }
      .se-progreso-pct {
        font-family:'DM Mono',monospace; font-size:.7em; color:#64748B;
        min-width:2.5em; text-align:right;
      }

      .se-vacio {
        display:flex; flex-direction:column; align-items:center; justify-content:center;
        height:60%; opacity:.4; gap:1em;
      }
      .se-vacio svg { width:3.5em; height:3.5em; opacity:.5; }
      .se-vacio p { font-size:1.1em; color:#94A3B8; }

      /* ── COLUMNA DERECHA — GALERÍA ── */
      .se-galeria {
        flex:0 0 35%; position:relative; overflow:hidden;
        background:#000;
      }
      .se-galeria-slot {
        position:absolute; inset:0;
        display:flex; align-items:center; justify-content:center;
        transition:opacity .8s ease;
      }
      .se-galeria-slot img,
      .se-galeria-slot video {
        width:100%; height:100%; object-fit:cover;
      }
      .se-galeria-placeholder {
        display:flex; flex-direction:column;
        align-items:center; justify-content:center;
        color:#475569; text-align:center; padding:2em; gap:1em;
      }
      .se-galeria-placeholder svg { width:4em; height:4em; opacity:.35; }
      .se-galeria-placeholder p { font-size:1.1em; line-height:1.5; }

      /* ── BOTÓN SALIR ── */
      .se-btn-salir {
        position:fixed; bottom:1.2em; right:1.2em; z-index:9999;
        background:rgba(15,23,42,.85); color:#94A3B8;
        border:1px solid rgba(255,255,255,.12);
        border-radius:2em; padding:.45em 1.1em;
        font-size:.78em; cursor:pointer;
        backdrop-filter:blur(8px);
        transition:color .2s, border-color .2s;
      }
      .se-btn-salir:hover { color:#F1F5F9; border-color:rgba(255,255,255,.3); }

      @keyframes se-fade-in {
        from { opacity:0; } to { opacity:1; }
      }
      .se-orden-card { animation:se-fade-in .4s ease; }
    `;
    document.head.appendChild(st);
  }

  // ── Construir estructura ───────────────────────────────────
  const pag = document.getElementById('pag-sala-espera');
  pag.innerHTML = `
    <div class="se-shell">
      <!-- TABLERO -->
      <div class="se-tablero">
        <div class="se-header">
          <div class="se-header-logo">
            <img src="img/logo.png" alt="Logo" onerror="this.style.display='none'">
            <span class="se-header-nombre" id="se-nombre-taller">Taller Automotriz</span>
          </div>
          <div class="se-reloj" id="se-reloj">--:--:--</div>
        </div>
        <div class="se-lista-wrap" id="se-lista"></div>
      </div>

      <!-- GALERÍA -->
      <div class="se-galeria" id="se-galeria">
        <div class="se-galeria-slot" id="se-slot-0" style="opacity:1"></div>
        <div class="se-galeria-slot" id="se-slot-1" style="opacity:0"></div>
      </div>
    </div>

    <button class="se-btn-salir" id="se-btn-salir">✕ Salir</button>
  `;

  // Nombre del taller desde sesión/config si está disponible
  try {
    const nombreEl = document.getElementById('se-nombre-taller');
    if (window.sesion?.empresa) nombreEl.textContent = window.sesion.empresa;
    else if (window.CONFIG?.NOMBRE_TALLER) nombreEl.textContent = CONFIG.NOMBRE_TALLER;
  } catch(e) { /* silencio */ }

  // Botón salir
  document.getElementById('se-btn-salir').addEventListener('click', _seSalir);

  // Iniciar reloj
  _seActualizarReloj();
  _seRelojInterval = setInterval(_seActualizarReloj, 1000);

  // Cargar tablero
  _seCargarOrdenes();
  _sePollingInterval = setInterval(_seCargarOrdenes, 30000);

  // Cargar galería
  _seIniciarGaleria();
}

// ── Reloj ──────────────────────────────────────────────────
function _seActualizarReloj() {
  const el = document.getElementById('se-reloj');
  if (!el) return;
  const ahora = new Date();
  const hh = String(ahora.getHours()).padStart(2,'0');
  const mm = String(ahora.getMinutes()).padStart(2,'0');
  const ss = String(ahora.getSeconds()).padStart(2,'0');
  el.textContent = `${hh}:${mm}:${ss}`;
}

// ── Tablero ────────────────────────────────────────────────
async function _seCargarOrdenes() {
  const lista = document.getElementById('se-lista');
  if (!lista) return;

  try {
    // Traer órdenes activas
    const resOrdenes = await fetch(
      `${SUPABASE_URL}/rest/v1/ordenes?or=(estado.eq.Activa,estado.is.null)&pulmon=not.eq.true&order=creado_en.desc&limit=20&select=id,placa,propietario,estado,creado_en`,
      { headers: { apikey: SUPABASE_KEY, Authorization: 'Bearer ' + SUPABASE_KEY } }
    );
    if (!resOrdenes.ok) throw new Error('ordenes');
    const ordenes = await resOrdenes.json();

    if (!ordenes.length) {
      lista.innerHTML = `
        <div class="se-vacio">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
          </svg>
          <p>No hay vehículos en taller en este momento</p>
        </div>`;
      return;
    }

    // Traer etapas de esas órdenes
    const ids = ordenes.map(o => o.id).join(',');
    const resEtapas = await fetch(
      `${SUPABASE_URL}/rest/v1/etapas?orden_id=in.(${ids})&select=orden_id,servicio,inicio,fin&order=orden_id`,
      { headers: { apikey: SUPABASE_KEY, Authorization: 'Bearer ' + SUPABASE_KEY } }
    );
    const etapas = resEtapas.ok ? await resEtapas.json() : [];

    // Agrupar etapas por orden
    const etapasPorOrden = {};
    for (const e of etapas) {
      if (!etapasPorOrden[e.orden_id]) etapasPorOrden[e.orden_id] = [];
      etapasPorOrden[e.orden_id].push(e);
    }

    lista.innerHTML = ordenes.map(o => _seRenderCard(o, etapasPorOrden[o.id] || [])).join('');

  } catch(e) {
    console.error('[SalaEspera] Error cargando órdenes:', e);
  }
}

function _seRenderCard(orden, etapas) {
  const { chip, chipClass } = _seEstado(etapas);
  const { pct } = _seProgreso(etapas);

  const propietario = orden.propietario || '';
  const nombre = propietario.length > 28 ? propietario.slice(0,28) + '…' : propietario;

  return `
    <div class="se-orden-card">
      <div>
        <div class="se-placa">${_esc(orden.placa || '—')}</div>
        <div class="se-propietario">${_esc(nombre)}</div>
      </div>
      <div class="se-info">
        <div class="se-info-nombre">${_esc(propietario)}</div>
        <div class="se-info-sub">${_seSubtitulo(etapas)}</div>
      </div>
      <div>
        <span class="se-chip ${chipClass}">${chip}</span>
      </div>
      <div class="se-progreso-wrap">
        <div class="se-progreso-bar">
          <div class="se-progreso-fill" style="width:${pct}%"></div>
        </div>
        <span class="se-progreso-pct">${pct}%</span>
      </div>
    </div>`;
}

function _seEstado(etapas) {
  if (!etapas.length) {
    return { chip: 'Recién ingresado', chipClass: 'se-chip-amarillo' };
  }
  const activa = etapas.find(e => e.inicio && !e.fin);
  if (activa) {
    return { chip: activa.servicio || 'En proceso', chipClass: 'se-chip-azul' };
  }
  const todasTerminadas = etapas.every(e => e.fin);
  if (todasTerminadas) {
    return { chip: 'Listo para entrega', chipClass: 'se-chip-verde' };
  }
  return { chip: 'En revisión', chipClass: 'se-chip-gris' };
}

function _seProgreso(etapas) {
  if (!etapas.length) return { pct: 0 };
  const terminadas = etapas.filter(e => e.fin).length;
  const pct = Math.round((terminadas / etapas.length) * 100);
  return { pct };
}

function _seSubtitulo(etapas) {
  if (!etapas.length) return 'Sin etapas registradas';
  const activa = etapas.find(e => e.inicio && !e.fin);
  if (activa) {
    const desde = activa.inicio ? _seHorasDesde(activa.inicio) : '';
    return desde ? `En ${activa.servicio} · ${desde}` : `En ${activa.servicio}`;
  }
  const total = etapas.length;
  const ok    = etapas.filter(e => e.fin).length;
  return `${ok} de ${total} etapas completadas`;
}

function _seHorasDesde(isoStr) {
  try {
    const mins = Math.floor((Date.now() - new Date(isoStr).getTime()) / 60000);
    if (mins < 1)  return 'recién iniciado';
    if (mins < 60) return `hace ${mins} min`;
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return m ? `hace ${h}h ${m}m` : `hace ${h}h`;
  } catch(e) { return ''; }
}

function _esc(str) {
  return String(str)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ── Galería ────────────────────────────────────────────────
async function _seIniciarGaleria() {
  try {
    const res = await fetch(
      `${SUPABASE_URL}/storage/v1/object/list/${BUCKET}`,
      {
        method: 'POST',
        headers: {
          apikey: SUPABASE_KEY,
          Authorization: 'Bearer ' + SUPABASE_KEY,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ prefix: 'galeria/', limit: 50 })
      }
    );

    if (!res.ok) throw new Error('list');
    const archivos = await res.json();

    // Filtrar solo imágenes y videos
    const soportados = /\.(jpe?g|png|webp|gif|mp4)$/i;
    _seImagenes = (archivos || [])
      .filter(f => f.name && soportados.test(f.name))
      .map(f => ({
        url: `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/galeria/${f.name}`,
        esVideo: /\.mp4$/i.test(f.name)
      }));

  } catch(e) {
    _seImagenes = [];
  }

  if (!_seImagenes.length) {
    _seRenderPlaceholder();
    return;
  }

  _seImagenActual = 0;
  _seSlotActivo   = 0;
  await _seMostrarMedia(_seImagenes[0], 0);

  _seGaleriaInterval = setInterval(_seRotarGaleria, 6000);
}

async function _seRotarGaleria() {
  if (!_seImagenes.length) return;
  _seImagenActual = (_seImagenActual + 1) % _seImagenes.length;
  const siguiente = (_seSlotActivo + 1) % 2;

  await _seMostrarMedia(_seImagenes[_seImagenActual], siguiente);

  // Fade: mostrar siguiente, ocultar actual
  const slotShow = document.getElementById(`se-slot-${siguiente}`);
  const slotHide = document.getElementById(`se-slot-${_seSlotActivo}`);
  if (slotShow) slotShow.style.opacity = '1';
  if (slotHide) slotHide.style.opacity = '0';

  // Pausar/detener el video en el slot que se oculta
  const videoOld = slotHide?.querySelector('video');
  if (videoOld) videoOld.pause();

  _seSlotActivo = siguiente;
}

function _seMostrarMedia(item, slotIdx) {
  return new Promise(resolve => {
    const slot = document.getElementById(`se-slot-${slotIdx}`);
    if (!slot) { resolve(); return; }

    slot.innerHTML = '';
    if (item.esVideo) {
      const vid = document.createElement('video');
      vid.src     = item.url;
      vid.loop    = true;
      vid.muted   = true;
      vid.autoplay= true;
      vid.playsInline = true;
      vid.style.cssText = 'width:100%;height:100%;object-fit:cover;';
      vid.oncanplay = () => { vid.play().catch(()=>{}); resolve(); };
      vid.onerror   = resolve;
      slot.appendChild(vid);
    } else {
      const img = document.createElement('img');
      img.src = item.url;
      img.alt = '';
      img.style.cssText = 'width:100%;height:100%;object-fit:cover;';
      img.onload  = resolve;
      img.onerror = resolve;
      slot.appendChild(img);
    }
  });
}

function _seRenderPlaceholder() {
  const g = document.getElementById('se-galeria');
  if (!g) return;
  const s0 = document.getElementById('se-slot-0');
  if (s0) s0.style.opacity = '1';
  s0.innerHTML = `
    <div class="se-galeria-placeholder">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2">
        <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
        <circle cx="8.5" cy="8.5" r="1.5"/>
        <polyline points="21 15 16 10 5 21"/>
      </svg>
      <p>Próximamente<br>fotos del taller</p>
    </div>`;
}

// ── Salir ──────────────────────────────────────────────────
function _seSalir() {
  // Detener todos los intervalos
  if (_sePollingInterval)  { clearInterval(_sePollingInterval);  _sePollingInterval  = null; }
  if (_seGaleriaInterval)  { clearInterval(_seGaleriaInterval);  _seGaleriaInterval  = null; }
  if (_seRelojInterval)    { clearInterval(_seRelojInterval);    _seRelojInterval    = null; }

  // Pausar videos en curso
  document.querySelectorAll('#pag-sala-espera video').forEach(v => v.pause());

  // Restaurar chrome de la app
  const sidebar   = document.getElementById('sidebar');
  const overlay   = document.getElementById('sidebar-overlay');
  const hamburger = document.querySelector('.hamburger');
  const bottomNav = document.getElementById('bottom-nav');
  const topbar    = document.querySelector('.topbar');
  const main      = document.querySelector('.main');
  const content   = document.querySelector('.content');

  if (topbar)    topbar.style.display    = '';
  if (sidebar)   sidebar.style.display   = '';
  if (hamburger) hamburger.style.display = '';
  if (bottomNav) bottomNav.style.display = '';
  if (overlay)   overlay.style.display   = '';
  if (main)   { main.style.marginLeft = ''; main.style.height = ''; main.style.overflow = ''; }
  if (content){ content.style.padding = ''; content.style.maxWidth = ''; content.style.height = ''; }

  document.body.style.background = '';
  document.body.style.overflow   = '';
  document.body.style.height     = '';

  if (typeof navJefe === 'function') navJefe('ordenes');
}
