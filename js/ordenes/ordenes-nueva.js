// ═══════════════════════════════════════════════════════════
// ÓRDENES — NUEVA ORDEN, WIZARD, SERVICIOS
// ═══════════════════════════════════════════════════════════
function resetNuevaOrden() {
  const fields = ['n-placa', 'n-marca', 'n-linea', 'n-modelo', 'n-color', 'n-propietario', 'n-telefono', 'n-km', 'n-fecha1', 'n-fecha2', 'n-inv-obs', 'n-cedula-cliente', 'n-vin', 'n-correo-cliente', 'n-descripcion-general'];
  fields.forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
  const aseguradora = document.getElementById('n-aseguradora');
  const dano = document.getElementById('n-dano');
  const tipoCliente = document.getElementById('n-tipo-cliente');
  const tipoCarroceria = document.getElementById('n-tipo-carroceria');
  if (aseguradora) aseguradora.value = '';
  if (dano) dano.value = '';
  if (tipoCliente) tipoCliente.value = '';
  if (tipoCarroceria) tipoCarroceria.value = '';
  const _kmChk = document.getElementById('n-km-omitir');
  if (_kmChk) { _kmChk.checked = false; }
  const _kmInp = document.getElementById('n-km');
  if (_kmInp) { _kmInp.disabled = false; _kmInp.style.opacity = '1'; }
  document.querySelectorAll('.dano-cb').forEach(cb => { cb.checked = false; });
  document.querySelectorAll('.inv-item').forEach(el => {
    el.classList.remove('checked');
    const chk = el.querySelector('input[type=checkbox]');
    if (chk) chk.checked = false;
  });
  fotosIngresoPendientes = [];
  renderPreviewIngreso();
  const resultado = document.getElementById('placa-resultado');
  const historial = document.getElementById('historial-previo');
  if (resultado) resultado.style.display = 'none';
  if (historial) historial.style.display = 'none';
}

function cancelarNuevaOrden() {
  if (esJefe()) navJefe('ordenes');
}

// ── Wizard nueva orden ──────────────────────────────────────
let _wizardPaso = 1;

function irPasoWizard(paso) {
  if (paso === 2 && !_validarPaso1()) return;
  _wizardPaso = paso;
  const s1 = document.getElementById('wizard-s1');
  const s2 = document.getElementById('wizard-s2');
  const ws1 = document.getElementById('ws-1');
  const ws2 = document.getElementById('ws-2');
  const btnPrev = document.getElementById('wizard-btn-prev');
  const btnNext = document.getElementById('wizard-btn-next');
  const btnSave = document.getElementById('wizard-btn-save');
  if (s1) s1.style.display = paso === 1 ? '' : 'none';
  if (s2) s2.style.display = paso === 2 ? '' : 'none';
  if (ws1) { ws1.classList.toggle('active', paso === 1); ws1.classList.toggle('done', paso > 1); }
  if (ws2) { ws2.classList.toggle('active', paso === 2); }
  if (btnPrev) btnPrev.style.display = paso > 1 ? '' : 'none';
  if (btnNext) btnNext.style.display = paso < 2 ? '' : 'none';
  if (btnSave) btnSave.style.display = paso === 2 ? '' : 'none';
  // Scroll al inicio del formulario
  const pag = document.getElementById('pag-nueva');
  if (pag) pag.scrollTop = 0;
}

function _validarPaso1() {
  const placa = document.getElementById('n-placa')?.value.trim();
  if (!placa) { toast('Ingresa la placa del vehículo', 'err'); return false; }
  const tipo = document.getElementById('n-tipo-cliente')?.value;
  if (!tipo) {
    const errEl = document.getElementById('n-tipo-cliente-error');
    if (errEl) errEl.style.display = 'block';
    toast('Selecciona el tipo de cliente', 'err');
    return false;
  }
  return true;
}

function _resetWizard() {
  _wizardPaso = 1;
  const s1 = document.getElementById('wizard-s1');
  const s2 = document.getElementById('wizard-s2');
  const ws1 = document.getElementById('ws-1');
  const ws2 = document.getElementById('ws-2');
  const btnPrev = document.getElementById('wizard-btn-prev');
  const btnNext = document.getElementById('wizard-btn-next');
  const btnSave = document.getElementById('wizard-btn-save');
  if (s1) s1.style.display = '';
  if (s2) s2.style.display = 'none';
  if (ws1) { ws1.classList.add('active'); ws1.classList.remove('done'); }
  if (ws2) { ws2.classList.remove('active'); }
  if (btnPrev) btnPrev.style.display = 'none';
  if (btnNext) btnNext.style.display = '';
  if (btnSave) btnSave.style.display = 'none';
}

function toggleInv(el, key) {
  el.classList.toggle('checked');
  const chk = el.querySelector('input[type=checkbox]');
  if (chk) chk.checked = el.classList.contains('checked');
}

function agregarFotosIngreso(input) {
  fotosIngresoPendientes = [...fotosIngresoPendientes, ...Array.from(input.files)];
  renderPreviewIngreso();
}

function renderPreviewIngreso() {
  const g = document.getElementById('fotos-ingreso-preview');
  if (!g) return;
  g.innerHTML = fotosIngresoPendientes.map((f, i) => `
    <div class="foto-thumb">
      <img src="${URL.createObjectURL(f)}" style="width:100%;height:100%;object-fit:cover">
      <button class="foto-delete" style="opacity:1" onclick="quitarFotoIngreso(${i})">✕</button>
    </div>`).join('');
}

function quitarFotoIngreso(i) { 
  fotosIngresoPendientes.splice(i, 1); 
  renderPreviewIngreso(); 
}

// ── Autocompletado de placa en tiempo real ──────────────────
let _placaDebounce = null;
let _placaRegistry = {};

function seleccionarPlacaById(placa) {
  seleccionarPlaca(placa, _placaRegistry[placa] || {});
}

async function autocompletarPlaca(val) {
  clearTimeout(_placaDebounce);
  const sugDiv = document.getElementById('placa-sugerencias');
  if (!sugDiv) return;
  if (!val || val.length < 2) { sugDiv.style.display = 'none'; return; }

  _placaDebounce = setTimeout(async () => {
    try {
      const [deVehiculos, deOrdenes] = await Promise.all([
        api(`/vehiculos?placa=ilike.${val}*&select=placa,marca,linea,modelo&limit=6`).catch(()=>[]) || [],
        api(`/ordenes?placa=ilike.${val}*&select=placa,marca,linea,modelo,propietario,telefono,color&order=creado_en.desc&limit=6`).catch(()=>[]) || []
      ]);

      // Deduplicar por placa, priorizar vehículos
      const mapa = {};
      deOrdenes.forEach(o => { mapa[o.placa] = o; });
      deVehiculos.forEach(v => { mapa[v.placa] = { ...mapa[v.placa], ...v }; });
      const sugerencias = Object.values(mapa).slice(0, 6);

      if (!sugerencias.length) { sugDiv.style.display = 'none'; return; }

      _placaRegistry = {};
      sugerencias.forEach(s => { _placaRegistry[s.placa] = s; });

      sugDiv.innerHTML = sugerencias.map(s => `
        <div class="placa-sug-item" data-placa="${escapeHtml(s.placa)}" onmousedown="seleccionarPlacaById(this.dataset.placa)">
          <span class="placa-sug-placa">${escapeHtml(s.placa)}</span>
          <span class="placa-sug-veh">${[s.marca,s.linea,s.modelo].filter(Boolean).map(escapeHtml).join(' ')||'—'}</span>
        </div>`).join('');
      sugDiv.style.display = 'block';
    } catch(e) { sugDiv.style.display = 'none'; }
  }, 250);
}

function seleccionarPlaca(placa, datos) {
  const input = document.getElementById('n-placa');
  if (input) input.value = placa;
  cerrarSugerenciasPlaca();
  // Pre-llenar campos del vehículo
  const campos = { 'n-marca': datos.marca, 'n-linea': datos.linea, 'n-modelo': datos.modelo, 'n-color': datos.color };
  Object.entries(campos).forEach(([id, val]) => {
    const el = document.getElementById(id);
    if (el && val) el.value = val;
  });
  // Pre-llenar propietario si es particular
  if (datos.propietario) {
    const prop = document.getElementById('n-propietario');
    const tel  = document.getElementById('n-telefono');
    if (prop && !prop.value) prop.value = datos.propietario;
    if (tel  && !tel.value  && datos.telefono) tel.value = datos.telefono;
  }
  buscarPorPlaca(); // Mostrar historial
}

function cerrarSugerenciasPlaca() {
  const s = document.getElementById('placa-sugerencias');
  if (s) s.style.display = 'none';
}

let _placaSugIdx = -1;
function navSugerenciasPlaca(e) {
  const items = document.querySelectorAll('.placa-sug-item');
  if (!items.length) return;
  if (e.key === 'ArrowDown') { e.preventDefault(); _placaSugIdx = Math.min(_placaSugIdx+1, items.length-1); }
  else if (e.key === 'ArrowUp') { e.preventDefault(); _placaSugIdx = Math.max(_placaSugIdx-1, 0); }
  else if (e.key === 'Enter' && _placaSugIdx >= 0) { e.preventDefault(); items[_placaSugIdx]?.dispatchEvent(new MouseEvent('mousedown')); return; }
  else if (e.key === 'Escape') { cerrarSugerenciasPlaca(); return; }
  items.forEach((item, i) => item.classList.toggle('active', i === _placaSugIdx));
}

