import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {ARButton} from 'three/addons/webxr/ARButton.js';
import {DB} from './modules/db.js';

const host = document.getElementById('host');
const modelSelect = document.getElementById('model');
const scaleMode = document.getElementById('scaleMode');
const viewMode = document.getElementById('viewMode');
const sectorLength = document.getElementById('sectorLength');
const sectorLabel = document.getElementById('sectorLabel');
const zoomInButton = document.getElementById('zoomIn');
const zoomOutButton = document.getElementById('zoomOut');
const fitViewButton = document.getElementById('fitView');
const viewIsoButton = document.getElementById('viewIso');
const viewSideButton = document.getElementById('viewSide');
const viewTopButton = document.getElementById('viewTop');
const gridToggle = document.getElementById('gridToggle');
const wireContrast = document.getElementById('wireContrast');
const selectionBox = document.getElementById('selection');
const previewButton = document.getElementById('preview');
const enterARButton = document.getElementById('enterAR');

let selected = null;
let catalog = null;
let rules = null;
let scene, camera, renderer, controls, content, loader, nativeARButton, gridHelper, groundPlane, axesHelper;
let currentBuild = null;
let lastViewBox = null;

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
function isWindSelection() {
  const props = properties();
  const type = String(selected?.type || '').toLowerCase();
  return type.includes('eólica') || type.includes('eolico') || type.includes('eólico') ||
    props['generator:source'] === 'wind' || props['plant:source'] === 'wind' || props.source === 'wind';
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


function selectedPointProjected(origin) {
  const point = selected?.selectionPoint;
  if (!point || !Number.isFinite(point.lat) || !Number.isFinite(point.lng)) return null;
  const radius = 6371000;
  const cosine = Math.cos(origin.lat * Math.PI / 180);
  return new THREE.Vector3(
    (point.lng - origin.lon) * Math.PI / 180 * radius * cosine,
    0,
    -(point.lat - origin.lat) * Math.PI / 180 * radius
  );
}

function projectGeometryWithOrigin() {
  const parts = lineCoordinateParts().filter(part => part.length >= 2);
  const all = parts.flat();
  if (!all.length) return {parts: [], origin: null, selectedPoint: null};
  const origin = {
    lon: all.reduce((sum, c) => sum + c[0], 0) / all.length,
    lat: all.reduce((sum, c) => sum + c[1], 0) / all.length
  };
  return {
    parts: parts.map(part => projectPart(part, origin)),
    origin,
    selectedPoint: selectedPointProjected(origin)
  };
}

function nearestLocationOnParts(parts, point) {
  if (!point) return null;
  let best = null;
  parts.forEach((part, partIndex) => {
    const distances = cumulative(part);
    for (let i = 1; i < part.length; i++) {
      const a = part[i - 1];
      const b = part[i];
      const ab = b.clone().sub(a);
      const len2 = ab.lengthSq();
      const t = len2 > 0 ? THREE.MathUtils.clamp(point.clone().sub(a).dot(ab) / len2, 0, 1) : 0;
      const projected = a.clone().addScaledVector(ab, t);
      const d = projected.distanceTo(point);
      const along = distances[i - 1] + a.distanceTo(projected);
      if (!best || d < best.distance) best = {partIndex, distance: d, along};
    }
  });
  return best;
}

function slicePolyline(points, startDistance, endDistance) {
  const distances = cumulative(points);
  const total = distances.at(-1);
  const start = Math.max(0, startDistance);
  const end = Math.min(total, endDistance);
  if (end <= start) return [];
  const out = [atDistance(points, start, distances)];
  for (let i = 1; i < points.length - 1; i++) {
    if (distances[i] > start && distances[i] < end) out.push(points[i].clone());
  }
  out.push(atDistance(points, end, distances));
  return out;
}

function sectorParts(parts) {
  if (viewMode?.value !== 'sector') return parts;
  const desired = Number(sectorLength?.value || 1000);
  const projectedSelection = projectGeometryWithOrigin();
  const reference = projectedSelection.selectedPoint;
  const nearest = nearestLocationOnParts(parts, reference);
  if (!nearest) {
    const first = parts[0];
    const distances = cumulative(first);
    const mid = distances.at(-1) / 2;
    return [slicePolyline(first, mid - desired / 2, mid + desired / 2)].filter(p => p.length >= 2);
  }
  const part = parts[nearest.partIndex];
  return [slicePolyline(part, nearest.along - desired / 2, nearest.along + desired / 2)].filter(p => p.length >= 2);
}

function frameContent(multiplier = 1) {
  if (!content) return;
  const box = new THREE.Box3().setFromObject(content);
  if (box.isEmpty()) return;
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  const maxDimension = Math.max(size.x, size.y, size.z, 1);
  lastViewBox = {box, size, center, maxDimension};
  controls.target.copy(center);
  camera.position.set(
    center.x + maxDimension * 0.65 * multiplier,
    center.y + maxDimension * 0.45 * multiplier,
    center.z + maxDimension * 0.75 * multiplier
  );
  camera.near = Math.max(0.001, maxDimension / 100000);
  camera.far = Math.max(1000, maxDimension * 40);
  camera.updateProjectionMatrix();
  controls.update();
  updateLaboratoryStage();
}

function zoomCamera(factor) {
  const target = controls.target.clone();
  const offset = camera.position.clone().sub(target);
  offset.multiplyScalar(factor);
  const minimum = Math.max(0.25, camera.near * 5);
  if (offset.length() < minimum) offset.setLength(minimum);
  camera.position.copy(target.add(offset));
  controls.update();
}


function updateLaboratoryStage() {
  if (!lastViewBox) return;
  const dimension = Math.max(lastViewBox.maxDimension, 1);
  const gridSize = Math.max(20, Math.ceil(dimension * 1.6 / 10) * 10);
  const divisions = Math.max(10, Math.min(120, Math.round(gridSize / Math.max(gridSize / 40, 1))));

  if (gridHelper) scene.remove(gridHelper);
  gridHelper = new THREE.GridHelper(gridSize, divisions, 0x315a72, 0x6f8996);
  gridHelper.position.set(lastViewBox.center.x, 0.002, lastViewBox.center.z);
  gridHelper.visible = gridToggle?.checked ?? true;
  scene.add(gridHelper);

  if (groundPlane) scene.remove(groundPlane);
  groundPlane = new THREE.Mesh(
    new THREE.PlaneGeometry(gridSize, gridSize),
    new THREE.MeshStandardMaterial({
      color: 0x587653,
      roughness: 0.95,
      metalness: 0,
      transparent: true,
      opacity: 0.78,
      side: THREE.DoubleSide
    })
  );
  groundPlane.rotation.x = -Math.PI / 2;
  groundPlane.position.set(lastViewBox.center.x, -0.01, lastViewBox.center.z);
  groundPlane.visible = gridToggle?.checked ?? true;
  scene.add(groundPlane);

  if (axesHelper) scene.remove(axesHelper);
  axesHelper = new THREE.AxesHelper(Math.max(2, dimension * 0.18));
  axesHelper.position.set(lastViewBox.center.x, 0.03, lastViewBox.center.z);
  axesHelper.visible = gridToggle?.checked ?? true;
  scene.add(axesHelper);
}

function setCameraPreset(mode) {
  if (!lastViewBox) return frameContent();
  const {center, maxDimension, size} = lastViewBox;
  const distance = Math.max(maxDimension * 1.25, 3);
  controls.target.copy(center);

  if (mode === 'top') {
    camera.position.set(center.x, center.y + distance * 1.35, center.z + 0.001);
    camera.up.set(0, 0, -1);
  } else if (mode === 'side') {
    // La geometría puede cambiar de dirección: se usa el lado largo de la caja.
    if (size.x >= size.z) {
      camera.position.set(center.x, center.y + distance * 0.18, center.z + distance * 0.78);
    } else {
      camera.position.set(center.x + distance * 0.78, center.y + distance * 0.18, center.z);
    }
    camera.up.set(0, 1, 0);
  } else {
    camera.position.set(
      center.x + distance * 0.72,
      center.y + distance * 0.48,
      center.z + distance * 0.82
    );
    camera.up.set(0, 1, 0);
  }

  camera.near = Math.max(0.001, maxDimension / 100000);
  camera.far = Math.max(1000, maxDimension * 50);
  camera.updateProjectionMatrix();
  controls.update();
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

function createInsulator(spec, effectiveLength, radiusScale) {
  const group = new THREE.Group();
  const ceramic = new THREE.MeshStandardMaterial({color: 0x9ed6c5, roughness: 0.28});
  const metal = new THREE.MeshStandardMaterial({color: 0x737d83, metalness: 0.85, roughness: 0.25});
  const discCount = Math.max(3, Math.min(spec.discs, Math.round(spec.discs * effectiveLength / Math.max(spec.lengthM * radiusScale, 0.0001))));
  const connectorTop = Math.min(0.12 * radiusScale, effectiveLength * 0.12);
  const connectorBottom = Math.min(0.10 * radiusScale, effectiveLength * 0.10);
  const discZone = Math.max(0.001, effectiveLength - connectorTop - connectorBottom);
  const step = discZone / discCount;
  const topRod = new THREE.Mesh(new THREE.CylinderGeometry(0.035 * radiusScale, 0.035 * radiusScale, connectorTop, 8), metal);
  topRod.position.y = -connectorTop / 2; group.add(topRod);
  const topBall = new THREE.Mesh(new THREE.SphereGeometry(0.065 * radiusScale, 8, 6), metal);
  topBall.position.y = 0; group.add(topBall);
  for (let index = 0; index < discCount; index++) {
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(spec.discRadiusM * radiusScale, spec.discRadiusM * radiusScale, Math.min(step * 0.38, 0.055 * radiusScale), 10), ceramic);
    disc.position.y = -connectorTop - (index + 0.5) * step;
    group.add(disc);
  }
  const bottomRod = new THREE.Mesh(new THREE.CylinderGeometry(0.03 * radiusScale, 0.03 * radiusScale, connectorBottom, 8), metal);
  bottomRod.position.y = -effectiveLength + connectorBottom / 2; group.add(bottomRod);
  const bottomBall = new THREE.Mesh(new THREE.SphereGeometry(0.055 * radiusScale, 8, 6), metal);
  bottomBall.position.y = -effectiveLength; group.add(bottomBall);
  return group;
}

function adaptiveInsulatorLengthAR(top, allTops, requestedLength, towerHeightWorld) {
  const gaps = allTops.filter(item => !item.shield && item.top.y < top.y - 0.0001)
    .map(item => top.y - item.top.y).sort((a,b)=>a-b);
  const gapLimit = gaps.length ? gaps[0] * 0.42 : Infinity;
  return Math.max(0.006, Math.min(requestedLength, gapLimit, towerHeightWorld * 0.04));
}


function addInsulatorAt(top, direction, spec, effectiveLength, radiusScale, role = 'suspension') {
  const insulator = createInsulator(spec, effectiveLength, radiusScale);
  insulator.position.copy(top);
  const downAxis = new THREE.Vector3(0, -1, 0);
  const targetDirection = direction.clone().normalize();
  insulator.quaternion.setFromUnitVectors(downAxis, targetDirection);
  content.add(insulator);

  const endPoint = top.clone().addScaledVector(targetDirection, effectiveLength);
  return {point: endPoint, role, insulatorLength: effectiveLength};
}

function towerSupportType(prevPosition, position, nextPosition, thresholdDeg = 12) {
  if (!prevPosition && nextPosition) return {type: 'start', deflectionDeg: 0};
  if (prevPosition && !nextPosition) return {type: 'end', deflectionDeg: 0};
  if (!prevPosition || !nextPosition) return {type: 'isolated', deflectionDeg: 0};

  const incomingForward = position.clone().sub(prevPosition).setY(0).normalize();
  const outgoingForward = nextPosition.clone().sub(position).setY(0).normalize();
  const dot = THREE.MathUtils.clamp(incomingForward.dot(outgoingForward), -1, 1);
  const deflectionDeg = THREE.MathUtils.radToDeg(Math.acos(dot));
  return {type: deflectionDeg >= thresholdDeg ? 'angle' : 'suspension', deflectionDeg};
}

function lineDirections(prevPosition, position, nextPosition) {
  const towardPrevious = prevPosition
    ? prevPosition.clone().sub(position).setY(0).normalize()
    : null;
  const towardNext = nextPosition
    ? nextPosition.clone().sub(position).setY(0).normalize()
    : null;
  return {towardPrevious, towardNext};
}

function createCable(start, end, sag, radius, shield) {
  const points = [];
  for (let i = 0; i <= 48; i++) {
    const t = i / 48;
    points.push(new THREE.Vector3().lerpVectors(start, end, t).add(new THREE.Vector3(0, -4 * sag * t * (1 - t), 0)));
  }
  const geometry = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), 48, radius, 6, false);
  const highlighted = wireContrast?.checked;
  const color = shield
    ? (highlighted ? 0x00e5ff : 0xaab3ba)
    : (highlighted ? 0xff2d2d : 0x333333);
  const material = new THREE.MeshStandardMaterial({
    color,
    metalness: 0.72,
    roughness: 0.28,
    emissive: highlighted ? (shield ? 0x003b46 : 0x4a0000) : 0x000000,
    emissiveIntensity: highlighted ? 0.75 : 0
  });
  return new THREE.Mesh(geometry, material);
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

