import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

// The scene lives on two pages: the lab (tools/atlas-phone-motion.html) and the case.
// The case marks its explorer with data-phone-scene; the lab has only one explorer.
const root = document.querySelector('[data-phone-scene]') ?? document.querySelector('[data-accordion-explorer]');
const canvas = root?.querySelector('.case-pitch-explorer-shot');

if (!root || !canvas) throw new Error('ATLAS phone motion prototype markup is incomplete.');

// Media paths are relative to this file, not to the page, so both pages resolve them alike.
const asset = (path) => new URL(path, import.meta.url).href;

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
const degrees = THREE.MathUtils.degToRad;

// The scene contract stays the same when the procedural shell is replaced by a GLB:
// phoneRoot owns the pose, screenMesh owns the current Atlas texture.
// intro is the resting shot while no pill is open. The three clips are shot in slow motion
// from this very frame (ATLAS shoot-vt.mjs, pitch-* scenes), so leaving rest has no seam.
const SCENES = {
  intro: {
    image: asset('../atlas/phone-home.webp'),
    position: [0, 0, 0],
    rotation: [0, 0, 0],
    scale: 0.65,
    camera: { position: [0, 0, 18.3], target: [0, 0, 0] }
  },
  globe: {
    video: asset('../atlas/phone-globe.mp4'),
    position: [0.02, -0.62, 2.99],
    rotation: [-34.5, 0, 0],
    scale: 0.62,
    camera: { position: [0, 0, 14.1], target: [-0.12, 0, 0] }
  },
  dial: {
    video: asset('../atlas/phone-dial.mp4'),
    position: [0.02, 0.55, -0.89],
    rotation: [-11, 36, 0],
    scale: 0.78,
    camera: { position: [0, 0, 10], target: [0, -0.57, 0] }
  },
  throw: {
    video: asset('../atlas/phone-throw.mp4'),
    position: [1.02, 2.67, 4.04],
    rotation: [-29.5, -23, -9.5],
    scale: 1.28,
    camera: { position: [0, 0, 23.9], target: [0.61, 0, 0] }
  }
};

// data-phone-transparent: the phone stands on the page itself, in either theme, the way the
// hero's phone always did. Without it the lab keeps its black studio.
const transparent = root.hasAttribute('data-phone-transparent');

const renderer = new THREE.WebGLRenderer({
  canvas,
  alpha: transparent,
  antialias: true,
  powerPreference: 'high-performance'
});
renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.1;

const scene = new THREE.Scene();
scene.background = transparent ? null : new THREE.Color(0x050505);

const camera = new THREE.PerspectiveCamera(18, 1, 0.1, 100);
camera.position.set(0, 0, 23);

scene.add(new THREE.HemisphereLight(0xf6f2eb, 0x09090b, 1.55));
const keyLight = new THREE.DirectionalLight(0xffffff, 4.2);
keyLight.position.set(-7, 8, 12);
scene.add(keyLight);
const rimLight = new THREE.DirectionalLight(0x8aa3ff, 3.2);
rimLight.position.set(8, 1, -4);
scene.add(rimLight);

const phoneRoot = new THREE.Group();
scene.add(phoneRoot);

const bodyMaterial = new THREE.MeshPhysicalMaterial({
  color: 0x4b4a47,
  metalness: 0.95,
  roughness: 0.2,
  clearcoat: 0.55,
  clearcoatRoughness: 0.24
});
const edgeMaterial = new THREE.MeshStandardMaterial({ color: 0x050505, metalness: 0.5, roughness: 0.34 });

// RoundedBoxGeometry clamps its radius to half the thinnest side, so a 0.46-thick
// body could never get phone corners. Every outline here is one rounded rectangle
// instead, extruded where it needs depth; nested outlines share their corner centres.
const PHONE = { width: 3.78, height: 8.14, depth: 0.46, radius: 0.62, edge: 0.1 };

