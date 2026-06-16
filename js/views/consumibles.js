// ═══════════════════════════════════════════════════════════
// CONSUMIBLES & DOCUMENTOS POR VEHÍCULO
// ═══════════════════════════════════════════════════════════

const CONSUMIBLES_CONFIG = {
  aceite:             { label: 'Aceite de motor',     icon: '🛢', kmDefault: 5000  },
  llantas:            { label: 'Llantas',             icon: '🔵', kmDefault: 50000 },
  frenos:             { label: 'Pastillas de freno',  icon: '🔴', kmDefault: 40000 },
  filtro_aire:        { label: 'Filtro de aire',      icon: '💨', kmDefault: 15000 },
  filtro_combustible: { label: 'Filtro combustible',  icon: '⛽', kmDefault: 30000 },
  bateria:            { label: 'Batería',             icon: '🔋', kmDefault: null, porFecha: true }
};

const DOCUMENTOS_CONFIG = {
  soat:          { label: 'SOAT',                icon: '📋' },
  seguro:        { label: 'Seguro todo riesgo',  icon: '🛡️' },
  tecnomecanica: { label: 'Tecnomecánica',       icon: '🔧' }
};

// ── Cálculo de estados ───────────────────────────────────────
function calcularEstadoConsumible(kmActual, kmInstalacion, kmVidaUtil) {
  if (!kmVidaUtil || kmInstalacion == null) return { dot: '⚪', label: 'Sin datos', color: '#9CA3AF' };
  const kmRestantes = kmVidaUtil - (kmActual - kmInstalacion);
  const pct = kmRestantes / kmVidaUtil;
  if (pct > 0.25) return { dot: '🟢', label: `${Math.max(0,Math.round(kmRestantes)).toLocaleString()} km`, color: '#16a34a' };
  if (pct > 0.10) return { dot: '🟡', label: `${Math.max(0,Math.round(kmRestantes)).toLocaleString()} km`, color: '#ca8a04' };
  return { dot: '🔴', label: kmRestantes < 0 ? `Vencido ${Math.abs(Math.round(kmRestantes)).toLocaleString()} km` : `${Math.max(0,Math.round(kmRestantes)).toLocaleString()} km`, color: '#dc2626' };
}

function calcularEstadoFecha(fechaVenc) {
  if (!fechaVenc) return { dot: '⚪', label: 'Sin fecha', color: '#9CA3AF', dias: null };
  const dias = Math.round((new Date(fechaVenc) - new Date()) / 86400000);
  if (dias > 60) return { dot: '🟢', label: `${dias} días`, color: '#16a34a', dias };
  if (dias > 15) return { dot: '🟡', label: `${dias} días`, color: '#ca8a04', dias };
  return { dot: '🔴', label: dias < 0 ? `Vencido hace ${Math.abs(dias)} días` : `${dias} días`, color: '#dc2626', dias };
}