function towerAttachments(tower, meta, spec, fitScale, prevPosition, position, nextPosition) {
  const tops = meta.attachmentProfile.attachmentsNative.map(attachment => {
    const local = new THREE.Vector3(
      attachment.x * tower.factor + tower.normalization.x,
      attachment.y * tower.factor + tower.normalization.y,
      attachment.z * tower.factor + tower.normalization.z
    );
    return {attachment, shield: !!attachment.shield, top: tower.group.localToWorld(local.clone())};
  });

  const towerHeightWorld = meta.defaultTargetHeightM * fitScale;
  const support = towerSupportType(prevPosition, position, nextPosition);
  const directions = lineDirections(prevPosition, position, nextPosition);
  const attachments = [];

  for (const item of tops) {
    const {attachment, top} = item;
    if (attachment.shield) {
      attachments.push({
        id: attachment.id,
        shield: true,
        incoming: top.clone(),
        outgoing: top.clone(),
        supportType: support.type
      });
      continue;
    }

    const requestedLength = spec.lengthM * fitScale * 0.45;
    const verticalLength = adaptiveInsulatorLengthAR(top, tops, requestedLength, towerHeightWorld);
    const horizontalLength = Math.max(0.006, Math.min(requestedLength, towerHeightWorld * 0.055));
    const radiusScale = Math.max(fitScale * 0.45, 0.02);

    if (support.type === 'suspension' || support.type === 'isolated') {
      const result = addInsulatorAt(
        top,
        new THREE.Vector3(0, -1, 0),
        spec,
        verticalLength,
        radiusScale,
        'suspension'
      );
      attachments.push({
        id: attachment.id,
        shield: false,
        incoming: result.point.clone(),
        outgoing: result.point.clone(),
        supportType: support.type,
        deflectionDeg: support.deflectionDeg
      });
      continue;
    }

    if (support.type === 'start') {
      const result = addInsulatorAt(top, directions.towardNext, spec, horizontalLength, radiusScale, 'terminal-start');
      attachments.push({
        id: attachment.id,
        shield: false,
        incoming: result.point.clone(),
        outgoing: result.point.clone(),
        supportType: support.type
      });
      continue;
    }

    if (support.type === 'end') {
      const result = addInsulatorAt(top, directions.towardPrevious, spec, horizontalLength, radiusScale, 'terminal-end');
      attachments.push({
        id: attachment.id,
        shield: false,
        incoming: result.point.clone(),
        outgoing: result.point.clone(),
        supportType: support.type
      });
      continue;
    }

    // Torre de ángulo: dos cadenas de amarre, una hacia cada vano.
    const incomingResult = addInsulatorAt(
      top,
      directions.towardPrevious,
      spec,
      horizontalLength,
      radiusScale,
      'angle-incoming'
    );
    const outgoingResult = addInsulatorAt(
      top,
      directions.towardNext,
      spec,
      horizontalLength,
      radiusScale,
      'angle-outgoing'
    );
    attachments.push({
      id: attachment.id,
      shield: false,
      incoming: incomingResult.point.clone(),
      outgoing: outgoingResult.point.clone(),
      supportType: support.type,
      deflectionDeg: support.deflectionDeg
    });
  }

  return {attachments, support};
}

