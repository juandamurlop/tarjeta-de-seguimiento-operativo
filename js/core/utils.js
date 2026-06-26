// ═══════════════════════════════════════════════════════════
// UTILIDADES
// ═══════════════════════════════════════════════════════════

// Inline SVG icon helper — returns an SVG string at the requested pixel size.
const _ICO = {
  camera:    '<path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/>',
  calendar:  '<rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>',
  car:       '<path d="M19 17H5"/><path d="M3 9l2.5-5h13l2.5 5"/><rect x="1" y="9" width="22" height="9" rx="2"/><circle cx="6.5" cy="18" r="2"/><circle cx="17.5" cy="18" r="2"/>',
  file:      '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>',
  clipboard: '<path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1"/>',
  user:      '<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
  wrench:    '<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>',
  money:     '<line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>',
  chart:     '<line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/><line x1="2" y1="20" x2="22" y2="20"/>',
  ticket:    '<path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v2z"/>',
  warning:   '<path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>',
  fuel:      '<path d="M3 22h12V4H3z"/><path d="M15 8h2a2 2 0 0 1 2 2v4a2 2 0 0 0 2 2 2 2 0 0 0 2-2V6l-4-4"/><line x1="3" y1="10" x2="15" y2="10"/>',
  building:  '<rect x="3" y="2" width="18" height="20" rx="1"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="2" x2="9" y2="9"/><line x1="15" y1="2" x2="15" y2="9"/>',
  edit:      '<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>',
  package:   '<line x1="16.5" y1="9.4" x2="7.5" y2="4.21"/><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/>',
  check:     '<polyline points="20 6 9 17 4 12"/>',
  x:         '<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>',
  clock:     '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>',
  hardhat:   '<path d="M2 18a1 1 0 0 0 1 1h18a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1H3a1 1 0 0 0-1 1v2z"/><path d="M10 10V5a2 2 0 0 1 4 0v5"/><path d="M4 15V9a8 8 0 0 1 16 0v6"/>',
};
function ico(name, size = 16) {
  const inner = _ICO[name];
  if (!inner) return '';
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle;flex-shrink:0">${inner}</svg>`;
}