const roundedRect = (width, height, radius) => {
  const x = -width / 2;
  const y = -height / 2;
  const shape = new THREE.Shape();
  shape.moveTo(x + radius, y);
  shape.lineTo(x + width - radius, y);
  shape.absarc(x + width - radius, y + radius, radius, -Math.PI / 2, 0);
  shape.lineTo(x + width, y + height - radius);
  shape.absarc(x + width - radius, y + height - radius, radius, 0, Math.PI / 2);
  shape.lineTo(x + radius, y + height);
  shape.absarc(x + radius, y + height - radius, radius, Math.PI / 2, Math.PI);
  shape.lineTo(x, y + radius);
  shape.absarc(x + radius, y + radius, radius, Math.PI, Math.PI * 1.5);
  return shape;
};

// An outline inset by `inset` from the body, corners concentric with the body's.
const insetRect = (inset) => roundedRect(PHONE.width - inset * 2, PHONE.height - inset * 2, PHONE.radius - inset);

// The body: flat sides with a small rounded edge front and back, like a real frame.
const bodyGeometry = new THREE.ExtrudeGeometry(insetRect(PHONE.edge), {
  depth: PHONE.depth - PHONE.edge * 2,
  bevelEnabled: true,
  bevelThickness: PHONE.edge,
  bevelSize: PHONE.edge,
  bevelSegments: 8,
  curveSegments: 32
});
bodyGeometry.translate(0, 0, -(PHONE.depth - PHONE.edge * 2) / 2);
const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
phoneRoot.add(body);

const FRONT = PHONE.depth / 2;

// Black glass over the whole front, a hair inside the metal frame.
const glass = new THREE.Mesh(new THREE.ShapeGeometry(insetRect(0.07), 32), edgeMaterial);
glass.position.z = FRONT + 0.004;
phoneRoot.add(glass);

// Screen recordings are 1124 × 2434. A screen of another shape shows them like
// object-fit: cover — trimmed at the edges, never stretched.
const SCREEN_ASPECT = 1124 / 2434;

const screenGeometry = (width, height, shape) => {
  const fit = width / height / SCREEN_ASPECT;
  const geometry = new THREE.ShapeGeometry(shape, 32);
  const positions = geometry.attributes.position;
  const uvs = geometry.attributes.uv;
  for (let index = 0; index < positions.count; index += 1) {
    const u = (positions.getX(index) + width / 2) / width;
    const v = (positions.getY(index) + height / 2) / height;
    uvs.setXY(index, 0.5 + (u - 0.5) * Math.min(1, fit), 0.5 + (v - 0.5) * Math.min(1, 1 / fit));
  }
  return geometry;
};

const roundedScreenGeometry = (inset) => screenGeometry(PHONE.width - inset * 2, PHONE.height - inset * 2, insetRect(inset));

const screenMaterial = new THREE.MeshBasicMaterial({ color: 0x0a0a0a, toneMapped: false });
const screenMesh = new THREE.Mesh(roundedScreenGeometry(0.13), screenMaterial);
screenMesh.position.z = FRONT + 0.008;
phoneRoot.add(screenMesh);

// The outgoing screen, laid a hair over screenMesh and faded out while the new one
// shows underneath. Shares screenMesh's outline.
const fadeMaterial = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false, toneMapped: false });
const fadeMesh = new THREE.Mesh(screenMesh.geometry, fadeMaterial);
fadeMesh.visible = false;
fadeMesh.renderOrder = 1;
phoneRoot.add(fadeMesh);

const islandMaterial = new THREE.MeshBasicMaterial({ color: 0x000000, toneMapped: false });
const island = new THREE.Mesh(new THREE.ShapeGeometry(roundedRect(1.08, 0.3, 0.15), 16), islandMaterial);
island.position.set(0, 3.5, FRONT + 0.012);
phoneRoot.add(island);

// Island and buttons: the parts that make the slab read as one particular phone.
const hardware = [island];

// Buttons sit on the flat part of the side and stand proud of it by a hair.
const buttonMaterial = new THREE.MeshStandardMaterial({ color: 0x3d3c39, metalness: 0.95, roughness: 0.2 });
const addButton = (side, y, height) => {
  const button = new THREE.Mesh(new RoundedBoxGeometry(0.1, height, 0.16, 4, 0.04), buttonMaterial);
  button.position.set(side * (PHONE.width / 2), y, 0);
  phoneRoot.add(button);
  hardware.push(button);
};
addButton(-1, 2.25, 0.48);
addButton(-1, 1.45, 0.82);
addButton(-1, 0.45, 0.82);
addButton(1, 1.2, 1.25);

