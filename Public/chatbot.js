// Chatbot Logic
const chatbotToggleBtn = document.getElementById('chatbot-toggle-btn');
const chatbotWidget = document.getElementById('chatbot-widget');
const chatbotCloseBtn = document.getElementById('chatbot-close-btn');
const chatbotInput = document.getElementById('chatbot-input');
const chatbotSendBtn = document.getElementById('chatbot-send-btn');
const chatbotMessages = document.getElementById('chatbot-messages');

// Preguntas frecuentes para botones rápidos
const frequentQuestions = [
    { text: '💹 Ver ganancias', query: 'cuáles son mis ganancias' },
    { text: '📅 Resumen mensual', query: 'cuál es el resumen del mes' },
    { text: '⚠️ Bajo stock', query: 'qué productos tienen bajo stock' },
    { text: '❓ Ayuda', query: 'ayuda' }
];

// Base de conocimiento del chatbot
const knowledgeBase = {
    // Saludos y generales
    'hola': {
        keywords: ['hola', 'hi', 'buenos', 'buenas', 'ey', 'oye'],
        response: '¡Hola! 👋 Soy tu asistente de inventario. ¿En qué puedo ayudarte? Puedo responder preguntas sobre:\n• Cómo agregar productos\n• Registrar ventas\n• Ver ganancias\n• Productos caducados\n• Resumen mensual'
    },
    
    // Agregar productos
    'agregar_producto': {
        keywords: ['agregar producto', 'nuevo producto', 'cómo agrego', 'crear producto', 'añadir producto'],
        response: '📝 Para agregar un producto:\n\n1. Haz clic en "Agregar Producto" en el menú\n2. Completa los campos:\n   • Nombre del producto\n   • Categoría\n   • Cantidad\n   • Precio del Proveedor\n   • Precio de Venta\n   • Fecha de vencimiento\n3. Haz clic en "Agregar Producto"\n\n¡El producto aparecerá en tu inventario!'
    },
    
    // Registrar ventas
    'registrar_venta': {
        keywords: ['vender', 'venta', 'realizar venta', 'cómo vendo', 'movimiento', 'salida'],
        response: '💰 Para registrar una venta:\n\n1. Ve a "Productos"\n2. Busca el producto\n3. Haz clic en "Movimiento"\n4. Selecciona tipo: "Salida"\n5. Ingresa cantidad vendida\n6. Haz clic en "Registrar"\n\n✅ El contador de ventas y ganancias se actualizarán automáticamente!'
    },
    
    // Ganancias
    'ganancias': {
        keywords: ['ganancia', 'ganancias', 'cuál es mi ganancia', 'cuánto gané', 'cuanto gane'],
        response: null, // Se obtiene dinámicamente
        dynamic: true
    },
    
    // Productos caducados
    'caducado': {
        keywords: ['caducado', 'vencimiento', 'próximo caducar', 'productos vencidos', 'fecha vencimiento'],
        response: '⚠️ Sistema de Vencimiento:\n\n🔴 Productos Próximos a Caducar (menos de 15 días):\n• Descuento automático del 10%-50%\n\n⚫ Productos Caducados:\n• No se pueden vender\n• Se muestran en panel de control\n\n💡 Consejo: Revisa el panel diariamente para gestionar productos por vencer.'
    },
    
    // Contador de ventas
    'contador': {
        keywords: ['contador', 'vendido', 'cuántas ventas', 'total vendido', 'cuántos productos vendí'],
        response: '📊 Contador de Ventas:\n\nEn la tabla de Productos ves una columna "Contador Ventas" que muestra:\n• Cantidad total de unidades vendidas\n• Se incrementa cada venta registrada\n• Se reinicia cada mes\n\nÚtil para ver cuáles productos se venden más.'
    },
    
    // Resumen mensual
    'mensual': {
        keywords: ['mensual', 'mes', 'resumen mes', 'reporte mensual', 'mes actual', 'detalles mes'],
        response: null,
        dynamic: true
    },
    
    // Bajo stock
    'stock': {
        keywords: ['stock', 'inventario bajo', 'poco producto', 'cantidad mínima', 'productos bajos'],
        response: null,
        dynamic: true
    },
    
    // Ayuda general
    'ayuda': {
        keywords: ['ayuda', 'help', 'cómo funciona', 'qué puedo hacer', 'no entiendo'],
        response: '🆘 Temas disponibles:\n\nPuedo ayudarte con:\n✓ Agregar/Editar/Eliminar productos\n✓ Registrar ventas\n✓ Entender ganancias\n✓ Productos caducados\n✓ Resumen mensual\n✓ Búsqueda y filtros\n✓ Bajo stock\n\nEscribe cualquier pregunta 😊'
    }
};

// Inicializar eventos
chatbotToggleBtn.addEventListener('click', toggleChatbot);
chatbotCloseBtn.addEventListener('click', closeChatbot);
chatbotSendBtn.addEventListener('click', sendMessage);
chatbotInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') sendMessage();
});

// Agregar evento para botón de reinicio
const chatbotRestartBtn = document.getElementById('chatbot-restart-btn');
chatbotRestartBtn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    restartChat();
});

// Función para mostrar/ocultar chatbot
function toggleChatbot() {
    chatbotWidget.classList.toggle('active');
    if (chatbotWidget.classList.contains('active')) {
        chatbotInput.focus();
        if (chatbotMessages.children.length === 0) {
            showBotMessage(knowledgeBase['hola'].response);
            showQuickButtons();
        }
    }
}

