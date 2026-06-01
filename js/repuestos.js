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
  const idx = pasos.indexOf(estadoActual);
  return `<div style="display:flex;align-items:center;gap:0;margin:8px 0;overflow-x:auto">
    ${pasos.map((p, i) => {
      const done = i < idx, active = i === idx;
      const col = done ? '#059669' : active ? '#2563EB' : '#D1D5DB';
      return `<div style="display:flex;align-items:center;flex-shrink:0">
        <div style="width:8px;height:8px;border-radius:50%;background:${col};flex-shrink:0"></div>
        <div style="font-size:9px;color:${col};margin:0 4px;white-space:nowrap;font-weight:${active?'700':'400'}">${labels[i]}</div>
        ${i < pasos.length-1 ? `<div style="width:20px;height:1px;background:${done?'#059669':'#E5E7EB'}"></div>` : ''}
      </div>`;
    }).join('')}
  </div>`;
}

const N8N_REPUESTO = 'https://automatizacionesfreimanautos-n8n.qs0sgf.easypanel.host/webhook/notificar-etapa';

const MARCAS_VEHICULOS = [
  'Acura','Alfa Romeo','Audi','BMW','Bentley','Buick','Cadillac','Chevrolet',
  'Chrysler','Citroën','Dodge','Ferrari','Fiat','Ford','GMC','Genesis',
  'Honda','Hyundai','Infiniti','Isuzu','Jaguar','Jeep','Kia','Lamborghini',
  'Land Rover','Lexus','Lincoln','Maserati','Mazda','Mercedes-Benz','Mini',
  'Mitsubishi','Nissan','Peugeot','Porsche','Ram','Renault','Rolls-Royce',
  'Seat','Skoda','Subaru','Suzuki','Tesla','Toyota','Volkswagen','Volvo',
  'Bajaj','Hero','Yamaha','Honda Moto','Kawasaki','Suzuki Moto','KTM'
];