// A design-system colour as { color, alpha }. Tokens can be color-mix() with
// transparency, so the browser resolves them and a 1px canvas reads the result.
const tokenColor = (token) => {
  const probe = document.createElement('i');
  probe.style.color = `var(${token})`;
  // Inside the scene: the section is a dark island, so its tokens, not the page theme.
  root.append(probe);
  const css = getComputedStyle(probe).color;
  probe.remove();
  const context = document.createElement('canvas').getContext('2d');
  context.fillStyle = css;
  context.fillRect(0, 0, 1, 1);
  const [r, g, b, a] = context.getImageData(0, 0, 1, 1).data;
  return { color: new THREE.Color().setRGB(r / 255, g / 255, b / 255, THREE.SRGBColorSpace), alpha: a / 255 };
};

// Abstract shell, after .ds-phone on the home page: a subtle graphite slab.
// Sizes are .ds-phone's CSS pixels — screen 375 × 812, the
// same shape as the recordings, so nothing is trimmed.
const U = PHONE.width / 391;
const SLAB = { width: 391 * U, height: 828 * U, radius: 56 * U, depth: 0.36 };
const SLAB_SCREEN = { width: 375 * U, height: 812 * U, radius: 49 * U };

const abstractShell = new THREE.Group();
phoneRoot.add(abstractShell);

const slabGeometry = new THREE.ExtrudeGeometry(roundedRect(SLAB.width, SLAB.height, SLAB.radius), {
  depth: SLAB.depth,
  bevelEnabled: false,
  curveSegments: 32
});
slabGeometry.translate(0, 0, -SLAB.depth / 2);
const shellColor = tokenColor('--color-device-shell');
abstractShell.add(new THREE.Mesh(slabGeometry, new THREE.MeshBasicMaterial({ color: shellColor.color })));

// Two looks of the same object, compared with ?device=abstract or the tuner.
const phoneShell = [body, glass, ...hardware];
const DEVICES = {
  phone: { screen: () => roundedScreenGeometry(0.13), screenZ: FRONT + 0.008 },
  abstract: {
    screen: () => screenGeometry(SLAB_SCREEN.width, SLAB_SCREEN.height, roundedRect(SLAB_SCREEN.width, SLAB_SCREEN.height, SLAB_SCREEN.radius)),
    screenZ: SLAB.depth / 2 + 0.004
  }
};

function setDevice(kind) {
  const abstract = kind === 'abstract';
  phoneShell.forEach((part) => { part.visible = !abstract; });
  abstractShell.visible = abstract;
  const device = DEVICES[abstract ? 'abstract' : 'phone'];
  screenMesh.geometry.dispose();
  screenMesh.geometry = device.screen();
  screenMesh.position.z = device.screenZ;
  fadeMesh.geometry = screenMesh.geometry;
  fadeMesh.position.z = device.screenZ + 0.002;
}

const params = new URLSearchParams(location.search);
// ?screen=live puts the real ATLAS app on the screen instead of the recordings — for tuning
// motion in place. WebGL cannot draw a page, so the app is an iframe set into the same 3D
// pose, one layer above the canvas. Abstract shell only: its screen has no glass to
// reflect, so nothing is lost by the screen being HTML.
// ⚠️ Not CSS3DRenderer: it nests the element in preserve-3d, and Chrome then drops the
// app's backdrop-filter — the glass headers of its sheets turn see-through. Here the whole
// pose is one matrix3d on one element under a plain perspective, no 3D context at all.
// The case sets the mode on the section (data-phone-screen="live", data-phone-film);
// the lab keeps its address flags.
const live = root.dataset.phoneScreen === 'live' || params.get('screen') === 'live';
const film = root.hasAttribute('data-phone-film') || params.has('film');
let deviceKind = live || params.get('device') === 'abstract' ? 'abstract' : 'phone';
setDevice(deviceKind);

