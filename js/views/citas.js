// ═══════════════════════════════════════════════════════════
// CITAS + CALENDARIO — vista unificada con pestañas
// ═══════════════════════════════════════════════════════════

async function montarCitasCalendario() {
  const pag = document.getElementById('pag-citas');
  if (!pag) return;

  pag.innerHTML = `
    <style>
      #cc-shell { display:flex; flex-direction:column; height:100%; overflow:hidden; }
      #cc-tabs {
        display:flex; gap:0; border-bottom:2px solid var(--gris-borde);
        background:var(--surface); padding:0 20px; flex-shrink:0;
      }
      .cc-tab {
        padding:11px 18px; cursor:pointer; font-size:13px; font-weight:600;
        color:var(--gris-mid); border-bottom:2px solid transparent; margin-bottom:-2px;
        background:none; border-top:none; border-left:none; border-right:none;
        transition:color .15s, border-color .15s;
      }
      .cc-tab.active { color:var(--azul); border-bottom-color:var(--azul); }
      .cc-tab:hover:not(.active) { color:var(--texto); }
      #citas-tab-content { flex:1; overflow:auto; }
    </style>
    <div id="cc-shell">
      <div id="cc-tabs">
        <button class="cc-tab active" id="cc-tab-agenda"     onclick="_ccSwitchTab('agenda')">📅 Agenda de citas</button>
        <button class="cc-tab"        id="cc-tab-calendario" onclick="_ccSwitchTab('calendario')">🗓 Calendario mensual</button>
      </div>
      <div id="citas-tab-content"></div>
    </div>`;

  window._ccTabActivo = 'agenda';
  await montarCitas();
}

async function _ccSwitchTab(tab) {
  if (window._ccTabActivo === tab) return;
  window._ccTabActivo = tab;

  document.querySelectorAll('.cc-tab').forEach(t => t.classList.remove('active'));
  const tabEl = document.getElementById('cc-tab-' + tab);
  if (tabEl) tabEl.classList.add('active');

  const cont = document.getElementById('citas-tab-content');
  if (!cont) return;
  cont.innerHTML = '<div class="loading-state" style="padding:40px;text-align:center;color:var(--gris-mid)">Cargando...</div>';

  if (tab === 'agenda') {
    await montarCitas();
  } else {
    if (typeof cargarCalendario === 'function') await cargarCalendario();
  }
}

// ═══════════════════════════════════════════════════════════
// CITAS / AGENDA
// ═══════════════════════════════════════════════════════════

let _citasSemana      = [];
let _citasLunesActual = null; // Date del lunes de la semana visible
let _citaEditandoId   = null; // null = nueva, uuid = editando

// ─── Constantes ──────────────────────────────────────────

const _CITAS_HORAS = (() => {
  const h = [];
  for (let m = 7 * 60; m < 18 * 60; m += 30) {
    const hh = String(Math.floor(m / 60)).padStart(2, '0');
    const mm = String(m % 60).padStart(2, '0');
    h.push(`${hh}:${mm}`);
  }
  return h; // '07:00' … '17:30'
})();

const _CITAS_HORA_LABELS = (() => {
  const h = [];
  for (let hh = 7; hh <= 18; hh++) {
    h.push(`${String(hh).padStart(2, '0')}:00`);
  }
  return h; // etiquetas de fila 07:00 … 18:00 (12 filas)
})();

const _CITAS_DIAS_NOMBRE = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

const _CITAS_TIPO_COLOR = {
  diagnostico:  { bg: '#EFF6FF', border: '#3B82F6', texto: '#1D4ED8', label: 'Diagnóstico'  },
  mantenimiento:{ bg: '#F0FDF4', border: '#22C55E', texto: '#15803D', label: 'Mantenimiento' },
  reparacion:   { bg: '#FFF7ED', border: '#F97316', texto: '#C2410C', label: 'Reparación'   },
  pintura:      { bg: '#FAF5FF', border: '#A855F7', texto: '#7E22CE', label: 'Pintura'       },
  latoneria:    { bg: '#FFF1F2', border: '#F43F5E', texto: '#BE123C', label: 'Latonería'     },
};

