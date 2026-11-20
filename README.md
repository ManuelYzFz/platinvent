# PlatInvent - Plataforma de Inventario

Sistema de gestión y control de inventario de dispositivos telemáticos (GPS, MDVR), tarjetas SIM y vehículos, con soporte para modo sin conexión (PWA/IndexedDB), escaneo y generación de códigos QR/barras, e internacionalización multilingüe.

---

## 📦 Registro de Paquetes y Dependencias Instaladas (npm)

A continuación se detalla cada una de las librerías instaladas en el proyecto mediante `npm`, junto con su comando de instalación y propósito en la aplicación:

### 1. Dependencias Principales (`dependencies`)

| Paquete | Versión | Comando de Instalación | Propósito / Uso en el Proyecto |
| :--- | :--- | :--- | :--- |
| **`lucide-react`** | `^1.31.0` | `npm install lucide-react` | Colección de íconos vectoriales modernos utilizados en barras de navegación, botones de acción, tablas y modales. |
| **`html5-qrcode`** | `^2.3.8` | `npm install html5-qrcode` | Motor de escaneo por cámara de códigos QR y códigos de barras (Code 128, EAN, etc.) para búsqueda rápida de dispositivos e ICCID de SIM cards. |
| **`qrcode`** | `^1.5.4` | `npm install qrcode` | Generación dinámica de códigos QR en lienzo y descarga de imágenes QR para etiquetado de inventario. |
| **`web-push`** | `^3.6.7` | `npm install web-push` | Soporte para el envío y gestión de notificaciones Web Push en la Progressive Web App (PWA). |
| **`next`** | `16.3.0` | `npm install next@16.3.0` | Framework web React con soporte de App Router, compilación con Turbopack y API Routes locales. |
| **`react`** | `19.2.8` | `npm install react@19.2.8` | Biblioteca base de interfaz de usuario. |
| **`react-dom`** | `19.2.8` | `npm install react-dom@19.2.8` | Renderizador de React para el DOM del navegador. |

### 2. Dependencias de Desarrollo (`devDependencies`)

| Paquete | Versión | Comando de Instalación | Propósito / Uso en el Proyecto |
| :--- | :--- | :--- | :--- |
| **`@types/qrcode`** | `^1.5.6` | `npm install -D @types/qrcode` | Definiciones de tipos TypeScript para la biblioteca `qrcode`. |
| **`@types/web-push`** | `^3.6.4` | `npm install -D @types/web-push` | Definiciones de tipos TypeScript para `web-push`. |
| **`tailwindcss`** | `^4` | `npm install -D tailwindcss @tailwindcss/postcss` | Framework de diseño utilitario (versión 4 con motor CSS nativo). |
| **`@tailwindcss/postcss`** | `^4` | `npm install -D @tailwindcss/postcss` | Integración de PostCSS para Tailwind CSS v4. |
| **`typescript`** | `^5` | `npm install -D typescript` | Compilador y comprobador estático de tipos TypeScript. |
| **`@types/node`** | `^20` | `npm install -D @types/node` | Tipos de TypeScript para el entorno de ejecución Node.js. |
| **`@types/react`** | `^19` | `npm install -D @types/react` | Definiciones de tipos para React 19. |
| **`@types/react-dom`** | `^19` | `npm install -D @types/react-dom` | Definiciones de tipos para React DOM 19. |
| **`eslint`** | `^9` | `npm install -D eslint` | Linter estático para análisis de calidad de código. |
| **`eslint-config-next`** | `16.3.0` | `npm install -D eslint-config-next@16.3.0` | Reglas y configuraciones oficiales de ESLint para proyectos Next.js. |

---

## 🚀 Puesta en Marcha

### Opción A: Usando Docker (Recomendado para equipos)

Para levantar el entorno completo (aplicación Next.js + proxy Caddy con HTTPS):

```bash
# Construir la imagen y levantar los contenedores
sudo docker compose up --build

# Para detener los contenedores
sudo docker compose down
```

### Opción B: Ejecución Local con Node.js

Requisitos: Node.js 20+ y npm.

```bash
# 1. Instalar todas las dependencias registradas
npm install

# 2. Iniciar servidor de desarrollo
npm run dev

# 3. Opcional: Iniciar con soporte HTTPS local (PWA / cámara para escáner)
npm run dev:https
```

Abre [http://localhost:3000](http://localhost:3000) en el navegador.

---

## 🛠️ Scripts Disponibles en `package.json`

- **`npm run dev`**: Inicia el servidor de desarrollo escuchando en `0.0.0.0:3000`.
- **`npm run dev:https`**: Inicia el servidor con certificados HTTPS experimentales de Next.js (necesario para usar la cámara en dispositivos móviles en red local).
- **`npm run build`**: Compila y optimiza el proyecto para producción con Turbopack y verificación estricta de TypeScript.
- **`npm run start`**: Inicia la aplicación previamente compilada en modo producción.
- **`npm run lint`**: Ejecuta el análisis de código con ESLint.

---

## 🌿 Flujo de Trabajo en Equipo y Ramas (Git)

- **`main`**: Rama principal protegida y estable.
- **`Manuel`**: Rama de desarrollo activo y nuevas características.
- **Colaboración**: Cada integrante desarrolla en su propia rama y unifica cambios mediante Pull Requests (PR).
- **Variables de Entorno**: Usar `.env.example` como plantilla para configurar `.env` localmente sin subir secretos.
