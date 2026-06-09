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
  { key:'ver_flotillas',       label:'Ver flotillas',                      grupo:'Más' },
  { key:'ver_aseguradoras',    label:'Ver aseguradoras',                   grupo:'Más' },
];

let mecanicos = [];
let ordenActual = null;
let filtroEstado = 'Activa';
let modalOrdenId = null;
let srvSeleccionados = [];
let modalPaso = 1;
let fotosIngresoPendientes = [];
let aprobEtapaId = null;
let todasCotizaciones = [];

const CATALOGO = {
  latoneria: {
    nombre: 'Latonería', clase: 'latoneria',
    etapas: [
      { key: 'lat_desarmado', nombre: 'Desarmado', esDesarmado: true },
      { key: 'lat_tapiceria', nombre: 'Tapicería' },
      { key: 'lat_latoneria', nombre: 'Latonería' },
      { key: 'lat_blindaje',  nombre: 'Blindaje' },
      { key: 'lat_vidrieria', nombre: 'Vidriería' },
      { key: 'lat_alistador', nombre: 'Alistador' },
      { key: 'lat_armado',    nombre: 'Armado', esArmado: true },
      { key: 'lat_tot',       nombre: 'T.O.T', tot: true },
    ]
  },




  pintura: {
    nombre: 'Pintura', clase: 'pintura',
    etapas: [
      { key: 'pin_alistador', nombre: 'Alistador' },
      { key: 'pin_pintor',    nombre: 'Pintor' },
      { key: 'pin_tot',       nombre: 'T.O.T', tot: true },
    ]
  },
  mecanica: {
    nombre: 'Mecánica', clase: 'mecanica',
    etapas: [
      { key: 'mec_mecanica',  nombre: 'Mecánica' },
      { key: 'mec_electrica', nombre: 'Eléctrica' },
      { key: 'mec_tot',       nombre: 'T.O.T', tot: true },
    ]
  },
  adicionales: {
    nombre: 'Adicionales', clase: 'adicionales',
    etapas: [
      { key: 'adi_polarizados', nombre: 'Polarizados' },
      { key: 'adi_radio',       nombre: 'Radio' },
      { key: 'adi_lavado',      nombre: 'Lavado' },
      { key: 'adi_tot',         nombre: 'T.O.T', tot: true },
      { key: 'adi_otro',        nombre: 'Otro', otro: true },
    ]
  }
};

const INV_LABELS = {
  llantas: '4 Llantas', llanta_repuesto: 'Llanta repuesto', gato: 'Gato',
  radio: 'Radio/Pantalla', documentos: 'Documentos', tapetes: 'Tapetes',
  herramientas: 'Herramientas', extintor: 'Extintor'
};

const CAPACIDAD_TALLER = 34;