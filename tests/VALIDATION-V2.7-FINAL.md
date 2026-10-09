# VALIDACIÓN FINAL V2.7

## Resultado
PASS para revisión estática y simulaciones de lógica.

## Pruebas ejecutadas
1. Sintaxis de todos los JavaScript con Node.
2. Correspondencia de IDs entre `ar-scene.js` y `ar.html`.
3. Simulación GPS:
   - lectura con ±1200 m rechazada;
   - primera lectura no se acepta inmediatamente;
   - lectura estable de ±3 m aceptada;
   - salto de 3,5 km sin mejora clara de precisión rechazado.
4. Conversión UTM:
   - huso 18S;
   - huso 19S.
5. Importación:
   - reconocimiento GLB;
   - reconocimiento GLTF;
   - reconocimiento OBJ;
   - reconocimiento IFC.
6. IFC:
   - detección sintética de `IFCPROJECTEDCRS('EPSG:32719',...)`;
   - detección de `IFCMAPCONVERSION(...)`.
7. Revisión de rutas y archivos del proyecto.

## Prueba de navegador
Se intentó ejecutar Chromium headless sobre un servidor HTTP local. El binario del
entorno de construcción abortó por dependencias de sesión/DBus antes de cargar la
aplicación. Por esa razón esta prueba NO se contabiliza como aprobada ni se afirma
que haya sido ejecutada con éxito.

## Limitación GPS
Una PWA no puede ordenar a Android usar exclusivamente el receptor GNSS. V2.7
muestra la coordenada RAW que entrega Android/Chrome y evita mezclarla silenciosamente
con la posición que usa el visor.

## IFC
La geometría IFC se procesa en el navegador mediante `web-ifc 0.0.77`. El WASM se
obtiene actualmente desde jsDelivr, por lo que la primera carga IFC requiere Internet.
