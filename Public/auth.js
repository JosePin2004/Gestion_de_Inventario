// Funciones de Autenticación

// Definir API_URL global si no existe
window.API_URL = window.API_URL || 'http://localhost:3000/api';

/**
 * Obtener el token JWT del localStorage
 */
function obtenerToken() {
    return localStorage.getItem('token');
}

/**
 * Obtener el ID del usuario autenticado
 */
function obtenerUsuarioId() {
    return localStorage.getItem('usuarioId');
}

/**
 * Obtener el nombre del usuario autenticado
 */
function obtenerNombreUsuario() {
    return localStorage.getItem('nombreUsuario');
}

/**
 * Verificar si el usuario está autenticado
 */
function estaAutenticado() {
    return !!obtenerToken();
}

/**
 * Redirigir al login si no está autenticado
 */
function verificarAutenticacion() {
    if (!estaAutenticado()) {
        window.location.href = 'auth.html';
    }
}

/**
 * Verificar si el usuario es administrador
 */
function esAdmin() {
    const admin = localStorage.getItem('esAdmin');
    return admin === 'true' || admin === '1' || admin === true;
}

/**
 * Cerrar sesión (logout)
 */
function cerrarSesion() {
    localStorage.removeItem('token');
    localStorage.removeItem('usuarioId');
    localStorage.removeItem('nombreUsuario');
    localStorage.removeItem('esAdmin');
    window.location.href = 'auth.html';
}

/**
 * Hacer una petición autenticada a la API
 * @param {string} endpoint - La ruta del endpoint (ej: /productos)
 * @param {string} metodo - GET, POST, PUT, DELETE
 * @param {object} datos - Datos a enviar (para POST/PUT)
 */
async function llamadaAPI(endpoint, metodo = 'GET', datos = null) {
    const token = obtenerToken();
    
    if (!token) {
        console.error('No hay token. El usuario debe estar autenticado.');
        window.location.href = 'auth.html';
        return null;
    }

    const opciones = {
        method: metodo,
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        }
    };

    if (datos && (metodo === 'POST' || metodo === 'PUT')) {
        opciones.body = JSON.stringify(datos);
    }

    try {
        const response = await fetch(`${window.API_URL}${endpoint}`, opciones);

        // Si el token expiró o es inválido
        if (response.status === 401) {
            console.warn('Token inválido o expirado. Redirigiendo al login.');
            cerrarSesion();
            return null;
        }

        if (!response.ok) {
            throw new Error(`Error ${response.status}: ${response.statusText}`);
        }

        return await response.json();

    } catch (error) {
        console.error('Error en la petición API:', error);
        throw error;
    }
}

/**
 * Actualizar la UI con información del usuario
 */
function actualizarUIUsuario() {
    const nombreUsuario = obtenerNombreUsuario();
    
    if (nombreUsuario) {
        // Buscar elemento para mostrar nombre de usuario
        const usuarioElement = document.getElementById('usuario-actual');
        if (usuarioElement) {
            usuarioElement.textContent = `👤 ${nombreUsuario}`;
        }

        // Buscar botón de logout
        const logoutBtn = document.getElementById('logout-btn');
        if (logoutBtn) {
            logoutBtn.onclick = () => {
                if (confirm('¿Deseas cerrar sesión?')) {
                    cerrarSesion();
                }
            };
        }
    }
}

// Ejecutar verificación cuando la página cargue
document.addEventListener('DOMContentLoaded', function() {
    // Solo verificar en página principal (index.html), no en auth.html
    if (window.location.pathname.endsWith('index.html') || 
        window.location.pathname === '/' ||
        window.location.pathname.endsWith('/')) {
        verificarAutenticacion();
        actualizarUIUsuario();
    }
});
