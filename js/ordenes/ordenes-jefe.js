// ═══════════════════════════════════════════════════════════
// ÓRDENES — VISTA JEFE, NAV, CALENDARIO
// ═══════════════════════════════════════════════════════════
function comprimirImagen(file, maxW = 1280, quality = 0.82) {
  return new Promise((resolve, reject) => {
    // Si no es imagen o es muy pequeña, devolver sin cambios
    if (!file.type.startsWith('image/')) { resolve(file); return; }
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      let { width, height } = img;
      // Solo redimensionar si supera el máximo
      if (width > maxW) {
        height = Math.round((height * maxW) / width);
        width = maxW;
      }
      const canvas = document.createElement('canvas');
      canvas.width  = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, width, height);
      canvas.toBlob(blob => {
        if (!blob) { resolve(file); return; }
        // Crear un nuevo File con el blob comprimido
        const compressed = new File([blob], file.name.replace(/\.[^.]+$/, '.jpg'), { type: 'image/jpeg', lastModified: Date.now() });
        resolve(compressed);
      }, 'image/jpeg', quality);
    };
    img.onerror = () => { URL.revokeObjectURL(url); resolve(file); };
    img.src = url;
  });
}

async function subirFotos(input, nombre, eid, k) {
  const files = Array.from(input.files);
  if (!files.length) return;
  const prog = document.getElementById(`prog-${k}`);
  let sub = 0;
  for (const file of files) {
    try {
      if (prog) prog.textContent = `Comprimiendo ${sub + 1}/${files.length}...`;
      const fileComprimido = await comprimirImagen(file);
      const path = `${ordenActual.id}/etapas/${eid}_${Date.now()}.jpg`;
      const url = await storageUpload(fileComprimido, path);
      await api('/fotos_etapas', 'POST', { etapa_id: eid, orden_id: ordenActual.id, etapa_nombre: nombre, url, nombre: file.name }, { Prefer: 'return=minimal' });
      sub++;
      if (prog) prog.textContent = `Subiendo ${sub}/${files.length}...`;
    } catch(e) { toast(`Error: ${file.name}`, 'err'); }
  }
  if (prog) prog.textContent = '';
  input.value = '';
  toast(`${sub} foto(s) subida(s) ✓`);
  if (ordenActual) abrirOrden(ordenActual.id);
}