async function buildLine() {
  previewButton.disabled = true;
  enterARButton.disabled = true;
  try {
    if (!selected) throw new Error('No existe una selección guardada. Vuelva al mapa y toque un elemento.');
    if (!isLineGeometry()) throw new Error('El elemento seleccionado no es una línea LineString/MultiLineString.');

    scene.remove(content);
    content = new THREE.Group();
    scene.add(content);

    const meta = catalog.models.find(model => model.id === modelSelect.value);
    if (!meta || meta.kind !== 'tower') throw new Error('Seleccione un modelo de torre válido.');
    const base = await loadModel(meta);
    const projected = projectGeometryWithOrigin();
    if (!projected.parts.length) throw new Error('La línea seleccionada no contiene coordenadas suficientes.');

    const fullRealLength = projected.parts.reduce((sum, part) => sum + cumulative(part).at(-1), 0);
    const projectedParts = sectorParts(projected.parts);
    if (!projectedParts.length) throw new Error('No se pudo extraer el sector seleccionado de la línea.');
    const displayedRealLength = projectedParts.reduce((sum, part) => sum + cumulative(part).at(-1), 0);
    const fitScale = scaleMode.value === 'fit' ? 20 / Math.max(displayedRealLength, 1) : 1;
    const modelScale = (meta.defaultTargetHeightM / meta.nativeHeightM) * fitScale;
    const props = properties();
    const voltage = Number(props.TENSION_KV || String(props.voltage || '').split(';')[0] || 220000);
    const spec = rules.insulators[String(voltage)] || rules.insulators['220000'];
    let towerCount = 0;
    let spanCount = 0;
    currentBuild = {supportSummary: {suspension: 0, angle: 0, terminal: 0}};

    for (const realPart of projectedParts) {
      const part = realPart.map(point => point.clone().multiplyScalar(fitScale));
      const distances = cumulative(part);
      const length = distances.at(-1);
      if (length <= 0) continue;
      const targetSpacingReal = 250;
      const count = Math.min(80, Math.max(2, Math.ceil((length / fitScale) / targetSpacingReal) + 1));
      const samples = Array.from({length: count}, (_, i) => length * i / (count - 1));
      const towerPositions = samples.map(distance => atDistance(part, distance, distances));
      const towers = [];
      let suspensionCount = 0;
      let angleCount = 0;
      let terminalCount = 0;

      for (let towerIndex = 0; towerIndex < towerPositions.length; towerIndex++) {
        const position = towerPositions[towerIndex];
        const prevPosition = towerIndex > 0 ? towerPositions[towerIndex - 1] : null;
        const nextPosition = towerIndex < towerPositions.length - 1 ? towerPositions[towerIndex + 1] : null;

        let tangent;
        if (prevPosition && nextPosition) {
          const incomingForward = position.clone().sub(prevPosition).setY(0).normalize();
          const outgoingForward = nextPosition.clone().sub(position).setY(0).normalize();
          tangent = incomingForward.add(outgoingForward);
          if (tangent.lengthSq() < 1e-8) tangent.copy(outgoingForward);
          tangent.normalize();
        } else if (nextPosition) {
          tangent = nextPosition.clone().sub(position).setY(0).normalize();
        } else {
          tangent = position.clone().sub(prevPosition).setY(0).normalize();
        }

        const tower = normalizeTower(base, meta, modelScale, position, tangent);
        const assembled = towerAttachments(
          tower,
          meta,
          spec,
          fitScale,
          prevPosition,
          position,
          nextPosition
        );
        towers.push(assembled);
        if (assembled.support.type === 'angle') angleCount++;
        else if (assembled.support.type === 'start' || assembled.support.type === 'end') terminalCount++;
        else suspensionCount++;
        towerCount++;
      }

      for (let index = 0; index < towers.length - 1; index++) {
        for (const attachment of towers[index].attachments) {
          const next = towers[index + 1].attachments.find(item => item.id === attachment.id);
          if (!next) continue;
          const startPoint = attachment.outgoing;
          const endPoint = next.incoming;
          const span = startPoint.distanceTo(endPoint);
          const sag = Math.min(span * 0.06, 12 * fitScale);
          const radius = Math.max(0.00002, (attachment.shield ? rules.conductorDefaults.shieldRadiusM : rules.conductorDefaults.radiusM) * fitScale);
          content.add(createCable(startPoint, endPoint, sag, radius, attachment.shield));
        }
        spanCount++;
      }

      currentBuild = currentBuild || {};
      currentBuild.supportSummary = {
        suspension: (currentBuild.supportSummary?.suspension || 0) + suspensionCount,
        angle: (currentBuild.supportSummary?.angle || 0) + angleCount,
        terminal: (currentBuild.supportSummary?.terminal || 0) + terminalCount
      };
    }

    frameContent();

    currentBuild = {
      towerCount,
      spanCount,
      fullRealLength,
      displayedRealLength,
      fitScale,
      viewMode: viewMode.value,
      supportSummary: currentBuild?.supportSummary || {suspension: 0, angle: 0, terminal: 0}
    };
    const modeText = viewMode.value === 'sector'
      ? `Sector seleccionado de ${(displayedRealLength / 1000).toFixed(2)} km`
      : `Línea completa de ${(fullRealLength / 1000).toFixed(2)} km`;
    const selectionText = selected?.selectionPoint
      ? `<br><b>Centro:</b> punto tocado en el mapa`
      : `<br><b>Centro:</b> punto medio automático`;
    const support = currentBuild.supportSummary;
    show(`<b>${selected.type}</b><br>${props.NOMBRE || props.name || 'Línea sin nombre'}<br><b>${modeText}</b> · ${towerCount} torres · ${spanCount} vanos${selectionText}<br><b>Apoyos:</b> ${support.suspension} suspensión vertical · ${support.angle} ángulo con doble amarre · ${support.terminal} terminal con amarre horizontal<br><b>Vista:</b> use Zoom +, Zoom −, Encuadrar y el mouse/dedo para orbitar.`);
    enterARButton.disabled = false;
  } catch (error) {
    console.error(error);
    show(`<b>Error:</b> ${error.message}<br>Vuelva al mapa, seleccione una línea y abra nuevamente 3D/AR.`, true);
  } finally {
    previewButton.disabled = false;
  }
}


