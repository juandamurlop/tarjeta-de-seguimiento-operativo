// ═══════════════════════════════════════════════════════════
// UTILIDADES
// ═══════════════════════════════════════════════════════════
function toast(msg, tipo = 'ok') {
  const t = document.getElementById('toast');
  t.textContent = msg; t.className = 'show ' + tipo;
  setTimeout(() => t.className = '', 3000);
}

function formatFecha(f) { return f ? new Date(f).toLocaleDateString('es-CO') : '—'; }
function formatTS(ts) { return ts ? new Date(ts).toLocaleString('es-CO', { dateStyle: 'short', timeStyle: 'short' }) : '—'; }
function kid(id) { return 'e' + String(id).replace(/\D/g, ''); }

function durHumana(ms) {
  const m = Math.round(ms / 60000);
  if (m < 60) return m + ' min';
  const h = Math.floor(m / 60), rm = m % 60;
  if (h < 24) return `${h}h ${rm}m`;
  return `${Math.floor(h / 24)}d ${h % 24}h`;
}

function openSidebar() {
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('sidebar-overlay');
  if (sidebar) sidebar.classList.add('mobile-open');
  if (overlay) overlay.classList.add('show');
}

function closeSidebar() {
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('sidebar-overlay');
  if (sidebar) sidebar.classList.remove('mobile-open');
  if (overlay) overlay.classList.remove('show');
}

function mostrarPagina(id) {
  const paginas = document.querySelectorAll('.pagina');
  paginas.forEach(p => p.classList.remove('activa'));
  const paginaActiva = document.getElementById(id);
  if (paginaActiva) paginaActiva.classList.add('activa');
}

function abrirLightbox(url) { 
  const img = document.getElementById('lightbox-img');
  const lightbox = document.getElementById('lightbox');
  if (img) img.src = url; 
  if (lightbox) lightbox.classList.add('show'); 
}

function cerrarLightbox() { 
  const lightbox = document.getElementById('lightbox');
  const img = document.getElementById('lightbox-img');
  if (lightbox) lightbox.classList.remove('show'); 
  if (img) img.src = ''; 
}