const _CITAS_ESTADO_STYLE = {
  pendiente:  { bg: '#EFF6FF', border: '#3B82F6', texto: '#1D4ED8' },
  confirmada: { bg: '#F0FDF4', border: '#22C55E', texto: '#15803D' },
  cancelada:  { bg: '#F3F4F6', border: '#D1D5DB', texto: '#6B7280' },
  completada: { bg: '#F5F3FF', border: '#DDD6FE', texto: '#6B7280' },
};

// ─── Montaje ──────────────────────────────────────────────

async function montarCitas() {
  // Si estamos dentro de la vista unificada, renderizar en el contenedor de tab;
  // de lo contrario, usar la página directa (compatibilidad con llamadas legacy).
  const pag = document.getElementById('citas-tab-content') || document.getElementById('pag-citas');
  if (!pag) return;

  _citasLunesActual = _citasLunesDeHoy();

  pag.innerHTML = `
    <style>
      #citas-wrap { display:flex; flex-direction:column; height:100%; }
      #citas-header {
        display:flex; align-items:center; gap:10px; flex-wrap:wrap;
        padding:16px 20px 12px; border-bottom:1px solid var(--gris-borde);
        background:var(--surface);
      }
      #citas-semana-label {
        font-weight:700; font-size:15px; color:var(--texto); flex:1; min-width:160px;
      }
      .citas-btn-nav {
        background:none; border:1px solid var(--gris-borde); border-radius:7px;
        padding:5px 12px; cursor:pointer; font-size:13px; color:var(--texto);
        transition:background .15s;
      }
      .citas-btn-nav:hover { background:var(--gris-bg); }
      #citas-grid-wrap { flex:1; overflow:auto; }
      #citas-tabla {
        border-collapse:collapse; min-width:700px; width:100%;
        font-size:12px; table-layout:fixed;
      }
      #citas-tabla th {
        background:var(--surface); border:1px solid var(--gris-borde);
        padding:8px 6px; text-align:center; position:sticky; top:0; z-index:5;
        font-size:12px; font-weight:600; color:var(--texto);
      }
      #citas-tabla th.col-hora { width:64px; font-weight:500; color:var(--gris-mid); }
      #citas-tabla td {
        border:1px solid var(--gris-borde); padding:3px 4px; vertical-align:top;
        min-height:52px; cursor:pointer; transition:background .12s;
      }
      #citas-tabla td:hover { background:var(--gris-bg); }
      #citas-tabla td.col-hora-td {
        background:var(--surface); text-align:right; font-size:11px;
        color:var(--gris-mid); padding:4px 8px 4px 4px; cursor:default;
        white-space:nowrap; vertical-align:top; padding-top:6px;
      }
      #citas-tabla td.col-hora-td:hover { background:var(--surface); }
      .cita-chip {
        border-radius:5px; padding:2px 5px; margin-bottom:2px;
        border-left:3px solid; font-size:11px; line-height:1.4;
        cursor:pointer; display:block; overflow:hidden;
        white-space:nowrap; text-overflow:ellipsis;
        transition:opacity .12s;
      }
      .cita-chip:hover { opacity:.82; }
      .cita-chip.cancelada { text-decoration:line-through; opacity:.55; }
      .citas-ocupacion {
        font-size:10px; font-weight:700; border-radius:4px;
        padding:1px 5px; display:inline-block; margin-top:1px;
      }
      .citas-ocupacion.ok    { background:#DCFCE7; color:#15803D; }
      .citas-ocupacion.warn  { background:#FEF9C3; color:#854D0E; }
      .citas-ocupacion.full  { background:#FEE2E2; color:#991B1B; }
      #citas-tabla th .dia-nombre { font-size:13px; font-weight:700; }
      #citas-tabla th .dia-fecha  { font-size:11px; color:var(--gris-mid); font-weight:400; margin-top:1px; }
      #citas-tabla th.hoy-col .dia-nombre {
        background:var(--azul); color:#fff; border-radius:6px;
        padding:2px 8px; display:inline-block;
      }
      .citas-spinner {
        display:flex; align-items:center; justify-content:center;
        padding:40px; color:var(--gris-mid); gap:10px; font-size:14px;
      }
      /* Modal */
      #modal-nueva-cita .modal-box {
        max-width:520px; width:100%; background:var(--surface);
        border-radius:14px; padding:0; overflow:hidden;
        box-shadow:0 20px 60px rgba(0,0,0,.2);
      }
      #modal-nueva-cita .modal-header {
        display:flex; align-items:center; justify-content:space-between;
        padding:16px 20px; border-bottom:1px solid var(--gris-borde);
      }
      #modal-nueva-cita .modal-header h3 { margin:0; font-size:16px; font-weight:700; }
      #modal-nueva-cita .modal-body { padding:20px; overflow-y:auto; max-height:68vh; }
      #modal-nueva-cita .modal-footer {
        padding:14px 20px; border-top:1px solid var(--gris-borde);
        display:flex; gap:8px; justify-content:flex-end; flex-wrap:wrap;
      }
      .citas-form-row { display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-bottom:14px; }
      .citas-form-row.solo { grid-template-columns:1fr; }
      .citas-field label { display:block; font-size:12px; font-weight:600; color:var(--gris-mid); margin-bottom:4px; }
      .citas-field input,
      .citas-field select,
      .citas-field textarea {
        width:100%; box-sizing:border-box; padding:8px 10px;
        border:1px solid var(--gris-borde); border-radius:7px;
        font-size:13px; background:var(--gris-bg); color:var(--texto);
        transition:border-color .15s; outline:none; font-family:inherit;
      }
      .citas-field input:focus,
      .citas-field select:focus,
      .citas-field textarea:focus { border-color:var(--azul); background:var(--surface); }
      .citas-field textarea { resize:vertical; min-height:72px; }
      .citas-aviso-capacidad {
        background:#FEF9C3; border:1px solid #FDE047; border-radius:7px;
        padding:8px 12px; font-size:12px; color:#713F12;
        margin-bottom:14px; display:none;
      }
      .citas-aviso-capacidad.visible { display:block; }
      .citas-estado-btns { display:flex; gap:8px; flex-wrap:wrap; }
    </style>
    <div id="citas-wrap">
      <div id="citas-header">
        <button class="citas-btn-nav" onclick="_citasSemanaAnterior()">&#8592;</button>
        <button class="citas-btn-nav" onclick="_citasSemanaHoy()">Hoy</button>
        <button class="citas-btn-nav" onclick="_citasSemanaSiguiente()">&#8594;</button>
        <span id="citas-semana-label"></span>
        <button class="btn btn-primary btn-sm" onclick="_citasAbrirModal(null, null, null)" style="margin-left:auto">
          + Nueva cita
        </button>
      </div>
      <div id="citas-grid-wrap">
        <div class="citas-spinner">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
            stroke-linecap="round" stroke-linejoin="round" style="animation:spin 1s linear infinite">
            <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
          </svg>
          Cargando agenda…
        </div>
      </div>
    </div>`;

  // Inyectar keyframe spin si no existe
  if (!document.getElementById('citas-spin-style')) {
    const s = document.createElement('style');
    s.id = 'citas-spin-style';
    s.textContent = `@keyframes spin { to { transform:rotate(360deg); } }`;
    document.head.appendChild(s);
  }

  _citasInyectarModal();
  await _citasCargarSemana(_citasLunesActual);
}

