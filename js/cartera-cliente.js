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
  return { tipo, pagId:'pag-cartera-empresas', titulo:'Empresas', plural:'empresas', singular:'empresa',
           icon:'🏢', color:'#0891B2', catalog:'/flotillas', nombre: o => o.propietario || 'Sin empresa' };
}

const _carFmt = n => n != null ? new Intl.NumberFormat('es-CO',{style:'currency',currency:'COP',minimumFractionDigits:0}).format(Math.round(n)) : '$0';

// ─── Entradas / navegación ──────────────────────────────────
function montarCarteraFlotillas() { _carteraSel.flotilla = null; cargarCarteraCliente('flotilla'); }
function montarCarteraEmpresas()  { _carteraSel.empresa  = null; cargarCarteraCliente('empresa'); }
function abrirCartera(tipo, nombre) { _carteraSel[tipo] = nombre; cargarCarteraCliente(tipo); }
function volverCartera(tipo)        { _carteraSel[tipo] = null;   cargarCarteraCliente(tipo); }
function resetVistaCartera(tipo)    { _carteraSel[tipo] = null; }

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
      ${c.enCat ? '' : '<span class="aseg-comp-flag">sin datos</span>'}
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

  return `<div class="aseg-ficha-card" style="border-left-color:${cfg.color}">
    <div class="aseg-ficha-head">
      <div style="min-width:0">
        <div class="aseg-ficha-nombre" style="color:${cfg.color}">${cfg.icon} ${escapeHtml(nombre)}</div>
        ${datos ? `<div class="aseg-ficha-sub">${datos}</div>` : ''}
      </div>
    </div>
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
            <span class="aseg-ot">${formatOT(o.id)}</span>
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
