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

// ═══════════════════════════════════════════════════════════
// PANTALLA "ORGANIZACIONES" — Aseguradoras / Flotillas / Empresas en pestañas.
// Reemplaza el antiguo grupo "Carteras" de la barra lateral. Reutiliza los
// módulos existentes renderizando cada uno en su panel (mismos IDs que antes).
// ═══════════════════════════════════════════════════════════
function montarOrganizaciones(tab) {
  const pag = document.getElementById('pag-organizaciones');
  if (!pag) return;
  if (!document.getElementById('org-panel-host')) {
    pag.innerHTML = `
      <div style="padding:16px 20px 0">
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:14px">
          <button class="filtro-btn" id="org-tab-aseguradora" onclick="orgTab('aseguradora')">🛡️ Aseguradoras</button>
          <button class="filtro-btn" id="org-tab-flotilla" onclick="orgTab('flotilla')">🚚 Flotillas</button>
          <button class="filtro-btn" id="org-tab-empresa" onclick="orgTab('empresa')">🏢 Empresas</button>
        </div>
      </div>
      <div id="org-panel-host">
        <div id="pag-aseguradoras" class="org-panel"></div>
        <div id="pag-cartera-flotillas" class="org-panel" style="display:none"></div>
        <div id="pag-cartera-empresas" class="org-panel" style="display:none"></div>
      </div>`;
  }
  orgTab(tab || 'aseguradora');
}

function orgTab(tipo) {
  const map = { aseguradora: 'pag-aseguradoras', flotilla: 'pag-cartera-flotillas', empresa: 'pag-cartera-empresas' };
  ['aseguradora', 'flotilla', 'empresa'].forEach(t => {
    const btn = document.getElementById('org-tab-' + t);
    if (btn) btn.classList.toggle('active', t === tipo);
    const pan = document.getElementById(map[t]);
    if (pan) pan.style.display = t === tipo ? '' : 'none';
  });
  if (tipo === 'aseguradora') {
    if (typeof resetVistaAseguradoras === 'function') resetVistaAseguradoras();
    if (typeof cargarModuloAseguradoras === 'function') cargarModuloAseguradoras();
    else if (typeof montarAseguradoras === 'function') montarAseguradoras();
  } else if (tipo === 'flotilla') {
    if (typeof resetVistaCartera === 'function') resetVistaCartera('flotilla');
    if (typeof montarCarteraFlotillas === 'function') montarCarteraFlotillas();
  } else {
    if (typeof resetVistaCartera === 'function') resetVistaCartera('empresa');
    if (typeof montarCarteraEmpresas === 'function') montarCarteraEmpresas();
  }
}

// Abre el formulario de registro de una nueva flotilla/empresa.
function crearOrgCartera(tipo) { abrirNuevaOrg(tipo); }

