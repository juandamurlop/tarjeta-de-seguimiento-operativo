// ═══════════════════════════════════════════════════════════
// REPORTES — Sistema centralizado de análisis operativo
// PDF via ventana de impresión | Excel via SheetJS (xlsx)
// ═══════════════════════════════════════════════════════════

const _RPT_EMPRESA = {
  nombre:    'FREIMANAUTOS',
  slogan:    'Simplemente profesional',
  nit:       '800.012.186',
  direccion: 'Calle 98A # 68D – 15',
  telefono:  '320 902 5804',
  email:     'freimanautossa@yahoo.com'
};

// ─── Cargar SheetJS dinámicamente ───────────────────────────
function _cargarSheetJS(cb) {
  if (window.XLSX) { cb(); return; }
  const s = document.createElement('script');
  s.src = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
  s.onload = cb; document.head.appendChild(s);
}

// ExcelJS: permite incrustar imágenes (gráficas) dentro del .xlsx
function _cargarExcelJS(cb) {
  if (window.ExcelJS) { cb(); return; }
  const s = document.createElement('script');
  s.src = 'https://cdnjs.cloudflare.com/ajax/libs/exceljs/4.4.0/exceljs.min.js';
  s.onload = cb;
  s.onerror = () => toast('No se pudo cargar el motor de Excel', 'err');
  document.head.appendChild(s);
}

// ════════════════════════════════════════════════════════════
// GRÁFICAS — dibujadas en canvas → PNG. Se reutilizan en el PDF
// (como <img>) y en el Excel (ExcelJS addImage).
// ════════════════════════════════════════════════════════════
const _CHART_COL = ['#2A5298','#0D7A4E','#92400E','#C0392B','#7C3AED','#0891B2','#D97706','#475569'];
function _fmtCorto(n){ n = n||0; if (n>=1e6) return '$'+(n/1e6).toFixed(n>=1e7?0:1)+'M'; if (n>=1e3) return '$'+Math.round(n/1e3)+'k'; return '$'+Math.round(n); }
function _cap(s){ s = String(s||''); return s.charAt(0).toUpperCase()+s.slice(1); }
function _roundRect(x,X,Y,W,H,r){ r=Math.min(r,W/2,H/2); if(r<0)r=0; x.beginPath(); x.moveTo(X+r,Y); x.arcTo(X+W,Y,X+W,Y+H,r); x.arcTo(X+W,Y+H,X,Y+H,r); x.arcTo(X,Y+H,X,Y,r); x.arcTo(X,Y,X+W,Y,r); x.closePath(); }
function _newCanvas(W,H){ const S=2; const cv=document.createElement('canvas'); cv.width=W*S; cv.height=H*S; const x=cv.getContext('2d'); x.scale(S,S); x.fillStyle='#fff'; x.fillRect(0,0,W,H); return {cv,x}; }
function _chartTitulo(x,t){ x.fillStyle='#1E3A5F'; x.font='bold 16px Arial'; x.textAlign='left'; x.fillText(t,16,26); }

function _chartDonutPNG(titulo, items, opts={}) {
  const W=opts.w||640, H=opts.h||300; const {cv,x}=_newCanvas(W,H); _chartTitulo(x,titulo);
  const total=items.reduce((s,i)=>s+i.value,0)||1;
  const cx=120, cy=165, r=82, ir=48; let a=-Math.PI/2;
  items.forEach(it=>{ const ang=(it.value/total)*Math.PI*2; x.beginPath(); x.moveTo(cx,cy); x.arc(cx,cy,r,a,a+ang); x.closePath(); x.fillStyle=it.color; x.fill(); a+=ang; });
  x.beginPath(); x.arc(cx,cy,ir,0,Math.PI*2); x.fillStyle='#fff'; x.fill();
  x.fillStyle='#1E3A5F'; x.font='bold 20px Arial'; x.textAlign='center'; x.fillText(total, cx, cy+2);
  x.fillStyle='#64748b'; x.font='10px Arial'; x.fillText(opts.centroLbl||'total', cx, cy+17);
  x.textAlign='left'; let ly=72;
  items.forEach(it=>{ const pct=Math.round(it.value/total*100); x.fillStyle=it.color; _roundRect(x,250,ly-10,13,13,3); x.fill(); x.fillStyle='#374151'; x.font='13px Arial'; x.fillText(`${it.label}  ${it.value} (${pct}%)`, 272, ly+1); ly+=26; });
  return cv.toDataURL('image/png');
}

function _chartBarsHPNG(titulo, items, opts={}) {
  const W=opts.w||640, rowH=29, padT=48, padB=14, padL=150, padR=84;
  const H=padT+items.length*rowH+padB; const {cv,x}=_newCanvas(W,H); _chartTitulo(x,titulo);
  const max=Math.max(1,...items.map(i=>i.value)); const barMaxW=W-padL-padR;
  items.forEach((it,i)=>{ const y=padT+i*rowH;
    x.fillStyle='#374151'; x.font='12px Arial'; x.textAlign='right';
    let lbl=it.label||'—'; if(lbl.length>20) lbl=lbl.slice(0,19)+'…'; x.fillText(lbl, padL-8, y+16);
    const bw=Math.max(2,(it.value/max)*barMaxW); x.fillStyle=it.color||'#2A5298'; _roundRect(x,padL,y+3,bw,17,4); x.fill();
    x.fillStyle='#374151'; x.font='bold 11px Arial'; x.textAlign='left'; x.fillText(opts.fmt?opts.fmt(it.value):String(it.value), padL+bw+6, y+16);
  });
  return cv.toDataURL('image/png');
}

function _chartBarsVPNG(titulo, items, opts={}) {
  const W=opts.w||640, H=opts.h||300; const {cv,x}=_newCanvas(W,H); _chartTitulo(x,titulo);
  const padL=24,padR=24,padT=54,padB=48; const plotW=W-padL-padR, plotH=H-padT-padB;
  const max=Math.max(1,...items.map(i=>i.value)); const n=items.length, gap=26, bw=(plotW-gap*(n-1))/n;
  // eje base
  x.strokeStyle='#E5E7EB'; x.beginPath(); x.moveTo(padL,padT+plotH); x.lineTo(W-padR,padT+plotH); x.stroke();
  items.forEach((it,i)=>{ const bh=(it.value/max)*plotH; const bx=padL+i*(bw+gap), by=padT+plotH-bh;
    x.fillStyle=it.color||'#2A5298'; _roundRect(x,bx,by,bw,bh,4); x.fill();
    x.fillStyle='#374151'; x.font='bold 12px Arial'; x.textAlign='center'; x.fillText(opts.fmt?opts.fmt(it.value):String(it.value), bx+bw/2, by-6);
    x.fillStyle='#64748b'; x.font='11px Arial'; let lbl=it.label||''; if(lbl.length>16) lbl=lbl.slice(0,15)+'…'; x.fillText(lbl, bx+bw/2, padT+plotH+18);
  });
  return cv.toDataURL('image/png');
}

// Construye las gráficas del reporte general a partir de las métricas
function _chartsReporte(d) {
  const { resumen={}, tecnicos=[], tiposCliente=[] } = d || {};
  const charts = [];
  try {
    if (tiposCliente.length) {
      const items = tiposCliente.map((t,i)=>({ label:_cap(t.tipo), value:t.ordenes||0, color:_CHART_COL[i%_CHART_COL.length] }));
      if (items.some(i=>i.value>0)) charts.push({ titulo:'Órdenes por tipo de cliente', png:_chartDonutPNG('Órdenes por tipo de cliente', items, {centroLbl:'órdenes'}), w:640, h:300 });
    }
    if (tecnicos.length) {
      const top = [...tecnicos].sort((a,b)=>(b.ingresos||0)-(a.ingresos||0)).slice(0,8).map(t=>({ label:t.tecnico, value:t.ingresos||0, color:'#2A5298' }));
      if (top.some(t=>t.value>0)) charts.push({ titulo:'Ingresos por técnico', png:_chartBarsHPNG('Ingresos por técnico (mano de obra)', top, {fmt:_fmtCorto}), w:640, h:48+top.length*29+14 });
    }
    const fin = [
      { label:'M. obra',    value:resumen.totalIngresos||0,  color:'#2A5298' },
      { label:'Venta rep.', value:resumen.totalVentaRep||0,  color:'#0891B2' },
      { label:'Costo rep.', value:resumen.totalCostoRep||0,  color:'#C0392B' }
    ];
    if (fin.some(f=>f.value>0)) charts.push({ titulo:'Facturación del período', png:_chartBarsVPNG('Facturación del período (COP)', fin, {fmt:_fmtCorto}), w:640, h:300 });
    if ((resumen.ordenesATiempo||0)+(resumen.ordenesTarde||0) > 0) {
      const items=[{label:'A tiempo',value:resumen.ordenesATiempo||0,color:'#0D7A4E'},{label:'Tarde',value:resumen.ordenesTarde||0,color:'#C0392B'}];
      charts.push({ titulo:'Cumplimiento de entregas', png:_chartDonutPNG('Cumplimiento de entregas', items, {centroLbl:'entregas'}), w:640, h:300 });
    }
  } catch(e) { console.warn('[charts] error:', e); }
  return charts;
}

// ─── Montar sección de reportes en el jefe ──────────────────
async function montarReportes() {
  const cont = document.getElementById('reportes-contenido');
  if (!cont) return;
  cont.innerHTML = '<div class="loading-state">Cargando...</div>';

  const ahora     = new Date();
  const hoy       = ahora.toISOString().split('T')[0];
  const lunes     = new Date(ahora);
  lunes.setDate(ahora.getDate() - ((ahora.getDay()+6)%7));
  const lunesStr  = lunes.toISOString().split('T')[0];
  const inicioMes = new Date(ahora.getFullYear(), ahora.getMonth(), 1).toISOString().split('T')[0];

  const [mecanicos, aseguradoras] = await Promise.all([
    api('/mecanicos?activo=eq.true&order=nombre.asc').catch(()=>[]) || [],
    api('/aseguradoras?activo=eq.true&order=nombre.asc').catch(()=>[]) || []
  ]);
  const mecOpts  = mecanicos.map(m =>
    `<option value="${m.id}">${escapeHtml(m.nombre)}</option>`).join('');
  const asegOpts = aseguradoras.map(a =>
    `<option value="${escapeHtml(a.nombre)}">${escapeHtml(a.nombre)}</option>`).join('');

  const SRVS = [
    { val:'latoneria', label:'Latonería' },
    { val:'pintura',   label:'Pintura' },
    { val:'mecanica',  label:'Mecánica' },
    { val:'adicionales', label:'Adicionales' }
  ];
  const srvOpts = SRVS.map(s => `<option value="${s.val}">${s.label}</option>`).join('');

  // ── CSS de tabs (una sola vez) ──────────────────────────────
  if (!document.getElementById('rep-tab-css')) {
    const st = document.createElement('style');
    st.id = 'rep-tab-css';
    st.textContent = `
      .rep-tabs{display:flex;gap:0;border-bottom:2px solid var(--gris-borde);margin-bottom:20px;overflow-x:auto;scrollbar-width:none}
      .rep-tab-btn{padding:9px 18px;font-size:13px;font-weight:600;color:var(--gris-mid);background:none;border:none;border-bottom:3px solid transparent;margin-bottom:-2px;cursor:pointer;white-space:nowrap;display:flex;align-items:center;gap:6px;transition:color .15s,border-color .15s}
      .rep-tab-btn.active{color:var(--azul);border-bottom-color:var(--azul)}
      .rep-tab-btn:hover:not(.active){color:var(--texto)}
      .rep-card{background:white;border:1.5px solid var(--gris-borde);border-radius:12px;padding:18px 20px;margin-bottom:14px;box-shadow:0 1px 4px rgba(0,0,0,.04)}
      .rep-card-title{font-size:13px;font-weight:700;color:var(--texto);margin-bottom:4px;display:flex;align-items:center;gap:8px}
      .rep-card-desc{font-size:12px;color:var(--gris-mid);margin-bottom:14px;line-height:1.5}
      .rep-card-accent{border-left:4px solid var(--azul)}
      .rep-card-green{border-left:4px solid #059669}
      .rep-card-purple{border-left:4px solid #7C3AED}
      .rep-card-orange{border-left:4px solid #D97706}
      .rep-badge{display:inline-flex;align-items:center;gap:4px;padding:3px 8px;border-radius:99px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.4px;background:var(--azul-light);color:var(--azul)}
    `;
    document.head.appendChild(st);
  }

  cont.innerHTML = `
    <!-- CABECERA -->
    <div style="display:flex;align-items:flex-end;justify-content:space-between;margin-bottom:20px;flex-wrap:wrap;gap:8px">
      <div>
        <div style="font-size:20px;font-weight:800;color:var(--texto);letter-spacing:-.3px">Reportes operativos</div>
        <div style="font-size:13px;color:var(--gris-mid);margin-top:2px">Análisis de tiempos, operarios, aseguradoras y servicios</div>
      </div>
      <div id="rep-loading" style="display:none;font-size:12px;color:var(--azul);font-weight:600;align-items:center;gap:6px">
        <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24" style="animation:spin 1s linear infinite"><path d="M21 12a9 9 0 11-6-8.485"/></svg>
        Generando...
      </div>
    </div>

    <!-- ══ TARJETA UNIFICADA ══════════════════════════════════ -->
    <div class="rep-form-card" style="max-width:700px">

      <!-- BLOQUE 1: Período -->
      <div class="rep-bloque">
        <div class="rep-bloque-titulo">
          <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
          Período
        </div>
        <div class="rep-opciones" id="rep-periodo-btns">
          <button class="rep-opcion active" onclick="_repSelPeriodo('mes',this)">Mes actual</button>
          <button class="rep-opcion" onclick="_repSelPeriodo('anio',this)">Año ${ahora.getFullYear()}</button>
          <button class="rep-opcion" onclick="_repSelPeriodo('rango',this)">Rango de fechas</button>
          <button class="rep-opcion" onclick="_repSelPeriodo('dia',this)">Día específico</button>
        </div>
        <!-- Campos condicionales -->
        <div id="rep-campos-rango" style="display:none;margin-top:12px;display:none">
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;max-width:380px">
            <div class="field" style="margin:0"><label style="font-size:11px">Desde</label><input type="date" id="rep-sem-ini" value="${lunesStr}" max="${hoy}"></div>
            <div class="field" style="margin:0"><label style="font-size:11px">Hasta</label><input type="date" id="rep-sem-fin" value="${hoy}" max="${hoy}"></div>
          </div>
        </div>
        <div id="rep-campos-dia" style="display:none;margin-top:12px">
          <div style="max-width:180px">
            <div class="field" style="margin:0"><label style="font-size:11px">Día</label><input type="date" id="rep-dia" value="${hoy}" max="${hoy}"></div>
          </div>
        </div>
      </div>

      <!-- BLOQUE 2: Alcance -->
      <div class="rep-bloque">
        <div class="rep-bloque-titulo">
          <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/></svg>
          Alcance
        </div>
        <div class="rep-opciones" id="rep-alcance-btns">
          <button class="rep-opcion active" onclick="_repSelAlcance('general',this)">General</button>
          <button class="rep-opcion" onclick="_repSelAlcance('operarios',this)">Por operario</button>
          <button class="rep-opcion" onclick="_repSelAlcance('aseguradora',this)">Por aseguradora</button>
          <button class="rep-opcion" onclick="_repSelAlcance('servicio',this)">Por servicio</button>
          <button class="rep-opcion" onclick="_repSelAlcance('pagos',this)">Pagos a técnicos</button>
        </div>
        <!-- Campos condicionales de alcance -->
        <div id="rep-campos-operarios" style="display:none;margin-top:12px">
          <div class="field" style="margin:0;max-width:320px">
            <label style="font-size:11px">Operario <span style="color:var(--gris-mid);font-weight:400">(opcional — vacío = todos)</span></label>
            <select id="rep-mec-sel" style="width:100%">
              <option value="">— Todos los operarios —</option>
              ${mecOpts}
            </select>
          </div>
        </div>
        <div id="rep-campos-aseguradora" style="display:none;margin-top:12px">
          <div class="field" style="margin:0;max-width:320px">
            <label style="font-size:11px">Aseguradora <span style="color:var(--gris-mid);font-weight:400">(opcional — vacío = todas)</span></label>
            <select id="rep-aseg-sel" style="width:100%">
              <option value="">— Todas las aseguradoras —</option>
              ${asegOpts}
            </select>
          </div>
        </div>
        <div id="rep-campos-servicio" style="display:none;margin-top:12px">
          <div class="field" style="margin:0;max-width:280px">
            <label style="font-size:11px">Servicio</label>
            <select id="rep-srv-sel" style="width:100%">
              <option value="">— Selecciona un servicio —</option>
              ${srvOpts}
            </select>
          </div>
        </div>
        <div id="rep-campos-pagos" style="display:none;margin-top:12px">
          <div class="field" style="margin:0;max-width:320px">
            <label style="font-size:11px">Técnico <span style="color:var(--gris-mid);font-weight:400">(opcional — vacío = todos)</span></label>
            <select id="rep-pago-mec-sel" style="width:100%">
              <option value="">— Todos los técnicos —</option>
              ${mecOpts}
            </select>
          </div>
        </div>
      </div>

      <!-- FOOTER: botones de exportación -->
      <div class="rep-bloque" style="border-bottom:none;padding-bottom:0;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px">
        <div id="rep-desc" style="font-size:12px;color:var(--gris-mid);line-height:1.5">
          Reporte general del mes en curso: tiempos, costos y tipo de cliente.
        </div>
        <div style="display:flex;gap:8px;flex-shrink:0">
          <button class="btn btn-outline" onclick="_repGenerar('pdf')" style="font-size:13px;display:flex;align-items:center;gap:6px">
            <svg width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
            PDF
          </button>
          <button class="btn btn-primary" onclick="_repGenerar('excel')" style="font-size:13px;display:flex;align-items:center;gap:6px">
            <svg width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M8 12l4 4 4-4M12 8v8"/></svg>
            Excel
          </button>
        </div>
      </div>

    </div><!-- /rep-form-card -->
  `;
}