async function buildWind() {
  previewButton.disabled = true;
  enterARButton.disabled = true;
  try {
    scene.remove(content);
    content = new THREE.Group();
    scene.add(content);
    const meta = catalog.models.find(model => model.kind === 'wind');
    if (!meta) throw new Error('No existe modelo de aerogenerador en el catálogo.');
    modelSelect.value = meta.id;
    const model = await loadModel(meta);
    const box0 = new THREE.Box3().setFromObject(model);
    const nativeSize = box0.getSize(new THREE.Vector3());
    const targetHeight = scaleMode.value === 'fit' ? 12 : meta.defaultTargetHeightM;
    const factor = targetHeight / Math.max(nativeSize.y, 0.001);
    model.scale.setScalar(factor);
    model.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(model);
    const center = box.getCenter(new THREE.Vector3());
    model.position.set(-center.x, -box.min.y, -center.z);
    content.add(model);
    content.updateMatrixWorld(true);
    frameContent(1.35);
    const props=properties();
    currentBuild={kind:'wind',model:meta.id,targetHeight};
    show(`<b>${selected.type}</b><br>${props.NOMBRE||props.name||'Aerogenerador'}<br><b>Aerogenerador 3D construido</b><br>Altura visual: ${targetHeight.toFixed(1)} m · Modelo: ${meta.label}`);
    enterARButton.disabled=false;
  } catch(error) {
    console.error(error); show(`<b>Error:</b> ${error.message}`,true);
  } finally { previewButton.disabled=false; }
}