// ── Popup principal ──────────────────────────────────────────
async function abrirPopupConsumibles(placa, kmActual) {
  if (!placa) { toast('Sin placa registrada', 'err'); return; }

  // Quitar popup anterior si existe
  document.getElementById('popup-consumibles')?.remove();

  const overlay = document.createElement('div');
  overlay.id = 'popup-consumibles';
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:8000;display:flex;align-items:center;justify-content:center;padding:16px';
  overlay.innerHTML = `<div style="background:#fff;border-radius:14px;width:100%;max-width:500px;max-height:90vh;overflow-y:auto;box-shadow:0 20px 60px rgba(0,0,0,.25);display:flex;flex-direction:column">
    <div style="padding:16px 20px 12px;border-bottom:1px solid #E5E7EB;display:flex;align-items:center;justify-content:space-between;position:sticky;top:0;background:#fff;z-index:1;border-radius:14px 14px 0 0">
      <div>
        <div style="font-size:16px;font-weight:700;color:#111827">🔧 Consumibles & Docs</div>
        <div style="font-size:12px;color:#6B7280;font-family:'DM Mono',monospace;letter-spacing:1px">${escapeHtml(placa)}${kmActual ? ' · ' + Number(kmActual).toLocaleString() + ' km' : ''}</div>
      </div>
      <button onclick="document.getElementById('popup-consumibles').remove()" style="background:none;border:none;cursor:pointer;font-size:20px;color:#6B7280;padding:4px 8px;border-radius:6px;line-height:1">&times;</button>
    </div>
    <div style="padding:16px 20px" id="popup-consumibles-body">
      <div style="text-align:center;color:#9CA3AF;font-size:13px">Cargando...</div>
    </div>
  </div>`;
  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
  document.body.appendChild(overlay);

  try {
    const [rawConsumibles, rawDocs] = await Promise.all([
      api(`/vehiculo_consumibles?placa=eq.${encodeURIComponent(placa)}&order=creado_en.desc`).catch(() => []),
      api(`/vehiculo_documentos?placa=eq.${encodeURIComponent(placa)}`).catch(() => [])
    ]);

    // Tomar el más reciente por tipo
    const porTipo = {};
    for (const c of (rawConsumibles || [])) {
      if (!porTipo[c.tipo]) porTipo[c.tipo] = c;
    }

    const km = parseFloat(kmActual) || 0;

    // ── Tabla consumibles
    let consHtml = `<div style="font-size:11px;font-weight:700;color:#6B7280;text-transform:uppercase;letter-spacing:.5px;margin-bottom:8px">Consumibles</div>
    <div style="border:1px solid #E5E7EB;border-radius:10px;overflow:hidden;margin-bottom:18px">`;

    const tiposConsumibles = Object.keys(CONSUMIBLES_CONFIG);
    tiposConsumibles.forEach((tipo, i) => {
      const cfg = CONSUMIBLES_CONFIG[tipo];
      const c = porTipo[tipo];
      let estadoHtml = '';
      if (cfg.porFecha) {
        if (c?.fecha_cambio) {
          // Batería: mostrar fecha de cambio
          estadoHtml = `<span style="font-size:11px;color:#6B7280">${formatFecha(c.fecha_cambio)}</span>`;
        } else {
          estadoHtml = `<span style="font-size:11px;color:#9CA3AF">Sin registro</span>`;
        }
      } else if (c && c.km_instalacion != null && c.km_vida_util) {
        const est = calcularEstadoConsumible(km, c.km_instalacion, c.km_vida_util);
        estadoHtml = `<span style="font-size:11px;color:${est.color};font-weight:600">${est.dot} ${est.label}</span>`;
      } else {
        estadoHtml = `<span style="font-size:11px;color:#9CA3AF">Sin registro</span>`;
      }

      const marcaRef = c ? [c.marca, c.referencia].filter(Boolean).join(' ') : '';
      const border = i < tiposConsumibles.length - 1 ? 'border-bottom:1px solid #F3F4F6;' : '';
      consHtml += `<div style="display:flex;align-items:center;gap:10px;padding:9px 12px;${border}">
        <span style="font-size:18px;flex-shrink:0;width:24px;text-align:center">${cfg.icon}</span>
        <div style="flex:1;min-width:0">
          <div style="font-size:13px;font-weight:600;color:#111827">${cfg.label}</div>
          ${marcaRef ? `<div style="font-size:11px;color:#6B7280">${escapeHtml(marcaRef)}</div>` : ''}
        </div>
        <div style="text-align:right;flex-shrink:0">${estadoHtml}</div>
        <button onclick="abrirModalEditarConsumible('${escapeHtml(placa)}','${tipo}',${c ? JSON.stringify(c).replace(/'/g,"&#39;") : 'null'},${km})" style="background:none;border:1px solid #E5E7EB;border-radius:6px;padding:4px 8px;cursor:pointer;font-size:11px;color:#374151;flex-shrink:0" title="Editar">✏</button>
      </div>`;
    });
    consHtml += `</div>`;

    // ── Tabla documentos
    const docsMap = {};
    for (const d of (rawDocs || [])) docsMap[d.tipo] = d;

    let docsHtml = `<div style="font-size:11px;font-weight:700;color:#6B7280;text-transform:uppercase;letter-spacing:.5px;margin-bottom:8px">Documentos</div>
    <div style="border:1px solid #E5E7EB;border-radius:10px;overflow:hidden">`;

    const tiposDocs = Object.keys(DOCUMENTOS_CONFIG);
    tiposDocs.forEach((tipo, i) => {
      const cfg = DOCUMENTOS_CONFIG[tipo];
      const d = docsMap[tipo];
      let estadoHtml = '';
      if (d?.fecha_venc) {
        const est = calcularEstadoFecha(d.fecha_venc);
        estadoHtml = `<span style="font-size:11px;color:${est.color};font-weight:600">${est.dot} ${est.label}</span><br><span style="font-size:10px;color:#9CA3AF">${formatFecha(d.fecha_venc)}</span>`;
      } else {
        estadoHtml = `<span style="font-size:11px;color:#9CA3AF">Sin registro</span>`;
      }

      const border = i < tiposDocs.length - 1 ? 'border-bottom:1px solid #F3F4F6;' : '';
      docsHtml += `<div style="display:flex;align-items:center;gap:10px;padding:9px 12px;${border}">
        <span style="font-size:18px;flex-shrink:0;width:24px;text-align:center">${cfg.icon}</span>
        <div style="flex:1;min-width:0">
          <div style="font-size:13px;font-weight:600;color:#111827">${cfg.label}</div>
          ${d?.numero ? `<div style="font-size:11px;color:#6B7280">${escapeHtml(d.numero)}</div>` : ''}
        </div>
        <div style="text-align:right;flex-shrink:0">${estadoHtml}</div>
        <button onclick="abrirModalEditarDocumento('${escapeHtml(placa)}','${tipo}',${d ? JSON.stringify(d).replace(/'/g,"&#39;").replace(/\n/g,' ') : 'null'})" style="background:none;border:1px solid #E5E7EB;border-radius:6px;padding:4px 8px;cursor:pointer;font-size:11px;color:#374151;flex-shrink:0" title="Editar">✏</button>
      </div>`;
    });
    docsHtml += `</div>`;

    document.getElementById('popup-consumibles-body').innerHTML = consHtml + docsHtml;
  } catch(e) {
    document.getElementById('popup-consumibles-body').innerHTML = `<div style="color:#dc2626">Error: ${escapeHtml(e.message)}</div>`;
  }
}

