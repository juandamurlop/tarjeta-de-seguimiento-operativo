/* ================================================================
   BUSCADOR GLOBAL — Freimanautos
   Overlay de pantalla completa con búsqueda en tiempo real de órdenes
   ================================================================ */

(function () {
  /* ── Estilos ────────────────────────────────────────────────── */
  const style = document.createElement('style');
  style.textContent = `
    /* Overlay backdrop */
    .gs-overlay {
      position: fixed;
      inset: 0;
      z-index: 9900;
      background: rgba(0,0,0,0.55);
      backdrop-filter: blur(4px);
      -webkit-backdrop-filter: blur(4px);
      display: flex;
      align-items: flex-start;
      justify-content: center;
      padding: 60px 16px 24px;
      opacity: 0;
      pointer-events: none;
      transition: opacity 0.18s ease;
    }
    .gs-overlay.gs-visible {
      opacity: 1;
      pointer-events: all;
    }

    /* Panel contenedor */
    .gs-panel {
      width: 100%;
      max-width: 620px;
      background: var(--surface, #fff);
      border-radius: 16px;
      box-shadow: 0 24px 80px rgba(0,0,0,0.28), 0 0 0 1px rgba(255,255,255,0.07);
      overflow: hidden;
      transform: translateY(-12px);
      transition: transform 0.18s ease;
    }
    .gs-overlay.gs-visible .gs-panel {
      transform: translateY(0);
    }

    /* Fila del input */
    .gs-input-row {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 14px 16px;
      border-bottom: 1px solid var(--gris-borde, #e5e7eb);
    }
    .gs-icon-search {
      color: var(--gris-mid, #9ca3af);
      flex-shrink: 0;
    }
    .gs-input {
      flex: 1;
      border: none;
      outline: none;
      background: transparent;
      font-size: 17px;
      font-weight: 500;
      color: var(--texto, #111);
      font-family: inherit;
    }
    .gs-input::placeholder { color: var(--gris-mid, #9ca3af); font-weight: 400; }
    .gs-kbd-hint {
      font-size: 10px;
      color: var(--gris-mid, #9ca3af);
      background: var(--gris-borde, #e5e7eb);
      border-radius: 4px;
      padding: 2px 6px;
      font-family: 'DM Mono', monospace;
      white-space: nowrap;
      flex-shrink: 0;
    }

    /* Área de resultados */
    .gs-results {
      max-height: 420px;
      overflow-y: auto;
      padding: 8px 0;
    }

    /* Estado vacío / sin resultados */
    .gs-empty {
      padding: 36px 24px;
      text-align: center;
      color: var(--gris-mid, #9ca3af);
    }
    .gs-empty svg { margin-bottom: 10px; opacity: .5; }
    .gs-empty-title { font-size: 14px; font-weight: 500; color: var(--gris-texto, #6b7280); }
    .gs-empty-sub { font-size: 12px; margin-top: 4px; }

    /* Spinner */
    .gs-spinner {
      display: flex;
      justify-content: center;
      padding: 32px;
    }
    @keyframes gs-spin { to { transform: rotate(360deg); } }
    .gs-spin-circle {
      width: 24px; height: 24px;
      border: 2.5px solid var(--gris-borde, #e5e7eb);
      border-top-color: var(--azul, #1e3a5f);
      border-radius: 50%;
      animation: gs-spin 0.7s linear infinite;
    }

    /* Ítem de resultado */
    .gs-item {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 10px 16px;
      cursor: pointer;
      transition: background 0.12s;
      border-radius: 0;
      text-decoration: none;
    }
    .gs-item:hover, .gs-item:focus {
      background: var(--gris-fondo, #f3f4f6);
      outline: none;
    }
    .gs-item-icon {
      flex-shrink: 0;
      width: 40px; height: 40px;
      border-radius: 10px;
      background: var(--azul-claro, rgba(30,58,95,0.08));
      display: flex; align-items: center; justify-content: center;
    }
    .gs-item-body { flex: 1; min-width: 0; }
    .gs-item-top {
      display: flex;
      align-items: baseline;
      gap: 8px;
      margin-bottom: 2px;
    }
    .gs-item-placa {
      font-family: 'DM Mono', monospace;
      font-size: 15px;
      font-weight: 600;
      color: var(--texto, #111);
      letter-spacing: .5px;
    }
    .gs-item-ot {
      font-size: 11px;
      color: var(--gris-mid, #9ca3af);
      font-family: 'DM Mono', monospace;
    }
    .gs-item-bottom {
      font-size: 12px;
      color: var(--gris-texto, #6b7280);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    /* Chips de estado */
    .gs-chip {
      display: inline-flex;
      align-items: center;
      font-size: 10px;
      font-weight: 600;
      letter-spacing: .4px;
      text-transform: uppercase;
      padding: 2px 7px;
      border-radius: 20px;
      flex-shrink: 0;
    }
    .gs-chip-activa    { background: #dbeafe; color: #1d4ed8; }
    .gs-chip-entregada { background: #dcfce7; color: #15803d; }
    .gs-chip-archivada { background: #f3f4f6; color: #6b7280; }
    .gs-chip-programada { background: #fef3c7; color: #92400e; }

    /* Pie del panel */
    .gs-footer {
      border-top: 1px solid var(--gris-borde, #e5e7eb);
      padding: 8px 16px;
      font-size: 11px;
      color: var(--gris-mid, #9ca3af);
      display: flex;
      gap: 14px;
    }
    .gs-footer span { display: flex; align-items: center; gap: 4px; }

    /* Botón lupa en topbar */
    .gs-topbar-btn {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 6px 10px;
      border: 1px solid rgba(255,255,255,0.18);
      border-radius: 8px;
      background: rgba(255,255,255,0.09);
      color: rgba(255,255,255,0.85);
      cursor: pointer;
      font-size: 12px;
      font-family: inherit;
      transition: background 0.15s;
      white-space: nowrap;
      flex-shrink: 0;
    }
    .gs-topbar-btn:hover { background: rgba(255,255,255,0.17); }
    .gs-topbar-btn .gs-topbar-kbd {
      font-family: 'DM Mono', monospace;
      font-size: 9px;
      opacity: .65;
      background: rgba(255,255,255,0.12);
      border-radius: 3px;
      padding: 1px 4px;
    }

    /* Dark-mode tweaks */
    [data-theme="dark"] .gs-chip-activa    { background: rgba(29,78,216,0.25); color: #93c5fd; }
    [data-theme="dark"] .gs-chip-entregada { background: rgba(21,128,61,0.25); color: #86efac; }
    [data-theme="dark"] .gs-chip-archivada { background: rgba(107,114,128,0.18); color: #9ca3af; }
    [data-theme="dark"] .gs-chip-programada { background: rgba(146,64,14,0.25); color: #fde68a; }
    [data-theme="dark"] .gs-item:hover { background: rgba(255,255,255,0.06); }
    [data-theme="dark"] .gs-item-icon { background: rgba(255,255,255,0.07); }
    [data-theme="dark"] .gs-kbd-hint { background: rgba(255,255,255,0.08); }
  `;
  document.head.appendChild(style);

  /* ── HTML del overlay ────────────────────────────────────────── */
  const overlay = document.createElement('div');
  overlay.className = 'gs-overlay';
  overlay.id = 'gs-overlay';
  overlay.innerHTML = `
    <div class="gs-panel" id="gs-panel" role="dialog" aria-modal="true" aria-label="Buscador global">
      <div class="gs-input-row">
        <svg class="gs-icon-search" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
          <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
        </svg>
        <input
          id="gs-input"
          class="gs-input"
          type="text"
          autocomplete="off"
          spellcheck="false"
          placeholder="Placa, cliente o número de orden…"
        >
        <span class="gs-kbd-hint">ESC</span>
      </div>
      <div class="gs-results" id="gs-results"></div>
      <div class="gs-footer">
        <span>
          <svg width="11" height="11" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><polyline points="9 18 15 12 9 6"/></svg>
          <svg width="11" height="11" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><polyline points="15 6 9 12 15 18"/></svg>
          Navegar
        </span>
        <span>
          <svg width="11" height="11" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>
          Abrir
        </span>
        <span>
          <span style="font-family:'DM Mono',monospace;font-size:9px;background:var(--gris-borde,#e5e7eb);border-radius:3px;padding:1px 4px;">ESC</span>
          Cerrar
        </span>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  /* ── Estado ────────────────────────────────────────────────── */
  let _debounceTimer = null;
  let _lastQuery = '';
  let _focusedIdx = -1;

  const elOverlay = overlay;
  const elInput   = document.getElementById('gs-input');
  const elResults = document.getElementById('gs-results');

  /* ── Helpers ────────────────────────────────────────────────── */
  function chipClass(estado) {
    const e = (estado || '').toLowerCase();
    if (e === 'activa')     return 'gs-chip-activa';
    if (e === 'entregada')  return 'gs-chip-entregada';
    if (e === 'archivada')  return 'gs-chip-archivada';
    if (e === 'programada') return 'gs-chip-programada';
    return 'gs-chip-archivada';
  }

  function renderEmpty() {
    elResults.innerHTML = `
      <div class="gs-empty">
        <svg width="36" height="36" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
          <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
        </svg>
        <div class="gs-empty-title">Escribe una placa, nombre o número de orden</div>
        <div class="gs-empty-sub">Mínimo 2 caracteres para buscar</div>
      </div>`;
  }

  function renderSpinner() {
    elResults.innerHTML = `<div class="gs-spinner"><div class="gs-spin-circle"></div></div>`;
  }

  function renderNoResults(q) {
    elResults.innerHTML = `
      <div class="gs-empty">
        <svg width="32" height="32" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
          <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
        </svg>
        <div class="gs-empty-title">No se encontraron órdenes para "<strong>${q}</strong>"</div>
        <div class="gs-empty-sub">Intenta con otra placa, nombre o número</div>
      </div>`;
  }

  function renderResults(ordenes) {
    if (!ordenes.length) {
      renderNoResults(_lastQuery);
      return;
    }
    _focusedIdx = -1;
    elResults.innerHTML = ordenes.map((o, i) => {
      const vehiculo = [o.marca, o.linea].filter(Boolean).join(' ');
      const estado   = o.estado || 'Activa';
      return `
        <div class="gs-item" tabindex="0" data-id="${o.id}" data-idx="${i}"
             onclick="_gsAbrirOrden('${o.id}')"
             onkeydown="if(event.key==='Enter')_gsAbrirOrden('${o.id}')">
          <div class="gs-item-icon">
            <svg width="18" height="18" fill="none" stroke="var(--azul,#1e3a5f)" stroke-width="2" viewBox="0 0 24 24">
              <rect x="1" y="3" width="15" height="13" rx="2"/><path d="M16 8h4l3 4v3h-7V8z"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/>
            </svg>
          </div>
          <div class="gs-item-body">
            <div class="gs-item-top">
              <span class="gs-item-placa">${o.placa || '—'}</span>
              ${o.numero_ot ? `<span class="gs-item-ot">#${o.numero_ot}</span>` : ''}
            </div>
            <div class="gs-item-bottom">${o.propietario || '—'}${vehiculo ? ' · ' + vehiculo : ''}</div>
          </div>
          <span class="gs-chip ${chipClass(estado)}">${estado}</span>
        </div>`;
    }).join('');
  }

  /* ── Búsqueda ────────────────────────────────────────────────── */
  async function buscar(q) {
    _lastQuery = q;
    if (q.length < 2) {
      renderEmpty();
      return;
    }
    renderSpinner();
    try {
      const enc = encodeURIComponent(q);
      const url = `/ordenes?or=(placa.ilike.*${enc}*,propietario.ilike.*${enc}*,numero_ot.ilike.*${enc}*)&order=creado_en.desc&limit=15&select=id,numero_ot,placa,marca,linea,propietario,estado,creado_en,tipo_cliente`;
      const data = await api(url);
      if (_lastQuery !== q) return; // query superseded
      renderResults(Array.isArray(data) ? data : []);
    } catch (e) {
      elResults.innerHTML = `<div class="gs-empty"><div class="gs-empty-title">Error al buscar</div><div class="gs-empty-sub">${e.message || ''}</div></div>`;
    }
  }

  /* ── Abrir/cerrar overlay ───────────────────────────────────── */
  function abrir() {
    elOverlay.classList.add('gs-visible');
    elInput.value = '';
    _lastQuery = '';
    renderEmpty();
    setTimeout(() => elInput.focus(), 60);
  }

  function cerrar() {
    elOverlay.classList.remove('gs-visible');
    elInput.blur();
  }

  /* ── Abrir orden y cerrar ───────────────────────────────────── */
  window._gsAbrirOrden = function (id) {
    cerrar();
    if (typeof abrirOrden === 'function') {
      abrirOrden(id);
    }
  };

  /* ── Eventos del input ──────────────────────────────────────── */
  elInput.addEventListener('input', () => {
    const q = elInput.value.trim();
    clearTimeout(_debounceTimer);
    _debounceTimer = setTimeout(() => buscar(q), 300);
  });

  /* Navegación por teclado dentro de resultados */
  elInput.addEventListener('keydown', e => {
    if (e.key === 'Escape') { cerrar(); return; }
    const items = elResults.querySelectorAll('.gs-item');
    if (!items.length) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      _focusedIdx = Math.min(_focusedIdx + 1, items.length - 1);
      items[_focusedIdx].focus();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      _focusedIdx = Math.max(_focusedIdx - 1, 0);
      items[_focusedIdx].focus();
    }
  });

  /* Cerrar al hacer click en el backdrop (fuera del panel) */
  elOverlay.addEventListener('click', e => {
    if (e.target === elOverlay) cerrar();
  });

  /* Tecla ESC desde cualquier item */
  elResults.addEventListener('keydown', e => {
    if (e.key === 'Escape') { cerrar(); elInput.focus(); }
    const items = [...elResults.querySelectorAll('.gs-item')];
    const cur   = document.activeElement;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      const next = items.indexOf(cur) + 1;
      if (next < items.length) items[next].focus();
      else elInput.focus();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      const prev = items.indexOf(cur) - 1;
      if (prev >= 0) items[prev].focus();
      else elInput.focus();
    }
  });

  /* Shortcut global Ctrl+K */
  document.addEventListener('keydown', e => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
      e.preventDefault();
      if (elOverlay.classList.contains('gs-visible')) cerrar();
      else abrir();
    }
    if (e.key === 'Escape' && elOverlay.classList.contains('gs-visible')) {
      cerrar();
    }
  });

  /* ── API pública ─────────────────────────────────────────────── */
  window._abrirBuscadorGlobal = abrir;

  /* ── Inyectar botón en topbar cuando el DOM esté listo ─────── */
  function inyectarBotonTopbar() {
    const topbar = document.querySelector('.topbar');
    if (!topbar || document.getElementById('gs-topbar-btn')) return;
    const btn = document.createElement('button');
    btn.id = 'gs-topbar-btn';
    btn.className = 'gs-topbar-btn';
    btn.setAttribute('title', 'Buscar (Ctrl+K)');
    btn.onclick = abrir;
    btn.innerHTML = `
      <svg width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
        <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
      </svg>
      Buscar
      <span class="gs-topbar-kbd">Ctrl K</span>
    `;
    // Insertar entre el título y topbar-actions
    const actions = document.getElementById('topbar-actions');
    if (actions) {
      topbar.insertBefore(btn, actions);
    } else {
      topbar.appendChild(btn);
    }
  }

  // Intentar inmediatamente y también después de que JS de la app corra
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', inyectarBotonTopbar);
  } else {
    inyectarBotonTopbar();
  }
  // Respaldo por si el topbar se pinta tarde
  setTimeout(inyectarBotonTopbar, 800);
})();
