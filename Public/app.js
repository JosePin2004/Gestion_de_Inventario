// API Base URL - usar window para evitar conflictos
window.API_URL = window.API_URL || 'http://localhost:3000/api';
let productoActualEnMovimiento = null;

// Función para realizar llamadas API con autenticación
async function llamadaAPILocal(endpoint, metodo = 'GET', datos = null) {
    const token = obtenerToken();
    
    if (!token) {
        console.error('No hay token. El usuario debe estar autenticado.');
        cerrarSesion();
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
            const errorData = await response.json();
            throw new Error(errorData.error || `Error ${response.status}: ${response.statusText}`);
        }

        return await response.json();

    } catch (error) {
        console.error('Error en la petición API:', error);
        alert('Error: ' + error.message);
        throw error;
    }
}

// Función para calcular estado de vencimiento
function calcularEstadoVencimiento(fechaVencimiento) {
    if (!fechaVencimiento) {
        return { estado: 'sin-vencimiento', clase: 'estado-bien', texto: 'Sin vencimiento' };
    }

    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    
    const fecha = new Date(fechaVencimiento);
    fecha.setHours(0, 0, 0, 0);
    
    const diasDiferencia = Math.floor((fecha - hoy) / (1000 * 60 * 60 * 24));

    if (diasDiferencia < 0) {
        return { estado: 'caducado', clase: 'estado-caducado', texto: '⚫ Caducado' };
    } else if (diasDiferencia <= 30) {
        return { estado: 'proximo', clase: 'estado-proximo', texto: `🔴 Próx. ${diasDiferencia} días` };
    } else {
        return { estado: 'bien', clase: 'estado-bien', texto: '✅ Bien' };
    }
}

// Inicializar aplicación
document.addEventListener('DOMContentLoaded', () => {
    console.log('Página cargada, verificando autenticación...');
    
    // Verificar que el usuario esté autenticado
    verificarAutenticacion();
    
    // Actualizar UI del usuario
    actualizarUIUsuario();
    
    // Inicializar eventos
    inicializarEventos();
    
    // Agregar event listener al year-selector
    agregarEventoAñoSelector();
    
    // Cargar datos
    cargarProductos();
    cargarResumen();
    
    // Cargar resumen cada 5 segundos
    setInterval(cargarResumen, 5000);
    
    // Mostrar botón de datos de prueba si es admin
    if (esAdmin()) {
        const btnDatosPrueba = document.getElementById('btn-datos-prueba');
        if (btnDatosPrueba) {
            btnDatosPrueba.style.display = 'inline-block';
            btnDatosPrueba.addEventListener('click', cargarDatosPrueba);
        }
    }
    
    console.log('Aplicación inicializada correctamente');
});

// Inicializar eventos
function inicializarEventos() {
    // Navegación
    document.querySelectorAll('.nav-btn').forEach(btn => {
        if (btn.id !== 'admin-btn' && btn.id !== 'logout-btn') {
            btn.addEventListener('click', function(e) {
                e.preventDefault();
                const seccion = this.getAttribute('data-section');
                console.log('Botón clickeado:', { id: this.id, seccion: seccion });
                cambiarSeccion(seccion);
            });
        }
    });

    // Mostrar botón admin si es administrador
    // Mostrar botón admin si es administrador
    if (esAdmin()) {
        document.getElementById('admin-btn').style.display = 'block';
    }

    // Event listener para logout
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            if (confirm('¿Deseas cerrar sesión?')) {
                cerrarSesion();
            }
        });
    }

    // Formulario de nuevo producto
    document.getElementById('form-producto').addEventListener('submit', agregarProducto);

    // Formulario de editar producto
    document.getElementById('form-editar-producto').addEventListener('submit', guardarProductoEditado);

    // Búsqueda y filtros
    document.getElementById('search-input').addEventListener('input', filtrarProductos);
    document.getElementById('categoria-filter').addEventListener('change', filtrarProductos);

    // Modal cerrar
    document.querySelectorAll('.close').forEach(closeBtn => {
        closeBtn.addEventListener('click', function() {
            this.closest('.modal').classList.remove('show');
        });
    });

    // Cerrar modal al hacer clic fuera
    document.querySelectorAll('.modal').forEach(modal => {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.classList.remove('show');
            }
        });
    });
}

