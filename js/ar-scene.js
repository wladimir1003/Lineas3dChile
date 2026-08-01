import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {ARButton} from 'three/addons/webxr/ARButton.js';
import {DB} from './modules/db.js';

const host = document.getElementById('host');
const modelSelect = document.getElementById('model');
const scaleMode = document.getElementById('scaleMode');
const selectionBox = document.getElementById('selection');
const previewButton = document.getElementById('preview');
const enterARButton = document.getElementById('enterAR');

let selected = null;
let catalog = null;
let rules = null;
let scene, camera, renderer, controls, content, loader, nativeARButton;
let currentBuild = null;

function show(message, bad = false) {
  selectionBox.innerHTML = `<div style="color:${bad ? '#ffb7b7' : '#fff'}">${message}</div>`;
}

async function readSelection() {
  try {
    const stored = await DB.get('selectedFeature');
    if (stored?.data) return stored.data;
  } catch (error) {
    console.warn('IndexedDB selection read failed', error);
  }
  try {
    return JSON.parse(sessionStorage.getItem('lecaSelected') || 'null');
  } catch {
    return null;
  }
}

function properties() { return selected?.feature?.properties || {}; }
function isLineGeometry() {
  const type = selected?.feature?.geometry?.type;
  return type === 'LineString' || type === 'MultiLineString';
}

function lineCoordinateParts() {
  const geometry = selected?.feature?.geometry;
  if (!geometry) return [];
  if (geometry.type === 'LineString') return [geometry.coordinates];
  if (geometry.type === 'MultiLineString') return geometry.coordinates;
  return [];
}

function projectPart(coords, origin) {
  const radius = 6371000;
  const cosine = Math.cos(origin.lat * Math.PI / 180);
  return coords.map(coord => new THREE.Vector3(
    (coord[0] - origin.lon) * Math.PI / 180 * radius * cosine,
    0,
    -(coord[1] - origin.lat) * Math.PI / 180 * radius
  ));
}

function projectGeometry() {
  const parts = lineCoordinateParts().filter(part => part.length >= 2);
  const all = parts.flat();
  if (!all.length) return [];
  const origin = {
    lon: all.reduce((sum, c) => sum + c[0], 0) / all.length,
    lat: all.reduce((sum, c) => sum + c[1], 0) / all.length
  };
  return parts.map(part => projectPart(part, origin));
}

function cumulative(points) {
  const distances = [0];
  for (let i = 1; i < points.length; i++) distances.push(distances.at(-1) + points[i].distanceTo(points[i - 1]));
  return distances;
}

function atDistance(points, distance, distances) {
  if (distance <= 0) return points[0].clone();
  if (distance >= distances.at(-1)) return points.at(-1).clone();
  let index = 1;
  while (distances[index] < distance) index++;
  return points[index - 1].clone().lerp(
    points[index],
    (distance - distances[index - 1]) / (distances[index] - distances[index - 1])
  );
}

function tangentAt(points, distance, distances) {
  const epsilon = Math.max(1, distances.at(-1) / 10000);
  return atDistance(points, Math.min(distances.at(-1), distance + epsilon), distances)
    .sub(atDistance(points, Math.max(0, distance - epsilon), distances))
    .normalize();
}

function recommendedModel() {
  const props = properties();
  const voltage = Number(props.TENSION_KV || String(props.voltage || '').split(';')[0] || 220000);
  const circuitsText = String(props.CIRCUITO ?? props.circuits ?? '1');
  const circuitsMatch = circuitsText.match(/\d+/);
  const circuits = circuitsMatch ? Number(circuitsMatch[0]) : 1;
  let best = null;
  for (const model of catalog.models.filter(item => item.kind === 'tower')) {
    let score = Math.abs((model.circuits || 1) - circuits) * 100;
    if (voltage < model.selection.voltageMin || voltage > model.selection.voltageMax) score += 50;
    if (!best || score < best.score) best = {model, score};
  }
  return best?.model?.id || catalog.models.find(item => item.kind === 'tower')?.id;
}

function createInsulator(spec, fitScale) {
  const group = new THREE.Group();
  const material = new THREE.MeshStandardMaterial({color: 0x9ed6c5});
  for (let index = 0; index < spec.discs; index++) {
    const disc = new THREE.Mesh(
      new THREE.CylinderGeometry(spec.discRadiusM * fitScale, spec.discRadiusM * fitScale, spec.lengthM / spec.discs * 0.42 * fitScale, 10),
      material
    );
    disc.position.y = -index * spec.lengthM / spec.discs * fitScale;
    group.add(disc);
  }
  return group;
}

