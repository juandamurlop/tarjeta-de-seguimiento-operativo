# Guía del Sistema — Freimanautos

Manual de uso e interpretación de cada apartado de la aplicación de gestión operativa del taller. Explica **cómo funciona** cada módulo y **cómo leer** cada indicador del dashboard.

---

## Índice
1. [Conceptos base](#1-conceptos-base)
2. [Pantalla de Taller (TV)](#2-pantalla-de-taller-tv)
3. [Órdenes](#3-órdenes)
4. [Etapas y proceso de trabajo](#4-etapas-y-proceso-de-trabajo)
5. [Pulmón](#5-pulmón)
6. [Capacidad del taller](#6-capacidad-del-taller)
7. [Gestión Operativa (KPIs en tiempo real)](#7-gestión-operativa-kpis-en-tiempo-real)
8. [Sistema de Alertas](#8-sistema-de-alertas)
9. [Registro: Ingreso Particular e Ingreso Flotilla](#9-registro)
10. [Cotizaciones](#10-cotizaciones)
11. [Repuestos](#11-repuestos)
12. [Consumibles y documentos](#12-consumibles-y-documentos)
13. [Informes › Dashboard mes actual](#13-informes--dashboard-mes-actual)
14. [Informes › Metas y Ventas](#14-informes--metas-y-ventas)
15. [Informes › Reportes](#15-informes--reportes)
16. [Aseguradoras](#16-aseguradoras)
17. [Anexos: fórmulas, colores y glosario](#17-anexos)

---

## 1. Conceptos base

### Roles
Cada usuario entra con su cédula y ve solo lo que le corresponde:
- **Jefe / Gerente:** acceso total (órdenes, informes, aseguradoras, gestión operativa, metas).
- **Mecánico / Técnico:** su lista de trabajo y registro de etapas.
- **Repuestos:** gestión de solicitudes de repuestos.
- **Pantalla taller (TV):** vista de solo lectura para el televisor del taller.
- **Asesor comercial:** cotizaciones e ingresos.
- **Cliente:** seguimiento de su propio vehículo.

### Tiempo real (sin recargar)
Las pantallas se **actualizan solas** cada cierto tiempo (la lista de órdenes y los dashboards cada 30 s; Gestión Operativa cada 60 s). La actualización es **suave**: solo cambia lo que realmente cambió, sin "parpadeo" ni saltos de scroll. No necesitas presionar F5.

### Lectura de semáforos (colores)
A lo largo del sistema, los colores significan lo mismo:
- 🟢 **Verde** — bien / dentro de meta / sin alerta.
- 🟡 **Amarillo / Naranja** — atención / empieza a demorarse.
- 🔴 **Rojo** — crítico / vencido / requiere acción inmediata.

---

## 2. Pantalla de Taller (TV)

Vista pensada para un televisor en el taller. Muestra en grande:
- **Tira de KPIs del día:** órdenes activas, entregadas hoy, ingresaron hoy, en proceso ahora, programadas, en pulmón.
- **Tabla de órdenes activas** con sus etapas, técnico, tiempo en curso y entrega.
- **Panel "Listos hoy"** (vehículos terminados/listos para entrega) y **"Programadas"**.
- **Franja de pulmón** abajo.

Cuando un vehículo queda **listo** o se **entrega**, suena un aviso y se anuncia la placa por voz. Se actualiza sola cada 10 segundos.

---

## 3. Órdenes

Es el corazón del sistema. Cada orden = un vehículo en el taller.

### Lista de órdenes
Tabla con: **Placa / OT**, vehículo, **etapa actual**, responsable, fecha de entrega estimada, **días en taller** y **estado**.

Estados (pill de color):
- **A tiempo** (verde) / **Atrasada** (roja, si pasó la fecha de entrega).
- **Entregada**, **Programada**, **En pulmón**.

El aviso **"⚠ Faltan datos"** indica que la orden no tiene nombre, marca, línea o teléfono completos.

Filtros arriba: Activa / Programada / Entregada / Pulmón. La barra de búsqueda filtra por placa, propietario, técnico, marca o línea.

### Detalle de una orden
Al hacer clic se abre el detalle con: datos del vehículo y cliente, fotos, **etapas de trabajo**, cotización/preliquidación, consumibles, y —si es de aseguradora— el panel de datos de aseguradora.

---

## 4. Etapas y proceso de trabajo

El trabajo de cada vehículo se divide en **etapas** (latonería, pintura, mecánica, etc.). Cada etapa tiene:
- Un **técnico asignado**.
- **Inicio** y **fin** (el técnico las marca; el tiempo se cuenta solo).
- **Valor** (lo que factura esa etapa).
- **Pausa** (se puede pausar; el tiempo en pausa no cuenta).
- **Aprobación de calidad** (el jefe aprueba antes de marcarla lista).

Una orden está **"Lista para entrega"** cuando **todas** sus etapas están finalizadas **y** aprobadas en calidad.

---

## 5. Pulmón

El "pulmón" es donde se aparcan vehículos que están en el taller pero **detenidos** (por ejemplo, esperando repuestos o autorización). Hay dos tipos:
- **Pulmón interno** — ocupa cupo del taller.
- **Pulmón externo** — fuera del taller (no ocupa cupo).

Se registra desde el detalle de la orden con el botón **Pulmón**, y queda el conteo de **días en pulmón** (útil para cobrar estadía en aseguradoras).

---

## 6. Capacidad del taller

En la barra lateral hay un **donut de capacidad**: el taller tiene **34 cupos fijos**.
- El arco **amarillo** = vehículos activos.
- El arco **naranja** = vehículos en pulmón interno.
- El centro muestra el **% de ocupación** y "X de 34 cupos".

**Al hacer clic en el donut** se abre un panel con el detalle segmentado:
- 🔴 **En operación** — con etapa activa (con cronómetro en vivo).
- 🟡 **Quietos** — en el taller pero sin etapa activa (esperando trabajo).
- 🟠 **En pulmón** — detenidos, con el tiempo acumulado.
- 🟣 **Programados** — próximas llegadas.

Desde ahí puedes ver cada vehículo, su cliente y su etapa.

---

## 7. Gestión Operativa (KPIs en tiempo real)

Pantalla de control del jefe. Se actualiza sola cada 60 s. Tiene tres bloques:

### Resumen (arriba)
- **Órdenes activas** — total en proceso.
- **Etapas en proceso** — etapas iniciadas y sin terminar ahora mismo.
- **Técnicos activos** — cuántos están trabajando.
- **Repuestos pendientes** — solicitudes sin entregar.

### Las 8 tarjetas KPI (cada una con semáforo y clic para ver detalle)

| # | KPI | Qué mide | Cuándo se pone rojo |
|---|---|---|---|
| 1 | **Sin técnico asignado** | Órdenes activas sin ningún técnico en sus etapas | Más de 3 órdenes, o alguna lleva +4 h |
| 2 | **Etapas sin iniciar** | Etapas ya asignadas a un técnico que no han arrancado | +5 etapas, o alguna lleva +3 h esperando |
| 3 | **Entretiempos activos** | Vehículos parados entre una etapa y la siguiente (>30 min) | Brechas largas (+4 h) |
| 4 | **Repuestos atascados** | Solicitudes de repuesto que pasaron su tiempo límite según su estado | Solicitudes muy viejas (+48 h) |
| 5 | **Órdenes vencidas** | Órdenes cuya fecha de entrega ya pasó | Cualquier orden vencida |
| 6 | **Prom. asignación → arranque** | Tiempo promedio entre asignar una etapa y que el técnico la inicie | (indicador de agilidad) |
| 7 | **Técnicos libres** | Técnicos activos sin etapa en curso | (oportunidad de asignar) |
| 8 | **Sin movimiento +4 h** | Órdenes activas sin ningún avance en más de 4 horas | Cualquiera en esa condición |

**Cómo usarlo:** las tarjetas rojas son tu lista de pendientes del momento. Haz clic en cualquiera para ver **qué vehículos** están en esa situación y cuánto llevan.

### Tabla "Estado de todas las órdenes activas"
Cada orden con su **progreso** (barra y X/Y etapas), técnico activo, fecha de entrega y una columna de **Alertas** (✓ OK si va bien).

> Los umbrales de repuestos por estado: Pendiente jefe (2 h), En gestión (24 h), Cotizado (48 h), Pedido (72 h), En taller (4 h).

---

## 8. Sistema de Alertas

Vigila las etapas en curso y avisa cuando algo lleva mucho tiempo sin moverse:
- **1 hora sin movimiento** → 🟡 popup amarillo discreto (se cierra solo en 30 s).
- **3 horas** → 🟠 popup naranja, más visible.
- **+5 horas** → 🔴 entra a la **lista de "Alertas críticas"** fija en Gestión Operativa.

Revisa automáticamente cada 5 minutos. Máximo 3 popups a la vez y no repite la misma alerta en la sesión. Solo lo ve el jefe/gerente.

---

## 9. Registro

Menú para ingresar vehículos nuevos. Dos apartados:

### Ingreso Particular
Para clientes independientes (no pertenecen a empresa ni flotilla).
- Botón **"Registrar vehículo particular"** → formulario del vehículo (placa, marca, línea, propietario, etc.).
- Abajo, la lista de **"Vehículos particulares registrados"** con búsqueda. Desde cada uno puedes **crear una orden**, **editar** o ver **consumibles/documentos**.
- Los vehículos quedan guardados para agilizar ingresos futuros.

### Ingreso Flotilla
Para empresas, aseguradoras u organizaciones con varios vehículos.
- Lista de flotillas/empresas (cada una con su conteo de vehículos).
- Botón **"Nueva flotilla"** para crear una. Al entrar a una flotilla ves y gestionas todos sus vehículos juntos.

---

## 10. Cotizaciones

Generación de cotizaciones para clientes. Se elige/crea la empresa o cliente, se arman los ítems y servicios, y se genera el documento (PDF). Una cotización aprobada puede pasar a convertirse en orden de trabajo, llevando sus datos.

---

## 11. Repuestos

Flujo de solicitud y compra de repuestos. Cada solicitud avanza por **estados**:

`Pendiente jefe` → `En gestión (enviado a repuestos)` → `Cotizado` → `Pedido` → `En taller (recibido)` → `Entregado`

- El técnico/jefe **solicita** un repuesto desde la etapa.
- El área de repuestos **cotiza** (tabla tipo Excel con proveedores y precios) y registra cuando se **pide** y cuando **llega**.
- Hay un **badge** en el menú con la cantidad de solicitudes pendientes del jefe.

En **Gestión Operativa** (KPI 4) se vigila que ninguna solicitud se quede atascada más de su tiempo límite.

---

## 12. Consumibles y documentos

Por cada vehículo (por placa) se llevan los **consumibles** (aceite, filtros, etc., con su kilometraje/fecha de cambio) y **documentos**. En el detalle de la orden aparece un mini-panel que indica con semáforo si algún consumible está **vencido** (🔴) o **próximo** (🟡). También se accede desde la lista de vehículos registrados (icono 🔧).

---

## 13. Informes › Dashboard mes actual

Vista financiera y operativa del mes en curso. Incluye:
- **Capacidad del taller** (el mismo donut de 34 cupos).
- **Tarjetas KPI** del mes (ingresos, órdenes, etc.).
- **Procesos** por sección.
- Listas de órdenes recientes (clic para abrir cada una).

> Este dashboard mide lo que ocurre **dentro de la app** (etapas facturadas). Para los números **oficiales del contador**, usa *Metas y Ventas* (ver siguiente).

---

## 14. Informes › Metas y Ventas

Reemplaza la antigua pestaña "Metas". Es el **cuadro de seguimiento de ventas del contador** dentro de la app. Tiene dos vistas.

### Datos: de dónde salen
El contador alimenta tres conjuntos de datos por **CSV** (botón **"Cargar datos (contador)"**):
1. **Ventas mensuales** — ventas, # facturas y metas (base e ideal) por mes.
2. **Ventas por servicio** — electricidad, latonería, mecánica, pintura, tapicería, otros (repuestos/insumos) y aseguradora, por año.
3. **Crédito** — datos del préstamo (formulario).

La app **deriva sola** el "mejor año", el "año anterior" y el ritmo (pacing) a partir de esa historia.

### Vista general (lo que ves al entrar)

**Tarjetas principales:**
- **Ventas del mes** — lo vendido en el mes en curso. Debajo: la **meta base** y el **% de cumplimiento** (con semáforo: verde ≥100 %, amarillo ≥70 %, rojo <70 %).
- **Meta ideal** — la meta ambiciosa y qué % de ella se logró.
- **Acumulado año** — ventas sumadas en lo que va del año vs la meta acumulada (con %).
- **vs Año anterior** — cuánto creciste (o caíste) respecto al mismo periodo del año pasado.
- **Facturas / ticket** — número de facturas y **venta promedio por factura** (ticket).

**Barra de "Ritmo del año (pacing)"** — la más importante para saber si vas al día:
- La **barra de color** = qué % del año **ya lograste**.
- La **línea vertical oscura** = dónde **deberías ir** a esta altura del año (según cómo se reparte la meta entre los meses).
- Si la barra **pasa** la línea → **Adelantado** 🟢. Si **no llega** → **Atrasado** 🟡. El número "X pts" es la diferencia.
- *Ejemplo:* "Logrado 36 % · Esperado 36 %" significa que vas exactamente en ritmo.

**Mini tabla mensual** — mes a mes: meta base, ventas y % de ejecución (el mes en curso queda resaltado).

### Vista detallada ("Análisis detallado →")

- **Seguimiento mensual completo:** por mes → meta base, meta ideal, ventas, **% ejecución**, **variación vs meta** (verde si superaste, rojo si faltó), # facturas y ticket promedio.
- **Ventas por servicio (interanual):** cada servicio con sus ventas por año (2023→actual) y la **barra de participación** (qué % del total representa este año). Aquí se ve que el negocio lo mueven sobre todo **Otros** (repuestos/insumos) y **Aseguradora**.
- **Crédito:** desembolsado, cuotas pagadas/totales, capital pendiente, capital pagado e intereses.

> **Cómo interpretar la "ejecución %":** ventas ÷ meta del mes. 100 % = cumpliste la meta. Ojo: un mes puede dar muy alto (ej. 245 %) si su meta era baja, o muy bajo si es el **mes en curso** (aún incompleto).

---

## 15. Informes › Reportes

Reportes históricos y analíticos del taller (producción, tiempos, técnicos, ingresos por periodo). Permite revisar el desempeño más allá del mes actual.

---

## 16. Aseguradoras

Dashboard dedicado al proceso con aseguradoras (estilo del proceso ordenado tipo Vulcania), con control financiero y de rentabilidad.

### Tira de KPIs (arriba)
- **Activos** — órdenes de aseguradora en proceso.
- **Facturado (autorizado)** — suma de los **valores autorizados** por las aseguradoras.
- **Por cobrar** — de lo autorizado, lo que **aún no está pagado** (cartera).
- **Tiempo autorización** — días promedio entre el peritaje y la autorización.
- **Ciclo prom. (mes)** — días promedio desde que entra hasta que se entrega.
- **Rentabilidad neta** y **En pérdida** — ver renta/pérdida abajo.

### Valor de plaza por día (configuración)
Es la **base del cálculo de renta/pérdida**. Escribe cuánto debe generar un cupo del taller al día (ej. `120000`) en el campo de arriba de la lista. Se guarda y al instante aparecen los indicadores de rentabilidad. Si no lo defines, dice *"sin definir — renta/pérdida desactivada"*.

> También puede salir automáticamente de la meta de ingresos del mes (Metas y Ventas), pero el valor escrito a mano **tiene prioridad**.

### Renta / Pérdida por vehículo
La idea: el taller tiene cupos limitados. Un carro que ocupa un cupo **muchos días** pero **factura poco** bloquea una plaza rentable → **pérdida**. Si factura bien para los días que lleva → **renta**.

En cada orden aparece un **badge**:
- 🟢 **+$X** — genera renta (aporta más de lo que cuesta su plaza).
- 🔴 **−$X** — genera pérdida.
- 🟡 **"X d al límite"** — a un carro activo le quedan pocos días antes de cruzar a pérdida (punto de equilibrio).

Pasa el cursor sobre el badge para ver el desglose (ingreso − costo de plaza).

### Segmentación por etapa del proceso
Las órdenes **no** se muestran en lista plana, sino **agrupadas por etapa**, cada bloque con su color y conteo:

`Peritaje pendiente` · `Peritaje enviado` · `En pulmón` · `Pendiente repuestos` · `Repuestos listos` · `En reparación` · `Terminado`

Así ves de un vistazo cuántos carros están esperando autorización, cuántos en reparación, etc.

### Tarjeta de cada orden
Muestra placa/OT, vehículo, propietario, aseguradora, estado, días en sistema, días en pulmón/estadía, resumen de repuestos y una **línea de tiempo** del proceso (peritaje → pulmón → repuestos → reparación → entrega).

### Datos de aseguradora (dentro de cada orden)
En el detalle de la orden hay un panel para registrar: **ajustador**, **fecha de peritaje**, **fecha de autorización**, **valor autorizado**, y **estado de pago** (pendiente / parcial / pagado). Estos datos alimentan los KPIs de **Facturado** y **Por cobrar**.

### Resumen por aseguradora
Abajo, una tarjeta por cada aseguradora con su número de órdenes y ciclo promedio. Clic para filtrar la lista por esa aseguradora.

---

## 17. Anexos

### Fórmulas clave

**Renta / pérdida (aseguradoras):**
```
valor de plaza por día = (manual)  ó  meta de ingresos del mes ÷ (34 cupos × días hábiles)
costo de ocupación     = valor de plaza por día × días en taller
rentabilidad           = ingreso de la orden − costo de ocupación
punto de equilibrio    = ingreso de la orden ÷ valor de plaza por día  (días máx. rentables)
```

**Pacing (Metas y Ventas):**
```
esperado del mes   = meta del mes ÷ meta anual          (cómo se reparte el año)
logrado del mes    = ventas del mes ÷ meta anual
esperado acumulado = suma de "esperado" hasta el mes en curso
logrado acumulado  = suma de "logrado" hasta el mes en curso
ritmo (adelantado/atrasado) = logrado acumulado − esperado acumulado
```

**Ejecución / cumplimiento:**
```
ejecución % = ventas ÷ meta   (100 % = meta cumplida)
ticket promedio = ventas ÷ número de facturas
```

### Leyenda de colores
| Color | Significado |
|---|---|
| 🟢 Verde | Bien · dentro de meta · sin alerta · renta |
| 🟡 Amarillo | Atención · empieza a demorarse · cerca del límite |
| 🟠 Naranja | Demora mayor · pulmón · estadía |
| 🔴 Rojo | Crítico · vencido · pérdida · acción inmediata |
| 🟣 Morado | Programado · aseguradora · informativo |

### Glosario
- **OT** — Orden de Trabajo (número de la orden).
- **Etapa** — cada fase del trabajo (latonería, pintura, mecánica…).
- **Pulmón** — vehículo detenido/aparcado en espera (interno ocupa cupo, externo no).
- **Cupo / plaza** — espacio de trabajo del taller (34 en total).
- **Estadía** — cobro por días que un vehículo permanece detenido (aseguradoras).
- **Peritaje** — revisión del daño por el ajustador de la aseguradora.
- **Valor autorizado** — monto que la aseguradora aprobó pagar.
- **Pacing** — ritmo: si las ventas van adelante o atrás de lo esperado para la fecha.
- **Ticket promedio** — venta promedio por factura.
- **Meta base / ideal** — meta realista / meta ambiciosa del mes.

---

*Guía generada para el sistema de gestión operativa de Freimanautos. Si un apartado cambia, actualiza este documento.*
