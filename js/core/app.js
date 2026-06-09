// ═══════════════════════════════════════════════════════════
// INICIALIZACIÓN Y NAVEGACIÓN PRINCIPAL
// ═══════════════════════════════════════════════════════════

function montarApp() {
  document.getElementById('pantalla-login').style.display = 'none';
  document.getElementById('app').classList.add('show');

  const rolLabels = {
    gerente:   'Gerente General',
    jefe:      'Jefe de Taller',
    mecanico:  'Mecánico',
    taller:    'Pantalla Taller',
    repuestos: 'Repuestos',
    cliente:   'Cliente'
  };

  document.getElementById('sb-nombre').textContent = sesion.nombre;
  document.getElementById('sb-avatar').innerHTML = '<img src="icons/logoFreimanpfp.png" style="width:100%;height:100%;object-fit:contain;border-radius:50%">';
  // Mostrar rol específico del mecánico si existe, si no el label genérico
  const rolMostrar = (sesion.perfil === 'mecanico' && sesion.datos?.rol)
    ? sesion.datos.rol
    : (rolLabels[sesion.perfil] || sesion.perfil);
  document.getElementById('sb-rol').textContent = rolMostrar;

  const capEl = document.getElementById('sidebar-capacidad');
  if (capEl) capEl.style.display = esJefe() ? 'block' : 'none';

  switch (sesion.perfil) {
    case 'gerente':   montarJefe();      break;
    case 'jefe':      montarJefe();      break;
    case 'mecanico': {
      const tieneVistas = sesion.permisos && Object.values(sesion.permisos).some(Boolean);
      if (tieneVistas) montarRolPersonalizado();
      else montarMecanico();
      break;
    }
    case 'taller':    esJefe() ? montarTallerKPI() : montarTaller(); break;
    case 'repuestos': montarRepuestos(); break;
    default:          montarCliente();   break;
  }
}

// ── PWA Install prompt ──────────────────────────────────────
let _pwaInstallPrompt = null;

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  _pwaInstallPrompt = e;
  // Mostrar banner de instalación si no está instalada
  _mostrarBannerInstalar();
});

window.addEventListener('appinstalled', () => {
  _pwaInstallPrompt = null;
  const banner = document.getElementById('pwa-install-banner');
  if (banner) banner.remove();
});

function _mostrarBannerInstalar() {
  if (document.getElementById('pwa-install-banner')) return;
  // Solo mostrar si la app NO está en modo standalone (ya instalada)
  if (window.matchMedia('(display-mode: standalone)').matches) return;
  if (window.navigator.standalone === true) return;

  const banner = document.createElement('div');
  banner.id = 'pwa-install-banner';
  banner.style.cssText = `
    position:fixed;bottom:76px;left:50%;transform:translateX(-50%);
    background:#1E3A5F;color:white;border-radius:12px;
    padding:10px 16px;display:flex;align-items:center;gap:10px;
    box-shadow:0 4px 20px rgba(0,0,0,0.3);z-index:9000;
    font-family:'DM Sans',sans-serif;font-size:13px;font-weight:500;
    white-space:nowrap;animation:slideUp .3s ease-out;
  `;
  banner.innerHTML = `
    <svg width="16" height="16" fill="none" stroke="white" stroke-width="2" viewBox="0 0 24 24"><path d="M12 2v13M5 9l7 7 7-7"/><path d="M3 19h18"/></svg>
    <span>Instalar app — oculta la barra de URL</span>
    <button onclick="_instalarPWA()" style="background:white;color:#1E3A5F;border:none;border-radius:7px;padding:5px 12px;font-size:12px;font-weight:700;cursor:pointer;font-family:'DM Sans',sans-serif">Instalar</button>
    <button onclick="document.getElementById('pwa-install-banner').remove()" style="background:none;border:none;color:rgba(255,255,255,.6);cursor:pointer;font-size:18px;line-height:1;padding:0 4px">×</button>
  `;
  document.body.appendChild(banner);

  // Auto-ocultar tras 12 segundos
  setTimeout(() => { if (banner.parentNode) banner.remove(); }, 12000);
}

async function _instalarPWA() {
  if (!_pwaInstallPrompt) return;
  _pwaInstallPrompt.prompt();
  const { outcome } = await _pwaInstallPrompt.userChoice;
  _pwaInstallPrompt = null;
  const banner = document.getElementById('pwa-install-banner');
  if (banner) banner.remove();
}

