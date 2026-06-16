// ═══════════════════════════════════════════════════════════
// MÓDULO DE REPUESTOS — v3
// ═══════════════════════════════════════════════════════════

// ── Helpers universales de tiempo y estado ───────────────
function _tiempoDesde(isoStr, sufijo = '') {
  if (!isoStr) return '—';
  const mins = Math.floor((Date.now() - new Date(isoStr)) / 60000);
  const h = Math.floor(mins / 60), m = mins % 60;
  const txt = h > 0 ? `${h}h ${m}m` : `${m}m`;
  const color = mins < 120 ? '#059669' : mins < 480 ? '#D97706' : '#DC2626';
  return `<span style="color:${color};font-weight:700;font-size:11px">⏱ ${txt}${sufijo}</span>`;
}

function _barraEstado(estadoActual) {
  const pasos  = ['pendiente_jefe','enviado_repuestos','cotizado','pedido','recibido_taller','entregado'];
  const labels = ['Solicitado','Repuestos','Cotizado','Pedido','En taller','Entregado'];
  const idx = Math.max(0, pasos.indexOf(estadoActual));
  const completo = estadoActual === 'entregado';
  // Color del paso ACTIVO (el resto de la barra va en gris).
  const colAct = completo ? '#059669' : '#2563EB';
  // Barra segmentada: completados/activo en color, pendientes en gris.
  const segmentos = pasos.map((p, i) => {
    const done = i < idx, active = i === idx;
    const bg = done ? '#059669' : active ? colAct : '#E5E7EB';
    return `<div style="flex:1;height:6px;border-radius:99px;background:${bg}"></div>`;
  }).join('');
  return `<div style="margin:2px 0 8px">
    <div style="display:flex;align-items:center;gap:3px">${segmentos}</div>
    <div style="display:flex;align-items:center;justify-content:space-between;gap:6px;margin-top:5px">
      <span style="font-size:11px;font-weight:700;color:${colAct};white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${labels[idx] || '—'}</span>
      <span style="font-size:10px;font-weight:600;color:#9CA3AF;flex-shrink:0">${idx + 1}/${pasos.length}</span>
    </div>
  </div>`;
}

// Versión MINI de la barra (para las filas de la lista): solo los 6 segmentos
// + el contador "X/6", sin la etiqueta (el badge ya muestra el nombre).
function _barraEstadoMini(estadoActual) {
  const pasos = ['pendiente_jefe','enviado_repuestos','cotizado','pedido','recibido_taller','entregado'];
  const idx = Math.max(0, pasos.indexOf(estadoActual));
  const colAct = estadoActual === 'entregado' ? '#059669' : '#2563EB';
  const seg = pasos.map((p, i) => {
    const bg = i < idx ? '#059669' : i === idx ? colAct : '#E5E7EB';
    return `<div style="flex:1;height:5px;border-radius:99px;background:${bg}"></div>`;
  }).join('');
  return `<div style="display:flex;align-items:center;gap:6px">
    <div style="display:flex;align-items:center;gap:2px;flex:1">${seg}</div>
    <span style="font-size:10px;font-weight:700;color:${colAct};flex-shrink:0">${idx + 1}/6</span>
  </div>`;
}

const N8N_REPUESTO = CONFIG.N8N_WEBHOOK_REPUESTO;

// ── Categorías de repuesto (para rankear proveedores por tipo) ──────
const CATEGORIAS_REPUESTO = [
  'Frenos', 'Motor', 'Suspensión/Dirección', 'Eléctrico',
  'Latonería/Carrocería', 'Filtros/Lubricantes', 'Transmisión',
  'Aire acondicionado', 'Llantas', 'Otros'
];
// Palabras clave por categoría (orden importa: lo más específico primero).
const _CAT_KEYWORDS = {
  'Frenos': ['liquido de freno', 'líquido de freno', 'pastilla', 'disco de freno', 'banda de freno', 'balata', 'caliper', 'bomba de freno', 'zapata', 'freno'],
  'Filtros/Lubricantes': ['filtro', 'aceite', 'lubricante', 'refrigerante', 'grasa', 'aditivo', 'anticongelante'],
  'Suspensión/Dirección': ['amortiguador', 'rotula', 'rótula', 'terminal', 'barra estabilizadora', 'muñon', 'muñón', 'brazo', 'tijera', 'cremallera', 'direccion', 'dirección', 'bieleta', 'buje', 'espiral', 'resorte', 'tensor'],
  'Motor': ['motor', 'piston', 'pistón', 'biela', 'culata', 'empaque', 'junta', 'valvula', 'válvula', 'arbol de leva', 'árbol de leva', 'correa', 'cadena de tiempo', 'bujia', 'bujía', 'inyector', 'turbo', 'bomba de agua', 'termostato', 'radiador', 'cigueñal', 'cigüeñal', 'cofre'],
  'Eléctrico': ['bateria', 'batería', 'alternador', 'motor de arranque', 'arranque', 'sensor', 'fusible', 'rele', 'relé', 'bombillo', 'farola', 'stop', 'cableado', 'bobina', 'computador', 'modulo', 'módulo', 'switch'],
  'Transmisión': ['caja de cambios', 'transmision', 'transmisión', 'clutch', 'croche', 'embrague', 'cardan', 'cardán', 'homocinetica', 'homocinética', 'diferencial', 'retenedor', 'cuoplin', 'cople'],
  'Aire acondicionado': ['aire acondicionado', 'compresor', 'condensador', 'evaporador', 'gas refrigerante', 'a/c'],
  'Latonería/Carrocería': ['guardafango', 'capó', 'capo', 'puerta', 'bumper', 'paragolpes', 'parachoque', 'espejo', 'vidrio', 'parabrisas', 'lamina', 'lámina', 'soporte', 'carroceria', 'carrocería', 'masilla', 'persiana', 'moldura'],
  'Llantas': ['llanta', 'neumatico', 'neumático', 'rin', 'caucho']
};
function _detectarCategoria(texto) {
  const t = (texto || '').toLowerCase();
  for (const cat of Object.keys(_CAT_KEYWORDS)) {
    if (_CAT_KEYWORDS[cat].some(k => t.includes(k))) return cat;
  }
  return 'Otros';
}
// Auto-rellena el selector de categoría según los ítems escritos, salvo que
// el mecánico ya lo haya cambiado a mano (_catTocada).
let _catTocada = false;
function _autoCategoria() {
  if (_catTocada) return;
  const sel = document.getElementById('sol-categoria');
  if (!sel) return;
  const texto = [...document.querySelectorAll('[id^="si-rep-"]')].map(i => i.value).join(' ');
  if (texto.trim()) sel.value = _detectarCategoria(texto);
}

// Detecta TODAS las categorías que sugiere el nombre de un proveedor (puede
// manejar varias). Devuelve un arreglo (vacío si es un proveedor general).
const _PROV_CAT = {
  'Frenos': ['freno','pastilla','disco de freno','balata','zapata','caliper'],
  'Motor': ['radiador','motor','culata','transtermo','dayco','arbol','leva','piston','valvula','válvula','correa','cadena','turbo','inyector','empaque'],
  'Suspensión/Dirección': ['amortiguador','resorte','tecniresorte','direccion','dirección','suspension','suspensión','tijera','rotula','rótula','terminal','bieleta','buje','espiral'],
  'Eléctrico': ['electric','eléctric','venelectric','scanner','escaner','motorola','bateria','batería','alternador','arranque','sensor','farola','bombillo','bobina'],
  'Latonería/Carrocería': ['vidrio','parabri','latas','bomper','cromado','lujo','espejo','lamina','lámina','void','sign','carroceria','carrocería','pintura','guardafango','puerta','capo','capó','moldura','persiana','parrilla'],
  'Filtros/Lubricantes': ['filtro','aceite','lubricante','aditivo'],
  'Transmisión': ['transmision','transmisión','clutch','croche','embrague','cardan','cardán','homocinetic','diferencial','retenedor'],
  'Aire acondicionado': ['aire acond','compresor','condensador','evaporador'],
  'Llantas': ['llanta','rin ','neumatic','caucho']
};
function _detectarCategoriasProveedor(nombre) {
  const t = (nombre || '').toLowerCase();
  const cats = [];
  for (const c of Object.keys(_PROV_CAT)) {
    if (_PROV_CAT[c].some(k => t.includes(k))) cats.push(c);
  }
  return cats;
}
// Botón "sugerir" en el formulario de proveedor: marca las categorías que
// sugiere el nombre.
function _sugerirCatProveedor() {
  const nombre = document.getElementById('prov-nombre')?.value || '';
  const cats = _detectarCategoriasProveedor(nombre);
  // Marca las detectadas (sin desmarcar las personalizadas ya elegidas).
  document.querySelectorAll('#modal-proveedor input[name="prov-cat"]').forEach(cb => { if (cats.includes(cb.value)) cb.checked = true; });
  toast(cats.length ? 'Sugeridas: ' + cats.join(', ') : 'No detecté categoría por el nombre', cats.length ? 'ok' : 'info');
}

// Categorías personalizadas ya usadas en otros proveedores (además de las
// estándar). Se llena en cargarProveedores.
let _catProvExtra = [];
// Agrega una categoría nueva (personalizada) al formulario, marcada.
function _agregarCategoriaProv() {
  const inp = document.getElementById('prov-cat-nueva');
  const val = (inp?.value || '').trim();
  if (!val) return;
  const wrap = document.getElementById('prov-cat-wrap');
  if (!wrap) return;
  const existe = [...wrap.querySelectorAll('input[name="prov-cat"]')].some(cb => cb.value.toLowerCase() === val.toLowerCase());
  if (existe) { toast('Esa categoría ya está en la lista', 'info'); if (inp) inp.value = ''; return; }
  const lbl = document.createElement('label');
  lbl.style.cssText = 'display:flex;align-items:center;gap:7px;font-size:12.5px;cursor:pointer;padding:4px 2px;line-height:1.2;text-transform:none;font-weight:400;letter-spacing:normal;color:var(--texto)';
  lbl.innerHTML = `<input type="checkbox" name="prov-cat" value="${escapeHtml(val)}" checked style="flex-shrink:0;margin:0;width:15px;height:15px"><span style="min-width:0">${escapeHtml(val)}</span>`;
  wrap.appendChild(lbl);
  if (inp) inp.value = '';
}

// Marcas de carros que circulan en Colombia (orden alfabético).
// Si falta alguna que manejen, se agrega aquí.
const MARCAS_VEHICULOS = [
  'Audi','BAIC','BMW','BYD','Changan','Chery','Chevrolet','Chrysler','Citroën',
  'DFSK','Dodge','Dongfeng','Fiat','Ford','Foton','Geely','GMC','Great Wall',
  'Haval','Honda','Hyundai','Isuzu','JAC','Jeep','Jetour','Kia','Land Rover',
  'Lexus','Mahindra','Mazda','Mercedes-Benz','MG','Mini','Mitsubishi','Nissan',
  'Peugeot','Ram','Renault','Seat','Skoda','SsangYong','Subaru','Suzuki',
  'Toyota','Volkswagen','Volvo'
];

// ── Sección activa ──────────────────────────────────────
let _repSeccionActual = 'solicitudes';
// ¿Mostrar el apartado de "Entregados" (completados) expandido?
let _repVerEntregados = false;
function _toggleEntregados() { _repVerEntregados = !_repVerEntregados; cargarSolicitudesRepuestos(); }

// ── Polling global ──────────────────────────────────────
let _repuestosPollingInterval = null;
function iniciarPollingRepuestos(fn, seg = 15) {
  if (_repuestosPollingInterval) clearInterval(_repuestosPollingInterval);
  _repuestosPollingInterval = setInterval(fn, seg * 1000);
}
function detenerPollingRepuestos() {
  if (_repuestosPollingInterval) clearInterval(_repuestosPollingInterval);
  _repuestosPollingInterval = null;
}

// ── Registros para evitar pasar datos de DB en onclick ──
let _solRegistry = {};
let _provRegistry = {};

function _abrirCotizarPorId(btn) {
  const d = _solRegistry[btn.dataset.solId];
  if (d) abrirModalCotizar(d.solicitudId, d.repuesto, d.unidades, d.placa, d.marca, d.modelo, d.anio, d.vin);
}

function _editarProveedorPorId(btn) {
  const p = _provRegistry[btn.dataset.provId];
  if (p) abrirModalProveedor(p);
}

// ── Shared helpers para modal-precio-venta ──────────────
const _OP_LABELS = { 1: 'Opción 1 — Precio alto', 2: 'Opción 2 — Precio medio', 3: 'Opción 3 — Precio bajo' };
function _pvCerrarModal() {
  const m = document.getElementById('modal-precio-venta');
  if (m) m.remove();
  window._pvCots = null;
  window._pvSol  = null;
  window._pvSeleccionada = null;
}

// ─────────────────────────────────────────────────────────
// SOLICITAR REPUESTO — tabla compacta tipo Excel
// ─────────────────────────────────────────────────────────
let _solItems = [{ idx: 0, fotoUrl: null }];
let _solModalAbierto = null; // timestamp cuando se abrió el modal

function _renderTablaItems() {
  return `<table style="width:100%;border-collapse:collapse;font-size:13px">
    <thead>
      <tr style="background:var(--gris-bg)">
        <th style="padding:6px 8px;text-align:center;width:28px;font-size:11px;color:var(--gris-mid);font-weight:600">#</th>
        <th style="padding:6px 8px;text-align:left;font-size:11px;color:var(--gris-mid);font-weight:600">Repuesto / Pieza</th>
        <th style="padding:6px 8px;text-align:center;width:60px;font-size:11px;color:var(--gris-mid);font-weight:600">Cant</th>
        <th style="padding:6px 8px;text-align:left;font-size:11px;color:var(--gris-mid);font-weight:600">Observaciones</th>
        <th style="width:28px"></th>
      </tr>
    </thead>
    <tbody id="sol-items-tbody">
      ${_solItems.map((item, i) => _renderFilaItem(item, i + 1)).join('')}
    </tbody>
  </table>`;
}

function _renderFilaItem(item, num) {
  return `<tr id="si-row-${item.idx}" style="border-bottom:1px solid var(--gris-borde)">
    <td style="padding:6px 8px;text-align:center;color:var(--gris-mid);font-size:11px">${num}</td>
    <td style="padding:4px 6px">
      <input id="si-rep-${item.idx}" type="text" placeholder="Ej: Disco de freno delantero" value="" oninput="_autoCategoria()"
        style="width:100%;border:none;background:transparent;font-size:13px;outline:none;padding:4px 0">
    </td>
    <td style="padding:4px 6px">
      <input id="si-cant-${item.idx}" type="number" min="1" value="1"
        style="width:52px;border:1px solid var(--gris-borde);border-radius:4px;text-align:center;font-size:13px;padding:4px">
    </td>
    <td style="padding:4px 6px">
      <input id="si-obs-${item.idx}" type="text" placeholder="Referencia, marca..."
        style="width:100%;border:none;background:transparent;font-size:12px;outline:none;padding:4px 0;color:var(--gris-mid)">
    </td>
    <td style="padding:4px 6px;text-align:center">
      ${num > 1
        ? `<button type="button" onclick="_quitarSolItem(${item.idx})"
            style="background:none;border:none;cursor:pointer;color:#DC2626;font-size:14px;line-height:1;padding:2px 4px">✕</button>`
        : '<span style="color:var(--gris-borde);font-size:14px">✕</span>'}
    </td>
  </tr>`;
}

function _agregarSolItem() {
  // Guardar valores actuales antes de re-renderizar
  _solItems.forEach(item => {
    const repEl  = document.getElementById(`si-rep-${item.idx}`);
    const cantEl = document.getElementById(`si-cant-${item.idx}`);
    const obsEl  = document.getElementById(`si-obs-${item.idx}`);
    if (repEl)  item._repuesto     = repEl.value;
    if (cantEl) item._unidades     = cantEl.value;
    if (obsEl)  item._observaciones = obsEl.value;
  });
  const idx = Date.now();
  _solItems.push({ idx, fotoUrl: null });
  const tbody = document.getElementById('sol-items-tbody');
  if (tbody) {
    tbody.innerHTML = _solItems.map((item, i) => _renderFilaItem(item, i + 1)).join('');
    // Restaurar valores guardados
    _solItems.forEach(item => {
      const repEl  = document.getElementById(`si-rep-${item.idx}`);
      const cantEl = document.getElementById(`si-cant-${item.idx}`);
      const obsEl  = document.getElementById(`si-obs-${item.idx}`);
      if (repEl  && item._repuesto)      repEl.value  = item._repuesto;
      if (cantEl && item._unidades)      cantEl.value = item._unidades;
      if (obsEl  && item._observaciones) obsEl.value  = item._observaciones;
    });
  }
  setTimeout(() => document.getElementById(`si-rep-${idx}`)?.focus(), 60);
}

