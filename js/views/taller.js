// ═══════════════════════════════════════════════════════════
// PANTALLA TALLER — Lista TV + panel derecho + audio desbloqueado
// ═══════════════════════════════════════════════════════════

const _tallerOrdenesNotificadas = new Set();
let _tallerGridSnapshot   = new Set();
let _tallerOverlayTimer   = null;
let _tallerAudioDesbloqueado = false;

function montarTaller() {
  const sidebar   = document.getElementById('sidebar');
  const overlay   = document.getElementById('sidebar-overlay');
  const hamburger = document.querySelector('.hamburger');
  const bottomNav = document.getElementById('bottom-nav');
  const topbar    = document.querySelector('.topbar');
  const main      = document.querySelector('.main');
  const content   = document.querySelector('.content');

  if (sidebar)   sidebar.style.display   = 'none';
  if (overlay)   overlay.style.display   = 'none';
  if (hamburger) hamburger.style.display = 'none';
  if (bottomNav) bottomNav.style.display = 'none';
  if (topbar)    topbar.style.display    = 'none';
  if (main)      { main.style.marginLeft = '0'; main.style.height = '100vh'; main.style.overflow = 'hidden'; }
  if (content)   { content.style.padding = '0'; content.style.maxWidth = '100%'; content.style.height = '100%'; }

  document.body.style.background = '#FFFFFF';
  document.body.style.overflow   = 'hidden';
  document.body.style.height     = '100vh';

  if (!document.getElementById('taller-tv-styles')) {
    const st = document.createElement('style');
    st.id = 'taller-tv-styles';
    st.textContent = `
      @keyframes pulse-dot  { 0%,100%{opacity:1} 50%{opacity:.35} }
      @keyframes flash-row  {
        0%,100%{background:transparent}
        30%,70%{background:rgba(245,158,11,.07)}
      }
      @keyframes tv-row-shake {
        0%   { transform:translateX(0)    scale(1);    background:transparent;             box-shadow:none; }
        4%   { transform:translateX(-6px) scale(1.01); background:rgba(245,158,11,.25);    box-shadow:0 0 0 3px #F59E0B; }
        8%   { transform:translateX( 6px) scale(1.01); background:rgba(245,158,11,.30);    box-shadow:0 0 0 3px #F59E0B; }
        12%  { transform:translateX(-5px) scale(1.01); background:rgba(37,99,235,.22);     box-shadow:0 0 0 3px #3B82F6; }
        16%  { transform:translateX( 5px) scale(1.01); background:rgba(37,99,235,.22);     box-shadow:0 0 0 3px #3B82F6; }
        20%  { transform:translateX(-3px) scale(1);    background:rgba(37,99,235,.18);     box-shadow:0 0 0 3px #3B82F6; }
        24%  { transform:translateX( 3px) scale(1);    background:rgba(37,99,235,.18);     box-shadow:0 0 0 3px #3B82F6; }
        30%  { transform:translateX(0)    scale(1);    background:rgba(37,99,235,.14);     box-shadow:0 0 0 2px #3B82F6; }
        55%  { transform:translateX(0)    scale(1);    background:rgba(37,99,235,.08);     box-shadow:0 0 0 1px rgba(59,130,246,.5); }
        100% { transform:translateX(0)    scale(1);    background:transparent;             box-shadow:none; }
      }
      tr.tv-row-alert td:first-child {
        border-left: 4px solid #F59E0B !important;
      }
      .tv-row-alert {
        animation: tv-row-shake 3s cubic-bezier(.36,.07,.19,.97) forwards !important;
        position: relative;
        z-index: 2;
      }
      @keyframes overlay-in {
        from{opacity:0;transform:scale(.95)}
        to{opacity:1;transform:scale(1)}
      }
      @keyframes slide-in-right {
        from{opacity:0;transform:translateX(1vw)}
        to{opacity:1;transform:translateX(0)}
      }
      @keyframes row-slide-in {
        from{opacity:0;transform:translateX(-1.5vw)}
        to{opacity:1;transform:translateX(0)}
      }
      .tv-row-new td { animation:row-slide-in .45s ease forwards; }
      .tv-panel-item-new { animation:slide-in-right .45s ease forwards; }
      #pag-taller {
        background:#FFFFFF;height:100vh;overflow:hidden;
        display:flex;flex-direction:column;font-size:1vw;
      }
      .tv-shell {
        display:flex;flex-direction:column;height:100vh;overflow:hidden;position:relative;
        background:#FFFFFF;
      }

      /* ── PANTALLA DE ACTIVACIÓN ── */
      .tv-activate-screen {
        position:fixed;inset:0;background:#FFFFFF;z-index:100;
        display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2vh;
      }
      .tv-activate-logo {
        width:14vw;opacity:.85;
      }
      .tv-activate-title {
        font-family:'DM Mono',monospace;font-size:1.2vw;color:#9CA3AF;
        letter-spacing:.2em;text-transform:uppercase;
      }
      .tv-activate-btn {
        font-family:'DM Mono',monospace;font-size:1.1vw;font-weight:700;
        letter-spacing:.12em;text-transform:uppercase;
        background:#1E3A5F;color:#FFFFFF;border:none;cursor:pointer;
        padding:1.2vh 3vw;border-radius:.5vw;
        transition:transform .15s,box-shadow .15s;
      }
      .tv-activate-btn:hover {
        transform:scale(1.03);
        box-shadow:0 .4vw 1.5vw rgba(30,58,95,.3);
      }
      .tv-activate-sub {
        font-size:.7vw;color:#9CA3AF;letter-spacing:.1em;text-transform:uppercase;
      }

      /* ── HEADER ── */
      .tv-header {
        background:#FFFFFF;border-bottom:2px solid #D1D5DB;
        padding:0 2vw;height:6vh;flex-shrink:0;
        display:flex;align-items:center;justify-content:space-between;
      }
      .tv-brand { display:flex;align-items:center;gap:.8vw; }
      .tv-brand-dot {
        width:.6vw;height:.6vw;border-radius:50%;background:#22C55E;
        animation:pulse-dot 2s infinite;
      }
      .tv-brand-name {
        font-family:'DM Mono',monospace;font-size:.65vw;
        letter-spacing:.18em;color:#4B5563;text-transform:uppercase;
      }
      .tv-clock {
        font-family:'DM Mono',monospace;font-size:2vw;font-weight:700;
        letter-spacing:.06em;color:#111827;
      }
      .tv-date {
        font-family:'DM Mono',monospace;font-size:.7vw;
        letter-spacing:.08em;color:#374151;text-align:right;text-transform:uppercase;
      }

      /* ── KPI STRIP ── */
      .tv-kpi-strip {
        display:grid;grid-template-columns:repeat(4,1fr);
        border-bottom:2px solid #D1D5DB;flex-shrink:0;
        background:#F8FAFC;
      }
      .tv-kpi {
        padding:.8vh 2vw;border-right:1.5px solid #D1D5DB;
        display:flex;align-items:center;gap:.8vw;
      }
      .tv-kpi:last-child { border-right:none; }
      .tv-kpi-num {
        font-family:'DM Mono',monospace;font-size:3.2vw;font-weight:700;line-height:1;
      }
      .tv-kpi-label {
        font-size:.75vw;font-weight:600;text-transform:uppercase;
        letter-spacing:.09em;color:#6B7280;line-height:1.4;
      }

      /* ── BODY ── */
      .tv-body {
        flex:1;overflow:hidden;display:flex;
      }
      .tv-list-wrap {
        flex:1;overflow:hidden;display:flex;flex-direction:column;
      }
      .tv-table-wrap {
        flex:1;overflow:hidden;
      }
      .tv-table {
        width:100%;border-collapse:collapse;table-layout:fixed;
        border-right:1px solid #D1D5DB;
      }
      .tv-thead th {
        padding:.6vh 1.4vw;font-size:.6vw;font-weight:700;
        letter-spacing:.15em;text-transform:uppercase;
        color:#4B5563;text-align:left;
        background:#F1F5F9;
        border-bottom:2px solid #CBD5E1;
        border-right:1px solid #D1D5DB;
        white-space:nowrap;
      }
      .tv-thead th:last-child { border-right:none; }
      .tv-tbody tr {
        border-bottom:1px solid #E2E8F0;
        transition:background .15s;
      }
      .tv-tbody tr:hover { background:#F8FAFC; }
      .tv-tbody tr.flash { animation:flash-row 1.5s ease-in-out; }
      .tv-tbody td {
        padding:.45vh 1.4vw;vertical-align:middle;
        border-right:1px solid #E9EDF2;
      }
      .tv-tbody td:last-child { border-right:none; }
      .tv-col-placa   { width:18%; }
      .tv-col-etapas  { width:36%; }
      .tv-col-tec     { width:14%; }
      .tv-col-timer   { width:10%; }
      .tv-col-entrega { width:8%; }
      .tv-col-estado  { width:14%; }

      /* ── FRANJA PULMÓN ── */
      .tv-pulmon-strip{flex-shrink:0;background:#F8FAFC;border-top:2px solid #D1D5DB;padding:.4vh 1.5vw;display:flex;align-items:center;gap:1vw;min-height:5.5vh;max-height:7vh;overflow:hidden}
      .tv-pulmon-strip-label{font-family:'DM Mono',monospace;font-size:.55vw;font-weight:700;text-transform:uppercase;letter-spacing:.18em;color:#4B5563;white-space:nowrap;flex-shrink:0}
      .tv-pulmon-cards{display:flex;align-items:center;gap:.6vw;overflow:hidden;flex:1}
      .tv-pulmon-cards-inner{display:flex;align-items:center;gap:.6vw;flex-shrink:0}
      .tv-pulmon-card{display:flex;align-items:center;gap:.4vw;background:#fff;border:1px solid #D1D5DB;border-radius:.4vw;padding:.3vh .7vw;cursor:pointer;transition:background .15s;flex-shrink:0}
      .tv-pulmon-card:hover{background:#F1F5F9}
      .tv-pulmon-info{display:flex;flex-direction:column;gap:.05vh}
      .tv-pulmon-placa{font-family:'DM Mono',monospace;font-size:.85vw;font-weight:700;color:#111827;letter-spacing:.04em;line-height:1}
      .tv-pulmon-veh{font-size:.5vw;color:#6B7280;line-height:1}
      .tv-pulmon-meta{display:flex;flex-direction:column;align-items:flex-end;gap:.05vh;margin-left:.3vw}
      .tv-pulmon-tipo{font-size:.48vw;color:#6B7280;font-weight:600;text-transform:uppercase;letter-spacing:.05em}
      .tv-pulmon-dias{font-family:'DM Mono',monospace;font-size:.7vw;font-weight:700;color:#374151}

      .tv-placa {
        font-family:'DM Mono',monospace;font-size:1.35vw;font-weight:700;
        color:#111827;letter-spacing:.04em;line-height:1;
      }
      .tv-vehiculo { font-size:.55vw;color:#374151;margin-top:.1vh; }
      .tv-propietario { font-size:.62vw;font-weight:600;color:#111827;margin-top:.2vh;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:16vw; }

      /* ── CHIPS DE ETAPA ── */
      .etapas-chips { display:flex;flex-wrap:wrap;gap:.3vw;align-items:center; }
      .chip {
        display:inline-flex;align-items:center;gap:.25vw;
        padding:.2vh .5vw;border-radius:.3vw;
        font-size:.62vw;font-weight:700;white-space:nowrap;border:1px solid transparent;
      }
      .chip-approved  { background:#DCFCE7;color:#15803D;border-color:#86EFAC; } /* verde = calidad aprobada */
      .chip-done      { background:#CCFBF1;color:#0D9488;border-color:#5EEAD4; } /* teal = terminado, espera calidad */
      .chip-reproceso { background:#FEE2E2;color:#DC2626;border-color:#FCA5A5; } /* rojo = reproceso */
      .chip-active    { background:#DBEAFE;color:#1D4ED8;border-color:#93C5FD; } /* azul = en curso AHORA */
      .chip-waiting   { background:#FEF3C7;color:#B45309;border-color:#FCD34D; } /* ambar = por iniciar */
      .chip-pending   { background:#F3F4F6;color:#6B7280;border-color:#E5E7EB; } /* gris = sin empezar */
      .chip-dot { width:.45vw;height:.45vw;border-radius:50%;flex-shrink:0; }
      .chip-dot.approved  { background:#16A34A; }
      .chip-dot.done      { background:#14B8A6; }
      .chip-dot.reproceso { background:#EF4444; }
      .chip-dot.active    { background:#2563EB; }
      .chip-dot.waiting   { background:transparent;border:.8px solid #F59E0B; }
      .chip-dot.pending   { background:transparent;border:.8px solid #D1D5DB; }

      .tv-tec { font-size:.75vw;color:#374151; }
      .tv-timer-val {
        font-family:'DM Mono',monospace;font-size:.85vw;font-weight:700;color:#B45309;
      }
      .tv-entrega-chip { font-family:'DM Mono',monospace;font-size:.75vw;font-weight:700; }

      .tv-badge {
        font-family:'DM Mono',monospace;font-size:.6vw;font-weight:700;
        padding:.25vh .6vw;border-radius:.3vw;
        text-transform:uppercase;letter-spacing:.07em;border:1px solid;white-space:nowrap;
      }
      .tv-badge-blue   { background:#DBEAFE;color:#1E40AF;border-color:#BFDBFE; }
      .tv-badge-amber  { background:#FEF3C7;color:#B45309;border-color:#FDE68A; }
      .tv-badge-red    { background:#FEE2E2;color:#DC2626;border-color:#FECACA; }
      .tv-badge-gray   { background:#F9FAFB;color:#6B7280;border-color:#E5E7EB; }

      /* ── PANEL DERECHO ── */
      .tv-panel-right {
        width:17vw;flex-shrink:0;
        border-left:2px solid #D1D5DB;
        display:flex;flex-direction:column;overflow:hidden;
        background:#F8FAFC;
      }
      .tv-panel-title {
        font-family:'DM Mono',monospace;font-size:.6vw;font-weight:700;
        letter-spacing:.18em;text-transform:uppercase;
        color:#4B5563;
        padding:.7vh 1.2vw;border-bottom:1.5px solid #D1D5DB;flex-shrink:0;
      }
      .tv-panel-list {
        flex:1;overflow-y:auto;padding:.4vh .5vw;
        display:flex;flex-direction:column;gap:.35vh;
        scrollbar-width:none;
      }
      .tv-panel-list::-webkit-scrollbar { display:none; }
      #tv-section-listos { flex:0 0 auto; max-height:35vh; }
      #tv-section-listos .tv-panel-list { flex:1; }
      .tv-panel-item {
        border-radius:.4vw;padding:.55vh .8vw;
        display:flex;align-items:center;gap:.6vw;
        animation:slide-in-right .4s ease;flex-shrink:0;cursor:pointer;
      }
      .tv-panel-item.listo {
        background:#FFFBEB;border:1.5px solid #F59E0B;
      }
      .tv-panel-item.entregado {
        background:#F0FDF4;border:1.5px solid #4ADE80;
      }
      .tv-panel-dot { width:.5vw;height:.5vw;border-radius:50%;flex-shrink:0; }
      .tv-panel-dot.listo    { background:#F59E0B; }
      .tv-panel-dot.entregado{ background:#22C55E; }
      .tv-panel-info { flex:1;min-width:0; }
      .tv-panel-placa {
        font-family:'DM Mono',monospace;font-size:.95vw;font-weight:700;
        color:#111827;letter-spacing:.04em;line-height:1;
      }
      .tv-panel-status {
        font-size:.6vw;font-weight:500;margin-top:.15vh;
        white-space:nowrap;overflow:hidden;text-overflow:ellipsis;
      }
      .tv-panel-status.listo    { color:#D97706; }
      .tv-panel-status.entregado{ color:#16A34A; }
      .tv-panel-time {
        font-family:'DM Mono',monospace;font-size:.6vw;color:#9CA3AF;
      }
      .tv-panel-empty {
        font-size:.7vw;color:#9CA3AF;
        font-style:italic;padding:1vh 0;text-align:center;
      }

      /* ── PANEL PROGRAMADAS ── */
      .tv-panel-section {
        display:flex;flex-direction:column;flex:1;overflow:hidden;min-height:0;
      }
      .tv-panel-divider {
        border-top:1.5px solid #D1D5DB;flex-shrink:0;
      }
      .tv-prog-item {
        display:flex;align-items:center;gap:.6vw;
        padding:.45vh .8vw;border-radius:.4vw;
        background:#EEF2FF;border:1px solid #C7D2FE;
        flex-shrink:0;cursor:default;
      }
      .tv-prog-dot {
        width:.45vw;height:.45vw;border-radius:50%;background:#6366F1;flex-shrink:0;
      }
      .tv-prog-placa {
        font-family:'DM Mono',monospace;font-size:.85vw;font-weight:700;
        color:#4338CA;letter-spacing:.04em;line-height:1;flex:1;min-width:0;
      }
      .tv-prog-fecha {
        font-family:'DM Mono',monospace;font-size:.55vw;color:#6B7280;
        flex-shrink:0;
      }
      .tv-prog-ot {
        font-family:'DM Mono',monospace;font-size:.5vw;color:#9CA3AF;
        margin-top:.1vh;
      }

      /* ── OVERLAY ── */
      .tv-update-overlay {
        position:absolute;inset:0;background:rgba(15,23,42,.65);
        z-index:30;display:flex;align-items:center;justify-content:center;padding:2vw;
      }
      .tv-overlay-card {
        background:#FFFFFF;border:0.2vw solid #F59E0B;border-radius:.8vw;
        width:26vw;overflow:hidden;animation:overlay-in .3s ease;
        box-shadow:0 2vw 4vw rgba(0,0,0,.25);
      }
      .tv-overlay-card.green-border { border-color:#22C55E; }
      .tv-overlay-badge {
        background:#F59E0B;color:#FFFFFF;
        font-family:'DM Mono',monospace;font-size:.7vw;font-weight:700;
        letter-spacing:.18em;text-transform:uppercase;
        padding:.6vh 1.5vw;text-align:center;
      }
      .tv-overlay-badge.green-bg { background:#22C55E; }
      .tv-overlay-head {
        padding:1.2vh 1.5vw .8vh;border-bottom:1px solid rgba(0,0,0,.08);
      }
      .tv-overlay-placa {
        font-family:'DM Mono',monospace;font-size:2.5vw;font-weight:700;
        color:#111827;letter-spacing:.04em;line-height:1;
      }
      .tv-overlay-veh { font-size:.8vw;color:#9CA3AF;margin-top:.3vh; }
      .tv-overlay-body { padding:.8vh 1.5vw; }
      .tv-overlay-row {
        display:flex;align-items:center;gap:.7vw;padding:.5vh 0;
        border-bottom:1px solid rgba(0,0,0,.06);
      }
      .tv-overlay-row:last-child { border-bottom:none; }
      .tv-odot        { width:.7vw;height:.7vw;border-radius:50%;flex-shrink:0; }
      .tv-odot.approved{ background:#16A34A; }
      .tv-odot.done   { background:#4ADE80;border:1px solid #16A34A; }
      .tv-odot.active { background:#F59E0B; }
      .tv-odot.pending{ background:transparent;border:1px solid #D1D5DB; }
      .tv-oname       { font-size:.9vw;flex:1; }
      .tv-oname.approved{ color:#15803D;font-weight:700; }
      .tv-oname.done  { color:#16A34A; }
      .tv-oname.active{ color:#B45309;font-weight:700; }
      .tv-oname.pending{ color:#D1D5DB; }
      .tv-otime       { font-family:'DM Mono',monospace;font-size:.8vw;font-weight:700; }
      .tv-otime.approved{ color:#15803D; }
      .tv-otime.active{ color:#B45309; }
      .tv-otime.done  { color:#16A34A; }
      .tv-overlay-foot {
        padding:.8vh 1.5vw;border-top:1px solid rgba(0,0,0,.07);
        display:flex;justify-content:space-between;align-items:center;
      }
      .tv-overlay-tec { font-size:.8vw;color:#6B7280; }
      .tv-overlay-entrega { font-size:.8vw;font-weight:700; }
      .tv-overlay-countdown {
        font-family:'DM Mono',monospace;font-size:.6vw;
        color:#9CA3AF;text-align:center;
        padding:.5vh;border-top:1px solid rgba(0,0,0,.06);
      }
      .tv-watermark {
        position:fixed;top:50%;left:50%;
        transform:translate(-50%,-50%);
        width:34vw;height:34vw;pointer-events:none;z-index:0;
      }

      /* ── MÓVIL ── */
      @media (max-width: 768px) {
        .tv-activate-logo { width:40vw !important; }
        .tv-activate-title { font-size:4.5vw !important; letter-spacing:.08em !important; }
        .tv-activate-btn { font-size:4.5vw !important; padding:2.5vh 8vw !important; border-radius:2vw !important; }
        .tv-activate-sub { font-size:3vw !important; }
        .tv-header { height:auto !important; padding:1.5vh 4vw !important; }
        .tv-clock { font-size:9vw !important; }
        .tv-date { font-size:3vw !important; }
        .tv-brand-name { font-size:2.8vw !important; letter-spacing:.1em !important; }
        .tv-brand-dot { width:2vw !important; height:2vw !important; }
        .tv-kpi-strip { grid-template-columns:repeat(2,1fr) !important; }
        .tv-kpi { padding:1.5vh 4vw !important; gap:2.5vw !important; border-right:none !important; border-bottom:1px solid rgba(0,0,0,.07); }
        .tv-kpi:nth-child(1),.tv-kpi:nth-child(3) { border-right:1px solid rgba(0,0,0,.07) !important; }
        .tv-kpi-num { font-size:10vw !important; }
        .tv-kpi-label { font-size:2.8vw !important; }
        .tv-panel-right { display:none !important; }
        .tv-thead th:nth-child(3),.tv-thead th:nth-child(4),
        .tv-tbody tr td:nth-child(3),.tv-tbody tr td:nth-child(4) { display:none !important; }
        .tv-col-placa  { width:22% !important; }
        .tv-col-etapas { width:52% !important; }
        .tv-col-entrega{ width:12% !important; }
        .tv-col-estado { width:14% !important; }
        .tv-thead th { font-size:2.5vw !important; padding:.5vh 1.5vw !important; }
        .tv-tbody td  { padding:1vh 1.5vw !important; }
        .tv-placa  { font-size:3.8vw !important; letter-spacing:.02em !important; }
        .tv-propietario { font-size:2.2vw !important; max-width:20vw !important; }
        .tv-vehiculo { font-size:2.2vw !important; }
        .chip { font-size:2.5vw !important; padding:.3vh 1vw !important; border-radius:.5vw !important; gap:.4vw !important; }
        .chip-dot { width:1.5vw !important; height:1.5vw !important; }
        .tv-entrega-chip { font-size:2.8vw !important; }
        .tv-badge { font-size:2.5vw !important; padding:.3vh 1vw !important; border-radius:.5vw !important; }
        .tv-watermark { width:70vw !important; height:70vw !important; }
      }

      /* ── Animaciones tipo tablero de aeropuerto (fondo blanco) ── */
      @keyframes tv-flip       { 0%{transform:perspective(20vw) rotateX(-90deg);opacity:.15} 100%{transform:perspective(20vw) rotateX(0);opacity:1} }
      @keyframes tv-chip-sweep { 0%{transform:translateX(-130%)} 100%{transform:translateX(430%)} }
      @keyframes tv-timer-pulse{ 0%,100%{opacity:1} 50%{opacity:.68} }

      /* Reloj split-flap: cada dígito "voltea" al cambiar */
      .tv-clock { display:flex;align-items:center;gap:.22vw;font-size:1.6vw; }
      .tv-flap  { display:inline-block;background:#1E3A5F;color:#fff;font-family:'DM Mono',monospace;
                  font-weight:700;font-size:inherit;line-height:1;padding:.5vh .55vw;border-radius:.35vw;
                  min-width:1.3vw;text-align:center; }
      .tv-flap.flip { animation:tv-flip .4s ease; }
      .tv-sep   { color:#1E3A5F;font-weight:700;font-size:inherit;padding:0 .08vw; }

      /* Etapa activa: destello que la recorre + punto que late */
      .chip-active     { position:relative;overflow:hidden; }
      .chip-active::after { content:"";position:absolute;top:0;left:0;width:35%;height:100%;
                            background:rgba(255,255,255,.55);animation:tv-chip-sweep 1.9s linear infinite;pointer-events:none; }
      .chip-dot.active { animation:pulse-dot 1.1s ease-in-out infinite; }

      /* Cronómetro activo: latido sutil */
      .tv-timer-val { animation:tv-timer-pulse 2.2s ease-in-out infinite; }

      /* Mismo efecto de la etapa activa aplicado al RESTO del tablero:
         destello que recorre estado / Listos hoy / Programadas, y puntos que laten. */
      .tv-badge, .tv-panel-item, .tv-prog-item { position:relative; overflow:hidden; }
      .tv-badge::after, .tv-panel-item::after, .tv-prog-item::after {
        content:""; position:absolute; top:0; left:0; width:30%; height:100%;
        background:rgba(255,255,255,.45); animation:tv-chip-sweep 3s linear infinite; pointer-events:none;
      }
      .tv-panel-dot, .tv-prog-dot { animation:pulse-dot 1.3s ease-in-out infinite; }
      .tv-entrega-chip { animation:tv-timer-pulse 2.4s ease-in-out infinite; }

      /* Placa en recuadro NAVY (texto blanco) con destello */
      .tv-placa-box {
        display:inline-flex;align-items:baseline;gap:.45vw;
        background:#1E3A5F;border-radius:.4vw;padding:.5vh .75vw;
        position:relative;overflow:hidden;
      }
      .tv-placa-box .tv-placa { color:#FFFFFF; }
      .tv-placa-ot { font-family:'DM Mono',monospace;font-size:.7vw;font-weight:700;color:#93C5FD;letter-spacing:.04em; }
      .tv-placa-box::after {
        content:"";position:absolute;top:0;left:0;width:30%;height:100%;
        background:rgba(255,255,255,.35);animation:tv-chip-sweep 3.2s linear infinite;pointer-events:none;
      }

      /* Técnico en recuadro PÚRPURA con destello (vacío = gris tenue, sin brillo) */
      .tv-tec-box {
        display:inline-flex;align-items:center;max-width:100%;
        background:#F3E8FF;border:1px solid #E9D5FF;color:#6B21A8;
        border-radius:.4vw;padding:.35vh .65vw;font-size:.72vw;font-weight:600;
        white-space:nowrap;overflow:hidden;text-overflow:ellipsis;position:relative;
      }
      .tv-tec-box.empty { background:#F8FAFC;border-color:#E2E8F0;color:#94A3B8;font-weight:400; }
      .tv-tec-box:not(.empty)::after {
        content:"";position:absolute;top:0;left:0;width:30%;height:100%;
        background:rgba(255,255,255,.55);animation:tv-chip-sweep 3.2s linear infinite;pointer-events:none;
      }

      /* ONDA UNIFORME: destello lento que recorre fila 1, luego fila 2, etc.
         (mismo ritmo en todos los recuadros + retardo escalonado por fila). */
      .chip-active::after,
      .tv-badge::after,
      .tv-placa-box::after,
      .tv-tec-box:not(.empty)::after {
        animation-duration: 6s;
        animation-delay: calc(var(--row-i, 0) * .5s);
      }
      /* Paneles (Listos hoy / Programadas): mismo ritmo lento, escalonados por item. */
      .tv-panel-item::after, .tv-prog-item::after {
        animation-duration: 6s;
        animation-delay: calc(var(--row-i, 0) * .5s);
      }
    `;
    document.head.appendChild(st);
  }

  const pagTaller = document.getElementById('pag-taller');
  if (pagTaller) pagTaller.style.cssText = 'display:flex;flex-direction:column;height:100vh;overflow:hidden;background:#FFFFFF';

  mostrarPagina('pag-taller');
  _mostrarPantallaActivacion();
}

