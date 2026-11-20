import * as THREE from 'three';
import {createSimulation,stepSimulation,defaultInput,FIXED_DT,TUNING} from './simulation.js';
import {PALETTE as C} from './worlds.js';
import {createAudio} from './audio.js';
const $=id=>document.getElementById(id),audio=createAudio();
let settings={volume:0.5,sensitivity:0.3};try{const saved=JSON.parse(localStorage.getItem('dao-den-long-settings'));if(saved){if(Number.isFinite(saved.volume))settings.volume=Math.max(0,Math.min(1,saved.volume));if(Number.isFinite(saved.sensitivity))settings.sensitivity=Math.max(.1,Math.min(1,saved.sensitivity));}}catch{}
audio.setVolume(settings.volume);
for(const key of ['volume','sensitivity']){$(key).value=settings[key];$(key).oninput=()=>{settings[key]=Number($(key).value);audio.setVolume(settings.volume);try{localStorage.setItem('dao-den-long-settings',JSON.stringify(settings));}catch{}};}
try{
const renderer=new THREE.WebGLRenderer({antialias:true});renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.setSize(innerWidth,innerHeight);renderer.domElement.setAttribute('aria-label','Game 3D Đảo Đèn Lồng');document.body.prepend(renderer.domElement);
const scene=new THREE.Scene();scene.background=new THREE.Color(C.sky);scene.fog=new THREE.Fog(C.fog,35,115);
const camera=new THREE.PerspectiveCamera(58,innerWidth/innerHeight,.1,300),ambient=new THREE.HemisphereLight(C.core,C.fog,.15);scene.add(ambient);
const moon=new THREE.DirectionalLight('#e4e8ff',1.1);moon.position.set(-30,60,25);scene.add(moon);
const mat=(color,extra={})=>new THREE.MeshStandardMaterial({color,roughness:.9,...extra});
const staticWorld=new THREE.Group(),dynamic=new THREE.Group();scene.add(staticWorld,dynamic);
const mesh=(geometry,material,p=[0,0,0],parent=staticWorld)=>{const m=new THREE.Mesh(geometry,material);m.position.set(...p);parent.add(m);return m;};
const grass=mat(C.grass),wood=mat(C.wood),sand=mat(C.sand);
let game=createSimulation(),mode='menu',yaw=0,cameraHeight=6,accumulator=0,previousTime,pulseTick=-999,lastCountdown=11,lastWind=false,frameCount=0,metricStart=0;
let wonScores=[],currentNight=1;const keys=new Set(),pending=new Set(),views=new Map();
function clearGroup(group){for(const child of [...group.children]){group.remove(child);child.traverse(o=>{if(o.geometry)o.geometry.dispose();if(o.material){const list=Array.isArray(o.material)?o.material:[o.material];for(const m of list)if(![grass,wood,sand].includes(m))m.dispose();}});}}
function buildWorld(){clearGroup(staticWorld);clearGroup(dynamic);views.clear();
 for(const [x,,z,r] of game.world.islands){mesh(new THREE.CylinderGeometry(r,r-2,5,72),grass,[x,-2.5,z]);const shore=mesh(new THREE.TorusGeometry(r-.3,.3,6,96),sand,[x,-.1,z]);shore.rotation.x=Math.PI/2;}
 if(game.night===2){mesh(new THREE.BoxGeometry(18,.2,4),wood,[35,-.1,0]);for(let x=26;x<=44;x+=.6)mesh(new THREE.BoxGeometry(.07,.04,4),sand,[x,.03,0]);}
 if(game.night===3){
  const shape=new THREE.Shape();shape.moveTo(24,0);shape.absarc(0,0,24,0,Math.PI,false);shape.lineTo(-12,0);shape.absarc(0,0,12,Math.PI,0,true);
  const tier=mesh(new THREE.ExtrudeGeometry(shape,{depth:3,bevelEnabled:false,curveSegments:48}),grass,[0,3,0]);tier.rotation.x=Math.PI/2;
  mesh(new THREE.CylinderGeometry(8,8,6,64),grass,[0,3,0]);mesh(new THREE.CylinderGeometry(2,2,8,24),wood,[0,10,0]);
  const bell=mesh(new THREE.SphereGeometry(1.3,16,12),mat(C.gold),[0,13,0]);bell.scale.y=1.2;
  for(const degrees of [30,150]){const a=degrees*Math.PI/180,points=[];for(const [r,h,side] of [[30,0,-1.5],[30,0,1.5],[24,3,-1.5],[24,3,1.5]])points.push(r*Math.cos(a)-side*Math.sin(a),h+.015,r*Math.sin(a)+side*Math.cos(a));const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(points,3));geometry.setIndex([0,2,1,1,2,3]);geometry.computeVertexNormals();mesh(geometry,mat(C.sand,{side:THREE.DoubleSide}));}
 }
 for(const pad of game.world.pads){const m=mesh(new THREE.CylinderGeometry(1,1,.12,24),mat(C.gold,{emissive:C.gold,emissiveIntensity:.35}),[pad.pos[0],pad.pos[1]+.06,pad.pos[2]]);m.name='Bục nhảy';}
 const sea=mesh(new THREE.PlaneGeometry(400,400),mat(C.sea),[35,-10.5,0]);sea.rotation.x=-Math.PI/2;
 for(const l of game.lanterns){const group=new THREE.Group();group.position.set(...l.pos);staticWorld.add(group);mesh(new THREE.CylinderGeometry(.12,.16,3.2,10),wood,[0,1.6,0],group);const paper=mesh(new THREE.SphereGeometry(.7,16,12),mat(C.off),[0,3.2,0],group);paper.scale.y=1.25;mesh(new THREE.CylinderGeometry(.3,.3,.12,12),wood,[0,4.1,0],group);mesh(new THREE.CylinderGeometry(.3,.3,.12,12),wood,[0,2.3,0],group);const light=new THREE.PointLight(C.lantern,0,15,2);light.position.y=3.2;group.add(light);const halo=mesh(new THREE.RingGeometry(5.92,6,64),new THREE.MeshBasicMaterial({color:C.gold,transparent:true,opacity:.2,side:THREE.DoubleSide}),[0,.02,0],group);halo.rotation.x=-Math.PI/2;views.set(l.id,{group,paper,light,halo});}
 const may=new THREE.Group();dynamic.add(may);mesh(new THREE.CylinderGeometry(.25,.38,.7,12),mat(C.shirt),[0,.85,0],may);mesh(new THREE.SphereGeometry(.25,16,12),mat('#edbd98'),[0,1.42,0],may);mesh(new THREE.ConeGeometry(.6,.3,32),sand,[0,1.71,0],may);mesh(new THREE.BoxGeometry(.45,.1,.12),mat(C.red),[0,1.21,-.2],may);for(const x of [-.14,.14])mesh(new THREE.CylinderGeometry(.08,.09,.5,8),mat(C.off),[x,.25,0],may);mesh(new THREE.BoxGeometry(.025,.35,.025),wood,[.46,1.35,0],may);mesh(new THREE.SphereGeometry(.14,10,8),mat(C.core,{emissive:C.lantern,emissiveIntensity:1}),[.46,1.1,0],may);const light=new THREE.PointLight(C.core,10,5,2);light.position.y=1.2;may.add(light);views.set('may',may);
 const pulse=mesh(new THREE.SphereGeometry(1,20,12),new THREE.MeshBasicMaterial({color:C.halo,wireframe:true,transparent:true,opacity:0}),[0,0,0],dynamic);views.set('pulse',pulse);
}
function show(title,message,detail,buttons,withSettings=false){$('overlay').hidden=false;$('dialog-title').textContent=title;$('dialog-message').textContent=message;$('dialog-detail').textContent=detail;$('settings').hidden=!withSettings;$('actions').replaceChildren();for(const [label,handler] of buttons){const b=document.createElement('button');b.textContent=label;b.onclick=handler;$('actions').append(b);}}
function menu(){mode='menu';audio.music(false);show('Đảo Đèn Lồng','Ba hòn đảo đang chờ Mây thắp sáng.','Hoàn thành lần lượt ba Đêm trước bình minh.',[['Bắt đầu',()=>{wonScores=[];intro(1);}],['Cài đặt',()=>settingsView(menu)]]);}
function intro(night){mode='intro';currentNight=night;game=createSimulation({night});buildWorld();show(`Đêm ${night} · ${game.world.name}`,['Ông Đăng: “Mây ơi, hãy gom ánh sáng và thắp lại những chiếc đèn.”','Ông Đăng: “Cầu tre hẹp lắm. Hãy tìm bục nhảy, và coi chừng Gió Lạc.”','Ông Đăng: “Theo dốc lên tầng cao. Tiếng chuông đang chờ bình minh.”'][night-1],`${game.lanterns.length} đèn · ${game.world.duration} giây · 3 Ngọn Lửa`,[['Vào Đêm',startNight],['Về menu',menu]]);}
function startNight(){game=createSimulation({night:currentNight});buildWorld();keys.clear();pending.clear();yaw=0;cameraHeight=6;accumulator=0;pulseTick=-999;lastCountdown=11;lastWind=false;frameCount=0;metricStart=0;mode='playing';$('overlay').hidden=true;audio.start();audio.music(true);}
function resume(){stepSimulation(game,{...defaultInput(),pause:false});const events=stepSimulation(game,{...defaultInput(),pause:true});handleEvents(events);keys.clear();pending.clear();mode='playing';accumulator=0;$('overlay').hidden=true;audio.music(true);}
function pauseMenu(){mode='paused';audio.music(false);show('Tạm dừng','Đêm đang chờ bạn.','', [['Tiếp tục',resume],['Chơi lại Đêm',startNight],['Cài đặt',()=>settingsView(pauseMenu)],['Về menu',menu]]);}
function settingsView(back){mode='settings';show('Cài đặt','Điều chỉnh âm lượng và độ nhạy chuột.','Cài đặt được lưu trên trình duyệt này.',[['Quay lại',back]],true);}
function result(){audio.music(false);mode='result';if(game.state==='won'){wonScores[currentNight-1]=game.score;audio.effect('won');if(currentNight===3)show('Bình Minh','Cả ba hòn đảo đã sáng trở lại!',`Tổng điểm: ${wonScores.reduce((a,b)=>a+b,0)}`, [['Về menu',menu]]);else show('Đêm đã sáng!','Mây đã thắp đủ các đèn.',`Điểm Đêm: ${game.score} · Tổng: ${wonScores.reduce((a,b)=>a+b,0)}`,[['Đêm kế tiếp',()=>intro(currentNight+1)],['Về menu',menu]]);}else{audio.effect('lost');show('Đêm nay chưa trọn vẹn',game.reason==='dawn'?'Bình minh đã tới.':'Mây đã mất hết Ngọn Lửa.',`Điểm Đêm chưa thắng không tính vào tổng: ${game.score}`,[['Chơi lại Đêm',startNight],['Về menu',menu]]);}}
function handleEvents(events){for(const event of events){audio.effect(event.name);if(event.name==='pulse')pulseTick=game.sim_tick;}}
function entities(){const active=new Set(['may','pulse',...game.lanterns.map(l=>l.id)]);
 for(const item of [...game.motes.map(m=>({...m,type:'mote'})),...game.shades.map(s=>({...s,type:'shade'})),...game.drifters.map(d=>({...d,type:'drifter'})),...game.charms.filter(c=>c.available).map(c=>({...c,type:'charm'}))]){
  const key=`${item.type}:${item.id}`;active.add(key);if(!views.has(key)){
   let m;if(item.type==='mote'){m=mesh(new THREE.SphereGeometry(.18,8,6),mat(C.mote,{emissive:C.mote,emissiveIntensity:1}),[0,0,0],dynamic);mesh(new THREE.SphereGeometry(.32,8,6),new THREE.MeshBasicMaterial({color:C.halo,transparent:true,opacity:.14,depthWrite:false}),[0,0,0],m);}
   if(item.type==='shade'){m=new THREE.Group();dynamic.add(m);const body=mesh(new THREE.SphereGeometry(.65,12,10),mat(C.shade,{emissive:C.rim,emissiveIntensity:.3}),[0,0,0],m);body.scale.y=1.2;for(const x of [-.2,.2])mesh(new THREE.SphereGeometry(.08,8,6),new THREE.MeshBasicMaterial({color:C.rim}),[x,.1,-.58],m);}
   if(item.type==='drifter'){m=mesh(new THREE.PlaneGeometry(2,.5,6,1),mat(C.drifter,{emissive:C.drifter,emissiveIntensity:.3,side:THREE.DoubleSide}),[0,0,0],dynamic);}
   if(item.type==='charm'){m=mesh(new THREE.BoxGeometry(.5,.75,.07),mat(C.red),[0,0,0],dynamic);const border=mesh(new THREE.BoxGeometry(.6,.85,.04),mat(C.gold),[0,0,.04],m);border.position.z=-.04;}
   views.set(key,m);
  }
  const m=views.get(key);m.position.set(...item.pos);if(item.type==='mote'||item.type==='charm')m.position.y+=.65+Math.sin(game.sim_tick/30)*.12;
  if(item.type==='shade'){m.children[0].material.color.set(item.state==='stunned'?C.stunned:C.shade);m.rotation.y=Math.atan2(game.player.pos[0]-item.pos[0],game.player.pos[2]-item.pos[2])+Math.PI;m.scale.setScalar(item.state==='spawning'?.5:1);}
  if(item.type==='drifter')m.rotation.y=game.sim_tick/20;
 }
 for(const [key,m] of views)if(!active.has(key)){dynamic.remove(m);m.traverse(o=>{o.geometry?.dispose();if(o.material)o.material.dispose();});views.delete(key);}
}
function render(){const p=game.player;entities();const may=views.get('may');may.position.set(...p.pos);may.rotation.y=Math.atan2(p.face[0],p.face[1]);may.visible=!p.respawn&&(p.invuln===0||Math.floor(game.sim_tick/5)%2===0);
 const count=game.lanterns.filter(l=>l.lit).length;ambient.intensity=.15+.55*count/game.lanterns.length;
 for(const l of game.lanterns){const v=views.get(l.id);v.paper.material.color.set(l.lit?C.lantern:C.off);v.paper.material.emissive.set(l.lit?C.core:'#000000');v.paper.material.emissiveIntensity=l.lit?1:0;v.light.intensity=l.lit?45:0;v.halo.visible=l.lit;}
 const pulse=views.get('pulse'),age=(game.sim_tick-pulseTick)/60;pulse.position.set(p.pos[0],p.pos[1]+.8,p.pos[2]);pulse.scale.setScalar(Math.max(.01,Math.min(5,age*15)));pulse.material.opacity=Math.max(0,.5-age);
 const angle=yaw*Math.PI/180;camera.position.set(p.pos[0]+Math.sin(angle)*9,p.pos[1]+cameraHeight,p.pos[2]+Math.cos(angle)*9);camera.lookAt(p.pos[0],p.pos[1]+1,p.pos[2]);
 $('flames').textContent=`Ngọn Lửa ${p.flames}/3`;$('night-label').textContent=`Đêm ${game.night} · ${game.world.name}`;const seconds=Math.ceil(game.time_left_s);$('time').textContent=`${String(Math.floor(seconds/60)).padStart(2,'0')}:${String(seconds%60).padStart(2,'0')}`;$('time').classList.toggle('danger',game.time_left_s<=30);$('lantern-count').textContent=`Đèn ${count}/${game.lanterns.length}`;$('score').textContent=`Điểm ${game.score}`;
 for(let i=0;i<10;i++)$('carry').children[i].classList.toggle('full',i<p.carried);$('carry').setAttribute('aria-label',`Đom đóm ${p.carried}/10`);
 $('cooldowns').textContent=`⇢ Lướt: ${p.charm>0?'sẵn sàng (bùa)':p.dashCd?`${(p.dashCd/60).toFixed(1)} s`:'sẵn sàng'} · ☀ Tỏa sáng: ${p.pulseCd?`${(p.pulseCd/60).toFixed(1)} s`:'sẵn sàng'}${p.charm?` · Bùa ${(p.charm/60).toFixed(1)} s`:''}`;
 const nearest=game.lanterns.filter(l=>!l.lit).map(l=>({l,d:Math.hypot(l.pos[0]-p.pos[0],l.pos[2]-p.pos[2])})).sort((a,b)=>a.d-b.d||(a.l.id<b.l.id?-1:1))[0];$('prompt').textContent=nearest?.d<=2?`E — Nạp ánh sáng (${nearest.l.deposited}/10)`:'Gom đom đóm để thắp lại những chiếc đèn.';
 if(nearest){const projected=new THREE.Vector3(...nearest.l.pos);projected.y+=2;camera.updateMatrixWorld();projected.project(camera);const off=Math.abs(projected.x)>1||Math.abs(projected.y)>1||projected.z>1;$('direction').hidden=!off;const relative=Math.atan2(nearest.l.pos[0]-p.pos[0],nearest.l.pos[2]-p.pos[2])-angle;const arrow=['↓','↘','→','↗','↑','↖','←','↙'][((Math.round(relative/(Math.PI/4))%8)+8)%8];$('direction').textContent=`${arrow} ${nearest.l.id} · ${nearest.d.toFixed(0)} m`;}else $('direction').hidden=true;
 $('wind').textContent=game.wind.warning?'🍃 Gió mạnh sắp tới!':game.wind.active?'🍃 Gió mạnh đang thổi':'';
 if(mode==='playing'){if(game.wind.warning&&!lastWind)audio.effect('wind');lastWind=game.wind.warning;if(seconds<=10&&seconds!==lastCountdown){audio.effect('countdown');lastCountdown=seconds;}}
 warningLeaves.visible=game.wind.warning;warningLeaves.position.set(p.pos[0],p.pos[1]+2,p.pos[2]);warningLeaves.children.forEach((leaf,i)=>{const a=game.sim_tick/12+i;leaf.position.set(Math.cos(a)*(2+i/5),Math.sin(a*2),Math.sin(a)*(2+i/5));leaf.rotation.y=a;});
 renderer.render(scene,camera);
}
for(let i=0;i<10;i++){const el=document.createElement('span');el.className='slot';$('carry').append(el);}
const handled=new Set(['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space','ShiftLeft','ShiftRight','KeyE','KeyF','Escape','KeyP']);
window.addEventListener('keydown',e=>{if(!handled.has(e.code))return;e.preventDefault();if(!keys.has(e.code))pending.add(e.code);keys.add(e.code);if(['Escape','KeyP'].includes(e.code)&&!e.repeat){if(mode==='playing'){handleEvents(stepSimulation(game,{...defaultInput(),pause:true}));pending.clear();pauseMenu();}else if(mode==='paused')resume();}});
window.addEventListener('keyup',e=>keys.delete(e.code));window.addEventListener('blur',()=>{keys.clear();pending.clear();if(mode==='playing'){stepSimulation(game,{...defaultInput(),pause:true});pauseMenu();}});
let dragging=false;renderer.domElement.onpointerdown=e=>{dragging=true;renderer.domElement.setPointerCapture(e.pointerId);};renderer.domElement.onpointerup=()=>dragging=false;renderer.domElement.onpointercancel=()=>dragging=false;renderer.domElement.onpointermove=e=>{if(dragging){yaw=(yaw+e.movementX*settings.sensitivity)%360;cameraHeight=Math.max(1,Math.min(12,cameraHeight+e.movementY*settings.sensitivity*.05));}};
window.onresize=()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);};
const warningLeaves=new THREE.Group();scene.add(warningLeaves);for(let i=0;i<8;i++){const leaf=mesh(new THREE.PlaneGeometry(.25,.45),mat(C.grass,{side:THREE.DoubleSide}),[0,0,0],warningLeaves);leaf.rotation.z=i;}
buildWorld();menu();
// Harness xem bản đồ trong Vite dev, không tồn tại trong bản build phát hành.
if(import.meta.env.DEV){const preview=Number(new URLSearchParams(location.search).get('preview-night'));if([1,2,3].includes(preview))intro(preview);}
renderer.setAnimationLoop(time=>{if(previousTime!==undefined&&mode==='playing')accumulator+=Math.min((time-previousTime)/1000,.25);previousTime=time;
 while(mode==='playing'&&accumulator>=FIXED_DT){const i=defaultInput();i.move=[Number(keys.has('KeyD')||keys.has('ArrowRight'))-Number(keys.has('KeyA')||keys.has('ArrowLeft')),Number(keys.has('KeyS')||keys.has('ArrowDown'))-Number(keys.has('KeyW')||keys.has('ArrowUp'))];i.cam_yaw_deg=yaw;for(const [field,codes] of Object.entries({jump:['Space'],dash:['ShiftLeft','ShiftRight'],interact:['KeyE'],pulse:['KeyF']}))i[field]=codes.some(c=>keys.has(c)||pending.has(c));handleEvents(stepSimulation(game,i));pending.clear();accumulator-=FIXED_DT;if(['won','lost'].includes(game.state))result();}
 render();if(mode==='playing'){if(!metricStart)metricStart=time;frameCount++;if(time>metricStart+1000)renderer.domElement.dataset.fps=((frameCount-1)*1000/(time-metricStart)).toFixed(1);}
});
}catch(e){$('error').hidden=false;$('error').textContent='Không khởi tạo được game. Kiểm tra WebGL 2 và console.';console.error(e);}