// ─── Modal: inyección única ───────────────────────────────

function _citasInyectarModal() {
  if (document.getElementById('modal-nueva-cita')) return;

  const horasOpts = _CITAS_HORAS.map(h => `<option value="${h}">${h}</option>`).join('');

  const m = document.createElement('div');
  m.className  = 'modal-overlay';
  m.id         = 'modal-nueva-cita';
  m.onclick    = e => { if (e.target === m) _citasCerrarModal(); };
  m.innerHTML  = `
    <div class="modal-box">
      <div class="modal-header">
        <h3 id="mcita-titulo">Nueva cita</h3>
        <button class="btn btn-ghost btn-sm" onclick="_citasCerrarModal()">✕</button>
      </div>
      <div class="modal-body">
        <div class="citas-aviso-capacidad" id="mcita-aviso-cap">
          ⚠️ Ya hay 3 citas en este horario. La bahía podría estar llena.
        </div>
        <div class="citas-form-row">
          <div class="citas-field">
            <label>Placa *</label>
            <input id="mcita-placa" type="text" placeholder="ABC123" maxlength="8"
              style="text-transform:uppercase" oninput="this.value=this.value.toUpperCase()">
          </div>
          <div class="citas-field">
            <label>Propietario *</label>
            <input id="mcita-propietario" type="text" placeholder="Nombre completo">
          </div>
        </div>
        <div class="citas-form-row">
          <div class="citas-field">
            <label>Teléfono</label>
            <input id="mcita-telefono" type="tel" placeholder="300 000 0000">
          </div>
          <div class="citas-field">
            <label>Tipo de servicio</label>
            <select id="mcita-tipo">
              <option value="diagnostico">Diagnóstico</option>
              <option value="mantenimiento">Mantenimiento</option>
              <option value="reparacion">Reparación</option>
              <option value="pintura">Pintura</option>
              <option value="latoneria">Latonería</option>
            </select>
          </div>
        </div>
        <div class="citas-form-row">
          <div class="citas-field">
            <label>Fecha *</label>
            <input id="mcita-fecha" type="date" onchange="_citasVerificarCapacidad()">
          </div>
          <div class="citas-field">
            <label>Hora *</label>
            <select id="mcita-hora" onchange="_citasVerificarCapacidad()">
              ${horasOpts}
            </select>
          </div>
        </div>
        <div class="citas-form-row">
          <div class="citas-field">
            <label>Bahía</label>
            <select id="mcita-baya">
              <option value="">Sin asignar</option>
              <option value="1">Bahía 1</option>
              <option value="2">Bahía 2</option>
              <option value="3">Bahía 3</option>
            </select>
          </div>
          <div class="citas-field">
            <label>Estado</label>
            <select id="mcita-estado">
              <option value="pendiente">Pendiente</option>
              <option value="confirmada">Confirmada</option>
              <option value="cancelada">Cancelada</option>
              <option value="completada">Completada</option>
            </select>
          </div>
        </div>
        <div class="citas-form-row solo">
          <div class="citas-field">
            <label>Notas</label>
            <textarea id="mcita-notas" placeholder="Observaciones, síntomas, instrucciones…"></textarea>
          </div>
        </div>
      </div>
      <div class="modal-footer" id="mcita-footer">
        <button class="btn btn-ghost" onclick="_citasCerrarModal()">Cancelar</button>
        <button class="btn btn-primary" id="mcita-btn-guardar" onclick="_citasGuardar()">Guardar cita</button>
      </div>
    </div>`;
  document.body.appendChild(m);
}