const LIVE = { width: 375, height: 812 };
let liveView = null;
let liveBox = null;
let liveAnchor = null;
let liveFrame = null;
let liveLoaded = false;
if (live) {
  const frame = document.createElement('iframe');
  liveFrame = frame;
  // Loaded only as the section comes near the screen: the case already runs one ATLAS
  // in its hero, and two at once from the first second is heavy on a phone.
  const src = asset(`../atlas-app/index.html${film ? '?film' : ''}`);
  if ('IntersectionObserver' in window) {
    const near = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return;
      near.disconnect();
      frame.src = src;
    }, { rootMargin: '200px 0px' });
    near.observe(root);
  } else {
    frame.src = src;
  }
  frame.title = 'ATLAS';
  if (root.hasAttribute('data-phone-demo')) {
    frame.inert = true;
    frame.tabIndex = -1;
    frame.setAttribute('aria-hidden', 'true');
  }
  // ⚠️ A 3D-transformed box does not clip an iframe to its border-radius in Chrome — the
  // app's full-bleed sheets stuck out square past the corners. The frame rounds itself,
  // and clip-path clips the box once more.
  Object.assign(frame.style, { width: '100%', height: '100%', border: '0', display: 'block', borderRadius: '49px' });
  liveBox = document.createElement('div');
  Object.assign(liveBox.style, {
    position: 'absolute',
    left: '0',
    top: '0',
    width: `${LIVE.width}px`,
    height: `${LIVE.height}px`,
    borderRadius: '49px',
    overflow: 'hidden',
    clipPath: 'inset(0 round 49px)',
    background: 'var(--color-device-bezel)',
    transformOrigin: '0 0',
    backfaceVisibility: 'hidden',
    pointerEvents: root.hasAttribute('data-phone-demo') ? 'none' : 'auto'
  });
  liveBox.append(frame);
  // ⚠️ The app's glass layers are backdrop-filter, and in a 3D-transformed iframe Chrome
  // draws their blur past every clip — ancestors', clip-path, even over siblings: square
  // corners stuck out on top. The one clip a backdrop respects is its own element's
  // border-radius, so the app's glass layers — sheet panels, the track sheet, the bottom blur strip — get
  // the screen's corners.
  frame.addEventListener('load', () => {
    liveLoaded = true;
    // Observe the untransformed canvas: intersection inside a tilted iframe can be wrong.
    if (root.hasAttribute('data-phone-demo') && 'IntersectionObserver' in window) {
      new IntersectionObserver(([entry]) => {
        frame.contentWindow.__setAtlasViewportActive?.(entry.isIntersecting);
      }).observe(canvas);
    }
    const style = frame.contentDocument.createElement('style');
    style.textContent = '.panel, #nowsheet { border-radius: 49px; }'
      + ' .pblur i { border-bottom-left-radius: 49px; border-bottom-right-radius: 49px; }';
    frame.contentDocument.head.append(style);
    // data-phone-wheel: the phone is half the screen, and a wheel over it went into the app —
    // the page stopped scrolling. The app has no wheel control of its own, so the wheel goes
    // back to the page, unless it is over a list inside the app that can still scroll that way.
    if (root.hasAttribute('data-phone-wheel')) frame.contentWindow.addEventListener('wheel', (event) => {
      if (event.ctrlKey) return;
      for (let node = event.target; node && node.nodeType === 1; node = node.parentElement) {
        const overflow = frame.contentWindow.getComputedStyle(node).overflowY;
        if (!/(auto|scroll)/.test(overflow) || node.scrollHeight <= node.clientHeight) continue;
        const room = event.deltaY < 0 ? node.scrollTop > 0 : node.scrollTop + node.clientHeight < node.scrollHeight;
        if (room) return;
      }
      event.preventDefault();
      // Through the site's own smooth wheel (script.js) when it runs; otherwise straight.
      const relay = new WheelEvent('wheel', { deltaX: event.deltaX, deltaY: event.deltaY, deltaMode: event.deltaMode, cancelable: true });
      if (window.dispatchEvent(relay)) {
        const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? window.innerHeight : 1;
        window.scrollBy(0, event.deltaY * unit);
      }
    }, { passive: false });
  });
  liveView = document.createElement('div');
  Object.assign(liveView.style, { position: 'absolute', inset: '0', overflow: 'hidden', pointerEvents: 'none' });
  liveView.append(liveBox);
  canvas.after(liveView);

  // The screen's place on the phone, one CSS pixel = U world units.
  liveAnchor = new THREE.Object3D();
  liveAnchor.scale.setScalar(U);
  liveAnchor.position.z = SLAB.depth / 2 + 0.004;
  phoneRoot.add(liveAnchor);
  screenMesh.visible = false;
}