function _quitarSolItem(idx) {
  _solItems = _solItems.filter(i => i.idx !== idx);
  const tbody = document.getElementById('sol-items-tbody');
  if (tbody) tbody.innerHTML = _solItems.map((item, i) => _renderFilaItem(item, i + 1)).join('');
}

function _tickTimerSol() {
  const el = document.getElementById('sol-timer-live');
  if (!el || !_solModalAbierto) return;
  const mins = Math.floor((Date.now() - _solModalAbierto) / 60000);
  const h = Math.floor(mins / 60), m = mins % 60;
  el.textContent = h > 0 ? `${h}h ${m}m` : `${m}m`;
}

// Punto de entrada unificado (compatible con llamadas antiguas)
async function abrirModalSolicitudRepuesto(ordenId, etapaId, placa) {
  _solItems = [{ idx: 0, fotoUrl: null }];
  _solModalAbierto = Date.now();
  _catTocada = false;
  const existing = document.getElementById('modal-sol-multi');
  if (existing) existing.remove();

  // Datos del vehículo (VIN incluido) para que repuestos pueda cotizar bien.
  const veh = await api(`/ordenes?id=eq.${ordenId}&select=placa,marca,linea,modelo,vin`).then(r=>r?.[0]).catch(()=>null);
  const vehLinea = [veh?.marca, veh?.linea, veh?.modelo].filter(Boolean).join(' ');
  const vinHtml = veh?.vin
    ? `<span style="font-family:'DM Mono',monospace;font-weight:600;color:var(--texto)">${escapeHtml(veh.vin)}</span>
       <button type="button" title="Copiar VIN"
         onclick="navigator.clipboard?.writeText('${escapeHtml(veh.vin).replace(/'/g,"\\x27")}');toast('VIN copiado ✓')"
         style="background:none;border:none;cursor:pointer;font-size:12px;padding:0 2px">📋</button>`
    : `<span style="color:var(--gris-mid)">Sin VIN registrado</span>`;

  // Mostrar los repuestos que ESTA orden ya tiene solicitados, para no repetir.
  const _existentesOrden = await api(`/solicitudes_repuesto?orden_id=eq.${ordenId}&order=creado_en.desc&select=repuesto,estado,unidades`).catch(() => []) || [];
  const existentesHtml = _existentesOrden.length ? `
    <div style="font-size:12px;margin-bottom:10px;padding:10px 12px;background:#FFFBEB;border:1px solid #FDE68A;border-radius:8px">
      <div style="font-weight:700;color:#92400E;margin-bottom:6px">📋 Esta orden ya tiene ${_existentesOrden.length} repuesto(s) solicitado(s):</div>
      <div style="display:flex;flex-wrap:wrap;gap:6px">
        ${_existentesOrden.map(s => { const inf = repuestoEstadoInfo(s.estado); return `<span style="font-size:11px;font-weight:700;color:${inf.color};background:${inf.bg};padding:2px 8px;border-radius:99px">${escapeHtml(s.repuesto || 'repuesto')}${s.unidades > 1 ? ` ×${s.unidades}` : ''} · ${inf.icon} ${inf.label}</span>`; }).join('')}
      </div>
      <div style="font-size:11px;color:#92400E;margin-top:6px">Revisa que no estés pidiendo algo que ya está en proceso.</div>
    </div>` : '';

  const div = document.createElement('div');
  div.id = 'modal-sol-multi';
  div.className = 'modal-overlay show';
  div.innerHTML = `
    <div class="modal" style="max-width:600px;max-height:90vh;overflow-y:auto">
      <div class="modal-header" style="padding-bottom:10px">
        <div class="modal-titulo" style="font-size:15px">Solicitar repuesto — ${escapeHtml(placa)}</div>
        <button class="modal-close" onclick="document.getElementById('modal-sol-multi').remove()">✕</button>
      </div>
      <div class="modal-body" style="padding-top:10px">

        ${existentesHtml}

        <!-- Datos del vehículo (visibles para repuestos) -->
        <div style="font-size:12px;margin-bottom:10px;padding:8px 12px;background:#EEF2F7;border-radius:6px;border:1px solid var(--gris-borde);line-height:1.7">
          ${vehLinea ? `<div>🚗 <strong>${escapeHtml(vehLinea)}</strong></div>` : ''}
          <div>🔢 VIN: ${vinHtml}</div>
        </div>

        <input type="hidden" name="sol-tipo" id="sol-tipo-taller" value="taller">

        <div style="font-size:12px;margin-bottom:10px;padding:8px 12px;background:#F8FAFC;border-radius:6px;border:1px solid var(--gris-borde)">
          <div style="font-weight:600;margin-bottom:6px;color:var(--texto)">¿Hay otro proceso en curso mientras llega el repuesto?</div>
          <label style="display:flex;align-items:center;gap:6px;cursor:pointer;margin-bottom:4px">
            <input type="radio" name="sol-otro-proceso" value="si" checked style="accent-color:var(--azul)">
            <span style="color:#059669;font-weight:500">✓ Sí — el técnico continúa trabajando en otra tarea</span>
          </label>
          <label style="display:flex;align-items:center;gap:6px;cursor:pointer">
            <input type="radio" name="sol-otro-proceso" value="no" style="accent-color:var(--azul)">
            <span style="color:#D97706;font-weight:500">⏸ No — pausar el contador hasta que llegue el repuesto</span>
          </label>
        </div>

        <!-- Tabla compacta -->
        <div style="border:1px solid var(--gris-borde);border-radius:8px;overflow:hidden;margin-bottom:10px">
          ${_renderTablaItems()}
        </div>
        <button type="button" class="btn btn-ghost btn-sm" onclick="_agregarSolItem()" style="margin-bottom:12px">
          + Agregar ítem
        </button>

        <!-- Categoría (auto-detectada, confirmable) -->
        <div class="field" style="margin-bottom:12px">
          <label style="font-size:12px;color:var(--gris-mid)">Categoría <span style="font-weight:400">(para sugerir el mejor proveedor)</span></label>
          <select id="sol-categoria" onchange="_catTocada=true" style="width:100%;padding:8px;border:1px solid var(--gris-borde);border-radius:6px;font-size:13px">
            ${CATEGORIAS_REPUESTO.map(c => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join('')}
          </select>
        </div>

        <!-- Timer en vivo -->
        <div style="font-size:11px;color:var(--gris-mid)">
          ⏱ Solicitado hace: <span id="sol-timer-live" style="font-weight:700;color:var(--texto)">0m</span>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-ghost" onclick="document.getElementById('modal-sol-multi').remove()">Cancelar</button>
        <button class="btn btn-primary" id="sol-multi-submit"
          data-oid="${ordenId}" data-eid="${etapaId||''}"
          onclick="enviarSolicitudRepuesto(+this.dataset.oid,this.dataset.eid?+this.dataset.eid:null)">
          Enviar solicitud →
        </button>
      </div>
    </div>`;
  document.body.appendChild(div);
  setTimeout(() => document.getElementById('si-rep-0')?.focus(), 80);

  // Iniciar ticker del timer en vivo
  if (window._solTimerTick) clearInterval(window._solTimerTick);
  window._solTimerTick = setInterval(() => {
    if (!document.getElementById('modal-sol-multi')) { clearInterval(window._solTimerTick); return; }
    _tickTimerSol();
  }, 10000);
}

async function _subirFotoSolItem(input, idx) {
  const file = input.files[0];
  if (!file) return;
  try {
    const ext = file.name.split('.').pop();
    const path = `solicitudes/items/${Date.now()}_${idx}.${ext}`;
    const url = await storageUpload(file, path);
    const item = _solItems.find(i => i.idx === idx);
    if (item) item.fotoUrl = url;
    toast('Foto adjuntada ✓');
  } catch(e) {
    toast('Error al subir foto', 'err');
  }
}

function _quitarFotoSolItem(idx) {
  const item = _solItems.find(i => i.idx === idx);
  if (item) item.fotoUrl = null;
}

async function enviarSolicitudRepuesto(ordenId, etapaId) {
  const items = _solItems.map(item => ({
    repuesto:      (document.getElementById(`si-rep-${item.idx}`)?.value || '').trim(),
    unidades:      parseFloat(document.getElementById(`si-cant-${item.idx}`)?.value) || 1,
    observaciones: (document.getElementById(`si-obs-${item.idx}`)?.value || '').trim() || null,
    foto_url:      item.fotoUrl || null
  }));

  if (items.some(i => !i.repuesto)) {
    toast('Completa el nombre de cada repuesto', 'err');
    return;
  }

  const btn = document.getElementById('sol-multi-submit');
  if (btn) btn.disabled = true;

  try {
    const orden = await api(`/ordenes?id=eq.${ordenId}&select=placa,marca,linea,modelo,vin`).then(r=>r?.[0]).catch(()=>null);

    // Si ya hay una solicitud de esta orden/etapa que el perfil de repuestos AÚN
    // no cotizó (pendiente_jefe o enviado_repuestos), se agregan los repuestos a
    // ESA misma solicitud en vez de crear otra. Si ya está cotizada o más
    // adelante, se crea una nueva.
    const _filtroEtapa = etapaId ? `&etapa_id=eq.${etapaId}` : '&etapa_id=is.null';
    const _existentes = await api(`/solicitudes_repuesto?orden_id=eq.${ordenId}${_filtroEtapa}&estado=in.(pendiente_jefe,enviado_repuestos)&order=creado_en.desc&limit=1&select=id`).catch(() => []) || [];
    let solicitudId = _existentes?.[0]?.id || null;
    const fusionada = !!solicitudId;

    if (!solicitudId) {
      // Crear cabecera nueva (primer ítem en campos legacy para compatibilidad)
      const solicitudRes = await api('/solicitudes_repuesto', 'POST', {
        orden_id:           ordenId,
        etapa_id:           etapaId || null,
        solicitado_por:     sesion.nombre,
        perfil_solicitante: sesion.perfil,
        repuesto:           items[0].repuesto,
        unidades:           items[0].unidades,
        observaciones:      items[0].observaciones,
        // Auto-aprobado: va directo a Repuestos para cotizar (sin paso previo
        // de aprobación del jefe). El jefe decide en el precio.
        estado:             'enviado_repuestos'
      }, { Prefer: 'return=representation' });
      solicitudId = solicitudRes?.[0]?.id;
    } else {
      // Agregar a la existente: refrescar "actualizado_en" para que vuelva arriba.
      await api(`/solicitudes_repuesto?id=eq.${solicitudId}`, 'PATCH', { actualizado_en: new Date().toISOString() }).catch(() => {});
    }

    // Guardar la categoría (para rankear proveedores por tipo). En PATCH aparte y
    // con catch, para no romper la creación si aún no se corrió el ALTER TABLE.
    const _categoria = document.getElementById('sol-categoria')?.value || _detectarCategoria(items.map(i => i.repuesto).join(' '));
    if (solicitudId && _categoria) {
      await api(`/solicitudes_repuesto?id=eq.${solicitudId}`, 'PATCH', { categoria: _categoria }, { Prefer: 'return=minimal' }).catch(() => {});
    }

    // Crear los ítems en solicitud_items (todos)
    if (solicitudId) {
      for (const item of items) {
        await api('/solicitud_items', 'POST', {
          solicitud_id:  solicitudId,
          repuesto:      item.repuesto,
          unidades:      item.unidades,
          observaciones: item.observaciones,
          foto_url:      item.foto_url
        }, { Prefer: 'return=minimal' }).catch(() => {});
      }
    }

    // Pausar etapa solo si el técnico indicó que NO hay otro proceso en curso
    const otroProceso = document.querySelector('input[name="sol-otro-proceso"]:checked')?.value;
    const debePausar = otroProceso !== 'si'; // pausa si respondió "No"
    if (debePausar) {
      if (etapaId) {
        // No reiniciar la pausa si ya estaba pausada (p. ej. por la solicitud anterior).
        const _et = await api(`/etapas?id=eq.${etapaId}&select=pausado`).then(r => r?.[0]).catch(() => null);
        if (_et && !_et.pausado) {
          await api(`/etapas?id=eq.${etapaId}`, 'PATCH', {
            pausado: true, pausa_inicio: new Date().toISOString()
          }).catch(() => {});
        }
      } else {
        // Sin etapa específica: buscar etapas activas de este mecánico en esta orden y pausarlas
        const activas = await api(`/etapas?orden_id=eq.${ordenId}&fin=is.null&pausado=eq.false&inicio=not.is.null&select=id`).catch(()=>[]) || [];
        for (const e of activas) {
          await api(`/etapas?id=eq.${e.id}`, 'PATCH', {
            pausado: true, pausa_inicio: new Date().toISOString()
          }).catch(() => {});
        }
      }
    }
    const pausaMensaje = debePausar ? ' · ⏸ Etapa pausada' : ' · El técnico continúa trabajando';

    // Notificación N8N — n8n envía a los 3 chats de repuestos directamente
    const resumen = items.map(i => `${i.repuesto} (x${i.unidades})`).join(', ');
    fetch(N8N_REPUESTO, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        evento: 'repuesto_solicitado', solicitado_por: sesion.nombre,
        repuesto: resumen, placa: orden?.placa || '',
        marca: orden?.marca || '', modelo: orden?.linea || '',
        vin: orden?.vin || '', orden_id: ordenId
      })
    }).catch(() => {});

    document.getElementById('modal-sol-multi')?.remove();
    const _accion = fusionada
      ? 'Agregado a la solicitud en curso'
      : (items.length > 1 ? items.length + ' repuestos solicitados' : 'Solicitud enviada');
    toast(`${_accion} ✓${pausaMensaje}`);

    if (typeof actualizarBadgeRepuestos === 'function') actualizarBadgeRepuestos();
    if (typeof cargarEtapasMecanico === 'function') cargarEtapasMecanico();
    if (typeof cargarRepuestosJefe === 'function' && typeof esJefe === 'function' && esJefe()) cargarRepuestosJefe();
  } catch(e) {
    toast('Error: ' + e.message, 'err');
    if (btn) btn.disabled = false;
  }
}

// ─────────────────────────────────────────────────────────
// BADGE JEFE
// ─────────────────────────────────────────────────────────
async function actualizarBadgeRepuestos() {
  try {
    const p = await api('/solicitudes_repuesto?estado=eq.pendiente_jefe&select=id').catch(()=>[]) || [];
    if (typeof _setNavBadge === 'function') _setNavBadge('nav-repuestos', p.length);
  } catch(e) {}
}