async function buscarPorPlaca() {
  const placa = document.getElementById('n-placa')?.value.trim().toUpperCase();
  const resultDiv = document.getElementById('placa-resultado');
  const histDiv = document.getElementById('historial-previo');
  cerrarSugerenciasPlaca();
  if (!placa || placa.length < 3) {
    if (resultDiv) resultDiv.style.display = 'none';
    if (histDiv) histDiv.style.display = 'none';
    return;
  }
  try {
    // Consultar vehículos registrados Y historial de órdenes en paralelo
    const [vehiculo, ordenes] = await Promise.all([
      api(`/vehiculos?placa=eq.${placa}&limit=1`).then(r => r?.[0]).catch(() => null),
      api(`/ordenes?placa=eq.${placa}&order=creado_en.desc&limit=5`).catch(() => []) || []
    ]);

    // Prioridad: tabla vehiculos > última orden
    const fuente = vehiculo || (ordenes?.length ? ordenes[0] : null);

    if (fuente) {
      const flds = { 'n-marca': fuente.marca, 'n-linea': fuente.linea, 'n-modelo': fuente.modelo, 'n-color': fuente.color };
      Object.entries(flds).forEach(([id, val]) => {
        const el = document.getElementById(id);
        if (el && val && !el.value) el.value = val;
      });
      const prop = document.getElementById('n-propietario');
      const tel  = document.getElementById('n-telefono');
      const ced  = document.getElementById('n-cedula-cliente');
      if (prop && !prop.value && fuente.propietario) prop.value = fuente.propietario;
      if (tel  && !tel.value  && fuente.telefono)    tel.value  = fuente.telefono;
      if (ced  && !ced.value  && fuente.cedula_nit)  ced.value  = fuente.cedula_nit;

      // Si el vehículo pertenece a una flotilla, pre-seleccionar
      if (vehiculo?.flotilla_id) {
        const tabFlot = document.getElementById('tcb-flotilla');
        if (tabFlot && typeof selTipoCliente === 'function') {
          const tipoActual = document.getElementById('n-tipo-cliente')?.value;
          if (!tipoActual) {
            selTipoCliente(tabFlot, 'flotilla');
            setTimeout(() => {
              const sel = document.getElementById('n-flotilla-sel');
              if (sel) sel.value = vehiculo.flotilla_id;
            }, 300);
          }
        }
      }

      if (resultDiv) {
        const origen = vehiculo ? '🚗 Vehículo en flotilla registrada' : '✔ Vehículo encontrado';
        resultDiv.className = 'placa-resultado encontrado';
        resultDiv.innerHTML = `${origen} — datos autocompletados.`;
        resultDiv.style.display = 'block';
      }
    }

    if (ordenes?.length) {
      const historialLista = document.getElementById('historial-lista');
      if (historialLista && histDiv) {
        historialLista.innerHTML = ordenes.map(o => `
          <div class="historial-item" onclick="abrirOrden(${o.id})">
            <div><span class="historial-placa">${escapeHtml(o.placa)}</span>
            <span style="color:var(--gris-mid);margin-left:8px">${escapeHtml(o.aseguradora)||'—'}</span></div>
            <div style="font-size:11px;color:var(--gris-mid);text-align:right">${formatFecha(o.creado_en)}</div>
          </div>`).join('');
        histDiv.style.display = 'block';
      }
    } else if (!fuente) {
      if (resultDiv) {
        resultDiv.className = 'placa-resultado nuevo';
        resultDiv.innerHTML = 'ℹ Placa nueva — sin registros anteriores.';
        resultDiv.style.display = 'block';
      }
      if (histDiv) histDiv.style.display = 'none';
    }
  } catch(e) { if (resultDiv) resultDiv.style.display = 'none'; }
}

// ── OCR Tarjeta de Propiedad ─────────────────────────────────
async function ocrTarjetaPropiedad(input) {
  const file = input.files?.[0];
  if (!file) return;
  const estado = document.getElementById('ocr-estado');
  if (estado) { estado.style.display = 'block'; estado.innerHTML = '⏳ Leyendo tarjeta de propiedad...'; }

  try {
    const parsed = await ocrLeerTarjeta(file);

    const mapa = {
      'n-placa':  parsed.placa?.toUpperCase(),
      'n-marca':  parsed.marca,
      'n-linea':  parsed.linea,
      'n-modelo': parsed.modelo,
      'n-color':  parsed.color,
      'n-vin':    parsed.vin?.toUpperCase()
    };

    let encontrados = [];
    Object.entries(mapa).forEach(([id, val]) => {
      if (!val) return;
      const el = document.getElementById(id);
      if (el) { el.value = val; encontrados.push(id.replace('n-','').replace('-',' ')); }
    });

    // Propietario va al campo correcto según tipo cliente seleccionado
    if (parsed.propietario) {
      const tipo = document.getElementById('n-tipo-cliente')?.value;
      const targetId = tipo === 'aseguradora' ? 'n-propietario-aseg' : 'n-propietario';
      const el = document.getElementById(targetId);
      if (el && !el.value) { el.value = parsed.propietario; encontrados.push('propietario'); }
    }

    // Documento del propietario (cédula o NIT) extraído de la tarjeta.
    const docParsed = parsed.documento || parsed.cedula_nit || parsed.cedula;
    const esNit = (parsed.tipo_documento || '').toUpperCase() === 'NIT';
    if (docParsed) {
      const tipo = document.getElementById('n-tipo-cliente')?.value;
      const cedId = tipo === 'aseguradora' ? 'n-cedula-aseg' : 'n-cedula-cliente';
      const cedEl = document.getElementById(cedId);
      if (cedEl && !cedEl.value) { cedEl.value = docParsed; encontrados.push(esNit ? 'NIT' : 'cédula'); }
      // Si la tarjeta es de una empresa (NIT), ajustar el modo persona/empresa.
      if (esNit) {
        const radioEmp = document.querySelector('input[name="n-tipo-persona"][value="empresa"]');
        if (radioEmp && typeof toggleTipoPersonaNueva === 'function') {
          radioEmp.checked = true;
          toggleTipoPersonaNueva('empresa');
        }
      }
    }

    // Si encontró placa, buscar historial
    if (parsed.placa) buscarPorPlaca();

    if (estado) {
      if (encontrados.length) {
        estado.innerHTML = `${ico('check',14)} Datos extraídos: <strong>${encontrados.join(', ')}</strong>. Revisa y corrige si es necesario.`;
        estado.style.background = 'var(--verde-bg)';
        estado.style.borderColor = 'var(--verde)';
        estado.style.color = 'var(--verde)';
      } else {
        estado.innerHTML = ico('warning',14) + ' No se pudieron extraer datos. La imagen puede estar borrosa o mal enfocada. Intenta con mejor iluminación.';
        estado.style.background = '#FEF3C7';
        estado.style.borderColor = '#FDE68A';
        estado.style.color = '#92400E';
      }
    }
  } catch(e) {
    if (estado) {
      estado.innerHTML = ico('x',14) + ' Error al leer la tarjeta: ' + e.message;
      estado.style.background = 'var(--rojo-bg,#FEE2E2)';
    }
    console.error('OCR error:', e);
  } finally {
    input.value = ''; // Reset para poder volver a subir
  }
}

// ── Toggle persona natural / empresa en nueva orden ─────────
function toggleTipoPersonaNueva(tipo) {
  const lblNombre = document.getElementById('lbl-n-propietario');
  const lblDoc    = document.getElementById('lbl-n-cedula');
  if (tipo === 'empresa') {
    if (lblNombre) lblNombre.textContent = 'Razón social *';
    if (lblDoc)    lblDoc.textContent    = 'NIT';
  } else {
    if (lblNombre) lblNombre.textContent = 'Nombre completo *';
    if (lblDoc)    lblDoc.textContent    = 'Cédula';
  }
}

function toggleTipoClienteNueva(tipo) {
  ['n-wrap-particular','n-wrap-aseg','n-wrap-flot','n-wrap-empresa'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = 'none';
  });
  const mapaBloque = {
    particular:  'n-wrap-particular',
    aseguradora: 'n-wrap-aseg',
    flotilla:    'n-wrap-flot',
    empresa:     'n-wrap-empresa'
  };
  const el = document.getElementById(mapaBloque[tipo]);
  if (el) el.style.display = 'block';
  const hidden = document.getElementById('n-tipo-cliente');
  if (hidden) hidden.value = tipo;
}

function selTipoCliente(label, tipo) {
  document.querySelectorAll('.tipo-cliente-btn').forEach(b => b.classList.remove('selected'));
  label.classList.add('selected');
  // Ocultar error de tipo si estaba visible
  const errEl = document.getElementById('n-tipo-cliente-error');
  if (errEl) errEl.style.display = 'none';
  toggleTipoClienteNueva(tipo);
}

function toggleNuevaAseg(val) {
  const el = document.getElementById('n-wrap-aseg-extra');
  if (el) el.style.display = val ? 'none' : 'block';
}
function toggleNuevaFlot(val) {
  const el = document.getElementById('n-wrap-flot-extra');
  if (el) el.style.display = val ? 'none' : 'block';
}
function toggleNuevaEmpresa(val) {
  const el = document.getElementById('n-wrap-empresa-extra');
  if (el) el.style.display = val ? 'none' : 'block';
}
async function agregarNuevaEmpresaNueva() {
  const n = document.getElementById('n-emp-nombre')?.value.trim() || prompt('Razón social:')?.trim();
  if (!n) return;
  const nit = document.getElementById('n-emp-nit')?.value.trim() || null;
  try {
    await api('/flotillas', 'POST', { nombre: n, nit, activo: true }, { Prefer:'return=minimal' });
    toast('Empresa agregada ✓');
    await recargarListasNuevaOrden();
    const sel = document.getElementById('n-empresa-sel');
    if (sel) sel.value = n;
  } catch(e) { toast('Error: '+e.message,'err'); }
}