// CSS pixel of the element → world → camera → CSS perspective. CSS y runs down, three's
// up, hence the flips. Camera space is measured in pixels at k px per unit, with
// k = focal / distance: the screen then sits on the perspective plane at about its own
// size. ⚠️ Without k the screen was ~1% big and blown up ~60× by perspective, and
// Chrome's pixel snapping before the blow-up shifted it off the body by 10–20 px.
const flipY = new THREE.Matrix4().makeScale(1, -1, 1);
const liveMatrix = new THREE.Matrix4();
const liveScale = new THREE.Matrix4();
const liveCenter = new THREE.Matrix4().makeTranslation(-LIVE.width / 2, -LIVE.height / 2, 0);
const livePoint = new THREE.Vector3();
const frameCenter = { x: 0, y: 0 };
function renderLive() {
  const height = canvas.clientHeight;
  const focal = (height / 2) / Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
  const distance = Math.max(0.001, -livePoint.setFromMatrixPosition(liveAnchor.matrixWorld).applyMatrix4(camera.matrixWorldInverse).z);
  const k = focal / distance;
  // The vanishing point follows the frame centre, which the slot may have moved off the canvas centre.
  liveView.style.perspective = `${focal}px`;
  liveView.style.perspectiveOrigin = `${frameCenter.x}px ${frameCenter.y}px`;
  liveMatrix.makeTranslation(frameCenter.x, frameCenter.y, focal)
    .multiply(liveScale.makeScale(k, k, k))
    .multiply(flipY)
    .multiply(camera.matrixWorldInverse)
    .multiply(liveAnchor.matrixWorld)
    .multiply(flipY)
    .multiply(liveCenter);
  liveBox.style.transform = `matrix3d(${liveMatrix.elements.join(',')})`;
}

const videos = new Map();
const textures = new Map();
const videoByTexture = new Map();

const imageLoader = new THREE.TextureLoader();

// The live case uses an iframe for its screen. Its old screen recordings are lab-only;
// loading them here costs three video decoders without drawing a single frame.
if (!live) Object.entries(SCENES).forEach(([id, config]) => {
  if (config.image) {
    const texture = imageLoader.load(config.image, requestRender);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.generateMipmaps = false;
    textures.set(id, texture);
    return;
  }

  const video = document.createElement('video');
  video.src = config.video;
  video.preload = 'auto';
  video.muted = true;
  video.playsInline = true;
  video.disablePictureInPicture = true;
  video.setAttribute('aria-hidden', 'true');
  video.load();

  const texture = new THREE.VideoTexture(video);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = false;

  video.addEventListener('loadeddata', requestRender);
  video.addEventListener('seeked', requestRender);
  video.addEventListener('ended', requestRender);
  videos.set(id, video);
  textures.set(id, texture);
  videoByTexture.set(texture, video);
});

// The explorer reports "nothing open" as an empty data-current.
const sceneFor = (current) => current || 'intro';
let selectedId = sceneFor(root.dataset.current);
let transition = null;
let transitionToken = 0;
let rafId = 0;
let visible = !document.hidden;
const cameraTarget = new THREE.Vector3();

// --phone-scene-scale: one size knob for a page, on top of the tuned poses (the case sets
// it from a design token; the lab has none, so 1).
const sceneScale = () => parseFloat(getComputedStyle(root).getPropertyValue('--phone-scene-scale')) || 1;
const mobileFraming = window.matchMedia('(max-width: 780px)');

