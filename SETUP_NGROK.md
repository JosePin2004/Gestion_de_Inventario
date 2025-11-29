# 🔗 Configurar ngrok para obtener un link fijo

## Paso 1: Descargar ngrok
1. Ve a https://ngrok.com/download
2. Descarga la versión para Windows
3. Extrae el archivo `ngrok.exe` en la carpeta del proyecto:
   `c:\Users\José\Desktop\inventario\PAGINA WEB\Gestion_de_Inventario\`

## Paso 2: Crear cuenta en ngrok (opcional pero recomendado)
1. Regístrate en https://ngrok.com
2. Obtén tu authtoken
3. Ejecuta en la terminal:
   ```
   ngrok authtoken TU_TOKEN_AQUI
   ```

## Paso 3: Iniciar ngrok
Una vez que el servidor Node.js está corriendo en `http://localhost:3000`:

```bash
ngrok http 3000
```

## Resultado
Verás una salida como:
```
Forwarding    https://abc123def456.ngrok.io -> http://localhost:3000
```

**Este es tu link fijo que puedes compartir:** `https://abc123def456.ngrok.io`

## Ventajas
- ✅ Link público que funciona desde cualquier lugar
- ✅ No importa tu IP local
- ✅ Funciona incluso fuera de la red
- ✅ HTTPS automático
- ✅ El link se mantiene mientras ngrok esté corriendo

## Nota
- Mantén tanto el servidor Node como ngrok corriendo
- Cada vez que reinicies ngrok, obtendrás un nuevo link (a menos que tengas plan Pro)
- Con cuenta gratuita, el link cambia cada 2 horas
