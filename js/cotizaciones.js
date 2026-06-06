// ═══════════════════════════════════════════════════════════
// COTIZACIONES
// ═══════════════════════════════════════════════════════════

// ─── NUEVA / EDITAR COTIZACIÓN ────────────────────────────

let _cotEditandoId = null;         // null = nueva, number = editando
let _cotEmpresasCache = [];        // cache de empresas cargadas

// ── Tipo de cliente ──────────────────────────────────────
function _cotSelTipo(tipo) {
  const wrapP = document.getElementById('cn-wrap-persona');
  const wrapE = document.getElementById('cn-wrap-empresa');
  const sel   = document.getElementById('cn-tipo-cliente');
  if (wrapP) wrapP.style.display = tipo === 'persona' ? '' : 'none';
  if (wrapE) wrapE.style.display = tipo === 'empresa' ? '' : 'none';
  if (sel && sel.value !== tipo) sel.value = tipo;
  if (tipo === 'empresa') _cotCargarEmpresas();
}

// ── Cargar empresas en caché ─────────────────────────────
async function _cotCargarEmpresas() {
  try {
    _cotEmpresasCache = await api('/empresas?activo=eq.true&order=nombre.asc').catch(() => []) || [];
  } catch(e) { _cotEmpresasCache = []; }
}

// ── Filtrar empresas en tiempo real ──────────────────────
function _cotFiltrarEmpresas(q) {
  const lista = document.getElementById('cn-emp-lista');
  if (!lista) return;
  const term = q.toLowerCase().trim();
  const filtradas = term
    ? _cotEmpresasCache.filter(e =>
        (e.nombre||'').toLowerCase().includes(term) ||
        (e.nit||'').toLowerCase().includes(term)
      )
    : _cotEmpresasCache;

  if (!filtradas.length && !term) { lista.style.display = 'none'; return; }

  lista.style.display = 'block';
  if (!filtradas.length) {
    lista.innerHTML = `<div style="padding:10px 14px;font-size:13px;color:var(--gris-mid)">Sin resultados — haz clic en "Nueva empresa"</div>`;
    return;
  }
  lista.innerHTML = filtradas.map(e => `
    <div onclick="_cotSeleccionarEmpresa(${e.id})" class="row-hover"
      style="padding:9px 14px;cursor:pointer;border-bottom:1px solid var(--gris-borde);font-size:13px">
      <div style="font-weight:600;color:var(--texto)">${escapeHtml(e.nombre)}</div>
      <div style="font-size:11px;color:var(--gris-mid)">${e.nit ? 'NIT: '+escapeHtml(e.nit)+' · ' : ''}${e.telefono ? escapeHtml(e.telefono) : ''}${e.contacto_nombre ? ' · '+escapeHtml(e.contacto_nombre) : ''}</div>
    </div>`).join('');
}

// ── Seleccionar empresa existente ────────────────────────
function _cotSeleccionarEmpresa(empId) {
  const emp = _cotEmpresasCache.find(e => e.id === empId);
  if (!emp) return;
  const set = (id, val) => { const el = document.getElementById(id); if (el) el.value = val || ''; };
  set('cn-empresa-id', emp.id);
  set('cn-emp-nombre', emp.nombre);
  set('cn-emp-nit',    emp.nit);
  set('cn-emp-tel',    emp.telefono);
  set('cn-emp-correo', emp.correo);
  set('cn-emp-dir',    emp.direccion);
  set('cn-emp-cnom',   emp.contacto_nombre);
  set('cn-emp-ctel',   emp.contacto_telefono);
  set('cn-emp-ccorreo',emp.contacto_correo);
  const tit = document.getElementById('cn-emp-datos-titulo');
  if (tit) tit.textContent = 'Empresa seleccionada';
  const datos = document.getElementById('cn-emp-datos');
  if (datos) datos.style.display = 'block';
  const lista = document.getElementById('cn-emp-lista');
  if (lista) lista.style.display = 'none';
  const buscar = document.getElementById('cn-emp-buscar');
  if (buscar) buscar.value = emp.nombre;
}

// ── Nueva empresa (formulario en blanco) ─────────────────
function _cotNuevaEmpresaInline() {
  ['cn-empresa-id','cn-emp-nombre','cn-emp-nit','cn-emp-tel','cn-emp-correo',
   'cn-emp-dir','cn-emp-cnom','cn-emp-ctel','cn-emp-ccorreo'].forEach(id => {
    const el = document.getElementById(id); if (el) el.value = '';
  });
  const tit = document.getElementById('cn-emp-datos-titulo');
  if (tit) tit.textContent = 'Nueva empresa';
  const datos = document.getElementById('cn-emp-datos');
  if (datos) datos.style.display = 'block';
  const lista = document.getElementById('cn-emp-lista');
  if (lista) lista.style.display = 'none';
  const buscar = document.getElementById('cn-emp-buscar');
  if (buscar) buscar.value = '';
  setTimeout(() => document.getElementById('cn-emp-nombre')?.focus(), 60);
}

function _cotCerrarEmpresaDatos() {
  const datos = document.getElementById('cn-emp-datos');
  if (datos) datos.style.display = 'none';
  const buscar = document.getElementById('cn-emp-buscar');
  if (buscar) buscar.value = '';
}

// ── Guardar empresa (nueva o actualizar existente) ───────
async function _cotGuardarEmpresa() {
  const nombre = document.getElementById('cn-emp-nombre')?.value.trim();
  if (!nombre) { toast('El nombre de la empresa es obligatorio', 'err'); return null; }
  const body = {
    nombre,
    nit:               document.getElementById('cn-emp-nit')?.value.trim()    || null,
    telefono:          document.getElementById('cn-emp-tel')?.value.trim()    || null,
    correo:            document.getElementById('cn-emp-correo')?.value.trim() || null,
    direccion:         document.getElementById('cn-emp-dir')?.value.trim()    || null,
    contacto_nombre:   document.getElementById('cn-emp-cnom')?.value.trim()   || null,
    contacto_telefono: document.getElementById('cn-emp-ctel')?.value.trim()   || null,
    contacto_correo:   document.getElementById('cn-emp-ccorreo')?.value.trim()|| null,
    activo: true,
  };
  const empId = document.getElementById('cn-empresa-id')?.value;
  try {
    if (empId) {
      await api(`/empresas?id=eq.${empId}`, 'PATCH', body);
      return parseInt(empId);
    } else {
      const res = await api('/empresas', 'POST', body, { Prefer: 'return=representation' });
      const id = res?.[0]?.id || null;
      if (id) {
        const idEl = document.getElementById('cn-empresa-id');
        if (idEl) idEl.value = id;
      }
      return id;
    }
  } catch(e) {
    toast('Error guardando empresa: ' + e.message, 'err');
    return null;
  }
}