const toPose = (config) => {
  const fitMobile = root.hasAttribute('data-phone-fit-mobile') && mobileFraming.matches;
  if (fitMobile) {
    config = { ...SCENES.intro, rotation: config.rotation };
  }
  const pose = {
  position: new THREE.Vector3(...config.position),
  quaternion: new THREE.Quaternion().setFromEuler(new THREE.Euler(...config.rotation.map(degrees))),
  scale: config.scale * sceneScale(),
  cameraPosition: new THREE.Vector3(...config.camera.position),
  cameraTarget: new THREE.Vector3(...config.camera.target)
  };
  if (fitMobile) {
    const width = canvas.clientWidth, height = canvas.clientHeight;
    const inset = parseFloat(getComputedStyle(root).getPropertyValue('--case-explorer-mobile-phone-inset')) || 0;
    const fitCamera = new THREE.PerspectiveCamera(camera.fov, width / height, camera.near, camera.far);
    fitCamera.position.copy(pose.cameraPosition);
    fitCamera.lookAt(pose.cameraTarget);
    fitCamera.updateMatrixWorld();
    // Perspective makes tilted corners grow unevenly; cap enlargement to the actual frame.
    for (let pass = 0; pass < 3; pass += 1) {
      let extentX = 0, extentY = 0;
      for (const x of [-SLAB.width / 2, SLAB.width / 2])
        for (const y of [-SLAB.height / 2, SLAB.height / 2])
          for (const z of [-SLAB.depth / 2, SLAB.depth / 2]) {
            const point = new THREE.Vector3(x, y, z).multiplyScalar(pose.scale)
              .applyQuaternion(pose.quaternion).add(pose.position).project(fitCamera);
            extentX = Math.max(extentX, Math.abs(point.x));
            extentY = Math.max(extentY, Math.abs(point.y));
          }
      pose.scale *= Math.min(1, (1 - 2 * inset / width) / extentX, (1 - 2 * inset / height) / extentY);
    }
  }
  return pose;
};

const applyPose = (pose) => {
  phoneRoot.position.copy(pose.position);
  phoneRoot.quaternion.copy(pose.quaternion);
  phoneRoot.scale.setScalar(pose.scale);
  camera.position.copy(pose.cameraPosition);
  cameraTarget.copy(pose.cameraTarget);
  camera.lookAt(cameraTarget);
};

const currentPose = () => ({
  position: phoneRoot.position.clone(),
  quaternion: phoneRoot.quaternion.clone(),
  scale: phoneRoot.scale.x,
  cameraPosition: camera.position.clone(),
  cameraTarget: cameraTarget.clone()
});

const render = () => {
  renderer.render(scene, camera);
  if (live) renderLive();
};
const anyVideoPlaying = () => [...videos.values()].some((video) => !video.paused && !video.ended);

function requestRender() {
  if (!visible || rafId) return;
  rafId = requestAnimationFrame(tick);
}

// Ease in and out: the phone leaves rest and arrives at rest, so a move never starts
// with a kick (easeOut did — full speed on the first frame).
const easeInOutCubic = (value) => (value < 0.5 ? 4 * value ** 3 : 1 - (-2 * value + 2) ** 3 / 2);

const token = (name, fallback) => {
  if (reducedMotion.matches) return 0;
  return parseFloat(getComputedStyle(root).getPropertyValue(name)) || fallback;
};

let fade = null;

function tick(now) {
  rafId = 0;
  if (!visible) return;

  if (transition) {
    const elapsed = now - transition.startedAt;
    const raw = Math.min(1, elapsed / transition.duration);
    const progress = easeInOutCubic(raw);
    phoneRoot.position.lerpVectors(transition.from.position, transition.to.position, progress);
    phoneRoot.quaternion.slerpQuaternions(transition.from.quaternion, transition.to.quaternion, progress);
    phoneRoot.scale.setScalar(THREE.MathUtils.lerp(transition.from.scale, transition.to.scale, progress));
    camera.position.lerpVectors(transition.from.cameraPosition, transition.to.cameraPosition, progress);
    cameraTarget.lerpVectors(transition.from.cameraTarget, transition.to.cameraTarget, progress);
    camera.lookAt(cameraTarget);

    // The gesture starts while the camera is still settling.
    if (!transition.played && elapsed >= transition.gestureDelay && transition.token === transitionToken) {
      transition.played = true;
      playScene(transition.id);
    }
    if (raw === 1) transition = null;
  }

  if (fade) {
    const raw = Math.min(1, (now - fade.startedAt) / fade.duration);
    fadeMaterial.opacity = 1 - easeInOutCubic(raw);
    if (raw === 1) endFade();
  }

  render();
  if (transition || fade || anyVideoPlaying()) requestRender();
}

