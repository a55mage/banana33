/*
 * Libreria GLSL del motore SDF. Le funzioni delle forme e delle operazioni sono la traduzione
 * esatta di quelle in sdf.ts: se se ne cambia una, va cambiata anche l'altra (lo verificano i test).
 */

export const GLSL_LIB = /* glsl */ `
#define FAR 1e10
#define NEUTRAL vec3(0.8)

float roundOf(vec3 s, float r) { return min(r, 0.5 * min(s.x, min(s.y, s.z)) - 1e-4); }

float sdSphere(vec3 p, vec4 P) {
  vec3 s = P.xyz;
  float r = roundOf(s, P.w);
  vec3 ax = max(s * 0.5 - r, vec3(1e-4));
  float k0 = length(p / ax);
  float k1 = length(p / (ax * ax));
  return (k1 == 0.0 ? -min(ax.x, min(ax.y, ax.z)) : k0 * (k0 - 1.0) / k1) - r;
}

float sdBox(vec3 p, vec4 P) {
  vec3 s = P.xyz;
  float r = max(0.0, roundOf(s, P.w));
  vec3 q = abs(p) - (s * 0.5 - r);
  return length(max(q, 0.0)) + min(max(q.x, max(q.y, q.z)), 0.0) - r;
}

float radialXZ(vec2 xz, vec2 rr) {
  float e = length(xz / rr);
  return (e - 1.0) * min(rr.x, rr.y);
}

float sdCylinder(vec3 p, vec4 P) {
  vec3 s = P.xyz;
  float r = max(0.0, roundOf(s, P.w));
  float dx = radialXZ(p.xz, max(s.xz * 0.5 - r, vec2(1e-4)));
  float dy = abs(p.y) - (s.y * 0.5 - r);
  return min(max(dx, dy), 0.0) + length(max(vec2(dx, dy), 0.0)) - r;
}

float sdCone(vec3 p, vec4 P) {
  vec3 s = P.xyz;
  float r = max(0.0, roundOf(s, P.w));
  float h = max(s.y * 0.5 - r, 1e-4);
  vec2 rr = max(s.xz * 0.5 - r, vec2(1e-4));
  float rb = (rr.x + rr.y) * 0.5;
  float qx = length(p.xz / rr * rb);
  float qy = p.y;
  vec2 k2 = vec2(-rb, 2.0 * h);
  vec2 ca = vec2(qx - min(qx, qy < 0.0 ? rb : 0.0), abs(qy) - h);
  float t = clamp(dot(vec2(-qx, h - qy), k2) / dot(k2, k2), 0.0, 1.0);
  vec2 cb = vec2(qx, qy - h) + k2 * t;
  float sg = (cb.x < 0.0 && ca.y < 0.0) ? -1.0 : 1.0;
  return sg * sqrt(min(dot(ca, ca), dot(cb, cb))) - r;
}

float sdTorus(vec3 p, vec4 P) {
  vec3 s = P.xyz;
  float tube = s.y * 0.5;
  float major = max((s.x + s.z) * 0.25 - tube, 1e-4);
  return length(vec2(length(p.xz) - major, p.y)) - tube;
}

float sdCapsule(vec3 p, vec4 P) {
  vec3 s = P.xyz;
  float radius = min(s.x, s.z) * 0.5;
  float h = max(s.y * 0.5 - radius, 0.0);
  p.y -= clamp(p.y, -h, h);
  return length(p) - radius;
}

void opUnion(inout float a, inout vec3 ca, float b, vec3 cb, float k) {
  k = max(k, 1e-5);
  float h = clamp(0.5 + 0.5 * (b - a) / k, 0.0, 1.0);
  a = mix(b, a, h) - k * h * (1.0 - h);
  ca = mix(cb, ca, h);
}

void opSubtract(inout float a, inout vec3 ca, float b, vec3 cb, float k) {
  k = max(k, 1e-5);
  float h = clamp(0.5 - 0.5 * (a + b) / k, 0.0, 1.0);
  a = mix(a, -b, h) + k * h * (1.0 - h);
  ca = mix(ca, cb, h);
}

void opIntersect(inout float a, inout vec3 ca, float b, vec3 cb, float k) {
  k = max(k, 1e-5);
  float h = clamp(0.5 - 0.5 * (b - a) / k, 0.0, 1.0);
  a = mix(b, a, h) + k * h * (1.0 - h);
  ca = mix(cb, ca, h);
}
`

