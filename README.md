# Líneas Eléctricas Chile 3D/AR — V1.0

Proyecto nuevo, exclusivo para Chile.

**Creado por Wladimir Campos — www.JFSasesorias.org**

## Incluye

- Capas oficiales IDE Energía: líneas, subestaciones, eólicas y solares.
- Consulta OSM por zona: torres, líneas, subestaciones, aerogeneradores y plantas solares/eólicas.
- GPS, radar y huincha GPS → punto tocado.
- IndexedDB para almacenar capas grandes.
- Laboratorio 3D con los cuatro GLB aportados.
- Escalado por altura objetivo y alineación automática de la base al suelo.
- Aisladores procedurales.
- Simulación de dos torres, fases, cable de guardia y catenarias.
- AR de colocación mediante GLB en Android.
- Diagnóstico integrado.

## Limitaciones honestas

- Los puntos de anclaje e aisladores son representativos hasta calibrarlos con planos.
- OSM puede no contener altura, circuitos o torres en todas las zonas.
- Para AR Quick Look en iPad se requieren modelos USDZ adicionales.
- La primera apertura necesita Internet para Leaflet, Turf, Three.js y model-viewer. Luego el Service Worker intenta almacenarlos cuando son usados.

## Subir a GitHub Pages

1. Cree un repositorio nuevo, por ejemplo `lineas-electricas-chile-3d-ar`.
2. Descomprima el ZIP.
3. Entre a la carpeta `lineas-electricas-chile-3d-ar-v1`.
4. Suba **el contenido interno completo** al nivel raíz del repositorio; `index.html` debe quedar en la raíz.
5. En GitHub vaya a **Settings → Pages**.
6. Seleccione **Deploy from a branch**, rama `main`, carpeta `/root`.
7. Abra la URL HTTPS entregada por GitHub.
8. Abra primero `diagnostico.html`.
9. Después pruebe `Laboratorio 3D`, `Datos Chile`, `OSM zona` y GPS.

## Modelos medidos

- Torre 3 fases + 1 CG: 42,37 m.
- Torre 6 fases A: 32,02 m.
- Torre 6 fases B: 26,67 m.
- Aerogenerador: 28,43 m.


## Correcciones V1.1
- Vano sobre eje Z y crucetas sobre eje X.
- Niveles de crucetas calibrados desde los GLB.
- Puntos superiores e inferiores de aisladores visibles.
- Consulta Overpass corregida con claves que contienen `:` entre comillas y servidores alternativos.
- AR requiere seleccionar primero un elemento del mapa; para una línea crea un vano 3D representativo en WebXR.
