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
      .enc-tabs{display:flex;gap:0;border-bottom:2px solid var(--gris-borde);margin-bottom:18px}
      .enc-tab-btn{padding:9px 18px;font-size:13px;font-weight:600;color:var(--gris-mid);background:none;border:none;border-bottom:3px solid transparent;margin-bottom:-2px;cursor:pointer;display:flex;align-items:center;gap:6px;transition:color .15s,border-color .15s}
      .enc-tab-btn.active{color:var(--azul);border-bottom-color:var(--azul)}
      .enc-tab-btn:hover:not(.active){color:var(--texto)}
      .enc-card{background:var(--surface);border:1.5px solid var(--gris-borde);border-radius:12px;padding:14px 16px;margin-bottom:10px;box-shadow:0 1px 4px rgba(0,0,0,.04)}
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
      <div style="margin-bottom:16px">
        <div style="font-size:20px;font-weight:800;color:var(--texto);letter-spacing:-.3px">Encuestas de satisfacción</div>
        <div style="font-size:13px;color:var(--gris-mid);margin-top:2px">Llamadas post-entrega · calificación del servicio y de los operarios</div>
      </div>
      <div class="enc-tabs" role="tablist">
        <button class="enc-tab-btn ${_state.tab === 'pendientes' ? 'active' : ''}" role="tab" aria-selected="${_state.tab === 'pendientes'}" onclick="Encuestas.switchTab('pendientes')">Pendientes</button>
        <button class="enc-tab-btn ${_state.tab === 'seguimiento' ? 'active' : ''}" role="tab" aria-selected="${_state.tab === 'seguimiento'}" onclick="Encuestas.switchTab('seguimiento')">Reseñas / Seguimiento</button>
        <button class="enc-tab-btn ${_state.tab === 'resultados' ? 'active' : ''}" role="tab" aria-selected="${_state.tab === 'resultados'}" onclick="Encuestas.switchTab('resultados')">Resultados</button>
      </div>
      <div id="enc-panel"><div class="loading-state">Cargando...</div></div>
    `;
    _dispatchTab();
  }

  function _dispatchTab() {
    if (_state.tab === 'resultados') cargarResultados();
    else if (_state.tab === 'seguimiento') cargarSeguimiento();
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
  async function cargarPendientes() {
    const panel = document.getElementById('enc-panel');
    if (!panel) return;
    panel.innerHTML = '<div class="loading-state">Cargando...</div>';

    const [ordenes, encuestas] = await Promise.all([
      _safe(api('/ordenes?estado=eq.Entregada&select=id,numero_ot,estado,placa,propietario,marca,linea,entregada_en&order=entregada_en.desc'), 'cargarPendientes.ordenes'),
      _safe(api('/encuestas?select=orden_id,estado'), 'cargarPendientes.encuestas')
    ]);

    // Una orden ya está "resuelta" si tiene encuesta completada o rechazada.
    const resueltas = new Set((encuestas || []).filter(e => e.estado === 'completada' || e.estado === 'rechazada').map(e => e.orden_id));
    const pendientes = (ordenes || []).filter(o => !resueltas.has(o.id));

    if (!pendientes.length) {
      panel.innerHTML = `<div class="empty-state" style="padding:40px;text-align:center;color:var(--gris-mid)">No hay órdenes entregadas pendientes de encuestar 🎉</div>`;
      return;
    }

    const puede = tienePermiso('gestionar_encuestas');
    panel.innerHTML = pendientes.map(o => {
      const dias = _dias(o.entregada_en);
      const diasTxt = dias == null ? '' : (dias === 0 ? 'hoy' : `hace ${dias} día${dias === 1 ? '' : 's'}`);
      return `
        <div class="enc-card" style="display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap">
          <div>
            <div style="font-weight:700;color:var(--texto)">${escapeHtml(o.placa || '—')}
              <span style="font-weight:500;color:var(--gris-mid);font-size:13px">· ${escapeHtml(o.marca || '')} ${escapeHtml(o.linea || '')}</span>
            </div>
            <div style="font-size:12px;color:var(--gris-mid);margin-top:2px">
              ${escapeHtml(o.propietario || 'Sin propietario')} · ${escapeHtml(otDe(o))} · Entregada ${formatFecha(o.entregada_en)} ${diasTxt ? `<b>(${diasTxt})</b>` : ''}
            </div>
          </div>
          ${puede ? `<div style="display:flex;gap:8px">
            <button class="btn-sm" style="background:var(--azul);color:white;border:none;padding:8px 14px;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer" onclick="Encuestas.abrir(${o.id})">Registrar encuesta</button>
            <button class="btn-sm" style="background:#F4F6F9;color:var(--gris-mid);border:1.5px solid var(--gris-borde);padding:8px 12px;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer" onclick="Encuestas.noContesta(${o.id})">No contestó</button>
          </div>` : ''}
        </div>`;
    }).join('');
  }

  async function noContesta(ordenId) {
    try {
      await api('/encuestas', 'POST', { orden_id: ordenId, estado: 'no_contesta', fecha_llamada: new Date().toISOString(), registrado_por: sesion?.id || null }, { Prefer: 'resolution=merge-duplicates' });
      toast('Marcada como "no contestó" — sigue pendiente');
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

    if (!ordenes.length) {
      panel.innerHTML = metricas + `<div class="empty-state" style="padding:30px;text-align:center;color:var(--gris-mid)">No hay órdenes cerradas todavía.</div>`;
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
            ${wa ? `<a href="${wa}" target="_blank" rel="noopener" class="btn-sm" style="background:#25D366;color:white;border:none;padding:8px 12px;border-radius:8px;font-size:13px;font-weight:600;text-decoration:none">💬 WhatsApp</a>` : ''}
            ${!gestionada ? `<button class="btn-sm" style="background:var(--azul);color:white;border:none;padding:8px 12px;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer" onclick="Encuestas.registrarContacto(${o.id})">Registrar contacto</button>` : ''}
            ${!gestionada ? `<button class="btn-sm" style="background:#F4F6F9;color:var(--gris-mid);border:1.5px solid var(--gris-borde);padding:8px 12px;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer" onclick="Encuestas.marcarGestionada(${o.id})">Marcar gestionada</button>` : ''}
          </div>
        </div>
      </div>`;
    }).join('');

    panel.innerHTML = metricas + cards;
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

  // ═══════════════════════════════════════════════════════════════════════════
  // FORMULARIO DE CAPTURA (modal accesible)
  // ═══════════════════════════════════════════════════════════════════════════
  async function abrir(ordenId) {
    cerrarModal();

    const [ordRes, etapas] = await Promise.all([
      _safe(api(`/ordenes?id=eq.${ordenId}&select=id,numero_ot,estado,placa,propietario,marca,linea,cliente_id,asesor_id,entregada_en`), 'abrir.orden'),
      _safe(api(`/etapas?orden_id=eq.${ordenId}&select=id,servicio,mecanico_id,tecnico`), 'abrir.etapas')
    ]);
    const orden = ordRes?.[0];
    if (!orden) { toast('No se pudo cargar la orden', 'err'); return; }

    // Mecánicos involucrados: dedupe por (servicio, mecanico_id), solo etapas con responsable.
    const vistos = new Set();
    const mecs = [];
    (etapas || []).forEach(e => {
      if (!e.mecanico_id) return;
      const key = `${e.servicio}|${e.mecanico_id}`;
      if (vistos.has(key)) return;
      vistos.add(key);
      const nombre = e.tecnico || _state.mecanicos.find(m => Number(m.id) === Number(e.mecanico_id))?.nombre || `Operario ${e.mecanico_id}`;
      mecs.push({ etapa_id: e.id, servicio: e.servicio, mecanico_id: e.mecanico_id, nombre });
    });

    // Asesores: operarios con el subrol "asesor" (es_asesor) + el jefe de taller,
    // que también puede atender. El jefe vive en `configuracion`, no como operario,
    // por eso va con value="jefe" y se guarda por nombre.
    const asesores = _state.mecanicos.filter(m => m.es_asesor);
    const jefeNombre = _state.jefe?.nombre || 'Jefe de taller';
    const opAsesores = asesores.map(m => `<option value="${m.id}">${escapeHtml(m.nombre)}</option>`).join('') +
      `<option value="jefe">${escapeHtml(jefeNombre)} (jefe)</option>`;
    const mecResOpts = [
      { v: 'bien', label: 'Bien' }, { v: 'regular', label: 'Regular' },
      { v: 'queja', label: 'Queja' }, { v: 'no_aplica', label: 'No aplica' }
    ];

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
            <div style="font-size:12px;color:var(--gris-mid)">${escapeHtml(orden.propietario || '')} · ${escapeHtml(otDe(orden))} · Entregada ${formatFecha(orden.entregada_en)}</div>
          </div>
          <button onclick="Encuestas.cerrarModal()" aria-label="Cerrar" style="background:none;border:none;font-size:22px;color:var(--gris-mid);cursor:pointer;line-height:1">×</button>
        </div>
        <div class="modal-body" style="padding:16px 18px">

          <!-- Asesor que atendió -->
          <div class="enc-field">
            <label class="enc-field-lbl" for="enc-asesor">Asesor que atendió</label>
            <select id="enc-asesor" style="width:100%;padding:8px 10px;border:1.5px solid var(--gris-borde);border-radius:8px">
              <option value="">— Seleccionar —</option>${opAsesores}
            </select>
          </div>

          <!-- BLOQUE INICIAL -->
          <div class="enc-sec-title">Preguntas iniciales</div>
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
          </div>

          <!-- MECÁNICOS -->
          <div class="enc-sec-title">Calificación de operarios</div>
          ${mecs.length ? `${mecs.map((mc, i) => `
            <div class="enc-mec-row" id="mecrow-${i}" data-etapa="${mc.etapa_id}" data-mecid="${mc.mecanico_id}" data-srv="${mc.servicio}">
              <div>
                <div style="font-weight:600;color:var(--texto);font-size:14px">${escapeHtml(mc.nombre)}</div>
                <div style="font-size:11px;color:var(--gris-mid)">${SRV_LBL[mc.servicio] || mc.servicio || ''}</div>
              </div>
              ${segHtml('mecres-' + i, mecResOpts, 'Resultado del trabajo de ' + mc.nombre)}
            </div>
          `).join('')}` : `<div style="font-size:13px;color:var(--gris-mid)">Esta orden no tiene operarios asignados en sus etapas.</div>`}

          <!-- PREGUNTAS ADICIONALES (texto libre) -->
          <div class="enc-field" style="margin-top:18px">
            <label class="enc-field-lbl" for="enc-comentarios">Preguntas adicionales</label>
            <textarea id="enc-comentarios" rows="3" style="width:100%;padding:9px 11px;border:1.5px solid var(--gris-borde);border-radius:8px;resize:vertical" placeholder="El cliente opina que ..."></textarea>
          </div>

          <div style="display:flex;gap:10px;justify-content:flex-end;margin-top:8px">
            <button onclick="Encuestas.cerrarModal()" style="background:#F4F6F9;color:var(--gris-mid);border:1.5px solid var(--gris-borde);padding:10px 16px;border-radius:8px;font-weight:600;cursor:pointer">Cancelar</button>
            <button id="enc-guardar-btn" onclick="Encuestas.guardar(${ordenId}, ${orden.cliente_id || 'null'})" style="background:var(--azul);color:white;border:none;padding:10px 20px;border-radius:8px;font-weight:700;cursor:pointer">Guardar encuesta</button>
          </div>
        </div>
      </div>`;
    document.body.appendChild(m);

    // Accesibilidad del modal: cierre con Escape, auto-foco y prefill.
    _state.modalKeyHandler = (ev) => { if (ev.key === 'Escape') cerrarModal(); };
    document.addEventListener('keydown', _state.modalKeyHandler);
    if (orden.asesor_id) { const s = document.getElementById('enc-asesor'); if (s) s.value = orden.asesor_id; }
    setTimeout(() => document.getElementById('enc-asesor')?.focus(), 50);
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
  async function guardar(ordenId, clienteId) {
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
      registrado_por: sesion?.id || null
    };

    const btn = document.getElementById('enc-guardar-btn');
    if (btn) { btn.disabled = true; btn.textContent = 'Guardando...'; }

    try {
      // upsert por orden_id (si existía un "no_contesta", lo reemplaza)
      const res = await api('/encuestas?select=id', 'POST', body, { Prefer: 'resolution=merge-duplicates,return=representation' });
      const encuestaId = res?.[0]?.id;

      // Eventos por mecánico
      const items = [];
      document.querySelectorAll('[id^="mecrow-"]').forEach(row => {
        const i = row.id.replace('mecrow-', '');
        const resultado = segVal('mecres-' + i);
        if (!resultado) return;   // sin calificar → se omite
        items.push({
          encuesta_id: encuestaId,
          orden_id: ordenId,
          etapa_id: Number(row.dataset.etapa) || null,
          mecanico_id: Number(row.dataset.mecid),
          servicio: row.dataset.srv || null,
          resultado,
          puntos: PUNTOS[resultado]
        });
      });
      if (encuestaId && items.length) {
        // limpiar items previos de esta encuesta (re-guardado) e insertar
        await api(`/encuesta_items_mecanico?encuesta_id=eq.${encuestaId}`, 'DELETE').catch(e => console.error('[Encuestas.guardar.limpiarItems]', e));
        await api('/encuesta_items_mecanico', 'POST', items, { Prefer: 'return=minimal' });
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
  return { montar, switchTab, cargarPendientes, cargarResultados, cargarSeguimiento, registrarContacto, marcarGestionada, setPeriodo, verMecanico, noContesta, abrir, gate, guardar, cerrarModal, segPick, statsMecanico, colorScore, tendHtml };
})();
window.Encuestas = Encuestas;