async function build() {
  if (isWindSelection()) return buildWind();
  return buildLine();
}


function applyDefaultTowerSelection() {
  const defaultId = catalog?.defaultTowerModelId || 'tower_6phase_shield';
  const optionExists = [...modelSelect.options].some(option => option.value === defaultId);
  if (optionExists) modelSelect.value = defaultId;
}

async function init() {
  selected = await readSelection();
  [catalog, rules] = await Promise.all([
    fetch('./config/model-catalog.json').then(r => r.json()),
    fetch('./config/electrical-rules.json').then(r => r.json())
  ]);

  const allowedModels = isWindSelection()
    ? catalog.models.filter(item => item.kind === 'wind')
    : catalog.models.filter(item => item.kind === 'tower');
  for (const model of allowedModels) {
    const option = document.createElement('option');
    option.value = model.id;
    option.textContent = model.label;
    modelSelect.appendChild(option);
  }
  modelSelect.value = isWindSelection()
    ? allowedModels[0]?.id
    : recommendedModel();

  scene = new THREE.Scene();
  scene.background = new THREE.Color(0xb8d3df);
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
  viewMode.onchange = () => {
    sectorLabel.style.display = viewMode.value === 'sector' ? 'flex' : 'none';
    applyDefaultTowerSelection();
  build();
  };
  sectorLength.onchange = build;
  zoomInButton.onclick = () => zoomCamera(0.75);
  zoomOutButton.onclick = () => zoomCamera(1.35);
  fitViewButton.onclick = () => frameContent();
  viewIsoButton.onclick = () => setCameraPreset('iso');
  viewSideButton.onclick = () => setCameraPreset('side');
  viewTopButton.onclick = () => setCameraPreset('top');
  gridToggle.onchange = () => {
    if (gridHelper) gridHelper.visible = gridToggle.checked;
    if (groundPlane) groundPlane.visible = gridToggle.checked;
    if (axesHelper) axesHelper.visible = gridToggle.checked;
  };
  wireContrast.onchange = build;
  sectorLabel.style.display = viewMode.value === 'sector' ? 'flex' : 'none';
  enterARButton.onclick = () => {
    if (!currentBuild) {
      alert('Primero construya la vista 3D del elemento seleccionado.');
      return;
    }
    if (!navigator.xr) {
      alert('Este navegador no ofrece WebXR AR. El contenido sigue disponible en el visor 3D. En iPad, los objetos individuales requieren USDZ/Quick Look o una implementación ARKit/RealityKit.');
      return;
    }
    if (isLineGeometry() && scaleMode.value === 'real' && viewMode.value === 'full' && !confirm('La línea completa a escala real puede ser demasiado extensa para el espacio AR. Se recomienda Sector seleccionado. ¿Continuar?')) return;
    nativeARButton.click();
  };

  renderer.setAnimationLoop(() => {
    controls.update();
    renderer.render(scene, camera);
  });

  if (!selected) {
    show('<b>No hay elemento seleccionado.</b><br>Vuelva al mapa, toque una línea eléctrica o un elemento eólico y luego presione 3D/AR seleccionado.', true);
    previewButton.disabled = true;
    enterARButton.disabled = true;
    return;
  }
  applyDefaultTowerSelection();
  await build();
}

init().catch(error => {
  console.error(error);
  show(`<b>Error de inicialización:</b> ${error.message}`, true);
});