// ── Limpiar formulario ────────────────────────────────────
function _cotLimpiarFormulario() {
  ['cn-placa','cn-marca','cn-linea','cn-ano','cn-color','cn-vin','cn-km',
   'cn-nombre','cn-cedula','cn-celular','cn-correo',
   'cn-emp-buscar','cn-empresa-id','cn-emp-nombre','cn-emp-nit','cn-emp-tel',
   'cn-emp-correo','cn-emp-dir','cn-emp-cnom','cn-emp-ctel','cn-emp-ccorreo'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  const ocrEst = document.getElementById('cn-ocr-estado');
  if (ocrEst) ocrEst.style.display = 'none';
  const ivaCheck = document.getElementById('cn-iva-check');
  if (ivaCheck) ivaCheck.checked = false;
  const repTbody = document.getElementById('cot-rep-tbody');
  const moTbody  = document.getElementById('cot-mo-tbody');
  if (repTbody) repTbody.innerHTML = '';
  if (moTbody)  moTbody.innerHTML  = '';
  // Resetear a persona natural
  _cotSelTipo('persona');
  const datos = document.getElementById('cn-emp-datos');
  if (datos) datos.style.display = 'none';
  const lista = document.getElementById('cn-emp-lista');
  if (lista) lista.style.display = 'none';
  _cotActualizarTotales();
}

function nuevaCotizacion() {
  _cotEditandoId = null;
  _cotLimpiarFormulario();
  cotAgregarRepuesto();
  cotAgregarManoObra();
  mostrarPagina('pag-cotizacion-nueva');
  const titleEl = document.getElementById('topbar-title');
  if (titleEl) titleEl.textContent = 'Nueva Cotización';
  const actEl = document.getElementById('topbar-actions');
  if (actEl) actEl.innerHTML = '';
  // Botones en modo crear
  const btnG = document.getElementById('btn-guardar-cot');
  const btnP = document.getElementById('btn-guardar-pdf-cot');
  if (btnG) btnG.textContent = 'Guardar cotización →';
  if (btnP) btnP.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg> Guardar + PDF`;
  closeSidebar();
}

// Editar una cotización ya creada requiere PIN (jefe/gerente), porque cambia
// los valores que ve el cliente. Si el PIN no está disponible, no bloquea.
async function editarCotizacion(cotId) {
  if (typeof pedirPin === 'function' && typeof _getPinCierre === 'function' && await _getPinCierre()) {
    pedirPin(() => _editarCotizacionReal(cotId), 'Editar cotización', 'Vas a modificar los valores de una cotización. Ingresa el PIN.');
    return;
  }
  return _editarCotizacionReal(cotId);
}
async function _editarCotizacionReal(cotId) {
  cerrarModalCotizacion();
  let cot = todasCotizaciones.find(c => c.id === cotId);
  if (!cot) {
    const arr = await api(`/cotizaciones?id=eq.${cotId}&limit=1`).catch(() => []);
    cot = arr?.[0];
  }
  if (!cot) { toast('No se encontró la cotización', 'err'); return; }

  _cotEditandoId = cotId;
  _cotLimpiarFormulario();

  // Rellenar campos vehículo
  const set = (id, val) => { const el = document.getElementById(id); if (el && val != null) el.value = val; };
  set('cn-placa',  cot.placa);
  set('cn-marca',  cot.marca);
  set('cn-linea',  cot.modelo);
  set('cn-ano',    cot.año);
  set('cn-color',  cot.color);
  set('cn-vin',    cot.vin);
  set('cn-km',     cot.kilometraje);

  // Tipo de cliente
  const tipo = cot.tipo_cliente || 'persona';
  _cotSelTipo(tipo);

  if (tipo === 'empresa' && cot.empresa_id) {
    // Cargar empresa desde DB
    const emps = await api(`/empresas?id=eq.${cot.empresa_id}&limit=1`).catch(() => []) || [];
    const emp  = emps[0];
    if (emp) {
      set('cn-empresa-id',   emp.id);
      set('cn-emp-nombre',   emp.nombre);
      set('cn-emp-nit',      emp.nit);
      set('cn-emp-tel',      emp.telefono);
      set('cn-emp-correo',   emp.correo);
      set('cn-emp-dir',      emp.direccion);
      set('cn-emp-cnom',     emp.contacto_nombre);
      set('cn-emp-ctel',     emp.contacto_telefono);
      set('cn-emp-ccorreo',  emp.contacto_correo);
      const tit = document.getElementById('cn-emp-datos-titulo');
      if (tit) tit.textContent = 'Empresa seleccionada';
      const datos = document.getElementById('cn-emp-datos');
      if (datos) datos.style.display = 'block';
    }
  } else {
    set('cn-nombre', cot.nombre_cliente);
    set('cn-cedula', cot.cedula_cliente);
    set('cn-celular',cot.telefono_cliente);
    set('cn-correo', cot.correo_cliente);
  }

  // IVA
  const ivaCheck = document.getElementById('cn-iva-check');
  if (ivaCheck) ivaCheck.checked = (cot.iva > 0);

  // Rellenar tablas de ítems
  let repItems = [], moItems = [];
  try { repItems = typeof cot.repuestos       === 'string' ? JSON.parse(cot.repuestos)       : (cot.repuestos       || []); } catch(e) { repItems = []; }
  try { moItems  = typeof cot.mano_obra_items === 'string' ? JSON.parse(cot.mano_obra_items) : (cot.mano_obra_items || []); } catch(e) { moItems  = []; }

  const _llenarTabla = (tbodyId, items, placeholderDesc) => {
    const tbody = document.getElementById(tbodyId);
    if (!tbody) return;
    tbody.innerHTML = '';
    if (!items.length) { tbody.appendChild(_cotFila(placeholderDesc)); return; }
    items.forEach(it => {
      const tr = _cotFila(placeholderDesc);
      tr.querySelector('.cot-inp-num').value = it.cantidad  ?? 1;
      tr.querySelector('.cot-inp-desc').value= it.descripcion || '';
      tr.querySelector('.cot-inp-dto').value = it.descuento_pct ?? 0;
      tr.querySelector('.cot-inp-val').value = it.valor_unitario ?? 0;
      tbody.appendChild(tr);
    });
  };
  _llenarTabla('cot-rep-tbody', repItems, 'Descripción del repuesto');
  _llenarTabla('cot-mo-tbody',  moItems,  'Concepto de mano de obra');
  _cotActualizarTotales();

  mostrarPagina('pag-cotizacion-nueva');
  const titleEl = document.getElementById('topbar-title');
  if (titleEl) titleEl.textContent = 'Editar Cotización';
  // Botones en modo editar
  const btnG = document.getElementById('btn-guardar-cot');
  const btnP = document.getElementById('btn-guardar-pdf-cot');
  if (btnG) btnG.textContent = 'Actualizar cotización →';
  if (btnP) btnP.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg> Actualizar + PDF`;
  closeSidebar();
}

function volverACotizaciones() { _cotEditandoId = null; navJefe('cotizaciones'); }

// ─── OCR + BÚSQUEDA ───────────────────────────────────────

async function cotOcrTarjetaPropiedad(input) {
  const file = input.files?.[0];
  if (!file) return;
  const estado = document.getElementById('cn-ocr-estado');
  if (estado) { estado.style.display = 'block'; estado.innerHTML = '⏳ Leyendo tarjeta de propiedad...'; estado.style.background = ''; estado.style.borderColor = ''; estado.style.color = ''; }
  try {
    const parsed = await ocrLeerTarjeta(file);
    const mapa = {
      'cn-placa': parsed.placa?.toUpperCase(),
      'cn-marca': parsed.marca,
      'cn-linea': parsed.linea,
      'cn-ano':   parsed.modelo,
      'cn-color': parsed.color,
      'cn-vin':   parsed.vin?.toUpperCase()
    };
    let encontrados = [];
    Object.entries(mapa).forEach(([id, val]) => {
      if (!val) return;
      const el = document.getElementById(id);
      if (el) { el.value = val; encontrados.push(id.replace('cn-','')); }
    });
    if (parsed.propietario) {
      const el = document.getElementById('cn-nombre');
      if (el && !el.value) { el.value = parsed.propietario; encontrados.push('propietario'); }
    }
    if (estado) {
      if (encontrados.length) {
        estado.innerHTML = `✓ Datos extraídos: <strong>${encontrados.join(', ')}</strong>. Revisa y corrige si es necesario.`;
        estado.style.background = 'var(--verde-bg)'; estado.style.borderColor = 'var(--verde)'; estado.style.color = 'var(--verde)';
      } else {
        estado.innerHTML = '⚠ No se pudieron extraer datos. Intenta con mejor iluminación.';
        estado.style.background = '#FEF3C7'; estado.style.borderColor = '#FDE68A'; estado.style.color = '#92400E';
      }
    }
  } catch(e) {
    if (estado) { estado.innerHTML = '✗ Error al leer la tarjeta: ' + e.message; }
  }
  input.value = '';
}

async function cotBuscarVehiculo() {
  const placa = document.getElementById('cn-placa')?.value.trim().toUpperCase();
  if (!placa) { toast('Ingresa la placa primero', 'err'); return; }
  try {
    const vhs = await api(`/vehiculos?placa=eq.${placa}`) || [];
    if (!vhs.length) { toast('Vehículo no encontrado', 'warn'); return; }
    const v = vhs[0];
    const mapa = { 'cn-marca': v.marca, 'cn-linea': v.linea, 'cn-ano': v.modelo, 'cn-color': v.color, 'cn-vin': v.vin };
    Object.entries(mapa).forEach(([id, val]) => { const el = document.getElementById(id); if (el && val) el.value = val; });
    toast('Vehículo encontrado ✓');
  } catch(e) { toast('Error al buscar: ' + e.message, 'err'); }
}

async function cotBuscarCliente() {
  const cedula = document.getElementById('cn-cedula')?.value.trim();
  if (!cedula) { toast('Ingresa la cédula primero', 'err'); return; }
  try {
    const cls = await api(`/clientes?cedula_nit=eq.${cedula}`) || [];
    if (!cls.length) { toast('Cliente no encontrado', 'warn'); return; }
    const c = cls[0];
    const mapa = { 'cn-nombre': c.nombre, 'cn-celular': c.celular, 'cn-correo': c.correo };
    Object.entries(mapa).forEach(([id, val]) => { const el = document.getElementById(id); if (el && val) el.value = val; });
    toast('Cliente encontrado ✓');
  } catch(e) { toast('Error al buscar: ' + e.message, 'err'); }
}

// ─── TABLA DE ÍTEMS ───────────────────────────────────────

function _cotFila(placeholderDesc) {
  const tr = document.createElement('tr');
  tr.className = 'cot-item-row';
  tr.innerHTML = `
    <td><input type="number" class="cot-inp cot-inp-num" min="1" value="1" onfocus="this.select()" oninput="_cotActualizarTotales()"></td>
    <td><input type="text"   class="cot-inp cot-inp-desc" placeholder="${escapeHtml(placeholderDesc)}"></td>
    <td style="white-space:nowrap"><input type="number" class="cot-inp cot-inp-dto" min="0" max="100" value="0" onfocus="this.select()" oninput="_cotActualizarTotales()">%</td>
    <td><input type="number" class="cot-inp cot-inp-val" min="0" value="0" onfocus="this.select()" oninput="_cotActualizarTotales()"></td>
    <td class="cot-row-total">${formatCOP(0)}</td>
    <td><button class="btn-del-row" onclick="cotEliminarFila(this)" title="Eliminar">×</button></td>`;
  return tr;
}

function cotAgregarRepuesto() {
  const tbody = document.getElementById('cot-rep-tbody');
  if (tbody) tbody.appendChild(_cotFila('Descripción del repuesto'));
}

function cotAgregarManoObra() {
  const tbody = document.getElementById('cot-mo-tbody');
  if (tbody) tbody.appendChild(_cotFila('Concepto de mano de obra'));
}

function cotEliminarFila(btn) {
  const tr = btn.closest('tr');
  if (tr) { tr.remove(); _cotActualizarTotales(); }
}

function _cotActualizarTotales() {
  const _calcTbody = tbodyId => {
    let subtotal = 0, descuento = 0;
    document.querySelectorAll(`#${tbodyId} .cot-item-row`).forEach(tr => {
      const cant = parseFloat(tr.querySelector('.cot-inp-num')?.value  || 0);
      const dto  = parseFloat(tr.querySelector('.cot-inp-dto')?.value  || 0);
      const val  = parseFloat(tr.querySelector('.cot-inp-val')?.value  || 0);
      const sub  = cant * val;
      const dv   = Math.round(sub * dto / 100);
      const tot  = sub - dv;
      const cell = tr.querySelector('.cot-row-total');
      if (cell) cell.textContent = formatCOP(tot);
      subtotal  += tot;
      descuento += dv;
    });
    return { subtotal, descuento };
  };
  const rep = _calcTbody('cot-rep-tbody');
  const mo  = _calcTbody('cot-mo-tbody');
  const dtoTotal = rep.descuento + mo.descuento;
  const total    = rep.subtotal  + mo.subtotal;
  const conIva   = true; // el IVA siempre se incluye en las cotizaciones
  const iva      = Math.round(total * 0.19);
  const totalIva = total + iva;
  const _txt = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
  _txt('cn-sub-rep',   formatCOP(rep.subtotal));
  _txt('cn-res-rep',   formatCOP(rep.subtotal));
  _txt('cn-sub-mo',    formatCOP(mo.subtotal));
  _txt('cn-res-mo',    formatCOP(mo.subtotal));
  _txt('cn-dto-total', '−' + formatCOP(dtoTotal));
  _txt('cn-total',         formatCOP(total));
  _txt('cn-iva-val',       formatCOP(iva));
  _txt('cn-total-iva',     formatCOP(totalIva));
  _txt('cn-total-siniva',  formatCOP(total));
  const _show = (id, v) => { const el = document.getElementById(id); if (el) el.style.display = v ? '' : 'none'; };
  _show('cn-dto-row',          dtoTotal > 0);
  _show('cn-iva-row',          conIva);
  _show('cn-total-iva-row',    conIva);
  _show('cn-total-siniva-row', !conIva);
}

function _cotLeerItems(tbodyId) {
  const items = [];
  document.querySelectorAll(`#${tbodyId} .cot-item-row`).forEach(tr => {
    const cant = parseFloat(tr.querySelector('.cot-inp-num')?.value || 0);
    const desc = tr.querySelector('.cot-inp-desc')?.value.trim() || '';
    const dto  = parseFloat(tr.querySelector('.cot-inp-dto')?.value || 0);
    const val  = parseFloat(tr.querySelector('.cot-inp-val')?.value || 0);
    if (!desc && val === 0) return;
    const sub = cant * val;
    const dv  = Math.round(sub * dto / 100);
    items.push({ cantidad: cant, descripcion: desc, descuento_pct: dto, valor_unitario: val, total: sub - dv });
  });
  return items;
}

// ─── GUARDAR COTIZACIÓN ───────────────────────────────────

const N8N_PDF_WEBHOOK = 'https://automatizacionesfreimanautos-n8n.qs0sgf.easypanel.host/webhook/cotizacion-pdf';

// ─── PLANTILLA DEL PDF — editable por el usuario (localStorage) ───
function _cotPdfConfig() {
  let c = {};
  try { c = JSON.parse(localStorage.getItem('cot_pdf_config') || '{}') || {}; } catch (e) {}
  return {
    logo:       c.logo       || '',
    nombre:     c.nombre     || 'FREIMANAUTOS',
    slogan:     c.slogan     || 'Servicio profesional Hyundai y multimarca · Desde 1987',
    nit:        c.nit        || '800012186',
    direccion:  c.direccion  || 'Calle 98 A 68 D – 15, Bogotá',
    telefono:   c.telefono   || '320 9025804',
    email:      c.email      || 'freimanautosa@gmail.com',
    encabezado: c.encabezado || '',
    nota:       (c.nota !== undefined) ? c.nota : 'Este documento es una COTIZACIÓN — No es factura de venta · FREIMANAUTOS · NIT:800012186 · Bogotá, Colombia, Dir: Calle 98 A 68 D – 15, Bogotá, Tel: 320 9025804',
    terminos:   c.terminos   || ''
  };
}

let _cotLogoTmp = null;  // logo en edición (dataURL base64)

function abrirConfigPdfCotizacion() {
  const c = _cotPdfConfig();
  _cotLogoTmp = c.logo || '';
  document.getElementById('modal-cot-pdf')?.remove();
  const m = document.createElement('div');
  m.id = 'modal-cot-pdf';
  m.className = 'modal-overlay show';
  m.innerHTML = `
    <div class="modal" style="max-width:560px;max-height:90vh;display:flex;flex-direction:column">
      <div class="modal-header">
        <h2>Plantilla del PDF de cotización</h2>
        <button class="btn btn-ghost btn-sm" onclick="document.getElementById('modal-cot-pdf').remove()">✕</button>
      </div>
      <div class="modal-body" style="flex:1;overflow-y:auto;display:flex;flex-direction:column;gap:14px">
        <div class="field" style="margin:0">
          <label>Logo</label>
          <div style="display:flex;align-items:center;gap:12px">
            <div id="cpdf-logo-prev" style="width:90px;height:54px;border:1.5px dashed var(--gris-borde);border-radius:8px;display:flex;align-items:center;justify-content:center;background:var(--gris-bg);overflow:hidden">
              ${c.logo ? `<img src="${c.logo}" style="max-width:100%;max-height:100%;object-fit:contain">` : '<span style="font-size:10px;color:var(--gris-mid)">sin logo</span>'}
            </div>
            <div style="display:flex;flex-direction:column;gap:6px">
              <label class="btn btn-outline btn-sm" style="margin:0;cursor:pointer">📁 Subir logo<input type="file" accept="image/*" style="display:none" onchange="_cotPdfLogoUpload(this)"></label>
              <button class="btn btn-ghost btn-sm" style="font-size:11px;color:var(--rojo)" onclick="_cotPdfQuitarLogo()">Quitar logo</button>
            </div>
          </div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
          <div class="field" style="margin:0"><label>Nombre / razón social</label><input id="cpdf-nombre" value="${escapeHtml(c.nombre)}"></div>
          <div class="field" style="margin:0"><label>NIT</label><input id="cpdf-nit" value="${escapeHtml(c.nit)}"></div>
          <div class="field" style="margin:0"><label>Eslogan</label><input id="cpdf-slogan" value="${escapeHtml(c.slogan)}"></div>
          <div class="field" style="margin:0"><label>Teléfono</label><input id="cpdf-telefono" value="${escapeHtml(c.telefono)}"></div>
          <div class="field" style="margin:0;grid-column:1/-1"><label>Dirección</label><input id="cpdf-direccion" value="${escapeHtml(c.direccion)}"></div>
          <div class="field" style="margin:0;grid-column:1/-1"><label>Correo</label><input id="cpdf-email" value="${escapeHtml(c.email)}"></div>
        </div>
        <div class="field" style="margin:0"><label>Texto de encabezado <span style="color:var(--gris-mid);font-weight:400">(opcional)</span></label><input id="cpdf-encabezado" value="${escapeHtml(c.encabezado)}" placeholder="Ej: Especialistas en latonería y pintura"></div>
        <div class="field" style="margin:0"><label>Nota de pie</label><input id="cpdf-nota" value="${escapeHtml(c.nota)}"></div>
        <div class="field" style="margin:0"><label>Términos y condiciones <span style="color:var(--gris-mid);font-weight:400">(opcional)</span></label><textarea id="cpdf-terminos" rows="4" style="width:100%;box-sizing:border-box;resize:vertical;font-family:inherit;font-size:13px;padding:8px 10px;border:1.5px solid var(--gris-borde);border-radius:6px">${escapeHtml(c.terminos)}</textarea></div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-ghost" onclick="document.getElementById('modal-cot-pdf').remove()">Cancelar</button>
        <button class="btn btn-primary" onclick="guardarConfigPdfCotizacion()">Guardar plantilla</button>
      </div>
    </div>`;
  m.addEventListener('click', e => { if (e.target === m) m.remove(); });
  document.body.appendChild(m);
}

function _cotPdfQuitarLogo() {
  _cotLogoTmp = '';
  const prev = document.getElementById('cpdf-logo-prev');
  if (prev) prev.innerHTML = '<span style="font-size:10px;color:var(--gris-mid)">sin logo</span>';
}

function _cotPdfLogoUpload(input) {
  const f = input.files?.[0];
  if (!f) return;
  if (f.size > 1.5 * 1024 * 1024) { toast('El logo es muy grande (máx 1.5 MB)', 'err'); return; }
  const reader = new FileReader();
  reader.onload = () => {
    _cotLogoTmp = reader.result;
    const prev = document.getElementById('cpdf-logo-prev');
    if (prev) prev.innerHTML = `<img src="${_cotLogoTmp}" style="max-width:100%;max-height:100%;object-fit:contain">`;
  };
  reader.readAsDataURL(f);
}

function guardarConfigPdfCotizacion() {
  const v = id => (document.getElementById(id)?.value ?? '').trim();
  const cfg = {
    logo:       _cotLogoTmp || '',
    nombre:     v('cpdf-nombre'),
    nit:        v('cpdf-nit'),
    slogan:     v('cpdf-slogan'),
    telefono:   v('cpdf-telefono'),
    direccion:  v('cpdf-direccion'),
    email:      v('cpdf-email'),
    encabezado: v('cpdf-encabezado'),
    nota:       v('cpdf-nota'),
    terminos:   v('cpdf-terminos')
  };
  try { localStorage.setItem('cot_pdf_config', JSON.stringify(cfg)); }
  catch (e) { toast('No se pudo guardar (¿logo muy pesado?): ' + e.message, 'err'); return; }
  toast('Plantilla del PDF guardada ✓');
  document.getElementById('modal-cot-pdf')?.remove();
}

function enviarPdfCotizacion(cotId) { return generarPdfCotizacion(cotId, 'enviar'); }

async function generarPdfCotizacion(cotId, accion = 'descargar') {
  // Deshabilitar botón mientras genera
  const btn = document.querySelector(`button[data-pdf="${cotId}"]`);
  const txtOrig = btn?.textContent || 'Generar PDF';
  if (btn) { btn.disabled = true; btn.textContent = '⏳ Generando...'; }

  try {
    // Obtener cotización del caché o desde Supabase
    let cot = todasCotizaciones.find(c => c.id === cotId);
    if (!cot) {
      const arr = await api(`/cotizaciones?id=eq.${cotId}&limit=1`);
      cot = arr?.[0];
    }
    if (!cot) throw new Error('Cotización no encontrada');

    // Parsear ítems (se guardan como JSON string en Supabase)
    let repuestos = [];
    let moItems   = [];
    try { repuestos = typeof cot.repuestos       === 'string' ? JSON.parse(cot.repuestos)       : (cot.repuestos       || []); } catch(e) { repuestos = []; }
    try { moItems   = typeof cot.mano_obra_items === 'string' ? JSON.parse(cot.mano_obra_items) : (cot.mano_obra_items || []); } catch(e) { moItems   = []; }

    // Totales recalculados desde los ítems (siempre exactos, no dependen de nada externo)
    const _money = n => '$ ' + new Intl.NumberFormat('es-CO').format(Math.round(n || 0));
    // Totales con la estructura de la plantilla (bruto por sección + descuento)
    const _gross = arr => arr.reduce((s, i) => s + (+i.cantidad || 0) * (+i.valor_unitario || 0), 0);
    const _desc  = arr => arr.reduce((s, i) => s + Math.round((+i.cantidad || 0) * (+i.valor_unitario || 0) * (+i.descuento_pct || 0) / 100), 0);
    const grRep = _gross(repuestos), grMo = _gross(moItems);
    const descTot = _desc(repuestos) + _desc(moItems);
    const base  = grRep + grMo - descTot;                          // subtotal neto
    const _ivaV = Math.round(base * 0.19);  // IVA 19% siempre incluido
    const _tot  = base + _ivaV;
    // Ejecutivo a cargo = el perfil que CREÓ la cotización (guardado en
    // cot.tecnico). Si es una cotización antigua sin ese dato, cae al usuario
    // en sesión.
    const ejecutivo = ((cot.tecnico && cot.tecnico.trim()) || (typeof sesion !== 'undefined' && sesion && sesion.nombre) || '—');
    const CFG = _cotPdfConfig();   // plantilla editable

    if (!window.jspdf || !window.jspdf.jsPDF) throw new Error('Librería PDF no disponible. Recarga la página.');
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit:'pt', format:'a4' });
    const W = doc.internal.pageSize.getWidth();
    const H = doc.internal.pageSize.getHeight();
    const M = 40;
    const AZUL = [30,58,95];

    // ── Encabezado: logo (SIN borde) + empresa + COTIZACIÓN/No./Fecha ──
    let headX = M;
    if (CFG.logo) {
      try {
        const im = await new Promise(r => { const x = new Image(); x.onload = () => r(x); x.onerror = () => r(null); x.src = CFG.logo; });
        if (im && im.naturalWidth) {
          const sc = Math.min(54 / im.naturalHeight, 150 / im.naturalWidth);
          const lw = im.naturalWidth * sc, lh = im.naturalHeight * sc;
          const fmtImg = CFG.logo.indexOf('image/png') >= 0 ? 'PNG' : CFG.logo.indexOf('image/webp') >= 0 ? 'WEBP' : 'JPEG';
          doc.addImage(CFG.logo, fmtImg, M, 26, lw, lh);   // sin recuadro ni borde punteado
          headX = M + lw + 14;
        }
      } catch (e) {}
    }
    doc.setFont('helvetica','bold'); doc.setFontSize(17); doc.setTextColor(AZUL[0],AZUL[1],AZUL[2]);
    doc.text(CFG.nombre || '', headX, 40);
    doc.setFont('helvetica','normal'); doc.setFontSize(8); doc.setTextColor(110,110,110);
    let hy = 53;
    if (CFG.slogan) { doc.text(String(CFG.slogan), headX, hy); hy += 10.5; }
    const l2 = [CFG.direccion ? 'Dirección: ' + CFG.direccion : '', CFG.telefono ? 'Tel: ' + CFG.telefono : ''].filter(Boolean).join(' · ');
    if (l2) { doc.text(l2, headX, hy); hy += 10.5; }
    const l3 = [CFG.nit ? 'NIT: ' + CFG.nit : '', CFG.email ? 'Email: ' + CFG.email : ''].filter(Boolean).join(' · ');
    if (l3) { doc.text(l3, headX, hy); hy += 10.5; }
    if (CFG.encabezado) { doc.text(String(CFG.encabezado), headX, hy); hy += 10.5; }
    doc.setFont('helvetica','bold'); doc.setFontSize(16); doc.setTextColor(AZUL[0],AZUL[1],AZUL[2]);
    doc.text('COTIZACIÓN', W - M, 40, { align:'right' });
    doc.setFont('helvetica','normal'); doc.setFontSize(9); doc.setTextColor(90,90,90);
    doc.text(`No. ${cot.codigo_cotizacion || ''}`, W - M, 54, { align:'right' });
    doc.text(`Fecha: ${cot.fecha || ''}`, W - M, 66, { align:'right' });
    const lineaY = Math.max(hy + 4, 84);
    doc.setDrawColor(AZUL[0],AZUL[1],AZUL[2]); doc.setLineWidth(1.4); doc.line(M, lineaY, W - M, lineaY);

    // ── Datos del cliente y del vehículo (dos columnas) ──
    let y = lineaY + 20;
    const colW = (W - 2 * M - 20) / 2, xL = M, xR = M + colW + 20;
    doc.setFont('helvetica','bold'); doc.setFontSize(9); doc.setTextColor(AZUL[0],AZUL[1],AZUL[2]);
    doc.text('DATOS DEL CLIENTE', xL, y); doc.text('DATOS DEL VEHÍCULO', xR, y);
    doc.setDrawColor(225,225,225); doc.setLineWidth(0.6); doc.line(xL, y + 4, xL + colW, y + 4); doc.line(xR, y + 4, xR + colW, y + 4);
    doc.setFont('helvetica','normal'); doc.setFontSize(9);
    const fila = (k, v, x, yy) => { doc.setTextColor(135,135,135); doc.text(k, x, yy); doc.setTextColor(40,40,40); doc.text(String(v || '—'), x + 82, yy); };
    const cli = [['Nombre:',cot.nombre_cliente],['Cédula / NIT:',cot.cedula_cliente],['Celular:',cot.telefono_cliente],['Correo:',cot.correo_cliente],['Kilometraje:',cot.kilometraje]];
    const veh = [['Placa:',cot.placa],['Marca:',cot.marca],['Modelo:',cot.modelo],['Año:',cot.año],['Color:',cot.color],['VIN:',cot.vin]];
    let yc = y + 18; cli.forEach(([k,v]) => { fila(k,v,xL,yc); yc += 13.5; });
    let yv = y + 18; veh.forEach(([k,v]) => { fila(k,v,xR,yv); yv += 13.5; });
    y = Math.max(yc, yv) + 8;

    // ── Tablas: Cant. · Descripción · Vr. Unitario · Dcto. · Total ──
    const colStyles = { 0:{halign:'center',cellWidth:36}, 2:{halign:'right',cellWidth:78}, 3:{halign:'center',cellWidth:44}, 4:{halign:'right',cellWidth:82} };
    const filaItem = i => [i.cantidad ?? 1, i.descripcion || '—', _money(i.valor_unitario), (i.descuento_pct || 0) + '%', _money(i.total)];
    const headTabla = ['Cant.','Descripción','Vr. Unitario','Dcto.','Total'];
    const tituloTabla = txt => { if (y > H - 120) { doc.addPage(); y = 50; } doc.setFont('helvetica','bold'); doc.setFontSize(9.5); doc.setTextColor(AZUL[0],AZUL[1],AZUL[2]); doc.text(txt, M, y); y += 6; };
    if (repuestos.length) {
      tituloTabla('DETALLE DE REPUESTOS Y SERVICIOS');
      doc.autoTable({ startY: y, head: [headTabla], body: repuestos.map(filaItem), theme:'grid',
        headStyles:{ fillColor: AZUL, fontSize:8.5, halign:'left' }, bodyStyles:{ fontSize:8.5 }, margin:{ left:M, right:M }, columnStyles: colStyles });
      y = doc.lastAutoTable.finalY + 12;
    }
    if (moItems.length) {
      tituloTabla('DETALLE DE MANO DE OBRA');
      doc.autoTable({ startY: y, head: [headTabla], body: moItems.map(filaItem), theme:'grid',
        headStyles:{ fillColor: AZUL, fontSize:8.5, halign:'left' }, bodyStyles:{ fontSize:8.5 }, margin:{ left:M, right:M }, columnStyles: colStyles });
      y = doc.lastAutoTable.finalY + 12;
    }

    // ── Totales (estructura de la plantilla) ──
    if (y > H - 175) { doc.addPage(); y = 50; }
    const bw = 250, bx = W - M - bw;
    const totRows = [['Subtotal Repuestos:', _money(grRep)], ['Mano de Obra:', _money(grMo)], ['Descuento:', descTot > 0 ? '- ' + _money(descTot) : _money(0)]];
    if (_ivaV > 0) totRows.push(['IVA:', _money(_ivaV)]);
    doc.setFontSize(10);
    totRows.forEach(([k,v]) => {
      doc.setFont('helvetica','normal'); doc.setTextColor(90,90,90); doc.text(k, bx, y + 11);
      doc.setTextColor(40,40,40); doc.text(v, bx + bw, y + 11, { align:'right' });
      y += 16;
    });
    y += 4;
    doc.setFillColor(AZUL[0],AZUL[1],AZUL[2]); doc.rect(bx, y, bw, 26, 'F');
    doc.setTextColor(255,255,255); doc.setFont('helvetica','bold'); doc.setFontSize(11);
    doc.text('VALOR TOTAL:', bx + 12, y + 17);
    doc.text(_money(_tot), bx + bw - 12, y + 17, { align:'right' });
    y += 40;

    // ── Observaciones + ejecutivo a cargo ──
    if (y > H - 80) { doc.addPage(); y = 50; }
    doc.setFont('helvetica','bold'); doc.setFontSize(9); doc.setTextColor(AZUL[0],AZUL[1],AZUL[2]); doc.text('OBSERVACIONES', M, y); y += 14;
    doc.setFont('helvetica','normal'); doc.setFontSize(9); doc.setTextColor(60,60,60);
    if (CFG.terminos) { const tl = doc.splitTextToSize(String(CFG.terminos), W - 2 * M); doc.text(tl, M, y); y += tl.length * 11 + 4; }
    doc.text(`Ejecutivo a cargo: ${ejecutivo}`, M, y);

    // ── Pie (texto de la plantilla, configurable) ──
    doc.setFont('helvetica','normal'); doc.setFontSize(7.5); doc.setTextColor(150,150,150);
    if (CFG.nota) doc.text(doc.splitTextToSize(String(CFG.nota), W - 2 * M), W / 2, H - 24, { align:'center' });

    const nombrePdf = `Cotizacion_${(cot.codigo_cotizacion || cot.placa || cotId)}.pdf`;
    if (accion === 'enviar') {
      // Enviar al cliente: compartir el archivo (WhatsApp / correo / etc.)
      const blob = doc.output('blob');
      const file = new File([blob], nombrePdf, { type: 'application/pdf' });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        try { await navigator.share({ files: [file], title: 'Cotización', text: `Cotización ${cot.codigo_cotizacion || ''} · ${CFG.nombre}` }); toast('Listo para enviar ✓'); }
        catch (e) { /* el usuario canceló el compartir */ }
      } else {
        // Sin Share API (escritorio): descarga el PDF y abre WhatsApp con el mensaje
        doc.save(nombrePdf);
        const tel = String(cot.telefono_cliente || '').replace(/\D/g, '');
        const msg = encodeURIComponent(`Hola ${cot.nombre_cliente || ''}, te comparto la cotización ${cot.codigo_cotizacion || ''} de ${CFG.nombre}. Total: ${_money(_tot)}.`);
        window.open(`https://wa.me/${tel ? '57' + tel : ''}?text=${msg}`, '_blank');
        toast('PDF descargado — adjúntalo en el chat de WhatsApp que se abrió', 'warn');
      }
    } else {
      doc.save(nombrePdf);
      toast('PDF generado ✓');
    }
    return true;
  } catch(e) {
    toast('Error al generar PDF: ' + e.message, 'err');
    if (btn) { btn.disabled = false; btn.textContent = txtOrig; }
    return null;
  }
}