// ── Pantalla de activación de audio ─────────────────────────
function _mostrarPantallaActivacion() {
  const cont = document.getElementById('taller-contenido');
  if (!cont) return;

  cont.innerHTML = `
    <div class="tv-activate-screen" id="tv-activate-screen">
      <img src="assets/icons/Icono_Redondo_Fondo_Taller.png" class="tv-activate-logo" alt="">
      <div class="tv-activate-title">Freimanautos · Sistema Operativo</div>
      <button class="tv-activate-btn" onclick="_activarPantallaTaller()">
        ▶ &nbsp; Iniciar pantalla del taller
      </button>
      <button class="tv-activate-btn" style="background:#374151;font-size:.75vw;padding:.8vh 2vw;margin-top:.5vh" onclick="_testVozTV()">
        🔊 &nbsp; Probar voz
      </button>
      <div id="tv-voz-status" style="font-size:.65vw;color:#9CA3AF;margin-top:.5vh"></div>
      <div class="tv-activate-sub">Presiona una vez para activar el audio y comenzar</div>
      <button onclick="logout()" style="margin-top:18px;background:none;border:1px solid #4B5563;color:#9CA3AF;font-size:13px;padding:8px 18px;border-radius:8px;cursor:pointer">
        ← Salir / cambiar de perfil
      </button>
    </div>`;
}

