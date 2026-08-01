import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';

const el = id => document.getElementById(id);
const host = el('canvasHost');
const status = el('status');
const Y_AXIS = new THREE.Vector3(0, 1, 0);
let catalog, rules, scene, camera, renderer, controls, content, loadedTemplate, currentMeta;

function log(message) { status.textContent = message; }

async function init() {
  [catalog, rules] = await Promise.all([
    fetch('./config/model-catalog.json').then(r => r.json()),
    fetch('./config/electrical-rules.json').then(r => r.json())
  ]);

  for (const model of catalog.models) {
    const option = document.createElement('option');
    option.value = model.id;
    option.textContent = model.label;
    el('modelSelect').appendChild(option);
  }

  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x9fc4d3);
  camera = new THREE.PerspectiveCamera(45, 1, 0.1, 10000);
  renderer = new THREE.WebGLRenderer({antialias: true});
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  host.appendChild(renderer.domElement);
  controls = new OrbitControls(camera, renderer.domElement);

  scene.add(new THREE.HemisphereLight(0xffffff, 0x334455, 2.2));
  const sun = new THREE.DirectionalLight(0xffffff, 2.5);
  sun.position.set(80, 120, 70);
  scene.add(sun);

  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(4000, 4000),
    new THREE.MeshStandardMaterial({color: 0x567b51})
  );
  ground.rotation.x = -Math.PI / 2;
  scene.add(ground);
  scene.add(new THREE.GridHelper(2000, 200));

  content = new THREE.Group();
  scene.add(content);
  resize();
  addEventListener('resize', resize);
  renderer.setAnimationLoop(() => {
    controls.update();
    renderer.render(scene, camera);
  });

  el('modelSelect').onchange = loadSelected;
  el('autoSelectBtn').onclick = autoSelect;
  el('singleBtn').onclick = single;
  el('spanBtn').onclick = span;
  el('resetBtn').onclick = frame;

  await loadSelected();
  await span();
}

function resize() {
  const width = host.clientWidth;
  const height = host.clientHeight;
  renderer.setSize(width, height, false);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
}

function meta() {
  return catalog.models.find(model => model.id === el('modelSelect').value);
}

function autoSelect() {
  const circuits = Number(el('circuitsSelect').value);
  const voltage = Number(el('voltageSelect').value);
  const height = Number(el('osmHeightInput').value) || null;
  let best;

  for (const model of catalog.models.filter(item => item.kind === 'tower')) {
    let score = Math.abs((model.circuits || 1) - circuits) * 100;
    if (voltage < model.selection.voltageMin || voltage > model.selection.voltageMax) score += 50;
    if (height) score += Math.abs(model.nativeHeightM - height);
    if (!best || score < best.score) best = {model, score};
  }

  if (best) {
    el('modelSelect').value = best.model.id;
    loadSelected().then(() => {
      el('heightInput').value = height || rules.voltageHeightEstimate[String(voltage)] || best.model.defaultTargetHeightM;
    });
  }
}

async function loadSelected() {
  currentMeta = meta();
  el('heightInput').value = currentMeta.defaultTargetHeightM;
  el('yawInput').value = 0;
  loadedTemplate = await new Promise((resolve, reject) => {
    new GLTFLoader().load(currentMeta.file, gltf => resolve(gltf.scene), undefined, reject);
  });
  loadedTemplate.traverse(object => {
    if (object.isMesh) {
      object.castShadow = true;
      object.receiveShadow = true;
    }
  });
  log(`Modelo: ${currentMeta.label}\nAltura nativa: ${currentMeta.nativeHeightM.toFixed(2)} m\nEje nativo de crucetas: X\nEn el laboratorio la línea usa X y la torre gira 90°, por lo que las crucetas quedan en Z.`);
}

function clear() {
  while (content.children.length) content.remove(content.children[0]);
}

function createTower(position, lineHeadingRad = Math.PI / 2) {
  const group = new THREE.Group();
  const model = loadedTemplate.clone(true);
  const factor = Number(el('heightInput').value) / currentMeta.nativeHeightM;
  model.scale.setScalar(factor);
  model.updateMatrixWorld(true);

  // Normalización dentro del grupo: base Y=0 y centro horizontal X/Z=0.
  const rawBox = new THREE.Box3().setFromObject(model);
  const rawCenter = rawBox.getCenter(new THREE.Vector3());
  const normalization = new THREE.Vector3(-rawCenter.x, -rawBox.min.y, -rawCenter.z);
  model.position.copy(normalization);
  group.add(model);

  // El eje local Z de la torre representa la dirección de la línea.
  // Para el laboratorio la línea va por X, por eso el yaw base es +90°.
  const correction = THREE.MathUtils.degToRad(Number(el('yawInput').value) || 0);
  group.rotation.y = lineHeadingRad + correction;
  group.position.copy(position);
  content.add(group);
  group.updateMatrixWorld(true);

  return {group, model, factor, normalization};
}

function createInsulator(spec) {
  const group = new THREE.Group();
  const material = new THREE.MeshStandardMaterial({color: 0x9ed6c5, roughness: 0.25});
  for (let index = 0; index < spec.discs; index++) {
    const disc = new THREE.Mesh(
      new THREE.CylinderGeometry(spec.discRadiusM, spec.discRadiusM, spec.lengthM / spec.discs * 0.42, 14),
      material
    );
    disc.position.y = -index * spec.lengthM / spec.discs;
    group.add(disc);
  }
  return group;
}

