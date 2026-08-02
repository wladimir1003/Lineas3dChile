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