// ── Modal editar consumible ───────────────────────────────────
function abrirModalEditarConsumible(placa, tipo, consumibleActual, kmActual) {
  document.getElementById('modal-cons-edit')?.remove();
  const cfg = CONSUMIBLES_CONFIG[tipo] || {};
  const c = consumibleActual || {};

  const modal = document.createElement('div');
  modal.id = 'modal-cons-edit';
  modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:9000;display:flex;align-items:center;justify-content:center;padding:16px';

  const kmDefVal = c.km_vida_util || cfg.kmDefault || '';
  const kmInstVal = c.km_instalacion ?? (kmActual || '');

  modal.innerHTML = `<div style="background:#fff;border-radius:12px;width:100%;max-width:400px;box-shadow:0 20px 60px rgba(0,0,0,.3)">
    <div style="padding:16px 20px 12px;border-bottom:1px solid #E5E7EB;display:flex;align-items:center;justify-content:space-between">
      <div style="font-size:15px;font-weight:700;color:#111827">${cfg.icon || ''} ${cfg.label || tipo}</div>
      <button onclick="document.getElementById('modal-cons-edit').remove()" style="background:none;border:none;cursor:pointer;font-size:18px;color:#6B7280">&times;</button>
    </div>
    <div style="padding:16px 20px;display:flex;flex-direction:column;gap:12px">
      <div style="font-size:12px;color:#6B7280;background:#F8FAFC;border-radius:6px;padding:6px 10px;font-family:'DM Mono',monospace">${escapeHtml(placa)}</div>

      <div class="field" style="margin:0">
        <label style="font-size:12px;font-weight:600;color:#374151;display:block;margin-bottom:4px">Marca</label>
        <input id="coned-marca" value="${escapeHtml(c.marca||'')}" placeholder="Ej: Castrol" style="width:100%;padding:8px 10px;border:1px solid #D1D5DB;border-radius:7px;font-size:13px;box-sizing:border-box">
      </div>
      <div class="field" style="margin:0">
        <label style="font-size:12px;font-weight:600;color:#374151;display:block;margin-bottom:4px">Referencia</label>
        <input id="coned-ref" value="${escapeHtml(c.referencia||'')}" placeholder="Ej: Edge 5W-30" style="width:100%;padding:8px 10px;border:1px solid #D1D5DB;border-radius:7px;font-size:13px;box-sizing:border-box">
      </div>
      ${!cfg.porFecha ? `
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
        <div class="field" style="margin:0">
          <label style="font-size:12px;font-weight:600;color:#374151;display:block;margin-bottom:4px">KM instalación</label>
          <input id="coned-kminst" type="number" value="${kmInstVal}" placeholder="${kmActual||0}" style="width:100%;padding:8px 10px;border:1px solid #D1D5DB;border-radius:7px;font-size:13px;box-sizing:border-box">
        </div>
        <div class="field" style="margin:0">
          <label style="font-size:12px;font-weight:600;color:#374151;display:block;margin-bottom:4px">KM vida útil</label>
          <input id="coned-kmvida" type="number" value="${kmDefVal}" placeholder="${cfg.kmDefault||''}" style="width:100%;padding:8px 10px;border:1px solid #D1D5DB;border-radius:7px;font-size:13px;box-sizing:border-box">
        </div>
      </div>` : ''}
      <div class="field" style="margin:0">
        <label style="font-size:12px;font-weight:600;color:#374151;display:block;margin-bottom:4px">Fecha de cambio</label>
        <input id="coned-fecha" type="date" value="${c.fecha_cambio ? c.fecha_cambio.split('T')[0] : new Date().toISOString().split('T')[0]}" style="width:100%;padding:8px 10px;border:1px solid #D1D5DB;border-radius:7px;font-size:13px;box-sizing:border-box">
      </div>
      <div class="field" style="margin:0">
        <label style="font-size:12px;font-weight:600;color:#374151;display:block;margin-bottom:4px">Notas</label>
        <textarea id="coned-notas" placeholder="Observaciones..." style="width:100%;padding:8px 10px;border:1px solid #D1D5DB;border-radius:7px;font-size:13px;min-height:56px;resize:vertical;box-sizing:border-box">${escapeHtml(c.notas||'')}</textarea>
      </div>
    </div>
    <div style="padding:12px 20px 16px;border-top:1px solid #E5E7EB;display:flex;justify-content:flex-end;gap:8px">
      <button onclick="document.getElementById('modal-cons-edit').remove()" style="padding:8px 16px;border:1px solid #D1D5DB;border-radius:7px;background:#fff;cursor:pointer;font-size:13px;font-weight:500">Cancelar</button>
      <button onclick="_guardarConsumible('${escapeHtml(placa)}','${tipo}',${kmActual||0})" style="padding:8px 16px;background:var(--azul,#1E3A5F);color:#fff;border:none;border-radius:7px;cursor:pointer;font-size:13px;font-weight:600">Guardar</button>
    </div>
  </div>`;
  modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
  document.body.appendChild(modal);
}

