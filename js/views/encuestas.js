// ═══════════════════════════════════════════════════════════════════════════
// ENCUESTAS DE SATISFACCIÓN — captura y resultados
// ───────────────────────────────────────────────────────────────────────────
// Flujo: atención al cliente llama días después de la entrega.
//   1) 3 preguntas iniciales (servicio general, asesor, jefe de taller).
//   2) Gate: si el cliente quedó conforme → bloque ampliado; si está molesto → cierra.
//   3) Calificación de mecánicos por área (siempre disponible: una queja se registra
//      aunque la encuesta se cierre temprano).
// El puntaje del mecánico NO se guarda: se deriva de encuesta_items_mecanico.puntos
// (snapshot: bien=5, regular=3, queja=1, no_aplica=null → no cuenta en el promedio).
//
// Todo vive dentro del módulo `Encuestas` (estado privado por closure). Los
// handlers de los onclick inline usan `Encuestas.metodo(...)`.
// ═══════════════════════════════════════════════════════════════════════════

const Encuestas = (() => {
  // ── Estado privado del módulo ─────────────────────────────────────────────
  const _state = {
    tab: 'pendientes',
    mecanicos: [],          // cache de operarios (id → nombre)
    continuada: null,       // gate: true | false | null
    modalKeyHandler: null,  // listener de Escape del modal activo
    periodo: 'todo',        // filtro del dashboard: 'mes' | '90' | 'todo'
    resultados: null,       // cache crudo { encuestas, items } de la pestaña Resultados
    jefe: null              // { nombre } del jefe de taller (desde configuracion)
  };

  // ── Constantes de negocio ─────────────────────────────────────────────────
  const PUNTOS = { bien: 5, regular: 3, queja: 1, no_aplica: null };
  const RES_LBL = { bien: 'Bien', regular: 'Regular', queja: 'Queja', no_aplica: 'No aplica' };
  const SRV_LBL = { latoneria: 'Latonería', pintura: 'Pintura', mecanica: 'Mecánica', adicionales: 'Adicionales' };
  // Promedio móvil: ventana de las últimas N evaluaciones que cuentan (no_aplica excluido).
  const VENTANA = 10;

  // Wrapper de fetch que loguea el error en vez de tragárselo en silencio.
  const _safe = (promise, ctx) => promise.catch(e => { console.error('[Encuestas.' + ctx + ']', e); return []; });

  // ═══════════════════════════════════════════════════════════════════════════
  // MOTOR DE PUNTAJE
  // ═══════════════════════════════════════════════════════════════════════════
  /**
   * Calcula el puntaje de un mecánico a partir de sus eventos de calificación.
   * @param {Array<{puntos:number|null, resultado:string, creado_en:string}>} items
   * @returns {{promedio:number|null, evaluadas:number, total:number, quejas:number, tendencia:number|null}}
   */
  function statsMecanico(items) {
    const ordenados = [...items].sort((a, b) => new Date(b.creado_en) - new Date(a.creado_en));
    const conPuntos = ordenados.filter(i => i.puntos != null);
    const avg = arr => arr.length ? arr.reduce((s, i) => s + Number(i.puntos), 0) / arr.length : null;
    const promedio = avg(conPuntos.slice(0, VENTANA));               // últimas N
    const promedioPrev = avg(conPuntos.slice(VENTANA, VENTANA * 2)); // N anteriores
    return {
      promedio,
      evaluadas: conPuntos.length,
      total: ordenados.length,
      quejas: ordenados.filter(i => i.resultado === 'queja').length,
      tendencia: (promedio != null && promedioPrev != null) ? promedio - promedioPrev : null
    };
  }
  function colorScore(p) { return p == null ? '#6B7280' : p >= 4 ? '#059669' : p <= 2.5 ? '#DC2626' : '#D97706'; }
  function tendHtml(t) {
    if (t == null) return `<span style="color:var(--gris-mid);font-size:12px">—</span>`;
    if (t > 0.1) return `<span style="color:#059669;font-size:12px;font-weight:700">▲ ${t.toFixed(1)}</span>`;
    if (t < -0.1) return `<span style="color:#DC2626;font-size:12px;font-weight:700">▼ ${Math.abs(t).toFixed(1)}</span>`;
    return `<span style="color:var(--gris-mid);font-size:12px">=</span>`;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // CONTROLES SEGMENTADOS (accesibles: role=group + aria-pressed)
  // ═══════════════════════════════════════════════════════════════════════════
  /**
   * Genera un control segmentado (grupo de botones tipo toggle).
   * @param {string} id      id único del contenedor (guarda el valor en data-val)
   * @param {Array<{v:string|number, label:string}>} opts opciones
   * @param {string} [aria]  etiqueta accesible del grupo
   * @returns {string} HTML del control
   */
  function segHtml(id, opts, aria = '') {
    return `<div class="enc-seg" id="${id}" data-val="" role="group"${aria ? ` aria-label="${escapeHtml(aria)}"` : ''}>` +
      opts.map(o => `<button type="button" class="enc-seg-btn act-${o.v}" data-v="${o.v}" aria-pressed="false" onclick="Encuestas.segPick('${id}','${o.v}')">${o.label}</button>`).join('') +
      `</div>`;
  }
  function segPick(id, v) {
    const c = document.getElementById(id);
    if (!c) return;
    c.dataset.val = v;
    c.querySelectorAll('.enc-seg-btn').forEach(b => {
      const on = b.dataset.v === String(v);
      b.classList.toggle('active', on);
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
  }
  function segVal(id) {
    const c = document.getElementById(id);
    const v = c?.dataset.val;
    return (v === '' || v == null) ? null : v;
  }
  const seg15 = (id, aria) => segHtml(id, [1, 2, 3, 4, 5].map(n => ({ v: n, label: String(n) })), aria);
  const segSiNo = (id, aria) => segHtml(id, [{ v: 'si', label: 'Sí' }, { v: 'no', label: 'No' }], aria);

  // Días transcurridos desde una fecha ISO (no existe util equivalente).
  function _dias(iso) {
    if (!iso) return null;
    const d = new Date(iso);
    return isNaN(d) ? null : Math.floor((Date.now() - d.getTime()) / 86400000);
  }

  // ── CSS propio de la sección (una sola vez) ─────────────────────────────────
  function _injectCss() {
    if (document.getElementById('enc-css')) return;
    const st = document.createElement('style');
    st.id = 'enc-css';
    st.textContent = `
      .enc-tabs{display:flex;gap:0;border-bottom:2px solid var(--gris-borde);margin-bottom:18px;overflow-x:auto;-webkit-overflow-scrolling:touch}
      .enc-tab-btn{padding:9px 16px;font-size:13px;font-weight:600;color:var(--gris-mid);background:none;border:none;border-bottom:3px solid transparent;margin-bottom:-2px;cursor:pointer;display:flex;align-items:center;gap:6px;transition:color .15s,border-color .15s;white-space:nowrap}
      .enc-tab-btn.active{color:var(--azul);border-bottom-color:var(--azul)}
      .enc-tab-btn:hover:not(.active){color:var(--texto)}
      .enc-badge{display:inline-flex;align-items:center;justify-content:center;min-width:18px;height:18px;padding:0 5px;border-radius:99px;font-size:10px;font-weight:800;background:var(--rojo,#DC2626);color:white}
      .enc-accion-row{display:flex;gap:6px;flex-wrap:wrap;margin-top:10px}
      .enc-timer{font-size:11px;font-weight:700;padding:2px 8px;border-radius:99px;display:inline-block}
      .enc-folder-header{font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.06em;color:var(--gris-mid);margin:18px 0 8px;padding-bottom:6px;border-bottom:1.5px solid var(--gris-borde);display:flex;align-items:center;gap:8px}
      .enc-card{background:var(--surface);border:1.5px solid var(--gris-borde);border-radius:12px;padding:14px 16px;margin-bottom:10px;box-shadow:0 1px 4px rgba(0,0,0,.04)}
      .enc-zones{display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;margin-bottom:18px}
      .enc-zone{border:2px dashed var(--gris-borde);border-radius:12px;padding:14px 10px;text-align:center;transition:all .18s ease;background:var(--surface);cursor:pointer;user-select:none}
      .enc-zone-icon{font-size:20px;margin-bottom:3px}
      .enc-zone-label{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.05em}
      .enc-zone-hint{font-size:10px;color:var(--gris-mid);margin-top:2px}
      .enc-zone.zone-green{border-color:#A7F3D0}.enc-zone.zone-green .enc-zone-label{color:#059669}
      .enc-zone.zone-amber{border-color:#FDE68A}.enc-zone.zone-amber .enc-zone-label{color:#D97706}
      .enc-zone.zone-slate{border-color:#CBD5E1}.enc-zone.zone-slate .enc-zone-label{color:#64748B}
      .enc-zone.drag-over{transform:scale(1.04)}
      .enc-zone.zone-green.drag-over{background:#ECFDF5;box-shadow:0 0 0 3px #059669}
      .enc-zone.zone-amber.drag-over{background:#FFFBEB;box-shadow:0 0 0 3px #D97706}
      .enc-zone.zone-slate.drag-over{background:#F1F5F9;box-shadow:0 0 0 3px #64748B}
      .enc-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(155px,1fr));gap:10px}
      .enc-gcard{background:var(--surface);border:1.5px solid var(--gris-borde);border-radius:11px;padding:12px;cursor:grab;transition:box-shadow .15s,transform .15s,border-color .15s,opacity .15s;user-select:none;touch-action:none}
      .enc-gcard:hover{box-shadow:0 4px 14px rgba(30,58,95,.12);transform:translateY(-1px);border-color:#B8C8DC}
      .enc-gcard.dragging{opacity:.3;transform:scale(.97)}
      .enc-gcard.selected{border-color:var(--azul);box-shadow:0 0 0 2px var(--azul)}
      .enc-gcard-plate{font-family:'DM Mono',monospace;font-size:16px;font-weight:700;color:var(--azul);letter-spacing:1px;margin-bottom:3px}
      .enc-gcard-owner{font-size:11px;color:var(--gris-mid);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-bottom:10px}
      .enc-gcard-foot{display:flex;align-items:center;justify-content:space-between;gap:4px;flex-wrap:wrap}
      .enc-gcard-time{font-size:10px;font-weight:700;color:var(--gris-mid);font-family:'DM Mono',monospace}
      .enc-gcard-time.urgent{color:#DC2626}
      .enc-ghost{position:fixed;pointer-events:none;z-index:9999;opacity:.93;transform:rotate(2deg) scale(1.05);box-shadow:0 8px 30px rgba(30,58,95,.25);border-radius:11px;background:var(--surface);border:2px solid var(--azul);padding:12px;min-width:155px}
      .enc-mobile-hint{background:#EFF6FF;border:1px solid #BFDBFE;border-radius:8px;padding:8px 12px;font-size:12px;color:#1D4ED8;margin-bottom:12px;display:none}
      @media(pointer:coarse){.enc-mobile-hint{display:block}}
      .enc-grid-lbl{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--gris-mid);margin-bottom:10px;display:flex;align-items:center;gap:8px}
      .enc-grid-lbl::after{content:'';flex:1;height:1px;background:var(--gris-borde)}
      .enc-kpi{background:var(--surface);border:1.5px solid var(--gris-borde);border-radius:12px;padding:14px 16px;text-align:center}
      .enc-kpi-num{font-size:24px;font-weight:800;color:var(--texto);font-family:'DM Mono',monospace}
      .enc-kpi-lbl{font-size:11px;color:var(--gris-mid);margin-top:2px;text-transform:uppercase;letter-spacing:.4px}
      .enc-seg{display:inline-flex;gap:4px;flex-wrap:wrap}
      .enc-seg-btn{min-width:34px;padding:7px 12px;font-size:13px;font-weight:600;color:var(--gris-mid);background:#F4F6F9;border:1.5px solid var(--gris-borde);border-radius:8px;cursor:pointer;transition:all .12s}
      .enc-seg-btn:hover{border-color:var(--azul)}
      .enc-seg-btn:focus-visible{outline:2px solid var(--azul);outline-offset:2px}
      .enc-seg-btn.active{background:var(--azul);border-color:var(--azul);color:white}
      .enc-seg-btn.act-bien.active{background:#059669;border-color:#059669}
      .enc-seg-btn.act-regular.active{background:#D97706;border-color:#D97706}
      .enc-seg-btn.act-queja.active{background:#DC2626;border-color:#DC2626}
      .enc-seg-btn.act-no_aplica.active{background:#6B7280;border-color:#6B7280}
      .enc-field{margin-bottom:14px}
      .enc-field-lbl{font-size:13px;font-weight:600;color:var(--texto);margin-bottom:7px}
      .enc-field-hint{font-size:11px;color:var(--gris-mid);font-weight:400;margin-left:6px}
      .enc-sec-title{font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:var(--azul);margin:18px 0 10px;padding-bottom:5px;border-bottom:1.5px solid var(--gris-borde)}
      .enc-mec-row{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:10px 0;border-bottom:1px solid var(--gris-borde);flex-wrap:wrap}
      .enc-mec-row:last-child{border-bottom:none}
      .enc-dash-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:14px;margin-bottom:16px}
      .enc-panel-card{background:var(--surface);border:1.5px solid var(--gris-borde);border-radius:12px;padding:16px 18px;box-shadow:0 1px 4px rgba(0,0,0,.04);margin-bottom:16px}
      .enc-panel-title{font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:var(--gris-mid);margin-bottom:14px}
      .enc-bar-row{display:grid;grid-template-columns:104px 1fr 38px;align-items:center;gap:10px;margin-bottom:11px}
      .enc-bar-lbl{font-size:12px;color:var(--texto);font-weight:600}
      .enc-bar-track{height:8px;background:#EEF1F5;border-radius:99px;overflow:hidden}
      .enc-bar-fill{height:100%;border-radius:99px;transition:width .45s cubic-bezier(.4,0,.2,1)}
      .enc-bar-val{font-size:13px;font-weight:700;font-family:'DM Mono',monospace;text-align:right}
      .enc-rank-row{display:grid;grid-template-columns:1fr 64px 70px 56px 50px;gap:8px;align-items:center;padding:9px 8px;border-bottom:1px solid var(--gris-borde);border-radius:8px;cursor:pointer;transition:background .12s}
      .enc-rank-row:hover{background:#F4F6F9}
      .enc-rank-row:focus-visible{outline:2px solid var(--azul);outline-offset:-2px}
      .enc-chip{display:inline-block;padding:2px 9px;border-radius:99px;font-size:10px;font-weight:700;white-space:nowrap}
    `;
    document.head.appendChild(st);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // MONTAJE
  // ═══════════════════════════════════════════════════════════════════════════
  async function montar() {
    _injectCss();
    const cont = document.getElementById('encuestas-contenido');
    if (!cont) return;

    if (!_state.mecanicos.length) {
      _state.mecanicos = await _safe(api('/mecanicos?select=id,nombre,rol,activo,es_asesor&order=nombre.asc'), 'montar.mecanicos') || [];
    }
    if (!_state.jefe) {
      const cfg = await _safe(api('/configuracion?clave=in.(jefe_nombre,jefe_cedula)'), 'montar.jefe') || [];
      _state.jefe = { nombre: cfg.find(c => c.clave === 'jefe_nombre')?.valor || 'Jefe de taller' };
    }

    cont.innerHTML = `
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:16px">
        <div style="flex:1">
          <div style="font-size:20px;font-weight:800;color:var(--texto);letter-spacing:-.3px">Encuestas de satisfacción</div>
          <div style="font-size:13px;color:var(--gris-mid);margin-top:2px">Seguimiento post-entrega · calificación del servicio</div>
        </div>
        <div id="enc-notif-btn" style="display:none">
          <button onclick="Encuestas.verNotificaciones()" style="position:relative;background:none;border:none;cursor:pointer;padding:4px">
            <svg width="22" height="22" fill="none" stroke="var(--texto)" stroke-width="2" viewBox="0 0 24 24"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
            <span id="enc-notif-count" style="position:absolute;top:-2px;right:-2px;background:#DC2626;color:white;border-radius:99px;font-size:9px;font-weight:800;min-width:16px;height:16px;display:flex;align-items:center;justify-content:center;padding:0 3px"></span>
          </button>
        </div>
      </div>
      <div class="enc-tabs" role="tablist">
        <button class="enc-tab-btn ${_state.tab === 'pendientes' ? 'active' : ''}" role="tab" aria-selected="${_state.tab === 'pendientes'}" onclick="Encuestas.switchTab('pendientes')">📋 Pendientes <span id="enc-badge-pend" class="enc-badge" style="display:none"></span></button>
        <button class="enc-tab-btn ${_state.tab === 'realizadas' ? 'active' : ''}" role="tab" aria-selected="${_state.tab === 'realizadas'}" onclick="Encuestas.switchTab('realizadas')">✅ Contactados</button>
        <button class="enc-tab-btn ${_state.tab === 'no_contesto' ? 'active' : ''}" role="tab" aria-selected="${_state.tab === 'no_contesto'}" onclick="Encuestas.switchTab('no_contesto')">📵 No contestó</button>
        <button class="enc-tab-btn ${_state.tab === 'archivados' ? 'active' : ''}" role="tab" aria-selected="${_state.tab === 'archivados'}" onclick="Encuestas.switchTab('archivados')">🗄 Archivados</button>
        <button class="enc-tab-btn ${_state.tab === 'resultados' ? 'active' : ''}" role="tab" aria-selected="${_state.tab === 'resultados'}" onclick="Encuestas.switchTab('resultados')">📊 Resultados</button>
      </div>
      <div id="enc-panel"><div class="loading-state">Cargando...</div></div>
    `;
    _dispatchTab();
  }

  function _dispatchTab() {
    if      (_state.tab === 'resultados')  cargarResultados();
    else if (_state.tab === 'seguimiento') cargarSeguimiento();
    else if (_state.tab === 'realizadas')  cargarRealizadas();
    else if (_state.tab === 'no_contesto') cargarNoContesto();
    else if (_state.tab === 'archivados')  cargarArchivados();
    else cargarPendientes();
  }

  function switchTab(tab) {
    _state.tab = tab;
    document.querySelectorAll('.enc-tab-btn').forEach(b => {
      const on = b.getAttribute('onclick')?.includes(`'${tab}'`);
      b.classList.toggle('active', !!on);
      b.setAttribute('aria-selected', on ? 'true' : 'false');
    });
    _dispatchTab();
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PESTAÑA: PENDIENTES
  // ═══════════════════════════════════════════════════════════════════════════
  // ── Helpers de tiempo ────────────────────────────────────────────────────────
  function _tiempoDesde(iso) {
    if (!iso) return null;
    const ms = Date.now() - new Date(iso).getTime();
    const h = Math.floor(ms / 3600000);
    const d = Math.floor(h / 24);
    if (d >= 1) return `hace ${d} día${d === 1 ? '' : 's'}`;
    if (h >= 1) return `hace ${h} h`;
    const m = Math.floor(ms / 60000);
    return `hace ${m} min`;
  }

  function _faseLbl(fase) {
    if (fase === 0) return { txt: 'Primer contacto', color: '#1D4ED8', bg: '#EFF6FF' };
    if (fase === 1) return { txt: 'Seguimiento 48h', color: '#059669', bg: '#ECFDF5' };
    if (fase === 2) return { txt: 'Check 2 semanas', color: '#7C3AED', bg: '#F5F3FF' };
    return { txt: 'Encuesta 3 semanas', color: '#D97706', bg: '#FFFBEB' };
  }

  function _proximoAvisoMs(fase) {
    if (fase === 0) return 48 * 3600000;       // 48h después del primer contacto
    if (fase === 1) return 14 * 24 * 3600000;  // 2 semanas
    return 7 * 24 * 3600000;                   // 1 semana más (3 semanas totales)
  }

  function _timerHtml(proximo_aviso) {
    if (!proximo_aviso) return '';
    const ms = new Date(proximo_aviso).getTime() - Date.now();
    if (ms <= 0) return `<span class="enc-timer" style="background:#FEE2E2;color:#DC2626">¡Vence ahora!</span>`;
    const h = Math.floor(ms / 3600000);
    const d = Math.floor(h / 24);
    const txt = d >= 1 ? `${d}d ${h % 24}h` : `${h}h`;
    return `<span class="enc-timer" style="background:#F0FDF4;color:#059669">⏱ ${txt}</span>`;
  }

  function _cardEncuesta(enc, o, accionesHtml) {
    const fl = _faseLbl(enc.fase || 0);
    const desde = _tiempoDesde(o.entregada_en);
    return `
      <div class="enc-card" data-enc-id="${enc.id}" data-orden-id="${o.id}">
        <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:10px;flex-wrap:wrap">
          <div style="min-width:0">
            <div style="font-weight:700;font-size:15px;color:var(--texto)">${escapeHtml(o.placa || '—')}
              <span style="font-weight:500;color:var(--gris-mid);font-size:13px"> · ${escapeHtml(o.marca || '')} ${escapeHtml(o.linea || '')}</span>
            </div>
            <div style="font-size:12px;color:var(--gris-mid);margin-top:3px">
              ${escapeHtml(o.propietario || 'Sin propietario')} · ${escapeHtml(otDe ? otDe(o) : ('OT-' + o.numero_ot))}
              ${desde ? ` · Entregado ${desde}` : ''}
            </div>
            ${enc.motivo ? `<div style="font-size:12px;color:#B45309;background:#FEF3C7;border-radius:6px;padding:4px 8px;margin-top:6px;display:inline-block">⚠ ${escapeHtml(enc.motivo)}</div>` : ''}
          </div>
          <div style="display:flex;flex-direction:column;align-items:flex-end;gap:4px;flex-shrink:0">
            <span style="font-size:10px;font-weight:700;padding:2px 8px;border-radius:99px;background:${fl.bg};color:${fl.color}">${fl.txt}</span>
            ${_timerHtml(enc.proximo_aviso)}
          </div>
        </div>
        ${accionesHtml}
      </div>`;
  }

  // ── PENDIENTES — grid con drag & drop ────────────────────────────────────────
  // Estado de drag para desktop y mobile
  const _drag = { encId: null, selectedId: null, ghost: null };

  async function cargarPendientes() {
    const panel = document.getElementById('enc-panel');
    if (!panel) return;
    panel.innerHTML = '<div class="loading-state">Cargando...</div>';

    const ahora = new Date().toISOString();
    const [encPend, encResuf] = await Promise.all([
      _safe(api('/encuestas?estado_seguimiento=eq.pendiente&select=id,orden_id,fase,motivo,proximo_aviso,ultimo_contacto'), 'pend.pend'),
      _safe(api(`/encuestas?proximo_aviso=lte.${ahora}&estado_seguimiento=neq.archivado&select=id,orden_id,fase,estado_seguimiento,motivo,proximo_aviso,ultimo_contacto`), 'pend.resuf')
    ]);

    const vistas = new Set();
    const todas = [...(encPend || []), ...(encResuf || [])].filter(e => {
      if (vistas.has(e.orden_id)) return false;
      vistas.add(e.orden_id); return true;
    });

    const badge = document.getElementById('enc-badge-pend');
    if (badge) { badge.textContent = todas.length; badge.style.display = todas.length ? 'flex' : 'none'; }
    _actualizarBell(todas.length);

    if (!todas.length) {
      panel.innerHTML = `<div style="padding:60px 20px;text-align:center;color:var(--gris-mid)">
        <div style="font-size:40px;margin-bottom:12px">🎉</div>
        <div style="font-size:15px;font-weight:700;color:var(--texto)">Todo al día</div>
        <div style="font-size:13px;margin-top:4px">No hay encuestas pendientes por ahora</div>
      </div>`;
      return;
    }

    const ids = todas.map(e => e.orden_id).join(',');
    const ordenes = await _safe(api(`/ordenes?id=in.(${ids})&select=id,numero_ot,placa,propietario,marca,linea,entregada_en`), 'pend.ords') || [];
    const ordMap = Object.fromEntries(ordenes.map(o => [o.id, o]));

    const puede = tienePermiso('gestionar_encuestas');

    const zonesHtml = puede ? `
      <div class="enc-zones" id="enc-zones">
        <div class="enc-zone zone-green" id="zone-contactado"
          ondragover="event.preventDefault();this.classList.add('drag-over')"
          ondragleave="this.classList.remove('drag-over')"
          ondrop="Encuestas.dropZone(event,'contactado')"
          onclick="Encuestas.tapZone('contactado')">
          <div class="enc-zone-icon">✅</div>
          <div class="enc-zone-label">Contactado</div>
          <div class="enc-zone-hint">resurge en 48h</div>
        </div>
        <div class="enc-zone zone-amber" id="zone-no_contactado"
          ondragover="event.preventDefault();this.classList.add('drag-over')"
          ondragleave="this.classList.remove('drag-over')"
          ondrop="Encuestas.dropZone(event,'no_contactado')">
          <div class="enc-zone-icon">📵</div>
          <div class="enc-zone-label">No contestó</div>
          <div class="enc-zone-hint">resurge en 2h</div>
        </div>
        <div class="enc-zone zone-slate" id="zone-archivado"
          ondragover="event.preventDefault();this.classList.add('drag-over')"
          ondragleave="this.classList.remove('drag-over')"
          ondrop="Encuestas.dropZone(event,'archivado')"
          onclick="Encuestas.tapZone('archivado')">
          <div class="enc-zone-icon">🗄</div>
          <div class="enc-zone-label">Archivar</div>
          <div class="enc-zone-hint">finalizar seguimiento</div>
        </div>
      </div>` : '';

    const cardsHtml = todas.map(enc => {
      const o = ordMap[enc.orden_id] || { id: enc.orden_id, placa: '—', propietario: '' };
      const fl = _faseLbl(enc.fase || 0);
      const ms = o.entregada_en ? Date.now() - new Date(o.entregada_en).getTime() : null;
      const dias = ms != null ? Math.floor(ms / 86400000) : null;
      const diasTxt = dias != null ? (dias === 0 ? 'hoy' : `${dias}d`) : '';
      const isUrgent = dias != null && dias >= 3;
      return `<div class="enc-gcard" data-enc-id="${enc.id}" data-orden-id="${o.id}"
        draggable="${puede ? 'true' : 'false'}"
        ondragstart="Encuestas.dragStart(event,${enc.id})"
        ondragend="Encuestas.dragEnd(event)"
        onclick="Encuestas.abrir(${o.id},${enc.id})"
        title="Clic para abrir encuesta"
        style="cursor:pointer">
        <div class="enc-gcard-plate">${escapeHtml(o.placa || '—')}</div>
        <div class="enc-gcard-owner">${escapeHtml((o.propietario || '').split(' ').slice(0,2).join(' ') || '—')}</div>
        <div class="enc-gcard-foot">
          <span style="font-size:10px;font-weight:700;padding:2px 7px;border-radius:99px;background:${fl.bg};color:${fl.color};white-space:nowrap">${fl.txt}</span>
          ${diasTxt ? `<span class="enc-gcard-time${isUrgent ? ' urgent' : ''}">${diasTxt}</span>` : ''}
        </div>
      </div>`;
    }).join('');

    panel.innerHTML = zonesHtml +
      `<div class="enc-grid-lbl">${todas.length} pendiente${todas.length !== 1 ? 's' : ''}</div>
       <div class="enc-grid" id="enc-grid">${cardsHtml}</div>`;

    _drag.selectedId = null;
    _drag.encId = null;
  }

  // ── Drag desktop ─────────────────────────────────────────────────────────────
  function dragStart(ev, encId) {
    _drag.encId = encId;
    ev.dataTransfer.effectAllowed = 'move';
    ev.currentTarget.classList.add('dragging');
  }

  function dragEnd(ev) {
    ev.currentTarget.classList.remove('dragging');
    document.querySelectorAll('.enc-zone').forEach(z => z.classList.remove('drag-over'));
    _drag.encId = null;
  }

  function dropZone(ev, estado) {
    ev.preventDefault();
    ev.currentTarget.classList.remove('drag-over');
    const id = _drag.encId;
    if (!id) return;
    if (estado === 'no_contactado') { accionConMotivo(id, 'no_contactado'); }
    else { accion(id, estado); }
  }

  // ── Touch / pointer (mobile) ──────────────────────────────────────────────────
  let _ptrStartX = 0, _ptrStartY = 0, _ptrMoved = false;

  function ptrDown(ev, encId) {
    if (ev.pointerType === 'mouse') return; // desktop usa drag nativo
    _ptrStartX = ev.clientX; _ptrStartY = ev.clientY; _ptrMoved = false;
  }

  function ptrMove(ev) {
    if (ev.pointerType === 'mouse') return;
    const dx = Math.abs(ev.clientX - _ptrStartX);
    const dy = Math.abs(ev.clientY - _ptrStartY);
    if (dx > 8 || dy > 8) _ptrMoved = true;
  }

  function ptrUp(ev) {
    if (ev.pointerType === 'mouse') return;
    // Si se movió mucho no es un tap → ignorar (scroll normal)
    if (_ptrMoved) return;
  }

  function cardTap(encId) {
    if (_drag.selectedId === encId) {
      // Deseleccionar
      _drag.selectedId = null;
      document.querySelectorAll('.enc-gcard').forEach(c => c.classList.remove('selected'));
    } else {
      _drag.selectedId = encId;
      document.querySelectorAll('.enc-gcard').forEach(c => {
        c.classList.toggle('selected', Number(c.dataset.encId) === encId);
      });
    }
  }

  function tapZone(estado) {
    const id = _drag.selectedId;
    if (!id) return; // sin selección, ignorar tap en zona
    if (estado === 'no_contactado') { accionConMotivo(id, 'no_contactado'); }
    else { accion(id, estado); }
  }

  function abrirEncuestaSeleccionada() {
    if (!_drag.selectedId) return;
    // Buscar la orden_id del enc seleccionado
    const card = document.querySelector(`.enc-gcard[data-enc-id="${_drag.selectedId}"]`);
    if (card) abrir(Number(card.dataset.ordenId));
  }

  // ── CONTACTADOS ──────────────────────────────────────────────────────────────
  async function cargarRealizadas() {
    const panel = document.getElementById('enc-panel');
    if (!panel) return;
    panel.innerHTML = '<div class="loading-state">Cargando...</div>';
    const ahora = new Date().toISOString();
    const encs = await _safe(api(`/encuestas?estado_seguimiento=eq.contactado&proximo_aviso=gt.${ahora}&select=id,orden_id,fase,proximo_aviso,ultimo_contacto`), 'realizadas') || [];
    if (!encs.length) { panel.innerHTML = `<div style="padding:40px;text-align:center;color:var(--gris-mid)">No hay contactados esperando seguimiento.</div>`; return; }
    const ids = encs.map(e => e.orden_id).join(',');
    const ordenes = await _safe(api(`/ordenes?id=in.(${ids})&select=id,numero_ot,placa,propietario,marca,linea,entregada_en`), 'realizadas.ords') || [];
    const ordMap = Object.fromEntries(ordenes.map(o => [o.id, o]));
    const puede = tienePermiso('gestionar_encuestas');
    panel.innerHTML = encs.map(enc => {
      const o = ordMap[enc.orden_id] || { id: enc.orden_id, placa: '—', marca: '', linea: '', propietario: '' };
      const accs = puede ? `<div class="enc-accion-row"><button onclick="Encuestas.accion(${enc.id},'archivado')" style="background:#F4F6F9;color:var(--gris-mid);border:1.5px solid var(--gris-borde);padding:8px 12px;border-radius:8px;font-size:13px;cursor:pointer">🗄 Archivar</button></div>` : '';
      return _cardEncuesta(enc, o, accs);
    }).join('');
  }

  // ── NO CONTESTÓ ──────────────────────────────────────────────────────────────
  async function cargarNoContesto() {
    const panel = document.getElementById('enc-panel');
    if (!panel) return;
    panel.innerHTML = '<div class="loading-state">Cargando...</div>';
    const ahora = new Date().toISOString();
    const encs = await _safe(api(`/encuestas?estado_seguimiento=eq.no_contactado&proximo_aviso=gt.${ahora}&select=id,orden_id,fase,proximo_aviso,motivo,ultimo_contacto`), 'nocon') || [];
    if (!encs.length) { panel.innerHTML = `<div style="padding:40px;text-align:center;color:var(--gris-mid)">No hay pendientes en "No contestó".</div>`; return; }
    const ids = encs.map(e => e.orden_id).join(',');
    const ordenes = await _safe(api(`/ordenes?id=in.(${ids})&select=id,numero_ot,placa,propietario,marca,linea,entregada_en`), 'nocon.ords') || [];
    const ordMap = Object.fromEntries(ordenes.map(o => [o.id, o]));
    const puede = tienePermiso('gestionar_encuestas');
    panel.innerHTML = encs.map(enc => {
      const o = ordMap[enc.orden_id] || { id: enc.orden_id, placa: '—', marca: '', linea: '', propietario: '' };
      const accs = puede ? `<div class="enc-accion-row">
        <button onclick="Encuestas.accion(${enc.id},'contactado')" style="flex:1;background:#059669;color:white;border:none;padding:9px 12px;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer">✅ Contestó</button>
        <button onclick="Encuestas.accion(${enc.id},'archivado')" style="background:#F4F6F9;color:var(--gris-mid);border:1.5px solid var(--gris-borde);padding:9px 10px;border-radius:8px;font-size:13px;cursor:pointer">🗄 Archivar</button>
      </div>` : '';
      return _cardEncuesta(enc, o, accs);
    }).join('');
  }

  // ── ARCHIVADOS ───────────────────────────────────────────────────────────────
  async function cargarArchivados() {
    const panel = document.getElementById('enc-panel');
    if (!panel) return;
    panel.innerHTML = '<div class="loading-state">Cargando...</div>';
    const encs = await _safe(api('/encuestas?estado_seguimiento=eq.archivado&select=id,orden_id,fase,ultimo_contacto&order=ultimo_contacto.desc&limit=50'), 'arch') || [];
    if (!encs.length) { panel.innerHTML = `<div style="padding:40px;text-align:center;color:var(--gris-mid)">No hay archivados todavía.</div>`; return; }
    const ids = encs.map(e => e.orden_id).join(',');
    const ordenes = await _safe(api(`/ordenes?id=in.(${ids})&select=id,numero_ot,placa,propietario,marca,linea,entregada_en`), 'arch.ords') || [];
    const ordMap = Object.fromEntries(ordenes.map(o => [o.id, o]));
    const puede = tienePermiso('gestionar_encuestas');
    panel.innerHTML = encs.map(enc => {
      const o = ordMap[enc.orden_id] || { id: enc.orden_id, placa: '—', marca: '', linea: '', propietario: '' };
      const accs = puede ? `<div class="enc-accion-row">
        <button onclick="Encuestas.eliminarEncuesta(${enc.id})" style="background:#FEE2E2;color:#DC2626;border:1.5px solid #FECACA;padding:8px 14px;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer">🗑 Eliminar</button>
      </div>` : '';
      return _cardEncuesta(enc, o, accs);
    }).join('');
  }

  // ── ELIMINAR ─────────────────────────────────────────────────────────────────
  async function eliminarEncuesta(encId) {
    if (!confirm('¿Eliminar esta encuesta? Esta acción no se puede deshacer.')) return;
    try {
      await api(`/encuestas?id=eq.${encId}`, 'DELETE');
      toast('Encuesta eliminada ✓');
      cargarArchivados();
    } catch(e) { toast('Error: ' + e.message, 'err'); }
  }

  // ── ACCIONES ─────────────────────────────────────────────────────────────────
  async function accion(encId, nuevoEstado) {
    try {
      const patch = { estado_seguimiento: nuevoEstado, ultimo_contacto: new Date().toISOString() };
      if (nuevoEstado === 'contactado') {
        // Leer fase actual para calcular próximo aviso
        const enc = await api(`/encuestas?id=eq.${encId}&select=fase`).then(r => r?.[0]).catch(() => null);
        const faseActual = enc?.fase || 0;
        const nuevaFase = faseActual + 1;
        patch.fase = nuevaFase;
        if (nuevaFase <= 3) {
          patch.proximo_aviso = new Date(Date.now() + _proximoAvisoMs(faseActual)).toISOString();
        } else {
          patch.estado_seguimiento = 'archivado';
          patch.proximo_aviso = null;
        }
      } else if (nuevoEstado === 'no_contactado') {
        patch.proximo_aviso = new Date(Date.now() + 2 * 3600000).toISOString(); // 2h
      } else if (nuevoEstado === 'archivado') {
        patch.proximo_aviso = null;
      }
      await api(`/encuestas?id=eq.${encId}`, 'PATCH', patch);
      const msgs = { contactado: 'Marcado como contactado ✓', no_contactado: 'Marcado "No contestó" — vuelve en 2h', archivado: 'Archivado ✓' };
      toast(msgs[nuevoEstado] || 'Guardado ✓');
      _dispatchTab();
    } catch(e) { toast('Error: ' + e.message, 'err'); }
  }

  async function accionConMotivo(encId, nuevoEstado) {
    const motivo = prompt('¿Motivo de no contacto? (opcional)') ?? '';
    try {
      const patch = { estado_seguimiento: nuevoEstado, ultimo_contacto: new Date().toISOString(), motivo: motivo || null };
      if (nuevoEstado === 'no_contactado') patch.proximo_aviso = new Date(Date.now() + 2 * 3600000).toISOString();
      await api(`/encuestas?id=eq.${encId}`, 'PATCH', patch);
      // Advertencia en orden
      const enc = await api(`/encuestas?id=eq.${encId}&select=orden_id`).then(r => r?.[0]).catch(() => null);
      if (enc?.orden_id) await api(`/ordenes?id=eq.${enc.orden_id}`, 'PATCH', { alerta_no_contacto: motivo || 'No contestó' }).catch(() => {});
      toast('Marcado "No contestó" — vuelve en 2h ⚠');
      _dispatchTab();
    } catch(e) { toast('Error: ' + e.message, 'err'); }
  }

  function _actualizarBell(count) {
    const btn = document.getElementById('enc-notif-btn');
    const cnt = document.getElementById('enc-notif-count');
    if (!btn) return;
    btn.style.display = count > 0 ? 'block' : 'none';
    if (cnt) cnt.textContent = count;
  }

  function verNotificaciones() { switchTab('pendientes'); }

  async function noContesta(ordenId) {
    // Legacy: buscar encuesta por orden_id
    const enc = await api(`/encuestas?orden_id=eq.${ordenId}&select=id`).then(r => r?.[0]).catch(() => null);
    if (enc) { await accionConMotivo(enc.id, 'no_contactado'); return; }
    try {
      await api('/encuestas', 'POST', { orden_id: ordenId, estado: 'no_contesta', estado_seguimiento: 'no_contactado', proximo_aviso: new Date(Date.now() + 2 * 3600000).toISOString(), fase: 0, registrado_por: sesion?.id || null }, { Prefer: 'resolution=merge-duplicates' });
      toast('Marcada como "no contestó" — vuelve en 2h');
      cargarPendientes();
    } catch (e) { console.error('[Encuestas.noContesta]', e); toast('Error: ' + e.message, 'err'); }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PESTAÑA: RESEÑAS / SEGUIMIENTO (órdenes cerradas)
  // Lista las órdenes ENTREGADAS y, según el tiempo desde la entrega, muestra
  // los recordatorios (48 h → llamar; 2 semanas → segundo contacto). Permite
  // registrar el contacto y marcar la orden como gestionada. Mide el tiempo
  // promedio hasta el primer contacto. Los recordatorios se calculan al abrir.
  // ═══════════════════════════════════════════════════════════════════════════
  function _parseSeg(v) {
    let s = {};
    try { s = typeof v === 'string' ? JSON.parse(v) : (v || {}); } catch { s = {}; }
    return {
      estado: s.estado || 'pendiente',
      contactos: Array.isArray(s.contactos) ? s.contactos : [],
      resena_enviada_en: s.resena_enviada_en || null,
      gestionada_en: s.gestionada_en || null,
      gestionada_por: s.gestionada_por || null
    };
  }
  function _segWa(tel) {
    let t = String(tel || '').replace(/\D/g, '');
    if (!t) return null;
    if (t.length === 10) t = '57' + t;
    return 'https://wa.me/' + t;
  }
  const _segBadge = (bg, color, txt) => `<span style="display:inline-block;font-size:11px;font-weight:700;padding:3px 9px;border-radius:99px;background:${bg};color:${color}">${txt}</span>`;

  async function cargarSeguimiento() {
    const panel = document.getElementById('enc-panel');
    if (!panel) return;
    panel.innerHTML = '<div class="loading-state">Cargando...</div>';
    const ordenes = await _safe(api('/ordenes?estado=eq.Entregada&select=id,numero_ot,placa,propietario,marca,linea,telefono,entregada_en,seguimiento_resena&order=entregada_en.desc'), 'cargarSeguimiento') || [];

    const ahora = Date.now();
    const H48 = 48, H2SEM = 24 * 14;
    let nGest = 0, nDue = 0;
    const tiempos = [];

    const items = ordenes.map(o => {
      const seg = _parseSeg(o.seguimiento_resena);
      const horas = o.entregada_en ? (ahora - new Date(o.entregada_en).getTime()) / 3600000 : 0;
      const nContactos = seg.contactos.length;
      const gestionada = seg.estado === 'gestionada';
      const due48 = !gestionada && horas >= H48 && nContactos === 0;
      const due2sem = !gestionada && horas >= H2SEM && nContactos < 2;
      if (gestionada) nGest++;
      if (due48 || due2sem) nDue++;
      if (nContactos && o.entregada_en) {
        const primero = Math.min(...seg.contactos.map(c => new Date(c.en).getTime()));
        tiempos.push((primero - new Date(o.entregada_en).getTime()) / 3600000);
      }
      return { o, seg, horas, nContactos, gestionada, due48, due2sem };
    });

    const promH = tiempos.length ? tiempos.reduce((a, b) => a + b, 0) / tiempos.length : null;
    const promTxt = promH == null ? '—' : (promH < 48 ? `${Math.round(promH)} h` : `${(promH / 24).toFixed(1)} d`);
    const mc = (num, lbl, color) => `<div style="flex:1;min-width:90px;background:var(--gris-bg,#F8FAFC);border:1px solid var(--gris-borde);border-radius:10px;padding:10px 12px;text-align:center"><div style="font-size:22px;font-weight:800;${color ? 'color:' + color : ''}">${num}</div><div style="font-size:11px;color:var(--gris-mid);margin-top:2px">${lbl}</div></div>`;
    const metricas = `<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:16px">
      ${mc(ordenes.length, 'Cerradas')}
      ${mc(nGest, 'Gestionadas', '#059669')}
      ${mc(nDue, 'Por contactar', nDue ? '#DC2626' : '#6B7280')}
      ${mc(promTxt, 'Prom. 1er contacto', '#2563EB')}
    </div>`;

    // Botón para ver TODAS las reseñas en Google (abre la ficha del negocio).
    const _verUrl = (typeof RESENA_GOOGLE_URL !== 'undefined' && RESENA_GOOGLE_URL) ? RESENA_GOOGLE_URL.replace(/\/review\/?$/, '') : '';
    const verGoogleBtn = _verUrl ? `<div style="margin-bottom:14px"><a href="${_verUrl}" target="_blank" rel="noopener" style="display:inline-flex;align-items:center;gap:7px;background:#4285F4;color:#fff;padding:9px 16px;border-radius:8px;font-size:13px;font-weight:700;text-decoration:none">⭐ Ver nuestras reseñas en Google →</a></div>` : '';

    if (!ordenes.length) {
      panel.innerHTML = verGoogleBtn + metricas + `<div class="empty-state" style="padding:30px;text-align:center;color:var(--gris-mid)">No hay órdenes cerradas todavía.</div>`;
      return;
    }

    const cards = items.map(({ o, seg, nContactos, gestionada, due48, due2sem }) => {
      const wa = _segWa(o.telefono);
      const dias = _dias(o.entregada_en);
      const diasTxt = dias == null ? '' : (dias === 0 ? 'hoy' : `hace ${dias} día${dias === 1 ? '' : 's'}`);
      let badge;
      if (gestionada) badge = _segBadge('#E6F5EF', '#059669', '✓ Gestionada');
      else if (due2sem) badge = _segBadge('#FEE2E2', '#DC2626', '📅 +2 semanas · segundo contacto');
      else if (due48) badge = _segBadge('#FEF3C7', '#92400E', '⏰ +48 h · llama al cliente');
      else if (nContactos) badge = _segBadge('#EFF6FF', '#2563EB', `${nContactos} contacto${nContactos === 1 ? '' : 's'}`);
      else badge = _segBadge('#F4F6F9', '#6B7280', 'Reciente');
      const hist = seg.contactos.length
        ? `<div style="margin-top:8px;display:flex;flex-direction:column;gap:3px">${seg.contactos.map(c => `<div style="font-size:11.5px;color:var(--gris-mid)">📞 ${formatTS(c.en)} · ${escapeHtml(c.por || '—')}${c.nota ? ' — ' + escapeHtml(c.nota) : ''}</div>`).join('')}</div>`
        : '';
      return `<div class="enc-card">
        <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px;flex-wrap:wrap">
          <div style="min-width:0">
            <div style="font-weight:700;color:var(--texto)">${escapeHtml(o.placa || '—')}
              <span style="font-weight:500;color:var(--gris-mid);font-size:13px">· ${escapeHtml(o.marca || '')} ${escapeHtml(o.linea || '')}</span>
            </div>
            <div style="font-size:12px;color:var(--gris-mid);margin-top:2px">${escapeHtml(o.propietario || 'Sin propietario')} · ${escapeHtml(otDe(o))} · Entregada ${formatFecha(o.entregada_en)} ${diasTxt ? `<b>(${diasTxt})</b>` : ''}</div>
            <div style="margin-top:6px">${badge}${seg.resena_enviada_en ? ` <span style="font-size:10px;color:#059669;font-weight:600">· ✅ reseña enviada</span>` : ''}</div>
            ${hist}
          </div>
          <div style="display:flex;gap:6px;flex-wrap:wrap;flex-shrink:0">
            <button class="btn-sm" style="background:#7C3AED;color:white;border:none;padding:8px 12px;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer" onclick="Encuestas.pedirResena(${o.id})">⭐ Pedir reseña</button>
            ${wa ? `<a href="${wa}" target="_blank" rel="noopener" class="btn-sm" style="background:#25D366;color:white;border:none;padding:8px 12px;border-radius:8px;font-size:13px;font-weight:600;text-decoration:none">💬 WhatsApp</a>` : ''}
            ${!gestionada ? `<button class="btn-sm" style="background:var(--azul);color:white;border:none;padding:8px 12px;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer" onclick="Encuestas.registrarContacto(${o.id})">Registrar contacto</button>` : ''}
            ${!gestionada ? `<button class="btn-sm" style="background:#F4F6F9;color:var(--gris-mid);border:1.5px solid var(--gris-borde);padding:8px 12px;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer" onclick="Encuestas.marcarGestionada(${o.id})">Marcar gestionada</button>` : ''}
          </div>
        </div>
      </div>`;
    }).join('');

    panel.innerHTML = verGoogleBtn + metricas + cards;
  }

  async function registrarContacto(ordenId) {
    const nota = (typeof prompt === 'function') ? (prompt('Nota del contacto (opcional): ¿qué dijo el cliente?') || '') : '';
    try {
      const o = await api(`/ordenes?id=eq.${ordenId}&select=seguimiento_resena`).then(r => r?.[0]);
      const seg = _parseSeg(o?.seguimiento_resena);
      seg.contactos.push({ en: new Date().toISOString(), por: sesion?.nombre || '—', nota: (nota || '').trim() || null });
      await api(`/ordenes?id=eq.${ordenId}`, 'PATCH', { seguimiento_resena: seg });
      toast('Contacto registrado ✓');
      cargarSeguimiento();
    } catch (e) {
      console.error('[Encuestas.registrarContacto]', e);
      toast('No se pudo guardar (¿falta correr el SQL de seguimiento_resena?)', 'err');
    }
  }

  async function marcarGestionada(ordenId) {
    try {
      const o = await api(`/ordenes?id=eq.${ordenId}&select=seguimiento_resena`).then(r => r?.[0]);
      const seg = _parseSeg(o?.seguimiento_resena);
      seg.estado = 'gestionada';
      seg.gestionada_en = new Date().toISOString();
      seg.gestionada_por = sesion?.nombre || '—';
      await api(`/ordenes?id=eq.${ordenId}`, 'PATCH', { seguimiento_resena: seg });
      toast('Marcada como gestionada ✓');
      cargarSeguimiento();
    } catch (e) {
      console.error('[Encuestas.marcarGestionada]', e);
      toast('No se pudo guardar (¿falta correr el SQL de seguimiento_resena?)', 'err');
    }
  }

  // Abre WhatsApp (el normal, sin n8n) con el mensaje + link de reseña de Google
  // ya escritos, y marca la reseña como enviada en el seguimiento.
  async function pedirResena(ordenId) {
    const link = (typeof RESENA_GOOGLE_URL !== 'undefined' && RESENA_GOOGLE_URL) ? RESENA_GOOGLE_URL : '';
    if (!link) { toast('Falta el link de reseña de Google en config.js (RESENA_GOOGLE_URL)', 'err'); return; }
    let o;
    try { o = await api(`/ordenes?id=eq.${ordenId}&select=telefono,propietario,seguimiento_resena`).then(r => r?.[0]); } catch (e) { o = null; }
    if (!o) { toast('No se encontró la orden', 'err'); return; }
    const n = (o.propietario || '').trim().split(/\s+/)[0] || '';
    const nombre = n ? n.charAt(0).toUpperCase() + n.slice(1).toLowerCase() : 'estimado cliente';
    const msg = `¡Hola ${nombre}! 🚗✨ Gracias por confiar en Freimanautos. Si quedaste contento con el servicio, ¿nos regalas una reseña en Google? Solo toca aquí 👉 ${link}\n\n¡Nos ayuda muchísimo! 🙏`;
    const base = _segWa(o.telefono); // https://wa.me/57...  (o null si no hay teléfono)
    const url = (base ? base : 'https://wa.me/') + '?text=' + encodeURIComponent(msg);
    window.open(url, '_blank');
    const seg = _parseSeg(o.seguimiento_resena);
    if (!seg.resena_enviada_en) {
      seg.resena_enviada_en = new Date().toISOString();
      await api(`/ordenes?id=eq.${ordenId}`, 'PATCH', { seguimiento_resena: seg }).catch(() => {});
    }
    toast('Abriendo WhatsApp con la reseña ✓');
    cargarSeguimiento();
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // FORMULARIO DE CAPTURA (modal accesible)
  // ═══════════════════════════════════════════════════════════════════════════
  async function abrir(ordenId, encId) {
    cerrarModal();

    const [ordRes, clienteRes] = await Promise.all([
      _safe(api(`/ordenes?id=eq.${ordenId}&select=id,numero_ot,estado,placa,propietario,marca,linea,cliente_id,asesor_id,entregada_en,telefono`), 'abrir.orden'),
      encId ? Promise.resolve(null) : Promise.resolve(null)
    ]);
    const orden = ordRes?.[0];
    if (!orden) { toast('No se pudo cargar la orden', 'err'); return; }

    // Cargar datos del cliente si existe
    let cliente = null;
    if (orden.cliente_id) {
      cliente = await _safe(api(`/clientes?id=eq.${orden.cliente_id}&select=id,nombre,telefono,email,documento`), 'abrir.cliente').then(r => r?.[0]).catch(() => null);
    }

    const tel = cliente?.telefono || orden.telefono || '';
    const email = cliente?.email || '';
    const wa = tel ? 'https://wa.me/' + String(tel).replace(/\D/g,'').replace(/^(\d{10})$/, '57$1') : '';

    const asesores = _state.mecanicos.filter(m => m.es_asesor);
    const jefeNombre = _state.jefe?.nombre || 'Jefe de taller';
    const opAsesores = asesores.map(m => `<option value="${m.id}">${escapeHtml(m.nombre)}</option>`).join('') +
      `<option value="jefe">${escapeHtml(jefeNombre)} (jefe)</option>`;

    const _inputDato = (id, lbl, val, type) => `
      <div style="display:flex;flex-direction:column;gap:3px">
        <label for="${id}" style="font-size:10px;text-transform:uppercase;letter-spacing:.05em;color:var(--gris-mid);font-weight:700">${lbl}</label>
        <input id="${id}" type="${type||'text'}" value="${escapeHtml(val||'')}" style="font-size:13px;font-weight:600;color:var(--texto);background:white;border:1.5px solid var(--gris-borde);border-radius:7px;padding:5px 9px;width:100%;box-sizing:border-box" />
      </div>`;
    const _dato = (lbl, val) => val ? `
      <div style="display:flex;flex-direction:column;gap:1px">
        <span style="font-size:10px;text-transform:uppercase;letter-spacing:.05em;color:var(--gris-mid);font-weight:700">${lbl}</span>
        <span style="font-size:13px;font-weight:600;color:var(--texto)">${escapeHtml(val)}</span>
      </div>` : '';

    const m = document.createElement('div');
    m.className = 'modal-overlay';
    m.id = 'modal-encuesta';
    m.setAttribute('role', 'dialog');
    m.setAttribute('aria-modal', 'true');
    m.setAttribute('aria-labelledby', 'enc-modal-title');
    m.style.cssText = 'display:flex;align-items:flex-start;justify-content:center;padding:24px 12px;overflow-y:auto';
    m.innerHTML = `
      <div class="modal" style="max-width:560px;width:100%;max-height:none">
        <div class="modal-header" style="display:flex;align-items:center;justify-content:space-between">
          <div>
            <div id="enc-modal-title" style="font-size:16px;font-weight:800;color:var(--texto)">Encuesta · ${escapeHtml(orden.placa || '')}</div>
            <div style="font-size:12px;color:var(--gris-mid)">${escapeHtml(otDe(orden))} · Entregada ${formatFecha(orden.entregada_en)}</div>
          </div>
          <button onclick="Encuestas.cerrarModal()" aria-label="Cerrar" style="background:none;border:none;font-size:22px;color:var(--gris-mid);cursor:pointer;line-height:1">×</button>
        </div>
        <div class="modal-body" style="padding:16px 18px">

          <!-- DATOS DEL CLIENTE / VEHÍCULO (editables) -->
          <div style="background:#F8FAFC;border:1.5px solid var(--gris-borde);border-radius:10px;padding:14px 16px;margin-bottom:16px">
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px">
              ${_inputDato('enc-cli-nombre', 'Propietario', orden.propietario || cliente?.nombre || '')}
              ${_inputDato('enc-cli-tel', 'Teléfono', tel, 'tel')}
              ${_inputDato('enc-cli-email', 'Correo', email, 'email')}
              ${_dato('Vehículo', [orden.marca, orden.linea].filter(Boolean).join(' '))}
              ${_dato('Placa', orden.placa)}
            </div>
            <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">
              <button onclick="Encuestas._guardarDatosCliente(${ordenId},${orden.cliente_id||'null'})" style="background:#1D4ED8;color:white;border:none;padding:7px 14px;border-radius:8px;font-size:12px;font-weight:700;cursor:pointer">💾 Guardar datos</button>
              <span id="enc-cli-msg" style="font-size:12px;color:#059669;display:none">Guardado ✓</span>
              <span style="flex:1"></span>
              <a id="enc-wa-link" href="${wa ? wa + '?text=' : '#'}" target="_blank" rel="noopener" style="display:${wa?'inline-flex':'none'};align-items:center;gap:6px;background:#25D366;color:white;padding:7px 14px;border-radius:8px;font-size:12px;font-weight:700;text-decoration:none">💬 WhatsApp</a>
              <a id="enc-tel-link" href="${tel ? 'tel:'+tel : '#'}" style="display:${tel?'inline-flex':'none'};align-items:center;gap:6px;background:#EFF6FF;color:#1D4ED8;padding:7px 14px;border-radius:8px;font-size:12px;font-weight:700;text-decoration:none;border:1.5px solid #BFDBFE">📞 Llamar</a>
            </div>
          </div>

          <!-- Acción rápida sin llenar encuesta -->
          <div style="display:flex;gap:8px;margin-bottom:16px;flex-wrap:wrap">
            <button onclick="Encuestas._accionRapida(${encId || 'null'},'no_contactado')" style="flex:1;background:#FEF3C7;color:#B45309;border:1.5px solid #FDE68A;padding:8px 12px;border-radius:8px;font-size:12px;font-weight:600;cursor:pointer">📵 No contestó</button>
            <button onclick="Encuestas._accionRapida(${encId || 'null'},'archivado')" style="flex:1;background:#F4F6F9;color:var(--gris-mid);border:1.5px solid var(--gris-borde);padding:8px 12px;border-radius:8px;font-size:12px;font-weight:600;cursor:pointer">🗄 Archivar sin encuesta</button>
          </div>

          <div style="height:1px;background:var(--gris-borde);margin-bottom:16px"></div>

          <!-- Asesor que atendió -->
          <div class="enc-field">
            <label class="enc-field-lbl" for="enc-asesor">Asesor que atendió</label>
            <select id="enc-asesor" style="width:100%;padding:8px 10px;border:1.5px solid var(--gris-borde);border-radius:8px">
              <option value="">— Seleccionar —</option>${opAsesores}
            </select>
          </div>

          <!-- BLOQUE INICIAL -->
          <div class="enc-sec-title">Calificaciones del servicio</div>
          <div class="enc-field">
            <div class="enc-field-lbl">¿Cómo le fue con el servicio?<span class="enc-field-hint">1 malo · 5 excelente</span></div>
            ${seg15('enc-general', 'Calificación del servicio, 1 a 5')}
          </div>
          <div class="enc-field">
            <div class="enc-field-lbl">¿Cómo califica la atención del asesor?</div>
            ${seg15('enc-asesor-calif', 'Calificación del asesor, 1 a 5')}
          </div>
          <div class="enc-field">
            <div class="enc-field-lbl">¿Cómo califica la atención del jefe de taller?</div>
            ${seg15('enc-jefe-calif', 'Calificación del jefe de taller, 1 a 5')}
          </div>

          <!-- GATE -->
          <div class="enc-field" style="background:#F4F6F9;border-radius:10px;padding:12px 14px">
            <div class="enc-field-lbl" style="margin-bottom:9px">¿El cliente quedó conforme para continuar la encuesta?</div>
            <div style="display:flex;gap:8px;flex-wrap:wrap">
              <button type="button" id="enc-gate-si" class="enc-seg-btn" aria-pressed="false" onclick="Encuestas.gate(true)">Sí, continuar</button>
              <button type="button" id="enc-gate-no" class="enc-seg-btn act-queja" aria-pressed="false" onclick="Encuestas.gate(false)">Cerrar aquí</button>
            </div>
          </div>

          <!-- BLOQUE AMPLIADO -->
          <div id="enc-ampliado" style="display:none">
            <div class="enc-sec-title">Preguntas adicionales</div>
            <div class="enc-field">
              <div class="enc-field-lbl">¿Cómo califica las instalaciones?</div>
              ${seg15('enc-instalaciones', 'Calificación de instalaciones, 1 a 5')}
            </div>
            <div class="enc-field">
              <div class="enc-field-lbl">¿Se cumplió con la fecha de entrega?</div>
              ${segSiNo('enc-cumplio', '¿Se cumplió la fecha de entrega?')}
            </div>
            <div class="enc-field">
              <div class="enc-field-lbl">¿Cómo califica la limpieza/entrega del vehículo?</div>
              ${seg15('enc-limpieza', 'Calificación de limpieza, 1 a 5')}
            </div>
            <div class="enc-field">
              <div class="enc-field-lbl">¿Recomendaría el taller?</div>
              ${segSiNo('enc-recomendaria', '¿Recomendaría el taller?')}
            </div>

            <!-- RESEÑA GOOGLE (solo si conforme) -->
            ${wa ? `<div style="background:#F0FDF4;border:1.5px solid #A7F3D0;border-radius:10px;padding:12px 14px;margin-top:8px">
              <div style="font-size:12px;font-weight:700;color:#059669;margin-bottom:8px">⭐ Pedir reseña en Google</div>
              <div style="font-size:12px;color:var(--gris-mid);margin-bottom:8px">El cliente está conforme. Puedes enviarle el link por WhatsApp ahora.</div>
              <a href="${wa}?text=${encodeURIComponent('¡Hola ' + (orden.propietario||'').trim().split(' ')[0] + '! 🚗✨ Gracias por confiar en Freimanautos. Si quedaste contento con el servicio, ¿nos regalas una reseña en Google? Solo toca aquí 👉 https://g.page/r/CVJ2CEaGL_XyEBM/review\n\n¡Nos ayuda muchísimo! 🙏')}" target="_blank" rel="noopener" style="display:inline-flex;align-items:center;gap:6px;background:#25D366;color:white;padding:8px 16px;border-radius:8px;font-size:13px;font-weight:700;text-decoration:none">💬 Enviar link de reseña por WhatsApp</a>
            </div>` : ''}
          </div>

          <!-- ¿CÓMO SE ENTERÓ? -->
          <div class="enc-field" style="margin-top:18px">
            <label class="enc-field-lbl" for="enc-origen">¿Cómo se enteró de nosotros?</label>
            <select id="enc-origen" style="width:100%;padding:9px 11px;border:1.5px solid var(--gris-borde);border-radius:8px">${typeof origenOptionsHtml === 'function' ? origenOptionsHtml('') : ''}</select>
          </div>

          <!-- COMENTARIOS -->
          <div class="enc-field" style="margin-top:18px">
            <label class="enc-field-lbl" for="enc-comentarios">Observaciones / comentarios</label>
            <textarea id="enc-comentarios" rows="3" style="width:100%;padding:9px 11px;border:1.5px solid var(--gris-borde);border-radius:8px;resize:vertical" placeholder="El cliente opina que ..."></textarea>
          </div>

          <div style="display:flex;gap:10px;justify-content:flex-end;margin-top:8px">
            <button onclick="Encuestas.cerrarModal()" style="background:#F4F6F9;color:var(--gris-mid);border:1.5px solid var(--gris-borde);padding:10px 16px;border-radius:8px;font-weight:600;cursor:pointer">Cancelar</button>
            <button id="enc-guardar-btn" onclick="Encuestas.guardar(${ordenId}, ${orden.cliente_id || 'null'}, ${encId || 'null'})" style="background:var(--azul);color:white;border:none;padding:10px 20px;border-radius:8px;font-weight:700;cursor:pointer">Guardar encuesta</button>
          </div>
        </div>
      </div>`;
    document.body.appendChild(m);

    _state.modalKeyHandler = (ev) => { if (ev.key === 'Escape') cerrarModal(); };
    document.addEventListener('keydown', _state.modalKeyHandler);
    if (orden.asesor_id) { const s = document.getElementById('enc-asesor'); if (s) s.value = orden.asesor_id; }
    setTimeout(() => document.getElementById('enc-asesor')?.focus(), 50);
  }

  async function _guardarDatosCliente(ordenId, clienteId) {
    const nombre = document.getElementById('enc-cli-nombre')?.value.trim() || '';
    const tel    = document.getElementById('enc-cli-tel')?.value.trim() || '';
    const email  = document.getElementById('enc-cli-email')?.value.trim() || '';
    try {
      // Actualizar orden (propietario + teléfono)
      const patchOrden = {};
      if (nombre) patchOrden.propietario = nombre;
      if (tel)    patchOrden.telefono    = tel;
      if (Object.keys(patchOrden).length) await api(`/ordenes?id=eq.${ordenId}`, 'PATCH', patchOrden);
      // Actualizar cliente si existe
      if (clienteId) {
        const patchCli = {};
        if (nombre) patchCli.nombre = nombre;
        if (tel)    patchCli.telefono = tel;
        if (email)  patchCli.email   = email;
        if (Object.keys(patchCli).length) await api(`/clientes?id=eq.${clienteId}`, 'PATCH', patchCli);
      }
      // Actualizar los links de WhatsApp/llamar en el modal sin cerrarlo
      const telLimpio = tel.replace(/\D/g,'');
      const waNum = telLimpio.length === 10 ? '57' + telLimpio : telLimpio;
      const waLink = document.getElementById('enc-wa-link');
      const telLink = document.getElementById('enc-tel-link');
      if (waLink && tel) { waLink.href = `https://wa.me/${waNum}?text=`; waLink.style.display = 'inline-flex'; }
      if (telLink && tel) { telLink.href = `tel:${tel}`; telLink.style.display = 'inline-flex'; }
      const msg = document.getElementById('enc-cli-msg');
      if (msg) { msg.style.display = 'inline'; setTimeout(() => { msg.style.display = 'none'; }, 2500); }
    } catch(e) { toast('Error al guardar: ' + e.message, 'err'); }
  }

  async function _accionRapida(encId, estado) {
    if (!encId) { cerrarModal(); return; }
    cerrarModal();
    if (estado === 'no_contactado') await accionConMotivo(encId, 'no_contactado');
    else await accion(encId, estado);
  }

  function cerrarModal() {
    if (_state.modalKeyHandler) { document.removeEventListener('keydown', _state.modalKeyHandler); _state.modalKeyHandler = null; }
    document.getElementById('modal-encuesta')?.remove();
    _state.continuada = null;
  }

  // Gate: muestra/oculta el bloque ampliado y marca conforme/molesto.
  function gate(continuar) {
    _state.continuada = continuar;
    const amp = document.getElementById('enc-ampliado');
    if (amp) amp.style.display = continuar ? 'block' : 'none';
    const si = document.getElementById('enc-gate-si');
    const no = document.getElementById('enc-gate-no');
    if (si) { si.classList.toggle('active', continuar); si.setAttribute('aria-pressed', continuar ? 'true' : 'false'); }
    if (no) { no.classList.toggle('active', !continuar); no.setAttribute('aria-pressed', !continuar ? 'true' : 'false'); }
  }

  /**
   * Guarda la encuesta y los eventos de calificación por mecánico.
   * @param {number} ordenId   id de la orden encuestada
   * @param {number|null} clienteId  id del cliente (puede ser null)
   */
  async function guardar(ordenId, clienteId, encId) {
    const general = segVal('enc-general');
    const cAsesor = segVal('enc-asesor-calif');
    const cJefe = segVal('enc-jefe-calif');
    if (!general || !cAsesor || !cJefe) { toast('Responde las 3 preguntas iniciales', 'err'); return; }
    if (_state.continuada === null) { toast('Indica si el cliente quedó conforme para continuar', 'err'); return; }

    const siNo = id => { const v = segVal(id); return v == null ? null : v === 'si'; };
    const num = id => { const v = segVal(id); return v == null ? null : Number(v); };
    const cont = _state.continuada;

    // Asesor: el value es un id de operario o "jefe" (no operario → se guarda por nombre).
    const asesorVal = document.getElementById('enc-asesor')?.value || '';
    const asesorId = (asesorVal && asesorVal !== 'jefe') ? Number(asesorVal) : null;
    const asesorNombre = asesorVal === 'jefe'
      ? (_state.jefe?.nombre || 'Jefe de taller')
      : (_state.mecanicos.find(m => Number(m.id) === asesorId)?.nombre || null);

    const body = {
      orden_id: ordenId,
      cliente_id: clienteId || null,
      asesor_id: asesorId,
      asesor_nombre: asesorNombre,
      estado: 'completada',
      continuada: cont,
      cliente_molesto: cont === false,
      fecha_llamada: new Date().toISOString(),
      satisfaccion_general: Number(general),
      calif_asesor: Number(cAsesor),
      calif_jefe: Number(cJefe),
      calif_instalaciones: cont ? num('enc-instalaciones') : null,
      cumplio_fecha: cont ? siNo('enc-cumplio') : null,
      calif_limpieza: cont ? num('enc-limpieza') : null,
      recomendaria: cont ? siNo('enc-recomendaria') : null,
      comentarios: document.getElementById('enc-comentarios')?.value.trim() || null,
      origen: document.getElementById('enc-origen')?.value || null,
      registrado_por: sesion?.id || null
    };

    const btn = document.getElementById('enc-guardar-btn');
    if (btn) { btn.disabled = true; btn.textContent = 'Guardando...'; }

    try {
      // upsert por orden_id (si existía un "no_contesta", lo reemplaza)
      const res = await api('/encuestas?select=id', 'POST', body, { Prefer: 'resolution=merge-duplicates,return=representation' });
      const encuestaId = res?.[0]?.id;

      // Marcar la encuesta de seguimiento como archivada (completada)
      const idSeg = encId || encuestaId;
      if (idSeg) {
        await api(`/encuestas?id=eq.${idSeg}`, 'PATCH', {
          estado_seguimiento: 'archivado',
          ultimo_contacto: new Date().toISOString(),
          proximo_aviso: null
        }).catch(() => {});
      }

      // Si la orden aún no tenía origen, rellenarlo con la respuesta de la encuesta.
      const _origenEnc = document.getElementById('enc-origen')?.value || '';
      if (_origenEnc) {
        const _oo = await api(`/ordenes?id=eq.${ordenId}&select=origen`).then(r => r?.[0]).catch(() => null);
        if (_oo && !_oo.origen) await api(`/ordenes?id=eq.${ordenId}`, 'PATCH', { origen: _origenEnc }).catch(() => {});
      }

      toast('Encuesta guardada ✓');
      cerrarModal();
      cargarPendientes();
    } catch (e) {
      console.error('[Encuestas.guardar]', e);
      toast('Error: ' + e.message, 'err');
      if (btn) { btn.disabled = false; btn.textContent = 'Guardar encuesta'; }
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PESTAÑA: RESULTADOS — dashboard de satisfacción
  // ───────────────────────────────────────────────────────────────────────────
  // cargarResultados() solo trae datos (1 vez, cache en _state.resultados);
  // _renderResultados() pinta desde el cache filtrado por período. El filtro de
  // período re-renderiza sin volver a pedir a Supabase.
  // ═══════════════════════════════════════════════════════════════════════════
  async function cargarResultados() {
    const panel = document.getElementById('enc-panel');
    if (!panel) return;
    panel.innerHTML = '<div class="loading-state">Cargando...</div>';

    const [encuestas, items] = await Promise.all([
      _safe(api('/encuestas?estado=eq.completada&order=creado_en.desc'), 'cargarResultados.encuestas'),
      _safe(api('/encuesta_items_mecanico?select=mecanico_id,puntos,resultado,creado_en,orden_id,servicio,comentario'), 'cargarResultados.items')
    ]);
    if (!_state.mecanicos.length) {
      _state.mecanicos = await _safe(api('/mecanicos?select=id,nombre,rol,activo&order=nombre.asc'), 'cargarResultados.mecanicos') || [];
    }
    _state.resultados = { encuestas: encuestas || [], items: items || [] };
    _renderResultados();
  }

  function setPeriodo(p) { _state.periodo = p; _renderResultados(); }

  // ── Helpers de agregación ────────────────────────────────────────────────
  function _cutoff() {
    const now = new Date();
    if (_state.periodo === 'mes') return new Date(now.getFullYear(), now.getMonth(), 1).getTime();
    if (_state.periodo === '90') return now.getTime() - 90 * 86400000;
    return null; // 'todo'
  }
  function _enPeriodo(row) {
    const cut = _cutoff();
    if (cut == null) return true;
    const t = new Date(row.creado_en).getTime();
    return !isNaN(t) && t >= cut;
  }
  function _avg(arr, key) {
    const v = arr.map(e => e[key]).filter(x => x != null);
    return v.length ? v.reduce((a, b) => a + Number(b), 0) / v.length : null;
  }
  function _pct(arr, key) {
    const v = arr.map(e => e[key]).filter(x => x != null);
    return v.length ? Math.round(v.filter(Boolean).length / v.length * 100) : null;
  }

  // ── Helpers de visualización ─────────────────────────────────────────────
  function _barAspecto(label, avg) {
    const col = colorScore(avg);
    const val = avg != null ? avg.toFixed(1) : '—';
    const w = avg != null ? Math.max(3, avg / 5 * 100) : 0;
    return `<div class="enc-bar-row">
      <div class="enc-bar-lbl">${label}</div>
      <div class="enc-bar-track" role="img" aria-label="${escapeHtml(label)}: ${val} de 5"><div class="enc-bar-fill" style="width:${w}%;background:${col}"></div></div>
      <div class="enc-bar-val" style="color:${col}">${val}</div>
    </div>`;
  }
  function _barPct(label, pct) {
    const col = pct == null ? '#6B7280' : pct >= 80 ? '#059669' : pct >= 50 ? '#D97706' : '#DC2626';
    const val = pct != null ? pct + '%' : '—';
    const w = pct != null ? Math.max(3, pct) : 0;
    return `<div class="enc-bar-row">
      <div class="enc-bar-lbl">${label}</div>
      <div class="enc-bar-track" role="img" aria-label="${escapeHtml(label)}: ${val}"><div class="enc-bar-fill" style="width:${w}%;background:${col}"></div></div>
      <div class="enc-bar-val" style="color:${col}">${val}</div>
    </div>`;
  }
  function _distribucionHtml(enc) {
    const counts = [0, 0, 0, 0, 0]; // índice 0 = 1★ ... 4 = 5★
    enc.forEach(e => { const n = e.satisfaccion_general; if (n >= 1 && n <= 5) counts[n - 1]++; });
    const max = Math.max(1, ...counts);
    const colFor = n => n >= 4 ? '#059669' : n <= 2 ? '#DC2626' : '#D97706';
    return [5, 4, 3, 2, 1].map(n => {
      const c = counts[n - 1];
      const w = c ? Math.max(3, c / max * 100) : 0;
      return `<div class="enc-bar-row" style="grid-template-columns:48px 1fr 38px">
        <div class="enc-bar-lbl">${n} ★</div>
        <div class="enc-bar-track"><div class="enc-bar-fill" style="width:${w}%;background:${colFor(n)}"></div></div>
        <div class="enc-bar-val">${c}</div>
      </div>`;
    }).join('');
  }
  function _tendenciaHtml(enc) {
    const MES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
    const porMes = {};
    enc.forEach(e => {
      const d = new Date(e.creado_en);
      if (isNaN(d)) return;
      const k = d.getFullYear() * 12 + d.getMonth();
      (porMes[k] = porMes[k] || []).push(e);
    });
    const keys = Object.keys(porMes).map(Number).sort((a, b) => a - b).slice(-6);
    if (keys.length < 2) return ''; // 1 mes no es tendencia
    const meta = keys.map(k => ({ k, avg: _avg(porMes[k], 'satisfaccion_general'), mes: MES[k % 12] }));
    const barras = meta.map(m => {
      const h = m.avg != null ? Math.max(4, Math.round(m.avg / 5 * 84)) : 0;
      return `<div style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;height:100%">
        <div style="font-size:10px;font-weight:700;font-family:'DM Mono',monospace;color:${colorScore(m.avg)};margin-bottom:3px">${m.avg != null ? m.avg.toFixed(1) : '—'}</div>
        <div style="width:62%;max-width:30px;height:${h}px;background:${colorScore(m.avg)};border-radius:4px 4px 0 0"></div>
      </div>`;
    }).join('');
    const labels = meta.map(m => `<div style="flex:1;text-align:center;font-size:10px;color:var(--gris-mid)">${m.mes}</div>`).join('');
    return `<div style="display:flex;align-items:flex-end;gap:8px;height:100px">${barras}</div>
      <div style="display:flex;gap:8px;margin-top:5px">${labels}</div>`;
  }
  function _rankingHtml(items) {
    const porMec = {};
    items.forEach(it => { (porMec[it.mecanico_id] = porMec[it.mecanico_id] || []).push(it); });
    const ranking = Object.entries(porMec).map(([mid, arr]) => {
      const st = statsMecanico(arr);
      const nombre = _state.mecanicos.find(m => Number(m.id) === Number(mid))?.nombre || `Operario ${mid}`;
      return { mid, nombre, ...st };
    }).filter(r => r.evaluadas > 0)
      .sort((a, b) => (b.promedio ?? -1) - (a.promedio ?? -1));
    if (!ranking.length) return '';
    return `<div class="enc-panel-card">
      <div class="enc-panel-title">Ranking de operarios <span style="text-transform:none;font-weight:400">· promedio últimas ${VENTANA} · clic para ver detalle</span></div>
      <div style="display:grid;grid-template-columns:1fr 64px 70px 56px 50px;gap:8px;padding:0 8px 8px;border-bottom:2px solid var(--gris-borde);font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:var(--gris-mid)">
        <div>Operario</div><div style="text-align:center">Puntaje</div><div style="text-align:center">Tendencia</div><div style="text-align:center">Eval.</div><div style="text-align:center">Quejas</div>
      </div>
      ${ranking.map(r => `
        <div class="enc-rank-row" role="button" tabindex="0" aria-label="Ver detalle de ${escapeHtml(r.nombre)}" onclick="Encuestas.verMecanico('${r.mid}')" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();Encuestas.verMecanico('${r.mid}')}">
          <div style="font-weight:600;font-size:13px;color:var(--texto)">${escapeHtml(r.nombre)}</div>
          <div style="text-align:center;font-weight:800;font-family:'DM Mono',monospace;font-size:15px;color:${colorScore(r.promedio)}">${r.promedio != null ? r.promedio.toFixed(1) : '—'}</div>
          <div style="text-align:center">${tendHtml(r.tendencia)}</div>
          <div style="text-align:center;font-size:13px;color:var(--gris-mid)">${r.evaluadas}</div>
          <div style="text-align:center;font-size:13px;font-weight:700;color:${r.quejas ? '#DC2626' : 'var(--gris-mid)'}">${r.quejas}</div>
        </div>`).join('')}
      <div id="enc-mec-detalle"></div>
    </div>`;
  }

  // Detalle expandible de un operario (toggle) — usa el cache filtrado por período.
  function verMecanico(mid) {
    const cont = document.getElementById('enc-mec-detalle');
    if (!cont) return;
    if (cont.dataset.mid === String(mid)) { cont.innerHTML = ''; cont.dataset.mid = ''; return; }
    cont.dataset.mid = String(mid);
    const items = (_state.resultados?.items || [])
      .filter(it => String(it.mecanico_id) === String(mid) && _enPeriodo(it))
      .sort((a, b) => new Date(b.creado_en) - new Date(a.creado_en))
      .slice(0, 12);
    const nombre = _state.mecanicos.find(m => String(m.id) === String(mid))?.nombre || `Operario ${mid}`;
    const chip = r => {
      const c = { bien: '#059669', regular: '#D97706', queja: '#DC2626', no_aplica: '#6B7280' }[r] || '#6B7280';
      return `<span class="enc-chip" style="background:${c}1a;color:${c}">${RES_LBL[r] || r}</span>`;
    };
    cont.innerHTML = `<div style="margin-top:12px;padding-top:12px;border-top:1.5px dashed var(--gris-borde)">
      <div style="font-size:12px;font-weight:700;color:var(--texto);margin-bottom:8px">Últimas evaluaciones de ${escapeHtml(nombre)}</div>
      ${items.length ? items.map(it => `<div style="display:flex;align-items:center;justify-content:space-between;gap:10px;padding:7px 0;border-bottom:1px solid var(--gris-borde)">
        <div style="min-width:0">
          <div style="font-size:12px;color:var(--gris-mid)">${formatFecha(it.creado_en)} · ${escapeHtml(formatOT(it.orden_id))} · ${SRV_LBL[it.servicio] || it.servicio || ''}</div>
          ${it.comentario ? `<div style="font-size:12px;color:var(--texto);margin-top:1px">${escapeHtml(it.comentario)}</div>` : ''}
        </div>
        ${chip(it.resultado)}
      </div>`).join('') : '<div style="font-size:12px;color:var(--gris-mid)">Sin evaluaciones en el período.</div>'}
    </div>`;
  }

  function _renderResultados() {
    const panel = document.getElementById('enc-panel');
    if (!panel || !_state.resultados) return;

    const periodos = [{ v: 'mes', l: 'Este mes' }, { v: '90', l: '90 días' }, { v: 'todo', l: 'Todo' }];
    const filtroUI = `<div style="display:flex;justify-content:flex-end;margin-bottom:14px">
      <div class="enc-seg" role="group" aria-label="Período del reporte">
        ${periodos.map(p => `<button type="button" class="enc-seg-btn ${_state.periodo === p.v ? 'active' : ''}" aria-pressed="${_state.periodo === p.v}" onclick="Encuestas.setPeriodo('${p.v}')">${p.l}</button>`).join('')}
      </div></div>`;

    if (!_state.resultados.encuestas.length) {
      panel.innerHTML = `<div class="empty-state" style="padding:40px;text-align:center;color:var(--gris-mid)">Aún no hay encuestas completadas.</div>`;
      return;
    }

    const enc = _state.resultados.encuestas.filter(_enPeriodo);
    const items = _state.resultados.items.filter(_enPeriodo);

    if (!enc.length) {
      panel.innerHTML = filtroUI + `<div class="empty-state" style="padding:40px;text-align:center;color:var(--gris-mid)">No hay encuestas en este período.</div>`;
      return;
    }

    const satG = _avg(enc, 'satisfaccion_general');
    const recom = _pct(enc, 'recomendaria');
    const molestos = enc.filter(e => e.cliente_molesto).length;

    const heroKpis = `<div class="enc-dash-grid" style="grid-template-columns:repeat(auto-fit,minmax(150px,1fr))">
      <div class="enc-kpi"><div class="enc-kpi-num">${enc.length}</div><div class="enc-kpi-lbl">Encuestas</div></div>
      <div class="enc-kpi"><div class="enc-kpi-num" style="color:${colorScore(satG)}">${satG != null ? satG.toFixed(1) : '—'}</div><div class="enc-kpi-lbl">Satisfacción</div></div>
      <div class="enc-kpi"><div class="enc-kpi-num">${recom != null ? recom + '%' : '—'}</div><div class="enc-kpi-lbl">Recomienda</div></div>
      <div class="enc-kpi"><div class="enc-kpi-num" style="color:${molestos ? '#DC2626' : 'var(--texto)'}">${molestos}</div><div class="enc-kpi-lbl">Clientes molestos</div></div>
    </div>`;

    const aspectos = `<div class="enc-panel-card">
      <div class="enc-panel-title">Calificación por aspecto</div>
      ${_barAspecto('Servicio', _avg(enc, 'satisfaccion_general'))}
      ${_barAspecto('Asesor', _avg(enc, 'calif_asesor'))}
      ${_barAspecto('Jefe de taller', _avg(enc, 'calif_jefe'))}
      ${_barAspecto('Instalaciones', _avg(enc, 'calif_instalaciones'))}
      ${_barAspecto('Limpieza', _avg(enc, 'calif_limpieza'))}
      ${_barPct('Cumplió fecha', _pct(enc, 'cumplio_fecha'))}
      ${_barPct('Recomendaría', _pct(enc, 'recomendaria'))}
    </div>`;
    const distrib = `<div class="enc-panel-card">
      <div class="enc-panel-title">Distribución del servicio</div>
      ${_distribucionHtml(enc)}
    </div>`;
    const trendInner = _tendenciaHtml(enc);
    const trend = trendInner ? `<div class="enc-panel-card"><div class="enc-panel-title">Tendencia mensual · servicio</div>${trendInner}</div>` : '';

    const conCom = enc.filter(e => e.comentarios);
    const comentarios = `<div class="enc-panel-card" style="margin-bottom:0">
      <div class="enc-panel-title">Comentarios recientes</div>
      ${conCom.length ? conCom.slice(0, 20).map(e => `
        <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px;padding:9px 0;border-bottom:1px solid var(--gris-borde)">
          <div style="flex:1;min-width:0">
            <div style="font-size:11px;color:var(--gris-mid);margin-bottom:2px">${formatFecha(e.creado_en)} · ${escapeHtml(formatOT(e.orden_id))}${e.cliente_molesto ? ' · <span style="color:#DC2626;font-weight:700">cliente molesto</span>' : ''}</div>
            <div style="font-size:13px;color:var(--texto)">${escapeHtml(e.comentarios)}</div>
          </div>
          <div style="font-weight:800;color:${colorScore(e.satisfaccion_general)};font-size:16px;font-family:'DM Mono',monospace;flex-shrink:0">${e.satisfaccion_general ?? '—'}</div>
        </div>`).join('') : '<div style="font-size:12px;color:var(--gris-mid)">Sin comentarios en el período.</div>'}
    </div>`;

    panel.innerHTML = filtroUI + heroKpis +
      `<div class="enc-dash-grid">${aspectos}${distrib}${trend}</div>` +
      _rankingHtml(items) + comentarios;
  }

  // API pública del módulo (lo que usan onclick inline, navJefe y mecanico.js)
  return { montar, switchTab, cargarPendientes, cargarResultados, cargarSeguimiento, registrarContacto, marcarGestionada, pedirResena, setPeriodo, verMecanico, noContesta, abrir, gate, guardar, cerrarModal, segPick, statsMecanico, colorScore, tendHtml, accion, accionConMotivo, eliminarEncuesta, _accionRapida, _guardarDatosCliente, dragStart, dragEnd, dropZone, ptrDown, ptrMove, ptrUp, cardTap, tapZone, abrirEncuestaSeleccionada, verNotificaciones, _drag };
})();
window.Encuestas = Encuestas;