// ─────────────────────────────────────────────────────────
// PERFIL JEFE — repuestos
// ─────────────────────────────────────────────────────────
async function cargarRepuestosJefe() {
  const cont = document.getElementById('repuestos-jefe-contenido');
  if (!cont) return;

  try {
    const filtro = document.getElementById('rep-filtro-estado')?.value||'';
    let q = '/solicitudes_repuesto?order=creado_en.desc&limit=50&select=*';
    if (filtro) q += `&estado=eq.${filtro}`;

    const solicitudes = await api(q).catch(()=>[]) || [];
    const oids = [...new Set(solicitudes.map(s=>s.orden_id).filter(Boolean))];
    const ordenes = oids.length ? await api(`/ordenes?id=in.(${oids.join(',')})&select=id,placa,marca,linea,modelo,vin,propietario`).catch(()=>[]) || [] : [];
    const om = {}; ordenes.forEach(o=>{ om[o.id]=o; });

    const estMap = {
      pendiente_jefe:    {txt:'Pendiente revisión', cls:'badge-pendiente'},
      enviado_repuestos: {txt:'En repuestos',       cls:'badge-iniciada'},
      cotizado:          {txt:'Cotizado',            cls:'badge-cotizada'},
      pedido:            {txt:'Pedido',              cls:'badge-iniciada'},
      recibido_taller:   {txt:'Llegó al taller',    cls:'badge-completada'},
      entregado:         {txt:'Entregado al técnico',cls:'badge-completada'},
      rechazado:         {txt:'Rechazado',           cls:'badge-pendiente'}
    };

    const barraHtml = `<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px">
      <div style="font-size:16px;font-weight:700">Solicitudes de repuestos</div>
      <select id="rep-filtro-estado" onchange="cargarRepuestosJefe()" style="font-size:12px;padding:6px 10px;border-radius:6px;border:1px solid var(--gris-borde)">
        <option value="">Todos los estados</option>
        <option value="pendiente_jefe">Pendiente revisión</option>
        <option value="enviado_repuestos">En repuestos</option>
        <option value="cotizado">Cotizado</option>
        <option value="pedido">Pedido</option>
        <option value="recibido_taller">Llegó al taller</option>
        <option value="entregado">Entregado al técnico</option>
        <option value="rechazado">Rechazado</option>
      </select>
    </div>`;

    // Cargar ítems de todas las solicitudes en un solo query
    const solIds = solicitudes.map(s => s.id);
    const todosItems = solIds.length
      ? await api(`/solicitud_items?solicitud_id=in.(${solIds.join(',')})&order=creado_en.asc`).catch(()=>[]) || []
      : [];

    if (!solicitudes.length) {
      renderSinParpadeo(cont, `<div style="padding:20px">${barraHtml}<div class="empty-state"><p>Sin solicitudes</p></div></div>`);
      return;
    }

    renderSinParpadeo(cont, `<div style="padding:20px">${barraHtml}
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(215px,1fr));gap:12px;align-items:stretch">
        ${solicitudes.map(s => {
          const o   = om[s.orden_id]||{};
          const est = estMap[s.estado]||{txt:s.estado,cls:''};
          const items = todosItems.filter(i => i.solicitud_id === s.id);

          // Timer del proveedor
          let timerProv = '';
          if (s.pedido_en && (s.estado === 'pedido' || s.estado === 'recibido_taller' || s.estado === 'entregado')) {
            const finTs = s.recibido_en ? new Date(s.recibido_en) : new Date();
            const mins  = Math.round((finTs - new Date(s.pedido_en)) / 60000);
            const h = Math.floor(mins/60), m = mins%60;
            const label = s.recibido_en ? 'Proveedor tardó' : 'Esperando proveedor';
            timerProv = `<div style="font-size:11px;color:${s.recibido_en?'#059669':'#D97706'};margin-top:3px;font-weight:600">⏱ ${label}: ${h>0?h+'h ':''}${m}m</div>`;
          }

          // Lista de ítems con fotos
          const itemsHtml = items.length > 0
            ? `<div style="margin:8px 0 10px;display:flex;flex-direction:column;gap:5px">
                ${items.map(i => `<div style="display:flex;align-items:center;gap:8px">
                  ${i.foto_url ? `<img src="${escapeHtml(i.foto_url)}" style="width:32px;height:32px;object-fit:cover;border-radius:4px;flex-shrink:0;cursor:pointer" onclick="abrirLightbox('${escapeHtml(i.foto_url)}')">` : ''}
                  <div>
                    <span style="font-weight:600;font-size:13px">${escapeHtml(i.repuesto)}</span>
                    <span style="font-size:12px;color:var(--gris-mid);margin-left:6px">x${i.unidades||1}</span>
                    ${i.observaciones ? `<div style="font-size:11px;color:var(--gris-mid);font-style:italic">${escapeHtml(i.observaciones)}</div>` : ''}
                  </div>
                </div>`).join('')}
              </div>`
            : `<div style="font-size:13px;color:var(--gris-mid);margin-bottom:8px">${escapeHtml(s.repuesto)} · x${s.unidades||1}${s.observaciones?` · ${escapeHtml(s.observaciones)}`:''}</div>`;

          // Timers universales
          const timerSolicitud  = _tiempoDesde(s.creado_en, ' desde solicitud');
          const timerEstado     = _tiempoDesde(s.actualizado_en || s.creado_en, ' en estado');

          const repNames = items.length ? items.map(i => i.repuesto) : [s.repuesto].filter(Boolean);
          const repResumen = repNames.slice(0, 2).map(escapeHtml).join(', ') + (repNames.length > 2 ? ` <span style="color:var(--gris-mid);font-weight:400">+${repNames.length - 2} más</span>` : '');
          // Un solo botón grande con "lo que toca hacer ahora" según el estado.
          let accionBtns = '';
          if (s.estado === 'pendiente_jefe') accionBtns = `<button class="btn btn-primary btn-sm" style="flex:1" onclick="jefeProcesarSolicitud(${s.id},'aprobar',${s.etapa_id||'null'})">✓ Enviar a cotizar</button>`;
          else if (s.estado === 'enviado_repuestos') accionBtns = `<button class="btn btn-primary btn-sm" style="flex:1" data-sol-id="${s.id}" onclick="_abrirCotizarPorId(this)">📝 Cotizar</button>`;
          else if (s.estado === 'cotizado') accionBtns = `<button class="btn btn-primary btn-sm" style="flex:1" onclick="abrirModalPrecioVenta(${s.id})">💲 Definir precio</button>`;
          else if (s.estado === 'pedido') accionBtns = `<button class="btn btn-success btn-sm" style="flex:1" onclick="jefeLlegadaYEntrega(${s.id},${s.etapa_id||'null'})">✓ Llegó y entregar</button>`;
          else if (s.estado === 'recibido_taller') accionBtns = `<button class="btn btn-success btn-sm" style="flex:1" onclick="jefeConfirmarEntrega(${s.id},${s.etapa_id||'null'})">✓ Entregar al técnico</button>`;

          return `<div class="card" data-id="${s.id}" style="padding:12px;display:flex;flex-direction:column;gap:7px">
            <div style="display:flex;align-items:center;justify-content:space-between;gap:8px">
              <span style="font-family:'DM Mono',monospace;font-weight:700;font-size:15px;color:#111;letter-spacing:.5px">${escapeHtml(o.placa||'—')}</span>
              <span class="badge ${est.cls}" style="flex-shrink:0">${est.txt}</span>
            </div>
            <div style="font-size:12px;color:var(--gris-mid);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escapeHtml(o.propietario||'Cliente —')} · ${formatOT(s.orden_id)}</div>
            <div title="${escapeHtml(repNames.join(', '))}" style="font-size:13px;font-weight:600;color:#1E293B;line-height:1.35;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden">${repResumen || '—'}</div>
            ${_barraEstado(s.estado)}
            <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:auto;padding-top:2px">
              <button class="btn btn-ghost btn-xs" onclick="_verSolicitud(${s.id})">Ver detalle</button>
              ${accionBtns}
            </div>
          </div>`;
        }).join('')}
      </div>
    </div>`);

    // Resaltar en naranja las solicitudes nuevas desde la última vez vista
    if (typeof destellarPendientes === 'function') destellarPendientes('repuestos-jefe', cont, '.card[data-id]');

    iniciarPollingRepuestos(()=>{
      if (document.getElementById('repuestos-jefe-contenido')) cargarRepuestosJefe();
      else detenerPollingRepuestos();
    });
  } catch(e) {
    cont.innerHTML = `<div class="empty-state">Error: ${e.message}</div>`;
  }
}

// ── Detalle de una solicitud (modal "Ver detalle") ──────────
function _cerrarVerSolicitud() {
  document.getElementById('modal-ver-solicitud')?.remove();
}

async function _verSolicitud(id) {
  _cerrarVerSolicitud();
  try {
    const s = await api(`/solicitudes_repuesto?id=eq.${id}&select=*`).then(r => r?.[0]).catch(() => null);
    if (!s) { toast('No se encontró la solicitud', 'err'); return; }
    const items = await api(`/solicitud_items?solicitud_id=eq.${id}&order=creado_en.asc`).catch(() => []) || [];
    const o = s.orden_id ? await api(`/ordenes?id=eq.${s.orden_id}&select=placa,marca,linea,modelo,vin,propietario`).then(r => r?.[0]).catch(() => null) : null;

    const estMap = {
      pendiente_jefe:{txt:'Pendiente revisión',cls:'badge-pendiente'}, enviado_repuestos:{txt:'En repuestos',cls:'badge-iniciada'},
      cotizado:{txt:'Cotizado',cls:'badge-cotizada'}, pedido:{txt:'Pedido',cls:'badge-iniciada'},
      recibido_taller:{txt:'Llegó al taller',cls:'badge-completada'}, entregado:{txt:'Entregado al técnico',cls:'badge-completada'}, rechazado:{txt:'Rechazado',cls:'badge-pendiente'}
    };
    const est = estMap[s.estado] || { txt: s.estado, cls: '' };

    const itemsHtml = items.length
      ? items.map(i => `<div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid var(--gris-borde)">
          ${i.foto_url ? `<img src="${escapeHtml(i.foto_url)}" style="width:46px;height:46px;object-fit:cover;border-radius:6px;cursor:pointer;flex-shrink:0" onclick="abrirLightbox('${escapeHtml(i.foto_url)}')">` : ''}
          <div style="flex:1;min-width:0"><div style="font-weight:600;font-size:14px">${escapeHtml(i.repuesto)} <span style="color:var(--gris-mid);font-weight:400">x${i.unidades||1}</span></div>${i.observaciones ? `<div style="font-size:12px;color:var(--gris-mid);font-style:italic">${escapeHtml(i.observaciones)}</div>` : ''}</div>
        </div>`).join('')
      : `<div style="padding:6px 0;font-size:14px">${escapeHtml(s.repuesto || '—')} <span style="color:var(--gris-mid)">x${s.unidades||1}</span>${s.observaciones ? `<div style="font-size:12px;color:var(--gris-mid);font-style:italic">${escapeHtml(s.observaciones)}</div>` : ''}</div>`;

    const _esRep = (typeof sesion !== 'undefined') && sesion?.perfil === 'repuestos';
    const _esJefeRol = (typeof esJefe === 'function') && esJefe();
    let accion = '';
    if (_esRep) {
      // Acciones del perfil de repuestos (cotizar / confirmar pedido)
      if (s.estado === 'enviado_repuestos' || s.estado === 'cotizado')
        accion = `<button class="btn btn-primary btn-sm" data-sol-id="${s.id}" style="margin-top:12px" onclick="_cerrarVerSolicitud();_abrirCotizarPorId(this)">${s.estado === 'enviado_repuestos' ? '+ Cotizar' : 'Ver / editar cotizaciones'}</button>`;
      else if (s.estado === 'pedido' && !s.pedido_proveedor_confirmado)
        accion = `<button class="btn btn-success btn-sm" style="margin-top:12px" onclick="marcarRepuestoSolicitadoProveedor(${s.id});_cerrarVerSolicitud()">Confirmar pedido al proveedor</button>`;
    } else if (_esJefeRol) {
      if (s.estado === 'pendiente_jefe') accion = `
      <div style="background:var(--gris-bg);border-radius:8px;padding:10px 12px;margin:12px 0">
        <div style="font-size:11px;font-weight:600;color:var(--gris-mid);margin-bottom:6px;text-transform:uppercase;letter-spacing:.5px">Nota para repuestos (opcional)</div>
        <textarea id="nota-jefe-${s.id}" style="width:100%;min-height:50px;font-size:13px;border:1px solid var(--gris-borde);border-radius:6px;padding:6px 10px;resize:vertical;box-sizing:border-box">${escapeHtml(s.nota_jefe || '')}</textarea>
      </div>
      <div style="display:flex;gap:8px">
        <button class="btn btn-success btn-sm" onclick="jefeProcesarSolicitud(${s.id},'aprobar',${s.etapa_id||'null'});_cerrarVerSolicitud()">✓ Aprobar y enviar</button>
        <button class="btn btn-danger btn-sm" onclick="jefeProcesarSolicitud(${s.id},'rechazar',${s.etapa_id||'null'});_cerrarVerSolicitud()">✕ Rechazar</button>
      </div>`;
      else if (s.estado === 'enviado_repuestos') accion = `<button class="btn btn-primary btn-sm" data-sol-id="${s.id}" style="margin-top:12px" onclick="_cerrarVerSolicitud();_abrirCotizarPorId(this)">📝 Cotizar</button>`;
      else if (s.estado === 'cotizado') accion = `<button class="btn btn-primary btn-sm" style="margin-top:12px" onclick="_cerrarVerSolicitud();abrirModalPrecioVenta(${s.id})">💲 Definir precio y ordenar</button>`;
      else if (s.estado === 'pedido') accion = `<button class="btn btn-success btn-sm" style="margin-top:12px" onclick="jefeLlegadaYEntrega(${s.id},${s.etapa_id||'null'});_cerrarVerSolicitud()">✓ Llegó y entregar al técnico</button>`;
      else if (s.estado === 'recibido_taller') accion = `<button class="btn btn-success btn-sm" style="margin-top:12px" onclick="jefeConfirmarEntrega(${s.id},${s.etapa_id||'null'});_cerrarVerSolicitud()">✓ Entregar al técnico</button>`;
    }

    const div = document.createElement('div');
    div.id = 'modal-ver-solicitud';
    div.style.cssText = 'position:fixed;inset:0;z-index:11000;background:rgba(0,0,0,.4);display:flex;align-items:flex-start;justify-content:center;padding:24px 12px;overflow-y:auto';
    div.onclick = (e) => { if (e.target === div) _cerrarVerSolicitud(); };
    div.innerHTML = `<div style="background:#fff;border-radius:14px;max-width:480px;width:100%;padding:18px 20px;box-shadow:0 10px 40px rgba(0,0,0,.2)">
      <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:10px;margin-bottom:8px">
        <div>
          <div style="font-family:'DM Mono',monospace;font-weight:700;font-size:18px;letter-spacing:.5px">${escapeHtml(o?.placa || '—')}</div>
          <div style="font-size:12px;color:var(--gris-mid)">${escapeHtml(o?.propietario || 'Cliente —')} · ${formatOT(s.orden_id)}${[o?.marca,o?.linea].filter(Boolean).length ? ' · '+escapeHtml([o.marca,o.linea].filter(Boolean).join(' ')) : ''}</div>
        </div>
        <button onclick="_cerrarVerSolicitud()" style="background:none;border:none;font-size:24px;line-height:1;cursor:pointer;color:var(--gris-mid)">×</button>
      </div>
      <span class="badge ${est.cls}">${est.txt}</span>
      ${_barraEstado(s.estado)}
      <div style="font-size:11px;color:var(--gris-mid);margin-bottom:10px">Solicitó: <strong>${escapeHtml(s.solicitado_por || '—')}</strong> · ${s.creado_en ? formatTS(s.creado_en) : '—'}${o?.vin ? `<br>VIN: <span style="font-family:'DM Mono',monospace">${escapeHtml(o.vin)}</span>` : ''}</div>
      <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:var(--gris-mid);margin-bottom:2px">Repuestos</div>
      ${itemsHtml}
      ${s.nota_jefe && s.estado !== 'pendiente_jefe' ? `<div style="font-size:12px;background:var(--gris-bg);padding:8px 10px;border-radius:6px;border-left:3px solid var(--azul);margin-top:10px">Nota: ${escapeHtml(s.nota_jefe)}</div>` : ''}
      ${accion}
    </div>`;
    document.body.appendChild(div);
  } catch (e) { toast('Error: ' + e.message, 'err'); }
}

// ── Reanuda el timer de una etapa pausada y registra el tiempo de espera ──
async function _reanudarEtapa(etapaId, solicitudId) {
  if (!etapaId) return;
  try {
    const etapa = await api(`/etapas?id=eq.${etapaId}`).then(r => r?.[0]);
    if (!etapa || !etapa.pausado) return;
    const pausaMs = etapa.pausa_inicio
      ? Date.now() - new Date(etapa.pausa_inicio).getTime()
      : 0;
    const pausaMin = Math.max(0, Math.round(pausaMs / 60000));
    const tiempoPausadoTotal = (etapa.tiempo_pausado_min || 0) + pausaMin;
    await api(`/etapas?id=eq.${etapaId}`, 'PATCH', {
      pausado: false,
      pausa_inicio: null,
      tiempo_pausado_min: tiempoPausadoTotal
    });
    if (solicitudId) {
      await api(`/solicitudes_repuesto?id=eq.${solicitudId}`, 'PATCH', {
        tiempo_espera_min: pausaMin
      }).catch(() => {});
    }
  } catch(e) { console.error('Error reanudando etapa:', e); }
}

async function jefeProcesarSolicitud(id, accion, etapaId) {
  const nota = document.getElementById(`nota-jefe-${id}`)?.value.trim()||null;
  await api(`/solicitudes_repuesto?id=eq.${id}`,'PATCH',{estado:accion==='aprobar'?'enviado_repuestos':'rechazado',nota_jefe:nota});

  // Si se rechaza, reanudar inmediatamente la etapa del mecánico
  if (accion === 'rechazar' && etapaId) {
    await _reanudarEtapa(etapaId, id);
    toast('Rechazado — ▶ Etapa del mecánico reanudada');
  } else {
    toast(accion==='aprobar' ? 'Enviado a repuestos ✓' : 'Rechazado');
  }
  cargarRepuestosJefe(); actualizarBadgeRepuestos();
}

// Jefe confirma que el repuesto llegó al taller (paso 1 de 2)
async function jefeConfirmarLlegada(solicitudId) {
  try {
    const ahora = new Date().toISOString();
    await api(`/solicitudes_repuesto?id=eq.${solicitudId}`, 'PATCH', {
      estado: 'recibido_taller',
      recibido_en: ahora,
      nota_jefe: 'El repuesto llegó al taller. Pendiente de entrega al técnico.'
    });

    // Notificar al técnico por Telegram
    const sol = await api(`/solicitudes_repuesto?id=eq.${solicitudId}&select=*`).then(r=>r?.[0]).catch(()=>null);
    if (sol?.etapa_id) {
      const etapa = await api(`/etapas?id=eq.${sol.etapa_id}&select=mecanico_id,tecnico`).then(r=>r?.[0]).catch(()=>null);
      const mec   = etapa?.mecanico_id ? await api(`/mecanicos?id=eq.${etapa.mecanico_id}&select=nombre,telegram_chat_id`).then(r=>r?.[0]).catch(()=>null) : null;
      const orden = sol.orden_id ? await api(`/ordenes?id=eq.${sol.orden_id}&select=placa`).then(r=>r?.[0]).catch(()=>null) : null;
      if (mec?.telegram_chat_id) {
        fetch(N8N_REPUESTO, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            evento: 'repuesto_llegado_taller',
            telegram_chat_id: mec.telegram_chat_id,
            tecnico: mec.nombre || etapa?.tecnico || '',
            repuesto: sol.repuesto,
            placa: orden?.placa || '',
            ot: formatOT(sol.orden_id)
          })
        }).catch(()=>{});
      }
    }

    toast('✓ Repuesto en taller — entrega al técnico para reanudar su timer');
    cargarRepuestosJefe();
  } catch(e) { toast('Error: ' + e.message, 'err'); }
}

