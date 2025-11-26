const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'Public')));

// Inicializar base de datos
const db = new sqlite3.Database('./inventario.db', (err) => {
  if (err) {
    console.error('Error al conectar a la BD:', err);
  } else {
    console.log('Conectado a la base de datos SQLite');
    inicializarBD();
  }
});

// Crear tablas si no existen
function inicializarBD() {
  db.run(`
    CREATE TABLE IF NOT EXISTS productos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre TEXT NOT NULL,
      descripcion TEXT,
      cantidad INTEGER NOT NULL,
      precio_proveedor REAL NOT NULL,
      precio_venta REAL NOT NULL,
      categoria TEXT,
      fecha_vencimiento DATE,
      fecha_entrada DATE,
      contador_ventas INTEGER DEFAULT 0,
      fecha_creacion DATETIME DEFAULT CURRENT_TIMESTAMP,
      fecha_actualizacion DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `, (err) => {
    if (err) console.error('Error creando tabla productos:', err);
    else agregarDatosMuestra();
  });

  db.run(`
    CREATE TABLE IF NOT EXISTS movimientos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      producto_id INTEGER NOT NULL,
      tipo TEXT NOT NULL,
      cantidad INTEGER NOT NULL,
      descripcion TEXT,
      fecha DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (producto_id) REFERENCES productos(id)
    )
  `, (err) => {
    if (err) console.error('Error creando tabla movimientos:', err);
  });

  db.run(`
    CREATE TABLE IF NOT EXISTS ventas_ganancias (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      producto_id INTEGER NOT NULL,
      cantidad INTEGER NOT NULL,
      ganancia_unitaria REAL NOT NULL,
      ganancia_total REAL NOT NULL,
      fecha DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (producto_id) REFERENCES productos(id)
    )
  `, (err) => {
    if (err) console.error('Error creando tabla ventas_ganancias:', err);
  });

  db.run(`
    CREATE TABLE IF NOT EXISTS resumen_mensual (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      año INTEGER NOT NULL,
      mes INTEGER NOT NULL,
      ganancia_total REAL DEFAULT 0,
      costo_total_compras REAL DEFAULT 0,
      ingresos_total_ventas REAL DEFAULT 0,
      fecha_creacion DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(año, mes)
    )
  `, (err) => {
    if (err) console.error('Error creando tabla resumen_mensual:', err);
  });
}

// Agregar datos de muestra
function agregarDatosMuestra() {
  db.get('SELECT COUNT(*) as count FROM productos', (err, row) => {
    if (row && row.count === 0) {
      console.log('Agregando datos de muestra...');
      const productos = [
        { nombre: 'Manzanas', cantidad: 15, precio_proveedor: 1.50, precio_venta: 2.50, categoria: 'Frutas y Verduras', fecha_vencimiento: '2025-12-20' },
        { nombre: 'Plátanos', cantidad: 20, precio_proveedor: 0.80, precio_venta: 1.50, categoria: 'Frutas y Verduras', fecha_vencimiento: '2025-11-28' },
        { nombre: 'Leche', cantidad: 8, precio_proveedor: 3.50, precio_venta: 5.00, categoria: 'Lácteos', fecha_vencimiento: '2025-12-10' },
        { nombre: 'Pollo', cantidad: 5, precio_proveedor: 8.00, precio_venta: 12.00, categoria: 'Carnes y Aves', fecha_vencimiento: '2025-11-27' },
        { nombre: 'Pan', cantidad: 25, precio_proveedor: 1.80, precio_venta: 3.00, categoria: 'Panificados', fecha_vencimiento: '2025-11-26' }
      ];
      
      productos.forEach(p => {
        db.run(
          `INSERT INTO productos (nombre, cantidad, precio_proveedor, precio_venta, categoria, fecha_vencimiento) VALUES (?, ?, ?, ?, ?, ?)`,
          [p.nombre, p.cantidad, p.precio_proveedor, p.precio_venta, p.categoria, p.fecha_vencimiento],
          (err) => {
            if (err) console.error('Error agregando producto de muestra:', err);
            else console.log(`Producto agregado: ${p.nombre}`);
          }
        );
      });
    }
  });
}