// ═══════════════════════════════════════════════════════════
// FORMULARIO DE REGISTRO — Nueva flotilla / empresa / aseguradora
// Pide: Nombre*, NIT, Dirección, Teléfono, Correo. Guarda en su catálogo
// (/flotillas para flotilla y empresa, /aseguradoras para aseguradora). Los
// campos opcionales se guardan best-effort por si falta alguna columna.
// ═══════════════════════════════════════════════════════════
function abrirNuevaOrg(tipo) {
  const meta = {
    flotilla:    { tabla: 'flotillas',    titulo: 'Nueva flotilla',    cref: 'flotilla'    },
    empresa:     { tabla: 'flotillas',    titulo: 'Nueva empresa',     cref: 'empresa'     },
    aseguradora: { tabla: 'aseguradoras', titulo: 'Nueva aseguradora', cref: 'aseg'        }
  }[tipo];
  if (!meta) return;

  document.getElementById('modal-nueva-org')?.remove();
  const ov = document.createElement('div');
  ov.id = 'modal-nueva-org';
  ov.dataset.tabla = meta.tabla; ov.dataset.cref = meta.cref;
  ov.style.cssText = 'position:fixed;inset:0;z-index:10001;background:rgba(0,0,0,.45);display:flex;align-items:center;justify-content:center;padding:18px';
  const f = (id, label, ph, type) => `
    <div class="field">
      <label style="font-size:11px;font-weight:700;color:var(--gris-mid);display:block;margin-bottom:4px">${label}</label>
      <input id="${id}" ${type ? `type="${type}"` : ''} placeholder="${ph}" style="width:100%;box-sizing:border-box;padding:8px 10px;border:1px solid var(--gris-borde);border-radius:7px;font-size:13px">
    </div>`;
  ov.innerHTML = `
    <div style="background:var(--surface);border-radius:14px;max-width:480px;width:100%;max-height:88vh;overflow:auto;padding:20px;box-shadow:0 10px 40px rgba(0,0,0,.25);font-family:'DM Sans',sans-serif">
      <div style="font-size:16px;font-weight:800;color:var(--azul);margin-bottom:14px">${meta.titulo}</div>
      <div style="display:flex;flex-direction:column;gap:11px">
        ${f('no-nombre', 'Nombre *', tipo === 'empresa' ? 'Razón social' : 'Nombre')}
        <div style="display:flex;gap:8px">
          <div style="flex:1;min-width:0">${f('no-nit', 'NIT', '900.123.456-7')}</div>
          <div style="flex:1.4;min-width:0">${f('no-tel', 'Teléfono', '3001234567', 'tel')}</div>
        </div>
        ${f('no-dir', 'Dirección', 'Dirección')}
        ${f('no-cor', 'Correo', 'correo@empresa.com', 'email')}
      </div>
      <div style="display:flex;gap:8px;margin-top:18px;justify-content:flex-end">
        <button class="btn btn-ghost btn-sm" onclick="document.getElementById('modal-nueva-org').remove()">Cancelar</button>
        <button class="btn btn-primary btn-sm" onclick="_guardarNuevaOrg()">Guardar</button>
      </div>
    </div>`;
  ov.addEventListener('click', e => { if (e.target === ov) ov.remove(); });
  document.body.appendChild(ov);
  setTimeout(() => document.getElementById('no-nombre')?.focus(), 30);
}

