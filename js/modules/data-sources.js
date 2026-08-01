const BASE='https://ide-energia.minenergia.cl/server/rest/services/IDE_Energia/Visor_IDE_Energ%C3%ADa/MapServer';
async function arc(layer,name,progress){let offset=0,features=[];const size=1000;while(true){progress?.(name,features.length);const q=new URLSearchParams({where:'1=1',outFields:'*',returnGeometry:'true',outSR:'4326',f:'geojson',resultOffset:String(offset),resultRecordCount:String(size)});const r=await fetch(`${BASE}/${layer}/query?${q}`);if(!r.ok)throw new Error(`${name}: HTTP ${r.status}`);const g=await r.json();if(!Array.isArray(g.features))throw new Error(`${name}: respuesta GeoJSON inválida`);features.push(...g.features);if(g.features.length<size)break;offset+=size;if(offset>100000)throw new Error(`${name}: demasiados registros`)}return{type:'FeatureCollection',features}}
function osmToGeo(j){const features=[];for(const e of j.elements||[]){const p={...(e.tags||{}),osm_id:e.id,osm_type:e.type};if(e.type==='node'&&Number.isFinite(e.lon)&&Number.isFinite(e.lat)){features.push({type:'Feature',properties:p,geometry:{type:'Point',coordinates:[e.lon,e.lat]}});continue}const coords=(e.geometry||[]).map(x=>[x.lon,x.lat]).filter(x=>x.every(Number.isFinite));if(coords.length>1){const closed=coords.length>3&&coords[0][0]===coords.at(-1)[0]&&coords[0][1]===coords.at(-1)[1];features.push({type:'Feature',properties:p,geometry:{type:closed?'Polygon':'LineString',coordinates:closed?[coords]:coords}})}else if(e.center){features.push({type:'Feature',properties:p,geometry:{type:'Point',coordinates:[e.center.lon,e.center.lat]}})}}return{type:'FeatureCollection',features}}
function query(lat,lon,radius){return `[out:json][timeout:60];(
node["power"="tower"](around:${radius},${lat},${lon});
node["power"="pole"](around:${radius},${lat},${lon});
way["power"="line"](around:${radius},${lat},${lon});
nwr["power"="substation"](around:${radius},${lat},${lon});
nwr["power"="generator"]["generator:source"="wind"](around:${radius},${lat},${lon});
nwr["power"="generator"]["generator:source"="solar"](around:${radius},${lat},${lon});
nwr["power"="plant"]["plant:source"="wind"](around:${radius},${lat},${lon});
nwr["power"="plant"]["plant:source"="solar"](around:${radius},${lat},${lon});
);out tags center geom;`}
async function overpass(endpoint,q){const body=new URLSearchParams({data:q});const r=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded;charset=UTF-8'},body});if(!r.ok){const t=await r.text().catch(()=> '');throw new Error(`Overpass HTTP ${r.status}${t?': '+t.slice(0,160).replace(/<[^>]+>/g,' '):''}`)}return r.json()}
export const DataSources={
 async downloadOfficial(progress){const [officialWind,officialSolar,officialSubstations,officialLines]=await Promise.all([arc(3,'Eólicas',progress),arc(4,'Solares',progress),arc(8,'Subestaciones',progress),arc(10,'Líneas',progress)]);return{officialWind,officialSolar,officialSubstations,officialLines}},
 async downloadOSM(lat,lon,radius){const q=query(lat,lon,radius),endpoints=['https://overpass-api.de/api/interpreter','https://overpass.kumi.systems/api/interpreter','https://overpass.nchc.org.tw/api/interpreter'];let last;for(const ep of endpoints){try{return osmToGeo(await overpass(ep,q))}catch(e){last=e;console.warn(ep,e)}}throw last||new Error('No fue posible consultar Overpass')}
};