// Jefe entrega el repuesto al técnico y reanuda su timer (paso 2 de 2)
async function jefeConfirmarEntrega(solicitudId, etapaId) {
  try {
    await api(`/solicitudes_repuesto?id=eq.${solicitudId}`, 'PATCH', {
      estado: 'entregado',
      nota_jefe: '✅ Repuesto entregado — puedes continuar con tu trabajo.'
    });
    if (etapaId) {
      await _reanudarEtapa(etapaId, solicitudId);
      toast('Repuesto entregado al técnico ✓ — ▶ Timer reanudado');
    } else {
      toast('Repuesto entregado ✓');
    }
    cargarRepuestosJefe();
  } catch(e) { toast('Error: ' + e.message, 'err'); }
}

// Llegó + entregado en UN solo paso (antes eran 2): marca recibido y entregado,
// y reanuda el timer del técnico.
async function jefeLlegadaYEntrega(solicitudId, etapaId) {
  try {
    await api(`/solicitudes_repuesto?id=eq.${solicitudId}`, 'PATCH', {
      estado: 'entregado',
      recibido_en: new Date().toISOString(),
      nota_jefe: '✅ Repuesto llegó y fue entregado — puedes continuar con tu trabajo.'
    });
    if (etapaId) {
      await _reanudarEtapa(etapaId, solicitudId);
      toast('Repuesto entregado al técnico ✓ — ▶ Timer reanudado');
    } else {
      toast('Repuesto entregado ✓');
    }
    if (typeof cargarRepuestosJefe === 'function') cargarRepuestosJefe();
  } catch(e) { toast('Error: ' + e.message, 'err'); }
}

async function abrirModalPrecioVenta(solicitudId) {
  const [cots, sol] = await Promise.all([
    api(`/cotizaciones_repuesto?solicitud_id=eq.${solicitudId}&order=opcion.asc&select=*,proveedores(nombre,whatsapp)`).catch(() => []) || [],
    api(`/solicitudes_repuesto?id=eq.${solicitudId}`).then(r => r?.[0]).catch(() => null)
  ]);
  _pvCerrarModal();

  // Guardar globalmente para que devolverRepuestoATecnico las use
  window._pvCots = cots;
  window._pvSol  = sol;

  // Pre-seleccionar la que ya tenga precio_venta_jefe, o la primera
  const presel = cots.find(c => c.precio_venta_jefe) || cots[0];
  window._pvSeleccionada = presel?.id || null;

  const div = document.createElement('div');
  div.id = 'modal-precio-venta';
  div.className = 'modal-overlay show';
  div.innerHTML = `
    <div class="modal" style="max-width:580px">
      <div class="modal-header">
        <div class="modal-titulo">Precio venta — ${escapeHtml(sol?.repuesto || '')}</div>
        <button class="modal-close" onclick="_pvCerrarModal()">✕</button>
      </div>
      <div class="modal-body">
        <p style="font-size:13px;color:var(--gris-mid);margin-bottom:16px">
          Selecciona la opción y define el precio de venta. Llama al cliente, confirma el valor y luego guarda aquí el precio acordado.
        </p>
        ${cots.length ? cots.map(c => {
          const sug = c.precio_costo ? Math.round(c.precio_costo * 1.4) : null;
          const seleccionado = c.id === window._pvSeleccionada;
          return `
          <div id="pv-card-${c.id}"
            onclick="_pvSeleccionar(${c.id}, [${cots.map(x => x.id).join(',')}])"
            style="
              border-radius:10px;padding:14px 16px;margin-bottom:10px;cursor:pointer;
              transition:border-color .15s, background .15s;
              border:2px solid ${seleccionado ? 'var(--azul)' : 'var(--gris-borde)'};
              background:${seleccionado ? 'var(--azul-bg,#EBF2FF)' : 'var(--gris-bg)'};
            ">
            <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px">
              <div id="pv-radio-${c.id}" style="
                width:18px;height:18px;border-radius:50%;flex-shrink:0;
                border:2px solid ${seleccionado ? 'var(--azul)' : 'var(--gris-mid)'};
                background:${seleccionado ? 'var(--azul)' : 'transparent'};
                display:flex;align-items:center;justify-content:center;
              ">${seleccionado ? '<div style="width:7px;height:7px;border-radius:50%;background:#fff"></div>' : ''}</div>
              <div style="font-weight:700;font-size:13px;color:${seleccionado ? 'var(--azul)' : 'var(--texto)'}">
                ${_OP_LABELS[c.opcion] || 'Opción ' + c.opcion}
              </div>
            </div>
            <div style="font-size:12px;color:var(--gris-mid);margin-bottom:10px;padding-left:28px">
              Proveedor: <strong>${escapeHtml(c.proveedores?.nombre || '—')}</strong> &nbsp;·&nbsp;
              Costo taller: <strong>${formatCOP(c.precio_costo)}</strong>
              ${sug ? `&nbsp;·&nbsp;<span style="color:var(--verde);font-weight:600">Sugerido +40%: ${formatCOP(sug)}</span>` : ''}
            </div>
            <div style="padding-left:28px" onclick="event.stopPropagation()">
              <label style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:var(--gris-mid);display:block;margin-bottom:5px">
                Precio venta al cliente (COP)
              </label>
              <div style="display:flex;gap:8px;align-items:center">
                <input type="number" id="pv-${c.id}"
                  value="${c.precio_venta_jefe || (sug || '')}"
                  placeholder="0" min="0"
                  style="font-family:'DM Mono',monospace;flex:1;padding:9px 12px;border:1px solid var(--gris-borde);border-radius:7px;font-size:14px">
              </div>
            </div>
          </div>`;
        }).join('') : '<p style="color:var(--gris-mid)">Sin cotizaciones aún.</p>'}

        <!-- Devolver al técnico -->
        <div style="margin-top:18px;padding-top:16px;border-top:1px solid var(--gris-borde)">
          <div style="font-size:12px;font-weight:700;color:var(--rojo);margin-bottom:8px;text-transform:uppercase;letter-spacing:.4px">
            ¿Ninguna opción funciona?
          </div>
          <div style="display:flex;gap:8px;align-items:flex-start">
            <input id="pv-nota-devolucion" type="text" placeholder="Motivo para el técnico (opcional)"
              style="flex:1;padding:9px 12px;border:1px solid var(--gris-borde);border-radius:7px;font-size:13px">
            <button class="btn btn-sm" onclick="devolverRepuestoATecnico(${solicitudId})"
              style="background:var(--rojo-bg,#FEE2E2);color:var(--rojo,#DC2626);border:1px solid var(--rojo,#DC2626);white-space:nowrap;flex-shrink:0">
              ↩ Devolver al técnico
            </button>
          </div>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-ghost" onclick="_pvCerrarModal()">Cancelar</button>
        ${cots.length ? `<button class="btn btn-primary" onclick="guardarPrecioVentaSeleccionado(${solicitudId})">
          Confirmar precio de venta
        </button>` : ''}
      </div>
    </div>`;
  document.body.appendChild(div);
}

function _pvSeleccionar(cotId, todosIds) {
  window._pvSeleccionada = cotId;
  todosIds.forEach(id => {
    const card  = document.getElementById(`pv-card-${id}`);
    const radio = document.getElementById(`pv-radio-${id}`);
    const lbl   = card?.querySelector('div[style*="font-weight:700;font-size:13px"]');
    const sel   = id === cotId;
    if (card) {
      card.style.borderColor = sel ? 'var(--azul)' : 'var(--gris-borde)';
      card.style.background  = sel ? 'var(--azul-bg,#EBF2FF)' : 'var(--gris-bg)';
    }
    if (radio) {
      radio.style.borderColor = sel ? 'var(--azul)' : 'var(--gris-mid)';
      radio.style.background  = sel ? 'var(--azul)' : 'transparent';
      radio.innerHTML = sel ? '<div style="width:7px;height:7px;border-radius:50%;background:#fff"></div>' : '';
    }
    if (lbl) lbl.style.color = sel ? 'var(--azul)' : 'var(--texto)';
  });
}

async function guardarPrecioVentaSeleccionado(solicitudId) {
  const cotId = window._pvSeleccionada;
  if (!cotId) { toast('Selecciona una opción primero', 'err'); return; }
  const val = parseFloat(document.getElementById(`pv-${cotId}`)?.value) || 0;
  if (!val) { toast('Ingresa el precio de venta', 'err'); document.getElementById(`pv-${cotId}`)?.focus(); return; }

  const cots = window._pvCots || [];
  const cot  = cots.find(c => c.id === cotId);
  const sol  = window._pvSol;

  // Nota visible para el técnico
  const notaTecnico = [
    `✓ Repuesto aprobado: ${sol?.repuesto || ''}`,
    cot ? `Opción elegida: ${_OP_LABELS[cot.opcion] || 'Opción ' + cot.opcion}` : '',
    cot?.proveedores?.nombre ? `Proveedor: ${cot.proveedores.nombre}` : '',
    `Precio de venta al cliente: ${formatCOP(val)}`
  ].filter(Boolean).join(' — ');

  try {
    await api(`/cotizaciones_repuesto?id=eq.${cotId}`, 'PATCH', { precio_venta_jefe: val });
    await api(`/solicitudes_repuesto?id=eq.${solicitudId}`, 'PATCH', {
      estado: 'pedido',
      nota_jefe: notaTecnico,
      pedido_en: new Date().toISOString()
    });
    toast('Precio definido ✓ — ahora espera que llegue el repuesto');
    _pvCerrarModal();
    cargarRepuestosJefe();
  } catch(e) { toast('Error: ' + e.message, 'err'); }
}

async function devolverRepuestoATecnico(solicitudId) {
  const motivoExtra = document.getElementById('pv-nota-devolucion')?.value.trim();
  const cots = window._pvCots || [];

  // Construir resumen de opciones con precios sugeridos
  let resumenOpciones = '';
  if (cots.length) {
    resumenOpciones = cots.map(c => {
      const sug = c.precio_costo ? Math.round(c.precio_costo * 1.4) : null;
      return `${_OP_LABELS[c.opcion] || 'Opción ' + c.opcion}: costo ${formatCOP(c.precio_costo)}${sug ? ' → sugerido ' + formatCOP(sug) : ''}`;
    }).join(' | ');
  }

  const nota = [
    motivoExtra || 'Repuesto devuelto para revisión.',
    resumenOpciones ? `Opciones cotizadas: ${resumenOpciones}` : ''
  ].filter(Boolean).join(' — ');

  try {
    await api(`/solicitudes_repuesto?id=eq.${solicitudId}`, 'PATCH', {
      estado: 'rechazado',
      nota_jefe: nota
    });
    toast('Solicitud devuelta al técnico ✓');
    _pvCerrarModal();
    cargarRepuestosJefe();
  } catch(e) { toast('Error: ' + e.message, 'err'); }
}

// ─────────────────────────────────────────────────────────
// PERFIL REPUESTOS
// ─────────────────────────────────────────────────────────
async function montarRepuestos() {
  const sidebarNav = document.getElementById('sidebar-nav');
  if (sidebarNav) {
    sidebarNav.innerHTML = `
      <div class="nav-section-label">Repuestos</div>
      <button class="nav-item active" id="nav-rep-solicitudes" onclick="mostrarSeccionRep('solicitudes')">
        <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2"/><rect x="9" y="3" width="6" height="4" rx="1"/></svg>
        Solicitudes
      </button>
      <button class="nav-item" id="nav-rep-proveedores" onclick="mostrarSeccionRep('proveedores')">
        <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/></svg>
        Proveedores
      </button>`;
  }
  const bottomNav = document.getElementById('bottom-nav-inner');
  if (bottomNav) {
    bottomNav.innerHTML = `
      <button class="bnav-item active" id="bnav-rep-solicitudes" onclick="mostrarSeccionRep('solicitudes')">
        <svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2"/><rect x="9" y="3" width="6" height="4" rx="1"/></svg>
        <span>Solicitudes</span>
      </button>
      <button class="bnav-item" id="bnav-rep-proveedores" onclick="mostrarSeccionRep('proveedores')">
        <svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/></svg>
        <span>Proveedores</span>
      </button>
    `;
  }

  const title = document.getElementById('topbar-title');
  if (title) title.textContent = 'Repuestos';
  mostrarPagina('pag-repuestos');
  cargarSolicitudesRepuestos();

  // Indicador neón de solicitudes pendientes por atender (refresca cada 30s)
  actualizarBadgeRepPerfil();
  if (!window._repPerfilBadgeInt) {
    window._repPerfilBadgeInt = setInterval(actualizarBadgeRepPerfil, 30000);
  }
}

async function actualizarBadgeRepPerfil() {
  try {
    const p = await api('/solicitudes_repuesto?estado=eq.enviado_repuestos&select=id').catch(() => []) || [];
    if (typeof _setNavBadge === 'function') _setNavBadge('nav-rep-solicitudes', p.length);
  } catch (e) {}
}

function mostrarSeccionRep(sec) {
  if (typeof _navMarcarVisto === 'function') _navMarcarVisto('nav-rep-' + sec);
  _repSeccionActual = sec;
  const btnSol   = document.getElementById('nav-rep-solicitudes');
  const btnProv  = document.getElementById('nav-rep-proveedores');
  const bnavSol  = document.getElementById('bnav-rep-solicitudes');
  const bnavProv = document.getElementById('bnav-rep-proveedores');
  if (btnSol)   btnSol.classList.toggle('active',   sec === 'solicitudes');
  if (btnProv)  btnProv.classList.toggle('active',  sec === 'proveedores');
  if (bnavSol)  bnavSol.classList.toggle('active',  sec === 'solicitudes');
  if (bnavProv) bnavProv.classList.toggle('active', sec === 'proveedores');
  if (sec === 'solicitudes') cargarSolicitudesRepuestos();
  else cargarProveedores();
}

