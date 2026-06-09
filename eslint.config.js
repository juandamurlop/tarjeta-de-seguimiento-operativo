const js = require('@eslint/js');

module.exports = [
  js.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'script',
      globals: {
        // ── Browser APIs ──────────────────────────────────────
        window: 'readonly',
        document: 'readonly',
        console: 'readonly',
        fetch: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        setInterval: 'readonly',
        clearInterval: 'readonly',
        requestAnimationFrame: 'readonly',
        getComputedStyle: 'readonly',
        alert: 'readonly',
        confirm: 'readonly',
        prompt: 'readonly',
        location: 'readonly',
        navigator: 'readonly',
        URL: 'readonly',
        URLSearchParams: 'readonly',
        FormData: 'readonly',
        FileReader: 'readonly',
        File: 'readonly',
        Blob: 'readonly',
        Image: 'readonly',
        Audio: 'readonly',
        MouseEvent: 'readonly',
        SpeechSynthesisUtterance: 'readonly',
        Set: 'readonly',
        Map: 'readonly',
        Promise: 'readonly',
        MutationObserver: 'readonly',
        IntersectionObserver: 'readonly',
        localStorage: 'readonly',
        sessionStorage: 'readonly',

        // ── Librerías CDN ─────────────────────────────────────
        jspdf: 'readonly',
        jsPDF: 'readonly',
        XLSX: 'readonly',

        // ── config.js ─────────────────────────────────────────
        CONFIG: 'readonly',

        // ── api.js ────────────────────────────────────────────
        api: 'readonly',
        storageUpload: 'readonly',
        SUPABASE_URL: 'readonly',
        SUPABASE_KEY: 'readonly',
        BUCKET: 'readonly',
        N8N_WEBHOOK: 'readonly',
        supabaseLogin: 'readonly',
        supabaseSignOut: 'readonly',
        supabaseSignUp: 'readonly',
        supabaseRefreshToken: 'readonly',
        _getBearer: 'readonly',

        // ── state.js ──────────────────────────────────────────
        sesion: 'writable',
        mecanicos: 'writable',
        ordenActual: 'writable',
        filtroEstado: 'writable',
        modalOrdenId: 'writable',
        srvSeleccionados: 'writable',
        modalPaso: 'writable',
        fotosIngresoPendientes: 'writable',
        aprobEtapaId: 'writable',
        todasCotizaciones: 'writable',
        CATALOGO: 'readonly',
        INV_LABELS: 'readonly',
        CAPACIDAD_TALLER: 'readonly',
        PERMISOS_CATALOGO: 'readonly',
        tienePermiso: 'readonly',
        esJefe: 'readonly',

        // ── auth.js ───────────────────────────────────────────
        doLogin: 'readonly',
        logout: 'readonly',
        refrescarToken: 'readonly',
        checkSesionGuardada: 'readonly',
        toggleModoCliente: 'readonly',
        toggleLoginPass: 'readonly',

        // ── app.js ────────────────────────────────────────────
        montarApp: 'readonly',
        montarJefe: 'readonly',
        montarMecanico: 'readonly',
        montarCliente: 'readonly',
        montarMonitor: 'readonly',
        esVistaMonitor: 'readonly',
        mostrarPagina: 'readonly',
        mostrarVista: 'writable',
        renderVista: 'writable',
        navJefe: 'writable',
        closeSidebar: 'readonly',
        cerrarLightbox: 'readonly',
        selTipoCliente: 'readonly',

        // ── utils.js ──────────────────────────────────────────
        toast: 'readonly',
        formatCOP: 'readonly',
        formatFecha: 'readonly',
        formatOT: 'readonly',
        formatTS: 'readonly',
        durHumana: 'readonly',
        escapeHtml: 'readonly',
        safeUrl: 'readonly',
        ocrLeerTarjeta: 'readonly',
        ico: 'readonly',
        kid: 'readonly',
        renderSinParpadeo: 'readonly',
        mostrarCargandoSiVacio: 'readonly',
        destellarNuevos: 'readonly',
        destellarPendientes: 'readonly',
        switchDashTab: 'readonly',

        // ── ordenes-*.js (referencias cruzadas entre módulos) ─
        ROL_LABEL: 'readonly',
        _bloqueEntrega: 'readonly',
        _bloquePreliqCierre: 'readonly',
        _calcPulmonTiempo: 'readonly',
        _ordenCompletandoId: 'writable',
        _refrescarCapacidad: 'readonly',
        _resetWizard: 'readonly',
        _waNumero: 'readonly',
        cambiarEstado: 'readonly',
        cargarMecanicosVista: 'readonly',
        cargarOrdenes: 'readonly',
        cargarVehiculos: 'readonly',
        cerrarSugerenciasPlaca: 'readonly',
        iniciarSistemaAlertas: 'readonly',
        renderPreviewIngreso: 'readonly',
        resetNuevaOrden: 'readonly',

        // ── ordenes.js ────────────────────────────────────────
        montarIngresoParticular: 'readonly',
        abrirOrden: 'readonly',
        buscarPorPlaca: 'readonly',
        recargarListasNuevaOrden: 'readonly',
        otDe: 'readonly',
        detenerRealtime: 'readonly',
        iniciarRealtime: 'readonly',
        cargarOrdenesPulmon: 'readonly',
        _getPinCierre: 'readonly',
        pedirPin: 'readonly',
        _citaInfo: 'readonly',
        _navMarcarVisto: 'readonly',
        _setNavBadge: 'readonly',

        // ── taller.js ─────────────────────────────────────────
        montarTaller: 'readonly',
        actualizarCapacidad: 'readonly',

        // ── taller-kpi.js ─────────────────────────────────────
        montarTallerKPI: 'readonly',
        cargarKPITaller: 'readonly',

        // ── mecanico.js ───────────────────────────────────────
        cargarEtapasMecanico: 'readonly',

        // ── cotizaciones.js ───────────────────────────────────
        cargarCotizaciones: 'readonly',
        _cotPdfConfig: 'readonly',

        // ── repuestos.js ──────────────────────────────────────
        montarRepuestos: 'readonly',
        cargarRepuestosJefe: 'readonly',
        abrirModalSolicitudRepuesto: 'readonly',

        // ── reportes.js ───────────────────────────────────────
        montarReportes: 'readonly',
        abrirModalReporte: 'readonly',

        // ── metas.js ──────────────────────────────────────────
        cargarDashboardMetas: 'readonly',

        // ── ventas.js ─────────────────────────────────────────
        cargarVistaVentas: 'readonly',

        // ── flotillas.js ──────────────────────────────────────
        montarFlotillas: 'readonly',
        montarCarteraFlotillas: 'readonly',

        // ── aseguradoras.js ───────────────────────────────────
        montarAseguradoras: 'readonly',
        cargarModuloAseguradoras: 'readonly',
        resetVistaAseguradoras: 'readonly',
        renderDatosAseguradora: 'readonly',
        renderSeccionAseguradora: 'readonly',
        agregarNuevaAsegNueva: 'readonly',
        _asegKpi: 'readonly',
        _asegRentabilidad: 'writable',
        _calcularRentabilidadAseg: 'readonly',
        _leerDatosAseg: 'readonly',
        ESTADOS_ASEG: 'readonly',

        // ── cartera-cliente.js ────────────────────────────────
        montarCarteraEmpresas: 'readonly',
        resetVistaCartera: 'readonly',

        // ── cliente.js ────────────────────────────────────────
        cargarMecanicos: 'readonly',

        // ── consumibles.js ────────────────────────────────────
        _cargarConsumiblesSidebar: 'readonly',
        CONSUMIBLES_CONFIG: 'readonly',

        // ── dashboard.js ──────────────────────────────────────
        nombre: 'readonly',
      }
    },
    rules: {
      // Bugs reales
      'no-undef': 'error',
      'no-unreachable': 'error',
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      'no-constant-condition': 'error',
      'no-duplicate-case': 'error',
      'no-self-assign': 'error',
      'use-isnan': 'error',

      // Async/await
      'no-async-promise-executor': 'error',
      'no-await-in-loop': 'warn',

      // Estilo
      'eqeqeq': ['warn', 'smart'],
      'no-var': 'warn',
      'prefer-const': 'warn',

      // Desactivadas — código legacy sin módulos
      'no-redeclare': 'off',
    }
  },
  {
    ignores: ['node_modules/', 'js/config.js']
  }
];
