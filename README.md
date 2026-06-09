# Freimanautos — Sistema Operativo

Sistema de gestión operativa para talleres automotrices. Permite administrar órdenes de trabajo, etapas de reparación, flotillas, cotizaciones, mecánicos y KPIs del taller en tiempo real.

Construido como **PWA** (Progressive Web App): funciona en el navegador, se puede instalar en el celular y tiene soporte offline básico.

---

## Stack tecnológico

| Capa | Tecnología |
|------|-----------|
| Frontend | Vanilla JavaScript, HTML5, CSS3 |
| Base de datos | Supabase (PostgreSQL) |
| Autenticación | Supabase Auth (JWT) |
| Almacenamiento | Supabase Storage |
| Automatizaciones | n8n (webhooks a Telegram, PDF) |
| Despliegue | Docker + Nginx |
| Calidad de código | ESLint 9, Prettier |

---

## Estructura del proyecto

```
appProcesos/
├── assets/
│   ├── audio/          ← motor.mp3 (sonido taller)
│   └── icons/          ← iconos PWA y favicons
├── css/
│   ├── main.css        ← punto de entrada (importa los demás)
│   ├── base.css        ← variables CSS y reset
│   ├── layout.css      ← sidebar, login, topbar
│   ├── components.css  ← botones, modales, formularios
│   ├── ordenes.css     ← estilos del módulo de órdenes
│   ├── cotizaciones.css
│   └── vistas.css      ← dashboard, reportes, demás vistas
├── docker/
│   └── nginx.conf      ← configuración Nginx para producción
├── docs/
│   └── GUIA-DEL-SISTEMA.md
├── js/
│   ├── config.js          ← credenciales (NO subir al repo)
│   ├── config.example.js  ← plantilla para configurar
│   ├── core/              ← motor de la app
│   │   ├── api.js         ← cliente HTTP a Supabase
│   │   ├── app.js         ← bootstrap y enrutamiento
│   │   ├── auth.js        ← login, logout, sesión
│   │   ├── state.js       ← estado global compartido
│   │   └── utils.js       ← helpers reutilizables
│   ├── ordenes/           ← módulo de órdenes (dividido por responsabilidad)
│   │   ├── ordenes-lista.js
│   │   ├── ordenes-detalle.js
│   │   ├── ordenes-nueva.js
│   │   ├── ordenes-jefe.js
│   │   └── ordenes-sistema.js
│   └── views/             ← una vista por archivo
│       ├── dashboard.js
│       ├── cotizaciones.js
│       ├── taller.js
│       ├── mecanico.js
│       └── ... (10 más)
├── supabase/
│   └── functions/      ← Edge Functions (OCR tarjeta)
├── Dockerfile
├── index.html          ← punto de entrada de la app
├── manifest.webmanifest
├── service-worker.js
├── package.json
└── iniciar.bat         ← script de arranque local
```

---

## Configuración inicial

### 1. Clonar el repositorio

```bash
git clone <url-del-repo>
cd appProcesos
```

### 2. Crear el archivo de configuración

```bash
# Copiar la plantilla
copy js\config.example.js js\config.js
```

Editar `js/config.js` con las credenciales reales:

```js
const CONFIG = {
  SUPABASE_URL: 'https://TU_PROYECTO.supabase.co',
  SUPABASE_KEY: 'TU_ANON_KEY',           // Settings → API en supabase.com
  BUCKET: 'fotos-etapas',
  N8N_WEBHOOK_ETAPA:    'https://TU_N8N/webhook/notificar-etapa',
  N8N_WEBHOOK_PDF:      'https://TU_N8N/webhook/cotizacion-pdf',
  N8N_WEBHOOK_REPUESTO: 'https://TU_N8N/webhook/notificar-etapa',
};
```

> ⚠️ `js/config.js` está en `.gitignore` — nunca se sube al repositorio.

### 3. Instalar dependencias de desarrollo

```bash
npm install
```

Esto instala ESLint y Prettier (solo para desarrollo, no afecta la app en producción).

---

## Correr localmente

### Opción A — Script de arranque

```bash
iniciar.bat
```

### Opción B — VS Code Live Server

1. Abrir la carpeta en VS Code
2. Instalar la extensión **Live Server**
3. Click en `Go Live` en la barra inferior

### Opción C — Docker (igual que producción)

```bash
docker build -t freimanautos .
docker run -p 8080:80 freimanautos
# Abrir: http://localhost:8080
```

---

## Comandos de calidad de código

```bash
# Verificar errores en todo el JS
npm run lint

# Corregir automáticamente lo que se pueda
npm run lint:fix

# Formatear JS y CSS
npm run format

# Solo verificar formato sin modificar
npm run format:check
```

---

## Despliegue en producción

La app se sirve como archivos estáticos desde Nginx dentro de un contenedor Docker.

```bash
# Build de la imagen
docker build -t freimanautos .

# Correr en producción
docker run -d -p 80:80 --name freimanautos freimanautos
```

La configuración de Nginx (`docker/nginx.conf`) incluye:
- Headers de seguridad (CSP, X-Frame-Options, X-Content-Type)
- Compresión gzip
- Cache de assets estáticos

---

## Variables de entorno necesarias

| Variable | Dónde obtenerla |
|----------|----------------|
| `SUPABASE_URL` | supabase.com → Settings → API → Project URL |
| `SUPABASE_KEY` | supabase.com → Settings → API → anon/public key |
| `BUCKET` | Nombre del bucket en Supabase Storage |
| `N8N_WEBHOOK_ETAPA` | URL del workflow de notificación de etapas en n8n |
| `N8N_WEBHOOK_PDF` | URL del workflow de generación de PDF en n8n |
| `N8N_WEBHOOK_REPUESTO` | URL del workflow de solicitud de repuestos en n8n |

---

## Perfiles de usuario

| Perfil | Acceso |
|--------|--------|
| `jefe` / `gerente` | Todo el sistema |
| `mecanico` | Sus órdenes y etapas asignadas |
| `cliente` | Consulta de su vehículo |
| `taller` | Pantalla de taller (monitor) |
| `repuestos` | Módulo de repuestos |
