// ═══════════════════════════════════════════════════════════
// ESTADO GLOBAL
// ═══════════════════════════════════════════════════════════
let sesion = null;

// Cambiar a true DESPUÉS de crear todos los usuarios en Supabase Auth.
// Con true: solo 'taller' puede entrar sin Supabase Auth.
// Con false: todos pueden entrar con login legacy (modo transición).
const MODO_ESTRICTO_AUTH = true;

// Helper: true si el usuario logueado tiene permisos de administración del taller
function esJefe() { return sesion?.perfil === 'jefe' || sesion?.perfil === 'gerente'; }

// Helper: verifica si el usuario tiene un permiso específico.
// Jefe/Gerente siempre tienen todo. Roles personalizados usan sesion.permisos.
function tienePermiso(p) {
  if (esJefe()) return true;
  return !!(sesion?.permisos?.[p]);
}

// Catálogo de permisos disponibles para roles personalizados
const PERMISOS_CATALOGO = [
  { key:'ver_dashboard',       label:'Ver dashboard general',              grupo:'Dashboard' },
  { key:'ver_ordenes',         label:'Ver órdenes de trabajo',             grupo:'Órdenes' },
  { key:'crear_ordenes',       label:'Crear nuevas órdenes',               grupo:'Órdenes' },
  { key:'editar_ordenes',      label:'Editar datos de órdenes',            grupo:'Órdenes' },
  { key:'aprobar_calidad',     label:'Aprobar calidad de etapas',          grupo:'Órdenes' },
  { key:'agregar_etapas',      label:'Agregar etapas a órdenes',           grupo:'Órdenes' },
  { key:'ver_precios',         label:'Ver precios e importes',             grupo:'Órdenes' },
  { key:'ver_cotizaciones',    label:'Ver cotizaciones',                   grupo:'Cotizaciones' },
  { key:'crear_cotizaciones',  label:'Crear y editar cotizaciones',        grupo:'Cotizaciones' },
  { key:'ver_calendario',      label:'Ver calendario de programación',     grupo:'Herramientas' },
  { key:'ver_mecanicos',       label:'Ver operarios activos',              grupo:'Herramientas' },
  { key:'ver_repuestos',       label:'Ver inventario de repuestos',        grupo:'Repuestos' },
  { key:'gestionar_repuestos', label:'Agregar y editar repuestos',         grupo:'Repuestos' },
  { key:'ver_reportes',        label:'Ver reportes y estadísticas',        grupo:'Reportes' },
  { key:'ver_encuestas',       label:'Ver encuestas de satisfacción',      grupo:'Reportes' },
  { key:'gestionar_encuestas', label:'Registrar/editar encuestas',         grupo:'Reportes' },
  { key:'ver_calificaciones',  label:'Ver calificaciones y satisfacción',  grupo:'Reportes' },
  { key:'ver_flotillas',       label:'Ver flotillas',                      grupo:'Más' },
  { key:'ver_aseguradoras',    label:'Ver aseguradoras',                   grupo:'Más' },
  { key:'ver_caja',            label:'Ver caja',                           grupo:'Más' },
];

let mecanicos = [];
let ordenActual = null;
let filtroEstado = 'Activa';
let _filtroOrdenesForzado = false; // true cuando el dashboard navega con un filtro específico
let modalOrdenId = null;
let srvSeleccionados = [];
let modalPaso = 1;
let fotosIngresoPendientes = [];
let aprobEtapaId = null;
let todasCotizaciones = [];

// Asignación de técnico por ETAPA (no por servicio):
//   - TOT (adi_tot) → siempre externo: nombre a mano.
//   - Electrónica (mec_electronica) → se pregunta si es interno (lista) o externo (texto).
//   - El resto → lista desplegable de técnicos del taller.
// La lógica vive en _modoTecnico() en ordenes-nueva.js.
const CATALOGO = {
  latoneria: {
    nombre: 'Latonería', clase: 'latoneria',
    etapas: [
      { key: 'lat_desarmado',  nombre: 'Desarmado', esDesarmado: true },
      { key: 'lat_reparacion', nombre: 'Reparación' },
      { key: 'lat_armado',     nombre: 'Armado', esArmado: true },
    ]
  },
  pintura: {
    nombre: 'Pintura', clase: 'pintura',
    etapas: [
      { key: 'pin_alistador', nombre: 'Alistador', esAlistador: true },
      { key: 'pin_pintor',    nombre: 'Pintor' },
      { key: 'pin_brillador', nombre: 'Brillador', esBrillador: true },
    ]
  },
  mecanica: {
    nombre: 'Mecánica', clase: 'mecanica',
    etapas: [
      { key: 'mec_mecanica',    nombre: 'Mecánica' },
      { key: 'mec_electronica', nombre: 'Electrónica' },
    ]
  },
  adicionales: {
    nombre: 'Adicionales', clase: 'adicionales',
    etapas: [
      { key: 'adi_alineacion', nombre: 'Alineación' },
      { key: 'adi_polarizado', nombre: 'Polarizado' },
      { key: 'adi_lavado',     nombre: 'Lavado' },
      { key: 'adi_tot',        nombre: 'TOT' },
    ]
  },
  embellecimiento: {
    nombre: 'Embellecimiento', clase: 'embellecimiento',
    etapas: [
      { key: 'emb_embellecimiento', nombre: 'Embellecimiento' },
    ]
  }
};

const INV_LABELS = {
  llantas: '4 Llantas', llanta_repuesto: 'Llanta repuesto', gato: 'Gato',
  radio: 'Radio/Pantalla', documentos: 'Documentos', tapetes: 'Tapetes',
  herramientas: 'Herramientas', extintor: 'Extintor'
};

const CAPACIDAD_TALLER = 36;

// Origen del ingreso ("¿Cómo nos conoció?") — para segmentar de dónde viene
// cada vehículo y medir campañas (p. ej. un evento). Editable: agrega/quita.
const ORIGEN_OPCIONES = [
  'Recomendado',
  'Redes sociales',
  'Google',
  'Evento',
  'Aseguradora / convenio',
  'Cliente frecuente',
  'Pasaba por el taller',
  'Otro'
];
// Opciones como <option> (con uno seleccionado). Vacío = "— ¿Cómo nos conoció? —".
function origenOptionsHtml(sel) {
  return '<option value="">— ¿Cómo nos conoció? —</option>' +
    ORIGEN_OPCIONES.map(o => `<option value="${o}" ${sel === o ? 'selected' : ''}>${o}</option>`).join('');
}