function marker(position, color) {
  if (!el('anchorCheck').checked) return;
  const mesh = new THREE.Mesh(
    new THREE.SphereGeometry(0.24, 12, 8),
    new THREE.MeshBasicMaterial({color})
  );
  mesh.position.copy(position);
  content.add(mesh);
}

function worldAttachments(tower) {
  const spec = rules.insulators[String(el('voltageSelect').value)] || rules.insulators['220000'];
  const useInsulator = el('insulatorCheck').checked;
  const attachments = [];

  for (const attachment of currentMeta.attachmentProfile.attachmentsNative) {
    // Coordenada calibrada en el espacio visual nativo del modelo.
    // Se aplica exactamente la misma escala, normalización, rotación y traslación de la torre.
    const local = new THREE.Vector3(
      attachment.x * tower.factor + tower.normalization.x,
      attachment.y * tower.factor + tower.normalization.y,
      attachment.z * tower.factor + tower.normalization.z
    );
    const top = tower.group.localToWorld(local.clone());
    marker(top, 0xff3030);

    if (attachment.shield) {
      attachments.push({id: attachment.id, point: top.clone(), shield: true});
      continue;
    }

    if (useInsulator) {
      const insulator = createInsulator(spec);
      insulator.position.copy(top);
      content.add(insulator);
    }

    const bottom = top.clone();
    bottom.y -= useInsulator ? spec.lengthM : 0;
    marker(bottom, 0xffe000);
    attachments.push({id: attachment.id, point: bottom, shield: false});
  }
  return attachments;
}

function cable(start, end, sag, radius, shield) {
  const points = [];
  for (let index = 0; index <= 96; index++) {
    const t = index / 96;
    points.push(
      new THREE.Vector3().lerpVectors(start, end, t)
        .add(new THREE.Vector3(0, -4 * sag * t * (1 - t), 0))
    );
  }
  const geometry = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), 96, radius, 6, false);
  content.add(new THREE.Mesh(
    geometry,
    new THREE.MeshStandardMaterial({color: shield ? 0xaab3ba : 0x30363a, metalness: 0.75, roughness: 0.3})
  ));
}

function addDirectionHelpers(spanLength) {
  const lineMaterial = new THREE.LineBasicMaterial({color: 0xff2020});
  const lineGeometry = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(-spanLength / 2, 0.25, 0),
    new THREE.Vector3(spanLength / 2, 0.25, 0)
  ]);
  content.add(new THREE.Line(lineGeometry, lineMaterial));

  // Flecha roja = dirección longitudinal de la línea (X).
  content.add(new THREE.ArrowHelper(new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 1, 0), Math.min(30, spanLength / 3), 0xff2020, 3, 2));
  // Flecha azul = dirección transversal de las crucetas (Z).
  content.add(new THREE.ArrowHelper(new THREE.Vector3(0, 0, 1), new THREE.Vector3(0, 1, 0), 20, 0x004cff, 3, 2));
}

async function single() {
  if (!loadedTemplate) await loadSelected();
  clear();
  const tower = createTower(new THREE.Vector3(), Math.PI / 2);
  const attachments = worldAttachments(tower);
  addDirectionHelpers(40);
  frame();
  log(`Vista individual\nRojo: dirección de línea X\nAzul: crucetas transversales Z\nPuntos rojos: unión a cruceta\nPuntos amarillos: conexión del conductor\nAnclajes: ${attachments.length}`);
}

async function span() {
  if (!loadedTemplate) await loadSelected();
  clear();
  if (currentMeta.kind !== 'tower') return single();

  const spanLength = Number(el('spanInput').value);
  const requestedSag = Number(el('sagInput').value);
  const positionA = new THREE.Vector3(-spanLength / 2, 0, 0);
  const positionB = new THREE.Vector3(spanLength / 2, 0, 0);
  const towerA = createTower(positionA, Math.PI / 2);
  const towerB = createTower(positionB, Math.PI / 2);
  const attachmentsA = worldAttachments(towerA);
  const attachmentsB = worldAttachments(towerB);
  const lowest = Math.min(...attachmentsA.map(item => item.point.y));
  const safeSag = Math.min(requestedSag, Math.max(0.5, lowest - 1));

  if (el('wireCheck').checked) {
    for (const attachmentA of attachmentsA) {
      const attachmentB = attachmentsB.find(item => item.id === attachmentA.id);
      if (!attachmentB) continue;
      cable(
        attachmentA.point,
        attachmentB.point,
        attachmentA.shield ? safeSag * 0.7 : safeSag,
        attachmentA.shield ? rules.conductorDefaults.shieldRadiusM : rules.conductorDefaults.radiusM,
        attachmentA.shield
      );
    }
  }

  addDirectionHelpers(spanLength);
  frame();
  log(`Vano V1.3\nLínea longitudinal: eje X (flecha roja)\nCrucetas: eje Z (flecha azul), exactamente perpendicular\nAnclajes y GLB usan una sola matriz mundial\nCables conectados a extremos calibrados, no al centro\nVano ${spanLength} m · Flecha ${safeSag.toFixed(1)} m`);
}

function frame() {
  const box = new THREE.Box3().setFromObject(content);
  if (box.isEmpty()) return;
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  const maximum = Math.max(size.x, size.y, size.z);
  controls.target.copy(center);
  camera.position.set(center.x + maximum * 0.55, center.y + maximum * 0.42, center.z + maximum * 0.72);
  camera.near = 0.1;
  camera.far = maximum * 30;
  camera.updateProjectionMatrix();
  controls.update();
}

init().catch(error => {
  console.error(error);
  log('ERROR: ' + error.message);
});