// ─── Estado del selector unificado ──────────────────────────
let _repPeriodo = 'mes';
let _repAlcance = 'general';

const _REP_DESC = {
  mes:      'Reporte general del mes en curso: tiempos, costos y tipo de cliente.',
  anio:     'Consolidado anual: evolución mensual, costos acumulados y comparativos.',
  rango:    'Reporte del período seleccionado: análisis completo.',
  dia:      'Snapshot de un día: órdenes ingresadas y etapas completadas.',
};

function _repSelPeriodo(p, btn) {
  _repPeriodo = p;
  document.querySelectorAll('#rep-periodo-btns .rep-opcion').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  document.getElementById('rep-campos-rango').style.display = (p === 'rango') ? 'block' : 'none';
  document.getElementById('rep-campos-dia').style.display   = (p === 'dia')   ? 'block' : 'none';
  const desc = document.getElementById('rep-desc');
  if (desc) desc.textContent = _REP_DESC[p] || '';
}

function _repSelAlcance(a, btn) {
  _repAlcance = a;
  document.querySelectorAll('#rep-alcance-btns .rep-opcion').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  ['operarios','aseguradora','servicio','pagos'].forEach(k => {
    const el = document.getElementById('rep-campos-' + k);
    if (el) el.style.display = (k === a) ? 'block' : 'none';
  });
}

function _repGenerar(formato) {
  const p = _repPeriodo;
  const a = _repAlcance;

  // Resolver fechas
  const ahora = new Date();
  let ini = null, fin = null;
  if (p === 'rango') {
    ini = document.getElementById('rep-sem-ini')?.value;
    fin = document.getElementById('rep-sem-fin')?.value;
    if (!ini || !fin) { toast('Define el rango de fechas', 'err'); return; }
  } else if (p === 'dia') {
    ini = document.getElementById('rep-dia')?.value;
    if (!ini) { toast('Selecciona el día', 'err'); return; }
    fin = null;
  }

  // Despachar según alcance
  if (a === 'general') {
    generarReporte(p, ini, fin, formato);
  } else if (a === 'operarios') {
    const mecId = document.getElementById('rep-mec-sel')?.value;
    if (mecId) {
      generarReporteMecanico(mecId, ini || new Date(ahora.getFullYear(), ahora.getMonth(), 1).toISOString().split('T')[0],
        fin || ahora.toISOString().split('T')[0], formato);
    } else {
      // Todos los operarios = reporte general con foco en operarios
      generarReporte(p, ini, fin, formato);
    }
  } else if (a === 'aseguradora') {
    const aseg = document.getElementById('rep-aseg-sel')?.value || null;
    const iniA = ini || new Date(ahora.getFullYear(), ahora.getMonth(), 1).toISOString().split('T')[0];
    const finA = fin || ahora.toISOString().split('T')[0];
    generarReporteAseguradoras(aseg, iniA, finA, formato);
  } else if (a === 'servicio') {
    const srv = document.getElementById('rep-srv-sel')?.value;
    if (!srv) { toast('Selecciona un servicio', 'err'); return; }
    const iniS = ini || new Date(ahora.getFullYear(), ahora.getMonth(), 1).toISOString().split('T')[0];
    const finS = fin || ahora.toISOString().split('T')[0];
    generarReporteServicio(srv, iniS, finS, formato);
  } else if (a === 'pagos') {
    const mecId = document.getElementById('rep-pago-mec-sel')?.value || null;
    const iniP = ini || new Date(ahora.getFullYear(), ahora.getMonth(), 1).toISOString().split('T')[0];
    const finP = fin || ini || ahora.toISOString().split('T')[0];
    generarReportePagosTecnicos(mecId, iniP, finP, formato);
  }
}

// ─── Launchers legacy (compatibilidad con código existente) ──
function _lanzarReporteTecnicos(formato) {
  const ahora = new Date();
  const ini = new Date(ahora.getFullYear(), ahora.getMonth(), 1).toISOString().split('T')[0];
  const fin = ahora.toISOString().split('T')[0];
  generarReporte('rango', ini, fin, formato);
}

function _lanzarReporteOp(formato) {
  const mecId = document.getElementById('rep-mec-sel')?.value;
  const ahora = new Date();
  const ini   = new Date(ahora.getFullYear(), ahora.getMonth(), 1).toISOString().split('T')[0];
  const fin   = ahora.toISOString().split('T')[0];
  if (!mecId) { toast('Selecciona un operario', 'err'); return; }
  generarReporteMecanico(mecId, ini, fin, formato);
}

function _lanzarReporteAsegGen(formato) {
  const ahora = new Date();
  const ini = new Date(ahora.getFullYear(), ahora.getMonth(), 1).toISOString().split('T')[0];
  const fin = ahora.toISOString().split('T')[0];
  generarReporteAseguradoras(null, ini, fin, formato);
}

function _lanzarReporteAseg(formato) {
  const aseg = document.getElementById('rep-aseg-sel')?.value;
  const ahora = new Date();
  const ini  = new Date(ahora.getFullYear(), ahora.getMonth(), 1).toISOString().split('T')[0];
  const fin  = ahora.toISOString().split('T')[0];
  if (!aseg) { toast('Selecciona una aseguradora', 'err'); return; }
  generarReporteAseguradoras(aseg, ini, fin, formato);
}

function _lanzarReporteSrv(formato) {
  const srv = document.getElementById('rep-srv-sel')?.value;
  const ahora = new Date();
  const ini = new Date(ahora.getFullYear(), ahora.getMonth(), 1).toISOString().split('T')[0];
  const fin = ahora.toISOString().split('T')[0];
  if (!srv) { toast('Selecciona un servicio', 'err'); return; }
  generarReporteServicio(srv, ini, fin, formato);
}

// ─── Reporte INTEGRAL de aseguradoras ────────────────────────
// Incluye TODOS los cálculos del módulo: autorizado, por cobrar, cartera
// vencida, pendiente por autorizar, rentabilidad (valor de plaza), tiempo
// de autorización, estado de pago, ciclo, pulmón y estadía.
async function generarReporteAseguradoras(asegFiltro, fechaIni, fechaFin, formato) {
  toast('Generando reporte de aseguradoras...');
  try {
    const desde = new Date(fechaIni + 'T00:00:00');
    const hasta = new Date(fechaFin  + 'T23:59:59');
    const desdeISO = desde.toISOString();
    const hastaISO = hasta.toISOString();
    const today = new Date();
    const DIAS_VENCE = 30;
    const fd  = d => d.toLocaleDateString('es-CO',{day:'2-digit',month:'short',year:'numeric'});
    const fmt = n => n != null ? new Intl.NumberFormat('es-CO',{style:'currency',currency:'COP',minimumFractionDigits:0}).format(Math.round(n)) : '$0';
    const fmtF = iso => iso ? new Date(iso).toLocaleDateString('es-CO',{day:'2-digit',month:'short',year:'numeric'}) : '—';

    let query = `/ordenes?aseguradora=not.is.null&or=(creado_en.gte.${desdeISO},entregada_en.gte.${desdeISO})&creado_en=lte.${hastaISO}&select=*&order=creado_en.desc`;
    if (asegFiltro) query += `&aseguradora=eq.${encodeURIComponent(asegFiltro)}`;

    // Excluir flotillas y empresas: guardan su nombre en "aseguradora" pero NO son aseguradoras
    const ordenes = (await api(query).catch(()=>[]) || []).filter(o => o.tipo_cliente !== 'flotilla' && o.tipo_cliente !== 'empresa');
    const titulo  = asegFiltro ? `Reporte Aseguradora — ${asegFiltro}` : 'Reporte Integral — Aseguradoras';
    const subtitulo = `Período: ${fd(desde)} al ${fd(hasta)}`;
    if (!ordenes.length) { toast('Sin órdenes en el período seleccionado', 'warn'); return; }

    // Rentabilidad (valor de plaza vs tiempo en taller) — reutiliza el cálculo del módulo
    if (typeof _calcularRentabilidadAseg === 'function') { try { await _calcularRentabilidadAseg(ordenes); } catch(e){} }
    const rentMap = (typeof _asegRentabilidad !== 'undefined' && _asegRentabilidad.porOrden) || {};
    const vpd     = (typeof _asegRentabilidad !== 'undefined' && _asegRentabilidad.valorPlazaDia) || 0;
    const rentOn  = (typeof _asegRentabilidad !== 'undefined' && !!_asegRentabilidad.activo) || vpd > 0;
    const rOk     = r => !!(r && r.vpd > 0);   // la orden tiene valor de plaza (propio o global)
    const leer    = (typeof _leerDatosAseg === 'function') ? _leerDatosAseg : (() => ({}));
    const EST     = (typeof ESTADOS_ASEG !== 'undefined') ? ESTADOS_ASEG : {};
    const estLabel = k => (EST[k] && EST[k].label) || k || '—';
    const estColor = k => (EST[k] && EST[k].color) || '#6B7280';

    const nuevoAcc = () => ({ total:0,entregadas:0,autorizado:0,porCobrar:0,vencida:0,vencidaCount:0,sinAutorizar:0,estimado:0,neta:0,enPerdida:0,estadia:0,aprobDias:[],enPulmon:0,cicloHrs:[] });
    const glob = nuevoAcc();
    const porAseg = {};
    const detalle = [];

    ordenes.forEach(o => {
      const d = leer(o);
      const va = parseFloat(d.valor_autorizado) || 0;
      const pago = d.estado_pago || 'pendiente';
      const pagado = pago === 'pagado';
      const r = rentMap[o.id] || null;
      const k = o.aseguradora || 'Sin aseguradora';
      if (!porAseg[k]) porAseg[k] = nuevoAcc();
      [glob, porAseg[k]].forEach(A => {
        A.total++;
        if (o.entregada_en) { A.entregadas++; if (o.creado_en) A.cicloHrs.push((new Date(o.entregada_en) - new Date(o.creado_en)) / 3600000); }
        if (o.pulmon) A.enPulmon++;
        if (va > 0) {
          A.autorizado += va;
          if (!pagado) { A.porCobrar += va; if (o.entregada_en && (today - new Date(o.entregada_en)) / 86400000 > DIAS_VENCE) { A.vencida += va; A.vencidaCount++; } }
        } else if (!o.entregada_en) { A.sinAutorizar++; A.estimado += (r ? r.ingreso : 0); }
        if (d.fecha_peritaje && d.fecha_autorizacion) { const dd = (new Date(d.fecha_autorizacion) - new Date(d.fecha_peritaje)) / 86400000; if (dd >= 0 && dd < 365) A.aprobDias.push(dd); }
        if (rOk(r)) { A.neta += r.rent; if (r.rent < 0) A.enPerdida++; }
        if (o.pulmon_desde) { const diasP = Math.floor((today - new Date(o.pulmon_desde)) / 86400000); const gracia = o.dias_gracia_estadia ?? 3; const tarifa = o.valor_estadia_dia ?? 0; A.estadia += Math.max(0, diasP - gracia) * tarifa; }
      });
      detalle.push({ o, va, pago, r, diasSist: o.creado_en ? Math.floor((today - new Date(o.creado_en)) / 86400000) : null, est: o.estado_aseguradora || 'peritaje_pendiente' });
    });

    const prom = arr => arr.length ? Math.round(arr.reduce((a,b)=>a+b,0)/arr.length) : 0;
    const resumenAseg = Object.entries(porAseg).map(([nombre,A]) => ({ nombre, ...A, promAprob: prom(A.aprobDias), cicloProm: A.cicloHrs.length ? prom(A.cicloHrs) : null })).sort((a,b)=>b.total-a.total);
    const G = { ...glob, promAprob: prom(glob.aprobDias), cicloProm: glob.cicloHrs.length ? prom(glob.cicloHrs) : null, activos: ordenes.filter(o=>o.estado==='Activa').length };
    const pagoLabel = (va,pago) => va > 0 ? (pago==='pagado'?'Pagado':pago==='parcial'?'Parcial':'Por cobrar') : 'Sin autorizar';

    if (formato === 'excel') {
      _cargarSheetJS(() => {
        const wb = XLSX.utils.book_new();
        const ws1 = XLSX.utils.aoa_to_sheet([
          [titulo],[subtitulo],
          ['Valor de plaza/día (base rentabilidad):', rentOn ? fmt(vpd) : 'no definido'],
          ['Generado:', new Date().toLocaleString('es-CO')],[],
          ['INDICADOR','VALOR'],
          ['Órdenes en el período', G.total],
          ['Activas', G.activos],
          ['Entregadas', G.entregadas],
          ['Autorizado (facturado)', G.autorizado],
          ['Por cobrar (cartera)', G.porCobrar],
          [`Cartera vencida (+${DIAS_VENCE}d sin pago)`, G.vencida],
          ['Pendiente por autorizar (N°)', G.sinAutorizar],
          ['Estimado en riesgo (sin autorizar)', G.estimado],
          ['Rentabilidad neta', rentOn ? Math.round(G.neta) : 'definir valor de plaza'],
          ['Órdenes en pérdida (N°)', rentOn ? G.enPerdida : '—'],
          ['Tiempo prom. de autorización (días)', G.promAprob],
          ['Ciclo promedio (horas)', G.cicloProm ?? '—'],
          ['En pulmón (N°)', G.enPulmon],
          ['Estadía acumulada (COP)', G.estadia],
        ]);
        ws1['!cols'] = [{wch:40},{wch:22}];
        XLSX.utils.book_append_sheet(wb, ws1, 'Resumen');

        const ws2 = XLSX.utils.aoa_to_sheet([
          ['Aseguradora','Órdenes','Entregadas','Autorizado','Por cobrar','Vencida','Sin autorizar','Estimado riesgo','Rent. neta','En pérdida','T.aprob (d)','Ciclo (h)','En pulmón','Estadía'],
          ...resumenAseg.map(a => [a.nombre,a.total,a.entregadas,a.autorizado,a.porCobrar,a.vencida,a.sinAutorizar,a.estimado, rentOn?Math.round(a.neta):'', rentOn?a.enPerdida:'', a.promAprob, a.cicloProm??'', a.enPulmon, a.estadia])
        ]);
        ws2['!cols'] = [{wch:22},{wch:9},{wch:11},{wch:14},{wch:13},{wch:12},{wch:13},{wch:15},{wch:13},{wch:11},{wch:11},{wch:10},{wch:11},{wch:14}];
        XLSX.utils.book_append_sheet(wb, ws2, 'Por aseguradora');

        const dHdr = ['Placa','Propietario','Aseguradora','Estado proceso','Ingreso','Entrega','Días sist.','Autorizado','Estado pago','Renta/Pérdida','Días pulmón'];
        const dRows = detalle.map(({o,va,pago,r,diasSist,est}) => [
          o.placa||'—', o.propietario||'—', o.aseguradora||'—', estLabel(est),
          fmtF(o.creado_en), fmtF(o.entregada_en), diasSist ?? '—',
          va || '', pagoLabel(va,pago), rOk(r) ? Math.round(r.rent) : '',
          o.pulmon && o.pulmon_desde ? Math.floor((today - new Date(o.pulmon_desde)) / 86400000) : ''
        ]);
        const ws3 = XLSX.utils.aoa_to_sheet([dHdr,...dRows]);
        ws3['!cols'] = [{wch:10},{wch:20},{wch:18},{wch:18},{wch:12},{wch:12},{wch:10},{wch:14},{wch:12},{wch:14},{wch:11}];
        XLSX.utils.book_append_sheet(wb, ws3, 'Detalle órdenes');

        XLSX.writeFile(wb, (asegFiltro||'Aseguradoras').replace(/\s+/g,'_') + `_${fechaIni}_${fechaFin}.xlsx`);
        toast('Excel generado ✓');
      });
      return;
    }

    // ── PDF ──
    const kpi = (val,lbl,col) => `<div class="kpi" style="border-top-color:${col}"><div class="kpi-val" style="color:${col}">${val}</div><div class="kpi-lbl">${lbl}</div></div>`;
    const kpisHtml = [
      kpi(G.total, 'Órdenes período', '#1E3A5F'),
      kpi(G.activos, 'Activas', '#2563EB'),
      kpi(fmt(G.autorizado), 'Autorizado', '#0891B2'),
      kpi(fmt(G.porCobrar), 'Por cobrar', G.porCobrar>0?'#DC2626':'#059669'),
      kpi(fmt(G.vencida), `Cartera vencida (+${DIAS_VENCE}d)`, G.vencidaCount?'#DC2626':'#059669'),
      kpi(G.sinAutorizar, 'Pend. por autorizar', '#D97706'),
      kpi(rentOn ? fmt(G.neta) : 'n/d', 'Rentabilidad neta', !rentOn?'#6B7280':(G.neta>=0?'#059669':'#DC2626')),
      kpi(rentOn ? G.enPerdida : 'n/d', 'En pérdida', '#DC2626'),
      kpi(G.promAprob+'d', 'T. autorización', '#7C3AED'),
      kpi(G.cicloProm!=null ? G.cicloProm+'h' : '—', 'Ciclo prom.', '#0EA5E9'),
      kpi(G.enPulmon, 'En pulmón', '#D97706'),
      kpi(G.estadia>0 ? fmt(G.estadia) : '—', 'Estadía acum.', '#5B21B6'),
    ].join('');

    const resumenHtml = resumenAseg.map((a,i) => `<tr>
      <td><strong style="color:#7C3AED">${i+1}. ${escapeHtml(a.nombre)}</strong></td>
      <td><strong>${a.total}</strong></td>
      <td style="font-family:monospace">${fmt(a.autorizado)}</td>
      <td style="font-family:monospace;color:${a.porCobrar>0?'#DC2626':'#374151'}">${a.porCobrar>0?fmt(a.porCobrar):'—'}</td>
      <td style="font-family:monospace;color:${a.vencida>0?'#DC2626':'#374151'}">${a.vencida>0?fmt(a.vencida):'—'}</td>
      <td>${a.sinAutorizar>0?`<span style="color:#D97706;font-weight:700">${a.sinAutorizar}</span>`:'—'}</td>
      <td style="font-family:monospace;font-weight:700;color:${!rentOn?'#9CA3AF':(a.neta>=0?'#059669':'#DC2626')}">${rentOn?fmt(a.neta):'n/d'}</td>
      <td>${a.promAprob?a.promAprob+'d':'—'}</td>
      <td>${a.cicloProm!=null?a.cicloProm+'h':'—'}</td>
      <td style="font-family:monospace">${a.estadia>0?fmt(a.estadia):'—'}</td>
    </tr>`).join('');

    const tablaOrdenes = detalle.slice(0,45).map(({o,va,pago,r,diasSist,est}) => {
      const pagoCol = va<=0 ? '#6B7280' : (pago==='pagado'?'#059669':pago==='parcial'?'#B45309':'#DC2626');
      return `<tr>
        <td><strong style="font-family:monospace">${o.placa||'—'}</strong></td>
        <td>${(o.propietario||'—').slice(0,16)}</td>
        <td>${(o.aseguradora||'—').slice(0,14)}</td>
        <td><span style="color:${estColor(est)};font-weight:700;font-size:9px">${estLabel(est)}</span></td>
        <td style="font-weight:700;color:${diasSist>30?'#DC2626':diasSist>15?'#D97706':'#374151'}">${diasSist??'—'}d</td>
        <td style="font-family:monospace">${va>0?fmt(va):'—'}</td>
        <td><span style="color:${pagoCol};font-weight:700;font-size:9px">${pagoLabel(va,pago)}</span></td>
        <td style="font-family:monospace;font-weight:700;color:${!rOk(r)?'#9CA3AF':(r.rent>=0?'#059669':'#DC2626')}">${rOk(r)?fmt(r.rent):'—'}</td>
      </tr>`;
    }).join('');

    const html = `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><title>${titulo}</title>
    <style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:'Segoe UI',Arial,sans-serif;color:#1a1a2e;font-size:12px;line-height:1.5}
    .page{max-width:980px;margin:0 auto;padding:32px 36px}
    .rpt-header{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid #5B21B6;padding-bottom:16px;margin-bottom:22px}
    .rpt-brand{font-size:22px;font-weight:800;color:#5B21B6;letter-spacing:1px}
    .kpi-row{display:grid;grid-template-columns:repeat(4,1fr);gap:9px;margin-bottom:22px}
    .kpi{border:1px solid #e5e7eb;border-radius:8px;padding:10px 12px;border-top:3px solid}
    .kpi-val{font-size:15px;font-weight:800;margin-bottom:2px;line-height:1.1}.kpi-lbl{font-size:9px;color:#888;text-transform:uppercase;letter-spacing:.4px}
    .nota{font-size:10px;color:#888;margin:0 0 18px;font-style:italic}
    .section{margin-bottom:24px;page-break-inside:avoid}
    .section-title{font-size:11px;font-weight:800;color:#5B21B6;text-transform:uppercase;letter-spacing:1px;border-bottom:1px solid #e5e7eb;padding-bottom:7px;margin-bottom:12px}
    table{width:100%;border-collapse:collapse;font-size:10.5px}
    th{background:#f5f3ff;padding:7px 9px;text-align:left;font-size:9px;text-transform:uppercase;letter-spacing:.3px;color:#5B21B6;font-weight:700;border-bottom:1px solid #e2e8f0}
    td{padding:6px 9px;border-bottom:1px solid #f1f5f0;color:#374151}
    .footer{margin-top:30px;border-top:1px solid #e2e8f0;padding-top:10px;font-size:9px;color:#aaa;text-align:center}
    @media print{.page{padding:18px 22px}.section{page-break-inside:avoid}}</style></head><body><div class="page">
    <div class="rpt-header">
      <div><div class="rpt-brand">${_RPT_EMPRESA.nombre}</div>
        <div style="font-size:10px;color:#888;margin-top:3px">${_RPT_EMPRESA.slogan} · NIT ${_RPT_EMPRESA.nit}</div>
        <div style="font-size:10px;color:#aaa">${_RPT_EMPRESA.direccion} · Tel: ${_RPT_EMPRESA.telefono}</div></div>
      <div style="text-align:right">
        <div style="font-size:15px;font-weight:800;color:#5B21B6">${titulo}</div>
        <div style="font-size:11px;color:#555;margin-top:3px">${subtitulo}</div>
        <div style="font-size:10px;color:#999;margin-top:3px">Generado: ${new Date().toLocaleString('es-CO',{day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'})}</div>
      </div>
    </div>
    <div class="kpi-row">${kpisHtml}</div>
    <div class="nota">Rentabilidad = ingreso de la orden − (valor de plaza/día × días en taller). El valor de plaza se toma de cada aseguradora (configurable en su ficha); si no tiene, usa el global${rentOn?'':' (aún no definido — defínelo en el módulo Aseguradoras)'}.</div>
    <div class="section"><div class="section-title">Resumen por aseguradora</div>
    <table><thead><tr><th>Aseguradora</th><th>Órdenes</th><th>Autorizado</th><th>Por cobrar</th><th>Vencida</th><th>Sin aut.</th><th>Rent. neta</th><th>T.aprob</th><th>Ciclo</th><th>Estadía</th></tr></thead>
    <tbody>${resumenHtml}</tbody></table></div>
    <div class="section"><div class="section-title">Detalle de órdenes${detalle.length>45?' (primeras 45 de '+detalle.length+')':''}</div>
    <table><thead><tr><th>Placa</th><th>Propietario</th><th>Aseguradora</th><th>Estado proceso</th><th>Días</th><th>Autorizado</th><th>Pago</th><th>Renta/Pérdida</th></tr></thead>
    <tbody>${tablaOrdenes}</tbody></table></div>
    <div class="footer">${_RPT_EMPRESA.nombre} · NIT ${_RPT_EMPRESA.nit} · Reporte integral de aseguradoras · ${new Date().toLocaleString('es-CO')}</div>
    </div></body></html>`;

    const win = window.open('', '_blank');
    if (win) { win.document.write(html); win.document.close(); setTimeout(() => win.print(), 800); }
    toast('PDF generado ✓');
  } catch(e) { toast('Error: ' + e.message, 'err'); console.error(e); }
}

