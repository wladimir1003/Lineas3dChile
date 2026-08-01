# Informe de validación

Resultado: **PASS**

Archivos locales: 27

Botones principales: gpsBtn, officialBtn, osmBtn, measureBtn, clearMeasureBtn, radarBtn, viewer3dBtn, arBtn, layersBtn, installBtn, diagnosticBtn, clearDbBtn

## Simulación de vano (250 m, flecha solicitada 12 m, 220 kV)

| Modelo | Altura | Punto inferior | Flecha aplicada | Despeje mínimo | Conductores | CG |
|---|---:|---:|---:|---:|---:|---:|
| Torre 3 fases + 1 cable de guardia | 42.4 m | 15.0 m | 12.0 m | 3.0 m | 3 | 1 |
| Torre 6 fases A sin cable de guardia | 32.0 m | 10.6 m | 9.6 m | 1.0 m | 6 | 0 |
| Torre 6 fases B sin cable de guardia | 26.7 m | 8.4 m | 7.4 m | 1.0 m | 6 | 0 |

## Validaciones realizadas

- Sintaxis JavaScript.
- JSON/GeoJSON.
- Rutas locales.
- Integridad y geometría de los cuatro GLB.
- Escalado uniforme y base Y=0.
- Protección contra catenaria bajo terreno.
- Presencia de controles GPS, OSM, datos oficiales, radar, medición, 3D, AR, instalación y diagnóstico.

## Pendiente de validar en GitHub Pages

- Acceso real a IDE Energía y Overpass desde el navegador.
- Permisos GPS y brújula en cada iPad/Android.
- AR Android y conversión USDZ para iPad.