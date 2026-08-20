// ═══════════════════════════════════════════════════════════
// SALA DE ESPERA — Tablero TV
// ═══════════════════════════════════════════════════════════

let _sePollingInterval = null;
let _seRelojInterval   = null;

function montarSalaEspera() {
  // ── Modo TV: ocultar chrome de la app via clase CSS ───────

  // ── Inyectar estilos una vez ───────────────────────────────
  document.body.classList.add('se-tv-mode');

  // ── Inyectar estilos una vez ───────────────────────────────
  if (!document.getElementById('se-styles')) {
    const st = document.createElement('style');
    st.id = 'se-styles';
    st.textContent = `
      body.se-tv-mode .topbar,
      body.se-tv-mode #sidebar,
      body.se-tv-mode .hamburger,
      body.se-tv-mode #bottom-nav,
      body.se-tv-mode #sidebar-overlay { display: none !important; }
      body.se-tv-mode .main { margin-left: 0 !important; height: 100vh !important; overflow: hidden !important; }
      body.se-tv-mode .content { padding: 0 !important; max-width: 100% !important; height: 100% !important; }
      body.se-tv-mode { background: #0F172A !important; overflow: hidden !important; height: 100vh !important; }
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

  // ── Estilos adicionales para sidebar dinámico, pulmón y meta ─
  if (!document.getElementById('se-styles-extra')) {
    const st2 = document.createElement('style');
    st2.id = 'se-styles-extra';
    st2.textContent = `
      .se-body { flex:1; display:flex; overflow:hidden; }
      .se-main { flex:1; display:flex; flex-direction:column; overflow:hidden; }
      .se-sidebar {
        width:200px; flex-shrink:0;
        border-left:1px solid rgba(255,255,255,.06);
        display:flex; flex-direction:column; overflow:hidden;
      }
      .se-sb-section { padding:10px 12px; border-bottom:1px solid rgba(255,255,255,.06); }
      .se-sb-label {
        font-size:9px; font-weight:800; letter-spacing:.12em;
        text-transform:uppercase; color:#64748B; margin-bottom:7px;
      }
      .se-sb-item {
        display:flex; align-items:center; gap:7px;
        padding:4px 0; border-bottom:1px solid rgba(255,255,255,.03);
      }
      .se-sb-item:last-child { border-bottom:none; }
      .se-sb-dot { width:6px; height:6px; border-radius:50%; flex-shrink:0; }
      .se-sb-placa { font-family:'DM Mono',monospace; font-size:12px; font-weight:700; color:#F1F5F9; }
      .se-sb-sub   { font-size:9px; color:#64748B; }

      .se-pulmon-strip {
        flex-shrink:0;
        border-top:1px solid rgba(167,139,250,.15);
        padding:5px 12px 6px;
        background:rgba(167,139,250,.04);
        display:flex; align-items:center; gap:10px; flex-wrap:wrap;
      }
      .se-pulmon-lbl {
        font-size:9px; font-weight:800; letter-spacing:.12em;
        text-transform:uppercase; color:#A78BFA; white-space:nowrap;
        display:flex; align-items:center; gap:5px; flex-shrink:0;
      }
      .se-pulmon-lbl::before {
        content:''; display:inline-block;
        width:5px; height:5px; border-radius:50%; background:#A78BFA;
      }
      .se-pulmon-chips { display:flex; gap:5px; flex-wrap:wrap; }
      .se-pulmon-chip {
        display:flex; align-items:center; gap:5px;
        background:rgba(167,139,250,.1);
        border:1px solid rgba(167,139,250,.22);
        border-radius:99px; padding:2px 9px 2px 6px;
      }
      .se-pulmon-chip-dot { width:5px; height:5px; border-radius:50%; flex-shrink:0; }
      .se-pulmon-chip-placa { font-family:'DM Mono',monospace; font-size:11px; font-weight:800; letter-spacing:.07em; color:#C4B5FD; }
      .se-pulmon-chip-sub   { font-size:9px; color:#64748B; }

      .se-meta-footer {
        flex-shrink:0;
        display:flex; align-items:center; gap:14px;
        padding:6px 16px;
        background:rgba(16,185,129,.04);
        border-top:1px solid rgba(16,185,129,.12);
      }
      .se-meta-lbl { font-size:9px; font-weight:800; letter-spacing:.1em; text-transform:uppercase; color:#10B981; white-space:nowrap; }
      .se-meta-nums { font-family:'DM Mono',monospace; font-size:13px; font-weight:700; color:#F1F5F9; white-space:nowrap; }
      .se-meta-nums span { color:#10B981; }
      .se-meta-bar-wrap { flex:1; height:5px; background:rgba(255,255,255,.06); border-radius:99px; overflow:hidden; }
      .se-meta-bar-fill { height:100%; border-radius:99px; background:linear-gradient(90deg,#059669,#10B981); }
      .se-meta-pct { font-family:'DM Mono',monospace; font-size:11px; font-weight:700; color:#10B981; white-space:nowrap; }
      .se-meta-faltan { font-size:10px; color:#64748B; white-space:nowrap; }
      .se-meta-faltan strong { color:#F59E0B; }
    `;
    document.head.appendChild(st2);
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
      <div class="se-body">
        <div class="se-main">
          <div class="se-lista-wrap" id="se-lista"></div>
          <div id="se-pulmon-strip" style="display:none"></div>
        </div>
        <div class="se-sidebar" id="se-sidebar" style="display:none"></div>
      </div>
      <div id="se-meta-footer" style="display:none"></div>
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
    const hdrs = { apikey: SUPABASE_KEY, Authorization: 'Bearer ' + SUPABASE_KEY };
    const hoy = new Date();
    const inicioMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1).toISOString();

    const [resOrdenes, resPulmon, resMeta] = await Promise.all([
      fetch(`${SUPABASE_URL}/rest/v1/ordenes?or=(estado.eq.Activa,estado.eq.Programada,estado.is.null)&pulmon=not.eq.true&order=creado_en.desc&limit=30&select=id,placa,propietario,estado,creado_en`, { headers: hdrs }),
      fetch(`${SUPABASE_URL}/rest/v1/ordenes?pulmon=eq.true&or=(estado.eq.Activa,estado.eq.Programada)&select=id,placa,pulmon_tipo&order=creado_en.desc&limit=30`, { headers: hdrs }),
      fetch(`${SUPABASE_URL}/rest/v1/ventas_mensuales?ano=eq.${hoy.getFullYear()}&mes_num=eq.${hoy.getMonth()+1}&select=meta_base&limit=1`, { headers: hdrs }),
    ]);

    const ordenes  = resOrdenes.ok  ? await resOrdenes.json()  : [];
    const pulmon   = resPulmon.ok   ? await resPulmon.json()   : [];
    const metaArr  = resMeta.ok     ? await resMeta.json()     : [];
    const metaBase = Number(metaArr[0]?.meta_base) || 0;

    // Facturado del mes (localStorage base + ordenes post-base)
    const _mesKey   = `facturado_base_${hoy.getFullYear()}_${hoy.getMonth()}`;
    const _fechaKey = `facturado_base_fecha_${hoy.getFullYear()}_${hoy.getMonth()}`;
    const _base     = parseInt(localStorage.getItem(_mesKey) || '0', 10);

    // Etapas para órdenes activas
    if (!ordenes.length && !pulmon.length) {
      lista.innerHTML = `
        <div class="se-vacio">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
          </svg>
          <p>No hay vehículos en taller en este momento</p>
        </div>`;
      _seRenderSidebar([], []);
      _seRenderPulmon([]);
      _seRenderMeta(0, metaBase);
      return;
    }

    const ids = ordenes.map(o => o.id).join(',');
    const resEtapas = ids ? await fetch(
      `${SUPABASE_URL}/rest/v1/etapas?orden_id=in.(${ids})&select=orden_id,servicio,inicio,fin&order=orden_id`,
      { headers: hdrs }
    ) : null;
    const etapas = resEtapas?.ok ? await resEtapas.json() : [];

    const etapasPorOrden = {};
    for (const e of etapas) {
      if (!etapasPorOrden[e.orden_id]) etapasPorOrden[e.orden_id] = [];
      etapasPorOrden[e.orden_id].push(e);
    }

    // Separar activas/programadas de listos para entrega
    const listos      = ordenes.filter(o => {
      const ets = etapasPorOrden[o.id] || [];
      return ets.length > 0 && ets.every(e => e.fin);
    });
    const programadas = ordenes.filter(o => o.estado === 'Programada');
    const enProceso   = ordenes.filter(o => !listos.includes(o) && o.estado !== 'Programada');

    lista.innerHTML = enProceso.map(o => _seRenderCard(o, etapasPorOrden[o.id] || [])).join('') ||
      `<div class="se-vacio"><p>Sin vehículos en proceso</p></div>`;

    _seRenderSidebar(listos, programadas);
    _seRenderPulmon(pulmon);
    _seRenderMeta(_base, metaBase);

  } catch(e) {
    console.error('[SalaEspera] Error cargando órdenes:', e);
  }
}

function _seRenderSidebar(listos, programadas) {
  const sb = document.getElementById('se-sidebar');
  if (!sb) return;
  const hayAlgo = listos.length || programadas.length;
  sb.style.display = hayAlgo ? '' : 'none';
  if (!hayAlgo) return;

  const mkItem = (o, color) => `
    <div class="se-sb-item">
      <div class="se-sb-dot" style="background:${color}"></div>
      <div>
        <div class="se-sb-placa">${_seEsc(o.placa || '—')}</div>
        <div class="se-sb-sub">${o.estado === 'Programada' ? 'Programada' : 'Listo para entrega'}</div>
      </div>
    </div>`;

  sb.innerHTML =
    (listos.length ? `<div class="se-sb-section">
      <div class="se-sb-label">Para entregar · ${listos.length}</div>
      ${listos.map(o => mkItem(o, '#10B981')).join('')}
    </div>` : '') +
    (programadas.length ? `<div class="se-sb-section">
      <div class="se-sb-label">Programadas · ${programadas.length}</div>
      ${programadas.map(o => mkItem(o, '#F59E0B')).join('')}
    </div>` : '');
}

function _seRenderPulmon(pulmon) {
  const el = document.getElementById('se-pulmon-strip');
  if (!el) return;
  if (!pulmon.length) { el.style.display = 'none'; return; }
  el.style.display = '';
  el.className = 'se-pulmon-strip';
  el.innerHTML = `
    <div class="se-pulmon-lbl">Pulmón · ${pulmon.length}</div>
    <div class="se-pulmon-chips">
      ${pulmon.map(o => {
        const esInt = o.pulmon_tipo === 'interno';
        const dot   = esInt ? '#A78BFA' : '#60A5FA';
        const sub   = esInt ? 'Int.' : 'Ext.';
        return `<div class="se-pulmon-chip">
          <div class="se-pulmon-chip-dot" style="background:${dot}"></div>
          <span class="se-pulmon-chip-placa">${_seEsc(o.placa || '—')}</span>
          <span class="se-pulmon-chip-sub">${sub}</span>
        </div>`;
      }).join('')}
    </div>`;
}

function _seRenderMeta(base, metaBase) {
  const el = document.getElementById('se-meta-footer');
  if (!el) return;
  if (!metaBase) { el.style.display = 'none'; return; }
  el.style.display = '';
  el.className = 'se-meta-footer';
  const fmtM = v => v >= 1e6 ? (v/1e6).toFixed(1).replace('.0','') + 'M'
                  : v >= 1e3 ? Math.round(v/1e3) + 'K' : String(Math.round(v));
  const pct   = Math.min(Math.round((base / metaBase) * 100), 100);
  const falta = Math.max(0, metaBase - base);
  el.innerHTML = `
    <div class="se-meta-lbl">Meta mes</div>
    <div class="se-meta-nums"><span>${fmtM(base)}</span> / ${fmtM(metaBase)}</div>
    <div class="se-meta-bar-wrap">
      <div class="se-meta-bar-fill" style="width:${pct}%"></div>
    </div>
    <div class="se-meta-pct">${pct}%</div>
    <div class="se-meta-faltan">Faltan <strong>${fmtM(falta)}</strong></div>`;
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
function _seRestaurarLayout() {
  if (_sePollingInterval) { clearInterval(_sePollingInterval); _sePollingInterval = null; }
  if (_seRelojInterval)   { clearInterval(_seRelojInterval);   _seRelojInterval   = null; }

  document.body.classList.remove('se-tv-mode');
}

function _seSalirSilencioso() {
  _seRestaurarLayout();
}

function _seSalir() {
  _seRestaurarLayout();
  if (typeof navJefe === 'function') navJefe('ordenes');
}