async function cargarSolicitudesRepuestos() {
  const cont = document.getElementById('rep-contenido');
  if (!cont) return;
  // "Cargando..." solo en la PRIMERA carga (no en cada tick del polling): así
  // el auto-refresco no produce el flash blanco. El contenido se actualiza con
  // renderSinParpadeo (morph del DOM) más abajo.
  mostrarCargandoSiVacio(cont, '<div class="loading-state">Cargando...</div>');

  try {
    const sols = await api('/solicitudes_repuesto?estado=in.(enviado_repuestos,cotizado,pedido,recibido_taller,entregado)&order=creado_en.desc&select=*').catch(()=>[]) || [];
    const oids = [...new Set(sols.map(s=>s.orden_id).filter(Boolean))];
    const ords = oids.length ? await api(`/ordenes?id=in.(${oids.join(',')})&select=id,placa,marca,linea,modelo,vin,propietario`).catch(()=>[]) || [] : [];
    const om = {}; ords.forEach(o=>{ om[o.id]=o; });

    // Cargar ítems de solicitud_items para todas las solicitudes
    const solIds = sols.map(s => s.id);
    const todosItems = solIds.length
      ? await api(`/solicitud_items?solicitud_id=in.(${solIds.join(',')})&order=creado_en.asc`).catch(()=>[]) || []
      : [];

    _solRegistry = {};
    sols.forEach(s => {
      const o = om[s.orden_id] || {};
      _solRegistry[s.id] = {
        solicitudId: s.id, repuesto: s.repuesto||'', unidades: s.unidades||1,
        placa: o.placa||'', marca: o.marca||'', modelo: o.linea||'',
        anio: o.modelo||'', vin: o.vin||''
      };
    });

    if (!sols.length) {
      renderSinParpadeo(cont, `<div style="padding:20px"><div style="font-size:16px;font-weight:700;margin-bottom:16px">Solicitudes</div><div class="empty-state"><p>Sin solicitudes asignadas</p></div></div>`);
      return;
    }

    const estadoBadge = {
      enviado_repuestos: { cls:'badge-iniciada',   txt:'Por cotizar' },
      cotizado:          { cls:'badge-cotizada',   txt:'Cotizado' },
      pedido:            { cls:'badge-iniciada',   txt:'Pedido al proveedor' },
      recibido_taller:   { cls:'badge-completada', txt:'Llegó al taller' },
      entregado:         { cls:'badge-completada', txt:'Entregado' }
    };

    // Pendientes / en proceso = vista principal (recuadros). Entregados = aparte.
    const pendientes = sols.filter(s => s.estado !== 'entregado');
    const entregados = sols.filter(s => s.estado === 'entregado').slice(0, 40);

    renderSinParpadeo(cont, `<div style="padding:20px">
      <div style="font-size:16px;font-weight:700;margin-bottom:16px">Solicitudes de repuestos</div>
      ${pendientes.length ? `<div style="display:flex;flex-direction:column;gap:6px">
        ${pendientes.map(s => {
          const o = om[s.orden_id] || {};
          const items = todosItems.filter(i => i.solicitud_id === s.id);
          const eb = estadoBadge[s.estado] || { cls:'', txt: s.estado };
          const repNames = items.length ? items.map(i => i.repuesto) : [s.repuesto].filter(Boolean);
          const repResumen = repNames.slice(0, 2).map(escapeHtml).join(', ') + (repNames.length > 2 ? ` <span style="color:var(--gris-mid);font-weight:400">+${repNames.length - 2}</span>` : '');
          const tEstado = _tiempoDesde(s.actualizado_en || s.creado_en, ' en estado');
          // Espera del proveedor (si ya se pidió)
          let espera = '';
          if (s.pedido_en) {
            const finTs = s.recibido_en ? new Date(s.recibido_en) : new Date();
            const mins  = Math.round((finTs - new Date(s.pedido_en)) / 60000);
            const h = Math.floor(mins/60), m = mins%60;
            espera = ` · ⏱ ${s.recibido_en ? 'tardó' : 'esperando'} ${h > 0 ? h+'h ' : ''}${m}m`;
          }
          let accionBtns = '';
          if (s.estado === 'enviado_repuestos' || s.estado === 'cotizado') accionBtns = `<button class="btn btn-primary btn-xs" data-sol-id="${s.id}" onclick="_abrirCotizarPorId(this)">${s.estado === 'enviado_repuestos' ? '+ Cotizar' : 'Cotizaciones'}</button>`;
          else if (s.estado === 'pedido' && !s.pedido_proveedor_confirmado) accionBtns = `<button class="btn btn-success btn-xs" onclick="marcarRepuestoSolicitadoProveedor(${s.id})">Confirmar pedido</button>`;
          else if (s.estado === 'pedido' && s.pedido_proveedor_confirmado) accionBtns = `<span style="font-size:11px;color:#059669;font-weight:600;white-space:nowrap">✓ Pedido confirmado</span>`;

          return `<div class="card" data-id="${s.id}" style="display:flex;align-items:center;gap:12px;padding:9px 12px">
            <div style="min-width:80px;flex-shrink:0">
              <div style="font-family:'DM Mono',monospace;font-weight:700;font-size:14px;color:#0F172A;letter-spacing:.5px">${escapeHtml(o.placa||'—')}</div>
              <div style="font-size:10px;color:var(--gris-mid);font-family:'DM Mono',monospace">${formatOT(s.orden_id)}</div>
            </div>
            <div style="flex:1;min-width:0">
              <div title="${escapeHtml(repNames.join(', '))}" style="font-size:13px;font-weight:600;color:#1E293B;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${repResumen || '—'}</div>
              <div style="font-size:11px;color:var(--gris-mid);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escapeHtml(o.propietario||'Cliente —')} · ${tEstado}${espera}</div>
            </div>
            <div style="width:118px;flex-shrink:0">${_barraEstadoMini(s.estado)}</div>
            <span class="badge ${eb.cls}" style="flex-shrink:0">${eb.txt}</span>
            <div style="display:flex;gap:6px;flex-shrink:0">
              ${accionBtns}
              <button class="btn btn-ghost btn-xs" onclick="_verSolicitud(${s.id})">Ver</button>
            </div>
          </div>`;
        }).join('')}
      </div>` : `<div class="empty-state" style="padding:24px 0"><p>✓ Sin solicitudes pendientes</p></div>`}
      ${entregados.length ? `<div style="margin-top:20px;border-top:1px solid var(--gris-borde);padding-top:14px">
        <button class="btn btn-ghost btn-sm" onclick="_toggleEntregados()" style="display:inline-flex;align-items:center;gap:6px">${_repVerEntregados ? '▾' : '▸'} Entregados · ${entregados.length}</button>
        ${_repVerEntregados ? `<div style="margin-top:10px;display:flex;flex-direction:column;gap:6px">
          ${entregados.map(s => {
            const o = om[s.orden_id] || {};
            const its = todosItems.filter(i => i.solicitud_id === s.id);
            const reps = (its.length ? its.map(i => i.repuesto) : [s.repuesto].filter(Boolean)).slice(0, 2).map(escapeHtml).join(', ');
            return `<div style="display:flex;align-items:center;gap:10px;padding:8px 12px;border:1px solid var(--gris-borde);border-radius:8px;background:#F8FAFC">
              <span style="font-family:'DM Mono',monospace;font-weight:700;font-size:13px;color:#0F172A;min-width:64px">${escapeHtml(o.placa || '—')}</span>
              <span style="flex:1;min-width:0;font-size:12px;color:#475569;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${reps || '—'}</span>
              <span class="badge badge-completada" style="flex-shrink:0">Entregado</span>
              <button class="btn btn-ghost btn-xs" onclick="_verSolicitud(${s.id})">Ver</button>
            </div>`;
          }).join('')}
        </div>` : ''}
      </div>` : ''}
    </div>`);

    iniciarPollingRepuestos(() => {
      if (!document.getElementById('rep-contenido')) { detenerPollingRepuestos(); return; }
      if (_repSeccionActual === 'solicitudes') cargarSolicitudesRepuestos();
    });
  } catch(e) { cont.innerHTML = `<div class="empty-state">Error: ${e.message}</div>`; }
}

// Repuestos confirma que ya se hizo el pedido al proveedor elegido
async function marcarRepuestoSolicitadoProveedor(solicitudId) {
  try {
    // Obtener datos para Telegram
    const sol   = await api(`/solicitudes_repuesto?id=eq.${solicitudId}&select=*`).then(r=>r?.[0]).catch(()=>null);
    const orden = sol?.orden_id ? await api(`/ordenes?id=eq.${sol.orden_id}&select=placa`).then(r=>r?.[0]).catch(()=>null) : null;
    let mecTelegram = null, mecNombre = '';
    if (sol?.etapa_id) {
      const etapa = await api(`/etapas?id=eq.${sol.etapa_id}&select=mecanico_id,tecnico`).then(r=>r?.[0]).catch(()=>null);
      if (etapa?.mecanico_id) {
        const mec = await api(`/mecanicos?id=eq.${etapa.mecanico_id}&select=nombre,telegram_chat_id`).then(r=>r?.[0]).catch(()=>null);
        mecTelegram = mec?.telegram_chat_id || null;
        mecNombre   = mec?.nombre || etapa?.tecnico || '';
      }
    }

    if (mecTelegram) {
      fetch(N8N_REPUESTO, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          evento: 'repuesto_pedido_proveedor',
          telegram_chat_id: mecTelegram,
          tecnico: mecNombre,
          repuesto: sol?.repuesto || '',
          placa: orden?.placa || '',
          ot: formatOT(sol?.orden_id||0)
        })
      }).catch(()=>{});
    }

    // Marcar en DB que ya se confirmó el pedido al proveedor
    await api(`/solicitudes_repuesto?id=eq.${solicitudId}`, 'PATCH', {
      pedido_proveedor_confirmado: true
    }).catch(() => {});

    toast('✓ Pedido confirmado al proveedor — técnico notificado');
    cargarSolicitudesRepuestos();
  } catch(e) { toast('Error: ' + e.message, 'err'); }
}

// ── Filas de la tabla de cotización ─────────────────────
let _cotFilas = []; // [{id, seleccionado, proveedorId, referencia, precio, dias, esOriginal}]

// Datos del vehículo disponibles para el mensaje WA (se setean en abrirModalCotizar)
let _cotDatosVehiculo = { repuesto:'', unidades:1, placa:'', marca:'', modelo:'', anio:'', vin:'', items:[] };

function _generarMensajeWA() {
  const d = _cotDatosVehiculo;
  const vehiculo = [d.marca, d.modelo, d.anio].filter(Boolean).join(' ') || '—';
  const placaStr = d.placa ? `\nPlaca: *${d.placa}*` : '';
  const vinStr   = d.vin   ? `\nVIN: *${d.vin}*`   : '';

  // Lista TODOS los repuestos de la solicitud (no solo el primero).
  const items = (d.items && d.items.length)
    ? d.items
    : [{ repuesto: d.repuesto, unidades: d.unidades }];
  const lista = items
    .filter(i => i.repuesto)
    .map(i => {
      const obs = i.observaciones ? ` (${i.observaciones})` : '';
      return `• ${i.repuesto} — ${i.unidades || 1} und${obs}`;
    })
    .join('\n') || '• (sin detalle)';

  return `Buenos días 👋\nSolicito cotización para el siguiente vehículo:\n\n🚗 Vehículo: *${vehiculo}*${placaStr}${vinStr}\n\n🔩 Repuestos:\n${lista}\n\nAgradezco me indiquen *precio*, *disponibilidad* y *tiempo de entrega*.\n¡Gracias!`;
}

function _copiarMensajeWA(filaId) {
  const msg = _generarMensajeWA();
  navigator.clipboard?.writeText(msg).then(() => toast('Mensaje copiado ✓'))
    .catch(() => { const ta = document.createElement('textarea'); ta.value = msg; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); ta.remove(); toast('Mensaje copiado ✓'); });
}

// Abre WhatsApp con el mensaje listo y el número del proveedor de esa fila.
// Si la fila no tiene proveedor (o el proveedor no tiene WhatsApp), abre
// WhatsApp igual con el mensaje cargado para elegir el contacto a mano.
function _enviarWA(filaId) {
  const msg = _generarMensajeWA();
  const sel = document.getElementById(`cot-prov-${filaId}`);
  const opt = sel?.selectedOptions?.[0];
  let tel = (opt?.dataset?.wa || '').replace(/\D/g, '');
  // Colombia: número local de 10 dígitos → anteponer indicativo 57.
  if (tel.length === 10) tel = '57' + tel;
  // Copiar también, como respaldo.
  navigator.clipboard?.writeText(msg).catch(() => {});
  const url = tel
    ? `https://wa.me/${tel}?text=${encodeURIComponent(msg)}`
    : `https://wa.me/?text=${encodeURIComponent(msg)}`;
  window.open(url, '_blank');
  if (!tel) toast('Ese proveedor no tiene WhatsApp guardado: se abrió con el mensaje listo para elegir contacto', 'info');
  // Registrar el contacto (para el fallback por tiempo). Robusto: si no existe
  // la tabla todavía, no rompe nada.
  const provId = sel?.value;
  if (provId && window._cotSolicitudId) {
    api('/contactos_repuesto', 'POST', { solicitud_id: _cotSolicitudId, proveedor_id: +provId, contactado_en: new Date().toISOString() }, { Prefer: 'return=minimal' })
      .then(() => { _cargarContactosCot(); }).catch(() => {});
  }
}

// Carga y muestra los proveedores ya contactados para la solicitud abierta,
// resaltando los que llevan > umbral horas sin respuesta (fallback por tiempo).
let _cotSolicitudId = null;
const _COT_UMBRAL_HORAS = 3;
async function _cargarContactosCot() {
  const cont = document.getElementById('cot-contactos');
  if (!cont || !_cotSolicitudId) return;
  const ctos = await api(`/contactos_repuesto?solicitud_id=eq.${_cotSolicitudId}&order=contactado_en.asc&select=proveedor_id,contactado_en`).catch(() => []) || [];
  if (!ctos.length) { cont.innerHTML = ''; return; }
  // Último contacto por proveedor
  const ult = {};
  ctos.forEach(c => { ult[c.proveedor_id] = c.contactado_en; });
  const nombre = id => (_provRegistry && _provRegistry[id]?.nombre) || ('Prov ' + id);
  const chips = Object.entries(ult).map(([id, ts]) => {
    const h = (Date.now() - new Date(ts).getTime()) / 3600000;
    const sinResp = h >= _COT_UMBRAL_HORAS;
    const txt = h < 1 ? 'hace ' + Math.round(h * 60) + ' min' : 'hace ' + Math.round(h) + ' h';
    return `<span style="display:inline-flex;align-items:center;gap:4px;font-size:10.5px;padding:2px 8px;border-radius:99px;${sinResp ? 'background:#FEF3C7;color:#92400E;font-weight:700' : 'background:#EEF2F7;color:var(--azul)'}">${sinResp ? '⏰' : '✓'} ${escapeHtml(nombre(id))} · ${txt}${sinResp ? ' · sin respuesta' : ''}</span>`;
  }).join(' ');
  const haySinResp = Object.values(ult).some(ts => (Date.now() - new Date(ts).getTime()) / 3600000 >= _COT_UMBRAL_HORAS);
  cont.innerHTML = `<div style="margin-top:6px;display:flex;flex-wrap:wrap;gap:5px;align-items:center">
    <span style="font-size:10px;color:var(--gris-mid);text-transform:uppercase;letter-spacing:.5px">Contactados:</span>${chips}
    ${haySinResp ? '<span style="font-size:10.5px;color:#B45309">→ prueba el siguiente proveedor</span>' : ''}
  </div>`;
}

const _CELL = 'border:none;border-right:1px solid #E2E8F0;background:transparent;width:100%;font-size:12.5px;padding:7px 8px;outline:none;font-family:inherit';

function _renderFilaCot(fila, idx, provOpts) {
  const bg = idx % 2 === 0 ? '#fff' : '#F8FAFC';
  return `<tr id="cot-fila-${fila.id}" style="background:${bg};border-bottom:1px solid #E2E8F0"
    onmouseover="this.style.background='#EFF6FF'" onmouseout="this.style.background='${bg}'">
    <td style="padding:6px 8px;text-align:center;color:#94A3B8;font-size:11px;font-weight:600;border-right:1px solid #E2E8F0;width:32px">${idx+1}</td>
    <td style="padding:0;border-right:1px solid #E2E8F0">
      <select id="cot-prov-${fila.id}" style="${_CELL}cursor:pointer">
        ${provOpts}
      </select>
    </td>
    <td style="padding:0;border-right:1px solid #E2E8F0">
      <input id="cot-precio-${fila.id}" type="number" value="${fila.precio||''}"
        placeholder="0" min="0" style="${_CELL}text-align:right;font-family:'DM Mono',monospace;font-weight:600">
    </td>
    <td style="padding:0;border-right:1px solid #E2E8F0;width:54px">
      <input id="cot-dias-${fila.id}" type="number" value="${fila.dias||''}"
        placeholder="—" min="0" style="${_CELL}text-align:center;width:54px">
    </td>
    <td style="padding:0;text-align:center;border-right:1px solid #E2E8F0;width:80px">
      <label style="display:inline-flex;align-items:center;gap:3px;font-size:12px;cursor:pointer;padding:7px 4px">
        <input type="radio" name="cot-orig-${fila.id}" value="si" ${fila.esOriginal!==false?'checked':''}
          style="accent-color:var(--azul)"> Sí
      </label>
      <label style="display:inline-flex;align-items:center;gap:3px;font-size:12px;cursor:pointer;padding:7px 4px">
        <input type="radio" name="cot-orig-${fila.id}" value="no" ${fila.esOriginal===false?'checked':''}
          style="accent-color:var(--azul)"> No
      </label>
    </td>
    <td style="padding:4px 6px;text-align:center;border-right:1px solid #E2E8F0;width:50px">
      <button type="button" title="Enviar cotización por WhatsApp al proveedor" onclick="_enviarWA(${fila.id})"
        style="background:#25D366;color:#fff;border:none;border-radius:4px;padding:3px 7px;font-size:11px;cursor:pointer;font-weight:700">WA</button>
    </td>
    <td style="padding:4px 6px;text-align:center;width:28px">
      <button type="button" onclick="_quitarFilaCot(${fila.id})"
        style="background:none;border:none;cursor:pointer;color:#CBD5E1;font-size:15px;line-height:1;padding:2px 4px"
        onmouseover="this.style.color='#DC2626'" onmouseout="this.style.color='#CBD5E1'">✕</button>
    </td>
  </tr>`;
}

function _quitarFilaCot(id) {
  _cotFilas = _cotFilas.filter(f => f.id !== id);
  _reRenderFilasCot();
}

function _agregarFilaCot() {
  _cotFilas.push({ id: Date.now(), seleccionado: false, proveedorId: '', referencia: '', precio: '', dias: '', esOriginal: false });
  _reRenderFilasCot();
}

function _reRenderFilasCot() {
  const tbody = document.getElementById('cot-tabla-tbody');
  if (!tbody) return;
  const sel = document.getElementById('_cot-prov-opts');
  const provOpts = sel ? sel.value : '';
  tbody.innerHTML = _cotFilas.map((f, i) => _renderFilaCot(f, i, provOpts)).join('');
  // Re-restaurar valores de los selects
  _cotFilas.forEach(f => {
    const s = document.getElementById(`cot-prov-${f.id}`);
    if (s && f.proveedorId) s.value = f.proveedorId;
  });
}

