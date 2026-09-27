// Architectural cutaway models built offline from the original floor plans.
import * as THREE from 'three';
import {OrbitControls} from 'three/examples/jsm/controls/OrbitControls.js';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
import {FLOORS} from '@/lib/map-route.mjs';

type Box = number[];
type FloorData = {floor:number; image:string; imageBox:Box; footprint:Box[]; rooms:{id:string; x:number; y:number; box:Box}[];
  corridors:number[][][]; stairs:{id:string; x:number; y:number; box:Box}[]; places:{id:string; name:string; kind:string; x:number; y:number; box?:Box}[]};
export type Mode = 'schema'|'3d'|'pdf';
export type Mark = {floor:number; x:number; y:number; box?:Box; tone:'from'|'to'|'selected'};
export type Leg = {floor:number; points:number[][]};

const FLOOR_H = 70, ROOM_H = 12, CX = 980, CZ = 390;
const level = (floor:number) => (floor-1)*FLOOR_H;
const px = (x:number) => x-CX, pz = (y:number) => y-CZ;

// The model takes its colours from the current theme.
function palette() {
  const css = getComputedStyle(document.documentElement), v = (name:string) => css.getPropertyValue(name).trim() || '#888';
  const dark = document.documentElement.dataset.scheme === 'dark';
  const col = (x:string) => new THREE.Color(x);
  // Rooms stand out clearly from the floor slab; each kind keeps a recognisable hue.
  const room = dark ? col(v('--card')).lerp(col(v('--foreground')), .13) : col(v('--card'));
  const tint = (hue:string, amount:number) => col(hue).lerp(room, 1-amount).getHex();
  return {slab:(dark ? col(v('--background')).lerp(col(v('--foreground')), .1) : col(v('--muted'))).getHex(), room:room.getHex(),
    lecture:tint(v('--lecture'), dark ? .55 : .45), machine:tint('#34c27a', .42), wc:tint('#7f9bd6', .4), food:tint('#ff9f43', .45),
    place:tint('#a58bff', .45), lift:tint('#8fa3b8', .5), stair:tint(v('--now'), .6), edge:col(v('--foreground')).lerp(room, dark ? .45 : .6).getHex(),
    text:v('--foreground'), textSoft:v('--muted-foreground'), ghost:col(v('--border')).getHex(), now:col(v('--now')).getHex()};
}
const kindOf = (id:string) => /^П-/.test(id) ? 'lecture' : /^МЗ-/.test(id) ? 'machine' : 'room';

export class MapScene {
  private renderer:THREE.WebGLRenderer; private scene = new THREE.Scene();
  private persp = new THREE.PerspectiveCamera(38, 1, 5, 20000); private ortho = new THREE.OrthographicCamera(-1, 1, 1, -1, -5000, 5000);
  private camera:THREE.Camera = this.ortho; private controls:OrbitControls;
  private floors = new Map<number, {group:THREE.Group; solid:THREE.Group; image:THREE.Mesh|null; loaded:boolean; loading:boolean; pick:THREE.Mesh}>();
  private dynamic = new THREE.Group(); private walker:THREE.Mesh|null = null; private walkPath:THREE.CurvePath<THREE.Vector3>|null = null;
  private mode:Mode = 'schema'; private active = 6; private frame = 0; private disposed = false; private down:{x:number; y:number}|null = null;
  private manualView = false;
  private colors = palette(); private anim:{from:THREE.Vector3; to:THREE.Vector3; t:number}|null = null;
  private labelCanvas:HTMLCanvasElement; private labelContext:CanvasRenderingContext2D; private marks:Mark[] = [];
  private observer:ResizeObserver;
  private loader = new GLTFLoader();
  private modelStatus:HTMLDivElement;

  constructor(private host:HTMLElement, private onPick:(floor:number, x:number, y:number)=>void) {
    this.renderer = new THREE.WebGLRenderer({antialias:true, alpha:true});
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    host.appendChild(this.renderer.domElement);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping=THREE.ACESFilmicToneMapping; this.renderer.toneMappingExposure=1;
    this.renderer.shadowMap.enabled = true; this.renderer.shadowMap.autoUpdate=false; this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.modelStatus = document.createElement('div'); this.modelStatus.className='map-model-status';
    this.modelStatus.setAttribute('role','status'); host.appendChild(this.modelStatus);
    this.labelCanvas = document.createElement('canvas'); this.labelCanvas.className = 'map-label-layer';
    this.labelContext = this.labelCanvas.getContext('2d')!; host.appendChild(this.labelCanvas);
    this.controls = new OrbitControls(this.ortho, this.renderer.domElement);
    this.controls.enableDamping = true; this.controls.screenSpacePanning = true;
    this.scene.add(new THREE.HemisphereLight(0xffffff, 0xc4d2d7, 1.5));
    const sun = new THREE.DirectionalLight(0xfff6e5, 2.4); sun.position.set(-700, 1200, -500); sun.castShadow=true;
    Object.assign(sun.shadow.camera,{left:-1200,right:1200,top:1000,bottom:-1000,near:1,far:3500});
    sun.shadow.mapSize.set(2048,2048); sun.shadow.bias=-.0003; sun.shadow.normalBias=.6;
    this.scene.add(sun);
    this.scene.add(this.dynamic);
    this.build();
    const el = this.renderer.domElement;
    el.addEventListener('pointerdown', e => { this.down = {x:e.clientX, y:e.clientY}; });
    el.addEventListener('pointerup', e => { if (this.down && Math.hypot(e.clientX-this.down.x, e.clientY-this.down.y) < 6) this.pick(e); else this.manualView=true; this.down = null; });
    el.addEventListener('wheel', () => { this.manualView=true; }, {passive:true});
    this.observer = new ResizeObserver(() => this.resize()); this.observer.observe(host);
    this.resize();
    const loop = () => { if (this.disposed) return; this.frame = requestAnimationFrame(loop); this.tick(); };
    loop();
  }