// Función para cerrar chatbot
function closeChatbot() {
    chatbotWidget.classList.remove('active');
}

// Función para reiniciar el chat
function restartChat() {
    chatbotMessages.innerHTML = '';
    chatbotInput.value = '';
    showBotMessage(knowledgeBase['hola'].response);
    showQuickButtons();
}

// Función para enviar mensaje
function sendMessage() {
    const message = chatbotInput.value.trim();
    if (message === '') return;

    // Mostrar mensaje del usuario
    showUserMessage(message);
    chatbotInput.value = '';

    // Procesar respuesta del bot (ahora es async)
    getResponse(message).then(response => {
        showBotMessage(response);
    });
}

// Función para mostrar mensaje del usuario
function showUserMessage(message) {
    const messageDiv = document.createElement('div');
    messageDiv.classList.add('chatbot-message', 'user');
    messageDiv.innerHTML = `<div class="chatbot-message-content">${escapeHtml(message)}</div>`;
    chatbotMessages.appendChild(messageDiv);
    chatbotMessages.scrollTop = chatbotMessages.scrollHeight;
}

// Función para mostrar mensaje del bot
function showBotMessage(message) {
    const messageDiv = document.createElement('div');
    messageDiv.classList.add('chatbot-message', 'bot');
    messageDiv.innerHTML = `<div class="chatbot-message-content">${escapeHtml(message)}</div>`;
    chatbotMessages.appendChild(messageDiv);
    chatbotMessages.scrollTop = chatbotMessages.scrollHeight;
}

// Función para obtener respuesta
async function getResponse(userMessage) {
    const userText = userMessage.toLowerCase();

    // Buscar coincidencias en la base de conocimiento
    for (let key in knowledgeBase) {
        const item = knowledgeBase[key];
        for (let keyword of item.keywords) {
            if (userText.includes(keyword)) {
                // Si es dinámico, obtener datos de la API
                if (item.dynamic) {
                    return await getDynamicResponse(key);
                }
                return item.response;
            }
        }
    }

    // Si no encuentra coincidencia
    return '🤔 No estoy seguro de tu pregunta. Puedo ayudarte con:\n• Agregar productos\n• Registrar ventas\n• Ver ganancias\n• Productos caducados\n• Resumen mensual\n\nIntenta reformular tu pregunta 😊';
}

// Función para obtener respuestas dinámicas desde la API
async function getDynamicResponse(key) {
    try {
        if (key === 'ganancias') {
            const resumen = await llamadaAPI('/resumen', 'GET');
            if (!resumen) throw new Error('Error obteniendo resumen');
            return `💹 Tus Ganancias Actuales:\n\n💰 Ganancia Total (Mes): $${(resumen.ganancia_total || 0).toFixed(2)}\n📊 Total de Productos: ${resumen.total_productos || 0}\n📦 Cantidad Total: ${resumen.cantidad_total || 0} unidades`;
        } 
        else if (key === 'mensual') {
            const datos = await llamadaAPI('/resumen-mensual', 'GET');
            if (!datos) throw new Error('Error obteniendo resumen mensual');
            return `📅 Resumen del Mes ${datos.mes}/${datos.año}:\n\n💼 Compras:\n  • Total: $${(datos.comparativa.costo_compras || 0).toFixed(2)}\n  • Items: ${datos.compras.total_items || 0}\n\n🛍️ Ventas:\n  • Total: $${(datos.comparativa.ingresos_ventas || 0).toFixed(2)}\n  • Transacciones: ${datos.ventas.total_transacciones || 0}\n\n✅ Ganancia Neta: $${(datos.comparativa.ganancia_neta || 0).toFixed(2)}\n📈 Margen: ${datos.comparativa.margen_ganancia_porcentaje}%`;
        }
        else if (key === 'stock') {
            const productos = await llamadaAPI('/productos', 'GET');
            if (!productos) throw new Error('Error obteniendo productos');
            const bajoStock = productos.filter(p => p.cantidad < 5);
            
            if (bajoStock.length === 0) {
                return '✅ Perfecto! No hay productos con bajo stock. Todo está bien abastecido.';
            }
            
            let response = `⚠️ Productos con Bajo Stock (menos de 5 unidades):\n\n`;
            bajoStock.forEach(p => {
                response += `• ${p.nombre}: ${p.cantidad} unidades\n`;
            });
            return response;
        }
    } catch (error) {
        console.error('Error obteniendo datos:', error);
        return '❌ Hubo un error al obtener los datos. Intenta de nuevo.';
    }
}

// Función para escapar HTML
function escapeHtml(text) {
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, m => map[m]);
}

// Función para mostrar botones de preguntas frecuentes
function showQuickButtons() {
    const buttonsContainer = document.getElementById('chatbot-quick-buttons');
    buttonsContainer.innerHTML = '';
    
    frequentQuestions.forEach(q => {
        const btn = document.createElement('button');
        btn.className = 'chatbot-quick-btn';
        btn.textContent = q.text;
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            handleQuickQuestion(q.query);
        });
        buttonsContainer.appendChild(btn);
    });
}

// Función para manejar preguntas rápidas
function handleQuickQuestion(query) {
    showUserMessage(query);
    document.getElementById('chatbot-quick-buttons').innerHTML = '';
    
    getResponse(query).then(response => {
        showBotMessage(response);
    });
}