// ── Filtro de proveedores por la MARCA del vehículo ────────────────
// Datos del proveedor desplegable de la cotización en curso.
let _cotProvData = { provConScore: [], vehMarca: '', favoritoId: null, cat: null };
let _cotVerTodosProv = false;

// ¿Este proveedor maneja la marca del vehículo? (sin marca del vehículo, o
// proveedor multimarca, o sin marcas configuradas → se muestra igual.)
function _provManejaMarca(p, vehMarca) {
  if (!vehMarca) return true;
  if (p.multimarca) return true;
  const ms = Array.isArray(p.marcas) ? p.marcas : [];
  if (!ms.length) return true; // aún sin configurar → no lo escondemos
  const t = String(vehMarca).trim().toUpperCase();
  return ms.some(m => String(m).trim().toUpperCase() === t);
}

// Arma las opciones del <select> de proveedor (filtradas por marca, salvo "ver todos").
function _buildProvOpts() {
  const { provConScore, vehMarca, favoritoId, cat } = _cotProvData;
  const lista = _cotVerTodosProv ? provConScore : provConScore.filter(p => _provManejaMarca(p, vehMarca));
  return '<option value="">— Seleccionar proveedor —</option>' + lista.map(p => {
    const star = p.id === favoritoId ? '★ ' : '';
    const sc = p._sc;
    const info = sc
      ? ` — ${sc.estrellas}★${sc.manual ? ' (manual)' : ''}${sc.avgDias != null ? ', ' + (Math.round(sc.avgDias*10)/10) + 'd' : ''}`
      : (p._tag ? ` — maneja ${cat}` : '');
    return `<option value="${p.id}" data-wa="${escapeHtml(p.whatsapp||'')}">${star}${escapeHtml(p.nombre)}${info}</option>`;
  }).join('');
}

// Texto/enlace del filtro de marca (cuántos ocultos + alternar "ver todos").
function _filtroMarcaHtml() {
  const { provConScore, vehMarca } = _cotProvData;
  if (!vehMarca) return `<span id="cot-filtro-marca"></span>`;
  const ocultos = provConScore.filter(p => !_provManejaMarca(p, vehMarca)).length;
  const link = `<a onclick="_toggleVerTodosProv()" style="color:var(--azul);cursor:pointer;font-weight:600">${_cotVerTodosProv ? 'filtrar por ' + escapeHtml(vehMarca) : 'ver todos'}</a>`;
  const txt = _cotVerTodosProv
    ? `Mostrando TODOS los proveedores`
    : `Solo proveedores de <b>${escapeHtml(vehMarca)}</b>${ocultos ? ` · ${ocultos} oculto${ocultos > 1 ? 's' : ''}` : ''}`;
  return `<span id="cot-filtro-marca" style="font-size:11px;color:var(--gris-mid)">${txt} · ${link}</span>`;
}

function _toggleVerTodosProv() {
  _cotVerTodosProv = !_cotVerTodosProv;
  const hid = document.getElementById('_cot-prov-opts');
  if (hid) hid.value = _buildProvOpts();
  _reRenderFilasCot();
  const t = document.getElementById('cot-filtro-marca');
  if (t) t.outerHTML = _filtroMarcaHtml();
}

// ── Puntaje de proveedores (desde el historial de cotizaciones) ──
// Combina velocidad de entrega (días promedio) y confianza (% de veces
// que su cotización fue la elegida por el jefe). Devuelve por proveedor:
// { n, elegido, avgDias, puntaje (0-100), estrellas (1-5) }.
async function _calcularScoresProveedores(categoria) {
  // Si hay categoría, rankea SOLO con el historial de esa categoría (a quién le
  // compras más ese tipo). Si no hay datos de la categoría (o no existe la
  // columna todavía), cae al ranking global. Así nunca se rompe.
  let cots = null;
  if (categoria) {
    cots = await api(`/cotizaciones_repuesto?select=proveedor_id,dias_entrega,precio_venta_jefe,solicitudes_repuesto!inner(categoria)&solicitudes_repuesto.categoria=eq.${encodeURIComponent(categoria)}`).catch(() => null);
  }
  if (!cots || !cots.length) {
    cots = await api('/cotizaciones_repuesto?select=proveedor_id,dias_entrega,precio_venta_jefe').catch(() => []) || [];
  }
  const stats = {};
  cots.forEach(c => {
    if (!c.proveedor_id) return;
    const s = stats[c.proveedor_id] || (stats[c.proveedor_id] = { n: 0, diasSum: 0, diasN: 0, elegido: 0 });
    s.n++;
    if (c.dias_entrega != null) { s.diasSum += (+c.dias_entrega || 0); s.diasN++; }
    if (c.precio_venta_jefe != null) s.elegido++;
  });
  const out = {};
  Object.entries(stats).forEach(([id, s]) => {
    const avgDias = s.diasN ? s.diasSum / s.diasN : null;
    const tasaElegido = s.n ? s.elegido / s.n : 0;
    // Velocidad de entrega (0-100) según días promedio.
    const velocidad = avgDias == null ? 55
      : avgDias <= 1 ? 100 : avgDias <= 2 ? 85 : avgDias <= 3 ? 70
      : avgDias <= 5 ? 55 : avgDias <= 7 ? 40 : 25;
    // Confianza (0-100) = % de veces que su cotización fue la elegida.
    const confianza = tasaElegido * 100;
    const bruto = velocidad * 0.6 + confianza * 0.4;
    // Amortiguación por tamaño de muestra: con poco historial el puntaje se
    // acerca a un valor neutro (50); con más cotizaciones refleja el desempeño
    // real. Evita que 1 sola cotización "afortunada" dé 5 estrellas.
    const w = s.n / (s.n + 3);
    const puntaje = Math.round(50 + (bruto - 50) * w);
    const estrellas = Math.max(1, Math.min(5, Math.round(puntaje / 20 * 2) / 2));
    out[id] = { n: s.n, elegido: s.elegido, avgDias, puntaje, estrellas, confiable: s.n >= 3 };
  });
  return out;
}

function _estrellasHtml(n) {
  if (n == null) return '<span style="color:var(--gris-mid)">—</span>';
  const full = Math.floor(n);
  const half = (n - full) >= 0.5;
  const empty = 5 - full - (half ? 1 : 0);
  return `<span style="color:#F59E0B;letter-spacing:1px">${'★'.repeat(full)}${half ? '⯨' : ''}${'<span style="color:#D1D5DB">★</span>'.repeat(Math.max(0, empty))}</span>`;
}

async function abrirModalCotizar(solicitudId, repuesto, unidades, placa, marca, modelo, anio, vin) {
  _cotSolicitudId = solicitudId;
  _cotDatosVehiculo = { repuesto: repuesto||'', unidades: unidades||1, placa: placa||'', marca: marca||'', modelo: modelo||'', anio: anio||'', vin: vin||'' };

  const [proveedores, cots, solItems, sol] = await Promise.all([
    api('/proveedores?activo=eq.true&order=nombre.asc').catch(()=>[]) || [],
    api(`/cotizaciones_repuesto?solicitud_id=eq.${solicitudId}&order=opcion.asc`).catch(()=>[]) || [],
    api(`/solicitud_items?solicitud_id=eq.${solicitudId}&order=creado_en.asc`).catch(()=>[]) || [],
    api(`/solicitudes_repuesto?id=eq.${solicitudId}`).then(r=>r?.[0]).catch(()=>null)
  ]);
  document.getElementById('modal-cotizar')?.remove();

  // Guardar todos los ítems para que el mensaje de WhatsApp los liste completos.
  _cotDatosVehiculo.items = solItems || [];

  // Score / favorito: rankeado por la CATEGORÍA de la solicitud (a quién le
  // compras más ese tipo); cae al global si no hay historial de la categoría.
  const _scores = await _calcularScoresProveedores(sol?.categoria);
  const _cat = sol?.categoria;
  // Boost: si el proveedor está etiquetado con la categoría de la solicitud,
  // sube en las sugerencias aunque no tenga historial todavía.
  const provConScore = proveedores.map(p => {
      const manual = (p.puntaje_manual != null && p.puntaje_manual !== '') ? Number(p.puntaje_manual) : null;
      const auto = _scores[p.id] || null;
      // El puntaje MANUAL manda sobre el automático cuando está definido.
      const _sc = manual != null
        ? { estrellas: manual, puntaje: Math.round(manual * 20), avgDias: auto?.avgDias ?? null, n: auto?.n || 0, manual: true }
        : auto;
      return { ...p, _sc, _tag: !!(_cat && Array.isArray(p.categorias) && p.categorias.includes(_cat)) };
    })
    .sort((a,b) => ((b._sc?.puntaje || 0) + (b._tag ? 15 : 0)) - ((a._sc?.puntaje || 0) + (a._tag ? 15 : 0)));
  const favorito   = provConScore.find(p => (p._sc && (p._sc.manual || p._sc.n > 0)) || p._tag) || null;
  const favoritoId = favorito?.id || null;

  // Guardar para el filtro por marca y armar las opciones (filtradas por la marca del vehículo).
  _cotVerTodosProv = false;
  _cotProvData = { provConScore, vehMarca: marca || '', favoritoId, cat: _cat };
  const provOpts = _buildProvOpts();

  // Filas iniciales
  _cotFilas = cots.length
    ? cots.map(c => ({ id: c.id, proveedorId: c.proveedor_id||'', referencia: c.referencia||'', precio: c.precio_costo||'', dias: c.dias_entrega||'', esOriginal: c.es_original !== false }))
    : [{ id: Date.now(), proveedorId: favoritoId||'', referencia:'', precio:'', dias:'', esOriginal:false },
       { id: Date.now()+1, proveedorId:'', referencia:'', precio:'', dias:'', esOriginal:false },
       { id: Date.now()+2, proveedorId:'', referencia:'', precio:'', dias:'', esOriginal:false }];

  // Info header
  const vehiculoStr = [marca, modelo, anio].filter(Boolean).join(' ') || placa || '';
  const timerStr    = sol?.creado_en ? _tiempoDesde(sol.creado_en, ' desde solicitud') : '';
  const favNom      = favorito ? favorito.nombre : null;

  const div = document.createElement('div');
  div.id = 'modal-cotizar';
  div.className = 'modal-overlay show';
  div.innerHTML = `
    <input type="hidden" id="_cot-prov-opts" value="">
    <div class="modal" style="max-width:780px;width:95vw;padding:0;overflow:hidden;border-radius:10px">

      <!-- CABECERA -->
      <div style="padding:14px 18px 10px;border-bottom:1px solid var(--gris-borde)">
        <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:10px">
          <div>
            <div style="font-size:15px;font-weight:700;color:var(--texto)">${escapeHtml(repuesto)} <span style="font-size:13px;font-weight:500;color:var(--gris-mid)">(x${unidades})</span></div>
            <div style="font-size:12px;color:var(--gris-mid);margin-top:2px">
              ${vehiculoStr ? `🚗 ${escapeHtml(vehiculoStr)}` : ''} ${placa ? `· <b>${escapeHtml(placa)}</b>` : ''} ${sol ? `· ${formatOT(solicitudId)}` : ''}
            </div>
            <div style="margin-top:4px;display:flex;align-items:center;gap:12px;font-size:11px;flex-wrap:wrap">
              ${sol?.categoria ? `<span style="background:#EEF2F7;color:var(--azul);font-weight:700;padding:2px 8px;border-radius:99px">🏷 ${escapeHtml(sol.categoria)}</span>` : ''}
              ${timerStr ? `<span>${timerStr}</span>` : ''}
              ${favNom ? `<span style="color:#D97706;font-weight:600">★ Favorito${sol?.categoria ? ' en ' + escapeHtml(sol.categoria) : ''}: ${escapeHtml(favNom)}</span>` : ''}
            </div>
          </div>
          <button onclick="document.getElementById('modal-cotizar').remove()"
            style="background:none;border:none;font-size:18px;cursor:pointer;color:var(--gris-mid);padding:0 4px;line-height:1">✕</button>
        </div>
        <div id="cot-contactos"></div>
        <div style="margin-top:6px">${_filtroMarcaHtml()}</div>
      </div>

      <!-- TABLA TIPO EXCEL -->
      <div style="overflow-x:auto">
        <table id="cot-tabla" style="width:100%;border-collapse:collapse;font-size:12.5px">
          <thead>
            <tr style="background:#F1F5F9;border-bottom:2px solid #CBD5E1">
              <th style="width:32px;padding:8px 6px;text-align:center;color:#64748B;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.5px">#</th>
              <th style="padding:8px 8px;text-align:left;color:#64748B;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;min-width:180px">Proveedor</th>
              <th style="padding:8px 8px;text-align:right;color:#64748B;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;min-width:110px">Valor unit. COP</th>
              <th style="padding:8px 6px;text-align:center;color:#64748B;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;width:54px">Días</th>
              <th style="padding:8px 8px;text-align:center;color:#64748B;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;width:80px">Original</th>
              <th style="padding:8px 6px;text-align:center;color:#64748B;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;width:50px">WA</th>
              <th style="width:28px"></th>
            </tr>
          </thead>
          <tbody id="cot-tabla-tbody">
            ${_cotFilas.map((f,i) => _renderFilaCot(f, i, provOpts)).join('')}
          </tbody>
        </table>
      </div>

      <!-- ACCIONES INFERIORES -->
      <div style="padding:10px 16px;border-top:1px solid var(--gris-borde);display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap">
        <button type="button" onclick="_agregarFilaCot()"
          style="background:none;border:1px dashed var(--gris-borde);border-radius:6px;padding:5px 12px;font-size:12px;cursor:pointer;color:var(--azul);font-weight:600">
          + Agregar fila
        </button>
        <div style="display:flex;gap:8px">
          <button class="btn btn-ghost" onclick="document.getElementById('modal-cotizar').remove()">Cancelar</button>
          <button class="btn btn-primary" onclick="guardarCotizaciones(${solicitudId})">Guardar cotización →</button>
        </div>
      </div>
    </div>`;
  document.body.appendChild(div);

  document.getElementById('_cot-prov-opts').value = provOpts;
  _cotFilas.forEach(f => {
    const s = document.getElementById(`cot-prov-${f.id}`);
    if (s && f.proveedorId) s.value = f.proveedorId;
  });
  _cargarContactosCot();
}

// ── Helpers para nuevo proveedor inline ──────────────────
function _toggleNuevoProv(num, solicitudId) {
  const form = document.getElementById(`np-form-${num}-${solicitudId}`);
  if (!form) return;
  const visible = form.style.display !== 'none';
  form.style.display = visible ? 'none' : 'block';
  if (!visible) setTimeout(() => document.getElementById(`np-nom-${num}-${solicitudId}`)?.focus(), 60);
}

function _cancelarNuevoProv(num, solicitudId) {
  const form = document.getElementById(`np-form-${num}-${solicitudId}`);
  if (form) form.style.display = 'none';
}

async function _guardarNuevoProvInline(num, solicitudId) {
  const nombre = document.getElementById(`np-nom-${num}-${solicitudId}`)?.value?.trim();
  if (!nombre) { toast('El nombre es obligatorio', 'err'); return; }
  const telefono      = document.getElementById(`np-tel-${num}-${solicitudId}`)?.value?.trim() || null;
  const especialidades = document.getElementById(`np-esp-${num}-${solicitudId}`)?.value?.trim() || '';
  try {
    const res = await api('/proveedores', 'POST', {
      nombre, telefono, whatsapp: telefono, especialidades, activo: true, marcas: [], multimarca: false
    }, { Prefer: 'return=representation' });
    const newProv = res?.[0];
    if (!newProv) { toast('Error al guardar proveedor', 'err'); return; }
    // Agregar al select y seleccionar
    const sel = document.getElementById(`cot-prov-${num}-${solicitudId}`);
    if (sel) {
      const opt = document.createElement('option');
      opt.value = newProv.id;
      opt.dataset.wa = telefono || '';
      opt.textContent = nombre;
      sel.appendChild(opt);
      sel.value = newProv.id;
    }
    _cancelarNuevoProv(num, solicitudId);
    toast(`Proveedor "${nombre}" guardado ✓`);
  } catch(e) { toast('Error: ' + e.message, 'err'); }
}

function _copiarMensajeProv(num, solicitudId) {
  const txt = document.getElementById(`wa-msg-${num}-${solicitudId}`)?.value || '';
  if (!txt) return;
  navigator.clipboard?.writeText(txt).then(() => {
    toast('Mensaje copiado ✓');
  }).catch(() => {
    // Fallback: select textarea
    const ta = document.getElementById(`wa-msg-${num}-${solicitudId}`);
    if (ta) { ta.select(); document.execCommand('copy'); toast('Mensaje copiado ✓'); }
  });
}

// Mantener compatibilidad con actualizarWaLink (ya no hace nada visualmente pero puede ser llamada)
function actualizarWaLink() {}