function escapeHtml(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ═══════════════════════════════════════════════════════════
// CENTRO DE ACTIVIDAD — logger de eventos del taller.
// No-op si la tabla aún no existe o falla la red; nunca bloquea al caller.
// ═══════════════════════════════════════════════════════════
function _logEvento(tipo, icono, descripcion, ordenId, placa, color) {
  if (!tipo || !descripcion) return;
  try {
    api('/eventos_taller', 'POST', {
      tipo, icono, descripcion,
      orden_id: ordenId ? Number(ordenId) : null,
      placa:    placa  || null,
      autor:    (typeof sesion !== 'undefined' && sesion?.nombre) || '—',
      color:    color  || '#64748B'
    }, { Prefer: 'return=minimal' }).catch(() => {});
  } catch (_) {}
}

// ═══════════════════════════════════════════════════════════
// REPUESTOS — fuente ÚNICA de estados (nombre, color, icono, paso).
// La usan el detalle de orden, el módulo de repuestos, la vista del
// técnico y la TV, para que TODOS vean lo mismo con el mismo nombre.
// Flujo: Solicitado → En gestión → Cotizado → Pedido → Llegó → Entregado.
// ═══════════════════════════════════════════════════════════
const REPUESTO_ESTADOS = {
  pendiente_jefe:    { label: 'Solicitado', paso: 1, color: '#D97706', bg: '#FEF3C7', icon: '📝', pendiente: true },
  enviado_repuestos: { label: 'En gestión', paso: 2, color: '#7C3AED', bg: '#EDE9FE', icon: '🔎', pendiente: true },
  cotizado:          { label: 'Cotizado',   paso: 3, color: '#2563EB', bg: '#EBF2FF', icon: '💲', pendiente: true },
  pedido:            { label: 'Pedido',      paso: 4, color: '#0891B2', bg: '#E0F2FE', icon: '🚚', pendiente: true },
  recibido_taller:   { label: 'Llegó',       paso: 5, color: '#0D9488', bg: '#CCFBF1', icon: '📦', pendiente: true },
  entregado:         { label: 'Entregado',   paso: 6, color: '#059669', bg: '#E6F5EF', icon: '✅', pendiente: false },
  rechazado:         { label: 'Cancelado',   paso: 0, color: '#DC2626', bg: '#FEE2E2', icon: '✕',  pendiente: false },
};
// Estados que cuentan como "sin completar" (bloquean cerrar la orden).
const REPUESTO_ESTADOS_PENDIENTES = ['pendiente_jefe', 'enviado_repuestos', 'cotizado', 'pedido', 'recibido_taller'];
const TOTAL_PASOS_REPUESTO = 6;
function repuestoEstadoInfo(estado) {
  return REPUESTO_ESTADOS[estado] || { label: estado || '—', paso: 0, color: '#6B7280', bg: '#F3F4F6', icon: '•', pendiente: false };
}

function safeUrl(url) {
  if (!url || typeof url !== 'string') return '#';
  const lower = url.trim().toLowerCase();
  if (!lower.startsWith('http://') && !lower.startsWith('https://')) return '#';
  return url.trim();
}
function toast(msg, tipo = 'ok', duracion = 3000) {
  const t = document.getElementById('toast');
  if (!t) return;
  t.innerHTML = '<span class="toast-msg"></span><span class="toast-bar"></span>';
  t.querySelector('.toast-msg').textContent = msg;
  t.className = 'show ' + tipo;
  // Barra de progreso: arranca en 0 y se rellena hasta 100% durante la duración;
  // al llenarse, el toast se oculta.
  const bar = t.querySelector('.toast-bar');
  bar.style.transition = 'none';
  bar.style.width = '0%';
  void bar.offsetWidth; // forzar reflow para reiniciar la animación
  bar.style.transition = `width ${duracion}ms linear`;
  bar.style.width = '100%';
  clearTimeout(t._toastTimer);
  t._toastTimer = setTimeout(() => { t.className = ''; }, duracion);
}

// Respaldo del avatar: si la imagen del logo no carga (algunos Android la
// muestran rota), se reemplaza por un círculo con la "F" de la marca.
function _avatarOnError(img) {
  if (!img) return;
  img.onerror = null;
  const d = document.createElement('div');
  d.style.cssText = 'width:100%;height:100%;display:flex;align-items:center;justify-content:center;background:#1E3A5F;color:#fff;border-radius:50%;font-weight:800;font-size:18px;font-family:\'DM Sans\',sans-serif';
  d.textContent = 'F';
  img.replaceWith(d);
}

// ── CÁMARA NATIVA: abre la cámara propia del dispositivo (la app de cámara del
// teléfono) con un input file + capture="environment". Da mejor calidad y
// enfoque que la cámara dentro del navegador, y deja repetir la foto. En
// computador sin cámara abre el selector de archivos. Pasa la foto al handler
// de OCR (que espera algo con .files). Uso: escanearTarjetaCamara(ocrTarjeta...).
async function escanearTarjetaCamara(handler) {
  const inp = document.createElement('input');
  inp.type = 'file';
  inp.accept = 'image/*';
  inp.setAttribute('capture', 'environment'); // abre la cámara trasera del dispositivo
  inp.style.display = 'none';
  inp.onchange = () => {
    const f = inp.files && inp.files[0];
    inp.remove();
    if (f && typeof handler === 'function') handler({ files: [f], value: '' });
  };
  document.body.appendChild(inp);
  inp.click();
}

// Comprime/reduce una imagen antes de enviarla al OCR (mucho más rápido:
// menos peso para subir y para procesar). Devuelve { base64, dataUrl, mime }.
function comprimirImagenBase64(file, maxDim = 1400, quality = 0.72) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('No se pudo leer la imagen'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => {
        // Si no se puede procesar, enviar el original tal cual
        const b64 = String(reader.result).split(',')[1] || '';
        resolve({ base64: b64, dataUrl: reader.result, mime: file.type || 'image/jpeg' });
      };
      img.onload = () => {
        try {
          let w = img.naturalWidth, h = img.naturalHeight;
          const scale = Math.min(1, maxDim / Math.max(w, h));
          w = Math.round(w * scale); h = Math.round(h * scale);
          const canvas = document.createElement('canvas');
          canvas.width = w; canvas.height = h;
          canvas.getContext('2d').drawImage(img, 0, 0, w, h);
          const dataUrl = canvas.toDataURL('image/jpeg', quality);
          resolve({ base64: dataUrl.split(',')[1], dataUrl, mime: 'image/jpeg' });
        } catch (e) {
          const b64 = String(reader.result).split(',')[1] || '';
          resolve({ base64: b64, dataUrl: reader.result, mime: file.type || 'image/jpeg' });
        }
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

// Comprime una imagen y devuelve un File JPEG liviano (~150-300KB), listo
// para storageUpload. Reduce a maxDim px y calidad dada. Si algo falla,
// devuelve el archivo original para no perder la foto.
function comprimirImagenFile(file, maxDim = 1400, quality = 0.72) {
  return new Promise((resolve) => {
    if (!file || !/^image\//.test(file.type)) return resolve(file);
    const reader = new FileReader();
    reader.onerror = () => resolve(file);
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => resolve(file);
      img.onload = () => {
        try {
          let w = img.naturalWidth, h = img.naturalHeight;
          const scale = Math.min(1, maxDim / Math.max(w, h));
          w = Math.round(w * scale); h = Math.round(h * scale);
          const canvas = document.createElement('canvas');
          canvas.width = w; canvas.height = h;
          canvas.getContext('2d').drawImage(img, 0, 0, w, h);
          canvas.toBlob((blob) => {
            if (!blob) return resolve(file);
            const base = (file.name || 'foto').replace(/\.[^.]+$/, '');
            resolve(new File([blob], base + '.jpg', { type: 'image/jpeg' }));
          }, 'image/jpeg', quality);
        } catch (e) { resolve(file); }
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

// Lee una tarjeta de propiedad con la función propia de Supabase (OpenAI
// gpt-4o, con la API key segura en el servidor). Envía la foto en alta calidad
// para máxima precisión. Devuelve { placa, marca, linea, modelo, color, vin,
// propietario, documento, tipo_documento }.
async function ocrLeerTarjeta(file) {
  // Enviamos la imagen grande y con poca compresión (2400px, calidad 0.92) para
  // que el modelo lea bien el VIN, la cédula y el NIT (letras pequeñas). Pesa más
  // y tarda un poco más, pero la lectura sale mucho más exacta.
  const { base64, mime } = await comprimirImagenBase64(file, 2400, 0.92);

  // Manda el token del usuario logueado (no la llave publica): así la función
  // OCR solo responde a personal autenticado y nadie de afuera gasta el saldo.
  const res = await fetch(`${SUPABASE_URL}/functions/v1/ocr-tarjeta`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: SUPABASE_KEY,
      Authorization: 'Bearer ' + (typeof _getBearer === 'function' ? _getBearer() : SUPABASE_KEY)
    },
    body: JSON.stringify({ imagen: base64, tipo: mime })
  });

  const d = await res.json().catch(() => ({}));
  if (!res.ok || (d && d.error)) {
    throw new Error((d && d.error) || `OCR ${res.status}`);
  }
  return (d && d.datos) || {};
}

// Normaliza un documento (cédula/NIT) para guardarlo/buscarlo SIEMPRE igual:
// quita puntos, espacios y guiones y deja solo letras y números en mayúscula.
// Así el acceso del cliente funciona aunque la cédula se escriba con o sin
// formato (1.010.026.957 == 1010026957) y aunque se cambie en cualquier momento.
function normDoc(d) { return String(d == null ? '' : d).toUpperCase().replace(/[^A-Z0-9]/g, ''); }

// Nombre del técnico de una etapa. Si es EXTERNO (tercero, sin técnico interno)
// lo muestra como "Nombre - TOT"; si es interno, solo el nombre.
function nombreTec(e) {
  if (!e) return '';
  const interno = e.tecnico != null && String(e.tecnico).trim();
  if (interno) return String(e.tecnico).trim();
  const ext = e.tercero != null && String(e.tercero).trim();
  if (ext) return String(e.tercero).trim() + ' - TOT';
  return '';
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

const _fmtCOP = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 });
function formatCOP(n) { return n != null ? _fmtCOP.format(n) : '—'; }
function formatOT(id, estado)  {
  if (estado === 'Programada') return 'Prog.';
  return 'OT-' + String(id).padStart(4, '0');
}
// Etiqueta de OT a partir del objeto orden: usa el número MANUAL (numero_ot)
// si la orden lo tiene; si no, el automático OT-####.
function otDe(o) {
  if (!o) return '';
  if (o.estado === 'Programada') return 'Prog.';
  return (o.numero_ot && String(o.numero_ot).trim()) ? String(o.numero_ot).trim() : formatOT(o.id, o.estado);
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
  const main    = document.querySelector('.main');
  if (sidebar) { sidebar.classList.remove('mobile-open'); sidebar.classList.remove('tablet-expanded'); }
  if (overlay) overlay.classList.remove('show');
  if (main)    main.classList.remove('tablet-expanded');
}

// Hamburger: funciona en móvil (slide overlay) y tablet (expand/collapse)
function toggleSidebar() {
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('sidebar-overlay');
  const main    = document.querySelector('.main');
  if (!sidebar) return;

  if (window.innerWidth <= 768) {
    // Móvil: deslizar como overlay
    const isOpen = sidebar.classList.contains('mobile-open');
    sidebar.classList.toggle('mobile-open', !isOpen);
    if (overlay) overlay.classList.toggle('show', !isOpen);
  } else {
    // Tablet: expandir/colapsar (los ítems del sidebar tienen nav-label)
    const isExpanded = sidebar.classList.contains('tablet-expanded');
    sidebar.classList.toggle('tablet-expanded', !isExpanded);
    if (main)    main.classList.toggle('tablet-expanded', !isExpanded);
    if (overlay) overlay.classList.toggle('show', !isExpanded);
  }
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

// ═══════════════════════════════════════════════════════════
// ALERTAS LUMINOSAS — destello neón para contenido nuevo/cambiado
// ───────────────────────────────────────────────────────────
// destellar(el): resalta un elemento con un brillo neón naranja.
// destellarNuevos(key, contenedor, selector): tras un re-render, hace
//   destellar solo los ítems cuyo data-id no estaba en el render anterior
//   (la primera vez solo registra, para no destellar todo de golpe).
// ═══════════════════════════════════════════════════════════
function destellar(el) {
  if (!el || !el.classList) return;
  el.classList.remove('destello-nuevo');
  void el.offsetWidth;            // reinicia la animación si ya estaba
  el.classList.add('destello-nuevo');
  clearTimeout(el._destelloT);
  el._destelloT = setTimeout(() => el.classList.remove('destello-nuevo'), 2600);
}

const _destelloVistos = {};
function destellarNuevos(key, contenedor, selector) {
  if (!contenedor) return;
  const items = contenedor.querySelectorAll(selector);
  const actuales = new Set();
  const vistos = _destelloVistos[key];
  items.forEach(it => {
    const id = it.dataset ? (it.dataset.destelloId || it.dataset.oid || it.dataset.id) : null;
    if (!id) return;
    actuales.add(id);
    if (vistos && !vistos.has(id)) destellar(it);   // nuevo desde el último render
  });
  _destelloVistos[key] = actuales;                   // 1ª vez: solo registra
}

// Al abrir una sección, resalta los ítems que el usuario NO había visto antes
// (recuerda lo visto en localStorage). La 1ª vez solo registra, sin destellar todo.
function destellarPendientes(key, contenedor, selector) {
  if (!contenedor) return;
  const lsKey = 'destello_seen_' + key;
  let seen;
  try { seen = new Set(JSON.parse(localStorage.getItem(lsKey) || 'null')); } catch (e) { seen = null; }
  const primeraVez = !(seen instanceof Set);
  if (primeraVez) seen = new Set();
  const items = contenedor.querySelectorAll(selector);
  items.forEach(it => {
    const id = it.dataset ? (it.dataset.destelloId || it.dataset.oid || it.dataset.id) : null;
    if (!id) return;
    if (!primeraVez && !seen.has(id)) destellar(it);   // novedad desde la última vez
    seen.add(id);
  });
  try { localStorage.setItem(lsKey, JSON.stringify([...seen])); } catch (e) {}
}

// ═══════════════════════════════════════════════════════════
// ACTUALIZACIÓN SIN PARPADEO (morph del DOM)
// ───────────────────────────────────────────────────────────
// Reemplaza el clásico `cont.innerHTML = html` en pantallas que se
// refrescan por temporizador. En vez de destruir y reconstruir todo el
// subárbol (lo que causa el "flash" tipo F5, el salto de scroll y la
// pérdida de foco), recorre el DOM existente y solo toca lo que cambió:
// texto, atributos y nodos añadidos/eliminados. Mismo efecto que taller.js
// pero genérico. Ante cualquier error cae de vuelta a innerHTML.
// ═══════════════════════════════════════════════════════════
function renderSinParpadeo(target, html) {
  if (!target) return;
  try {
    const tpl = document.createElement('template');
    tpl.innerHTML = html;
    _morphHijos(target, tpl.content);
  } catch (e) {
    console.warn('[render] morph falló, fallback innerHTML:', e);
    target.innerHTML = html;
  }
}

function _mismoTipoNodo(a, b) {
  if (a.nodeType !== b.nodeType) return false;
  if (a.nodeType === 1) return a.tagName === b.tagName;
  return true;
}

function _morphHijos(viejoPadre, nuevoPadre) {
  let viejo = viejoPadre.firstChild;
  let nuevo = nuevoPadre.firstChild;
  while (nuevo) {
    const sigNuevo = nuevo.nextSibling;
    if (!viejo) {
      viejoPadre.appendChild(document.importNode(nuevo, true));
    } else {
      const sigViejo = viejo.nextSibling;
      if (!_mismoTipoNodo(viejo, nuevo)) {
        viejoPadre.replaceChild(document.importNode(nuevo, true), viejo);
      } else {
        _morphNodo(viejo, nuevo);
      }
      viejo = sigViejo;
    }
    nuevo = sigNuevo;
  }
  // Eliminar nodos viejos sobrantes
  while (viejo) {
    const sig = viejo.nextSibling;
    viejoPadre.removeChild(viejo);
    viejo = sig;
  }
}

function _morphNodo(viejo, nuevo) {
  // Texto / comentario: solo actualizar el valor si cambió
  if (viejo.nodeType === 3 || viejo.nodeType === 8) {
    if (viejo.nodeValue !== nuevo.nodeValue) viejo.nodeValue = nuevo.nodeValue;
    return;
  }
  if (viejo.nodeType !== 1) return;

  // No tocar un campo que el usuario está editando en este momento
  if (viejo === document.activeElement &&
      ['INPUT', 'TEXTAREA', 'SELECT'].includes(viejo.tagName)) return;

  _morphAttrs(viejo, nuevo);

  // No re-sincronizar el value/checked en vivo de inputs (lo maneja el usuario)
  if (['INPUT', 'TEXTAREA'].includes(viejo.tagName)) return;

  _morphHijos(viejo, nuevo);
}

function _morphAttrs(viejo, nuevo) {
  const nAttrs = nuevo.attributes;
  for (let i = 0; i < nAttrs.length; i++) {
    const a = nAttrs[i];
    if (viejo.getAttribute(a.name) !== a.value) viejo.setAttribute(a.name, a.value);
  }
  const vAttrs = viejo.attributes;
  for (let i = vAttrs.length - 1; i >= 0; i--) {
    const name = vAttrs[i].name;
    if (!nuevo.hasAttribute(name)) viejo.removeAttribute(name);
  }
}

// Muestra un placeholder de carga SOLO si el contenedor está vacío (primera
// carga). En refrescos automáticos conserva el contenido actual para evitar
// el flash "Cargando…" → contenido en cada tick del temporizador.
function mostrarCargandoSiVacio(cont, html) {
  if (!cont) return;
  const soloPlaceholder = cont.children.length <= 1 &&
    (cont.querySelector('.loading-state') || cont.querySelector('.empty-state'));
  if (!cont.textContent.trim() || soloPlaceholder) cont.innerHTML = html;
}