async function _activarPantallaTaller() {
  // Desbloquear audio con interacción del usuario
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    await ctx.resume();
    window._tvAudioCtx = ctx;
    _tallerAudioDesbloqueado = true;
  } catch(e) { console.warn('AudioContext:', e); }

  // También pre-cargar el archivo mp3
  try {
    const audio = new Audio('assets/audio/motor.mp3');
    await audio.play().catch(()=>{});
    audio.pause();
    audio.currentTime = 0;
    window._tvAudio = audio;
  } catch(e) { console.warn('Audio preload:', e); }

  // Quitar pantalla de activación y arrancar
  const screen = document.getElementById('tv-activate-screen');
  if (screen) screen.remove();

  // Resetear estado de scroll de paneles para evitar pausado:true heredado
  window._tvPanelScroll = {
    listos:      { dir: 1, pausado: false },
    programadas: { dir: 1, pausado: false }
  };

  cargarPantallaTaller();
  iniciarRelojTaller();
  setInterval(() => { if (sesion?.perfil === 'taller') cargarPantallaTaller(); }, 10000);
}

function _tvSonar() {
  try {
    if (window._tvAudio) {
      window._tvAudio.currentTime = 0;
      window._tvAudio.play().catch(()=>{});
      return;
    }
    const audio = new Audio('assets/audio/motor.mp3');
    audio.play().catch(()=>{});
  } catch(e) { console.warn('Sound error:', e); }
}

