// ═══════════════════════════════════════════════════════════
// CARTERA UNIFICADA — Flotillas · Empresas · Clientes
// Panel con pestañas que delega en los módulos existentes.
// ═══════════════════════════════════════════════════════════

(function () {
  'use strict';

  const TABS = [
    { id: 'flotilla', label: '🚚 Flotillas',  panelId: 'pag-cartera-flotillas',  fn: () => { if (typeof resetVistaCartera === 'function') resetVistaCartera('flotilla'); if (typeof montarCarteraFlotillas === 'function') montarCarteraFlotillas(); } },
    { id: 'empresa',  label: '🏢 Empresas',   panelId: 'pag-cartera-empresas',   fn: () => { if (typeof resetVistaCartera === 'function') resetVistaCartera('empresa');  if (typeof montarCarteraEmpresas  === 'function') montarCarteraEmpresas();  } },
    { id: 'clientes', label: '👤 Clientes',   panelId: 'pag-cartera-clientes',   fn: () => _montarCarteraClientesPanel() },
  ];

  // ─── Inyectar estilos una sola vez ──────────────────────
  function _inyectarStyles() {
    if (document.getElementById('cartera-styles')) return;
    const s = document.createElement('style');
    s.id = 'cartera-styles';
    s.textContent = `
      #pag-cartera { display: flex; flex-direction: column; }
      .cartera-tabs { display: flex; gap: 8px; flex-wrap: wrap; padding: 16px 20px 12px; flex-shrink: 0; }
      .cartera-panel-host { overflow: visible; position: relative; }
      .cartera-panel { }
    `;
    document.head.appendChild(s);
  }

  // ─── Construir el esqueleto HTML ─────────────────────────
  function _buildShell(pag) {
    _inyectarStyles();
    const tabsHtml = TABS.map(t =>
      `<button class="filtro-btn" id="cartera-tab-${t.id}" onclick="_carteraTab('${t.id}')">${t.label}</button>`
    ).join('');

    const panelsHtml = TABS.map(t =>
      `<div id="${t.panelId}" class="cartera-panel" style="display:none"></div>`
    ).join('');

    pag.innerHTML = `
      <div class="cartera-tabs">${tabsHtml}</div>
      <div class="cartera-panel-host" id="cartera-panel-host">${panelsHtml}</div>`;
  }

  // ─── Cambiar pestaña activa ──────────────────────────────
  window._carteraTab = function (tabId) {
    const tab = TABS.find(t => t.id === tabId);
    if (!tab) return;

    TABS.forEach(t => {
      const btn = document.getElementById('cartera-tab-' + t.id);
      const pan = document.getElementById(t.panelId);
      const active = t.id === tabId;
      if (btn) btn.classList.toggle('active', active);
      if (pan) pan.style.display = active ? '' : 'none';
    });

    tab.fn();
  };

  // ─── Panel de clientes individuales (placeholder) ────────
  function _montarCarteraClientesPanel() {
    const el = document.getElementById('pag-cartera-clientes');
    if (!el) return;
    // Solo renderizar si está vacío
    if (el.dataset.cargado) return;
    el.dataset.cargado = '1';
    el.innerHTML = `
      <div style="padding:40px 20px;text-align:center;color:var(--gris-mid)">
        <div style="font-size:40px;margin-bottom:12px">👤</div>
        <p style="font-size:15px;font-weight:600;margin:0 0 6px">Cartera de Clientes</p>
        <p style="font-size:13px;margin:0">Próximamente: historial y saldo por cliente particular.</p>
      </div>`;
  }

  // ─── Punto de entrada llamado desde navJefe ──────────────
  window.montarCartera = function (tab) {
    const pag = document.getElementById('pag-cartera');
    if (!pag) return;

    // Reconstruir el shell solo si aún no existe (o fue vaciado)
    if (!document.getElementById('cartera-panel-host')) {
      _buildShell(pag);
    }

    _carteraTab(tab || 'flotilla');
  };
})();