// Cambiar sección activa
function cambiarSeccion(seccion) {
    if (!seccion) {
        console.error('No se especificó sección');
        return;
    }
    
    console.log('Cambiando a sección:', seccion);
    
    // Desactivar todas las secciones
    document.querySelectorAll('.section').forEach(s => {
        s.classList.remove('active');
        console.log('Removiendo active de:', s.id);
    });

    // Desactivar todos los botones nav
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.classList.remove('active');
    });

    // Activar sección y botón seleccionados
    const seccionElement = document.getElementById(seccion);
    if (!seccionElement) {
        console.error('Sección no encontrada:', seccion);
        return;
    }
    
    seccionElement.classList.add('active');
    console.log('Clase active agregada a sección:', seccion);
    
    const btnElement = document.querySelector(`[data-section="${seccion}"]`);
    if (btnElement) {
        btnElement.classList.add('active');
    }

    // Recargar datos si es necesario
    if (seccion === 'productos') {
        console.log('Cargando productos...');
        cargarProductos();
    } else if (seccion === 'reportes') {
        console.log('Cargando reportes...');
        cargarAnosDisponibles();
    }
}

// Cargar productos
async function cargarProductos() {
    try {
        const productos = await llamadaAPILocal('/productos');
        if (!productos) return;

        // Actualizar tabla
        const tbody = document.getElementById('productos-tbody');
        tbody.innerHTML = '';

        if (productos.length === 0) {
            tbody.innerHTML = '<tr><td colspan="10" class="text-center">No hay productos</td></tr>';
            return;
        }

        // Actualizar filtro de categorías
        const categorias = [...new Set(productos.map(p => p.categoria).filter(Boolean))];
        const categoryFilter = document.getElementById('categoria-filter');
        const currentValue = categoryFilter.value;
        categoryFilter.innerHTML = '<option value="">Todas las categorías</option>';
        categorias.forEach(cat => {
            const option = document.createElement('option');
            option.value = cat;
            option.textContent = cat;
            categoryFilter.appendChild(option);
        });
        categoryFilter.value = currentValue;

        // Llenar tabla
        productos.forEach(producto => {
            const row = document.createElement('tr');
            const totalVenta = (producto.cantidad * producto.precio_final).toFixed(2);
            const gananciaUnitaria = (producto.precio_venta - producto.precio_proveedor).toFixed(2);
            const estadoVencimiento = calcularEstadoVencimiento(producto.fecha_vencimiento);
            const fechaFormato = producto.fecha_vencimiento 
                ? new Date(producto.fecha_vencimiento).toLocaleDateString('es-ES')
                : '-';
            
            // Mostrar precio con descuento si aplica
            let precioVentaHTML = `$${parseFloat(producto.precio_venta).toFixed(2)}`;
            if (producto.descuento > 0) {
                precioVentaHTML = `<del>$${parseFloat(producto.precio_venta).toFixed(2)}</del><br><strong style="color: #16a34a;">$${parseFloat(producto.precio_final).toFixed(2)} (-${producto.descuento}%)</strong>`;
            }
            
            // Color de ganancia
            const gananciaColor = gananciaUnitaria > 0 ? '#16a34a' : gananciaUnitaria < 0 ? '#dc2626' : '#6b7280';
            
            // Marcar como no disponible si está caducado
            const availabilityClass = !producto.disponible ? ' style="opacity: 0.5; background: #fee2e2;"' : '';
            
            row.innerHTML = `
                <td>${producto.nombre}</td>
                <td>${producto.categoria || '-'}</td>
                <td>${producto.cantidad}</td>
                <td>$${parseFloat(producto.precio_proveedor).toFixed(2)}</td>
                <td${availabilityClass}>${precioVentaHTML}</td>
                <td style="color: ${gananciaColor}; font-weight: bold;">$${gananciaUnitaria}</td>
                <td style="text-align: center; font-weight: bold;">${producto.contador_ventas || 0}</td>
                <td><span class="estado-vencimiento ${estadoVencimiento.clase}">${estadoVencimiento.texto}</span><br><small>${fechaFormato}</small></td>
                <td>$${totalVenta}</td>
                <td>
                    <button class="btn btn-warning btn-small" onclick="abrirMovimientos(${producto.id}, '${producto.nombre}', ${!producto.disponible})" ${!producto.disponible ? 'disabled' : ''}>Movimiento</button>
                    <button class="btn btn-warning btn-small" onclick="abrirEditar(${producto.id})">Editar</button>
                    <button class="btn btn-danger btn-small" onclick="eliminarProducto(${producto.id})">Eliminar</button>
                </td>
            `;
            tbody.appendChild(row);
        });
    } catch (error) {
        console.error('Error cargando productos:', error);
        mostrarMensaje('Error al cargar productos', 'error');
    }
}