async function guardarNuevaCotizacion(conPdf = false) {
  const tipoCliente = document.getElementById('cn-tipo-cliente')?.value || 'persona';

  // Validación según tipo
  let nombreCliente, cedulaCliente, telefonoCliente, correoCliente, empresaId = null;

  if (tipoCliente === 'empresa') {
    const empNombre = document.getElementById('cn-emp-nombre')?.value.trim();
    if (!empNombre) {
      toast('El nombre de la empresa es obligatorio', 'err');
      document.getElementById('cn-emp-nombre')?.focus();
      return;
    }
    // Guardar/actualizar empresa
    empresaId = await _cotGuardarEmpresa();
    if (!empresaId) return; // _cotGuardarEmpresa ya muestra el toast de error
    nombreCliente   = empNombre;
    cedulaCliente   = document.getElementById('cn-emp-nit')?.value.trim()    || '';
    telefonoCliente = document.getElementById('cn-emp-tel')?.value.trim()    || '';
    correoCliente   = document.getElementById('cn-emp-correo')?.value.trim() || '';
  } else {
    const nombre = document.getElementById('cn-nombre')?.value.trim();
    if (!nombre) { toast('El nombre del cliente es obligatorio', 'err'); document.getElementById('cn-nombre')?.focus(); return; }
    nombreCliente   = nombre;
    cedulaCliente   = document.getElementById('cn-cedula')?.value.trim()   || '';
    telefonoCliente = document.getElementById('cn-celular')?.value.trim()  || '';
    correoCliente   = document.getElementById('cn-correo')?.value.trim()   || '';
  }

  const btnGuardar = document.getElementById('btn-guardar-cot');
  const btnPdf     = document.getElementById('btn-guardar-pdf-cot');
  const esEditar   = _cotEditandoId !== null;
  if (btnGuardar) { btnGuardar.disabled = true; btnGuardar.textContent = 'Guardando...'; }
  if (btnPdf)     { btnPdf.disabled = true; }

  try {
    const repItems   = _cotLeerItems('cot-rep-tbody');
    const moItems    = _cotLeerItems('cot-mo-tbody');
    const totalRep   = repItems.reduce((s, i) => s + i.total, 0);
    const totalMo    = moItems.reduce((s, i)  => s + i.total, 0);
    const subtotal   = totalRep + totalMo;
    const iva        = Math.round(subtotal * 0.19); // IVA siempre incluido
    const totalFinal = subtotal + iva;

    const camposBase = {
      placa:             document.getElementById('cn-placa')?.value.trim().toUpperCase() || '',
      marca:             document.getElementById('cn-marca')?.value.trim() || '',
      modelo:            document.getElementById('cn-linea')?.value.trim() || '',
      año:               document.getElementById('cn-ano')?.value.trim() || '',
      color:             document.getElementById('cn-color')?.value.trim() || '',
      vin:               document.getElementById('cn-vin')?.value.trim().toUpperCase() || '',
      kilometraje:       document.getElementById('cn-km')?.value.trim() || '',
      nombre_cliente:    nombreCliente,
      cedula_cliente:    cedulaCliente,
      telefono_cliente:  telefonoCliente,
      correo_cliente:    correoCliente,
      tipo_cliente:      tipoCliente,
      empresa_id:        empresaId,
      repuestos:         JSON.stringify(repItems),
      mano_obra_items:   JSON.stringify(moItems),
      total_repuestos:   totalRep,
      mano_obra:         totalMo,
      iva:               iva,
      total_general:     totalFinal,
    };

    let cotId;
    if (esEditar) {
      // PATCH — actualizar existente
      await api(`/cotizaciones?id=eq.${_cotEditandoId}`, 'PATCH', camposBase);
      cotId = _cotEditandoId;
      toast('Cotización actualizada ✓');
    } else {
      // POST — crear nueva
      const now  = new Date();
      const body = {
        ...camposBase,
        codigo_cotizacion: `COT-${now.getFullYear()}-${String(Date.now()).slice(-6)}`,
        fecha:             now.toLocaleDateString('es-CO'),
        hora:              now.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' }),
        estado:            'pendiente',
        // Ejecutivo a cargo = quien crea la cotización (usuario en sesión)
        tecnico:           (typeof sesion !== 'undefined' && sesion && sesion.nombre) || ''
      };
      const res = await api('/cotizaciones?select=id', 'POST', body, { Prefer: 'return=representation' });
      cotId = res[0]?.id;
      toast('Cotización guardada ✓');
    }

    if (conPdf && cotId) {
      // generarPdfCotizacion ya muestra los toasts y abre el PDF.
      await generarPdfCotizacion(cotId);
    }

    _cotEditandoId = null;
    volverACotizaciones();
    await cargarCotizaciones();
  } catch(e) {
    toast('Error al guardar: ' + e.message, 'err');
  } finally {
    if (btnGuardar) { btnGuardar.disabled = false; btnGuardar.textContent = esEditar ? 'Actualizar cotización →' : 'Guardar cotización →'; }
    if (btnPdf)     { btnPdf.disabled = false; }
  }
}

