// ═══ HISTORIAL DE VEHÍCULO ═══
let _hvPlacaActual = null;

async function montarHistorialVehiculo(placaInicial) {
  const pag = document.getElementById('pag-historial-vehiculo');
  if (!pag) return;

  pag.innerHTML = `
    <div class="hv-wrap">
      <div class="hv-header">
        <h2 class="hv-titulo">Historial de Vehículo</h2>
        <div class="hv-buscador">
          <input
            id="hv-input-placa"
            class="hv-input"
            type="text"
            placeholder="Ej: ABC123"
            maxlength="8"
            autocomplete="off"
            spellcheck="false"
          />
          <button id="hv-btn-buscar" class="hv-btn-buscar">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            Buscar
          </button>
        </div>
      </div>
      <div id="hv-contenido"></div>
    </div>
  `;

  // Estilos embebidos del módulo
  if (!document.getElementById('hv-styles')) {
    const style = document.createElement('style');
    style.id = 'hv-styles';
    style.textContent = `
      .hv-wrap { max-width: 860px; margin: 0 auto; padding: 24px 16px 48px; }

      .hv-header { margin-bottom: 24px; }
      .hv-titulo { font-size: 1.35rem; font-weight: 700; color: var(--texto); margin: 0 0 16px; }

      .hv-buscador { display: flex; gap: 8px; }
      .hv-input {
        flex: 1; max-width: 280px;
        padding: 10px 14px; border-radius: 8px;
        border: 1.5px solid var(--gris-borde); background: var(--surface);
        color: var(--texto); font-size: 1rem; font-weight: 600; letter-spacing: 1px;
        text-transform: uppercase; outline: none; transition: border-color .15s;
      }
      .hv-input:focus { border-color: var(--azul); }
      .hv-btn-buscar {
        display: flex; align-items: center; gap: 6px;
        padding: 10px 18px; border-radius: 8px;
        background: var(--azul); color: #fff; border: none;
        font-size: .9rem; font-weight: 600; cursor: pointer;
        transition: opacity .15s;
      }
      .hv-btn-buscar:hover { opacity: .88; }
      .hv-btn-buscar:active { opacity: .75; }

      /* Vacío */
      .hv-vacio {
        display: flex; flex-direction: column; align-items: center;
        justify-content: center; padding: 64px 24px; gap: 16px;
        color: var(--gris-mid); text-align: center;
      }
      .hv-vacio svg { opacity: .35; }
      .hv-vacio-titulo { font-size: 1.05rem; font-weight: 600; margin: 0; color: var(--texto); opacity: .5; }
      .hv-vacio-sub { font-size: .88rem; margin: 0; max-width: 300px; line-height: 1.5; }

      /* Spinner */
      .hv-spinner {
        display: flex; justify-content: center; align-items: center;
        padding: 64px 24px;
      }
      .hv-spin {
        width: 36px; height: 36px; border-radius: 50%;
        border: 3px solid var(--gris-borde);
        border-top-color: var(--azul);
        animation: hv-giro .7s linear infinite;
      }
      @keyframes hv-giro { to { transform: rotate(360deg); } }

      /* Sin resultados */
      .hv-sin-resultados {
        background: var(--surface); border: 1.5px solid var(--gris-borde);
        border-radius: 12px; padding: 40px 24px; text-align: center;
        color: var(--gris-mid);
      }
      .hv-sin-resultados strong { color: var(--texto); }

      /* Ficha */
      .hv-ficha { display: flex; flex-direction: column; gap: 20px; }

      .hv-placa-card {
        background: var(--surface); border: 1.5px solid var(--gris-borde);
        border-radius: 14px; padding: 20px 24px;
        display: flex; flex-wrap: wrap; gap: 16px 32px; align-items: flex-start;
      }
      .hv-placa-bloque { flex: 1; min-width: 180px; }
      .hv-placa-num {
        font-size: 2rem; font-weight: 800; letter-spacing: 3px;
        color: var(--azul); margin: 0 0 4px;
      }
      .hv-placa-meta { font-size: .85rem; color: var(--gris-mid); margin: 0; line-height: 1.6; }
      .hv-placa-meta span { color: var(--texto); font-weight: 500; }

      .hv-kpis {
        display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
        gap: 12px;
      }
      .hv-kpi {
        background: var(--gris-bg); border: 1.5px solid var(--gris-borde);
        border-radius: 10px; padding: 14px 16px;
      }
      .hv-kpi-label { font-size: .75rem; color: var(--gris-mid); font-weight: 600; text-transform: uppercase; letter-spacing: .5px; margin-bottom: 4px; }
      .hv-kpi-val { font-size: 1.25rem; font-weight: 700; color: var(--texto); }
      .hv-kpi-sub { font-size: .75rem; color: var(--gris-mid); margin-top: 2px; }

      /* Timeline */
      .hv-timeline-titulo {
        font-size: .85rem; font-weight: 700; text-transform: uppercase;
        letter-spacing: .6px; color: var(--gris-mid); margin: 0 0 12px;
      }
      .hv-timeline { display: flex; flex-direction: column; gap: 10px; }

      .hv-orden {
        background: var(--surface); border: 1.5px solid var(--gris-borde);
        border-radius: 12px; overflow: hidden;
        border-left: 4px solid var(--gris-mid);
        transition: border-color .15s;
      }
      .hv-orden.estado-Activa    { border-left-color: var(--azul); }
      .hv-orden.estado-Entregada { border-left-color: var(--verde); }
      .hv-orden.estado-Archivada { border-left-color: var(--gris-mid); }

      .hv-orden-head {
        display: flex; align-items: center; gap: 12px; flex-wrap: wrap;
        padding: 14px 16px; cursor: pointer; user-select: none;
        transition: background .12s;
      }
      .hv-orden-head:hover { background: var(--gris-bg); }

      .hv-orden-fecha { font-size: .8rem; color: var(--gris-mid); min-width: 90px; }
      .hv-orden-fecha strong { display: block; font-size: .88rem; color: var(--texto); font-weight: 600; }

      .hv-chip {
        display: inline-block; padding: 2px 9px; border-radius: 99px;
        font-size: .72rem; font-weight: 700; text-transform: uppercase; letter-spacing: .4px;
      }
      .hv-chip-azul  { background: color-mix(in srgb, var(--azul) 15%, transparent); color: var(--azul); }
      .hv-chip-verde { background: color-mix(in srgb, var(--verde) 15%, transparent); color: var(--verde); }
      .hv-chip-gris  { background: color-mix(in srgb, var(--gris-mid) 15%, transparent); color: var(--gris-mid); }

      .hv-orden-servicios { display: flex; flex-wrap: wrap; gap: 4px; flex: 1; }
      .hv-tag-servicio {
        background: var(--gris-bg); border: 1px solid var(--gris-borde);
        border-radius: 6px; padding: 2px 8px;
        font-size: .72rem; color: var(--gris-mid); font-weight: 500;
      }
      .hv-orden-total { font-size: .9rem; font-weight: 700; color: var(--texto); margin-left: auto; white-space: nowrap; }
      .hv-orden-caret {
        font-size: .8rem; color: var(--gris-mid); transition: transform .2s; flex-shrink: 0;
      }
      .hv-orden.abierta .hv-orden-caret { transform: rotate(180deg); }

      .hv-orden-body {
        display: none; padding: 0 16px 16px; border-top: 1px solid var(--gris-borde);
        animation: hv-fade-in .15s ease;
      }
      .hv-orden.abierta .hv-orden-body { display: block; }
      @keyframes hv-fade-in { from { opacity: 0; transform: translateY(-4px); } to { opacity: 1; transform: none; } }

      .hv-detalle-titulo {
        font-size: .75rem; font-weight: 700; text-transform: uppercase;
        letter-spacing: .5px; color: var(--gris-mid); margin: 14px 0 8px;
      }
      .hv-etapa-row, .hv-rep-row {
        display: flex; justify-content: space-between; align-items: center;
        padding: 6px 0; border-bottom: 1px solid var(--gris-borde); gap: 12px;
        font-size: .83rem;
      }
      .hv-etapa-row:last-child, .hv-rep-row:last-child { border-bottom: none; }
      .hv-etapa-nombre { color: var(--texto); font-weight: 500; }
      .hv-etapa-op { color: var(--gris-mid); font-size: .75rem; }
      .hv-etapa-val { color: var(--texto); font-weight: 600; white-space: nowrap; }
      .hv-rep-nombre { color: var(--texto); }
      .hv-rep-uds { color: var(--gris-mid); font-size: .78rem; }
      .hv-rep-est { }
      .hv-vacio-detalle { color: var(--gris-mid); font-size: .82rem; padding: 4px 0; }

      .hv-dias-taller { font-size: .75rem; color: var(--gris-mid); margin-left: 4px; }

      @media (max-width: 600px) {
        .hv-placa-num { font-size: 1.5rem; }
        .hv-kpis { grid-template-columns: 1fr 1fr; }
        .hv-orden-total { margin-left: 0; }
      }
    `;
    document.head.appendChild(style);
  }

  // Eventos
  const input = document.getElementById('hv-input-placa');
  const btn   = document.getElementById('hv-btn-buscar');

  input.addEventListener('input', () => {
    input.value = input.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
  });
  input.addEventListener('keydown', e => {
    if (e.key === 'Enter') _hvBuscar(input.value.trim());
  });
  btn.addEventListener('click', () => _hvBuscar(input.value.trim()));

  // Estado inicial
  if (placaInicial) {
    input.value = placaInicial.toUpperCase();
    await _hvBuscar(placaInicial.toUpperCase());
  } else {
    _hvRenderVacio();
  }
}