function createCable(start, end, sag, radius, shield) {
  const points = [];
  for (let i = 0; i <= 48; i++) {
    const t = i / 48;
    points.push(new THREE.Vector3().lerpVectors(start, end, t).add(new THREE.Vector3(0, -4 * sag * t * (1 - t), 0)));
  }
  const geometry = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), 48, radius, 5, false);
  return new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({color: shield ? 0xaab3ba : 0x333333, metalness: 0.7}));
}

async function loadModel(meta) {
  return new Promise((resolve, reject) => loader.load(meta.file, gltf => resolve(gltf.scene), undefined, reject));
}

function normalizeTower(baseModel, meta, modelScale, position, tangent) {
  const group = new THREE.Group();
  const model = baseModel.clone(true);
  model.scale.setScalar(modelScale);
  model.updateMatrixWorld(true);
  const rawBox = new THREE.Box3().setFromObject(model);
  const rawCenter = rawBox.getCenter(new THREE.Vector3());
  const normalization = new THREE.Vector3(-rawCenter.x, -rawBox.min.y, -rawCenter.z);
  model.position.copy(normalization);
  group.add(model);

  // Local Z = dirección de la línea. Local X = cruceta, automáticamente perpendicular.
  group.rotation.y = Math.atan2(tangent.x, tangent.z);
  group.position.copy(position);
  content.add(group);
  group.updateMatrixWorld(true);
  return {group, factor: modelScale, normalization};
}

function towerAttachments(tower, meta, spec, fitScale) {
  const attachments = [];
  for (const attachment of meta.attachmentProfile.attachmentsNative) {
    const local = new THREE.Vector3(
      attachment.x * tower.factor + tower.normalization.x,
      attachment.y * tower.factor + tower.normalization.y,
      attachment.z * tower.factor + tower.normalization.z
    );
    const top = tower.group.localToWorld(local.clone());
    if (attachment.shield) {
      attachments.push({id: attachment.id, point: top, shield: true});
      continue;
    }
    const insulator = createInsulator(spec, fitScale);
    insulator.position.copy(top);
    content.add(insulator);
    const bottom = top.clone();
    bottom.y -= spec.lengthM * fitScale;
    attachments.push({id: attachment.id, point: bottom, shield: false});
  }
  return attachments;
}

async function build() {
  previewButton.disabled = true;
  enterARButton.disabled = true;
  try {
    if (!selected) throw new Error('No existe una selección guardada. Vuelva al mapa y toque una línea.');
    if (!isLineGeometry()) throw new Error('El elemento seleccionado no es una línea LineString/MultiLineString.');

    scene.remove(content);
    content = new THREE.Group();
    scene.add(content);

    const meta = catalog.models.find(model => model.id === modelSelect.value);
    if (!meta || meta.kind !== 'tower') throw new Error('Seleccione un modelo de torre válido.');
    const base = await loadModel(meta);
    const projectedParts = projectGeometry();
    if (!projectedParts.length) throw new Error('La línea seleccionada no contiene coordenadas suficientes.');

    const totalRealLength = projectedParts.reduce((sum, part) => sum + cumulative(part).at(-1), 0);
    const fitScale = scaleMode.value === 'fit' ? 40 / Math.max(totalRealLength, 1) : 1;
    const modelScale = (meta.defaultTargetHeightM / meta.nativeHeightM) * fitScale;
    const props = properties();
    const voltage = Number(props.TENSION_KV || String(props.voltage || '').split(';')[0] || 220000);
    const spec = rules.insulators[String(voltage)] || rules.insulators['220000'];
    let towerCount = 0;
    let spanCount = 0;

    for (const realPart of projectedParts) {
      const part = realPart.map(point => point.clone().multiplyScalar(fitScale));
      const distances = cumulative(part);
      const length = distances.at(-1);
      if (length <= 0) continue;
      const targetSpacingReal = 250;
      const count = Math.min(80, Math.max(2, Math.ceil((length / fitScale) / targetSpacingReal) + 1));
      const samples = Array.from({length: count}, (_, i) => length * i / (count - 1));
      const towers = [];

      for (const distance of samples) {
        const position = atDistance(part, distance, distances);
        const tangent = tangentAt(part, distance, distances);
        const tower = normalizeTower(base, meta, modelScale, position, tangent);
        towers.push(towerAttachments(tower, meta, spec, fitScale));
        towerCount++;
      }

      for (let index = 0; index < towers.length - 1; index++) {
        for (const attachment of towers[index]) {
          const next = towers[index + 1].find(item => item.id === attachment.id);
          if (!next) continue;
          const span = attachment.point.distanceTo(next.point);
          const sag = Math.min(span * 0.06, 12 * fitScale);
          const radius = (attachment.shield ? rules.conductorDefaults.shieldRadiusM : rules.conductorDefaults.radiusM) * Math.max(fitScale, 0.08);
          content.add(createCable(attachment.point, next.point, sag, radius, attachment.shield));
        }
        spanCount++;
      }
    }

    const box = new THREE.Box3().setFromObject(content);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    const maxDimension = Math.max(size.x, size.y, size.z);
    controls.target.copy(center);
    camera.position.set(center.x + maxDimension * 0.65, center.y + maxDimension * 0.45, center.z + maxDimension * 0.75);
    camera.near = 0.01;
    camera.far = Math.max(1000, maxDimension * 30);
    camera.updateProjectionMatrix();
    controls.update();

    currentBuild = {towerCount, spanCount, totalRealLength, fitScale};
    show(`<b>${selected.type}</b><br>${props.NOMBRE || props.name || 'Línea sin nombre'}<br><b>Línea completa construida:</b> ${(totalRealLength / 1000).toFixed(2)} km · ${towerCount} torres · ${spanCount} vanos<br><b>Orientación:</b> eje local Z sigue la línea y las crucetas locales X quedan perpendiculares.`);
    enterARButton.disabled = false;
  } catch (error) {
    console.error(error);
    show(`<b>Error:</b> ${error.message}<br>Vuelva al mapa, seleccione una línea y abra nuevamente 3D/AR.`, true);
  } finally {
    previewButton.disabled = false;
  }
}