function _citasCerrarModal() {
  const m = document.getElementById('modal-nueva-cita');
  if (m) m.classList.remove('show');
  _citaEditandoId = null;
}

// ─── Navegación de semana ─────────────────────────────────

function _citasSemanaAnterior() {
  const d = new Date(_citasLunesActual);
  d.setDate(d.getDate() - 7);
  _citasLunesActual = d;
  _citasCargarSemana(d);
}

function _citasSemanaSiguiente() {
  const d = new Date(_citasLunesActual);
  d.setDate(d.getDate() + 7);
  _citasLunesActual = d;
  _citasCargarSemana(d);
}

function _citasSemanaHoy() {
  _citasLunesActual = _citasLunesDeHoy();
  _citasCargarSemana(_citasLunesActual);
}

function _citasLunesDeHoy() {
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const dow = hoy.getDay(); // 0=dom
  const diff = dow === 0 ? -6 : 1 - dow;
  hoy.setDate(hoy.getDate() + diff);
  return hoy;
}

// ─── Carga ───────────────────────────────────────────────

async function _citasCargarSemana(lunes) {
  const wrap = document.getElementById('citas-grid-wrap');
  if (!wrap) return;
  wrap.innerHTML = `
    <div class="citas-spinner">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
        stroke-linecap="round" stroke-linejoin="round" style="animation:spin 1s linear infinite">
        <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
      </svg>
      Cargando…
    </div>`;

  const sabado = new Date(lunes);
  sabado.setDate(sabado.getDate() + 5);
  const fmtDate = d => d.toISOString().slice(0, 10);

  // Actualizar etiqueta de semana
  const label = document.getElementById('citas-semana-label');
  if (label) {
    const opts = { day: 'numeric', month: 'short' };
    label.textContent =
      `${lunes.toLocaleDateString('es-CO', opts)} — ${sabado.toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' })}`;
  }

  try {
    _citasSemana = await api(
      `/citas?fecha=gte.${fmtDate(lunes)}&fecha=lte.${fmtDate(sabado)}&order=fecha.asc,hora.asc`
    ).catch(() => []) || [];
  } catch (e) {
    _citasSemana = [];
  }

  _citasRenderCalendario(_citasSemana, lunes);
}

