// ═══════════════════════════════════════════════════════════
// FLOTILLAS — Gestión de flotas y registro de vehículos
// ═══════════════════════════════════════════════════════════

// ── Estado del módulo ────────────────────────────────────
let _flotillas       = [];
let _flotillaActual  = null;
let _vehiculosActual = [];
let _vehiculoEditar  = null;
let _vehiculoFotoFile = null;

// ═══════════════════════════════════════════════════════════
// INGRESO PARTICULAR — registro de vehículos de clientes independientes
// (pestaña "Ingreso Particular" del menú Registro → pag-vehiculos)
// ═══════════════════════════════════════════════════════════
async function montarIngresoParticular() {
  const pag = document.getElementById('pag-vehiculos');
  if (!pag) return;

  pag.innerHTML = `
    <div style="margin-bottom:20px">
      <div style="font-size:18px;font-weight:700;color:var(--texto);margin-bottom:4px">Ingreso particular</div>
      <div style="font-size:13px;color:var(--gris-mid)">Registra un vehículo de un cliente independiente (no pertenece a flotilla ni empresa).</div>
    </div>

    <!-- CARD: VEHÍCULO PARTICULAR -->
    <div class="dash-panel" style="max-width:420px;margin-bottom:30px">
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:12px">
        <div style="width:44px;height:44px;background:var(--azul-bg,#EBF2FF);border-radius:12px;display:flex;align-items:center;justify-content:center;flex-shrink:0">
          <svg width="22" height="22" fill="none" stroke="var(--azul)" stroke-width="1.8" viewBox="0 0 24 24">
            <path d="M19 17H5v-5l2.5-5h9L19 12v5z"/>
            <circle cx="7.5" cy="17" r="2"/><circle cx="16.5" cy="17" r="2"/>
            <path d="M5 12h14"/>
          </svg>
        </div>
        <div>
          <div style="font-size:15px;font-weight:700;color:var(--texto)">Vehículo particular</div>
          <div style="font-size:12px;color:var(--gris-mid)">Cliente independiente</div>
        </div>
      </div>
      <div style="font-size:12px;color:var(--gris-mid);line-height:1.65;margin-bottom:18px">
        Vehículo de un cliente que no pertenece a ninguna empresa ni grupo. Se guarda para agilizar ingresos futuros.
      </div>
      <button class="btn btn-primary" style="width:100%" onclick="abrirModalRegistrarVehiculo(null)">
        <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>
        Registrar vehículo particular
      </button>
    </div>

    <!-- Lista de vehículos particulares registrados -->
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;flex-wrap:wrap;gap:8px">
      <div style="font-size:14px;font-weight:700;color:var(--texto)">Vehículos particulares registrados</div>
      <input type="text" id="flot-buscar" placeholder="Buscar por placa, nombre o cédula..."
        style="padding:8px 14px;border:1px solid var(--gris-borde);border-radius:8px;font-size:13px;width:280px"
        oninput="filtrarVehiculosFlotilla(this.value)">
    </div>
    <div id="flotilla-vehiculos-lista">
      <div class="loading-state">Cargando vehículos...</div>
    </div>
  `;

  await cargarVehiculosFlotilla(null);
}

// ═══════════════════════════════════════════════════════════
// INGRESO FLOTILLA — gestión de flotas / empresas
// (pestaña "Ingreso Flotilla" del menú Registro → pag-flotillas)
// ═══════════════════════════════════════════════════════════
async function montarFlotillas() {
  const pag = document.getElementById('pag-flotillas');
  if (!pag) return;
  _flotillaActual = null;

  // Pre-cargar flotillas en segundo plano
  api('/flotillas?order=nombre.asc').catch(() => []).then(r => { if (r) _flotillas = r; });

  pag.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;flex-wrap:wrap;gap:10px">
      <div>
        <div style="font-size:18px;font-weight:700;color:var(--texto);margin-bottom:4px">Ingreso flotilla / empresa</div>
        <div style="font-size:13px;color:var(--gris-mid)">Empresas, aseguradoras u organizaciones con varios vehículos.</div>
      </div>
      <button class="btn btn-primary" style="background:#7C3AED;border-color:#7C3AED" onclick="abrirModalNuevaFlotilla()">
        <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>
        Nueva flotilla
      </button>
    </div>

    <div id="flotillas-grid" class="ordenes-grid">
      <div class="loading-state">Cargando flotillas...</div>
    </div>
  `;

  await cargarFlotillas();
}

// ═══════════════════════════════════════════════════════════
// VISTA FLOTILLAS — Lista de flotillas/empresas
// ═══════════════════════════════════════════════════════════
async function _mostrarVistaFlotillas() {
  const pag = document.getElementById('pag-flotillas');
  if (!pag) return;

  pag.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;flex-wrap:wrap;gap:10px">
      <div style="display:flex;align-items:center;gap:12px">
        <button class="back-btn" style="position:static;margin:0" onclick="montarFlotillas()">← Volver</button>
        <div>
          <div style="font-size:18px;font-weight:700;color:var(--texto)">Flotillas y empresas</div>
          <div style="font-size:12px;color:var(--gris-mid);margin-top:2px">Gestiona grupos de vehículos registrados</div>
        </div>
      </div>
      <button class="btn btn-primary" onclick="abrirModalNuevaFlotilla()">
        <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>
        Nueva flotilla
      </button>
    </div>
    <div id="flotillas-grid" class="ordenes-grid">
      <div class="loading-state">Cargando flotillas...</div>
    </div>
  `;

  await cargarFlotillas();
}