async function init() {
  selected = await readSelection();
  [catalog, rules] = await Promise.all([
    fetch('./config/model-catalog.json').then(r => r.json()),
    fetch('./config/electrical-rules.json').then(r => r.json())
  ]);

  for (const model of catalog.models.filter(item => item.kind === 'tower')) {
    const option = document.createElement('option');
    option.value = model.id;
    option.textContent = model.label;
    modelSelect.appendChild(option);
  }
  modelSelect.value = recommendedModel();

  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x9fc4d3);
  camera = new THREE.PerspectiveCamera(45, 1, 0.01, 10000);
  renderer = new THREE.WebGLRenderer({antialias: true, alpha: true});
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.xr.enabled = true;
  host.appendChild(renderer.domElement);
  controls = new OrbitControls(camera, renderer.domElement);
  scene.add(new THREE.HemisphereLight(0xffffff, 0x334455, 2.5));
  const light = new THREE.DirectionalLight(0xffffff, 2);
  light.position.set(20, 30, 15);
  scene.add(light);
  content = new THREE.Group();
  scene.add(content);
  loader = new GLTFLoader();

  const resize = () => {
    renderer.setSize(host.clientWidth, host.clientHeight, false);
    camera.aspect = host.clientWidth / host.clientHeight;
    camera.updateProjectionMatrix();
  };
  addEventListener('resize', resize);
  resize();

  nativeARButton = ARButton.createButton(renderer, {
    requiredFeatures: ['hit-test'],
    optionalFeatures: ['dom-overlay'],
    domOverlay: {root: document.body}
  });
  nativeARButton.style.display = 'none';
  document.body.appendChild(nativeARButton);

  previewButton.onclick = build;
  modelSelect.onchange = build;
  scaleMode.onchange = build;
  enterARButton.onclick = () => {
    if (!currentBuild) {
      alert('Primero construya la línea completa en 3D.');
      return;
    }
    if (!navigator.xr) {
      alert('Este navegador no ofrece WebXR AR. La línea completa sí está disponible en el visor 3D. En iPad se requiere una implementación ARKit/RealityKit o una versión USDZ para objetos individuales.');
      return;
    }
    if (scaleMode.value === 'real' && !confirm('La línea a escala real puede ser demasiado extensa para el espacio AR. ¿Continuar?')) return;
    nativeARButton.click();
  };

  renderer.setAnimationLoop(() => {
    controls.update();
    renderer.render(scene, camera);
  });

  if (!selected) {
    show('<b>No hay línea seleccionada.</b><br>Vuelva al mapa, toque una línea eléctrica y luego presione 3D/AR línea seleccionada.', true);
    previewButton.disabled = true;
    enterARButton.disabled = true;
    return;
  }
  await build();
}

init().catch(error => {
  console.error(error);
  show(`<b>Error de inicialización:</b> ${error.message}`, true);
});