// ── Test de voz desde pantalla de activación ─────────────
function _testVozTV() {
  const status = document.getElementById('tv-voz-status');
  if (status) status.textContent = 'Reproduciendo prueba...';
  // Usa exactamente la misma función que el anuncio real
  _tvAnunciarPlaca({ placa: 'ABC123' });
  setTimeout(() => { if (status) status.textContent = ''; }, 8000);
}

// ── Anuncio de voz ───────────────────────────────────────
// Voz masculina grave consistente en PC y Google TV.
// Primario: StreamElements Enrique (Audio element, igual que motor.mp3)
// Respaldo: Web Speech API si el audio falla
function _tvAnunciarPlaca(orden) {
  const placa = (orden.placa || '').toUpperCase();
  const placaLetra = placa.split('').join(' ');
  const msg = `Atención. Vehículo con placa ${placaLetra} listo para entrega al cliente.`;
  setTimeout(() => _tvTTSAudio(msg), 800);
}

// ── TTS masculino via Web Speech API ─────────────────────
// Nombres de voces masculinas españolas según navegador/OS
const _TTS_VOCES_MASC = [
  'Microsoft Pablo',        // Windows Chrome/Edge — es-ES masculino
  'Microsoft Raul',         // Windows antiguo
  'Diego',                  // macOS — es-AR masculino
  'Andrés',                 // macOS — es-CL masculino
  'Jorge',                  // macOS — es-ES masculino
  'Carlos',                 // macOS — es-MX
  'Google español de Estados Unidos', // Chrome — a veces masculino
  'Enrique',                // si está disponible en el sistema
  'Pablo',
  'Juan',
  'Miguel',
];

function _tvTTSAudio(texto) {
  if (!window.speechSynthesis) return;

  const _hablar = () => {
    const voces = window.speechSynthesis.getVoices();
    const u = new SpeechSynthesisUtterance(texto);
    u.lang   = 'es';
    u.rate   = 0.80;
    u.volume = 1;

    // Buscar voz masculina por nombre
    const vozMasc = voces.find(v =>
      _TTS_VOCES_MASC.some(n => v.name.toLowerCase().startsWith(n.toLowerCase()))
    ) || voces.find(v =>
      v.lang.startsWith('es') && /male|masc/i.test(v.name)
    );

    if (vozMasc) {
      u.voice = vozMasc;
      u.pitch = 0.7;
    } else {
      // No hay voz masculina instalada → pitch mínimo para sonar lo más grave posible
      u.pitch = 0.0;
    }

    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(u);
  };

  // Las voces pueden no estar cargadas aún al primer uso
  const voces = window.speechSynthesis.getVoices();
  if (voces.length > 0) {
    _hablar();
  } else {
    window.speechSynthesis.addEventListener('voiceschanged', _hablar, { once: true });
  }
}

function iniciarRelojTaller() {
  // Evitar relojes duplicados (causaban "doble tic" si se montaba dos veces).
  if (window._tallerRelojInterval) clearInterval(window._tallerRelojInterval);
  let prev = [];
  function tick() {
    const reloj = document.getElementById('taller-reloj');
    const fecha = document.getElementById('taller-fecha');
    const now   = new Date();
    if (reloj) {
      const chars = now.toLocaleTimeString('es-CO', { hour:'2-digit', minute:'2-digit', second:'2-digit', hour12:false }).split('');
      if (reloj.children.length !== chars.length) {
        // Construir las fichas UNA sola vez
        reloj.innerHTML = chars.map(ch => ch === ':' ? `<span class="tv-sep">:</span>` : `<span class="tv-flap">${ch}</span>`).join('');
        prev = chars.slice();
      } else {
        // Solo actualizar (y voltear) los dígitos que cambiaron → sin repintar todo
        chars.forEach((ch, i) => {
          if (ch === ':' || prev[i] === ch) return;
          const el = reloj.children[i];
          if (el) { el.textContent = ch; el.classList.remove('flip'); void el.offsetWidth; el.classList.add('flip'); }
        });
        prev = chars;
      }
    }
    if (fecha) fecha.innerHTML = now.toLocaleDateString('es-CO', { weekday:'long', day:'2-digit', month:'long', year:'numeric' }).toUpperCase();
  }
  tick();
  window._tallerRelojInterval = setInterval(tick, 1000);
}

function _tvTimerStr(etapaOinicio) {
  const inicioISO = typeof etapaOinicio === 'string' ? etapaOinicio : etapaOinicio?.inicio;
  if (!inicioISO) return '';
  let secs = Math.floor((Date.now() - new Date(inicioISO)) / 1000);
  // Descontar tiempo en pausa acumulado
  if (typeof etapaOinicio === 'object' && etapaOinicio) {
    secs -= (etapaOinicio.tiempo_pausado_min || 0) * 60;
    if (etapaOinicio.pausado && etapaOinicio.pausa_inicio) {
      secs -= Math.floor((Date.now() - new Date(etapaOinicio.pausa_inicio)) / 1000);
    }
  }
  secs = Math.max(0, secs);
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  const pad = n => String(n).padStart(2,'0');
  return pad(h)+':'+pad(m)+':'+pad(s);
}

function _tvHoraStr(isoStr) {
  if (!isoStr) return '';
  return new Date(isoStr).toLocaleTimeString('es-CO', { hour:'2-digit', minute:'2-digit', hour12:false });
}

// Texto corto de la cuenta regresiva de la cita de recogida (para la pantalla TV).
function _tvCitaTxt(orden) {
  if (!orden || !orden.cita_entrega || typeof _citaInfo !== 'function') return '';
  const ci = _citaInfo(orden.cita_entrega);
  if (!ci) return '';
  return ci.vencida ? `⏰ ${ci.texto}` : `🚗 ${ci.texto}`;
}