// ── Sección activa ──────────────────────────────────────
let _repSeccionActual = 'solicitudes';

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
      <input id="si-rep-${item.idx}" type="text" placeholder="Ej: Disco de freno delantero" value=""
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
  const idx = Date.now();
  _solItems.push({ idx, fotoUrl: null });
  const tbody = document.getElementById('sol-items-tbody');
  if (tbody) tbody.innerHTML = _solItems.map((item, i) => _renderFilaItem(item, i + 1)).join('');
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
  const existing = document.getElementById('modal-sol-multi');
  if (existing) existing.remove();

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

        <!-- Tipo -->
        <div style="display:flex;align-items:center;gap:6px;margin-bottom:12px;font-size:13px">
          <span style="font-weight:600;color:var(--gris-mid);font-size:11px;text-transform:uppercase;letter-spacing:.5px">Tipo:</span>
          <label style="display:flex;align-items:center;gap:4px;cursor:pointer">
            <input type="radio" name="sol-tipo" id="sol-tipo-taller" value="taller" checked> Taller
          </label>
          <label style="display:flex;align-items:center;gap:4px;cursor:pointer">
            <input type="radio" name="sol-tipo" id="sol-tipo-venta" value="venta_directa"> Venta directa
          </label>
          <label style="display:flex;align-items:center;gap:4px;cursor:pointer">
            <input type="radio" name="sol-tipo" id="sol-tipo-corp" value="corporativo"> Corporativo
          </label>
        </div>

        ${esJefe()
          ? `<div style="font-size:12px;color:#1E40AF;margin-bottom:10px;padding:7px 10px;background:#EFF6FF;border-radius:6px;border:1px solid #BFDBFE">
              La etapa <strong>no se pausará</strong> — el mecánico continúa trabajando.
            </div>`
          : `<div style="font-size:12px;color:#92400E;margin-bottom:10px;padding:7px 10px;background:#FEF3C7;border-radius:6px;border:1px solid #FDE68A">
              ⏸ La etapa se pausará hasta que el jefe entregue los repuestos.
            </div>`
        }

        <!-- Tabla compacta -->
        <div style="border:1px solid var(--gris-borde);border-radius:8px;overflow:hidden;margin-bottom:10px">
          ${_renderTablaItems()}
        </div>
        <button type="button" class="btn btn-ghost btn-sm" onclick="_agregarSolItem()" style="margin-bottom:12px">
          + Agregar ítem
        </button>

        <!-- Urgencia -->
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px;font-size:13px">
          <span style="font-weight:600;color:var(--gris-mid);font-size:11px;text-transform:uppercase;letter-spacing:.5px">Urgencia:</span>
          <label style="display:flex;align-items:center;gap:4px;cursor:pointer">
            <input type="radio" name="sol-urgencia" value="normal" checked> Normal
          </label>
          <label style="display:flex;align-items:center;gap:4px;cursor:pointer">
            <input type="radio" name="sol-urgencia" value="urgente"> Urgente
          </label>
          <label style="display:flex;align-items:center;gap:4px;cursor:pointer">
            <input type="radio" name="sol-urgencia" value="muy_urgente"> Muy urgente
          </label>
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
  const tipo     = document.querySelector('input[name="sol-tipo"]:checked')?.value || 'taller';
  const urgencia = document.querySelector('input[name="sol-urgencia"]:checked')?.value || 'normal';
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

    // Crear cabecera de la solicitud (primer ítem en campos legacy para compatibilidad)
    const solicitudRes = await api('/solicitudes_repuesto', 'POST', {
      orden_id:           ordenId,
      etapa_id:           etapaId || null,
      solicitado_por:     sesion.nombre,
      perfil_solicitante: sesion.perfil,
      repuesto:           items[0].repuesto,
      unidades:           items[0].unidades,
      observaciones:      items[0].observaciones,
      estado:             'pendiente_jefe',
      tipo_solicitud:     tipo,
      urgencia:           urgencia
    }, { Prefer: 'return=representation' });

    const solicitudId = solicitudRes?.[0]?.id;

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

    // Pausar etapa activa — solo si quien solicita es mecánico (no jefe/gerente)
    if (!esJefe()) {
      if (etapaId) {
        await api(`/etapas?id=eq.${etapaId}`, 'PATCH', {
          pausado: true, pausa_inicio: new Date().toISOString()
        }).catch(() => {});
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
    toast(`${items.length > 1 ? items.length + ' repuestos solicitados' : 'Solicitud enviada'} ✓ — ⏸ Etapa pausada`);

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
    const badge = document.getElementById('badge-repuestos');
    if (!badge) return;
    badge.textContent = p.length;
    badge.style.display = p.length>0 ? 'inline-flex' : 'none';
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
    const ordenes = oids.length ? await api(`/ordenes?id=in.(${oids.join(',')})&select=id,placa,marca,linea,modelo,vin`).catch(()=>[]) || [] : [];
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
      cont.innerHTML = `<div style="padding:20px">${barraHtml}<div class="empty-state"><p>Sin solicitudes</p></div></div>`;
      return;
    }

    cont.innerHTML = `<div style="padding:20px">${barraHtml}
      <div style="display:flex;flex-direction:column;gap:10px">
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

          return `<div class="card" style="padding:16px">
            ${_barraEstado(s.estado)}
            <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-bottom:6px">
              <div>
                <div style="font-weight:700;font-size:15px;margin-bottom:2px">
                  ${items.length > 1 ? `${items.length} repuestos solicitados` : escapeHtml(s.repuesto)}
                </div>
                <div style="font-size:12px;color:var(--gris-mid)">${escapeHtml(s.solicitado_por)} · ${formatTS(s.creado_en)}</div>
                ${o.placa ? `<div style="font-size:12px;color:var(--azul);margin-top:2px;font-family:'DM Mono',monospace">
                  ${escapeHtml(o.placa)} · ${formatOT(s.orden_id)}
                  ${o.vin ? `· <span style="color:var(--gris-mid)">VIN: ${escapeHtml(o.vin)}</span>` : ''}
                </div>` : ''}
                <div style="display:flex;gap:10px;margin-top:4px;flex-wrap:wrap">
                  ${timerSolicitud}
                  <span style="color:var(--gris-mid);font-size:11px">|</span>
                  ${timerEstado}
                </div>
                ${timerProv}
              </div>
              <span class="badge ${est.cls}">${est.txt}</span>
            </div>
            ${itemsHtml}
            ${s.estado==='pendiente_jefe' ? `
              <div style="background:var(--gris-bg);border-radius:8px;padding:10px 12px;margin-bottom:10px">
                <div style="font-size:11px;font-weight:600;color:var(--gris-mid);margin-bottom:6px;text-transform:uppercase;letter-spacing:.5px">Nota para repuestos (opcional)</div>
                <textarea id="nota-jefe-${s.id}" style="width:100%;min-height:48px;font-size:13px;border:1px solid var(--gris-borde);border-radius:6px;padding:6px 10px;resize:vertical">${escapeHtml(s.nota_jefe||'')}</textarea>
              </div>
              <div style="display:flex;gap:8px">
                <button class="btn btn-success btn-sm" onclick="jefeProcesarSolicitud(${s.id},'aprobar',${s.etapa_id||'null'})">✓ Aprobar y enviar</button>
                <button class="btn btn-danger btn-sm"  onclick="jefeProcesarSolicitud(${s.id},'rechazar',${s.etapa_id||'null'})">✕ Rechazar</button>
              </div>` : ''}
            ${s.estado==='cotizado' ? `
              <div style="background:#EBF2FF;border:1px solid #BFDBFE;border-radius:8px;padding:10px 14px;margin-bottom:8px;font-size:13px;color:#1E40AF;font-weight:600">
                💰 Hay cotizaciones listas. Define el precio de venta para ordenar el repuesto.
              </div>
              <div style="display:flex;gap:8px;flex-wrap:wrap">
                <button class="btn btn-primary btn-sm" onclick="abrirModalPrecioVenta(${s.id})">
                  <svg width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
                  Definir precio y ordenar
                </button>
              </div>` : ''}
            ${s.estado==='pedido' ? `
              <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">
                <span style="font-size:12px;color:var(--gris-mid);font-style:italic">⏳ Esperando llegada del proveedor...</span>
                <button class="btn btn-success btn-sm" onclick="jefeConfirmarLlegada(${s.id})">
                  <svg width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path d="M20 6L9 17l-5-5"/></svg>
                  Llegó al taller
                </button>
              </div>` : ''}
            ${s.estado==='recibido_taller' ? `
              <div style="background:#E6F5EF;border:1px solid #A7F3D0;border-radius:8px;padding:10px 14px;margin-bottom:8px;font-size:13px;color:#065F46;font-weight:600">
                📦 El repuesto está en el taller. Entrégalo al técnico para reanudar su trabajo.
              </div>
              <div style="display:flex;gap:8px;flex-wrap:wrap">
                ${s.etapa_id ? `<button class="btn btn-success btn-sm" onclick="jefeConfirmarEntrega(${s.id},${s.etapa_id})">
                  <svg width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path d="M20 6L9 17l-5-5"/></svg>
                  Entregar al técnico → Reanudar timer
                </button>` : `<button class="btn btn-success btn-sm" onclick="jefeConfirmarEntrega(${s.id},null)">
                  <svg width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path d="M20 6L9 17l-5-5"/></svg>
                  Marcar como entregado
                </button>`}
              </div>` : ''}
            ${s.estado==='enviado_repuestos' ? `
              <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">
                <span style="font-size:12px;color:var(--gris-mid);font-style:italic">⏳ Esperando cotización de repuestos...</span>
              </div>` : ''}
          </div>`;
        }).join('')}
      </div>
    </div>`;

    iniciarPollingRepuestos(()=>{
      if (document.getElementById('repuestos-jefe-contenido')) cargarRepuestosJefe();
      else detenerPollingRepuestos();
    });
  } catch(e) {
    cont.innerHTML = `<div class="empty-state">Error: ${e.message}</div>`;
  }
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
}