async function _guardarConsumible(placa, tipo, kmActual) {
  const cfg = CONSUMIBLES_CONFIG[tipo] || {};
  const marca     = document.getElementById('coned-marca')?.value.trim() || null;
  const referencia= document.getElementById('coned-ref')?.value.trim() || null;
  const km_inst   = cfg.porFecha ? null : (parseFloat(document.getElementById('coned-kminst')?.value) || null);
  const km_vida   = cfg.porFecha ? null : (parseFloat(document.getElementById('coned-kmvida')?.value) || null);
  const fecha     = document.getElementById('coned-fecha')?.value || null;
  const notas     = document.getElementById('coned-notas')?.value.trim() || null;

  const payload = { placa, tipo, marca, referencia, km_instalacion: km_inst, km_vida_util: km_vida, fecha_cambio: fecha, notas };

  try {
    await api('/vehiculo_consumibles', 'POST', payload, { Prefer: 'return=minimal' });
    toast('Consumible guardado ✓');
    document.getElementById('modal-cons-edit')?.remove();
    // Refrescar popup si está abierto
    if (document.getElementById('popup-consumibles')) {
      abrirPopupConsumibles(placa, kmActual);
    }
  } catch(e) { toast('Error: ' + e.message, 'err'); }
}

// ── Modal editar documento ────────────────────────────────────
function abrirModalEditarDocumento(placa, tipo, docActual) {
  document.getElementById('modal-doc-edit')?.remove();
  const cfg = DOCUMENTOS_CONFIG[tipo] || {};
  const d = docActual || {};

  const modal = document.createElement('div');
  modal.id = 'modal-doc-edit';
  modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:9000;display:flex;align-items:center;justify-content:center;padding:16px';

  modal.innerHTML = `<div style="background:#fff;border-radius:12px;width:100%;max-width:400px;box-shadow:0 20px 60px rgba(0,0,0,.3)">
    <div style="padding:16px 20px 12px;border-bottom:1px solid #E5E7EB;display:flex;align-items:center;justify-content:space-between">
      <div style="font-size:15px;font-weight:700;color:#111827">${cfg.icon || ''} ${cfg.label || tipo}</div>
      <button onclick="document.getElementById('modal-doc-edit').remove()" style="background:none;border:none;cursor:pointer;font-size:18px;color:#6B7280">&times;</button>
    </div>
    <div style="padding:16px 20px;display:flex;flex-direction:column;gap:12px">
      <div style="font-size:12px;color:#6B7280;background:#F8FAFC;border-radius:6px;padding:6px 10px;font-family:'DM Mono',monospace">${escapeHtml(placa)}</div>

      <div class="field" style="margin:0">
        <label style="font-size:12px;font-weight:600;color:#374151;display:block;margin-bottom:4px">Fecha de vencimiento</label>
        <input id="doced-fechavenc" type="date" value="${d.fecha_venc ? d.fecha_venc.split('T')[0] : ''}" style="width:100%;padding:8px 10px;border:1px solid #D1D5DB;border-radius:7px;font-size:13px;box-sizing:border-box">
      </div>
      <div class="field" style="margin:0">
        <label style="font-size:12px;font-weight:600;color:#374151;display:block;margin-bottom:4px">Número / póliza</label>
        <input id="doced-numero" value="${escapeHtml(d.numero||'')}" placeholder="Ej: SOAT-123456" style="width:100%;padding:8px 10px;border:1px solid #D1D5DB;border-radius:7px;font-size:13px;box-sizing:border-box">
      </div>
      <div class="field" style="margin:0">
        <label style="font-size:12px;font-weight:600;color:#374151;display:block;margin-bottom:4px">Aseguradora / entidad</label>
        <input id="doced-aseg" value="${escapeHtml(d.aseguradora||'')}" placeholder="Ej: Sura" style="width:100%;padding:8px 10px;border:1px solid #D1D5DB;border-radius:7px;font-size:13px;box-sizing:border-box">
      </div>
      <div class="field" style="margin:0">
        <label style="font-size:12px;font-weight:600;color:#374151;display:block;margin-bottom:4px">Valor</label>
        <input id="doced-valor" type="number" value="${d.valor||''}" placeholder="0" style="width:100%;padding:8px 10px;border:1px solid #D1D5DB;border-radius:7px;font-size:13px;box-sizing:border-box">
      </div>
      <div class="field" style="margin:0">
        <label style="font-size:12px;font-weight:600;color:#374151;display:block;margin-bottom:4px">Notas</label>
        <textarea id="doced-notas" placeholder="Observaciones..." style="width:100%;padding:8px 10px;border:1px solid #D1D5DB;border-radius:7px;font-size:13px;min-height:52px;resize:vertical;box-sizing:border-box">${escapeHtml(d.notas||'')}</textarea>
      </div>
    </div>
    <div style="padding:12px 20px 16px;border-top:1px solid #E5E7EB;display:flex;justify-content:flex-end;gap:8px">
      <button onclick="document.getElementById('modal-doc-edit').remove()" style="padding:8px 16px;border:1px solid #D1D5DB;border-radius:7px;background:#fff;cursor:pointer;font-size:13px;font-weight:500">Cancelar</button>
      <button onclick="_guardarDocumento('${escapeHtml(placa)}','${tipo}','${d.id||''}')" style="padding:8px 16px;background:var(--azul,#1E3A5F);color:#fff;border:none;border-radius:7px;cursor:pointer;font-size:13px;font-weight:600">Guardar</button>
    </div>
  </div>`;
  modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
  document.body.appendChild(modal);
}