const useTexture = (id) => {
  screenMaterial.map = textures.get(id);
  screenMaterial.color.set(0xffffff);
  screenMaterial.needsUpdate = true;
  requestRender();
};

// Pause everything except the clip still dissolving out, which keeps moving to the end of the fade.
const pauseVideos = () => videos.forEach((video) => {
  if (fade?.video !== video) video.pause();
});

function endFade() {
  if (!fade) return;
  if (fade.video && fade.video !== videos.get(selectedId)) fade.video.pause();
  fade = null;
  fadeMesh.visible = false;
}

// Lay the current screen over the new one and dissolve it away.
const startFade = () => {
  const map = screenMaterial.map;
  endFade();
  const duration = token('--duration-screen-crossfade', 360);
  if (!map || !duration) return;
  fadeMaterial.map = map;
  fadeMaterial.opacity = 1;
  fadeMaterial.needsUpdate = true;
  fadeMesh.visible = true;
  fade = { startedAt: performance.now(), duration, video: videoByTexture.get(map) };
};

const seekToStill = (id) => {
  if (live) return;
  const video = videos.get(id);
  useTexture(id);
  if (!video) return;
  const seek = () => {
    if (!Number.isFinite(video.duration)) return;
    video.currentTime = Math.max(0, video.duration - 0.05);
  };
  if (video.readyState >= HTMLMediaElement.HAVE_METADATA) seek();
  else video.addEventListener('loadedmetadata', seek, { once: true });
};

// Show a clip's first frame without playing it — the screen the camera moves towards.
const cueScene = (id) => {
  const video = videos.get(id);
  if (video) {
    video.pause();
    video.currentTime = 0;
  }
  useTexture(id);
};

function playScene(id) {
  if (live) return;
  const video = videos.get(id);
  pauseVideos();
  useTexture(id);
  if (!video) return;
  if (reducedMotion.matches || !visible) {
    seekToStill(id);
    return;
  }
  if (!video.paused) video.pause();
  video.currentTime = 0;
  video.play().then(requestRender).catch(() => requestRender());
}

const selectScene = (id, { initial = false } = {}) => {
  const config = SCENES[id];
  if (!config) return;
  selectedId = id;
  transitionToken += 1;

  const target = toPose(config);
  const duration = initial ? 0 : token('--duration-camera', 1200);
  if (!duration) {
    endFade();
    transition = null;
    applyPose(target);
    if (reducedMotion.matches) seekToStill(id);
    else playScene(id);
    requestRender();
    return;
  }

  startFade();
  pauseVideos();
  cueScene(id);
  transition = {
    id,
    token: transitionToken,
    startedAt: performance.now(),
    duration,
    gestureDelay: Math.min(duration, token('--duration-gesture-delay', 840)),
    played: false,
    from: currentPose(),
    to: target
  };
  requestRender();
};

const replaySelected = () => playScene(selectedId);

const observer = new MutationObserver((records) => {
  if (records.some((record) => record.attributeName === 'data-current')) selectScene(sceneFor(root.dataset.current));
});
observer.observe(root, { attributes: true, attributeFilter: ['data-current'] });

/* ?film: the three case-study cards drive the real controls in the embedded ATLAS
   app. The scene still changes through data-current; this bridge adds the action. */
