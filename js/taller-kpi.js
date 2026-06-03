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

// ── Modal de drilldown ───────────────────────────────────
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

// ── Función principal ────────────────────────────────────
async function cargarKPITaller() {
  const cont = document.getElementById('taller-kpi-contenido');
  if (!cont) return;

  const ahora = Date.now();
  const hoy = new Date(); hoy.setHours(0, 0, 0, 0);

  try {
    const [ordenesActivas, todasEtapas, solicitudesRep, mecanicosData] = await Promise.all([
      api('/ordenes?estado=eq.Activa&order=creado_en.asc').catch(() => []),
      api('/etapas?select=id,orden_id,etapa,servicio,mecanico_id,tecnico,creado_en,inicio,fin,pausado,tiempo_pausado_min&order=creado_en.asc').catch(() => []),
      api('/solicitudes_repuesto?estado=not.in.(entregado,rechazado)&order=creado_en.asc').catch(() => []),
      api('/mecanicos?activo=eq.true&order=nombre.asc').catch(() => [])
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

    // ── Datos de los paneles (debajo de los KPIs) ─────────
    // 1) Carga por sección — etapas activas agrupadas por etapa
    const _porSeccion = {};
    etapasActivas.forEach(e => {
      const sec = e.etapa || e.servicio || 'Otro';
      _porSeccion[sec] = (_porSeccion[sec] || 0) + 1;
    });
    const cargaSeccion = Object.entries(_porSeccion)
      .map(([label, valor]) => ({ label, valor }))
      .sort((a, b) => b.valor - a.valor).slice(0, 8);

    // 2) Órdenes por días en taller
    const _buckets = { '0–3 días': 0, '4–7 días': 0, '8–15 días': 0, '+15 días': 0 };
    ordenesActivas.forEach(o => {
      const base = o.ingreso_en || o.creado_en;
      const d = base ? Math.floor((Date.now() - new Date(base)) / 86400000) : 0;
      if (d <= 3) _buckets['0–3 días']++;
      else if (d <= 7) _buckets['4–7 días']++;
      else if (d <= 15) _buckets['8–15 días']++;
      else _buckets['+15 días']++;
    });
    const _diasCol = { '0–3 días': '#059669', '4–7 días': '#2A5298', '8–15 días': '#D97706', '+15 días': '#DC2626' };
    const ordenesDias = Object.entries(_buckets).map(([label, valor]) => ({ label, valor, color: _diasCol[label] }));

    // 3) Repuestos por estado
    const _repLbl = { pendiente_jefe: 'Solicitado', enviado_repuestos: 'En repuestos', cotizado: 'Cotizado', pedido: 'Pedido', recibido_taller: 'En taller' };
    const _porRep = {};
    (solicitudesRep || []).forEach(s => { const l = _repLbl[s.estado]; if (l) _porRep[l] = (_porRep[l] || 0) + 1; });
    const repuestosEstado = Object.values(_repLbl).map(l => ({ label: l, valor: _porRep[l] || 0 }));

    // 4) Técnicos: qué hacen ahora
    const tecnicosAhora = etapasActivas.map(e => {
      const o = ordenesActivas.find(or => or.id === e.orden_id) || {};
      return { tecnico: e.tecnico || 'Sin técnico', placa: o.placa || '—', ordenId: e.orden_id, etapa: e.etapa || e.servicio || '', ms: e.inicio ? Date.now() - new Date(e.inicio).getTime() : 0 };
    }).sort((a, b) => b.ms - a.ms);

    renderSinParpadeo(cont, `
      <div class="kpi-shell">

        <div class="kpi-header">
          <div style="display:flex;align-items:center;gap:12px">
            <div style="font-weight:700;font-size:16px;color:var(--texto)">Gestión Operativa</div>
            <div style="font-size:11px;color:var(--gris-mid);background:var(--gris-bg);padding:3px 10px;border-radius:99px;border:1px solid var(--gris-borde)">Actualizado ${hora}</div>
          </div>
          <button class="btn btn-ghost btn-sm" onclick="cargarKPITaller()">
            <svg width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path d="M23 4v6h-6M1 20v-6h6"/><path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/></svg>
            Actualizar
          </button>
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
        </div>

        <div class="kpi-grid">
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

        <!-- PANELES / GRÁFICOS -->
        <div class="kpi-paneles">
          <div class="card kpi-panel">
            <div class="kpi-panel-titulo">Carga por sección · etapas activas</div>
            ${_kpiBarras(cargaSeccion, '#2A5298')}
          </div>
          <div class="card kpi-panel">
            <div class="kpi-panel-titulo">Órdenes por días en taller</div>
            ${_kpiBarras(ordenesDias, '#2A5298')}
          </div>
          <div class="card kpi-panel">
            <div class="kpi-panel-titulo">Repuestos por estado</div>
            ${_kpiBarras(repuestosEstado, '#7C3AED')}
          </div>
          <div class="card kpi-panel">
            <div class="kpi-panel-titulo">Técnicos · qué hacen ahora (${tecnicosAhora.length})</div>
            ${tecnicosAhora.length ? tecnicosAhora.map(t => `
              <div class="kpi-tec-row" onclick="_kpiAbrirOrden(${t.ordenId})">
                <span style="width:7px;height:7px;border-radius:50%;background:#22C55E;flex-shrink:0;box-shadow:0 0 0 2px #DCFCE7"></span>
                <span style="font-weight:600;font-size:12px;flex-shrink:0">${escapeHtml(t.tecnico)}</span>
                <span style="font-family:'DM Mono',monospace;font-size:11px;color:var(--gris-mid);flex-shrink:0">${escapeHtml(t.placa)}</span>
                <span style="font-size:11px;color:var(--gris-mid);flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;text-align:right">${escapeHtml(t.etapa)}</span>
                <span style="font-size:11px;font-weight:700;color:var(--azul);flex-shrink:0">${_kpiDur(t.ms)}</span>
              </div>`).join('') : '<div style="font-size:12px;color:var(--gris-mid)">Ningún técnico trabajando ahora</div>'}
          </div>
        </div>

      </div>`);

  } catch (err) {
    if (cont) cont.innerHTML = `<div class="empty-state" style="padding:40px">
      <div style="font-size:32px;margin-bottom:12px">⚠️</div>
      <div style="font-weight:700;margin-bottom:6px">Error cargando KPIs</div>
      <div style="font-size:13px;color:var(--gris-mid)">${escapeHtml(err.message)}</div>
    </div>`;
  }
}