// ─── Buscar ───────────────────────────────────────────────────────────────────
async function _hvBuscar(placa) {
  if (!placa) { toast('Ingresa una placa para buscar', 'warn'); return; }

  _hvPlacaActual = placa;
  const cont = document.getElementById('hv-contenido');
  if (!cont) return;

  // Spinner
  cont.innerHTML = `<div class="hv-spinner"><div class="hv-spin"></div></div>`;

  // 1. Ordenes
  const ordenes = await api(
    `/ordenes?placa=eq.${encodeURIComponent(placa)}&select=id,placa,marca,linea,color,km,propietario,telefono,creado_en,entregada_en,estado,tipo_cliente,aseguradora&order=creado_en.desc`
  );

  if (!ordenes) {
    cont.innerHTML = `<div class="hv-sin-resultados"><p>Error al consultar las órdenes. Intenta de nuevo.</p></div>`;
    return;
  }

  if (ordenes.length === 0) {
    cont.innerHTML = `
      <div class="hv-sin-resultados">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" opacity=".3">
          <circle cx="12" cy="12" r="10"/><line x1="8" y1="12" x2="16" y2="12"/>
        </svg>
        <p style="margin:12px 0 4px;font-size:1rem;font-weight:600;">Sin resultados para <strong>${escapeHtml(placa)}</strong></p>
        <p style="font-size:.85rem;color:var(--gris-mid);margin:0;">No se encontraron órdenes registradas con esta placa.</p>
      </div>`;
    return;
  }

  // 2. Etapas y repuestos en paralelo
  const ids = ordenes.map(o => o.id);
  const inIds = `(${ids.join(',')})`;

  const [etapas, solicitudes] = await Promise.all([
    api(`/etapas?orden_id=in.${inIds}&select=orden_id,servicio,valor,horas_facturadas,operario_id,estado&order=orden_id`),
    api(`/solicitudes_repuesto?orden_id=in.${inIds}&select=orden_id,repuesto,unidades,estado&order=orden_id`),
  ]);

  // 3. Operarios únicos
  let perfiles = [];
  const opIds = [...new Set((etapas || []).map(e => e.operario_id).filter(Boolean))];
  if (opIds.length > 0) {
    const ps = await api(`/perfiles?id=in.(${opIds.join(',')})&select=id,nombre`);
    if (ps) perfiles = ps;
  }

  _hvRenderResultados(ordenes, etapas || [], solicitudes || [], perfiles);
}

