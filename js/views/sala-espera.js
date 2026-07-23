// ═══════════════════════════════════════════════════════════
// SALA DE ESPERA — Tablero TV
// ═══════════════════════════════════════════════════════════

let _sePollingInterval = null;
let _seRelojInterval   = null;

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
        display:flex; flex-direction:column; height:100vh; overflow:hidden; position:relative;
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
        flex:1; overflow-y:auto; padding:.8em 1.2em 1.2em;
        display:grid;
        grid-template-columns: repeat(auto-fill, minmax(26em, 1fr));
        align-content:start;
        gap:.6em;
      }
      .se-lista-wrap::-webkit-scrollbar { width:4px; }
      .se-lista-wrap::-webkit-scrollbar-thumb { background:rgba(255,255,255,.15); border-radius:2px; }

      .se-orden-card {
        background:rgba(255,255,255,.04);
        border:1px solid rgba(255,255,255,.07);
        border-radius:.6em;
        padding:.75em 1em;
        display:grid;
        grid-template-columns: auto 1fr auto;
        gap:.5em 1em;
        align-items:center;
        transition:background .3s;
        animation:se-fade-in .4s ease;
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

      .se-chip {
        font-size:.72em; font-weight:700; letter-spacing:.06em;
        text-transform:uppercase; border-radius:2em;
        padding:.3em .85em; white-space:nowrap;
      }
      .se-chip-azul     { background:rgba(59,130,246,.2);   color:#93C5FD;  border:1px solid rgba(59,130,246,.35); }
      .se-chip-verde    { background:rgba(34,197,94,.2);    color:#86EFAC;  border:1px solid rgba(34,197,94,.35); }
      .se-chip-gris     { background:rgba(148,163,184,.15); color:#94A3B8;  border:1px solid rgba(148,163,184,.25); }
      .se-chip-amarillo { background:rgba(251,191,36,.15);  color:#FCD34D;  border:1px solid rgba(251,191,36,.3); }

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
        grid-column: 1 / -1;
        display:flex; flex-direction:column; align-items:center; justify-content:center;
        height:60%; opacity:.4; gap:1em;
      }
      .se-vacio svg { width:3.5em; height:3.5em; opacity:.5; }
      .se-vacio p { font-size:1.1em; color:#94A3B8; }

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
    `;
    document.head.appendChild(st);
  }

  // ── Construir estructura ───────────────────────────────────
  const pag = document.getElementById('pag-sala-espera');
  pag.innerHTML = `
    <div class="se-shell">
      <div class="se-header">
        <div class="se-header-logo">
          <img src="img/logo.png" alt="Logo" onerror="this.style.display='none'">
          <span class="se-header-nombre" id="se-nombre-taller">Taller Automotriz</span>
        </div>
        <div class="se-reloj" id="se-reloj">--:--:--</div>
      </div>
      <div class="se-lista-wrap" id="se-lista"></div>
    </div>
    <button class="se-btn-salir" id="se-btn-salir">✕ Salir</button>
  `;

  try {
    const nombreEl = document.getElementById('se-nombre-taller');
    if (window.sesion?.empresa) nombreEl.textContent = window.sesion.empresa;
    else if (window.CONFIG?.NOMBRE_TALLER) nombreEl.textContent = CONFIG.NOMBRE_TALLER;
  } catch(e) { /* silencio */ }

  document.getElementById('se-btn-salir').addEventListener('click', _seSalir);

  _seActualizarReloj();
  _seRelojInterval = setInterval(_seActualizarReloj, 1000);

  _seCargarOrdenes();
  _sePollingInterval = setInterval(_seCargarOrdenes, 30000);
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

    const ids = ordenes.map(o => o.id).join(',');
    const resEtapas = await fetch(
      `${SUPABASE_URL}/rest/v1/etapas?orden_id=in.(${ids})&select=orden_id,servicio,inicio,fin&order=orden_id`,
      { headers: { apikey: SUPABASE_KEY, Authorization: 'Bearer ' + SUPABASE_KEY } }
    );
    const etapas = resEtapas.ok ? await resEtapas.json() : [];

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
        <div class="se-placa">${_seEsc(orden.placa || '—')}</div>
        <div class="se-propietario">${_seEsc(nombre)}</div>
      </div>
      <div class="se-info">
        <div class="se-info-nombre">${_seEsc(propietario)}</div>
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
  if (!etapas.length) return { chip: 'Recién ingresado', chipClass: 'se-chip-amarillo' };
  const activa = etapas.find(e => e.inicio && !e.fin);
  if (activa) return { chip: activa.servicio || 'En proceso', chipClass: 'se-chip-azul' };
  if (etapas.every(e => e.fin)) return { chip: 'Listo para entrega', chipClass: 'se-chip-verde' };
  return { chip: 'En revisión', chipClass: 'se-chip-gris' };
}

function _seProgreso(etapas) {
  if (!etapas.length) return { pct: 0 };
  return { pct: Math.round((etapas.filter(e => e.fin).length / etapas.length) * 100) };
}

function _seSubtitulo(etapas) {
  if (!etapas.length) return 'Sin etapas registradas';
  const activa = etapas.find(e => e.inicio && !e.fin);
  if (activa) {
    const desde = activa.inicio ? _seHorasDesde(activa.inicio) : '';
    return desde ? `En ${activa.servicio} · ${desde}` : `En ${activa.servicio}`;
  }
  const ok = etapas.filter(e => e.fin).length;
  return `${ok} de ${etapas.length} etapas completadas`;
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

function _seEsc(str) {
  return String(str)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ── Salir ──────────────────────────────────────────────────
function _seSalir() {
  if (_sePollingInterval) { clearInterval(_sePollingInterval); _sePollingInterval = null; }
  if (_seRelojInterval)   { clearInterval(_seRelojInterval);   _seRelojInterval   = null; }

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
