// ═══════════════════════════════════════════════════════════
// GESTIÓN OPERATIVA — KPIs del taller (jefe / gerente)
// ═══════════════════════════════════════════════════════════

// Store global de datos de drilldown (evita JSON en onclick)
window._kpiStore = {};

// ── Helpers ──────────────────────────────────────────────
function _kpiMs(isoStr) {
  if (!isoStr) return 0;
  return Date.now() - new Date(isoStr).getTime();
}
function _kpiDur(ms) {
  if (!ms || ms <= 0) return '—';
  const m = Math.floor(ms / 60000);
  if (m < 60) return m + 'm';
  const h = Math.floor(m / 60), rm = m % 60;
  if (h < 24) return h + 'h ' + rm + 'm';
  return Math.floor(h / 24) + 'd ' + (h % 24) + 'h';
}
function _kpiSemaforo(val, umbralRojo, umbralAmarillo) {
  if (val >= umbralRojo) return 'rojo';
  if (val >= umbralAmarillo) return 'amarillo';
  return 'verde';
}

// ── Animación "en vivo": los números cuentan hacia su valor y hacen flash
// cuando cambian. renderSinParpadeo reusa los nodos del DOM, así que guardamos
// el valor previo en el propio nodo (node._kpiPrev). ──
function _kpiCountUp(node, from, to) {
  const dur = 650, t0 = performance.now();
  const ease = x => 1 - Math.pow(1 - x, 3);
  (function step(t) {
    const p = Math.min(1, (t - t0) / dur);
    node.textContent = String(Math.round(from + (to - from) * ease(p)));
    if (p < 1) requestAnimationFrame(step);
  })(t0);
}
function _kpiFlash(node) {
  const card = node.closest('.kpi-card, .kpi-res-item, .kpi-valor-taller') || node;
  card.classList.remove('kpi-flash'); void card.offsetWidth; card.classList.add('kpi-flash');
}
function _kpiAnimarNumeros() {
  document.querySelectorAll('#taller-kpi-contenido .kpi-card-num, #taller-kpi-contenido .kpi-res-num, #taller-kpi-contenido .kpi-vt-num').forEach(node => {
    const txt = (node.textContent || '').trim();
    if (/^\d+$/.test(txt)) {
      const target = parseInt(txt, 10);
      const prev = (typeof node._kpiPrev === 'number') ? node._kpiPrev : 0;
      if (prev !== target) { _kpiCountUp(node, prev, target); if (node._kpiPrev !== undefined) _kpiFlash(node); }
      node._kpiPrev = target;
    } else {
      if (node._kpiPrev !== undefined && node._kpiPrev !== txt) _kpiFlash(node);
      node._kpiPrev = txt;
    }
  });
}

// ── Alertas de cambio en las categorías ──────────────────
// Describe en texto el cambio de una orden comparando su firma anterior/actual.
function _kpiDescribirCambio(prevStr, curStr, ets) {
  if (prevStr === undefined || prevStr === curStr) return 'Actualizada';
  const p = String(prevStr).split('|'), c = String(curStr).split('|');
  if (c[0] !== p[0]) return c[0] ? ('Pasó a pulmón ' + c[0]) : 'Salió de pulmón';
  if (c[1] !== p[1]) {
    if (c[1]) { const e = (ets || []).find(x => String(x.id) === c[1]); const n = e ? (e.etapa || e.servicio || 'etapa') : 'etapa'; const t = e && e.tecnico ? (' · ' + e.tecnico) : ''; return 'Inició ' + n + t; }
    return 'Terminó la etapa en curso';
  }
  if (c[2] !== p[2]) return c[2] === 'P' ? 'Etapa pausada' : 'Etapa reanudada';
  if ((+c[3] || 0) > (+p[3] || 0)) return 'Finalizó una etapa';
  return 'Actualizada';
}
// Tarjeta rápida: muestra QUÉ cambió en la orden + botón para abrirla.
function _kpiVerCambio(id) {
  const c = (window._kpiCambios || {})[id] || {};
  document.getElementById('_kpiCambioOv')?.remove();
  const ov = document.createElement('div');
  ov.id = '_kpiCambioOv'; ov.className = 'kpi-cambio-ov';
  ov.addEventListener('click', e => { if (e.target === ov) ov.remove(); });
  ov.innerHTML = `<div class="kpi-cambio-card">
    <div style="background:#1E3A5F;color:#fff;padding:12px 16px;display:flex;align-items:center;justify-content:space-between">
      <div style="font-size:13px;font-weight:800">🔔 Cambio en la orden</div>
      <button onclick="document.getElementById('_kpiCambioOv').remove()" style="background:none;border:none;color:#fff;font-size:18px;cursor:pointer;line-height:1">×</button>
    </div>
    <div style="padding:16px">
      <div style="font-family:'DM Mono',monospace;font-weight:800;font-size:18px;color:var(--texto)">${escapeHtml(c.placa || '')}</div>
      <div style="margin-top:6px;font-size:14px;color:var(--gris-texto)">${escapeHtml(c.desc || 'Actualizada')}</div>
      <button onclick="document.getElementById('_kpiCambioOv').remove();_kpiAbrirConCambio(${id})" class="btn btn-primary btn-sm" style="margin-top:14px;width:100%">Abrir orden →</button>
    </div>
  </div>`;
  document.body.appendChild(ov);
}
// Abre la orden dejando una pista para que el detalle destelle el apartado
// (la etapa) que cambió.
function _kpiAbrirConCambio(id) {
  const c = (window._kpiCambios || {})[id] || {};
  window._kpiFlashEtapa = { ordenId: id, etapaId: c.etapaId || null };
  if (typeof _kpiAbrirOrden === 'function') _kpiAbrirOrden(id);
}
// Tras cada refresco: a las secciones COLAPSADAS con un cambio les pone una
// alerta pulsante por 10 s; a las ABIERTAS les re-dispara el destello.
function _kpiAplicarAlertasSecciones() {
  const cambios = window._kpiSecCambios || {};
  window._kpiAlertTimers = window._kpiAlertTimers || {};
  const storeKeyDe = { vencidas:'k5', pulmonInt:'pulmonInt', pulmonExt:'pulmonExt', enProceso:'enProceso', sinTecnico:'k1', sinIniciar:'k2', sinMov:'k8', repuestos:'k4' };
  // Prioridad: lo crítico primero — es lo que se auto-abre si hay varios cambios.
  const prioridad = ['vencidas','sinMov','repuestos','sinTecnico','sinIniciar','pulmonInt','pulmonExt','enProceso'];
  let abrir = null;
  prioridad.forEach(key => {
    if (!(cambios[key] || []).length) return;
    const el = document.getElementById('kpi-sec-' + key);
    if (el) {
      el.classList.add('kpi-chip-alert');
      if (window._kpiAlertTimers[key]) clearTimeout(window._kpiAlertTimers[key]);
      window._kpiAlertTimers[key] = setTimeout(() => {
        document.getElementById('kpi-sec-' + key)?.classList.remove('kpi-chip-alert');
      }, 10000);
    }
    if (!abrir) abrir = storeKeyDe[key];
  });
  // Auto-abrir el popup de la categoría más crítica que cambió, 10 s. Si ya
  // había uno abierto por novedad, lo reemplaza (no se encima). Pero si el
  // usuario abrió uno a mano (o lo fijó pasando el mouse), no se lo quita.
  if (abrir && typeof kpiDrilldown === 'function') {
    const abiertoAMano = document.getElementById('_kpiModal') && !window._kpiAutoClose;
    if (!abiertoAMano) kpiDrilldown(abrir, { autoCierre: 10000 });
  }
  // Ticker de cambios: se despliega en el espacio bajo los chips mostrando qué cambió.
  const _tickerEl = document.getElementById('kpi-cambio-ticker');
  if (_tickerEl) {
    const _kCambios = window._kpiCambios || {};
    const _catLabel = { vencidas:'Vencida', sinMov:'Sin movimiento', repuestos:'Rep. atascado', sinTecnico:'Sin técnico', sinIniciar:'Sin iniciar', pulmonInt:'Pulmón int.', pulmonExt:'Pulmón ext.', enProceso:'En proceso' };
    const _catColor = { vencidas:'#DC2626', sinMov:'#9333EA', repuestos:'#0891B2', sinTecnico:'#B45309', sinIniciar:'#92400E', pulmonInt:'#D97706', pulmonExt:'#2563EB', enProceso:'#059669' };
    const _items = [];
    ['vencidas','sinMov','repuestos','sinTecnico','sinIniciar','pulmonInt','pulmonExt','enProceso'].forEach(key => {
      (cambios[key] || []).forEach(id => {
        const c = _kCambios[id] || {};
        _items.push({ placa: c.placa || 'OT-'+id, desc: c.desc || 'Actualizada', cat: _catLabel[key] || key, color: _catColor[key] || '#666', ordenId: id });
      });
    });
    if (_items.length) {
      const _ts = new Date().toLocaleTimeString('es-CO', { hour:'2-digit', minute:'2-digit', second:'2-digit' });
      const _iHtml = _items.slice(0, 3).map(it =>
        `<div class="kpi-ticker-item" onclick="document.getElementById('kpi-cambio-ticker')?.classList.remove('show');document.getElementById('kpi-cambio-ticker')?.classList.add('hide');_kpiAbrirOrden(${it.ordenId})"><span style="font-family:'DM Mono',monospace;font-weight:800;color:${it.color}">${it.placa}</span><span style="font-size:10px;color:${it.color};background:${it.color}22;border-radius:99px;padding:1px 7px;font-weight:700;white-space:nowrap">${it.cat}</span><span style="color:var(--gris-texto);flex:1;min-width:0">${it.desc}</span><span style="font-size:10px;color:var(--gris-mid);flex-shrink:0">→</span></div>`
      ).join('') + (_items.length > 3 ? `<div style="font-size:10px;color:var(--gris-mid);padding-top:4px">y ${_items.length - 3} más…</div>` : '');
      _tickerEl.innerHTML = `<div class="kpi-ticker-inner"><div class="kpi-ticker-items">${_iHtml}</div><div class="kpi-ticker-meta"><span class="kpi-ticker-ts">${_ts}</span><button class="kpi-ticker-close" onclick="const el=document.getElementById('kpi-cambio-ticker');if(el){el.classList.remove('show');el.classList.add('hide')}" title="Cerrar">×</button></div></div>`;
      _tickerEl.classList.remove('hide');
      void _tickerEl.offsetWidth;
      _tickerEl.classList.add('show');
      if (window._kpiTickerTimer) clearTimeout(window._kpiTickerTimer);
      window._kpiTickerTimer = setTimeout(() => {
        const el = document.getElementById('kpi-cambio-ticker');
        if (el && el.classList.contains('show')) { el.classList.remove('show'); el.classList.add('hide'); }
      }, 8000);
    }
  }
}

// ── Modal de drilldown ───────────────────────────────────
// Mini-estadística del "pulso del día"
function _pulsoStat(label, val, color) {
  return `<div style="text-align:center;min-width:78px">
    <div style="font-size:20px;font-weight:800;color:${color};line-height:1">${val}</div>
    <div style="font-size:9px;color:var(--gris-mid);text-transform:uppercase;letter-spacing:.4px;margin-top:4px">${label}</div>
  </div>`;
}

// Gráfico de barras horizontales: items = [{label, valor, color?}]
function _kpiBarras(items, colorDefault) {
  if (!items || !items.length) return '<div style="font-size:12px;color:var(--gris-mid)">Sin datos</div>';
  const max = Math.max(1, ...items.map(i => i.valor || 0));
  return items.map(i => {
    const pct = Math.round((i.valor || 0) / max * 100);
    return `<div style="display:flex;align-items:center;gap:8px;margin-bottom:7px">
      <div style="font-size:11px;color:var(--gris-texto);width:94px;flex-shrink:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escapeHtml(i.label)}</div>
      <div style="flex:1;height:14px;background:var(--gris-bg);border-radius:99px;overflow:hidden"><div style="height:100%;width:${pct}%;background:${i.color || colorDefault || '#2A5298'};border-radius:99px;min-width:${i.valor ? 4 : 0}px;transition:width .4s var(--ease-out)"></div></div>
      <div style="font-size:12px;font-weight:700;color:var(--texto);width:22px;text-align:right;flex-shrink:0">${i.valor || 0}</div>
    </div>`;
  }).join('');
}

function kpiDrilldown(key, opts) {
  opts = opts || {};
  const { titulo, filas } = window._kpiStore[key] || { titulo: '—', filas: [] };
  const ex = document.getElementById('_kpiModal');
  if (ex) ex.remove();
  if (window._kpiAutoClose) { clearTimeout(window._kpiAutoClose); window._kpiAutoClose = null; }

  const filasHtml = filas.length
    ? filas.map((f, i) => `
        <div class="kpi-drill-fila" onclick="_kpiAbrirOrden(${f.ordenId || 0})">
          <div class="kpi-drill-main">
            <div class="kpi-drill-placa">${escapeHtml(f.placa || '—')}</div>
            <div class="kpi-drill-ot">${escapeHtml(f.ot || '')}</div>
          </div>
          <div class="kpi-drill-info">
            <div class="kpi-drill-titulo">${escapeHtml(f.titulo || '')}</div>
            <div class="kpi-drill-sub">${escapeHtml(f.sub || '')}</div>
          </div>
          <div class="kpi-drill-badge kpi-${f.color || 'verde'}">${escapeHtml(f.badge || '')}</div>
          ${f.ordenId ? '<span class="kpi-drill-arrow">→</span>' : ''}
        </div>`).join('')
    : '<div style="text-align:center;padding:24px;color:var(--gris-mid)">Sin alertas activas ✓</div>';

  const ov = document.createElement('div');
  ov.id = '_kpiModal';
  ov.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:9999;display:flex;align-items:center;justify-content:center;padding:16px';
  ov.addEventListener('click', e => { if (e.target === ov) ov.remove(); });
  ov.innerHTML = `
    <div style="background:var(--surface);border-radius:14px;width:100%;max-width:580px;max-height:85vh;display:flex;flex-direction:column;box-shadow:0 20px 60px rgba(0,0,0,.25)">
      <div style="display:flex;align-items:center;justify-content:space-between;padding:18px 20px;border-bottom:1.5px solid var(--gris-borde);flex-shrink:0">
        <div style="font-size:15px;font-weight:700;color:var(--texto)">${escapeHtml(titulo)}</div>
        <button onclick="document.getElementById('_kpiModal').remove()" style="background:none;border:none;cursor:pointer;font-size:20px;color:var(--gris-mid);line-height:1">✕</button>
      </div>
      <div style="overflow-y:auto;padding:12px 16px;flex:1">${filasHtml}</div>
    </div>`;
  document.body.appendChild(ov);
  // Apertura automática por novedad: se cierra sola tras N ms, salvo que el
  // usuario pase el mouse por encima (entonces se queda mientras lo lee).
  if (opts.autoCierre) {
    window._kpiAutoClose = setTimeout(() => { document.getElementById('_kpiModal')?.remove(); window._kpiAutoClose = null; }, opts.autoCierre);
    ov.addEventListener('mouseenter', () => { if (window._kpiAutoClose) { clearTimeout(window._kpiAutoClose); window._kpiAutoClose = null; } });
  }
}