// Cargar resumen
async function cargarResumen() {
    try {
        const productos = await llamadaAPILocal('/productos');
        if (!productos) return;
        const resumen = await llamadaAPILocal('/resumen');
        if (!resumen) return;

        document.getElementById('total-productos').textContent = resumen.total_productos || 0;
        document.getElementById('cantidad-total').textContent = resumen.cantidad_total || 0;
        document.getElementById('valor-total').textContent = `$${(resumen.valor_total || 0).toFixed(2)}`;
        document.getElementById('ganancia-total').textContent = `$${(resumen.ganancia_total || 0).toFixed(2)}`;

        // Cargar productos con bajo stock
        cargarBajoStock(productos);
        
        // Cargar productos caducados y próximos a caducar
        cargarCaducidosYProximos(productos);
        
        // Cargar resumen mensual
        cargarResumenMensual();
    } catch (error) {
        console.error('Error cargando resumen:', error);
    }
}

// Cargar datos de prueba
async function cargarDatosPrueba() {
    const btn = document.getElementById('btn-datos-prueba');
    const textoOriginal = btn.textContent;
    
    try {
        btn.disabled = true;
        btn.textContent = '⏳ Cargando datos...';
        
        const respuesta = await llamadaAPILocal('/datos-prueba', 'POST', {});
        
        console.log('Datos de prueba insertados:', respuesta);
        
        // Esperar un segundo y recargar datos
        setTimeout(() => {
            cargarResumen();
            btn.disabled = false;
            btn.textContent = '✓ Datos cargados!';
            
            setTimeout(() => {
                btn.textContent = textoOriginal;
            }, 3000);
        }, 1500);
    } catch (error) {
        console.error('Error cargando datos de prueba:', error);
        btn.disabled = false;
        btn.textContent = textoOriginal;
    }
}

// Cargar resumen mensual
async function cargarResumenMensual() {
    try {
        const datos = await llamadaAPILocal('/resumen-mensual');
        if (!datos) {
            console.error('No hay datos del resumen mensual');
            return;
        }

        console.log('Datos del resumen mensual:', datos);

        // Actualizar totales mensuales
        if (datos.comparativa) {
            const elem1 = document.getElementById('mes-costo-compras');
            const elem2 = document.getElementById('mes-ingresos-ventas');
            const elem3 = document.getElementById('mes-ganancia-neta');
            const elem4 = document.getElementById('mes-margen-ganancia');
            
            if (elem1) elem1.textContent = `$${(datos.comparativa.costo_compras || 0).toFixed(2)}`;
            if (elem2) elem2.textContent = `$${(datos.comparativa.ingresos_ventas || 0).toFixed(2)}`;
            if (elem3) elem3.textContent = `$${(datos.comparativa.ganancia_neta || 0).toFixed(2)}`;
            if (elem4) elem4.textContent = `${datos.comparativa.margen_ganancia_porcentaje}%`;
            
            console.log('Elementos actualizados correctamente');
        } else {
            console.error('No se encontró objeto comparativa en datos:', datos);
        }

        // Llenar tabla de compras
        const comprasTable = document.getElementById('mes-compras-detalle');
        console.log('Compras detalle:', datos.compras.detalle);
        if (datos.compras.detalle.length === 0) {
            comprasTable.innerHTML = '<tr><td colspan="3" style="padding: 0.5rem; text-align: center; color: #999;">Sin compras este mes</td></tr>';
        } else {
            comprasTable.innerHTML = datos.compras.detalle.map(compra => `
                <tr style="border-bottom: 1px solid #eee;">
                    <td style="padding: 0.5rem;">${compra.nombre}</td>
                    <td style="text-align: right; padding: 0.5rem;">${compra.cantidad}</td>
                    <td style="text-align: right; padding: 0.5rem;">$${(compra.costo_total || 0).toFixed(2)}</td>
                </tr>
            `).join('');
        }

        // Llenar tabla de ventas
        const ventasTable = document.getElementById('mes-ventas-detalle');
        if (datos.ventas.detalle.length === 0) {
            ventasTable.innerHTML = '<tr><td colspan="3" style="padding: 0.5rem; text-align: center; color: #999;">Sin ventas este mes</td></tr>';
        } else {
            ventasTable.innerHTML = datos.ventas.detalle.map(venta => `
                <tr style="border-bottom: 1px solid #eee;">
                    <td style="padding: 0.5rem;">${venta.nombre}</td>
                    <td style="text-align: right; padding: 0.5rem;">${venta.cantidad}</td>
                    <td style="text-align: right; padding: 0.5rem; color: #16a34a; font-weight: bold;">$${(venta.ganancia_total || 0).toFixed(2)}</td>
                </tr>
            `).join('');
        }
    } catch (error) {
        console.error('Error cargando resumen mensual:', error);
        console.error('Stack:', error.stack);
    }
}