// ─── Reporte por tipo de servicio ────────────────────────────
async function generarReporteServicio(servicio, fechaIni, fechaFin, formato) {
  toast('Generando reporte de servicio...');
  try {
    const desde    = new Date(fechaIni + 'T00:00:00');
    const hasta    = new Date(fechaFin  + 'T23:59:59');
    const desdeISO = desde.toISOString();
    const hastaISO = hasta.toISOString();
    const fd  = d => d.toLocaleDateString('es-CO',{day:'2-digit',month:'short',year:'numeric'});
    const fmt = n => n != null ? new Intl.NumberFormat('es-CO',{style:'currency',currency:'COP',minimumFractionDigits:0}).format(n) : '$0';
    const fmtF = iso => iso ? new Date(iso).toLocaleDateString('es-CO',{day:'2-digit',month:'short',year:'numeric'}) : '—';
    const hrStr = m => { const h=Math.floor(m/60); return h>0?`${h}h ${m%60}m`:`${m%60}m`; };

    const SRVS_LABEL = {latoneria:'Latonería',pintura:'Pintura',mecanica:'Mecánica',adicionales:'Adicionales'};
    const srvLabel  = SRVS_LABEL[servicio] || servicio;
    const titulo    = `Reporte de ${srvLabel}`;
    const subtitulo = `Período: ${fd(desde)} al ${fd(hasta)}`;

    const etapas = await api(
      `/etapas?servicio=eq.${servicio}&fin=gte.${desdeISO}&fin=lte.${hastaISO}&select=id,orden_id,etapa,tecnico,mecanico_id,inicio,fin,valor,horas_facturadas,tiempo_pausado_min&order=fin.asc`
    ).catch(()=>[]) || [];

    if (!etapas.length) { toast('Sin etapas en el período seleccionado', 'warn'); return; }

    // Métricas por operario
    const opMap = {};
    let totalMin = 0, totalVal = 0, totalPausado = 0;
    etapas.forEach(e => {
      if (!e.inicio || !e.fin) return;
      const bruto = Math.round((new Date(e.fin) - new Date(e.inicio)) / 60000);
      const neto  = Math.max(0, bruto - (e.tiempo_pausado_min||0));
      totalMin    += neto;
      totalVal    += (e.valor||0);
      totalPausado+= (e.tiempo_pausado_min||0);
      const op = e.tecnico || `Operario #${e.mecanico_id||'?'}`;
      if (!opMap[op]) opMap[op] = { etapas:0, neto:0, valor:0, pausado:0 };
      opMap[op].etapas++;
      opMap[op].neto  += neto;
      opMap[op].valor += (e.valor||0);
      opMap[op].pausado += (e.tiempo_pausado_min||0);
    });
    const operarios = Object.entries(opMap)
      .map(([nombre, d]) => ({ nombre, ...d, promNeto: d.etapas ? Math.round(d.neto/d.etapas) : 0 }))
      .sort((a,b) => b.etapas - a.etapas);

    // Cuellos de botella
    const etapaMap = {};
    etapas.forEach(e => {
      if (!e.inicio||!e.fin) return;
      const k = e.etapa||'Sin nombre';
      const neto = Math.max(0, Math.round((new Date(e.fin)-new Date(e.inicio))/60000) - (e.tiempo_pausado_min||0));
      if (!etapaMap[k]) etapaMap[k] = { count:0, total:0 };
      etapaMap[k].count++;
      etapaMap[k].total += neto;
    });
    const cuellos = Object.entries(etapaMap)
      .map(([etapa, d]) => ({ etapa, count:d.count, prom:Math.round(d.total/d.count) }))
      .sort((a,b) => b.prom - a.prom).slice(0,8);

    if (formato === 'excel') {
      _cargarSheetJS(() => {
        const wb = XLSX.utils.book_new();
        const ws1 = XLSX.utils.aoa_to_sheet([
          [titulo],[subtitulo],['Generado:',new Date().toLocaleString('es-CO')],[],
          ['Etapas completadas', etapas.length],
          ['Tiempo neto total', hrStr(totalMin)],
          ['Tiempo pausado (repuestos)', hrStr(totalPausado)],
          ['Ingresos generados (COP)', totalVal],
        ]);
        ws1['!cols'] = [{wch:32},{wch:20}];
        XLSX.utils.book_append_sheet(wb, ws1, 'Resumen');

        const ws2 = XLSX.utils.aoa_to_sheet([
          ['Operario','Etapas','Tiempo neto total (min)','Prom/etapa (min)','Pausado (min)','Ingresos (COP)'],
          ...operarios.map(o => [o.nombre,o.etapas,o.neto,o.promNeto,o.pausado,o.valor])
        ]);
        ws2['!cols'] = [{wch:22},{wch:10},{wch:22},{wch:18},{wch:14},{wch:18}];
        XLSX.utils.book_append_sheet(wb, ws2, 'Por Operario');

        const ws3 = XLSX.utils.aoa_to_sheet([
          ['Etapa','Veces ejecutada','Tiempo promedio (min)'],
          ...cuellos.map(c => [c.etapa,c.count,c.prom])
        ]);
        ws3['!cols'] = [{wch:28},{wch:16},{wch:20}];
        XLSX.utils.book_append_sheet(wb, ws3, 'Cuellos de Botella');

        const hdr = ['Etapa','Operario','Inicio','Fin','T. neto (min)','Pausado (min)','Valor (COP)'];
        const ws4 = XLSX.utils.aoa_to_sheet([hdr,...etapas.map(e => {
          const bruto = (e.inicio&&e.fin) ? Math.round((new Date(e.fin)-new Date(e.inicio))/60000) : 0;
          return [e.etapa||'—',e.tecnico||'—',fmtF(e.inicio),fmtF(e.fin),Math.max(0,bruto-(e.tiempo_pausado_min||0)),e.tiempo_pausado_min||0,e.valor||0];
        })]);
        ws4['!cols'] = [{wch:24},{wch:20},{wch:14},{wch:14},{wch:14},{wch:14},{wch:16}];
        XLSX.utils.book_append_sheet(wb, ws4, 'Detalle etapas');

        XLSX.writeFile(wb, `${srvLabel}_${fechaIni}_${fechaFin}.xlsx`);
        toast('Excel generado ✓');
      });
      return;
    }

    // PDF
    const colSrv = {latoneria:'#DC2626',pintura:'#D97706',mecanica:'#2563EB',adicionales:'#059669'}[servicio]||'#1E3A5F';
    const opHtml = operarios.map(o => `<tr>
      <td><strong>${escapeHtml(o.nombre)}</strong></td>
      <td>${o.etapas}</td>
      <td style="color:#2563EB;font-weight:700">${hrStr(o.neto)}</td>
      <td>${hrStr(o.promNeto)}</td>
      <td>${o.pausado > 0 ? `<span style="background:#FEF3C7;color:#92400E;padding:1px 6px;border-radius:3px;font-size:10px">⏸ ${hrStr(o.pausado)}</span>` : '—'}</td>
      <td style="font-family:monospace">${fmt(o.valor)}</td>
    </tr>`).join('');

    const cuelloHtml = cuellos.map((c,i) => {
      const maxProm = cuellos[0].prom||1;
      const pct = Math.round(c.prom/maxProm*100);
      return `<div style="display:flex;align-items:center;gap:10px;margin-bottom:7px">
        <span style="width:140px;font-size:11px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${c.etapa}</span>
        <div style="flex:1;background:#f1f5f9;border-radius:4px;height:8px;overflow:hidden">
          <div style="width:${pct}%;height:100%;background:${i===0?colSrv:'#94A3B8'};border-radius:4px"></div>
        </div>
        <span style="font-size:11px;font-weight:700;width:50px;text-align:right">${hrStr(c.prom)}</span>
      </div>`;
    }).join('');

    const html = `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><title>${titulo}</title>
    <style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:'Segoe UI',Arial,sans-serif;color:#1a1a2e;font-size:12px;line-height:1.5}
    .page{max-width:960px;margin:0 auto;padding:32px 36px}
    .rpt-header{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid ${colSrv};padding-bottom:16px;margin-bottom:24px}
    .kpi-row{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:24px}
    .kpi{border:1px solid #e5e7eb;border-radius:8px;padding:12px 14px;border-top:3px solid}
    .kpi-val{font-size:20px;font-weight:800;margin-bottom:3px}.kpi-lbl{font-size:10px;color:#888;text-transform:uppercase;letter-spacing:.5px}
    .section{margin-bottom:26px;page-break-inside:avoid}
    .section-title{font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:1px;border-bottom:1px solid #e5e7eb;padding-bottom:7px;margin-bottom:12px;color:${colSrv}}
    table{width:100%;border-collapse:collapse;font-size:11px}
    th{padding:7px 10px;text-align:left;font-size:9px;text-transform:uppercase;letter-spacing:.4px;color:#64748b;font-weight:700;border-bottom:1px solid #e2e8f0;background:#f8fafc}
    td{padding:6px 10px;border-bottom:1px solid #f1f5f0}
    .footer{margin-top:30px;border-top:1px solid #e2e8f0;padding-top:10px;font-size:9px;color:#aaa;text-align:center}
    @media print{.page{padding:18px 22px}}</style></head><body><div class="page">
    <div class="rpt-header">
      <div><div style="font-size:22px;font-weight:800;color:${colSrv};letter-spacing:1px">${_RPT_EMPRESA.nombre}</div>
        <div style="font-size:10px;color:#888;margin-top:3px">${_RPT_EMPRESA.slogan} · NIT ${_RPT_EMPRESA.nit}</div></div>
      <div style="text-align:right">
        <div style="font-size:16px;font-weight:800;color:${colSrv}">${titulo}</div>
        <div style="font-size:11px;color:#555;margin-top:3px">${subtitulo}</div>
        <div style="font-size:10px;color:#999;margin-top:3px">Generado: ${new Date().toLocaleString('es-CO',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'})}</div>
      </div>
    </div>
    <div class="kpi-row">
      <div class="kpi" style="border-top-color:${colSrv}"><div class="kpi-val" style="color:${colSrv}">${etapas.length}</div><div class="kpi-lbl">Etapas completadas</div></div>
      <div class="kpi" style="border-top-color:#2563EB"><div class="kpi-val" style="color:#2563EB">${hrStr(totalMin)}</div><div class="kpi-lbl">Tiempo neto total</div></div>
      <div class="kpi" style="border-top-color:#F59E0B"><div class="kpi-val" style="color:#D97706">${totalPausado>0?hrStr(totalPausado):'—'}</div><div class="kpi-lbl">⏸ Pausado repuestos</div></div>
      <div class="kpi" style="border-top-color:#059669"><div class="kpi-val" style="color:#059669;font-size:15px">${fmt(totalVal)}</div><div class="kpi-lbl">Ingresos generados</div></div>
    </div>
    <div class="section"><div class="section-title">Rendimiento por operario</div>
    <table><thead><tr><th>Operario</th><th>Etapas</th><th>T. Neto total</th><th>Prom/etapa</th><th>Pausado</th><th>Ingresos</th></tr></thead>
    <tbody>${opHtml}</tbody></table></div>
    <div class="section"><div class="section-title">Etapas con mayor duración promedio (cuellos de botella)</div>${cuelloHtml}</div>
    <div class="footer">${_RPT_EMPRESA.nombre} · NIT ${_RPT_EMPRESA.nit} · Reporte generado el ${new Date().toLocaleString('es-CO')}</div>
    </div></body></html>`;

    const win = window.open('', '_blank');
    if (win) { win.document.write(html); win.document.close(); setTimeout(() => win.print(), 800); }
    toast('PDF generado ✓');
  } catch(e) { toast('Error: ' + e.message, 'err'); console.error(e); }
}

