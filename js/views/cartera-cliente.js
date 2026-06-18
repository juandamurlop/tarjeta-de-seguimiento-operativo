// ═══════════════════════════════════════════════════════════
// CARTERA POR CLIENTE — Módulos de Flotillas y Empresas
// Misma estructura que Aseguradoras (lista de compañías → detalle
// con sus órdenes), pero con métricas operativas (sin peritaje ni
// rentabilidad por plaza, que son exclusivos de aseguradoras).
//   · Flotilla: nombre en campo "aseguradora", tipo_cliente='flotilla'
//   · Empresa : razón social en "propietario", tipo_cliente='empresa'
// ═══════════════════════════════════════════════════════════

let _carteraSel   = { flotilla: null, empresa: null };  // compañía abierta
let _carteraCache = { flotilla: [],   empresa: []   };  // órdenes
let _carteraVal   = { flotilla: {},   empresa: {}   };  // facturado por orden
let _carteraEtapa = { flotilla: {},   empresa: {}   };  // etapa actual por orden
let _carteraProg  = { flotilla: { tot:{}, fin:{} }, empresa: { tot:{}, fin:{} } };
let _carteraCat   = { flotilla: {},   empresa: {}   };  // catálogo por nombre

function _carteraConfig(tipo) {
  if (tipo === 'flotilla') {
    return { tipo, pagId:'pag-cartera-flotillas', titulo:'Flotillas', plural:'flotillas', singular:'flotilla',
             icon:'🚚', color:'#7C3AED', catalog:'/flotillas', nombre: o => o.aseguradora || 'Sin flotilla' };
  }
  // La empresa se guarda en el campo "aseguradora" (organización). Para órdenes
  // antiguas sin ese dato, se cae al propietario como respaldo.
  return { tipo, pagId:'pag-cartera-empresas', titulo:'Empresas', plural:'empresas', singular:'empresa',
           icon:'🏢', color:'#0891B2', catalog:'/flotillas', nombre: o => o.aseguradora || o.propietario || 'Sin empresa' };
}

const _carFmt = n => n != null ? new Intl.NumberFormat('es-CO',{style:'currency',currency:'COP',minimumFractionDigits:0}).format(Math.round(n)) : '$0';

// ─── Entradas / navegación ──────────────────────────────────
function montarCarteraFlotillas() { _carteraSel.flotilla = null; cargarCarteraCliente('flotilla'); }
function montarCarteraEmpresas()  { _carteraSel.empresa  = null; cargarCarteraCliente('empresa'); }
function abrirCartera(tipo, nombre) { _carteraSel[tipo] = nombre; cargarCarteraCliente(tipo); }
function volverCartera(tipo)        { _carteraSel[tipo] = null;   cargarCarteraCliente(tipo); }
function resetVistaCartera(tipo)    { _carteraSel[tipo] = null; }

// Crear una nueva flotilla/empresa desde la lista de Carteras. Se guarda en el
// catálogo /flotillas (donde viven ambas). Aparecerá en la lista al asignarle una
// orden; mientras tanto ya queda disponible para órdenes y para editar su contacto.
async function crearOrgCartera(tipo) {
  const esEmp  = tipo === 'empresa';
  const nombre = (prompt(`Nombre de ${esEmp ? 'la empresa' : 'la flotilla'}:`) || '').trim();
  if (!nombre) return;
  const nit = (prompt('NIT (opcional):') || '').trim() || null;
  try {
    await api('/flotillas', 'POST', { nombre, nit, activo: true }, { Prefer: 'return=minimal' });
    toast((esEmp ? 'Empresa' : 'Flotilla') + ' creada ✓');
    cargarCarteraCliente(tipo);
  } catch (e) { toast('Error: ' + e.message, 'err'); }
}

