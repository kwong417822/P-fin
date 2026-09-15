const DEFAULTS = {
    amplitude: 0.5,
    speed: 0.65,
    wavelength: 80,
    rings: 2,
    decay: 1,
    refraction: 100,
    dispersion: 0.5,
    shine: 0.5,
    trigger: "click",
    interval: 0
};
const MAX_RIPPLES = 12;
const BASE_SPEED = 340;
const VERT = `#version 300 es
precision highp float;
layout(location = 0) in vec2 aPos;
out vec2 vUv;
void main () {
  vUv = aPos * 0.5 + 0.5;
  gl_Position = vec4(aPos, 0.0, 1.0);
}`;
const FRAG = `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 outColor;
uniform sampler2D uContent;
uniform vec2 uResolution;
uniform vec4 uRipples[12];
uniform int uCount;
uniform float uSpeed;
uniform float uWavelength;
uniform float uWidth;
uniform float uDecay;
uniform float uRefraction;
uniform float uDispersion;
uniform float uShine;
uniform float uHasContent;
uniform float uMaxX;

vec4 page (vec2 p) {
  p.x = clamp(p.x, 0.0005, uMaxX - 0.0005);
  p.y = clamp(p.y, 0.0005, 0.9995);
  return texture(uContent, p);
}

void main () {
  vec2 pUv = vec2(vUv.x, 1.0 - vUv.y);
  vec2 frag = pUv * uResolution;

  vec2 grad = vec2(0.0);
  float k = 6.28318530718 / uWavelength;
  float w2 = uWidth * uWidth;

  for (int i = 0; i < 12; i++) {
    if (i >= uCount) break;
    vec4 rp = uRipples[i];
    vec2 dv = frag - rp.xy;
    float r = length(dv);
    float front = uSpeed * rp.z;
    float s = r - front;
    float env = exp(-s * s / w2) * exp(-uDecay * rp.z) * rp.w;
    env *= smoothstep(0.0, 0.08, rp.z);
    env *= inversesqrt(1.0 + front / max(uWavelength, 1.0) * 0.2);
    if (env < 0.0015) continue;
    float dh = (k * cos(s * k) - 2.0 * s / w2 * sin(s * k)) * env;
    grad += dv / max(r, 1.0) * dh * uWavelength * 0.16;
  }

  float g = dot(grad, vec2(-0.55, -0.8));
  float glint = pow(clamp(g * 2.2, 0.0, 1.0), 2.0) * uShine;
  float shade = pow(clamp(-g * 1.6, 0.0, 1.0), 2.0) * uShine * 0.3;

  if (uHasContent < 0.5) {
    float a = clamp(glint * 0.9 + shade * 0.5, 0.0, 0.85);
    outColor = vec4(vec3(glint * 0.9), a);
    return;
  }

  vec2 offs = grad * uRefraction / uResolution;
  vec3 col;
  if (uDispersion > 0.001) {
    float d = uDispersion * 0.35;
    col = vec3(
      page(pUv + offs * (1.0 + d)).r,
      page(pUv + offs).g,
      page(pUv + offs * (1.0 - d)).b
    );
  } else {
    col = page(pUv + offs).rgb;
  }
  col += glint;
  col *= 1.0 - shade;
  outColor = vec4(col, 1.0);
}`;
export function supportsHtmlInCanvas() {
    if (typeof document === "undefined") return false;
    const probe = document.createElement("canvas");
    const ctx = probe.getContext("2d");
    return Boolean(ctx && typeof ctx.drawElementImage === "function" && typeof probe.requestPaint === "function");
}
export function createRipple(elements, options = {}) {
    const config = {
        ...DEFAULTS,
        ...options
    };
    const { source, content, output } = elements;
    const gl = output.getContext("webgl2", {
        alpha: true,
        depth: false,
        stencil: false,
        antialias: false,
        premultipliedAlpha: true
    });
    if (!gl || gl.isContextLost()) return null;
    const sourceCtx = source.getContext("2d");
    const paintable = source;
    const htmlInCanvas = Boolean(sourceCtx && typeof sourceCtx.drawElementImage === "function" && typeof paintable.requestPaint === "function");
    let contentDirty = false;
    let wake = ()=>{};
    if (htmlInCanvas) {
        paintable.onpaint = ()=>{
            try {
                sourceCtx.reset();
                sourceCtx.drawElementImage(content, 0, 0);
                contentDirty = true;
                wake();
            } catch  {}
        };
    }
    function compile(type, text) {
        const shader = gl.createShader(type);
        gl.shaderSource(shader, text);
        gl.compileShader(shader);
        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
            console.error("Ripple shader error:", gl.getShaderInfoLog(shader));
        }
        return shader;
    }
    const vertexShader = compile(gl.VERTEX_SHADER, VERT);
    const fragmentShader = compile(gl.FRAGMENT_SHADER, FRAG);
    const program = gl.createProgram();
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);
    const uniforms = {};
    const count = gl.getProgramParameter(program, gl.ACTIVE_UNIFORMS);
    for(let i = 0; i < count; i++){
        const info = gl.getActiveUniform(program, i);
        uniforms[info.name.replace("[0]", "")] = gl.getUniformLocation(program, info.name);
    }
    const quad = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, quad);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
        -1,
        -1,
        1,
        -1,
        -1,
        1,
        1,
        1
    ]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    const contentTexture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, contentTexture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([
        0,
        0,
        0,
        0
    ]));
    let contentMaxX = 1;
    function syncCanvasSize() {
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        const width = Math.max(1, Math.round(output.clientWidth * dpr));
        const height = Math.max(1, Math.round(output.clientHeight * dpr));
        if (output.width !== width || output.height !== height) {
            output.width = width;
            output.height = height;
        }
        contentMaxX = Math.min(1, Math.max(0.05, content.clientWidth / Math.max(output.clientWidth, 1)));
        if (htmlInCanvas) {
            const cssWidth = Math.max(1, Math.round(source.clientWidth));
            const cssHeight = Math.max(1, Math.round(source.clientHeight));
            if (source.width !== cssWidth * dpr || source.height !== cssHeight * dpr) {
                source.width = cssWidth * dpr;
                source.height = cssHeight * dpr;
            }
            paintable.requestPaint();
        }
    }
    syncCanvasSize();
    function uploadContent() {
        if (!htmlInCanvas || !contentDirty) return;
        contentDirty = false;
        gl.bindTexture(gl.TEXTURE_2D, contentTexture);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
    }
    const ripples = [];
    const rippleData = new Float32Array(MAX_RIPPLES * 4);
    function splash(x, y, strength = 1) {
        if (reducedMotion) return;
        if (ripples.length >= MAX_RIPPLES) ripples.shift();
        ripples.push({
            x,
            y,
            age: 0,
            amp: strength
        });
        start();
    }
    function pruneRipples(delta) {
        const diag = Math.hypot(output.clientWidth, output.clientHeight);
        const speedPx = BASE_SPEED * Math.max(config.speed, 0.05);
        const width = config.wavelength * Math.max(config.rings, 1) * 0.5;
        for(let i = ripples.length - 1; i >= 0; i--){
            const rp = ripples[i];
            rp.age += delta;
            const gone = rp.age * speedPx > diag + width * 3 || Math.exp(-Math.max(config.decay, 0.05) * rp.age) * rp.amp < 0.012;
            if (gone) ripples.splice(i, 1);
        }
    }
    function render() {
        uploadContent();
        const dpr = output.width / Math.max(output.clientWidth, 1);
        gl.useProgram(program);
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, contentTexture);
        gl.uniform1i(uniforms.uContent, 0);
        gl.uniform2f(uniforms.uResolution, output.width, output.height);
        for(let i = 0; i < MAX_RIPPLES; i++){
            const rp = ripples[i];
            rippleData[i * 4] = rp ? rp.x * dpr : 0;
            rippleData[i * 4 + 1] = rp ? rp.y * dpr : 0;
            rippleData[i * 4 + 2] = rp ? rp.age : 0;
            rippleData[i * 4 + 3] = rp ? rp.amp * Math.max(config.amplitude, 0) : 0;
        }
        gl.uniform4fv(uniforms.uRipples, rippleData);
        gl.uniform1i(uniforms.uCount, ripples.length);
        gl.uniform1f(uniforms.uSpeed, BASE_SPEED * Math.max(config.speed, 0.05) * dpr);
        gl.uniform1f(uniforms.uWavelength, Math.max(config.wavelength, 4) * dpr);
        gl.uniform1f(uniforms.uWidth, Math.max(config.wavelength, 4) * Math.max(config.rings, 1) * 0.5 * dpr);
        gl.uniform1f(uniforms.uDecay, Math.max(config.decay, 0.05));
        gl.uniform1f(uniforms.uRefraction, Math.max(config.refraction, 0) * dpr);
        gl.uniform1f(uniforms.uDispersion, Math.max(config.dispersion, 0));
        gl.uniform1f(uniforms.uShine, Math.max(config.shine, 0));
        gl.uniform1f(uniforms.uHasContent, htmlInCanvas ? 1 : 0);
        gl.uniform1f(uniforms.uMaxX, contentMaxX);
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        gl.viewport(0, 0, output.width, output.height);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }
    function renderIdle() {
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        gl.viewport(0, 0, output.width, output.height);
        if (htmlInCanvas) {
            render();
        } else {
            gl.clearColor(0, 0, 0, 0);
            gl.clear(gl.COLOR_BUFFER_BIT);
        }
    }
    let raf = 0;
    let lastTime = performance.now();
    let destroyed = false;
    let running = false;
    let visible = true;
    let ambientTimer = 0;
    const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    let reducedMotion = motionQuery.matches;
    function spawnAmbient() {
        const w = output.clientWidth;
        const h = output.clientHeight;
        if (w < 10 || h < 10) return;
        splash(w * (0.15 + Math.random() * 0.7), h * (0.15 + Math.random() * 0.7), 0.6 + Math.random() * 0.5);
    }
    function frame(now) {
        if (destroyed) return;
        if (!visible) {
            running = false;
            return;
        }
        const delta = Math.min(Math.max((now - lastTime) / 1000, 0), 1 / 30);
        lastTime = now;
        if (!reducedMotion) {
            pruneRipples(delta);
            if (config.interval > 0) {
                ambientTimer += delta;
                if (ambientTimer >= config.interval) {
                    ambientTimer = 0;
                    spawnAmbient();
                }
            }
        }
        if (ripples.length > 0) {
            render();
        } else {
            renderIdle();
            if (!contentDirty && (config.interval <= 0 || reducedMotion)) {
                running = false;
                return;
            }
        }
        raf = requestAnimationFrame(frame);
    }
    function start() {
        if (destroyed || running || !visible) return;
        running = true;
        lastTime = performance.now();
        raf = requestAnimationFrame(frame);
    }
    wake = start;
    start();
    function localPoint(event) {
        const rect = output.getBoundingClientRect();
        return [
            event.clientX - rect.left,
            event.clientY - rect.top
        ];
    }
    let hoverX = -1e5;
    let hoverY = -1e5;
    function onPointerDown(event) {
        if (config.trigger === "none") return;
        const [x, y] = localPoint(event);
        splash(x, y, 1);
    }
    function onPointerMove(event) {
        if (config.trigger !== "hover") return;
        const [x, y] = localPoint(event);
        if (Math.hypot(x - hoverX, y - hoverY) < 56) return;
        hoverX = x;
        hoverY = y;
        splash(x, y, 0.3);
    }
    content.addEventListener("pointerdown", onPointerDown, {
        passive: true
    });
    content.addEventListener("pointermove", onPointerMove, {
        passive: true
    });
    function onMotionChange() {
        reducedMotion = motionQuery.matches;
        if (reducedMotion) ripples.length = 0;
        start();
    }
    motionQuery.addEventListener("change", onMotionChange);
    const observer = new ResizeObserver(()=>{
        syncCanvasSize();
        start();
    });
    observer.observe(output);
    observer.observe(content);
    const intersection = new IntersectionObserver((entries)=>{
        visible = entries[entries.length - 1]?.isIntersecting ?? true;
        if (visible) start();
    });
    intersection.observe(output);
    return {
        setOptions (next) {
            if (!Object.entries(next).some(([key, value])=>config[key] !== value)) return;
            Object.assign(config, next);
            start();
        },
        splash,
        resize () {
            syncCanvasSize();
            start();
        },
        destroy () {
            destroyed = true;
            cancelAnimationFrame(raf);
            content.removeEventListener("pointerdown", onPointerDown);
            content.removeEventListener("pointermove", onPointerMove);
            observer.disconnect();
            intersection.disconnect();
            motionQuery.removeEventListener("change", onMotionChange);
            gl.deleteTexture(contentTexture);
            gl.deleteProgram(program);
            gl.deleteShader(vertexShader);
            gl.deleteShader(fragmentShader);
            gl.deleteBuffer(quad);
            if (htmlInCanvas) paintable.onpaint = null;
        }
    };
}


//# sourceMappingURL=data:application/json;base64,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