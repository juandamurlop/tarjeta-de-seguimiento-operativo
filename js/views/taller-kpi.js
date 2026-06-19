// ═══════════════════════════════════════════════════════════
// GESTIÓN OPERATIVA — KPIs del taller (jefe / gerente)
// ═══════════════════════════════════════════════════════════

// Store global de datos de drilldown (evita JSON en onclick)
window._kpiStore = {};

// ── Helpers ──────────────────────────────────────────────
function _kpiMs(isoStr) {
  if (!isoStr) return 0;
  return Date.now() - new Date(isoStr).getTime();
}
function _kpiDur(ms) {
  if (!ms || ms <= 0) return '—';
  const m = Math.floor(ms / 60000);
  if (m < 60) return m + 'm';
  const h = Math.floor(m / 60), rm = m % 60;
  if (h < 24) return h + 'h ' + rm + 'm';
  return Math.floor(h / 24) + 'd ' + (h % 24) + 'h';
}
function _kpiSemaforo(val, umbralRojo, umbralAmarillo) {
  if (val >= umbralRojo) return 'rojo';
  if (val >= umbralAmarillo) return 'amarillo';
  return 'verde';
}

// ── Animación "en vivo": los números cuentan hacia su valor y hacen flash
// cuando cambian. renderSinParpadeo reusa los nodos del DOM, así que guardamos
// el valor previo en el propio nodo (node._kpiPrev). ──
function _kpiCountUp(node, from, to) {
  const dur = 650, t0 = performance.now();
  const ease = x => 1 - Math.pow(1 - x, 3);
  (function step(t) {
    const p = Math.min(1, (t - t0) / dur);
    node.textContent = String(Math.round(from + (to - from) * ease(p)));
    if (p < 1) requestAnimationFrame(step);
  })(t0);
}
function _kpiFlash(node) {
  const card = node.closest('.kpi-card, .kpi-res-item, .kpi-valor-taller') || node;
  card.classList.remove('kpi-flash'); void card.offsetWidth; card.classList.add('kpi-flash');
}
function _kpiAnimarNumeros() {
  document.querySelectorAll('#taller-kpi-contenido .kpi-card-num, #taller-kpi-contenido .kpi-res-num, #taller-kpi-contenido .kpi-vt-num').forEach(node => {
    const txt = (node.textContent || '').trim();
    if (/^\d+$/.test(txt)) {
      const target = parseInt(txt, 10);
      const prev = (typeof node._kpiPrev === 'number') ? node._kpiPrev : 0;
      if (prev !== target) { _kpiCountUp(node, prev, target); if (node._kpiPrev !== undefined) _kpiFlash(node); }
      node._kpiPrev = target;
    } else {
      if (node._kpiPrev !== undefined && node._kpiPrev !== txt) _kpiFlash(node);
      node._kpiPrev = txt;
    }
  });
}

// ── Modal de drilldown ───────────────────────────────────
// Mini-estadística del "pulso del día"
function _pulsoStat(label, val, color) {
  return `<div style="text-align:center;min-width:78px">
    <div style="font-size:20px;font-weight:800;color:${color};line-height:1">${val}</div>
    <div style="font-size:9px;color:var(--gris-mid);text-transform:uppercase;letter-spacing:.4px;margin-top:4px">${label}</div>
  </div>`;
}

// Gráfico de barras horizontales: items = [{label, valor, color?}]
function _kpiBarras(items, colorDefault) {
  if (!items || !items.length) return '<div style="font-size:12px;color:var(--gris-mid)">Sin datos</div>';
  const max = Math.max(1, ...items.map(i => i.valor || 0));
  return items.map(i => {
    const pct = Math.round((i.valor || 0) / max * 100);
    return `<div style="display:flex;align-items:center;gap:8px;margin-bottom:7px">
      <div style="font-size:11px;color:var(--gris-texto);width:94px;flex-shrink:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escapeHtml(i.label)}</div>
      <div style="flex:1;height:14px;background:var(--gris-bg);border-radius:99px;overflow:hidden"><div style="height:100%;width:${pct}%;background:${i.color || colorDefault || '#2A5298'};border-radius:99px;min-width:${i.valor ? 4 : 0}px;transition:width .4s var(--ease-out)"></div></div>
      <div style="font-size:12px;font-weight:700;color:var(--texto);width:22px;text-align:right;flex-shrink:0">${i.valor || 0}</div>
    </div>`;
  }).join('');
}

function kpiDrilldown(key) {
  const { titulo, filas } = window._kpiStore[key] || { titulo: '—', filas: [] };
  const ex = document.getElementById('_kpiModal');
  if (ex) ex.remove();

  const filasHtml = filas.length
    ? filas.map((f, i) => `
        <div class="kpi-drill-fila" onclick="_kpiAbrirOrden(${f.ordenId || 0})">
          <div class="kpi-drill-main">
            <div class="kpi-drill-placa">${escapeHtml(f.placa || '—')}</div>
            <div class="kpi-drill-ot">${escapeHtml(f.ot || '')}</div>
          </div>
          <div class="kpi-drill-info">
            <div class="kpi-drill-titulo">${escapeHtml(f.titulo || '')}</div>
            <div class="kpi-drill-sub">${escapeHtml(f.sub || '')}</div>
          </div>
          <div class="kpi-drill-badge kpi-${f.color || 'verde'}">${escapeHtml(f.badge || '')}</div>
          ${f.ordenId ? '<span class="kpi-drill-arrow">→</span>' : ''}
        </div>`).join('')
    : '<div style="text-align:center;padding:24px;color:var(--gris-mid)">Sin alertas activas ✓</div>';

  const ov = document.createElement('div');
  ov.id = '_kpiModal';
  ov.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:9999;display:flex;align-items:center;justify-content:center;padding:16px';
  ov.addEventListener('click', e => { if (e.target === ov) ov.remove(); });
  ov.innerHTML = `
    <div style="background:white;border-radius:14px;width:100%;max-width:580px;max-height:85vh;display:flex;flex-direction:column;box-shadow:0 20px 60px rgba(0,0,0,.25)">
      <div style="display:flex;align-items:center;justify-content:space-between;padding:18px 20px;border-bottom:1.5px solid var(--gris-borde);flex-shrink:0">
        <div style="font-size:15px;font-weight:700;color:var(--texto)">${escapeHtml(titulo)}</div>
        <button onclick="document.getElementById('_kpiModal').remove()" style="background:none;border:none;cursor:pointer;font-size:20px;color:var(--gris-mid);line-height:1">✕</button>
      </div>
      <div style="overflow-y:auto;padding:12px 16px;flex:1">${filasHtml}</div>
    </div>`;
  document.body.appendChild(ov);
}