// ─── Reporte de PAGOS por técnico ────────────────────────────
// Suma el "precio técnico" (etapas.valor — lo que el jefe le paga al técnico)
// de cada trabajo TERMINADO en el período, con detalle por orden/vehículo para
// que cada técnico compare con su propio registro. NO usa valor_venta.
async function generarReportePagosTecnicos(mecId, fechaIni, fechaFin, formato) {
  toast('Generando reporte de pagos...');
  try {
    const desde    = new Date(fechaIni + 'T00:00:00');
    const hasta    = new Date(fechaFin + 'T23:59:59');
    const desdeISO = desde.toISOString();
    const hastaISO = hasta.toISOString();
    const fd   = d => d.toLocaleDateString('es-CO',{day:'2-digit',month:'short',year:'numeric'});
    const fmt  = n => n != null ? new Intl.NumberFormat('es-CO',{style:'currency',currency:'COP',minimumFractionDigits:0}).format(n) : '$0';
    const fmtF = iso => iso ? new Date(iso).toLocaleDateString('es-CO',{day:'2-digit',month:'short',year:'numeric'}) : '—';
    const ot   = id => (typeof formatOT === 'function') ? formatOT(id) : ('OT-' + id);

    const filtroMec = mecId ? `&mecanico_id=eq.${mecId}` : '';
    const etapas = await api(
      `/etapas?fin=gte.${desdeISO}&fin=lte.${hastaISO}${filtroMec}&select=id,orden_id,etapa,servicio,tecnico,mecanico_id,valor,fin&order=fin.asc`
    ).catch(()=>[]) || [];
    if (!etapas.length) { toast('Sin trabajos terminados en el período', 'warn'); return; }

    // Datos de vehículo/orden
    const ordenIds = [...new Set(etapas.map(e => e.orden_id).filter(Boolean))];
    const ordenes  = ordenIds.length
      ? await api(`/ordenes?id=in.(${ordenIds.join(',')})&select=id,placa,marca,linea,propietario`).catch(()=>[]) || []
      : [];
    const ordMap = {}; ordenes.forEach(o => ordMap[o.id] = o);
    // Nombres de técnicos internos
    const mecs = await api('/mecanicos?select=id,nombre').catch(()=>[]) || [];
    const mecMap = {}; mecs.forEach(m => mecMap[m.id] = m.nombre);

    // Agrupar por técnico (interno por mecanico_id; externo por nombre de texto)
    const tecMap = {};
    etapas.forEach(e => {
      const nombre = (e.mecanico_id && mecMap[e.mecanico_id]) || e.tecnico || `Técnico #${e.mecanico_id||'?'}`;
      const key = e.mecanico_id ? 'm'+e.mecanico_id : 't'+(e.tecnico||'?');
      if (!tecMap[key]) tecMap[key] = { nombre, etapas:[], total:0 };
      tecMap[key].etapas.push(e);
      tecMap[key].total += (e.valor||0);
    });
    const tecnicos    = Object.values(tecMap).sort((a,b) => b.total - a.total);
    const granTotal   = tecnicos.reduce((s,t) => s + t.total, 0);
    const totalEtapas = etapas.length;

    const titulo    = mecId ? `Pago a técnico — ${tecnicos[0]?.nombre || ''}` : 'Pagos a técnicos';
    const subtitulo = `Período: ${fd(desde)} al ${fd(hasta)}`;

    // ── EXCEL ──
    if (formato === 'excel') {
      _cargarSheetJS(() => {
        const wb = XLSX.utils.book_new();
        const ws1 = XLSX.utils.aoa_to_sheet([
          [titulo],[subtitulo],['Generado:', new Date().toLocaleString('es-CO')],[],
          ['Técnico','Trabajos','Total a pagar (COP)'],
          ...tecnicos.map(t => [t.nombre, t.etapas.length, t.total]),
          [],['TOTAL GENERAL', totalEtapas, granTotal]
        ]);
        ws1['!cols'] = [{wch:26},{wch:10},{wch:20}];
        XLSX.utils.book_append_sheet(wb, ws1, 'Resumen pagos');

        const hdr = ['Técnico','Placa','Vehículo','OT','Proceso','Servicio','Fecha','Precio técnico (COP)'];
        const rows = [];
        tecnicos.forEach(t => t.etapas.forEach(e => {
          const o = ordMap[e.orden_id] || {};
          rows.push([t.nombre, o.placa||'—', [o.marca,o.linea].filter(Boolean).join(' ')||'—', ot(e.orden_id), e.etapa||'—', e.servicio||'—', fmtF(e.fin), e.valor||0]);
        }));
        const ws2 = XLSX.utils.aoa_to_sheet([hdr, ...rows]);
        ws2['!cols'] = [{wch:22},{wch:10},{wch:20},{wch:10},{wch:22},{wch:14},{wch:14},{wch:18}];
        XLSX.utils.book_append_sheet(wb, ws2, 'Detalle por trabajo');

        XLSX.writeFile(wb, `Pagos_tecnicos_${fechaIni}_${fechaFin}.xlsx`);
        toast('Excel generado ✓');
      });
      return;
    }

    // ── PDF ──
    const col = '#1E3A5F';
    const resumenHtml = tecnicos.map(t => `<tr>
      <td><strong>${escapeHtml(t.nombre)}</strong></td>
      <td>${t.etapas.length}</td>
      <td style="font-family:monospace;text-align:right;font-weight:700">${fmt(t.total)}</td>
    </tr>`).join('');

    const bloquesTec = tecnicos.map(t => {
      const filas = t.etapas.map(e => {
        const o = ordMap[e.orden_id] || {};
        return `<tr>
          <td style="font-family:monospace;font-weight:700">${escapeHtml(o.placa||'—')}</td>
          <td>${escapeHtml([o.marca,o.linea].filter(Boolean).join(' ')||'—')}</td>
          <td style="font-family:monospace">${ot(e.orden_id)}</td>
          <td>${escapeHtml(e.etapa||'—')}</td>
          <td>${fmtF(e.fin)}</td>
          <td style="font-family:monospace;text-align:right">${fmt(e.valor)}</td>
        </tr>`;
      }).join('');
      return `<div class="section">
        <div class="tec-head"><span>${escapeHtml(t.nombre)}</span><span>${t.etapas.length} trabajos · <strong>${fmt(t.total)}</strong></span></div>
        <table><thead><tr><th>Placa</th><th>Vehículo</th><th>OT</th><th>Proceso</th><th>Fecha</th><th style="text-align:right">Precio técnico</th></tr></thead>
        <tbody>${filas}</tbody>
        <tfoot><tr class="subtotal"><td colspan="5" style="text-align:right">Subtotal ${escapeHtml(t.nombre)}</td><td style="text-align:right;font-family:monospace">${fmt(t.total)}</td></tr></tfoot>
        </table>
      </div>`;
    }).join('');

    const html = `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><title>${titulo}</title>
    <style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:'Segoe UI',Arial,sans-serif;color:#1a1a2e;font-size:12px;line-height:1.5}
    .page{max-width:960px;margin:0 auto;padding:32px 36px}
    .rpt-header{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid ${col};padding-bottom:16px;margin-bottom:24px}
    .kpi-row{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:24px}
    .kpi{border:1px solid #e5e7eb;border-radius:8px;padding:12px 14px;border-top:3px solid}
    .kpi-val{font-size:20px;font-weight:800;margin-bottom:3px}.kpi-lbl{font-size:10px;color:#888;text-transform:uppercase;letter-spacing:.5px}
    .section{margin-bottom:22px;page-break-inside:avoid}
    .section-title{font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:1px;border-bottom:1px solid #e5e7eb;padding-bottom:7px;margin-bottom:12px;color:${col}}
    .tec-head{display:flex;justify-content:space-between;align-items:center;background:${col};color:#fff;padding:8px 12px;border-radius:6px 6px 0 0;font-size:13px;font-weight:700}
    table{width:100%;border-collapse:collapse;font-size:11px}
    th{padding:7px 10px;text-align:left;font-size:9px;text-transform:uppercase;letter-spacing:.4px;color:#64748b;font-weight:700;border-bottom:1px solid #e2e8f0;background:#f8fafc}
    td{padding:6px 10px;border-bottom:1px solid #f1f5f0}
    tfoot .subtotal td{font-weight:800;background:#f8fafc;border-top:2px solid #e2e8f0}
    .footer{margin-top:30px;border-top:1px solid #e2e8f0;padding-top:10px;font-size:9px;color:#aaa;text-align:center}
    @media print{.page{padding:18px 22px}}</style></head><body><div class="page">
    <div class="rpt-header">
      <div><div style="font-size:22px;font-weight:800;color:${col};letter-spacing:1px">${_RPT_EMPRESA.nombre}</div>
        <div style="font-size:10px;color:#888;margin-top:3px">${_RPT_EMPRESA.slogan} · NIT ${_RPT_EMPRESA.nit}</div></div>
      <div style="text-align:right">
        <div style="font-size:16px;font-weight:800;color:${col}">${titulo}</div>
        <div style="font-size:11px;color:#555;margin-top:3px">${subtitulo}</div>
        <div style="font-size:10px;color:#999;margin-top:3px">Generado: ${new Date().toLocaleString('es-CO',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'})}</div>
      </div>
    </div>
    <div class="kpi-row">
      <div class="kpi" style="border-top-color:${col}"><div class="kpi-val" style="color:${col}">${tecnicos.length}</div><div class="kpi-lbl">Técnicos</div></div>
      <div class="kpi" style="border-top-color:#2563EB"><div class="kpi-val" style="color:#2563EB">${totalEtapas}</div><div class="kpi-lbl">Trabajos terminados</div></div>
      <div class="kpi" style="border-top-color:#059669"><div class="kpi-val" style="color:#059669;font-size:16px">${fmt(granTotal)}</div><div class="kpi-lbl">Total a pagar</div></div>
    </div>
    ${tecnicos.length > 1 ? `<div class="section"><div class="section-title">Resumen por técnico</div>
      <table><thead><tr><th>Técnico</th><th>Trabajos</th><th style="text-align:right">Total a pagar</th></tr></thead>
      <tbody>${resumenHtml}</tbody>
      <tfoot><tr class="subtotal"><td style="text-align:right">TOTAL GENERAL</td><td>${totalEtapas}</td><td style="text-align:right;font-family:monospace">${fmt(granTotal)}</td></tr></tfoot>
      </table></div>` : ''}
    <div class="section-title">Detalle por técnico (trazabilidad por vehículo)</div>
    ${bloquesTec}
    <div class="footer">${_RPT_EMPRESA.nombre} · NIT ${_RPT_EMPRESA.nit} · Precio técnico = valor que asigna el Jefe de Taller a cada proceso · ${new Date().toLocaleString('es-CO')}</div>
    </div></body></html>`;

    const win = window.open('', '_blank');
    if (win) { win.document.write(html); win.document.close(); setTimeout(() => win.print(), 800); }
    toast('PDF generado ✓');
  } catch(e) { toast('Error: ' + e.message, 'err'); console.error(e); }
}

// ─── Función principal de generación ────────────────────────
async function generarReporte(tipo, fechaIni, fechaFin, formato) {
  const loading = document.getElementById('rep-loading');
  if (loading) loading.style.display = 'flex';
  try {
    const ahora = new Date();
    let desde, hasta, tituloReporte, subtitulo;
    const meses = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

    if (tipo === 'mes') {
      desde  = new Date(ahora.getFullYear(), ahora.getMonth(), 1);
      hasta  = new Date(ahora.getFullYear(), ahora.getMonth()+1, 0, 23, 59, 59);
      tituloReporte = `Reporte Operativo — ${meses[ahora.getMonth()]} ${ahora.getFullYear()}`;
      subtitulo     = `Período: 1 al ${hasta.getDate()} de ${meses[ahora.getMonth()]} ${ahora.getFullYear()}`;
    } else if (tipo === 'anio') {
      desde  = new Date(ahora.getFullYear(), 0, 1);
      hasta  = new Date(ahora.getFullYear(), 11, 31, 23, 59, 59);
      tituloReporte = `Reporte Anual ${ahora.getFullYear()}`;
      subtitulo     = `Período: 1 Enero — 31 Diciembre ${ahora.getFullYear()}`;
    } else if (tipo === 'dia') {
      desde  = new Date(fechaIni + 'T00:00:00');
      hasta  = new Date(fechaIni + 'T23:59:59');
      tituloReporte = `Reporte Diario — ${desde.toLocaleDateString('es-CO',{weekday:'long',day:'2-digit',month:'long',year:'numeric'})}`;
      subtitulo     = '';
    } else {
      desde  = new Date(fechaIni + 'T00:00:00');
      hasta  = new Date(fechaFin  + 'T23:59:59');
      const fd = d => d.toLocaleDateString('es-CO',{day:'2-digit',month:'short',year:'numeric'});
      tituloReporte = `Reporte Operativo — ${fd(desde)} al ${fd(hasta)}`;
      subtitulo     = '';
    }

    const desdeISO = desde.toISOString();
    const hastaISO = hasta.toISOString();

    const [
      etapas, ordenes, novedades,
      ordenesEntregadas, ordenesIngresadas,
      solicitudesRep, cotizaciones, flotillas, cotsCliente
    ] = await Promise.all([
      api(`/etapas?fin=gte.${desdeISO}&fin=lte.${hastaISO}&select=id,orden_id,etapa,etapa_key,servicio,tecnico,mecanico_id,inicio,fin,valor,horas_facturadas,horas_adicionales,horas_estimadas,tiempo_pausado_min`).catch(()=>[]) || [],
      api(`/ordenes?or=(creado_en.gte.${desdeISO},entregada_en.gte.${desdeISO})&select=id,placa,marca,linea,propietario,aseguradora,tipo_cliente,estado,creado_en,entregada_en,fecha_entrega_1,fecha_entrega_2`).catch(()=>[]) || [],
      api(`/novedades?creado_en=gte.${desdeISO}&creado_en=lte.${hastaISO}&select=id,orden_id,etapa_id,tipo,responsable,motivo,desde,creado_en`).catch(()=>[]) || [],
      api(`/ordenes?estado=eq.Entregada&entregada_en=gte.${desdeISO}&entregada_en=lte.${hastaISO}&select=id,placa,marca,linea,propietario,aseguradora,tipo_cliente,creado_en,entregada_en,fecha_entrega_1,pulmon,pulmon_desde,pulmon_fin,pulmon_tipo`).catch(()=>[]) || [],
      api(`/ordenes?creado_en=gte.${desdeISO}&creado_en=lte.${hastaISO}&select=id,placa,marca,linea,propietario,aseguradora,tipo_cliente,creado_en,estado,pulmon,pulmon_desde,pulmon_fin,pulmon_tipo`).catch(()=>[]) || [],
      api(`/solicitudes_repuesto?creado_en=gte.${desdeISO}&creado_en=lte.${hastaISO}&select=id,orden_id,etapa_id,repuesto,unidades,estado,tiempo_espera_min,creado_en`).catch(()=>[]) || [],
      api(`/cotizaciones_repuesto?select=id,solicitud_id,opcion,precio_costo,precio_venta_jefe,estado_opcion`).catch(()=>[]) || [],
      api(`/flotillas?select=id,nombre&order=nombre.asc`).catch(()=>[]) || [],
      api(`/cotizaciones?created_at=gte.${desdeISO}&created_at=lte.${hastaISO}&select=id,estado,total_general,orden_id,created_at`).catch(()=>[]) || []
    ]);

    const datos = _calcularMetricas(etapas, ordenes, novedades, ordenesEntregadas, ordenesIngresadas, solicitudesRep, cotizaciones, flotillas, desdeISO, hastaISO, cotsCliente);

    if (formato === 'pdf') _generarPDF(datos, tituloReporte, subtitulo);
    else _cargarExcelJS(() => _generarExcel(datos, tituloReporte));

  } catch(e) {
    toast('Error generando reporte: ' + e.message, 'err');
    console.error(e);
  } finally {
    if (loading) loading.style.display = 'none';
  }
}

