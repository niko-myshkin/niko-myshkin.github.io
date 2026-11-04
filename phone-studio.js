/* ATLAS phone angle studio. Dev-only: case-atlas-pitch.html?studio=1.
   A small self-contained WebGL model keeps the actual app screenshot intact.
   The public page continues to use its saved static image. */
(() => {
  if (!new URLSearchParams(location.search).has('studio')) return;

  const stage = document.querySelector('.case-pitch-explorer-stage');
  const media = stage?.querySelector('.case-pitch-explorer-media');
  const firstShot = media?.querySelector('[data-accordion-media="globe"]');
  if (!stage || !media || !firstShot) return;

  const canvas = document.createElement('canvas');
  canvas.className = 'case-pitch-explorer-shot case-phone-studio-canvas is-current';
  canvas.dataset.accordionMedia = 'globe';
  canvas.width = 1254;
  canvas.height = 1254;
  canvas.setAttribute('role', 'img');
  canvas.setAttribute('aria-label', 'Adjustable 3D phone showing the original ATLAS screenshot');
  firstShot.removeAttribute('data-accordion-media');
  firstShot.style.display = 'none';
  media.append(canvas);

  const tray = document.createElement('div');
  tray.className = 'case-phone-studio';
  tray.innerHTML = `
    <div class="case-phone-studio-intro">
      <p class="case-phone-studio-kicker">ATLAS · angle studio</p>
      <p>Gentle perspective, like the reference. Drag to rotate or adjust its depth.</p>
    </div>
    <div class="case-phone-studio-controls"></div>
    <div class="case-phone-studio-actions">
      <button type="button" data-studio-reset>Reference angle</button>
      <button type="button" data-studio-export>Export PNG</button>
      <button type="button" data-studio-copy>Copy angle link</button>
      <output aria-live="polite" data-studio-status></output>
    </div>`;
  stage.after(tray);

  // A long virtual lens keeps the 3D depth without the previous wide-angle bulge.
  // URL values win, so an angle already chosen in the editor keeps its framing.
  const defaults = { yaw: 19, pitch: -3, roll: -9, zoom: 1.65, x: 0, y: -0.78, light: -0.45, fov: 20 };
  const state = { ...defaults };
  const settings = [
    ['yaw', 'Turn', -60, 60, 1, '°'],
    ['pitch', 'Tilt', -45, 45, 1, '°'],
    ['roll', 'Lean', -30, 30, 1, '°'],
    ['zoom', 'Size', 0.8, 2.2, 0.01, '×'],
    ['x', 'Left / right', -1.2, 1.2, 0.01, ''],
    ['y', 'Up / down', -1.2, 1.2, 0.01, ''],
    ['light', 'Light', -1, 1, 0.01, ''],
    ['fov', 'Perspective', 14, 34, 1, '°'],
  ];
  const query = new URLSearchParams(location.search);
  settings.forEach(([key, , min, max]) => {
    const value = Number(query.get(key));
    if (query.has(key) && Number.isFinite(value)) {
      const clamped = Math.max(min, Math.min(max, value));
      state[key] = key === 'pitch' ? Math.round(clamped) : clamped;
    }
  });
  const controls = tray.querySelector('.case-phone-studio-controls');
  const inputs = new Map();
  const outputs = new Map();
  settings.forEach(([key, label, min, max, step, unit]) => {
    const row = document.createElement('label');
    row.className = 'case-phone-studio-control';
    row.innerHTML = `<span>${label}</span><input type="range" min="${min}" max="${max}" step="${step}" value="${state[key]}" data-studio-key="${key}"><output></output>`;
    controls.append(row);
    const input = row.querySelector('input');
    const output = row.querySelector('output');
    inputs.set(key, input);
    outputs.set(key, { output, unit });
  });

  const status = tray.querySelector('[data-studio-status]');
  const gl = canvas.getContext('webgl2', { alpha: false, antialias: true, preserveDrawingBuffer: true });
  if (!gl) {
    status.textContent = 'This browser cannot open the 3D editor (WebGL 2 is unavailable).';
    return;
  }

  const vertexSource = `#version 300 es
    in vec3 aPosition;
    in vec2 aUV;
    in vec3 aNormal;
    uniform mat4 uMVP;
    uniform mat4 uModel;
    out vec2 vUV;
    out vec3 vNormal;
    void main() {
      vUV = aUV;
      vNormal = mat3(uModel) * aNormal;
      gl_Position = uMVP * vec4(aPosition, 1.0);
    }`;
  const fragmentSource = `#version 300 es
    precision highp float;
    in vec2 vUV;
    in vec3 vNormal;
    uniform sampler2D uScreen;
    uniform vec3 uColor;
    uniform vec3 uLight;
    uniform bool uTextured;
    out vec4 fragColor;
    void main() {
      if (uTextured) {
        vec2 halfSize = vec2(0.465, 1.015);
        float radius = 0.075;
        vec2 p = abs((vUV - 0.5) * (halfSize * 2.0));
        vec2 q = p - (halfSize - radius);
        float edge = length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - radius;
        if (edge > 0.0) discard;
        fragColor = texture(uScreen, vUV);
      } else {
        vec3 n = normalize(vNormal);
        vec3 l = normalize(uLight);
        float diffuse = max(dot(n, l), 0.0);
        float shine = pow(max(dot(reflect(-l, n), vec3(0.0, 0.0, 1.0)), 0.0), 28.0);
        fragColor = vec4(uColor * (0.55 + 0.45 * diffuse) + vec3(0.16 * shine), 1.0);
      }
    }`;
  const compile = (type, source) => {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader));
    return shader;
  };
  let program;
  try {
    program = gl.createProgram();
    gl.attachShader(program, compile(gl.VERTEX_SHADER, vertexSource));
    gl.attachShader(program, compile(gl.FRAGMENT_SHADER, fragmentSource));
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program));
  } catch (error) {
    status.textContent = `Could not start the 3D editor: ${error.message}`;
    return;
  }
  gl.useProgram(program);
  gl.enable(gl.DEPTH_TEST);
  gl.clearColor(0, 0, 0, 1);
  gl.uniform1i(gl.getUniformLocation(program, 'uScreen'), 0);
  const uniforms = {
    mvp: gl.getUniformLocation(program, 'uMVP'),
    model: gl.getUniformLocation(program, 'uModel'),
    color: gl.getUniformLocation(program, 'uColor'),
    light: gl.getUniformLocation(program, 'uLight'),
    textured: gl.getUniformLocation(program, 'uTextured'),
  };
  const attributes = {
    position: gl.getAttribLocation(program, 'aPosition'),
    uv: gl.getAttribLocation(program, 'aUV'),
    normal: gl.getAttribLocation(program, 'aNormal'),
  };

  // Each vertex: position (3), UV (2), normal (3).
  const vertex = (point, uv, normal) => [...point, ...uv, ...normal];
  const triangle = (out, a, b, c, normal) => out.push(
    ...vertex(a, [0, 0], normal), ...vertex(b, [0, 0], normal), ...vertex(c, [0, 0], normal),
  );
  const perimeter = (width, height, radius) => {
    const points = [];
    const corners = [
      [width / 2 - radius, height / 2 - radius, 0],
      [-width / 2 + radius, height / 2 - radius, 90],
      [-width / 2 + radius, -height / 2 + radius, 180],
      [width / 2 - radius, -height / 2 + radius, 270],
    ];
    corners.forEach(([cx, cy, start]) => {
      for (let i = 0; i <= 10; i += 1) {
        const angle = (start + i * 9) * Math.PI / 180;
        points.push([cx + Math.cos(angle) * radius, cy + Math.sin(angle) * radius]);
      }
    });
    return points;
  };
  const outer = perimeter(1.04, 2.2, 0.13);
  const inner = perimeter(0.99, 2.15, 0.11);
  const fan = (loop, z) => {
    const out = [];
    loop.forEach((point, i) => {
      const next = loop[(i + 1) % loop.length];
      triangle(out, [0, 0, z], [...point, z], [...next, z], [0, 0, 1]);
    });
    return out;
  };
  const bridge = (a, za, b, zb) => {
    const out = [];
    a.forEach((point, i) => {
      const next = (i + 1) % a.length;
      const p = point, q = a[next], r = b[i], s = b[next];
      const dx = q[0] - p[0], dy = q[1] - p[1];
      const normal = [dy, -dx, 0];
      triangle(out, [...p, za], [...q, za], [...r, zb], normal);
      triangle(out, [...q, za], [...s, zb], [...r, zb], normal);
    });
    return out;
  };
  const box = (cx, cy, cz, w, h, d) => {
    const out = [];
    const x0 = cx - w / 2, x1 = cx + w / 2;
    const y0 = cy - h / 2, y1 = cy + h / 2;
    const z0 = cz - d / 2, z1 = cz + d / 2;
    const faces = [
      [[x0,y0,z1],[x1,y0,z1],[x1,y1,z1],[x0,y1,z1],[0,0,1]],
      [[x0,y0,z0],[x0,y0,z1],[x0,y1,z1],[x0,y1,z0],[-1,0,0]],
      [[x1,y0,z1],[x1,y0,z0],[x1,y1,z0],[x1,y1,z1],[1,0,0]],
    ];
    faces.forEach(([a,b,c,d,n]) => { triangle(out,a,b,c,n); triangle(out,a,c,d,n); });
    return out;
  };
  const screen = [
    ...vertex([-0.465,-1.015,0.08],[0,0],[0,0,1]),
    ...vertex([ 0.465,-1.015,0.08],[1,0],[0,0,1]),
    ...vertex([ 0.465, 1.015,0.08],[1,1],[0,0,1]),
    ...vertex([-0.465,-1.015,0.08],[0,0],[0,0,1]),
    ...vertex([ 0.465, 1.015,0.08],[1,1],[0,0,1]),
    ...vertex([-0.465, 1.015,0.08],[0,1],[0,0,1]),
  ];
  const makeMesh = (data) => {
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(data), gl.STATIC_DRAW);
    return { buffer, count: data.length / 8 };
  };
  const meshes = {
    body: makeMesh(bridge(outer, 0.02, outer, -0.16)),
    face: makeMesh(fan(outer, 0.021)),
    rim: makeMesh(bridge(outer, 0.023, inner, 0.058)),
    glass: makeMesh(fan(inner, 0.059)),
    buttons: makeMesh([
      ...box(-0.533, 0.43, -0.045, 0.025, 0.16, 0.08),
      ...box(-0.533, 0.08, -0.045, 0.025, 0.22, 0.08),
      ...box(-0.533, -0.25, -0.045, 0.025, 0.22, 0.08),
    ]),
    screen: makeMesh(screen),
  };

  const multiply = (a, b) => {
    const out = new Float32Array(16);
    for (let c = 0; c < 4; c += 1) for (let r = 0; r < 4; r += 1) {
      for (let k = 0; k < 4; k += 1) out[c * 4 + r] += a[k * 4 + r] * b[c * 4 + k];
    }
    return out;
  };
  const identity = () => new Float32Array([1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1]);
  const translate = (x, y, z) => { const m = identity(); m[12]=x; m[13]=y; m[14]=z; return m; };
  const scale = (v) => { const m = identity(); m[0]=v; m[5]=v; m[10]=v; return m; };
  const rx = (a) => new Float32Array([1,0,0,0, 0,Math.cos(a),Math.sin(a),0, 0,-Math.sin(a),Math.cos(a),0, 0,0,0,1]);
  const ry = (a) => new Float32Array([Math.cos(a),0,-Math.sin(a),0, 0,1,0,0, Math.sin(a),0,Math.cos(a),0, 0,0,0,1]);
  const rz = (a) => new Float32Array([Math.cos(a),Math.sin(a),0,0, -Math.sin(a),Math.cos(a),0,0, 0,0,1,0, 0,0,0,1]);
  const perspective = () => {
    const f = 1 / Math.tan(radians(state.fov) / 2), near = 0.1, far = 100;
    return new Float32Array([
      f,0,0,0, 0,f,0,0,
      0,0,(far + near) / (near - far),-1,
      0,0,2 * far * near / (near - far),0,
    ]);
  };
  const radians = (degrees) => degrees * Math.PI / 180;
  const draw = (mesh, color, textured) => {
    gl.bindBuffer(gl.ARRAY_BUFFER, mesh.buffer);
    gl.vertexAttribPointer(attributes.position, 3, gl.FLOAT, false, 32, 0);
    gl.vertexAttribPointer(attributes.uv, 2, gl.FLOAT, false, 32, 12);
    gl.vertexAttribPointer(attributes.normal, 3, gl.FLOAT, false, 32, 20);
    gl.enableVertexAttribArray(attributes.position);
    gl.enableVertexAttribArray(attributes.uv);
    gl.enableVertexAttribArray(attributes.normal);
    gl.uniform3fv(uniforms.color, color);
    gl.uniform1i(uniforms.textured, textured ? 1 : 0);
    gl.drawArrays(gl.TRIANGLES, 0, mesh.count);
  };
  let ready = false;
  const render = () => {
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    // Couple camera distance to FOV: changing perspective does not change the
    // phone's center size, so the control edits depth instead of reframing.
    const cameraDistance = 1.5 / Math.tan(radians(state.fov) / 2);
    const model = [
      translate(state.x, state.y, -cameraDistance),
      rz(radians(state.roll)),
      rx(radians(state.pitch)),
      ry(radians(state.yaw)),
      scale(state.zoom),
    ].reduce(multiply);
    gl.uniformMatrix4fv(uniforms.model, false, model);
    gl.uniformMatrix4fv(uniforms.mvp, false, multiply(perspective(), model));
    gl.uniform3fv(uniforms.light, [state.light, 0.55, 1]);
    draw(meshes.body, [0.22,0.22,0.23], false);
    draw(meshes.face, [0.11,0.11,0.12], false);
    draw(meshes.rim, [0.36,0.36,0.37], false);
    draw(meshes.glass, [0.015,0.015,0.016], false);
    draw(meshes.buttons, [0.25,0.25,0.26], false);
    if (ready) draw(meshes.screen, [1,1,1], true);
  };
  const sync = () => {
    settings.forEach(([key]) => {
      inputs.get(key).value = state[key];
      const { output, unit } = outputs.get(key);
      output.textContent = `${Number(state[key]).toFixed(['yaw','pitch','roll','fov'].includes(key) ? 0 : 2)}${unit}`;
    });
    render();
    const url = new URL(location.href);
    settings.forEach(([key]) => url.searchParams.set(key, key === 'pitch' ? String(state[key]) : Number(state[key]).toFixed(2)));
    history.replaceState(null, '', url);
  };
  controls.addEventListener('input', (event) => {
    const key = event.target.dataset.studioKey;
    if (!key) return;
    state[key] = key === 'pitch' ? Math.round(Number(event.target.value)) : Number(event.target.value);
    sync();
  });
  tray.querySelector('[data-studio-reset]').addEventListener('click', () => {
    Object.assign(state, defaults);
    sync();
    status.textContent = 'Reference angle loaded.';
  });
  tray.querySelector('[data-studio-export]').addEventListener('click', () => {
    render();
    canvas.toBlob((blob) => {
      if (!blob) { status.textContent = 'Export failed. Try again.'; return; }
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'atlas-phone-angle.png';
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      status.textContent = 'PNG exported at 1254 × 1254.';
    }, 'image/png');
  });
  tray.querySelector('[data-studio-copy]').addEventListener('click', () => {
    navigator.clipboard.writeText(location.href)
      .then(() => { status.textContent = 'Angle link copied. Send it to me when you pick a view.'; })
      .catch(() => { status.textContent = 'Clipboard unavailable. Copy the address from the browser.'; });
  });
  let pointer;
  canvas.addEventListener('pointerdown', (event) => {
    pointer = { x: event.clientX, y: event.clientY, yaw: state.yaw, pitch: state.pitch };
    canvas.setPointerCapture(event.pointerId);
  });
  canvas.addEventListener('pointermove', (event) => {
    if (!pointer) return;
    state.yaw = Math.max(-60, Math.min(60, pointer.yaw + (event.clientX - pointer.x) * 0.25));
    state.pitch = Math.round(Math.max(-45, Math.min(45, pointer.pitch - (event.clientY - pointer.y) * 0.25)));
    sync();
  });
  canvas.addEventListener('pointerup', () => { pointer = null; });
  canvas.addEventListener('pointercancel', () => { pointer = null; });

  const screenshot = new Image();
  screenshot.onload = () => {
    const texture = gl.createTexture();
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, screenshot);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.generateMipmap(gl.TEXTURE_2D);
    ready = true;
    status.textContent = 'Ready to adjust and export.';
    render();
  };
  screenshot.onerror = () => { status.textContent = 'Could not load the ATLAS screenshot.'; };
  screenshot.src = 'atlas/phone-studio-screen.png';
  sync();
})();