function mostrarSeccionRep(sec) {
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
  cont.innerHTML = '<div class="loading-state">Cargando...</div>';

  try {
    const sols = await api('/solicitudes_repuesto?estado=in.(enviado_repuestos,cotizado,pedido,recibido_taller,entregado)&order=creado_en.desc&select=*').catch(()=>[]) || [];
    const oids = [...new Set(sols.map(s=>s.orden_id).filter(Boolean))];
    const ords = oids.length ? await api(`/ordenes?id=in.(${oids.join(',')})&select=id,placa,marca,linea,modelo,vin`).catch(()=>[]) || [] : [];
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
      cont.innerHTML = `<div style="padding:20px"><div style="font-size:16px;font-weight:700;margin-bottom:16px">Solicitudes</div><div class="empty-state"><p>Sin solicitudes asignadas</p></div></div>`;
      return;
    }

    const estadoBadge = {
      enviado_repuestos: { cls:'badge-iniciada',   txt:'Por cotizar' },
      cotizado:          { cls:'badge-cotizada',   txt:'Cotizado' },
      pedido:            { cls:'badge-iniciada',   txt:'Pedido al proveedor' },
      recibido_taller:   { cls:'badge-completada', txt:'Llegó al taller' },
      entregado:         { cls:'badge-completada', txt:'Entregado' }
    };

    cont.innerHTML = `<div style="padding:20px">
      <div style="font-size:16px;font-weight:700;margin-bottom:16px">Solicitudes de repuestos</div>
      <div style="display:flex;flex-direction:column;gap:12px">
        ${sols.map(s => {
          const o = om[s.orden_id] || {};
          const items = todosItems.filter(i => i.solicitud_id === s.id);
          const eb = estadoBadge[s.estado] || { cls:'', txt: s.estado };

          // Timer del proveedor (desde pedido_en hasta ahora o recibido_en)
          let timerProv = '';
          if (s.pedido_en) {
            const finTs = s.recibido_en ? new Date(s.recibido_en) : new Date();
            const mins  = Math.round((finTs - new Date(s.pedido_en)) / 60000);
            const h = Math.floor(mins/60), m = mins%60;
            const label = s.recibido_en ? 'Tardó' : 'Esperando';
            timerProv = `<div style="font-size:11px;color:${s.recibido_en?'#059669':'#D97706'};margin-top:4px;font-weight:600">
              ⏱ ${label}: ${h > 0 ? h+'h ' : ''}${m}m
            </div>`;
          }

          // Lista de ítems
          const itemsHtml = items.length > 0
            ? `<div style="margin:8px 0;display:flex;flex-direction:column;gap:4px">
                ${items.map(i => `<div style="display:flex;align-items:center;gap:8px;font-size:12px">
                  ${i.foto_url ? `<img src="${escapeHtml(i.foto_url)}" style="width:28px;height:28px;object-fit:cover;border-radius:3px;flex-shrink:0">` : ''}
                  <span style="font-weight:600">${escapeHtml(i.repuesto)}</span>
                  <span style="color:var(--gris-mid)">x${i.unidades||1}</span>
                  ${i.observaciones ? `<span style="color:var(--gris-mid);font-style:italic">${escapeHtml(i.observaciones)}</span>` : ''}
                </div>`).join('')}
              </div>`
            : `<div style="font-size:13px;color:var(--gris-mid);margin-bottom:4px">${escapeHtml(s.repuesto)} · x${s.unidades||1}</div>`;

          // Timers universales
          const timerSolicitud2 = _tiempoDesde(s.creado_en, ' desde solicitud');
          const timerEstado2    = _tiempoDesde(s.actualizado_en || s.creado_en, ' en estado');

          return `<div class="card" style="padding:16px">
            ${_barraEstado(s.estado)}
            <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-bottom:8px">
              <div style="flex:1;min-width:0">
                <div style="font-weight:700;font-size:14px;margin-bottom:2px">${items.length > 1 ? `${items.length} repuestos` : escapeHtml(s.repuesto)}</div>
                <div style="font-size:12px;color:var(--azul);font-family:'DM Mono',monospace">
                  ${escapeHtml(o.placa||'—')} · ${formatOT(s.orden_id)}
                </div>
                <div style="font-size:11px;color:var(--gris-mid);margin-top:2px">${escapeHtml(s.solicitado_por||'')} · ${formatTS(s.creado_en)}</div>
                <div style="display:flex;gap:10px;margin-top:4px;flex-wrap:wrap">
                  ${timerSolicitud2}
                  <span style="color:var(--gris-mid);font-size:11px">|</span>
                  ${timerEstado2}
                </div>
                ${timerProv}
              </div>
              <span class="badge ${eb.cls}">${eb.txt}</span>
            </div>
            ${itemsHtml}
            ${s.nota_jefe ? `<div style="font-size:12px;background:var(--gris-bg);padding:6px 10px;border-radius:6px;border-left:3px solid var(--azul);margin-top:6px">${escapeHtml(s.nota_jefe)}</div>` : ''}
            <div style="display:flex;gap:8px;margin-top:10px;flex-wrap:wrap">
              ${s.estado === 'enviado_repuestos' || s.estado === 'cotizado'
                ? `<button class="btn btn-primary btn-sm" data-sol-id="${s.id}" onclick="_abrirCotizarPorId(this)">
                    ${s.estado==='enviado_repuestos' ? '+ Cotizar' : 'Ver / editar cotizaciones'}
                  </button>`
                : ''}
              ${s.estado === 'pedido' && !s.pedido_proveedor_confirmado
                ? `<button class="btn btn-success btn-sm" onclick="marcarRepuestoSolicitadoProveedor(${s.id})"
                    style="display:flex;align-items:center;gap:5px">
                    <svg width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path d="M20 6L9 17l-5-5"/></svg>
                    Confirmar pedido al proveedor
                  </button>`
                : s.estado === 'pedido' && s.pedido_proveedor_confirmado
                ? `<span style="font-size:12px;color:#059669;font-weight:600">✓ Pedido confirmado al proveedor</span>`
                : ''}
            </div>
          </div>`;
        }).join('')}
      </div>
    </div>`;

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
let _cotDatosVehiculo = { repuesto:'', unidades:1, placa:'', marca:'', modelo:'', anio:'', vin:'' };

function _generarMensajeWA() {
  const d = _cotDatosVehiculo;
  const vehiculo = [d.marca, d.modelo, d.anio].filter(Boolean).join(' ') || d.placa || '—';
  const vinStr   = d.vin ? `, VIN: *${d.vin}*` : '';
  return `Buenos días. Solicito cotización para el siguiente vehículo:\nVehículo: *${vehiculo}*${vinStr}.\n\nLos repuestos son:\n- ${d.repuesto} / unidades: (${d.unidades})\n\nQuedo atento, gracias.`;
}

function _copiarMensajeWA(filaId) {
  const msg = _generarMensajeWA();
  navigator.clipboard?.writeText(msg).then(() => toast('Mensaje copiado ✓'))
    .catch(() => { const ta = document.createElement('textarea'); ta.value = msg; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); ta.remove(); toast('Mensaje copiado ✓'); });
}