function agregarNuevaAsegNueva(onSaved) {
  // Eliminar modal previo
  document.getElementById('modal-nueva-aseg')?.remove();

  // Contador de contactos
  let _contactoIdx = 0;

  const m = document.createElement('div');
  m.id = 'modal-nueva-aseg';
  m.className = 'modal-overlay show';
  m.innerHTML = `
    <div class="modal" style="max-width:560px">
      <div class="modal-header">
        <div class="modal-titulo">
          <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
          Nueva aseguradora
        </div>
        <button class="modal-close" onclick="document.getElementById('modal-nueva-aseg').remove()">
          <svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M18 6L6 18M6 6l12 12"/></svg>
        </button>
      </div>
      <div class="modal-body" style="display:flex;flex-direction:column;gap:12px">

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
          <div class="field" style="margin:0"><label>Nombre *</label><input id="naseg-nombre" placeholder="HDI Seguros, Sura..."></div>
          <div class="field" style="margin:0"><label>NIT</label><input id="naseg-nit" placeholder="900123456-7"></div>
          <div class="field" style="margin:0"><label>Teléfono</label><input id="naseg-tel" type="tel" placeholder="6011234567"></div>
          <div class="field" style="margin:0"><label>Correo</label><input id="naseg-mail" type="email" placeholder="contacto@aseguradora.com"></div>
          <div class="field" style="margin:0;grid-column:1/-1"><label>Dirección</label><input id="naseg-dir" placeholder="Cra 7 #32-16, Bogotá"></div>
          <div class="field" style="margin:0"><label>Valor hora estadía (COP)</label><input id="naseg-hora" type="number" min="0" placeholder="0" style="font-family:'DM Mono',monospace"></div>
        </div>

        <div style="border-top:1px solid var(--gris-borde);padding-top:12px">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">
            <span style="font-size:11px;font-weight:700;color:var(--gris-mid);text-transform:uppercase;letter-spacing:.5px">Contactos</span>
            <button class="btn btn-ghost btn-xs" onclick="_nasegAgregarContacto()" style="display:flex;align-items:center;gap:4px">
              <svg width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              Agregar contacto
            </button>
          </div>
          <div id="naseg-contactos-wrap" style="display:flex;flex-direction:column;gap:8px"></div>
        </div>

        <div id="naseg-error" style="display:none;background:var(--rojo-bg);color:var(--rojo);border-radius:6px;padding:9px 12px;font-size:13px"></div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-ghost" onclick="document.getElementById('modal-nueva-aseg').remove()">Cancelar</button>
        <button class="btn btn-primary" id="naseg-btn-save" onclick="_guardarNuevaAsegModal()">Guardar aseguradora</button>
      </div>
    </div>`;
  m.addEventListener('click', e => { if (e.target === m) m.remove(); });
  document.body.appendChild(m);

  // Agregar primer contacto vacío
  window._nasegContactoIdx = 0;
  window._nasegAgregarContacto = function() {
    const wrap = document.getElementById('naseg-contactos-wrap');
    if (!wrap) return;
    const idx = window._nasegContactoIdx++;
    const div = document.createElement('div');
    div.id = `naseg-contacto-${idx}`;
    div.style.cssText = 'display:grid;grid-template-columns:1fr 1fr 1fr auto;gap:7px;align-items:end;background:var(--gris-bg);border-radius:7px;padding:8px 10px';
    div.innerHTML = `
      <div class="field" style="margin:0"><label style="font-size:10px">Nombre</label><input placeholder="Carlos López" style="font-size:13px"></div>
      <div class="field" style="margin:0"><label style="font-size:10px">Teléfono</label><input placeholder="3001234567" style="font-size:13px"></div>
      <div class="field" style="margin:0"><label style="font-size:10px">Correo</label><input placeholder="carlos@seg.com" style="font-size:13px"></div>
      <button class="btn btn-ghost btn-xs" style="color:var(--rojo);flex-shrink:0;margin-bottom:0" onclick="document.getElementById('naseg-contacto-${idx}').remove()" title="Quitar">
        <svg width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M18 6L6 18M6 6l12 12"/></svg>
      </button>`;
    wrap.appendChild(div);
  };
  window._nasegAgregarContacto();

  window._guardarNuevaAsegModal = async function() {
    const nombre = document.getElementById('naseg-nombre')?.value.trim();
    const errEl  = document.getElementById('naseg-error');
    if (!nombre) { errEl.textContent = 'El nombre es obligatorio.'; errEl.style.display = 'block'; return; }
    errEl.style.display = 'none';
    const btn = document.getElementById('naseg-btn-save');
    if (btn) { btn.disabled = true; btn.textContent = 'Guardando...'; }

    // Recoger contactos
    const contactos = [];
    document.querySelectorAll('#naseg-contactos-wrap > div').forEach(div => {
      const inputs = div.querySelectorAll('input');
      const n = inputs[0]?.value.trim();
      const t = inputs[1]?.value.trim();
      const c = inputs[2]?.value.trim();
      if (n || t || c) contactos.push({ nombre: n, telefono: t, correo: c });
    });

    const body = {
      nombre,
      activo: true,
      nit:       document.getElementById('naseg-nit')?.value.trim() || null,
      telefono:  document.getElementById('naseg-tel')?.value.trim() || null,
      correo:    document.getElementById('naseg-mail')?.value.trim() || null,
      direccion: document.getElementById('naseg-dir')?.value.trim() || null,
      valor_hora: parseFloat(document.getElementById('naseg-hora')?.value) || null,
      contactos: contactos.length ? JSON.stringify(contactos) : null,
    };

    try {
      try {
        await api('/aseguradoras', 'POST', body, { Prefer:'return=minimal' });
      } catch (e1) {
        // Reintento sin columnas que podrían no existir aún en la BD (ej. nit)
        const { nit, ...bodySinNit } = body;
        await api('/aseguradoras', 'POST', bodySinNit, { Prefer:'return=minimal' });
      }
      toast('Aseguradora creada ✓');
      document.getElementById('modal-nueva-aseg').remove();
      await recargarListasNuevaOrden();
      if (typeof onSaved === 'function') onSaved();
    } catch(e) {
      errEl.textContent = 'Error: ' + e.message;
      errEl.style.display = 'block';
      if (btn) { btn.disabled = false; btn.textContent = 'Guardar aseguradora'; }
    }
  };

  setTimeout(() => document.getElementById('naseg-nombre')?.focus(), 80);
}

async function agregarNuevaFlotNueva() {
  const nombre = prompt('Nombre de la nueva flotilla:')?.trim();
  if (!nombre) return;
  try {
    await api('/flotillas', 'POST', { nombre, activo: true }, { Prefer:'return=minimal' });
    toast('Flotilla agregada ✓');
    await recargarListasNuevaOrden();
  } catch(e) { toast('Error: '+e.message,'err'); }
}

async function recargarListasNuevaOrden() {
  const [aseg, flot, mecs] = await Promise.all([
    api('/aseguradoras?activo=eq.true&order=nombre.asc').catch(e=>{ console.error('[NuevaOrden.recargarListas.aseguradoras]', e); return []; }) || [],
    api('/flotillas?activo=eq.true&order=nombre.asc').catch(e=>{ console.error('[NuevaOrden.recargarListas.flotillas]', e); return []; }) || [],
    api('/mecanicos?activo=eq.true&order=nombre.asc&select=id,nombre,rol').catch(e=>{ console.error('[NuevaOrden.recargarListas.mecanicos]', e); return []; }) || []
  ]);
  const selA = document.getElementById('n-aseguradora-sel');
  const selF = document.getElementById('n-flotilla-sel');
  if (selA) selA.innerHTML = '<option value="">— Seleccionar —</option>' +
    aseg.map(a=>`<option value="${escapeHtml(a.nombre)}">${escapeHtml(a.nombre)}</option>`).join('');
  if (selF) selF.innerHTML = '<option value="">— Seleccionar —</option>' +
    flot.map(f=>`<option value="${escapeHtml(f.nombre)}">${escapeHtml(f.nombre)}</option>`).join('');

  // Asesor de servicio: operarios que atienden (excluye pantalla taller / repuestos).
  const selAsesor = document.getElementById('n-asesor');
  if (selAsesor) {
    const asesores = mecs.filter(m => !ROLES_EXCLUIR.includes(m.rol));
    selAsesor.innerHTML = '<option value="">— Seleccionar —</option>' +
      asesores.map(m => `<option value="${m.id}">${escapeHtml(m.nombre)}</option>`).join('');
    // Prefill con el usuario actual si es uno de los asesores válidos.
    if (sesion?.id && asesores.some(m => Number(m.id) === Number(sesion.id))) selAsesor.value = sesion.id;
  }
}

// Normaliza un teléfono a formato WhatsApp (solo dígitos con indicativo país).
// Colombia: celular de 10 dígitos -> se antepone 57.
function _waNumero(raw) {
  if (!raw) return '';
  let d = String(raw).replace(/\D/g, '').replace(/^00/, '');
  if (!d) return '';
  if (d.length === 10) return '57' + d;        // celular CO sin indicativo
  if (d.startsWith('57') && d.length >= 12) return d; // ya trae 57
  return d;                                     // otro país / ya con indicativo
}