// ─── Render vacío ─────────────────────────────────────────────────────────────
function _hvRenderVacio() {
  const cont = document.getElementById('hv-contenido');
  if (!cont) return;
  cont.innerHTML = `
    <div class="hv-vacio">
      <svg width="80" height="80" viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="1.8">
        <rect x="4" y="20" width="56" height="28" rx="7"/>
        <path d="M12 20l4-8h32l4 8"/>
        <circle cx="16" cy="48" r="5" fill="var(--gris-bg)" stroke="currentColor"/>
        <circle cx="48" cy="48" r="5" fill="var(--gris-bg)" stroke="currentColor"/>
        <line x1="22" y1="31" x2="42" y2="31" stroke-linecap="round"/>
      </svg>
      <p class="hv-vacio-titulo">Historial de vehículo</p>
      <p class="hv-vacio-sub">Busca por número de placa para ver el historial completo del vehículo.</p>
    </div>
  `;
}

// ─── Render resultados ────────────────────────────────────────────────────────
function _hvRenderResultados(ordenes, etapas, solicitudes, perfiles) {
  const cont = document.getElementById('hv-contenido');
  if (!cont) return;

  const perfilMap = Object.fromEntries(perfiles.map(p => [p.id, p.nombre]));

  // Agrupaciones por orden_id
  const etapasPorOrden = {};
  for (const e of etapas) {
    (etapasPorOrden[e.orden_id] = etapasPorOrden[e.orden_id] || []).push(e);
  }
  const repsPorOrden = {};
  for (const r of solicitudes) {
    (repsPorOrden[r.orden_id] = repsPorOrden[r.orden_id] || []).push(r);
  }

  // Datos del vehículo (de la primera orden con datos)
  const vehiculo = ordenes.find(o => o.marca || o.linea || o.color) || ordenes[0];
  const placa    = vehiculo.placa || _hvPlacaActual;

  // KM actual = máximo km registrado
  const kmActual = ordenes.reduce((max, o) => {
    const k = parseInt(o.km) || 0;
    return k > max ? k : max;
  }, 0);

  // KPIs
  const totalOrdenes = ordenes.length;

  const totalInvertido = ordenes.reduce((sum, o) => {
    const valorEtapas = (etapasPorOrden[o.id] || []).reduce((s, e) => s + (parseFloat(e.valor) || 0), 0);
    return sum + valorEtapas;
  }, 0);

  const fechas = ordenes
    .map(o => o.creado_en ? new Date(o.creado_en) : null)
    .filter(Boolean)
    .sort((a, b) => a - b);

  let promDias = '—';
  if (fechas.length >= 2) {
    let totalMs = 0;
    for (let i = 1; i < fechas.length; i++) totalMs += fechas[i] - fechas[i - 1];
    const avg = totalMs / (fechas.length - 1) / 86400000;
    promDias = Math.round(avg) + ' días';
  }

  const ultimoIngreso = ordenes[0]?.creado_en
    ? _hvFecha(ordenes[0].creado_en)
    : '—';

  const proximaRevision = kmActual > 0
    ? `${(kmActual + 5000).toLocaleString('es-CO')} km`
    : 'No disponible';

  // Ficha HTML
  const marcaLinea = [vehiculo.marca, vehiculo.linea].filter(Boolean).join(' · ') || '—';
  const color      = vehiculo.color || '—';

  const fichaHtml = `
    <div class="hv-ficha">
      <!-- Encabezado del vehículo -->
      <div class="hv-placa-card">
        <div class="hv-placa-bloque">
          <p class="hv-placa-num">${escapeHtml(placa)}</p>
          <p class="hv-placa-meta">
            Marca/Línea: <span>${escapeHtml(marcaLinea)}</span><br>
            Color: <span>${escapeHtml(color)}</span><br>
            ${vehiculo.propietario ? `Propietario: <span>${escapeHtml(vehiculo.propietario)}</span>` : ''}
          </p>
        </div>
        <div class="hv-placa-bloque">
          <p class="hv-placa-meta">
            KM actual: <span style="font-size:1.1rem;font-weight:700;">${kmActual > 0 ? kmActual.toLocaleString('es-CO') : '—'}</span><br>
            Próxima revisión: <span>${escapeHtml(proximaRevision)}</span>
          </p>
        </div>
      </div>

      <!-- KPIs -->
      <div class="hv-kpis">
        <div class="hv-kpi">
          <div class="hv-kpi-label">Órdenes</div>
          <div class="hv-kpi-val">${totalOrdenes}</div>
        </div>
        <div class="hv-kpi">
          <div class="hv-kpi-label">Total invertido</div>
          <div class="hv-kpi-val">${_hvMoneda(totalInvertido)}</div>
        </div>
        <div class="hv-kpi">
          <div class="hv-kpi-label">Entre visitas</div>
          <div class="hv-kpi-val">${escapeHtml(promDias)}</div>
          <div class="hv-kpi-sub">promedio</div>
        </div>
        <div class="hv-kpi">
          <div class="hv-kpi-label">Último ingreso</div>
          <div class="hv-kpi-val" style="font-size:.95rem;">${escapeHtml(ultimoIngreso)}</div>
        </div>
      </div>

      <!-- Timeline -->
      <div>
        <p class="hv-timeline-titulo">Historial de órdenes</p>
        <div class="hv-timeline" id="hv-timeline">
          ${ordenes.map((o, i) => _hvOrdenHtml(o, etapasPorOrden[o.id] || [], repsPorOrden[o.id] || [], perfilMap, ordenes.length - i, ordenes.length)).join('')}
        </div>
      </div>
    </div>
  `;

  cont.innerHTML = fichaHtml;

  // Eventos de toggle
  document.querySelectorAll('.hv-orden-head').forEach(head => {
    head.addEventListener('click', () => {
      const id = head.closest('.hv-orden').dataset.id;
      _hvToggleOrden(id);
    });
  });
}