function _kpiAbrirOrden(ordenId) {
  if (!ordenId) return;
  document.getElementById('_kpiModal')?.remove();
  // abrirOrden ya navega al detalle (pag-detalle). El navJefe('ordenes')
  // previo dejaba al usuario en la lista en vez de abrir la orden.
  if (typeof abrirOrden === 'function') abrirOrden(ordenId);
}

// Botón "Actualizar": gira el ícono una vez (feedback) y recarga.
function _kpiActualizar(btn) {
  const ico = btn?.querySelector('.kpi-refresh-ico');
  if (ico) {
    ico.classList.remove('spin');
    void ico.offsetWidth;            // reinicia la animación si se da clic seguido
    ico.classList.add('spin');
    ico.addEventListener('animationend', () => ico.classList.remove('spin'), { once: true });
  }
  cargarKPITaller();
}

// Refrescar la Gestión Operativa apenas se vuelve a ver la pantalla. Los
// temporizadores (setInterval) se ralentizan o pausan en segundo plano —p. ej.
// un monitor/TV o una pestaña detrás—, así que esto la pone al día al instante
// cuando se mira de nuevo. Se registra una sola vez.
if (typeof document !== 'undefined' && !window._kpiVisHandler) {
  window._kpiVisHandler = true;
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden &&
        document.getElementById('pag-taller-kpi')?.classList.contains('activa') &&
        typeof cargarKPITaller === 'function') {
      cargarKPITaller();
    }
  });
}