function _kpiAbrirOrden(ordenId) {
  if (!ordenId) return;
  document.getElementById('_kpiModal')?.remove();
  // abrirOrden ya navega al detalle (pag-detalle). El navJefe('ordenes')
  // previo dejaba al usuario en la lista en vez de abrir la orden.
  if (typeof abrirOrden === 'function') abrirOrden(ordenId);
}

// ── Vista previa al pasar el mouse por los chips ─────────────────────────────
// Muestra las órdenes de esa categoría en el espacio bajo los chips, sin
// abrir el popup. Desaparece cuando el mouse sale del chip Y del panel.
function kpiHoverPreview(storeKey, color, titulo) {
  clearTimeout(window._kpiHoverTimer);
  const panel = document.getElementById('kpi-hover-panel');
  if (!panel) return;
  const { filas } = window._kpiStore?.[storeKey] || { filas: [] };

  const MAX = 6;
  const filasHtml = filas.length
    ? filas.slice(0, MAX).map(f => {
        const badge = f.badge
          ? `<span style="font-size:10px;font-weight:700;color:${color};background:${color}1A;border-radius:99px;padding:1px 8px;white-space:nowrap;flex-shrink:0">${escapeHtml(f.badge)}</span>`
          : '';
        const ot = f.ot
          ? `<span style="font-size:10px;color:var(--gris-mid);flex-shrink:0;font-family:'DM Mono',monospace">${escapeHtml(f.ot)}</span>`
          : '';
        return `<div class="kpi-ord-chip" onclick="kpiHoverPreviewOut(true);_kpiAbrirOrden(${f.ordenId || 0})">
          <span class="kc-pl">${escapeHtml(f.placa || '—')}</span>
          <span class="kc-nf">${escapeHtml(f.titulo || f.sub || '')}</span>
          ${badge}${ot}
        </div>`;
      }).join('') +
      (filas.length > MAX
        ? `<div class="kpi-hp-mas">y ${filas.length - MAX} más · clic en la categoría para ver todas →</div>`
        : '')
    : `<div class="kpi-hp-vacio">Sin órdenes activas en esta categoría ✓</div>`;

  panel.innerHTML = `
    <div class="kpi-hover-inner"
      onmouseenter="clearTimeout(window._kpiHoverTimer)"
      onmouseleave="kpiHoverPreviewOut()">
      <div class="kpi-hp-titulo" style="color:${color};border-bottom:1px solid ${color}28">
        <span>${titulo}</span>
        <span style="font-weight:400;color:var(--gris-mid)">${filas.length} orden${filas.length !== 1 ? 'es' : ''}</span>
      </div>
      <div class="kpi-hp-filas">${filasHtml}</div>
    </div>`;
  panel.classList.add('show');
}

function kpiHoverPreviewOut(inmediato) {
  if (inmediato) {
    clearTimeout(window._kpiHoverTimer);
    const panel = document.getElementById('kpi-hover-panel');
    if (panel) panel.classList.remove('show');
    return;
  }
  window._kpiHoverTimer = setTimeout(() => {
    const panel = document.getElementById('kpi-hover-panel');
    if (panel) panel.classList.remove('show');
  }, 150);
}

// ── Notificación central de novedades ────────────────────
let _kpiUltimoEventoId = null;
let _kpiNovedadTimer = null;

function _kpiMostrarToast(ev) {
  // Si ya hay una visible, encolarla
  if (document.getElementById('kpi-novedad-overlay')) {
    setTimeout(() => _kpiMostrarToast(ev), 8500);
    return;
  }

  if (!document.getElementById('kpi-novedad-style')) {
    const s = document.createElement('style');
    s.id = 'kpi-novedad-style';
    s.textContent = `
      #kpi-novedad-overlay {
        position:fixed;inset:0;z-index:9999;
        background:rgba(2,6,23,.72);
        display:flex;align-items:center;justify-content:center;
        animation:kpiOvIn .35s ease both;
      }
      @keyframes kpiOvIn { from{opacity:0} to{opacity:1} }
      #kpi-novedad-card {
        background:#0f1e36;
        border:1px solid rgba(56,189,248,.22);
        border-radius:24px;
        padding:30px 36px 26px;
        width:min(460px,90vw);
        box-shadow:0 0 0 1px rgba(56,189,248,.08), 0 32px 80px rgba(0,0,0,.8);
        animation:kpiCardIn .5s cubic-bezier(.22,1,.36,1) both;
        position:relative;overflow:hidden;
      }
      #kpi-novedad-card::before {
        content:'';position:absolute;inset:0;pointer-events:none;
        background:radial-gradient(ellipse at 50% 0%,rgba(56,189,248,.16) 0%,transparent 65%);
        animation:kpiDestello .7s ease both;
      }
      @keyframes kpiDestello{from{opacity:0}50%{opacity:1}to{opacity:.35}}
      @keyframes kpiCardIn{from{opacity:0;transform:scale(.82) translateY(28px)}to{opacity:1;transform:scale(1) translateY(0)}}
      .kpi-nov-pulso {
        width:9px;height:9px;border-radius:50%;background:#38bdf8;flex-shrink:0;
        box-shadow:0 0 0 0 rgba(56,189,248,.6);
        animation:kpiPulso 1.4s ease-out infinite;
      }
      @keyframes kpiPulso{0%{box-shadow:0 0 0 0 rgba(56,189,248,.7)}70%{box-shadow:0 0 0 10px rgba(56,189,248,0)}100%{box-shadow:0 0 0 0 rgba(56,189,248,0)}}
      .kpi-nov-placa {
        font-size:52px;font-weight:900;letter-spacing:.08em;font-family:monospace;
        background:linear-gradient(135deg,#f1f5f9,#7dd3fc);
        -webkit-background-clip:text;-webkit-text-fill-color:transparent;
        animation:kpiPlacaIn .55s cubic-bezier(.22,1,.36,1) .15s both;
      }
      @keyframes kpiPlacaIn{from{opacity:0;transform:scale(1.12)}60%{transform:scale(.97)}to{opacity:1;transform:scale(1)}}
      .kpi-nov-cambio {
        display:flex;align-items:center;gap:10px;
        background:rgba(255,255,255,.04);border-radius:14px;
        padding:14px 18px;margin-bottom:16px;
        animation:kpiSlideUp .5s cubic-bezier(.22,1,.36,1) .18s both;
      }
      .kpi-nov-estado { flex:1;text-align:center;padding:8px 10px;border-radius:10px; }
      .kpi-nov-estado.antes { background:rgba(248,113,113,.1);border:1px solid rgba(248,113,113,.2); }
      .kpi-nov-estado.despues { background:rgba(52,211,153,.1);border:1px solid rgba(52,211,153,.2); }
      @keyframes kpiSlideUp{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:none}}
      .kpi-nov-bar { height:3px;background:linear-gradient(90deg,#38bdf8,#7dd3fc);border-radius:999px;animation:kpiProg 7s linear forwards; }
      @keyframes kpiProg{from{width:100%}to{width:0%}}
    `;
    document.head.appendChild(s);
  }

  const desc = escapeHtml(ev.descripcion || '');
  // Intentar detectar "antes → después" en la descripción (formato: "X → Y")
  const flechaMatch = (ev.descripcion || '').match(/^(.+?)\s*[→\->]+\s*(.+)$/);
  const cambioHtml = flechaMatch
    ? `<div class="kpi-nov-cambio">
        <div class="kpi-nov-estado antes"><div style="font-size:9px;text-transform:uppercase;letter-spacing:.08em;color:#f87171;margin-bottom:3px">Antes</div><div style="font-size:13px;font-weight:700;color:#f87171">${escapeHtml(flechaMatch[1].trim())}</div></div>
        <div style="font-size:20px;color:#334155;flex-shrink:0">→</div>
        <div class="kpi-nov-estado despues"><div style="font-size:9px;text-transform:uppercase;letter-spacing:.08em;color:#34d399;margin-bottom:3px">Ahora</div><div style="font-size:13px;font-weight:700;color:#34d399">${escapeHtml(flechaMatch[2].trim())}</div></div>
      </div>`
    : `<div style="font-size:14px;color:#94a3b8;line-height:1.55;margin-bottom:16px;text-align:center;animation:kpiSlideUp .5s cubic-bezier(.22,1,.36,1) .18s both">${desc}</div>`;

  const placaHtml = ev.placa
    ? `<div class="kpi-nov-placa">${escapeHtml(ev.placa)}</div>`
    : '';
  const ordenHtml = ev.orden_id
    ? `<div style="display:inline-block;margin-top:4px;padding:3px 12px;border-radius:999px;background:rgba(56,189,248,.1);border:1px solid rgba(56,189,248,.22);font-size:12px;color:#7dd3fc">Orden #${ev.orden_id}</div>`
    : '';

  const overlay = document.createElement('div');
  overlay.id = 'kpi-novedad-overlay';
  overlay.innerHTML = `
    <div id="kpi-novedad-card">
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:20px">
        <div class="kpi-nov-pulso"></div>
        <span style="font-size:11px;font-weight:600;letter-spacing:.12em;text-transform:uppercase;color:#38bdf8">Novedad en taller</span>
        <button id="kpi-nov-x" style="margin-left:auto;background:none;border:none;color:#334155;font-size:20px;cursor:pointer;line-height:1;padding:0">✕</button>
      </div>
      <div style="text-align:center;margin-bottom:20px">
        ${placaHtml}
        ${ordenHtml}
      </div>
      ${cambioHtml}
      <div style="display:flex;align-items:center;justify-content:center;gap:10px;font-size:12px;color:#64748b;animation:kpiSlideUp .5s cubic-bezier(.22,1,.36,1) .28s both">
        <span style="font-size:16px">${escapeHtml(ev.icono || '📋')}</span>
        ${ev.autor && ev.autor !== '—' ? `<span>${escapeHtml(ev.autor)}</span>` : ''}
        <span>· ahora</span>
      </div>
      <div style="margin-top:18px;height:3px;background:rgba(255,255,255,.07);border-radius:999px;overflow:hidden">
        <div class="kpi-nov-bar" id="kpi-nov-bar"></div>
      </div>
    </div>
  `;

  const cerrar = () => {
    clearTimeout(_kpiNovedadTimer);
    overlay.style.transition = 'opacity .35s';
    overlay.style.opacity = '0';
    setTimeout(() => overlay.remove(), 360);
  };

  overlay.querySelector('#kpi-nov-x').addEventListener('click', cerrar);
  overlay.addEventListener('click', e => { if (e.target === overlay) cerrar(); });
  if (ev.orden_id) {
    overlay.querySelector('#kpi-novedad-card').style.cursor = 'pointer';
    overlay.querySelector('#kpi-novedad-card').addEventListener('click', e => {
      if (e.target.id === 'kpi-nov-x') return;
      cerrar();
      setTimeout(() => _kpiAbrirOrden(ev.orden_id), 200);
    });
  }

  document.body.appendChild(overlay);
  _kpiNovedadTimer = setTimeout(cerrar, 7000);
}

// ── Centro de Actividad ──────────────────────────────────
function _haceCuanto(isoStr) {
  if (!isoStr) return '';
  const s = Math.floor((Date.now() - new Date(isoStr).getTime()) / 1000);
  if (s < 60) return 'ahora';
  if (s < 3600) return Math.floor(s / 60) + 'm';
  if (s < 86400) return Math.floor(s / 3600) + 'h';
  return Math.floor(s / 86400) + 'd';
}

// fecha seleccionada en el historial (YYYY-MM-DD), null = hoy
let _kpiFeedFecha = null;

function _kpiFeedFechaHoy() {
  return new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD
}

function _kpiFeedEsHoy() {
  return !_kpiFeedFecha || _kpiFeedFecha === _kpiFeedFechaHoy();
}

function _kpiFeedCambiarFecha(delta) {
  const base = _kpiFeedFecha || _kpiFeedFechaHoy();
  const d = new Date(base + 'T12:00:00');
  d.setDate(d.getDate() + delta);
  const nueva = d.toLocaleDateString('en-CA');
  _kpiFeedFecha = nueva === _kpiFeedFechaHoy() ? null : nueva;
  _kpiFeed();
}

function _kpiFeedFechaLabel() {
  if (_kpiFeedEsHoy()) return 'Hoy';
  const d = new Date((_kpiFeedFecha) + 'T12:00:00');
  return d.toLocaleDateString('es-CO', { weekday: 'short', day: 'numeric', month: 'short' });
}