// ─── HTML de una orden ────────────────────────────────────────────────────────
function _hvOrdenHtml(orden, etapas, reps, perfilMap, visitaNum, totalVisitas) {
  const chipClass = {
    'Activa':    'hv-chip-azul',
    'Entregada': 'hv-chip-verde',
    'Archivada': 'hv-chip-gris',
  }[orden.estado] || 'hv-chip-gris';

  const totalOrden = etapas.reduce((s, e) => s + (parseFloat(e.valor) || 0), 0);

  // Días en taller
  let diasTaller = '';
  if (orden.creado_en && orden.entregada_en) {
    const d = Math.round((new Date(orden.entregada_en) - new Date(orden.creado_en)) / 86400000);
    diasTaller = `<span class="hv-dias-taller">(${d} día${d !== 1 ? 's' : ''})</span>`;
  } else if (orden.creado_en && orden.estado === 'Activa') {
    const d = Math.round((Date.now() - new Date(orden.creado_en)) / 86400000);
    diasTaller = `<span class="hv-dias-taller">(${d} día${d !== 1 ? 's' : ''} activa)</span>`;
  }

  // Servicios únicos
  const servicios = [...new Set(etapas.map(e => e.servicio).filter(Boolean))];
  const tagsHtml = servicios.length
    ? servicios.map(s => `<span class="hv-tag-servicio">${escapeHtml(s)}</span>`).join('')
    : `<span class="hv-tag-servicio" style="opacity:.5;">Sin servicios</span>`;

  // Detalle etapas
  const etapasHtml = etapas.length
    ? etapas.map(e => `
        <div class="hv-etapa-row">
          <div>
            <div class="hv-etapa-nombre">${escapeHtml(e.servicio || '—')}</div>
            ${e.operario_id ? `<div class="hv-etapa-op">${escapeHtml(perfilMap[e.operario_id] || 'Operario ' + e.operario_id)}</div>` : ''}
          </div>
          <div class="hv-etapa-val">${_hvMoneda(e.valor)}</div>
        </div>`).join('')
    : `<p class="hv-vacio-detalle">Sin etapas registradas.</p>`;

  // Detalle repuestos
  const repsHtml = reps.length
    ? reps.map(r => `
        <div class="hv-rep-row">
          <div class="hv-rep-nombre">${escapeHtml(r.repuesto || '—')}</div>
          <div class="hv-rep-uds">${r.unidades != null ? 'x' + r.unidades : ''}</div>
          <div class="hv-rep-est">
            <span class="hv-chip ${r.estado === 'Aprobado' ? 'hv-chip-verde' : r.estado === 'Rechazado' ? 'hv-chip-gris' : 'hv-chip-azul'}" style="font-size:.68rem;">
              ${escapeHtml(r.estado || 'Pendiente')}
            </span>
          </div>
        </div>`).join('')
    : `<p class="hv-vacio-detalle">Sin repuestos registrados.</p>`;

  return `
    <div class="hv-orden estado-${escapeHtml(orden.estado || '')}" data-id="${orden.id}">
      <div class="hv-orden-head">
        <div class="hv-orden-fecha">
          <strong>${_hvFecha(orden.creado_en)}</strong>
          ${orden.entregada_en ? `<span style="font-size:.75rem;color:var(--gris-mid);">→ ${_hvFecha(orden.entregada_en)}</span>` : ''}
          ${diasTaller}
        </div>
        <span class="hv-chip ${chipClass}">${escapeHtml(orden.estado || '—')}</span>
        ${visitaNum != null ? `<span style="font-size:11px;font-weight:700;background:#EFF6FF;color:#2563EB;border:1px solid #BFDBFE;padding:2px 9px;border-radius:99px;white-space:nowrap">Visita ${visitaNum} de ${totalVisitas}</span>` : ''}
        <div class="hv-orden-servicios">${tagsHtml}</div>
        <div class="hv-orden-total">${_hvMoneda(totalOrden)}</div>
        <span class="hv-orden-caret">▼</span>
      </div>
      <div class="hv-orden-body">
        <p class="hv-detalle-titulo">Servicios / Etapas</p>
        ${etapasHtml}
        <p class="hv-detalle-titulo">Repuestos</p>
        ${repsHtml}
      </div>
    </div>
  `;
}

// ─── Toggle expand/collapse ───────────────────────────────────────────────────
function _hvToggleOrden(id) {
  const el = document.querySelector(`.hv-orden[data-id="${id}"]`);
  if (!el) return;
  el.classList.toggle('abierta');
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function _hvFecha(iso) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch { return iso; }
}

function _hvMoneda(val) {
  const n = parseFloat(val) || 0;
  if (n === 0) return '$0';
  return '$' + Math.round(n).toLocaleString('es-CO');
}