// ─── LISTA DE COTIZACIONES ────────────────────────────────

async function cargarCotizaciones() {
  const lista = document.getElementById('cot-lista');
  if (!lista) return;
  lista.innerHTML = '<div class="loading-state">Cargando cotizaciones...</div>';
  try {
    const data = await api('/cotizaciones?order=created_at.desc&limit=100') || [];
    todasCotizaciones = data;
    renderCotizaciones(data);
  } catch(e) {
    lista.innerHTML = `<div class="empty-state">Error: ${e.message}</div>`;
  }
}

function filtrarCotizaciones() {
  const q = (document.getElementById('cot-buscar')?.value || '').toLowerCase().trim();
  const est = document.getElementById('cot-filtro-estado')?.value || '';
  const filt = todasCotizaciones.filter(c => {
    const matchQ = !q || [c.placa, c.nombre_cliente, c.codigo_cotizacion, c.cedula_cliente].some(f => (f || '').toLowerCase().includes(q));
    const matchEst = !est || (c.estado || 'pendiente') === est;
    return matchQ && matchEst;
  });
  renderCotizaciones(filt);
}

function renderCotizaciones(data) {
  const lista = document.getElementById('cot-lista');
  if (!lista) return;
  if (!data.length) {
    lista.innerHTML = '<div class="empty-state"><div class="empty-state-icon">📄</div><p>No hay cotizaciones.</p></div>';
    return;
  }
  const fmt = n => n != null ? new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(n) : '—';
  
  lista.innerHTML = data.map(c => {
    const estado = c.estado || 'pendiente';
    const badgeCls = `badge-cot-${estado}`;
    let badgeTxt = '';
    if (estado === 'pendiente') {
      badgeTxt = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 6v6l4 2"/><path d="M20 12v5"/><path d="M20 21h.01"/><path d="M21.25 8.2A10 10 0 1 0 16 21.16"/></svg> Pendiente`;
    } else if (estado === 'aprobada') {
      badgeTxt = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg> Aprobada`;
    } else {
      badgeTxt = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg> Rechazada`;
    }
    const tienOrden = c.orden_id != null;
    return `<div class="cot-card" data-id="${c.id}">
      <div class="cot-card-top" onclick="abrirDetalleCotizacion(${c.id})" style="cursor:pointer">
        <div>
          <div class="cot-placa">${c.placa || '—'}</div>
          <div class="cot-codigo">${c.codigo_cotizacion || '—'}</div>
          <div class="cot-cliente">${c.nombre_cliente || '—'} · ${c.cedula_cliente || '—'}</div>
        </div>
        <span class="${badgeCls}">${badgeTxt}</span>
      </div>
      <div class="cot-card-mid" onclick="abrirDetalleCotizacion(${c.id})" style="cursor:pointer">
        <div class="cot-chip"><strong>${c.fecha || formatFecha(c.created_at)}</strong></div>
        <div class="cot-chip">Tecnico: <strong>${c.tecnico || '—'}</strong></div>
        <div class="cot-chip"><strong>${[c.marca, c.modelo, c.año].filter(Boolean).join(' ') || '—'}</strong></div>
        <div class="cot-chip">Valor: <strong>${fmt(c.total_general)}</strong></div>
      </div>
      <div class="cot-card-bot">
        ${estado !== 'rechazada' ? `<button class="btn btn-ghost btn-sm" style="font-size:12px;color:var(--azul)" onclick="event.stopPropagation();editarCotizacion(${c.id})">✏️ Editar</button>` : ''}
        <button class="btn btn-outline btn-sm" style="font-size:12px" onclick="event.stopPropagation();generarPdfCotizacion(${c.id})" data-pdf="${c.id}">📄 PDF</button>
        <button class="btn btn-primary btn-sm" style="font-size:12px" onclick="event.stopPropagation();enviarPdfCotizacion(${c.id})">📤 Enviar</button>
        ${estado === 'pendiente' ? `
          <button class="btn btn-success btn-sm" onclick="event.stopPropagation();aprobarCotizacion(${c.id})">Aprobar → Crear Orden</button>
          <button class="btn btn-danger btn-sm" onclick="event.stopPropagation();rechazarCotizacion(${c.id})">Rechazar</button>
        ` : ''}
        ${estado === 'aprobada' && !tienOrden ? `
          <button class="btn btn-primary btn-sm" onclick="event.stopPropagation();convertirEnOrden(${c.id})">+ Crear orden desde esta</button>
        ` : ''}
        ${tienOrden ? `<span style="font-size:12px;color:var(--verde);font-weight:600">✓ Orden creada</span>` : ''}
      </div>
    </div>`;
  }).join('');
  // Resaltar las cotizaciones nuevas desde la última vez que se vio la sección
  if (typeof destellarPendientes === 'function') destellarPendientes('cotizaciones', lista, '.cot-card');
}