function _renderFilaCot(fila, idx, provOpts) {
  return `<tr id="cot-fila-${fila.id}" style="border-bottom:1px solid var(--gris-borde)">
    <td style="padding:5px 8px;text-align:center;width:28px">
      <input type="checkbox" id="cot-sel-${fila.id}" ${fila.seleccionado ? 'checked' : ''}
        style="width:15px;height:15px;cursor:pointer">
    </td>
    <td style="padding:4px 6px;min-width:160px">
      <select id="cot-prov-${fila.id}" style="width:100%;font-size:12px;border:1px solid var(--gris-borde);border-radius:4px;padding:4px 6px">${provOpts}</select>
    </td>
    <td style="padding:4px 6px;min-width:90px">
      <input id="cot-ref-${fila.id}" type="text" value="${escapeHtml(fila.referencia||'')}"
        placeholder="Ref..." style="width:100%;font-size:12px;border:1px solid var(--gris-borde);border-radius:4px;padding:4px 6px">
    </td>
    <td style="padding:4px 6px;min-width:90px">
      <input id="cot-precio-${fila.id}" type="number" value="${fila.precio||''}"
        placeholder="$0" min="0" style="width:100%;font-size:12px;border:1px solid var(--gris-borde);border-radius:4px;padding:4px 6px;font-family:'DM Mono',monospace">
    </td>
    <td style="padding:4px 6px;width:46px">
      <input id="cot-dias-${fila.id}" type="number" value="${fila.dias||''}"
        placeholder="—" min="0" style="width:40px;font-size:12px;border:1px solid var(--gris-borde);border-radius:4px;padding:4px 4px;text-align:center">
    </td>
    <td style="padding:4px 8px;white-space:nowrap">
      <label style="display:flex;align-items:center;gap:4px;font-size:12px;cursor:pointer">
        <input type="radio" name="cot-orig-${fila.id}" value="si" ${fila.esOriginal!==false ? 'checked' : ''}> Sí
      </label>
      <label style="display:flex;align-items:center;gap:4px;font-size:12px;cursor:pointer">
        <input type="radio" name="cot-orig-${fila.id}" value="no" ${fila.esOriginal===false ? 'checked' : ''}> No
      </label>
    </td>
    <td style="padding:4px 6px;text-align:center;white-space:nowrap">
      <button type="button" title="Copiar mensaje WhatsApp para este proveedor"
        onclick="_copiarMensajeWA(${fila.id})"
        style="background:#25D366;color:#fff;border:none;border-radius:4px;padding:3px 7px;font-size:11px;cursor:pointer;font-weight:600">
        📋 WA
      </button>
    </td>
    <td style="padding:4px 6px;text-align:center">
      ${idx > 0
        ? `<button type="button" onclick="_quitarFilaCot(${fila.id})"
            style="background:none;border:none;cursor:pointer;color:#DC2626;font-size:14px;line-height:1;padding:2px 4px">✕</button>`
        : ''}
    </td>
  </tr>`;
}