// Cargar productos caducados y próximos a caducar
function cargarCaducidosYProximos(productos) {
    const caducados = [];
    const proximosCaducar = [];

    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);

    productos.forEach(producto => {
        if (!producto.fecha_vencimiento) return;

        const fecha = new Date(producto.fecha_vencimiento);
        fecha.setHours(0, 0, 0, 0);
        const diasDiferencia = Math.floor((fecha - hoy) / (1000 * 60 * 60 * 24));

        if (diasDiferencia < 0) {
            caducados.push(producto);
        } else if (diasDiferencia < 15) {
            proximosCaducar.push(producto);
        }
    });

    // Llenar lista de caducados
    const caducadosList = document.getElementById('caducados-list');
    caducadosList.innerHTML = '';
    if (caducados.length === 0) {
        caducadosList.innerHTML = '<li style="padding: 1rem; text-align: center; color: #16a34a;">✅ Sin productos caducados</li>';
    } else {
        caducados.forEach(p => {
            const li = document.createElement('li');
            li.style.padding = '0.75rem 0';
            li.style.borderBottom = '1px solid #fee2e2';
            li.innerHTML = `
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <div>
                        <strong>${p.nombre}</strong><br>
                        <small>Cantidad: ${p.cantidad} | Precio: $${p.precio_final.toFixed(2)}</small>
                    </div>
                    <span style="background: #fee2e2; color: #dc2626; padding: 0.25rem 0.75rem; border-radius: 1rem; font-size: 0.85rem;">CADUCADO</span>
                </div>
            `;
            caducadosList.appendChild(li);
        });
    }

    // Llenar lista de próximos a caducar
    const proximosList = document.getElementById('proximos-caducar-list');
    proximosList.innerHTML = '';
    if (proximosCaducar.length === 0) {
        proximosList.innerHTML = '<li style="padding: 1rem; text-align: center; color: #16a34a;">✅ Sin productos próximos a caducar</li>';
    } else {
        proximosCaducar.forEach(p => {
            const fecha = new Date(p.fecha_vencimiento);
            const diasRestantes = Math.ceil((fecha - hoy) / (1000 * 60 * 60 * 24));
            const li = document.createElement('li');
            li.style.padding = '0.75rem 0';
            li.style.borderBottom = '1px solid #fed7aa';
            li.innerHTML = `
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <div>
                        <strong>${p.nombre}</strong><br>
                        <small>Vence en: ${diasRestantes} días | Descuento: ${p.descuento}%</small>
                    </div>
                    <span style="background: #fed7aa; color: #ea580c; padding: 0.25rem 0.75rem; border-radius: 1rem; font-size: 0.85rem;">Próximo</span>
                </div>
            `;
            proximosList.appendChild(li);
        });
    }
}

// Cargar productos con bajo stock
async function cargarBajoStock(productos) {
    const bajoStock = productos.filter(p => p.cantidad < 10);
    const list = document.getElementById('bajo-stock-list');
    list.innerHTML = '';

    if (bajoStock.length === 0) {
        list.innerHTML = '<li>✅ Todos los productos tienen stock suficiente</li>';
        return;
    }

    bajoStock.forEach(producto => {
        const li = document.createElement('li');
        const estado = producto.cantidad < 5 ? '🔴 Crítico' : '🟡 Bajo';
        li.innerHTML = `
            <span>${producto.nombre}: ${producto.cantidad} unidades</span>
            <span class="badge">${estado}</span>
        `;
        list.appendChild(li);
    });
}