/** Uniform comuni a modello e ombra; N = numero di nodi (costante dello shader) */
const uniformsDecl = (n: number) => /* glsl */ `
uniform mat4 uInv[${n}];
uniform vec4 uParam[${n}];
uniform vec4 uColor[${n}];
uniform vec3 uLight;
`

/** Funzioni basate sulla scena: distanza, normale, ombra morbida, occlusione ambientale */
const SCENE_HELPERS = /* glsl */ `
float mapD(vec3 p) { vec3 c; return sceneMap(p, c); }

vec3 calcNormal(vec3 p) {
  const vec2 e = vec2(1.0, -1.0) * 0.0004;
  return normalize(e.xyy * mapD(p + e.xyy) + e.yyx * mapD(p + e.yyx) + e.yxy * mapD(p + e.yxy) + e.xxx * mapD(p + e.xxx));
}

float softShadow(vec3 ro, vec3 rd, float tmax) {
  float res = 1.0;
  float t = 0.003;
  for (int i = 0; i < 40; i++) {
    float h = mapD(ro + rd * t);
    res = min(res, 12.0 * h / t);
    t += clamp(h, 0.003, 0.08);
    if (res < 0.002 || t > tmax) break;
  }
  return clamp(res, 0.0, 1.0);
}

float calcAO(vec3 p, vec3 n) {
  float occ = 0.0;
  float sca = 1.0;
  for (int i = 0; i < 5; i++) {
    float h = 0.004 + 0.025 * float(i);
    occ += (h - mapD(p + n * h)) * sca;
    sca *= 0.8;
  }
  return clamp(1.0 - 2.5 * occ, 0.0, 1.0);
}
`

export const SCULPT_VERTEX = /* glsl */ `
varying vec3 vWorld;
void main() {
  vec4 w = modelMatrix * vec4(position, 1.0);
  vWorld = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
}
`