function _quitarFilaCot(id) {
  _cotFilas = _cotFilas.filter(f => f.id !== id);
  _reRenderFilasCot();
}

function _agregarFilaCot() {
  _cotFilas.push({ id: Date.now(), seleccionado: false, proveedorId: '', referencia: '', precio: '', dias: '', esOriginal: true });
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

async function abrirModalCotizar(solicitudId, repuesto, unidades, placa, marca, modelo, anio, vin) {
  _cotDatosVehiculo = { repuesto: repuesto||'', unidades: unidades||1, placa: placa||'', marca: marca||'', modelo: modelo||'', anio: anio||'', vin: vin||'' };
  const [proveedores, cots, solItems, sol] = await Promise.all([
    api('/proveedores?activo=eq.true&order=nombre.asc').catch(()=>[]) || [],
    api(`/cotizaciones_repuesto?solicitud_id=eq.${solicitudId}&order=opcion.asc`).catch(()=>[]) || [],
    api(`/solicitud_items?solicitud_id=eq.${solicitudId}&order=creado_en.asc`).catch(()=>[]) || [],
    api(`/solicitudes_repuesto?id=eq.${solicitudId}`).then(r=>r?.[0]).catch(()=>null)
  ]);
  const existing = document.getElementById('modal-cotizar');
  if (existing) existing.remove();

  // Usar ítems de solicitud_items si existen; si no, usar los campos legacy
  const itemsList = solItems.length ? solItems : [{ repuesto, unidades, observaciones: null, foto_url: null }];

  // Score de proveedores — favorito = el de menor tiempo_respuesta_promedio_min
  const provConScore = proveedores.map(p => ({
    ...p,
    score: p.tiempo_respuesta_promedio_min != null ? p.tiempo_respuesta_promedio_min : Infinity
  })).sort((a, b) => a.score - b.score);
  const favoritoId = provConScore[0]?.score < Infinity ? provConScore[0].id : null;

  const provOpts = '<option value="">— Proveedor —</option>' +
    provConScore.map(p => {
      const star = p.id === favoritoId ? '★ ' : '';
      const tiempo = p.tiempo_respuesta_promedio_min != null
        ? ` · ${Math.round(p.tiempo_respuesta_promedio_min/60)}h prom`
        : '';
      return `<option value="${p.id}">${star}${escapeHtml(p.nombre)}${tiempo}</option>`;
    }).join('');

  // Inicializar filas desde cotizaciones existentes o una fila vacía
  if (cots.length) {
    _cotFilas = cots.map(c => ({
      id:          c.id,
      seleccionado: true,
      proveedorId: c.proveedor_id || '',
      referencia:  c.referencia || '',
      precio:      c.precio_costo || '',
      dias:        c.dias_entrega || '',
      esOriginal:  c.es_original !== false
    }));
  } else {
    _cotFilas = [{ id: Date.now(), seleccionado: false, proveedorId: favoritoId || '', referencia: '', precio: '', dias: '', esOriginal: true }];
  }

  // Timer desde creado_en de la solicitud
  const timerSolicitud = sol?.creado_en ? _tiempoDesde(sol.creado_en, ' desde solicitud') : '';

  // Resumen encabezado
  const titulo = `${escapeHtml(repuesto)} (x${unidades})${placa ? ' · ' + escapeHtml(placa) : ''}${sol ? ' · ' + formatOT(solicitudId) : ''}`;

  // Info del favorito
  const favInfo = favoritoId
    ? (() => {
        const fp = provConScore[0];
        const h = Math.round((fp.tiempo_respuesta_promedio_min||0)/60);
        return `<div style="font-size:11px;color:#D97706;margin-bottom:10px">★ Favorito: <strong>${escapeHtml(fp.nombre)}</strong> · Prom: ${h}h</div>`;
      })()
    : '';

  const div = document.createElement('div');
  div.id = 'modal-cotizar';
  div.className = 'modal-overlay show';
  div.innerHTML = `
    <!-- oculto: provOpts para re-render -->
    <input type="hidden" id="_cot-prov-opts" value="">
    <div class="modal" style="max-width:680px;max-height:90vh;overflow-y:auto">
      <div class="modal-header" style="padding-bottom:8px">
        <div>
          <div class="modal-titulo" style="font-size:14px">Cotización · ${titulo}</div>
          <div style="font-size:11px;color:var(--gris-mid);margin-top:3px">${timerSolicitud}</div>
        </div>
        <button class="modal-close" onclick="document.getElementById('modal-cotizar').remove()">✕</button>
      </div>
      <div class="modal-body" style="padding-top:10px">
        ${favInfo}

        <!-- Tabla compacta -->
        <div style="border:1px solid var(--gris-borde);border-radius:8px;overflow-x:auto;margin-bottom:10px">
          <table style="width:100%;border-collapse:collapse;font-size:12px;min-width:560px">
            <thead>
              <tr style="background:var(--gris-bg)">
                <th style="padding:7px 8px;width:28px"></th>
                <th style="padding:7px 8px;text-align:left;font-size:10px;color:var(--gris-mid);font-weight:700;text-transform:uppercase;letter-spacing:.5px">Proveedor</th>
                <th style="padding:7px 8px;text-align:left;font-size:10px;color:var(--gris-mid);font-weight:700;text-transform:uppercase;letter-spacing:.5px">Referencia</th>
                <th style="padding:7px 8px;text-align:left;font-size:10px;color:var(--gris-mid);font-weight:700;text-transform:uppercase;letter-spacing:.5px">Vr.Unit</th>
                <th style="padding:7px 8px;text-align:center;font-size:10px;color:var(--gris-mid);font-weight:700;text-transform:uppercase;letter-spacing:.5px">Días</th>
                <th style="padding:7px 8px;text-align:left;font-size:10px;color:var(--gris-mid);font-weight:700;text-transform:uppercase;letter-spacing:.5px">Original</th>
                <th style="padding:7px 8px;text-align:center;font-size:10px;color:var(--gris-mid);font-weight:700;text-transform:uppercase;letter-spacing:.5px">Msg WA</th>
                <th style="width:28px"></th>
              </tr>
            </thead>
            <tbody id="cot-tabla-tbody">
              ${_cotFilas.map((f, i) => _renderFilaCot(f, i, provOpts)).join('')}
            </tbody>
          </table>
        </div>
        <button type="button" class="btn btn-ghost btn-sm" onclick="_agregarFilaCot()" style="margin-bottom:12px">
          + Agregar proveedor
        </button>

        <!-- Notas -->
        <div class="field" style="margin-bottom:0">
          <label style="font-size:11px">Notas</label>
          <input id="cot-notas" type="text" placeholder="Observaciones generales..." value="${escapeHtml(sol?.nota_repuestos||'')}"
            style="font-size:13px">
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-ghost" onclick="document.getElementById('modal-cotizar').remove()">Cancelar</button>
        <button class="btn btn-primary" onclick="guardarCotizaciones(${solicitudId})">Guardar cotización →</button>
      </div>
    </div>`;
  document.body.appendChild(div);

  // Guardar provOpts en input oculto para re-renders
  document.getElementById('_cot-prov-opts').value = provOpts;

  // Pre-seleccionar proveedores de cotizaciones existentes
  _cotFilas.forEach(f => {
    const s = document.getElementById(`cot-prov-${f.id}`);
    if (s && f.proveedorId) s.value = f.proveedorId;
  });
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
      seleccionado: document.getElementById(`cot-sel-${f.id}`)?.checked ?? f.seleccionado,
      proveedorId: document.getElementById(`cot-prov-${f.id}`)?.value || null,
      referencia:  document.getElementById(`cot-ref-${f.id}`)?.value?.trim() || null,
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
        referencia:    f.referencia,
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
      estado: 'cotizado',
      nota_repuestos: notas
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

    // Poblar registry para evitar pasar JSON en onclick
    _provRegistry = {};
    provs.forEach(p => { _provRegistry[p.id] = p; });

    cont.innerHTML = `<div style="padding:20px">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px">
        <div style="font-size:16px;font-weight:700">Proveedores</div>
        <button class="btn btn-primary btn-sm" onclick="abrirModalProveedor()">+ Nuevo proveedor</button>
      </div>
      ${provs.length ? `<div style="overflow-x:auto;-webkit-overflow-scrolling:touch"><table style="width:100%;border-collapse:collapse;font-size:13px;min-width:500px">
        <thead><tr style="background:var(--gris-bg);border-bottom:1px solid var(--gris-borde)">
          <th style="padding:10px 12px;text-align:left;font-size:10px;font-weight:700;letter-spacing:1px;color:var(--gris-mid);text-transform:uppercase">Nombre</th>
          <th style="padding:10px 12px;text-align:left;font-size:10px;font-weight:700;letter-spacing:1px;color:var(--gris-mid);text-transform:uppercase">Tipo</th>
          <th style="padding:10px 12px;text-align:left;font-size:10px;font-weight:700;letter-spacing:1px;color:var(--gris-mid);text-transform:uppercase">Ciudad</th>
          <th style="padding:10px 12px;text-align:left;font-size:10px;font-weight:700;letter-spacing:1px;color:var(--gris-mid);text-transform:uppercase">WhatsApp</th>
          <th style="padding:10px 12px;text-align:left;font-size:10px;font-weight:700;letter-spacing:1px;color:var(--gris-mid);text-transform:uppercase">Marcas</th>
          <th></th>
        </tr></thead>
        <tbody>
          ${provs.map(p=>`<tr style="border-bottom:1px solid var(--gris-borde)">
            <td style="padding:10px 12px;font-weight:600">${escapeHtml(p.nombre)}</td>
            <td style="padding:10px 12px;color:var(--gris-mid)">${escapeHtml(p.tipo_proveedor||'—')}</td>
            <td style="padding:10px 12px">${escapeHtml(p.ciudad||'—')}</td>
            <td style="padding:10px 12px;font-family:'DM Mono',monospace">${escapeHtml(p.whatsapp||'—')}</td>
            <td style="padding:10px 12px;font-size:11px;color:var(--gris-mid)">
              ${p.multimarca?'<span style="background:var(--azul-light);color:var(--azul);padding:2px 6px;border-radius:3px;font-size:10px;font-weight:600">Multimarca</span>':(p.marcas||[]).slice(0,3).map(escapeHtml).join(', ')||'—'}
            </td>
            <td style="padding:10px 12px">
              <button class="btn btn-ghost btn-sm" data-prov-id="${p.id}" onclick="_editarProveedorPorId(this)">Editar</button>
            </td>
          </tr>`).join('')}
        </tbody>
      </table></div>` : '<div class="empty-state"><p>Sin proveedores registrados</p></div>'}
    </div>`;
  } catch(e) { cont.innerHTML = `<div class="empty-state">Error: ${e.message}</div>`; }
}