// RUTAS API

// Obtener todos los productos
app.get('/api/productos', (req, res) => {
  db.all('SELECT * FROM productos ORDER BY nombre', (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
    } else {
      // Aplicar descuentos basados en fecha de vencimiento
      const productosConDescuento = rows.map(p => {
        const descuento = calcularDescuento(p.fecha_vencimiento, p.precio_venta);
        return { ...p, ...descuento };
      });
      res.json(productosConDescuento);
    }
  });
});

// Función para calcular descuento basado en fecha de vencimiento
function calcularDescuento(fechaVencimiento, precio_venta) {
  if (!fechaVencimiento) {
    return { precio_final: precio_venta, descuento: 0, disponible: true };
  }

  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  
  const fecha = new Date(fechaVencimiento);
  fecha.setHours(0, 0, 0, 0);
  
  const diasDiferencia = Math.floor((fecha - hoy) / (1000 * 60 * 60 * 24));

  if (diasDiferencia < 0) {
    // Caducado - no disponible
    return { precio_final: 0, descuento: 100, disponible: false, razon: 'caducado' };
  } else if (diasDiferencia < 5) {
    // Menos de 5 días - 50% descuento
    return { 
      precio_final: precio_venta * 0.5, 
      descuento: 50, 
      disponible: true,
      razon: 'proximo_caducar'
    };
  } else if (diasDiferencia < 15) {
    // 5-15 días - 25% descuento
    return { 
      precio_final: precio_venta * 0.75, 
      descuento: 25, 
      disponible: true,
      razon: 'proximo_caducar'
    };
  } else if (diasDiferencia <= 30) {
    // 15-30 días - 10% descuento
    return { 
      precio_final: precio_venta * 0.9, 
      descuento: 10, 
      disponible: true,
      razon: 'proximo_caducar'
    };
  } else {
    // Más de 30 días - sin descuento
    return { precio_final: precio_venta, descuento: 0, disponible: true };
  }
}

// Obtener un producto por ID
app.get('/api/productos/:id', (req, res) => {
  db.get('SELECT * FROM productos WHERE id = ?', [req.params.id], (err, row) => {
    if (err) {
      res.status(500).json({ error: err.message });
    } else if (!row) {
      res.status(404).json({ error: 'Producto no encontrado' });
    } else {
      const descuento = calcularDescuento(row.fecha_vencimiento, row.precio_venta);
      res.json({ ...row, ...descuento });
    }
  });
});

