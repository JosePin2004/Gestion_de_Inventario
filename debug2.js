const sqlite3 = require('sqlite3').verbose();

const db = new sqlite3.Database('./inventario.db', (err) => {
  if (err) {
    console.error('Error:', err);
  } else {
    const hoy = new Date();
    const año = hoy.getFullYear();
    const mes = hoy.getMonth() + 1;
    const mesFormatted = `${año}-${String(mes).padStart(2, '0')}`;
    
    console.log(`Buscando datos para: ${mesFormatted}\n`);
    
    // Ventas del mes actual
    db.get(
      `SELECT 
        COUNT(*) as total_ventas,
        SUM(cantidad) as total_unidades_vendidas,
        SUM(ganancia_total) as ganancia_total_ventas
       FROM ventas_ganancias
       WHERE strftime('%Y-%m', fecha) = ?`,
      [mesFormatted],
      (err, ventasData) => {
        console.log('RESULTADO VENTAS_GANANCIAS:', JSON.stringify(ventasData, null, 2));
        
        // Entradas del mes actual
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
          [mesFormatted],
          (err, compras) => {
            console.log('\nRESULTADO COMPRAS:', JSON.stringify(compras, null, 2));
            
            // Ventas del mes actual con detalle
            db.all(
              `SELECT 
                vg.producto_id,
                p.nombre,
                vg.cantidad,
                vg.ganancia_unitaria,
                vg.ganancia_total,
                p.precio_venta
               FROM ventas_ganancias vg
               JOIN productos p ON vg.producto_id = p.id
               WHERE strftime('%Y-%m', vg.fecha) = ?
               ORDER BY vg.fecha DESC`,
              [mesFormatted],
              (err, ventas) => {
                console.log('\nRESULTADO DETALLE VENTAS:', JSON.stringify(ventas, null, 2));
                
                const costoTotalCompras = compras.reduce((acc, c) => acc + (c.costo_total || 0), 0);
                const ingresosTotalVentas = ventas.reduce((acc, v) => acc + (v.cantidad * v.precio_venta || 0), 0);
                const gananciaTotal = ventas.reduce((acc, v) => acc + (v.ganancia_total || 0), 0);
                
                console.log('\nCALCULOS FINALES:');
                console.log('Costo total compras:', costoTotalCompras);
                console.log('Ingresos total ventas:', ingresosTotalVentas);
                console.log('Ganancia total:', gananciaTotal);
                console.log('Margen:', ingresosTotalVentas > 0 ? ((gananciaTotal / ingresosTotalVentas) * 100).toFixed(2) : 0);
                
                db.close();
              }
            );
          }
        );
      }
    );
  }
});
