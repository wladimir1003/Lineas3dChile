# Validación V1.3

## Geometría del laboratorio

- Dirección de línea: (1, 0, 0)
- Dirección de crucetas después del giro: (0, 0, -1)
- Producto punto: 0 (perpendicular)
- Torre 3 fases + 1 cable de guardia: separación transversal nativa 6.44 m; 4 anclajes
- Torre 6 fases A sin cable de guardia: separación transversal nativa 5.72 m; 6 anclajes
- Torre 6 fases B sin cable de guardia: separación transversal nativa 4.82 m; 6 anclajes

## Código

- JavaScript validado con `node --check`.
- JSON y GeoJSON válidos.
- Referencias locales verificadas.
- ZIP verificado con `unzip -t`.

## Errores corregidos

- Los anclajes ahora usan la misma transformación mundial del grupo de torre.
- La normalización horizontal y de base se aplica también a los anclajes.
- La selección se guarda en IndexedDB; sessionStorage es solo respaldo.
- AR valida que la selección sea LineString/MultiLineString y muestra errores visibles.