// Crear nuevo producto
app.post('/api/productos', (req, res) => {
  const { nombre, descripcion, cantidad, precio_proveedor, precio_venta, categoria, fecha_vencimiento, fecha_entrada } = req.body;

  if (!nombre || cantidad === undefined || precio_proveedor === undefined || precio_venta === undefined) {
    return res.status(400).json({ error: 'Campos requeridos: nombre, cantidad, precio_proveedor, precio_venta' });
  }

  db.run(
    `INSERT INTO productos (nombre, descripcion, cantidad, precio_proveedor, precio_venta, categoria, fecha_vencimiento, fecha_entrada) 
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [nombre, descripcion, cantidad, precio_proveedor, precio_venta, categoria, fecha_vencimiento || null, fecha_entrada || null],
    function(err) {
      if (err) {
        res.status(500).json({ error: err.message });
      } else {
        res.json({ id: this.lastID, message: 'Producto creado exitosamente' });
      }
    }
  );
});

// Actualizar producto
app.put('/api/productos/:id', (req, res) => {
  const { nombre, descripcion, cantidad, precio_proveedor, precio_venta, categoria, fecha_vencimiento, fecha_entrada } = req.body;

  db.run(
    `UPDATE productos 
     SET nombre = ?, descripcion = ?, cantidad = ?, precio_proveedor = ?, precio_venta = ?, categoria = ?, fecha_vencimiento = ?, fecha_entrada = ?, fecha_actualizacion = CURRENT_TIMESTAMP
     WHERE id = ?`,
    [nombre, descripcion, cantidad, precio_proveedor, precio_venta, categoria, fecha_vencimiento || null, fecha_entrada || null, req.params.id],
    function(err) {
      if (err) {
        res.status(500).json({ error: err.message });
      } else if (this.changes === 0) {
        res.status(404).json({ error: 'Producto no encontrado' });
      } else {
        res.json({ message: 'Producto actualizado exitosamente' });
      }
    }
  );
});

// Eliminar producto
app.delete('/api/productos/:id', (req, res) => {
  db.run('DELETE FROM productos WHERE id = ?', [req.params.id], function(err) {
    if (err) {
      res.status(500).json({ error: err.message });
    } else if (this.changes === 0) {
      res.status(404).json({ error: 'Producto no encontrado' });
    } else {
      res.json({ message: 'Producto eliminado exitosamente' });
    }
  });
});

// Obtener movimientos de un producto
app.get('/api/movimientos/:producto_id', (req, res) => {
  db.all(
    'SELECT * FROM movimientos WHERE producto_id = ? ORDER BY fecha DESC',
    [req.params.producto_id],
    (err, rows) => {
      if (err) {
        res.status(500).json({ error: err.message });
      } else {
        res.json(rows);
      }
    }
  );
});

// Registrar movimiento de inventario
app.post('/api/movimientos', (req, res) => {
  const { producto_id, tipo, cantidad, descripcion } = req.body;

  if (!producto_id || !tipo || !cantidad) {
    return res.status(400).json({ error: 'Campos requeridos: producto_id, tipo, cantidad' });
  }

  // Verificar si el producto está caducado
  db.get('SELECT fecha_vencimiento, precio_venta, precio_proveedor FROM productos WHERE id = ?', [producto_id], (err, producto) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }

    if (producto && producto.fecha_vencimiento) {
      const hoy = new Date();
      hoy.setHours(0, 0, 0, 0);
      const fecha = new Date(producto.fecha_vencimiento);
      fecha.setHours(0, 0, 0, 0);
      const diasDiferencia = Math.floor((fecha - hoy) / (1000 * 60 * 60 * 24));

      if (diasDiferencia < 0 && tipo === 'salida') {
        return res.status(400).json({ error: 'No se puede vender un producto caducado' });
      }
    }

    // Actualizar cantidad del producto
    const operador = tipo === 'entrada' ? '+' : '-';
    db.run(
      `UPDATE productos SET cantidad = cantidad ${operador} ? WHERE id = ?`,
      [cantidad, producto_id],
      function(err) {
        if (err) {
          return res.status(500).json({ error: err.message });
        }

        // Registrar movimiento
        db.run(
          `INSERT INTO movimientos (producto_id, tipo, cantidad, descripcion) VALUES (?, ?, ?, ?)`,
          [producto_id, tipo, cantidad, descripcion],
          function(err) {
            if (err) {
              res.status(500).json({ error: err.message });
            } else {
              // Si es una salida, registrar ganancia e incrementar contador
              if (tipo === 'salida') {
                const ganancia_unitaria = producto.precio_venta - producto.precio_proveedor;
                const ganancia_total = ganancia_unitaria * cantidad;
                
                // Registrar ganancia de la venta
                db.run(
                  `INSERT INTO ventas_ganancias (producto_id, cantidad, ganancia_unitaria, ganancia_total) VALUES (?, ?, ?, ?)`,
                  [producto_id, cantidad, ganancia_unitaria, ganancia_total],
                  (err) => {
                    if (err) {
                      console.error('Error al registrar ganancia:', err.message);
                    }
                  }
                );
                
                // Incrementar contador de ventas
                db.run(
                  `UPDATE productos SET contador_ventas = contador_ventas + ? WHERE id = ?`,
                  [cantidad, producto_id],
                  (err) => {
                    if (err) {
                      console.error('Error al incrementar contador:', err.message);
                    }
                  }
                );
              }
              res.json({ id: this.lastID, message: 'Movimiento registrado' });
            }
          }
        );
      }
    );
  });
});

// Obtener resumen de inventario
app.get('/api/resumen', (req, res) => {
  db.get(
    `SELECT 
      COUNT(*) as total_productos,
      SUM(cantidad) as cantidad_total,
      SUM(cantidad * precio_venta) as valor_total
     FROM productos`,
    (err, row) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      
      // Obtener ganancia total de las ventas realizadas
      db.get(
        `SELECT SUM(ganancia_total) as ganancia_total FROM ventas_ganancias`,
        (err, ganancias) => {
          if (err) {
            return res.status(500).json({ error: err.message });
          }
          
          const resumen = {
            total_productos: row.total_productos || 0,
            cantidad_total: row.cantidad_total || 0,
            valor_total: row.valor_total || 0,
            ganancia_total: ganancias.ganancia_total || 0
          };
          
          res.json(resumen);
        }
      );
    }
  );
});

// Obtener resumen del mes actual
app.get('/api/resumen-mensual', (req, res) => {
  const hoy = new Date();
  const año = hoy.getFullYear();
  const mes = hoy.getMonth() + 1;
  
  // Ventas del mes actual
  db.get(
    `SELECT 
      COUNT(*) as total_ventas,
      SUM(cantidad) as total_unidades_vendidas,
      SUM(ganancia_total) as ganancia_total_ventas,
      SUM(cantidad * ganancia_unitaria / (ganancia_unitaria + precio_proveedor) * precio_proveedor) as costo_vendido
     FROM ventas_ganancias
     WHERE strftime('%Y-%m', fecha) = ?`,
    [`${año}-${String(mes).padStart(2, '0')}`],
    (err, ventasData) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      
      // Entradas (compras) del mes actual
      db.all(
        `SELECT 
          m.producto_id,
          p.nombre,
          m.cantidad,
          p.precio_proveedor,
          m.cantidad * p.precio_proveedor as costo_total
         FROM movimientos m
         JOIN productos p ON m.producto_id = p.id
         WHERE m.tipo = 'entrada' AND strftime('%Y-%m', m.fecha) = ?
         ORDER BY m.fecha DESC`,
        [`${año}-${String(mes).padStart(2, '0')}`],
        (err, compras) => {
          if (err) {
            return res.status(500).json({ error: err.message });
          }
          
          // Ventas del mes actual con detalle
          db.all(
            `SELECT 
              vg.producto_id,
              p.nombre,
              vg.cantidad,
              vg.ganancia_unitaria,
              vg.ganancia_total,
              p.precio_venta,
              (vg.cantidad * vg.ganancia_unitaria / (vg.ganancia_unitaria + p.precio_proveedor) * p.precio_proveedor) as costo_vendido
             FROM ventas_ganancias vg
             JOIN productos p ON vg.producto_id = p.id
             WHERE strftime('%Y-%m', vg.fecha) = ?
             ORDER BY vg.fecha DESC`,
            [`${año}-${String(mes).padStart(2, '0')}`],
            (err, ventas) => {
              if (err) {
                return res.status(500).json({ error: err.message });
              }
              
              const costoTotalCompras = compras.reduce((acc, c) => acc + (c.costo_total || 0), 0);
              const ingresosTotalVentas = ventas.reduce((acc, v) => acc + (v.cantidad * v.precio_venta || 0), 0);
              const gananciaTotal = ventas.reduce((acc, v) => acc + (v.ganancia_total || 0), 0);
              
              res.json({
                mes: mes,
                año: año,
                compras: {
                  total_items: compras.length,
                  costo_total: costoTotalCompras,
                  detalle: compras
                },
                ventas: {
                  total_transacciones: ventasData.total_ventas || 0,
                  total_unidades: ventasData.total_unidades_vendidas || 0,
                  ingresos_total: ingresosTotalVentas,
                  ganancia_total: gananciaTotal,
                  detalle: ventas
                },
                comparativa: {
                  costo_compras: costoTotalCompras,
                  ingresos_ventas: ingresosTotalVentas,
                  ganancia_neta: gananciaTotal,
                  margen_ganancia_porcentaje: ingresosTotalVentas > 0 ? ((gananciaTotal / ingresosTotalVentas) * 100).toFixed(2) : 0
                }
              });
            }
          );
        }
      );
    }
  );
});

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`Servidor ejecutándose en http://localhost:${PORT}`);
});