// ── Mensaje de WhatsApp "listo para entrega" (editable por el usuario) ──
const _WA_ENTREGA_DEFAULT = 'Hola {nombre}, le saluda {taller}. Su {vehiculo} de placa {placa} ya está LISTO para entrega. Puede pasar a recogerlo en nuestro taller. ¡Gracias por confiar en nosotros! 🚗';
function _waEntregaTemplate() {
  try { return localStorage.getItem('wa_entrega_msg') || _WA_ENTREGA_DEFAULT; } catch (e) { return _WA_ENTREGA_DEFAULT; }
}
function _waEntregaMsg(o) {
  const taller  = (typeof _cotPdfConfig === 'function' && _cotPdfConfig().nombre) || 'Freimanautos';
  const veh     = [o.marca, o.linea].filter(Boolean).join(' ') || 'vehículo';
  const nombre  = (o.propietario || '').trim().split(' ')[0] || '';
  return _waEntregaTemplate()
    .replace(/\{nombre\}/g, nombre)
    .replace(/\{taller\}/g, taller)
    .replace(/\{vehiculo\}/g, veh)
    .replace(/\{placa\}/g, o.placa || '');
}
// Editor del mensaje de WhatsApp
function editarMensajeEntrega() {
  const prev = document.getElementById('wa-msg-modal'); if (prev) prev.remove();
  const ov = document.createElement('div');
  ov.id = 'wa-msg-modal';
  ov.style.cssText = 'position:fixed;inset:0;z-index:10001;background:rgba(0,0,0,.45);display:flex;align-items:center;justify-content:center;padding:18px';
  ov.innerHTML = `
    <div style="background:#fff;border-radius:14px;max-width:460px;width:100%;padding:20px;box-shadow:0 10px 40px rgba(0,0,0,.25);font-family:'DM Sans',sans-serif">
      <div style="font-size:16px;font-weight:800;color:var(--azul);margin-bottom:4px">Mensaje de WhatsApp al cliente</div>
      <div style="font-size:12px;color:var(--gris-mid);margin-bottom:12px">Se envía cuando el vehículo está listo para entrega.</div>
      <textarea id="wa-msg-text" rows="6" style="width:100%;border:1px solid var(--gris-borde);border-radius:8px;padding:10px;font-size:13px;font-family:inherit;resize:vertical">${escapeHtml(_waEntregaTemplate())}</textarea>
      <div style="font-size:11px;color:var(--gris-mid);margin-top:8px;line-height:1.6">
        Etiquetas que puedes usar (se reemplazan solas):<br>
        <code>{nombre}</code> · <code>{vehiculo}</code> · <code>{placa}</code> · <code>{taller}</code>
      </div>
      <div style="display:flex;gap:8px;margin-top:16px;justify-content:flex-end">
        <button class="btn btn-ghost btn-sm" onclick="document.getElementById('wa-msg-modal').remove()">Cancelar</button>
        <button class="btn btn-ghost btn-sm" onclick="localStorage.removeItem('wa_entrega_msg');document.getElementById('wa-msg-text').value=_waEntregaTemplate()">Restaurar</button>
        <button class="btn btn-primary btn-sm" onclick="_guardarMensajeEntrega()">Guardar</button>
      </div>
    </div>`;
  ov.addEventListener('click', e => { if (e.target === ov) ov.remove(); });
  document.body.appendChild(ov);
}
function _guardarMensajeEntrega() {
  const v = document.getElementById('wa-msg-text')?.value.trim();
  if (v) { try { localStorage.setItem('wa_entrega_msg', v); } catch (e) {} }
  document.getElementById('wa-msg-modal')?.remove();
  toast('Mensaje guardado ✓');
}

// Abre WhatsApp con el mensaje "listo para entrega", marca la orden como
// avisada (para activar el agendamiento de la cita) y refresca el detalle.
// (No envía solo: el usuario da "Enviar" — gratis, sin API de WhatsApp Business.)
async function avisarClienteWhatsapp(ordenId) {
  try {
    const arr = await api(`/ordenes?id=eq.${ordenId}&select=placa,marca,linea,propietario,telefono`).catch(() => []);
    const o = arr && arr[0];
    if (!o) { toast('No se encontró la orden', 'err'); return; }
    const tel = _waNumero(o.telefono);
    if (!tel) { toast('El cliente no tiene celular registrado en la orden', 'err'); return; }
    window.open(`https://wa.me/${tel}?text=${encodeURIComponent(_waEntregaMsg(o))}`, '_blank');
    try { await api(`/ordenes?id=eq.${ordenId}`, 'PATCH', { entrega_avisada_en: new Date().toISOString() }); } catch (e) {}
    abrirOrden(ordenId); // refrescar para mostrar el agendamiento de la cita
  } catch (e) { toast('Error: ' + e.message, 'err'); }
}

// Información de la cita: texto de cuenta regresiva + si está vencida.
function _citaInfo(citaISO) {
  if (!citaISO) return null;
  const t = new Date(citaISO).getTime();
  const diff = t - Date.now();
  const min = Math.round(Math.abs(diff) / 60000);
  const fmt = m => m < 60 ? `${m} min` : `${Math.floor(m / 60)}h ${m % 60}m`;
  const cuando = new Date(citaISO).toLocaleString('es-CO', { weekday: 'short', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: true });
  if (diff > 60000)  return { vencida: false, texto: `Recoge en ${fmt(min)}`, cuando, diffMs: diff };
  if (diff > -60000) return { vencida: true,  texto: 'Cliente debería estar llegando', cuando, diffMs: diff };
  return { vencida: true, texto: `Cita vencida hace ${fmt(min)}`, cuando, diffMs: diff };
}

// Bloque "listo para entrega" del detalle: avisar + agendar cita + cuenta regresiva.
function _bloqueEntrega(orden) {
  const tel = orden.telefono ? _waNumero(orden.telefono) : '';
  const avisado = !!orden.entrega_avisada_en;
  const ci = _citaInfo(orden.cita_entrega);
  let h = `<div style="font-size:11px;color:var(--verde);font-weight:600;margin-bottom:8px;text-align:center">✓ Calidad aprobada — listo para entrega</div>`;
  // Botón avisar (o reenviar) + editar mensaje
  h += `<div style="display:flex;gap:6px;margin-bottom:6px">
    <button class="btn" style="flex:1;background:#25D366;border-color:#25D366;color:#fff" onclick="avisarClienteWhatsapp(${orden.id})">📲 ${avisado ? 'Reenviar' : 'Avisar al cliente'} (WhatsApp)</button>
    <button class="btn btn-ghost btn-sm" title="Editar mensaje" onclick="editarMensajeEntrega()">✏️</button>
  </div>`;
  if (avisado) {
    h += `<div style="font-size:11px;color:var(--gris-mid);margin-bottom:8px">✓ Cliente avisado el ${formatTS(orden.entrega_avisada_en)}</div>`;
    // Agendar / re-agendar cita
    const val = orden.cita_entrega ? _toLocalInput(orden.cita_entrega) : '';
    h += `<div style="background:#F8FAFC;border:1px solid var(--gris-borde);border-radius:8px;padding:10px;margin-bottom:6px">
      <label style="font-size:11px;font-weight:700;color:var(--gris-mid);display:block;margin-bottom:5px">¿Cuándo recoge el cliente?</label>
      <div style="display:flex;gap:6px">
        <input type="datetime-local" id="cita-input-${orden.id}" value="${val}" style="flex:1;font-size:12px;padding:6px 8px;border:1px solid var(--gris-borde);border-radius:6px">
        <button class="btn btn-primary btn-sm" onclick="guardarCitaEntrega(${orden.id})">Guardar</button>
      </div>`;
    if (ci) {
      const col = ci.vencida ? '#DC2626' : '#0369A1';
      const bg  = ci.vencida ? '#FEF2F2' : '#EFF6FF';
      h += `<div style="margin-top:8px;background:${bg};border-radius:6px;padding:8px;text-align:center">
        <div style="font-size:13px;font-weight:800;color:${col}">${ci.vencida ? '⏰ ' : '🚗 '}${ci.texto}</div>
        <div style="font-size:11px;color:var(--gris-mid);margin-top:2px">Cita: ${ci.cuando}</div>
      </div>`;
    }
    h += `</div>`;
    // Llamar cliente
    if (tel) h += `<a href="tel:+${tel}" class="btn btn-ghost btn-sm" style="width:100%;margin-bottom:6px;text-align:center;display:block">📞 Llamar al cliente</a>`;
  }
  return h;
}
function _toLocalInput(iso) {
  const d = new Date(iso);
  const p = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}
async function guardarCitaEntrega(ordenId) {
  const inp = document.getElementById('cita-input-' + ordenId);
  const val = inp && inp.value;
  if (!val) { toast('Selecciona fecha y hora', 'err'); return; }
  try {
    await api(`/ordenes?id=eq.${ordenId}`, 'PATCH', { cita_entrega: new Date(val).toISOString() });
    document.querySelectorAll(`.cita-popup[data-cita-id="${ordenId}"]`).forEach(p => p.remove());
    toast('Cita de recogida guardada ✓');
    abrirOrden(ordenId);
  } catch (e) { toast('Error: ' + e.message, 'err'); }
}

// ══════════════════════════════════════════════════════════════
// CIERRE DE ORDEN: preliquidación enviada obligatoria + PIN
// ══════════════════════════════════════════════════════════════

// Envía la preliquidación al cliente por WhatsApp y la marca como enviada
// (requisito para poder cerrar la orden).
async function enviarPreliquidacionCliente(ordenId) {
  try {
    const arr = await api(`/ordenes?id=eq.${ordenId}&select=placa,marca,linea,propietario,telefono`).catch(() => []);
    const o = arr && arr[0];
    if (!o) { toast('No se encontró la orden', 'err'); return; }
    const tel = _waNumero(o.telefono);
    if (!tel) { toast('El cliente no tiene celular registrado en la orden', 'err'); return; }
    const taller = (typeof _cotPdfConfig === 'function' && _cotPdfConfig().nombre) || 'Freimanautos';
    const nombre = (o.propietario || '').trim().split(' ')[0] || '';
    const veh    = [o.marca, o.linea].filter(Boolean).join(' ') || 'vehículo';
    const saludo = nombre ? `Hola ${nombre}, ` : 'Hola, ';
    const msg = `${saludo}le saluda ${taller}. Le compartimos la preliquidación de su ${veh} de placa ${o.placa} con el detalle de los trabajos y valores. Quedamos atentos a cualquier inquietud antes de la entrega. ¡Gracias! 📄`;
    window.open(`https://wa.me/${tel}?text=${encodeURIComponent(msg)}`, '_blank');
    await api(`/ordenes?id=eq.${ordenId}`, 'PATCH', { preliquidacion_enviada_en: new Date().toISOString() });
    toast('Preliquidación marcada como enviada ✓');
    abrirOrden(ordenId);
  } catch (e) { toast('Error: ' + e.message, 'err'); }
}