// ── Función principal ────────────────────────────────────
async function cargarKPITaller() {
  const cont = document.getElementById('taller-kpi-contenido');
  if (!cont) return;

  const ahora = Date.now();
  const hoy = new Date(); hoy.setHours(0, 0, 0, 0);

  try {
    const _hace14d = new Date(ahora - 14 * 86400000).toISOString();
    const _inicioMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1).toISOString();
    const [ordenesActivas, todasEtapas, solicitudesRep, mecanicosData, entregadasRecientes, cotsPendientes, cotsMes, capActivas, capPulmonInt] = await Promise.all([
      api('/ordenes?estado=eq.Activa&order=creado_en.asc').catch(() => []),
      api('/etapas?select=id,orden_id,etapa,servicio,mecanico_id,tecnico,creado_en,inicio,fin,pausado,tiempo_pausado_min,valor_venta&order=creado_en.asc').catch(() => []),
      api('/solicitudes_repuesto?estado=not.in.(entregado,rechazado)&order=creado_en.asc').catch(() => []),
      api('/mecanicos?activo=eq.true&order=nombre.asc').catch(() => []),
      api(`/ordenes?estado=eq.Entregada&entregada_en=gte.${_hace14d}&select=id,placa,ingreso_en,entregada_en,fecha_entrega_1,creado_en`).catch(() => []),
      api('/cotizaciones?estado=eq.pendiente&select=id').catch(() => []),
      api(`/cotizaciones?created_at=gte.${_inicioMes}&select=id,orden_id`).catch(() => []),
      // MISMAS consultas que el sidebar (_refrescarCapacidad) para que la
      // "Ocupación del taller" coincida exactamente con la capacidad del sidebar.
      api('/ordenes?estado=eq.Activa&pulmon=eq.false&select=id').catch(() => []),
      api('/ordenes?pulmon=eq.true&pulmon_tipo=eq.interno&select=id').catch(() => [])
    ]);

    const etapasActivas = todasEtapas.filter(e => e.inicio && !e.fin);
    const tecRoles = ['jefe_taller', 'gerente', 'prueba', 'repuestos', 'pantalla_taller', 'asesor_comercial'];

    // ── KPI 1: Órdenes sin técnico asignado ───────────────
    const k1Filas = ordenesActivas.filter(o => {
      const ets = todasEtapas.filter(e => e.orden_id === o.id);
      return ets.length === 0 || ets.every(e => !e.mecanico_id);
    }).map(o => ({
      placa: o.placa, ot: formatOT(o.id), ordenId: o.id,
      titulo: [o.marca, o.linea].filter(Boolean).join(' ') || 'Sin datos',
      sub: 'Sin asignar hace ' + _kpiDur(_kpiMs(o.creado_en)),
      badge: _kpiDur(_kpiMs(o.creado_en)),
      color: _kpiSemaforo(_kpiMs(o.creado_en), 4 * 3600000, 2 * 3600000)
    }));
    window._kpiStore.k1 = { titulo: 'Órdenes sin técnico asignado', filas: k1Filas };
    const k1Color = _kpiSemaforo(k1Filas.length, 3, 1);
    const k1Max = k1Filas.reduce((m, f) => _kpiMs(ordenesActivas.find(o => o.placa === f.placa)?.creado_en) > m ? _kpiMs(ordenesActivas.find(o => o.placa === f.placa)?.creado_en) : m, 0);

    // ── KPI 2: Etapas asignadas sin iniciar ───────────────
    const k2Filas = todasEtapas.filter(e => e.mecanico_id && !e.inicio && !e.fin).map(e => {
      const o = ordenesActivas.find(or => or.id === e.orden_id) || {};
      const ms = _kpiMs(e.creado_en);
      return {
        placa: o.placa || '—', ot: formatOT(e.orden_id), ordenId: e.orden_id,
        titulo: (e.etapa || '—') + ' · ' + (e.tecnico || 'Sin técnico'),
        sub: 'Asignada hace ' + _kpiDur(ms),
        badge: _kpiDur(ms),
        color: _kpiSemaforo(ms, 3 * 3600000, 1 * 3600000)
      };
    });
    window._kpiStore.k2 = { titulo: 'Etapas asignadas sin iniciar', filas: k2Filas };
    const k2Color = _kpiSemaforo(k2Filas.length, 5, 2);
    const k2Max = k2Filas.length ? Math.max(...todasEtapas.filter(e => e.mecanico_id && !e.inicio && !e.fin).map(e => _kpiMs(e.creado_en))) : 0;

    // ── KPI 3: Entretiempos entre etapas ──────────────────
    const k3Filas = [];
    ordenesActivas.forEach(o => {
      const ets = todasEtapas.filter(e => e.orden_id === o.id);
      const finalizadas = ets.filter(e => e.fin).sort((a, b) => new Date(a.fin) - new Date(b.fin));
      const pendientes = ets.filter(e => !e.inicio && !e.fin);
      if (finalizadas.length && pendientes.length) {
        const ultimaFin = new Date(finalizadas[finalizadas.length - 1].fin).getTime();
        const gapMs = ahora - ultimaFin;
        if (gapMs > 30 * 60000) {
          k3Filas.push({
            placa: o.placa, ot: formatOT(o.id), ordenId: o.id,
            titulo: 'Parado tras finalizar: ' + (finalizadas[finalizadas.length - 1].etapa || '—'),
            sub: 'Sin avance hace ' + _kpiDur(gapMs),
            badge: _kpiDur(gapMs),
            color: _kpiSemaforo(gapMs, 4 * 3600000, 2 * 3600000)
          });
        }
      }
    });
    window._kpiStore.k3 = { titulo: 'Entretiempos en operación', filas: k3Filas };
    const k3Color = _kpiSemaforo(k3Filas.length, 3, 1);
    const k3Max = k3Filas.length ? Math.max(...k3Filas.map(f => _kpiMs(ordenesActivas.find(o => o.placa === f.placa)?.creado_en))) : 0;

    // ── KPI 4: Solicitudes de repuesto atascadas ──────────
    const UMBRAL_REP = { pendiente_jefe: 2 * 3600000, enviado_repuestos: 24 * 3600000, cotizado: 48 * 3600000, pedido: 72 * 3600000, recibido_taller: 4 * 3600000 };
    const LABEL_REP = { pendiente_jefe: 'Pendiente jefe', enviado_repuestos: 'En gestión', cotizado: 'Cotizado', pedido: 'Pedido', recibido_taller: 'En taller' };
    const k4Filas = solicitudesRep.filter(s => {
      const umbral = UMBRAL_REP[s.estado] || 48 * 3600000;
      return _kpiMs(s.creado_en) > umbral;
    }).map(s => {
      const o = ordenesActivas.find(or => or.id === s.orden_id) || {};
      const ms = _kpiMs(s.creado_en);
      return {
        placa: o.placa || ('OT-' + s.orden_id), ot: formatOT(s.orden_id), ordenId: s.orden_id,
        titulo: s.repuesto || 'Repuesto sin nombre',
        sub: (LABEL_REP[s.estado] || s.estado) + ' · hace ' + _kpiDur(ms),
        badge: _kpiDur(ms),
        color: _kpiSemaforo(ms, 48 * 3600000, 24 * 3600000)
      };
    });
    window._kpiStore.k4 = { titulo: 'Solicitudes de repuesto atascadas', filas: k4Filas };
    const k4Color = _kpiSemaforo(k4Filas.length, 3, 1);
    const k4Max = k4Filas.length ? Math.max(...solicitudesRep.filter(s => _kpiMs(s.creado_en) > (UMBRAL_REP[s.estado] || 48 * 3600000)).map(s => _kpiMs(s.creado_en))) : 0;

    // ── KPI 5: Órdenes vencidas ───────────────────────────
    const k5Filas = ordenesActivas.filter(o => o.fecha_entrega_1 && new Date(o.fecha_entrega_1) < hoy).map(o => {
      const dias = Math.round((hoy.getTime() - new Date(o.fecha_entrega_1).getTime()) / 86400000);
      return {
        placa: o.placa, ot: formatOT(o.id), ordenId: o.id,
        titulo: [o.marca, o.linea].filter(Boolean).join(' ') || 'Sin datos',
        sub: dias + ' día' + (dias !== 1 ? 's' : '') + ' de retraso',
        badge: dias + 'd retraso',
        color: 'rojo'
      };
    });
    window._kpiStore.k5 = { titulo: 'Órdenes vencidas', filas: k5Filas };
    const k5Color = k5Filas.length > 0 ? 'rojo' : 'verde';

    // ── KPI 6: Prom. asignación → arranque ────────────────
    const tiemposArr = todasEtapas
      .filter(e => e.mecanico_id && e.inicio && e.creado_en)
      .map(e => new Date(e.inicio).getTime() - new Date(e.creado_en).getTime())
      .filter(t => t > 0 && t < 7 * 24 * 3600000);
    const k6Prom = tiemposArr.length ? Math.round(tiemposArr.reduce((a, b) => a + b, 0) / tiemposArr.length) : 0;
    const k6Filas = todasEtapas.filter(e => e.mecanico_id && e.inicio && e.creado_en && (new Date(e.inicio) - new Date(e.creado_en)) > 0)
      .slice(-20).map(e => {
        const o = ordenesActivas.find(or => or.id === e.orden_id) || {};
        const ms = new Date(e.inicio) - new Date(e.creado_en);
        return {
          placa: o.placa || '—', ot: formatOT(e.orden_id), ordenId: e.orden_id,
          titulo: (e.etapa || '—') + ' · ' + (e.tecnico || '—'),
          sub: 'Tardó ' + _kpiDur(ms) + ' en arrancar',
          badge: _kpiDur(ms),
          color: _kpiSemaforo(ms, 4 * 3600000, 2 * 3600000)
        };
      });
    window._kpiStore.k6 = { titulo: 'Tiempo asignación → arranque (últimas etapas)', filas: k6Filas };
    const k6Color = _kpiSemaforo(k6Prom, 4 * 3600000, 2 * 3600000);

    // ── KPI 7: Técnicos libres ────────────────────────────
    const tecActivos = mecanicosData.filter(m => !tecRoles.includes(m.rol));
    const k7Filas = tecActivos.filter(m => !etapasActivas.some(e => e.mecanico_id === m.id)).map(m => ({
      placa: m.nombre.charAt(0).toUpperCase(), ot: '', ordenId: 0,
      titulo: m.nombre,
      sub: (m.rol || 'Técnico') + ' · Sin etapa activa',
      badge: 'Libre',
      color: 'amarillo'
    }));
    window._kpiStore.k7 = { titulo: 'Técnicos sin actividad activa', filas: k7Filas };
    const k7Color = k7Filas.length >= tecActivos.length ? 'amarillo' : 'verde';

    // ── KPI 8: Órdenes sin movimiento > 4h ───────────────
    const k8Filas = ordenesActivas.filter(o => {
      const antig = _kpiMs(o.ingreso_en || o.creado_en);
      if (antig < 4 * 3600000) return false;
      const ets = todasEtapas.filter(e => e.orden_id === o.id);
      if (!ets.length) return true;
      const ultimaAct = Math.max(...ets.map(e => new Date(e.inicio || e.creado_en).getTime()));
      return (ahora - ultimaAct) > 4 * 3600000;
    }).map(o => ({
      placa: o.placa, ot: formatOT(o.id), ordenId: o.id,
      titulo: [o.marca, o.linea].filter(Boolean).join(' ') || 'Sin datos',
      sub: 'Sin actividad hace ' + _kpiDur(_kpiMs(o.ingreso_en || o.creado_en)),
      badge: _kpiDur(_kpiMs(o.ingreso_en || o.creado_en)),
      color: _kpiSemaforo(_kpiMs(o.ingreso_en || o.creado_en), 8 * 3600000, 4 * 3600000)
    }));
    window._kpiStore.k8 = { titulo: 'Órdenes sin movimiento +4h', filas: k8Filas };
    const k8Color = _kpiSemaforo(k8Filas.length, 3, 1);

    // ── Render ────────────────────────────────────────────
    const hora = new Date().toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });

    // ════════ DATOS DE CONTROL DE LA OPERACIÓN ════════
    const CAP = (typeof CAPACIDAD_TALLER !== 'undefined' ? CAPACIDAD_TALLER : 36);
    const _localDay = iso => { if (!iso) return null; const x = new Date(iso); return `${x.getFullYear()}-${String(x.getMonth()+1).padStart(2,'0')}-${String(x.getDate()).padStart(2,'0')}`; };
    const _hoyKey = _localDay(new Date());

    // Pulso del día — MISMOS números que la capacidad del sidebar:
    // activas (estado=Activa & pulmon=false) y pulmón interno.
    const enTaller = capActivas.length;
    const enPulmon = capPulmonInt.length;
    // Cupos ocupados = activas + pulmón interno (igual que el sidebar "X de 36").
    const cuposOcupados = enTaller + enPulmon;
    const pctOcup  = Math.min(100, Math.round(cuposOcupados / CAP * 100));
    const ingresosHoy = ordenesActivas.filter(o => _localDay(o.ingreso_en) === _hoyKey).length
                      + entregadasRecientes.filter(o => _localDay(o.ingreso_en) === _hoyKey).length;
    const entregasHoy = entregadasRecientes.filter(o => _localDay(o.entregada_en) === _hoyKey).length;

    // Throughput últimos 7 días (ingresos vs entregas)
    const dias7 = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(hoy); d.setDate(d.getDate() - i);
      dias7.push({ dStr: _localDay(d), lbl: d.toLocaleDateString('es-CO', { weekday: 'short' }).replace('.', ''), ingresos: 0, entregas: 0 });
    }
    const _sumDia = (arr, campo, key) => arr.forEach(o => { const d = dias7.find(x => x.dStr === _localDay(o[campo])); if (d) d[key]++; });
    _sumDia(ordenesActivas, 'ingreso_en', 'ingresos');
    _sumDia(entregadasRecientes, 'ingreso_en', 'ingresos');
    _sumDia(entregadasRecientes, 'entregada_en', 'entregas');
    const maxT = Math.max(1, ...dias7.map(d => Math.max(d.ingresos, d.entregas)));

    // Embudo: órdenes activas por etapa del proceso
    const _embudo = {};
    ordenesActivas.filter(o => !o.pulmon).forEach(o => {
      const ets = todasEtapas.filter(e => e.orden_id === o.id);
      const act = etapasActivas.find(e => e.orden_id === o.id);
      let stage;
      if (act) stage = act.etapa || act.servicio || 'En proceso';
      else if (!ets.length || ets.every(e => !e.mecanico_id)) stage = 'Sin asignar';
      else if (ets.every(e => e.fin)) stage = 'Calidad / Listo';
      else stage = 'Por iniciar';
      _embudo[stage] = (_embudo[stage] || 0) + 1;
    });
    const embudo = Object.entries(_embudo).map(([label, valor]) => ({ label, valor })).sort((a, b) => b.valor - a.valor);

    // Cumplimiento de entregas (últimos 14 días) + órdenes en riesgo
    const _conMeta = entregadasRecientes.filter(o => o.fecha_entrega_1);
    const _aTiempo = _conMeta.filter(o => new Date(o.entregada_en) <= new Date(new Date(o.fecha_entrega_1).getTime() + 86400000)).length;
    const pctCumpl = _conMeta.length ? Math.round(_aTiempo / _conMeta.length * 100) : null;
    const enRiesgo = ordenesActivas.filter(o => !o.pulmon && o.fecha_entrega_1)
      .map(o => ({ ...o, dias: Math.ceil((new Date(o.fecha_entrega_1) - hoy) / 86400000) }))
      .filter(o => o.dias <= 2).sort((a, b) => a.dias - b.dias);

    // ── Valor actualmente EN EL TALLER: suma del precio de venta de los
    // procesos de las órdenes activas (o el total manual de la orden si existe).
    const _fmtCOP = n => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(n || 0);
    const totalValorTaller = ordenesActivas.reduce((s, o) => {
      const etsVal = todasEtapas.filter(e => e.orden_id === o.id).reduce((a, e) => a + (e.valor_venta || 0), 0);
      return s + (o.precio_venta_cliente && o.precio_venta_cliente > 0 ? o.precio_venta_cliente : etsVal);
    }, 0);
    const valorTallerHtml = `
      <div class="kpi-valor-taller" onclick="abrirPanelValorTaller()" style="cursor:pointer" title="Ver valor por orden y la meta del mes">
        <div>
          <div class="kpi-vt-lbl">💰 Valor en el taller</div>
          <div class="kpi-vt-sub">Suma de las ${ordenesActivas.length} órdenes activas · <span style="text-decoration:underline">ver detalle y meta →</span></div>
        </div>
        <div class="kpi-vt-num">${_fmtCOP(totalValorTaller)}</div>
      </div>`;

    // ── Capacidad y comercial (datos reales) ──
    const _manana = new Date(hoy); _manana.setDate(_manana.getDate() + 1);
    const _mananaKey = _localDay(_manana);
    const porEntregarHoy    = ordenesActivas.filter(o => _localDay(o.fecha_entrega_1) === _hoyKey).length;
    const porEntregarManana = ordenesActivas.filter(o => _localDay(o.fecha_entrega_1) === _mananaKey).length;
    const cotsPend    = cotsPendientes.length;
    const cotsConvPct = cotsMes.length ? Math.round(cotsMes.filter(c => c.orden_id != null).length / cotsMes.length * 100) : 0;
    const ocupColor   = pctOcup >= 90 ? 'var(--rojo)' : pctOcup >= 70 ? 'var(--amarillo)' : 'var(--verde)';
    const indicadores2Html = `
        <div class="kpi-res-item">
          <div class="kpi-res-num" style="color:var(--azul)">${porEntregarHoy}</div>
          <div class="kpi-res-lbl">Entregar hoy</div>
        </div>
        <div class="kpi-res-item">
          <div class="kpi-res-num">${porEntregarManana}</div>
          <div class="kpi-res-lbl">Entregar mañana</div>
        </div>
        <div class="kpi-res-item">
          <div class="kpi-res-num" style="color:var(--amarillo)">${cotsPend}</div>
          <div class="kpi-res-lbl">Cotiz. pendientes${cotsMes.length ? ' · ' + cotsConvPct + '% conv.' : ''}</div>
        </div>`;

    // Panel "Ocupación del taller" (pulso del día) — a ancho completo, arriba.
    const pulsoHtml = `
      <div class="card" style="padding:12px 18px;display:flex;flex-wrap:wrap;gap:20px;align-items:center;flex:2 1 360px;min-width:0">
        <div style="flex:1;min-width:180px">
          <div style="font-size:9.5px;color:var(--gris-mid);text-transform:uppercase;letter-spacing:.5px;margin-bottom:5px">Ocupación del taller</div>
          <div style="display:flex;align-items:center;gap:9px">
            <div style="flex:1;height:10px;background:var(--gris-bg);border-radius:99px;overflow:hidden"><div style="height:100%;width:${pctOcup}%;background:${pctOcup >= 90 ? '#DC2626' : pctOcup >= 70 ? '#D97706' : '#059669'};border-radius:99px;transition:width .4s var(--ease-out)"></div></div>
            <span style="font-size:14px;font-weight:800;white-space:nowrap">${cuposOcupados}/${CAP}</span>
          </div>
        </div>
        ${_pulsoStat('En pulmón', enPulmon, '#D97706')}
        ${_pulsoStat('Ingresos hoy', ingresosHoy, '#2A5298')}
        ${_pulsoStat('Entregas hoy', entregasHoy, '#059669')}
        ${_pulsoStat('Entregas a tiempo', pctCumpl != null ? pctCumpl + '%' : '—', pctCumpl == null ? '#6B7280' : pctCumpl >= 80 ? '#059669' : pctCumpl >= 60 ? '#D97706' : '#DC2626')}
      </div>`;

    // ── Resumen de PENDIENTES de un vistazo (chips clickeables) ──
    const _pend = [
      { n: k5Filas.length, s: 'vencida',            p: 'vencidas',            key: 'k5', sev: 'rojo' },
      { n: k8Filas.length, s: 'sin moverse +4h',    p: 'sin moverse +4h',     key: 'k8', sev: 'rojo' },
      { n: k4Filas.length, s: 'esperando repuesto', p: 'esperando repuesto',  key: 'k4', sev: 'amarillo' },
      { n: k1Filas.length, s: 'sin técnico',        p: 'sin técnico',         key: 'k1', sev: 'amarillo' },
      { n: k2Filas.length, s: 'sin iniciar',        p: 'sin iniciar',         key: 'k2', sev: 'amarillo' },
      { n: k3Filas.length, s: 'parada',             p: 'paradas',             key: 'k3', sev: 'amarillo' }
    ];
    const _pendAct = _pend.filter(x => x.n > 0);
    const _sevCol  = { rojo: { bg:'#FEF2F2', bd:'#FCA5A5', tx:'#B91C1C' }, amarillo: { bg:'#FFFBEB', bd:'#FDE68A', tx:'#92400E' } };
    const pendientesHtml = `
      <div class="kpi-pend-bar">
        <div class="kpi-pend-titulo">⚠ Pendientes ahora</div>
        <div class="kpi-pend-chips">
          ${_pendAct.length ? _pendAct.map(x => {
            const c = _sevCol[x.sev];
            return `<button onclick="kpiDrilldown('${x.key}')" class="kpi-pend-chip" style="background:${c.bg};border-color:${c.bd};color:${c.tx}">
              <span class="kpi-pend-n">${x.n}</span> ${x.n === 1 ? x.s : x.p}
            </button>`;
          }).join('') : `<span style="font-size:13px;font-weight:700;color:var(--verde)">Todo al día ✓</span>`}
        </div>
      </div>`;

    // ── PANEL: ÓRDENES POR ESTADO (reemplaza los recuadros de conteo) ──────
    // Estilo (sacudida) + bucle de auto-scroll, registrados una sola vez.
    if (!document.getElementById('kpi-sec-style')) {
      const _st = document.createElement('style'); _st.id = 'kpi-sec-style';
      _st.textContent = '@keyframes kpiShake{0%,100%{transform:translateX(0)}15%{transform:translateX(-4px)}30%{transform:translateX(4px)}45%{transform:translateX(-3px)}60%{transform:translateX(3px)}75%{transform:translateX(-1px)}}.kpi-ord-shake{animation:kpiShake .55s ease 2;background:#FEF9C3}.kpi-ord-chip:hover{background:#EFF6FF}';
      document.head.appendChild(_st);
    }
    if (!window._kpiScrollLoop) {
      // Auto-scroll de las secciones que no caben. Mueve una PISTA interna con
      // transform:translateY (sub-pixel + acelerado por GPU) en vez de scrollTop
      // (que redondea a enteros y se ve "a pasos"). Resultado: totalmente fluido.
      const VEL = 14;         // px por segundo
      const PAUSA = 1500;     // ms de pausa al llegar a cada extremo
      let _kpiLast = performance.now();
      const _kpiTick = (now) => {
        const dt = Math.min(80, now - _kpiLast) / 1000; // s (clamp si la pestaña estuvo en 2º plano)
        _kpiLast = now;
        document.querySelectorAll('#taller-kpi-contenido .kpi-sec-body').forEach(body => {
          const track = body.firstElementChild;
          if (!track) return;
          const max = track.offsetHeight - body.clientHeight;
          if (max <= 2) {                              // cabe: nada que mover
            if (body._pos) { body._pos = 0; track.style.transform = 'translateY(0)'; }
            return;
          }
          if (body.matches(':hover')) return;          // mouse encima: pausa
          if (body._pos == null) body._pos = 0;
          if (body._pauseUntil && now < body._pauseUntil) return;
          body._dir = body._dir || 1;
          body._pos += body._dir * VEL * dt;
          if (body._pos >= max) { body._pos = max; body._dir = -1; body._pauseUntil = now + PAUSA; }
          else if (body._pos <= 0) { body._pos = 0; body._dir = 1; body._pauseUntil = now + PAUSA; }
          track.style.transform = `translateY(${(-body._pos).toFixed(2)}px)`;
        });
        window._kpiScrollLoop = requestAnimationFrame(_kpiTick);
      };
      window._kpiScrollLoop = requestAnimationFrame(_kpiTick);
    }

    const _pulmonInt = ordenesActivas.filter(o => o.pulmon && o.pulmon_tipo === 'interno');
    const _pulmonExt = ordenesActivas.filter(o => o.pulmon && o.pulmon_tipo === 'externo');
    const _enProceso = [];
    { const _vistos = new Set();
      etapasActivas.forEach(e => {
        if (_vistos.has(e.orden_id)) return; _vistos.add(e.orden_id);
        const o = ordenesActivas.find(or => or.id === e.orden_id);
        if (!o || o.pulmon) return;
        _enProceso.push({ id: o.id, placa: o.placa, info: (typeof nombreTec === 'function' ? nombreTec(e) : (e.tecnico || e.tercero)) || (e.etapa || e.servicio || '') });
      });
    }
    // CAMBIOS desde el refresco anterior: si la "firma" de una orden cambió
    // (etapa activa, pausa, pulmón, etapas terminadas), se sube de primera y se sacude.
    const _sigMap = {};
    ordenesActivas.forEach(o => {
      const ets = todasEtapas.filter(e => e.orden_id === o.id);
      const act = ets.find(e => e.inicio && !e.fin);
      _sigMap[o.id] = [o.pulmon ? (o.pulmon_tipo || 'p') : '', act ? act.id : '', act ? (act.pausado ? 'P' : 'R') : '', ets.filter(e => e.fin).length].join('|');
    });
    const _prevSig = window._kpiPrevSig || {};
    const _cambiados = new Set();
    Object.keys(_sigMap).forEach(id => { if (_prevSig[id] !== undefined && _prevSig[id] !== _sigMap[id]) _cambiados.add(+id); });
    window._kpiPrevSig = _sigMap;
    const _ordCambia = (filas, getId) => filas.slice().sort((a, b) => (_cambiados.has(getId(b)) ? 1 : 0) - (_cambiados.has(getId(a)) ? 1 : 0));

    const _chipO = (id, placa, info) => `<div class="kpi-ord-chip${_cambiados.has(id) ? ' kpi-ord-shake' : ''}" onclick="_kpiAbrirOrden(${id})" style="display:flex;align-items:center;gap:6px;padding:2px 5px;border-radius:5px;cursor:pointer;line-height:1.2">
        <span style="font-family:'DM Mono',monospace;font-weight:800;font-size:12.5px;color:var(--texto);flex-shrink:0">${escapeHtml(placa || '—')}</span>
        <span style="font-size:11px;font-weight:600;color:#334155;flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escapeHtml(info || '')}</span>
      </div>`;
    const _secO = (ico, titulo, color, filas, mapFn, getId) => `<div class="kpi-sec" style="border:1px solid ${color}33;border-radius:8px;overflow:hidden;display:flex;flex-direction:column;min-height:0">
        <div style="display:flex;align-items:center;justify-content:space-between;gap:6px;padding:4px 8px;background:${color}14;border-left:4px solid ${color}">
          <span style="font-size:11.5px;font-weight:800;color:${color};text-transform:uppercase;letter-spacing:.02em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${ico} ${titulo}</span>
          <span style="font-size:11.5px;font-weight:800;color:#fff;background:${color};border-radius:99px;min-width:20px;text-align:center;padding:1px 6px;flex-shrink:0">${filas.length}</span>
        </div>
        <div class="kpi-sec-body" style="padding:3px 5px;overflow:hidden;flex:1;min-height:0;max-height:150px;background:${color}0a"><div class="kpi-sec-track" style="will-change:transform">${filas.length ? _ordCambia(filas, getId).map(mapFn).join('') : '<div style="font-size:11px;color:var(--gris-mid);padding:3px 5px">—</div>'}</div></div>
      </div>`;
    const seccionesHtml = `<div class="kpi-secciones" style="display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin-top:10px;align-items:stretch">
        ${_secO('🚨','Vencidas','#DC2626', k5Filas, f => _chipO(f.ordenId, f.placa, f.badge), f => f.ordenId)}
        ${_secO('🫁','Pulmón interno','#D97706', _pulmonInt, o => _chipO(o.id, o.placa, _kpiDur(_kpiMs(o.pulmon_desde))), o => o.id)}
        ${_secO('🫁','Pulmón externo','#2563EB', _pulmonExt, o => _chipO(o.id, o.placa, _kpiDur(_kpiMs(o.pulmon_desde))), o => o.id)}
        ${_secO('🔧','En proceso','#059669', _enProceso, o => _chipO(o.id, o.placa, o.info), o => o.id)}
        ${_secO('📋','Sin técnico','#B45309', k1Filas, f => _chipO(f.ordenId, f.placa, f.titulo), f => f.ordenId)}
        ${_secO('⏳','Sin iniciar','#92400E', k2Filas, f => _chipO(f.ordenId, f.placa, f.titulo), f => f.ordenId)}
        ${_secO('🕐','Sin movimiento +4h','#9333EA', k8Filas, f => _chipO(f.ordenId, f.placa, f.badge), f => f.ordenId)}
        ${_secO('🔩','Repuestos atascados','#0891B2', k4Filas, f => _chipO(f.ordenId, f.placa, f.titulo), f => f.ordenId)}
      </div>`;

    renderSinParpadeo(cont, `
      <div class="kpi-shell">

        <div class="kpi-header">
          <div style="display:flex;align-items:center;gap:12px">
            <div style="font-weight:700;font-size:16px;color:var(--texto)">Gestión Operativa</div>
            <div class="kpi-live" style="font-size:11px;color:var(--gris-texto);background:var(--gris-bg);padding:3px 10px 3px 9px;border-radius:99px;border:1px solid var(--gris-borde)"><span class="kpi-live-dot"></span>EN VIVO · ${hora}</div>
          </div>
          <button class="btn btn-ghost btn-sm" onclick="_kpiActualizar(this)">
            <svg class="kpi-refresh-ico" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path d="M23 4v6h-6M1 20v-6h6"/><path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/></svg>
            Actualizar
          </button>
        </div>

        <div class="kpi-fila-top">
          ${valorTallerHtml}
          ${pulsoHtml}
        </div>

        <div class="kpi-resumen">
          <div class="kpi-res-item">
            <div class="kpi-res-num">${ordenesActivas.length}</div>
            <div class="kpi-res-lbl">Órdenes activas</div>
          </div>
          <div class="kpi-res-item">
            <div class="kpi-res-num" style="color:var(--verde)">${etapasActivas.length}</div>
            <div class="kpi-res-lbl">Etapas en proceso</div>
          </div>
          <div class="kpi-res-item">
            <div class="kpi-res-num" style="color:var(--azul)">${tecActivos.length - k7Filas.length}</div>
            <div class="kpi-res-lbl">Técnicos activos</div>
          </div>
          <div class="kpi-res-item">
            <div class="kpi-res-num" style="color:var(--amarillo)">${solicitudesRep.length}</div>
            <div class="kpi-res-lbl">Repuestos pendientes</div>
          </div>
          ${indicadores2Html}
        </div>

        ${seccionesHtml}

        <div class="kpi-grid" style="display:none">
          <div class="kpi-card kpi-${k1Color}" onclick="kpiDrilldown('k1')">
            <div class="kpi-card-ico">📋</div>
            <div class="kpi-card-num">${k1Filas.length}</div>
            <div class="kpi-card-lbl">Sin técnico asignado</div>
            <div class="kpi-card-sub">${k1Filas.length ? 'Más antigua: ' + _kpiDur(k1Max) : 'Sin alertas'}</div>
            <div class="kpi-card-link">Ver detalle →</div>
          </div>

          <div class="kpi-card kpi-${k2Color}" onclick="kpiDrilldown('k2')">
            <div class="kpi-card-ico">⏳</div>
            <div class="kpi-card-num">${k2Filas.length}</div>
            <div class="kpi-card-lbl">Etapas sin iniciar</div>
            <div class="kpi-card-sub">${k2Filas.length ? 'Esperando hace ' + _kpiDur(k2Max) : 'Sin alertas'}</div>
            <div class="kpi-card-link">Ver detalle →</div>
          </div>

          <div class="kpi-card kpi-${k3Color}" onclick="kpiDrilldown('k3')">
            <div class="kpi-card-ico">⏸</div>
            <div class="kpi-card-num">${k3Filas.length}</div>
            <div class="kpi-card-lbl">Entretiempos activos</div>
            <div class="kpi-card-sub">${k3Filas.length ? k3Filas.length + ' orden(es) paradas' : 'Sin brechas'}</div>
            <div class="kpi-card-link">Ver detalle →</div>
          </div>

          <div class="kpi-card kpi-${k4Color}" onclick="kpiDrilldown('k4')">
            <div class="kpi-card-ico">🔧</div>
            <div class="kpi-card-num">${k4Filas.length}</div>
            <div class="kpi-card-lbl">Repuestos atascados</div>
            <div class="kpi-card-sub">${k4Filas.length ? 'Más antigua: ' + _kpiDur(k4Max) : 'Sin alertas'}</div>
            <div class="kpi-card-link">Ver detalle →</div>
          </div>

          <div class="kpi-card kpi-${k5Color}" onclick="kpiDrilldown('k5')">
            <div class="kpi-card-ico">🚨</div>
            <div class="kpi-card-num">${k5Filas.length}</div>
            <div class="kpi-card-lbl">Órdenes vencidas</div>
            <div class="kpi-card-sub">${k5Filas.length ? 'Requieren atención inmediata' : 'Todo en fecha'}</div>
            <div class="kpi-card-link">Ver detalle →</div>
          </div>

          <div class="kpi-card kpi-${k6Color}" onclick="kpiDrilldown('k6')">
            <div class="kpi-card-ico">⚡</div>
            <div class="kpi-card-num">${_kpiDur(k6Prom)}</div>
            <div class="kpi-card-lbl">Prom. asig. → arranque</div>
            <div class="kpi-card-sub">Basado en ${tiemposArr.length} etapas</div>
            <div class="kpi-card-link">Ver historial →</div>
          </div>

          <div class="kpi-card kpi-${k7Color}" onclick="kpiDrilldown('k7')">
            <div class="kpi-card-ico">👷</div>
            <div class="kpi-card-num">${k7Filas.length}</div>
            <div class="kpi-card-lbl">Técnicos libres</div>
            <div class="kpi-card-sub">${k7Filas.length ? k7Filas.slice(0, 2).map(f => f.titulo.split(' ')[0]).join(', ') + (k7Filas.length > 2 ? '...' : '') : 'Todos ocupados'}</div>
            <div class="kpi-card-link">Ver quiénes →</div>
          </div>

          <div class="kpi-card kpi-${k8Color}" onclick="kpiDrilldown('k8')">
            <div class="kpi-card-ico">🕐</div>
            <div class="kpi-card-num">${k8Filas.length}</div>
            <div class="kpi-card-lbl">Sin movimiento +4h</div>
            <div class="kpi-card-sub">${k8Filas.length ? 'Revisar prioridad' : 'Todas con actividad'}</div>
            <div class="kpi-card-link">Ver detalle →</div>
          </div>
        </div>

        <!-- PANELES DE CONTROL (ocultos: reemplazados por "Órdenes por estado") -->
        <div class="kpi-paneles" style="display:none">
          <div class="card kpi-panel">
            <div class="kpi-panel-titulo">Flujo · ingresos vs entregas (7 días)</div>
            <div style="display:flex;align-items:flex-end;gap:6px;height:52px;padding-top:3px">
              ${dias7.map(d => `<div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:3px">
                <div style="display:flex;align-items:flex-end;gap:2px;height:42px">
                  <div title="Ingresos: ${d.ingresos}" style="width:7px;height:${Math.max(Math.round(d.ingresos / maxT * 40), d.ingresos ? 3 : 0)}px;background:#2A5298;border-radius:3px 3px 0 0"></div>
                  <div title="Entregas: ${d.entregas}" style="width:7px;height:${Math.max(Math.round(d.entregas / maxT * 40), d.entregas ? 3 : 0)}px;background:#059669;border-radius:3px 3px 0 0"></div>
                </div>
                <div style="font-size:8px;color:var(--gris-mid)">${d.lbl}</div>
              </div>`).join('')}
            </div>
            <div style="display:flex;gap:14px;margin-top:7px;font-size:9px;color:var(--gris-mid)">
              <span><span style="display:inline-block;width:8px;height:8px;background:#2A5298;border-radius:2px;vertical-align:middle"></span> Ingresos</span>
              <span><span style="display:inline-block;width:8px;height:8px;background:#059669;border-radius:2px;vertical-align:middle"></span> Entregas</span>
            </div>
          </div>

          <div class="card kpi-panel">
            <div class="kpi-panel-titulo">Órdenes por etapa del proceso</div>
            ${_kpiBarras(embudo, '#2A5298')}
          </div>

          <div class="card kpi-panel">
            <div class="kpi-panel-titulo">Órdenes en riesgo (${enRiesgo.length})</div>
            ${enRiesgo.length ? enRiesgo.slice(0, 8).map(o => {
              const venc = o.dias < 0, col = venc ? '#DC2626' : o.dias === 0 ? '#D97706' : '#B45309';
              const txt = venc ? `vencida ${Math.abs(o.dias)}d` : o.dias === 0 ? 'vence hoy' : `en ${o.dias}d`;
              return `<div class="kpi-tec-row" onclick="_kpiAbrirOrden(${o.id})">
                <span style="font-family:'DM Mono',monospace;font-weight:700;font-size:12px;flex-shrink:0">${escapeHtml(o.placa || '—')}</span>
                <span style="font-size:11px;color:var(--gris-mid);flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escapeHtml([o.marca, o.linea].filter(Boolean).join(' ') || '')}</span>
                <span style="font-size:11px;font-weight:700;color:${col};flex-shrink:0">${txt}</span>
              </div>`;
            }).join('') : '<div style="font-size:12px;color:var(--gris-mid)">Ninguna orden en riesgo ✓</div>'}
          </div>
        </div>

      </div>`);

    // Animar números (cuenta + flash en los que cambiaron) tras cada refresco.
    _kpiAnimarNumeros();

  } catch (err) {
    if (cont) cont.innerHTML = `<div class="empty-state" style="padding:40px">
      <div style="font-size:32px;margin-bottom:12px">⚠️</div>
      <div style="font-weight:700;margin-bottom:6px">Error cargando KPIs</div>
      <div style="font-size:13px;color:var(--gris-mid)">${escapeHtml(err.message)}</div>
    </div>`;
  }
}