// Render unificado de un item del panel "Terminados / Listos" (evita 3 copias).
function _tvPanelItem(orden, tipo) {
  const hora = tipo === 'entregado' ? _tvHoraStr(orden.entregada_en) : '';
  const statusTxt = tipo === 'listo' ? 'Listo para entrega' : '✓ Entregado';
  const cita = tipo === 'listo' ? _tvCitaTxt(orden) : '';
  return `<div class="tv-panel-item ${tipo}" data-orden-id="${orden.id}" onclick="_tvVerDetalle(${orden.id})">
    <div class="tv-panel-dot ${tipo}"></div>
    <div class="tv-panel-info">
      <div class="tv-panel-placa">${orden.placa}</div>
      <div class="tv-panel-status ${tipo}">${statusTxt}</div>
      ${cita ? `<div class="tv-panel-status ${tipo}" style="color:${cita.startsWith('⏰')?'#DC2626':'#059669'};font-weight:700">${cita}</div>` : ''}
    </div>
    ${hora ? `<div class="tv-panel-time">${hora}</div>` : ''}
  </div>`;
}

function _tvEntregaInfo(orden) {
  if (!orden.fecha_entrega_1) return { color:'#9CA3AF', label:'Sin fecha', hora:null };
  const f    = new Date(orden.fecha_entrega_1);
  const fDia = new Date(f); fDia.setHours(0,0,0,0);
  const hoy  = new Date(); hoy.setHours(0,0,0,0);
  const dias = Math.round((fDia - hoy) / 86400000);
  const tieneHora = f.getHours() !== 0 || f.getMinutes() !== 0;
  const hora = tieneHora ? f.toLocaleTimeString('es-CO',{hour:'2-digit',minute:'2-digit',hour12:false}) : null;
  if (dias < 0)   return { color:'#DC2626', label:`${Math.abs(dias)}d vencida`, hora };
  if (dias === 0) return { color:'#D97706', label:'Hoy', hora };
  if (dias <= 2)  return { color:'#D97706', label:`${dias}d`, hora };
  return { color:'#16A34A', label:`${dias}d`, hora };
}

function _tvMostrarOverlay(orden, etapasOrden, badge, esVerde, aprobadas) {
  if (_tallerOverlayTimer) clearInterval(_tallerOverlayTimer);
  const { color: entColor, label: entLabel } = _tvEntregaInfo(orden);
  const tecnico = etapasOrden.find(e => e.inicio && !e.fin)?.tecnico
    || etapasOrden.filter(e => e.tecnico).slice(-1)[0]?.tecnico || '';

  const etapasHtml = etapasOrden.map(e => {
    const isApproved = !!e.fin && aprobadas?.has(e.id);
    const cls = isApproved ? 'approved' : e.fin ? 'done' : (e.inicio && !e.fin ? 'active' : 'pending');
    const tiempo = cls === 'active' ? _tvTimerStr(e.inicio) : (isApproved ? '✓✓' : e.fin ? '✓' : '');
    return `<div class="tv-overlay-row">
      <div class="tv-odot ${cls}"></div>
      <span class="tv-oname ${cls}">${e.etapa||'—'}</span>
      <span class="tv-otime ${cls}">${tiempo}</span>
    </div>`;
  }).join('');

  const overlayHtml = `
    <div class="tv-update-overlay" id="tv-overlay" onclick="this.remove()">
      <div class="tv-overlay-card${esVerde?' green-border':''}" onclick="event.stopPropagation()">
        <div class="tv-overlay-badge${esVerde?' green-bg':''}">${badge}</div>
        <div class="tv-overlay-head">
          <div class="tv-overlay-placa">${orden.placa}</div>
          <div style="font-family:'DM Mono',monospace;font-size:.7vw;font-weight:600;color:#9CA3AF;letter-spacing:.08em;margin-top:.2vh">${otDe(orden)}</div>
          <div class="tv-overlay-veh">${[orden.marca,orden.linea].filter(Boolean).join(' ')||'—'}</div>
        </div>
        <div class="tv-overlay-body">${etapasHtml}</div>
        <div class="tv-overlay-foot">
          <span class="tv-overlay-tec">${tecnico||'—'}</span>
          <span class="tv-overlay-entrega" style="color:${esVerde?'#4ADE80':entColor}">${esVerde?'✓ Listo para entrega':entLabel}</span>
        </div>
        <div class="tv-overlay-countdown" id="tv-overlay-cd">Cerrando en 5s — toca para cerrar</div>
      </div>
    </div>`;

  const shell = document.querySelector('.tv-shell');
  if (!shell) return;
  const existing = document.getElementById('tv-overlay');
  if (existing) existing.remove();
  shell.insertAdjacentHTML('beforeend', overlayHtml);

  let countdown = 5;
  _tallerOverlayTimer = setInterval(() => {
    countdown--;
    const cd = document.getElementById('tv-overlay-cd');
    if (cd) cd.textContent = `Cerrando en ${countdown}s — toca para cerrar`;
    if (countdown <= 0) {
      clearInterval(_tallerOverlayTimer);
      const ov = document.getElementById('tv-overlay');
      if (ov) ov.remove();
    }
  }, 1000);
}

// ── Autoscroll perpetuo — se inicia UNA sola vez ─────────
window._tvScrollDir      = window._tvScrollDir ?? 1;
window._tvScrollPausado  = false;
window._tvScrollRunning  = false;

// Estado independiente para cada panel lateral
window._tvPanelScroll = window._tvPanelScroll ?? {
  listos:      { dir: 1, pausado: false },
  programadas: { dir: 1, pausado: false }
};

function _scrollPanel(id, state, pxPerSec, pauseMs) {
  const el = document.getElementById(id);
  if (!el || state.pausado) return;
  const max = el.scrollHeight - el.clientHeight;
  if (max <= 5) return;
  el.scrollTop += state.dir * pxPerSec;
  if (state.dir === 1 && el.scrollTop >= max - 1) {
    el.scrollTop = max; state.dir = -1; state.pausado = true;
    setTimeout(() => { state.pausado = false; }, pauseMs);
  } else if (state.dir === -1 && el.scrollTop <= 1) {
    el.scrollTop = 0; state.dir = 1; state.pausado = true;
    setTimeout(() => { state.pausado = false; }, pauseMs);
  }
}