async function guardarCotizaciones(solicitudId) {
  try {
    // Leer los valores actuales de los inputs
    const filas = _cotFilas.map(f => ({
      id:          f.id,
      seleccionado: true,
      proveedorId: document.getElementById(`cot-prov-${f.id}`)?.value || null,
      precio:      parseFloat(document.getElementById(`cot-precio-${f.id}`)?.value) || 0,
      dias:        parseInt(document.getElementById(`cot-dias-${f.id}`)?.value) || null,
      esOriginal:  document.querySelector(`input[name="cot-orig-${f.id}"]:checked`)?.value !== 'no'
    }));

    const filasSeleccionadas = filas.filter(f => f.seleccionado && (f.proveedorId || f.precio));
    if (!filasSeleccionadas.length) { toast('Selecciona al menos una fila con proveedor o precio', 'err'); return; }

    const notas = document.getElementById('cot-notas')?.value?.trim() || null;

    // Guardar solo las filas seleccionadas
    for (let i = 0; i < filasSeleccionadas.length; i++) {
      const f   = filasSeleccionadas[i];
      const op  = i + 1;
      const body = {
        proveedor_id:  f.proveedorId || null,
        precio_costo:  f.precio,
        dias_entrega:  f.dias,
        es_original:   f.esOriginal,
        estado_opcion: 'cotizado'
      };
      // Si f.id parece un id de DB (número pequeño), intentar PATCH primero
      const ex = await api(`/cotizaciones_repuesto?solicitud_id=eq.${solicitudId}&opcion=eq.${op}`).catch(()=>[]) || [];
      if (ex.length) {
        await api(`/cotizaciones_repuesto?id=eq.${ex[0].id}`, 'PATCH', body);
      } else {
        await api('/cotizaciones_repuesto', 'POST', { solicitud_id: solicitudId, opcion: op, ...body }, { Prefer: 'return=minimal' });
      }
    }

    await api(`/solicitudes_repuesto?id=eq.${solicitudId}`, 'PATCH', {
      estado: 'cotizado'
    });
    toast('Cotizaciones guardadas ✓');
    document.getElementById('modal-cotizar')?.remove();
    cargarSolicitudesRepuestos();
  } catch(e) { toast('Error: ' + e.message, 'err'); }
}

// ─────────────────────────────────────────────────────────
// PROVEEDORES
// ─────────────────────────────────────────────────────────
async function cargarProveedores() {
  const cont = document.getElementById('rep-contenido');
  if (!cont) return;
  cont.innerHTML = '<div class="loading-state">Cargando proveedores...</div>';

  try {
    const provs = await api('/proveedores?order=nombre.asc').catch(()=>[]) || [];
    // Categorías personalizadas ya usadas (para mostrarlas en el formulario).
    _catProvExtra = [...new Set(provs.flatMap(p => p.categorias || []).filter(c => !CATEGORIAS_REPUESTO.includes(c)))];
    const scores = await _calcularScoresProveedores();
    // Favorito = mayor puntaje con historial
    let favId = null, favPun = -1;
    provs.forEach(p => { const s = scores[p.id]; if (s && s.n > 0 && s.puntaje > favPun) { favPun = s.puntaje; favId = p.id; } });

    // Poblar registry para evitar pasar JSON en onclick
    _provRegistry = {};
    provs.forEach(p => { _provRegistry[p.id] = p; });

    cont.innerHTML = `<div style="padding:20px">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px">
        <div style="font-size:16px;font-weight:700">Proveedores</div>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          <button class="btn btn-ghost btn-sm" onclick="autoCategorizarProveedores()">🏷 Auto-categorizar</button>
          <button class="btn btn-ghost btn-sm" onclick="abrirImportarProveedores()">📥 Importar contactos</button>
          <button class="btn btn-primary btn-sm" onclick="abrirModalProveedor()">+ Nuevo proveedor</button>
        </div>
      </div>
      <div style="margin-bottom:14px">
        <input id="prov-buscar" type="text" oninput="_filtrarProveedores(this.value)" autocomplete="off"
          placeholder="🔎 Buscar por nombre, número o marca…"
          style="width:100%;padding:9px 13px;border:1.5px solid var(--gris-borde);border-radius:8px;font-size:13px;outline:none">
      </div>
      ${provs.length ? `<div style="overflow-x:auto;-webkit-overflow-scrolling:touch"><table style="width:100%;border-collapse:collapse;font-size:13px;min-width:500px">
        <thead><tr style="background:var(--gris-bg);border-bottom:1px solid var(--gris-borde)">
          <th style="padding:10px 12px;text-align:left;font-size:10px;font-weight:700;letter-spacing:1px;color:var(--gris-mid);text-transform:uppercase">Nombre</th>
          <th style="padding:10px 12px;text-align:left;font-size:10px;font-weight:700;letter-spacing:1px;color:var(--gris-mid);text-transform:uppercase">Tipo</th>
          <th style="padding:10px 12px;text-align:left;font-size:10px;font-weight:700;letter-spacing:1px;color:var(--gris-mid);text-transform:uppercase">Ciudad</th>
          <th style="padding:10px 12px;text-align:left;font-size:10px;font-weight:700;letter-spacing:1px;color:var(--gris-mid);text-transform:uppercase">WhatsApp</th>
          <th style="padding:10px 12px;text-align:left;font-size:10px;font-weight:700;letter-spacing:1px;color:var(--gris-mid);text-transform:uppercase">Marcas</th>
          <th style="padding:10px 12px;text-align:left;font-size:10px;font-weight:700;letter-spacing:1px;color:var(--gris-mid);text-transform:uppercase">Puntaje</th>
          <th></th>
        </tr></thead>
        <tbody>
          ${provs.map(p=>`<tr data-buscar="${escapeHtml(((p.nombre||'')+' '+(p.whatsapp||'')+' '+(p.telefono||'')+' '+(p.marcas||[]).join(' ')+(p.multimarca?' multimarca todas':'')).toLowerCase())}" style="border-bottom:1px solid var(--gris-borde)">
            <td style="padding:10px 12px;font-weight:600">${escapeHtml(p.nombre)}
              ${(p.categorias||[]).length ? `<div style="margin-top:3px;display:flex;flex-wrap:wrap;gap:3px">${p.categorias.slice(0,4).map(c=>`<span style="background:#EEF2F7;color:var(--azul);font-size:9px;font-weight:600;padding:1px 6px;border-radius:99px">${escapeHtml(c)}</span>`).join('')}</div>` : ''}
            </td>
            <td style="padding:10px 12px;color:var(--gris-mid)">${escapeHtml(p.tipo_proveedor||'—')}</td>
            <td style="padding:10px 12px">${escapeHtml(p.ciudad||'—')}</td>
            <td style="padding:10px 12px;font-family:'DM Mono',monospace">${escapeHtml(p.whatsapp||'—')}</td>
            <td style="padding:10px 12px;font-size:11px;color:var(--gris-mid)">
              ${p.multimarca?'<span style="background:var(--azul-light);color:var(--azul);padding:2px 6px;border-radius:3px;font-size:10px;font-weight:600">Multimarca</span>':(p.marcas||[]).slice(0,3).map(escapeHtml).join(', ')||'—'}
            </td>
            <td style="padding:10px 12px">
              ${(() => {
                const s = scores[p.id];
                if (!s || !s.n) return '<span style="font-size:11px;color:var(--gris-mid)">Sin historial</span>';
                return `<div style="display:flex;align-items:center;gap:6px;white-space:nowrap">
                  ${p.id === favId ? '<span title="Favorito de confianza" style="color:#D97706;font-weight:800">★</span>' : ''}
                  ${_estrellasHtml(s.estrellas)}
                  <span style="font-size:10px;color:var(--gris-mid)">${s.avgDias != null ? (Math.round(s.avgDias*10)/10) + 'd · ' : ''}${s.elegido}/${s.n}✓${!s.confiable ? ' · <span style="color:#B45309">poco historial</span>' : ''}</span>
                </div>`;
              })()}
            </td>
            <td style="padding:10px 12px;white-space:nowrap">
              <button class="btn btn-ghost btn-sm" data-prov-id="${p.id}" onclick="_editarProveedorPorId(this)">Editar</button>
              <button class="btn btn-ghost btn-sm" style="color:var(--rojo)" data-prov-id="${p.id}" onclick="_eliminarProveedorPorId(this)">Eliminar</button>
            </td>
          </tr>`).join('')}
        </tbody>
      </table></div>` : '<div class="empty-state"><p>Sin proveedores registrados</p></div>'}
    </div>`;
  } catch(e) { cont.innerHTML = `<div class="empty-state">Error: ${e.message}</div>`; }
}

// Filtra la lista de proveedores por nombre, número o marca (en vivo).
function _filtrarProveedores(q) {
  q = (q || '').trim().toLowerCase();
  document.querySelectorAll('#rep-contenido tbody tr[data-buscar]').forEach(tr => {
    tr.style.display = (!q || tr.dataset.buscar.includes(q)) ? '' : 'none';
  });
}

// Eliminar proveedor desde el botón de la fila (usa el registry para el nombre).
function _eliminarProveedorPorId(btn) {
  const id = +btn.dataset.provId;
  const p = (_provRegistry || {})[id];
  eliminarProveedor(id, p?.nombre || '');
}

function abrirModalProveedor(prov) {
  const existing = document.getElementById('modal-proveedor');
  if (existing) existing.remove();
  const p = prov||{};
  const selMarcas = p.marcas||[];
  const esMulti   = p.multimarca||false;
  const selCats   = p.categorias||[];

  const _itemCheck = (name, val, checked) => `
    <label style="display:flex;align-items:center;gap:7px;font-size:12.5px;cursor:pointer;padding:4px 2px;line-height:1.2;text-transform:none;font-weight:400;letter-spacing:normal;color:var(--texto)">
      <input type="checkbox" name="${name}" value="${escapeHtml(val)}" ${checked?'checked':''} style="flex-shrink:0;margin:0;width:15px;height:15px">
      <span style="min-width:0">${escapeHtml(val)}</span>
    </label>`;

  const marcasHtml = MARCAS_VEHICULOS.map(m => _itemCheck('prov-marca', m, selMarcas.includes(m)||esMulti)).join('');

  // Categorías: estándar + las que ya existan en otros proveedores + las de este.
  const todasCats = [...new Set([...CATEGORIAS_REPUESTO, ...(_catProvExtra||[]), ...selCats])];
  const catsHtml = todasCats.map(c => _itemCheck('prov-cat', c, selCats.includes(c))).join('');

  const div = document.createElement('div');
  div.id = 'modal-proveedor';
  div.className = 'modal-overlay show';
  div.innerHTML = `
    <div class="modal" style="max-width:520px;max-height:90vh;overflow-y:auto">
      <div class="modal-header">
        <div class="modal-titulo">${p.id?'Editar proveedor':'Nuevo proveedor'}</div>
        <button class="modal-close" onclick="document.getElementById('modal-proveedor').remove()">✕</button>
      </div>
      <div class="modal-body">
        <div class="field"><label>Nombre *</label><input id="prov-nombre" value="${escapeHtml(p.nombre||'')}"></div>
        <div class="field">
          <label>Tipo de proveedor</label>
          <select id="prov-tipo" style="width:100%">
            <option value="">— Seleccionar —</option>
            <option value="Concesionario" ${p.tipo_proveedor==='Concesionario'?'selected':''}>Concesionario</option>
            <option value="Importador"    ${p.tipo_proveedor==='Importador'   ?'selected':''}>Importador</option>
            <option value="Almacén"       ${p.tipo_proveedor==='Almacén'      ?'selected':''}>Almacén</option>
          </select>
        </div>
        <div class="field"><label>Ciudad</label><input id="prov-ciudad" value="${escapeHtml(p.ciudad||'')}" placeholder="Bogotá, Medellín..."></div>
        <div class="field"><label>WhatsApp</label><input id="prov-whatsapp" value="${escapeHtml(p.whatsapp||'')}" type="tel" placeholder="3001234567"></div>
        <div class="field">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
            <label style="margin:0">Marcas que maneja</label>
            <label style="display:flex;align-items:center;gap:6px;font-size:13px;cursor:pointer;font-weight:600;color:var(--azul)">
              <input type="checkbox" id="prov-multimarca" ${esMulti?'checked':''} onchange="toggleMultimarca(this.checked)">
              Multimarca (todas)
            </label>
          </div>
          <div id="prov-marcas-wrap" style="max-height:200px;overflow-y:auto;border:1px solid var(--gris-borde);border-radius:8px;padding:8px 12px;display:grid;grid-template-columns:repeat(auto-fill,minmax(115px,1fr));gap:2px 12px;align-content:start;${esMulti?'opacity:.4;pointer-events:none':''}">
            ${marcasHtml}
          </div>
        </div>
        <div class="field">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;flex-wrap:wrap;gap:6px">
            <label style="margin:0">Categorías que maneja <span style="font-weight:400;color:var(--gris-mid);font-size:11px">(para sugerirlo en esos repuestos)</span></label>
            <button type="button" class="btn btn-ghost btn-xs" style="font-size:11px;color:var(--azul)" onclick="_sugerirCatProveedor()">✨ Sugerir del nombre</button>
          </div>
          <div id="prov-cat-wrap" style="border:1px solid var(--gris-borde);border-radius:8px;padding:8px 12px;display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:2px 12px;align-content:start">
            ${catsHtml}
          </div>
          <div style="display:flex;gap:6px;margin-top:8px">
            <input id="prov-cat-nueva" placeholder="+ Agregar otra categoría…" style="flex:1;font-size:12.5px;padding:7px 10px;border:1px solid var(--gris-borde);border-radius:6px"
              onkeydown="if(event.key==='Enter'){event.preventDefault();_agregarCategoriaProv();}">
            <button type="button" class="btn btn-ghost btn-sm" onclick="_agregarCategoriaProv()">Agregar</button>
          </div>
        </div>
        <div class="field">
          <label>Puntaje manual <span style="font-weight:400;color:var(--gris-mid);font-size:11px">(opcional — si lo pones, manda sobre el automático)</span></label>
          <select id="prov-puntaje" style="width:100%">
            <option value="">Automático (por historial)</option>
            ${[5,4.5,4,3.5,3,2.5,2,1.5,1].map(v=>`<option value="${v}" ${Number(p.puntaje_manual)===v?'selected':''}>${'★'.repeat(Math.floor(v))}${v%1?'½':''} · ${v}</option>`).join('')}
          </select>
        </div>
        ${p.id ? `<div class="field"><label>Estado</label>
          <select id="prov-activo" style="width:100%">
            <option value="true"  ${p.activo!==false?'selected':''}>Activo</option>
            <option value="false" ${p.activo===false?'selected':''}>Inactivo</option>
          </select></div>` : ''}
      </div>
      <div class="modal-footer" style="justify-content:space-between">
        ${p.id ? `<button class="btn btn-ghost btn-sm" style="color:var(--rojo)" onclick="eliminarProveedor(${p.id},'${escapeHtml(p.nombre||'').replace(/'/g,"\\x27")}')">🗑 Eliminar</button>` : '<span></span>'}
        <div style="display:flex;gap:8px">
          <button class="btn btn-ghost" onclick="document.getElementById('modal-proveedor').remove()">Cancelar</button>
          <button class="btn btn-primary" onclick="guardarProveedor(${p.id||'null'})">Guardar</button>
        </div>
      </div>
    </div>`;
  document.body.appendChild(div);
}

// Asigna categorías automáticamente (por el nombre) a los proveedores que aún
// no tienen ninguna. No sobrescribe los que ya están categorizados.
async function autoCategorizarProveedores() {
  if (!confirm('¿Detectar y asignar categorías por el nombre a los proveedores que no tengan ninguna?')) return;
  try {
    const provs = await api('/proveedores?select=id,nombre,categorias');
    let n = 0;
    for (const p of provs) {
      if (p.categorias && p.categorias.length) continue;
      const cats = _detectarCategoriasProveedor(p.nombre);
      if (cats.length) { await api(`/proveedores?id=eq.${p.id}`, 'PATCH', { categorias: cats }).catch(() => {}); n++; }
    }
    toast(`${n} proveedor(es) categorizados ✓`);
    cargarProveedores();
  } catch (e) {
    toast('Primero corre el SQL de categorías (docs/sql-proveedor-categorias.sql)', 'err');
  }
}

async function eliminarProveedor(id, nombre) {
  if (!confirm(`¿Eliminar el proveedor "${nombre}"?\nEsta acción no se puede deshacer.`)) return;
  try {
    await api(`/proveedores?id=eq.${id}`, 'DELETE', null, { Prefer: 'return=minimal' });
    toast('Proveedor eliminado ✓');
    document.getElementById('modal-proveedor')?.remove();
    cargarProveedores();
  } catch (e) {
    // Si tiene cotizaciones (llave foránea), no se puede borrar → sugerir inactivar.
    toast('No se pudo eliminar (tiene historial de cotizaciones). Mejor márcalo Inactivo.', 'err');
  }
}