// Bloque del detalle: enviar preliquidación + cerrar con PIN.
function _bloquePreliqCierre(orden) {
  const enviada = !!orden.preliquidacion_enviada_en;
  let h = `<div style="background:#F8FAFC;border:1px solid var(--gris-borde);border-radius:8px;padding:10px;margin:8px 0">
    <div style="font-size:11px;font-weight:700;color:var(--gris-mid);margin-bottom:6px">Preliquidación al cliente</div>
    <div style="display:flex;gap:6px;margin-bottom:6px">
      <button class="btn btn-ghost btn-sm" style="flex:1" onclick="generarPreliquidacion(${orden.id},false)">📋 Sin precios</button>
      <button class="btn btn-ghost btn-sm" style="flex:1" onclick="generarPreliquidacion(${orden.id},true)">💰 Con precios</button>
    </div>
    <button class="btn btn-sm" style="width:100%;background:#25D366;border-color:#25D366;color:#fff" onclick="enviarPreliquidacionCliente(${orden.id})">📲 ${enviada ? 'Reenviar' : 'Enviar'} preliquidación (WhatsApp)</button>`;
  h += enviada
    ? `<div style="font-size:11px;color:var(--verde);font-weight:600;margin-top:6px">✓ Preliquidación enviada el ${formatTS(orden.preliquidacion_enviada_en)}</div>`
    : `<div style="font-size:11px;color:#B45309;margin-top:6px">⚠ Debes enviar la preliquidación al cliente antes de cerrar la orden.</div>`;
  h += `</div>`;
  // Botón cerrar (bloqueado hasta enviar la preliquidación) — requiere PIN
  h += enviada
    ? `<button class="btn btn-success" style="width:100%" onclick="intentarCerrarOrden(${orden.id})">🔒 Cerrar orden (con PIN)</button>`
    : `<button class="btn" style="width:100%;opacity:.45;cursor:not-allowed" disabled>🔒 Cerrar orden (con PIN)</button>`;
  h += `<div style="text-align:center;margin-top:4px"><button class="btn btn-ghost btn-sm" style="font-size:10px;color:var(--gris-mid)" onclick="configurarPinCierre()">⚙ Configurar PIN de cierre</button></div>`;
  return h;
}

// Verifica preliquidación enviada + abre el modal de PIN para cerrar.
async function intentarCerrarOrden(ordenId) {
  let o = (ordenActual && ordenActual.id === ordenId) ? ordenActual : null;
  if (!o) o = await api(`/ordenes?id=eq.${ordenId}`).then(r => r && r[0]).catch(() => null);
  if (!o) { toast('Orden no encontrada', 'err'); return; }
  if (!o.preliquidacion_enviada_en) { toast('Primero envía la preliquidación al cliente', 'err'); return; }
  pedirPin(() => cambiarEstado('Entregada'), 'Cerrar orden', 'Ingresa el PIN del jefe / gerente para cerrar.');
}

// Archivar orden (eliminación reversible) — requiere PIN.
function archivarOrden(ordenId) {
  pedirPin(async () => {
    try {
      await api(`/ordenes?id=eq.${ordenId}`, 'PATCH', { estado: 'Archivada' });
      toast('Orden archivada ✓');
      if (typeof navJefe === 'function') navJefe('ordenes');
    } catch (e) { toast('Error: ' + e.message, 'err'); }
  }, 'Archivar orden', 'Se ocultará de las listas (reversible). Ingresa el PIN.');
}

// Historial del vehículo: todas las visitas (órdenes) de una placa, con fechas
// y qué se le hizo. Incluye las archivadas/entregadas.
async function verHistorialVehiculo(placa) {
  if (!placa) return;
  try {
    const ords = await api(`/ordenes?placa=eq.${encodeURIComponent(placa)}&order=creado_en.desc&select=id,numero_ot,estado,ingreso_en,creado_en,entregada_en,marca,linea`).catch(() => []) || [];
    if (!ords.length) { toast('Sin historial para esta placa'); return; }
    const ids = ords.map(o => o.id).join(',');
    const etapas = await api(`/etapas?orden_id=in.(${ids})&select=orden_id,servicio,valor`).catch(() => []) || [];
    const porOrden = {};
    etapas.forEach(e => { (porOrden[e.orden_id] = porOrden[e.orden_id] || []).push(e); });
    const srvNom = { latoneria: 'Latonería', pintura: 'Pintura', mecanica: 'Mecánica', adicionales: 'Adicionales' };
    const filas = ords.map(o => {
      const ini  = o.ingreso_en || o.creado_en;
      const fin  = o.entregada_en;
      const dias = ini ? Math.max(0, Math.round(((fin ? new Date(fin) : new Date()) - new Date(ini)) / 86400000)) : null;
      const ets  = porOrden[o.id] || [];
      const srvs = [...new Set(ets.map(e => srvNom[e.servicio] || e.servicio).filter(Boolean))];
      const valor = ets.reduce((s, e) => s + (e.valor || 0), 0);
      return `<div style="border:1px solid var(--gris-borde);border-radius:8px;padding:10px 12px;margin-bottom:8px;cursor:pointer" onclick="document.getElementById('hist-veh-modal')?.remove();abrirOrden(${o.id})">
        <div style="display:flex;justify-content:space-between;align-items:center;gap:8px">
          <span style="font-weight:700;font-family:'DM Mono',monospace">${otDe(o)}</span>
          <span style="font-size:11px;color:var(--gris-mid)">${formatFecha(ini)}${fin ? ` → ${formatFecha(fin)}` : ''}</span>
        </div>
        <div style="font-size:12px;color:var(--gris-mid);margin-top:4px">${o.estado || '—'}${dias != null ? ` · ${dias} día(s)` : ''}${valor > 0 ? ` · ${formatCOP(valor)}` : ''}</div>
        ${srvs.length ? `<div style="margin-top:5px">${srvs.map(s => `<span style="background:#EEF2FF;color:#3730A3;border-radius:5px;padding:1px 7px;margin-right:4px;font-size:11px">${escapeHtml(s)}</span>`).join('')}</div>` : ''}
      </div>`;
    }).join('');
    const veh = [ords[0].marca, ords[0].linea].filter(Boolean).join(' ');
    document.getElementById('hist-veh-modal')?.remove();
    const ov = document.createElement('div');
    ov.id = 'hist-veh-modal';
    ov.style.cssText = 'position:fixed;inset:0;z-index:10002;background:rgba(0,0,0,.5);display:flex;align-items:center;justify-content:center;padding:18px';
    ov.innerHTML = `
      <div style="background:#fff;border-radius:14px;max-width:480px;width:100%;max-height:85vh;display:flex;flex-direction:column;font-family:'DM Sans',sans-serif;box-shadow:0 10px 40px rgba(0,0,0,.3)">
        <div style="padding:16px 18px;border-bottom:1px solid var(--gris-borde);display:flex;justify-content:space-between;align-items:center">
          <div>
            <div style="font-size:16px;font-weight:800;color:var(--azul)">Historial · ${escapeHtml(placa)}</div>
            <div style="font-size:12px;color:var(--gris-mid)">${escapeHtml(veh || '')}${veh ? ' · ' : ''}${ords.length} visita(s)</div>
          </div>
          <button onclick="document.getElementById('hist-veh-modal').remove()" style="background:none;border:none;font-size:22px;cursor:pointer;color:var(--gris-mid);line-height:1">×</button>
        </div>
        <div style="padding:14px 18px;overflow-y:auto">${filas}</div>
      </div>`;
    ov.addEventListener('click', e => { if (e.target === ov) ov.remove(); });
    document.body.appendChild(ov);
  } catch (e) { toast('Error cargando historial: ' + e.message, 'err'); }
}

// Eliminar PERMANENTEMENTE una orden archivada (con PIN + confirmación).
// Borra primero los registros hijos para evitar conflictos de llaves foráneas.
function eliminarOrdenPermanente(ordenId) {
  pedirPin(async () => {
    if (!confirm('¿ELIMINAR PERMANENTEMENTE esta orden y todos sus datos (etapas, fotos, repuestos)?\n\nEsta acción NO se puede deshacer.')) return;
    try {
      // Repuestos: borrar hijos de cada solicitud primero
      const sols = await api(`/solicitudes_repuesto?orden_id=eq.${ordenId}&select=id`).catch(() => []) || [];
      if (sols.length) {
        const ids = sols.map(s => s.id).join(',');
        await api(`/cotizaciones_repuesto?solicitud_id=in.(${ids})`, 'DELETE').catch(() => {});
        await api(`/solicitud_items?solicitud_id=in.(${ids})`, 'DELETE').catch(() => {});
      }
      await api(`/solicitudes_repuesto?orden_id=eq.${ordenId}`, 'DELETE').catch(() => {});
      // Hijos directos de la orden
      await api(`/aprobaciones_etapa?orden_id=eq.${ordenId}`, 'DELETE').catch(() => {});
      await api(`/fotos_etapas?orden_id=eq.${ordenId}`, 'DELETE').catch(() => {});
      await api(`/fotos_ingreso?orden_id=eq.${ordenId}`, 'DELETE').catch(() => {});
      await api(`/novedades?orden_id=eq.${ordenId}`, 'DELETE').catch(() => {});
      await api(`/etapas?orden_id=eq.${ordenId}`, 'DELETE').catch(() => {});
      // Cotizaciones del cliente: desligar (conservar el histórico)
      await api(`/cotizaciones?orden_id=eq.${ordenId}`, 'PATCH', { orden_id: null }).catch(() => {});
      // Finalmente, la orden
      await api(`/ordenes?id=eq.${ordenId}`, 'DELETE');
      toast('Orden eliminada permanentemente ✓');
      if (typeof navJefe === 'function') navJefe('ordenes');
      else cargarOrdenes();
    } catch (e) { toast('Error eliminando: ' + e.message, 'err'); }
  }, 'Eliminar orden', 'ELIMINACIÓN PERMANENTE. Ingresa el PIN para confirmar.');
}