async function cargarFlotillas() {
  const grid = document.getElementById('flotillas-grid');
  if (!grid) return;
  try {
    const [flotillas, vehiculos] = await Promise.all([
      api('/flotillas?order=nombre.asc').catch(() => []) || [],
      api('/vehiculos?select=id,flotilla_id').catch(() => []) || []
    ]);
    _flotillas = flotillas || [];

    const conteo = {};
    (vehiculos || []).forEach(v => {
      if (v.flotilla_id) conteo[v.flotilla_id] = (conteo[v.flotilla_id] || 0) + 1;
    });
    const sinFlotilla = (vehiculos || []).filter(v => !v.flotilla_id).length;

    if (!_flotillas.length) {
      grid.innerHTML = `
        <div class="empty-state" style="grid-column:1/-1">
          <svg width="48" height="48" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24" style="margin-bottom:12px;color:var(--gris-mid)"><rect x="1" y="3" width="15" height="13" rx="1"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>
          <div style="font-weight:600;margin-bottom:6px">No hay flotillas registradas</div>
          <div style="font-size:13px;color:var(--gris-mid);margin-bottom:14px">Crea la primera flotilla o empresa para organizar sus vehículos</div>
          <button class="btn btn-primary btn-sm" onclick="abrirModalNuevaFlotilla()">+ Crear primera flotilla</button>
        </div>`;
      return;
    }

    const cards = (_flotillas || []).map(f => `
      <div class="orden-card" style="cursor:pointer" onclick="abrirFlotilla(${f.id})">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:10px">
          <div>
            <div style="font-weight:700;font-size:15px;color:var(--texto)">${escapeHtml(f.nombre||'Sin nombre')}</div>
            ${f.nit ? `<div style="font-size:11px;color:var(--gris-mid)">NIT ${escapeHtml(f.nit)}</div>` : ''}
          </div>
          <div style="background:var(--azul-bg,#EBF2FF);color:var(--azul);border-radius:20px;padding:3px 10px;font-size:12px;font-weight:700;white-space:nowrap">
            ${conteo[f.id] || 0} vehículos
          </div>
        </div>
        ${f.direccion ? `<div style="font-size:12px;color:var(--gris-mid);margin-bottom:4px">📍 ${escapeHtml(f.direccion)}</div>` : ''}
        ${f.telefono  ? `<div style="font-size:12px;color:var(--gris-mid);margin-bottom:4px">📞 ${escapeHtml(f.telefono)}</div>` : ''}
        <div style="margin-top:10px;display:flex;justify-content:flex-end">
          <span style="font-size:12px;color:var(--azul);font-weight:600">Ver vehículos →</span>
        </div>
      </div>`).join('');

    grid.innerHTML = cards ||
      `<div class="empty-state" style="grid-column:1/-1">No hay flotillas registradas todavía.</div>`;

  } catch (e) {
    grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1">Error cargando flotillas: ${escapeHtml(e.message)}</div>`;
  }
}