const filmActionFor = { globe: 'spinPlanet', dial: 'spinDecades', throw: 'throwPlaceEra' };
let filmActionTimer = 0;
const runFilmAction = (id, delay) => {
  clearTimeout(filmActionTimer);
  const action = filmActionFor[id];
  if (!film || !liveFrame || !action) return;
  filmActionTimer = window.setTimeout(() => liveFrame.contentWindow.__filmActions?.[action]?.(), delay);
};
// Every selection path (pill, arrow, swipe or scroll) drives the same gesture.
new MutationObserver(() => {
  const autoplay = root.hasAttribute('data-phone-autoplay');
  if (autoplay && reducedMotion.matches) return;
  runFilmAction(root.dataset.current, autoplay
    ? token('--duration-gesture-delay', 840)
    : token('--duration-card-text-delay', 250));
}).observe(root, { attributes: true, attributeFilter: ['data-current'] });
liveFrame?.addEventListener('load', () => runFilmAction(root.dataset.current, 0));

// data-phone-slot: the canvas is a wide layer (so a close-up is never cut at a column edge),
// but the phone is framed on the slot — an empty box in the layout. The camera's centre of
// projection is moved onto the slot's centre with setViewOffset; poses stay as tuned.
const slot = root.dataset.phoneSlot ? document.querySelector(root.dataset.phoneSlot) : null;
const resize = () => {
  const width = Math.max(1, canvas.clientWidth);
  const height = Math.max(1, canvas.clientHeight);
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  renderer.setSize(width, height, false);
  camera.aspect = width / height;
  frameCenter.x = width / 2;
  frameCenter.y = height / 2;
  if (slot) {
    const layer = canvas.getBoundingClientRect();
    const box = slot.getBoundingClientRect();
    frameCenter.x = box.left - layer.left + box.width / 2;
    frameCenter.y = box.top - layer.top + box.height / 2;
    camera.setViewOffset(width, height, width / 2 - frameCenter.x, height / 2 - frameCenter.y, width, height);
    root.style.setProperty('--phone-slot-left', `${Math.round(box.left - layer.left)}px`);
  }
  camera.updateProjectionMatrix();
  if (root.hasAttribute('data-phone-fit-mobile') && mobileFraming.matches) {
    transition = null;
    applyPose(toPose(SCENES[selectedId]));
  }
  requestRender();
};

const resizeObserver = new ResizeObserver(resize);
resizeObserver.observe(canvas);
if (slot) resizeObserver.observe(slot);
mobileFraming.addEventListener('change', () => {
  transition = null;
  applyPose(toPose(SCENES[selectedId]));
  requestRender();
});

document.addEventListener('visibilitychange', () => {
  visible = !document.hidden;
  if (!visible) {
    pauseVideos();
    if (rafId) cancelAnimationFrame(rafId);
    rafId = 0;
    return;
  }
  if (reducedMotion.matches) seekToStill(selectedId);
  else playScene(selectedId);
  requestRender();
});

reducedMotion.addEventListener('change', () => {
  transitionToken += 1;
  transition = null;
  applyPose(toPose(SCENES[selectedId]));
  if (reducedMotion.matches) {
    pauseVideos();
    seekToStill(selectedId);
  } else {
    playScene(selectedId);
  }
  requestRender();
});

applyPose(toPose(SCENES[selectedId]));
resize();
if (reducedMotion.matches) seekToStill(selectedId);
else playScene(selectedId);

// ?tune opens the pose sliders. A slider snaps the phone straight to the edited pose.
if (new URLSearchParams(location.search).has('tune')) {
  root.addEventListener('phone-tuner-replay', replaySelected);
  const openTuner = () => import('./atlas-phone-motion-tuner.js?v=20260924-film').then(({ setupTuner }) => setupTuner({
    scenes: SCENES,
      sceneFor,
      device: deviceKind,
      filmGlobe: film && liveFrame ? liveFrame.contentWindow.__ATLAS_FILM_GLOBE : null,
      getFov: () => camera.fov,
      setFov: (fov) => {
        camera.fov = fov;
        camera.updateProjectionMatrix();
        requestRender();
      },
    setDevice: (kind) => {
      deviceKind = kind;
      setDevice(kind);
      requestRender();
    },
    root,
    preview: (id) => {
      if (id !== selectedId) return;
      transitionToken += 1;
      transition = null;
      applyPose(toPose(SCENES[id]));
      requestRender();
    }
  }));
  if (film && liveFrame && !liveLoaded) liveFrame.addEventListener('load', openTuner, { once: true });
  else openTuner();
}