// Agregar nuevo producto
async function agregarProducto(e) {
    e.preventDefault();

    const nombre = document.getElementById('nombre').value.trim();
    const cantidad = document.getElementById('cantidad').value.trim();
    const precio_proveedor = document.getElementById('precio_proveedor').value.trim();
    const precio_venta = document.getElementById('precio_venta').value.trim();

    // Validación
    if (!nombre) {
        mostrarMensaje('El nombre del producto es requerido', 'error');
        return;
    }
    if (!cantidad || isNaN(parseInt(cantidad))) {
        mostrarMensaje('La cantidad debe ser un número válido', 'error');
        return;
    }
    if (!precio_proveedor || isNaN(parseFloat(precio_proveedor))) {
        mostrarMensaje('El precio del proveedor debe ser un número válido', 'error');
        return;
    }
    if (!precio_venta || isNaN(parseFloat(precio_venta))) {
        mostrarMensaje('El precio de venta debe ser un número válido', 'error');
        return;
    }

    const producto = {
        nombre: nombre,
        descripcion: document.getElementById('descripcion').value || '',
        cantidad: parseInt(cantidad),
        precio_proveedor: parseFloat(precio_proveedor),
        precio_venta: parseFloat(precio_venta),
        categoria: document.getElementById('categoria').value || '',
        fecha_vencimiento: document.getElementById('fecha_vencimiento').value || null,
        fecha_entrada: document.getElementById('fecha_entrada').value || null
    };

    try {
        const response = await llamadaAPILocal('/productos', 'POST', producto);
        if (response && response.id) {
            mostrarMensaje('Producto agregado exitosamente', 'success');
            document.getElementById('form-producto').reset();
            await cargarProductos();
            await cargarResumen();
            cambiarSeccion('productos');
        } else {
            mostrarMensaje('Error al agregar producto', 'error');
        }
    } catch (error) {
        console.error('Error:', error);
        mostrarMensaje('Error al agregar producto: ' + error.message, 'error');
    }
}

// Abrir modal para editar
async function abrirEditar(id) {
    try {
        const producto = await llamadaAPILocal(`/productos/${id}`);
        if (!producto) return;

        document.getElementById('edit-id').value = producto.id;
        document.getElementById('edit-nombre').value = producto.nombre;
        document.getElementById('edit-descripcion').value = producto.descripcion || '';
        document.getElementById('edit-cantidad').value = producto.cantidad;
        document.getElementById('edit-precio_proveedor').value = producto.precio_proveedor;
        document.getElementById('edit-precio_venta').value = producto.precio_venta;
        document.getElementById('edit-categoria').value = producto.categoria || '';
        document.getElementById('edit-fecha_vencimiento').value = producto.fecha_vencimiento || '';
        document.getElementById('edit-fecha_entrada').value = producto.fecha_entrada || '';

        document.getElementById('modal-editar').classList.add('show');
    } catch (error) {
        console.error('Error:', error);
        mostrarMensaje('Error al cargar producto', 'error');
    }
}

// Guardar producto editado
async function guardarProductoEditado(e) {
    e.preventDefault();

    const id = document.getElementById('edit-id').value;
    const producto = {
        nombre: document.getElementById('edit-nombre').value,
        descripcion: document.getElementById('edit-descripcion').value,
        cantidad: parseInt(document.getElementById('edit-cantidad').value),
        precio_proveedor: parseFloat(document.getElementById('edit-precio_proveedor').value),
        precio_venta: parseFloat(document.getElementById('edit-precio_venta').value),
        categoria: document.getElementById('edit-categoria').value,
        fecha_vencimiento: document.getElementById('edit-fecha_vencimiento').value,
        fecha_entrada: document.getElementById('edit-fecha_entrada').value
    };

    try {
        const response = await llamadaAPILocal(`/productos/${id}`, 'PUT', producto);
        if (response) {
            mostrarMensaje('Producto actualizado exitosamente', 'success');
            cerrarModal();
            cargarProductos();
            cargarResumen();
        } else {
            mostrarMensaje('Error al actualizar', 'error');
        }
    } catch (error) {
        console.error('Error:', error);
        mostrarMensaje('Error al actualizar producto', 'error');
    }
}

// Eliminar producto
async function eliminarProducto(id) {
    if (!confirm('¿Estás seguro de que deseas eliminar este producto?')) {
        return;
    }

    try {
        const response = await llamadaAPILocal(`/productos/${id}`, 'DELETE');
        if (response) {
            mostrarMensaje('Producto eliminado exitosamente', 'success');
            cargarProductos();
            cargarResumen();
        } else {
            mostrarMensaje('Error al eliminar', 'error');
        }
    } catch (error) {
        console.error('Error:', error);
        mostrarMensaje('Error al eliminar producto', 'error');
    }
}