async function _kpiFeed() {
  const el = document.getElementById('kpi-feed');
  const ua = document.getElementById('kpi-ult-act');
  if (!el && !ua) return;
  try {
    // Construir filtro de fecha
    const fechaBase = _kpiFeedFecha || _kpiFeedFechaHoy();
    const dInicio = fechaBase + 'T00:00:00';
    const dFin    = fechaBase + 'T23:59:59';
    const filtroFecha = `creado_en=gte.${dInicio}&creado_en=lte.${dFin}`;

    // Para detectar novedades siempre consultamos hoy sin límite de fecha
    const evsHoy = _kpiFeedEsHoy()
      ? null  // se reutiliza la misma consulta abajo
      : await api(`/eventos_taller?order=creado_en.desc&limit=10&creado_en=gte.${_kpiFeedFechaHoy()}T00:00:00`).catch(() => null);

    const evs = await api(`/eventos_taller?order=creado_en.desc&limit=100&${filtroFecha}`).catch(() => null);
    if (evs === null) return;

    const evsFiltrados = evs; // ya vienen del día seleccionado

    // Detectar novedades solo cuando estamos viendo hoy
    const evsFuenteHoy = _kpiFeedEsHoy() ? evs : (evsHoy || []);
    if (_kpiUltimoEventoId !== null && evsFuenteHoy.length > 0) {
      const nuevos = [];
      for (const ev of evsFuenteHoy) {
        if (ev.id === _kpiUltimoEventoId) break;
        nuevos.push(ev);
      }
      nuevos.reverse().forEach(ev => _kpiMostrarToast(ev));
    }
    if (evsFuenteHoy.length > 0) _kpiUltimoEventoId = evsFuenteHoy[0].id;

    const hora = new Date().toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

    // ── Panel lateral "Últimas 5 actividades" (siempre muestra hoy) ──
    if (ua) {
      const horaUa = ua.querySelector('.kpi-ua-hora');
      if (horaUa) horaUa.textContent = hora;
      const listaUa = ua.querySelector('.kpi-ua-list');
      if (listaUa) {
        const evsPanelHoy = _kpiFeedEsHoy() ? evsFiltrados : (evsHoy || []);
        if (!evsPanelHoy.length) {
          listaUa.innerHTML = '<div class="kpi-ua-vacio">Sin actividad hoy</div>';
        } else {
          listaUa.innerHTML = evsPanelHoy.slice(0, 5).map(e => {
            const c = escapeHtml(e.color || '#64748B');
            const attrs = e.orden_id
              ? `class="kpi-ua-item clic" onclick="_kpiAbrirOrden(${e.orden_id})"`
              : 'class="kpi-ua-item"';
            return `<div ${attrs}>
              <span class="kpi-ua-ico">${escapeHtml(e.icono || '📋')}</span>
              <span class="kpi-ua-cuerpo">
                <div class="kpi-ua-desc">${escapeHtml(e.descripcion || '')}</div>
                <div class="kpi-ua-sub">
                  <span style="color:${c};font-weight:700">${_haceCuanto(e.creado_en)}</span>
                  ${e.autor && e.autor !== '—' ? `<span>· ${escapeHtml(e.autor)}</span>` : ''}
                </div>
              </span>
            </div>`;
          }).join('');
        }
      }
    }

    // ── Feed completo "Centro de actividad" ──
    if (!el) return;

    // Navegador de fecha integrado en el header del feed
    const horaEl = el.querySelector('.kpi-feed-hora');
    if (horaEl) {
      horaEl.innerHTML = `
        <span style="display:flex;align-items:center;gap:4px">
          <button onclick="_kpiFeedCambiarFecha(-1)" style="background:none;border:none;color:var(--gris-mid);cursor:pointer;font-size:15px;line-height:1;padding:0 3px" title="Día anterior">‹</button>
          <span style="font-size:10px;font-weight:700;color:${_kpiFeedEsHoy() ? 'var(--azul)' : 'var(--gris-mid)'};min-width:36px;text-align:center">${_kpiFeedFechaLabel()}</span>
          <button onclick="_kpiFeedCambiarFecha(+1)" ${_kpiFeedEsHoy() ? 'disabled' : ''} style="background:none;border:none;color:var(--gris-mid);cursor:pointer;font-size:15px;line-height:1;padding:0 3px;${_kpiFeedEsHoy() ? 'opacity:.3;cursor:default' : ''}" title="Día siguiente">›</button>
        </span>
      `;
    }

    const lista = el.querySelector('.kpi-feed-list');
    if (!lista) return;
    if (!evsFiltrados.length) {
      lista.innerHTML = `<div class="kpi-feed-vacio">Sin actividad ${_kpiFeedEsHoy() ? 'hoy' : 'este día'} — las acciones del taller aparecen aquí en tiempo real</div>`;
      return;
    }
    lista.innerHTML = evsFiltrados.map(e => {
      const c = escapeHtml(e.color || '#64748B');
      const clic = e.orden_id ? `class="kpi-ev clic" onclick="_kpiAbrirOrden(${e.orden_id})"` : 'class="kpi-ev"';
      const horaEv = e.creado_en
        ? new Date(e.creado_en).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })
        : '';
      return `<div ${clic}>
        <span class="kpi-ev-ico">${escapeHtml(e.icono || '📋')}</span>
        <span class="kpi-ev-body">
          <div class="kpi-ev-desc">${escapeHtml(e.descripcion || '')}</div>
          <div class="kpi-ev-meta">
            <span class="kpi-ev-tag" style="background:${c}20;color:${c}">${escapeHtml(e.tipo || '')}</span>
            <span>${horaEv}</span>
            ${e.autor && e.autor !== '—' ? `<span>· ${escapeHtml(e.autor)}</span>` : ''}
          </div>
        </span>
        ${e.orden_id ? '<span class="kpi-ev-arr">→</span>' : ''}
      </div>`;
    }).join('');
  } catch (_) {}
}

function _kpiFeedIniciar() {
  _kpiFeed();
  if (!window._kpiFeedInterval) {
    window._kpiFeedInterval = setInterval(() => {
      if (!document.getElementById('kpi-feed')) {
        clearInterval(window._kpiFeedInterval);
        window._kpiFeedInterval = null;
        return;
      }
      _kpiFeed();
    }, 8000);
  }
}

// Botón "Actualizar": gira el ícono una vez (feedback) y recarga.
function _kpiActualizar(btn) {
  const ico = btn?.querySelector('.kpi-refresh-ico');
  if (ico) {
    ico.classList.remove('spin');
    void ico.offsetWidth;            // reinicia la animación si se da clic seguido
    ico.classList.add('spin');
    ico.addEventListener('animationend', () => ico.classList.remove('spin'), { once: true });
  }
  cargarKPITaller();
}

// Refrescar la Gestión Operativa apenas se vuelve a ver la pantalla. Los
// temporizadores (setInterval) se ralentizan o pausan en segundo plano —p. ej.
// un monitor/TV o una pestaña detrás—, así que esto la pone al día al instante
// cuando se mira de nuevo. Se registra una sola vez.
if (typeof document !== 'undefined' && !window._kpiVisHandler) {
  window._kpiVisHandler = true;
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden &&
        document.getElementById('pag-taller-kpi')?.classList.contains('activa') &&
        typeof cargarKPITaller === 'function') {
      cargarKPITaller();
    }
  });
}