// ─── Render calendario ────────────────────────────────────

function _citasRenderCalendario(citas, lunes) {
  const wrap = document.getElementById('citas-grid-wrap');
  if (!wrap) return;

  const hoy       = new Date(); hoy.setHours(0,0,0,0);
  const fmtDate   = d => d.toISOString().slice(0, 10);

  // Construir días (lunes a sábado)
  const dias = [];
  for (let i = 0; i < 6; i++) {
    const d = new Date(lunes);
    d.setDate(d.getDate() + i);
    dias.push(d);
  }

  // Indexar citas por fecha+hora
  const idx = {};
  for (const c of citas) {
    const key = `${c.fecha}|${c.hora}`;
    if (!idx[key]) idx[key] = [];
    idx[key].push(c);
  }

  // ── Cabecera ──
  let thead = `<thead><tr><th class="col-hora">Hora</th>`;
  for (let i = 0; i < dias.length; i++) {
    const d     = dias[i];
    const esHoy = fmtDate(d) === fmtDate(hoy);
    thead += `<th${esHoy ? ' class="hoy-col"' : ''}>
      <div class="dia-nombre">${_CITAS_DIAS_NOMBRE[i]}</div>
      <div class="dia-fecha">${d.getDate()} ${d.toLocaleDateString('es-CO', {month:'short'})}</div>
    </th>`;
  }
  thead += `</tr></thead>`;

  // ── Cuerpo: una fila por hora (07:00 … 17:00, 11 filas de 1h) ──
  // Cada fila de 1h agrupa los slots :00 y :30
  let tbody = '<tbody>';
  for (const horaLabel of _CITAS_HORA_LABELS.slice(0, -1)) { // 07:00…17:00
    const h    = parseInt(horaLabel);
    const slot0 = `${String(h).padStart(2,'0')}:00`;
    const slot1 = `${String(h).padStart(2,'0')}:30`;

    tbody += `<tr>`;
    tbody += `<td class="col-hora-td">${horaLabel}</td>`;

    for (const dia of dias) {
      const fecha    = fmtDate(dia);
      const citas0   = idx[`${fecha}|${slot0}`] || [];
      const citas1   = idx[`${fecha}|${slot1}`] || [];
      const todasCel = [...citas0, ...citas1];
      const activas  = todasCel.filter(c => c.estado !== 'cancelada').length;

      let ocup = '';
      if (activas > 0) {
        const cls = activas >= 3 ? 'full' : activas === 2 ? 'warn' : 'ok';
        ocup = `<div class="citas-ocupacion ${cls}">${activas}/3</div>`;
      }

      let chips = '';
      for (const c of todasCel) {
        const tc    = _CITAS_TIPO_COLOR[c.tipo_servicio] || _CITAS_TIPO_COLOR.diagnostico;
        const ec    = _CITAS_ESTADO_STYLE[c.estado]      || _CITAS_ESTADO_STYLE.pendiente;
        const color = c.estado === 'cancelada' || c.estado === 'completada' ? ec : tc;
        const cls   = c.estado === 'cancelada' ? ' cancelada' : '';
        chips += `<span class="cita-chip${cls}"
          style="background:${color.bg};border-left-color:${color.border};color:${color.texto}"
          onclick="event.stopPropagation();_citasAbrirModal('${escapeHtml(c.fecha)}','${escapeHtml(c.hora)}',${JSON.stringify(c).replace(/</g,'\\u003c').replace(/>/g,'\\u003e').replace(/"/g,'&quot;')})"
          title="${escapeHtml(c.placa)} · ${escapeHtml(c.propietario||'')} · ${escapeHtml(c.hora)}">
          <strong>${escapeHtml(c.placa)}</strong> ${escapeHtml((c.tipo_servicio||'').slice(0,5))} ${c.hora}
        </span>`;
      }

      tbody += `<td onclick="_citasAbrirModal('${fecha}','${slot0}',null)">
        ${ocup}${chips}
      </td>`;
    }
    tbody += `</tr>`;
  }
  tbody += '</tbody>';

  wrap.innerHTML = `<table id="citas-tabla">${thead}${tbody}</table>`;
}

