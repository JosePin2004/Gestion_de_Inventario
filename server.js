const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = 'tu_secreto_jwt_super_seguro_cambiar_en_produccion';

// Crear directorio usuarios_data si no existe
const usuariosDataDir = path.join(__dirname, 'usuarios_data');
if (!fs.existsSync(usuariosDataDir)) {
  fs.mkdirSync(usuariosDataDir, { recursive: true });
}

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'Public')));

// Redireccionar a auth.html si intenta acceder a / sin token
app.get('/', (req, res) => {
  const token = req.headers['authorization']?.split(' ')[1];
  if (!token) {
    res.redirect('/auth.html');
  } else {
    res.sendFile(path.join(__dirname, 'Public', 'index.html'));
  }
});

// Inicializar base de datos de usuarios (maestra)
const dbUsers = new sqlite3.Database('./usuarios.db', (err) => {
  if (err) {
    console.error('Error al conectar a BD usuarios:', err);
  } else {
    console.log('Conectado a base de datos de usuarios');
    inicializarBDUsuarios();
  }
});

// Crear tabla de usuarios
function inicializarBDUsuarios() {
  // Primero, intentar agregar la columna es_admin si no existe
  dbUsers.run(`
    ALTER TABLE usuarios ADD COLUMN es_admin BOOLEAN DEFAULT 0
  `, (err) => {
    // Ignorar error si la columna ya existe
    if (err && err.code !== 'SQLITE_ERROR') {
      console.error('Error alterando tabla usuarios:', err);
    }
  });

  // Crear tabla de usuarios si no existe
  dbUsers.run(`
    CREATE TABLE IF NOT EXISTS usuarios (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre_usuario TEXT UNIQUE NOT NULL,
      email TEXT UNIQUE NOT NULL,
      contraseña TEXT NOT NULL,
      es_admin BOOLEAN DEFAULT 0,
      fecha_creacion DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `, (err) => {
    if (err) console.error('Error creando tabla usuarios:', err);
  });

  // Crear tabla de sesiones activas
  dbUsers.run(`
    CREATE TABLE IF NOT EXISTS sesiones (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      usuario_id INTEGER NOT NULL,
      token TEXT NOT NULL,
      fecha_login DATETIME DEFAULT CURRENT_TIMESTAMP,
      ultima_actividad DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
    )
  `, (err) => {
    if (err) console.error('Error creando tabla sesiones:', err);
  });

  // Crear usuario admin por defecto después de un pequeño delay
  setTimeout(() => {
    crearUsuarioAdmin();
  }, 500);
}

// Crear usuario administrador
async function crearUsuarioAdmin() {
  dbUsers.get('SELECT * FROM usuarios WHERE nombre_usuario = ?', ['admin'], async (err, row) => {
    if (!row) {
      // El usuario admin no existe, crearlo
      const hashedPassword = await bcrypt.hash('admin123', 10);
      dbUsers.run(
        'INSERT INTO usuarios (nombre_usuario, email, contraseña, es_admin) VALUES (?, ?, ?, ?)',
        ['admin', 'admin@inventario.local', hashedPassword, 1],
        function(err) {
          if (err) console.error('Error creando usuario admin:', err);
          else {
            console.log('✅ Usuario admin creado (usuario: admin, contraseña: admin123)');
            // Inicializar BD del admin (ID=1)
            const dbAdminPersonal = obtenerDBUsuario(1);
            inicializarBDUsuarioPersonal(dbAdminPersonal);
          }
        }
      );
    } else if (!row.es_admin) {
      // Si el usuario admin existe pero no es admin, actualizar
      dbUsers.run('UPDATE usuarios SET es_admin = 1 WHERE nombre_usuario = ?', ['admin']);
    } else {
      // Admin ya existe, verificar si tiene tablas
      const dbAdminCheck = obtenerDBUsuario(row.id);
      dbAdminCheck.get("SELECT name FROM sqlite_master WHERE type='table' AND name='productos'", (err, tableRow) => {
        if (!tableRow) {
          // Las tablas no existen, crearlas
          console.log('📋 Creando tablas para usuario admin...');
          inicializarBDUsuarioPersonal(dbAdminCheck);
        }
      });
    }
  });
}

// Función para obtener la BD del usuario
function obtenerDBUsuario(usuarioId) {
  return new sqlite3.Database(`./usuarios_data/usuario_${usuarioId}.db`);
}