// ═══════════════════════════════════════════════════════════
// PANEL "Valor en el taller + Meta del mes" (clic en el valor del taller).
// Muestra el valor por orden activa que suma el total, y la meta mensual de
// ingresos (del módulo Metas) con cuánto se lleva, cuánto falta y barra/gráfico.
// ═══════════════════════════════════════════════════════════
async function abrirPanelValorTaller() {
  const _fmt = n => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(n || 0);
  document.getElementById('panel-valor-taller')?.remove();
  const ov = document.createElement('div');
  ov.id = 'panel-valor-taller';
  ov.style.cssText = 'position:fixed;inset:0;z-index:800;background:rgba(0,0,0,.55);display:flex;align-items:center;justify-content:center;padding:16px';
  ov.innerHTML = `<div style="background:#fff;border-radius:16px;max-width:640px;width:100%;max-height:90vh;display:flex;flex-direction:column;box-shadow:0 20px 60px rgba(0,0,0,.3);overflow:hidden;font-family:'DM Sans',sans-serif">
    <div style="background:#1E3A5F;color:#fff;padding:14px 18px;display:flex;align-items:center;justify-content:space-between">
      <div style="font-size:15px;font-weight:700">💰 Valor en el taller y meta del mes</div>
      <button onclick="document.getElementById('panel-valor-taller').remove()" style="background:none;border:none;color:#fff;font-size:22px;cursor:pointer;line-height:1">×</button>
    </div>
    <div id="pvt-body" style="padding:16px 18px;overflow:auto;flex:1"><div class="loading-state">Cargando...</div></div>
  </div>`;
  ov.addEventListener('click', e => { if (e.target === ov) ov.remove(); });
  document.body.appendChild(ov);
  try {
    const ahora = new Date();
    const inicioMes = new Date(ahora.getFullYear(), ahora.getMonth(), 1).toISOString();
    const anio = ahora.getFullYear(), mesNum = ahora.getMonth() + 1;
    const [ords, metas, etMes] = await Promise.all([
      api(`/ordenes?or=(estado.eq.Activa,estado.is.null)&pulmon=not.eq.true&select=id,placa,propietario,precio_venta_cliente,insumos,repuestos_simple&limit=300`).catch(() => []) || [],
      api(`/metas_taller?ano=eq.${anio}&mes_num=eq.${mesNum}&limit=1`).catch(() => []) || [],
      api(`/etapas?fin=gte.${inicioMes}&fin=not.is.null&select=valor`).catch(() => []) || []
    ]);
    const ids = ords.map(o => o.id).join(',');
    const ets = ids ? (await api(`/etapas?orden_id=in.(${ids})&select=orden_id,valor_venta`).catch(() => []) || []) : [];
    const valItems = (o, campo) => { try { const raw = o[campo]; const a = Array.isArray(raw) ? raw : (typeof raw === 'string' && raw ? JSON.parse(raw) : []); return a.reduce((s, i) => s + (((+i.cantidad) || 0) * ((+i.valor) || 0)), 0); } catch (e) { return 0; } };
    const filas = ords.map(o => {
      const mo = ets.filter(e => e.orden_id === o.id).reduce((a, e) => a + (e.valor_venta || 0), 0);
      const v = (o.precio_venta_cliente && o.precio_venta_cliente > 0) ? o.precio_venta_cliente : (mo + valItems(o, 'insumos') + valItems(o, 'repuestos_simple'));
      return { placa: o.placa, v };
    }).filter(f => f.v > 0).sort((a, b) => b.v - a.v);
    const totalTaller = filas.reduce((s, f) => s + f.v, 0);
    const maxV = Math.max(1, ...filas.map(f => f.v));
    const meta = metas[0]?.meta_ingresos || 0;
    const ingresosMes = etMes.reduce((s, e) => s + (e.valor || 0), 0);
    const falta = Math.max(0, meta - ingresosMes);
    const pctReal = meta > 0 ? Math.round(ingresosMes / meta * 100) : 0;
    const pctBar = Math.min(pctReal, 100);
    const colorBar = pctReal >= 100 ? '#059669' : pctReal >= 70 ? '#D97706' : '#DC2626';

    const ordRows = filas.length ? filas.map(f => `<div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
        <span style="font-family:'DM Mono',monospace;font-weight:800;font-size:12.5px;width:62px;flex-shrink:0">${escapeHtml(f.placa || '—')}</span>
        <div style="flex:1;height:13px;background:var(--gris-bg);border-radius:99px;overflow:hidden"><div style="height:100%;width:${Math.round(f.v / maxV * 100)}%;background:#2A5298;border-radius:99px"></div></div>
        <span style="font-size:12px;font-weight:700;font-family:'DM Mono',monospace;flex-shrink:0;width:98px;text-align:right">${_fmt(f.v)}</span>
      </div>`).join('') : '<div style="color:var(--gris-mid);font-size:13px">Sin órdenes con valor.</div>';

    const body = document.getElementById('pvt-body');
    if (body) body.innerHTML = `
      <div style="font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.06em;color:#1D4ED8;margin-bottom:8px">Valor por orden activa (${filas.length})</div>
      ${ordRows}
      <div style="display:flex;justify-content:space-between;border-top:2px solid var(--azul-mid);margin-top:8px;padding-top:8px;font-weight:800;color:var(--azul);font-size:14px"><span>Total en el taller</span><span style="font-family:'DM Mono',monospace">${_fmt(totalTaller)}</span></div>
      <div style="font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.06em;color:#047857;margin:20px 0 8px">📈 Meta del mes</div>
      ${meta > 0 ? `
        <div style="display:flex;justify-content:space-between;font-size:13px;margin-bottom:5px"><span style="color:var(--gris-mid)">Logrado este mes</span><strong>${_fmt(ingresosMes)}</strong></div>
        <div style="height:22px;background:var(--gris-bg);border-radius:99px;overflow:hidden;margin-bottom:7px"><div style="height:100%;width:${pctBar}%;min-width:34px;background:${colorBar};border-radius:99px;display:flex;align-items:center;justify-content:flex-end;padding-right:9px;color:#fff;font-size:11px;font-weight:800;transition:width .5s ease">${pctReal}%</div></div>
        <div style="display:flex;justify-content:space-between;font-size:12.5px"><span style="color:var(--gris-mid)">Meta: <strong style="color:var(--texto)">${_fmt(meta)}</strong></span><span style="color:${falta > 0 ? '#DC2626' : '#059669'};font-weight:700">${falta > 0 ? 'Faltan ' + _fmt(falta) : '¡Meta cumplida! 🎉'}</span></div>
      ` : `<div style="font-size:13px;color:#B45309;background:#FEF3C7;border:1px solid #FDE68A;border-radius:8px;padding:10px 12px">No hay meta cargada para este mes. Cárgala en el módulo <strong>Metas</strong>.</div>`}`;
  } catch (e) { const b = document.getElementById('pvt-body'); if (b) b.innerHTML = `<div class="empty-state">Error: ${e.message}</div>`; }
}