// ── Función principal ────────────────────────────────────
async function cargarKPITaller() {
  const cont = document.getElementById('taller-kpi-contenido');
  if (!cont) return;

  const ahora = Date.now();
  const hoy = new Date(); hoy.setHours(0, 0, 0, 0);

  try {
    const _hace14d = new Date(ahora - 14 * 86400000).toISOString();
    const _inicioMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1).toISOString();
    const [ordenesActivas, todasEtapas, solicitudesRep, mecanicosData, entregadasRecientes, cotsPendientes, cotsMes, capActivas, capPulmonInt, entregadasMesVal, metasTallerArr] = await Promise.all([
      api('/ordenes?estado=eq.Activa&order=creado_en.asc').catch(() => []),
      api('/etapas?select=id,orden_id,etapa,servicio,mecanico_id,tecnico,creado_en,inicio,fin,pausado,tiempo_pausado_min,valor_venta&order=creado_en.asc').catch(() => []),
      api('/solicitudes_repuesto?estado=not.in.(entregado,rechazado)&order=creado_en.asc').catch(() => []),
      api('/mecanicos?activo=eq.true&order=nombre.asc').catch(() => []),
      api(`/ordenes?estado=eq.Entregada&entregada_en=gte.${_hace14d}&select=id,placa,ingreso_en,entregada_en,fecha_entrega_1,creado_en`).catch(() => []),
      api('/cotizaciones?estado=eq.pendiente&select=*').catch(() => []),
      api(`/cotizaciones?created_at=gte.${_inicioMes}&select=id,orden_id`).catch(() => []),
      // MISMAS consultas que el sidebar (_refrescarCapacidad) para que la
      // "Ocupación del taller" coincida exactamente con la capacidad del sidebar.
      api('/ordenes?estado=eq.Activa&pulmon=eq.false&select=id').catch(() => []),
      api('/ordenes?pulmon=eq.true&pulmon_tipo=eq.interno&select=id').catch(() => []),
      // Órdenes entregadas este mes + meta del mes (tabla ventas_mensuales, misma que usa el módulo Metas).
      api(`/ordenes?estado=eq.Entregada&entregada_en=gte.${_inicioMes}&select=id,precio_venta_cliente,insumos,repuestos_simple,entregada_en&limit=500`).catch(() => []),
      api(`/ventas_mensuales?ano=eq.${hoy.getFullYear()}&mes_num=eq.${hoy.getMonth()+1}&select=meta_base,ventas&limit=1`).catch(() => [])
    ]);

    // Solo etapas que pertenecen a órdenes activas (excluye Entregadas/Archivadas)
    const _actIdsSet = new Set(ordenesActivas.map(o => o.id));
    const etapasSoloActivas = todasEtapas.filter(e => _actIdsSet.has(e.orden_id));
    const etapasActivas = etapasSoloActivas.filter(e => e.inicio && !e.fin);
    const tecRoles = ['jefe_taller', 'gerente', 'prueba', 'repuestos', 'pantalla_taller', 'asesor_comercial'];

    // ── KPI 1: Órdenes sin técnico asignado ───────────────
    const k1Filas = ordenesActivas.filter(o => {
      const ets = todasEtapas.filter(e => e.orden_id === o.id);
      return ets.length === 0 || ets.every(e => !e.mecanico_id);
    }).map(o => ({
      placa: o.placa, ot: formatOT(o.id), ordenId: o.id,
      titulo: [o.marca, o.linea].filter(Boolean).join(' ') || 'Sin datos',
      sub: 'Sin asignar hace ' + _kpiDur(_kpiMs(o.creado_en)),
      badge: _kpiDur(_kpiMs(o.creado_en)),
      color: _kpiSemaforo(_kpiMs(o.creado_en), 4 * 3600000, 2 * 3600000)
    }));
    window._kpiStore.k1 = { titulo: 'Órdenes sin técnico asignado', filas: k1Filas };
    const k1Color = _kpiSemaforo(k1Filas.length, 3, 1);
    const k1Max = k1Filas.reduce((m, f) => _kpiMs(ordenesActivas.find(o => o.placa === f.placa)?.creado_en) > m ? _kpiMs(ordenesActivas.find(o => o.placa === f.placa)?.creado_en) : m, 0);

    // ── KPI 2: Etapas asignadas sin iniciar ───────────────
    const k2Filas = etapasSoloActivas.filter(e => e.mecanico_id && !e.inicio && !e.fin).map(e => {
      const o = ordenesActivas.find(or => or.id === e.orden_id) || {};
      const ms = _kpiMs(e.creado_en);
      return {
        placa: o.placa || '—', ot: formatOT(e.orden_id), ordenId: e.orden_id,
        titulo: (e.etapa || '—') + ' · ' + (e.tecnico || 'Sin técnico'),
        sub: 'Asignada hace ' + _kpiDur(ms),
        badge: _kpiDur(ms),
        color: _kpiSemaforo(ms, 3 * 3600000, 1 * 3600000)
      };
    });
    window._kpiStore.k2 = { titulo: 'Etapas asignadas sin iniciar', filas: k2Filas };
    const k2Color = _kpiSemaforo(k2Filas.length, 5, 2);
    const k2Max = k2Filas.length ? Math.max(...etapasSoloActivas.filter(e => e.mecanico_id && !e.inicio && !e.fin).map(e => _kpiMs(e.creado_en))) : 0;

    // ── KPI 3: Entretiempos entre etapas ──────────────────
    const k3Filas = [];
    ordenesActivas.forEach(o => {
      const ets = todasEtapas.filter(e => e.orden_id === o.id);
      const finalizadas = ets.filter(e => e.fin).sort((a, b) => new Date(a.fin) - new Date(b.fin));
      const pendientes = ets.filter(e => !e.inicio && !e.fin);
      if (finalizadas.length && pendientes.length) {
        const ultimaFin = new Date(finalizadas[finalizadas.length - 1].fin).getTime();
        const gapMs = ahora - ultimaFin;
        if (gapMs > 30 * 60000) {
          k3Filas.push({
            placa: o.placa, ot: formatOT(o.id), ordenId: o.id,
            titulo: 'Parado tras finalizar: ' + (finalizadas[finalizadas.length - 1].etapa || '—'),
            sub: 'Sin avance hace ' + _kpiDur(gapMs),
            badge: _kpiDur(gapMs),
            color: _kpiSemaforo(gapMs, 4 * 3600000, 2 * 3600000)
          });
        }
      }
    });
    window._kpiStore.k3 = { titulo: 'Entretiempos en operación', filas: k3Filas };
    const k3Color = _kpiSemaforo(k3Filas.length, 3, 1);
    const k3Max = k3Filas.length ? Math.max(...k3Filas.map(f => _kpiMs(ordenesActivas.find(o => o.placa === f.placa)?.creado_en))) : 0;

    // ── KPI 4: Solicitudes de repuesto atascadas ──────────
    const UMBRAL_REP = { pendiente_jefe: 2 * 3600000, enviado_repuestos: 24 * 3600000, cotizado: 48 * 3600000, pedido: 72 * 3600000, recibido_taller: 4 * 3600000 };
    const LABEL_REP = { pendiente_jefe: 'Pendiente jefe', enviado_repuestos: 'En gestión', cotizado: 'Cotizado', pedido: 'Pedido', recibido_taller: 'En taller' };
    const k4Filas = solicitudesRep.filter(s => {
      const umbral = UMBRAL_REP[s.estado] || 48 * 3600000;
      return _kpiMs(s.creado_en) > umbral;
    }).map(s => {
      const o = ordenesActivas.find(or => or.id === s.orden_id) || {};
      const ms = _kpiMs(s.creado_en);
      return {
        placa: o.placa || ('OT-' + s.orden_id), ot: formatOT(s.orden_id), ordenId: s.orden_id,
        titulo: s.repuesto || 'Repuesto sin nombre',
        sub: (LABEL_REP[s.estado] || s.estado) + ' · hace ' + _kpiDur(ms),
        badge: _kpiDur(ms),
        color: _kpiSemaforo(ms, 48 * 3600000, 24 * 3600000)
      };
    });
    window._kpiStore.k4 = { titulo: 'Solicitudes de repuesto atascadas', filas: k4Filas };
    const k4Color = _kpiSemaforo(k4Filas.length, 3, 1);
    const k4Max = k4Filas.length ? Math.max(...solicitudesRep.filter(s => _kpiMs(s.creado_en) > (UMBRAL_REP[s.estado] || 48 * 3600000)).map(s => _kpiMs(s.creado_en))) : 0;

    // ── KPI 5: Órdenes vencidas ───────────────────────────
    const k5Filas = ordenesActivas.filter(o => o.fecha_entrega_1 && new Date(o.fecha_entrega_1) < hoy).map(o => {
      const dias = Math.round((hoy.getTime() - new Date(o.fecha_entrega_1).getTime()) / 86400000);
      return {
        placa: o.placa, ot: formatOT(o.id), ordenId: o.id,
        titulo: [o.marca, o.linea].filter(Boolean).join(' ') || 'Sin datos',
        sub: dias + ' día' + (dias !== 1 ? 's' : '') + ' de retraso',
        badge: dias + 'd retraso',
        color: 'rojo'
      };
    });
    window._kpiStore.k5 = { titulo: 'Órdenes vencidas', filas: k5Filas };
    const k5Color = k5Filas.length > 0 ? 'rojo' : 'verde';

    // ── KPI 6: Prom. asignación → arranque ────────────────
    const tiemposArr = etapasSoloActivas
      .filter(e => e.mecanico_id && e.inicio && e.creado_en)
      .map(e => new Date(e.inicio).getTime() - new Date(e.creado_en).getTime())
      .filter(t => t > 0 && t < 7 * 24 * 3600000);
    const k6Prom = tiemposArr.length ? Math.round(tiemposArr.reduce((a, b) => a + b, 0) / tiemposArr.length) : 0;
    const k6Filas = etapasSoloActivas.filter(e => e.mecanico_id && e.inicio && e.creado_en && (new Date(e.inicio) - new Date(e.creado_en)) > 0)
      .slice(-20).map(e => {
        const o = ordenesActivas.find(or => or.id === e.orden_id) || {};
        const ms = new Date(e.inicio) - new Date(e.creado_en);
        return {
          placa: o.placa || '—', ot: formatOT(e.orden_id), ordenId: e.orden_id,
          titulo: (e.etapa || '—') + ' · ' + (e.tecnico || '—'),
          sub: 'Tardó ' + _kpiDur(ms) + ' en arrancar',
          badge: _kpiDur(ms),
          color: _kpiSemaforo(ms, 4 * 3600000, 2 * 3600000)
        };
      });
    window._kpiStore.k6 = { titulo: 'Tiempo asignación → arranque (últimas etapas)', filas: k6Filas };
    const k6Color = _kpiSemaforo(k6Prom, 4 * 3600000, 2 * 3600000);

    // ── KPI 7: Técnicos libres ────────────────────────────
    const tecActivos = mecanicosData.filter(m => !tecRoles.includes(m.rol));
    const k7Filas = tecActivos.filter(m => !etapasActivas.some(e => e.mecanico_id === m.id)).map(m => ({
      placa: m.nombre.charAt(0).toUpperCase(), ot: '', ordenId: 0,
      titulo: m.nombre,
      sub: (m.rol || 'Técnico') + ' · Sin etapa activa',
      badge: 'Libre',
      color: 'amarillo'
    }));
    window._kpiStore.k7 = { titulo: 'Técnicos sin actividad activa', filas: k7Filas };
    const k7Color = k7Filas.length >= tecActivos.length ? 'amarillo' : 'verde';

    // ── KPI 8: Órdenes sin movimiento > 4h ───────────────
    const k8Filas = ordenesActivas.filter(o => {
      const antig = _kpiMs(o.ingreso_en || o.creado_en);
      if (antig < 4 * 3600000) return false;
      const ets = todasEtapas.filter(e => e.orden_id === o.id);
      if (!ets.length) return true;
      const ultimaAct = Math.max(...ets.map(e => new Date(e.inicio || e.creado_en).getTime()));
      return (ahora - ultimaAct) > 4 * 3600000;
    }).map(o => ({
      placa: o.placa, ot: formatOT(o.id), ordenId: o.id,
      titulo: [o.marca, o.linea].filter(Boolean).join(' ') || 'Sin datos',
      sub: 'Sin actividad hace ' + _kpiDur(_kpiMs(o.ingreso_en || o.creado_en)),
      badge: _kpiDur(_kpiMs(o.ingreso_en || o.creado_en)),
      color: _kpiSemaforo(_kpiMs(o.ingreso_en || o.creado_en), 8 * 3600000, 4 * 3600000)
    }));
    window._kpiStore.k8 = { titulo: 'Órdenes sin movimiento +4h', filas: k8Filas };
    const k8Color = _kpiSemaforo(k8Filas.length, 3, 1);

    // ── Render ────────────────────────────────────────────
    const hora = new Date().toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });

    // ════════ DATOS DE CONTROL DE LA OPERACIÓN ════════
    const CAP = (typeof CAPACIDAD_TALLER !== 'undefined' ? CAPACIDAD_TALLER : 36);
    const _localDay = iso => { if (!iso) return null; const x = new Date(iso); return `${x.getFullYear()}-${String(x.getMonth()+1).padStart(2,'0')}-${String(x.getDate()).padStart(2,'0')}`; };
    const _hoyKey = _localDay(new Date());

    // Pulso del día — MISMOS números que la capacidad del sidebar:
    // activas (estado=Activa & pulmon=false) y pulmón interno.
    const enTaller = capActivas.length;
    const enPulmon = capPulmonInt.length;
    // Cupos ocupados = activas + pulmón interno (igual que el sidebar "X de 36").
    const cuposOcupados = enTaller + enPulmon;
    const pctOcup  = Math.min(100, Math.round(cuposOcupados / CAP * 100));
    const ingresosHoy = ordenesActivas.filter(o => _localDay(o.ingreso_en) === _hoyKey).length
                      + entregadasRecientes.filter(o => _localDay(o.ingreso_en) === _hoyKey).length;
    const entregasHoy = entregadasRecientes.filter(o => _localDay(o.entregada_en) === _hoyKey).length;

    // Throughput últimos 7 días (ingresos vs entregas)
    const dias7 = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(hoy); d.setDate(d.getDate() - i);
      dias7.push({ dStr: _localDay(d), lbl: d.toLocaleDateString('es-CO', { weekday: 'short' }).replace('.', ''), ingresos: 0, entregas: 0 });
    }
    const _sumDia = (arr, campo, key) => arr.forEach(o => { const d = dias7.find(x => x.dStr === _localDay(o[campo])); if (d) d[key]++; });
    _sumDia(ordenesActivas, 'ingreso_en', 'ingresos');
    _sumDia(entregadasRecientes, 'ingreso_en', 'ingresos');
    _sumDia(entregadasRecientes, 'entregada_en', 'entregas');
    const maxT = Math.max(1, ...dias7.map(d => Math.max(d.ingresos, d.entregas)));

    // Embudo: órdenes activas por etapa del proceso
    const _embudo = {};
    ordenesActivas.filter(o => !o.pulmon).forEach(o => {
      const ets = todasEtapas.filter(e => e.orden_id === o.id);
      const act = etapasActivas.find(e => e.orden_id === o.id);
      let stage;
      if (act) stage = act.etapa || act.servicio || 'En proceso';
      else if (!ets.length || ets.every(e => !e.mecanico_id)) stage = 'Sin asignar';
      else if (ets.every(e => e.fin)) stage = 'Calidad / Listo';
      else stage = 'Por iniciar';
      _embudo[stage] = (_embudo[stage] || 0) + 1;
    });
    const embudo = Object.entries(_embudo).map(([label, valor]) => ({ label, valor })).sort((a, b) => b.valor - a.valor);

    // Cumplimiento de entregas (últimos 14 días) + órdenes en riesgo
    const _conMeta = entregadasRecientes.filter(o => o.fecha_entrega_1);
    const _aTiempo = _conMeta.filter(o => new Date(o.entregada_en) <= new Date(new Date(o.fecha_entrega_1).getTime() + 86400000)).length;
    const pctCumpl = _conMeta.length ? Math.round(_aTiempo / _conMeta.length * 100) : null;
    const enRiesgo = ordenesActivas.filter(o => !o.pulmon && o.fecha_entrega_1)
      .map(o => ({ ...o, dias: Math.ceil((new Date(o.fecha_entrega_1) - hoy) / 86400000) }))
      .filter(o => o.dias <= 2).sort((a, b) => a.dias - b.dias);

    const _fmtCOP = n => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(n || 0);

    // ── Fórmula única de valor por orden (usada en TODO el KPI) ──────────────
    // Prioridad: precio_venta_cliente (aseguradora) › etapas + insumos + repuestos.
    const _valItemsVT = (o, campo) => { try { const raw = o[campo]; const a = Array.isArray(raw) ? raw : (typeof raw === 'string' && raw ? JSON.parse(raw) : []); return a.reduce((s, i) => s + (((+i.cantidad) || 0) * ((+i.valor) || 0)), 0); } catch (_) { return 0; } };
    const _valOrden = o => {
      const mo = todasEtapas.filter(e => e.orden_id === o.id).reduce((a, e) => a + (e.valor_venta || 0), 0);
      return (o.precio_venta_cliente && o.precio_venta_cliente > 0)
        ? o.precio_venta_cliente
        : (mo + _valItemsVT(o, 'insumos') + _valItemsVT(o, 'repuestos_simple'));
    };

    // Desglose por categoría — la misma fórmula en los tres grupos.
    const _ordsEnProceso = ordenesActivas.filter(o => !o.pulmon);
    const _ordsPulmonInt = ordenesActivas.filter(o => o.pulmon && o.pulmon_tipo === 'interno');
    const _ordsPulmonExt = ordenesActivas.filter(o => o.pulmon && o.pulmon_tipo === 'externo');
    const valorEnProceso  = _ordsEnProceso.reduce((s, o) => s + _valOrden(o), 0);
    const valorPulmonInt  = _ordsPulmonInt.reduce((s, o) => s + _valOrden(o), 0);
    const valorPulmonExt  = _ordsPulmonExt.reduce((s, o) => s + _valOrden(o), 0);
    const totalValorTaller = valorEnProceso + valorPulmonInt + valorPulmonExt;

    // FACTURADO del mes: base manual (localStorage) + órdenes entregadas DESPUÉS de fijar la base.
    const _kpiMesKey = `facturado_base_${hoy.getFullYear()}_${hoy.getMonth()}`;
    const _kpiBaseFechaKey = `facturado_base_fecha_${hoy.getFullYear()}_${hoy.getMonth()}`;
    const _kpiBase = parseInt(localStorage.getItem(_kpiMesKey) || '0', 10);
    const _kpiBaseFecha = localStorage.getItem(_kpiBaseFechaKey) || null;
    const _entregadasPost = (_kpiBase > 0 && _kpiBaseFecha)
      ? (entregadasMesVal || []).filter(o => o.entregada_en && o.entregada_en > _kpiBaseFecha)
      : (entregadasMesVal || []);
    const facturadoMes = _kpiBase + _entregadasPost.reduce((s, o) => s + _valOrden(o), 0);
    // META del mes: meta_base del mes calendario actual en ventas_mensuales.
    const _metaMes = (metasTallerArr || [])[0];
    const metaIngresosMes = Number(_metaMes?.meta_base) || 0;
    const _pctFact = metaIngresosMes > 0 ? Math.min(Math.round(facturadoMes / metaIngresosMes * 100), 100) : null;
    const valorTallerHtml = `
      <div class="kpi-valor-taller" onclick="abrirPanelValorTaller()" style="cursor:pointer" title="Ver valor por orden y la meta del mes">
        <div style="min-width:0;flex:1">
          <div class="kpi-vt-lbl">💰 Valor en el taller</div>
          <div class="kpi-vt-sub">${ordenesActivas.length} órdenes activas · <span style="text-decoration:underline">ver detalle →</span></div>
          <div style="display:flex;flex-direction:column;gap:2px;margin-top:7px">
            <div style="font-size:10.5px;color:rgba(255,255,255,.75)">🔧 En proceso&nbsp;<strong style="color:#fff">${_fmtCOP(valorEnProceso)}</strong>&nbsp;<span style="opacity:.6">(${_ordsEnProceso.length})</span></div>
            ${_ordsPulmonInt.length ? `<div style="font-size:10.5px;color:rgba(255,255,255,.75)">🫁 Pulmón int.&nbsp;<strong style="color:#fff">${_fmtCOP(valorPulmonInt)}</strong>&nbsp;<span style="opacity:.6">(${_ordsPulmonInt.length})</span></div>` : ''}
            ${_ordsPulmonExt.length ? `<div style="font-size:10.5px;color:rgba(255,255,255,.75)">🌐 Pulmón ext.&nbsp;<strong style="color:#fff">${_fmtCOP(valorPulmonExt)}</strong>&nbsp;<span style="opacity:.6">(${_ordsPulmonExt.length})</span></div>` : ''}
          </div>
        </div>
        <div style="display:flex;flex-direction:column;gap:5px;align-items:flex-end;flex-shrink:0">
          <div style="display:flex;flex-direction:column;align-items:flex-end;gap:1px">
            <span style="font-size:9.5px;font-weight:700;text-transform:uppercase;letter-spacing:.04em;opacity:.7">Total taller</span>
            <span class="kpi-vt-num" style="font-size:20px">${_fmtCOP(totalValorTaller)}</span>
          </div>
          <div style="display:flex;flex-direction:column;align-items:flex-end;gap:1px;border-top:1px solid rgba(255,255,255,.22);padding-top:5px">
            <div style="display:flex;align-items:center;gap:5px">
              <span style="font-size:9.5px;font-weight:700;text-transform:uppercase;letter-spacing:.04em;opacity:.7">Facturado mes</span>
              <button onclick="event.stopPropagation();_kpiEditarBase()" title="Ajustar valor base del mes" style="font-size:8px;padding:1px 5px;border-radius:99px;border:1px solid rgba(255,255,255,.3);background:rgba(255,255,255,.1);color:rgba(255,255,255,.7);cursor:pointer;line-height:1.4">✏️</button>
            </div>
            <span class="kpi-vt-num" style="font-size:20px;color:#A7F3D0">${_fmtCOP(facturadoMes)}</span>
            ${_pctFact !== null ? `<div style="display:flex;align-items:center;gap:5px;margin-top:2px">
              <div style="width:70px;height:3px;background:rgba(255,255,255,.2);border-radius:99px;overflow:hidden">
                <div style="height:100%;width:${_pctFact}%;background:#A7F3D0;border-radius:99px"></div>
              </div>
              <span style="font-size:9px;color:rgba(255,255,255,.65)">${_pctFact}% de meta</span>
            </div>` : '<span style="font-size:9px;color:rgba(255,255,255,.4)">sin meta cargada</span>'}
          </div>
        </div>
      </div>`;

    // ── Capacidad y comercial (datos reales) ──
    const _manana = new Date(hoy); _manana.setDate(_manana.getDate() + 1);
    const _mananaKey = _localDay(_manana);
    const porEntregarHoy    = ordenesActivas.filter(o => _localDay(o.fecha_entrega_1) === _hoyKey).length;
    const porEntregarManana = ordenesActivas.filter(o => _localDay(o.fecha_entrega_1) === _mananaKey).length;
    const cotsPend    = cotsPendientes.length;
    const cotsConvPct = cotsMes.length ? Math.round(cotsMes.filter(c => c.orden_id != null).length / cotsMes.length * 100) : 0;
    const ocupColor   = pctOcup >= 90 ? 'var(--rojo)' : pctOcup >= 70 ? 'var(--amarillo)' : 'var(--verde)';
    const indicadores2Html = `
        <div class="kpi-res-item clic" onclick="kpiDrilldown('entregarHoy')">
          <div class="kpi-res-num" style="color:var(--azul)">${porEntregarHoy}</div>
          <div class="kpi-res-lbl">Entregar hoy</div>
        </div>
        <div class="kpi-res-item clic" onclick="kpiDrilldown('entregarManana')">
          <div class="kpi-res-num">${porEntregarManana}</div>
          <div class="kpi-res-lbl">Entregar mañana</div>
        </div>
        <div class="kpi-res-item clic" onclick="kpiDrilldown('cotizPend')">
          <div class="kpi-res-num" style="color:var(--amarillo)">${cotsPend}</div>
          <div class="kpi-res-lbl">Cotiz. pendientes${cotsMes.length ? ' · ' + cotsConvPct + '% conv.' : ''}</div>
        </div>`;

    // ── Stores de drilldown para las TARJETAS de arriba (clic → ver detalle) ──
    window._kpiStore.activas = { titulo: 'Órdenes activas', filas: ordenesActivas.map(o => ({ placa: o.placa, ot: formatOT(o.id), ordenId: o.id, titulo: [o.marca, o.linea].filter(Boolean).join(' ') || 'Sin datos', sub: 'Ingreso hace ' + _kpiDur(_kpiMs(o.ingreso_en || o.creado_en)), badge: '', color: 'azul' })) };
    window._kpiStore.etapasProc = { titulo: 'Etapas en proceso', filas: etapasActivas.map(e => { const o = ordenesActivas.find(x => x.id === e.orden_id) || {}; return { placa: o.placa || '—', ot: formatOT(e.orden_id), ordenId: e.orden_id, titulo: (e.etapa || e.servicio || '—') + ' · ' + ((typeof nombreTec === 'function' ? nombreTec(e) : e.tecnico) || ''), sub: 'En curso hace ' + _kpiDur(_kpiMs(e.inicio)), badge: e.pausado ? 'Pausada' : '', color: e.pausado ? 'amarillo' : 'verde' }; }) };
    const _tecOcupados = tecActivos.filter(m => etapasActivas.some(e => e.mecanico_id === m.id));
    window._kpiStore.tecnicos = { titulo: 'Técnicos activos', filas: _tecOcupados.map(m => { const e = etapasActivas.find(x => x.mecanico_id === m.id) || {}; const o = ordenesActivas.find(x => x.id === e.orden_id) || {}; return { placa: (m.nombre || '·').charAt(0).toUpperCase(), ot: '', ordenId: e.orden_id || 0, titulo: m.nombre, sub: (e.etapa || e.servicio || 'Trabajando') + (o.placa ? (' · ' + o.placa) : ''), badge: m.rol || '', color: 'verde' }; }) };
    window._kpiStore.repuestosPend = { titulo: 'Repuestos pendientes', filas: solicitudesRep.map(s => { const o = ordenesActivas.find(x => x.id === s.orden_id) || {}; return { placa: o.placa || ('OT-' + s.orden_id), ot: formatOT(s.orden_id), ordenId: s.orden_id, titulo: s.repuesto || 'Repuesto', sub: (LABEL_REP[s.estado] || s.estado) + ' · hace ' + _kpiDur(_kpiMs(s.creado_en)), badge: '', color: 'amarillo' }; }) };
    const _entHoy = ordenesActivas.filter(o => _localDay(o.fecha_entrega_1) === _hoyKey);
    const _entMan = ordenesActivas.filter(o => _localDay(o.fecha_entrega_1) === _mananaKey);
    const _dlEnt = (arr, txt) => arr.map(o => ({ placa: o.placa, ot: formatOT(o.id), ordenId: o.id, titulo: [o.marca, o.linea].filter(Boolean).join(' ') || '', sub: 'Entrega: ' + txt, badge: txt, color: 'azul' }));
    window._kpiStore.entregarHoy = { titulo: 'Para entregar hoy', filas: _dlEnt(_entHoy, 'hoy') };
    window._kpiStore.entregarManana = { titulo: 'Para entregar mañana', filas: _dlEnt(_entMan, 'mañana') };
    window._kpiStore.cotizPend = { titulo: 'Cotizaciones pendientes', filas: (cotsPendientes || []).map(c => ({ placa: c.placa || '', ot: c.id ? ('COT-' + c.id) : '', ordenId: 0, titulo: c.cliente || c.propietario || 'Cotización', sub: c.total != null ? ('Total: $' + new Intl.NumberFormat('es-CO').format(c.total)) : '', badge: 'pendiente', color: 'amarillo' })) };

    // Mini ring gauge para la ocupación
    const _ringR = 20, _ringCirc = +(2 * Math.PI * _ringR).toFixed(2);
    const _ringDash = +(_ringCirc * pctOcup / 100).toFixed(1);
    const _ringGap  = +(_ringCirc - _ringDash).toFixed(1);
    const _ringCol  = pctOcup >= 90 ? '#DC2626' : pctOcup >= 70 ? '#D97706' : '#059669';

    // Panel "Ocupación del taller" (pulso del día) — a ancho completo, arriba.
    const pulsoHtml = `
      <div class="card kpi-ocup-clic" title="Ver ocupación del taller" onclick="if(typeof abrirPanelCapacidad==='function')abrirPanelCapacidad()" style="padding:12px 18px;display:flex;flex-wrap:wrap;gap:16px;align-items:center;flex:2 1 360px;min-width:0;cursor:pointer">
        <div class="kpi-ocup-ring">
          <svg width="54" height="54" viewBox="0 0 54 54">
            <circle cx="27" cy="27" r="${_ringR}" fill="none" stroke="var(--gris-bg)" stroke-width="6"/>
            <circle cx="27" cy="27" r="${_ringR}" fill="none" stroke="${_ringCol}" stroke-width="6"
              stroke-dasharray="${_ringDash} ${_ringGap}" stroke-linecap="round"
              transform="rotate(-90 27 27)" style="transition:stroke-dasharray .4s var(--ease-out)"/>
          </svg>
          <div class="kpi-ocup-ring-txt">
            <span class="kpi-ocup-ring-pct">${pctOcup}%</span>
            <span class="kpi-ocup-ring-lbl">${cuposOcupados}/${CAP}</span>
          </div>
        </div>
        <div style="flex:1;min-width:130px">
          <div style="font-size:9.5px;color:var(--gris-mid);text-transform:uppercase;letter-spacing:.5px;margin-bottom:5px">Ocupación del taller</div>
          <div style="display:flex;align-items:center;gap:9px">
            <div style="flex:1;height:6px;background:var(--gris-bg);border-radius:99px;overflow:hidden"><div style="height:100%;width:${pctOcup}%;background:${_ringCol};border-radius:99px;transition:width .4s var(--ease-out)"></div></div>
          </div>
        </div>
        ${_pulsoStat('En pulmón', enPulmon, '#D97706')}
        ${_pulsoStat('Ingresos hoy', ingresosHoy, '#2A5298')}
        ${_pulsoStat('Entregas hoy', entregasHoy, '#059669')}
        ${_pulsoStat('Entregas a tiempo', pctCumpl != null ? pctCumpl + '%' : '—', pctCumpl == null ? '#6B7280' : pctCumpl >= 80 ? '#059669' : pctCumpl >= 60 ? '#D97706' : '#DC2626')}
      </div>`;

    // ── Resumen de PENDIENTES de un vistazo (chips clickeables) ──
    const _pend = [
      { n: k5Filas.length, s: 'vencida',            p: 'vencidas',            key: 'k5', sev: 'rojo' },
      { n: k8Filas.length, s: 'sin moverse +4h',    p: 'sin moverse +4h',     key: 'k8', sev: 'rojo' },
      { n: k4Filas.length, s: 'esperando repuesto', p: 'esperando repuesto',  key: 'k4', sev: 'amarillo' },
      { n: k1Filas.length, s: 'sin técnico',        p: 'sin técnico',         key: 'k1', sev: 'amarillo' },
      { n: k2Filas.length, s: 'sin iniciar',        p: 'sin iniciar',         key: 'k2', sev: 'amarillo' },
      { n: k3Filas.length, s: 'parada',             p: 'paradas',             key: 'k3', sev: 'amarillo' }
    ];
    const _pendAct = _pend.filter(x => x.n > 0);
    const _sevCol  = { rojo: { bg:'#FEF2F2', bd:'#FCA5A5', tx:'#B91C1C' }, amarillo: { bg:'#FFFBEB', bd:'#FDE68A', tx:'#92400E' } };
    const pendientesHtml = `
      <div class="kpi-pend-bar">
        <div class="kpi-pend-titulo">⚠ Pendientes ahora</div>
        <div class="kpi-pend-chips">
          ${_pendAct.length ? _pendAct.map(x => {
            const c = _sevCol[x.sev];
            return `<button onclick="kpiDrilldown('${x.key}')" class="kpi-pend-chip" style="background:${c.bg};border-color:${c.bd};color:${c.tx}">
              <span class="kpi-pend-n">${x.n}</span> ${x.n === 1 ? x.s : x.p}
            </button>`;
          }).join('') : `<span style="font-size:13px;font-weight:700;color:var(--verde)">Todo al día ✓</span>`}
        </div>
      </div>`;

    // ── PANEL: ÓRDENES POR ESTADO (reemplaza los recuadros de conteo) ──────
    // Estilo (sacudida) + bucle de auto-scroll, registrados una sola vez.
    if (!document.getElementById('kpi-sec-style')) {
      const _st = document.createElement('style'); _st.id = 'kpi-sec-style';
      // Destello al actualizar IDÉNTICO a la pantalla de taller (taller.js):
      // animación tv-row-shake (ámbar→azul con anillo) + borde ámbar a la izquierda.
      _st.textContent =
        '@keyframes kpiRowShake{' +
        '0%{transform:translateX(0) scale(1);background:transparent;box-shadow:none}' +
        '4%{transform:translateX(-6px) scale(1.01);background:rgba(245,158,11,.25);box-shadow:0 0 0 3px #F59E0B}' +
        '8%{transform:translateX(6px) scale(1.01);background:rgba(245,158,11,.30);box-shadow:0 0 0 3px #F59E0B}' +
        '12%{transform:translateX(-5px) scale(1.01);background:rgba(37,99,235,.22);box-shadow:0 0 0 3px #3B82F6}' +
        '16%{transform:translateX(5px) scale(1.01);background:rgba(37,99,235,.22);box-shadow:0 0 0 3px #3B82F6}' +
        '20%{transform:translateX(-3px) scale(1);background:rgba(37,99,235,.18);box-shadow:0 0 0 3px #3B82F6}' +
        '24%{transform:translateX(3px) scale(1);background:rgba(37,99,235,.18);box-shadow:0 0 0 3px #3B82F6}' +
        '30%{transform:translateX(0) scale(1);background:rgba(37,99,235,.14);box-shadow:0 0 0 2px #3B82F6}' +
        '55%{transform:translateX(0) scale(1);background:rgba(37,99,235,.08);box-shadow:0 0 0 1px rgba(59,130,246,.5)}' +
        '100%{transform:translateX(0) scale(1);background:transparent;box-shadow:none}}' +
        '.kpi-ord-flash{animation:kpiRowShake 3s cubic-bezier(.36,.07,.19,.97) forwards;position:relative;z-index:2;border-radius:6px;border-left:3px solid #F59E0B}' +
        // Chips de orden más grandes y legibles (claro/oscuro).
        '.kpi-ord-chip{display:flex;align-items:center;gap:8px;padding:6px 8px;border-radius:6px;cursor:pointer;line-height:1.25}' +
        '.kpi-ord-chip:hover{background:var(--azul-light)}' +
        '.kpi-ord-chip .kc-pl{font-family:"DM Mono",monospace;font-weight:800;font-size:15px;color:var(--texto);flex-shrink:0}' +
        '.kpi-ord-chip .kc-nf{font-size:13px;font-weight:600;color:var(--gris-texto);flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}' +
        '.kpi-ord-chip .kc-vl{font-size:12.5px;font-weight:800;color:var(--verde);font-family:"DM Mono",monospace;flex-shrink:0}' +
        // Alerta de cambio en categoría (pulsa por 10 s).
        '@keyframes kpiAlertPulse{0%,100%{box-shadow:0 0 0 0 rgba(245,158,11,.55)}50%{box-shadow:0 0 0 5px rgba(245,158,11,0)}}' +
        // Chips de categoría (Vencidas, Pulmón…): fila compacta, abren el popup.
        '.kpi-chips-row{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:7px;margin-top:10px}' +
        '@media(max-width:560px){.kpi-chips-row{grid-template-columns:repeat(2,minmax(0,1fr))}}' +
        '.kpi-chip{min-width:0;position:relative;overflow:hidden;display:flex;align-items:center;gap:6px;padding:8px 9px;border:1px solid var(--gris-borde);border-left:4px solid;border-radius:10px;background:var(--surface);cursor:pointer;text-align:left;box-shadow:var(--shadow-sm);transition:transform .16s var(--ease-out),box-shadow .16s,background .16s}' +
        '.kpi-chip:hover{transform:translateY(-2px);box-shadow:var(--shadow-md);background:var(--surface-2)}' +
        '.kpi-chip-bg-num{position:absolute;right:6px;bottom:-2px;font-size:28px;font-weight:900;opacity:0.28;line-height:1;user-select:none;pointer-events:none;transition:opacity .2s;font-family:"DM Mono",monospace}' +
        '.kpi-chip:hover .kpi-chip-bg-num{opacity:0.4}' +
        '.kpi-chip-ico{flex-shrink:0;font-size:14px;line-height:1;position:relative;z-index:1}' +
        '.kpi-chip-title{flex:1;min-width:0;font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.01em;line-height:1.15;white-space:normal;position:relative;z-index:1}' +
        '.kpi-chip.kpi-chip-alert{animation:kpiAlertPulse 1.4s ease-in-out infinite}' +
        // Ticker de cambios (se despliega bajo los chips cuando algo cambia).
        '@keyframes kpiTickDown{from{max-height:0;opacity:0;margin-top:0}to{max-height:220px;opacity:1;margin-top:8px}}' +
        '@keyframes kpiTickUp{from{max-height:220px;opacity:1;margin-top:8px}to{max-height:0;opacity:0;margin-top:0}}' +
        '.kpi-cambio-ticker{overflow:hidden;border-radius:10px;max-height:0}' +
        '.kpi-cambio-ticker.show{animation:kpiTickDown .35s var(--ease-out) forwards}' +
        '.kpi-cambio-ticker.hide{animation:kpiTickUp .25s ease-in forwards}' +
        '.kpi-ticker-inner{background:var(--surface-2);border:1px solid var(--gris-borde);border-radius:10px;padding:9px 12px;display:flex;align-items:flex-start;gap:10px}' +
        '.kpi-ticker-items{flex:1;min-width:0}' +
        '.kpi-ticker-item{font-size:12px;display:flex;align-items:center;gap:6px;line-height:1.4;flex-wrap:wrap;cursor:pointer;border-radius:6px;padding:3px 4px;margin:-3px -4px;transition:background .15s}' +
        '.kpi-ticker-item:hover{background:rgba(var(--neon),.10)}' +
        '.kpi-ticker-item+.kpi-ticker-item{border-top:1px dashed var(--gris-borde);margin-top:5px;padding-top:5px}' +
        '.kpi-ticker-meta{display:flex;flex-direction:column;align-items:flex-end;gap:5px;flex-shrink:0}' +
        '.kpi-ticker-ts{font-size:10px;color:var(--gris-mid);white-space:nowrap}' +
        '.kpi-ticker-close{background:none;border:none;font-size:18px;line-height:1;color:var(--gris-mid);cursor:pointer;padding:0;transition:color .15s}' +
        '.kpi-ticker-close:hover{color:var(--texto)}' +
        // Panel de vista previa al pasar el mouse por los chips.
        '.kpi-hover-panel{overflow:hidden;max-height:0;opacity:0;margin-top:0;transition:max-height .28s var(--ease-out),opacity .2s ease,margin-top .2s ease;pointer-events:none}' +
        '.kpi-hover-panel.show{max-height:320px;opacity:1;margin-top:8px;pointer-events:auto}' +
        '.kpi-hover-inner{background:var(--surface);border:1px solid var(--gris-borde);border-radius:12px;padding:10px 14px;box-shadow:var(--shadow-md)}' +
        '.kpi-hp-titulo{font-size:10.5px;font-weight:800;text-transform:uppercase;letter-spacing:.5px;margin-bottom:8px;padding-bottom:7px;display:flex;align-items:center;gap:6px}' +
        '.kpi-hp-filas{display:flex;flex-direction:column;gap:2px;max-height:240px;overflow-y:auto}' +
        '.kpi-hp-vacio{font-size:13px;color:var(--gris-mid);text-align:center;padding:12px 0}' +
        '.kpi-hp-mas{font-size:11px;color:var(--gris-mid);text-align:center;padding:5px 0;border-top:1px dashed var(--gris-borde);margin-top:4px}' +
        // Resumen de arriba clickeable.
        '.kpi-res-item.clic{cursor:pointer;transition:background .15s,transform .15s}' +
        '.kpi-res-item.clic:hover{background:var(--azul-light)}' +
        '.kpi-ocup-clic{cursor:pointer}' +
        // Tarjeta rápida de cambio.
        '.kpi-cambio-ov{position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:9998;display:flex;align-items:center;justify-content:center;padding:16px}' +
        '.kpi-cambio-card{background:var(--surface);border-radius:14px;max-width:380px;width:100%;box-shadow:0 20px 60px rgba(0,0,0,.3);overflow:hidden}' +
        // Centro de Actividad — feed de eventos en tiempo real.
        '.kpi-feed{background:var(--surface);border:1px solid var(--gris-borde);border-radius:14px;overflow:hidden;margin-top:10px}' +
        '.kpi-feed-head{display:flex;align-items:center;justify-content:space-between;padding:10px 14px 6px;border-bottom:1px solid var(--gris-borde)}' +
        '.kpi-feed-title{font-size:10.5px;font-weight:800;text-transform:uppercase;letter-spacing:.6px;color:var(--gris-mid);display:flex;align-items:center;gap:7px}' +
        '.kpi-feed-live{width:7px;height:7px;border-radius:50%;background:#DC2626;box-shadow:0 0 0 0 rgba(220,38,38,.4);animation:kpiFeedPulse 2s infinite;flex-shrink:0}' +
        '@keyframes kpiFeedPulse{0%,100%{box-shadow:0 0 0 0 rgba(220,38,38,.4)}50%{box-shadow:0 0 0 5px rgba(220,38,38,0)}}' +
        '.kpi-feed-hora{font-size:10px;color:var(--gris-mid);font-family:"DM Mono",monospace}' +
        '.kpi-feed-list{padding:4px 0;max-height:300px;overflow-y:auto}' +
        '.kpi-ev{display:flex;align-items:center;gap:9px;padding:6px 14px;cursor:default;transition:background .12s}' +
        '.kpi-ev.clic{cursor:pointer}' +
        '.kpi-ev:hover.clic{background:var(--azul-light)}' +
        '.kpi-ev-ico{font-size:14px;flex-shrink:0;width:18px;text-align:center;line-height:1}' +
        '.kpi-ev-body{flex:1;min-width:0}' +
        '.kpi-ev-desc{font-size:12.5px;color:var(--texto);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}' +
        '.kpi-ev-meta{font-size:10px;color:var(--gris-mid);margin-top:1px;display:flex;align-items:center;gap:5px}' +
        '.kpi-ev-tag{font-size:9.5px;font-weight:700;padding:1px 7px;border-radius:99px;white-space:nowrap;flex-shrink:0}' +
        '.kpi-ev-arr{font-size:11px;color:var(--gris-mid);flex-shrink:0}' +
        '.kpi-ev+.kpi-ev{border-top:1px solid var(--gris-borde)}' +
        '.kpi-feed-vacio{padding:18px;text-align:center;font-size:13px;color:var(--gris-mid)}' +
        // Layout de dos columnas: chips a la izquierda, últimas actividades a la derecha.
        '.kpi-secciones-wrap{display:flex;gap:12px;align-items:flex-start}' +
        '.kpi-chips-area{flex:1;min-width:0}' +
        '.kpi-ult-act{width:262px;flex-shrink:0;background:var(--surface);border:1px solid var(--gris-borde);border-radius:14px;overflow:hidden}' +
        '.kpi-ua-head{display:flex;align-items:center;justify-content:space-between;padding:10px 14px 8px;border-bottom:1px solid var(--gris-borde)}' +
        '.kpi-ua-titulo{font-size:10.5px;font-weight:800;text-transform:uppercase;letter-spacing:.6px;color:var(--gris-mid);display:flex;align-items:center;gap:6px}' +
        '.kpi-ua-live{width:6px;height:6px;border-radius:50%;background:#DC2626;animation:kpiFeedPulse 2s infinite;flex-shrink:0}' +
        '.kpi-ua-hora{font-size:9.5px;color:var(--gris-mid);font-family:"DM Mono",monospace}' +
        '.kpi-ua-list{padding:2px 0}' +
        '.kpi-ua-item{display:flex;align-items:flex-start;gap:8px;padding:7px 12px;transition:background .12s;cursor:default}' +
        '.kpi-ua-item.clic{cursor:pointer}' +
        '.kpi-ua-item.clic:hover{background:var(--azul-light)}' +
        '.kpi-ua-item+.kpi-ua-item{border-top:1px solid var(--gris-borde)}' +
        '.kpi-ua-ico{font-size:13px;flex-shrink:0;width:16px;text-align:center;margin-top:1px}' +
        '.kpi-ua-cuerpo{flex:1;min-width:0}' +
        '.kpi-ua-desc{font-size:11.5px;color:var(--texto);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;line-height:1.3}' +
        '.kpi-ua-sub{font-size:10px;color:var(--gris-mid);margin-top:2px;display:flex;align-items:center;gap:5px;flex-wrap:wrap}' +
        '.kpi-ua-vacio{padding:16px;text-align:center;font-size:12px;color:var(--gris-mid)}' +
        '@media(max-width:768px){.kpi-secciones-wrap{flex-direction:column}.kpi-ult-act{width:100%}}' +
        // ── Layout inferior: chips ancho completo, luego donut+feed 2 columnas ──
        '.kpi-bottom-row{display:grid;grid-template-columns:1fr 1.1fr;gap:12px;align-items:start;margin-top:12px}' +
        '@media(max-width:768px){.kpi-bottom-row{grid-template-columns:1fr}}' +
        // Columna del donut
        '.kpi-donut-col{background:var(--surface);border:1px solid var(--gris-borde);border-radius:14px;padding:16px}' +
        '.kpi-dcol-titulo{font-size:10.5px;font-weight:800;text-transform:uppercase;letter-spacing:.6px;color:var(--gris-mid);margin-bottom:12px;padding-bottom:8px;border-bottom:1px solid var(--gris-borde);display:flex;align-items:center;gap:6px}' +
        '.kpi-dcol-inner{display:flex;align-items:center;gap:20px}' +
        '.kpi-dcol-legend{flex:1;display:flex;flex-direction:column;gap:6px}' +
        '.kpi-dcol-leg-item{display:flex;align-items:center;gap:7px;font-size:10.5px}' +
        '.kpi-dcol-leg-dot{width:10px;height:10px;border-radius:3px;flex-shrink:0}' +
        '.kpi-dcol-leg-label{flex:1;color:var(--gris-texto);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}' +
        '.kpi-dcol-leg-val{font-weight:700;color:var(--texto)}' +
        '.kpi-dcol-leg-pct{color:var(--gris-mid);width:30px;text-align:right}' +
        // Feed columna derecha
        '.kpi-feed-col .kpi-feed{margin-top:0}' +
        '.kpi-feed-col .kpi-feed-list{max-height:290px}' +
        // Mini ring de ocupación en el pulso
        '.kpi-ocup-ring{position:relative;width:54px;height:54px;flex-shrink:0}' +
        '.kpi-ocup-ring svg{display:block}' +
        '.kpi-ocup-ring-txt{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center}' +
        '.kpi-ocup-ring-pct{font-size:11px;font-weight:800;color:var(--texto);line-height:1}' +
        '.kpi-ocup-ring-lbl{font-size:8px;color:var(--gris-mid);margin-top:1px}' +
        // Footer note discreta
        '.kpi-footer-note{text-align:center;font-size:10px;color:var(--gris-mid);padding:4px 0}';
      document.head.appendChild(_st);
    }
    // (Se retiró la rotación por pasos: ahora cada sección es colapsable y
    // muestra máximo 4 órdenes con "Ver todas", así que no hay desbordamiento.)
    if (window._kpiScrollLoop) { cancelAnimationFrame(window._kpiScrollLoop); window._kpiScrollLoop = null; }
    if (window._kpiRotInterval) { clearInterval(window._kpiRotInterval); window._kpiRotInterval = null; }

    const _pulmonInt = ordenesActivas.filter(o => o.pulmon && o.pulmon_tipo === 'interno');
    const _pulmonExt = ordenesActivas.filter(o => o.pulmon && o.pulmon_tipo === 'externo');
    const _enProceso = [];
    { const _vistos = new Set();
      etapasActivas.forEach(e => {
        if (_vistos.has(e.orden_id)) return; _vistos.add(e.orden_id);
        const o = ordenesActivas.find(or => or.id === e.orden_id);
        if (!o || o.pulmon) return;
        _enProceso.push({ id: o.id, placa: o.placa, info: (typeof nombreTec === 'function' ? nombreTec(e) : (e.tecnico || e.tercero)) || (e.etapa || e.servicio || '') });
      });
    }
    // CAMBIOS desde el refresco anterior: si la "firma" de una orden cambió
    // (etapa activa, pausa, pulmón, etapas terminadas), se sube de primera y se sacude.
    const _sigMap = {};
    ordenesActivas.forEach(o => {
      const ets = todasEtapas.filter(e => e.orden_id === o.id);
      const act = ets.find(e => e.inicio && !e.fin);
      _sigMap[o.id] = [o.pulmon ? (o.pulmon_tipo || 'p') : '', act ? act.id : '', act ? (act.pausado ? 'P' : 'R') : '', ets.filter(e => e.fin).length].join('|');
    });
    const _prevSig = window._kpiPrevSig || {};
    const _cambiados = new Set();
    Object.keys(_sigMap).forEach(id => { if (_prevSig[id] !== undefined && _prevSig[id] !== _sigMap[id]) _cambiados.add(+id); });
    window._kpiPrevSig = _sigMap;

    // Descripción legible del cambio de cada orden + cuál etapa cambió (para
    // destellar ese apartado al abrir el detalle de la orden).
    window._kpiCambios = window._kpiCambios || {};
    _cambiados.forEach(id => {
      const ets = todasEtapas.filter(e => e.orden_id === id);
      const o = ordenesActivas.find(x => x.id === id) || {};
      const p = String(_prevSig[id] ?? '').split('|'), c = String(_sigMap[id]).split('|');
      let etapaId = null;
      if (c[1] && c[1] !== p[1]) etapaId = +c[1];               // etapa iniciada
      else if (c[2] !== p[2] && c[1]) etapaId = +c[1];          // pausada / reanudada
      else if ((+c[3] || 0) > (+p[3] || 0)) {                  // alguna finalizó
        const fin = ets.filter(e => e.fin).sort((a, b) => new Date(b.fin) - new Date(a.fin))[0];
        etapaId = fin ? fin.id : null;
      }
      window._kpiCambios[id] = { placa: o.placa || ('OT-' + id), desc: _kpiDescribirCambio(_prevSig[id], _sigMap[id], ets), etapaId };
    });
    // Stores de drilldown para las secciones que no tenían (pulmón / en proceso).
    const _dlPulmon = arr => arr.map(o => ({ placa: o.placa, ot: formatOT(o.id), ordenId: o.id, titulo: [o.marca, o.linea].filter(Boolean).join(' ') || '', sub: 'En pulmón hace ' + _kpiDur(_kpiMs(o.pulmon_desde)), badge: _kpiDur(_kpiMs(o.pulmon_desde)), color: 'amarillo' }));
    window._kpiStore.pulmonInt = { titulo: 'En pulmón interno', filas: _dlPulmon(_pulmonInt) };
    window._kpiStore.pulmonExt = { titulo: 'En pulmón externo', filas: _dlPulmon(_pulmonExt) };
    window._kpiStore.enProceso = { titulo: 'En proceso', filas: _enProceso.map(o => ({ placa: o.placa, ot: formatOT(o.id), ordenId: o.id, titulo: o.info, sub: '', badge: '', color: 'verde' })) };
    // Qué secciones tienen una orden cambiada (para las alertas post-render).
    const _secOrdenes = {
      vencidas: k5Filas.map(f => f.ordenId), pulmonInt: _pulmonInt.map(o => o.id), pulmonExt: _pulmonExt.map(o => o.id),
      enProceso: _enProceso.map(o => o.id), sinTecnico: k1Filas.map(f => f.ordenId), sinIniciar: k2Filas.map(f => f.ordenId),
      sinMov: k8Filas.map(f => f.ordenId), repuestos: k4Filas.map(f => f.ordenId)
    };
    window._kpiSecCambios = {};
    Object.keys(_secOrdenes).forEach(k => { window._kpiSecCambios[k] = _secOrdenes[k].filter(id => _cambiados.has(id)); });

    // Valor por orden para los chips — reutiliza la misma fórmula unificada.
    const _valOrd = {};
    ordenesActivas.forEach(o => { _valOrd[o.id] = _valOrden(o); });
    const _fmtValKpi = n => '$' + new Intl.NumberFormat('es-CO', { maximumFractionDigits: 0 }).format(n || 0);

    // Chip de orden: si la orden cambió, destella y al tocar muestra QUÉ cambió.
    const _chipO = (id, placa, info) => {
      const cambio = _cambiados.has(id);
      const click = cambio ? `_kpiVerCambio(${id})` : `_kpiAbrirOrden(${id})`;
      return `<div class="kpi-ord-chip${cambio ? ' kpi-ord-flash' : ''}" onclick="${click}">
        <span class="kc-pl">${escapeHtml(placa || '—')}</span>
        <span class="kc-nf">${escapeHtml(info || '')}</span>
        ${_valOrd[id] ? `<span class="kc-vl">${_fmtValKpi(_valOrd[id])}</span>` : ''}
      </div>`;
    };
    // Sección colapsable: encabezado (toca para abrir/cerrar), alerta de cambio,
    // y cuerpo con máximo 4 órdenes + "Ver todas (N)".
    // Chip compacto: ícono + título (baja a 2ª línea si es largo) + contador.
    // Al hacer clic abre el popup (kpiDrilldown), sin expandir inline.
    const _secO = (key, ico, titulo, color, filas, mapFn, getId, storeKey) => {
      return `<button class="kpi-chip" id="kpi-sec-${key}"
        onclick="kpiDrilldown('${storeKey}')"
        onmouseenter="kpiHoverPreview('${storeKey}','${color}','${ico} ${titulo}')"
        onmouseleave="kpiHoverPreviewOut()"
        style="border-left-color:${color}">
        <span class="kpi-chip-bg-num" style="color:${color}">${filas.length}</span>
        <span class="kpi-chip-ico">${ico}</span>
        <span class="kpi-chip-title" style="color:${color}">${titulo}</span>
      </button>`;
    };
    // ── Donut: distribución de órdenes activas por etapa del proceso ──
    const _donutColors = ['#2563EB','#059669','#D97706','#7C3AED','#0891B2','#DC2626','#B45309','#9333EA','#EA580C','#0D9488'];
    const _donutR = 44, _donutC = 60, _donutCirc = +(2 * Math.PI * _donutR).toFixed(2);
    const _embudoTotal = embudo.reduce((s, d) => s + (d.valor || 0), 0) || 1;
    let _donutOff = 0;
    const _donutSlices = embudo.slice(0, 8).map((d, i) => {
      const dash = +(_donutCirc * (d.valor || 0) / _embudoTotal).toFixed(1);
      const gap  = +(_donutCirc - dash).toFixed(1);
      const col  = _donutColors[i % _donutColors.length];
      const svg  = `<circle cx="${_donutC}" cy="${_donutC}" r="${_donutR}" fill="none" stroke="${col}" stroke-width="20" stroke-dasharray="${dash} ${gap}" stroke-dashoffset="${(-_donutOff).toFixed(1)}" transform="rotate(-90 ${_donutC} ${_donutC})"/>`;
      _donutOff += dash;
      return { label: d.label, valor: d.valor, color: col, svg, pct: Math.round((d.valor || 0) / _embudoTotal * 100) };
    });
    const donutHtml = `
      <div class="kpi-donut-col">
        <div class="kpi-dcol-titulo"><span style="width:7px;height:7px;border-radius:50%;background:var(--azul);display:inline-block"></span>Distribución por etapa del proceso</div>
        <div class="kpi-dcol-inner">
          <svg viewBox="0 0 120 120" width="130" height="130" style="flex-shrink:0">
            <circle cx="${_donutC}" cy="${_donutC}" r="${_donutR}" fill="none" stroke="var(--gris-bg)" stroke-width="20"/>
            ${_donutSlices.map(s => s.svg).join('')}
            <text x="${_donutC}" y="56" text-anchor="middle" fill="var(--texto)" font-size="16" font-weight="900" font-family="inherit">${enTaller}</text>
            <text x="${_donutC}" y="70" text-anchor="middle" fill="var(--gris-mid)" font-size="8" font-family="inherit">activas</text>
          </svg>
          <div class="kpi-dcol-legend">
            ${_donutSlices.length ? _donutSlices.map(s => `
              <div class="kpi-dcol-leg-item">
                <span class="kpi-dcol-leg-dot" style="background:${s.color}"></span>
                <span class="kpi-dcol-leg-label">${escapeHtml(s.label)}</span>
                <span class="kpi-dcol-leg-val">${s.valor}</span>
                <span class="kpi-dcol-leg-pct">${s.pct}%</span>
              </div>`).join('') : '<div style="font-size:11px;color:var(--gris-mid);text-align:center;padding:8px 0">Sin datos de etapas</div>'}
          </div>
        </div>
      </div>`;

    // ── Fila de estadísticas inferiores ──
    const statsBottomHtml = `
      <div class="kpi-stats-bottom">
        <div class="kpi-sbot">
          <div class="kpi-sbot-num" style="color:var(--azul)">${_fmtCOP(facturadoMes)}</div>
          <div class="kpi-sbot-lbl">Facturado este mes</div>
          <div class="kpi-sbot-sub" style="color:var(--gris-mid)">${entregadasMesVal.length} órdenes entregadas</div>
        </div>
        <div class="kpi-sbot">
          <div class="kpi-sbot-num">${ordenesActivas.length}</div>
          <div class="kpi-sbot-lbl">Órdenes activas</div>
          <div class="kpi-sbot-sub" style="color:var(--gris-mid)">${ingresosHoy} ingreso${ingresosHoy!==1?'s':''} · ${entregasHoy} entrega${entregasHoy!==1?'s':''} hoy</div>
        </div>
        <div class="kpi-sbot">
          <div class="kpi-sbot-num" style="color:${pctCumpl==null?'var(--gris-mid)':pctCumpl>=80?'var(--verde)':pctCumpl>=60?'var(--amarillo)':'var(--rojo)'}">${pctCumpl!=null?pctCumpl+'%':'—'}</div>
          <div class="kpi-sbot-lbl">Entregas a tiempo</div>
          <div class="kpi-sbot-sub" style="color:var(--gris-mid)">${_conMeta.length} con fecha pactada</div>
        </div>
        <div class="kpi-sbot">
          <div class="kpi-sbot-num" style="color:${enRiesgo.length?'var(--amarillo)':'var(--verde)'}">${enRiesgo.length}</div>
          <div class="kpi-sbot-lbl">En riesgo de vencer</div>
          <div class="kpi-sbot-sub" style="color:${k5Filas.length?'var(--rojo)':'var(--gris-mid)'}">${k5Filas.length} ya vencida${k5Filas.length!==1?'s':''}</div>
        </div>
        <div class="kpi-sbot">
          <div class="kpi-sbot-num" style="font-size:13px;color:var(--gris-mid);font-family:'DM Mono',monospace">${hora}</div>
          <div class="kpi-sbot-lbl">Última actualización</div>
          <div class="kpi-sbot-sub" style="color:var(--gris-mid)">KPI: 30s · Actividad: 8s</div>
        </div>
      </div>`;

    const seccionesHtml = `
      <div class="kpi-chips-row">
        ${_secO('vencidas','🚨','Vencidas','#DC2626', k5Filas, f => _chipO(f.ordenId, f.placa, f.badge), f => f.ordenId, 'k5')}
        ${_secO('pulmonInt','🫁','Pulmón interno','#D97706', _pulmonInt, o => _chipO(o.id, o.placa, _kpiDur(_kpiMs(o.pulmon_desde))), o => o.id, 'pulmonInt')}
        ${_secO('pulmonExt','🫁','Pulmón externo','#2563EB', _pulmonExt, o => _chipO(o.id, o.placa, _kpiDur(_kpiMs(o.pulmon_desde))), o => o.id, 'pulmonExt')}
        ${_secO('enProceso','🔧','En proceso','#059669', _enProceso, o => _chipO(o.id, o.placa, o.info), o => o.id, 'enProceso')}
        ${_secO('sinTecnico','📋','Sin técnico','#B45309', k1Filas, f => _chipO(f.ordenId, f.placa, f.titulo), f => f.ordenId, 'k1')}
        ${_secO('sinIniciar','⏳','Sin iniciar','#92400E', k2Filas, f => _chipO(f.ordenId, f.placa, f.titulo), f => f.ordenId, 'k2')}
        ${_secO('sinMov','🕐','Sin movimiento +4h','#9333EA', k8Filas, f => _chipO(f.ordenId, f.placa, f.badge), f => f.ordenId, 'k8')}
        ${_secO('repuestos','🔩','Repuestos atascados','#0891B2', k4Filas, f => _chipO(f.ordenId, f.placa, f.titulo), f => f.ordenId, 'k4')}
      </div>
      <div class="kpi-hover-panel" id="kpi-hover-panel"></div>
      <div class="kpi-cambio-ticker" id="kpi-cambio-ticker"></div>

      <div class="kpi-bottom-row">
        ${donutHtml}
        <div class="kpi-feed-col">
          <div class="kpi-feed" id="kpi-feed">
            <div class="kpi-feed-head">
              <div class="kpi-feed-title"><span class="kpi-feed-live"></span>Actividad en tiempo real</div>
              <span class="kpi-feed-hora"></span>
            </div>
            <div class="kpi-feed-list"><div class="kpi-feed-vacio">Cargando actividad…</div></div>
          </div>
        </div>
      </div>
      <div class="kpi-footer-note">KPI: 30s · Actividad: 8s · última actualización ${hora}</div>
`;

    renderSinParpadeo(cont, `
      <div class="kpi-shell">

        <div class="kpi-header">
          <div style="display:flex;align-items:center;gap:12px">
            <div style="font-weight:700;font-size:16px;color:var(--texto)">Gestión Operativa</div>
            <div class="kpi-live" style="font-size:11px;color:var(--gris-texto);background:var(--gris-bg);padding:3px 10px 3px 9px;border-radius:99px;border:1px solid var(--gris-borde)"><span class="kpi-live-dot"></span>EN VIVO · ${hora}</div>
          </div>
          <button class="btn btn-ghost btn-sm" onclick="_kpiActualizar(this)">
            <svg class="kpi-refresh-ico" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path d="M23 4v6h-6M1 20v-6h6"/><path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/></svg>
            Actualizar
          </button>
        </div>

        <div class="kpi-fila-top">
          ${valorTallerHtml}
          ${pulsoHtml}
        </div>

        <div class="kpi-resumen">
          <div class="kpi-res-item clic" onclick="kpiDrilldown('activas')">
            <div class="kpi-res-num">${ordenesActivas.length}</div>
            <div class="kpi-res-lbl">Órdenes activas</div>
          </div>
          <div class="kpi-res-item clic" onclick="kpiDrilldown('etapasProc')">
            <div class="kpi-res-num" style="color:var(--verde)">${etapasActivas.length}</div>
            <div class="kpi-res-lbl">Etapas en proceso</div>
          </div>
          <div class="kpi-res-item clic" onclick="kpiDrilldown('tecnicos')">
            <div class="kpi-res-num" style="color:var(--azul)">${tecActivos.length - k7Filas.length}</div>
            <div class="kpi-res-lbl">Técnicos activos</div>
          </div>
          <div class="kpi-res-item clic" onclick="kpiDrilldown('repuestosPend')">
            <div class="kpi-res-num" style="color:var(--amarillo)">${solicitudesRep.length}</div>
            <div class="kpi-res-lbl">Repuestos pendientes</div>
          </div>
          ${indicadores2Html}
        </div>

        ${seccionesHtml}

        <div class="kpi-grid" style="display:none">
          <div class="kpi-card kpi-${k1Color}" onclick="kpiDrilldown('k1')">
            <div class="kpi-card-ico">📋</div>
            <div class="kpi-card-num">${k1Filas.length}</div>
            <div class="kpi-card-lbl">Sin técnico asignado</div>
            <div class="kpi-card-sub">${k1Filas.length ? 'Más antigua: ' + _kpiDur(k1Max) : 'Sin alertas'}</div>
            <div class="kpi-card-link">Ver detalle →</div>
          </div>

          <div class="kpi-card kpi-${k2Color}" onclick="kpiDrilldown('k2')">
            <div class="kpi-card-ico">⏳</div>
            <div class="kpi-card-num">${k2Filas.length}</div>
            <div class="kpi-card-lbl">Etapas sin iniciar</div>
            <div class="kpi-card-sub">${k2Filas.length ? 'Esperando hace ' + _kpiDur(k2Max) : 'Sin alertas'}</div>
            <div class="kpi-card-link">Ver detalle →</div>
          </div>

          <div class="kpi-card kpi-${k3Color}" onclick="kpiDrilldown('k3')">
            <div class="kpi-card-ico">⏸</div>
            <div class="kpi-card-num">${k3Filas.length}</div>
            <div class="kpi-card-lbl">Entretiempos activos</div>
            <div class="kpi-card-sub">${k3Filas.length ? k3Filas.length + ' orden(es) paradas' : 'Sin brechas'}</div>
            <div class="kpi-card-link">Ver detalle →</div>
          </div>

          <div class="kpi-card kpi-${k4Color}" onclick="kpiDrilldown('k4')">
            <div class="kpi-card-ico">🔧</div>
            <div class="kpi-card-num">${k4Filas.length}</div>
            <div class="kpi-card-lbl">Repuestos atascados</div>
            <div class="kpi-card-sub">${k4Filas.length ? 'Más antigua: ' + _kpiDur(k4Max) : 'Sin alertas'}</div>
            <div class="kpi-card-link">Ver detalle →</div>
          </div>

          <div class="kpi-card kpi-${k5Color}" onclick="kpiDrilldown('k5')">
            <div class="kpi-card-ico">🚨</div>
            <div class="kpi-card-num">${k5Filas.length}</div>
            <div class="kpi-card-lbl">Órdenes vencidas</div>
            <div class="kpi-card-sub">${k5Filas.length ? 'Requieren atención inmediata' : 'Todo en fecha'}</div>
            <div class="kpi-card-link">Ver detalle →</div>
          </div>

          <div class="kpi-card kpi-${k6Color}" onclick="kpiDrilldown('k6')">
            <div class="kpi-card-ico">⚡</div>
            <div class="kpi-card-num">${_kpiDur(k6Prom)}</div>
            <div class="kpi-card-lbl">Prom. asig. → arranque</div>
            <div class="kpi-card-sub">Basado en ${tiemposArr.length} etapas</div>
            <div class="kpi-card-link">Ver historial →</div>
          </div>

          <div class="kpi-card kpi-${k7Color}" onclick="kpiDrilldown('k7')">
            <div class="kpi-card-ico">👷</div>
            <div class="kpi-card-num">${k7Filas.length}</div>
            <div class="kpi-card-lbl">Técnicos libres</div>
            <div class="kpi-card-sub">${k7Filas.length ? k7Filas.slice(0, 2).map(f => f.titulo.split(' ')[0]).join(', ') + (k7Filas.length > 2 ? '...' : '') : 'Todos ocupados'}</div>
            <div class="kpi-card-link">Ver quiénes →</div>
          </div>

          <div class="kpi-card kpi-${k8Color}" onclick="kpiDrilldown('k8')">
            <div class="kpi-card-ico">🕐</div>
            <div class="kpi-card-num">${k8Filas.length}</div>
            <div class="kpi-card-lbl">Sin movimiento +4h</div>
            <div class="kpi-card-sub">${k8Filas.length ? 'Revisar prioridad' : 'Todas con actividad'}</div>
            <div class="kpi-card-link">Ver detalle →</div>
          </div>
        </div>

        <!-- PANELES DE CONTROL (ocultos: reemplazados por "Órdenes por estado") -->
        <div class="kpi-paneles" style="display:none">
          <div class="card kpi-panel">
            <div class="kpi-panel-titulo">Flujo · ingresos vs entregas (7 días)</div>
            <div style="display:flex;align-items:flex-end;gap:6px;height:52px;padding-top:3px">
              ${dias7.map(d => `<div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:3px">
                <div style="display:flex;align-items:flex-end;gap:2px;height:42px">
                  <div title="Ingresos: ${d.ingresos}" style="width:7px;height:${Math.max(Math.round(d.ingresos / maxT * 40), d.ingresos ? 3 : 0)}px;background:#2A5298;border-radius:3px 3px 0 0"></div>
                  <div title="Entregas: ${d.entregas}" style="width:7px;height:${Math.max(Math.round(d.entregas / maxT * 40), d.entregas ? 3 : 0)}px;background:#059669;border-radius:3px 3px 0 0"></div>
                </div>
                <div style="font-size:8px;color:var(--gris-mid)">${d.lbl}</div>
              </div>`).join('')}
            </div>
            <div style="display:flex;gap:14px;margin-top:7px;font-size:9px;color:var(--gris-mid)">
              <span><span style="display:inline-block;width:8px;height:8px;background:#2A5298;border-radius:2px;vertical-align:middle"></span> Ingresos</span>
              <span><span style="display:inline-block;width:8px;height:8px;background:#059669;border-radius:2px;vertical-align:middle"></span> Entregas</span>
            </div>
          </div>

          <div class="card kpi-panel">
            <div class="kpi-panel-titulo">Órdenes por etapa del proceso</div>
            ${_kpiBarras(embudo, '#2A5298')}
          </div>

          <div class="card kpi-panel">
            <div class="kpi-panel-titulo">Órdenes en riesgo (${enRiesgo.length})</div>
            ${enRiesgo.length ? enRiesgo.slice(0, 8).map(o => {
              const venc = o.dias < 0, col = venc ? '#DC2626' : o.dias === 0 ? '#D97706' : '#B45309';
              const txt = venc ? `vencida ${Math.abs(o.dias)}d` : o.dias === 0 ? 'vence hoy' : `en ${o.dias}d`;
              return `<div class="kpi-tec-row" onclick="_kpiAbrirOrden(${o.id})">
                <span style="font-family:'DM Mono',monospace;font-weight:700;font-size:12px;flex-shrink:0">${escapeHtml(o.placa || '—')}</span>
                <span style="font-size:11px;color:var(--gris-mid);flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escapeHtml([o.marca, o.linea].filter(Boolean).join(' ') || '')}</span>
                <span style="font-size:11px;font-weight:700;color:${col};flex-shrink:0">${txt}</span>
              </div>`;
            }).join('') : '<div style="font-size:12px;color:var(--gris-mid)">Ninguna orden en riesgo ✓</div>'}
          </div>
        </div>

      </div>`);

    // Animar números (cuenta + flash en los que cambiaron) tras cada refresco.
    _kpiAnimarNumeros();

    // Alertas de cambio: a las secciones colapsadas con un cambio les pone la
    // alerta pulsante (10 s); a las abiertas les re-dispara el destello.
    _kpiAplicarAlertasSecciones();

    // Centro de actividad: carga eventos y arranca el polling independiente (8s).
    _kpiFeedIniciar();

  } catch (err) {
    if (cont) cont.innerHTML = `<div class="empty-state" style="padding:40px">
      <div style="font-size:32px;margin-bottom:12px">⚠️</div>
      <div style="font-weight:700;margin-bottom:6px">Error cargando KPIs</div>
      <div style="font-size:13px;color:var(--gris-mid)">${escapeHtml(err.message)}</div>
    </div>`;
  }
}