async function _getPinCierre() {
  try {
    const r = await api(`/config_app?clave=eq.pin_cierre&select=valor`).catch(() => []);
    return (r && r[0] && r[0].valor) ? String(r[0].valor) : null;
  } catch (e) { return null; }
}
async function _setPinCierre(pin) {
  await api(`/config_app`, 'POST', { clave: 'pin_cierre', valor: String(pin) }, { Prefer: 'resolution=merge-duplicates' });
}

// PIN reutilizable: verifica el PIN y, si es correcto, ejecuta onOk().
let _pinCallback = null;
async function pedirPin(onOk, titulo, subtitulo) {
  const pin = await _getPinCierre();
  if (!pin) { toast('Primero configura el PIN'); configurarPinCierre(); return; }
  _pinCallback = onOk;
  document.getElementById('pin-cierre-modal')?.remove();
  const ov = document.createElement('div');
  ov.id = 'pin-cierre-modal';
  ov.style.cssText = 'position:fixed;inset:0;z-index:10002;background:rgba(0,0,0,.5);display:flex;align-items:center;justify-content:center;padding:18px';
  ov.innerHTML = `
    <div style="background:#fff;border-radius:14px;max-width:340px;width:100%;padding:22px;text-align:center;font-family:'DM Sans',sans-serif;box-shadow:0 10px 40px rgba(0,0,0,.3)">
      <div style="font-size:34px">🔒</div>
      <div style="font-size:16px;font-weight:800;color:var(--azul);margin:6px 0 2px">${titulo || 'Confirmar con PIN'}</div>
      <div style="font-size:12px;color:var(--gris-mid);margin-bottom:14px">${subtitulo || 'Ingresa el PIN del jefe de taller / gerente.'}</div>
      <input id="pin-cierre-input" type="password" inputmode="numeric" maxlength="8" autocomplete="off"
        style="width:100%;text-align:center;font-size:22px;letter-spacing:6px;padding:10px;border:1px solid var(--gris-borde);border-radius:8px;font-family:'DM Mono',monospace">
      <div id="pin-cierre-err" style="font-size:12px;color:#DC2626;height:16px;margin-top:6px"></div>
      <div style="display:flex;gap:8px;margin-top:8px">
        <button class="btn btn-ghost btn-sm" style="flex:1" onclick="document.getElementById('pin-cierre-modal').remove()">Cancelar</button>
        <button class="btn btn-primary btn-sm" style="flex:1" onclick="_confirmarPin()">Confirmar</button>
      </div>
    </div>`;
  ov.addEventListener('click', e => { if (e.target === ov) ov.remove(); });
  document.body.appendChild(ov);
  const inp = document.getElementById('pin-cierre-input');
  setTimeout(() => inp?.focus(), 50);
  inp?.addEventListener('keydown', e => { if (e.key === 'Enter') _confirmarPin(); });
}
async function _confirmarPin() {
  const inp = document.getElementById('pin-cierre-input');
  const err = document.getElementById('pin-cierre-err');
  const val = (inp && inp.value || '').trim();
  const pin = await _getPinCierre();
  if (val && pin && val === pin) {
    document.getElementById('pin-cierre-modal')?.remove();
    const cb = _pinCallback; _pinCallback = null;
    if (typeof cb === 'function') await cb();
  } else {
    if (err) err.textContent = 'PIN incorrecto';
    if (inp) { inp.value = ''; inp.focus(); }
  }
}

// Configurar / cambiar el PIN (requiere el PIN actual si ya existe).
async function configurarPinCierre() {
  const actual = await _getPinCierre();
  document.getElementById('pin-config-modal')?.remove();
  const ov = document.createElement('div');
  ov.id = 'pin-config-modal';
  ov.style.cssText = 'position:fixed;inset:0;z-index:10003;background:rgba(0,0,0,.5);display:flex;align-items:center;justify-content:center;padding:18px';
  ov.innerHTML = `
    <div style="background:#fff;border-radius:14px;max-width:360px;width:100%;padding:22px;font-family:'DM Sans',sans-serif;box-shadow:0 10px 40px rgba(0,0,0,.3)">
      <div style="font-size:16px;font-weight:800;color:var(--azul);margin-bottom:2px">${actual ? 'Cambiar' : 'Configurar'} PIN de cierre</div>
      <div style="font-size:12px;color:var(--gris-mid);margin-bottom:14px">Solo el jefe de taller y el gerente deben conocerlo.</div>
      ${actual ? `<input id="pin-cfg-actual" type="password" inputmode="numeric" maxlength="8" placeholder="PIN actual" style="width:100%;padding:9px;border:1px solid var(--gris-borde);border-radius:8px;font-family:'DM Mono',monospace;margin-bottom:8px">` : ''}
      <input id="pin-cfg-nuevo" type="password" inputmode="numeric" maxlength="8" placeholder="Nuevo PIN (4 a 8 dígitos)" style="width:100%;padding:9px;border:1px solid var(--gris-borde);border-radius:8px;font-family:'DM Mono',monospace">
      <div id="pin-cfg-err" style="font-size:12px;color:#DC2626;height:16px;margin-top:6px"></div>
      <div style="display:flex;gap:8px;margin-top:8px;justify-content:flex-end">
        <button class="btn btn-ghost btn-sm" onclick="document.getElementById('pin-config-modal').remove()">Cancelar</button>
        <button class="btn btn-primary btn-sm" onclick="_guardarPinCierre(${actual ? 1 : 0})">Guardar</button>
      </div>
    </div>`;
  ov.addEventListener('click', e => { if (e.target === ov) ov.remove(); });
  document.body.appendChild(ov);
}
async function _guardarPinCierre(requiereActual) {
  const err = document.getElementById('pin-cfg-err');
  const setErr = m => { if (err) err.textContent = m; };
  if (requiereActual) {
    const act = (document.getElementById('pin-cfg-actual')?.value || '').trim();
    const cur = await _getPinCierre();
    if (act !== cur) { setErr('PIN actual incorrecto'); return; }
  }
  const nuevo = (document.getElementById('pin-cfg-nuevo')?.value || '').trim();
  if (!/^\d{4,8}$/.test(nuevo)) { setErr('El PIN debe tener de 4 a 8 dígitos'); return; }
  try {
    await _setPinCierre(nuevo);
    document.getElementById('pin-config-modal')?.remove();
    toast('PIN de cierre guardado ✓');
  } catch (e) { setErr('Error guardando: ' + e.message); }
}