// ─── Carga + render ─────────────────────────────────────────
async function cargarCarteraCliente(tipo) {
  const cfg = _carteraConfig(tipo);
  const cont = document.getElementById(cfg.pagId);
  if (!cont) return;
  mostrarCargandoSiVacio(cont, '<div class="loading-state">Cargando ' + cfg.plural + '...</div>');

  try {
    const today = new Date();
    const ordenes = await api(`/ordenes?tipo_cliente=eq.${tipo}&order=creado_en.desc&select=*`).catch(()=>[]) || [];

    const ids = ordenes.map(o => o.id).join(',');
    const etapas = ids ? (await api(`/etapas?orden_id=in.(${ids})&select=orden_id,servicio,etapa,inicio,fin,valor`).catch(()=>[]) || []) : [];
    const valPorOrden = {}, etapaAct = {}, totEt = {}, finEt = {};
    etapas.forEach(e => {
      valPorOrden[e.orden_id] = (valPorOrden[e.orden_id] || 0) + (e.valor || 0);
      totEt[e.orden_id] = (totEt[e.orden_id] || 0) + 1;
      if (e.fin) finEt[e.orden_id] = (finEt[e.orden_id] || 0) + 1;
      if (e.inicio && !e.fin) etapaAct[e.orden_id] = e.etapa || (typeof CATALOGO !== 'undefined' && CATALOGO[e.servicio]?.nombre) || e.servicio;
    });
    _carteraCache[tipo] = ordenes;
    _carteraVal[tipo]   = valPorOrden;
    _carteraEtapa[tipo] = etapaAct;
    _carteraProg[tipo]  = { tot: totEt, fin: finEt };

    let catalogo = cfg.catalog ? (await api(cfg.catalog + '?order=nombre.asc').catch(()=>[]) || []) : [];
    const catByName = {};
    catalogo.forEach(c => { catByName[(c.nombre || '').trim().toLowerCase()] = c; });
    _carteraCat[tipo] = catByName;

    // Agrupar por compañía
    const grupos = {};
    ordenes.forEach(o => { const n = cfg.nombre(o); (grupos[n] = grupos[n] || { nombre:n, ords:[] }).ords.push(o); });
    const companias = Object.values(grupos).map(g => {
      const act = g.ords.filter(o => o.estado === 'Activa').length;
      const ent = g.ords.filter(o => o.entregada_en).length;
      const fact = g.ords.reduce((s,o) => s + (valPorOrden[o.id] || 0), 0);
      const ciclos = g.ords.filter(o => o.entregada_en && o.creado_en).map(o => (new Date(o.entregada_en) - new Date(o.creado_en)) / 86400000);
      const ciclo = ciclos.length ? Math.round(ciclos.reduce((a,b)=>a+b,0)/ciclos.length) : null;
      return { nombre:g.nombre, count:g.ords.length, act, ent, fact, ciclo, enCat: !!catByName[(g.nombre||'').trim().toLowerCase()] };
    }).filter(c => c.count > 0).sort((a,b) => b.act - a.act || b.count - a.count);

    const G = {
      total: ordenes.length,
      activas: ordenes.filter(o => o.estado === 'Activa').length,
      entregadas: ordenes.filter(o => o.entregada_en).length,
      facturado: ordenes.reduce((s,o) => s + (valPorOrden[o.id] || 0), 0)
    };

    if (_carteraSel[tipo]) {
      // ═══ DETALLE — solo las órdenes de la compañía seleccionada ═══
      renderSinParpadeo(cont, `
        <div class="aseg-wrap">
          <div class="aseg-topbar">
            <button class="btn btn-ghost btn-sm" onclick="volverCartera('${tipo}')" style="display:flex;align-items:center;gap:6px">
              <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
              ${cfg.titulo}
            </button>
          </div>
          ${_carteraFichaHtml(tipo, _carteraSel[tipo])}
          <div class="aseg-filtros">
            <input id="cartera-buscar-${tipo}" type="text" placeholder="Placa, propietario..."
              class="aseg-input" style="flex:1;min-width:200px" oninput="filtrarCarteraOrdenes('${tipo}')">
            <select id="cartera-estado-${tipo}" onchange="filtrarCarteraOrdenes('${tipo}')" class="aseg-input" style="background:#fff">
              <option value="">Todas</option>
              <option value="Activa">Activas</option>
              <option value="Entregada">Entregadas</option>
            </select>
          </div>
          <div id="cartera-lista-${tipo}"></div>
        </div>`);
      filtrarCarteraOrdenes(tipo);

    } else {
      // ═══ LISTA — compañías registradas ═══
      renderSinParpadeo(cont, `
        <div class="aseg-wrap">
          <div class="aseg-topbar">
            <span class="aseg-topbar-info">${cfg.icon} ${companias.length} ${cfg.plural}</span>
            <button class="btn btn-primary btn-sm" onclick="crearOrgCartera('${tipo}')" style="display:flex;align-items:center;gap:6px">
              <svg width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              Nueva ${cfg.singular}
            </button>
          </div>
          <div class="aseg-kpi-grupo">📊 Resumen</div>
          <div class="aseg-kpis">
            ${_asegKpi('🚗', G.total, 'Órdenes', '#2563EB', '')}
            ${_asegKpi('⚙️', G.activas, 'Activas', '#0EA5E9', 'en proceso')}
            ${_asegKpi('✅', G.entregadas, 'Entregadas', '#059669', '')}
            ${_asegKpi('💵', _carFmt(G.facturado), 'Facturado', cfg.color, 'valor del trabajo')}
          </div>
          <div class="aseg-kpi-grupo" style="margin-top:6px">📋 Selecciona ${tipo==='empresa'?'una empresa':'una flotilla'} para ver sus órdenes</div>
          <input id="cartera-buscarcomp-${tipo}" type="text" placeholder="Buscar ${cfg.singular}..."
            class="aseg-input" style="width:100%;margin-bottom:12px;box-sizing:border-box" oninput="filtrarCarteraComp('${tipo}')">
          <div class="aseg-comp-grid" id="cartera-comp-${tipo}">
            ${companias.length ? companias.map(c => _carteraCompCard(tipo, c)).join('') : `<div class="empty-state"><div class="empty-state-icon">${cfg.icon}</div><p>Aún no hay órdenes de ${cfg.plural}. Aparecerán aquí al registrar una orden de ${cfg.singular}.</p></div>`}
          </div>
        </div>`);
    }
  } catch (e) {
    cont.innerHTML = `<div class="empty-state">Error: ${e.message}</div>`;
  }
}