function toggleMultimarca(checked) {
  const wrap = document.getElementById('prov-marcas-wrap');
  if (!wrap) return;
  wrap.style.opacity = checked ? '.4' : '1';
  wrap.style.pointerEvents = checked ? 'none' : 'auto';
  if (checked) wrap.querySelectorAll('input[type=checkbox]').forEach(cb=>{ cb.checked=true; });
}

async function guardarProveedor(id) {
  const nombre = document.getElementById('prov-nombre')?.value.trim();
  if (!nombre) { toast('El nombre es obligatorio','err'); return; }
  const esMulti  = document.getElementById('prov-multimarca')?.checked||false;
  const marcas   = esMulti ? MARCAS_VEHICULOS
    : [...document.querySelectorAll('#modal-proveedor input[name="prov-marca"]:checked')].map(cb=>cb.value);

  const categorias = [...document.querySelectorAll('#modal-proveedor input[name="prov-cat"]:checked')].map(cb=>cb.value);

  const body = {
    nombre,
    tipo_proveedor: document.getElementById('prov-tipo')?.value||null,
    ciudad:         document.getElementById('prov-ciudad')?.value.trim()||null,
    whatsapp:       document.getElementById('prov-whatsapp')?.value.trim()||null,
    multimarca:     esMulti,
    marcas,
    activo:         id ? (document.getElementById('prov-activo')?.value==='true') : true
  };

  try {
    let provId = id;
    if (id) await api(`/proveedores?id=eq.${id}`,'PATCH',body);
    else {
      const res = await api('/proveedores','POST',body,{Prefer:'return=representation'});
      provId = res?.[0]?.id;
    }
    // categorias + puntaje manual en PATCH aparte (catch) para no romper si falta la columna.
    const _ptVal = document.getElementById('prov-puntaje')?.value;
    const puntaje_manual = _ptVal ? Number(_ptVal) : null;
    if (provId) await api(`/proveedores?id=eq.${provId}`,'PATCH',{ categorias, puntaje_manual }).catch(()=>{});
    toast('Proveedor guardado ✓');
    document.getElementById('modal-proveedor')?.remove();
    cargarProveedores();
  } catch(e) { toast('Error: '+e.message,'err'); }
}

// ─────────────────────────────────────────────────────────
// IMPORTADOR DE CONTACTOS (CSV de Google / vCard de iCloud)
// ─────────────────────────────────────────────────────────
let _impProveedores = [];
let _impModoEtiqueta = false;

// Normaliza un teléfono: solo dígitos; quita 00 e indicativo 57 (Colombia)
// para guardar el número de 10 dígitos (el botón WA antepone el 57 al enviar).
function _normTelImport(raw) {
  let d = String(raw || '').replace(/\D/g, '');
  if (d.startsWith('00')) d = d.slice(2);
  if (d.startsWith('57') && d.length === 12) d = d.slice(2);
  return d;
}

// Parser de una línea CSV (respeta comillas y comas internas).
function _csvLinea(linea) {
  const out = []; let cur = ''; let q = false;
  for (let i = 0; i < linea.length; i++) {
    const c = linea[i];
    if (q) {
      if (c === '"') { if (linea[i + 1] === '"') { cur += '"'; i++; } else q = false; }
      else cur += c;
    } else {
      if (c === '"') q = true;
      else if (c === ',') { out.push(cur); cur = ''; }
      else cur += c;
    }
  }
  out.push(cur);
  return out;
}

function _parseCSVContactos(text) {
  const lineas = text.split(/\r?\n/).filter(l => l.trim().length);
  if (!lineas.length) return [];
  const header = _csvLinea(lineas[0]).map(h => h.trim());
  const idxExact = n => header.findIndex(h => h.toLowerCase() === n.toLowerCase());
  const idxCont  = s => header.findIndex(h => h.toLowerCase().includes(s.toLowerCase()));
  const idxNombre = idxExact('Name');
  let idxFirst = idxExact('First Name'); if (idxFirst < 0) idxFirst = idxExact('Given Name');
  let idxLast  = idxExact('Last Name');  if (idxLast  < 0) idxLast  = idxExact('Family Name');
  let idxTel = header.findIndex(h => /phone.*value/i.test(h));
  if (idxTel < 0) idxTel = idxCont('Phone');
  if (idxTel < 0) idxTel = idxCont('Mobile');
  if (idxTel < 0) idxTel = idxCont('Tel');
  const idxOrg   = idxExact('Organization Name');
  const idxLabel = idxExact('Labels');
  const out = [];
  for (let i = 1; i < lineas.length; i++) {
    const cols = _csvLinea(lineas[i]);
    let nombre = idxNombre >= 0 ? (cols[idxNombre] || '').trim() : '';
    if (!nombre) nombre = [cols[idxFirst] || '', cols[idxLast] || ''].join(' ').trim();
    if (!nombre && idxOrg >= 0) nombre = (cols[idxOrg] || '').trim();
    let tel = idxTel >= 0 ? (cols[idxTel] || '').trim() : '';
    if (tel.includes(':::')) tel = tel.split(':::')[0].trim();   // Google une varios con :::
    const label = idxLabel >= 0 ? (cols[idxLabel] || '') : '';
    if (!nombre && !tel) continue;
    out.push({ nombre: nombre || '(sin nombre)', telefono: tel, label });
  }
  return out;
}

// Heurística: ¿este contacto parece un proveedor de repuestos/servicios?
// Pre-marca los probables y descarta familia/clientes/bancos. El usuario ajusta.
const _PROV_KEYWORDS = ['repuesto','partes','autopart',' parts','planet parts','import','electric','eléctric','venelectric','latoner','latas','bomper','freno','radiador','vidrio','parabris','amortiguador','ejes','resorte','cromado','pintura','accesorio','lujos','espejo','chasis','scanner','escaner','montacoche','montacarga','elevador','hidraulic','parrilla','surticaja','plastico','filtro','dayco','suzuki','mitsub','mitsbishi','great wall','toyota nissan','japon korea','japón korea','korea','asiatica de partes','caelca','transtermo','tecniresortes','imporlatas','partcar','discolpartes','coautopartes','florida importacion','derco','ambacar','parabricentro','tuparabrisas','refaccionaria','servintec','ingecom','depolujo','jimcars','motorola','autostok','auto body','rep great wall','rep mitsubishi','banco de chasis','maderas','radiadores','almacen','almacén'];
const _PROV_EXCLUIR = ['cepeda','freiman','cliente','client','mamá','mama','madre','mi bb','banco de','davivienda','occidente','previsora','fiducentral','fiduciar','seguros','contador','ejecutiva','asistente','asitente','drone','jardinero','licorera','krispy','cabaña','humedal','universidad','cárcel','carcel','inmuniz','computadores','construcciones','void corte','sign products','eventos','makerule','nequi','jacuzzi','luciana','nuera','starex','jeep compass','tesla'];
function _esLikelyProveedor(nombre, label) {
  const t = (nombre || '').toLowerCase();
  if ((label || '').toLowerCase().includes('cliente')) return false;
  if (_PROV_EXCLUIR.some(k => t.includes(k))) return false;
  return _PROV_KEYWORDS.some(k => t.includes(k));
}

function _parseVCard(text) {
  const out = [];
  text.split(/END:VCARD/i).forEach(c => {
    if (!/BEGIN:VCARD/i.test(c)) return;
    const fn  = (c.match(/[\r\n]FN[^:\r\n]*:(.+)/i) || [])[1];
    const tel = (c.match(/[\r\n]TEL[^:\r\n]*:(.+)/i) || [])[1];
    const nombre = (fn || '').trim();
    const telefono = (tel || '').trim();
    if (nombre || telefono) out.push({ nombre: nombre || '(sin nombre)', telefono });
  });
  return out;
}

function abrirImportarProveedores() {
  document.getElementById('modal-imp-prov')?.remove();
  const div = document.createElement('div');
  div.id = 'modal-imp-prov';
  div.className = 'modal-overlay show';
  div.innerHTML = `
    <div class="modal" style="max-width:620px;max-height:90vh;overflow-y:auto">
      <div class="modal-header">
        <div class="modal-titulo">Importar contactos de proveedores</div>
        <button class="modal-close" onclick="document.getElementById('modal-imp-prov').remove()">✕</button>
      </div>
      <div class="modal-body">
        <div style="font-size:12.5px;color:var(--gris-mid);margin-bottom:12px;line-height:1.5">
          Sube el archivo de tus contactos (<b>CSV de Google</b> o <b>vCard .vcf de iCloud</b>).
          Te mostramos la lista y tú marcas cuáles son proveedores.
        </div>
        <input type="file" id="imp-file" accept=".csv,.vcf,text/csv,text/vcard" onchange="_procesarArchivoProveedores(this)"
          style="width:100%;padding:10px;border:1.5px dashed var(--gris-borde);border-radius:8px;font-size:13px;cursor:pointer">
        <div id="imp-resultado" style="margin-top:14px"></div>
      </div>
    </div>`;
  document.body.appendChild(div);
}

async function _procesarArchivoProveedores(input) {
  const file = input.files && input.files[0];
  if (!file) return;
  const cont = document.getElementById('imp-resultado');
  if (cont) cont.innerHTML = '<div style="font-size:12px;color:var(--gris-mid)">Leyendo archivo…</div>';
  try {
    const text = await file.text();
    const esVcf = /\.vcf$/i.test(file.name) || /BEGIN:VCARD/i.test(text.slice(0, 200));
    _impProveedores = (esVcf ? _parseVCard(text) : _parseCSVContactos(text))
      .filter(c => _normTelImport(c.telefono)); // solo contactos con número usable
    // Si el archivo trae una etiqueta "Proveedor(es)" (la marcaste en Google
    // Contactos), usamos ESA como verdad exacta. Si no, caemos a la heurística.
    _impModoEtiqueta = _impProveedores.some(c => /proveedor/i.test(c.label || ''));
    _impProveedores.forEach(c => {
      c.sugerido = _impModoEtiqueta
        ? /proveedor/i.test(c.label || '')
        : _esLikelyProveedor(c.nombre, c.label);
    });
    _impProveedores.sort((a, b) => (b.sugerido ? 1 : 0) - (a.sugerido ? 1 : 0));
    _renderImpLista();
  } catch (e) {
    if (cont) cont.innerHTML = `<div style="color:var(--rojo);font-size:12px">No se pudo leer el archivo: ${escapeHtml(e.message)}</div>`;
  }
}

function _renderImpLista() {
  const cont = document.getElementById('imp-resultado');
  if (!cont) return;
  if (!_impProveedores.length) {
    cont.innerHTML = '<div style="color:var(--gris-mid);font-size:12px">No se encontraron contactos con número en el archivo.</div>';
    return;
  }
  const nSug = _impProveedores.filter(c => c.sugerido).length;
  const hint = _impModoEtiqueta
    ? `Detectamos tu etiqueta <b>"Proveedores"</b> y marcamos exactamente esos <b>${nSug}</b>. ✅`
    : `Pre-marcamos <b>${nSug}</b> que parecen proveedores (resaltados). Revisa y ajusta lo que quieras.<br><span style="color:var(--gris-mid)">Tip: si etiquetas tus proveedores como "Proveedores" en Google Contactos, la próxima vez los detecto exactos.</span>`;
  cont.innerHTML = `
    <div style="background:#EEF2F7;border-radius:8px;padding:8px 10px;font-size:11.5px;color:var(--azul);margin-bottom:8px;line-height:1.5">
      ${hint}
    </div>
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
      <label style="display:flex;align-items:center;gap:6px;font-size:12px;cursor:pointer;font-weight:600">
        <input type="checkbox" id="imp-todos" onchange="_toggleImpTodos(this.checked)"> Seleccionar todos
      </label>
      <span style="font-size:11px;color:var(--gris-mid)">${_impProveedores.length} contactos · <span id="imp-cuenta">${nSug}</span> marcados</span>
    </div>
    <div style="max-height:300px;overflow-y:auto;border:1px solid var(--gris-borde);border-radius:8px">
      ${_impProveedores.map((c, i) => `
        <label style="display:flex;align-items:center;gap:10px;padding:8px 12px;border-bottom:1px solid var(--gris-borde);cursor:pointer;font-size:13px;${c.sugerido ? 'background:#F0FDF4' : ''}">
          <input type="checkbox" class="imp-check" data-idx="${i}" ${c.sugerido ? 'checked' : ''} onchange="_impActualizarCuenta()">
          <span style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escapeHtml(c.nombre)}${c.sugerido ? ' <span style="font-size:9px;color:#15803D;font-weight:700">● proveedor</span>' : ''}</span>
          <span style="font-family:'DM Mono',monospace;font-size:11px;color:var(--gris-mid)">${escapeHtml(_normTelImport(c.telefono))}</span>
        </label>`).join('')}
    </div>
    <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:14px">
      <button class="btn btn-ghost btn-sm" onclick="document.getElementById('modal-imp-prov').remove()">Cancelar</button>
      <button class="btn btn-primary btn-sm" onclick="confirmarImportarProveedores()">Importar marcados →</button>
    </div>`;
}

function _toggleImpTodos(checked) {
  document.querySelectorAll('.imp-check').forEach(ch => { ch.checked = checked; });
  _impActualizarCuenta();
}
function _impActualizarCuenta() {
  const n = document.querySelectorAll('.imp-check:checked').length;
  const el = document.getElementById('imp-cuenta'); if (el) el.textContent = n;
}

async function confirmarImportarProveedores() {
  const checks = [...document.querySelectorAll('.imp-check:checked')];
  if (!checks.length) { toast('Marca al menos un proveedor', 'err'); return; }
  const seleccion = checks.map(ch => _impProveedores[+ch.dataset.idx]).filter(Boolean);
  // No duplicar: comparar por número con los que ya existen
  const existentes = await api('/proveedores?select=whatsapp').catch(() => []) || [];
  const setExist = new Set(existentes.map(p => _normTelImport(p.whatsapp)).filter(Boolean));
  const vistos = new Set();
  const nuevos = [];
  seleccion.forEach(s => {
    const t = _normTelImport(s.telefono);
    if (!t || setExist.has(t) || vistos.has(t)) return;
    vistos.add(t);
    nuevos.push({ nombre: s.nombre, whatsapp: t, activo: true, marcas: [], multimarca: false });
  });
  if (!nuevos.length) { toast('Nada nuevo: ya existían o sin número válido', 'info'); return; }
  try {
    await api('/proveedores', 'POST', nuevos, { Prefer: 'return=minimal' });
    document.getElementById('modal-imp-prov')?.remove();
    toast(`${nuevos.length} proveedor(es) importado(s) ✓`);
    cargarProveedores();
  } catch (e) { toast('Error: ' + e.message, 'err'); }
}

// ─────────────────────────────────────────────────────────
// VISTA CLIENTE
// ─────────────────────────────────────────────────────────
async function cargarRepuestosCliente(ordenId) {
  const cont = document.getElementById('cliente-repuestos-contenido');
  if (!cont) return;
  try {
    const sols = await api(`/solicitudes_repuesto?orden_id=eq.${ordenId}&estado=in.(cotizado,pedido,entregado)&select=*`).catch(()=>[]) || [];
    if (!sols.length) { cont.innerHTML=''; return; }
    const items = await Promise.all(sols.map(async s => {
      const cots = await api(`/cotizaciones_repuesto?solicitud_id=eq.${s.id}&order=opcion.asc&select=*,proveedores(nombre)`).catch(()=>[]) || [];
      const conPrecio = cots.filter(c=>c.precio_venta_jefe);
      if (!conPrecio.length) return '';
      return `<div style="margin-bottom:14px;padding:14px;background:var(--gris-bg);border-radius:8px;border:1px solid var(--gris-borde)">
        <div style="font-weight:700;margin-bottom:8px">${escapeHtml(s.repuesto)} · ${escapeHtml(String(s.unidades))} und</div>
        ${conPrecio.map(c=>`<div style="display:flex;align-items:center;justify-content:space-between;padding:8px 10px;background:white;border-radius:6px;border:1px solid var(--gris-borde);margin-bottom:5px">
          <div><div style="font-size:13px;font-weight:600">Opción ${c.opcion}</div><div style="font-size:11px;color:var(--gris-mid)">${escapeHtml(c.proveedores?.nombre||'—')}</div></div>
          <div style="font-size:15px;font-weight:700;color:var(--verde);font-family:'DM Mono',monospace">${formatCOP(c.precio_venta_jefe)}</div>
        </div>`).join('')}
        <div style="font-size:11px;color:var(--gris-mid);margin-top:6px">Consulta con el taller para confirmar tu opción.</div>
      </div>`;
    }));
    const html = items.filter(Boolean).join('');
    if (html) cont.innerHTML = `<div style="margin-top:16px;border-top:1px solid var(--gris-borde);padding-top:16px"><div class="seccion-titulo">Repuestos disponibles</div>${html}</div>`;
  } catch(e) { cont.innerHTML=''; }
}