async function _guardarDocumento(placa, tipo, existingId) {
  const fecha_venc  = document.getElementById('doced-fechavenc')?.value || null;
  const numero      = document.getElementById('doced-numero')?.value.trim() || null;
  const aseguradora = document.getElementById('doced-aseg')?.value.trim() || null;
  const valor       = parseFloat(document.getElementById('doced-valor')?.value) || null;
  const notas       = document.getElementById('doced-notas')?.value.trim() || null;

  const payload = { placa, tipo, fecha_venc, numero, aseguradora, valor, notas };

  try {
    if (existingId) {
      await api(`/vehiculo_documentos?id=eq.${existingId}`, 'PATCH', payload);
    } else {
      await api('/vehiculo_documentos', 'POST', payload, { Prefer: 'return=minimal' });
    }
    toast('Documento guardado ✓');
    document.getElementById('modal-doc-edit')?.remove();
    // Refrescar popup si está abierto
    const popup = document.getElementById('popup-consumibles');
    if (popup) {
      // Extraer placa del subtitle
      abrirPopupConsumibles(placa, null);
    }
  } catch(e) { toast('Error: ' + e.message, 'err'); }
}

// ── Mini-panel de consumibles en el sidebar de la orden ───────
async function _cargarConsumiblesSidebar(placa, kmActual) {
  const body = document.getElementById('consumibles-sidebar-body');
  if (!body) return;
  try {
    const [consumibles, docs] = await Promise.all([
      api(`/vehiculo_consumibles?placa=eq.${placa}&order=creado_en.desc`).catch(()=>[]) || [],
      api(`/vehiculo_documentos?placa=eq.${placa}`).catch(()=>[]) || []
    ]);

    // Último por tipo
    const ultimos = {};
    consumibles.forEach(c => { if (!ultimos[c.tipo]) ultimos[c.tipo] = c; });

    const alertas = [];

    // Consumibles con km
    Object.entries(CONSUMIBLES_CONFIG).forEach(([tipo, cfg]) => {
      if (cfg.porFecha) return;
      const c = ultimos[tipo];
      if (!c) return;
      const est = calcularEstadoConsumible(kmActual, c.km_instalacion, c.km_vida_util || cfg.kmDefault);
      if (est.color !== '🟢') alertas.push({ icon: cfg.icon, label: cfg.label, est });
    });

    // Documentos por fecha
    docs.forEach(d => {
      const cfg = DOCUMENTOS_CONFIG[d.tipo];
      if (!cfg) return;
      const est = calcularEstadoFecha(d.fecha_venc);
      if (est.color !== '🟢') alertas.push({ icon: cfg.icon, label: cfg.label, est });
    });

    if (!alertas.length) {
      // Sin datos NO es lo mismo que "todo bien": si no hay ningún consumible
      // ni documento registrado, queda PENDIENTE de cargar (no verde).
      const sinDatos = consumibles.length === 0 && docs.length === 0;
      body.innerHTML = sinDatos
        ? `<div style="font-size:12px;color:var(--amarillo);display:flex;align-items:center;gap:5px">🟡 Pendiente: agregar datos</div>
           <button class="btn btn-ghost btn-xs" style="margin-top:6px;font-size:11px;width:100%" onclick="abrirPopupConsumibles('${escapeHtml(placa)}',${kmActual})">Agregar datos →</button>`
        : `<div style="font-size:12px;color:var(--verde);display:flex;align-items:center;gap:5px">🟢 Todo en buen estado</div>`;
    } else {
      body.innerHTML = alertas.map(a =>
        `<div style="display:flex;align-items:center;justify-content:space-between;padding:4px 0;border-bottom:1px solid var(--gris-borde);font-size:12px">
          <span>${a.icon} ${a.label}</span>
          <span style="font-weight:700">${a.est.dot} ${a.est.label}</span>
        </div>`
      ).join('') + `<button class="btn btn-ghost btn-xs" style="margin-top:6px;font-size:11px;width:100%" onclick="abrirPopupConsumibles('${escapeHtml(placa)}',${kmActual})">Ver todo →</button>`;
    }
  } catch(e) {
    if (body) body.innerHTML = `<div style="font-size:11px;color:var(--gris-mid)">—</div>`;
  }
}