function _carteraCompCard(tipo, c) {
  const cfg = _carteraConfig(tipo);
  return `<div class="aseg-comp-card hover-lift" data-nombre="${escapeHtml(c.nombre)}" onclick="abrirCartera('${tipo}', this.dataset.nombre)" style="border-left-color:${cfg.color}">
    <div class="aseg-comp-top">
      <span class="aseg-comp-nombre" style="color:${cfg.color}">${cfg.icon} ${escapeHtml(c.nombre)}</span>
      <div style="display:flex;align-items:center;gap:6px;flex-shrink:0">
        ${c.enCat ? '' : '<span class="aseg-comp-flag">sin datos</span>'}
        ${c.enCat ? `<button class="btn btn-ghost btn-xs" title="Eliminar del catálogo" style="color:var(--rojo);padding:2px 6px" data-ctabla="flotillas" data-ckey="nombre" data-cval="${escapeHtml(c.nombre)}" data-cref="${tipo}" data-cnombre="${escapeHtml(c.nombre)}" onclick="event.stopPropagation();_eliminarContactoOrg(this)">🗑</button>` : ''}
      </div>
    </div>
    <div class="aseg-comp-nums">
      <div><span class="n">${c.count}</span><span class="t">órdenes</span></div>
      <div><span class="n" style="color:#2563EB">${c.act}</span><span class="t">activas</span></div>
    </div>
    <div class="aseg-comp-chips">
      <span class="aseg-chip" style="background:#ECFEFF;color:#0E7490">💵 ${_carFmt(c.fact)}</span>
      ${c.ent ? `<span class="aseg-chip" style="background:#E6F5EF;color:#059669">✅ ${c.ent} entreg.</span>` : ''}
      ${c.ciclo != null ? `<span class="aseg-chip" style="background:#F5F3FF;color:#5B21B6">⏱ ${c.ciclo}d ciclo</span>` : ''}
    </div>
    <div class="aseg-comp-go" style="color:${cfg.color}">Ver órdenes →</div>
  </div>`;
}