  private build() {
    this.colors = palette();
    for (const {group} of this.floors.values()) { this.scene.remove(group); disposeTree(group); }
    this.floors.clear();
    for (const f of FLOORS as FloorData[]) {
      const group = new THREE.Group(); group.position.y = level(f.floor);
      const solid = new THREE.Group();
      group.add(solid);
      // Invisible plane for taps.
      const [bx0, by0, bx1, by1] = bounds(f);
      const pick = new THREE.Mesh(new THREE.PlaneGeometry(bx1-bx0, by1-by0).rotateX(-Math.PI/2), new THREE.MeshBasicMaterial({visible:false}));
      pick.position.set(px((bx0+bx1)/2), 1, pz((by0+by1)/2)); group.add(pick);
      this.scene.add(group);
      this.floors.set(f.floor, {group, solid, image:null, loaded:false, loading:false, pick});
    }
    this.apply();
  }

  // The original drawing from the PDF, for checking the schematic.
  private image(floor:number) {
    const entry = this.floors.get(floor)!;
    if (entry.image) return entry.image;
    const f = (FLOORS as FloorData[]).find(q => q.floor === floor)!;
    const [x0, y0, x1, y1] = f.imageBox;
    const tex = new THREE.TextureLoader().load(import.meta.env.BASE_URL + f.image); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(x1-x0, y1-y0).rotateX(-Math.PI/2), new THREE.MeshBasicMaterial({map:tex,toneMapped:false}));
    mesh.position.set(px((x0+x1)/2), 0.5, pz((y0+y1)/2));
    entry.group.add(mesh); entry.image = mesh;
    return mesh;
  }

  private loadModel(floor:number) {
    const entry=this.floors.get(floor)!;
    if(entry.loaded || entry.loading) return;
    entry.loading=true;
    this.loader.load(import.meta.env.BASE_URL+`map/models/f${floor}.glb`, gltf=>{
      if(this.disposed || this.floors.get(floor)!==entry) { disposeTree(gltf.scene); return; }
      entry.solid.add(gltf.scene); entry.loaded=true; entry.loading=false;
      gltf.scene.traverse(o=>{const m=o as THREE.Mesh;if(m.isMesh){m.castShadow=['wall','cap','stair','lift'].includes(m.name);m.receiveShadow=true;}});
      this.themeModel(entry.solid); this.apply();
    },undefined,()=>{
      if(this.disposed)return;
      entry.loading=false;
      if(floor===this.active && this.mode!=='pdf') {
        this.modelStatus.textContent='Модель не загрузилась. Переключись на PDF или открой карту заново.';
        this.modelStatus.hidden=false;
      }
    });
  }

  private themeModel(root:THREE.Group) {
    const dark=document.documentElement.dataset.scheme==='dark';
    const shades:Record<string,number>={glass:0x4f7385,door:0x6e5a45,slab:0x23303a,floor:0x33434a,room:0x47565b,lecture:0x35655f,machine:0x3c576f,wc:0x435577,food:0x75604c,place:0x5c526d,wall:0x9daeb4,cap:0xc5d4d4,shadow:0x24363c,stair:0x577b7c,steel:0x9faeb5,lift:0x6c899c,rail:0xb8cbd0};
    root.traverse(o=>{
      const mesh=o as THREE.Mesh; if(!mesh.isMesh)return;
      const m=mesh.material as THREE.MeshStandardMaterial;
      if(!m.userData.lightColor)m.userData.lightColor=m.color.getHex();
      m.color.setHex(dark ? shades[m.name] ?? m.userData.lightColor : m.userData.lightColor);
    });
  }

  setView(mode:Mode, floor:number, lowest = floor) {
    const modeChanged = mode !== this.mode, floorChanged = floor !== this.active;
    this.mode = mode; this.active = floor; this.lowest = lowest;
    this.apply();
    if (modeChanged || floorChanged) { this.manualView=false; this.frameFloor(); }
  }
  private lowest = 6;

  private apply() {
    this.renderer.shadowMap.needsUpdate=true;
    for (const [n, e] of this.floors) {
      const on = n === this.active;
      // 3D: the floor in focus is solid, floors under it are faint, floors above are hidden.
      e.group.visible = on || (this.mode === '3d' && this.lowest < this.active && n >= this.lowest && n < this.active);
      e.solid.visible = this.mode !== 'pdf' || !on;
      const opacity = on ? 1 : n >= this.lowest ? .5 : .16;
      e.solid.traverse(o => { const m = (o as THREE.Mesh).material as THREE.Material|undefined; if (!m) return; m.transparent = !on || m.type === 'LineBasicMaterial'; m.opacity = on ? (m.type === 'LineBasicMaterial' ? .8 : 1) : opacity; m.depthWrite = on; m.needsUpdate = true; });
      if (on && this.mode === 'pdf') this.image(n);
      if (e.group.visible && this.mode !== 'pdf') this.loadModel(n);
      if (e.image) e.image.visible = on && this.mode === 'pdf';

    }
    const current=this.floors.get(this.active)!;
    this.modelStatus.hidden=this.mode==='pdf'||current.loaded;
    if(!this.modelStatus.hidden)this.modelStatus.textContent='Загружаем объёмную модель…';
    this.host.dataset.modelReady=String(current.loaded);
    this.applyDynamic();
    const top = this.mode !== '3d';
    this.camera = top ? this.ortho : this.persp;
    this.controls.object = this.camera;
    this.controls.enableRotate = !top;
    this.controls.touches = top ? {ONE:THREE.TOUCH.PAN, TWO:THREE.TOUCH.DOLLY_PAN} : {ONE:THREE.TOUCH.ROTATE, TWO:THREE.TOUCH.DOLLY_PAN};
    this.controls.mouseButtons = top ? {LEFT:THREE.MOUSE.PAN, MIDDLE:THREE.MOUSE.DOLLY, RIGHT:THREE.MOUSE.PAN} : {LEFT:THREE.MOUSE.ROTATE, MIDDLE:THREE.MOUSE.DOLLY, RIGHT:THREE.MOUSE.PAN};
    this.controls.maxPolarAngle = Math.PI*0.45; this.controls.minDistance = 120; this.controls.maxDistance = 8000;
    this.controls.minZoom = 0.05; this.controls.maxZoom = 14;
  }

  private frameFloor(focus?:{x:number; y:number}) {
    const f = (FLOORS as FloorData[]).find(q => q.floor === this.active)!;
    const [x0, y0, x1, y1] = bounds(f), y = level(this.active);
    // Default view: the middle of the rooms (the U-shaped floors have an empty courtyard in the centre).
    const midY = f.rooms.reduce((a, r) => a + r.y, 0) / Math.max(1, f.rooms.length);
    const target = focus ? new THREE.Vector3(px(focus.x), y, pz(focus.y)) : new THREE.Vector3(px((x0+x1)/2), y, pz(f.rooms.length > 20 ? midY : (y0+y1)/2));
    const {clientWidth:w, clientHeight:h} = this.host;
    if (this.mode === '3d') {
      // Fit the whole floor width (or a neighbourhood of the focus) into the view, seen from the south-east above.
      const span = focus ? (this.manualView ? 280 : 620) : (x1-x0)*1.12, hfov = 2*Math.atan(Math.tan(THREE.MathUtils.degToRad(this.persp.fov/2))*this.persp.aspect);
      const dist = Math.min(7000, span/2/Math.tan(hfov/2));
      this.persp.position.copy(target).add(new THREE.Vector3(-0.22, 1.05, 0.72).normalize().multiplyScalar(dist));
    } else {
      // Start with the entire floor visible; search or a tap zooms into a room.
      this.ortho.zoom = focus ? w/360 : Math.min(w/((x1-x0)*1.08), h/((y1-y0)*1.18));
      this.ortho.position.set(target.x, y+2000, target.z); this.ortho.up.set(0, 0, -1);
      this.ortho.updateProjectionMatrix();
    }
    this.controls.target.copy(target); this.camera.lookAt(target); this.controls.update();
  }

  focus(floor:number, x:number, y:number) {
    if (floor !== this.active) { this.active = floor; this.apply(); }
    this.manualView=true;
    this.frameFloor({x, y});
  }

  zoom(factor:number) {
    this.manualView=true;
    if (this.mode === '3d') {
      const offset = this.persp.position.clone().sub(this.controls.target).divideScalar(factor);
      this.persp.position.copy(this.controls.target).add(offset);
    } else {
      this.ortho.zoom = THREE.MathUtils.clamp(this.ortho.zoom*factor, .08, 14);
      this.ortho.updateProjectionMatrix();
    }
    this.controls.update();
  }

  reset() { this.manualView=true; this.frameFloor(); }

  setRoute(legs:Leg[], marks:Mark[]) {
    this.marks = marks;
    for (const o of [...this.dynamic.children]) { this.dynamic.remove(o); (o as THREE.Mesh).geometry?.dispose(); }
    this.walker = null; this.walkPath = null;
    const hl = (m:Mark) => {
      const r = m;
      const color = m.tone === 'to' ? this.colors.now : new THREE.Color(this.colors.text).getHex();
      if (r?.box) {
        const [x0, y0, x1, y1] = r.box, g = new THREE.BoxGeometry(x1-x0-2, 1, y1-y0-2);
        const box = new THREE.Mesh(g, new THREE.MeshBasicMaterial({color, transparent:true, opacity:.28, depthWrite:false}));
        box.position.set(px((x0+x1)/2), level(m.floor)+1.6, pz((y0+y1)/2)); box.userData.floor = m.floor; this.dynamic.add(box);
        const edges = new THREE.LineSegments(new THREE.EdgesGeometry(g), new THREE.LineBasicMaterial({color})); edges.position.copy(box.position); edges.userData.floor = m.floor; this.dynamic.add(edges);
      }
      const pin = new THREE.Group();
      const head = new THREE.Mesh(new THREE.SphereGeometry(7, 20, 14), new THREE.MeshLambertMaterial({color}));
      const tip = new THREE.Mesh(new THREE.ConeGeometry(4.5, 16, 16).rotateX(Math.PI), new THREE.MeshLambertMaterial({color}));
      head.position.y = 30; tip.position.y = 20; pin.add(head, tip);
      pin.position.set(px(m.x), level(m.floor)+ROOM_H, pz(m.y)); pin.userData.pin = true; pin.userData.floor = m.floor; this.dynamic.add(pin);
    };
    marks.forEach(hl);
    if (!legs.length) { this.applyDynamic(); return; }
    const tube = (pts:THREE.Vector3[], floor:number|null) => {
      const path = new THREE.CurvePath<THREE.Vector3>();
      for (let i = 1; i < pts.length; i++) if (pts[i].distanceTo(pts[i-1]) > 0.01) path.add(new THREE.LineCurve3(pts[i-1], pts[i]));
      if (!path.curves.length) return;
      const mesh = new THREE.Mesh(new THREE.TubeGeometry(path, Math.max(32, pts.length*6), 2.6, 8, false), new THREE.MeshBasicMaterial({color:this.colors.now}));
      mesh.renderOrder = 3; mesh.userData.floor = floor; this.dynamic.add(mesh);
    };
    const all:THREE.Vector3[] = [];
    legs.forEach((leg, i) => {
      const pts = leg.points.map(([x, y]) => new THREE.Vector3(px(x), level(leg.floor)+ROOM_H+2, pz(y)));
      tube(pts, leg.floor);
      if (i > 0) tube([all[all.length-1], pts[0]], null);   // up or down the stairwell
      all.push(...pts);
    });
    const path = new THREE.CurvePath<THREE.Vector3>();
    for (let i = 1; i < all.length; i++) if (all[i].distanceTo(all[i-1]) > 0.01) path.add(new THREE.LineCurve3(all[i-1], all[i]));
    if (!path.curves.length) return;
    this.walker = new THREE.Mesh(new THREE.SphereGeometry(5, 16, 12), new THREE.MeshBasicMaterial({color:0xffffff}));
    const ring = new THREE.Mesh(new THREE.SphereGeometry(7, 16, 12), new THREE.MeshBasicMaterial({color:this.colors.now, transparent:true, opacity:.5}));
    this.walker.add(ring); this.walker.userData.walker = true; this.dynamic.add(this.walker); this.walkPath = path;
    this.applyDynamic();
  }

  // Route pieces and highlights follow floor visibility: flat views show one floor only.
  private applyDynamic() {
    for (const o of this.dynamic.children) {
      const f = o.userData.floor as number|null|undefined;
      o.visible = this.mode === '3d' ? (f == null || f <= this.active) : f === this.active;
      if (o.userData.walker) o.visible = this.mode === '3d';
    }
  }

  private pick(e:PointerEvent) {
    const rect = this.renderer.domElement.getBoundingClientRect();
    const ray = new THREE.Raycaster(); ray.setFromCamera(new THREE.Vector2((e.clientX-rect.left)/rect.width*2-1, -(e.clientY-rect.top)/rect.height*2+1), this.camera);
    const hit = ray.intersectObject(this.floors.get(this.active)!.pick)[0];
    if (hit) this.onPick(this.active, hit.point.x+CX, hit.point.z+CZ);
  }

  private resize() {
    const w = this.host.clientWidth, h = this.host.clientHeight; if (!w || !h) return;
    this.renderer.setSize(w, h);
    const ratio = Math.min(devicePixelRatio, 2);
    this.labelCanvas.width = Math.round(w*ratio); this.labelCanvas.height = Math.round(h*ratio); this.labelKey = '';
    this.labelCanvas.style.width = `${w}px`; this.labelCanvas.style.height = `${h}px`;
    this.persp.aspect = w/h; this.persp.updateProjectionMatrix();
    Object.assign(this.ortho, {left:-w/2, right:w/2, top:h/2, bottom:-h/2}); this.ortho.updateProjectionMatrix();
    if (!this.manualView) this.frameFloor();
  }

  private tick() {
    this.controls.update();
    const t = performance.now()/1000;
    if (this.walker && this.walkPath) this.walker.position.copy(this.walkPath.getPointAt((t*0.18)%1));
    for (const o of this.dynamic.children) if (o.userData.pin) o.children[0].position.y = 30 + Math.sin(t*3)*3;
    this.renderer.render(this.scene, this.camera);
    this.drawLabels();
  }

  // Room numbers are printed on the floor of each room, like on the paper plan: along the room's
  // long side, sized to fill it, with a contrasting outline. They lie in the floor plane, so in 3D
  // they turn and tilt with the model. They never get smaller on screen than a readable size.
  // Zoomed out, numbers that would run into each other gather into one capsule with their range
  // («701–711»), like a sign in a corridor; zooming in splits it back into single numbers.
  private labelKey = '';
  private drawLabels() {
    const ctx = this.labelContext, w = this.host.clientWidth, h = this.host.clientHeight;
    const ratio = Math.min(devicePixelRatio, 2);
    // Laid out again only when the view, the marks, the theme or the fonts changed.
    this.camera.updateMatrixWorld();
    const key = [this.mode, this.active, w, h, document.documentElement.dataset.scheme, document.fonts?.status,
      this.marks.map(m => `${m.floor}:${m.x}:${m.y}:${m.tone}`).join(','),
      ...this.camera.projectionMatrix.elements.map(v => v.toFixed(4)), ...this.camera.matrixWorld.elements.map(v => v.toFixed(2))].join('|');
    if (key === this.labelKey) return;
    this.labelKey = key;
    ctx.setTransform(ratio,0,0,ratio,0,0); ctx.clearRect(0,0,w,h);
    if (this.mode === 'pdf') return;
    const f = (FLOORS as FloorData[]).find(q => q.floor === this.active)!;
    const floorY = level(this.active) + 1.4;
    const project = (x:number, z:number) => {
      const p = new THREE.Vector3(px(x), floorY, pz(z)).project(this.camera);
      return {x:(p.x+1)*w/2, y:(1-p.y)*h/2, ok:p.z>-1 && p.z<1};
    };
    const selected = new Set(this.marks.filter(m=>m.floor===this.active).map(m=>`${m.x}:${m.y}`));
    const dark = document.documentElement.dataset.scheme==='dark';
    const ink = dark ? '#ffffff' : '#10131c', soft = dark ? '#d5dcf5' : '#3b4152';
    const halo = dark ? 'rgba(9,13,30,.94)' : 'rgba(255,255,255,.96)';
    const accent = `#${this.colors.now.toString(16).padStart(6,'0')}`;
    const family = getComputedStyle(this.host).fontFamily || 'system-ui, sans-serif';
    const MIN = 11.5, MAX = 30, CHIP = 11.5;
    type P = {x:number; y:number};
    type Rect = {x0:number; y0:number; x1:number; y1:number};
    const rectOf = (pts:P[]):Rect => ({x0:Math.min(...pts.map(p=>p.x)), y0:Math.min(...pts.map(p=>p.y)), x1:Math.max(...pts.map(p=>p.x)), y1:Math.max(...pts.map(p=>p.y))});
    const overlap = (a:Rect, b:Rect) => a.x0 < b.x1+3 && b.x0 < a.x1+3 && a.y0 < b.y1+3 && b.y0 < a.y1+3;
    // Buttons and badges over the map keep their space, so no number hides underneath them.
    const origin = this.host.getBoundingClientRect();
    const blocked:Rect[] = [...this.host.querySelectorAll('.map-zoom, .map-orientation, .scene-hint')].map(el=>el.getBoundingClientRect())
      .map(r=>({x0:r.left-origin.left, y0:r.top-origin.top, x1:r.right-origin.left, y1:r.bottom-origin.top}));
    const free = (r:Rect) => !blocked.some(b => overlap(b, r));
    const labels = [
      // A capital letter suffix: in this font a small «б» is easy to misread as «6» (733б → 7336).
      ...f.rooms.map(r=>({text:r.id.replace(/(\d)([а-я])$/, (_, d:string, l:string)=>d+l.toUpperCase()),x:r.x,y:r.y,box:r.box as Box|undefined,kind:'room',priority:(r.box[2]-r.box[0])*(r.box[3]-r.box[1]),side:sideOf(f, r) as Side|null})),
      ...f.places.filter(p=>p.kind==='wc'||p.kind==='food'||(p.kind==='place'&&p.box)).map(p=>({text:p.kind==='wc'?'WC':p.name.replace(/\s*\(.*\)/,'').replace(/^Столовая /,''),x:p.x,y:p.y,box:p.box,kind:'place',priority:1200,side:null as Side|null})),
      ...f.stairs.map(s=>({text:`Л ${s.id}`,x:s.x,y:s.y,box:s.box,kind:'stair',priority:600,side:null as Side|null})),
    ].map(item=>({...item, important:selected.has(`${item.x}:${item.y}`)}))
      .sort((a,b)=>Number(b.important)-Number(a.important) || b.priority-a.priority);
    ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.lineJoin='round';
    type Item = typeof labels[number];
    type Laid = {item:Item; c:P; rect:Rect; draw:()=>void};
    // Where a label would stand on its own, and how to print it there.
    const lay = (item:Item):Laid|null => {
      const b = item.box ?? [item.x-20, item.y-10, item.x+20, item.y+10];
      const cx = (b[0]+b[2])/2, cz = (b[1]+b[3])/2, c = project(cx, cz);
      if (!c.ok) return null;
      const ex = project(cx+1, cz), ez = project(cx, cz+1);
      const X = {x:ex.x-c.x, y:ex.y-c.y}, Z = {x:ez.x-c.x, y:ez.y-c.y};
      // Text runs along the longer side of the room; narrow rooms get it written upwards.
      const along = (b[2]-b[0]) >= (b[3]-b[1])*.9;
      let B = along ? X : {x:-Z.x, y:-Z.y}, D = along ? Z : X;
      const L = along ? b[2]-b[0] : b[3]-b[1], S = along ? b[3]-b[1] : b[2]-b[0];
      // Keep it readable from any side the camera turns to: never upside down, never mirrored.
      // Left-to-right when the line is closer to horizontal, bottom-to-top when it is closer to vertical.
      if (Math.abs(B.x) > Math.abs(B.y)*.7 ? B.x < 0 : B.y > 0) { B = {x:-B.x, y:-B.y}; D = {x:-D.x, y:-D.y}; }
      if (B.x*D.y - B.y*D.x < 0) D = {x:-D.x, y:-D.y};
      const lb = Math.hypot(B.x, B.y), ld0 = Math.hypot(D.x, D.y);
      if (lb < 1e-4 || ld0 < 1e-4) return null;
      // A very flat view squashes text; stand it up a little so it stays legible.
      const stretch = Math.max(1, .62*lb/ld0), ld = ld0*stretch;
      D = {x:D.x*stretch, y:D.y*stretch};
      const weight = item.important ? '900' : item.kind==='room' ? '800' : '700';
      ctx.font = `${weight} 100px ${family}`;
      const perPx = ctx.measureText(item.text).width/100;            // text width per 1px of font size
      // Size in floor units that fills the room, then clamped to the readable range on screen.
      const fit = Math.min(S*.6, L*.84/perPx) * (item.kind==='room' ? 1 : .8);
      const size = THREE.MathUtils.clamp(fit*ld, MIN, MAX) + (item.important ? 2 : 0) - (item.kind==='stair' ? 1.5 : 0);
      const tw = perPx*size*lb/ld, th = size;                         // on-screen extents along B and D
      const ub = {x:B.x/lb, y:B.y/lb}, ud = {x:D.x/ld, y:D.y/ld};
      const corners = [[-1,-1],[1,-1],[1,1],[-1,1]].map(([i,j])=>({x:c.x+ub.x*tw/2*i+ud.x*th/2*j*1.1, y:c.y+ub.y*tw/2*i+ud.y*th/2*j*1.1}));
      if (corners.every(q=>q.x<0) || corners.every(q=>q.x>w) || corners.every(q=>q.y<0) || corners.every(q=>q.y>h)) return null;
      return {item, c, rect:rectOf(corners), draw:() => {
        // Draw in text space: 1 unit = 1 screen px across the letters, stretched along the baseline by perspective.
        ctx.setTransform(ratio*ub.x*lb/ld, ratio*ub.y*lb/ld, ratio*ud.x, ratio*ud.y, ratio*c.x, ratio*c.y);
        ctx.font = `${weight} ${size}px ${family}`;
        ctx.lineWidth = Math.max(3, size*.3); ctx.strokeStyle = halo;
        ctx.strokeText(item.text, 0, size*.04);
        ctx.fillStyle = item.important ? accent : item.kind==='room' ? ink : soft;
        ctx.fillText(item.text, 0, size*.04);
      }};
    };
    // A capsule with the range of numbers it stands for.
    const chipFont = `750 ${CHIP}px ${family}`;
    // Kept inside the view: a capsule at the edge moves in rather than being cut off.
    const chipRect = (text:string, c:P):Rect => {
      ctx.font = chipFont;
      const bw = ctx.measureText(text).width+16, bh = CHIP+10;
      const x = THREE.MathUtils.clamp(c.x, bw/2+4, Math.max(bw/2+4, w-bw/2-4)), y = THREE.MathUtils.clamp(c.y, bh/2+4, Math.max(bh/2+4, h-bh/2-4));
      return {x0:x-bw/2, y0:y-bh/2, x1:x+bw/2, y1:y+bh/2};
    };
    const drawChip = (text:string, r:Rect) => {
      ctx.setTransform(ratio,0,0,ratio,0,0);
      ctx.beginPath(); ctx.roundRect(r.x0, r.y0, r.x1-r.x0, r.y1-r.y0, (r.y1-r.y0)/2);
      ctx.fillStyle = dark ? 'rgba(20,26,58,.9)' : 'rgba(255,255,255,.95)'; ctx.fill();
      ctx.lineWidth = 1; ctx.strokeStyle = dark ? 'rgba(255,255,255,.2)' : 'rgba(16,19,28,.14)'; ctx.stroke();
      ctx.font = chipFont; ctx.fillStyle = ink; ctx.fillText(text, (r.x0+r.x1)/2, (r.y0+r.y1)/2+.5);
    };

    const laid = labels.map(lay).filter((l):l is Laid => !!l);
    // The chosen rooms are always printed, and nothing covers them.
    const fixed = laid.filter(l => l.item.important);
    const taken:Rect[] = fixed.map(l => l.rect);
    // A capsule stands outside the building on its rooms' side of the corridor: above the upper row,
    // below the lower one, left or right of a wing — so the two sides never run into each other.
    const outside = (members:Laid[], text:string):{rect:Rect; dir:P} => {
      const {nx, nz} = members[0].item.side!, tx = -nz, tz = nx;
      let out = -Infinity, along = 0;
      for (const m of members) {
        const b = m.item.box ?? [m.item.x, m.item.y, m.item.x, m.item.y];
        for (const [x, z] of [[b[0], b[1]], [b[2], b[1]], [b[2], b[3]], [b[0], b[3]]]) out = Math.max(out, x*nx+z*nz);
        along += ((b[0]+b[2])/2)*tx+((b[1]+b[3])/2)*tz;
      }
      along /= members.length;
      const ax = tx*along+nx*out, az = tz*along+nz*out, a = project(ax, az), e = project(ax+nx*20, az+nz*20);
      const len = Math.hypot(e.x-a.x, e.y-a.y) || 1, sx = (e.x-a.x)/len, sy = (e.y-a.y)/len;
      ctx.font = chipFont;
      const off = Math.abs(sx)*(ctx.measureText(text).width+16)/2 + Math.abs(sy)*(CHIP+10)/2 + 5;
      return {rect:chipRect(text, {x:a.x+sx*off, y:a.y+sy*off}), dir:{x:sx, y:sy}};
    };
    type Group = {members:Laid[]; key:string; rect:Rect; text?:string; dir?:P};
    const chip = (members:Laid[]):Group => {
      const text = members.length === 1 ? members[0].item.text : range(members.map(m => m.item.text));
      return {members, key:members[0].item.side!.key, text, ...outside(members, text)};
    };
    // Numbers of one side that would overlap gather into one capsule; the capsule may meet others in turn.
    // Across the corridor nothing is merged: a number inside its room that meets the other side steps out to its own.
    const groups:Group[] = laid.filter(l => !l.item.important && l.item.kind==='room').map(l => ({members:[l], key:l.item.side!.key, rect:l.rect}));
    for (let i = 0; i < groups.length; i++) {
      for (let again = true; again;) {
        again = false;
        for (let k = 0; k < groups.length; k++) {
          const a = groups[i], b = groups[k];
          if (k === i || !overlap(a.rect, b.rect)) continue;
          if (a.key === b.key) { groups[i] = chip([...a.members, ...b.members]); groups.splice(k, 1); if (k < i) i--; }
          else if (!a.text) groups[i] = chip(a.members);
          else if (!b.text) groups[k] = chip(b.members);
          else continue;
          again = true; break;
        }
      }
    }
    // Bigger capsules first. Where two sides meet at a corner, the smaller capsule moves further out
    // from its rooms (or along them) to the first free place instead of disappearing.
    groups.sort((a, b) => Number(!!b.text)-Number(!!a.text) || b.members.length-a.members.length);
    const within = (r:Rect) => r.x0 >= 0 && r.y0 >= 0 && r.x1 <= w && r.y1 <= h;
    const place = () => {
      const used = [...taken], placed:{g:Group; rect:Rect}[] = [], lost:Group[] = [];
      const clear = (r:Rect) => free(r) && !used.some(t => overlap(t, r));
      for (const g of groups) {
        let rect:Rect|undefined = g.rect;
        if (!clear(rect) && g.text && g.dir) {
          const bw = g.rect.x1-g.rect.x0, bh = g.rect.y1-g.rect.y0, n = g.dir, t = {x:-n.y, y:n.x};
          const step = Math.abs(n.x)*(bw+4)+Math.abs(n.y)*(bh+4), side = Math.abs(t.x)*(bw/2+4)+Math.abs(t.y)*(bh/2+4);
          const moves = [[1, 0], [2, 0], [0, 1], [0, -1], [1, 1], [1, -1], [3, 0]].map(([i, j]) => ({x:n.x*step*i+t.x*side*j, y:n.y*step*i+t.y*side*j}));
          rect = moves.map(m => ({x0:g.rect.x0+m.x, y0:g.rect.y0+m.y, x1:g.rect.x1+m.x, y1:g.rect.y1+m.y})).find(r => clear(r) && within(r));
        }
        if (rect && clear(rect)) { used.push(rect); placed.push({g, rect}); } else lost.push(g);
      }
      return {used, placed, lost};
    };
    // A capsule with no free place left joins the nearest capsule of its own side, so its numbers stay on the map.
    let layout = place();
    for (let round = 0; round < 8; round++) {
      const lost = layout.lost.find(g => g.text && layout.placed.some(p => p.g.key === g.key && p.g.text));
      if (!lost) break;
      const mid = (r:Rect) => ({x:(r.x0+r.x1)/2, y:(r.y0+r.y1)/2}), m = mid(lost.rect);
      const near = layout.placed.filter(p => p.g.key === lost.key && p.g.text)
        .sort((p, q) => Math.hypot(mid(p.rect).x-m.x, mid(p.rect).y-m.y)-Math.hypot(mid(q.rect).x-m.x, mid(q.rect).y-m.y))[0].g;
      groups.splice(groups.indexOf(lost), 1); groups.splice(groups.indexOf(near), 1, chip([...near.members, ...lost.members]));
      groups.sort((a, b) => Number(!!b.text)-Number(!!a.text) || b.members.length-a.members.length);
      layout = place();
    }
    taken.splice(0, taken.length, ...layout.used);
    for (const {g, rect} of layout.placed) if (g.text) drawChip(g.text, rect); else g.members[0].draw();
    // Toilets, food and stairs where there is room left.
    for (const l of laid) if (!l.item.important && l.item.kind!=='room' && free(l.rect) && !taken.some(t => overlap(t, l.rect))) { taken.push(l.rect); l.draw(); }
    for (const l of fixed) l.draw();
    ctx.setTransform(ratio,0,0,ratio,0,0);
  }

  retheme() { this.colors=palette(); this.labelKey=''; for(const e of this.floors.values())this.themeModel(e.solid); }

  dispose() {
    this.disposed = true; cancelAnimationFrame(this.frame); this.observer.disconnect(); this.controls.dispose();
    disposeTree(this.scene);
    this.renderer.dispose(); this.renderer.domElement.remove(); this.labelCanvas.remove(); this.modelStatus.remove();
  }
}