function abrirModalProveedor(prov) {
  const existing = document.getElementById('modal-proveedor');
  if (existing) existing.remove();
  const p = prov||{};
  const selMarcas = p.marcas||[];
  const esMulti   = p.multimarca||false;

  const marcasHtml = MARCAS_VEHICULOS.map(m=>`
    <label style="display:flex;align-items:center;gap:5px;font-size:12px;cursor:pointer;padding:2px 0">
      <input type="checkbox" name="prov-marca" value="${escapeHtml(m)}" ${selMarcas.includes(m)||esMulti?'checked':''}>
      ${escapeHtml(m)}
    </label>`).join('');

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
          <div id="prov-marcas-wrap" style="max-height:200px;overflow-y:auto;border:1px solid var(--gris-borde);border-radius:8px;padding:10px 14px;display:grid;grid-template-columns:1fr 1fr 1fr;${esMulti?'opacity:.4;pointer-events:none':''}">
            ${marcasHtml}
          </div>
        </div>
        ${p.id ? `<div class="field"><label>Estado</label>
          <select id="prov-activo" style="width:100%">
            <option value="true"  ${p.activo!==false?'selected':''}>Activo</option>
            <option value="false" ${p.activo===false?'selected':''}>Inactivo</option>
          </select></div>` : ''}
      </div>
      <div class="modal-footer">
        <button class="btn btn-ghost" onclick="document.getElementById('modal-proveedor').remove()">Cancelar</button>
        <button class="btn btn-primary" onclick="guardarProveedor(${p.id||'null'})">Guardar</button>
      </div>
    </div>`;
  document.body.appendChild(div);
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
    if (id) await api(`/proveedores?id=eq.${id}`,'PATCH',body);
    else     await api('/proveedores','POST',body,{Prefer:'return=minimal'});
    toast('Proveedor guardado ✓');
    document.getElementById('modal-proveedor')?.remove();
    cargarProveedores();
  } catch(e) { toast('Error: '+e.message,'err'); }
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