function _carteraFichaHtml(tipo, nombre) {
  const cfg = _carteraConfig(tipo);
  const a = _carteraCat[tipo][(nombre || '').trim().toLowerCase()];
  const ords = _carteraCache[tipo].filter(o => cfg.nombre(o) === nombre);
  const act = ords.filter(o => o.estado === 'Activa').length;
  const ent = ords.filter(o => o.entregada_en).length;
  const fact = ords.reduce((s,o) => s + (_carteraVal[tipo][o.id] || 0), 0);
  const datos = a ? [a.nit ? 'NIT ' + escapeHtml(a.nit) : '', a.telefono ? '📞 ' + escapeHtml(a.telefono) : '', a.correo ? '✉ ' + escapeHtml(a.correo) : ''].filter(Boolean).join('  ·  ') : '';

  const personas = (a && Array.isArray(a.personas)) ? a.personas : [];
  return `<div class="aseg-ficha-card" style="border-left-color:${cfg.color}">
    <div class="aseg-ficha-head">
      <div style="min-width:0">
        <div class="aseg-ficha-nombre" style="color:${cfg.color}">${cfg.icon} ${escapeHtml(nombre)}</div>
        ${datos ? `<div class="aseg-ficha-sub">${datos}</div>` : ''}
      </div>
      ${a && a.id != null ? `<div style="display:flex;gap:6px;flex-shrink:0">
        <button class="btn btn-ghost btn-sm" data-ctabla="flotillas" data-ckey="id" data-cval="${a.id}" data-cfield="personas" data-cref="${tipo}" data-cnombre="${escapeHtml(nombre)}" onclick="abrirEditarContactoOrg(this)">✏️ Editar</button>
        <button class="btn btn-ghost btn-sm" style="color:var(--rojo)" data-ctabla="flotillas" data-ckey="id" data-cval="${a.id}" data-cref="${tipo}" data-cnombre="${escapeHtml(nombre)}" onclick="_eliminarContactoOrg(this)">🗑 Eliminar</button>
      </div>` : ''}
    </div>
    ${personas.length ? `<div style="display:flex;flex-wrap:wrap;gap:4px;margin-top:8px">${personas.map(p => `<span class="aseg-chip" style="background:#F5F3FF;color:#5B21B6">👤 ${escapeHtml(p.nombre || '—')}${p.telefono ? ' · ' + escapeHtml(p.telefono) : ''}${p.correo ? ' · ' + escapeHtml(p.correo) : ''}</span>`).join('')}</div>` : ''}
    <div class="aseg-ficha-stats">
      <div><div class="v">${ords.length}</div><div class="l">Órdenes totales</div></div>
      <div><div class="v" style="color:#2563EB">${act}</div><div class="l">Activas</div></div>
      <div><div class="v" style="color:#059669">${ent}</div><div class="l">Entregadas</div></div>
      <div><div class="v" style="color:${cfg.color}">${_carFmt(fact)}</div><div class="l">Facturado</div></div>
    </div>
  </div>`;
}

function filtrarCarteraComp(tipo) {
  const q = (document.getElementById('cartera-buscarcomp-' + tipo)?.value || '').toLowerCase().trim();
  document.querySelectorAll('#cartera-comp-' + tipo + ' .aseg-comp-card').forEach(card => {
    const nombre = (card.dataset.nombre || '').toLowerCase();
    card.style.display = (!q || nombre.includes(q)) ? '' : 'none';
  });
}

function filtrarCarteraOrdenes(tipo) {
  const cfg = _carteraConfig(tipo);
  const q = (document.getElementById('cartera-buscar-' + tipo)?.value || '').toLowerCase().trim();
  const est = document.getElementById('cartera-estado-' + tipo)?.value || '';
  const data = _carteraCache[tipo].filter(o => {
    if (cfg.nombre(o) !== _carteraSel[tipo]) return false;
    if (est === 'Activa' && o.estado !== 'Activa') return false;
    if (est === 'Entregada' && !o.entregada_en) return false;
    if (q && ![o.placa, o.propietario, o.marca, o.linea].some(f => (f||'').toLowerCase().includes(q))) return false;
    return true;
  });
  renderListaCarteraOrdenes(tipo, data);
}