// ─── Reporte individual por mecánico ────────────────────────
async function generarReporteMecanico(mecId, fechaIni, fechaFin, formato) {
  const loading = document.getElementById('rep-loading');
  if (loading) loading.style.display = 'flex';
  try {
    const desde    = new Date(fechaIni + 'T00:00:00');
    const hasta    = new Date(fechaFin  + 'T23:59:59');
    const desdeISO = desde.toISOString();
    const hastaISO = hasta.toISOString();
    const fd       = d => d.toLocaleDateString('es-CO',{day:'2-digit',month:'short',year:'numeric'});

    // Primero obtener datos del mecánico (necesitamos su nombre para las novedades)
    const mecData = await api(`/mecanicos?id=eq.${mecId}&select=id,nombre,rol`).then(r=>r?.[0]).catch(()=>null);

    // Luego las demás consultas en paralelo
    const [etapas, novedades] = await Promise.all([
      api(`/etapas?mecanico_id=eq.${mecId}&fin=gte.${desdeISO}&fin=lte.${hastaISO}&select=id,orden_id,etapa,servicio,inicio,fin,valor,horas_facturadas,horas_adicionales,tiempo_pausado_min&order=fin.asc`).catch(()=>[]) || [],
      mecData?.nombre
        ? api(`/novedades?responsable=eq.${encodeURIComponent(mecData.nombre)}&creado_en=gte.${desdeISO}&creado_en=lte.${hastaISO}&select=*`).catch(()=>[]) || []
        : Promise.resolve([])
    ]);

    // Obtener etapas del mecánico también por solicitudes usando etapa_id
    const ordenIds = [...new Set(etapas.map(e => e.orden_id))];
    const ordenes = ordenIds.length
      ? await api(`/ordenes?id=in.(${ordenIds.join(',')})&select=id,placa,marca,linea,propietario`).catch(()=>[]) || []
      : [];
    const omOrden = {}; ordenes.forEach(o => { omOrden[o.id] = o; });

    // También solicitudes de repuesto vinculadas a etapas del mecánico
    const etapaIds = etapas.map(e => e.id);
    const solsRep  = etapaIds.length
      ? await api(`/solicitudes_repuesto?etapa_id=in.(${etapaIds.join(',')})&select=id,repuesto,estado,tiempo_espera_min,creado_en`).catch(()=>[]) || []
      : [];

    const nombreMec = mecData?.nombre || `Operario #${mecId}`;
    const titulo    = `Reporte de Operario — ${nombreMec}`;
    const subtitulo = `Período: ${fd(desde)} al ${fd(hasta)}`;

    // Calcular métricas
    const fmt = n => n!=null ? new Intl.NumberFormat('es-CO',{style:'currency',currency:'COP',minimumFractionDigits:0}).format(n) : '$0';
    const fmtHora = iso => iso ? new Date(iso).toLocaleString('es-CO',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit',hour12:false}) : '—';
    const fmtFecha = iso => iso ? new Date(iso).toLocaleDateString('es-CO',{day:'2-digit',month:'short',year:'numeric'}) : '—';

    let totalBrutoMin = 0, totalPausadoMin = 0, totalValor = 0, totalHorasFact = 0;
    const srvMap = {};
    etapas.forEach(e => {
      if (!e.inicio || !e.fin) return;
      const bruto   = Math.round((new Date(e.fin) - new Date(e.inicio)) / 60000);
      const pausado = e.tiempo_pausado_min || 0;
      totalBrutoMin   += bruto;
      totalPausadoMin += pausado;
      totalValor      += (e.valor || 0);
      totalHorasFact  += (e.horas_facturadas || 0);
      const s = e.servicio || 'otro';
      if (!srvMap[s]) srvMap[s] = { count: 0, neto: 0 };
      srvMap[s].count++;
      srvMap[s].neto += Math.max(0, bruto - pausado);
    });

    const totalNetoMin = Math.max(0, totalBrutoMin - totalPausadoMin);
    const esperas      = solsRep.filter(s => s.tiempo_espera_min != null).map(s => s.tiempo_espera_min);
    const promEspera   = esperas.length ? Math.round(esperas.reduce((a,b)=>a+b,0)/esperas.length) : 0;

    const hrStr = m => { const h=Math.floor(m/60); return h>0?`${h}h ${m%60}m`:`${m%60}m`; };

    if (formato === 'excel') {
      _cargarSheetJS(() => {
        const wb = XLSX.utils.book_new();
        // Hoja resumen
        const ws1 = XLSX.utils.aoa_to_sheet([
          [`REPORTE OPERARIO — ${nombreMec.toUpperCase()}`],
          [subtitulo],
          ['Generado:', new Date().toLocaleString('es-CO')],
          [],
          ['RESUMEN', ''],
          ['Etapas completadas', etapas.length],
          ['Tiempo bruto (horas)', Math.round(totalBrutoMin/60*10)/10],
          ['Tiempo pausado repuestos (min)', totalPausadoMin],
          ['Tiempo neto trabajado (horas)', Math.round(totalNetoMin/60*10)/10],
          ['Ingresos generados (COP)', totalValor],
          ['Horas facturadas', totalHorasFact],
          ['Solicitudes de repuesto', solsRep.length],
          ['Espera promedio por repuesto (min)', promEspera],
        ]);
        ws1['!cols'] = [{wch:35},{wch:22}];
        XLSX.utils.book_append_sheet(wb, ws1, 'Resumen');
        // Hoja detalle etapas
        const hdr = ['Placa','Vehículo','Etapa','Servicio','Inicio','Fin','Tiempo bruto (h)','Pausado (min)','Tiempo neto (h)','Valor (COP)','H.Facturadas'];
        const rows = etapas.map(e => {
          const o = omOrden[e.orden_id] || {};
          const bruto = (e.inicio && e.fin) ? Math.round((new Date(e.fin)-new Date(e.inicio))/60000) : 0;
          const neto  = Math.max(0, bruto - (e.tiempo_pausado_min||0));
          return [
            o.placa||'—', [o.marca,o.linea].filter(Boolean).join(' ')||'—',
            e.etapa||'—', e.servicio||'—',
            fmtFecha(e.inicio), fmtFecha(e.fin),
            Math.round(bruto/60*10)/10, e.tiempo_pausado_min||0, Math.round(neto/60*10)/10,
            e.valor||0, e.horas_facturadas||0
          ];
        });
        const ws2 = XLSX.utils.aoa_to_sheet([hdr,...rows]);
        ws2['!cols'] = [{wch:10},{wch:18},{wch:20},{wch:14},{wch:14},{wch:14},{wch:14},{wch:14},{wch:14},{wch:16},{wch:12}];
        XLSX.utils.book_append_sheet(wb, ws2, 'Etapas');
        // Hoja repuestos
        if (solsRep.length) {
          const rHdr = ['Repuesto','Estado','Tiempo espera (min)','Fecha solicitud'];
          const rRows = solsRep.map(s => [s.repuesto||'—', s.estado||'—', s.tiempo_espera_min||'—', fmtFecha(s.creado_en)]);
          const ws3 = XLSX.utils.aoa_to_sheet([rHdr,...rRows]);
          ws3['!cols'] = [{wch:30},{wch:18},{wch:20},{wch:16}];
          XLSX.utils.book_append_sheet(wb, ws3, 'Solicitudes repuesto');
        }
        const nombre = `${nombreMec.replace(/\s+/g,'_')}_${fechaIni}_${fechaFin}.xlsx`;
        XLSX.writeFile(wb, nombre);
        toast('Excel generado ✓');
      });
      return;
    }

    // PDF
    const srvColor = { latoneria:'#DC2626', pintura:'#D97706', mecanica:'#2563EB', adicionales:'#059669' };
    const serviciosHtml = Object.entries(srvMap).map(([srv, d]) => {
      const h = Math.floor(d.neto/60), m = d.neto%60;
      const color = srvColor[srv]||'#6B7280';
      const nombre = (typeof CATALOGO!=='undefined'&&CATALOGO[srv]?.nombre)||srv;
      return `<tr><td style="font-weight:600;color:${color}">${nombre}</td><td>${d.count}</td><td>${h>0?h+'h ':''} ${m}m</td></tr>`;
    }).join('');

    const etapasHtml = etapas.map(e => {
      const o = omOrden[e.orden_id] || {};
      const bruto = (e.inicio&&e.fin) ? Math.round((new Date(e.fin)-new Date(e.inicio))/60000) : 0;
      const neto  = Math.max(0, bruto-(e.tiempo_pausado_min||0));
      const hN = Math.floor(neto/60), mN = neto%60;
      const pausaBadge = (e.tiempo_pausado_min||0) > 0
        ? `<span style="font-size:9px;background:#FEF3C7;color:#92400E;padding:1px 5px;border-radius:3px">⏸ ${e.tiempo_pausado_min}m esp.</span>`
        : '';
      return `<tr>
        <td style="font-family:monospace;font-weight:700">${o.placa||'—'}</td>
        <td>${[o.marca,o.linea].filter(Boolean).join(' ')||'—'}</td>
        <td>${e.etapa||'—'}</td>
        <td>${(typeof CATALOGO!=='undefined'&&CATALOGO[e.servicio]?.nombre)||e.servicio||'—'}</td>
        <td style="font-size:10px">${fmtHora(e.inicio)}</td>
        <td style="font-size:10px">${fmtHora(e.fin)}</td>
        <td style="font-weight:700;color:#2563EB">${hN>0?hN+'h ':''} ${mN}m ${pausaBadge}</td>
        <td style="font-family:monospace">${fmt(e.valor)}</td>
      </tr>`;
    }).join('');

    const html = `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><title>${titulo}</title>
    <style>
      *{box-sizing:border-box;margin:0;padding:0}
      body{font-family:'Segoe UI',Arial,sans-serif;color:#1a1a2e;font-size:12px;line-height:1.5}
      .page{max-width:960px;margin:0 auto;padding:32px 36px}
      .rpt-header{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid #1E3A5F;padding-bottom:16px;margin-bottom:24px}
      .rpt-brand{font-size:22px;font-weight:800;color:#1E3A5F;letter-spacing:1px}
      .kpi-row{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:24px}
      .kpi{border:1px solid #e5e7eb;border-radius:8px;padding:12px 14px;border-top:3px solid}
      .kpi-val{font-size:20px;font-weight:800;margin-bottom:2px}
      .kpi-lbl{font-size:10px;color:#888;text-transform:uppercase;letter-spacing:.5px}
      .section{margin-bottom:26px;page-break-inside:avoid}
      .section-title{font-size:11px;font-weight:800;color:#1E3A5F;text-transform:uppercase;letter-spacing:1px;border-bottom:1px solid #e5e7eb;padding-bottom:7px;margin-bottom:12px}
      table{width:100%;border-collapse:collapse;font-size:11px}
      th{background:#f1f5f9;padding:7px 10px;text-align:left;font-size:9px;text-transform:uppercase;letter-spacing:.5px;color:#64748b;border-bottom:1px solid #e2e8f0}
      td{padding:6px 10px;border-bottom:1px solid #f1f5f0}
      .footer{margin-top:30px;border-top:1px solid #e2e8f0;padding-top:10px;font-size:9px;color:#aaa;text-align:center}
      @media print{.page{padding:18px 22px}}
    </style></head><body><div class="page">
      <div class="rpt-header">
        <div>
          <div class="rpt-brand">${_RPT_EMPRESA.nombre}</div>
          <div style="font-size:10px;color:#888;margin-top:3px">${_RPT_EMPRESA.slogan} · NIT ${_RPT_EMPRESA.nit}</div>
          <div style="font-size:10px;color:#888">${_RPT_EMPRESA.direccion} · Tel: ${_RPT_EMPRESA.telefono}</div>
        </div>
        <div style="text-align:right">
          <div style="font-size:15px;font-weight:700;color:#1E3A5F">${titulo}</div>
          <div style="font-size:11px;color:#555;margin-top:4px">${subtitulo}</div>
          <div style="font-size:10px;color:#999;margin-top:3px">Generado: ${new Date().toLocaleString('es-CO',{day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'})}</div>
        </div>
      </div>

      <div class="kpi-row">
        <div class="kpi" style="border-top-color:#1E3A5F">
          <div class="kpi-val" style="color:#1E3A5F">${etapas.length}</div>
          <div class="kpi-lbl">Etapas completadas</div>
        </div>
        <div class="kpi" style="border-top-color:#2563EB">
          <div class="kpi-val" style="color:#2563EB">${hrStr(totalNetoMin)}</div>
          <div class="kpi-lbl">Tiempo neto trabajado</div>
        </div>
        <div class="kpi" style="border-top-color:#F59E0B">
          <div class="kpi-val" style="color:#D97706">${totalPausadoMin > 0 ? hrStr(totalPausadoMin) : '0m'}</div>
          <div class="kpi-lbl">⏸ Pausado (repuestos)</div>
        </div>
        <div class="kpi" style="border-top-color:#059669">
          <div class="kpi-val" style="color:#059669;font-size:15px">${fmt(totalValor)}</div>
          <div class="kpi-lbl">Ingresos generados</div>
        </div>
      </div>

      <div class="section">
        <div class="section-title">Por servicio</div>
        <table><thead><tr><th>Servicio</th><th>Etapas</th><th>Tiempo neto</th></tr></thead>
        <tbody>${serviciosHtml}</tbody></table>
      </div>

      ${solsRep.length ? `<div class="section">
        <div class="section-title">Solicitudes de repuesto · ${solsRep.length} total · Espera promedio: ${promEspera}m</div>
        <table><thead><tr><th>Repuesto</th><th>Estado</th><th>Tiempo de espera</th><th>Fecha</th></tr></thead>
        <tbody>${solsRep.map(s=>`<tr>
          <td>${s.repuesto||'—'}</td>
          <td>${s.estado||'—'}</td>
          <td>${s.tiempo_espera_min!=null?s.tiempo_espera_min+'m':'En curso'}</td>
          <td>${fmtFecha(s.creado_en)}</td>
        </tr>`).join('')}</tbody></table>
      </div>` : ''}

      <div class="section">
        <div class="section-title">Detalle de etapas completadas</div>
        <table><thead><tr>
          <th>Placa</th><th>Vehículo</th><th>Etapa</th><th>Servicio</th>
          <th>Inicio</th><th>Fin</th><th>Tiempo neto</th><th>Valor</th>
        </tr></thead>
        <tbody>${etapasHtml}</tbody></table>
      </div>

      <div class="footer">
        ${_RPT_EMPRESA.nombre} · NIT ${_RPT_EMPRESA.nit} · ${_RPT_EMPRESA.direccion} · Tel: ${_RPT_EMPRESA.telefono} ·
        Reporte generado el ${new Date().toLocaleString('es-CO')}
      </div>
    </div></body></html>`;

    const win = window.open('', '_blank');
    if (win) { win.document.write(html); win.document.close(); setTimeout(() => win.print(), 800); }
    toast('Reporte PDF generado ✓');
  } catch(e) {
    toast('Error generando reporte: ' + e.message, 'err'); console.error(e);
  } finally {
    if (loading) loading.style.display = 'none';
  }
}

// ─── Motor de cálculo de métricas ───────────────────────────
function _calcularMetricas(etapas, ordenes, novedades, ordenesEntregadas, ordenesIngresadas, solicitudesRep, cotizaciones, flotillas, desdeISO, hastaISO, cotsCliente = []) {
  const minToHrs = ms => Math.round(ms / 3600000 * 10) / 10;
  const fmt      = n  => n != null ? new Intl.NumberFormat('es-CO',{style:'currency',currency:'COP',minimumFractionDigits:0}).format(n) : '$0';
  const hrStr    = m  => { const h=Math.floor(m/60); return h>0?`${h}h ${m%60}m`:`${m%60}m`; };

  // ── Duración bruta (inicio→fin) en horas ──
  const durBrutoHrs = e => (e.inicio && e.fin) ? minToHrs(new Date(e.fin) - new Date(e.inicio)) : null;
  // ── Duración neta (descontando pausas por repuesto) ──
  const durNetaHrs  = e => {
    const bruto = durBrutoHrs(e);
    if (bruto === null) return null;
    return Math.max(0, bruto - ((e.tiempo_pausado_min||0) / 60));
  };

  // ── Resumen general ──
  const totalIngresos          = etapas.reduce((s,e) => s+(e.valor||0), 0);
  const totalHorasFacturadas   = etapas.reduce((s,e) => s+(e.horas_facturadas||0), 0);
  const totalHorasAdicionales  = etapas.reduce((s,e) => s+(e.horas_adicionales||0), 0);
  const totalMinutosPausados   = etapas.reduce((s,e) => s+(e.tiempo_pausado_min||0), 0);

  // ── Tiempo promedio por servicio ──
  const srvMap = {};
  etapas.forEach(e => {
    const s    = e.servicio || 'otro';
    const neta = durNetaHrs(e);
    if (!srvMap[s]) srvMap[s] = { count:0, totalHrs:0, totalVal:0, durs:[] };
    srvMap[s].count++;
    srvMap[s].totalVal += (e.valor||0);
    if (neta !== null) { srvMap[s].totalHrs += neta; srvMap[s].durs.push(neta); }
  });
  const servicios = Object.entries(srvMap).map(([srv, d]) => ({
    servicio:       srv,
    nombre:         (typeof CATALOGO!=='undefined'&&CATALOGO[srv]?.nombre)||srv,
    etapas:         d.count,
    ingresos:       d.totalVal,
    horasPromedio:  d.durs.length ? Math.round((d.totalHrs/d.durs.length)*10)/10 : 0,
    horasTotal:     Math.round(d.totalHrs*10)/10,
    etapaMasLenta:  d.durs.length ? Math.round(Math.max(...d.durs)*10)/10 : 0,
    etapaMasRapida: d.durs.length ? Math.round(Math.min(...d.durs)*10)/10 : 0
  })).sort((a,b) => b.etapas - a.etapas);

  // ── Calidad por técnico: novedades atribuibles ──
  const calidadTecMap = {};
  novedades.forEach(n => {
    if (!n.responsable) return;
    if (!calidadTecMap[n.responsable]) calidadTecMap[n.responsable] = { reprocesos:0, garantias:0, detenidos:0 };
    if (n.tipo === 'Reproceso') calidadTecMap[n.responsable].reprocesos++;
    if (n.tipo === 'Garantia')  calidadTecMap[n.responsable].garantias++;
    if (n.tipo === 'Detenido')  calidadTecMap[n.responsable].detenidos++;
  });

  // ── Eficiencia por técnico — con tiempos netos ──
  const tecMap = {};
  etapas.forEach(e => {
    if (!e.tecnico) return;
    const neta  = durNetaHrs(e);
    const bruta = durBrutoHrs(e);
    if (!tecMap[e.tecnico]) tecMap[e.tecnico] = {
      etapas:0, completadas:0,
      totalHrsNeto:0, totalHrsBruto:0, totalPausadoMin:0,
      horasEst:0, horasFact:0, horasAdi:0, totalVal:0,
      servicios:{}, dursNeto:[]
    };
    const t = tecMap[e.tecnico];
    t.etapas++;
    if (e.fin) t.completadas++;
    t.totalVal         += (e.valor||0);
    t.horasFact        += (e.horas_facturadas||0);
    t.horasAdi         += (e.horas_adicionales||0);
    t.horasEst         += (e.horas_estimadas||0);
    t.totalPausadoMin  += (e.tiempo_pausado_min||0);
    if (bruta !== null) t.totalHrsBruto += bruta;
    if (neta  !== null) { t.totalHrsNeto += neta; t.dursNeto.push(neta); }
    const s = e.servicio || 'otro';
    t.servicios[s] = (t.servicios[s]||0)+1;
  });
  const tecnicos = Object.entries(tecMap).map(([tec, d]) => {
    const eficienciaEst = d.horasEst > 0
      ? Math.round((d.horasEst / Math.max(d.totalHrsNeto, 0.1)) * 100) : null;
    const cal = calidadTecMap[tec] || { reprocesos:0, garantias:0, detenidos:0 };
    return {
      tecnico:            tec,
      etapas:             d.etapas,
      completadas:        d.completadas,
      horasNetas:         Math.round(d.totalHrsNeto*10)/10,
      horasBrutas:        Math.round(d.totalHrsBruto*10)/10,
      minutosPausados:    d.totalPausadoMin,
      horasEstimadas:     Math.round(d.horasEst*10)/10,
      horasFacturadas:    Math.round(d.horasFact*10)/10,
      horasAdicionales:   Math.round(d.horasAdi*10)/10,
      ingresos:           d.totalVal,
      eficiencia:         eficienciaEst,
      promedioHrEtapa:    d.dursNeto.length ? Math.round((d.totalHrsNeto/d.dursNeto.length)*10)/10 : 0,
      servicioTop:        Object.entries(d.servicios).sort((a,b)=>b[1]-a[1])[0]?.[0]||'—',
      reprocesos:         cal.reprocesos,
      garantias:          cal.garantias,
      detenidos:          cal.detenidos
    };
  }).sort((a,b) => b.completadas - a.completadas);

  // ── Análisis de solicitudes de repuesto ──
  const esperas = solicitudesRep.filter(s => s.tiempo_espera_min != null).map(s => s.tiempo_espera_min);
  const tiempoEsperaPromedio = esperas.length ? Math.round(esperas.reduce((a,b)=>a+b,0)/esperas.length) : 0;
  const topRepMap = {};
  solicitudesRep.forEach(s => { topRepMap[s.repuesto] = (topRepMap[s.repuesto]||0)+1; });
  const topRepuestos = Object.entries(topRepMap)
    .sort((a,b)=>b[1]-a[1]).slice(0,10)
    .map(([rep, n]) => ({ repuesto: rep, veces: n }));

  // ── Costos y márgenes de repuestos ──
  const cotPorSol = {};
  cotizaciones.forEach(c => {
    if (!cotPorSol[c.solicitud_id]) cotPorSol[c.solicitud_id] = [];
    cotPorSol[c.solicitud_id].push(c);
  });
  let totalCostoRep = 0, totalVentaRep = 0;
  solicitudesRep.filter(s => s.estado === 'entregado').forEach(s => {
    const cots = cotPorSol[s.id] || [];
    const entregado = cots.find(c => c.estado_opcion === 'entregado');
    if (entregado) {
      totalCostoRep += (entregado.precio_costo||0) * (s.unidades||1);
      totalVentaRep += (entregado.precio_venta_jefe||0) * (s.unidades||1);
    }
  });
  const margenRep = totalCostoRep > 0 ? Math.round(((totalVentaRep-totalCostoRep)/totalCostoRep)*100) : 0;

  // ── Cotizaciones al cliente → conversión a orden ──
  const cotsClienteTotal     = cotsCliente.length;
  const cotsClienteValor     = cotsCliente.reduce((s,c) => s + (c.total_general||0), 0);
  const cotsConvertidas      = cotsCliente.filter(c => c.orden_id != null).length;
  const cotsValorConvertido  = cotsCliente.filter(c => c.orden_id != null).reduce((s,c) => s + (c.total_general||0), 0);
  const cotsTasaConversion   = cotsClienteTotal > 0 ? Math.round((cotsConvertidas/cotsClienteTotal)*100) : 0;

  // ── Análisis por tipo de cliente ──
  const valPorOrden = {};
  etapas.forEach(e => { valPorOrden[e.orden_id] = (valPorOrden[e.orden_id]||0)+(e.valor||0); });

  // La flotilla guarda su NOMBRE en el campo "aseguradora" con tipo_cliente='flotilla'.
  // Por eso se clasifica primero por tipo_cliente para no contar flotillas como aseguradoras.
  const esFlotilla = o => o.tipo_cliente === 'flotilla';
  const esEmpresa  = o => o.tipo_cliente === 'empresa';
  const esAseg     = o => !esFlotilla(o) && !esEmpresa(o) && (o.tipo_cliente === 'aseguradora' || !!o.aseguradora);

  const tipoMap = {};
  ordenes.forEach(o => {
    const key = esFlotilla(o) ? 'Flotilla' : esEmpresa(o) ? 'Empresa' : (esAseg(o) ? 'Aseguradora' : 'Particular');
    if (!tipoMap[key]) tipoMap[key] = { ordenes:0, valor:0 };
    tipoMap[key].ordenes++;
    tipoMap[key].valor += (valPorOrden[o.id]||0);
  });
  const tiposCliente = Object.entries(tipoMap)
    .map(([tipo, d]) => ({ tipo, ...d }))
    .sort((a,b) => b.ordenes - a.ordenes);

  // ── Ranking aseguradoras (excluye flotillas) ──
  const asegMap = {};
  ordenes.filter(esAseg).forEach(o => {
    const k = o.aseguradora || 'Sin nombre';
    if (!asegMap[k]) asegMap[k] = { ordenes:0, valor:0 };
    asegMap[k].ordenes++;
    asegMap[k].valor += (valPorOrden[o.id]||0);
  });
  const rankingAseguradoras = Object.entries(asegMap)
    .map(([nombre, d]) => ({ nombre, ...d }))
    .sort((a,b) => b.ordenes - a.ordenes).slice(0,10);

  // ── Ranking flotillas / empresas (por nombre, guardado en "aseguradora") ──
  const flotMap2 = {};
  ordenes.filter(esFlotilla).forEach(o => {
    const nombre = o.aseguradora || 'Sin flotilla';
    if (!flotMap2[nombre]) flotMap2[nombre] = { nombre, ordenes:0, valor:0 };
    flotMap2[nombre].ordenes++;
    flotMap2[nombre].valor += (valPorOrden[o.id]||0);
  });
  const rankingFlotillas = Object.values(flotMap2)
    .sort((a,b) => b.ordenes - a.ordenes);

  // ── Análisis de novedades ──
  const novPorTipo = { Detenido:0, Reproceso:0, Garantia:0 };
  const novPorOrden = {};
  novedades.forEach(n => {
    novPorTipo[n.tipo] = (novPorTipo[n.tipo]||0)+1;
    novPorOrden[n.orden_id] = (novPorOrden[n.orden_id]||0)+1;
  });
  const ordenesConNovedades = Object.keys(novPorOrden).length;

  // ── Tiempos de ciclo por orden ──
  const ordenesConTiempo = ordenesEntregadas.map(o => {
    const durTotal = (o.creado_en && o.entregada_en)
      ? minToHrs(new Date(o.entregada_en) - new Date(o.creado_en)) : null;
    const diasPromesa = (o.fecha_entrega_1 && o.entregada_en)
      ? Math.round((new Date(o.entregada_en) - new Date(o.fecha_entrega_1)) / 86400000) : null;
    return {
      placa: o.placa, vehiculo: [o.marca,o.linea].filter(Boolean).join(' ')||'—',
      propietario: o.propietario||'—', aseguradora: o.aseguradora||'Particular',
      ingreso: o.creado_en, entrega: o.entregada_en,
      duracionHrs: durTotal, diasVsPromesa: diasPromesa,
      novedades: novPorOrden[o.id]||0
    };
  });
  const tiempoPromedioCiclo = ordenesConTiempo.filter(o=>o.duracionHrs).length
    ? Math.round(ordenesConTiempo.filter(o=>o.duracionHrs).reduce((s,o)=>s+o.duracionHrs,0)/ordenesConTiempo.filter(o=>o.duracionHrs).length*10)/10 : 0;
  const ordenesATiempo    = ordenesConTiempo.filter(o=>o.diasVsPromesa!==null&&o.diasVsPromesa<=0).length;
  const ordenesTarde      = ordenesConTiempo.filter(o=>o.diasVsPromesa!==null&&o.diasVsPromesa>0).length;
  const totalConPromesa   = ordenesATiempo + ordenesTarde;
  const tasaCumplimiento  = totalConPromesa > 0 ? Math.round(ordenesATiempo / totalConPromesa * 100) : null;

  // ── Análisis de tiempos en pulmón ──
  // Unir ordenesIngresadas + ordenesEntregadas sin duplicados
  const todasOrdenesIdsVistas = new Set();
  const todasOrdenesPeriodo = [...ordenesIngresadas, ...ordenesEntregadas].filter(o => {
    if (todasOrdenesIdsVistas.has(o.id)) return false;
    todasOrdenesIdsVistas.add(o.id); return true;
  });
  const ordenesConPulmon = todasOrdenesPeriodo.filter(o => o.pulmon_desde);

  const tiemposPulmonHrs = ordenesConPulmon.map(o => {
    const fin = o.pulmon_fin || (o.pulmon ? new Date().toISOString() : null);
    if (!fin) return null;
    return (new Date(fin) - new Date(o.pulmon_desde)) / 3600000;
  }).filter(t => t !== null);

  const promedioPulmonHrs = tiemposPulmonHrs.length
    ? Math.round(tiemposPulmonHrs.reduce((a,b)=>a+b,0)/tiemposPulmonHrs.length * 10) / 10 : 0;
  const maxPulmonHrs      = tiemposPulmonHrs.length ? Math.round(Math.max(...tiemposPulmonHrs)*10)/10 : 0;
  const ordenesEnPulmonAhora = ordenesConPulmon.filter(o => o.pulmon).length;

  const distPulmon = { menos1d:0, uno3d:0, mas3d:0 };
  tiemposPulmonHrs.forEach(h => {
    if (h < 24) distPulmon.menos1d++;
    else if (h < 72) distPulmon.uno3d++;
    else distPulmon.mas3d++;
  });

  const pulmonPorTipoMap = {};
  ordenesConPulmon.filter(o => o.pulmon_desde && o.pulmon_fin).forEach(o => {
    const tipo = o.pulmon_tipo || 'sin tipo';
    if (!pulmonPorTipoMap[tipo]) pulmonPorTipoMap[tipo] = { count:0, totalHrs:0 };
    pulmonPorTipoMap[tipo].count++;
    pulmonPorTipoMap[tipo].totalHrs += (new Date(o.pulmon_fin) - new Date(o.pulmon_desde)) / 3600000;
  });
  const pulmonPorTipo = Object.entries(pulmonPorTipoMap).map(([tipo, d]) => ({
    tipo: tipo.charAt(0).toUpperCase()+tipo.slice(1),
    count: d.count,
    promedioHrs: Math.round(d.totalHrs/d.count*10)/10
  }));

  // ── Cuellos de botella ──
  const etapaMap = {};
  etapas.forEach(e => {
    const k = e.etapa||'Sin nombre';
    const neta = durNetaHrs(e);
    if (!etapaMap[k]) etapaMap[k] = { count:0, totalHrs:0, servicio: e.servicio };
    etapaMap[k].count++;
    if (neta !== null) etapaMap[k].totalHrs += neta;
  });
  const cuellos = Object.entries(etapaMap).map(([etapa, d]) => ({
    etapa, servicio: d.servicio||'—', veces: d.count,
    horaPromedio: d.count>0 ? Math.round((d.totalHrs/d.count)*10)/10 : 0
  })).sort((a,b) => b.horaPromedio - a.horaPromedio).slice(0,10);

  return {
    resumen: {
      ordenesEntregadas:      ordenesEntregadas.length,
      ordenesIngresadas:      ordenesIngresadas.length,
      etapasCompletadas:      etapas.length,
      totalIngresos,
      totalHorasFacturadas:   Math.round(totalHorasFacturadas*10)/10,
      totalHorasAdicionales:  Math.round(totalHorasAdicionales*10)/10,
      totalMinutosPausados,
      tiempoPromedioCiclo,
      ordenesATiempo, ordenesTarde, tasaCumplimiento,
      novedadesTotal:         novedades.length,
      novPorTipo, ordenesConNovedades,
      // repuestos
      solicitudesRep:         solicitudesRep.length,
      tiempoEsperaPromedio,
      totalCostoRep, totalVentaRep, margenRep,
      // cotizaciones al cliente
      cotsClienteTotal, cotsClienteValor, cotsConvertidas, cotsValorConvertido, cotsTasaConversion,
      // totales economicos
      totalMOmasRep:          totalIngresos + totalVentaRep,
      // pulmón
      ordenesConPulmon:       ordenesConPulmon.length,
      promedioPulmonHrs,      maxPulmonHrs,
      ordenesEnPulmonAhora,   distPulmon, pulmonPorTipo
    },
    servicios, tecnicos, cuellos,
    ordenesDetalle: ordenesConTiempo,
    ordenesIngresadas, novedades,
    topRepuestos, tiposCliente, rankingAseguradoras, rankingFlotillas,
    fmt, hrStr
  };
}

// ─── Generador PDF ───────────────────────────────────────────
function _generarPDF(d, titulo, subtitulo) {
  const { resumen, servicios, tecnicos, cuellos, ordenesDetalle, ordenesIngresadas, novedades,
          topRepuestos, tiposCliente, rankingAseguradoras, rankingFlotillas, fmt, hrStr } = d;

  const charts = _chartsReporte(d);
  const graficasHtml = charts.length ? `
  <div class="section">
    <div class="section-title">Gráficas del período</div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px">
      ${charts.map(c => `<img src="${c.png}" alt="${c.titulo}" style="width:100%;border:1px solid #e5e7eb;border-radius:8px">`).join('')}
    </div>
  </div>` : '';

  const fmtFecha = iso => iso ? new Date(iso).toLocaleDateString('es-CO',{day:'2-digit',month:'short',year:'numeric'}) : '—';
  const fmtHora  = iso => iso ? new Date(iso).toLocaleString('es-CO',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit',hour12:false}) : '—';
  const pctColor = p => p==null?'#666':p>=100?'#059669':p>=80?'#D97706':'#DC2626';

  const html = `<!DOCTYPE html>
<html lang="es"><head><meta charset="UTF-8"><title>${titulo}</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:'Segoe UI',Arial,sans-serif;color:#1a1a2e;background:#fff;font-size:12px;line-height:1.5}
  .page{max-width:960px;margin:0 auto;padding:32px 36px}
  .rpt-header{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid #1E3A5F;padding-bottom:16px;margin-bottom:24px}
  .rpt-brand{font-size:22px;font-weight:800;color:#1E3A5F;letter-spacing:1px}
  .kpi-row{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:22px}
  .kpi{border:1px solid #e5e7eb;border-radius:8px;padding:12px 14px;border-top:3px solid}
  .kpi-val{font-size:20px;font-weight:800;margin-bottom:3px}
  .kpi-lbl{font-size:10px;color:#888;text-transform:uppercase;letter-spacing:.5px}
  .kpi-sub{font-size:10px;color:#aaa;margin-top:2px}
  .section{margin-bottom:26px;page-break-inside:avoid}
  .section-title{font-size:11px;font-weight:800;color:#1E3A5F;text-transform:uppercase;letter-spacing:1px;border-bottom:1px solid #e5e7eb;padding-bottom:7px;margin-bottom:12px;display:flex;align-items:center;gap:8px}
  table{width:100%;border-collapse:collapse;font-size:11px}
  th{background:#f1f5f9;padding:7px 10px;text-align:left;font-size:9px;text-transform:uppercase;letter-spacing:.4px;color:#64748b;font-weight:700;border-bottom:1px solid #e2e8f0}
  td{padding:6px 10px;border-bottom:1px solid #f1f5f0;color:#374151}
  tr:last-child td{border-bottom:none}
  .total-row td{font-weight:700;background:#f8fafc;border-top:2px solid #e2e8f0}
  .badge{display:inline-block;padding:2px 7px;border-radius:20px;font-size:9px;font-weight:700}
  .badge-green{background:#dcfce7;color:#166534}
  .badge-amber{background:#fef9c3;color:#854d0e}
  .badge-red{background:#fee2e2;color:#991b1b}
  .badge-blue{background:#dbeafe;color:#1e40af}
  .badge-gray{background:#f1f5f9;color:#64748b}
  .badge-pause{background:#FEF3C7;color:#92400E}
  .bar-wrap{background:#f1f5f9;border-radius:4px;height:6px;overflow:hidden;width:80px;display:inline-block;vertical-align:middle;margin-left:6px}
  .bar-fill{height:100%;border-radius:4px}
  .nov-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:10px}
  .nov-box{border-radius:8px;padding:12px;text-align:center}
  .nov-val{font-size:24px;font-weight:800;margin-bottom:3px}
  .cuello-row{display:flex;align-items:center;gap:10px;margin-bottom:6px}
  .cuello-lbl{width:140px;font-size:11px;color:#374151;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .cuello-bar{background:#f1f5f9;border-radius:4px;height:8px;overflow:hidden;flex:1}
  .cuello-val{width:50px;font-size:11px;font-weight:700;text-align:right}
  .tipo-row{display:flex;align-items:center;justify-content:space-between;padding:8px 0;border-bottom:1px solid #f1f5f9}
  .footer{margin-top:32px;border-top:1px solid #e2e8f0;padding-top:10px;font-size:9px;color:#aaa;text-align:center}
  @media print{body{font-size:11px}.page{padding:18px 22px}.section{page-break-inside:avoid}}
</style></head><body><div class="page">

  <!-- ENCABEZADO -->
  <div class="rpt-header">
    <div>
      <div class="rpt-brand">${_RPT_EMPRESA.nombre}</div>
      <div style="font-size:11px;color:#888;margin-top:3px">${_RPT_EMPRESA.slogan} · NIT ${_RPT_EMPRESA.nit}</div>
      <div style="font-size:10px;color:#aaa;margin-top:2px">${_RPT_EMPRESA.direccion} · Tel: ${_RPT_EMPRESA.telefono} · ${_RPT_EMPRESA.email}</div>
      ${subtitulo ? `<div style="font-size:11px;color:#666;margin-top:5px">${subtitulo}</div>` : ''}
    </div>
    <div style="text-align:right">
      <div style="font-size:14px;font-weight:700;color:#1E3A5F">${titulo}</div>
      <div style="font-size:10px;color:#999;margin-top:4px">Generado: ${new Date().toLocaleString('es-CO',{day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'})}</div>
    </div>
  </div>

  <!-- KPIs EJECUTIVOS -->
  <div class="kpi-row">
    <div class="kpi" style="border-top-color:#1E3A5F">
      <div class="kpi-val" style="color:#1E3A5F">${resumen.ordenesEntregadas}</div>
      <div class="kpi-lbl">Órdenes entregadas</div>
      <div class="kpi-sub">
        ${resumen.tasaCumplimiento !== null
          ? `<span style="font-weight:700;color:${resumen.tasaCumplimiento>=90?'#059669':resumen.tasaCumplimiento>=70?'#D97706':'#DC2626'}">${resumen.tasaCumplimiento}% a tiempo</span> · ${resumen.ordenesTarde} tarde`
          : `${resumen.ordenesATiempo} a tiempo · ${resumen.ordenesTarde} tarde`}
      </div>
    </div>
    <div class="kpi" style="border-top-color:#059669">
      <div class="kpi-val" style="color:#059669;font-size:14px">${fmt(resumen.totalIngresos)}</div>
      <div class="kpi-lbl">Ingresos mano de obra</div>
      <div class="kpi-sub">${resumen.totalHorasFacturadas}h facturadas</div>
    </div>
    <div class="kpi" style="border-top-color:#D97706">
      <div class="kpi-val" style="color:#D97706">${resumen.tiempoPromedioCiclo}h</div>
      <div class="kpi-lbl">Ciclo promedio / orden</div>
      <div class="kpi-sub">${resumen.etapasCompletadas} etapas completadas</div>
    </div>
    <div class="kpi" style="border-top-color:#F59E0B">
      <div class="kpi-val" style="color:#D97706;font-size:15px">${resumen.totalMinutosPausados > 0 ? hrStr(resumen.totalMinutosPausados) : '—'}</div>
      <div class="kpi-lbl">⏸ Total pausado (repuestos)</div>
      <div class="kpi-sub">${resumen.solicitudesRep} solicitudes · ${resumen.tiempoEsperaPromedio}m espera prom.</div>
    </div>
  </div>

  <!-- SEGUNDA FILA KPIs: REPUESTOS + COSTOS -->
  ${(resumen.totalCostoRep > 0 || resumen.totalVentaRep > 0) ? `
  <div class="kpi-row" style="margin-bottom:24px">
    <div class="kpi" style="border-top-color:#7C3AED">
      <div class="kpi-val" style="color:#7C3AED;font-size:14px">${fmt(resumen.totalCostoRep)}</div>
      <div class="kpi-lbl">Costo repuestos (proveedor)</div>
      <div class="kpi-sub">Repuestos entregados en el período</div>
    </div>
    <div class="kpi" style="border-top-color:#0891B2">
      <div class="kpi-val" style="color:#0891B2;font-size:14px">${fmt(resumen.totalVentaRep)}</div>
      <div class="kpi-lbl">Venta repuestos (al cliente)</div>
      <div class="kpi-sub">Margen: <strong style="color:${resumen.margenRep>=30?'#059669':resumen.margenRep>=15?'#D97706':'#DC2626'}">${resumen.margenRep}%</strong></div>
    </div>
    <div class="kpi" style="border-top-color:#059669">
      <div class="kpi-val" style="color:#059669;font-size:14px">${fmt(resumen.totalIngresos + resumen.totalVentaRep)}</div>
      <div class="kpi-lbl">Total facturado (MO + repuestos)</div>
      <div class="kpi-sub">Combinado del período</div>
    </div>
    <div class="kpi" style="border-top-color:#DC2626">
      <div class="kpi-val" style="color:#DC2626">${resumen.novedadesTotal}</div>
      <div class="kpi-lbl">Novedades registradas</div>
      <div class="kpi-sub">${resumen.ordenesConNovedades} órdenes afectadas</div>
    </div>
  </div>` : `
  <div class="kpi-row" style="margin-bottom:24px">
    <div class="kpi" style="border-top-color:#DC2626">
      <div class="kpi-val" style="color:#DC2626">${resumen.novedadesTotal}</div>
      <div class="kpi-lbl">Novedades registradas</div>
      <div class="kpi-sub">${resumen.ordenesConNovedades} órdenes afectadas</div>
    </div>
    <div class="kpi" style="border-top-color:#6B7280">
      <div class="kpi-val" style="color:#6B7280">${resumen.solicitudesRep}</div>
      <div class="kpi-lbl">Solicitudes de repuesto</div>
      <div class="kpi-sub">Espera promedio: ${resumen.tiempoEsperaPromedio}min</div>
    </div>
    <div class="kpi" style="border-top-color:#1E3A5F;grid-column:span 2">
      <div class="kpi-val" style="color:#1E3A5F">${resumen.ordenesIngresadas}</div>
      <div class="kpi-lbl">Órdenes ingresadas al período</div>
    </div>
  </div>`}

  <!-- GRÁFICAS -->
  ${graficasHtml}

  <!-- COTIZACIONES → ÓRDENES -->
  ${resumen.cotsClienteTotal > 0 ? `
  <div class="section">
    <div class="section-title">Cotizaciones al cliente · conversión a orden</div>
    <div class="kpi-row">
      <div class="kpi" style="border-top-color:#1E3A5F">
        <div class="kpi-val" style="color:#1E3A5F">${resumen.cotsClienteTotal}</div>
        <div class="kpi-lbl">Cotizaciones del período</div>
        <div class="kpi-sub">Valor cotizado: ${fmt(resumen.cotsClienteValor)}</div>
      </div>
      <div class="kpi" style="border-top-color:#059669">
        <div class="kpi-val" style="color:#059669">${resumen.cotsConvertidas}</div>
        <div class="kpi-lbl">Convertidas en orden</div>
        <div class="kpi-sub">Valor: ${fmt(resumen.cotsValorConvertido)}</div>
      </div>
      <div class="kpi" style="border-top-color:${resumen.cotsTasaConversion>=50?'#059669':resumen.cotsTasaConversion>=25?'#D97706':'#DC2626'}">
        <div class="kpi-val" style="color:${resumen.cotsTasaConversion>=50?'#059669':resumen.cotsTasaConversion>=25?'#D97706':'#DC2626'}">${resumen.cotsTasaConversion}%</div>
        <div class="kpi-lbl">Tasa de conversión</div>
        <div class="kpi-sub">Cotización que se vuelve trabajo</div>
      </div>
      <div class="kpi" style="border-top-color:#7C3AED">
        <div class="kpi-val" style="color:#7C3AED">${resumen.cotsClienteTotal - resumen.cotsConvertidas}</div>
        <div class="kpi-lbl">Sin convertir aún</div>
        <div class="kpi-sub">Pendientes o rechazadas</div>
      </div>
    </div>
  </div>` : ''}

  <!-- PANEL PULMÓN -->
  ${resumen.ordenesConPulmon > 0 ? `
  <div style="background:#FFFBEB;border:1.5px solid #FDE68A;border-radius:10px;padding:14px 20px;margin-bottom:22px">
    <div style="font-size:10px;font-weight:800;color:#92400E;text-transform:uppercase;letter-spacing:.8px;margin-bottom:12px">
      ⏰ Análisis de tiempo en pulmón — ${resumen.ordenesConPulmon} órdenes registradas
    </div>
    <div style="display:flex;gap:28px;flex-wrap:wrap;align-items:flex-start">
      <div>
        <div style="font-size:11px;color:#92400E;margin-bottom:2px">Promedio</div>
        <div style="font-size:24px;font-weight:800;color:#D97706">${resumen.promedioPulmonHrs}h</div>
      </div>
      <div style="border-left:1px solid #FDE68A;padding-left:24px">
        <div style="font-size:11px;color:#92400E;margin-bottom:2px">Máximo registrado</div>
        <div style="font-size:24px;font-weight:800;color:#D97706">${resumen.maxPulmonHrs}h</div>
      </div>
      <div style="border-left:1px solid #FDE68A;padding-left:24px">
        <div style="font-size:11px;color:#92400E;margin-bottom:6px">Distribución</div>
        <div style="font-size:12px;line-height:1.8;color:#78350F">
          <span style="font-weight:700">${resumen.distPulmon.menos1d}</span> menor a 1 día &nbsp;·&nbsp;
          <span style="font-weight:700">${resumen.distPulmon.uno3d}</span> de 1 a 3 días &nbsp;·&nbsp;
          <span style="font-weight:700;color:${resumen.distPulmon.mas3d>0?'#DC2626':'#78350F'}">${resumen.distPulmon.mas3d}</span> más de 3 días
        </div>
      </div>
      ${resumen.pulmonPorTipo.length ? `<div style="border-left:1px solid #FDE68A;padding-left:24px">
        <div style="font-size:11px;color:#92400E;margin-bottom:6px">Por tipo</div>
        ${resumen.pulmonPorTipo.map(p => `<div style="font-size:12px;color:#78350F"><strong>${p.tipo}</strong>: ${p.count} ord. · prom. ${p.promedioHrs}h</div>`).join('')}
      </div>` : ''}
      ${resumen.ordenesEnPulmonAhora > 0 ? `<div style="border-left:1px solid #FDE68A;padding-left:24px">
        <div style="font-size:11px;color:#DC2626;margin-bottom:2px">Actualmente en pulmón</div>
        <div style="font-size:24px;font-weight:800;color:#DC2626">${resumen.ordenesEnPulmonAhora}</div>
      </div>` : ''}
    </div>
  </div>` : ''}

  <!-- ANÁLISIS POR SERVICIO -->
  <div class="section">
    <div class="section-title">Análisis por servicio (tiempo neto — descontando pausas)</div>
    <table><thead><tr>
      <th>Servicio</th><th>Etapas</th><th>Ingresos</th>
      <th>Hrs promedio/etapa</th><th>Más lenta</th><th>Más rápida</th><th>Hrs total neto</th>
    </tr></thead><tbody>
      ${servicios.map(s => `<tr>
        <td><strong>${escapeHtml(s.nombre)}</strong></td>
        <td><span class="badge badge-blue">${s.etapas}</span></td>
        <td style="font-family:monospace">${fmt(s.ingresos)}</td>
        <td>${s.horasPromedio}h</td>
        <td style="color:#DC2626">${s.etapaMasLenta}h</td>
        <td style="color:#059669">${s.etapaMasRapida}h</td>
        <td>${s.horasTotal}h</td>
      </tr>`).join('')}
      <tr class="total-row">
        <td>TOTAL</td>
        <td>${servicios.reduce((s,x)=>s+x.etapas,0)}</td>
        <td style="font-family:monospace">${fmt(servicios.reduce((s,x)=>s+x.ingresos,0))}</td>
        <td colspan="4"></td>
      </tr>
    </tbody></table>
  </div>

  <!-- RENDIMIENTO POR TÉCNICO — con tiempo neto, pausas y calidad -->
  <div class="section">
    <div class="section-title">Rendimiento por técnico</div>
    <div style="font-size:10px;color:#888;margin-bottom:8px;font-style:italic">
      * Tiempo neto = tiempo bruto menos minutos pausados esperando repuestos.
        Eficiencia: tiempo neto vs estimado (>100% = más rápido que estimado).
    </div>
    <table><thead><tr>
      <th>Técnico</th><th>Etapas</th><th>T. Neto (h)</th><th>T. Bruto (h)</th>
      <th>⏸ Pausado</th><th>Eficiencia</th><th>Ingresos</th><th>Reprocesos</th><th>Garantías</th>
    </tr></thead><tbody>
      ${tecnicos.map(t => {
        const ef = t.eficiencia;
        const efBadge = ef==null ? '<span class="badge badge-gray">—</span>'
          : ef>=100 ? `<span class="badge badge-green">${ef}% ↑</span>`
          : ef>=80  ? `<span class="badge badge-amber">${ef}%</span>`
          : `<span class="badge badge-red">${ef}% ↓</span>`;
        const pausBadge = t.minutosPausados > 0
          ? `<span class="badge badge-pause">⏸ ${t.minutosPausados}m</span>`
          : '<span style="color:#aaa">—</span>';
        const reproBadge = t.reprocesos > 0
          ? `<span class="badge badge-amber">${t.reprocesos}</span>`
          : '<span style="color:#aaa">0</span>';
        const garBadge = t.garantias > 0
          ? `<span class="badge badge-red">${t.garantias}</span>`
          : '<span style="color:#aaa">0</span>';
        return `<tr>
          <td><strong>${t.tecnico}</strong></td>
          <td>${t.completadas}/${t.etapas}</td>
          <td style="color:#2563EB;font-weight:600">${t.horasNetas}h</td>
          <td style="color:#94A3B8">${t.horasBrutas}h</td>
          <td>${pausBadge}</td>
          <td>${efBadge}</td>
          <td style="font-family:monospace">${fmt(t.ingresos)}</td>
          <td style="text-align:center">${reproBadge}</td>
          <td style="text-align:center">${garBadge}</td>
        </tr>`;
      }).join('')}
    </tbody></table>
  </div>

  <!-- CALIDAD POR TÉCNICO — sección destacada si hay novedades -->
  ${tecnicos.some(t => t.reprocesos > 0 || t.garantias > 0) ? `<div class="section">
    <div class="section-title">Calidad por técnico — reprocesos y garantías</div>
    <div style="font-size:10px;color:#888;margin-bottom:10px;font-style:italic">
      * Un reproceso es trabajo que tuvo que rehacerse. Una garantía es un reclamo posterior a la entrega.
        Ambos afectan la rentabilidad real del trabajo.
    </div>
    <table><thead><tr>
      <th>Técnico</th><th>Etapas completadas</th><th>Reprocesos</th>
      <th>Garantías</th><th>Detenidos</th><th>Total incidencias</th><th>Tasa incidencia</th>
    </tr></thead><tbody>
      ${tecnicos.filter(t => t.reprocesos>0||t.garantias>0||t.detenidos>0).map(t => {
        const total = t.reprocesos + t.garantias + t.detenidos;
        const tasa  = t.completadas > 0 ? Math.round(total/t.completadas*100) : 0;
        const tasaColor = tasa===0?'#059669':tasa<=10?'#D97706':'#DC2626';
        return `<tr>
          <td><strong>${t.tecnico}</strong></td>
          <td>${t.completadas}</td>
          <td style="text-align:center">${t.reprocesos>0?`<span class="badge badge-amber">${t.reprocesos}</span>`:'—'}</td>
          <td style="text-align:center">${t.garantias>0?`<span class="badge badge-red">${t.garantias}</span>`:'—'}</td>
          <td style="text-align:center">${t.detenidos>0?`<span class="badge badge-gray">${t.detenidos}</span>`:'—'}</td>
          <td style="text-align:center;font-weight:700">${total}</td>
          <td style="color:${tasaColor};font-weight:700">${tasa}%</td>
        </tr>`;
      }).join('')}
    </tbody></table>
  </div>` : ''}

  <!-- CUELLOS DE BOTELLA -->
  <div class="section">
    <div class="section-title">Cuellos de botella — etapas con mayor duración promedio (neta)</div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:24px">
      <div>${cuellos.slice(0,5).map((c,i) => {
        const maxH = cuellos[0].horaPromedio||1;
        const pct  = Math.round((c.horaPromedio/maxH)*100);
        const color= i===0?'#DC2626':i===1?'#D97706':'#2563EB';
        return `<div class="cuello-row">
          <span class="cuello-lbl">${c.etapa}</span>
          <div class="cuello-bar"><div class="bar-fill" style="width:${pct}%;background:${color}"></div></div>
          <span class="cuello-val" style="color:${color}">${c.horaPromedio}h</span>
        </div>`;
      }).join('')}</div>
      <div>${cuellos.slice(5,10).map(c => {
        const maxH = cuellos[0].horaPromedio||1;
        const pct  = Math.round((c.horaPromedio/maxH)*100);
        return `<div class="cuello-row">
          <span class="cuello-lbl">${c.etapa}</span>
          <div class="cuello-bar"><div class="bar-fill" style="width:${pct}%;background:#64748b"></div></div>
          <span class="cuello-val">${c.horaPromedio}h</span>
        </div>`;
      }).join('')}</div>
    </div>
  </div>

  <!-- POR TIPO DE CLIENTE -->
  ${tiposCliente.length ? `<div class="section">
    <div class="section-title">Análisis por tipo de cliente</div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px">
      <div>
        <table><thead><tr><th>Tipo</th><th>Órdenes</th><th>Valor MO</th></tr></thead><tbody>
          ${tiposCliente.map(t => {
            const color = t.tipo==='Aseguradora'?'#2563EB':t.tipo==='Flotilla'?'#7C3AED':'#059669';
            return `<tr>
              <td><span style="font-weight:700;color:${color}">${t.tipo}</span></td>
              <td><span class="badge badge-blue">${t.ordenes}</span></td>
              <td style="font-family:monospace">${fmt(t.valor)}</td>
            </tr>`;
          }).join('')}
        </tbody></table>
      </div>
      ${rankingAseguradoras.length ? `<div>
        <div style="font-size:10px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:.5px;margin-bottom:8px">Top aseguradoras</div>
        ${rankingAseguradoras.slice(0,6).map((a,i) => `
          <div style="display:flex;justify-content:space-between;align-items:center;padding:5px 0;border-bottom:1px solid #f1f5f9;font-size:11px">
            <span style="font-weight:600">${i+1}. ${escapeHtml(a.nombre)}</span>
            <span>${a.ordenes} órd. · <span style="font-family:monospace">${fmt(a.valor)}</span></span>
          </div>`).join('')}
      </div>` : ''}
    </div>
    ${rankingFlotillas.length ? `
    <div style="font-size:10px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:.5px;margin-bottom:8px">Flotillas / Empresas</div>
    <table><thead><tr><th>Empresa / Flotilla</th><th>Órdenes</th><th>Valor MO</th></tr></thead><tbody>
      ${rankingFlotillas.map((f,i) => `<tr>
        <td><span style="font-weight:${i===0?'700':'400'};color:#7C3AED">${escapeHtml(f.nombre)}</span></td>
        <td><span class="badge" style="background:#F3E8FF;color:#7C3AED">${f.ordenes}</span></td>
        <td style="font-family:monospace">${fmt(f.valor)}</td>
      </tr>`).join('')}
    </tbody></table>` : ''}
  </div>` : ''}

  <!-- REPUESTOS — COSTOS Y TIEMPOS -->
  ${topRepuestos.length ? `<div class="section">
    <div class="section-title">Repuestos más solicitados y análisis de espera</div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">
      <div>
        <table><thead><tr><th>Repuesto</th><th>Veces solicitado</th></tr></thead><tbody>
          ${topRepuestos.map((r,i) => `<tr>
            <td>${i===0?`<strong>${r.repuesto}</strong>`:r.repuesto}</td>
            <td><span class="badge badge-blue">${r.veces}</span></td>
          </tr>`).join('')}
        </tbody></table>
      </div>
      <div style="background:#f8fafc;border-radius:8px;padding:14px;border:1px solid #e2e8f0">
        <div style="font-size:11px;font-weight:700;color:#1E3A5F;margin-bottom:10px">Resumen de costos</div>
        <div style="display:grid;gap:8px;font-size:12px">
          <div style="display:flex;justify-content:space-between">
            <span style="color:#64748b">Solicitudes en período</span>
            <strong>${resumen.solicitudesRep}</strong>
          </div>
          <div style="display:flex;justify-content:space-between">
            <span style="color:#64748b">Espera promedio</span>
            <strong>${resumen.tiempoEsperaPromedio > 0 ? resumen.tiempoEsperaPromedio+'min' : '—'}</strong>
          </div>
          ${resumen.totalCostoRep > 0 ? `
          <div style="display:flex;justify-content:space-between;padding-top:8px;border-top:1px solid #e2e8f0">
            <span style="color:#64748b">Costo proveedor</span>
            <strong style="font-family:monospace">${fmt(resumen.totalCostoRep)}</strong>
          </div>
          <div style="display:flex;justify-content:space-between">
            <span style="color:#64748b">Precio venta cliente</span>
            <strong style="font-family:monospace">${fmt(resumen.totalVentaRep)}</strong>
          </div>
          <div style="display:flex;justify-content:space-between">
            <span style="color:#64748b">Margen bruto</span>
            <strong style="color:${resumen.margenRep>=30?'#059669':resumen.margenRep>=15?'#D97706':'#DC2626'}">${resumen.margenRep}%</strong>
          </div>` : '<div style="color:#aaa;font-size:11px;font-style:italic">Sin datos de costos en el período.</div>'}
        </div>
      </div>
    </div>
  </div>` : ''}

  <!-- NOVEDADES -->
  <div class="section">
    <div class="section-title">Novedades y detenciones</div>
    <div class="nov-grid">
      <div class="nov-box" style="background:#fee2e2">
        <div class="nov-val" style="color:#DC2626">${resumen.novPorTipo.Detenido||0}</div>
        <div style="font-size:10px;text-transform:uppercase;letter-spacing:.5px;color:#DC2626">Detenidos</div>
      </div>
      <div class="nov-box" style="background:#fef9c3">
        <div class="nov-val" style="color:#D97706">${resumen.novPorTipo.Reproceso||0}</div>
        <div style="font-size:10px;text-transform:uppercase;letter-spacing:.5px;color:#D97706">Reprocesos</div>
      </div>
      <div class="nov-box" style="background:#dbeafe">
        <div class="nov-val" style="color:#1E40AF">${resumen.novPorTipo.Garantia||0}</div>
        <div style="font-size:10px;text-transform:uppercase;letter-spacing:.5px;color:#1E40AF">Garantías</div>
      </div>
    </div>
    ${novedades.length ? `<table>
      <thead><tr><th>Tipo</th><th>Motivo</th><th>Responsable</th><th>Fecha</th></tr></thead>
      <tbody>
        ${novedades.slice(0,20).map(n => `<tr>
          <td><span class="badge ${n.tipo==='Detenido'?'badge-red':n.tipo==='Reproceso'?'badge-amber':'badge-blue'}">${n.tipo}</span></td>
          <td>${n.motivo||'—'}</td><td>${n.responsable||'—'}</td><td>${fmtHora(n.creado_en)}</td>
        </tr>`).join('')}
        ${novedades.length>20?`<tr><td colspan="4" style="text-align:center;color:#aaa;font-style:italic">... y ${novedades.length-20} más</td></tr>`:''}
      </tbody>
    </table>` : '<div style="color:#aaa;font-style:italic;font-size:12px">Sin novedades en el período.</div>'}
  </div>

  <!-- DETALLE ÓRDENES ENTREGADAS -->
  ${ordenesDetalle.length ? `<div class="section">
    <div class="section-title">Órdenes entregadas — detalle de ciclo</div>
    <table><thead><tr>
      <th>Placa</th><th>Vehículo</th><th>Propietario</th><th>Aseguradora</th>
      <th>Ingreso</th><th>Entrega</th><th>Ciclo</th><th>Vs. prometido</th><th>Novedades</th>
    </tr></thead><tbody>
      ${ordenesDetalle.map(o => {
        const vpColor = o.diasVsPromesa==null?'#aaa':o.diasVsPromesa<=0?'#059669':'#DC2626';
        const vpLabel = o.diasVsPromesa==null?'—':o.diasVsPromesa===0?'A tiempo':o.diasVsPromesa<0?`${Math.abs(o.diasVsPromesa)}d antes`:`${o.diasVsPromesa}d tarde`;
        return `<tr>
          <td><strong style="font-family:monospace">${escapeHtml(o.placa)}</strong></td>
          <td>${escapeHtml(o.vehiculo)}</td><td>${escapeHtml(o.propietario)}</td><td>${escapeHtml(o.aseguradora)}</td>
          <td>${fmtFecha(o.ingreso)}</td><td>${fmtHora(o.entrega)}</td>
          <td>${o.duracionHrs?o.duracionHrs+'h':'—'}</td>
          <td style="color:${vpColor};font-weight:600">${vpLabel}</td>
          <td>${o.novedades>0?`<span class="badge badge-amber">${o.novedades}</span>`:'—'}</td>
        </tr>`;
      }).join('')}
    </tbody></table>
  </div>` : ''}

  <div class="footer">
    ${_RPT_EMPRESA.nombre} · NIT ${_RPT_EMPRESA.nit} · ${_RPT_EMPRESA.direccion} · Tel: ${_RPT_EMPRESA.telefono} ·
    Reporte generado el ${new Date().toLocaleString('es-CO')}
  </div>
</div></body></html>`;

  const win = window.open('', '_blank');
  if (win) { win.document.write(html); win.document.close(); setTimeout(() => win.print(), 800); }
  toast('Reporte PDF generado ✓');
}

// ─── Generador Excel con SheetJS ────────────────────────────
function _generarExcel(d, titulo) {
  if (!window.ExcelJS) { _cargarExcelJS(() => _generarExcel(d, titulo)); return; }
  const { resumen, servicios, tecnicos, cuellos, ordenesDetalle, ordenesIngresadas, novedades,
          topRepuestos, tiposCliente, rankingAseguradoras, rankingFlotillas } = d;
  const fmtFecha = iso => iso ? new Date(iso).toLocaleDateString('es-CO') : '—';

  const wb = new ExcelJS.Workbook();
  wb.creator = 'Freimanautos';
  const hoja = (name, aoa, widths) => {
    const ws = wb.addWorksheet(name);
    if (widths) ws.columns = widths.map(w => ({ width: w }));
    aoa.forEach(r => ws.addRow(r));
    ws.getRow(1).font = { bold: true };
    return ws;
  };

  // Hoja 0: Gráficas (imágenes incrustadas)
  const charts = _chartsReporte(d);
  if (charts.length) {
    const wsG = wb.addWorksheet('Gráficas');
    wsG.getColumn(1).width = 2;
    let row = 1;
    charts.forEach(c => {
      try {
        const imgId = wb.addImage({ base64: c.png.split(',')[1], extension: 'png' });
        wsG.addImage(imgId, { tl: { col: 1, row }, ext: { width: c.w, height: c.h } });
        row += Math.ceil(c.h / 18) + 2;
      } catch (e) { console.warn('[xlsx img]', e); }
    });
  }

  // Hoja 1: Resumen ejecutivo
  hoja('Resumen', [
    ['REPORTE OPERATIVO — FREIMANAUTOS · NIT 800.012.186'],
    [titulo], ['Generado:', new Date().toLocaleString('es-CO')], [],
    ['MÉTRICAS CLAVE', ''],
    ['Órdenes entregadas', resumen.ordenesEntregadas],
    ['Órdenes ingresadas', resumen.ordenesIngresadas],
    ['Etapas completadas', resumen.etapasCompletadas],
    ['Ingresos MO (COP)', resumen.totalIngresos],
    ['Venta repuestos (COP)', resumen.totalVentaRep],
    ['Total facturado MO + repuestos (COP)', resumen.totalIngresos + resumen.totalVentaRep],
    ['Costo repuestos proveedor (COP)', resumen.totalCostoRep],
    ['Margen repuestos (%)', resumen.margenRep],
    ['Horas facturadas total', resumen.totalHorasFacturadas],
    ['Horas adicionales total', resumen.totalHorasAdicionales],
    ['Total minutos pausados (repuestos)', resumen.totalMinutosPausados],
    ['Tiempo promedio ciclo (hrs)', resumen.tiempoPromedioCiclo],
    ['Órdenes a tiempo', resumen.ordenesATiempo],
    ['Órdenes tarde', resumen.ordenesTarde],
    ['Tasa de cumplimiento (%)', resumen.tasaCumplimiento !== null ? resumen.tasaCumplimiento : 'Sin datos'],
    ['Solicitudes de repuesto', resumen.solicitudesRep],
    ['Espera promedio por repuesto (min)', resumen.tiempoEsperaPromedio],
    ['Cotizaciones al cliente', resumen.cotsClienteTotal],
    ['Valor cotizado (COP)', resumen.cotsClienteValor],
    ['Cotizaciones convertidas en orden', resumen.cotsConvertidas],
    ['Valor convertido (COP)', resumen.cotsValorConvertido],
    ['Tasa de conversión cotización→orden (%)', resumen.cotsTasaConversion],
    ['Órdenes que pasaron por pulmón', resumen.ordenesConPulmon],
    ['Tiempo promedio en pulmón (hrs)', resumen.promedioPulmonHrs],
    ['Tiempo máximo en pulmón (hrs)', resumen.maxPulmonHrs],
    ['Actualmente en pulmón', resumen.ordenesEnPulmonAhora],
    ['Distribución pulmón < 1 día', resumen.distPulmon.menos1d],
    ['Distribución pulmón 1–3 días', resumen.distPulmon.uno3d],
    ['Distribución pulmón > 3 días', resumen.distPulmon.mas3d],
    [],
    ['Novedades totales', resumen.novedadesTotal],
    ['— Detenidos', resumen.novPorTipo.Detenido||0],
    ['— Reprocesos', resumen.novPorTipo.Reproceso||0],
    ['— Garantías', resumen.novPorTipo.Garantia||0],
    ['Órdenes con novedades', resumen.ordenesConNovedades],
  ], [38, 22]);

  // Hoja 2: Servicios
  hoja('Por Servicio', [
    ['Servicio','Etapas','Ingresos (COP)','Hrs prom/etapa (neto)','Más lenta (h)','Más rápida (h)','Hrs total neto'],
    ...servicios.map(s => [s.nombre,s.etapas,s.ingresos,s.horasPromedio,s.etapaMasLenta,s.etapaMasRapida,s.horasTotal])
  ], [18,10,18,20,16,16,14]);

  // Hoja 3: Técnicos — con tiempo neto, pausas y calidad
  hoja('Técnicos', [
    ['Técnico','Etapas completadas','T. Neto (h)','T. Bruto (h)','Pausado (min)','T. Estimado (h)','Eficiencia (%)','Prom/etapa (h)','Ingresos (COP)','H. Adicionales','Reprocesos','Garantías','Detenidos','Servicio top'],
    ...tecnicos.map(t => [t.tecnico,t.completadas,t.horasNetas,t.horasBrutas,t.minutosPausados,t.horasEstimadas,t.eficiencia,t.promedioHrEtapa,t.ingresos,t.horasAdicionales,t.reprocesos,t.garantias,t.detenidos,t.servicioTop])
  ], [20,18,12,12,14,14,14,14,18,14,12,10,10,14]);

  // Hoja 4: Cuellos de botella
  hoja('Cuellos de Botella', [
    ['Etapa','Servicio','Veces ejecutada','Hrs promedio (neto)'],
    ...cuellos.map(c => [c.etapa,c.servicio,c.veces,c.horaPromedio])
  ], [24,16,18,18]);

  // Hoja 5: Por tipo de cliente + aseguradoras + flotillas
  hoja('Por Tipo Cliente', [
    ['TIPO DE CLIENTE','Órdenes','Valor MO (COP)'], [],
    ...tiposCliente.map(t => [t.tipo, t.ordenes, t.valor]),
    [],
    ['TASA DE CUMPLIMIENTO', resumen.tasaCumplimiento !== null ? resumen.tasaCumplimiento + '%' : 'Sin datos'],
    ['Órdenes a tiempo', resumen.ordenesATiempo],
    ['Órdenes tarde',    resumen.ordenesTarde],
    [],
    ['RANKING ASEGURADORAS','Órdenes','Valor MO (COP)'], [],
    ...rankingAseguradoras.map(a => [a.nombre, a.ordenes, a.valor]),
    [],
    ['FLOTILLAS / EMPRESAS','Órdenes','Valor MO (COP)'], [],
    ...rankingFlotillas.map(f => [f.nombre, f.ordenes, f.valor])
  ], [28,12,20]);

  // Hoja 6: Repuestos
  hoja('Repuestos', [
    ['REPUESTOS MÁS SOLICITADOS','Veces'], [],
    ...topRepuestos.map(r => [r.repuesto, r.veces]),
    [], ['RESUMEN COSTOS',''],
    ['Solicitudes en período', resumen.solicitudesRep],
    ['Espera promedio (min)', resumen.tiempoEsperaPromedio],
    ['Costo proveedor (COP)', resumen.totalCostoRep],
    ['Precio venta cliente (COP)', resumen.totalVentaRep],
    ['Margen bruto (%)', resumen.margenRep],
  ], [34,20]);

  // Hoja 7: Detalle órdenes
  if (ordenesDetalle.length) hoja('Órdenes Entregadas', [
    ['Placa','Vehículo','Propietario','Aseguradora','Ingreso','Entrega','Ciclo (hrs)','Días vs prometido','Novedades'],
    ...ordenesDetalle.map(o => [o.placa,o.vehiculo,o.propietario,o.aseguradora,fmtFecha(o.ingreso),fmtFecha(o.entrega),o.duracionHrs,o.diasVsPromesa,o.novedades])
  ], [10,18,20,16,12,12,12,16,10]);

  // Hoja 8: Novedades
  if (novedades.length) hoja('Novedades', [
    ['Tipo','Motivo','Responsable','Fecha'],
    ...novedades.map(n => [n.tipo,n.motivo||'—',n.responsable||'—',fmtFecha(n.creado_en)])
  ], [14,40,20,14]);

  // Hoja 9: Órdenes ingresadas
  if (ordenesIngresadas.length) hoja('Órdenes Ingresadas', [
    ['Placa','Vehículo','Propietario','Aseguradora','Tipo cliente','Fecha ingreso','Estado'],
    ...ordenesIngresadas.map(o => [o.placa,[o.marca,o.linea].filter(Boolean).join(' ')||'—',o.propietario||'—',o.aseguradora||'Particular',o.tipo_cliente||'—',fmtFecha(o.creado_en),o.estado||'—'])
  ], [10,18,20,16,14,14,10]);

  const nombre = titulo.replace(/[^a-zA-Z0-9áéíóúÁÉÍÓÚñÑ\s]/g,'').replace(/\s+/g,'_').slice(0,60)+'.xlsx';
  wb.xlsx.writeBuffer().then(buf => {
    const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = nombre;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    toast('Excel generado ✓');
  }).catch(e => { toast('Error generando Excel: ' + e.message, 'err'); console.error(e); });
}
