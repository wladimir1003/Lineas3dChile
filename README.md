# Líneas Eléctricas Chile 3D/AR V1.4

Creado por **Wladimir Campos** · www.JFSasesorias.org

## Correcciones V1.4

- Las centrales eólicas y aerogeneradores seleccionados pueden abrirse en el visor 3D/AR.
- En modo ajustado a 20 m los cables escalan proporcionalmente y ya no conservan un grosor mínimo sobredimensionado.
- El laboratorio incorpora una escala visual independiente para reducir las cadenas de aisladores; valor inicial 60%.
- La barra inferior usa una cuadrícula responsiva adaptada al ancho disponible.
- Icono completamente nuevo, color turquesa/azul con símbolo de energía.
- El botón se llama **3D/AR seleccionado** y admite líneas y elementos eólicos.

## Prueba recomendada

1. Borrar la versión anterior y subir todos los archivos V1.4.
2. Limpiar caché y datos del sitio.
3. Seleccionar una central eólica y pulsar **3D/AR seleccionado**.
4. Seleccionar una línea y comparar **Ajustar a escena de 20 m** con **Escala real**.
5. En Laboratorio 3D ajustar **Escala visual aislador** entre 45% y 70%.


## Cambios V1.5

- Al tocar una línea se guarda la coordenada exacta seleccionada.
- El visor 3D abre por defecto un sector centrado en ese punto.
- Longitud configurable: 500 m, 1 km, 2 km o 5 km.
- Opción para cambiar a línea completa.
- Botones Zoom +, Zoom − y Encuadrar.
- La cámara se ajusta automáticamente al sector o línea mostrada.


## Cambios V1.6
- Aisladores con herraje superior unido exactamente al punto de cruceta.
- Longitud adaptativa limitada por la separación vertical entre crucetas.
- Valor inicial reducido al 45%.
- Cable de guardia de la torre 3 fases anclado en la cumbre real medida del GLB.
- Punto del cable de guardia marcado en color celeste en el laboratorio.


## Cambios V1.7

- El visor 3D/AR usa la misma lógica de anclaje que el laboratorio.
- Torres rectas: cadenas de suspensión verticales.
- Torres iniciales y finales: cadenas de amarre horizontales orientadas hacia el vano.
- Torres con cambio de dirección >= 12°: dos cadenas horizontales por fase, una hacia cada vano.
- Cada vano conecta `salida` de una torre con `entrada` de la siguiente.
- Las cadenas nacen exactamente en el punto calibrado de la cruceta mediante `matrixWorld`.


## Cambios V1.8

- Nueva torre `torre 6fases con CG.glb`.
- Dimensiones detectadas: 28,90 m de altura y 4,79 m de ancho/profundidad.
- Seis anclajes de fase en tres niveles.
- Cable de guardia conectado a la cumbre medida del GLB.
- Visor 3D/AR con suelo, grilla y ejes como el Laboratorio 3D.
- Cámaras Isométrica, Lateral y Superior.
- Zoom +, Zoom − y Encuadrar.
- Opción de alto contraste para conductores, sin aumentar excesivamente su diámetro.


## Cambios V1.9

- La grilla y el suelo se centran sobre el modelo o sector de línea actualmente visible.
- Conductores resaltados en rojo intenso.
- Cable de guardia resaltado en celeste intenso.
- Torre predeterminada: 6 fases con 1 cable de guardia.
- Botones, selectores y textos ligeramente más grandes en Android y modo PWA instalado.


## Cambios V2.1

- Encabezado y textos centrados; el botón Volver al menú ya no tapa el contenido.
- AR con hit-test de superficies.
- Retícula celeste para indicar dónde se colocará la escena.
- Toque en pantalla para colocar torres, línea o aerogenerador.
- Botón `Poner a 5 m frente a mí`.
- Botón `Recentrar`.
- Contador de distancia al objetivo.
- Indicador de dirección: frente, izquierda, derecha o detrás.
- Botón para salir de AR.
- WebXR/ARCore gestiona automáticamente acelerómetro, giroscopio y seguimiento de cámara.


## Cambios V2.2

- La escena AR se coloca automáticamente delante del usuario.
- Distancia calculada según el tamaño real de la escena.
- Torre o línea apoyada por su base sobre el suelo.
- Centrado horizontal por caja envolvente.
- Distancia recomendada entre 12 y 60 m.
- Marcador celeste/amarillo en el punto objetivo.
- El usuario puede tocar la retícula para mover la escena.
- Estar físicamente bajo una torre real no la alinea automáticamente: esta versión usa AR de colocación manual, no AR geoespacial.


## Cambios V2.3

- Ubicación GPS del móvil/tablet visible en la pestaña 3D/AR.
- Latitud, longitud, precisión, distancia y rumbo hacia la selección.
- Marcador azul del dispositivo en el mapa de referencia.
- Botón para centrar el mapa en el dispositivo.
- Laboratorio AR con visibilidad independiente de torres, conductores, aisladores y cable de guardia.
- Puntos de anclaje, cajas envolventes, ejes XYZ y marcador objetivo.
- Diagnóstico WebXR, ARCore, hit-test, seguimiento, orientación y escala.
- Seguimiento de orientación del dispositivo.


## Auditoría y correcciones V2.5
- Se revisaron todos los HTML, CSS, JavaScript, JSON, GeoJSON, GLB y service worker.
- Se eliminó por completo el bloque duplicado del visor 3D/AR.
- `modelSelect` apunta al `<select>` real.
- Se corrigió la función de centro GPS/selección.
- Diagnóstico y visibilidad se crean después de la geometría.
- `ar-scene.js` se incluye en la caché offline.
- Service worker con una sola activación y limpieza de versiones antiguas.
- Laboratorio 3D declara y usa correctamente su selector de modelos.
