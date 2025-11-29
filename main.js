const { app, BrowserWindow } = require('electron');
const path = require('path');
const { spawn } = require('child_process');

let mainWindow;
let serverProcess;

// Crear la ventana principal
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true
    },
    icon: path.join(__dirname, 'assets/icon.png')
  });

  // Abrir las herramientas de desarrollo (comentar en producción)
  // mainWindow.webContents.openDevTools();

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// Iniciar el servidor Node.js
function startServer() {
  return new Promise((resolve) => {
    const isDev = process.env.NODE_ENV === 'development';
    const serverPath = isDev 
      ? path.join(__dirname, 'server.js')
      : path.join(process.resourcesPath, 'server.js');

    serverProcess = spawn('node', [serverPath], {
      cwd: __dirname,
      stdio: 'inherit'
    });

    // Esperar a que el servidor esté listo
    setTimeout(() => {
      resolve();
    }, 2000);

    serverProcess.on('error', (err) => {
      console.error('Error al iniciar servidor:', err);
      resolve();
    });
  });
}

// Cuando Electron esté listo
app.on('ready', async () => {
  console.log('🚀 Iniciando servidor...');
  await startServer();
  
  console.log('🪟 Creando ventana...');
  createWindow();

  // Cargar la página web
  mainWindow.loadURL('http://localhost:3000');
});

// Salir cuando todas las ventanas se cierren
app.on('window-all-closed', () => {
  // Detener el servidor
  if (serverProcess) {
    serverProcess.kill();
  }
  
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  }
});

// Manejar errores no capturados
process.on('uncaughtException', (error) => {
  console.error('Error no capturado:', error);
});
