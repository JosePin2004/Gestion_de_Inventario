// Test para verificar si los elementos HTML existen y se pueden actualizar
document.addEventListener('DOMContentLoaded', () => {
    console.log('=== TEST DE ACTUALIZACIÓN ===');
    
    // Verificar que los elementos existen
    const elementos = [
        'mes-costo-compras',
        'mes-ingresos-ventas', 
        'mes-ganancia-neta',
        'mes-margen-ganancia'
    ];
    
    elementos.forEach(id => {
        const elem = document.getElementById(id);
        console.log(`${id}: ${elem ? '✅ EXISTE' : '❌ NO EXISTE'}`);
    });
    
    // Intentar actualizar un elemento
    const testElem = document.getElementById('mes-ganancia-neta');
    if (testElem) {
        console.log('Contenido actual:', testElem.textContent);
        testElem.textContent = '$123.45 (TEST)';
        console.log('Contenido después del test:', testElem.textContent);
    }
});