// Middleware para verificar token JWT
function verificarToken(req, res, next) {
  const token = req.headers['authorization']?.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ error: 'Token no proporcionado' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.usuarioId = decoded.id;
    req.nombreUsuario = decoded.nombreUsuario;
    req.esAdmin = decoded.esAdmin;
    next();
  } catch (error) {
    res.status(401).json({ error: 'Token inválido' });
  }
}

// Middleware para verificar si es administrador
function verificarAdmin(req, res, next) {
  if (!req.esAdmin) {
    return res.status(403).json({ error: 'Acceso denegado: Solo administradores' });
  }
  next();
}

// ENDPOINTS DE AUTENTICACIÓN

// Registro
app.post('/api/auth/registro', async (req, res) => {
  const { nombreUsuario, email, contraseña } = req.body;

  if (!nombreUsuario || !email || !contraseña) {
    return res.status(400).json({ error: 'Campos requeridos' });
  }

  try {
    const contraseñaHash = await bcrypt.hash(contraseña, 10);

    dbUsers.run(
      'INSERT INTO usuarios (nombre_usuario, email, contraseña) VALUES (?, ?, ?)',
      [nombreUsuario, email, contraseñaHash],
      function(err) {
        if (err) {
          if (err.message.includes('UNIQUE constraint failed')) {
            return res.status(400).json({ error: 'Usuario o email ya existe' });
          }
          return res.status(500).json({ error: err.message });
        }

        const usuarioId = this.lastID;

        // Crear BD personal para el usuario
        const dbPersonal = obtenerDBUsuario(usuarioId);
        inicializarBDUsuarioPersonal(dbPersonal);

        // Agregar datos de prueba para demostración
        const productosPrueba = [
          { nombre: 'Arroz Premium', categoria: 'Granos y Cereales', descripcion: 'Arroz blanco de calidad', cantidad: 50, precio_proveedor: 0.50, precio_venta: 1.50, fecha_entrada: new Date().toISOString().split('T')[0] },
          { nombre: 'Aceite Vegetal', categoria: 'Aceites y Condimentos', descripcion: 'Aceite puro', cantidad: 30, precio_proveedor: 2.00, precio_venta: 4.00, fecha_entrada: new Date().toISOString().split('T')[0] },
          { nombre: 'Leche Entera', categoria: 'Lácteos', descripcion: 'Leche pasteurizada', cantidad: 40, precio_proveedor: 0.80, precio_venta: 1.50, fecha_entrada: new Date().toISOString().split('T')[0] },
          { nombre: 'Pan Integral', categoria: 'Panificados', descripcion: 'Pan fresco diario', cantidad: 20, precio_proveedor: 0.75, precio_venta: 1.50, fecha_entrada: new Date().toISOString().split('T')[0] }
        ];

        // Insertar productos de prueba
        productosPrueba.forEach(producto => {
          dbPersonal.run(
            `INSERT INTO productos (nombre, categoria, descripcion, cantidad, precio_proveedor, precio_venta, fecha_entrada)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [producto.nombre, producto.categoria, producto.descripcion, producto.cantidad, producto.precio_proveedor, producto.precio_venta, producto.fecha_entrada],
            function(err) {
              if (err) {
                console.error(`Error insertando producto ${producto.nombre}:`, err.message);
              } else {
                // Registrar movimiento de entrada para cada producto
                const productoId = this.lastID;
                dbPersonal.run(
                  `INSERT INTO movimientos (producto_id, tipo, cantidad, descripcion) VALUES (?, ?, ?, ?)`,
                  [productoId, 'entrada', producto.cantidad, 'Compra inicial de prueba'],
                  (err) => {
                    if (err) {
                      console.error(`Error registrando movimiento:`, err.message);
                    }
                  }
                );

                // Registrar algunas ventas de prueba
                const cantidadVentas = Math.floor(producto.cantidad / 3);
                if (cantidadVentas > 0) {
                  const ganancia_unitaria = producto.precio_venta - producto.precio_proveedor;
                  const ganancia_total = ganancia_unitaria * cantidadVentas;
                  const hoy = new Date().toISOString().split('T')[0];
                  
                  dbPersonal.run(
                    `INSERT INTO ventas_ganancias (producto_id, cantidad, ganancia_unitaria, ganancia_total, fecha) VALUES (?, ?, ?, ?, ?)`,
                    [productoId, cantidadVentas, ganancia_unitaria, ganancia_total, hoy],
                    (err) => {
                      if (err) {
                        console.error(`Error registrando venta:`, err.message);
                      }
                    }
                  );
                }
              }
            }
          );
        });

        const token = jwt.sign(
          { id: usuarioId, nombreUsuario },
          JWT_SECRET,
          { expiresIn: '24h' }
        );

        res.json({ 
          mensaje: 'Usuario registrado exitosamente',
          token,
          usuarioId
        });
      }
    );
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Login
app.post('/api/auth/login', (req, res) => {
  const { nombreUsuario, contraseña } = req.body;

  if (!nombreUsuario || !contraseña) {
    return res.status(400).json({ error: 'Usuario y contraseña requeridos' });
  }

  dbUsers.get(
    'SELECT * FROM usuarios WHERE nombre_usuario = ?',
    [nombreUsuario],
    async (err, usuario) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }

      if (!usuario) {
        return res.status(401).json({ error: 'Usuario o contraseña incorrectos' });
      }

      try {
        const coincide = await bcrypt.compare(contraseña, usuario.contraseña);

        if (!coincide) {
          return res.status(401).json({ error: 'Usuario o contraseña incorrectos' });
        }

        const token = jwt.sign(
          { id: usuario.id, nombreUsuario: usuario.nombre_usuario, esAdmin: usuario.es_admin },
          JWT_SECRET,
          { expiresIn: '24h' }
        );

        // Registrar sesión
        dbUsers.run(
          'INSERT INTO sesiones (usuario_id, token) VALUES (?, ?)',
          [usuario.id, token],
          (err) => {
            if (err) console.error('Error registrando sesión:', err);
          }
        );

        res.json({ 
          mensaje: 'Sesión iniciada',
          token,
          usuarioId: usuario.id,
          nombreUsuario: usuario.nombre_usuario,
          esAdmin: usuario.es_admin
        });
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    }
  );
});

// Endpoint para logout
app.post('/api/auth/logout', verificarToken, (req, res) => {
  const token = req.headers['authorization']?.split(' ')[1];
  
  dbUsers.run(
    'DELETE FROM sesiones WHERE token = ?',
    [token],
    (err) => {
      if (err) console.error('Error eliminando sesión:', err);
      res.json({ mensaje: 'Sesión cerrada correctamente' });
    }
  );
});

// Crear tablas de productos para cada usuario
function inicializarBDUsuarioPersonal(db) {
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
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS movimientos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      producto_id INTEGER NOT NULL,
      tipo TEXT NOT NULL,
      cantidad INTEGER NOT NULL,
      descripcion TEXT,
      fecha DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS ventas_ganancias (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      producto_id INTEGER NOT NULL,
      cantidad INTEGER NOT NULL,
      ganancia_unitaria REAL NOT NULL,
      ganancia_total REAL NOT NULL,
      fecha DATE
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS resumen_mensual (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      mes INTEGER NOT NULL,
      año INTEGER NOT NULL,
      total_ventas REAL DEFAULT 0,
      total_compras REAL DEFAULT 0,
      ganancia_neta REAL DEFAULT 0,
      UNIQUE(mes, año)
    )
  `);
}

// Inicializar base de datos (mantener por compatibilidad)
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
app.get('/api/productos', verificarToken, (req, res) => {
  const dbUsuario = obtenerDBUsuario(req.usuarioId);
  
  dbUsuario.all('SELECT * FROM productos ORDER BY nombre', (err, rows) => {
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
app.get('/api/productos/:id', verificarToken, (req, res) => {
  const dbUsuario = obtenerDBUsuario(req.usuarioId);
  
  dbUsuario.get('SELECT * FROM productos WHERE id = ?', [req.params.id], (err, row) => {
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
app.post('/api/productos', verificarToken, (req, res) => {
  const dbUsuario = obtenerDBUsuario(req.usuarioId);
  const { nombre, descripcion, cantidad, precio_proveedor, precio_venta, categoria, fecha_vencimiento, fecha_entrada } = req.body;

  if (!nombre || cantidad === undefined || precio_proveedor === undefined || precio_venta === undefined) {
    return res.status(400).json({ error: 'Campos requeridos: nombre, cantidad, precio_proveedor, precio_venta' });
  }

  dbUsuario.run(
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
app.put('/api/productos/:id', verificarToken, (req, res) => {
  const dbUsuario = obtenerDBUsuario(req.usuarioId);
  const { nombre, descripcion, cantidad, precio_proveedor, precio_venta, categoria, fecha_vencimiento, fecha_entrada } = req.body;

  dbUsuario.run(
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
app.delete('/api/productos/:id', verificarToken, (req, res) => {
  const dbUsuario = obtenerDBUsuario(req.usuarioId);
  
  dbUsuario.run('DELETE FROM productos WHERE id = ?', [req.params.id], function(err) {
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
app.post('/api/movimientos', verificarToken, (req, res) => {
  const dbUsuario = obtenerDBUsuario(req.usuarioId);
  const { producto_id, tipo, cantidad, descripcion } = req.body;

  if (!producto_id || !tipo || !cantidad) {
    return res.status(400).json({ error: 'Campos requeridos: producto_id, tipo, cantidad' });
  }

  // Verificar si el producto está caducado
  dbUsuario.get('SELECT fecha_vencimiento, precio_venta, precio_proveedor FROM productos WHERE id = ?', [producto_id], (err, producto) => {
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
    dbUsuario.run(
      `UPDATE productos SET cantidad = cantidad ${operador} ? WHERE id = ?`,
      [cantidad, producto_id],
      function(err) {
        if (err) {
          return res.status(500).json({ error: err.message });
        }

        // Registrar movimiento
        dbUsuario.run(
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
                dbUsuario.run(
                  `INSERT INTO ventas_ganancias (producto_id, cantidad, ganancia_unitaria, ganancia_total) VALUES (?, ?, ?, ?)`,
                  [producto_id, cantidad, ganancia_unitaria, ganancia_total],
                  (err) => {
                    if (err) {
                      console.error('Error al registrar ganancia:', err.message);
                    }
                  }
                );
                
                // Incrementar contador de ventas
                dbUsuario.run(
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
app.get('/api/resumen', verificarToken, (req, res) => {
  const dbUsuario = obtenerDBUsuario(req.usuarioId);
  
  dbUsuario.get(
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
      dbUsuario.get(
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
app.get('/api/resumen-mensual', verificarToken, (req, res) => {
  const dbUsuario = obtenerDBUsuario(req.usuarioId);
  const hoy = new Date();
  const año = hoy.getFullYear();
  const mes = hoy.getMonth() + 1;
  
  console.log(`[${new Date().toISOString()}] Llamada a /api/resumen-mensual - Buscando datos para ${año}-${String(mes).padStart(2, '0')}`);
  
  // Ventas del mes actual
  dbUsuario.get(
    `SELECT 
      COUNT(*) as total_ventas,
      SUM(cantidad) as total_unidades_vendidas,
      SUM(ganancia_total) as ganancia_total_ventas
     FROM ventas_ganancias
     WHERE strftime('%Y-%m', fecha) = ?`,
    [`${año}-${String(mes).padStart(2, '0')}`],
    (err, ventasData) => {
      console.log(`[${new Date().toISOString()}] Callback ventasData:`, err ? `ERROR: ${err.message}` : `OK - ${JSON.stringify(ventasData)}`);
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      
      // Entradas (compras) del mes actual
      dbUsuario.all(
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
          console.log(`[${new Date().toISOString()}] Callback compras:`, err ? `ERROR: ${err.message}` : `OK - ${compras.length} registros`);
          if (err) {
            return res.status(500).json({ error: err.message });
          }
          
          // Ventas del mes actual con detalle
          dbUsuario.all(
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
              console.log(`[${new Date().toISOString()}] Callback ventas:`, err ? `ERROR: ${err.message}` : `OK - ${ventas.length} registros`);
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
              
              console.log(`[${new Date().toISOString()}] Respuesta enviada:`, JSON.stringify({
                costo_compras: costoTotalCompras,
                ingresos_ventas: ingresosTotalVentas,
                ganancia_neta: gananciaTotal
              }));
            }
          );
        }
      );
    }
  );
});

// Obtener años disponibles con datos
app.get('/api/anos-disponibles', verificarToken, (req, res) => {
  const dbUsuario = obtenerDBUsuario(req.usuarioId);
  
  dbUsuario.all(
    `SELECT DISTINCT strftime('%Y', fecha) as ano 
     FROM (
       SELECT fecha FROM ventas_ganancias
       UNION ALL
       SELECT fecha FROM movimientos
     )
     ORDER BY ano DESC`,
    (err, rows) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      const anos = rows.map(r => parseInt(r.ano));
      res.json([...new Set(anos)]);
    }
  );
});

// Obtener reportes del año
app.get('/api/reportes/:ano', verificarToken, (req, res) => {
  const dbUsuario = obtenerDBUsuario(req.usuarioId);
  const ano = req.params.ano;
  
  // Array para almacenar datos mensuales
  const meses = Array(12).fill(null).map(() => ({
    costo_compras: 0,
    ingresos_ventas: 0,
    ganancia_neta: 0,
    margen_ganancia_porcentaje: 0
  }));
  
  let comprasTotal = 0;
  let ventasTotal = 0;
  let gananciaTotal = 0;
  
  // Obtener todos los meses del año
  const getMesesDelAno = () => {
    return new Promise((resolve, reject) => {
      const queries = [];
      
      for (let mes = 1; mes <= 12; mes++) {
        const mesFormatted = String(mes).padStart(2, '0');
        const patron = `${ano}-${mesFormatted}`;
        
        // Obtener datos de compras del mes
        dbUsuario.all(
          `SELECT m.cantidad, p.precio_proveedor, m.cantidad * p.precio_proveedor as costo
           FROM movimientos m
           JOIN productos p ON m.producto_id = p.id
           WHERE m.tipo = 'entrada' AND strftime('%Y-%m', m.fecha) = ?`,
          [patron],
          (err, compras) => {
            if (!err && compras) {
              meses[mes - 1].costo_compras = compras.reduce((acc, c) => acc + (c.costo || 0), 0);
              comprasTotal += meses[mes - 1].costo_compras;
            }
            
            // Obtener datos de ventas del mes
            dbUsuario.all(
              `SELECT vg.cantidad, vg.ganancia_total, p.precio_venta
               FROM ventas_ganancias vg
               JOIN productos p ON vg.producto_id = p.id
               WHERE strftime('%Y-%m', vg.fecha) = ?`,
              [patron],
              (err, ventas) => {
                if (!err && ventas) {
                  meses[mes - 1].ingresos_ventas = ventas.reduce((acc, v) => acc + (v.cantidad * v.precio_venta || 0), 0);
                  meses[mes - 1].ganancia_neta = ventas.reduce((acc, v) => acc + (v.ganancia_total || 0), 0);
                  meses[mes - 1].margen_ganancia_porcentaje = meses[mes - 1].ingresos_ventas > 0 
                    ? ((meses[mes - 1].ganancia_neta / meses[mes - 1].ingresos_ventas) * 100).toFixed(2)
                    : 0;
                  
                  ventasTotal += meses[mes - 1].ingresos_ventas;
                  gananciaTotal += meses[mes - 1].ganancia_neta;
                }
                
                if (mes === 12) {
                  // Todas las consultas completadas
                  resolve();
                }
              }
            );
          }
        );
      }
    });
  };
  
  getMesesDelAno().then(() => {
    const margenAnual = ventasTotal > 0 ? ((gananciaTotal / ventasTotal) * 100).toFixed(2) : 0;
    
    res.json({
      ano: ano,
      anual: {
        costo_compras: comprasTotal,
        ingresos_ventas: ventasTotal,
        ganancia_neta: gananciaTotal,
        margen_ganancia_porcentaje: margenAnual
      },
      mensual: meses
    });
  }).catch(error => {
    res.status(500).json({ error: error.message });
  });
});

// ==================== ENDPOINTS DE ADMINISTRACIÓN ====================

// Obtener todos los usuarios registrados
app.get('/api/admin/usuarios-registrados', verificarToken, verificarAdmin, (req, res) => {
  dbUsers.all(
    'SELECT id, nombre_usuario, email, es_admin, fecha_creacion FROM usuarios ORDER BY fecha_creacion DESC',
    (err, usuarios) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      res.json({
        total: usuarios.length,
        usuarios
      });
    }
  );
});

// Endpoint para agregar datos de prueba (solo admin)
app.post('/api/datos-prueba', verificarToken, verificarAdmin, (req, res) => {
  const dbUsuario = obtenerDBUsuario(req.usuarioId);
  
  const productosPrueba = [
    { nombre: 'Arroz Premium', categoria: 'Granos y Cereales', descripcion: 'Arroz blanco de calidad', cantidad: 50, precio_proveedor: 0.50, precio_venta: 1.50 },
    { nombre: 'Aceite Vegetal', categoria: 'Aceites y Condimentos', descripcion: 'Aceite puro', cantidad: 30, precio_proveedor: 2.00, precio_venta: 4.00 },
    { nombre: 'Leche Entera', categoria: 'Lácteos', descripcion: 'Leche pasteurizada', cantidad: 40, precio_proveedor: 0.80, precio_venta: 1.50 },
    { nombre: 'Pan Integral', categoria: 'Panificados', descripcion: 'Pan fresco diario', cantidad: 20, precio_proveedor: 0.75, precio_venta: 1.50 }
  ];

  let productosInsertados = 0;

  productosPrueba.forEach(producto => {
    dbUsuario.run(
      `INSERT INTO productos (nombre, categoria, descripcion, cantidad, precio_proveedor, precio_venta, fecha_entrada)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [producto.nombre, producto.categoria, producto.descripcion, producto.cantidad, producto.precio_proveedor, producto.precio_venta, new Date().toISOString().split('T')[0]],
      function(err) {
        if (err) {
          console.error(`Error insertando producto ${producto.nombre}:`, err.message);
        } else {
          productosInsertados++;
          const productoId = this.lastID;
          
          // Registrar movimiento de entrada
          dbUsuario.run(
            `INSERT INTO movimientos (producto_id, tipo, cantidad, descripcion) VALUES (?, ?, ?, ?)`,
            [productoId, 'entrada', producto.cantidad, 'Compra inicial de prueba'],
            (err) => {
              if (err) {
                console.error(`Error registrando movimiento:`, err.message);
              }
            }
          );

          // Registrar ventas de prueba
          const cantidadVentas = Math.floor(producto.cantidad / 3);
          if (cantidadVentas > 0) {
            const ganancia_unitaria = producto.precio_venta - producto.precio_proveedor;
            const ganancia_total = ganancia_unitaria * cantidadVentas;
            const hoy = new Date().toISOString().split('T')[0];
            
            dbUsuario.run(
              `INSERT INTO ventas_ganancias (producto_id, cantidad, ganancia_unitaria, ganancia_total, fecha) VALUES (?, ?, ?, ?, ?)`,
              [productoId, cantidadVentas, ganancia_unitaria, ganancia_total, hoy],
              (err) => {
                if (err) {
                  console.error(`Error registrando venta:`, err.message);
                }
              }
            );
          }
        }
      }
    );
  });

  res.json({ mensaje: 'Datos de prueba siendo insertados...' });
});

// Obtener usuarios en línea
app.get('/api/admin/usuarios-online', verificarToken, verificarAdmin, (req, res) => {
  // Limpiar sesiones que tengan más de 1 hora sin actividad
  const hace1Hora = new Date(Date.now() - 3600000).toISOString();
  
  dbUsers.run(
    'DELETE FROM sesiones WHERE ultima_actividad < ?',
    [hace1Hora],
    (err) => {
      if (err) console.error('Error limpiando sesiones:', err);
    }
  );

  // Obtener usuarios en línea (sesiones activas en los últimos 30 minutos)
  const hace30Min = new Date(Date.now() - 1800000).toISOString();
  
  dbUsers.all(
    `SELECT DISTINCT u.id, u.nombre_usuario, u.email, COUNT(s.id) as sesiones_activas, 
     MAX(s.fecha_login) as ultima_conexion, MAX(s.ultima_actividad) as ultima_actividad
     FROM usuarios u
     LEFT JOIN sesiones s ON u.id = s.usuario_id AND s.ultima_actividad > ?
     GROUP BY u.id
     ORDER BY u.nombre_usuario`,
    [hace30Min],
    (err, usuarios) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      
      const usuariosEnLinea = usuarios.filter(u => u.sesiones_activas > 0);
      
      res.json({
        total_online: usuariosEnLinea.length,
        usuarios_online: usuariosEnLinea,
        usuarios_offline: usuarios.filter(u => u.sesiones_activas === 0)
      });
    }
  );
});

// Actualizar última actividad del usuario
app.post('/api/admin/actualizar-actividad', verificarToken, (req, res) => {
  const token = req.headers['authorization']?.split(' ')[1];
  
  dbUsers.run(
    'UPDATE sesiones SET ultima_actividad = CURRENT_TIMESTAMP WHERE token = ?',
    [token],
    (err) => {
      if (err) console.error('Error actualizando actividad:', err);
      res.json({ ok: true });
    }
  );
});

// Iniciar servidor
const os = require('os');

// Obtener la IP local
function getLocalIP() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      // Ignorar direcciones IPv6 y localhost
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return 'localhost';
}

const localIP = getLocalIP();

app.listen(PORT, '0.0.0.0', () => {
  console.log(`\n✅ Servidor ejecutándose`);
  console.log(`📱 Acceso local: http://localhost:${PORT}`);
  console.log(`🌐 Acceso en red: http://${localIP}:${PORT}`);
  console.log(`\nComparte este enlace con otros: http://${localIP}:${PORT}\n`);
});
