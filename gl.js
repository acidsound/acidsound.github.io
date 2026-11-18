export function makeProgram(gl, vertexSource, fragmentSource) {
  const shaders = [];
  const program = gl.createProgram();
  try {
    for (const [type, source] of [[gl.VERTEX_SHADER, vertexSource], [gl.FRAGMENT_SHADER, fragmentSource]]) {
      const shader = gl.createShader(type);
      shaders.push(shader);
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw Error(gl.getShaderInfoLog(shader));
      gl.attachShader(program, shader);
    }
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw Error(gl.getProgramInfoLog(program));
    return program;
  } catch (error) {
    gl.deleteProgram(program);
    throw error;
  } finally {
    for (const shader of shaders) gl.deleteShader(shader);
  }
}

export function buffer(gl, target, data) {
  const handle = gl.createBuffer();
  gl.bindBuffer(target, handle);
  gl.bufferData(target, data, gl.STATIC_DRAW);
  return handle;
}

export function resize(canvas, maxRatio = 1.7) {
  const ratio = Math.min(window.devicePixelRatio || 1, maxRatio);
  const w = Math.max(1, Math.round(canvas.clientWidth * ratio));
  const h = Math.max(1, Math.round(canvas.clientHeight * ratio));
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w;
    canvas.height = h;
    return true;
  }
  return false;
}

export function perspective(fov, aspect, near = .05, far = 90) {
  const f = 1 / Math.tan(fov * .5);
  return new Float32Array([f / aspect,0,0,0, 0,f,0,0, 0,0,(far+near)/(near-far),-1, 0,0,2*far*near/(near-far),0]);
}

export const dot = (a,b) => a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
export const cross = (a,b) => [a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
export function unit(v) {
  const n = Math.hypot(...v) || 1;
  return [v[0]/n,v[1]/n,v[2]/n];
}

export function lookAt(eye, target) {
  const z = unit(eye.map((v,i) => v-target[i]));
  const x = unit(cross([0,1,0],z));
  const y = cross(z,x);
  return new Float32Array([x[0],y[0],z[0],0, x[1],y[1],z[1],0, x[2],y[2],z[2],0, -dot(x,eye),-dot(y,eye),-dot(z,eye),1]);
}

export function motionButton(button, running, name) {
  const label = name + (running ? ' 일시정지' : ' 재생');
  button.setAttribute('aria-label', label);
  button.setAttribute('title', label);
  button.setAttribute('aria-pressed', String(running));
  button.querySelector('use').setAttribute('href', running ? '#i-pause' : '#i-play');
}