// ─── MODAL DETALLE COTIZACIÓN ─────────────────────────────

function cerrarModalCotizacion() {
  const m = document.getElementById('modal-cot-detalle');
  if (m) m.classList.remove('show');
}

async function abrirDetalleCotizacion(cotId) {
  // Crear modal si no existe
  let modal = document.getElementById('modal-cot-detalle');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'modal-cot-detalle';
    modal.className = 'modal-overlay';
    modal.innerHTML = `
      <div class="modal" style="max-width:680px;max-height:90vh;display:flex;flex-direction:column">
        <div class="modal-header">
          <h2 id="mcot-titulo">Cotización</h2>
          <button class="btn btn-ghost btn-sm" onclick="cerrarModalCotizacion()">✕</button>
        </div>
        <div class="modal-body" id="mcot-body" style="overflow-y:auto;flex:1"><div class="loading-state">Cargando...</div></div>
        <div class="modal-footer" id="mcot-footer"></div>
      </div>`;
    modal.addEventListener('click', e => { if (e.target === modal) cerrarModalCotizacion(); });
    document.body.appendChild(modal);
  }
  modal.classList.add('show');
  document.getElementById('mcot-body').innerHTML = '<div class="loading-state">Cargando...</div>';
  document.getElementById('mcot-footer').innerHTML = '';

  // Obtener cotización
  let cot = todasCotizaciones.find(c => c.id === cotId);
  if (!cot) {
    const arr = await api(`/cotizaciones?id=eq.${cotId}&limit=1`).catch(() => []);
    cot = arr?.[0];
  }
  if (!cot) {
    document.getElementById('mcot-body').innerHTML = '<div class="empty-state">No se encontró la cotización.</div>';
    return;
  }

  document.getElementById('mcot-titulo').textContent = `${cot.codigo_cotizacion || 'Cotización'} — ${cot.placa || ''}`;

  const fmt = n => n != null ? new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(n) : '—';

  // Parsear ítems
  let repuestos = [];
  let moItems   = [];
  try { repuestos = typeof cot.repuestos       === 'string' ? JSON.parse(cot.repuestos)       : (cot.repuestos       || []); } catch(e) { repuestos = []; }
  try { moItems   = typeof cot.mano_obra_items === 'string' ? JSON.parse(cot.mano_obra_items) : (cot.mano_obra_items || []); } catch(e) { moItems   = []; }

  const filaItem = it => `
    <tr>
      <td style="padding:6px 8px;text-align:center">${it.cantidad ?? '—'}</td>
      <td style="padding:6px 8px">${escapeHtml(it.descripcion || '—')}</td>
      <td style="padding:6px 8px;text-align:right">${fmt(it.valor_unitario)}</td>
      <td style="padding:6px 8px;text-align:center">${it.descuento_pct ?? 0}%</td>
      <td style="padding:6px 8px;text-align:right;font-weight:600">${fmt(it.total)}</td>
    </tr>`;

  const tablaItems = (items, vacia) => {
    if (!items.length) return `<p style="font-size:13px;color:var(--gris-mid);padding:8px 0">${vacia}</p>`;
    return `<table style="width:100%;border-collapse:collapse;font-size:13px">
      <thead><tr style="background:var(--gris-bg);font-size:11px;text-transform:uppercase;color:var(--gris-mid)">
        <th style="padding:6px 8px;text-align:center">Cant.</th>
        <th style="padding:6px 8px;text-align:left">Descripción</th>
        <th style="padding:6px 8px;text-align:right">Vr. Unit.</th>
        <th style="padding:6px 8px;text-align:center">Dcto.</th>
        <th style="padding:6px 8px;text-align:right">Total</th>
      </tr></thead>
      <tbody>${items.map(filaItem).join('')}</tbody>
    </table>`;
  };

  const chip = (label, val) => val
    ? `<div style="display:flex;flex-direction:column;gap:2px">
         <div style="font-size:10px;color:var(--gris-mid);text-transform:uppercase;letter-spacing:.4px">${label}</div>
         <div style="font-size:13px;font-weight:500">${escapeHtml(String(val))}</div>
       </div>` : '';

  document.getElementById('mcot-body').innerHTML = `
    <!-- VEHÍCULO -->
    <div style="margin-bottom:20px">
      <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.6px;color:var(--gris-mid);margin-bottom:10px">Vehículo</div>
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(120px,1fr));gap:12px;background:var(--gris-bg);border-radius:10px;padding:14px">
        ${chip('Placa', cot.placa)}
        ${chip('Marca', cot.marca)}
        ${chip('Línea', cot.modelo)}
        ${chip('Año', cot.año)}
        ${chip('Color', cot.color)}
        ${chip('VIN', cot.vin)}
        ${chip('Km', cot.kilometraje)}
      </div>
    </div>
    <!-- CLIENTE -->
    <div style="margin-bottom:20px">
      <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.6px;color:var(--gris-mid);margin-bottom:10px">Cliente</div>
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:12px;background:var(--gris-bg);border-radius:10px;padding:14px">
        ${chip('Nombre', cot.nombre_cliente)}
        ${chip('Cédula/NIT', cot.cedula_cliente)}
        ${chip('Teléfono', cot.telefono_cliente)}
        ${chip('Correo', cot.correo_cliente)}
        ${chip('Aseguradora', cot.aseguradora)}
        ${chip('Tipo cliente', cot.tipo_cliente)}
        ${chip('Nivel de daño', cot.nivel_dano)}
      </div>
    </div>
    <!-- REPUESTOS -->
    <div style="margin-bottom:20px">
      <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.6px;color:var(--gris-mid);margin-bottom:10px">Repuestos</div>
      ${tablaItems(repuestos, 'Sin repuestos')}
    </div>
    <!-- MANO DE OBRA -->
    <div style="margin-bottom:20px">
      <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.6px;color:var(--gris-mid);margin-bottom:10px">Mano de obra</div>
      ${tablaItems(moItems, 'Sin mano de obra')}
    </div>
    <!-- TOTALES -->
    <div style="background:var(--gris-bg);border-radius:10px;padding:14px">
      <div style="display:flex;justify-content:space-between;font-size:13px;padding:5px 0;border-bottom:1px solid var(--gris-borde)"><span style="color:var(--gris-mid)">Repuestos</span><span style="font-weight:600">${fmt(cot.total_repuestos)}</span></div>
      <div style="display:flex;justify-content:space-between;font-size:13px;padding:5px 0;border-bottom:1px solid var(--gris-borde)"><span style="color:var(--gris-mid)">Mano de obra</span><span style="font-weight:600">${fmt(cot.mano_obra)}</span></div>
      <div style="display:flex;justify-content:space-between;font-size:14px;font-weight:700;padding:8px 0;border-bottom:1px solid var(--gris-borde)"><span>Subtotal</span><span>${fmt((cot.total_repuestos||0)+(cot.mano_obra||0))}</span></div>
      ${cot.iva ? `
      <div style="display:flex;justify-content:space-between;font-size:13px;padding:5px 0;border-bottom:1px solid var(--gris-borde)"><span style="color:var(--gris-mid)">IVA (19%)</span><span style="font-weight:600">${fmt(cot.iva)}</span></div>
      <div style="display:flex;justify-content:space-between;font-size:16px;font-weight:800;padding:10px 12px;background:var(--azul);color:white;border-radius:8px;margin-top:8px"><span>TOTAL CON IVA</span><span>${fmt(cot.total_general)}</span></div>
      ` : `
      <div style="display:flex;justify-content:space-between;font-size:16px;font-weight:800;padding:10px 12px;background:var(--azul);color:white;border-radius:8px;margin-top:8px"><span>TOTAL</span><span>${fmt(cot.total_general)}</span></div>
      `}
    </div>`;

  // Botones del footer
  const estado = cot.estado || 'pendiente';
  const tienOrden = cot.orden_id != null;
  const footerEl = document.getElementById('mcot-footer');
  footerEl.innerHTML = `
    <button class="btn btn-ghost" onclick="cerrarModalCotizacion()">Cerrar</button>
    ${estado !== 'rechazada' ? `<button class="btn btn-ghost btn-sm" style="color:var(--azul)" onclick="editarCotizacion(${cot.id})">✏️ Editar</button>` : ''}
    <button class="btn btn-outline" onclick="generarPdfCotizacion(${cot.id})" data-pdf="${cot.id}">📄 Generar PDF</button>
    <button class="btn btn-primary" onclick="enviarPdfCotizacion(${cot.id})">📤 Enviar al cliente</button>
    ${estado === 'pendiente' ? `
      <button class="btn btn-success" onclick="cerrarModalCotizacion();aprobarCotizacion(${cot.id})">✓ Aprobar → Crear Orden</button>
      <button class="btn btn-danger btn-sm" onclick="cerrarModalCotizacion();rechazarCotizacion(${cot.id})">Rechazar</button>
    ` : ''}
    ${estado === 'aprobada' && !tienOrden ? `
      <button class="btn btn-primary" onclick="cerrarModalCotizacion();convertirEnOrden(${cot.id})">+ Crear orden</button>
    ` : ''}
    ${tienOrden ? `<span style="font-size:13px;color:var(--verde);font-weight:600;padding:0 8px">✓ Orden ya creada</span>` : ''}`;
}