async function crearOrden() {
  const placa = document.getElementById('n-placa')?.value.trim().toUpperCase();
  if (!placa) { toast('La placa es obligatoria', 'err'); document.getElementById('n-placa')?.focus(); return; }

  // Tipo de cliente OBLIGATORIO
  const tipoClienteVal = document.getElementById('n-tipo-cliente')?.value;
  if (!tipoClienteVal) {
    const errEl = document.getElementById('n-tipo-cliente-error');
    if (errEl) errEl.style.display = 'block';
    document.getElementById('tipo-cliente-grid')?.scrollIntoView({ behavior:'smooth', block:'center' });
    toast('Selecciona el tipo de cliente', 'err');
    return;
  }
  const errElTc = document.getElementById('n-tipo-cliente-error');
  if (errElTc) errElTc.style.display = 'none';

  // KM (opcional si se marcó "Sin odómetro")
  const kmOmitir = document.getElementById('n-km-omitir')?.checked || false;
  const kmVal = document.getElementById('n-km')?.value;
  if (!kmOmitir && (!kmVal || parseInt(kmVal) < 0)) { toast('El kilometraje es obligatorio (o marca "Sin odómetro")', 'err'); document.getElementById('n-km')?.focus(); return; }

  const cedulaCliente = document.getElementById('n-cedula-cliente')?.value.trim() || '';
  const vin = document.getElementById('n-vin')?.value.trim().toUpperCase() || null;
  const correoCliente = document.getElementById('n-correo-cliente')?.value.trim() || null;

  // Validar VIN si fue ingresado
  if (vin && vin.length !== 17) { toast('El VIN debe tener exactamente 17 caracteres', 'err'); return; }
  if (vin && !/^[A-HJ-NPR-Z0-9]{17}$/.test(vin)) { toast('VIN inválido — solo mayúsculas y números (sin I, O, Q)', 'err'); return; }
  if (correoCliente && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correoCliente)) { toast('Correo electrónico inválido', 'err'); return; }

  const invItems = {};
  document.querySelectorAll('.inv-item input[type=checkbox]').forEach(chk => { invItems[chk.value] = chk.checked; });

  let clienteId = null;
  if (cedulaCliente) {
    try {
      let cl = await api(`/clientes?cedula_nit=eq.${cedulaCliente}`);
      if (cl?.length) {
        clienteId = cl[0].id;
      } else {
        const nombre = document.getElementById('n-propietario')?.value || null;
        const telefono = document.getElementById('n-telefono')?.value || null;
        const nuevo = await api('/clientes?select=id', 'POST', { cedula_nit: cedulaCliente, nombre, celular: telefono }, { Prefer: 'return=representation' });
        clienteId = nuevo[0].id;
      }
    } catch(e) { console.warn('Error creando cliente:', e); }
  }

  const body = {
    placa,
    // Número de OT manual (opcional). Si queda vacío, se muestra el automático
    // OT-#### basado en el id de la orden.
    numero_ot: document.getElementById('n-numero-ot')?.value.trim() || null,
    // Campo "aseguradora" = nombre de la organización (aseguradora / flotilla /
    // empresa). El tipo real lo distingue tipo_cliente. Así el vehículo queda
    // ligado a su empresa/flotilla aunque el propietario sea una persona.
    aseguradora: (() => {
      const tipo = document.getElementById('n-tipo-cliente')?.value || '';
      if (tipo === 'aseguradora') return document.getElementById('n-aseguradora-sel')?.value || null;
      if (tipo === 'flotilla')    return document.getElementById('n-flotilla-sel')?.value || null;
      if (tipo === 'empresa')     return document.getElementById('n-empresa-sel')?.value || null;
      return null;
    })(),
    marca: document.getElementById('n-marca')?.value || null,
    linea: document.getElementById('n-linea')?.value || null,
    modelo: document.getElementById('n-modelo')?.value || null,
    color: document.getElementById('n-color')?.value || null,
    propietario: document.getElementById('n-propietario')?.value || null,
    telefono: document.getElementById('n-telefono')?.value || null,
    // Dirección del cliente (Particular usa n-direccion; Aseguradora, naseg-dir).
    direccion: (document.getElementById('n-direccion')?.value.trim()
             || document.getElementById('naseg-dir')?.value.trim() || null),
    tipo_cliente: (() => {
      const persona = document.querySelector('input[name="n-tipo-persona"]:checked')?.value || 'natural';
      if (persona === 'empresa') return 'empresa';
      return document.getElementById('n-tipo-cliente')?.value || null;
    })(),
    nivel_dano: document.getElementById('n-dano')?.value || null,
    kilometraje: kmOmitir ? null : (parseInt(document.getElementById('n-km')?.value) || null),
    fecha_entrega_1: document.getElementById('n-fecha1')?.value || null,
    fecha_entrega_2: document.getElementById('n-fecha2')?.value || null,
    descripcion_general: document.getElementById('n-descripcion-general')?.value.trim() || null,
    tipo_carroceria: document.getElementById('n-tipo-carroceria')?.value || null,
    danos_vehiculo: (() => {
      const d = {};
      document.querySelectorAll('.dano-cb:checked').forEach(cb => {
        const [zona, tipo] = cb.value.split(':');
        if (!d[zona]) d[zona] = [];
        d[zona].push(tipo);
      });
      return Object.keys(d).length ? JSON.stringify(d) : null;
    })(),
    inventario: JSON.stringify({ items: invItems, observaciones: document.getElementById('n-inv-obs')?.value.trim() || null }),
    // Nueva orden = vehículo que ingresa ahora (Activa). Para programar un
    // ingreso futuro se usa "Agendar ingreso" en el Calendario.
    estado: 'Activa',
    ingreso_en: new Date().toISOString(),
    cliente_id: clienteId,
    asesor_id: Number(document.getElementById('n-asesor')?.value) || null,
    vin: vin || null,
    correo_cliente: correoCliente || null
  };

  try {
    const completando = _ordenCompletandoId;
    let ordenId;
    if (completando) {
      // Completar una orden agendada (Programada): actualizar con todos los
      // datos y activarla (el body ya trae estado:'Activa' e ingreso_en:ahora).
      await api(`/ordenes?id=eq.${completando}`, 'PATCH', body);
      ordenId = completando;
      _ordenCompletandoId = null;
    } else {
      const res = await api('/ordenes?select=id', 'POST', body, { Prefer: 'return=representation' });
      ordenId = res[0].id;
    }

    if (fotosIngresoPendientes.length) {
      const prog = document.getElementById('prog-ingreso');
      if (prog) prog.textContent = `Subiendo fotos 0/${fotosIngresoPendientes.length}...`;
      let sub = 0;
      for (const file of fotosIngresoPendientes) {
        try {
          const ext = file.name.split('.').pop();
          const path = `${ordenId}/ingreso/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
          const url = await storageUpload(file, path);
          await api('/fotos_ingreso', 'POST', { orden_id: ordenId, url, nombre: file.name }, { Prefer: 'return=minimal' });
          sub++;
          if (prog) prog.textContent = `Subiendo fotos ${sub}/${fotosIngresoPendientes.length}...`;
        } catch(e) { console.error(e); }
      }
      if (prog) prog.textContent = '';
    }

    resetNuevaOrden();
    fotosIngresoPendientes = [];
    modalOrdenId = ordenId;
    toast(completando ? '✓ Vehículo recibido — orden activada' : 'Orden creada ✓');
    abrirModalServicios();
  } catch(e) { toast('Error: ' + e.message, 'err'); }
}

// ============================================================
// MODAL SERVICIOS
// ============================================================
function abrirModalServicios() {
  srvSeleccionados = [];
  modalPaso = 1;
  document.querySelectorAll('.srv-card-select').forEach(c => c.classList.remove('selected'));
  const errorDiv = document.getElementById('srv-error');
  if (errorDiv) errorDiv.style.display = 'none';
  const titulo = document.getElementById('modal-srv-titulo');
  if (titulo) titulo.textContent = 'Paso 1 — Servicios';
  const backBtn = document.getElementById('btn-back');
  if (backBtn) backBtn.style.display = 'none';
  const nextBtn = document.getElementById('btn-next');
  if (nextBtn) nextBtn.textContent = 'Continuar →';
  const paso1 = document.getElementById('paso-1');
  const paso2 = document.getElementById('paso-2');
  if (paso1) paso1.classList.add('active');
  if (paso2) paso2.classList.remove('active');
  const modal = document.getElementById('modal-servicios');
  if (modal) modal.classList.add('show');
}

function cerrarModalServicios() {
  const modal = document.getElementById('modal-servicios');
  if (modal) modal.classList.remove('show');
  if (modalOrdenId) { 
    cargarOrdenes(); 
    abrirOrden(modalOrdenId); 
    modalOrdenId = null; 
  }
}

function toggleServicio(srv) {
  const card = document.getElementById('srv-' + srv);
  if (card) card.classList.toggle('selected');
  if (srvSeleccionados.includes(srv)) {
    srvSeleccionados = srvSeleccionados.filter(s => s !== srv);
  } else {
    srvSeleccionados.push(srv);
  }
}

function modalNext() {
  if (modalPaso === 1) {
    if (!srvSeleccionados.length) { 
      const error = document.getElementById('srv-error');
      if (error) error.style.display = 'block';
      return; 
    }
    const error = document.getElementById('srv-error');
    if (error) error.style.display = 'none';
    buildChecklist('checklist-nuevo', srvSeleccionados, []);
    const paso1 = document.getElementById('paso-1');
    const paso2 = document.getElementById('paso-2');
    if (paso1) paso1.classList.remove('active');
    if (paso2) paso2.classList.add('active');
    const backBtn = document.getElementById('btn-back');
    if (backBtn) backBtn.style.display = '';
    const nextBtn = document.getElementById('btn-next');
    if (nextBtn) nextBtn.textContent = 'Guardar etapas ✓';
    modalPaso = 2;
  } else {
    guardarEtapasNueva();
  }
}

function modalBack() {
  const paso1 = document.getElementById('paso-1');
  const paso2 = document.getElementById('paso-2');
  if (paso1) paso1.classList.add('active');
  if (paso2) paso2.classList.remove('active');
  const backBtn = document.getElementById('btn-back');
  if (backBtn) backBtn.style.display = 'none';
  const nextBtn = document.getElementById('btn-next');
  if (nextBtn) nextBtn.textContent = 'Continuar →';
  const titulo = document.getElementById('modal-srv-titulo');
  if (titulo) titulo.textContent = 'Paso 1 — Servicios';
  modalPaso = 1;
}

const ROLES_EXCLUIR = ['taller', 'repuestos', 'Asesor Previsora'];

function buildChecklist(containerId, servicios, existentes) {
  const container = document.getElementById(containerId);
  if (!container) return;
  const mecElegibles = mecanicos.filter(m => !ROLES_EXCLUIR.includes(m.rol));
  container.innerHTML = servicios.map(srvKey => {
    const srv = CATALOGO[srvKey];
    if (!srv) return '';
    const items = srv.etapas.map(et => {
      const ex = existentes.find(e => e.etapa_key === et.key);
      const iniciada = !!ex?.inicio;
      const checked = !!ex;
      const dis = iniciada ? 'disabled' : '';
      const mecSelected = ex?.mecanico_id ?? '';
      const esExterno = !!srv.externo;
      const extraHtml = '';
      const mecsFiltrados = mecElegibles;
      // Autoselección: "Armado" replica su técnico en Desarmado/Reparación;
      // "Alistador" lo replica en "Brillador".
      const autoChange = et.esArmado
        ? `onchange="_autoFillLatoneria(this.value,'${containerId}')"`
        : et.esAlistador
        ? `onchange="_autoFillPinturaBrillador(this.value,'${containerId}')"`
        : '';
      let mecHtml;
      if (iniciada) {
        mecHtml = `<div style="font-size:11px;color:var(--gris-mid);margin-top:4px">Técnico ya asignado</div>`;
      } else if (esExterno) {
        // Mecánica / Adicionales: el técnico suele ser externo (no está en la
        // base de datos), por eso se escribe el nombre a mano.
        mecHtml = `<div class="mec-select-wrap" id="mec-${et.key}" style="margin-top:6px;display:${checked ? 'block' : 'none'}">
          <input type="text" id="tec-txt-${et.key}" placeholder="Nombre del técnico (externo) *" value="${ex?.tercero ? escapeHtml(ex.tercero) : ''}" style="font-size:13px;width:100%;padding:7px 9px;border:1.5px solid var(--gris-borde);border-radius:5px;box-sizing:border-box">
        </div>`;
      } else {
        mecHtml = `<div class="mec-select-wrap" id="mec-${et.key}" style="margin-top:6px;display:${checked ? 'block' : 'none'}">
          <select id="mec-sel-${et.key}" style="font-size:13px" ${autoChange}>
            <option value="">— Asignar técnico * —</option>
            ${mecsFiltrados.map(m => `<option value="${m.id}" ${m.id == mecSelected ? ' selected' : ''}>${escapeHtml(m.nombre)}</option>`).join('')}
          </select>
        </div>`;
      }
      // Al seleccionar una etapa solo se asigna el técnico. Las horas y el valor
      // de la mano de obra se ingresan después, en el detalle de cada etapa.
      const camposHtml = '';
      return `<div class="check-item">
        <input type="checkbox" id="chk-${et.key}" value="${et.key}" ${checked ? 'checked' : ''} ${dis}
          onchange="onChkChange('${et.key}', this.checked)">
        <div style="flex:1">
          <div class="check-item-label">${et.nombre}${iniciada ? ' <span style="font-size:10px;color:var(--gris-mid)">(ya iniciada)</span>' : ''}</div>
          ${extraHtml}${mecHtml}${camposHtml}
        </div>
      </div>`;
    }).join('');
    const cls = srv.clase;
    return `<div class="etapas-grupo">
      <span class="etapas-grupo-label badge-${cls}" style="background:var(--${cls === 'latoneria' ? 'rojo' : cls === 'pintura' ? 'amarillo' : cls === 'mecanica' ? 'azul' : 'verde'}-bg);color:${cls === 'latoneria' ? '#991B1B' : cls === 'pintura' ? 'var(--amarillo)' : cls === 'mecanica' ? 'var(--azul)' : 'var(--verde)'}">${srv.nombre}</span>
      ${items}
    </div>`;
  }).join('');
}

function onChkChange(key, checked) {
  const extra = document.getElementById('extra-' + key);
  if (extra) extra.classList.toggle('show', checked);
  const mecDiv = document.getElementById('mec-' + key);
  if (mecDiv) {
    mecDiv.classList.toggle('show', checked);
    mecDiv.style.display = checked ? 'block' : 'none';
  }
  const camposDiv = document.getElementById('campos-' + key);
  if (camposDiv) camposDiv.style.display = checked ? 'block' : 'none';

  // Latonería: al marcar "Armado" se marcan también Desarmado y Reparación
  // (son el mismo flujo y normalmente el mismo técnico).
  if (key === 'lat_armado' && checked) {
    ['lat_desarmado', 'lat_reparacion'].forEach(k => {
      const c = document.getElementById('chk-' + k);
      if (c && !c.checked && !c.disabled) { c.checked = true; onChkChange(k, true); }
    });
  }
  // Pintura: al marcar "Alistador" se marca también "Brillador".
  if (key === 'pin_alistador' && checked) {
    const c = document.getElementById('chk-pin_brillador');
    if (c && !c.checked && !c.disabled) { c.checked = true; onChkChange('pin_brillador', true); }
  }
}

// Latonería: asignar técnico a "Armado" lo replica en Desarmado y Reparación,
// y marca las tres etapas si no estaban marcadas.
function _autoFillLatoneria(mecId, containerId) {
  ['lat_desarmado', 'lat_reparacion', 'lat_armado'].forEach(k => {
    const chk = document.getElementById('chk-' + k);
    if (chk && !chk.checked && !chk.disabled) { chk.checked = true; onChkChange(k, true); }
    const sel = document.getElementById('mec-sel-' + k);
    if (sel && !sel.disabled && mecId) sel.value = mecId;
  });
}

// Pintura: asignar técnico a "Alistador" lo replica en "Brillador".
function _autoFillPinturaBrillador(mecId, containerId) {
  const chk = document.getElementById('chk-pin_brillador');
  if (chk && !chk.checked && !chk.disabled) { chk.checked = true; onChkChange('pin_brillador', true); }
  const sel = document.getElementById('mec-sel-pin_brillador');
  if (sel && !sel.disabled && mecId) sel.value = mecId;
}

function recogerChecklist(containerId) {
  const result = [];
  document.querySelectorAll(`#${containerId} input[type=checkbox]:checked:not(:disabled)`).forEach(chk => {
    const key = chk.value;
    let srvKey = null, etDef = null;
    for (const [sk, sv] of Object.entries(CATALOGO)) {
      const et = sv.etapas.find(e => e.key === key);
      if (et) { srvKey = sk; etDef = et; break; }
    }
    if (!etDef) return;
    const tecTxt   = document.getElementById(`tec-txt-${key}`);
    const mecSel   = document.getElementById(`mec-sel-${key}`);
    result.push({
      key, servicio: srvKey, nombre: etDef.nombre,
      tercero:     tecTxt?.value?.trim() || null,
      mecanico_id: mecSel?.value ? parseInt(mecSel.value) : null
    });
  });
  return result;
}

// Guarda el nombre de los técnicos externos (Mecánica/Adicionales) en su propia
// tabla, ligados a la placa y la orden, para llevar historial. Si la tabla aún
// no existe en la base de datos, falla en silencio sin romper el guardado.
async function _guardarTecnicosExternos(etapas, ordenId, placa) {
  const externos = etapas.filter(et => et.tercero && (et.servicio === 'mecanica' || et.servicio === 'adicionales'));
  for (const et of externos) {
    try {
      await api('/tecnicos_externos', 'POST', {
        nombre: et.tercero, servicio: et.servicio, etapa: et.nombre,
        placa: placa || null, orden_id: ordenId || null
      }, { Prefer: 'return=minimal' });
    } catch (e) { console.warn('No se pudo registrar técnico externo:', e?.message); }
  }
}

async function guardarEtapasNueva() {
  const etapas = recogerChecklist('checklist-nuevo');
  if (!etapas.length) { toast('Selecciona al menos una etapa', 'err'); return; }
  const sinMec = etapas.filter(et => !et.mecanico_id && !et.tercero);
  if (sinMec.length) { toast(`Asigna un mecánico a: ${sinMec.map(e => e.nombre).join(', ')}`, 'err'); return; }
  try {
    for (const et of etapas) {
      const mec = mecanicos.find(m => m.id === et.mecanico_id);
      await api('/etapas', 'POST', {
        orden_id: modalOrdenId, servicio: et.servicio, etapa_key: et.key, etapa: et.nombre,
        tercero: et.tercero || null, mecanico_id: et.mecanico_id || null, tecnico: mec?.nombre || null
      }, { Prefer: 'return=minimal' });
    }
    toast('Etapas guardadas ✓');
    document.getElementById('modal-servicios')?.classList.remove('show');

    const ordenData = await api(`/ordenes?id=eq.${modalOrdenId}`).catch(() => []);
    if (ordenData?.[0]) {
      const ord = ordenData[0];
      await _guardarTecnicosExternos(etapas, ord.id, ord.placa);
      const primerasPorSrv = {};
      etapas.forEach(et => { if (!primerasPorSrv[et.servicio]) primerasPorSrv[et.servicio] = et; });
      for (const et of Object.values(primerasPorSrv)) {
        if (!et.mecanico_id) continue;
        fetch(N8N_WEBHOOK, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            evento: 'tecnico_asignado',
            orden: { id: ord.id, placa: ord.placa, propietario: ord.propietario, marca: ord.marca, linea: ord.linea, aseguradora: ord.aseguradora },
            siguiente_etapa: { id: null, nombre: et.nombre, servicio: et.servicio, mecanico_id: et.mecanico_id, tecnico: mecanicos.find(m => m.id === et.mecanico_id)?.nombre || null },
            todas_completadas: false,
            link: `${window.location.origin}${window.location.pathname}`
          }) 
        }).catch(() => {});
      }
      const fotosIng = await api(`/fotos_ingreso?orden_id=eq.${modalOrdenId}&order=creado_en.asc&limit=1`).catch(() => []) || [];
      fetch(N8N_WEBHOOK, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          evento: 'orden_creada', 
          orden: { id: ord.id, placa: ord.placa, propietario: ord.propietario, marca: ord.marca, linea: ord.linea, modelo: ord.modelo, color: ord.color, tipo_cliente: ord.tipo_cliente, aseguradora: ord.aseguradora, nivel_dano: ord.nivel_dano, fecha_entrega_1: ord.fecha_entrega_1 }, 
          etapas: etapas.map(et => ({ servicio: et.servicio, etapa: et.nombre, tecnico: mecanicos.find(m => m.id === et.mecanico_id)?.nombre || et.tercero || 'Sin asignar' })), 
          foto_url: fotosIng[0]?.url || null, 
          link: `${window.location.origin}${window.location.pathname}` 
        }) 
      }).catch(() => {});
    }
    cargarOrdenes(); 
    if (modalOrdenId) abrirOrden(modalOrdenId); 
    modalOrdenId = null;
  } catch(e) { toast('Error: ' + e.message, 'err'); }
}

