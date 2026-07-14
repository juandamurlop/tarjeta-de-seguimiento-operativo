// ═══════════════════════════════════════════════════════════
// MÓDULO CAJA — control de caja diario, movimientos y caja menor.
// Vista nativa del sistema (como Reportes). Usa api()/storageUpload del core,
// NO el SDK supabase-js. Todo va namespaced bajo `Caja` para no colisionar con
// las funciones globales de la app. Acceso: solo gerente por ahora.
// ═══════════════════════════════════════════════════════════
const Caja = (function () {
  const CATS = {
    egreso:  ['Repuestos', 'Materiales', 'Servicios externos', 'Viáticos', 'Anticipo caja menor', 'Arriendo / servicios', 'Otro'],
    ingreso: ['Pago cliente', 'Abono seguro', 'Vuelto anticipo', 'Préstamo interno', 'Otro ingreso']
  };

  let movHoy = [], apertura = null, histData = [], anticiposData = [];
  let anticipoIdPendiente = null;
  let egresoIdPendiente = null;
  let _ordenSel = null, _ordenTimer = null;

  // ── UTILS ──────────────────────────────────────────────────
  const $ = k => document.getElementById('cj-' + k);
  const esc = s => (typeof escapeHtml === 'function' ? escapeHtml(String(s ?? '')) : String(s ?? ''));
  const fmt = n => '$' + Math.round(n || 0).toLocaleString('es-CO');
  const hoyISO = () => new Date().toISOString().slice(0, 10);
  const horaLocal = () => new Date().toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });
  function fechaLeg(iso) {
    if (!iso) return '';
    const [y, m, d] = iso.split('-');
    const ms = ['', 'ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
    return `${d} ${ms[+m]} ${y}`;
  }
  function diasAtras(n) { const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString().slice(0, 10); }
  function usuarioActual() {
    if (typeof sesion === 'undefined' || !sesion) return '';
    return sesion.cedula ? `${sesion.cedula}@freimanautos.com` : (sesion.nombre || '');
  }
  const arr = r => Array.isArray(r) ? r : (r ? [r] : []);
  const first = r => arr(r)[0] || null;

  function toast(msg, tipo = 'ok') {
    const el = $('toast'); if (!el) return;
    el.textContent = msg;
    el.className = 'cj-toast show ' + (tipo === 'ok' ? 'ok' : 'bad');
    clearTimeout(el._t);
    el._t = setTimeout(() => { el.className = 'cj-toast'; }, 2800);
  }
  function setBtnLoading(k, loading, texto) {
    const btn = $(k); if (!btn) return;
    btn.disabled = loading;
    btn.innerHTML = loading ? `<span class="cj-spinner"></span>${texto || 'Guardando...'}` : (texto || btn._orig || btn.textContent);
    if (!btn._orig) btn._orig = btn.textContent;
  }

  // ── BÚSQUEDA DE ORDEN (para vincular pago) ─────────────────
  function _showOrdenSearch() {
    const show = $('m-tipo')?.value === 'ingreso' && $('m-cat')?.value === 'Pago cliente';
    const wrap = $('orden-search-wrap');
    if (wrap) wrap.style.display = show ? '' : 'none';
    if (!show) _limpiarOrden();
  }
  async function _buscarOrden(q) {
    const lista = $('orden-lista'); if (!lista) return;
    if (!q || q.trim().length < 2) { lista.style.display = 'none'; return; }
    clearTimeout(_ordenTimer);
    _ordenTimer = setTimeout(async () => {
      lista.innerHTML = '<div style="padding:8px 12px;font-size:13px;color:var(--cj-txt2)">Buscando...</div>';
      lista.style.display = 'block';
      const qe = encodeURIComponent(q.trim());
      const rows = arr(await api(`/ordenes?or=(placa.ilike.*${qe}*,propietario.ilike.*${qe}*,numero_ot.ilike.*${qe}*)&select=id,numero_ot,placa,propietario,marca,linea,estado&limit=8`).catch(() => []));
      if (!rows.length) { lista.innerHTML = '<div style="padding:8px 12px;font-size:13px;color:var(--cj-txt2)">Sin resultados</div>'; return; }
      lista.innerHTML = rows.map(o => `<div class="cj-ac-item" onclick="Caja._selOrden('${esc(o.id)}','${esc(o.numero_ot||'')}','${esc(o.placa||'')}','${esc(o.propietario||'')}','${esc(o.marca||'')} ${esc(o.linea||'')}')">
        <strong>${esc(o.numero_ot ? 'OT ' + o.numero_ot : o.placa)}</strong>
        <span style="color:var(--cj-txt2)"> · ${esc(o.placa)} · ${esc(o.propietario||'—')}</span>
        <span style="float:right;font-size:11px;color:var(--cj-txt2)">${esc(o.estado)}</span>
      </div>`).join('');
    }, 250);
  }
  function _selOrden(id, ot, placa, propietario, vehiculo) {
    _ordenSel = { id, ot, placa, propietario };
    if ($('orden-id')) $('orden-id').value = id;
    if ($('orden-ot')) $('orden-ot').value = ot;
    if ($('orden-q')) $('orden-q').value = '';
    const lista = $('orden-lista'); if (lista) lista.style.display = 'none';
    if ($('orden-sel-txt')) $('orden-sel-txt').textContent = `${ot ? 'OT ' + ot + ' · ' : ''}${placa} · ${propietario || vehiculo.trim()}`;
    if ($('orden-sel')) $('orden-sel').style.display = 'flex';
    if ($('m-desc') && !$('m-desc').value) $('m-desc').value = `Pago orden${ot ? ' ' + ot : ''} — ${placa}`;
  }
  function _limpiarOrden() {
    _ordenSel = null;
    ['orden-id','orden-ot','orden-q'].forEach(k => { if ($(k)) $(k).value = ''; });
    const lista = $('orden-lista'); if (lista) lista.style.display = 'none';
    if ($('orden-sel')) $('orden-sel').style.display = 'none';
  }

  // ── CATEGORÍAS ─────────────────────────────────────────────
  function updCats() {
    const t = $('m-tipo')?.value || 'egreso';
    if ($('m-cat')) $('m-cat').innerHTML = CATS[t].map(c => `<option>${esc(c)}</option>`).join('');
    _showOrdenSearch();
  }
  function poblarFiltrosCats() {
    const todas = [...CATS.egreso, ...CATS.ingreso];
    if ($('h-cat')) $('h-cat').innerHTML = '<option value="">Todas</option>' + todas.map(c => `<option>${esc(c)}</option>`).join('');
  }

  // ── DASHBOARD ──────────────────────────────────────────────
  async function cargarDashboard() {
    const hoy = hoyISO();
    const inicioMes = hoy.slice(0, 7) + '-01';
    const hace14 = diasAtras(14);

    const [apHoy, mes, flujoData] = await Promise.all([
      api(`/caja_aperturas?fecha=eq.${hoy}&select=saldo_inicial&limit=1`).catch(() => []),
      api(`/caja_movimientos?fecha=gte.${inicioMes}&fecha=lte.${hoy}`).catch(() => []),
      api(`/caja_movimientos?fecha=gte.${hace14}&fecha=lte.${hoy}&select=fecha,tipo,monto`).catch(() => [])
    ]);

    const ap = first(apHoy);
    const movMes = arr(mes);
    const ingMes = movMes.filter(m => m.tipo === 'ingreso').reduce((a, m) => a + Number(m.monto), 0);
    const egMes = movMes.filter(m => m.tipo === 'egreso').reduce((a, m) => a + Number(m.monto), 0);
    const ingHoy = movMes.filter(m => m.fecha === hoy && m.tipo === 'ingreso').reduce((a, m) => a + Number(m.monto), 0);
    const egHoy = movMes.filter(m => m.fecha === hoy && m.tipo === 'egreso').reduce((a, m) => a + Number(m.monto), 0);
    const saldoHoy = (Number(ap?.saldo_inicial) || 0) + ingHoy - egHoy;
    const balance = ingMes - egMes;

    if ($('d-saldo')) $('d-saldo').textContent = fmt(saldoHoy);
    if ($('d-saldo-sub')) $('d-saldo-sub').textContent = `Apertura: ${fmt(ap?.saldo_inicial || 0)}`;
    if ($('d-ing-mes')) $('d-ing-mes').textContent = fmt(ingMes);
    if ($('d-ing-sub')) $('d-ing-sub').textContent = movMes.filter(m => m.tipo === 'ingreso').length + ' movimientos';
    if ($('d-eg-mes')) $('d-eg-mes').textContent = fmt(egMes);
    if ($('d-eg-sub')) $('d-eg-sub').textContent = movMes.filter(m => m.tipo === 'egreso').length + ' movimientos';
    if ($('d-balance')) { $('d-balance').textContent = fmt(Math.abs(balance)); $('d-balance').style.color = balance >= 0 ? 'var(--cj-verde)' : 'var(--cj-rojo)'; }
    if ($('d-balance-sub')) $('d-balance-sub').textContent = balance >= 0 ? 'Superávit en el mes' : 'Déficit en el mes';

    // Flujo diario (barras CSS)
    const fd = arr(flujoData);
    const dias = [];
    for (let i = 13; i >= 0; i--) dias.push(diasAtras(i));
    const ingPD = dias.map(d => fd.filter(m => m.fecha === d && m.tipo === 'ingreso').reduce((a, m) => a + Number(m.monto), 0));
    const egPD = dias.map(d => fd.filter(m => m.fecha === d && m.tipo === 'egreso').reduce((a, m) => a + Number(m.monto), 0));
    renderFlujo(dias, ingPD, egPD);

    // Egresos por categoría
    const porCat = {};
    movMes.filter(m => m.tipo === 'egreso').forEach(m => { porCat[m.categoria] = (porCat[m.categoria] || 0) + Number(m.monto); });
    const sorted = Object.entries(porCat).sort((a, b) => b[1] - a[1]);
    const maxCat = sorted[0] ? sorted[0][1] : 1;
    if ($('cat-bars')) $('cat-bars').innerHTML = sorted.length
      ? `<div class="cat-bar-wrap">${sorted.map(([c, v]) => `<div class="cat-row"><div class="cat-label" title="${esc(c)}">${esc(c)}</div><div class="cat-track"><div class="cat-fill" style="width:${Math.round(v / maxCat * 100)}%"></div></div><div class="cat-amt">${fmt(v)}</div></div>`).join('')}</div>`
      : '<div class="empty">Sin egresos este mes</div>';

    // Últimos movimientos
    const ultimos = [...movMes].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 8);
    if ($('dash-ultimos')) $('dash-ultimos').innerHTML = ultimos.length
      ? `<table><thead><tr><th>Fecha</th><th>Hora</th><th>Tipo</th><th>Descripción</th><th>Responsable</th><th style="text-align:right">Monto</th></tr></thead>
        <tbody>${ultimos.map(m => `<tr>
          <td style="color:var(--cj-txt2);font-size:12px">${fechaLeg(m.fecha)}</td>
          <td style="color:var(--cj-txt2);font-size:12px">${esc(m.hora)}</td>
          <td><span class="tag ${m.tipo}">${esc(m.tipo)}</span></td>
          <td>${esc(m.descripcion)}</td>
          <td style="color:var(--cj-txt2)">${esc(m.responsable)}</td>
          <td style="text-align:right" class="${m.tipo === 'ingreso' ? 'pos' : 'neg'}">${m.tipo === 'ingreso' ? '+' : '-'}${fmt(m.monto)}</td>
        </tr>`).join('')}</tbody></table>`
      : '<div class="empty">Sin movimientos</div>';
  }

  function renderFlujo(dias, ingPD, egPD) {
    const el = $('flujo'); if (!el) return;
    const max = Math.max(1, ...ingPD, ...egPD);
    el.innerHTML = `<div class="flujo-bars">${dias.map((d, i) => {
      const [, mm, dd] = d.split('-');
      const hi = Math.round(ingPD[i] / max * 100), he = Math.round(egPD[i] / max * 100);
      return `<div class="flujo-day" title="${dd}/${mm} · +${fmt(ingPD[i])} / -${fmt(egPD[i])}">
        <div class="flujo-pair">
          <div class="flujo-bar ing" style="height:${hi}%"></div>
          <div class="flujo-bar eg" style="height:${he}%"></div>
        </div>
        <div class="flujo-lbl">${dd}/${mm}</div>
      </div>`;
    }).join('')}</div>
    <div class="flujo-leyenda"><span><i style="background:var(--cj-verde)"></i>Ingresos</span><span><i style="background:var(--cj-rojo)"></i>Egresos</span></div>`;
  }

  // ── CAJA HOY ───────────────────────────────────────────────
  async function cargarHoy() {
    const fecha = hoyISO();
    apertura = first(await api(`/caja_aperturas?fecha=eq.${fecha}&limit=1`).catch(() => []));

    const heroEstado = $('hero-estado');
    const apCard = $('apertura-card');
    if (apertura) {
      if (apCard) apCard.style.display = 'none';
      const cerrada = apertura.saldo_cierre != null;
      if (heroEstado) {
        heroEstado.textContent = cerrada ? 'Caja cerrada' : 'Caja abierta';
        heroEstado.style.background = cerrada ? 'rgba(239,68,68,0.25)' : 'rgba(76,175,80,0.3)';
      }
      const btnCierre = $('btn-cerrar-caja');
      if (btnCierre) btnCierre.style.display = cerrada ? 'none' : '';
      const formReg = $('card-registro');
      if (formReg) formReg.style.display = cerrada ? 'none' : '';
      const cierreInfo = $('cierre-info');
      if (cierreInfo) {
        cierreInfo.style.display = cerrada ? '' : 'none';
        if (cerrada) cierreInfo.innerHTML = `<div class="cj-alert info">Caja cerrada a las ${esc(apertura.hora_cierre||'—')} por ${esc(apertura.cerrada_por||'—')}. Conteo físico: ${fmt(apertura.saldo_cierre)} · Diferencia: <strong style="color:${(apertura.diferencia||0)>=0?'var(--cj-verde)':'var(--cj-rojo)'}">${fmt(Math.abs(apertura.diferencia||0))} ${(apertura.diferencia||0)>=0?'sobrante':'faltante'}</strong></div>`;
      }
    } else {
      if (apCard) apCard.style.display = 'block';
      if (heroEstado) { heroEstado.textContent = 'Sin abrir'; heroEstado.style.background = 'rgba(255,255,255,0.15)'; }
      const btnCierre = $('btn-cerrar-caja'); if (btnCierre) btnCierre.style.display = 'none';
      await preLlenarSaldoAnterior();
    }

    movHoy = arr(await api(`/caja_movimientos?fecha=eq.${fecha}&order=created_at.asc`).catch(() => []));
    actualizarMetricas();
    renderTablaHoy();
    actualizarHeroSaldo();
  }

  function actualizarHeroSaldo() {
    const t = calcTotales(movHoy, apertura);
    if ($('hero-saldo')) $('hero-saldo').textContent = fmt(t.saldo);
    if ($('hero-meta')) $('hero-meta').textContent = `+${fmt(t.ing)} ingresos  −${fmt(t.eg)} egresos`;
    const alerta = $('alerta-saldo-bajo');
    if (alerta) {
      const bajo = apertura && t.saldo < 100000 && (apertura.saldo_cierre == null);
      alerta.style.display = bajo ? '' : 'none';
      if (bajo) alerta.innerHTML = `<div class="cj-alert warning">Saldo en caja por debajo de ${fmt(100000)}. Considera hacer una recarga.</div>`;
    }
  }

  async function preLlenarSaldoAnterior() {
    const ultAp = first(await api(`/caja_aperturas?fecha=lt.${hoyISO()}&order=fecha.desc&limit=1`).catch(() => []));
    if (!ultAp) return;
    const movs = arr(await api(`/caja_movimientos?fecha=eq.${ultAp.fecha}&select=tipo,monto`).catch(() => []));
    const ing = movs.filter(m => m.tipo === 'ingreso').reduce((a, m) => a + Number(m.monto), 0);
    const eg = movs.filter(m => m.tipo === 'egreso').reduce((a, m) => a + Number(m.monto), 0);
    const saldoFinal = Number(ultAp.saldo_inicial) + ing - eg;
    if ($('ap-monto')) $('ap-monto').value = saldoFinal;
    if ($('ap-nota')) $('ap-nota').placeholder = `Traído del ${fechaLeg(ultAp.fecha)}`;
    const apCard = $('apertura-card');
    if (apCard && !apCard.querySelector('.cj-aviso-saldo')) {
      const aviso = document.createElement('div');
      aviso.className = 'cj-alert info cj-aviso-saldo';
      aviso.innerHTML = `Saldo sugerido: <strong>${fmt(saldoFinal)}</strong> — cierre del ${fechaLeg(ultAp.fecha)}. Ajusta si hay diferencia física.`;
      const fg = apCard.querySelector('.fg2');
      if (fg) apCard.insertBefore(aviso, fg);
    }
  }

  function calcTotales(lista, ap) {
    const ing = lista.filter(m => m.tipo === 'ingreso').reduce((a, m) => a + Number(m.monto), 0);
    const eg = lista.filter(m => m.tipo === 'egreso').reduce((a, m) => a + Number(m.monto), 0);
    const ini = Number(ap?.saldo_inicial) || 0;
    return { ing, eg, ini, saldo: ini + ing - eg };
  }
  function actualizarMetricas() {
    const t = calcTotales(movHoy, apertura);
    if ($('m-ini')) $('m-ini').textContent = fmt(t.ini);
    if ($('m-ing')) $('m-ing').textContent = fmt(t.ing);
    if ($('m-eg')) $('m-eg').textContent = fmt(t.eg);
    if ($('m-sal')) $('m-sal').textContent = fmt(t.saldo);
  }
  function renderTablaHoy() {
    const f = $('filtro-hoy')?.value || 'todos';
    const lista = f === 'todos' ? movHoy : movHoy.filter(m => m.tipo === f);
    renderTabla('tabla-hoy', lista, true);
    if ($('res-hoy')) $('res-hoy').innerHTML = resumenHTML(calcTotales(movHoy, apertura));
    updBadgeEgresos();
  }
  // Celda de estado de justificación (solo aplica a egresos).
  function estadoCelda(m) {
    if (m.tipo !== 'egreso') return '';
    if (m.estado === 'cerrado') {
      const link = m.factura_url ? ` <a href="${esc(m.factura_url)}" target="_blank" rel="noopener" style="font-size:11px;color:var(--cj-azul)">ver</a>` : '';
      return `<span class="estado-badge cerrado">justificado</span>${link}`;
    }
    // pendiente (o egreso antiguo sin estado) → permite cerrar con factura
    return `<span class="estado-badge pendiente">por justificar</span><br><button class="cj-btn sm" style="margin-top:5px" onclick="Caja.abrirCierreEgreso('${m.id}')">Cerrar con factura</button>`;
  }
  function renderTabla(k, lista, conDel) {
    const el = $(k); if (!el) return;
    if (!lista.length) { el.innerHTML = '<div class="empty">Sin movimientos registrados</div>'; return; }
    const metodoIcon = { efectivo:'Efectivo', transferencia:'Transf.', tarjeta:'Tarjeta', consignacion:'Consig.' };
    el.innerHTML = `<div class="tw"><table><thead><tr><th>Hora</th><th>Tipo</th><th>Categoría</th><th>Descripción</th><th>Método</th><th>Cajero</th><th>Recibe</th><th style="text-align:right">Monto</th><th>Estado</th>${conDel ? '<th></th>' : ''}</tr></thead>
    <tbody>${lista.map(m => `<tr>
      <td style="color:var(--cj-txt2);font-size:12px">${esc(m.hora)}</td>
      <td><span class="tag ${m.tipo}">${esc(m.tipo)}</span></td>
      <td style="color:var(--cj-txt2)">${esc(m.categoria)}</td>
      <td>${esc(m.descripcion)}${m.numero_ot ? `<br><small style="color:var(--cj-azul);font-weight:600">OT ${esc(m.numero_ot)}</small>` : ''}${m.observacion ? `<br><small style="color:var(--cj-txt2)">${esc(m.observacion)}</small>` : ''}${m.estado === 'cerrado' && m.valor_factura != null ? `<br><small style="color:var(--cj-txt2)">Factura: ${fmt(m.valor_factura)}${Number(m.diferencia) > 0 ? ` · sobrante ${fmt(m.diferencia)}` : ''}</small>` : ''}</td>
      <td style="font-size:13px">${metodoIcon[m.metodo_pago] || '💵'} ${esc(m.metodo_pago || 'efectivo')}</td>
      <td style="color:var(--cj-txt2);font-size:12px">${esc(m.responsable)}</td>
      <td style="color:var(--cj-txt2);font-size:12px">${esc(m.recibe || '—')}</td>
      <td style="text-align:right" class="${m.tipo === 'ingreso' ? 'pos' : 'neg'}">${m.tipo === 'ingreso' ? '+' : '-'}${fmt(m.monto)}</td>
      <td>${estadoCelda(m)}</td>
      ${conDel ? `<td style="white-space:nowrap"><button class="cj-btn danger sm" onclick="Caja.eliminar('${m.id}')">×</button>${m.tipo==='ingreso'?` <button class="cj-btn sm" onclick="Caja.generarReciboPDF('${m.id}')" title="Generar recibo">Recibo</button>`:''}</td>` : ''}
    </tr>`).join('')}</tbody></table></div>`;
  }
  function updBadgeEgresos() {
    const btn = $('tab-hoy'); if (!btn) return;
    const ex = btn.querySelector('.cj-tab-badge'); if (ex) ex.remove();
    const pend = movHoy.filter(m => m.tipo === 'egreso' && m.estado === 'pendiente').length;
    if (pend) { const b = document.createElement('span'); b.className = 'cj-tab-badge'; b.textContent = pend; btn.appendChild(b); }
  }
  function resumenHTML(t) {
    return `<div class="res-row"><span style="color:var(--cj-txt2)">Saldo inicial</span><span>${fmt(t.ini)}</span></div>
    <div class="res-row"><span style="color:var(--cj-verde)">+ Ingresos</span><span class="pos">${fmt(t.ing)}</span></div>
    <div class="res-row"><span style="color:var(--cj-rojo)">− Egresos</span><span class="neg">${fmt(t.eg)}</span></div>
    <div class="res-row total"><span>Saldo final</span><span>${fmt(t.saldo)}</span></div>`;
  }

  async function abrirCaja() {
    const monto = parseFloat($('ap-monto')?.value);
    const nota = $('ap-nota')?.value.trim() || '';
    if (isNaN(monto) || monto < 0) { toast('Ingresa un monto válido', 'bad'); return; }
    setBtnLoading('btn-abrir', true, 'Abriendo...');
    try {
      await api('/caja_aperturas', 'POST', { fecha: hoyISO(), saldo_inicial: monto, nota, usuario: usuarioActual() });
      toast('✓ Caja abierta correctamente');
      _logEvento('caja_apertura', '🏦', `Caja abierta — saldo inicial: ${fmt(monto)}`, null, null, '#2563EB');
      await cargarHoy();
    } catch (e) {
      toast('Error: ' + e.message, 'bad');
    } finally {
      setBtnLoading('btn-abrir', false, 'Confirmar y abrir caja');
    }
  }

  async function registrar() {
    if (!apertura) { toast('Primero abre la caja del día', 'bad'); return; }
    const tipo = $('m-tipo').value;
    const categoria = $('m-cat').value;
    const descripcion = $('m-desc').value.trim();
    const monto = parseFloat($('m-monto').value);
    const responsable = $('m-resp')?.value.trim() || usuarioActual();
    const recibe = $('m-recibe')?.value.trim() || null;
    const metodo_pago = $('m-metodo')?.value || 'efectivo';
    const observacion = $('m-obs').value.trim();
    const orden_id = $('orden-id')?.value || null;
    const numero_ot = $('orden-ot')?.value || null;
    if (!descripcion) { toast('Agrega una descripción', 'bad'); return; }
    if (isNaN(monto) || monto <= 0) { toast('Ingresa un monto válido', 'bad'); return; }
    setBtnLoading('btn-registrar', true, 'Guardando...');
    try {
      const body = { fecha: hoyISO(), hora: horaLocal(), tipo, categoria, descripcion, monto, responsable,
        recibe, metodo_pago, observacion, usuario: usuarioActual(), estado: tipo === 'egreso' ? 'pendiente' : null };
      if (orden_id) { body.orden_id = orden_id; body.numero_ot = numero_ot; }
      await api('/caja_movimientos', 'POST', body);
      toast(tipo === 'ingreso'
        ? `✓ Ingreso registrado — ${fmt(monto)}`
        : `✓ Egreso registrado — ${fmt(monto)}. Queda pendiente de justificar con factura.`);
      _logEvento(
        tipo === 'ingreso' ? 'caja_ingreso' : 'caja_egreso',
        tipo === 'ingreso' ? '💵' : '💸',
        `${tipo === 'ingreso' ? 'Ingreso' : 'Egreso'}: ${fmt(monto)} — ${descripcion || categoria}`,
        null, null, tipo === 'ingreso' ? '#059669' : '#D97706'
      );
      limpiarFormMov();
      await cargarHoy();
    } catch (e) {
      toast('Error: ' + e.message, 'bad');
    } finally {
      setBtnLoading('btn-registrar', false, 'Registrar movimiento');
    }
  }

  function limpiarFormMov() {
    ['m-desc', 'm-monto', 'm-recibe', 'm-obs'].forEach(k => { if ($(k)) $(k).value = ''; });
    if ($('m-tipo')) $('m-tipo').value = 'egreso';
    if ($('m-metodo')) $('m-metodo').value = 'efectivo';
    if ($('m-resp')) $('m-resp').value = (typeof sesion !== 'undefined' && sesion?.nombre) || '';
    updCats();
    _limpiarOrden();
  }

  async function eliminar(id) {
    const ligado = anticiposData.find(a => a.movimiento_egreso_id === id);
    if (ligado) { toast(`Este egreso respalda el anticipo de ${ligado.colaborador}. Gestiona el anticipo en Caja Menor.`, 'bad'); return; }
    if (!confirm('¿Eliminar este movimiento?')) return;
    try {
      await api(`/caja_movimientos?id=eq.${id}`, 'DELETE');
      toast('Movimiento eliminado');
      await cargarHoy();
    } catch (e) { toast('Error: ' + e.message, 'bad'); }
  }

  // ── HISTORIAL ──────────────────────────────────────────────
  async function buscarHistorial() {
    const desde = $('h-desde')?.value || diasAtras(30);
    const hasta = $('h-hasta')?.value || hoyISO();
    const tipo = $('h-tipo')?.value || '';
    const cat = $('h-cat')?.value || '';
    if ($('tabla-hist')) $('tabla-hist').innerHTML = '<div class="spin">Buscando...</div>';
    let path = `/caja_movimientos?fecha=gte.${desde}&fecha=lte.${hasta}&order=fecha.asc&order=created_at.asc`;
    if (tipo) path += `&tipo=eq.${tipo}`;
    if (cat) path += `&categoria=eq.${encodeURIComponent(cat)}`;
    histData = arr(await api(path).catch(() => []));
    renderTabla('tabla-hist', histData, false);
    const resEl = $('res-hist');
    if (resEl) {
      if (histData.length) {
        const ing = histData.filter(m => m.tipo === 'ingreso').reduce((a, m) => a + Number(m.monto), 0);
        const eg = histData.filter(m => m.tipo === 'egreso').reduce((a, m) => a + Number(m.monto), 0);
        resEl.innerHTML = `<div class="res-row"><span style="color:var(--cj-verde)">Total ingresos</span><span class="pos">${fmt(ing)}</span></div>
        <div class="res-row"><span style="color:var(--cj-rojo)">Total egresos</span><span class="neg">${fmt(eg)}</span></div>
        <div class="res-row total"><span>Neto</span><span>${fmt(ing - eg)}</span></div>`;
        resEl.style.display = '';
      } else { resEl.style.display = 'none'; }
    }
  }

  // ── PDF ────────────────────────────────────────────────────
  function exportPDF(modo) {
    if (!window.jspdf) { toast('No se pudo generar el PDF', 'bad'); return; }
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit: 'mm', format: 'a4' });
    const AZUL = [26, 58, 107], GRIS = [100, 100, 100], VERDE = [59, 109, 17], ROJO = [163, 45, 45];
    doc.setFillColor(...AZUL); doc.rect(0, 0, 210, 22, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(13); doc.setFont('helvetica', 'bold'); doc.text('Freimanautos SA', 14, 10);
    doc.setFontSize(9); doc.setFont('helvetica', 'normal'); doc.text('Control de Caja', 14, 16);
    doc.setFontSize(8); doc.text(new Date().toLocaleString('es-CO'), 196, 16, { align: 'right' });
    let lista, titulo, subtitulo;
    if (modo === 'hoy') { lista = movHoy; titulo = 'Informe de Caja — Hoy'; subtitulo = fechaLeg(hoyISO()); }
    else { lista = histData; const d = $('h-desde')?.value, h = $('h-hasta')?.value; titulo = 'Informe de Caja — Período'; subtitulo = (d ? fechaLeg(d) : '?') + ' al ' + (h ? fechaLeg(h) : '?'); }
    doc.setTextColor(...AZUL); doc.setFontSize(13); doc.setFont('helvetica', 'bold'); doc.text(titulo, 14, 32);
    doc.setFontSize(9); doc.setFont('helvetica', 'normal'); doc.setTextColor(...GRIS); doc.text(subtitulo, 14, 38);
    const ing = lista.filter(m => m.tipo === 'ingreso').reduce((a, m) => a + Number(m.monto), 0);
    const eg = lista.filter(m => m.tipo === 'egreso').reduce((a, m) => a + Number(m.monto), 0);
    const ap = modo === 'hoy' && apertura ? Number(apertura.saldo_inicial) : 0;
    doc.setFillColor(245, 245, 243); doc.roundedRect(14, 43, 182, 28, 3, 3, 'F');
    const cols = modo === 'hoy'
      ? [[14, 'Saldo inicial', ap, AZUL], [62, 'Ingresos', ing, VERDE], [110, 'Egresos', eg, ROJO], [158, 'Saldo final', ap + ing - eg, AZUL]]
      : [[14, 'Mov.', lista.length, AZUL], [62, 'Ingresos', ing, VERDE], [110, 'Egresos', eg, ROJO], [158, 'Neto', ing - eg, ing >= eg ? VERDE : ROJO]];
    cols.forEach(([x, l, v, c]) => { doc.setFontSize(8); doc.setTextColor(...GRIS); doc.setFont('helvetica', 'normal'); doc.text(l, x, 51); doc.setFontSize(11); doc.setFont('helvetica', 'bold'); doc.setTextColor(...c); doc.text(typeof v === 'number' ? fmt(v) : String(v), x, 59); });
    doc.autoTable({
      startY: 76,
      head: [['Fecha', 'Hora', 'Tipo', 'Categoría', 'Descripción', 'Responsable', 'Monto']],
      body: lista.map(m => [(m.fecha ? fechaLeg(m.fecha) : ''), m.hora || '', m.tipo, m.categoria || '', m.descripcion || '', m.responsable || '', (m.tipo === 'ingreso' ? '+' : '-') + fmt(m.monto)]),
      theme: 'grid', styles: { fontSize: 8, cellPadding: 3 }, headStyles: { fillColor: AZUL, textColor: 255, fontStyle: 'bold', fontSize: 8 },
      columnStyles: { 0: { cellWidth: 18 }, 1: { cellWidth: 12 }, 2: { cellWidth: 16 }, 3: { cellWidth: 28 }, 4: { cellWidth: 55 }, 5: { cellWidth: 28 }, 6: { cellWidth: 22, halign: 'right' } },
      didParseCell(dp) { if (dp.section === 'body' && dp.column.index === 6) { const m = lista[dp.row.index]; if (m) dp.cell.styles.textColor = m.tipo === 'ingreso' ? VERDE : ROJO; } },
      margin: { left: 14, right: 14 }
    });
    const n = doc.internal.getNumberOfPages();
    for (let i = 1; i <= n; i++) { doc.setPage(i); doc.setFontSize(8); doc.setTextColor(...GRIS); doc.text(`Pág. ${i} de ${n}`, 14, 290); doc.text('Freimanautos SA — Bogotá, Colombia', 196, 290, { align: 'right' }); }
    doc.save(`caja-freimanautos-${modo === 'hoy' ? hoyISO() : 'periodo'}.pdf`);
  }

  // ── ANTICIPOS / CAJA MENOR ────────────────────────────────
  async function cargarAnticipos() {
    anticiposData = arr(await api('/caja_anticipos?order=created_at.desc').catch(() => []));
    renderAnticipos();
    mostrarAlertasPendientes();
    actualizarBadgeAnticipos();
  }

  function actualizarBadgeAnticipos() {
    const btn = $('tab-anticipos'); if (!btn) return;
    const existing = btn.querySelector('.cj-tab-badge'); if (existing) existing.remove();
    const pendientes = anticiposData.filter(a => a.estado === 'pendiente' && a.fecha_solicitud <= hoyISO());
    if (pendientes.length) {
      const badge = document.createElement('span');
      badge.className = 'cj-tab-badge'; badge.textContent = pendientes.length;
      btn.appendChild(badge);
    }
  }

  function mostrarAlertasPendientes() {
    const hoy = hoyISO();
    const pendientes = anticiposData.filter(a => a.estado === 'pendiente' && a.fecha_solicitud < hoy);
    const el = $('alertas-anticipos'); if (!el) return;
    if (!pendientes.length) { el.innerHTML = ''; return; }
    el.innerHTML = `<div class="alerta-pendiente">
      <div class="al-title">⚠️ ${pendientes.length} anticipo${pendientes.length > 1 ? 's' : ''} pendiente${pendientes.length > 1 ? 's' : ''} de días anteriores</div>
      ${pendientes.map(a => `<div class="al-item"><span><strong>${esc(a.colaborador)}</strong> — ${esc(a.concepto)} <span style="font-size:11px;">(${fechaLeg(a.fecha_solicitud)})</span></span><span style="font-weight:600;">${fmt(a.monto)}</span></div>`).join('')}
      <div style="font-size:12px;margin-top:8px;">Estos anticipos solo pueden cerrarse con soporte adjunto.</div>
    </div>`;
  }

  async function registrarAnticipo() {
    if (!apertura) { toast('Primero abre la caja del día', 'bad'); return; }
    const colaborador = $('ant-colab').value.trim();
    const monto = parseFloat($('ant-monto').value);
    const fecha = $('ant-fecha').value || hoyISO();
    const concepto = $('ant-concepto').value.trim();
    const observacion = $('ant-obs').value.trim();
    if (!colaborador) { toast('Ingresa el nombre del colaborador', 'bad'); return; }
    if (isNaN(monto) || monto <= 0) { toast('Ingresa un monto válido', 'bad'); return; }
    if (!concepto) { toast('Ingresa el concepto', 'bad'); return; }
    const totales = calcTotales(movHoy, apertura);
    if (monto > totales.saldo) { toast('No hay saldo suficiente en caja para registrar este anticipo', 'bad'); return; }
    setBtnLoading('btn-anticipo', true, 'Guardando...');
    try {
      const anticipo = first(await api('/caja_anticipos', 'POST',
        { fecha_solicitud: fecha, colaborador, concepto, monto, observacion, usuario_registro: usuarioActual(), estado: 'pendiente' },
        { Prefer: 'return=representation' }));
      // El egreso que respalda el anticipo nace 'cerrado': la justificación la
      // lleva el propio anticipo (su factura), no debe pedirse dos veces.
      let mov;
      try {
        mov = first(await api('/caja_movimientos', 'POST',
          { fecha: hoyISO(), hora: horaLocal(), tipo: 'egreso', categoria: 'Anticipo caja menor', descripcion: `Anticipo caja menor — ${colaborador}`, monto, responsable: colaborador, observacion: `Concepto: ${concepto}${observacion ? ' | ' + observacion : ''}`, usuario: usuarioActual(), estado: 'cerrado' },
          { Prefer: 'return=representation' }));
      } catch (eMov) {
        // No se pudo descontar de caja → revertir el anticipo para no dejarlo a medias.
        if (anticipo?.id) await api(`/caja_anticipos?id=eq.${anticipo.id}`, 'DELETE').catch(() => {});
        throw new Error('no se pudo descontar de caja, anticipo cancelado (' + eMov.message + ')');
      }
      if (anticipo?.id && mov?.id) {
        await api(`/caja_anticipos?id=eq.${anticipo.id}`, 'PATCH', { movimiento_egreso_id: mov.id }).catch(() => {});
      }
      toast(`✓ Anticipo registrado y descontado de caja — ${fmt(monto)}`);
      limpiarFormAnticipo();
      await cargarHoy(); await cargarAnticipos();
    } catch (e) {
      toast('Error registrando anticipo: ' + e.message, 'bad');
    } finally {
      setBtnLoading('btn-anticipo', false, 'Registrar anticipo');
    }
  }

  function limpiarFormAnticipo() {
    ['ant-colab', 'ant-monto', 'ant-concepto', 'ant-obs'].forEach(k => { if ($(k)) $(k).value = ''; });
    if ($('ant-fecha')) $('ant-fecha').value = hoyISO();
  }

  function renderAnticipos() {
    const filtro = $('filtro-anticipos')?.value || 'todos';
    const lista = filtro === 'todos' ? anticiposData : anticiposData.filter(a => a.estado === filtro);
    const el = $('lista-anticipos'); if (!el) return;
    if (!lista.length) { el.innerHTML = '<div class="empty">Sin anticipos registrados</div>'; return; }
    el.innerHTML = lista.map(a => `
      <div class="cj-card" style="border-left:3px solid ${a.estado === 'pendiente' ? 'var(--cj-amber)' : 'var(--cj-verde)'};">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:8px;">
          <div>
            <div style="font-weight:600;font-size:14px;">${esc(a.colaborador)}</div>
            <div style="color:var(--cj-txt2);font-size:13px;margin-top:2px;">${esc(a.concepto)}</div>
            ${a.observacion ? `<div style="color:var(--cj-txt2);font-size:12px;margin-top:2px;">${esc(a.observacion)}</div>` : ''}
            <div style="font-size:12px;color:var(--cj-txt2);margin-top:4px;">Solicitado: ${fechaLeg(a.fecha_solicitud)}</div>
            ${a.fecha_cierre ? `<div style="font-size:12px;color:var(--cj-verde);margin-top:2px;">Cerrado: ${fechaLeg(a.fecha_cierre)}</div>` : ''}
            ${a.estado === 'cerrado' && a.valor_factura != null ? `<div style="font-size:12px;color:var(--cj-txt2);margin-top:4px;">Soporte: ${fmt(a.valor_factura)}</div>` : ''}
            ${a.estado === 'cerrado' && a.diferencia != null && Number(a.diferencia) > 0 ? `<div style="font-size:12px;color:var(--cj-verde);margin-top:2px;">Vuelto recibido: ${fmt(a.diferencia)}</div>` : ''}
            ${a.estado === 'cerrado' && a.diferencia != null && Number(a.diferencia) < 0 ? `<div style="font-size:12px;color:var(--cj-amber);margin-top:2px;">Diferencia asumida por colaborador: ${fmt(Math.abs(a.diferencia))}</div>` : ''}
          </div>
          <div style="text-align:right;"><div style="font-size:20px;font-weight:700;color:${a.estado === 'pendiente' ? 'var(--cj-rojo)' : 'var(--cj-verde)'};">${fmt(a.monto)}</div><div style="margin-top:6px;"><span class="estado-badge ${a.estado}">${esc(a.estado)}</span></div></div>
        </div>
        ${a.factura_url ? (a.factura_nombre && a.factura_nombre.toLowerCase().endsWith('.pdf')
          ? `<div style="margin-top:10px;display:flex;align-items:center;gap:8px;padding:10px;background:var(--cj-rojo-bg);border-radius:var(--cj-r);border:1px solid var(--cj-borde);"><span style="font-size:20px;">📄</span><span style="font-size:13px;color:var(--cj-rojo);font-weight:500;">${esc(a.factura_nombre)}</span><a href="${esc(a.factura_url)}" target="_blank" rel="noopener" style="font-size:12px;color:var(--cj-azul);margin-left:auto;font-weight:500;">Ver PDF ↗</a></div>`
          : `<img class="preview-img" src="${esc(a.factura_url)}" alt="Soporte" onclick="Caja.abrirModal('${esc(a.factura_url)}')"/>`) : ''}
        ${a.estado === 'pendiente' ? `<div style="margin-top:1rem;padding-top:1rem;border-top:1px solid var(--cj-borde);"><div style="margin-bottom:8px;"><label>Adjuntar soporte obligatorio (foto o PDF)</label><input type="file" id="cj-file-${a.id}" accept="image/*,application/pdf" onchange="Caja.previewFactura('${a.id}')"/></div><div id="cj-preview-${a.id}"></div><div style="display:flex;gap:8px;margin-top:10px;flex-wrap:wrap;"><button class="cj-btn success" onclick="Caja.abrirModalFactura('${a.id}')">✓ Cerrar con soporte</button></div></div>` : ''}
      </div>`).join('');
  }

  function previewFactura(id) {
    const file = document.getElementById('cj-file-' + id)?.files[0]; if (!file) return;
    const el = document.getElementById('cj-preview-' + id); if (!el) return;
    if (file.size > 10 * 1024 * 1024) { toast('Archivo muy grande. Máximo 10MB', 'bad'); document.getElementById('cj-file-' + id).value = ''; el.innerHTML = ''; return; }
    if (file.type === 'application/pdf') {
      const url = URL.createObjectURL(file);
      el.innerHTML = `<div style="display:flex;align-items:center;gap:8px;padding:8px;background:var(--cj-rojo-bg);border-radius:var(--cj-r);border:1px solid var(--cj-borde);"><span>📄</span><span style="font-size:13px;color:var(--cj-rojo);font-weight:500;">${esc(file.name)}</span><a href="${url}" target="_blank" rel="noopener" style="font-size:12px;color:var(--cj-azul);margin-left:auto;">Ver ↗</a></div>`;
    } else {
      const reader = new FileReader();
      reader.onload = e => { el.innerHTML = `<img src="${e.target.result}" style="max-height:120px;border-radius:var(--cj-r);margin-top:6px;border:1px solid var(--cj-borde);"/>`; };
      reader.readAsDataURL(file);
    }
  }

  function abrirModalFactura(id) {
    const fileInput = document.getElementById('cj-file-' + id);
    if (!fileInput?.files[0]) { toast('Selecciona el soporte primero', 'bad'); return; }
    const anticipo = anticiposData.find(a => a.id === id); if (!anticipo) { toast('No se encontró el anticipo', 'bad'); return; }
    anticipoIdPendiente = id;
    $('mf-sub').textContent = `Anticipo entregado a ${anticipo.colaborador}: ${fmt(anticipo.monto)}`;
    $('mf-valor').value = anticipo.monto;
    $('mf-diff').style.display = 'none';
    $('modal-factura').classList.add('open');
    $('mf-valor').focus();
    $('mf-valor').oninput = () => actualizarDiffModal(anticipo.monto);
    actualizarDiffModal(anticipo.monto);
  }

  function actualizarDiffModal(montoOriginal) {
    const val = parseFloat($('mf-valor').value);
    const el = $('mf-diff');
    if (isNaN(val) || val < 0) { el.style.display = 'none'; return; }
    const diff = montoOriginal - val; el.style.display = 'block';
    if (diff > 0) { el.style.background = 'var(--cj-verde-bg)'; el.style.color = 'var(--cj-verde)'; el.textContent = `Debe devolver ${fmt(diff)}. Ese valor se registrará como ingreso en la caja del día.`; }
    else if (diff < 0) { el.style.background = 'var(--cj-amber-bg)'; el.style.color = 'var(--cj-amber)'; el.textContent = `La factura supera el anticipo por ${fmt(Math.abs(diff))}. No se descuenta de caja automáticamente.`; }
    else { el.style.background = 'var(--cj-verde-bg)'; el.style.color = 'var(--cj-verde)'; el.textContent = 'Gasto exacto. No hay vuelto ni diferencia pendiente.'; }
  }

  function cerrarModalFactura() { $('modal-factura').classList.remove('open'); anticipoIdPendiente = null; }

  async function confirmarCierreAnticipo() {
    const id = anticipoIdPendiente;
    const anticipo = anticiposData.find(a => a.id === id);
    if (!anticipo) { toast('No se encontró el anticipo', 'bad'); return; }
    const valorReal = parseFloat($('mf-valor').value);
    if (isNaN(valorReal) || valorReal < 0) { toast('Ingresa un valor válido', 'bad'); return; }
    const file = document.getElementById('cj-file-' + id)?.files[0];
    if (!file) { toast('Selecciona el soporte antes de cerrar', 'bad'); return; }
    const diferencia = anticipo.monto - valorReal;
    if (diferencia > 0 && !apertura) { toast('Para recibir el vuelto primero debes abrir la caja del día', 'bad'); return; }
    setBtnLoading('btn-confirmar-cierre', true, 'Guardando...');
    try {
      const url = await storageUpload(file, `caja/anticipos/${id}_${Date.now()}.x`);
      let nota = `Soporte: ${fmt(valorReal)}`;
      if (diferencia > 0) nota += ` — Vuelto recibido en caja: ${fmt(diferencia)}`;
      else if (diferencia < 0) nota += ` — Diferencia asumida por colaborador: ${fmt(Math.abs(diferencia))}. No afecta caja.`;
      else nota += ' — Gasto exacto.';
      await api(`/caja_anticipos?id=eq.${id}`, 'PATCH', {
        estado: 'cerrado', fecha_cierre: hoyISO(), factura_url: url, factura_nombre: file.name,
        valor_factura: valorReal, diferencia, observacion_cierre: nota
      });
      if (diferencia > 0) {
        await api('/caja_movimientos', 'POST', {
          fecha: hoyISO(), hora: horaLocal(), tipo: 'ingreso', categoria: 'Vuelto anticipo',
          descripcion: `Vuelto anticipo — ${anticipo.colaborador}`, monto: diferencia, responsable: anticipo.colaborador,
          observacion: `Anticipo: ${fmt(anticipo.monto)} | Soporte: ${fmt(valorReal)} | Concepto: ${anticipo.concepto}`, usuario: usuarioActual()
        });
      }
      cerrarModalFactura();
      if (diferencia > 0) toast(`✓ Anticipo cerrado. Vuelto recibido: ${fmt(diferencia)}`);
      else if (diferencia < 0) toast(`✓ Anticipo cerrado. Diferencia no afecta caja: ${fmt(Math.abs(diferencia))}`);
      else toast('✓ Anticipo cerrado sin diferencia');
      await cargarHoy(); await cargarAnticipos();
    } catch (e) {
      toast('Error cerrando anticipo: ' + e.message, 'bad');
    } finally {
      setBtnLoading('btn-confirmar-cierre', false, 'Cerrar anticipo');
    }
  }

  function abrirModal(url) { $('modal-img-src').src = url; $('img-modal').classList.add('open'); }
  function cerrarModal() { $('img-modal').classList.remove('open'); }

  // ── CIERRE DE EGRESO CON FACTURA ──────────────────────────
  function abrirCierreEgreso(id) {
    const m = movHoy.find(x => x.id === id) || histData.find(x => x.id === id);
    if (!m) { toast('No se encontró el egreso', 'bad'); return; }
    egresoIdPendiente = id;
    $('eg-sub').textContent = `${m.descripcion || 'Egreso'} — entregado ${fmt(m.monto)}`;
    $('eg-file').value = '';
    $('eg-preview').innerHTML = '';
    $('eg-valor').value = m.monto;
    $('eg-diff').style.display = 'none';
    $('modal-egreso').classList.add('open');
    $('eg-valor').oninput = () => actualizarDiffEgreso(m.monto);
    actualizarDiffEgreso(m.monto);
  }
  function previewEgreso() {
    const file = $('eg-file')?.files[0]; const el = $('eg-preview'); if (!el) return;
    if (!file) { el.innerHTML = ''; return; }
    if (file.size > 10 * 1024 * 1024) { toast('Archivo muy grande. Máximo 10MB', 'bad'); $('eg-file').value = ''; el.innerHTML = ''; return; }
    if (file.type === 'application/pdf') {
      el.innerHTML = `<div style="display:flex;align-items:center;gap:8px;padding:8px;background:var(--cj-rojo-bg);border-radius:var(--cj-r);border:1px solid var(--cj-borde);"><span>📄</span><span style="font-size:13px;color:var(--cj-rojo);font-weight:500;">${esc(file.name)}</span></div>`;
    } else {
      const reader = new FileReader();
      reader.onload = e => { el.innerHTML = `<img src="${e.target.result}" style="max-height:120px;border-radius:var(--cj-r);border:1px solid var(--cj-borde);"/>`; };
      reader.readAsDataURL(file);
    }
  }
  function actualizarDiffEgreso(montoEntregado) {
    const val = parseFloat($('eg-valor').value);
    const el = $('eg-diff');
    if (isNaN(val) || val < 0) { el.style.display = 'none'; return; }
    const diff = montoEntregado - val; el.style.display = 'block';
    if (diff > 0) { el.style.background = 'var(--cj-amber-bg)'; el.style.color = 'var(--cj-amber)'; el.textContent = `Sobran ${fmt(diff)}. Cuando la persona los devuelva, regístralos como INGRESO para que la caja cuadre.`; }
    else if (diff < 0) { el.style.background = 'var(--cj-amber-bg)'; el.style.color = 'var(--cj-amber)'; el.textContent = `La factura supera lo entregado por ${fmt(Math.abs(diff))}. No afecta la caja automáticamente.`; }
    else { el.style.background = 'var(--cj-verde-bg)'; el.style.color = 'var(--cj-verde)'; el.textContent = 'Gasto exacto. No hay sobrante.'; }
  }
  function cerrarModalEgreso() { $('modal-egreso').classList.remove('open'); egresoIdPendiente = null; }
  async function confirmarCierreEgreso() {
    const id = egresoIdPendiente;
    const m = movHoy.find(x => x.id === id) || histData.find(x => x.id === id);
    if (!m) { toast('No se encontró el egreso', 'bad'); return; }
    const valorReal = parseFloat($('eg-valor').value);
    if (isNaN(valorReal) || valorReal < 0) { toast('Ingresa el valor de la factura', 'bad'); return; }
    const file = $('eg-file')?.files[0];
    if (!file) { toast('Adjunta la factura antes de cerrar', 'bad'); return; }
    setBtnLoading('btn-cierre-egreso', true, 'Guardando...');
    try {
      const url = await storageUpload(file, `caja/egresos/${id}_${Date.now()}.x`);
      const diferencia = Number(m.monto) - valorReal;
      let nota = `Factura: ${fmt(valorReal)}`;
      if (diferencia > 0) nota += ` — Sobrante por devolver a caja: ${fmt(diferencia)}`;
      else if (diferencia < 0) nota += ` — Factura mayor a lo entregado por ${fmt(Math.abs(diferencia))}`;
      else nota += ' — Gasto exacto';
      await api(`/caja_movimientos?id=eq.${id}`, 'PATCH', {
        estado: 'cerrado', fecha_cierre: hoyISO(), factura_url: url, factura_nombre: file.name,
        valor_factura: valorReal, diferencia, observacion_cierre: nota
      });
      cerrarModalEgreso();
      if (diferencia > 0) toast(`✓ Egreso justificado. Sobrante a devolver: ${fmt(diferencia)} — regístralo como ingreso.`);
      else toast('✓ Egreso justificado con factura');
      await cargarHoy();
      if ($('view-historial')?.classList.contains('active')) buscarHistorial();
    } catch (e) {
      toast('Error cerrando egreso: ' + e.message, 'bad');
    } finally {
      setBtnLoading('btn-cierre-egreso', false, 'Cerrar con factura');
    }
  }

  // ── CIERRE DE CAJA ─────────────────────────────────────────
  function abrirCierreCaja() {
    if (!apertura) { toast('No hay caja abierta hoy', 'bad'); return; }
    const t = calcTotales(movHoy, apertura);
    $('cc-saldo-sistema').textContent = fmt(t.saldo);
    $('cc-fisico').value = '';
    $('cc-diff').style.display = 'none';
    $('modal-cierre').classList.add('open');
    $('cc-fisico').focus();
    $('cc-fisico').oninput = () => {
      const v = parseFloat($('cc-fisico').value);
      const el = $('cc-diff'); if (!el) return;
      if (isNaN(v)) { el.style.display = 'none'; return; }
      const diff = v - t.saldo; el.style.display = 'block';
      el.style.background = diff >= 0 ? 'var(--cj-verde-bg)' : 'var(--cj-rojo-bg)';
      el.style.color = diff >= 0 ? 'var(--cj-verde)' : 'var(--cj-rojo)';
      el.textContent = diff >= 0 ? `Sobrante: ${fmt(diff)}` : `Faltante: ${fmt(Math.abs(diff))}`;
    };
  }
  function cerrarModalCierre() { $('modal-cierre').classList.remove('open'); }
  async function confirmarCierreCaja() {
    if (!apertura) return;
    const fisico = parseFloat($('cc-fisico').value);
    if (isNaN(fisico) || fisico < 0) { toast('Ingresa el conteo físico', 'bad'); return; }
    const t = calcTotales(movHoy, apertura);
    const diferencia = fisico - t.saldo;
    setBtnLoading('btn-confirmar-cierre-caja', true, 'Cerrando...');
    try {
      await api(`/caja_aperturas?id=eq.${apertura.id}`, 'PATCH', {
        saldo_cierre: fisico, hora_cierre: horaLocal(),
        diferencia, cerrada_por: usuarioActual()
      });
      toast('Caja cerrada correctamente');
      cerrarModalCierre();
      await cargarHoy();
    } catch (e) { toast('Error: ' + e.message, 'bad'); }
    finally { setBtnLoading('btn-confirmar-cierre-caja', false, 'Confirmar cierre'); }
  }

  // ── RECIBO PDF ─────────────────────────────────────────────
  function generarReciboPDF(id) {
    const m = movHoy.find(x => x.id === id) || histData.find(x => x.id === id);
    if (!m) { toast('Movimiento no encontrado', 'bad'); return; }
    if (!window.jspdf) { toast('No se pudo cargar el generador de PDF', 'bad'); return; }
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit: 'mm', format: [80, 120] });
    const AZUL = [26, 58, 107], GRIS = [100, 100, 100];
    doc.setFillColor(...AZUL); doc.rect(0, 0, 80, 18, 'F');
    doc.setTextColor(255, 255, 255); doc.setFont('helvetica', 'bold');
    doc.setFontSize(11); doc.text('Freimanautos SA', 6, 8);
    doc.setFontSize(7); doc.setFont('helvetica', 'normal'); doc.text('Recibo de Caja', 6, 14);
    doc.setTextColor(...AZUL); doc.setFontSize(10); doc.setFont('helvetica', 'bold');
    doc.text('RECIBO DE PAGO', 40, 26, { align: 'center' });
    doc.setTextColor(...GRIS); doc.setFont('helvetica', 'normal'); doc.setFontSize(8);
    const rows = [
      ['Fecha:', `${fechaLeg(m.fecha)} ${m.hora||''}`],
      ['Cajero:', m.responsable || '—'],
      ['Recibe:', m.recibe || '—'],
      ['Concepto:', m.descripcion || '—'],
      ['Método:', m.metodo_pago || 'efectivo'],
      m.numero_ot ? ['OT vinculada:', 'OT ' + m.numero_ot] : null,
    ].filter(Boolean);
    let y = 34;
    rows.forEach(([l, v]) => {
      doc.setFont('helvetica', 'bold'); doc.text(l, 6, y);
      doc.setFont('helvetica', 'normal'); doc.text(v, 32, y, { maxWidth: 42 });
      y += 7;
    });
    doc.setDrawColor(...AZUL); doc.setLineWidth(0.3); doc.line(6, y, 74, y); y += 6;
    doc.setFont('helvetica', 'bold'); doc.setFontSize(12); doc.setTextColor(...AZUL);
    doc.text('TOTAL:', 6, y); doc.text(fmt(m.monto), 74, y, { align: 'right' });
    y += 10;
    doc.setFontSize(7); doc.setTextColor(...GRIS); doc.setFont('helvetica', 'normal');
    doc.text('Gracias por su pago — Freimanautos SA', 40, y, { align: 'center' });
    doc.save(`recibo-${m.fecha}-${(m.recibe||'cliente').replace(/\s+/g,'_')}.pdf`);
  }

  // ── RECONCILIACIÓN (órdenes entregadas sin pago) ────────────
  async function cargarPendientesCobro() {
    const cont = $('view-cobrar'); if (!cont) return;
    cont.innerHTML = '<div class="spin">Cargando...</div>';
    // Órdenes entregadas
    const ordenes = arr(await api('/ordenes?estado=eq.Entregada&select=id,numero_ot,placa,propietario,marca,linea,entregada_en&order=entregada_en.desc&limit=200').catch(() => []));
    if (!ordenes.length) { cont.innerHTML = '<div class="empty">Sin órdenes entregadas</div>'; return; }
    // IDs con pago registrado
    const conPago = new Set();
    const pagados = arr(await api('/caja_movimientos?orden_id=not.is.null&select=orden_id').catch(() => []));
    pagados.forEach(p => { if (p.orden_id) conPago.add(p.orden_id); });
    const sinPago = ordenes.filter(o => !conPago.has(o.id));
    const conPagoList = ordenes.filter(o => conPago.has(o.id));
    if (!sinPago.length && !conPagoList.length) { cont.innerHTML = '<div class="empty">Sin órdenes entregadas</div>'; return; }
    const filaOrden = (o, pagada) => `<tr>
      <td style="font-family:monospace;font-size:12px">${esc(o.numero_ot||'—')}</td>
      <td><strong>${esc(o.placa)}</strong><br><small style="color:var(--cj-txt2)">${esc(o.marca||'')} ${esc(o.linea||'')}</small></td>
      <td style="color:var(--cj-txt2);font-size:12px">${esc(o.propietario||'—')}</td>
      <td style="font-size:12px;color:var(--cj-txt2)">${o.entregada_en ? fechaLeg(o.entregada_en.slice(0,10)) : '—'}</td>
      <td><span class="estado-badge ${pagada?'cerrado':'pendiente'}">${pagada?'Con pago':'Sin pago'}</span></td>
    </tr>`;
    cont.innerHTML = `
      ${sinPago.length ? `<div class="cj-alert warning" style="margin-bottom:1rem">${sinPago.length} orden${sinPago.length>1?'es':''} entregada${sinPago.length>1?'s':''} sin pago registrado en caja.</div>` : ''}
      <div class="tw"><table>
        <thead><tr><th>N° OT</th><th>Vehículo</th><th>Propietario</th><th>Entregada</th><th>Estado pago</th></tr></thead>
        <tbody>${sinPago.map(o => filaOrden(o, false)).join('')}${conPagoList.map(o => filaOrden(o, true)).join('')}</tbody>
      </table></div>`;
  }

  // ── TABS ───────────────────────────────────────────────────
  function showTab(id, btn) {
    const cont = document.getElementById('pag-caja');
    if (cont) {
      cont.querySelectorAll('.cj-tab').forEach(t => t.classList.remove('active'));
      cont.querySelectorAll('.cj-view').forEach(v => v.classList.remove('active'));
    }
    if (btn) btn.classList.add('active');
    const view = $('view-' + id);
    if (view) view.classList.add('active');
    if (id === 'dashboard') cargarDashboard();
    if (id === 'hoy') cargarHoy();
    if (id === 'anticipos') cargarAnticipos();
    if (id === 'historial') buscarHistorial();
    if (id === 'cobrar') cargarPendientesCobro();
  }

  // ── MARKUP ─────────────────────────────────────────────────
  function template() {
    return `
    <div class="cj-toast" id="cj-toast"></div>
    <div class="cj-tabs">
      <button class="cj-tab active" id="cj-tab-dashboard" onclick="Caja.showTab('dashboard',this)">Dashboard</button>
      <button class="cj-tab" id="cj-tab-hoy" onclick="Caja.showTab('hoy',this)">Caja del día</button>
      <button class="cj-tab" onclick="Caja.showTab('historial',this)">Historial</button>
      <button class="cj-tab" id="cj-tab-anticipos" onclick="Caja.showTab('anticipos',this)">Caja Menor</button>
      <button class="cj-tab" onclick="Caja.showTab('cobrar',this)">Por cobrar</button>
    </div>

    <!-- DASHBOARD -->
    <div id="cj-view-dashboard" class="cj-view active">
      <div class="kpi-grid">
        <div class="kpi azul"><div class="k-lbl">Saldo en caja hoy</div><div class="k-val" id="cj-d-saldo">$0</div><div class="k-sub" id="cj-d-saldo-sub">—</div></div>
        <div class="kpi verde"><div class="k-lbl">Ingresos del mes</div><div class="k-val" id="cj-d-ing-mes">$0</div><div class="k-sub" id="cj-d-ing-sub">0 movimientos</div></div>
        <div class="kpi rojo"><div class="k-lbl">Egresos del mes</div><div class="k-val" id="cj-d-eg-mes">$0</div><div class="k-sub" id="cj-d-eg-sub">0 movimientos</div></div>
        <div class="kpi amber"><div class="k-lbl">Balance del mes</div><div class="k-val" id="cj-d-balance">$0</div><div class="k-sub" id="cj-d-balance-sub">—</div></div>
      </div>
      <div class="chart-grid">
        <div class="chart-box"><div class="chart-title">Flujo diario — últimos 14 días</div><div id="cj-flujo"><div class="spin">Cargando...</div></div></div>
        <div class="chart-box"><div class="chart-title">Egresos por categoría — mes actual</div><div id="cj-cat-bars" style="padding-top:.5rem;"><div class="spin">Cargando...</div></div></div>
      </div>
      <div class="chart-box"><div class="chart-title">Últimos movimientos del mes</div><div id="cj-dash-ultimos"><div class="spin">Cargando...</div></div></div>
    </div>

    <!-- HOY -->
    <div id="cj-view-hoy" class="cj-view">
      <div class="cj-hero">
        <div class="cj-hero-top">
          <div><div class="sh-label">Caja del día</div><div class="sh-val" id="cj-hero-saldo">$0</div><div class="sh-meta" id="cj-hero-meta">—</div></div>
          <div class="sh-right"><div class="sh-label">Hoy</div><div class="cj-hero-fecha" id="cj-hero-fecha">—</div><div class="sh-chip" id="cj-hero-estado">Sin abrir</div><button class="cj-btn sm" id="cj-btn-cerrar-caja" style="display:none;margin-top:6px" onclick="Caja.abrirCierreCaja()">Cerrar caja del día</button></div>
        </div>
        <div id="cj-cierre-info" style="display:none;margin-top:10px"></div>
        <div id="cj-alerta-saldo-bajo" style="display:none;margin-top:10px"></div>
        <div class="cj-hero-metrics">
          <div class="cj-metric"><span>Apertura</span><strong id="cj-m-ini">$0</strong></div>
          <div class="cj-metric positivo"><span>Ingresos hoy</span><strong id="cj-m-ing">$0</strong></div>
          <div class="cj-metric negativo"><span>Egresos hoy</span><strong id="cj-m-eg">$0</strong></div>
          <div class="cj-metric"><span>Saldo actual</span><strong id="cj-m-sal">$0</strong></div>
        </div>
      </div>

      <div class="cj-card" id="cj-apertura-card" style="display:none;">
        <div class="cj-section-title">Apertura de caja</div>
        <div class="cj-alert warning">No hay caja abierta hoy. Confirma el saldo inicial para comenzar.</div>
        <div class="fg2">
          <div><label>Saldo inicial ($)</label><input type="number" id="cj-ap-monto" placeholder="0" min="0"/></div>
          <div><label>Nota (opcional)</label><input type="text" id="cj-ap-nota" placeholder="Observación..."/></div>
        </div>
        <button class="cj-btn primary" onclick="Caja.abrirCaja()" id="cj-btn-abrir">Confirmar y abrir caja</button>
      </div>

      <div class="cj-card" id="cj-card-registro">
        <div class="cj-section-title">Registrar movimiento</div>
        <div class="fg2">
          <div><label>Tipo de movimiento</label>
            <select id="cj-m-tipo" onchange="Caja.updCats()">
              <option value="egreso">💸 Egreso — salida de dinero</option>
              <option value="ingreso">💰 Ingreso — entrada de dinero</option>
            </select>
          </div>
          <div><label>Categoría</label><select id="cj-m-cat" onchange="Caja._showOrdenSearch()"></select></div>
        </div>
        <div id="cj-orden-search-wrap" style="display:none;margin-bottom:12px">
          <label>Vincular orden de trabajo <span style="color:var(--cj-txt2);font-weight:400">(opcional)</span></label>
          <div style="position:relative">
            <input type="text" id="cj-orden-q" placeholder="Placa, propietario o N° OT..." autocomplete="off"
              oninput="Caja._buscarOrden(this.value)"
              onfocus="Caja._buscarOrden(this.value)"
              onblur="setTimeout(()=>{ const d=document.getElementById('cj-orden-lista'); if(d) d.style.display='none'; },200)">
            <div id="cj-orden-lista" style="display:none;position:absolute;top:100%;left:0;right:0;background:var(--cj-card);border:1px solid var(--cj-borde);border-radius:var(--cj-r);z-index:100;max-height:220px;overflow-y:auto;box-shadow:0 4px 12px rgba(0,0,0,.12)"></div>
          </div>
          <div id="cj-orden-sel" class="cj-orden-sel-box" style="display:none">
            <span id="cj-orden-sel-txt"></span>
            <button onclick="Caja._limpiarOrden()" style="background:none;border:none;cursor:pointer;color:var(--cj-txt2);font-size:18px;line-height:1;padding:0 2px">×</button>
          </div>
          <input type="hidden" id="cj-orden-id">
          <input type="hidden" id="cj-orden-ot">
        </div>
        <div class="fg2">
          <div><label>Descripción *</label><input type="text" id="cj-m-desc" placeholder="¿En qué se usó / quién pagó?"/></div>
          <div><label>Monto ($) *</label><input type="number" id="cj-m-monto" placeholder="0" min="0"/></div>
        </div>
        <div class="fg3" style="margin-bottom:12px">
          <div>
            <label>Método de pago</label>
            <select id="cj-m-metodo">
              <option value="efectivo">Efectivo</option>
              <option value="transferencia">Transferencia</option>
              <option value="tarjeta">Tarjeta</option>
              <option value="consignacion">Consignación</option>
            </select>
          </div>
          <div><label>Cajero / Entrega</label><input type="text" id="cj-m-resp" readonly style="background:var(--cj-gris);cursor:default"/></div>
          <div><label>Recibe <span style="color:var(--cj-txt2);font-weight:400">(cliente, proveedor…)</span></label><input type="text" id="cj-m-recibe" placeholder="Nombre de quien recibe"/></div>
        </div>
        <div style="margin-bottom:12px;"><label>Observación (opcional)</label><textarea id="cj-m-obs" placeholder="Nota adicional..."></textarea></div>
        <div style="display:flex;justify-content:flex-end;gap:8px;">
          <button class="cj-btn" onclick="Caja.limpiarFormMov()">Limpiar</button>
          <button class="cj-btn primary" onclick="Caja.registrar()" id="cj-btn-registrar">Registrar movimiento</button>
        </div>
      </div>

      <div class="cj-card">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1rem;">
          <div class="cj-section-title" style="margin:0;">Movimientos del día</div>
          <div style="display:flex;gap:8px;">
            <select id="cj-filtro-hoy" onchange="Caja.renderTablaHoy()" style="width:auto;font-size:12px;">
              <option value="todos">Todos</option><option value="ingreso">Ingresos</option><option value="egreso">Egresos</option>
            </select>
            <button class="cj-btn sm" onclick="Caja.exportPDF('hoy')">Exportar PDF</button>
          </div>
        </div>
        <div id="cj-tabla-hoy"></div>
        <div class="res-box" style="margin-top:1rem;" id="cj-res-hoy"></div>
      </div>
    </div>

    <!-- HISTORIAL -->
    <div id="cj-view-historial" class="cj-view">
      <div class="cj-card">
        <div class="cj-section-title">Filtros</div>
        <div class="fbar">
          <div class="fg"><label>Desde</label><input type="date" id="cj-h-desde"/></div>
          <div class="fg"><label>Hasta</label><input type="date" id="cj-h-hasta"/></div>
          <div class="fg"><label>Tipo</label><select id="cj-h-tipo"><option value="">Todos</option><option value="ingreso">Ingresos</option><option value="egreso">Egresos</option></select></div>
          <div class="fg"><label>Categoría</label><select id="cj-h-cat"><option value="">Todas</option></select></div>
          <button class="cj-btn primary" onclick="Caja.buscarHistorial()">Buscar</button>
          <button class="cj-btn sm" onclick="Caja.exportPDF('historial')">PDF período</button>
        </div>
      </div>
      <div class="cj-card">
        <div id="cj-tabla-hist"><div class="empty">Selecciona un rango de fechas y haz clic en Buscar</div></div>
        <div class="res-box" style="margin-top:1rem;display:none;" id="cj-res-hist"></div>
      </div>
    </div>

    <!-- ANTICIPOS -->
    <div id="cj-view-anticipos" class="cj-view">
      <div id="cj-alertas-anticipos"></div>
      <div class="cj-card">
        <div class="cj-section-title">Registrar anticipo de caja menor</div>
        <div class="fg3">
          <div><label>Colaborador *</label><input type="text" id="cj-ant-colab" placeholder="Nombre completo"/></div>
          <div><label>Monto ($) *</label><input type="number" id="cj-ant-monto" placeholder="0" min="0"/></div>
          <div><label>Fecha solicitud</label><input type="date" id="cj-ant-fecha"/></div>
        </div>
        <div style="margin-bottom:10px;"><label>Concepto *</label><input type="text" id="cj-ant-concepto" placeholder="¿Para qué se usa el dinero?"/></div>
        <div style="margin-bottom:12px;"><label>Observación (opcional)</label><textarea id="cj-ant-obs" placeholder="Nota adicional..."></textarea></div>
        <div style="display:flex;justify-content:flex-end;gap:8px;">
          <button class="cj-btn" onclick="Caja.limpiarFormAnticipo()">Limpiar</button>
          <button class="cj-btn primary" onclick="Caja.registrarAnticipo()" id="cj-btn-anticipo">Registrar anticipo</button>
        </div>
      </div>
      <div class="cj-card">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1rem;">
          <div class="cj-section-title" style="margin:0;">Anticipos registrados</div>
          <select id="cj-filtro-anticipos" onchange="Caja.renderAnticipos()" style="width:auto;font-size:12px;">
            <option value="todos">Todos</option><option value="pendiente">Pendientes</option><option value="cerrado">Cerrados</option>
          </select>
        </div>
        <div id="cj-lista-anticipos"><div class="spin">Cargando...</div></div>
      </div>
    </div>

    <!-- POR COBRAR -->
    <div id="cj-view-cobrar" class="cj-view">
      <div class="cj-card">
        <div class="cj-section-title">Órdenes entregadas — seguimiento de cobro</div>
        <div id="cj-view-cobrar"><div class="empty">Cargando...</div></div>
      </div>
    </div>

    <!-- MODALES -->
    <div class="modal-form-overlay" id="cj-modal-cierre">
      <div class="modal-form">
        <h3>Cerrar caja del día</h3>
        <div class="sub">Cuenta el efectivo físico y compara con el saldo del sistema.</div>
        <div style="display:flex;justify-content:space-between;padding:12px;background:var(--cj-gris);border-radius:var(--cj-r);margin:12px 0">
          <span style="color:var(--cj-txt2)">Saldo sistema</span>
          <strong id="cj-cc-saldo-sistema">$0</strong>
        </div>
        <div style="margin-bottom:10px"><label>Conteo físico en caja ($)</label><input type="number" id="cj-cc-fisico" placeholder="0" min="0" style="font-size:16px;padding:10px 12px"/></div>
        <div id="cj-cc-diff" style="font-size:13px;padding:10px;border-radius:var(--cj-r);margin-bottom:1rem;display:none"></div>
        <div style="display:flex;gap:8px;justify-content:flex-end">
          <button class="cj-btn" onclick="Caja.cerrarModalCierre()">Cancelar</button>
          <button class="cj-btn danger" onclick="Caja.confirmarCierreCaja()" id="cj-btn-confirmar-cierre-caja">Confirmar cierre</button>
        </div>
      </div>
    </div>

    <div class="modal-overlay" id="cj-img-modal" onclick="Caja.cerrarModal()"><img class="modal-img" id="cj-modal-img-src" src="" alt="Soporte"/></div>
    <div class="modal-form-overlay" id="cj-modal-factura">
      <div class="modal-form">
        <h3>Cerrar anticipo con soporte</h3>
        <div class="sub" id="cj-mf-sub">Anticipo entregado: $0</div>
        <div style="margin-bottom:12px;"><label>Valor real del soporte / factura ($)</label><input type="number" id="cj-mf-valor" placeholder="0" min="0" style="font-size:16px;padding:10px 12px;"/></div>
        <div id="cj-mf-diff" style="font-size:13px;padding:10px;border-radius:var(--cj-r);margin-bottom:1rem;display:none;"></div>
        <div style="display:flex;gap:8px;justify-content:flex-end;">
          <button class="cj-btn" onclick="Caja.cerrarModalFactura()">Cancelar</button>
          <button class="cj-btn success" onclick="Caja.confirmarCierreAnticipo()" id="cj-btn-confirmar-cierre">Cerrar anticipo</button>
        </div>
      </div>
    </div>

    <div class="modal-form-overlay" id="cj-modal-egreso">
      <div class="modal-form">
        <h3>Justificar egreso con factura</h3>
        <div class="sub" id="cj-eg-sub">Egreso: $0</div>
        <div style="margin-bottom:10px;"><label>Factura / soporte (foto o PDF) *</label><input type="file" id="cj-eg-file" accept="image/*,application/pdf" onchange="Caja.previewEgreso()"/></div>
        <div id="cj-eg-preview" style="margin-bottom:10px;"></div>
        <div style="margin-bottom:12px;"><label>Valor real de la factura ($)</label><input type="number" id="cj-eg-valor" placeholder="0" min="0" style="font-size:16px;padding:10px 12px;"/></div>
        <div id="cj-eg-diff" style="font-size:13px;padding:10px;border-radius:var(--cj-r);margin-bottom:1rem;display:none;"></div>
        <div style="display:flex;gap:8px;justify-content:flex-end;">
          <button class="cj-btn" onclick="Caja.cerrarModalEgreso()">Cancelar</button>
          <button class="cj-btn success" onclick="Caja.confirmarCierreEgreso()" id="cj-btn-cierre-egreso">Cerrar con factura</button>
        </div>
      </div>
    </div>`;
  }

  // ── ENTRADA ────────────────────────────────────────────────
  async function montar() {
    const cont = document.getElementById('caja-contenido');
    if (!cont) return;
    cont.innerHTML = template();
    if ($('hero-fecha')) $('hero-fecha').textContent = fechaLeg(hoyISO());
    if ($('ant-fecha')) $('ant-fecha').value = hoyISO();
    if ($('m-resp')) $('m-resp').value = (typeof sesion !== 'undefined' && sesion?.nombre) || '';
    updCats();
    poblarFiltrosCats();
    await Promise.all([cargarDashboard(), cargarHoy(), cargarAnticipos()]);
  }

  return {
    montar, showTab, updCats, renderTablaHoy, renderAnticipos,
    abrirCaja, registrar, limpiarFormMov, eliminar,
    buscarHistorial, exportPDF,
    registrarAnticipo, limpiarFormAnticipo, previewFactura,
    abrirModalFactura, cerrarModalFactura, confirmarCierreAnticipo,
    abrirCierreEgreso, previewEgreso, cerrarModalEgreso, confirmarCierreEgreso,
    abrirModal, cerrarModal,
    _showOrdenSearch, _buscarOrden, _selOrden, _limpiarOrden,
    abrirCierreCaja, cerrarModalCierre, confirmarCierreCaja,
    generarReciboPDF, cargarPendientesCobro
  };
})();

// Punto de entrada que llama el menú (navJefe → case 'caja').
function montarCaja() { Caja.montar(); }
