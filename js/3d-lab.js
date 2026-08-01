import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
const el=id=>document.getElementById(id),host=el('canvasHost'),status=el('status');
let catalog,rules,scene,camera,renderer,controls,content,loadedTemplate,currentMeta;
function log(s){status.textContent=s}
async function init(){
 catalog=await fetch('./config/model-catalog.json').then(r=>r.json());rules=await fetch('./config/electrical-rules.json').then(r=>r.json());
 for(const m of catalog.models){const o=document.createElement('option');o.value=m.id;o.textContent=m.label;el('modelSelect').appendChild(o)}
 scene=new THREE.Scene();scene.background=new THREE.Color(0x9fc4d3);camera=new THREE.PerspectiveCamera(45,1,.1,10000);
 renderer=new THREE.WebGLRenderer({antialias:true});renderer.setPixelRatio(Math.min(devicePixelRatio,2));host.appendChild(renderer.domElement);
 controls=new OrbitControls(camera,renderer.domElement);scene.add(new THREE.HemisphereLight(0xffffff,0x334455,2.2));const sun=new THREE.DirectionalLight(0xffffff,2.5);sun.position.set(80,120,70);scene.add(sun);
 const ground=new THREE.Mesh(new THREE.PlaneGeometry(4000,4000),new THREE.MeshStandardMaterial({color:0x567b51}));ground.rotation.x=-Math.PI/2;scene.add(ground);scene.add(new THREE.GridHelper(2000,200));
 content=new THREE.Group();scene.add(content);resize();addEventListener('resize',resize);renderer.setAnimationLoop(()=>{controls.update();renderer.render(scene,camera)});
 el('modelSelect').onchange=loadSelected;el('autoSelectBtn').onclick=autoSelect;el('singleBtn').onclick=single;el('spanBtn').onclick=span;el('resetBtn').onclick=frame;await loadSelected();await span();
}
function resize(){const w=host.clientWidth,h=host.clientHeight;renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix()}
function meta(){return catalog.models.find(x=>x.id===el('modelSelect').value)}
function autoSelect(){const c=+el('circuitsSelect').value,v=+el('voltageSelect').value,h=+el('osmHeightInput').value||null;let best;for(const m of catalog.models.filter(x=>x.kind==='tower')){let s=Math.abs((m.circuits||1)-c)*100;if(v<m.selection.voltageMin||v>m.selection.voltageMax)s+=50;if(h)s+=Math.abs(m.nativeHeightM-h);if(!best||s<best.s)best={m,s}}if(best){el('modelSelect').value=best.m.id;loadSelected().then(()=>{el('heightInput').value=h||rules.voltageHeightEstimate[String(v)]||best.m.defaultTargetHeightM})}}
async function loadSelected(){currentMeta=meta();el('heightInput').value=currentMeta.defaultTargetHeightM;el('yawInput').value=currentMeta.attachmentProfile?.modelYawDeg||0;loadedTemplate=await new Promise((res,rej)=>new GLTFLoader().load(currentMeta.file,g=>res(g.scene),undefined,rej));loadedTemplate.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true}});log(`Modelo: ${currentMeta.label}
Altura nativa: ${currentMeta.nativeHeightM.toFixed(2)} m
Anclajes calibrados: ${currentMeta.attachmentProfile?.attachmentsNative?.length||0}`)}
function clear(){while(content.children.length)content.remove(content.children[0])}
function prepared(){const obj=loadedTemplate.clone(true),factor=(+el('heightInput').value)/currentMeta.nativeHeightM;obj.scale.setScalar(factor);obj.rotation.y=THREE.MathUtils.degToRad(+el('yawInput').value||0);obj.updateMatrixWorld(true);let b=new THREE.Box3().setFromObject(obj),c=b.getCenter(new THREE.Vector3());obj.position.x-=c.x;obj.position.z-=c.z;obj.position.y-=b.min.y;obj.updateMatrixWorld(true);b=new THREE.Box3().setFromObject(obj);return{obj,factor,height:b.max.y-b.min.y}}
function insulator(spec){const g=new THREE.Group(),mat=new THREE.MeshStandardMaterial({color:0x9ed6c5,roughness:.25});for(let i=0;i<spec.discs;i++){const d=new THREE.Mesh(new THREE.CylinderGeometry(spec.discRadiusM,spec.discRadiusM,spec.lengthM/spec.discs*.42,14),mat);d.position.y=-i*spec.lengthM/spec.discs;g.add(d)}return g}
function marker(v,color){if(!el('anchorCheck').checked)return;const m=new THREE.Mesh(new THREE.SphereGeometry(.24,12,8),new THREE.MeshBasicMaterial({color}));m.position.copy(v);content.add(m)}
function addTower(position){const p=prepared();p.obj.position.add(position);content.add(p.obj);return p}
function worldAttachments(position,p){const spec=rules.insulators[String(el('voltageSelect').value)]||rules.insulators['220000'];const use=el('insulatorCheck').checked;const yaw=THREE.MathUtils.degToRad(+el('yawInput').value||0),rot=new THREE.Matrix4().makeRotationY(yaw);const list=[];for(const a of currentMeta.attachmentProfile.attachmentsNative){const local=new THREE.Vector3(a.x*p.factor,a.y*p.factor,a.z*p.factor).applyMatrix4(rot);const top=local.add(position.clone());marker(top,0xff3030);if(a.shield){list.push({id:a.id,point:top.clone(),shield:true});continue}if(use){const ins=insulator(spec);ins.position.copy(top);content.add(ins)}const bottom=top.clone();bottom.y-=use?spec.lengthM:0;marker(bottom,0xffe000);list.push({id:a.id,point:bottom,shield:false})}return list}
function cable(a,b,sag,radius,shield){const pts=[];for(let i=0;i<=96;i++){const t=i/96;pts.push(new THREE.Vector3().lerpVectors(a,b,t).add(new THREE.Vector3(0,-4*sag*t*(1-t),0)))}const geo=new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts),96,radius,6,false);content.add(new THREE.Mesh(geo,new THREE.MeshStandardMaterial({color:shield?0xaab3ba:0x30363a,metalness:.75,roughness:.3})))}
async function single(){if(!loadedTemplate)await loadSelected();clear();const p=addTower(new THREE.Vector3());const a=worldAttachments(new THREE.Vector3(),p);frame();log(`Vista individual
Rojo: extremo real de cruceta
Amarillo: extremo inferior de aislador
Anclajes: ${a.length}`)}
async function span(){if(!loadedTemplate)await loadSelected();clear();if(currentMeta.kind!=='tower')return single();const vano=+el('spanInput').value,requested=+el('sagInput').value;const A=new THREE.Vector3(0,0,-vano/2),B=new THREE.Vector3(0,0,vano/2);const pa=addTower(A),pb=addTower(B),aa=worldAttachments(A,pa),bb=worldAttachments(B,pb);const low=Math.min(...aa.map(x=>x.point.y)),safe=Math.min(requested,Math.max(.5,low-1));if(el('wireCheck').checked){for(const a of aa){const b=bb.find(x=>x.id===a.id);if(b)cable(a.point,b.point,a.shield?safe*.7:safe,a.shield?rules.conductorDefaults.shieldRadiusM:rules.conductorDefaults.radiusM,a.shield)}}frame();log(`Vano corregido
Torres centradas en su GLB
Línea: eje Z
Crucetas: eje X
Cables conectados por ID a extremos reales
Vano ${vano} m · Flecha ${safe.toFixed(1)} m`)}
function frame(){const b=new THREE.Box3().setFromObject(content);if(b.isEmpty())return;const s=b.getSize(new THREE.Vector3()),c=b.getCenter(new THREE.Vector3()),m=Math.max(s.x,s.y,s.z);controls.target.copy(c);camera.position.set(c.x+m*.6,c.y+m*.4,c.z+m*.7);camera.near=.1;camera.far=m*30;camera.updateProjectionMatrix()}
init().catch(e=>{console.error(e);log('ERROR: '+e.message)});