/** Shader del modello: ray marching dentro il suo ingombro e illuminazione per materiale */
export function sculptFragment(n: number, sceneMap: string): string {
  return /* glsl */ `
${uniformsDecl(n)}
uniform mat4 uProj;
uniform vec3 uBoxMin;
uniform vec3 uBoxMax;
uniform int uMaterial; // 0 opaco, 1 lucido, 2 metallo, 3 argilla
uniform vec3 uSky;
uniform vec3 uGround;
varying vec3 vWorld;

${GLSL_LIB}
${sceneMap}
${SCENE_HELPERS}

vec2 boxHit(vec3 ro, vec3 rd) {
  vec3 inv = 1.0 / rd;
  vec3 t0 = (uBoxMin - ro) * inv;
  vec3 t1 = (uBoxMax - ro) * inv;
  vec3 tmin = min(t0, t1);
  vec3 tmax = max(t0, t1);
  return vec2(max(max(tmin.x, tmin.y), tmin.z), min(min(tmax.x, tmax.y), tmax.z));
}

void main() {
  vec3 ro = cameraPosition;
  vec3 rd = normalize(vWorld - ro);
  vec2 tb = boxHit(ro, rd);
  if (tb.x > tb.y || tb.y < 0.0) discard;

  float t = max(tb.x, 0.0);
  bool hit = false;
  vec3 albedo;
  float h = FAR;
  for (int i = 0; i < 300; i++) {
    h = sceneMap(ro + rd * t, albedo);
    float eps = 0.00015 * max(t, 0.5);
    // distanza negativa: il passo ha superato la superficie (succede con fusioni e sottrazioni,
    // che non sono distanze esatte); va considerato comunque un contatto
    if (h < eps) { hit = true; break; }
    // passo prudente ma mai nullo, così i raggi radenti non esauriscono i passi
    t += max(h * 0.9, eps * 0.5);
    if (t > tb.y) break;
  }
  // passi esauriti a un soffio dalla superficie: contatto (evita buchi sui raggi radenti)
  if (!hit && t <= tb.y && h < 0.002) hit = true;
  if (!hit) discard;

  vec3 pos = ro + rd * t;
  vec3 n = calcNormal(pos);
  vec3 L = normalize(uLight);
  vec3 V = -rd;
  vec3 H = normalize(L + V);
  float ndl = dot(n, L);
  float dif = uMaterial == 3 ? clamp((ndl + 0.4) / 1.4, 0.0, 1.0) : clamp(ndl, 0.0, 1.0);
  float sha = dif > 0.0 ? softShadow(pos + n * 0.002, L, 1.5) : 0.0;
  float ao = calcAO(pos, n);
  float skyAmt = 0.5 + 0.5 * n.y;
  float fre = pow(1.0 - clamp(dot(n, V), 0.0, 1.0), 5.0);
  vec3 refl = reflect(rd, n);
  vec3 env = mix(uGround, uSky, smoothstep(-0.2, 0.4, refl.y));

  vec3 sun = vec3(1.0, 0.96, 0.9) * 1.5;
  vec3 diffuse = albedo * (dif * sha * sun + skyAmt * ao * uSky * 0.55 + clamp(-n.y, 0.0, 1.0) * ao * uGround * 0.25);
  vec3 col;
  if (uMaterial == 2) {
    // metallo: poca diffusione, riflessi colorati dal materiale
    vec3 spec = albedo * pow(clamp(dot(n, H), 0.0, 1.0), 60.0) * 2.0 * sha;
    col = diffuse * 0.25 + spec + env * albedo * (0.55 + 0.45 * fre) * ao;
  } else {
    float shin = uMaterial == 1 ? 140.0 : 18.0;
    float specAmt = uMaterial == 1 ? 0.6 : uMaterial == 0 ? 0.05 : 0.0;
    float envAmt = uMaterial == 1 ? 0.35 : 0.04;
    col = diffuse + vec3(pow(clamp(dot(n, H), 0.0, 1.0), shin)) * specAmt * dif * sha + env * fre * envAmt * ao;
  }

  vec4 clip = uProj * viewMatrix * vec4(pos, 1.0);
  gl_FragDepth = clamp(clip.z / clip.w * 0.5 + 0.5, 0.0, 1.0);
  gl_FragColor = vec4(col, 1.0);
  #include <colorspace_fragment>
}
`
}

/** Shader dell'ombra sul pavimento: ombra morbida verso la luce e occlusione di contatto */
export function shadowFragment(n: number, sceneMap: string): string {
  return /* glsl */ `
${uniformsDecl(n)}
uniform vec3 uCenter;
uniform float uRadius;
uniform float uStrength;
varying vec3 vWorld;

${GLSL_LIB}
${sceneMap}
${SCENE_HELPERS}

void main() {
  vec3 p = vWorld + vec3(0.0, 0.001, 0.0);
  float fade = 1.0 - smoothstep(uRadius * 0.6, uRadius, length(p.xz - uCenter.xz));
  if (fade <= 0.0) discard;
  float sha = softShadow(p, normalize(uLight), 2.0);
  float contact = clamp(mapD(p) / 0.05, 0.0, 1.0);
  float a = ((1.0 - sha) * 0.55 + (1.0 - contact) * 0.35) * fade * uStrength;
  if (a < 0.003) discard;
  gl_FragColor = vec4(0.0, 0.0, 0.0, a);
}
`
}
