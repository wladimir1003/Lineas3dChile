# VALIDACIÓN V2.7

## Código
- Todos los JavaScript pasan `node --check`.
- Todos los IDs usados por `ar-scene.js` existen en `ar.html`.

## GPS
- `enableHighAccuracy: true`.
- `maximumAge: 0`.
- RAW separado de posición aceptada.
- Lectura >20 m: rechazada.
- Primeras lecturas: período de estabilización.
- Salto kilométrico sin mejora clara de precisión: rechazado.

## Modelos
- GLB/GLTF: GLTFLoader.
- OBJ: OBJLoader.
- IFC: web-ifc 0.0.77 + WASM.
- Georreferencia: WGS84 / UTM 18S / UTM 19S / local.
- IFC: lectura de IFCPROJECTEDCRS e IFCMAPCONVERSION.

## Conversión
- UTM 18S y UTM 19S simuladas con coordenadas de prueba dentro de rangos válidos para Chile.