function renderListaCarteraOrdenes(tipo, data) {
  const cont = document.getElementById('cartera-lista-' + tipo);
  if (!cont) return;
  if (!data.length) { cont.innerHTML = '<div class="empty-state"><div class="empty-state-icon">📋</div><p>Sin órdenes en este filtro.</p></div>'; return; }
  const cfg = _carteraConfig(tipo);
  const today = new Date();
  const html = '<div class="aseg-cards-grid">' + data.map(o => {
    const dias = o.creado_en ? Math.floor((today - new Date(o.creado_en)) / 86400000) : 0;
    const etapa = _carteraEtapa[tipo][o.id] || (o.entregada_en ? 'Entregada' : o.pulmon ? 'En pulmón' : '—');
    const tot = _carteraProg[tipo].tot[o.id] || 0, fin = _carteraProg[tipo].fin[o.id] || 0;
    const fact = _carteraVal[tipo][o.id] || 0;
    const estCol = o.entregada_en ? '#16A34A' : o.pulmon ? '#D97706' : '#2563EB';
    const estTxt = o.entregada_en ? 'Entregada' : o.pulmon ? 'En pulmón' : 'Activa';
    return `<div class="aseg-card hover-lift" data-id="${o.id}" style="--ac:${estCol}" onclick="abrirOrden(${o.id})">
      <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px">
        <div style="flex:1;min-width:0">
          <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:3px">
            <span class="aseg-placa">${escapeHtml(o.placa||'—')}</span>
            <span class="aseg-ot">${otDe(o)}</span>
          </div>
          <div class="aseg-meta">${[o.marca,o.linea].filter(Boolean).map(escapeHtml).join(' ') || '—'}${o.modelo ? ' · ' + escapeHtml(o.modelo) : ''}</div>
          <div class="aseg-aseg" style="color:${cfg.color}">${cfg.icon} ${escapeHtml(cfg.nombre(o))}</div>
        </div>
        <div style="display:flex;flex-direction:column;align-items:flex-end;gap:4px;flex-shrink:0">
          <span class="aseg-chip" style="background:#EEF2FF;color:${estCol}"><span style="width:6px;height:6px;border-radius:50%;background:currentColor;flex-shrink:0"></span>${estTxt}</span>
          <span style="font-size:11px;color:var(--gris-mid)">${dias}d en sistema</span>
        </div>
      </div>
      <div class="aseg-money">
        <span class="aseg-chip" style="background:#ECFEFF;color:#0E7490">💵 ${fact > 0 ? _carFmt(fact) : '—'}</span>
        <span class="aseg-chip" style="background:var(--gris-bg);color:var(--gris-mid)">⚙️ ${escapeHtml(String(etapa))}${tot ? ` · ${fin}/${tot}` : ''}</span>
      </div>
    </div>`;
  }).join('') + '</div>';
  renderSinParpadeo(cont, html);
}

// ═══════════════════════════════════════════════════════════
// EDITAR CONTACTO desde la ficha (aseguradora / flotilla / empresa)
// Modal compartido: edita teléfono, correo y la lista de personas de contacto.
//   · Aseguradoras → tabla /aseguradoras (clave nombre), campo "contactos".
//   · Flotillas/Empresas → tabla /flotillas (clave id), campo "personas".
// Guarda campo por campo (best-effort): si una columna no existe aún (falta el
// SQL), el resto igual se guarda y avisamos cuál falló.
// ═══════════════════════════════════════════════════════════
let _contactoOrgPersonas = [];

