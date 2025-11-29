const sqlite3 = require('sqlite3').verbose();

const db = new sqlite3.Database('./inventario.db', (err) => {
  if (err) {
    console.error('Error:', err);
  } else {
    console.log('=== VERIFICACIÓN DE DATOS ===\n');
    
    // Verificar productos
    db.all('SELECT * FROM productos', (err, rows) => {
      if (err) console.error('Error productos:', err);
      else console.log('PRODUCTOS:', JSON.stringify(rows, null, 2));
    });
    
    // Verificar movimientos
    db.all('SELECT * FROM movimientos', (err, rows) => {
      if (err) console.error('Error movimientos:', err);
      else console.log('\nMOVIMIENTOS:', JSON.stringify(rows, null, 2));
    });
    
    // Verificar ventas_ganancias
    db.all('SELECT * FROM ventas_ganancias', (err, rows) => {
      if (err) console.error('Error ventas_ganancias:', err);
      else console.log('\nVENTAS_GANANCIAS:', JSON.stringify(rows, null, 2));
      
      db.close();
    });
  }
});
