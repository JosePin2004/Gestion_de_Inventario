// API Base URL
const API_URL = 'http://localhost:3000/api';
let productoActualEnMovimiento = null;

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
    cargarProductos();
    cargarResumen();
    inicializarEventos();
    // Cargar resumen cada 5 segundos
    setInterval(cargarResumen, 5000);
});

// Inicializar eventos
function inicializarEventos() {
    // Navegación
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            cambiarSeccion(e.target.dataset.section);
        });
    });

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
    // Desactivar todas las secciones
    document.querySelectorAll('.section').forEach(s => {
        s.classList.remove('active');
    });

    // Desactivar todos los botones nav
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.classList.remove('active');
    });

    // Activar sección y botón seleccionados
    document.getElementById(seccion).classList.add('active');
    document.querySelector(`[data-section="${seccion}"]`).classList.add('active');

    // Recargar datos si es necesario
    if (seccion === 'productos') {
        cargarProductos();
    }
}

// Cargar productos
async function cargarProductos() {
    try {
        const response = await fetch(`${API_URL}/productos`);
        const productos = await response.json();

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
        const response = await fetch(`${API_URL}/productos`);
        const productos = await response.json();

        const resumenResponse = await fetch(`${API_URL}/resumen`);
        const resumen = await resumenResponse.json();

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

// Cargar resumen mensual
async function cargarResumenMensual() {
    try {
        const response = await fetch(`${API_URL}/resumen-mensual`);
        const datos = await response.json();

        // Actualizar totales mensuales
        document.getElementById('mes-costo-compras').textContent = `$${(datos.comparativa.costo_compras || 0).toFixed(2)}`;
        document.getElementById('mes-ingresos-ventas').textContent = `$${(datos.comparativa.ingresos_ventas || 0).toFixed(2)}`;
        document.getElementById('mes-ganancia-neta').textContent = `$${(datos.comparativa.ganancia_neta || 0).toFixed(2)}`;
        document.getElementById('mes-margen-ganancia').textContent = `${datos.comparativa.margen_ganancia_porcentaje}%`;

        // Llenar tabla de compras
        const comprasTable = document.getElementById('mes-compras-detalle');
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
        const response = await fetch(`${API_URL}/productos`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(producto)
        });

        if (response.ok) {
            mostrarMensaje('Producto agregado exitosamente', 'success');
            document.getElementById('form-producto').reset();
            await cargarProductos();
            await cargarResumen();
            cambiarSeccion('productos');
        } else {
            const error = await response.json();
            mostrarMensaje(error.error || 'Error al agregar producto', 'error');
        }
    } catch (error) {
        console.error('Error:', error);
        mostrarMensaje('Error al agregar producto: ' + error.message, 'error');
    }
}

// Abrir modal para editar
async function abrirEditar(id) {
    try {
        const response = await fetch(`${API_URL}/productos/${id}`);
        const producto = await response.json();

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
        const response = await fetch(`${API_URL}/productos/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(producto)
        });

        if (response.ok) {
            mostrarMensaje('Producto actualizado exitosamente', 'success');
            cerrarModal();
            cargarProductos();
            cargarResumen();
        } else {
            const error = await response.json();
            mostrarMensaje(error.error || 'Error al actualizar', 'error');
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
        const response = await fetch(`${API_URL}/productos/${id}`, {
            method: 'DELETE'
        });

        if (response.ok) {
            mostrarMensaje('Producto eliminado exitosamente', 'success');
            cargarProductos();
            cargarResumen();
        } else {
            const error = await response.json();
            mostrarMensaje(error.error || 'Error al eliminar', 'error');
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
        const response = await fetch(`${API_URL}/movimientos/${productoId}`);
        const movimientos = await response.json();

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
        const response = await fetch(`${API_URL}/movimientos`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                producto_id: productoActualEnMovimiento,
                tipo: tipo,
                cantidad: cantidad,
                descripcion: descripcion
            })
        });

        if (response.ok) {
            mostrarMensaje('Movimiento registrado exitosamente', 'success');
            document.getElementById('cantidad-movimiento').value = '';
            document.getElementById('descripcion-movimiento').value = '';
            await cargarHistorialMovimientos(productoActualEnMovimiento);
            cargarProductos();
            cargarResumen();
        } else {
            const error = await response.json();
            mostrarMensaje(error.error || 'Error al registrar movimiento', 'error');
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