async function _guardarNuevaOrg() {
  const m = document.getElementById('modal-nueva-org');
  if (!m) return;
  const { tabla, cref } = m.dataset;
  const val = id => document.getElementById(id)?.value.trim() || null;
  const nombre = val('no-nombre');
  if (!nombre) { toast('El nombre es obligatorio', 'err'); return; }
  const nit = val('no-nit'), dir = val('no-dir'), tel = val('no-tel'), cor = val('no-cor');
  try {
    // Si ya existe una con ese nombre (la tabla tiene nombre único), NO la creamos
    // de nuevo (eso daba "duplicate key"): la reutilizamos y completamos sus datos.
    const existe = await api(`/${tabla}?nombre=eq.${encodeURIComponent(nombre)}&select=nombre&limit=1`).then(r => r && r.length).catch(() => false);
    if (!existe) {
      await api(`/${tabla}`, 'POST', { nombre, activo: true }, { Prefer: 'return=minimal' });
    }
    const where = `/${tabla}?nombre=eq.${encodeURIComponent(nombre)}`;
    const fallaron = [];
    const patch = async (obj, et) => { try { await api(where, 'PATCH', obj); } catch (e) { fallaron.push(et); } };
    // En /flotillas marcamos el tipo (flotilla/empresa) para que aparezca en su
    // pestaña aunque todavía no tenga órdenes. cref ya es 'flotilla' o 'empresa'.
    if (tabla === 'flotillas') await patch({ tipo: cref }, 'tipo');
    await patch({ nit }, 'NIT');
    await patch({ direccion: dir }, 'dirección');
    await patch({ telefono: tel }, 'teléfono');
    await patch({ correo: cor }, 'correo');
    m.remove();
    toast(fallaron.length ? (existe ? 'Actualizado' : 'Creado') + '. No se guardó: ' + fallaron.join(', ') : (existe ? 'Actualizado ✓' : 'Creado ✓'));
    _refrescarVistaOrg(cref);
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
    }).filter(c => c.count > 0);

    // Incluir las organizaciones del catálogo de ESTE tipo que aún no tienen
    // órdenes (las recién creadas), para que aparezcan de una vez en su pestaña.
    const _conOrden = new Set(companias.map(c => (c.nombre||'').trim().toLowerCase()));
    catalogo.forEach(cat => {
      if (cat.tipo !== tipo) return;                 // solo del tipo correcto
      const k = (cat.nombre||'').trim().toLowerCase();
      if (!k || _conOrden.has(k)) return;
      companias.push({ nombre: cat.nombre, count:0, act:0, ent:0, fact:0, ciclo:null, enCat:true });
    });
    companias.sort((a,b) => b.act - a.act || b.count - a.count);

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
            <select id="cartera-estado-${tipo}" onchange="filtrarCarteraOrdenes('${tipo}')" class="aseg-input" style="background:var(--surface)">
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
        <button class="btn btn-ghost btn-xs" title="Eliminar" style="color:var(--rojo);padding:2px 6px" data-ctabla="flotillas" data-ckey="nombre" data-cval="${escapeHtml(c.nombre)}" data-cref="${tipo}" data-cnombre="${escapeHtml(c.nombre)}" onclick="event.stopPropagation();_eliminarContactoOrg(this)">🗑</button>
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
      <div style="display:flex;gap:6px;flex-shrink:0">
        <button class="btn btn-ghost btn-sm" data-ctabla="flotillas" data-ckey="nombre" data-cval="${escapeHtml(nombre)}" data-cfield="personas" data-cref="${tipo}" data-cnombre="${escapeHtml(nombre)}" onclick="abrirEditarContactoOrg(this)">✏️ Editar</button>
        <button class="btn btn-ghost btn-sm" style="color:var(--rojo)" data-ctabla="flotillas" data-ckey="nombre" data-cval="${escapeHtml(nombre)}" data-cref="${tipo}" data-cnombre="${escapeHtml(nombre)}" onclick="_eliminarContactoOrg(this)">🗑 Eliminar</button>
      </div>
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
    <div style="background:var(--surface);border-radius:14px;max-width:520px;width:100%;max-height:88vh;overflow:auto;padding:20px;box-shadow:0 10px 40px rgba(0,0,0,.25);font-family:'DM Sans',sans-serif">
      <div style="font-size:16px;font-weight:800;color:var(--azul);margin-bottom:12px">Editar datos</div>
      <div style="margin-bottom:10px">
        <label style="font-size:11px;font-weight:700;color:var(--gris-mid);display:block;margin-bottom:4px">Nombre</label>
        <input id="co-nombre" value="${escapeHtml(fila.nombre || nombre || '')}" placeholder="Nombre de la organización" style="width:100%;box-sizing:border-box;padding:8px 10px;border:1px solid var(--gris-borde);border-radius:7px;font-size:13px;font-weight:600">
      </div>
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
  const { ctabla, cval, cfield, cref } = m.dataset;   // cval = nombre original
  _coSync();
  const nuevoNombre = document.getElementById('co-nombre')?.value.trim() || cval;
  const nit = document.getElementById('co-nit')?.value.trim() || null;
  const dir = document.getElementById('co-dir')?.value.trim() || null;
  const tel = document.getElementById('co-tel')?.value.trim() || null;
  const cor = document.getElementById('co-cor')?.value.trim() || null;
  const personas = _contactoOrgPersonas.filter(p => p.nombre || p.telefono || p.correo);
  const esFlot = ctabla === 'flotillas' && cref !== 'aseg';

  // Asegurar que exista el registro (puede venir solo de órdenes, sin catálogo).
  try {
    const existe = await api(`/${ctabla}?nombre=eq.${encodeURIComponent(cval)}&select=nombre&limit=1`).then(r => r && r.length).catch(() => false);
    if (!existe) {
      const base = { nombre: cval, activo: true };
      if (esFlot) base.tipo = cref;
      await api(`/${ctabla}`, 'POST', base, { Prefer: 'return=minimal' });
    }
  } catch (e) { /* los PATCH siguientes avisan si algo falla */ }

  const where = `/${ctabla}?nombre=eq.${encodeURIComponent(cval)}`;
  const fallaron = [];
  const patch = async (obj, etiqueta) => {
    try { await api(where, 'PATCH', obj); } catch (e) { fallaron.push(etiqueta); }
  };
  if (esFlot) await patch({ tipo: cref }, 'tipo');
  await patch({ nit: nit }, 'NIT');
  await patch({ direccion: dir }, 'dirección');
  await patch({ telefono: tel }, 'teléfono');
  await patch({ correo: cor }, 'correo');
  await patch({ [cfield]: personas }, 'personas');

  // Cambio de nombre: renombra el registro y actualiza las órdenes que lo usan
  // (las órdenes referencian la organización por el campo "aseguradora").
  let renombrado = true;
  if (nuevoNombre && nuevoNombre !== cval) {
    try {
      await api(where, 'PATCH', { nombre: nuevoNombre });
      try { await api(`/ordenes?aseguradora=eq.${encodeURIComponent(cval)}`, 'PATCH', { aseguradora: nuevoNombre }); } catch (e) {}
    } catch (e) { renombrado = false; }
  }

  m.remove();
  if (!renombrado) {
    toast('Datos guardados, pero ese nombre ya existe (no se cambió el nombre).', 'err');
  } else if (fallaron.length) {
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

// Elimina la organización. Borra su registro del catálogo y, si tiene órdenes,
// las DESVINCULA (pasan a "Particular", NO se borran) para que desaparezca de la
// lista (que se arma desde las órdenes). Pide confirmar en cada caso.
async function _eliminarContactoOrg(btn) {
  const { ctabla, cval, cref, cnombre } = btn.dataset;
  const nombre = cval;
  if (!confirm(`¿Eliminar "${cnombre || nombre}"?\n\nSe borra su registro (NIT, teléfono, contactos...). Las órdenes NO se borran.`)) return;
  try {
    // ¿Tiene órdenes asignadas? Se referencian por "aseguradora"; en empresas/
    // flotillas a veces el nombre quedó en "propietario" (sin aseguradora).
    const enc = encodeURIComponent(nombre);
    let ords = await api(`/ordenes?aseguradora=eq.${enc}&select=id&limit=1`).catch(() => []) || [];
    if (!ords.length && cref !== 'aseg') {
      ords = await api(`/ordenes?tipo_cliente=eq.${cref}&propietario=eq.${enc}&aseguradora=is.null&select=id&limit=1`).catch(() => []) || [];
    }
    let desvincular = false;
    if (ords.length) {
      desvincular = confirm(`"${cnombre || nombre}" tiene órdenes asignadas.\n\nPara que desaparezca del listado, esas órdenes pasarán a "Particular" (NO se borran, solo se les quita la organización). ¿Continuar?`);
      if (!desvincular) return;  // si no quiere desvincular, no tiene sentido borrar el catálogo y que siga apareciendo
    }
    // Borrar el registro del catálogo (si existe).
    await api(`/${ctabla}?nombre=eq.${enc}`, 'DELETE').catch(() => {});
    // Desvincular las órdenes para que la organización deje de aparecer.
    if (desvincular) {
      try { await api(`/ordenes?aseguradora=eq.${enc}`, 'PATCH', { aseguradora: null, tipo_cliente: 'particular' }); } catch (e) {}
      if (cref !== 'aseg') {
        try { await api(`/ordenes?tipo_cliente=eq.${cref}&propietario=eq.${enc}&aseguradora=is.null`, 'PATCH', { tipo_cliente: 'particular' }); } catch (e) {}
      }
    }
    toast('Eliminado ✓');
    _refrescarVistaOrg(cref);
  } catch (e) {
    toast('Error eliminando: ' + e.message, 'err');
  }
}
