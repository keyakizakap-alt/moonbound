import * as T from './assets/three.js';

const scratchCanvas=document.createElement('canvas');scratchCanvas.width=scratchCanvas.height=128;const sc=scratchCanvas.getContext('2d');const pixels=sc.createImageData(128,128);for(let i=0;i<pixels.data.length;i+=4){const value=170+Math.floor(Math.random()*55);pixels.data[i]=pixels.data[i+1]=pixels.data[i+2]=value;pixels.data[i+3]=255}sc.putImageData(pixels,0,0);const scratches=new T.CanvasTexture(scratchCanvas);scratches.wrapS=scratches.wrapT=T.RepeatWrapping;scratches.repeat.set(3,3);
let detail=1;
const sphere = new T.SphereGeometry(1, 28, 20);
const midSphere=new T.SphereGeometry(1,16,12),lowSphere=new T.SphereGeometry(1,10,8);
const irisGeo = new T.SphereGeometry(1, 16, 12);
const palettes = [0xe0e1e7, 0x181522, 0x564466, 0x624330, 0x6f2926, 0x14282c];
const material = (color, metalness = 0, roughness = .5) => new T.MeshStandardMaterial({ color, metalness, roughness });
function mesh(parent, geometry, mat, x=0, y=0, z=0, sx=1, sy=1, sz=1) {
  const m = new T.Mesh(geometry, mat);
  m.position.set(x,y,z); m.scale.set(sx,sy,sz); m.castShadow=true; m.receiveShadow=true;
  parent.add(m); return m;
}
function ellipsoid(parent,mat,x,y,z,sx,sy,sz){return mesh(parent,detail<.5?lowSphere:detail<.9?midSphere:sphere,mat,x,y,z,sx,sy,sz)}
function tube(parent,points,radius,mat,segments=16){
  return mesh(parent,new T.TubeGeometry(new T.CatmullRomCurve3(points.map(p=>new T.Vector3(...p))),Math.max(6,Math.floor(segments*detail)),radius,Math.max(4,Math.floor(7*detail)),false),mat);
}
function lathe(parent,profile,mat,y=0,depth=1,segments=40){
  const m=mesh(parent,new T.LatheGeometry(profile.map(p=>new T.Vector2(...p)),Math.max(12,Math.floor(segments*detail))),mat,0,y,0);m.scale.z=depth;return m;
}
function band(parent,radius,y,mat,depth=1,t=.012){
  const m=mesh(parent,new T.TorusGeometry(radius,t,6,48),mat,0,y,0);m.rotation.x=Math.PI/2;m.scale.y=depth;return m;
}
function joint(parent,x,y,z){const g=new T.Group();g.position.set(x,y,z);parent.add(g);return g}