async function eliminarFoto(fotoId, url) {
  if (!confirm('¿Eliminar esta foto?')) return;
  try {
    await api(`/fotos_etapas?id=eq.${fotoId}`, 'DELETE');
    const path = url.split(`/object/public/${BUCKET}/`)[1];
    if (path) await fetch(`${SUPABASE_URL}/storage/v1/object/${BUCKET}/${path}`, { method: 'DELETE', headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${_getBearer()}` } });
    toast('Foto eliminada ✓');
    if (ordenActual) abrirOrden(ordenActual.id);
  } catch(e) { toast('Error: ' + e.message, 'err'); }
}

// ============================================================
// NOVEDADES
// ============================================================
async function guardarNovedad(eid) {
  const motivo = document.getElementById(`nmot-${eid}`)?.value?.trim();
  if (!motivo) { toast('El motivo es obligatorio', 'err'); return; }
  const tipo        = document.getElementById(`ntype-${eid}`)?.value;
  const responsable = document.getElementById(`nresp-${eid}`)?.value;
  const valorRaw    = parseFloat(document.getElementById(`nvalor-${eid}`)?.value);
  const valor       = valorRaw > 0 ? valorRaw : null;

  try {
    // Si tipo es Detenido, pausar la etapa primero
    if (tipo === 'Detenido') {
      await api(`/etapas?id=eq.${eid}`, 'PATCH', {
        pausado: true, pausa_inicio: new Date().toISOString()
      });
    }

    const payload = { orden_id: ordenActual.id, etapa_id: eid, tipo, responsable, motivo, desde: new Date().toISOString() };
    if (valor !== null) payload.valor_adicional = valor;

    await api('/novedades', 'POST', payload, { Prefer: 'return=minimal' });
    toast(tipo === 'Detenido' ? 'Etapa pausada y novedad registrada ✓' : 'Novedad registrada ✓');

    const input = document.getElementById(`nmot-${eid}`);
    if (input) input.value = '';
    const vinput = document.getElementById(`nvalor-${eid}`);
    if (vinput) vinput.value = '';
    if (ordenActual) abrirOrden(ordenActual.id);
  } catch(e) { toast('Error: ' + e.message, 'err'); }
}

// ============================================================
// APROBACIÓN DE CALIDAD
// ============================================================
async function abrirModalAprobacion(eid, nombre) {
  aprobEtapaId = eid;
  const titulo = document.getElementById('modal-aprob-titulo');
  if (titulo) titulo.textContent = `Calidad — ${nombre}`;
  const obs = document.getElementById('aprob-obs');
  if (obs) obs.value = '';
  document.querySelectorAll('input[name="aprob-estado"]').forEach(r => r.checked = false);
  const hist = await api(`/aprobaciones_etapa?etapa_id=eq.${eid}&order=creado_en.desc`).catch(() => []) || [];
  const histDiv = document.getElementById('aprob-historial');
  const histList = document.getElementById('aprob-historial-lista');
  if (hist.length && histList) {
    histList.innerHTML = hist.map(h => `
      <div class="aprob-box ${h.estado === 'rechazado' ? 'rechazado' : ''}" style="margin-bottom:8px">
        <div class="aprob-box-top">
          <span class="aprob-box-estado">${h.estado === 'aprobado' ? '✓ Aprobado' : '✗ Rechazado'}</span>
          <span class="aprob-box-fecha">${formatTS(h.creado_en)}</span>
        </div>
        <div style="font-size:12px;color:var(--gris-mid)">Por: ${escapeHtml(h.registrado_por)}</div>
        ${h.observacion ? `<div style="font-size:12px;margin-top:4px">${escapeHtml(h.observacion)}</div>` : ''}
      </div>`).join('');
    if (histDiv) histDiv.style.display = 'block';
  } else if (histDiv) {
    histDiv.style.display = 'none';
  }
  const modal = document.getElementById('modal-aprobacion');
  if (modal) modal.classList.add('show');
}

function cerrarModalAprobacion() { 
  const modal = document.getElementById('modal-aprobacion');
  if (modal) modal.classList.remove('show'); 
  aprobEtapaId = null; 
}

async function guardarAprobacion() {
  const estado = document.querySelector('input[name="aprob-estado"]:checked')?.value;
  const obs = document.getElementById('aprob-obs')?.value.trim() || '';
  if (!estado) { toast('Selecciona Aprobado o Rechazado', 'err'); return; }
  try {
    await api('/aprobaciones_etapa', 'POST', {
      etapa_id: aprobEtapaId, orden_id: ordenActual.id, estado,
      registrado_por: sesion?.nombre || 'Jefe', observacion: obs || null
    });
    toast(`Etapa ${estado} ✓`);
    cerrarModalAprobacion();

    // Si rechazó: notificar al mecánico que debe corregir
    if (estado === 'rechazado') {
      const etapaRech = await api(`/etapas?id=eq.${aprobEtapaId}&select=id,etapa,servicio,mecanico_id,tecnico`).then(r=>r?.[0]).catch(()=>null);
      if (etapaRech?.mecanico_id) {
        const mecRech = await api(`/mecanicos?id=eq.${etapaRech.mecanico_id}&select=nombre,telegram_chat_id`).then(r=>r?.[0]).catch(()=>null);
        fetch(N8N_WEBHOOK, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            evento: 'etapa_rechazada',
            telegram_chat_id: mecRech?.telegram_chat_id || null,
            orden: { id: ordenActual.id, placa: ordenActual.placa, propietario: ordenActual.propietario, marca: ordenActual.marca, linea: ordenActual.linea },
            etapa: { id: aprobEtapaId, nombre, servicio: etapaRech.servicio, tecnico: etapaRech.tecnico, mecanico_id: etapaRech.mecanico_id },
            observacion: document.getElementById('aprob-obs')?.value.trim() || '',
            rechazado_por: sesion?.nombre || 'Jefe',
            link: `${window.location.origin}${window.location.pathname}`
          })
        }).catch(() => {});
      }
    }

    // Si aprobó, verificar si TODAS las etapas de la orden quedaron aprobadas
    if (estado === 'aprobado') {
      const [etapas, aprobaciones] = await Promise.all([
        api(`/etapas?orden_id=eq.${ordenActual.id}&select=id`).catch(() => []),
        api(`/aprobaciones_etapa?orden_id=eq.${ordenActual.id}&order=creado_en.desc&select=etapa_id,estado`).catch(() => [])
      ]);
      // Tomar el estado más reciente por etapa
      const ultimaPorEtapa = {};
      aprobaciones.forEach(a => { if (!ultimaPorEtapa[a.etapa_id]) ultimaPorEtapa[a.etapa_id] = a.estado; });
      const todasAprobadas = etapas.length > 0 && etapas.every(e => ultimaPorEtapa[e.id] === 'aprobado');
      if (todasAprobadas) {
        fetch(N8N_WEBHOOK, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            evento: 'orden_calidad_aprobada',
            orden: { id: ordenActual.id, placa: ordenActual.placa, propietario: ordenActual.propietario, marca: ordenActual.marca, linea: ordenActual.linea },
            aprobado_por: sesion?.nombre || 'Jefe',
            link: `${window.location.origin}${window.location.pathname}`
          })
        }).catch(() => {});
      }
    }

    if (ordenActual) abrirOrden(ordenActual.id);
  } catch(e) { toast('Error: ' + e.message, 'err'); }
}

// ============================================================
// CAPACIDAD (helper)
// ============================================================
function _refrescarCapacidad() {
  const ok = [true, true, true];
  Promise.all([
    api('/ordenes?estado=eq.Activa&pulmon=eq.false&select=id').catch(() => { ok[0] = false; return []; }),
    api('/ordenes?pulmon=eq.true&pulmon_tipo=eq.interno&select=id').catch(() => { ok[1] = false; return []; }),
    api('/ordenes?pulmon=eq.true&pulmon_tipo=eq.externo&select=id').catch(() => { ok[2] = false; return []; })
  ]).then(([activas, pulmonInterno, pulmonExterno]) => {
    if (ok[0] && ok[1] && ok[2]) actualizarCapacidad(activas.length, pulmonInterno.length, pulmonExterno.length);
  });
}

function _setPulmonUI(activo, tipo) {
  const card  = document.getElementById('pulmon-card');
  const badge = document.getElementById('d-pulmon-badge');
  const btn   = document.getElementById('btn-pulmon');
  if (card)  card.classList.toggle('inactivo', !activo);
  if (badge) {
    if (activo) {
      badge.innerHTML = `En pulmón${tipo ? ` · <strong>${tipo.charAt(0).toUpperCase()+tipo.slice(1)}</strong>` : ''} desde ${formatFecha(ordenActual.pulmon_desde)}`;
      badge.style.color = 'var(--amarillo)';
    } else if (ordenActual.pulmon_fin && ordenActual.pulmon_desde) {
      const tiempo = _calcPulmonTiempo(ordenActual.pulmon_desde, ordenActual.pulmon_fin);
      badge.innerHTML = `<span style="color:var(--verde,#10B981)">✓ Salió de pulmón</span> · estuvo <strong>${tiempo}</strong>${tipo ? ` (${tipo})` : ''}`;
      badge.style.color = 'var(--gris-mid)';
    } else {
      badge.textContent = 'Sin pulmón activo';
      badge.style.color = 'var(--gris-mid)';
    }
  }
  if (btn) btn.textContent = activo ? 'Sacar de pulmón' : 'Activar Pulmón';
}

// ============================================================
// PULMÓN
// ============================================================
function _calcPulmonTiempo(desde, fin) {
  const min = Math.round((new Date(fin) - new Date(desde)) / 60000);
  if (min < 1) return '< 1m';
  const d = Math.floor(min / 1440);
  const h = Math.floor((min % 1440) / 60);
  const m = min % 60;
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function togglePulmon() {
  if (ordenActual.pulmon) {
    _desactivarPulmon();
  } else {
    document.getElementById('modal-pulmon-tipo')?.classList.add('show');
  }
}

function cerrarModalPulmonTipo() {
  document.getElementById('modal-pulmon-tipo')?.classList.remove('show');
}

async function activarPulmonCon(tipo) {
  cerrarModalPulmonTipo();
  const ahora = new Date().toISOString();
  const patch = { pulmon: true, pulmon_desde: ahora, pulmon_tipo: tipo };
  try {
    await api(`/ordenes?id=eq.${ordenActual.id}`, 'PATCH', patch);
    ordenActual.pulmon = true;
    ordenActual.pulmon_desde = ahora;
    ordenActual.pulmon_tipo = tipo;
    _setPulmonUI(true, tipo);
    toast(`Orden en pulmón ${tipo.charAt(0).toUpperCase()+tipo.slice(1)} ✓`);
    _refrescarCapacidad();
  } catch(e) { toast('Error: ' + e.message, 'err'); }
}

async function _desactivarPulmon() {
  const ahora = new Date().toISOString();
  // Guardamos pulmon_fin y NO borramos pulmon_desde — queda el historial
  const patch = { pulmon: false, pulmon_fin: ahora };
  try {
    await api(`/ordenes?id=eq.${ordenActual.id}`, 'PATCH', patch);
    ordenActual.pulmon     = false;
    ordenActual.pulmon_fin = ahora;
    // pulmon_desde y pulmon_tipo se conservan para mostrar historial
    _setPulmonUI(false, ordenActual.pulmon_tipo || '');
    toast('Pulmón desactivado ✓');
    _refrescarCapacidad();
    cargarOrdenesPulmon(); // refrescar lista pulmón para que desaparezca
  } catch(e) { toast('Error: ' + e.message, 'err'); }
}


// ============================================================
// ESTADO ORDEN (JEFE)
// ============================================================
async function cambiarEstado(v) {
  try {
    const patch = { estado: v };
    if (v === 'Entregada') patch.entregada_en = new Date().toISOString();
    await api(`/ordenes?id=eq.${ordenActual.id}`, 'PATCH', patch);
    ordenActual.estado = v;
    toast(`Estado: ${v} ✓`);
    if (filtroEstado === null) await cargarOrdenesPulmon();
    else await cargarOrdenes();
    if (ordenActual) abrirOrden(ordenActual.id);
  } catch(e) { toast('Error: ' + e.message, 'err'); }
}

// Precio de venta al cliente (solo aseguradoras). Lo fija el jefe/gerente y es
// el total que se imprime en la orden de trabajo de aseguradora (sin detalle).
async function guardarPrecioVentaCliente(ordenId) {
  const el = document.getElementById(`precio-venta-${ordenId}`);
  const val = (el && el.value !== '') ? parseFloat(el.value) : null;
  try {
    await api(`/ordenes?id=eq.${ordenId}`, 'PATCH', { precio_venta_cliente: val });
    if (ordenActual && ordenActual.id === ordenId) ordenActual.precio_venta_cliente = val;
    toast('Precio de venta guardado ✓');
    abrirOrden(ordenId);
  } catch (e) { toast('Error: ' + e.message, 'err'); }
}

async function recibirVehiculo(ordenId) {
  // Abre el formulario completo PRE-LLENADO con lo agendado, para completar
  // kilometraje, inventario, daños, etc. Al guardar, activa la orden (PATCH).
  let orden;
  try {
    orden = (await api(`/ordenes?id=eq.${ordenId}&limit=1`).catch(() => []))?.[0];
  } catch(e) { toast('Error: ' + e.message, 'err'); return; }
  if (!orden) { toast('Orden no encontrada', 'err'); return; }

  navJefe('nueva'); // abre y resetea el formulario (resetNuevaOrden limpia el modo)

  setTimeout(() => {
    _ordenCompletandoId = ordenId; // activar modo "completar" DESPUÉS del reset

    const set = (id, val) => { const el = document.getElementById(id); if (el && val != null && val !== '') el.value = val; };
    set('n-placa', orden.placa);
    set('n-numero-ot', orden.numero_ot);
    set('n-marca', orden.marca);
    set('n-linea', orden.linea);
    set('n-modelo', orden.modelo);
    set('n-color', orden.color);
    set('n-vin', orden.vin);
    set('n-propietario', orden.propietario);
    set('n-telefono', orden.telefono);
    set('n-cedula-cliente', orden.cedula_cliente);
    set('n-correo-cliente', orden.correo_cliente);
    set('n-direccion', orden.direccion);
    if (typeof _mostrarFormVehiculo === 'function') _mostrarFormVehiculo(true); // ya tiene datos → mostrar

    // Tipo de cliente
    const tipo  = orden.tipo_cliente || 'particular';
    const tabId = tipo === 'aseguradora' ? 'tcb-aseguradora'
                : tipo === 'flotilla'    ? 'tcb-flotilla'
                : tipo === 'empresa'     ? 'tcb-empresa'
                : 'tcb-particular';
    const tab = document.getElementById(tabId);
    if (tab && typeof selTipoCliente === 'function') selTipoCliente(tab, tipo);
    if (orden.aseguradora) {
      const selId = tipo === 'aseguradora' ? 'n-aseguradora-sel' : tipo === 'flotilla' ? 'n-flotilla-sel' : tipo === 'empresa' ? 'n-empresa-sel' : null;
      if (selId) setTimeout(() => { const sel = document.getElementById(selId); if (sel) sel.value = orden.aseguradora; }, 250);
    }

    const resultDiv = document.getElementById('placa-resultado');
    if (resultDiv) {
      resultDiv.className = 'placa-resultado encontrado';
      resultDiv.innerHTML = `📥 Completando ingreso de <strong>${escapeHtml(orden.placa || '')}</strong>. Agrega kilometraje, inventario y daños; al guardar se activará la orden.`;
      resultDiv.style.display = 'block';
    }
    toast(`Completa los datos de ${orden.placa} para activar`);
  }, 320);
}

// ============================================================
// MECÁNICOS (cargar lista)
// ============================================================
async function cargarMecanicos() {
  try {
    mecanicos = await api('/mecanicos?activo=eq.true&order=nombre.asc') || [];
  } catch(e) { 
    mecanicos = []; 
  }
}
// ============================================================
// NAVEGACIÓN JEFE
// ============================================================
function montarJefe() {
  const sidebarNav = document.getElementById('sidebar-nav');
  if (sidebarNav) {
    // Estado guardado de grupos abiertos/cerrados
    const _grupAbiertos = JSON.parse(localStorage.getItem('nav_grupos') || '{"operaciones":true,"comercial":true,"registro":false,"informes":false,"aseguradoras":false}');

    const _toggleGrupo = (id) => {
      _grupAbiertos[id] = !_grupAbiertos[id];
      localStorage.setItem('nav_grupos', JSON.stringify(_grupAbiertos));
      const cont = document.getElementById('nav-grupo-' + id);
      const chevron = document.getElementById('nav-chevron-' + id);
      if (cont) {
        clearTimeout(cont._animT);
        if (_grupAbiertos[id]) {
          // Abrir: 0 → altura real (suave), luego liberar a 'none'
          cont.style.display = 'block';
          cont.style.maxHeight = '0px';
          cont.style.opacity = '0';
          void cont.offsetHeight; // forzar reflow
          cont.style.maxHeight = cont.scrollHeight + 'px';
          cont.style.opacity = '1';
          cont._animT = setTimeout(() => { if (_grupAbiertos[id]) cont.style.maxHeight = 'none'; }, 340);
        } else {
          // Cerrar: fijar altura actual → 0
          cont.style.maxHeight = cont.scrollHeight + 'px';
          void cont.offsetHeight; // forzar reflow
          cont.style.maxHeight = '0px';
          cont.style.opacity = '0';
          cont._animT = setTimeout(() => { if (!_grupAbiertos[id]) cont.style.display = 'none'; }, 340);
        }
      }
      if (chevron) chevron.style.transform = _grupAbiertos[id] ? 'rotate(0deg)' : 'rotate(-90deg)';
    };
    window._navToggleGrupo = _toggleGrupo;

    const _grupoHeader = (id, label) => `
      <button onclick="_navToggleGrupo('${id}')" style="width:100%;display:flex;align-items:center;justify-content:space-between;padding:14px 12px 5px;background:none;border:none;cursor:pointer;transition:opacity .15s" onmouseover="this.style.opacity='.75'" onmouseout="this.style.opacity='1'">
        <span class="nav-section-label">${label}</span>
        <svg id="nav-chevron-${id}" width="13" height="13" fill="none" stroke="white" stroke-width="2.5" viewBox="0 0 24 24" style="flex-shrink:0;transition:transform .2s;transform:rotate(${_grupAbiertos[id]?'0':'-90'}deg);opacity:.8"><polyline points="6 9 12 15 18 9"/></svg>
      </button>
      <div id="nav-grupo-${id}" class="nav-grupo-body"${_grupAbiertos[id]?'':' style="display:none"'}>`;

    sidebarNav.innerHTML = `
      ${_grupoHeader('operaciones','Gestión Operativa')}
        <button class="nav-item" id="nav-taller-kpi" onclick="navJefe('taller-kpi')">
          <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>
          <span class="nav-label">Gestión Operativa</span>
        </button>
        <button class="nav-item active" id="nav-ordenes" onclick="navJefe('ordenes')">
          <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/></svg>
          <span class="nav-label">Órdenes</span>
        </button>
        <button class="nav-item" id="nav-nueva" onclick="navJefe('nueva')">
          <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 8v8M8 12h8"/></svg>
          <span class="nav-label">Nueva orden</span>
        </button>
        <button class="nav-item" id="nav-calendario" onclick="navJefe('calendario')">
          <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
          <span class="nav-label">Calendario</span>
        </button>
        <button class="nav-item" id="nav-mecanicos" onclick="navJefe('mecanicos')">
          <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/></svg>
          <span class="nav-label">Operarios</span>
        </button>
      </div>

      ${_grupoHeader('comercial','Comercial')}
        <button class="nav-item" id="nav-cotizaciones" onclick="navJefe('cotizaciones')">
          <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><path d="M14 2v6h6M16 13H8M16 17H8M10 9H8"/></svg>
          <span class="nav-label">Cotizaciones</span>
        </button>
        <button class="nav-item" id="nav-repuestos" onclick="navJefe('repuestos')">
          <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M20 7H4a2 2 0 00-2 2v6a2 2 0 002 2h16a2 2 0 002-2V9a2 2 0 00-2-2z"/><path d="M16 21V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v16"/></svg>
          <span class="nav-label">Repuestos</span>
        </button>
      </div>

      ${_grupoHeader('registro','Registro')}
        <button class="nav-item" id="nav-vehiculos-lista" onclick="navJefe('vehiculos-lista')">
          <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>
          <span class="nav-label">Vehículos ingresados</span>
        </button>
        <button class="nav-item" id="nav-vehiculos" onclick="navJefe('vehiculos')">
          <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M5 17H3a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11a2 2 0 0 1 2 2v3"/><rect x="9" y="11" width="14" height="10" rx="2"/><circle cx="12" cy="21" r="1"/><circle cx="20" cy="21" r="1"/></svg>
          <span class="nav-label">Ingreso de vehículos</span>
        </button>
      </div>

      ${_grupoHeader('informes','Informes')}
        <button class="nav-item" id="nav-metas" onclick="navJefe('metas')">
          <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
          <span class="nav-label">Metas</span>
        </button>
        <button class="nav-item" id="nav-reportes" onclick="navJefe('reportes')">
          <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
          <span class="nav-label">Reportes</span>
        </button>
        <button class="nav-item" id="nav-encuestas" onclick="navJefe('encuestas')">
          <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/></svg>
          <span class="nav-label">Encuestas</span>
        </button>
      </div>

      ${_grupoHeader('aseguradoras','Carteras')}
        <button class="nav-item" id="nav-aseguradoras" onclick="navJefe('aseguradoras')">
          <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
          <span class="nav-label">Aseguradoras</span>
        </button>
        <button class="nav-item" id="nav-cartera-flotillas" onclick="navJefe('cartera-flotillas')">
          <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>
          <span class="nav-label">Flotillas</span>
        </button>
        <button class="nav-item" id="nav-cartera-empresas" onclick="navJefe('cartera-empresas')">
          <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M3 21h18M5 21V7l8-4v18M19 21V11l-6-3"/><path d="M9 9v.01M9 12v.01M9 15v.01M9 18v.01"/></svg>
          <span class="nav-label">Empresas</span>
        </button>
      </div>
    `;
  }

  const bottomNav = document.getElementById('bottom-nav-inner');
  if (bottomNav) {
    bottomNav.innerHTML = `
      <button class="bnav-item" id="bnav-dashboard" onclick="navJefe('dashboard')">
        <svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>
        <span>Taller</span>
      </button>
      <button class="bnav-item active" id="bnav-ordenes" onclick="navJefe('ordenes')">
        <svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/></svg>
        <span>Órdenes</span>
      </button>
      <button class="bnav-item" id="bnav-nueva" onclick="navJefe('nueva')">
        <svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 8v8M8 12h8"/></svg>
        <span>Nueva</span>
      </button>
      <button class="bnav-item" id="bnav-cotizaciones" onclick="navJefe('cotizaciones')">
        <svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><path d="M14 2v6h6M16 13H8M16 17H8M10 9H8"/></svg>
        <span>Cotiz.</span>
      </button>
      <button class="bnav-item" id="bnav-mas" onclick="openSidebar()">
        <svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
        <span>Más</span>
      </button>
    `;
  }

  // Cargar la lista de mecánicos para los selects
  cargarMecanicos().finally(() => {
    // Gestión Operativa SIEMPRE como pantalla principal al entrar (decisión del
    // dueño: tablero de pendientes centrado y visible). No se restaura la última
    // página, para que el jefe/gerente siempre vea primero el estado del taller.
    navJefe('taller-kpi');
  });
  
  // Cargar capacidad al inicio
  _refrescarCapacidad();
  setTimeout(() => { if (typeof actualizarBadgesNav === 'function') actualizarBadgesNav(); }, 1500);
  if (!window._navBadgeInterval) {
    window._navBadgeInterval = setInterval(() => {
      if (typeof actualizarBadgesNav === 'function') actualizarBadgesNav();
    }, 45000);
  }

  // Activar Realtime (pendiente de implementar)
  if (typeof iniciarRealtime === 'function') iniciarRealtime();

  // Sistema de alertas de etapas sin movimiento
  iniciarSistemaAlertas();
}

// ─── Badges de notificación del menú lateral ──────────────
function _navBadgePrevGet() { try { return JSON.parse(localStorage.getItem('nav_badge_prev') || '{}'); } catch (e) { return {}; } }
function _navBadgePrevSet(o) { try { localStorage.setItem('nav_badge_prev', JSON.stringify(o)); } catch (e) {} }
function _navSeenGet() { try { return JSON.parse(localStorage.getItem('nav_badge_seen') || '{}'); } catch (e) { return {}; } }
function _navSeenSet(o) { try { localStorage.setItem('nav_badge_seen', JSON.stringify(o)); } catch (e) {} }

// Crea/actualiza el indicador de un ítem del menú.
// Ilumina (punto + borde + destello) solo si hay pendientes NO atendidos
// (conteo mayor al ya visto). Si ya se atendió la sección, queda en calma.
function _setNavBadge(navId, count) {
  const item = document.getElementById(navId);
  if (!item) return;
  let b = item.querySelector('.nav-badge');
  const n = Number(count) || 0;
  const seenAll = _navSeenGet();
  const seen = seenAll[navId] || 0;
  const esNuevo = n > seen;          // hay algo nuevo sin atender

  if (n > 0) {
    if (!b) { b = document.createElement('span'); b.className = 'nav-badge'; item.appendChild(b); }
    b.style.display = 'inline-block';
    b.title = `${n} pendiente${n === 1 ? '' : 's'}`;
    b.classList.toggle('visto', !esNuevo);
    item.classList.toggle('nav-notif', esNuevo);
  } else {
    if (b) b.style.display = 'none';
    item.classList.remove('nav-notif');
    if (seenAll[navId]) { delete seenAll[navId]; _navSeenSet(seenAll); } // reset al quedar en 0
  }

  // ¿Subió respecto al último refresco y es nuevo? → abrir grupo + destellar
  const prevAll = _navBadgePrevGet();
  const prev = prevAll[navId] || 0;
  if (n > prev && esNuevo) _revealNavItem(navId);
  prevAll[navId] = n;
  _navBadgePrevSet(prevAll);
}

// Marca una sección como atendida: apaga su iluminación (la deja en calma).
function _navMarcarVisto(navId) {
  if (!navId) return;
  const prevAll = _navBadgePrevGet();
  const n = prevAll[navId] || 0;
  const seenAll = _navSeenGet();
  seenAll[navId] = n;
  _navSeenSet(seenAll);
  const item = document.getElementById(navId);
  if (!item) return;
  item.classList.remove('nav-notif', 'nav-flash');
  const b = item.querySelector('.nav-badge');
  if (b) { if (n > 0) b.classList.add('visto'); else b.style.display = 'none'; }
}

// Abre el grupo del ítem (si está colapsado) y destella su ícono.
function _revealNavItem(navId) {
  const item = document.getElementById(navId);
  if (!item) return;
  // Abrir el grupo contenedor si está cerrado
  const groupBody = item.closest('.nav-grupo-body');
  if (groupBody && getComputedStyle(groupBody).display === 'none') {
    const gid = groupBody.id.replace('nav-grupo-', '');
    if (typeof window._navToggleGrupo === 'function') window._navToggleGrupo(gid);
  }
  // Destello del ícono (reinicia la animación si ya estaba corriendo)
  item.classList.remove('nav-flash');
  void item.offsetWidth;
  item.classList.add('nav-flash');
  clearTimeout(item._flashT);
  item._flashT = setTimeout(() => item.classList.remove('nav-flash'), 2800);
}

// Refresca todos los badges del menú (pendientes que requieren atención).
async function actualizarBadgesNav() {
  try {
    const [rep, cot, aseg] = await Promise.all([
      api('/solicitudes_repuesto?estado=eq.pendiente_jefe&select=id').catch(() => []),
      api('/cotizaciones?estado=eq.pendiente&select=id').catch(() => []),
      api('/ordenes?aseguradora=not.is.null&estado_aseguradora=eq.peritaje_pendiente&select=id').catch(() => [])
    ]);
    _setNavBadge('nav-repuestos',    (rep  || []).length);
    _setNavBadge('nav-cotizaciones', (cot  || []).length);
    _setNavBadge('nav-aseguradoras', (aseg || []).length);
  } catch (e) {}
}

function navJefe(pag) {
  // Al entrar a una sección, apagar su iluminación de notificación
  if (typeof _navMarcarVisto === 'function') _navMarcarVisto('nav-' + pag);
  // Actualizar clases active en sidebar y bottom nav
  // Detener polling KPI al salir de esa pantalla
  if (pag !== 'taller-kpi' && window._kpiInterval) { clearInterval(window._kpiInterval); window._kpiInterval = null; }
  const pages = ['ordenes', 'nueva', 'dashboard', 'taller-kpi', 'cotizaciones', 'calendario', 'mecanicos', 'repuestos', 'reportes', 'encuestas', 'flotillas', 'aseguradoras', 'cartera-flotillas', 'cartera-empresas', 'vehiculos', 'vehiculos-lista', 'metas'];
  pages.forEach(p => {
    const navBtn = document.getElementById('nav-' + p);
    const bnavBtn = document.getElementById('bnav-' + p);
    if (navBtn) navBtn.classList.remove('active');
    if (bnavBtn) bnavBtn.classList.remove('active');
  });
  
  const currentNav = document.getElementById('nav-' + pag);
  const currentBnav = document.getElementById('bnav-' + pag);
  if (currentNav) currentNav.classList.add('active');
  if (currentBnav) currentBnav.classList.add('active');

  // Ocultar/mostrar botón de detalle si existe
  const navDetalle = document.getElementById('nav-detalle');
  if (navDetalle && pag !== 'detalle') navDetalle.style.display = 'none';

  // Mostrar la página correspondiente
  let pagId = '';
  let titulo = '';
  
  switch(pag) {
    case 'ordenes':
      pagId = 'pag-ordenes';
      titulo = 'Órdenes';
      break;
    case 'nueva':
      pagId = 'pag-nueva';
      titulo = 'Nueva Orden';
      resetNuevaOrden();
      setTimeout(() => { if (typeof recargarListasNuevaOrden === 'function') recargarListasNuevaOrden(); }, 50);
      break;
    case 'dashboard':
      pagId = 'pag-dashboard';
      titulo = 'Dashboard – Mes actual';
      setTimeout(() => { if (typeof switchDashTab === 'function') switchDashTab('mes'); }, 50);
      break;
    case 'metas':
      pagId = 'pag-dashboard';
      titulo = 'Metas';
      setTimeout(() => { if (typeof switchDashTab === 'function') switchDashTab('metas'); }, 50);
      break;
    case 'cotizaciones':
      pagId = 'pag-cotizaciones';
      titulo = 'Cotizaciones';
      cargarCotizaciones();
      break;
    case 'calendario':
      pagId = 'pag-calendario';
      titulo = 'Calendario de Entregas';
      cargarCalendario();
      break;
    case 'taller-kpi':
      pagId = 'pag-taller-kpi';
      titulo = 'Gestión Operativa';
      if (window._kpiInterval) clearInterval(window._kpiInterval);
      setTimeout(() => { if (typeof cargarKPITaller === 'function') cargarKPITaller(); }, 50);
      window._kpiInterval = setInterval(() => { if (typeof cargarKPITaller === 'function') cargarKPITaller(); }, 30000);
      break;
    case 'mecanicos':
      pagId = 'pag-mecanicos';
      titulo = 'Operarios';
      cargarMecanicosVista();
      break;
    case 'repuestos':
      pagId = 'pag-repuestos-jefe';
      titulo = 'Repuestos';
      setTimeout(() => { if (typeof cargarRepuestosJefe === 'function') cargarRepuestosJefe(); }, 50);
      break;
    case 'reportes':
      pagId = 'pag-reportes';
      titulo = 'Reportes';
      setTimeout(() => { if (typeof montarReportes === 'function') montarReportes(); }, 50);
      break;
    case 'encuestas':
      pagId = 'pag-encuestas';
      titulo = 'Encuestas de satisfacción';
      setTimeout(() => { if (typeof Encuestas !== 'undefined') Encuestas.montar(); }, 50);
      break;
    case 'flotillas':
      pagId = 'pag-flotillas';
      titulo = 'Ingreso Flotilla';
      setTimeout(() => { if (typeof montarFlotillas === 'function') montarFlotillas(); }, 50);
      break;
    case 'aseguradoras':
      pagId = 'pag-aseguradoras';
      titulo = 'Aseguradoras';
      if (typeof resetVistaAseguradoras === 'function') resetVistaAseguradoras();
      setTimeout(() => {
        if (typeof cargarModuloAseguradoras === 'function') cargarModuloAseguradoras();
        else if (typeof montarAseguradoras === 'function') montarAseguradoras();
      }, 50);
      break;
    case 'cartera-flotillas':
      pagId = 'pag-cartera-flotillas';
      titulo = 'Flotillas';
      if (typeof resetVistaCartera === 'function') resetVistaCartera('flotilla');
      setTimeout(() => { if (typeof montarCarteraFlotillas === 'function') montarCarteraFlotillas(); }, 50);
      break;
    case 'cartera-empresas':
      pagId = 'pag-cartera-empresas';
      titulo = 'Empresas';
      if (typeof resetVistaCartera === 'function') resetVistaCartera('empresa');
      setTimeout(() => { if (typeof montarCarteraEmpresas === 'function') montarCarteraEmpresas(); }, 50);
      break;
    case 'vehiculos':
      pagId = 'pag-vehiculos';
      titulo = 'Ingreso de vehículos';
      setTimeout(() => {
        if (typeof montarIngresoVehiculos === 'function') montarIngresoVehiculos();
        else if (typeof montarIngresoParticular === 'function') montarIngresoParticular();
        else if (typeof cargarVehiculos === 'function') cargarVehiculos();
      }, 50);
      break;
    case 'vehiculos-lista':
      pagId = 'pag-vehiculos';
      titulo = 'Vehículos ingresados';
      setTimeout(() => { if (typeof cargarVehiculos === 'function') cargarVehiculos(); }, 50);
      break;
    default:
      pagId = 'pag-ordenes';
      titulo = 'Órdenes';
  }

  mostrarPagina(pagId);

  const titleEl = document.getElementById('topbar-title');
  if (titleEl) titleEl.textContent = titulo;

  const actionsEl = document.getElementById('topbar-actions');
  if (actionsEl) actionsEl.innerHTML = '';

  // Guardar última página para restaurar en F5 (solo durante la sesión)
  const pagsSinGuardar = ['nueva', 'detalle'];
  if (!pagsSinGuardar.includes(pag)) sessionStorage.setItem('ultima_pag_jefe', pag);

  // Si es la página de órdenes, cargar las órdenes
  if (pag === 'ordenes') cargarOrdenes();

  closeSidebar();
}
// ═══════════════════════════════════════════════════════════
// CALENDARIO DE ENTREGAS
// ═══════════════════════════════════════════════════════════
let calMesActual = new Date();
calMesActual.setDate(1);
calMesActual.setHours(0,0,0,0);

async function cargarCalendario() {
  const cont = document.getElementById('pag-calendario');
  if (!cont) return;
  cont.innerHTML = '<div class="loading-state">Cargando...</div>';
  try {
    const ordenes = await api(
      `/ordenes?select=id,placa,marca,linea,propietario,estado,pulmon,fecha_entrega_1,fecha_entrega_2,fecha_programada&or=(estado.eq.Activa,pulmon.eq.true,estado.eq.Programada)&order=fecha_entrega_1.asc`
    ).catch(() => []) || [];
    renderCalendario(cont, ordenes, calMesActual);
  } catch(e) {
    cont.innerHTML = `<div class="empty-state">Error: ${e.message}</div>`;
  }
}

function renderCalendario(cont, ordenes, mesDate) {
  const año  = mesDate.getFullYear();
  const mes  = mesDate.getMonth();
  const hoy  = new Date(); hoy.setHours(0,0,0,0);

  const mesLabel = mesDate.toLocaleDateString('es-CO', { month: 'long', year: 'numeric' });
  const diasMes  = new Date(año, mes + 1, 0).getDate();
  const primerDia = new Date(año, mes, 1).getDay(); // 0=dom
  const offset = (primerDia + 6) % 7; // lunes primero

  // Indexar órdenes por fecha. Las Programadas (agendadas) se ubican por su
  // fecha_programada (día de ingreso); el resto por sus fechas de entrega.
  const porDia = {};
  ordenes.forEach(o => {
    if (o.estado === 'Programada') {
      if (o.fecha_programada) {
        const d = new Date(o.fecha_programada + 'T00:00:00');
        if (d.getFullYear() === año && d.getMonth() === mes) {
          const key = d.getDate();
          (porDia[key] = porDia[key] || []).push({ ...o, esProgramada: true });
        }
      }
      return;
    }
    [o.fecha_entrega_1, o.fecha_entrega_2].filter(Boolean).forEach((f, fi) => {
      const d = new Date(f);
      if (d.getFullYear() === año && d.getMonth() === mes) {
        const key = d.getDate();
        if (!porDia[key]) porDia[key] = [];
        porDia[key].push({ ...o, esFecha2: fi === 1 });
      }
    });
  });

  // Build grid
  const diasSem = ['Lun','Mar','Mié','Jue','Vie','Sáb','Dom'];
  const totalMes = Object.values(porDia).reduce((sum, items) => sum + items.length, 0);
  const headHtml = diasSem.map(d => `<div class="cal-head">${d}</div>`).join('');

  let celdas = '';
  // Celdas vacías antes del primer día
  for (let i = 0; i < offset; i++) celdas += `<div class="cal-cell cal-empty"></div>`;

  for (let d = 1; d <= diasMes; d++) {
    const fecha  = new Date(año, mes, d);
    const esHoy  = fecha.getTime() === hoy.getTime();
    const ords   = porDia[d] || [];
    const pasado = fecha < hoy;

    const ordsHtml = ords.slice(0, 4).map(o => {
      const prog    = o.esProgramada;
      const urgente = !prog && !o.esFecha2 && o.fecha_entrega_1 && new Date(o.fecha_entrega_1) <= hoy;
      const color = prog ? '#7C3AED' : urgente ? '#DC2626' : o.esFecha2 ? '#D97706' : '#2A5298';
      const bg    = prog ? '#F3E8FF' : urgente ? '#FEE2E2' : o.esFecha2 ? '#FEF3C7' : '#EBF2FF';
      return `<div class="cal-orden" style="background:${bg};color:${color};border-left-color:${color}" onclick="abrirOrden(${o.id})">
        <div style="display:flex;align-items:center;justify-content:space-between;gap:6px">
          <span style="font-family:'DM Mono',monospace;font-weight:700;font-size:11px">${escapeHtml(o.placa) || '---'}</span>
          ${prog ? '<span style="font-size:9px;font-weight:800;opacity:0.85">📅</span>' : o.esFecha2 ? '<span style="font-size:9px;font-weight:800;opacity:0.75">F2</span>' : ''}
        </div>
        <div class="cal-orden-meta">${[o.marca,o.linea].filter(Boolean).map(escapeHtml).join(' ') || escapeHtml(o.propietario) || 'Orden activa'}</div>
      </div>`;
    }).join('');
    const masHtml = ords.length > 4
      ? `<div class="cal-mas">+${ords.length-4} mas</div>` : '';

    celdas += `<div class="cal-cell${esHoy?' cal-hoy':''}${pasado&&!esHoy?' cal-pasado':''}${ords.length?' cal-con-ordenes':''}">
      <div class="cal-dia"><span>${d}</span>${ords.length ? `<strong>${ords.length}</strong>` : ''}</div>
      ${ordsHtml}${masHtml}
    </div>`;
  }

  // ── Vista AGENDA (lista por día) — se muestra solo en móvil ──
  let agendaHtml = '';
  for (let d = 1; d <= diasMes; d++) {
    const ords = porDia[d] || [];
    if (!ords.length) continue;
    const fecha = new Date(año, mes, d);
    const esHoy = fecha.getTime() === hoy.getTime();
    const wd    = diasSem[(fecha.getDay() + 6) % 7];
    const filas = ords.map(o => {
      const prog    = o.esProgramada;
      const urgente = !prog && !o.esFecha2 && o.fecha_entrega_1 && new Date(o.fecha_entrega_1) <= hoy;
      const color = prog ? '#7C3AED' : urgente ? '#DC2626' : o.esFecha2 ? '#D97706' : '#2A5298';
      const bg    = prog ? '#F3E8FF' : urgente ? '#FEE2E2' : o.esFecha2 ? '#FEF3C7' : '#EBF2FF';
      const tag   = prog ? '📅 Agendada' : urgente ? 'Vencida' : o.esFecha2 ? 'Entrega 2' : 'Entrega 1';
      return `<div class="cal-ag-orden" style="border-left-color:${color}" onclick="abrirOrden(${o.id})">
        <span class="cal-ag-placa">${escapeHtml(o.placa) || '---'}</span>
        <span class="cal-ag-veh">${[o.marca,o.linea].filter(Boolean).map(escapeHtml).join(' ') || escapeHtml(o.propietario) || 'Orden'}</span>
        <span class="cal-ag-tag" style="background:${bg};color:${color}">${tag}</span>
      </div>`;
    }).join('');
    agendaHtml += `<div class="cal-ag-dia${esHoy ? ' cal-ag-hoy' : ''}">
      <div class="cal-ag-fecha"><span class="n">${d}</span> ${wd}${esHoy ? ' · Hoy' : ''} <span class="c">${ords.length}</span></div>
      <div class="cal-ag-lista">${filas}</div>
    </div>`;
  }
  if (!agendaHtml) agendaHtml = '<div class="empty-state" style="padding:30px 16px"><p>No hay entregas ni ingresos programados este mes.</p></div>';

  cont.innerHTML = `
    <div class="cal-shell">
    <div style="display:flex;justify-content:flex-end;margin-bottom:12px">
      <button class="btn btn-primary btn-sm" onclick="abrirModalAgendar()">
        <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>
        Agendar ingreso
      </button>
    </div>
    <div class="cal-nav">
      <button class="btn btn-ghost btn-sm" onclick="calCambiarMes(-1)">← Anterior</button>
      <div>
        <div class="cal-mes-titulo">${mesLabel.charAt(0).toUpperCase() + mesLabel.slice(1)}</div>
        <div style="font-size:12px;color:var(--gris-mid);text-align:center">${totalMes} entregas programadas</div>
      </div>
      <button class="btn btn-ghost btn-sm" onclick="calCambiarMes(1)">Siguiente →</button>
    </div>
    <div class="cal-leyenda">
      <span class="cal-ley-dot" style="background:#F3E8FF;border:1px solid #7C3AED"></span><span style="font-size:11px;color:var(--gris-mid)">📅 Agendada</span>
      <span class="cal-ley-dot" style="background:#EBF2FF;border:1px solid #2A5298;margin-left:12px"></span><span style="font-size:11px;color:var(--gris-mid)">Entrega 1</span>
      <span class="cal-ley-dot" style="background:#FEF3C7;border:1px solid #D97706;margin-left:12px"></span><span style="font-size:11px;color:var(--gris-mid)">Entrega 2</span>
      <span class="cal-ley-dot" style="background:#FEE2E2;border:1px solid #DC2626;margin-left:12px"></span><span style="font-size:11px;color:var(--gris-mid)">Vencida</span>
    </div>
    <div class="cal-grid">
      ${headHtml}
      ${celdas}
    </div>
    <div class="cal-agenda">${agendaHtml}</div>
    </div>
  `;
}

async function calCambiarMes(delta) {
  calMesActual.setMonth(calMesActual.getMonth() + delta);
  const cont = document.getElementById('pag-calendario');
  if (!cont) return;
  cont.innerHTML = '<div class="loading-state">Cargando...</div>';
  try {
    const ordenes = await api(
      `/ordenes?select=id,placa,marca,linea,propietario,estado,pulmon,fecha_entrega_1,fecha_entrega_2,fecha_programada&or=(estado.eq.Activa,pulmon.eq.true,estado.eq.Programada)`
    ).catch(() => []) || [];
    renderCalendario(cont, ordenes, calMesActual);
  } catch(e) {
    cont.innerHTML = `<div class="empty-state">Error: ${e.message}</div>`;
  }
}

// ═══════════════════════════════════════════════════════════
// AGENDAR INGRESO — registro ligero de un vehículo que llegará
// (crea la orden como Programada; el resto se completa al llegar)
// ═══════════════════════════════════════════════════════════
async function abrirModalAgendar() {
  document.getElementById('modal-agendar')?.remove();
  const [aseg, flot] = await Promise.all([
    api('/aseguradoras?activo=eq.true&order=nombre.asc').catch(() => []) || [],
    api('/flotillas?activo=eq.true&order=nombre.asc').catch(() => []) || []
  ]);
  const hoyStr = (() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; })();

  const ov = document.createElement('div');
  ov.id = 'modal-agendar';
  ov.className = 'modal-overlay show';
  ov.style.display = 'flex';
  ov.addEventListener('click', e => { if (e.target === ov) ov.remove(); });
  ov.innerHTML = `
    <div class="modal" style="max-width:460px">
      <div class="modal-header">
        <h2>Agendar ingreso</h2>
        <button class="modal-close" onclick="document.getElementById('modal-agendar').remove()">✕</button>
      </div>
      <div class="modal-body" style="display:flex;flex-direction:column;gap:13px">
        <div style="font-size:12px;color:var(--gris-mid);line-height:1.5">Registro rápido de un vehículo que ingresará próximamente. Los demás datos (kilometraje, inventario, daños…) se completan cuando llegue al taller.</div>
        <div class="field" style="margin:0"><label>Placa *</label><input id="ag-placa" placeholder="ABC123" style="text-transform:uppercase" oninput="this.value=this.value.toUpperCase()"></div>
        <div class="field" style="margin:0"><label>Fecha programada *</label><input id="ag-fecha" type="date" min="${hoyStr}" value="${hoyStr}"></div>
        <div class="field" style="margin:0"><label>Tipo de cliente</label>
          <select id="ag-tipo" onchange="_agendarToggleTipo(this.value)">
            <option value="particular">Particular</option>
            <option value="aseguradora">Aseguradora</option>
            <option value="flotilla">Flotilla / Empresa</option>
          </select>
        </div>
        <div class="field" id="ag-aseg-wrap" style="margin:0;display:none"><label>Aseguradora</label>
          <select id="ag-aseg"><option value="">— Seleccionar —</option>${aseg.map(a => `<option value="${escapeHtml(a.nombre)}">${escapeHtml(a.nombre)}</option>`).join('')}</select>
        </div>
        <div class="field" id="ag-flot-wrap" style="margin:0;display:none"><label>Flotilla / Empresa</label>
          <select id="ag-flot"><option value="">— Seleccionar —</option>${flot.map(f => `<option value="${escapeHtml(f.nombre)}">${escapeHtml(f.nombre)}</option>`).join('')}</select>
        </div>
        <div class="field" style="margin:0"><label>Cliente — nombre</label><input id="ag-nombre" placeholder="Nombre del cliente"></div>
        <div class="field" style="margin:0"><label>Cliente — teléfono</label><input id="ag-tel" placeholder="Teléfono" inputmode="numeric" oninput="this.value=this.value.replace(/[^\\d]/g,'')"></div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-ghost" onclick="document.getElementById('modal-agendar').remove()">Cancelar</button>
        <button class="btn btn-primary" id="ag-guardar" onclick="guardarAgendamiento()">Agendar →</button>
      </div>
    </div>`;
  document.body.appendChild(ov);
  setTimeout(() => document.getElementById('ag-placa')?.focus(), 80);
}

function _agendarToggleTipo(tipo) {
  const a = document.getElementById('ag-aseg-wrap');
  const f = document.getElementById('ag-flot-wrap');
  if (a) a.style.display = tipo === 'aseguradora' ? '' : 'none';
  if (f) f.style.display = tipo === 'flotilla' ? '' : 'none';
}

async function guardarAgendamiento() {
  const placa = document.getElementById('ag-placa')?.value.trim().toUpperCase();
  const fecha = document.getElementById('ag-fecha')?.value;
  if (!placa) { toast('La placa es obligatoria', 'err'); document.getElementById('ag-placa')?.focus(); return; }
  if (!fecha) { toast('La fecha programada es obligatoria', 'err'); return; }
  const tipo = document.getElementById('ag-tipo')?.value || 'particular';
  let aseguradora = null;
  if (tipo === 'aseguradora')   aseguradora = document.getElementById('ag-aseg')?.value || null;
  else if (tipo === 'flotilla') aseguradora = document.getElementById('ag-flot')?.value || null;

  const body = {
    placa,
    propietario:      document.getElementById('ag-nombre')?.value.trim() || null,
    telefono:         document.getElementById('ag-tel')?.value.trim()    || null,
    tipo_cliente:     tipo,
    aseguradora,
    fecha_programada: fecha,
    estado:           'Programada',
    ingreso_en:       null
  };

  const btn = document.getElementById('ag-guardar');
  if (btn) { btn.disabled = true; btn.textContent = 'Agendando...'; }
  try {
    await api('/ordenes', 'POST', body, { Prefer: 'return=minimal' });
    toast('Ingreso agendado ✓');
    document.getElementById('modal-agendar')?.remove();
    if (typeof cargarCalendario === 'function') cargarCalendario();
    if (typeof _refrescarCapacidad === 'function') _refrescarCapacidad();
  } catch(e) {
    toast('Error al agendar: ' + e.message, 'err');
    if (btn) { btn.disabled = false; btn.textContent = 'Agendar →'; }
  }
}

// ═══════════════════════════════════════════════════════════
// VISTA OPERARIOS
// ═══════════════════════════════════════════════════════════
const ROL_LABEL = {
  mecanico: 'Mecánico', pintor: 'Pintor', latonero: 'Latonero',
  detailing: 'Detailing', tot: 'T.O.T.', repuestos: 'Repuestos',
  taller: 'Pantalla Taller', 'Asesor Previsora': 'Asesor Previsora'
};