function _coRenderPersonas() {
  const cont = document.getElementById('co-personas-list');
  if (!cont) return;
  cont.innerHTML = _contactoOrgPersonas.length
    ? _contactoOrgPersonas.map((p, i) => `
        <div data-pi="${i}" style="display:flex;gap:5px;margin-bottom:6px">
          <input class="co-p-nom" placeholder="Nombre" value="${escapeHtml(p.nombre || '')}" style="flex:2;min-width:0;padding:7px 9px;border:1px solid var(--gris-borde);border-radius:6px;font-size:12.5px">
          <input class="co-p-tel" placeholder="Teléfono" value="${escapeHtml(p.telefono || '')}" style="flex:1;min-width:0;padding:7px 9px;border:1px solid var(--gris-borde);border-radius:6px;font-size:12.5px">
          <input class="co-p-cor" placeholder="Correo" value="${escapeHtml(p.correo || '')}" style="flex:1.5;min-width:0;padding:7px 9px;border:1px solid var(--gris-borde);border-radius:6px;font-size:12.5px">
          <button onclick="_coDelPersona(${i})" title="Quitar" style="flex-shrink:0;background:none;border:1px solid #FECACA;color:#DC2626;border-radius:6px;padding:0 9px;cursor:pointer;font-size:13px">✕</button>
        </div>`).join('')
    : '<div style="font-size:12px;color:var(--gris-mid);padding:4px 0">Sin personas de contacto. Agrega una abajo.</div>';
}
function _coSync() {
  const cont = document.getElementById('co-personas-list');
  if (!cont) return;
  _contactoOrgPersonas = [...cont.querySelectorAll('[data-pi]')].map(row => ({
    nombre:   row.querySelector('.co-p-nom').value.trim(),
    telefono: row.querySelector('.co-p-tel').value.trim(),
    correo:   row.querySelector('.co-p-cor').value.trim()
  }));
}
function _coAddPersona() { _coSync(); _contactoOrgPersonas.push({ nombre: '', telefono: '', correo: '' }); _coRenderPersonas(); }
function _coDelPersona(i) { _coSync(); _contactoOrgPersonas.splice(i, 1); _coRenderPersonas(); }

async function abrirEditarContactoOrg(btn) {
  const tabla = btn.dataset.ctabla, ckey = btn.dataset.ckey, cval = btn.dataset.cval, cfield = btn.dataset.cfield, cref = btn.dataset.cref;
  const nombre = btn.dataset.cnombre || '';
  // Traer fila actual para precargar.
  let fila = {};
  try {
    const r = await api(`/${tabla}?${ckey}=eq.${encodeURIComponent(cval)}&limit=1`);
    fila = (r && r[0]) || {};
  } catch (e) { /* sigue con vacíos */ }
  let personas = [];
  try { const raw = fila[cfield]; personas = Array.isArray(raw) ? raw : (typeof raw === 'string' && raw ? JSON.parse(raw) : []); } catch (e) { personas = []; }
  _contactoOrgPersonas = personas.map(p => ({ nombre: p.nombre || '', telefono: p.telefono || '', correo: p.correo || '' }));

  document.getElementById('modal-contacto-org')?.remove();
  const ov = document.createElement('div');
  ov.id = 'modal-contacto-org';
  ov.dataset.ctabla = tabla; ov.dataset.ckey = ckey; ov.dataset.cval = cval; ov.dataset.cfield = cfield; ov.dataset.cref = cref;
  ov.style.cssText = 'position:fixed;inset:0;z-index:10001;background:rgba(0,0,0,.45);display:flex;align-items:center;justify-content:center;padding:18px';
  ov.innerHTML = `
    <div style="background:#fff;border-radius:14px;max-width:520px;width:100%;max-height:88vh;overflow:auto;padding:20px;box-shadow:0 10px 40px rgba(0,0,0,.25);font-family:'DM Sans',sans-serif">
      <div style="font-size:16px;font-weight:800;color:var(--azul);margin-bottom:2px">Editar datos</div>
      <div style="font-size:12px;color:var(--gris-mid);margin-bottom:14px">${escapeHtml(nombre)}</div>
      <div style="display:flex;gap:8px;margin-bottom:10px">
        <div style="flex:1;min-width:0">
          <label style="font-size:11px;font-weight:700;color:var(--gris-mid);display:block;margin-bottom:4px">NIT</label>
          <input id="co-nit" value="${escapeHtml(fila.nit || '')}" placeholder="900.123.456-7" style="width:100%;box-sizing:border-box;padding:8px 10px;border:1px solid var(--gris-borde);border-radius:7px;font-size:13px">
        </div>
        <div style="flex:1.6;min-width:0">
          <label style="font-size:11px;font-weight:700;color:var(--gris-mid);display:block;margin-bottom:4px">Dirección</label>
          <input id="co-dir" value="${escapeHtml(fila.direccion || '')}" placeholder="Dirección" style="width:100%;box-sizing:border-box;padding:8px 10px;border:1px solid var(--gris-borde);border-radius:7px;font-size:13px">
        </div>
      </div>
      <div style="display:flex;gap:8px;margin-bottom:12px">
        <div style="flex:1;min-width:0">
          <label style="font-size:11px;font-weight:700;color:var(--gris-mid);display:block;margin-bottom:4px">Teléfono</label>
          <input id="co-tel" type="tel" value="${escapeHtml(fila.telefono || '')}" placeholder="3001234567" style="width:100%;box-sizing:border-box;padding:8px 10px;border:1px solid var(--gris-borde);border-radius:7px;font-size:13px">
        </div>
        <div style="flex:1.6;min-width:0">
          <label style="font-size:11px;font-weight:700;color:var(--gris-mid);display:block;margin-bottom:4px">Correo</label>
          <input id="co-cor" type="email" value="${escapeHtml(fila.correo || '')}" placeholder="correo@empresa.com" style="width:100%;box-sizing:border-box;padding:8px 10px;border:1px solid var(--gris-borde);border-radius:7px;font-size:13px">
        </div>
      </div>
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px">
        <label style="font-size:11px;font-weight:700;color:var(--gris-mid)">Personas de contacto</label>
        <button class="btn btn-ghost btn-sm" onclick="_coAddPersona()">+ Agregar persona</button>
      </div>
      <div id="co-personas-list"></div>
      <div style="display:flex;gap:8px;margin-top:16px;justify-content:flex-end">
        <button class="btn btn-ghost btn-sm" onclick="document.getElementById('modal-contacto-org').remove()">Cancelar</button>
        <button class="btn btn-primary btn-sm" onclick="_guardarContactoOrg()">Guardar</button>
      </div>
    </div>`;
  ov.addEventListener('click', e => { if (e.target === ov) ov.remove(); });
  document.body.appendChild(ov);
  _coRenderPersonas();
}

