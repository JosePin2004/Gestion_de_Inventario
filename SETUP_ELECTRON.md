# 📦 Crear App de Escritorio con Electron

## ¿Qué es?
Convierte tu aplicación web en un programa de escritorio que se ejecuta como una ventana normal, sin necesidad de abrir un navegador ni una terminal.

## Instalación

### Paso 1: Instalar dependencias de Electron
```bash
cd "c:\Users\José\Desktop\inventario\PAGINA WEB\Gestion_de_Inventario"

npm install --save-dev electron electron-builder concurrently wait-on
```

### Paso 2: Usar el archivo package.json actualizado
Ya está creado: `package-electron.json`

### Paso 3: Cambiar el nombre del package.json actual
```bash
# Hacer backup del actual
ren package.json package-backup.json

# Usar el nuevo
ren package-electron.json package.json
```

## Ejecutar en modo desarrollo

```bash
npm run electron-dev
```

Esto abrirá la aplicación en una ventana de Electron.

## Empaquetar como instalador (Windows)

```bash
npm run build
```

Esto creará carpetas:
- `dist/` - Instalador .exe
- `dist/Gestión de Inventario Portable.exe` - Versión portátil (sin instalación)

## Resultado Final

✅ **Instalador (.exe)** - Los usuarios pueden instalar la aplicación
✅ **Versión Portátil** - Ejecutar sin instalar
✅ **Acceso directo** en Escritorio y Menú Inicio
✅ **No requiere abrir navegador**
✅ **Servidor integrado** que se inicia automáticamente

## Requisitos
- Node.js instalado
- Las dependencias de npm

## Estructura de archivos necesarios
```
├── main.js (punto de entrada de Electron)
├── preload.js (seguridad)
├── server.js (servidor Node.js)
├── package.json
├── Public/ (archivos frontend)
├── inventario.db (base de datos)
└── assets/
    └── icon.png (icono de la app - opcional)
```

## Notas
- La primera compilación tarda más tiempo
- El instalador se guardará en `dist/`
- Se requiere ~500MB de espacio temporal
- Compatible con Windows 7+