// Abrir modal de movimientos
async function abrirMovimientos(productoId, nombreProducto, caducado = false) {
    if (caducado) {
        mostrarMensaje('No se puede vender un producto caducado', 'error');
        return;
    }
    
    productoActualEnMovimiento = productoId;
    document.getElementById('modal-movimientos-titulo').textContent = `Movimientos - ${nombreProducto}`;

    // Limpiar formulario
    document.getElementById('tipo-movimiento').value = '';
    document.getElementById('cantidad-movimiento').value = '';
    document.getElementById('descripcion-movimiento').value = '';

    // Cargar historial
    await cargarHistorialMovimientos(productoId);

    document.getElementById('modal-movimientos').classList.add('show');
}

// Cargar historial de movimientos
async function cargarHistorialMovimientos(productoId) {
    try {
        const movimientos = await llamadaAPILocal(`/movimientos/${productoId}`);
        if (!movimientos) return;

        const list = document.getElementById('movimientos-list');
        list.innerHTML = '';

        if (movimientos.length === 0) {
            list.innerHTML = '<div class="text-center" style="padding: 1rem;">Sin movimientos registrados</div>';
            return;
        }

        movimientos.forEach(mov => {
            const date = new Date(mov.fecha).toLocaleString('es-ES');
            const item = document.createElement('div');
            item.className = 'movimiento-item';
            item.innerHTML = `
                <div>
                    <span class="movimiento-type ${mov.tipo}">${mov.tipo.toUpperCase()}</span>
                    <span style="margin-left: 1rem;">${mov.cantidad} unidades</span>
                </div>
                <div style="text-align: right;">
                    <div style="font-size: 0.85rem; color: #6b7280;">${date}</div>
                    <div style="font-size: 0.85rem; color: #6b7280;">${mov.descripcion || '-'}</div>
                </div>
            `;
            list.appendChild(item);
        });
    } catch (error) {
        console.error('Error cargando movimientos:', error);
        mostrarMensaje('Error al cargar movimientos', 'error');
    }
}

// Guardar movimiento
async function guardarMovimiento() {
    const tipo = document.getElementById('tipo-movimiento').value;
    const cantidad = parseInt(document.getElementById('cantidad-movimiento').value);
    const descripcion = document.getElementById('descripcion-movimiento').value;

    if (!tipo || !cantidad) {
        mostrarMensaje('Por favor completa los campos requeridos', 'error');
        return;
    }

    try {
        const response = await llamadaAPILocal('/movimientos', 'POST', {
            producto_id: productoActualEnMovimiento,
            tipo: tipo,
            cantidad: cantidad,
            descripcion: descripcion
        });
        if (response) {
            mostrarMensaje('Movimiento registrado exitosamente', 'success');
            document.getElementById('cantidad-movimiento').value = '';
            document.getElementById('descripcion-movimiento').value = '';
            await cargarHistorialMovimientos(productoActualEnMovimiento);
            cargarProductos();
            cargarResumen();
        } else {
            mostrarMensaje('Error al registrar movimiento', 'error');
        }
    } catch (error) {
        console.error('Error:', error);
        mostrarMensaje('Error al registrar movimiento', 'error');
    }
}

// Filtrar productos
function filtrarProductos() {
    const searchTerm = document.getElementById('search-input').value.toLowerCase();
    const categoryFilter = document.getElementById('categoria-filter').value;
    const rows = document.querySelectorAll('#productos-tbody tr');

    rows.forEach(row => {
        const nombre = row.cells[0]?.textContent.toLowerCase() || '';
        const categoria = row.cells[1]?.textContent || '';

        const matchSearch = nombre.includes(searchTerm);
        const matchCategory = !categoryFilter || categoria === categoryFilter;

        row.style.display = matchSearch && matchCategory ? '' : 'none';
    });
}

// Cerrar modal
function cerrarModal() {
    document.querySelectorAll('.modal').forEach(modal => {
        modal.classList.remove('show');
    });
}