// ── Toast especial para actualizar consumible desde etapa ─────
function _toastConsumible(tipo, placa, km) {
  const cfg = CONSUMIBLES_CONFIG[tipo];
  if (!cfg || !placa) return;
  const toastEl = document.createElement('div');
  toastEl.id = 'toast-consumible-' + tipo;
  toastEl.style.cssText = 'position:fixed;bottom:80px;left:50%;transform:translateX(-50%);background:#1E293B;color:#fff;padding:12px 16px;border-radius:10px;font-size:13px;z-index:9999;display:flex;align-items:center;gap:10px;box-shadow:0 4px 20px rgba(0,0,0,.3);white-space:nowrap';
  toastEl.innerHTML = `<span>${cfg.icon} ¿Registrar cambio de ${cfg.label}?</span><button onclick="abrirModalEditarConsumible('${escapeHtml(placa)}','${tipo}',null,${km||0});this.closest('[id^=toast-consumible]').remove()" style="background:var(--azul,#1E3A5F);color:#fff;border:none;border-radius:6px;padding:4px 10px;cursor:pointer;font-size:12px;white-space:nowrap">Registrar</button><button onclick="this.closest('[id^=toast-consumible]').remove()" style="background:none;border:none;color:#94A3B8;cursor:pointer;font-size:16px;line-height:1;padding:0 2px">&times;</button>`;
  document.body.appendChild(toastEl);
  setTimeout(() => toastEl.remove(), 10000);
}