async function aprobarCotizacion(id) {
  if (!confirm('¿Aprobar esta cotización y crear la orden de trabajo?')) return;
  try {
    await api(`/cotizaciones?id=eq.${id}`, 'PATCH', { estado: 'aprobada' });
    const cot = todasCotizaciones.find(c => c.id === id);
    if (cot) await crearOrdenDesdeCotizacion(cot);
    toast('Cotización aprobada y orden creada ✓');
    cargarCotizaciones();
  } catch(e) { toast('Error: ' + e.message, 'err'); }
}

async function rechazarCotizacion(id) {
  if (!confirm('¿Rechazar esta cotización?')) return;
  try {
    await api(`/cotizaciones?id=eq.${id}`, 'PATCH', { estado: 'rechazada' });
    toast('Cotización rechazada ✓');
    cargarCotizaciones();
  } catch(e) { toast('Error: ' + e.message, 'err'); }
}

async function convertirEnOrden(cotId) {
  const cot = todasCotizaciones.find(c => c.id === cotId);
  if (!cot) return;
  try {
    await crearOrdenDesdeCotizacion(cot);
    toast('Orden creada ✓');
    cargarCotizaciones();
  } catch(e) { toast('Error: ' + e.message, 'err'); }
}

async function crearOrdenDesdeCotizacion(cot) {
  // Buscar o crear cliente
  let clienteId = null;
  if (cot.cedula_cliente) {
    try {
      const cl = await api(`/clientes?cedula_nit=eq.${cot.cedula_cliente}`).catch(() => []) || [];
      if (cl.length) {
        clienteId = cl[0].id;
      } else if (cot.nombre_cliente) {
        const nuevo = await api('/clientes?select=id', 'POST', {
          cedula_nit: cot.cedula_cliente,
          nombre: cot.nombre_cliente,
          celular: cot.telefono_cliente || null
        }, { Prefer: 'return=representation' });
        clienteId = nuevo[0]?.id || null;
      }
    } catch(e) { console.warn('Error cliente:', e); }
  }

  // Buscar vehículo
  let vehiculoId = null;
  if (cot.placa) {
    const vh = await api(`/vehiculos?placa=eq.${cot.placa}`).catch(() => []) || [];
    vehiculoId = vh[0]?.id || null;
  }

  // Construir descripción general desde los ítems de la cotización
  let repItems = [], moItems = [];
  try { repItems = typeof cot.repuestos       === 'string' ? JSON.parse(cot.repuestos)       : (cot.repuestos       || []); } catch(e) { repItems = []; }
  try { moItems  = typeof cot.mano_obra_items === 'string' ? JSON.parse(cot.mano_obra_items) : (cot.mano_obra_items || []); } catch(e) { moItems  = []; }

  const lineasDesc = [];
  if (moItems.length) {
    const mo = moItems.filter(i => i.descripcion?.trim()).map(i => `${i.descripcion}${i.cantidad > 1 ? ` (x${i.cantidad})` : ''}`).join(', ');
    if (mo) lineasDesc.push(`Mano de obra: ${mo}`);
  }
  if (repItems.length) {
    const rp = repItems.filter(i => i.descripcion?.trim()).map(i => `${i.descripcion}${i.cantidad > 1 ? ` (x${i.cantidad})` : ''}`).join(', ');
    if (rp) lineasDesc.push(`Repuestos: ${rp}`);
  }
  const descripcionGeneral = lineasDesc.join('\n') || null;

  // Construir body con todos los campos disponibles en la cotización
  const body = {
    placa:              cot.placa              || null,
    marca:              cot.marca              || null,
    linea:              cot.modelo             || null,
    modelo:             cot.año                || null,
    color:              cot.color              || null,
    vin:                cot.vin                || null,
    km:                 cot.kilometraje        ? parseInt(cot.kilometraje) || null : null,
    propietario:        cot.nombre_cliente     || null,
    telefono:           cot.telefono_cliente   || null,
    correo_cliente:     cot.correo_cliente     || null,
    cedula_cliente:     cot.cedula_cliente     || null,
    aseguradora:        cot.aseguradora        || null,
    empresa_id:         cot.empresa_id         || null,
    tipo_cliente:       (cot.tipo_cliente === 'persona' ? 'particular' : cot.tipo_cliente) || null,
    nivel_dano:         cot.nivel_dano         || null,
    descripcion_general: descripcionGeneral,
    cotizacion_url:     cot.url_pdf            || null,
    cotizacion_id:      cot.id,
    cliente_id:         clienteId,
    vehiculo_id:        vehiculoId,
    estado:             'Activa'
  };

  const res = await api('/ordenes?select=id', 'POST', body, { Prefer: 'return=representation' });
  const ordenId = res[0].id;
  await api(`/cotizaciones?id=eq.${cot.id}`, 'PATCH', { orden_id: ordenId });

  // Notificar por Telegram (mismo evento que crearOrden normal)
  fetch(N8N_WEBHOOK, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      evento: 'orden_creada',
      orden: {
        id:           ordenId,
        placa:        body.placa,
        propietario:  body.propietario,
        marca:        body.marca,
        linea:        body.linea,
        modelo:       body.modelo,
        color:        body.color,
        tipo_cliente: body.tipo_cliente,
        aseguradora:  body.aseguradora,
        fecha_entrega_1: null,
        desde_cotizacion: true
      },
      etapas: [],   // el jefe las asigna después
      link: (typeof window !== 'undefined') ? `${window.location.origin}${window.location.pathname}` : ''
    })
  }).catch(() => {});

  return ordenId;
}