// Mostrar mensaje
function mostrarMensaje(mensaje, tipo = 'info') {
    const alertClass = `alert alert-${tipo}`;
    const alertHTML = `<div class="${alertClass}">${mensaje}</div>`;
    
    // Crear contenedor temporal
    const temp = document.createElement('div');
    temp.innerHTML = alertHTML;
    const alert = temp.firstElementChild;
    
    // Insertar al inicio del main-content
    const mainContent = document.querySelector('.main-content');
    mainContent.insertBefore(alert, mainContent.firstChild);
    
    // Remover después de 3 segundos
    setTimeout(() => alert.remove(), 3000);
}

// ==================== REPORTES ====================

// Cargar años disponibles para el selector
async function cargarAnosDisponibles() {
    console.log('Iniciando cargarAnosDisponibles...');
    try {
        console.log(`Llamando a /anos-disponibles`);
        const anos = await llamadaAPILocal('/anos-disponibles');
        if (!anos) return;
        console.log('Años disponibles:', anos);
        
        const selector = document.getElementById('year-selector');
        if (!selector) {
            console.error('No se encontró el selector #year-selector');
            return;
        }
        
        selector.innerHTML = '';
        
        if (anos.length === 0) {
            selector.innerHTML = '<option value="">Sin datos disponibles</option>';
            return;
        }
        
        anos.forEach(ano => {
            const option = document.createElement('option');
            option.value = ano;
            option.textContent = ano;
            selector.appendChild(option);
        });
        
        // Seleccionar el año actual por defecto
        const anoActual = new Date().getFullYear();
        selector.value = anoActual;
        
        // Cargar reportes del año seleccionado
        cargarReportes();
    } catch (error) {
        console.error('Error cargando años disponibles:', error);
    }
}

// Cargar reportes del año seleccionado
async function cargarReportes() {
    const anoSeleccionado = document.getElementById('year-selector').value;
    console.log('Año seleccionado para cargar reportes:', anoSeleccionado);
    
    if (!anoSeleccionado) {
        document.getElementById('monthly-report-table').innerHTML = 
            '<tr style="text-align: center; color: #999;"><td colspan="5" style="padding: 2rem;">Selecciona un año para ver el detalle mensual</td></tr>';
        return;
    }
    
    try {
        console.log(`Llamando a /reportes/${anoSeleccionado}`);
        const datos = await llamadaAPILocal(`/reportes/${anoSeleccionado}`);
        if (!datos) return;
        console.log('Datos del reporte:', datos);
        
        // Actualizar resumen anual
        document.getElementById('annual-compras').textContent = `$${(datos.anual.costo_compras || 0).toFixed(2)}`;
        document.getElementById('annual-ventas').textContent = `$${(datos.anual.ingresos_ventas || 0).toFixed(2)}`;
        document.getElementById('annual-ganancia').textContent = `$${(datos.anual.ganancia_neta || 0).toFixed(2)}`;
        document.getElementById('annual-margen').textContent = `${datos.anual.margen_ganancia_porcentaje}%`;
        
        // Actualizar tabla mensual
        const meses = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 
                       'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
        
        let filas = '';
        datos.mensual.forEach((mes, index) => {
            const margen = mes.ingresos_ventas > 0 ? ((mes.ganancia_neta / mes.ingresos_ventas) * 100).toFixed(2) : '0';
            filas += `
                <tr style="border-bottom: 1px solid #eee;">
                    <td style="padding: 1rem; font-weight: 500;">${meses[index]}</td>
                    <td style="padding: 1rem; text-align: right;">$${(mes.costo_compras || 0).toFixed(2)}</td>
                    <td style="padding: 1rem; text-align: right;">$${(mes.ingresos_ventas || 0).toFixed(2)}</td>
                    <td style="padding: 1rem; text-align: right; color: #16a34a; font-weight: bold;">$${(mes.ganancia_neta || 0).toFixed(2)}</td>
                    <td style="padding: 1rem; text-align: right; color: #16a34a;">${margen}%</td>
                </tr>
            `;
        });
        
        document.getElementById('monthly-report-table').innerHTML = filas;
    } catch (error) {
        console.error('Error cargando reportes:', error);
        console.error('Stack:', error.stack);
        mostrarMensaje('Error al cargar los reportes: ' + error.message, 'error');
    }
}

// Agregar event listener para cambio de año después de cargar
function agregarEventoAñoSelector() {
    const yearSelector = document.getElementById('year-selector');
    if (yearSelector) {
        yearSelector.addEventListener('change', cargarReportes);
        console.log('Event listener agregado al year-selector');
    }
}

// Función para ir al panel de administración
function irAlAdmin() {
    window.location.href = 'admin.html';
}