// ─── Modal: abrir ─────────────────────────────────────────

function _citasAbrirModal(fecha, hora, citaExistente) {
  _citasInyectarModal();
  const m = document.getElementById('modal-nueva-cita');
  if (!m) return;

  const set = (id, val) => { const el = document.getElementById(id); if (el) el.value = val != null ? val : ''; };

  if (citaExistente) {
    // Modo edición
    _citaEditandoId = citaExistente.id;
    document.getElementById('mcita-titulo').textContent = 'Editar cita';

    set('mcita-placa',       citaExistente.placa);
    set('mcita-propietario', citaExistente.propietario);
    set('mcita-telefono',    citaExistente.telefono);
    set('mcita-tipo',        citaExistente.tipo_servicio);
    set('mcita-fecha',       citaExistente.fecha);
    set('mcita-hora',        citaExistente.hora);
    set('mcita-baya',        citaExistente.baya != null ? String(citaExistente.baya) : '');
    set('mcita-notas',       citaExistente.notas);
    set('mcita-estado',      citaExistente.estado);

    // Footer modo edición
    document.getElementById('mcita-footer').innerHTML = `
      <button class="btn btn-ghost" onclick="_citasCerrarModal()">Cancelar</button>
      <button class="btn btn-outline btn-sm" style="color:var(--rojo);border-color:var(--rojo)"
        onclick="_citasCambiarEstado('${citaExistente.id}','cancelada')">Cancelar cita</button>
      <button class="btn btn-outline btn-sm" style="color:var(--verde);border-color:var(--verde)"
        onclick="_citasCambiarEstado('${citaExistente.id}','completada')">Completar</button>
      <button class="btn btn-primary" onclick="_citasGuardar()">Guardar cambios</button>`;
  } else {
    // Modo nueva
    _citaEditandoId = null;
    document.getElementById('mcita-titulo').textContent = 'Nueva cita';

    set('mcita-placa',       '');
    set('mcita-propietario', '');
    set('mcita-telefono',    '');
    set('mcita-tipo',        'diagnostico');
    set('mcita-fecha',       fecha || '');
    set('mcita-hora',        hora  || '07:00');
    set('mcita-baya',        '');
    set('mcita-notas',       '');
    set('mcita-estado',      'pendiente');

    document.getElementById('mcita-footer').innerHTML = `
      <button class="btn btn-ghost" onclick="_citasCerrarModal()">Cancelar</button>
      <button class="btn btn-primary" id="mcita-btn-guardar" onclick="_citasGuardar()">Guardar cita</button>`;
  }

  document.getElementById('mcita-aviso-cap').classList.remove('visible');
  _citasVerificarCapacidad();
  m.classList.add('show');
}

// ─── Verificar capacidad en modal ─────────────────────────