function disposeTree(root:THREE.Object3D) {
  root.traverse(o => {
    const m = o as THREE.Mesh; m.geometry?.dispose();
    const materials = Array.isArray(m.material) ? m.material : m.material ? [m.material] : [];
    for (const material of materials) {
      (material as THREE.Material & {map?:THREE.Texture}).map?.dispose(); material.dispose();
    }
  });
}

// Which side of the corridor a room is on: the nearest long run of the corridor and the side of it,
// with the direction pointing from the corridor to the room (in floor coordinates).
type Side = {key:string; nx:number; nz:number};
const sides = new WeakMap<object, Side>();
function sideOf(f:FloorData, room:{x:number; y:number}):Side {
  const known = sides.get(room);
  if (known) return known;
  let best = {d:Infinity, side:{key:'', nx:0, nz:1}};
  f.corridors.forEach((line, li) => line.slice(1).forEach(([bx, by], si) => {
    const [ax, ay] = line[si], dx = bx-ax, dy = by-ay, len = Math.hypot(dx, dy);
    if (len < 150) return;   // short spurs into rooms and stairwells do not count
    const t = THREE.MathUtils.clamp(((room.x-ax)*dx+(room.y-ay)*dy)/(len*len), 0, 1);
    const d = Math.hypot(room.x-ax-dx*t, room.y-ay-dy*t);
    if (d >= best.d) return;
    const s = Math.sign(dx*(room.y-ay)-dy*(room.x-ax)) || 1;
    best = {d, side:{key:`${li}.${si}${s > 0 ? '+' : '-'}`, nx:-dy/len*s, nz:dx/len*s}};
  }));
  sides.set(room, best.side);
  return best.side;
}

