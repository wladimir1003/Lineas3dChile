# Líneas Eléctricas Chile 3D/AR V1.3

Creado por **Wladimir Campos**  
www.JFSasesorias.org

## Correcciones principales

- Laboratorio 3D rehecho con una sola transformación para modelo y anclajes.
- Dirección longitudinal del vano: eje X, indicada con flecha roja.
- Crucetas: eje Z, indicado con flecha azul; quedan a 90° del vano.
- Los puntos de anclaje reciben la misma escala, normalización, rotación y traslación del GLB.
- Las catenarias se conectan a los extremos inferiores de los aisladores.
- La selección de línea se guarda en IndexedDB, evitando límites de `sessionStorage`.
- El botón **3D/AR línea seleccionada** solo acepta LineString o MultiLineString.
- La página AR no se bloquea cuando falta selección: muestra un diagnóstico visible.
- La línea completa seleccionada se reconstruye con torres, aisladores y vanos a lo largo de toda su geometría.

## Prueba recomendada

1. Abra `diagnostico.html`.
2. Cargue **Datos Chile** u **OSM zona**.
3. Toque una línea eléctrica.
4. Presione **3D/AR línea seleccionada**.
5. En la página nueva presione **Reconstruir línea completa 3D**.
6. En Android compatible puede probar **Colocar maqueta en AR**.

## Laboratorio

En `3d-lab.html`:

- Flecha roja: dirección de la línea.
- Flecha azul: dirección transversal de crucetas.
- Esferas rojas: extremo superior del aislador.
- Esferas amarillas: punto de conexión del conductor.