// ═══════════════════════════════════════════════════════════
// VISTA DETALLE — Vehículos de una flotilla
// ═══════════════════════════════════════════════════════════
async function abrirFlotilla(flotillaId) {
  const pag = document.getElementById('pag-flotillas');
  if (!pag) return;

  _flotillaActual = flotillaId ? (_flotillas.find(f => f.id === flotillaId) || { id: flotillaId, nombre: '...' }) : null;
  const nombre = _flotillaActual ? escapeHtml(_flotillaActual.nombre || 'Flotilla') : 'Sin flotilla asignada';

  pag.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;flex-wrap:wrap;gap:10px">
      <div style="display:flex;align-items:center;gap:12px">
        <button class="back-btn" style="position:static;margin:0" onclick="_mostrarVistaFlotillas()">← Volver</button>
        <div>
          <div style="font-size:18px;font-weight:700;color:var(--texto)">${nombre}</div>
          ${_flotillaActual?.nit ? `<div style="font-size:11px;color:var(--gris-mid)">NIT ${escapeHtml(_flotillaActual.nit)}</div>` : ''}
        </div>
      </div>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        ${_flotillaActual ? `<button class="btn btn-ghost btn-sm" onclick="abrirModalEditarFlotilla(${flotillaId})">Editar flotilla</button>` : ''}
        <button class="btn btn-primary" onclick="abrirModalRegistrarVehiculo(${flotillaId || 'null'})">
          <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>
          Registrar vehículo
        </button>
      </div>
    </div>
    <div style="margin-bottom:16px">
      <input type="text" id="flot-buscar" placeholder="Buscar por placa, propietario o cédula..."
        style="width:100%;max-width:420px;padding:9px 14px;border:1px solid var(--gris-borde);border-radius:8px;font-size:14px"
        oninput="filtrarVehiculosFlotilla(this.value)">
    </div>
    <div id="flotilla-vehiculos-lista">
      <div class="loading-state">Cargando vehículos...</div>
    </div>`;

  await cargarVehiculosFlotilla(flotillaId);
}

async function cargarVehiculosFlotilla(flotillaId) {
  const lista = document.getElementById('flotilla-vehiculos-lista');
  if (!lista) return;
  try {
    const url = flotillaId
      ? `/vehiculos?flotilla_id=eq.${flotillaId}&order=fecha_ingreso.desc`
      : `/vehiculos?flotilla_id=is.null&order=fecha_ingreso.desc`;
    _vehiculosActual = await api(url).catch(() => []) || [];
    renderVehiculosFlotilla(_vehiculosActual);
  } catch (e) {
    lista.innerHTML = `<div class="empty-state">Error: ${escapeHtml(e.message)}</div>`;
  }
}

function renderVehiculosFlotilla(vehiculos) {
  const lista = document.getElementById('flotilla-vehiculos-lista');
  if (!lista) return;

  if (!vehiculos.length) {
    lista.innerHTML = `
      <div class="empty-state">
        <svg width="40" height="40" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24" style="margin-bottom:10px;color:var(--gris-mid)"><path d="M14 16H9m10 0h3v-3.15a1 1 0 00-.84-.99L16 11l-2.7-3.6a1 1 0 00-.8-.4H5.24a2 2 0 00-1.8 1.1l-.8 1.63A6 6 0 002 12.42V16h2"/><circle cx="6.5" cy="16.5" r="2.5"/><circle cx="16.5" cy="16.5" r="2.5"/></svg>
        <div style="font-weight:600;margin-bottom:4px">No hay vehículos registrados</div>
        <div style="font-size:13px;color:var(--gris-mid)">Usa "Registrar vehículo" para agregar uno</div>
      </div>`;
    return;
  }

  lista.innerHTML = `
    <div style="overflow-x:auto">
      <table style="width:100%;border-collapse:collapse;font-size:13px;min-width:700px">
        <thead>
          <tr style="background:var(--gris-bg);border-bottom:2px solid var(--gris-borde)">
            <th style="padding:10px 12px;text-align:left;font-size:11px;color:var(--gris-mid);text-transform:uppercase;letter-spacing:.5px">Placa</th>
            <th style="padding:10px 12px;text-align:left;font-size:11px;color:var(--gris-mid);text-transform:uppercase;letter-spacing:.5px">Vehículo</th>
            <th style="padding:10px 12px;text-align:left;font-size:11px;color:var(--gris-mid);text-transform:uppercase;letter-spacing:.5px">Propietario</th>
            <th style="padding:10px 12px;text-align:left;font-size:11px;color:var(--gris-mid);text-transform:uppercase;letter-spacing:.5px">Cédula / NIT</th>
            <th style="padding:10px 12px;text-align:center;font-size:11px;color:var(--gris-mid);text-transform:uppercase;letter-spacing:.5px">Acciones</th>
          </tr>
        </thead>
        <tbody>
          ${vehiculos.map(v => `
            <tr class="row-hover" style="border-bottom:1px solid var(--gris-borde)">
              <td style="padding:11px 12px">
                <span style="font-family:'DM Mono',monospace;font-weight:700;font-size:14px;letter-spacing:2px;color:var(--texto)">${escapeHtml(v.placa||'—')}</span>
                ${v.foto_tarjeta_url ? `<br><a href="${escapeHtml(v.foto_tarjeta_url)}" target="_blank" style="font-size:10px;color:var(--azul)">ver tarjeta</a>` : ''}
              </td>
              <td style="padding:11px 12px">
                <div style="font-weight:600">${[v.marca, v.linea].filter(Boolean).map(escapeHtml).join(' ') || '—'}</div>
                <div style="font-size:11px;color:var(--gris-mid)">${[v.modelo, v.color].filter(Boolean).map(escapeHtml).join(' · ') || ''}</div>
                ${v.vin ? `<div style="font-size:10px;color:var(--gris-mid);font-family:monospace">VIN: ${escapeHtml(v.vin)}</div>` : ''}
              </td>
              <td style="padding:11px 12px">
                <div>${escapeHtml(v.propietario||'—')}</div>
                ${v.telefono ? `<div style="font-size:11px;color:var(--gris-mid)">${escapeHtml(v.telefono)}</div>` : ''}
              </td>
              <td style="padding:11px 12px;color:var(--gris-mid);font-family:monospace;font-size:12px">${escapeHtml(v.cedula_nit||'—')}</td>
              <td style="padding:11px 12px;text-align:center">
                <div style="display:flex;gap:6px;justify-content:center;flex-wrap:wrap">
                  <button class="btn btn-sm btn-primary" data-vid="${v.id}" onclick="crearOrdenDesdeVehiculo(this.dataset.vid)">
                    <svg width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/></svg>
                    Orden
                  </button>
                  <button class="btn btn-sm btn-ghost" data-vid="${v.id}" onclick="abrirModalEditarVehiculo(this.dataset.vid)">
                    <svg width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                  </button>
                  ${v.placa ? `<button class="btn btn-sm btn-ghost" onclick="abrirPopupConsumibles('${escapeHtml(v.placa)}',${v.km||v.kilometraje||0})" title="Consumibles & Docs" style="font-size:14px;padding:4px 6px">🔧</button>` : ''}
                </div>
              </td>
            </tr>`).join('')}
        </tbody>
      </table>
    </div>`;
}

function filtrarVehiculosFlotilla(q) {
  if (!q) { renderVehiculosFlotilla(_vehiculosActual); return; }
  const ql = q.toLowerCase();
  renderVehiculosFlotilla(_vehiculosActual.filter(v =>
    (v.placa||'').toLowerCase().includes(ql) ||
    (v.propietario||'').toLowerCase().includes(ql) ||
    (v.cedula_nit||'').toLowerCase().includes(ql) ||
    (v.marca||'').toLowerCase().includes(ql)
  ));
}

// ═══════════════════════════════════════════════════════════
// CREAR ORDEN DESDE VEHÍCULO REGISTRADO
// ═══════════════════════════════════════════════════════════
function crearOrdenDesdeVehiculo(vehiculoId) {
  const v = _vehiculosActual.find(x => x.id == vehiculoId);
  if (!v) { toast('Vehículo no encontrado', 'err'); return; }

  navJefe('nueva');

  setTimeout(() => {
    const campos = { 'n-placa': v.placa, 'n-marca': v.marca, 'n-linea': v.linea,
                     'n-modelo': v.modelo, 'n-color': v.color, 'n-vin': v.vin };
    Object.entries(campos).forEach(([id, val]) => {
      const el = document.getElementById(id);
      if (el && val) el.value = val;
    });

    if (v.flotilla_id) {
      const tabFlot = document.getElementById('tcb-flotilla');
      if (tabFlot) selTipoCliente(tabFlot, 'flotilla');
      setTimeout(() => {
        const sel = document.getElementById('n-flotilla-sel');
        if (sel) { sel.value = v.flotilla_id; if (!sel.value) recargarListasNuevaOrden().then(() => { sel.value = v.flotilla_id; }); }
      }, 250);
    } else {
      const tabPart = document.getElementById('tcb-particular');
      if (tabPart) selTipoCliente(tabPart, 'particular');
      const propEl = document.getElementById('n-propietario');
      const cedEl  = document.getElementById('n-cedula-cliente');
      const telEl  = document.getElementById('n-telefono');
      if (propEl && v.propietario) propEl.value = v.propietario;
      if (cedEl  && v.cedula_nit)  cedEl.value  = v.cedula_nit;
      if (telEl  && v.telefono)    telEl.value   = v.telefono;
    }

    const resultDiv = document.getElementById('placa-resultado');
    if (resultDiv) {
      resultDiv.className = 'placa-resultado encontrado';
      resultDiv.innerHTML = `🚗 Vehículo de flotilla cargado — revisa y confirma los datos.`;
      resultDiv.style.display = 'block';
    }
    if (typeof buscarPorPlaca === 'function') buscarPorPlaca();
    toast(`Datos de ${v.placa} cargados`);
  }, 300);
}

// ═══════════════════════════════════════════════════════════
// MODAL — REGISTRAR / EDITAR VEHÍCULO
// ═══════════════════════════════════════════════════════════
function abrirModalRegistrarVehiculo(flotillaId) {
  _vehiculoEditar = null;
  _abrirModalVehiculo(flotillaId, null);
}

function abrirModalEditarVehiculo(vehiculoId) {
  const v = _vehiculosActual.find(x => x.id == vehiculoId);
  if (!v) { toast('Vehículo no encontrado', 'err'); return; }
  _vehiculoEditar = v;
  _abrirModalVehiculo(v.flotilla_id, v);
}

function _abrirModalVehiculo(flotillaId, vehiculo) {
  document.getElementById('modal-vehiculo-flot')?.remove();
  const v = vehiculo || {};
  const titulo = vehiculo ? 'Editar vehículo' : 'Registrar vehículo';
  const flotOpts = [
    `<option value="">— Sin flotilla —</option>`,
    ...(_flotillas || []).map(f =>
      `<option value="${f.id}" ${f.id == flotillaId ? 'selected' : ''}>${escapeHtml(f.nombre||'')}</option>`)
  ].join('');

  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.id = 'modal-vehiculo-flot';
  modal.style.zIndex = '1000';
  modal.innerHTML = `
    <div class="modal" style="max-width:640px;width:95%">
      <div class="modal-header">
        <h2 style="font-size:16px">${titulo}</h2>
        <button class="btn btn-ghost btn-sm" onclick="cerrarModalVehiculo()">✕</button>
      </div>
      <div class="modal-body" style="max-height:80vh;overflow-y:auto">

        <!-- OCR Tarjeta -->
        <div style="background:var(--azul-bg,#EBF2FF);border:1.5px dashed var(--azul);border-radius:10px;padding:14px 16px;margin-bottom:18px;display:flex;align-items:center;gap:14px;flex-wrap:wrap">
          <svg width="28" height="28" fill="none" stroke="var(--azul)" stroke-width="1.8" viewBox="0 0 24 24"><path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/><circle cx="12" cy="13" r="4"/></svg>
          <div style="flex:1;min-width:160px">
            <div style="font-weight:700;font-size:13px;color:var(--azul)">Leer tarjeta de propiedad</div>
            <div style="font-size:11px;color:var(--gris-mid);margin-top:2px">Toma o sube una foto y los datos se llenarán automáticamente</div>
          </div>
          <label class="btn btn-primary" style="cursor:pointer;white-space:nowrap">
            <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/><circle cx="12" cy="13" r="4"/></svg>
            Escanear tarjeta
            <input type="file" id="ocr-vehiculo-input" accept="image/*" capture="environment"
              style="display:none" onchange="ocrTarjetaVehiculo(this)">
          </label>
        </div>

        <div id="ocr-vehiculo-estado" style="display:none;margin-bottom:14px;font-size:12px;padding:8px 12px;border-radius:6px;border:1px solid var(--gris-borde);background:var(--gris-bg)"></div>

        <!-- Preview foto tarjeta -->
        <div id="vehiculo-foto-preview" style="${v.foto_tarjeta_url ? '' : 'display:none'};margin-bottom:14px">
          <div style="font-size:11px;color:var(--gris-mid);margin-bottom:4px">Foto de tarjeta:</div>
          <img id="vehiculo-foto-img" src="${escapeHtml(v.foto_tarjeta_url||'')}"
            style="max-width:100%;max-height:160px;border-radius:8px;border:1px solid var(--gris-borde);cursor:pointer"
            onclick="abrirLightbox(this.src)" onerror="this.parentElement.style.display='none'">
        </div>

        <!-- Formulario -->
        <div class="grid-2" style="gap:12px">
          <div class="field full">
            <label>Placa <span style="color:var(--rojo)">*</span></label>
            <input id="vf-placa" value="${escapeHtml(v.placa||'')}"
              style="font-family:'DM Mono',monospace;letter-spacing:2px;text-transform:uppercase"
              placeholder="ABC123" maxlength="7" oninput="this.value=this.value.toUpperCase()">
          </div>
          <div class="field"><label>Marca</label><input id="vf-marca" value="${escapeHtml(v.marca||'')}" placeholder="Toyota"></div>
          <div class="field"><label>Línea</label><input id="vf-linea" value="${escapeHtml(v.linea||'')}" placeholder="Hilux"></div>
          <div class="field"><label>Modelo (año)</label><input id="vf-modelo" value="${escapeHtml(v.modelo||'')}" placeholder="2021" maxlength="4" type="number" min="1950" max="2099"></div>
          <div class="field"><label>Color</label><input id="vf-color" value="${escapeHtml(v.color||'')}" placeholder="Blanco"></div>
          <div class="field full">
            <label>VIN <span style="font-weight:400;font-size:11px;color:var(--gris-mid)">(opcional)</span></label>
            <input id="vf-vin" value="${escapeHtml(v.vin||'')}" placeholder="WBA3A5C50DF256145"
              maxlength="17" style="font-family:'DM Mono',monospace;letter-spacing:1px"
              oninput="this.value=this.value.toUpperCase()">
          </div>
          <div class="field full" style="border-top:1px solid var(--gris-borde);padding-top:12px;margin-top:4px">
            <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:var(--gris-mid);margin-bottom:10px">Propietario según tarjeta</div>
          </div>
          <div class="field full">
            <label>Nombre completo <span style="color:var(--rojo)">*</span></label>
            <input id="vf-propietario" value="${escapeHtml(v.propietario||'')}" placeholder="Nombre completo del titular">
          </div>
          <div class="field">
            <label>Cédula / NIT</label>
            <input id="vf-cedula" value="${escapeHtml(v.cedula_nit||'')}" placeholder="Número de documento">
          </div>
          <div class="field">
            <label>Teléfono <span style="font-weight:400;font-size:11px;color:var(--gris-mid)">(opcional)</span></label>
            <input id="vf-telefono" value="${escapeHtml(v.telefono||'')}" placeholder="3001234567" type="tel">
          </div>
          <div class="field full">
            <label>Flotilla / Empresa</label>
            <select id="vf-flotilla">${flotOpts}</select>
          </div>
        </div>
      </div>
      <div class="modal-footer" style="display:flex;justify-content:flex-end;gap:8px;padding:14px 20px;border-top:1px solid var(--gris-borde)">
        <button class="btn btn-ghost" onclick="cerrarModalVehiculo()">Cancelar</button>
        <button class="btn btn-primary" id="btn-guardar-vehiculo" onclick="guardarVehiculo()">
          ${vehiculo ? 'Guardar cambios' : 'Registrar vehículo'}
        </button>
      </div>
    </div>`;

  document.body.appendChild(modal);
  requestAnimationFrame(() => modal.classList.add('show'));
  modal.addEventListener('click', e => { if (e.target === modal) cerrarModalVehiculo(); });
  setTimeout(() => { document.getElementById('vf-placa')?.focus(); }, 100);
}

function cerrarModalVehiculo() {
  const m = document.getElementById('modal-vehiculo-flot');
  if (m) { m.classList.remove('show'); setTimeout(() => m.remove(), 150); }
  _vehiculoEditar = null;
  _vehiculoFotoFile = null;
}

// ═══════════════════════════════════════════════════════════
// OCR TARJETA EN CONTEXTO DE FLOTILLAS
// ═══════════════════════════════════════════════════════════
async function ocrTarjetaVehiculo(input) {
  const file = input.files?.[0];
  if (!file) return;

  const estado = document.getElementById('ocr-vehiculo-estado');
  const btnGuardar = document.getElementById('btn-guardar-vehiculo');
  if (estado) {
    estado.style.display = 'block';
    estado.style.background = 'var(--gris-bg)';
    estado.style.borderColor = 'var(--gris-borde)';
    estado.style.color = 'var(--texto)';
    estado.innerHTML = '⏳ Leyendo tarjeta de propiedad...';
  }
  if (btnGuardar) btnGuardar.disabled = true;

  try {
    const parsed = await ocrLeerTarjeta(file);

    const mapa = {
      'vf-placa':      parsed.placa?.toUpperCase(),
      'vf-marca':      parsed.marca,
      'vf-linea':      parsed.linea,
      'vf-modelo':     parsed.modelo,
      'vf-color':      parsed.color,
      'vf-vin':        parsed.vin?.toUpperCase(),
      'vf-propietario': parsed.propietario,
      'vf-cedula':     parsed.cedula_nit || parsed.cedula || parsed.documento
    };

    let encontrados = [];
    Object.entries(mapa).forEach(([id, val]) => {
      if (!val) return;
      const el = document.getElementById(id);
      if (el) {
        el.value = val;
        el.style.background = 'var(--verde-bg,#ECFDF5)';
        setTimeout(() => { if (el) el.style.background = ''; }, 2500);
        encontrados.push(id.replace('vf-', ''));
      }
    });

    _vehiculoFotoFile = file;

    const preview = document.getElementById('vehiculo-foto-preview');
    const img     = document.getElementById('vehiculo-foto-img');
    if (preview && img) { img.src = URL.createObjectURL(file); preview.style.display = 'block'; }

    if (estado) {
      if (encontrados.length) {
        estado.innerHTML = `✅ Datos extraídos: <strong>${encontrados.join(', ')}</strong>. Revisa y corrige si es necesario.`;
        estado.style.background = 'var(--verde-bg,#ECFDF5)';
        estado.style.borderColor = 'var(--verde,#10B981)';
        estado.style.color = 'var(--verde,#065F46)';
      } else {
        estado.innerHTML = '⚠️ No se pudieron extraer datos. Intenta con mejor iluminación o llena manualmente.';
        estado.style.background = '#FEF3C7';
        estado.style.borderColor = '#FDE68A';
        estado.style.color = '#92400E';
      }
    }
  } catch(e) {
    if (estado) {
      estado.innerHTML = `❌ Error al leer la tarjeta: ${escapeHtml(e.message)}`;
      estado.style.background = 'var(--rojo-bg,#FEE2E2)';
      estado.style.color = 'var(--rojo,#DC2626)';
    }
    console.error('OCR vehiculo error:', e);
  } finally {
    input.value = '';
    if (btnGuardar) btnGuardar.disabled = false;
  }
}

// ═══════════════════════════════════════════════════════════
// GUARDAR VEHÍCULO
// ═══════════════════════════════════════════════════════════
async function guardarVehiculo() {
  const placa       = document.getElementById('vf-placa')?.value.trim().toUpperCase();
  const propietario = document.getElementById('vf-propietario')?.value.trim();
  if (!placa)       { toast('La placa es obligatoria', 'err'); document.getElementById('vf-placa')?.focus(); return; }
  if (!propietario) { toast('El nombre del propietario es obligatorio', 'err'); document.getElementById('vf-propietario')?.focus(); return; }

  const btn = document.getElementById('btn-guardar-vehiculo');
  if (btn) { btn.disabled = true; btn.textContent = 'Guardando...'; }

  try {
    const flotillaVal = document.getElementById('vf-flotilla')?.value;
    const datos = {
      placa,
      marca:       document.getElementById('vf-marca')?.value.trim() || null,
      linea:       document.getElementById('vf-linea')?.value.trim() || null,
      modelo:      document.getElementById('vf-modelo')?.value.trim() || null,
      color:       document.getElementById('vf-color')?.value.trim() || null,
      vin:         document.getElementById('vf-vin')?.value.trim().toUpperCase() || null,
      propietario,
      cedula_nit:  document.getElementById('vf-cedula')?.value.trim() || null,
      telefono:    document.getElementById('vf-telefono')?.value.trim() || null,
      flotilla_id: flotillaVal ? parseInt(flotillaVal) : null
    };

    if (_vehiculoFotoFile) {
      try {
        const safePlaca = placa.replace(/[^a-zA-Z0-9]/g, '_');
        datos.foto_tarjeta_url = await storageUpload(_vehiculoFotoFile, `tarjetas/${safePlaca}_${Date.now()}.jpg`);
      } catch(e) { console.warn('No se pudo subir la foto:', e.message); }
    }

    if (_vehiculoEditar) {
      await api(`/vehiculos?id=eq.${_vehiculoEditar.id}`, 'PATCH', datos);
      toast('Vehículo actualizado ✓');
    } else {
      await api('/vehiculos', 'POST', datos, { 'Prefer': 'resolution=merge-duplicates,return=minimal', 'on_conflict': 'placa' });
      toast('Vehículo registrado ✓');
    }

    _vehiculoFotoFile = null;
    cerrarModalVehiculo();
    await cargarVehiculosFlotilla(_flotillaActual?.id || null);

  } catch (e) {
    toast('Error guardando: ' + e.message, 'err');
    console.error(e);
  } finally {
    const label = _vehiculoEditar ? 'Guardar cambios' : 'Registrar vehículo';
    if (btn) { btn.disabled = false; btn.textContent = label; }
  }
}

// ═══════════════════════════════════════════════════════════
// MODAL — NUEVA / EDITAR FLOTILLA
// ═══════════════════════════════════════════════════════════
function abrirModalNuevaFlotilla()          { _abrirModalFlotilla(null); }
function abrirModalEditarFlotilla(id)       { _abrirModalFlotilla(_flotillas.find(x => x.id === id) || null); }

function _abrirModalFlotilla(flotilla) {
  document.getElementById('modal-nueva-flotilla')?.remove();
  const f = flotilla || {};
  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.id = 'modal-nueva-flotilla';
  modal.style.zIndex = '1000';
  modal.innerHTML = `
    <div class="modal" style="max-width:480px;width:95%">
      <div class="modal-header">
        <h2 style="font-size:16px">${flotilla ? 'Editar flotilla' : 'Nueva flotilla'}</h2>
        <button class="btn btn-ghost btn-sm" onclick="cerrarModalFlotilla()">✕</button>
      </div>
      <div class="modal-body">
        <div class="grid-2" style="gap:12px">
          <div class="field full">
            <label>Nombre de la flotilla / empresa <span style="color:var(--rojo)">*</span></label>
            <input id="ff-nombre" value="${escapeHtml(f.nombre||'')}" placeholder="Transportes XYZ S.A.S.">
          </div>
          <div class="field"><label>NIT</label><input id="ff-nit" value="${escapeHtml(f.nit||'')}" placeholder="900.123.456-7"></div>
          <div class="field"><label>Teléfono</label><input id="ff-telefono" value="${escapeHtml(f.telefono||'')}" placeholder="6011234567" type="tel"></div>
          <div class="field full"><label>Dirección</label><input id="ff-direccion" value="${escapeHtml(f.direccion||'')}" placeholder="Cra 10 #20-30"></div>
          <div class="field full"><label>Correo</label><input id="ff-email" value="${escapeHtml(f.email||'')}" placeholder="contacto@empresa.com" type="email"></div>
        </div>
      </div>
      <div class="modal-footer" style="display:flex;justify-content:flex-end;gap:8px;padding:14px 20px;border-top:1px solid var(--gris-borde)">
        <button class="btn btn-ghost" onclick="cerrarModalFlotilla()">Cancelar</button>
        <button class="btn btn-primary" onclick="guardarFlotilla(${f.id || 'null'})">${flotilla ? 'Guardar cambios' : 'Crear flotilla'}</button>
      </div>
    </div>`;
  document.body.appendChild(modal);
  requestAnimationFrame(() => modal.classList.add('show'));
  modal.addEventListener('click', e => { if (e.target === modal) cerrarModalFlotilla(); });
  setTimeout(() => { document.getElementById('ff-nombre')?.focus(); }, 100);
}

function cerrarModalFlotilla() {
  const m = document.getElementById('modal-nueva-flotilla');
  if (m) { m.classList.remove('show'); setTimeout(() => m.remove(), 150); }
}

async function guardarFlotilla(flotillaId) {
  const nombre = document.getElementById('ff-nombre')?.value.trim();
  if (!nombre) { toast('El nombre es obligatorio', 'err'); document.getElementById('ff-nombre')?.focus(); return; }
  const datos = {
    nombre,
    nit:       document.getElementById('ff-nit')?.value.trim() || null,
    telefono:  document.getElementById('ff-telefono')?.value.trim() || null,
    direccion: document.getElementById('ff-direccion')?.value.trim() || null,
    email:     document.getElementById('ff-email')?.value.trim() || null,
    activa:    true
  };
  try {
    if (flotillaId) {
      await api(`/flotillas?id=eq.${flotillaId}`, 'PATCH', datos, { Prefer: 'return=minimal' });
      toast('Flotilla actualizada ✓');
    } else {
      await api('/flotillas', 'POST', datos, { Prefer: 'return=minimal' });
      toast('Flotilla creada ✓');
    }
    cerrarModalFlotilla();
    await montarFlotillas();
  } catch(e) { toast('Error: ' + e.message, 'err'); console.error(e); }
}