async function _citasVerificarCapacidad() {
  const fecha = document.getElementById('mcita-fecha')?.value;
  const hora  = document.getElementById('mcita-hora')?.value;
  const aviso = document.getElementById('mcita-aviso-cap');
  if (!fecha || !hora || !aviso) return;

  try {
    const res = await api(
      `/citas?fecha=eq.${fecha}&hora=eq.${hora}&estado=neq.cancelada&select=id`
    ).catch(() => []) || [];
    const count = _citaEditandoId
      ? res.filter(c => c.id !== _citaEditandoId).length
      : res.length;
    aviso.classList.toggle('visible', count >= 3);
  } catch (_) { /* silencioso */ }
}

// ─── Guardar (POST / PATCH) ───────────────────────────────

async function _citasGuardar() {
  const val = id => (document.getElementById(id)?.value || '').trim();

  const placa       = val('mcita-placa').toUpperCase();
  const propietario = val('mcita-propietario');
  const fecha       = val('mcita-fecha');
  const hora        = val('mcita-hora');

  if (!placa)       { toast('La placa es obligatoria', 'err'); return; }
  if (!propietario) { toast('El propietario es obligatorio', 'err'); return; }
  if (!fecha)       { toast('La fecha es obligatoria', 'err'); return; }
  if (!hora)        { toast('La hora es obligatoria', 'err'); return; }

  const bayaRaw = val('mcita-baya');
  const data = {
    placa,
    propietario,
    telefono:      val('mcita-telefono') || null,
    tipo_servicio: val('mcita-tipo')     || 'diagnostico',
    fecha,
    hora,
    baya:          bayaRaw ? parseInt(bayaRaw) : null,
    notas:         val('mcita-notas')    || null,
    estado:        val('mcita-estado')   || 'pendiente',
  };

  const btn = document.getElementById('mcita-btn-guardar') ||
              document.querySelector('#mcita-footer .btn-primary');
  if (btn) { btn.disabled = true; btn.textContent = 'Guardando…'; }

  try {
    if (_citaEditandoId) {
      // PATCH
      const res = await fetch(`${SUPABASE_URL}/rest/v1/citas?id=eq.${_citaEditandoId}`, {
        method: 'PATCH',
        headers: {
          'apikey':        SUPABASE_KEY,
          'Authorization': 'Bearer ' + SUPABASE_KEY,
          'Content-Type':  'application/json',
          'Prefer':        'return=representation',
        },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error(await res.text());
      toast('Cita actualizada', 'ok');
    } else {
      // POST
      data.creado_por = sesion?.id || null;
      const res = await fetch(`${SUPABASE_URL}/rest/v1/citas`, {
        method: 'POST',
        headers: {
          'apikey':        SUPABASE_KEY,
          'Authorization': 'Bearer ' + SUPABASE_KEY,
          'Content-Type':  'application/json',
          'Prefer':        'return=representation',
        },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error(await res.text());
      toast('Cita creada', 'ok');
    }
    _citasCerrarModal();
    await _citasCargarSemana(_citasLunesActual);
  } catch (e) {
    console.error('_citasGuardar:', e);
    toast('Error al guardar la cita', 'err');
    if (btn) { btn.disabled = false; btn.textContent = _citaEditandoId ? 'Guardar cambios' : 'Guardar cita'; }
  }
}

// ─── Cambiar estado rápido ────────────────────────────────

async function _citasCambiarEstado(id, estado) {
  if (!id) return;
  const labels = { cancelada: 'Cancelar', completada: 'Completar' };
  const confirmMsg = estado === 'cancelada'
    ? '¿Cancelar esta cita?'
    : '¿Marcar esta cita como completada?';
  if (!confirm(confirmMsg)) return;

  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/citas?id=eq.${id}`, {
      method: 'PATCH',
      headers: {
        'apikey':        SUPABASE_KEY,
        'Authorization': 'Bearer ' + SUPABASE_KEY,
        'Content-Type':  'application/json',
        'Prefer':        'return=representation',
      },
      body: JSON.stringify({ estado }),
    });
    if (!res.ok) throw new Error(await res.text());
    toast(`Cita ${estado === 'cancelada' ? 'cancelada' : 'completada'}`, 'ok');
    _citasCerrarModal();
    await _citasCargarSemana(_citasLunesActual);
  } catch (e) {
    console.error('_citasCambiarEstado:', e);
    toast('Error al actualizar estado', 'err');
  }
}