// ============================================================
// MODAL AGREGAR ETAPAS
// ============================================================
async function abrirModalAgregar() {
  if (!ordenActual) return;
  const [existentes] = await Promise.all([
    api(`/etapas?orden_id=eq.${ordenActual.id}&order=creado_en.asc`).catch(() => []),
    cargarMecanicos(),
  ]);
  buildChecklist('checklist-agregar', Object.keys(CATALOGO), existentes || []);
  const modal = document.getElementById('modal-agregar');
  if (modal) modal.classList.add('show');
}

function cerrarModalAgregar() { 
  const modal = document.getElementById('modal-agregar');
  if (modal) modal.classList.remove('show'); 
}

async function confirmarAgregarEtapas() {
  const etapas = recogerChecklist('checklist-agregar');
  if (!etapas.length) { toast('Selecciona al menos una etapa', 'err'); return; }
  const sinMec = etapas.filter(et => !et.mecanico_id && !et.tercero);
  if (sinMec.length) { toast(`Asigna un mecánico a: ${sinMec.map(e => e.nombre).join(', ')}`, 'err'); return; }
  try {
    for (const et of etapas) {
      const mec = mecanicos.find(m => m.id === et.mecanico_id);
      await api('/etapas', 'POST', { 
        orden_id: ordenActual.id, servicio: et.servicio, etapa_key: et.key, etapa: et.nombre, 
        tercero: et.tercero || null, mecanico_id: et.mecanico_id || null, tecnico: mec?.nombre || null
      }, { Prefer: 'return=minimal' });
    }
    await _guardarTecnicosExternos(etapas, ordenActual.id, ordenActual.placa);
    toast('Etapas agregadas ✓');
    cerrarModalAgregar();
    if (ordenActual) abrirOrden(ordenActual.id);
  } catch(e) { toast('Error: ' + e.message, 'err'); }
}

// ============================================================
// FOTOS
// ============================================================

// Comprime una imagen usando Canvas antes de subirla.
// maxW: ancho máximo en px (alto se escala proporcionalmente)
// quality: 0-1 para JPEG