// The text of a capsule: runs of numbers that go in a row. Rooms across a corridor are numbered from
// the other end, so 607…619 and 684…696 stay two runs: «607–619 · 684–696». П-3, П-5, МЗ-1 → «П-3–5 · МЗ-1».
// Side rooms numbered differently («64» among 6xx) are left out: they show when zoomed in.
function range(ids:string[]) {
  const parts = new Map<string, {pre:string; nums:number[]}>();
  for (const id of ids) {
    const m = id.match(/^(\D*)(\d+)/);
    if (!m) continue;
    const key = `${m[1]}|${m[2].length}`, part = parts.get(key) ?? {pre:m[1], nums:[]};
    part.nums.push(Number(m[2])); parts.set(key, part);
  }
  const all = [...parts.values()], most = Math.max(...all.map(p => p.nums.length));
  const runs:{pre:string; lo:number; hi:number; n:number}[] = [];
  for (const p of all.filter(p => p.nums.length*3 >= most)) {
    const nums = [...new Set(p.nums)].sort((a, b) => a-b);
    for (const n of nums) {
      const last = runs.at(-1);
      if (last && last.pre === p.pre && n-last.hi <= 3) { last.hi = n; last.n++; } else runs.push({pre:p.pre, lo:n, hi:n, n:1});
    }
  }
  const shown = [...runs].sort((a, b) => b.n-a.n).slice(0, 2).sort((a, b) => runs.indexOf(a)-runs.indexOf(b));
  const text = shown.map(r => r.pre+r.lo+(r.hi > r.lo ? `–${r.hi}` : '')).join(' · ');
  return runs.length > 2 ? `${text} …` : text;
}

function bounds(f:FloorData):Box {
  const xs = f.footprint.flatMap(b => [b[0], b[2]]), ys = f.footprint.flatMap(b => [b[1], b[3]]);
  return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
}

function floorTag(floor:number, x:number, z:number, color:string) {
  const c = document.createElement('canvas'); c.width = 256; c.height = 96;
  const ctx = c.getContext('2d')!; ctx.font = '800 64px system-ui, sans-serif'; ctx.fillStyle = color; ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
  ctx.fillText(`${floor}`, 240, 48);
  const s = new THREE.Sprite(new THREE.SpriteMaterial({map:new THREE.CanvasTexture(c), transparent:true, depthTest:false}));
  s.scale.set(80, 30, 1); s.position.set(x-30, 10, z);
  return s;
}