document.addEventListener('DOMContentLoaded', function() {
  // Si la URL tiene ?view=monitor, montar el monitor sin login
  if (typeof esVistaMonitor === 'function' && esVistaMonitor()) {
    if (typeof montarMonitor === 'function') montarMonitor();
    return;
  }

  checkSesionGuardada();
  const lightbox = document.getElementById('lightbox');
  if (lightbox) {
    lightbox.addEventListener('click', function(e) {
      if (e.target === this) cerrarLightbox();
    });
  }
});

// ─── Navegación para roles personalizados ────────────────────
const _NAV_ITEMS_ROL = [
  { perm:'ver_dashboard',    pag:'dashboard',    icoS:`<svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>`, label:'Estado del taller',   blabel:'Taller' },
  { perm:'ver_ordenes',      pag:'ordenes',      icoS:`<svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/></svg>`,                                                                                                                                      label:'Todas las órdenes',   blabel:'Órdenes' },
  { perm:'crear_ordenes',    pag:'nueva',        icoS:`<svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 8v8M8 12h8"/></svg>`,                                                                                                                                                         label:'Nueva orden',         blabel:'Nueva' },
  { perm:'ver_cotizaciones', pag:'cotizaciones', icoS:`<svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><path d="M14 2v6h6M16 13H8M16 17H8M10 9H8"/></svg>`,                                                                                                  label:'Cotizaciones',        blabel:'Cotiz.' },
  { perm:'ver_calendario',   pag:'calendario',   icoS:`<svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>`,                                              label:'Calendario',          blabel:'Agenda' },
  { perm:'ver_mecanicos',    pag:'mecanicos',    icoS:`<svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/></svg>`,                                                                   label:'Operarios',           blabel:'Personal' },
  { perm:'ver_repuestos',    pag:'repuestos',    icoS:`<svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M20 7H4a2 2 0 00-2 2v6a2 2 0 002 2h16a2 2 0 002-2V9a2 2 0 00-2-2z"/><path d="M16 21V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v16"/></svg>`,                                                                             label:'Repuestos',           blabel:'Repuestos' },
  { perm:'ver_reportes',     pag:'reportes',     icoS:`<svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>`,                              label:'Reportes',            blabel:'Reportes' },
  { perm:'ver_flotillas',    pag:'flotillas',    icoS:`<svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>`,                                        label:'Vehículos',           blabel:'Flotillas' },
  { perm:'ver_aseguradoras', pag:'aseguradoras', icoS:`<svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>`,                                                                                                                                                         label:'Aseguradoras',        blabel:'Seguros' },
];

function montarRolPersonalizado() {
  const perms = sesion?.permisos || {};
  const items = _NAV_ITEMS_ROL.filter(n => perms[n.perm]);
  if (!items.length) { montarMecanico(); return; }

  const sidebarNav = document.getElementById('sidebar-nav');
  if (sidebarNav) {
    sidebarNav.innerHTML = items.map(n =>
      `<button class="nav-item" id="nav-${n.pag}" onclick="navJefe('${n.pag}')">
        ${n.icoS.replace('width="16"','width="16"')}
        <span class="nav-label">${n.label}</span>
       </button>`
    ).join('');
  }

  const bottomNav = document.getElementById('bottom-nav-inner');
  if (bottomNav) {
    const bItems = items.slice(0, 4);
    bottomNav.innerHTML = bItems.map(n =>
      `<button class="bnav-item" id="bnav-${n.pag}" onclick="navJefe('${n.pag}')">
        ${n.icoS.replace('width="16" height="16"','width="20" height="20"')}
        <span>${n.blabel}</span>
       </button>`
    ).join('') +
    (items.length > 4 ? `<button class="bnav-item" id="bnav-mas" onclick="openSidebar()">
      <svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
      <span>Más</span></button>` : '');
  }

  cargarMecanicos().finally(() => {
    const primera = items[0]?.pag || 'ordenes';
    const ultimaPag = localStorage.getItem('ultima_pag_jefe') || primera;
    const pagValida = items.some(n => n.pag === ultimaPag) ? ultimaPag : primera;
    navJefe(pagValida);
  });
  if (typeof iniciarRealtime === 'function') iniciarRealtime();
}

if ('serviceWorker' in navigator) {
  window.addEventListener('load', function() {
    navigator.serviceWorker.register('/service-worker.js')
      .then(reg => console.log('Service Worker registrado:', reg.scope))
      .catch(err => console.warn('Error al registrar Service Worker:', err));
  });
}