// ═══════════════════════════════════════════════════════════
// PANEL "Valor en el taller + Meta del mes" (clic en el valor del taller).
// Muestra el valor por orden activa que suma el total, y la meta mensual de
// ingresos (del módulo Metas) con cuánto se lleva, cuánto falta y barra/gráfico.
// ═══════════════════════════════════════════════════════════
async function abrirPanelValorTaller() {
  const _fmt = n => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(n || 0);
  document.getElementById('panel-valor-taller')?.remove();
  const ov = document.createElement('div');
  ov.id = 'panel-valor-taller';
  ov.style.cssText = 'position:fixed;inset:0;z-index:800;background:rgba(0,0,0,.55);display:flex;align-items:center;justify-content:center;padding:16px';
  ov.innerHTML = `<div style="background:var(--surface);border-radius:16px;max-width:640px;width:100%;max-height:90vh;display:flex;flex-direction:column;box-shadow:0 20px 60px rgba(0,0,0,.3);overflow:hidden;font-family:'DM Sans',sans-serif">
    <div style="background:#1E3A5F;color:#fff;padding:14px 18px;display:flex;align-items:center;justify-content:space-between">
      <div style="font-size:15px;font-weight:700">💰 Valor en el taller y meta del mes</div>
      <button onclick="document.getElementById('panel-valor-taller').remove()" style="background:none;border:none;color:#fff;font-size:22px;cursor:pointer;line-height:1">×</button>
    </div>
    <div id="pvt-body" style="padding:16px 18px;overflow:auto;flex:1"><div class="loading-state">Cargando...</div></div>
  </div>`;
  ov.addEventListener('click', e => { if (e.target === ov) ov.remove(); });
  document.body.appendChild(ov);
  try {
    const ahora = new Date();
    const inicioMes = new Date(ahora.getFullYear(), ahora.getMonth(), 1).toISOString();
    const anio = ahora.getFullYear(), mesNum = ahora.getMonth() + 1;
    const [ords, metasArr, ordsEnt] = await Promise.all([
      api(`/ordenes?or=(estado.eq.Activa,estado.is.null)&select=id,placa,pulmon,pulmon_tipo,precio_venta_cliente,insumos,repuestos_simple&limit=300`).catch(() => []) || [],
      api(`/ventas_mensuales?ano=eq.${anio}&mes_num=eq.${mesNum}&select=meta_base,ventas&limit=1`).catch(() => []) || [],
      api(`/ordenes?estado=eq.Entregada&entregada_en=gte.${inicioMes}&select=id,precio_venta_cliente,insumos,repuestos_simple&limit=500`).catch(() => []) || []
    ]);
    const metaMes = metasArr[0];
    const ids = ords.map(o => o.id).join(',');
    const ets = ids ? (await api(`/etapas?orden_id=in.(${ids})&select=orden_id,valor_venta`).catch(() => []) || []) : [];
    const valItems = (o, campo) => { try { const raw = o[campo]; const a = Array.isArray(raw) ? raw : (typeof raw === 'string' && raw ? JSON.parse(raw) : []); return a.reduce((s, i) => s + (((+i.cantidad) || 0) * ((+i.valor) || 0)), 0); } catch (_) { return 0; } };
    const valOrden = o => {
      const mo = ets.filter(e => e.orden_id === o.id).reduce((a, e) => a + (e.valor_venta || 0), 0);
      return (o.precio_venta_cliente && o.precio_venta_cliente > 0) ? o.precio_venta_cliente : (mo + valItems(o, 'insumos') + valItems(o, 'repuestos_simple'));
    };
    // Clasificar órdenes en tres grupos
    const ordsProc = ords.filter(o => !o.pulmon);
    const ordsPInt = ords.filter(o => o.pulmon && o.pulmon_tipo === 'interno');
    const ordsPExt = ords.filter(o => o.pulmon && o.pulmon_tipo === 'externo');
    const mkFila = (o) => ({ placa: o.placa, v: valOrden(o) });
    const toFila = arr => arr.map(mkFila).filter(f => f.v > 0).sort((a, b) => b.v - a.v);
    const filasProc = toFila(ordsProc);
    const filasPInt = toFila(ordsPInt);
    const filasPExt = toFila(ordsPExt);
    const vProc = filasProc.reduce((s, f) => s + f.v, 0);
    const vPInt = filasPInt.reduce((s, f) => s + f.v, 0);
    const vPExt = filasPExt.reduce((s, f) => s + f.v, 0);
    const totalTaller = vProc + vPInt + vPExt;
    const maxV = Math.max(1, ...[...filasProc, ...filasPInt, ...filasPExt].map(f => f.v));
    const meta = Number(metaMes?.meta_base) || 0;
    // Facturado del mes: órdenes entregadas en el mes en curso.
    const idsEnt = ordsEnt.map(o => o.id).join(',');
    const etsEnt = idsEnt ? (await api(`/etapas?orden_id=in.(${idsEnt})&select=orden_id,valor_venta`).catch(() => []) || []) : [];
    const ingresosMes = ordsEnt.reduce((s, o) => {
      const mo = etsEnt.filter(e => e.orden_id === o.id).reduce((a, e) => a + (e.valor_venta || 0), 0);
      return s + ((o.precio_venta_cliente && o.precio_venta_cliente > 0) ? o.precio_venta_cliente : (mo + valItems(o, 'insumos') + valItems(o, 'repuestos_simple')));
    }, 0);
    const falta = Math.max(0, meta - ingresosMes);
    const pctReal = meta > 0 ? Math.round(ingresosMes / meta * 100) : 0;
    const pctBar = Math.min(pctReal, 100);
    const colorBar = pctReal >= 100 ? '#059669' : pctReal >= 70 ? '#D97706' : '#DC2626';

    const mkRows = (filas, color) => filas.length ? filas.map(f => `
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:5px">
        <span style="font-family:'DM Mono',monospace;font-weight:800;font-size:12.5px;width:62px;flex-shrink:0">${escapeHtml(f.placa || '—')}</span>
        <div style="flex:1;height:11px;background:var(--gris-bg);border-radius:99px;overflow:hidden"><div style="height:100%;width:${Math.round(f.v / maxV * 100)}%;background:${color};border-radius:99px"></div></div>
        <span style="font-size:12px;font-weight:700;font-family:'DM Mono',monospace;flex-shrink:0;width:98px;text-align:right">${_fmt(f.v)}</span>
      </div>`).join('') : '<div style="font-size:12px;color:var(--gris-mid);padding:3px 0">—</div>';

    const body = document.getElementById('pvt-body');
    if (body) body.innerHTML = `
      <!-- ── Resumen por categoría ── -->
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:8px;margin-bottom:16px">
        <div style="background:#EFF6FF;border:1px solid #BFDBFE;border-radius:12px;padding:10px 12px">
          <div style="font-size:9.5px;font-weight:800;text-transform:uppercase;letter-spacing:.05em;color:#1D4ED8">🔧 En proceso</div>
          <div style="font-size:19px;font-weight:800;color:#1E3A5F;font-family:'DM Mono',monospace;margin-top:2px">${_fmt(vProc)}</div>
          <div style="font-size:10.5px;color:#2563EB;margin-top:1px">${filasProc.length} orden${filasProc.length !== 1 ? 'es' : ''}</div>
        </div>
        ${ordsPInt.length || filasPInt.length ? `
        <div style="background:#F5F3FF;border:1px solid #DDD6FE;border-radius:12px;padding:10px 12px">
          <div style="font-size:9.5px;font-weight:800;text-transform:uppercase;letter-spacing:.05em;color:#6D28D9">🫁 Pulmón interno</div>
          <div style="font-size:19px;font-weight:800;color:#4C1D95;font-family:'DM Mono',monospace;margin-top:2px">${_fmt(vPInt)}</div>
          <div style="font-size:10.5px;color:#7C3AED;margin-top:1px">${filasPInt.length} orden${filasPInt.length !== 1 ? 'es' : ''}</div>
        </div>` : ''}
        ${ordsPExt.length || filasPExt.length ? `
        <div style="background:#FFF7ED;border:1px solid #FED7AA;border-radius:12px;padding:10px 12px">
          <div style="font-size:9.5px;font-weight:800;text-transform:uppercase;letter-spacing:.05em;color:#C2410C">🌐 Pulmón externo</div>
          <div style="font-size:19px;font-weight:800;color:#7C2D12;font-family:'DM Mono',monospace;margin-top:2px">${_fmt(vPExt)}</div>
          <div style="font-size:10.5px;color:#EA580C;margin-top:1px">${filasPExt.length} orden${filasPExt.length !== 1 ? 'es' : ''}</div>
        </div>` : ''}
        <div style="background:#ECFDF5;border:1px solid #A7F3D0;border-radius:12px;padding:10px 12px">
          <div style="font-size:9.5px;font-weight:800;text-transform:uppercase;letter-spacing:.05em;color:#047857">💵 Facturado mes</div>
          <div style="font-size:19px;font-weight:800;color:#065F46;font-family:'DM Mono',monospace;margin-top:2px">${_fmt(ingresosMes)}</div>
          <div style="font-size:10.5px;color:#059669;margin-top:1px">${ordsEnt.length} orden${ordsEnt.length !== 1 ? 'es' : ''} entregada${ordsEnt.length !== 1 ? 's' : ''} este mes</div>
        </div>
      </div>

      <!-- ── Detalle de órdenes ── -->
      <div style="font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.06em;color:#1D4ED8;margin-bottom:6px">🔧 En proceso (${filasProc.length})</div>
      ${mkRows(filasProc, '#2A5298')}
      ${filasPInt.length ? `<div style="font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.06em;color:#6D28D9;margin:12px 0 6px">🫁 Pulmón interno (${filasPInt.length})</div>${mkRows(filasPInt, '#7C3AED')}` : ''}
      ${filasPExt.length ? `<div style="font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.06em;color:#C2410C;margin:12px 0 6px">🌐 Pulmón externo (${filasPExt.length})</div>${mkRows(filasPExt, '#EA580C')}` : ''}

      <div style="display:flex;justify-content:space-between;border-top:2px solid var(--azul-mid);margin-top:10px;padding-top:8px;font-weight:800;color:var(--azul);font-size:14px"><span>Total en el taller</span><span style="font-family:'DM Mono',monospace">${_fmt(totalTaller)}</span></div>

      <!-- ── Meta del mes ── -->
      <div style="font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.06em;color:#047857;margin:18px 0 8px">📈 Meta del mes</div>
      ${meta > 0 ? `
        <div style="display:flex;justify-content:space-between;font-size:13px;margin-bottom:5px"><span style="color:var(--gris-mid)">Logrado este mes</span><strong>${_fmt(ingresosMes)}</strong></div>
        <div style="height:22px;background:var(--gris-bg);border-radius:99px;overflow:hidden;margin-bottom:7px"><div style="height:100%;width:${pctBar}%;min-width:34px;background:${colorBar};border-radius:99px;display:flex;align-items:center;justify-content:flex-end;padding-right:9px;color:#fff;font-size:11px;font-weight:800;transition:width .5s ease">${pctReal}%</div></div>
        <div style="display:flex;justify-content:space-between;font-size:12.5px"><span style="color:var(--gris-mid)">Meta: <strong style="color:var(--texto)">${_fmt(meta)}</strong></span><span style="color:${falta > 0 ? '#DC2626' : '#059669'};font-weight:700">${falta > 0 ? 'Faltan ' + _fmt(falta) : '¡Meta cumplida! 🎉'}</span></div>
      ` : `<div style="font-size:13px;color:#B45309;background:#FEF3C7;border:1px solid #FDE68A;border-radius:8px;padding:10px 12px">No hay meta cargada para este mes. Cárgala en el módulo <strong>Metas</strong>.</div>`}`;
  } catch (e) { const b = document.getElementById('pvt-body'); if (b) b.innerHTML = `<div class="empty-state">Error: ${e.message}</div>`; }
}

function _kpiEditarBase() {
  const hoy = new Date();
  const mesKey = `facturado_base_${hoy.getFullYear()}_${hoy.getMonth()}`;
  const fechaKey = `facturado_base_fecha_${hoy.getFullYear()}_${hoy.getMonth()}`;
  const actual = parseInt(localStorage.getItem(mesKey) || '0', 10);
  const val = prompt('Valor base facturado del mes (sin puntos ni $):', actual || '');
  if (val === null) return;
  const num = parseInt(val.replace(/\D/g, ''), 10);
  if (isNaN(num)) { alert('Valor inválido'); return; }
  localStorage.setItem(mesKey, num);
  localStorage.setItem(fechaKey, new Date().toISOString());
  if (typeof cargarKpiTaller === 'function') cargarKpiTaller();
}
