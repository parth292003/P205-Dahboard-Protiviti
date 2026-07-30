/* p2o5-scene v2: supplier→ship→port→plant scene.
   Fancy mode (needs import map for 'three'): Sky + Water shaders from three.js examples, shadows, OrbitControls.
   Fallback (no import map): flat-shaded water, parallax camera. */
(function(){
if(customElements.get('p2o5-scene')) return;
const STAGE_FOCUS=[[-42,0],[-14,9],[20,0],[42,-4]];
const SHIP_POS=[[-30,7],[-14,9],[6,7],[6,7]];
const PAL={
 dark:{fog:0x0a141d,water:0x0d2434,pad:0x25333f,wh:0x30414f,roof:0x1c2833,crane:0x415463,crane2:0x3c4e5c,tankA:0xb9c6ce,tankB:0xaab8c1,tankTop:0x27343f,
  plantA:0x37485a,plantB:0x2d3d4c,stack:0x93a5b1,silo:0xaab8c1,hull:0xa6503a,deck:0x8a4231,hatch:0xd99a4e,bridge:0xdde6ec,bridgeTop:0x27343f,funnel:0xb14a30,
  label:'#bed7e8',labelBg:'rgba(12,24,34,0.72)',shipLabel:'#ebd7b4',sea:0x3d5a6e,hemiSky:0x9fc4de,hemiGnd:0x0d1a24,land:0x16242e,road:0x2c3a46},
 light:{fog:0xcfe0ec,water:0x9fc3da,pad:0xb7c6d2,wh:0xa9b9c6,roof:0x8296a5,crane:0x8fa3b2,crane2:0x869aa9,tankA:0xeef3f6,tankB:0xdde6ec,tankTop:0x8fa3b2,
  plantA:0x9fb2c1,plantB:0x8ea3b3,stack:0xd5dee5,silo:0xdde6ec,hull:0xb45a3e,deck:0x9c4c34,hatch:0xd99a4e,bridge:0xf4f7f9,bridgeTop:0x5b6b7a,funnel:0xb45a3e,
  label:'#24384a',labelBg:'rgba(255,255,255,0.88)',shipLabel:'#8c3e20',sea:0xe8f2f8,hemiSky:0xffffff,hemiGnd:0xb9c9d6,land:0xccc7b4,road:0x93a0ab}
};
class P2O5Scene extends HTMLElement{
  static get observedAttributes(){return['stage','vessel','accent','drift'];}
  constructor(){super();this._stage=2;this._vessel='';this._accent='#3f7ca8';this._drift=true;this._ready=false;}
  attributeChangedCallback(n,_,v){
    if(n==='stage'){this._stage=Math.max(0,Math.min(3,parseInt(v)||0));if(this._ready)this._applyStage();}
    else if(n==='vessel'){this._vessel=v||'';if(this._ready)this._applyVessel();}
    else if(n==='accent'){this._accent=v||'#3f7ca8';if(this._ready)this._applyAccent();}
    else if(n==='drift'){this._drift=v!=='0'&&v!=='false';}
  }
  connectedCallback(){if(this._init)return;this._init=true;this.style.cssText+=';display:block;position:relative;overflow:hidden;width:100%;height:100%;';this._boot();}
  disconnectedCallback(){this._dead=true;if(this._ro)this._ro.disconnect();}
  async _boot(){
    let T=null,Water=null,Sky=null,Orbit=null;
    try{
      T=await import('three');
      Water=(await import('three/addons/objects/Water.js')).Water;
      Sky=(await import('three/addons/objects/Sky.js')).Sky;
      Orbit=(await import('three/addons/controls/OrbitControls.js')).OrbitControls;
    }catch(e){
      try{T=await import('https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js');}
      catch(e2){console.error('three load failed',e2);return;}
    }
    this._T=T;this._WaterC=Water;this._SkyC=Sky;this._Orbit=Orbit;
    this._build();
  }
  _mat(c,o){const T=this._T;return new T.MeshStandardMaterial(Object.assign({color:c,roughness:.8,metalness:.06,flatShading:true},o||{}));}
  _box(w,h,d,c,x,y,z,parent){const T=this._T;const m=new T.Mesh(new T.BoxGeometry(w,h,d),this._mat(c));m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;(parent||this._world).add(m);return m;}
  _cyl(r,h,c,x,y,z,parent,seg){const T=this._T;const m=new T.Mesh(new T.CylinderGeometry(r,r,h,seg||16),this._mat(c));m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;(parent||this._world).add(m);return m;}
  _drawPill(cv,text,fg,bg){
    const g=cv.getContext('2d');g.clearRect(0,0,cv.width,cv.height);
    if(!text)return;
    g.font='600 44px -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif';
    const tw=Math.min(g.measureText(text).width,430);
    const pw=tw+64,ph=76,x0=(cv.width-pw)/2,y0=(cv.height-ph)/2,r=38;
    g.fillStyle=bg;g.beginPath();
    g.moveTo(x0+r,y0);g.arcTo(x0+pw,y0,x0+pw,y0+ph,r);g.arcTo(x0+pw,y0+ph,x0,y0+ph,r);g.arcTo(x0,y0+ph,x0,y0,r);g.arcTo(x0,y0,x0+pw,y0,r);g.fill();
    g.fillStyle=fg;g.textAlign='center';g.textBaseline='middle';g.fillText(text,cv.width/2,cv.height/2+2,430);
  }
  _label(text,x,y,z,scale){
    const T=this._T,cv=document.createElement('canvas');cv.width=512;cv.height=128;
    this._drawPill(cv,text,this._P.label,this._P.labelBg);
    const t=new T.CanvasTexture(cv);t.anisotropy=4;
    const s=new T.Sprite(new T.SpriteMaterial({map:t,transparent:true,depthWrite:false}));
    s.scale.set((scale||15),(scale||15)*128/512,1);s.position.set(x,y,z);this._world.add(s);return s;
  }
  _build(){
    const T=this._T,fancy=!!(this._WaterC&&this._SkyC);
    const P=this._P=PAL[(this.getAttribute('theme')||'dark')==='light'?'light':'dark'];
    const scn=this._scene=new T.Scene();
    const cam=this._cam=new T.PerspectiveCamera(45,2,1,2000);
    cam.position.set(-14,24,68);cam.lookAt(2,2,0);
    const rnd=this._rnd=new T.WebGLRenderer({antialias:true,alpha:!fancy});
    rnd.setPixelRatio(Math.min(devicePixelRatio,2));
    rnd.domElement.style.cssText='position:absolute;inset:0;width:100%;height:100%;display:block';
    this.appendChild(rnd.domElement);
    const world=this._world=new T.Group();scn.add(world);
    let sunVec=new T.Vector3(-0.4,0.45,0.6).normalize();
    if(fancy){
      rnd.toneMapping=T.ACESFilmicToneMapping;rnd.toneMappingExposure=.62;
      rnd.shadowMap.enabled=true;rnd.shadowMap.type=T.PCFSoftShadowMap;
      const sky=new this._SkyC();sky.scale.setScalar(1500);scn.add(sky);
      const u=sky.material.uniforms;
      u.turbidity.value=4;u.rayleigh.value=1.4;u.mieCoefficient.value=.004;u.mieDirectionalG.value=.95;
      const elev=26,azim=150;
      const phi=T.MathUtils.degToRad(90-elev),theta=T.MathUtils.degToRad(azim);
      sunVec=new T.Vector3().setFromSphericalCoords(1,phi,theta);
      u.sunPosition.value.copy(sunVec);
      const wg=new T.PlaneGeometry(3000,3000);
      const water=this._water=new this._WaterC(wg,{
        textureWidth:512,textureHeight:512,
        waterNormals:new T.TextureLoader().load('https://cdn.jsdelivr.net/gh/mrdoob/three.js@r160/examples/textures/waternormals.jpg',t=>{t.wrapS=t.wrapT=T.RepeatWrapping;}),
        sunDirection:sunVec.clone(),sunColor:0xffffff,waterColor:0x1f6d8c,distortionScale:2.6,fog:false
      });
      water.rotation.x=-Math.PI/2;water.position.y=-.15;scn.add(water);
    }else{
      scn.fog=new T.Fog(P.fog,70,175);
      const wg=new T.PlaneGeometry(320,150,96,42);wg.rotateX(-Math.PI/2);
      this._wpos=wg.attributes.position;this._wbase=Float32Array.from(this._wpos.array);
      const water=new T.Mesh(wg,new T.MeshStandardMaterial({color:P.water,roughness:.55,metalness:.2,flatShading:true}));
      water.position.y=-0.4;world.add(water);
    }
    scn.add(new T.HemisphereLight(P.hemiSky,P.hemiGnd,fancy?.65:1.1));
    const sun=new T.DirectionalLight(0xfff2dc,fancy?2.4:1.5);
    sun.position.copy(sunVec).multiplyScalar(120);
    if(fancy){
      sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);
      const sc=sun.shadow.camera;sc.left=-70;sc.right=70;sc.top=70;sc.bottom=-70;sc.near=10;sc.far=300;
      sun.shadow.bias=-0.0005;
    }
    scn.add(sun);
    this._click=[];
    // land masses: supplier island (left), port+plant coast (right)
    this._box(20,1.6,18,P.land,-43,0,-1);
    this._box(50,1.6,22,P.land,33,0,-6);
    const road=this._box(17,.14,2.2,P.road,30,.92,-2);road.rotation.y=.245;road.castShadow=false;
    const pad=(x,z,w,d,st)=>{const p=this._box(w,1.4,d,P.pad,x,.5,z);p.userData.stage=st;this._click.push(p);return p;};
    // supplier quay
    pad(-42,0,13,10,0);
    const wh=this._box(8,4.2,6,P.wh,-42,3.3,0);wh.userData.stage=0;this._click.push(wh);
    this._box(8.4,.7,6.4,P.roof,-42,5.7,0);
    this._box(.7,5,.7,P.crane,-36.7,3.6,3.4);this._box(6,.5,.6,P.crane,-34,6.1,3.4);
    this._box(1.6,1.2,1.6,P.roof,-38.4,1.8,-3.2);this._box(1.6,1.8,1.6,P.roof,-40.4,2.1,-3.4);
    // port tanks
    pad(20,0,15,10,2);
    [[16.2,P.tankA],[20,P.tankB],[23.8,P.tankA]].forEach(([x,c])=>{
      const t=this._cyl(1.9,4.6,c,x,3.5,0,null,18);t.material.metalness=.45;t.material.roughness=.32;t.userData.stage=2;this._click.push(t);
      this._cyl(1.95,.35,P.tankTop,x,5.95,0);
      this._box(.16,4.6,.16,P.crane2,x+1.95,3.5,1.2);
    });
    this._box(.8,7,.8,P.crane2,11,4.6,1);this._box(.8,7,.8,P.crane2,11,4.6,4.6);
    this._box(.9,.9,10,P.crane2,11,8.3,3.8).rotation.x=.35;
    // plant
    pad(42,-4,16,12,3);
    const pb=this._box(7,5,7,P.plantA,39,3.6,-4);pb.userData.stage=3;this._click.push(pb);
    this._box(5,3.4,5,P.plantB,45.5,2.8,-6);
    this._cyl(.55,9,P.stack,44.5,5.6,-1.5,null,10);
    this._cyl(.55,7,P.stack,46.5,4.6,-1.5,null,10);
    this._cyl(1.5,3.6,P.silo,49,2.9,-6);
    this._box(3.5,.5,1.2,P.crane2,30.5,1.3,-3.6).rotation.y=.12; // pipe rack tank→plant
    // containers at supplier + quay lampposts
    [[-46.5,1.9,-3,0xa35d4e],[-44.4,1.9,-3,0x4e7a9d],[-45.4,3,-3,0x6e8d6a],[-47.5,1.9,3.2,0x4e7a9d]].forEach(([x,y,z,c])=>this._box(2,1.1,1,c,x,y,z));
    const lamp=(x,z)=>{this._cyl(.07,3.2,P.crane2,x,2.4,z,null,6);const b=new T.Mesh(new T.SphereGeometry(.17,8,8),new T.MeshStandardMaterial({color:0xfff2c0,emissive:0xffe9a8,emissiveIntensity:.9}));b.position.set(x,4.1,z);this._world.add(b);};
    lamp(14,3.6);lamp(26,1.2);lamp(36,-2.6);
    // ship
    const ship=this._ship=new T.Group();
    const hs=new T.Shape();hs.moveTo(-7,0);hs.lineTo(-7,2.1);hs.lineTo(4.6,2.1);hs.lineTo(7,1.9);hs.lineTo(5.2,0);hs.closePath();
    const hull=new T.Mesh(new T.ExtrudeGeometry(hs,{depth:3.8,bevelEnabled:false}),this._mat(P.hull));
    hull.position.z=-1.9;hull.castShadow=true;ship.add(hull);
    this._box(11.6,.4,3.6,P.deck,-1.2,2.3,0,ship);
    [[-3.6],[-0.6],[2.4]].forEach(([x])=>this._box(2.4,1,3,P.hatch,x,3,0,ship));
    this._box(2.6,2.6,3.2,P.bridge,-5.6,3.8,0,ship);
    this._box(2.2,1.1,2.6,P.bridgeTop,-5.6,5.6,0,ship);
    this._cyl(.4,1.4,P.funnel,-6.4,6.3,0,ship,10);
    this._box(.14,1.6,.14,P.bridgeTop,6.2,3,0,ship);
    // painted vessel name on both hull sides
    const nc=document.createElement('canvas');nc.width=256;nc.height=64;this._hullCv=nc;
    const nt=new T.CanvasTexture(nc);nt.anisotropy=4;this._hullTex=nt;
    const nm=new T.MeshBasicMaterial({map:nt,transparent:true});
    const hp1=new T.Mesh(new T.PlaneGeometry(5.5,1.2),nm);hp1.position.set(1.6,1.15,1.94);ship.add(hp1);
    const hp2=new T.Mesh(new T.PlaneGeometry(5.5,1.2),nm);hp2.position.set(1.6,1.15,-1.94);hp2.rotation.y=Math.PI;ship.add(hp2);
    ship.traverse(m=>{if(m.isMesh){m.userData.stage=1;this._click.push(m);}});
    world.add(ship);
    this._shipLabel=this._label('',0,7.6,0,15);
    this._label('SUPPLIER',-42,10.8,0,13);
    this._label('PORT TANKS',20,11,0,14);
    this._label('PLANT',42,10.4,-4,11);
    const sea=new T.CatmullRomCurve3([[-28,7.2],[-20,8.6],[-12,9.2],[-2,8.6],[5,7]].map(p=>new T.Vector3(p[0],.5,p[1])));
    const seaLine=new T.Line(new T.BufferGeometry().setFromPoints(sea.getPoints(60)),new T.LineDashedMaterial({color:P.sea,dashSize:1.2,gapSize:1,transparent:true,opacity:.7}));
    seaLine.computeLineDistances();world.add(seaLine);
    // buoys
    this._buoys=[];
    [[-22,10.4],[-10,10.6],[0,9.8]].forEach(([x,z])=>{
      const b=new T.Group();
      const s=new T.Mesh(new T.SphereGeometry(.5,10,10),this._mat(0xd05a3a));s.castShadow=true;b.add(s);
      const m=new T.Mesh(new T.CylinderGeometry(.06,.06,1.1,6),this._mat(0x333f4a));m.position.y=.7;b.add(m);
      b.position.set(x,.15,z);world.add(b);this._buoys.push(b);
    });
    this._flows=[
      new T.CatmullRomCurve3([new T.Vector3(-42,4,0),new T.Vector3(-36,3,4),new T.Vector3(-30,2.5,6)]),
      sea,
      new T.CatmullRomCurve3([new T.Vector3(8,2.5,7),new T.Vector3(14,2.2,4),new T.Vector3(20,3,0)]),
      new T.CatmullRomCurve3([new T.Vector3(22,3,0),new T.Vector3(30,2.2,-2),new T.Vector3(38,2.5,-4)])
    ];
    const pgeo=new T.SphereGeometry(.34,8,8);
    this._pmat=new T.MeshBasicMaterial({color:this._accent});
    this._parts=[];
    for(let i=0;i<10;i++){const s=new T.Mesh(pgeo,this._pmat);s.userData.t=i/10;world.add(s);this._parts.push(s);}
    this._ring=new T.Mesh(new T.TorusGeometry(6,.16,8,48),new T.MeshBasicMaterial({color:this._accent,transparent:true,opacity:.85}));
    this._ring.rotation.x=-Math.PI/2;this._ring.position.y=.5;world.add(this._ring);
    // controls / parallax
    this._ray=new T.Raycaster();this._mouse=new T.Vector2();this._par={x:0,y:0};
    let controls=null;
    if(this._Orbit){
      controls=this._controls=new this._Orbit(cam,rnd.domElement);
      controls.target.set(2,2,0);controls.enableDamping=true;controls.dampingFactor=.06;
      controls.minDistance=34;controls.maxDistance=140;controls.maxPolarAngle=1.45;controls.minPolarAngle=.35;
      controls.autoRotateSpeed=.5;controls.enablePan=false;
    }
    let downAt=0;
    rnd.domElement.addEventListener('pointerdown',()=>{downAt=Date.now();});
    rnd.domElement.addEventListener('pointermove',e=>{
      const r=this.getBoundingClientRect();
      this._par.x=(e.clientX-r.left)/r.width*2-1;this._par.y=(e.clientY-r.top)/r.height*2-1;
      this._mouse.set(this._par.x,-this._par.y);
      this._ray.setFromCamera(this._mouse,cam);
      const hit=this._ray.intersectObjects(this._click,false)[0];
      rnd.domElement.style.cursor=hit?'pointer':(controls?'grab':'default');
      const hs=hit?hit.object.userData.stage:-1;
      if(hs!==this._hoverStage){
        this._hoverStage=hs;
        this.dispatchEvent(new CustomEvent('stage-hover',{detail:{stage:hs,x:e.clientX-r.left,y:e.clientY-r.top},bubbles:true,composed:true}));
      }
    });
    rnd.domElement.addEventListener('pointerleave',()=>{
      if(this._hoverStage!==-1){this._hoverStage=-1;this.dispatchEvent(new CustomEvent('stage-hover',{detail:{stage:-1,x:0,y:0},bubbles:true,composed:true}));}
    });
    rnd.domElement.addEventListener('click',()=>{
      if(Date.now()-downAt>250)return; // drag, not click
      this._ray.setFromCamera(this._mouse,cam);
      const hit=this._ray.intersectObjects(this._click,false)[0];
      if(hit){this.dispatchEvent(new CustomEvent('stage-select',{detail:{stage:hit.object.userData.stage},bubbles:true,composed:true}));}
    });
    this._ro=new ResizeObserver(()=>{
      const w=this.clientWidth||800,h=this.clientHeight||480;
      rnd.setSize(w,h,false);cam.aspect=w/h;cam.updateProjectionMatrix();
    });this._ro.observe(this);
    this._ready=true;this._applyStage(true);this._applyVessel();
    const clock=new T.Clock();
    const loop=()=>{
      if(this._dead)return;
      requestAnimationFrame(loop);
      const dt=clock.getDelta(),t=clock.getElapsedTime();
      if(fancy){this._water.material.uniforms.time.value+=dt*.35;}
      else{
        const pos=this._wpos,base=this._wbase;
        for(let i=0;i<pos.count;i++){
          const x=base[i*3],z=base[i*3+2];
          pos.array[i*3+1]=Math.sin(x*.16+t*1.1)*.3+Math.cos(z*.23+t*.7)*.22;
        }
        pos.needsUpdate=true;
      }
      const tp=this._shipTarget;
      if(tp){ship.position.x+=(tp[0]-ship.position.x)*.03;ship.position.z+=(tp[1]-ship.position.z)*.03;}
      ship.position.y=Math.sin(t*.9)*.14+.12;
      ship.rotation.z=Math.sin(t*.7)*.02;ship.rotation.x=Math.sin(t*.5)*.012;
      this._shipLabel.position.set(ship.position.x,7.6,ship.position.z);
      this._buoys.forEach((b,i)=>{b.position.y=.15+Math.sin(t*1.3+i*2)*.18;b.rotation.z=Math.sin(t*.9+i)*.08;});
      const cur=this._flows[this._stage];
      this._parts.forEach(p=>{
        p.userData.t=(p.userData.t+.0035)%1;
        p.position.copy(cur.getPoint(p.userData.t));
        p.scale.setScalar(.7+.5*Math.sin(p.userData.t*Math.PI));
      });
      const rs=1+Math.sin(t*2.4)*.06;this._ring.scale.set(rs,rs,1);
      this._ring.material.opacity=.55+.3*Math.sin(t*2.4);
      if(controls){controls.autoRotate=this._drift;controls.update();}
      else{
        const dx=(this._drift?Math.sin(t*.12)*3:0)+this._par.x*4;
        cam.position.x+=((2+dx)-cam.position.x)*.04;
        cam.position.y+=((30-this._par.y*2.5)-cam.position.y)*.04;
        cam.lookAt(2,0,0);
      }
      rnd.render(scn,cam);
    };
    loop();
  }
  _applyStage(snap){
    const f=STAGE_FOCUS[this._stage];
    this._ring.position.set(f[0],this._stage===1?.5:1.05,f[1]);
    this._shipTarget=SHIP_POS[this._stage];
    if(snap){this._ship.position.set(this._shipTarget[0],0,this._shipTarget[1]);}
  }
  _applyVessel(){
    const cv=this._shipLabel.material.map.image;
    this._drawPill(cv,(this._vessel||'').toUpperCase(),this._P.shipLabel,this._P.labelBg);
    this._shipLabel.material.map.needsUpdate=true;
    if(this._hullCv){
      const g=this._hullCv.getContext('2d');g.clearRect(0,0,256,64);
      g.font='700 30px -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif';g.textAlign='center';g.textBaseline='middle';
      g.fillStyle='rgba(246,239,226,0.92)';g.fillText((this._vessel||'').toUpperCase(),128,33,240);
      this._hullTex.needsUpdate=true;
    }
  }
  _applyAccent(){
    this._pmat.color.set(this._accent);
    this._ring.material.color.set(this._accent);
  }
}
customElements.define('p2o5-scene',P2O5Scene);
})();