// Merge static details within each articulated joint, while keeping the rig movable.
function batch(group){
  for(const c of [...group.children])if(c.isGroup)batch(c);
  const sets=new Map();
  for(const c of [...group.children])if(c.isMesh&&!c.userData.dynamic&&!Array.isArray(c.material)){
    c.updateMatrix();const key=c.material.uuid; if(!sets.has(key))sets.set(key,[]);sets.get(key).push(c);
  }
  for(const set of sets.values()){
    if(set.length<2)continue;
    const attributes={position:[],normal:[],uv:[]};
    for(const m of set){
      const g=(m.geometry.index?m.geometry.toNonIndexed():m.geometry.clone()).applyMatrix4(m.matrix);
      for(const name of Object.keys(attributes)){
        const a=g.getAttribute(name);attributes[name].push(a?Array.from(a.array):Array(g.getAttribute('position').count*(name==='uv'?2:3)).fill(0));
      }
      group.remove(m);g.dispose();
    }
    const g=new T.BufferGeometry();
    for(const name of Object.keys(attributes))g.setAttribute(name,new T.Float32BufferAttribute(attributes[name].flat(),name==='uv'?2:3));
    const merged=mesh(group,g,set[0].material);merged.frustumCulled=true;
  }
}
function cape(parent,mat){
  const w=8,h=12,p=[],uv=[],indices=[];
  for(let j=0;j<=h;j++)for(let i=0;i<=w;i++){
    const v=j/h,u=i/w;p.push((u-.5)*(.42+v*.37),1.70-v*1.15,-.16-v*.22+Math.sin(u*Math.PI*8)*.014);
    uv.push(u,v);
  }
  for(let j=0;j<h;j++)for(let i=0;i<w;i++){
    const a=j*(w+1)+i,b=a+1,c=a+w+1,d=c+1;indices.push(a,c,b,b,c,d);
  }
  const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(p,3));g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.setIndex(indices);g.computeVertexNormals();
  const m=mesh(parent,g,mat);m.userData.dynamic=true;m.userData.rest=p;m.userData.previous=new Float32Array(p);m.userData.constraints=[];
  for(let j=0;j<=h;j++)for(let i=0;i<=w;i++){const a=j*(w+1)+i;for(const [dx,dy] of [[1,0],[0,1],[1,1]])if(i+dx<=w&&j+dy<=h){const b=(j+dy)*(w+1)+i+dx;const len=Math.hypot(p[a*3]-p[b*3],p[a*3+1]-p[b*3+1],p[a*3+2]-p[b*3+2]);m.userData.constraints.push([a,b,len])}}
  m.userData.columns=w+1;m.userData.accumulator=0;return m;
}
function blade(parent,steel,gold,glow){
  const shape=new T.Shape();shape.moveTo(-.04,0);shape.lineTo(-.04,.72);shape.lineTo(0,.91);shape.lineTo(.04,.72);shape.lineTo(.04,0);shape.closePath();
  const g=new T.ExtrudeGeometry(shape,{depth:.016,bevelEnabled:true,bevelSize:.006,bevelThickness:.005,bevelSegments:2,steps:1});
  mesh(parent,g,steel,0,0,-.008);
  tube(parent,[[-.15,-.025,0],[0,-.015,0],[.15,-.025,0]],.018,gold);
  lathe(parent,[[.024,-.16],[.028,-.14],[.024,-.025]],material(0x20202b),0,1,16);
  ellipsoid(parent,gold,0,-.18,0,.038,.04,.038);
  tube(parent,[[0,.07,.019],[0,.65,.019]],.004,glow);
}
function face(head,skin,hair,variant,hero){
  // Tapered jaw, cheeks and a natural-sized cranium rather than a spherical head.
  const g=new T.SphereGeometry(1,Math.max(16,Math.floor(40*detail)),Math.max(12,Math.floor(28*detail))),p=g.attributes.position;
  for(let i=0;i<p.count;i++){
    const y=p.getY(i),jaw=y<-.2?1+(y+.2)*.28:1;
    p.setXYZ(i,p.getX(i)*(.129+(variant%4)*.003)*jaw,p.getY(i)*.162,p.getZ(i)*.108*(y<-.4?.85:1));
  }g.computeVertexNormals();
  mesh(head,g,skin);
  const features=joint(head,0,0,0);
  for(const side of[-1,1]){
    ellipsoid(features,skin,side*.129,-.008,0,.018,.035,.018);
    
    const eye=ellipsoid(features,material(0xe4ded7),side*.050,.028,.093,.027,.010,.010);
    eye.rotation.z=side*(variant%3-1)*.035;
    ellipsoid(features,material(0x4b342a),side*.050,.028,.102,.008,.008,.003);
    ellipsoid(features,material(0x15151a),side*.050,.028,.105,.004,.005,.002);
    ellipsoid(features,new T.MeshBasicMaterial({color:0xffffff}),side*.047,.031,.107,.0015,.0015,.001);
    tube(features,[[side*.015,.031,.104],[side*.049,.042,.105],[side*.085,.028,.095]],.0028,material(0x45323a),12);
    tube(features,[[side*.018,.061,.10],[side*.049,.068,.102],[side*.088,.061,.087]],.004,hair,12);
  }
  ellipsoid(features,skin,0,.002,.109,.011,.033,.014);
  ellipsoid(features,skin,0,-.019,.119,.013,.010,.013);
  const lip=material(0xa76872,0,.5);
  tube(features,[[-.027,-.071,.094],[-.012,-.067,.104],[0,-.070,.105],[.012,-.067,.104],[.027,-.071,.094]],.0037,lip,12);
  ellipsoid(features,material(0xbc8390),0,-.078,.097,.023,.005,.005);
}
function buildValkyrie(hero,quality){
  detail=quality;
  const root=new T.Group(),body=new T.Group();root.add(body);
  const id=hero.id||0,style=hero.art??id%6,fuller=hero.build==='curvy';
  const steel=material(new T.Color(hero.color).lerp(new T.Color(0xbdcbd5),.63),.68,.31);
  const accent=material(hero.color,.32,.38),gold=material(0xc9a46a,.72,.3);
  const dark=material(new T.Color(hero.color).multiplyScalar(.12),.08,.78);
  steel.roughnessMap=scratches;steel.bumpMap=scratches;steel.bumpScale=.0015;gold.roughnessMap=scratches;
  const skin=material(new T.Color(0xe7baa7).lerp(new T.Color(0xc79d8c),(id%4)*.055),0,.63);
  const hair=material(palettes[style],.03,.44);
  const magic=new T.MeshStandardMaterial({color:hero.color,emissive:hero.color,emissiveIntensity:1.7,roughness:.3});
  // Fitted, fully covered breastplate with waist, back and hip contours.
  lathe(body,[[.19,1.01],[.22,1.09],[.18,1.20],[.155,1.32],[.18,1.46],[.22,1.58],[.235,1.64],[.19,1.70],[.10,1.75]],steel,0,.72);
  if(fuller)body.scale.x=1.12;
  for(const side of[-1,1]){
    ellipsoid(body,steel,side*.085,1.53,.105,.105,.115,.054);
    tube(body,[[side*.03,1.67,.13],[side*.13,1.57,.16],[side*.15,1.43,.12],[side*.06,1.32,.115]],.008,gold);
    ellipsoid(body,gold,side*.19,1.66,.025,.072,.06,.085);
  }
  band(body,.18,1.21,gold,.74,.017);ellipsoid(body,gold,0,1.22,.14,.055,.048,.019);
  ellipsoid(body,magic,0,1.63,.152,.025,.031,.014);
  lathe(body,[[.075,1.74],[.08,1.80],[.066,1.85]],skin,0,.88);
  lathe(body,[[.092,1.72],[.084,1.79]],accent,0,.88);
  band(body,.087,1.785,gold,.88,.007);
  for(let i=0;i<6;i++){
    const geo=new T.LatheGeometry([new T.Vector2(.21,1.11),new T.Vector2(.25,1.01),new T.Vector2(.28,.79)],24,(i/6)*Math.PI*2+.04,Math.PI/3-.08);
    const panel=mesh(body,geo,i%2?dark:accent);panel.scale.z=.8;
  }
  band(body,.216,1.08,gold,.81,.009);
  const clothMaterial=dark.clone();clothMaterial.side=T.DoubleSide;
  const cloak=cape(body,clothMaterial);
  const head=joint(body,0,2.012,0);face(head,skin,hair,id,hero);
  const capGeometry=new T.SphereGeometry(1,32,24,0,Math.PI*2,0,Math.PI*.53);const capVertices=capGeometry.attributes.position;for(let i=0;i<capVertices.count;i++)if(capVertices.getZ(i)>.2&&capVertices.getY(i)<.45)capVertices.setY(i,.45);capGeometry.computeVertexNormals();mesh(head,capGeometry,hair,0,.016,-.007,.139,.153,.117);
  const locks=joint(head,0,0,0);
  const short=style===2||style===5;
  const lockCount=Math.max(8,Math.floor(28*detail));
  for(let i=0;i<lockCount;i++){
    const a=(i/lockCount)*Math.PI*2,front=Math.cos(a)<-.2;
    if(front)continue;
    const x=Math.sin(a)*.12,z=-Math.cos(a)*.1;
    const length=short?.22:(style===1?.51:.43);
    tube(locks,[[x*.55,.135,z*.7],[x,.065,z],[x*1.12,-.1,z-.015],[x*(1.1+Math.sin(i)*.15),-length,z-.03]],.012,hair,20);
  }
  // Swept front fringe; distinct hair length and color per portrait family.
  for(let i=0;i<9;i++){
    const x=(i-4)*.025;
    tube(head,[[x*.8,.14,.055],[x,.095,.09],[x+(style===1?.018:0),.051+(i%3)*.006,.103]],.012,hair,16);
  }
  tube(head,[[-.12,.095,.077],[0,.145,.10],[.12,.095,.077]],.007,gold);
  ellipsoid(head,magic,0,.135,.107,.015,.020,.008);
  const shoulders=[],elbows=[],hips=[],knees=[];
  for(const side of[-1,1]){
    const shoulder=joint(body,side*.275,1.68,0);shoulder.rotation.z=side*.09;
    ellipsoid(shoulder,steel,0,-.028,0,.095,.105,.105);
    band(shoulder,.10,-.045,gold,.98,.007);
    lathe(shoulder,[[.057,-.32],[.07,-.18],[.072,-.09]],dark,0,.85,24);
    ellipsoid(shoulder,steel,0,-.17,-.016,.073,.145,.059);
    const elbow=joint(shoulder,0,-.34,0);ellipsoid(elbow,steel,0,0,0,.063,.055,.06);
    lathe(elbow,[[.04,-.31],[.055,-.21],[.065,-.04]],steel,0,.84,24);
    band(elbow,.051,-.24,gold,.84,.008);
    const hand=joint(elbow,0,-.34,0);ellipsoid(hand,dark,0,-.024,0,.04,.062,.026);
    for(let f=0;f<4;f++)ellipsoid(hand,dark,(f-1.5)*.013,-.068,.007,.007,.031,.012);
    if(side===-1){const weapon=joint(hand,0,-.04,.035);weapon.rotation.x=Math.PI;blade(weapon,steel,gold,magic)}
    else{ellipsoid(hand,accent,0,-.075,-.024,.12,.18,.025);tube(hand,[[-.10,-.12,-.05],[0,-.23,-.05],[.10,-.12,-.05]],.006,gold)}
    shoulders.push(shoulder);elbows.push(elbow);
    const hip=joint(body,side*.115,.94,0);
    lathe(hip,[[.067,-.45],[.079,-.28],[.086,-.04]],dark,0,.94,24);
    ellipsoid(hip,steel,side*.015,-.23,-.004,.081,.20,.076);
    const knee=joint(hip,0,-.46,0);
    ellipsoid(knee,steel,0,-.012,.018,.076,.063,.069);
    lathe(knee,[[.044,-.38],[.047,-.28],[.07,-.06]],steel,0,.82,24);
    tube(knee,[[0,-.03,.075],[0,-.32,.041]],.007,gold);
    ellipsoid(knee,dark,0,-.41,.04,.062,.066,.135);
    ellipsoid(knee,steel,0,-.42,.12,.058,.035,.075);
    hips.push(hip);knees.push(knee);
  }
  if(hero.build==='elegant')root.scale.set(1,1.06,1);
  if(fuller)root.scale.set(1,1.07,1);
  root.userData={rig:{body,head,locks,shoulders,elbows,hips,knees,cloak},attack:0,baseScale:root.scale.clone()};
  batch(body);return root;
}
function buildEnemy(boss,variant,quality){
  detail=quality;
  const root=new T.Group(),body=new T.Group();root.add(body);
  const steel=material(boss?0x493947:0x526072,.64,.43),bone=material(0xbbb1a2,0,.73),dark=material(0x1c202b,.1,.7),gold=material(0x9c775a,.7,.4);
  const glow=new T.MeshStandardMaterial({color:0xff574b,emissive:0xee3027,emissiveIntensity:2});
  lathe(body,[[.21,1.01],[.17,1.25],[.22,1.43],[.28,1.66],[.20,1.76]],steel,0,.75);
  for(const side of[-1,1]){
    ellipsoid(body,steel,side*.12,1.52,.11,.12,.16,.07);
    for(let r=0;r<4;r++)tube(body,[[side*.02,1.47-r*.065,.17],[side*.15,1.46-r*.065,.14],[side*.19,1.43-r*.065,.05]],.009,gold);
  }
  const head=joint(body,0,1.96,0);
  ellipsoid(head,bone,0,0,0,.139,.17,.12);ellipsoid(head,bone,0,-.11,.04,.105,.07,.083);
  for(const side of[-1,1]){
    ellipsoid(head,dark,side*.056,.024,.10,.047,.04,.023);
    ellipsoid(head,glow,side*.057,.026,.119,.025,.012,.010);
    tube(head,[[side*.10,.10,-.02],[side*.17,.23,-.06],[side*.16,.38,-.12],[side*.10,.44,-.19]],boss?.035:.022,steel);
    ellipsoid(head,steel,side*.124,.015,-.02,.052,.14,.085);
  }
  for(let i=-3;i<=3;i++)ellipsoid(head,bone,i*.021,-.094,.117,.008,.021,.006);
  lathe(head,[[.05,-.22],[.057,-.15]],dark);
  const shoulders=[],elbows=[],hips=[],knees=[];
  for(const side of[-1,1]){
    const shoulder=joint(body,side*.32,1.70,0);
    ellipsoid(shoulder,steel,0,0,0,.16,.12,.14);
    for(let i=0;i<3;i++)tube(shoulder,[[side*.04,.06,-.09+i*.075],[side*.16,.21,-.10+i*.075],[side*.22,.27,-.10+i*.075]],.025,steel);
    lathe(shoulder,[[.064,-.36],[.085,-.1]],dark);const elbow=joint(shoulder,0,-.37,0);
    lathe(elbow,[[.051,-.3],[.09,-.08],[.065,0]],steel);
    ellipsoid(elbow,dark,0,-.36,.02,.061,.09,.04);
    if(side===-1){const sword=joint(elbow,0,-.39,.05);sword.rotation.x=Math.PI;blade(sword,steel,gold,glow)}
    else for(let i=0;i<3;i++)tube(elbow,[[i*.03-.03,-.38,.02],[i*.032-.032,-.46,.06],[i*.032-.032,-.50,.11]],.011,bone);
    shoulders.push(shoulder);elbows.push(elbow);
    const hip=joint(body,side*.13,.95,0);lathe(hip,[[.064,-.46],[.086,-.07]],steel);
    const knee=joint(hip,0,-.46,0);ellipsoid(knee,steel,0,0,.018,.08,.075,.08);
    lathe(knee,[[.052,-.39],[.066,-.1]],steel);ellipsoid(knee,steel,0,-.42,.057,.07,.063,.14);
    hips.push(hip);knees.push(knee);
  }
  const mantleMaterial=dark.clone();mantleMaterial.side=T.DoubleSide;
  const cloak=cape(body,mantleMaterial);
  if(boss){
    root.scale.setScalar(1.52);
    for(const side of[-1,1]){
      // Curved, ribbed wing-like pauldrons make the guardian silhouette readable.
      for(let i=0;i<5;i++)tube(body,[[side*.27,1.73,.05],[side*(.46+i*.08),1.94+i*.035,.13],[side*(.64+i*.08),1.71-i*.16,.22]],.024,steel);
    }
    ellipsoid(body,glow,0,1.50,.19,.06,.075,.03);
  }else if(variant%2===1){root.scale.set(.93,1.08,.93)}
  root.userData={rig:{body,head,shoulders,elbows,hips,knees,cloak},attack:0,baseScale:root.scale.clone(),enemy:true};
  batch(body);return root;
}
function makeLOD(factory){
  const lod=new T.LOD();const factors=[1,.65,.36],distances=[0,11,22];
  for(let i=0;i<3;i++){const model=factory(factors[i]);if(i===0){lod.scale.copy(model.scale);lod.userData={attack:0,baseScale:lod.scale.clone(),motion:{hair:0,hairVelocity:0}}}model.scale.setScalar(1);lod.addLevel(model,distances[i],.12)}
  lod.levels.forEach((level,i)=>level.object.visible=i===0);detail=1;return lod;
}
export function createValkyrie(hero={color:0x9dd8ee,art:0,id:0}){return makeLOD(q=>buildValkyrie(hero,q))}
export function createEnemy(boss=false,variant=0){const lod=makeLOD(q=>buildEnemy(boss,variant,q));lod.userData.enemy=true;return lod}
function smoothAngle(current,target,alpha){return current+Math.atan2(Math.sin(target-current),Math.cos(target-current))*alpha}
function samplePose(progress,keys){
  for(let i=1;i<keys.length;i++)if(progress<=keys[i][0]){
    const a=keys[i-1],b=keys[i],t=T.MathUtils.smoothstep(progress,a[0],b[0]);return T.MathUtils.lerp(a[1],b[1],t);
  }
  return keys[keys.length-1][1];
}
export function animateRig(root,time,moving,dt){
  const step=T.MathUtils.clamp(dt,0,.1);
  const state=root.userData.animation??(root.userData.animation={phase:0,blend:0,lastPosition:root.position.clone(),hair:0,hairVelocity:0,cloth:0,clothVelocity:0,poses:null});
  const travelled=root.position.distanceTo(state.lastPosition);state.lastPosition.copy(root.position);
  // Animation advances with actual travel, including the companion's own movement.
  const speed=step>0?Math.min(travelled/step,4):0;
  const targetBlend=moving&&speed>.02?T.MathUtils.clamp(speed/1.8,0,1):0;
  state.blend=T.MathUtils.lerp(state.blend,targetBlend,1-Math.exp(-10*step));
  if(travelled<.75)state.phase+=travelled*(Math.PI*2/1.35);
  const cycle=state.phase;
  const attack=root.userData.attack||0;
  const progress=T.MathUtils.clamp(1-attack/.45,0,1);
  const attacking=attack>0;
  const walk=state.blend*(attacking?.3:1);
  const hairTarget=moving?Math.sin(cycle)*.012:0;
  // Exact damped convergence keeps secondary motion bounded at low frame rates.
  state.hair=T.MathUtils.lerp(state.hair,hairTarget,1-Math.exp(-8*step));
  const clothTarget=(moving?-.045:0)+Math.sin(time*1.5)*.006;
  state.cloth=T.MathUtils.lerp(state.cloth,clothTarget,1-Math.exp(-5*step));
  const models=root.isLOD?root.levels.map(l=>l.object):[root];
  const activeIndex=root.isLOD?root.getCurrentLevel():0;
  for(let level=0;level<models.length;level++){
    const model=models[level],rig=model.userData.rig;if(!rig)continue;
    const blend=1-Math.exp(-14*step);
    rig.body.position.y=Math.sin(cycle*2)*.008*walk;
    rig.body.rotation.z=Math.sin(cycle)*.006*walk;rig.body.rotation.x=T.MathUtils.lerp(rig.body.rotation.x,root.userData.dodging?-.12:0,blend);
    rig.body.rotation.y=attacking?samplePose(progress,[[0,0],[.2,-.10],[.55,.14],[1,0]]):T.MathUtils.lerp(rig.body.rotation.y,0,blend);
    rig.head.rotation.y=T.MathUtils.lerp(rig.head.rotation.y,0,blend);
    rig.hips.forEach((hip,i)=>{
      const phase=cycle+i*Math.PI;
      const upper=.46,lower=.41;
      const footZ=-Math.cos(phase)*.28*walk;
      const footY=-.858-rig.body.position.y+Math.max(0,Math.sin(phase))*.065*walk;
      const distance=Math.min(Math.hypot(footY,footZ),upper+lower-.002);
      const aim=Math.atan2(-footZ,-footY);
      const hipBend=Math.acos(T.MathUtils.clamp((upper*upper+distance*distance-lower*lower)/(2*upper*distance),-1,1));
      const kneeBend=Math.acos(T.MathUtils.clamp((distance*distance-upper*upper-lower*lower)/(2*upper*lower),-1,1));
      hip.rotation.x=smoothAngle(hip.rotation.x,aim-hipBend,blend);
      rig.knees[i].rotation.x=T.MathUtils.lerp(rig.knees[i].rotation.x,kneeBend,blend);
    });
    rig.shoulders.forEach((shoulder,i)=>{
      let x=-.08-Math.sin(cycle+i*Math.PI)*.16*walk,z=i===0?-.09:.09,elbow=-.12;
      if(i===0&&attacking){
        x=samplePose(progress,[[0,-.08],[.22,-.62],[.55,.36],[.78,.10],[1,-.08]]);
        z=samplePose(progress,[[0,-.09],[.22,-.35],[.55,.18],[1,-.09]]);
        elbow=samplePose(progress,[[0,-.12],[.22,-.55],[.55,-.20],[1,-.12]]);
      }
      shoulder.rotation.x=T.MathUtils.lerp(shoulder.rotation.x,x,blend);
      shoulder.rotation.z=T.MathUtils.lerp(shoulder.rotation.z,z,blend);
      rig.elbows[i].rotation.x=T.MathUtils.lerp(rig.elbows[i].rotation.x,elbow,blend);
    });
    if(rig.locks)rig.locks.rotation.x=state.hair;
    // Reconstruct a bounded cloth pose from its rest shape, never accumulated drift.
    const cloth=rig.cloak.geometry.attributes.position,rest=rig.cloak.userData.rest;
    for(let i=0;i<cloth.count;i++){
      const v=T.MathUtils.clamp((1.70-rest[i*3+1])/1.15,0,1);
      const flutter=Math.sin(time*2-rest[i*3]*4-v*2)*.007*v;
      cloth.setXYZ(i,rest[i*3],rest[i*3+1],rest[i*3+2]+state.cloth*v*v+flutter);
    }
    cloth.needsUpdate=true;if(level===activeIndex)rig.cloak.geometry.computeVertexNormals();
  }
  root.userData.attack=Math.max(0,attack-step);
}
export function disposeCharacter(root){
  const geometries=new Set(),materials=new Set();root.traverse(n=>{if(n.isMesh){if(n.geometry!==sphere&&n.geometry!==irisGeo&&n.geometry!==midSphere&&n.geometry!==lowSphere)geometries.add(n.geometry);for(const m of Array.isArray(n.material)?n.material:[n.material])materials.add(m)}});
  for(const g of geometries)g.dispose();for(const m of materials)m.dispose();
}