async function _guardarContactoOrg() {
  const m = document.getElementById('modal-contacto-org');
  if (!m) return;
  const { ctabla, ckey, cval, cfield, cref } = m.dataset;
  _coSync();
  const nit = document.getElementById('co-nit')?.value.trim() || null;
  const dir = document.getElementById('co-dir')?.value.trim() || null;
  const tel = document.getElementById('co-tel')?.value.trim() || null;
  const cor = document.getElementById('co-cor')?.value.trim() || null;
  const personas = _contactoOrgPersonas.filter(p => p.nombre || p.telefono || p.correo);
  const where = `/${ctabla}?${ckey}=eq.${encodeURIComponent(cval)}`;

  const fallaron = [];
  const patch = async (obj, etiqueta) => {
    try { await api(where, 'PATCH', obj); } catch (e) { fallaron.push(etiqueta); }
  };
  await patch({ nit: nit }, 'NIT');
  await patch({ direccion: dir }, 'dirección');
  await patch({ telefono: tel }, 'teléfono');
  await patch({ correo: cor }, 'correo');
  await patch({ [cfield]: personas }, 'personas');

  m.remove();
  if (fallaron.length) {
    toast('Guardado parcial. No se pudo guardar: ' + fallaron.join(', ') + (fallaron.includes('personas') ? ' (¿falta correr el SQL de personas/contactos?)' : ''), 'err');
  } else {
    toast('Contacto actualizado ✓');
  }
  // Refrescar la vista correspondiente.
  _refrescarVistaOrg(cref);
}

function _refrescarVistaOrg(cref) {
  if (cref === 'aseg') { if (typeof cargarModuloAseguradoras === 'function') cargarModuloAseguradoras(); else if (typeof montarAseguradoras === 'function') montarAseguradoras(); }
  else if (typeof cargarCarteraCliente === 'function') cargarCarteraCliente(cref);
}

// Elimina la organización del catálogo (aseguradora / flotilla / empresa). NO
// borra las órdenes — solo el registro con sus datos de contacto. Pide confirmar.
async function _eliminarContactoOrg(btn) {
  const { ctabla, ckey, cval, cref, cnombre } = btn.dataset;
  if (!confirm(`¿Eliminar "${cnombre || ''}" del catálogo?\n\nSe borran sus datos de contacto (NIT, teléfono, personas...). Las órdenes NO se borran.`)) return;
  try {
    await api(`/${ctabla}?${ckey}=eq.${encodeURIComponent(cval)}`, 'DELETE');
    toast('Eliminado ✓');
    _refrescarVistaOrg(cref);
  } catch (e) {
    toast('Error eliminando: ' + e.message, 'err');
  }
}