// ── Scroll bounce automático para la franja pulmón ──────────
function _iniciarScrollPulmon() {
  if (window._pulmonScrollRunning) return;
  window._pulmonScrollRunning = true;
  const SPEED = 0.5; // px por frame — lento
  let pos = 0;
  let dir = 1;
  function tick() {
    const wrap  = document.getElementById('tv-pulmon-cards');
    const inner = document.getElementById('tv-pulmon-cards-inner');
    if (!wrap || !inner) { window._pulmonScrollRunning = false; return; }
    const maxMove = Math.max(0, inner.offsetWidth - wrap.offsetWidth);
    if (maxMove <= 0) {
      inner.style.transform = 'translateX(0)';
      requestAnimationFrame(tick);
      return;
    }
    pos += SPEED * dir;
    if (pos >= maxMove) { pos = maxMove; dir = -1; }
    if (pos <= 0)       { pos = 0;       dir =  1; }
    inner.style.transform = `translateX(${-pos}px)`;
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}

function _iniciarScrollTaller() {
  if (window._tvScrollRunning) return;
  window._tvScrollRunning = true;

  const PX_PER_SEC = 35;
  const PAUSE_TOP  = 4000;
  const PAUSE_BOT  = 3000;
  let lastTime = null;

  const step = (ts) => {
    if (!document.getElementById('taller-contenido') ||
        document.getElementById('tv-activate-screen')) {
      window._tvScrollRunning = false;
      return;
    }

    // ── Panel listos y programadas (scroll independiente, más lento) ──
    _scrollPanel('tv-panel-listos',      window._tvPanelScroll.listos,      0.8, 3000);
    _scrollPanel('tv-panel-programadas', window._tvPanelScroll.programadas, 0.8, 3000);

    // ── Tabla principal ──
    if (!window._tvScrollPausado) {
      const tw = document.querySelector('.tv-table-wrap');
      if (tw) {
        const maxScroll = tw.scrollHeight - tw.clientHeight;
        if (maxScroll > 20) {
          if (lastTime === null) lastTime = ts;
          const delta = Math.min((ts - lastTime) / 1000, 0.1);
          lastTime = ts;
          tw.scrollTop += window._tvScrollDir * PX_PER_SEC * delta;
          if (window._tvScrollDir === 1 && tw.scrollTop >= maxScroll - 2) {
            tw.scrollTop = maxScroll; lastTime = null;
            window._tvScrollDir = -1; window._tvScrollPausado = true;
            setTimeout(() => { window._tvScrollPausado = false; }, PAUSE_BOT);
          } else if (window._tvScrollDir === -1 && tw.scrollTop <= 2) {
            tw.scrollTop = 0; lastTime = null;
            window._tvScrollDir = 1; window._tvScrollPausado = true;
            setTimeout(() => { window._tvScrollPausado = false; }, PAUSE_TOP);
          }
        } else { lastTime = null; }
      }
    } else { lastTime = null; }

    requestAnimationFrame(step);
  };

  window._tvScrollPausado = true;
  setTimeout(() => { window._tvScrollPausado = false; }, PAUSE_TOP);
  requestAnimationFrame(step);
}

async function cargarPantallaTaller() {
  const cont = document.getElementById('taller-contenido');
  if (!cont || document.getElementById('tv-activate-screen')) return;

  const _primeraLlamada = !document.querySelector('.tv-shell');

  try {
    const hoy    = new Date(); hoy.setHours(0,0,0,0);
    const manana = new Date(hoy); manana.setDate(manana.getDate()+1);
    const hoyISO = hoy.toISOString().split('T')[0];

    // La pantalla de TV NO inicia sesión, así que NO accede a las tablas
    // directamente: pide todo a la función segura `tablero_taller`, que
    // devuelve los mismos 7 conjuntos. Así las tablas quedan cerradas al público.
    const _tab = await api('/rpc/tablero_taller', 'POST', {}).catch(()=>({})) || {};
    const ordenesActivas     = _tab.ordenesActivas     || [];
    const entregadasHoy      = _tab.entregadasHoy      || [];
    const etapasActivas      = _tab.etapasActivas      || [];
    const etapasTodas        = _tab.etapasTodas        || [];
    const aprobacionesTodas  = _tab.aprobacionesTodas  || [];
    const ordenesProgramadas = _tab.ordenesProgramadas || [];
    const ordenesPulmon      = _tab.ordenesPulmon      || [];

    // Tomar el estado MÁS RECIENTE por etapa (orden desc ya viene del query)
    const _ultimoEstadoEtapa = {};
    aprobacionesTodas.forEach(a => {
      if (!(_ultimoEstadoEtapa[a.etapa_id])) _ultimoEstadoEtapa[a.etapa_id] = a.estado;
    });
    const aprobadas = new Set(
      Object.entries(_ultimoEstadoEtapa)
        .filter(([, estado]) => estado === 'aprobado')
        .map(([etapa_id]) => Number(etapa_id))
    );

    // ── Clasificar órdenes ───────────────────────────────────
    // "Lista" = TODAS las etapas finalizadas Y todas con aprobación de calidad aprobada
    const ordenesListas = ordenesActivas.filter(o => {
      const ets = etapasTodas.filter(e => e.orden_id === o.id);
      if (!ets.length) return false;
      const todasFinalizadas  = ets.every(e => e.fin);
      const todasAprobadas    = ets.every(e => aprobadas.has(e.id));
      return todasFinalizadas && todasAprobadas;
    });
    const listasIds = new Set(ordenesListas.map(o => o.id));

    const ordenesEnGrid = ordenesActivas.filter(o => {
      if (o.estado === 'Programada') return false;
      // Ocultar solo si aún no llegó al taller (sin ingreso_en) y su fecha es futura
      if (o.fecha_programada && o.fecha_programada > hoyISO && !o.ingreso_en) return false;
      if (listasIds.has(o.id)) return false; // ya en panel "listos"
      const ets = etapasTodas.filter(e => e.orden_id === o.id);
      if (!ets.length) return true;
      // Mostrar en grid si: tiene etapas sin fin, O si todas tienen fin pero
      // alguna AÚN NO tiene calidad aprobada (esperando revisión del jefe)
      const hayPendientes   = ets.some(e => !e.fin);
      const esperandoCalidad = ets.every(e => e.fin) && !ets.every(e => aprobadas.has(e.id));
      return hayPendientes || esperandoCalidad;
    });

    const creadasHoy  = ordenesEnGrid.filter(o => { const f = new Date(o.ingreso_en || o.creado_en); return f >= hoy && f < manana; });
    const entregarHoy = ordenesEnGrid.filter(o => o.fecha_entrega_1?.split('T')[0] === hoyISO || o.fecha_entrega_2?.split('T')[0] === hoyISO);
    const enProceso   = ordenesEnGrid.filter(o => etapasActivas.some(e => e.orden_id === o.id));

    // En primera carga: pre-poblar caché para no disparar sonidos por órdenes ya existentes
    if (_primeraLlamada) {
      entregadasHoy.forEach(o => _tallerOrdenesNotificadas.add('ent_'+o.id));
      ordenesListas.forEach(o => _tallerOrdenesNotificadas.add('lst_'+o.id));
    }

    // ── Sonido para nuevas entregas ──────────────────────────
    const nuevasEntregadas = entregadasHoy.filter(o => !_tallerOrdenesNotificadas.has('ent_'+o.id));
    if (nuevasEntregadas.length) {
      nuevasEntregadas.forEach(o => _tallerOrdenesNotificadas.add('ent_'+o.id));
      _tvSonar();
      const oEnt = nuevasEntregadas[0];
      const ets  = etapasTodas.filter(e => e.orden_id === oEnt.id);
      setTimeout(() => _tvMostrarOverlay(oEnt, ets, '✓ ORDEN ENTREGADA', true, aprobadas), 600);
    }

    // ── Sonido + voz para nuevas listas ─────────────────────
    const nuevasListas = ordenesListas.filter(o =>
      !_tallerOrdenesNotificadas.has('lst_'+o.id) &&
      _tallerGridSnapshot.has(o.id)
    );
    if (nuevasListas.length && !nuevasEntregadas.length) {
      nuevasListas.forEach(o => _tallerOrdenesNotificadas.add('lst_'+o.id));
      _tvSonar();
      // Anuncio de voz para cada orden lista
      nuevasListas.forEach((o, idx) => {
        setTimeout(() => _tvAnunciarPlaca(o), idx * 4500);
      });
    }

    // ── Detectar cambios: inicio, fin o cambio de etapa ─────
    // Snapshot completo: orden_id → { activas: Set<id>, finalizadas: Set<id> }
    const snapshotNuevo = {};
    etapasActivas.forEach(e => {
      if (!snapshotNuevo[e.orden_id]) snapshotNuevo[e.orden_id] = { act: new Set(), fin: 0 };
      snapshotNuevo[e.orden_id].act.add(e.id);
    });
    etapasTodas.forEach(e => {
      if (e.fin) {
        if (!snapshotNuevo[e.orden_id]) snapshotNuevo[e.orden_id] = { act: new Set(), fin: 0 };
        snapshotNuevo[e.orden_id].fin++;
      }
    });

    let ordenCambiada = null;
    const prevSnap = window._tvSnapshotCompleto || {};

    if (Object.keys(prevSnap).length) { // no primera carga
      for (const [oidStr, cur] of Object.entries(snapshotNuevo)) {
        const oid = parseInt(oidStr);
        const prev = prevSnap[oidStr];
        if (!prev) {
          // nueva orden con actividad
          ordenCambiada = ordenesEnGrid.find(o => o.id === oid);
          break;
        }
        // cambio en activas (inicio/cambio de etapa)
        const actCambiaron = cur.act.size !== prev.act.size ||
          [...cur.act].some(id => !prev.act.has(id));
        // nueva etapa finalizada
        const finCambio = cur.fin !== prev.fin;
        if (actCambiaron || finCambio) {
          ordenCambiada = ordenesEnGrid.find(o => o.id === oid);
          break;
        }
      }
    }

    window._tvSnapshotCompleto = snapshotNuevo;
    // snapshot legacy para compatibilidad
    const snapshotLegacy = {};
    etapasActivas.forEach(e => { snapshotLegacy[e.orden_id] = e.id; });
    window._tvSnapshotEtapas = snapshotLegacy;
    _tallerGridSnapshot = new Set(ordenesEnGrid.map(o => o.id));

    // ── Render fila de tabla ─────────────────────────────────
    function renderFila(orden, i) {
      const etsOrden     = etapasTodas.filter(e => e.orden_id === orden.id);
      const etapasActOrden = etapasActivas.filter(e => e.orden_id === orden.id);
      const { color: entColor, label: entLabel } = _tvEntregaInfo(orden);

      const esIngreso = creadasHoy.some(o => o.id === orden.id);
      const esEntrega = entregarHoy.some(o => o.id === orden.id);
      const dias      = orden.fecha_entrega_1
        ? Math.round((new Date(orden.fecha_entrega_1) - new Date()) / 86400000) : null;

      let badge = '';
      if (esEntrega && dias !== null && dias < 0)
        badge = `<span class="tv-badge tv-badge-red">${Math.abs(dias)}d vencida</span>`;
      else if (esEntrega)
        badge = `<span class="tv-badge tv-badge-amber">Entrega hoy</span>`;
      else if (esIngreso)
        badge = `<span class="tv-badge tv-badge-blue">Nuevo hoy</span>`;
      else if (dias !== null && dias < 0)
        badge = `<span class="tv-badge tv-badge-red">${Math.abs(dias)}d vencida</span>`;
      else if (dias !== null && dias <= 2)
        badge = `<span class="tv-badge tv-badge-amber">${dias}d</span>`;
      else
        badge = `<span class="tv-badge tv-badge-gray">${dias !== null ? dias+'d' : 'Sin fecha'}</span>`;

      // Chips de etapas
      const chips = etsOrden.map((e, idx) => {
        const isApproved = !!e.fin && aprobadas.has(e.id);
        const done       = !!e.fin;
        const active     = !!e.inicio && !e.fin;
        const prevDone   = idx > 0 && !!etsOrden[idx-1]?.fin;
        const waiting    = !done && !active && prevDone;
        // ¿Tiene la última aprobación como rechazado?
        const ultAprob = aprobacionesTodas.find(a => a.etapa_id === e.id);
        const esReproceso = done && ultAprob?.estado === 'rechazado';
        const cls   = isApproved ? 'approved' : esReproceso ? 'reproceso' : done ? 'done' : active ? 'active' : waiting ? 'waiting' : 'pending';
        const label = isApproved ? `${e.etapa} ✓✓` : esReproceso ? `${e.etapa} ✗` : done ? `${e.etapa} ⏳` : active ? `${e.etapa} ●` : waiting ? `${e.etapa} →` : e.etapa;
        return `<span class="chip chip-${cls}"><span class="chip-dot ${cls}"></span>${label||'—'}</span>`;
      }).join('');

      // Técnico(s) — puede ser múltiple si hay simultáneas
      const tecnicos = [...new Set(etapasActOrden.map(e => e.tecnico).filter(Boolean))];
      const tecHtml  = `<div style="display:flex;flex-direction:column;gap:.25vh;align-items:flex-start">${
        tecnicos.length
          ? tecnicos.map(t => `<span class="tv-tec-box">${escapeHtml(t)}</span>`).join('')
          : `<span class="tv-tec-box empty">Sin técnico</span>`
      }</div>`;

      // Timer(es)
      const timerHtml = etapasActOrden.length
        ? etapasActOrden.map(e =>
            `<div class="tv-timer-val" id="tv-et-${e.id}" ${e.pausado ? 'style="color:rgba(180,83,9,.4)"' : ''}>${e.pausado ? '⏸ ' : ''}${_tvTimerStr(e)}</div>`
          ).join('')
        : `<div style="font-size:.7vw;color:#9CA3AF">—</div>`;

      return `<tr id="tv-row-${orden.id}" onclick="_tvVerDetalle(${orden.id})" style="cursor:pointer;--row-i:${i||0}">
        <td>
          <div style="display:flex;align-items:center;gap:.5vw;white-space:nowrap">
            <span class="tv-placa-box">
              <span class="tv-placa">${orden.placa}</span>
              ${otDe(orden) ? `<span class="tv-placa-ot">${otDe(orden)}</span>` : ''}
            </span>
            ${orden.placa ? `<button onclick="event.stopPropagation();abrirPopupConsumibles('${orden.placa}',${orden.kilometraje||orden.km||0})" title="Consumibles & Docs" style="background:none;border:1px solid #D1D5DB;border-radius:.3vw;padding:.15vh .4vw;cursor:pointer;font-size:.65vw;color:#374151;line-height:1;flex-shrink:0" tabindex="-1">🔧</button>` : ''}
          </div>
          ${orden.propietario ? `<div class="tv-propietario">${escapeHtml(orden.propietario)}</div>` : ''}
          <div class="tv-vehiculo">${[orden.marca,orden.linea].filter(Boolean).join(' ')||'—'}</div>
        </td>
        <td><div class="etapas-chips">${chips}</div></td>
        <td>${tecHtml}</td>
        <td>${timerHtml}</td>
        <td>
          <span class="tv-entrega-chip" style="color:${entColor}">${entLabel}</span>
          ${(() => { const { hora } = _tvEntregaInfo(orden); return hora ? `<div style="font-family:'DM Mono',monospace;font-size:.6vw;color:${entColor};opacity:.65;margin-top:.15vh">${hora}</div>` : ''; })()}
        </td>
        <td>${badge}</td>
      </tr>`;
    }

    // ── Franja pulmón ────────────────────────────────────────
    function _pulmonCardHtml(o) {
      const dias = o.pulmon_desde ? Math.floor((Date.now()-new Date(o.pulmon_desde))/86400000) : null;
      const tipo = o.pulmon_tipo ? o.pulmon_tipo.charAt(0).toUpperCase()+o.pulmon_tipo.slice(1) : 'Pulmón';
      return `<div class="tv-pulmon-card" onclick="_tvVerDetalle(${o.id})">
        <div class="tv-pulmon-info">
          <div class="tv-pulmon-placa">⏸ ${o.placa}</div>
          <div class="tv-pulmon-veh">${[o.marca,o.linea].filter(Boolean).join(' ')||'—'}</div>
        </div>
        <div class="tv-pulmon-meta">
          <div class="tv-pulmon-tipo">${tipo}</div>
          ${dias!==null?`<div class="tv-pulmon-dias">${dias}d</div>`:''}
        </div>
      </div>`;
    }
    const pulmonFranjaHtml = ordenesPulmon.length
      ? ordenesPulmon.map(_pulmonCardHtml).join('')
      : `<div style="font-size:.65vw;color:#92400E;opacity:.6;font-style:italic">Sin vehículos en pulmón</div>`;

    // ── Panel derecho: Listos hoy ────────────────────────────
    // Deduplicar por id (una orden no puede aparecer dos veces)
    const _panelSeen = new Set();
    const panelItems = [
      ...ordenesListas.map(o  => ({ orden:o, tipo:'listo'    })),
      ...entregadasHoy.map(o  => ({ orden:o, tipo:'entregado' }))
    ].filter(({ orden }) => {
      if (_panelSeen.has(orden.id)) return false;
      _panelSeen.add(orden.id);
      return true;
    });

    // Si una orden que estaba en "listos" fue rechazada, quitarla del cache
    // para que cuando se re-apruebe pueda notificar de nuevo
    const listasActualesIds = new Set(ordenesListas.map(o => o.id));
    [..._tallerOrdenesNotificadas].forEach(key => {
      if (key.startsWith('lst_')) {
        const id = parseInt(key.replace('lst_', ''));
        if (!listasActualesIds.has(id)) _tallerOrdenesNotificadas.delete(key);
      }
    });
    const panelListosHtml = panelItems.length
      ? panelItems.map(({orden, tipo}) => _tvPanelItem(orden, tipo)).join('')
      : '<div class="tv-panel-empty">Sin terminados hoy</div>';

    // ── Panel derecho: Programadas ───────────────────────────
    const progHtml = ordenesProgramadas.length
      ? ordenesProgramadas.map(o => {
          const fp   = o.fecha_programada ? new Date(o.fecha_programada + 'T00:00:00') : null;
          const dias = fp ? Math.round((fp - hoy) / 86400000) : null;
          const label = dias === 0 ? 'Hoy' : dias === 1 ? 'Mañana' : dias !== null ? `en ${dias}d` : '—';
          return `<div class="tv-prog-item">
            <div class="tv-prog-dot"></div>
            <div style="flex:1;min-width:0">
              <div class="tv-prog-placa">${o.placa}</div>
              <div class="tv-prog-ot">${otDe(o)} · ${[o.marca,o.linea].filter(Boolean).join(' ')||'—'}</div>
            </div>
            ${label ? `<div class="tv-prog-fecha">${label}</div>` : ''}
          </div>`;
        }).join('')
      : '<div class="tv-panel-empty">Sin programadas</div>';

    const panelHtml = panelListosHtml; // alias para compatibilidad

    // ── Ordenar: orden cambiada AL TOP primero, luego activas, luego por entrega ──
    const changedId = ordenCambiada?.id || null;
    const ordenesOrdenadas = [...ordenesEnGrid].sort((a, b) => {
      if (a.id === changedId) return -1;
      if (b.id === changedId) return  1;
      const aActiva = etapasActivas.some(e => e.orden_id === a.id) ? 0 : 1;
      const bActiva = etapasActivas.some(e => e.orden_id === b.id) ? 0 : 1;
      if (aActiva !== bActiva) return aActiva - bActiva;
      const fa = a.fecha_entrega_1 || '9999', fb = b.fecha_entrega_1 || '9999';
      return fa < fb ? -1 : fa > fb ? 1 : 0;
    });

    // ── Primer render: construir shell completo ──────────────
    if (_primeraLlamada) {
      const filasHtml = ordenesOrdenadas.map(renderFila).join('');
      const panelListosHtmlInner = panelItems.length
        ? panelItems.map(({orden, tipo}) => _tvPanelItem(orden, tipo)).join('')
        : '<div class="tv-panel-empty">Sin terminados hoy</div>';

      cont.innerHTML = `
        <div class="tv-shell">
          <div class="tv-header">
            <div class="tv-brand">
              <div class="tv-brand-dot"></div>
              <span class="tv-brand-name">Freimanautos · Sistema Operativo</span>
            </div>
            <div id="taller-reloj" class="tv-clock"></div>
            <div id="taller-fecha" class="tv-date"></div>
          </div>

          <div class="tv-kpi-strip" style="grid-template-columns:repeat(6,1fr)">
            <div class="tv-kpi">
              <div class="tv-kpi-num" id="tv-kpi-activas" style="color:#1E40AF">${ordenesActivas.length}</div>
              <div class="tv-kpi-label">Órdenes<br>activas</div>
            </div>
            <div class="tv-kpi">
              <div class="tv-kpi-num" id="tv-kpi-entregadas" style="color:#15803D">${entregadasHoy.length}</div>
              <div class="tv-kpi-label">Entregadas<br>hoy</div>
            </div>
            <div class="tv-kpi">
              <div class="tv-kpi-num" id="tv-kpi-creadas" style="color:#1E40AF">${creadasHoy.length}</div>
              <div class="tv-kpi-label">Ingresaron<br>hoy</div>
            </div>
            <div class="tv-kpi">
              <div class="tv-kpi-num" id="tv-kpi-proceso" style="color:#B45309">${enProceso.length}</div>
              <div class="tv-kpi-label">En proceso<br>ahora</div>
            </div>
            <div class="tv-kpi">
              <div class="tv-kpi-num" id="tv-kpi-programadas" style="color:#4338CA">${ordenesProgramadas.length}</div>
              <div class="tv-kpi-label">Programadas</div>
            </div>
            <div class="tv-kpi" style="background:#F8FAFC">
              <div class="tv-kpi-num" id="tv-kpi-pulmon" style="color:#374151">${ordenesPulmon.length}</div>
              <div class="tv-kpi-label">En<br>pulmón</div>
            </div>
          </div>

          <div class="tv-body">
            <div class="tv-list-wrap">
              <div class="tv-table-wrap">
                <table class="tv-table">
                  <thead class="tv-thead">
                    <tr>
                      <th class="tv-col-placa">Placa</th>
                      <th class="tv-col-etapas">Etapas del proceso</th>
                      <th class="tv-col-tec">Técnico</th>
                      <th class="tv-col-timer">Tiempo</th>
                      <th class="tv-col-entrega">Entrega</th>
                      <th class="tv-col-estado">Estado</th>
                    </tr>
                  </thead>
                  <tbody class="tv-tbody">
                    ${filasHtml || `<tr><td colspan="6" style="text-align:center;padding:3vh;color:#D1D5DB;font-size:.8vw;letter-spacing:.1em">SIN ÓRDENES ACTIVAS</td></tr>`}
                  </tbody>
                </table>
              </div>
              <div class="tv-pulmon-strip">
                <div class="tv-pulmon-strip-label">EN PULMÓN · ${ordenesPulmon.length}</div>
                <div style="width:1px;height:3vh;background:#D1D5DB;flex-shrink:0"></div>
                <div class="tv-pulmon-cards" id="tv-pulmon-cards">
                  <div class="tv-pulmon-cards-inner" id="tv-pulmon-cards-inner">${pulmonFranjaHtml}</div>
                </div>
              </div>
            </div>

            <div class="tv-panel-right">
              <div class="tv-panel-section" id="tv-section-listos">
                <div class="tv-panel-title">Listos hoy</div>
                <div class="tv-panel-list" id="tv-panel-listos">${panelListosHtmlInner}</div>
              </div>
              <div class="tv-panel-divider"></div>
              <div class="tv-panel-section">
                <div class="tv-panel-title" id="tv-prog-title" style="color:#6366F1">Programadas · ${ordenesProgramadas.length}</div>
                <div class="tv-panel-list" id="tv-panel-programadas" style="gap:.3vh">${progHtml}</div>
              </div>
            </div>
          </div>
        </div>

        <div class="tv-watermark">
          <img src="assets/icons/Icono_Redondo_Fondo_Taller.png"
            style="width:100%;height:100%;object-fit:contain;opacity:0.06" alt="">
        </div>
      `;

      iniciarRelojTaller();
      _iniciarScrollTaller();
      _iniciarScrollPulmon();

    } else {
      // ── Actualización incremental: solo tocar lo que cambió ──

      // KPIs
      const upd = (id, val) => { const el=document.getElementById(id); if(el) el.textContent=val; };
      upd('tv-kpi-activas',    ordenesActivas.length);
      upd('tv-kpi-entregadas', entregadasHoy.length);
      upd('tv-kpi-creadas',    creadasHoy.length);
      upd('tv-kpi-proceso',    enProceso.length);
      upd('tv-kpi-programadas',ordenesProgramadas.length);
      upd('tv-kpi-pulmon',     ordenesPulmon.length);
      upd('tv-prog-title',     `Programadas · ${ordenesProgramadas.length}`);

      // Actualizar tabla: re-render completo del tbody, animando solo filas nuevas
      const tbody = cont.querySelector('.tv-tbody');
      if (tbody) {
        const existingIds = new Set(
          [...tbody.querySelectorAll('tr[id^="tv-row-"]')].map(tr => parseInt(tr.id.replace('tv-row-','')))
        );
        const filasHtml = ordenesOrdenadas.map(renderFila).join('');
        tbody.innerHTML = filasHtml || `<tr><td colspan="6" style="text-align:center;padding:3vh;color:#D1D5DB;font-size:.8vw;letter-spacing:.1em">SIN ÓRDENES ACTIVAS</td></tr>`;
        // Animar solo las filas genuinamente nuevas
        ordenesOrdenadas.forEach(orden => {
          if (!existingIds.has(orden.id)) {
            const tr = document.getElementById(`tv-row-${orden.id}`);
            if (tr) { tr.classList.add('tv-row-new'); setTimeout(() => tr.classList.remove('tv-row-new'), 500); }
          }
        });
      }

      // Panel Listos hoy: solo reemplazar si el contenido cambió (evita parpadeo)
      const panelListos = document.getElementById('tv-panel-listos');
      if (panelListos) {
        const sig = panelItems.map(({orden,tipo}) => `${orden.id}:${tipo}:${tipo==='listo'?_tvCitaTxt(orden):''}`).join(',');
        if (panelListos.dataset.sig !== sig) {
          panelListos.dataset.sig = sig;
          const scrollPos = panelListos.scrollTop;
          panelListos.innerHTML = panelItems.length
            ? panelItems.map(({orden, tipo}) => _tvPanelItem(orden, tipo)).join('')
            : '<div class="tv-panel-empty">Sin terminados hoy</div>';
          panelListos.scrollTop = scrollPos;
        }
      }

      // Panel programadas: reemplazar completo (pequeño, cambia poco)
      const panelProg = document.getElementById('tv-panel-programadas');
      if (panelProg) panelProg.innerHTML = progHtml;

      // Franja pulmón: actualizar si cambió
      const pulmonCards = document.getElementById('tv-pulmon-cards');
      if (pulmonCards) {
        const sigPulmon = ordenesPulmon.map(o => o.id).join(',');
        if (pulmonCards.dataset.sig !== sigPulmon) {
          pulmonCards.dataset.sig = sigPulmon;
          pulmonCards.innerHTML = `<div class="tv-pulmon-cards-inner" id="tv-pulmon-cards-inner">${pulmonFranjaHtml}</div>`;
          pulmonCards.scrollLeft = 0;
        }
      }
    }

    // ── Referencias globales ─────────────────────────────────
    window._tvEtapasTodas    = etapasTodas;
    window._tvOrdenesActivas = ordenesActivas;
    window._tvEntregadasHoy  = entregadasHoy;
    window._tvAprobadas      = aprobadas;

    // Timers en vivo
    if (window._tallerTimerInterval) clearInterval(window._tallerTimerInterval);
    window._tallerTimerInterval = setInterval(() => {
      etapasActivas.forEach(e => {
        const el = document.getElementById(`tv-et-${e.id}`);
        if (el) el.textContent = (e.pausado ? '⏸ ' : '') + _tvTimerStr(e);
      });
    }, 1000);

    // Scroll perpetuo (solo arranca si no está corriendo)
    _iniciarScrollTaller();

    // ── Animación cuando hay cambio en una orden ─────────────
    if (ordenCambiada) {
      const tw = cont.querySelector('.tv-table-wrap');
      if (tw) tw.scrollTop = 0;
      window._tvScrollPausado = true;

      setTimeout(() => {
        const rowEl = document.getElementById(`tv-row-${ordenCambiada.id}`);
        if (rowEl) {
          rowEl.classList.remove('tv-row-alert');
          void rowEl.offsetWidth;
          rowEl.classList.add('tv-row-alert');
          setTimeout(() => rowEl.classList.remove('tv-row-alert'), 3200);
        }
        setTimeout(() => { window._tvScrollPausado = false; }, 3000);
      }, 80);
    }

  } catch(e) {
    if (!document.getElementById('tv-activate-screen'))
      cont.innerHTML = `<div style="color:#DC2626;padding:4vh 3vw;font-family:'DM Mono',monospace;font-size:1.2vw">ERROR: ${e.message}</div>`;
  }
}

function _tvVerDetalle(ordenId) {
  const todas  = [...(window._tvOrdenesActivas||[]), ...(window._tvEntregadasHoy||[])];
  const orden  = todas.find(o => o.id === ordenId);
  if (!orden) return;
  const ets    = (window._tvEtapasTodas||[]).filter(e => e.orden_id === ordenId);
  const esEnt  = (window._tvEntregadasHoy||[]).some(o => o.id === ordenId);
  _tvMostrarOverlay(orden, ets, esEnt ? '✓ ENTREGADA HOY' : 'DETALLE DE ORDEN', esEnt, window._tvAprobadas);
}