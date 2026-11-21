// Simulador del procesador de 2 qubits: port a JavaScript del notebook de Python.
//
//   dρ/dt = −i[H(t), ρ] + Σ_k ( L_k ρ L_k† − ½{L_k† L_k, ρ} )      (16 EDOs complejas)
//   dψ/dt = −i H(t) ψ                                               (4 EDOs complejas)
//
// Al vectorizar ρ (apilando columnas, vec(AXB) = (Bᵀ ⊗ A) vec X) todo queda como un sistema lineal
//   dy/dt = A(t) y,   y = (vec ρ, ψ) ∈ ℂ²⁰,   A(t) = diag( 𝓛(t), −iH(t) )
// que se resuelve con seis integradores escritos a mano. A(t) es diagonal por bloques, así que cada
// método se aplica bloque por bloque (es matemáticamente idéntico a aplicarlo a la matriz 20×20).
// Unidades: tiempo en ns, frecuencias angulares en rad/ns.

import * as LA from './linalg.js'

export const MHz = 2 * Math.PI * 1e-3
export const METHODS = ['Euler', 'Heun', 'RK4', 'RK45', 'Crank-Nicolson', 'Magnus4']
export const ORDER = { Euler: 1, Heun: 2, RK4: 4, RK45: 5, 'Crank-Nicolson': 2, Magnus4: 4 }
export const FIXED = ['Euler', 'Heun', 'RK4', 'Crank-Nicolson', 'Magnus4']

// ---------------------------------------------------------------- operadores
const m2 = (rows) => Float64Array.from(rows.flat(2))      // [[ [re, im], [re, im] ], ...]
export const I2 = m2([[[1, 0], [0, 0]], [[0, 0], [1, 0]]])
export const SX = m2([[[0, 0], [1, 0]], [[1, 0], [0, 0]]])
export const SY = m2([[[0, 0], [0, -1]], [[0, 1], [0, 0]]])
export const SZ = m2([[[1, 0], [0, 0]], [[0, 0], [-1, 0]]])
export const SM = m2([[[0, 0], [1, 0]], [[0, 0], [0, 0]]])    // σ₋ = |0⟩⟨1|

/** Operador de 1 qubit `op` sobre el qubit j de un registro de nq qubits (kron con identidades). */
export function opOn(op, j, nq) {
  let out = Float64Array.of(1, 0), d = 1
  for (let k = 0; k < nq; k++) { out = LA.kron(out, d, k === j ? op : I2, 2); d *= 2 }
  return out
}

/** −i[H, ·] vectorizado: −i (I ⊗ H − Hᵀ ⊗ I) */
function commSuper(H, d) {
  const I = LA.eye(d)
  const K = LA.kron(I, d, H, d)
  LA.addScaled(K, LA.kron(LA.transpose(H, d), d, I, d), -1)
  return LA.scaled(K, 0, -1)
}

/** Σ_k ( L̄_k ⊗ L_k − ½ I ⊗ L_k†L_k − ½ (L_k†L_k)ᵀ ⊗ I ) */
function dissSuper(Ls, d) {
  const I = LA.eye(d), D = LA.zeros(d * d)
  for (const L of Ls) {
    const LdL = LA.matmul(LA.dagger(L, d), L, d)
    LA.addScaled(D, LA.kron(LA.conj(L), d, L, d), 1)
    LA.addScaled(D, LA.kron(I, d, LdL, d), -0.5)
    LA.addScaled(D, LA.kron(LA.transpose(LdL, d), d, I, d), -0.5)
  }
  return D
}

/** Operadores de Lindblad: √(1/T1) σ₋ y √(γφ/2) σz por qubit, con γφ = 1/T2 − 1/(2T1). */
export function noiseOps(nq, T1, T2) {
  if (T2 === undefined || T2 === null) T2 = 2 * T1
  const g1 = isFinite(T1) ? 1 / T1 : 0
  const gphi = (isFinite(T2) ? 1 / T2 : 0) - g1 / 2
  if (gphi < -1e-15) throw new Error('T₂ > 2·T₁ no es físico')
  const Ls = []
  for (let j = 0; j < nq; j++) {
    if (g1 > 0) Ls.push(LA.scaled(opOn(SM, j, nq), Math.sqrt(g1)))
    if (gphi > 0) Ls.push(LA.scaled(opOn(SZ, j, nq), Math.sqrt(gphi / 2)))
  }
  return Ls
}

/**
 * Sistema abierto dy/dt = A(t) y. H(t) = H0 + Σ_m c_m(t) H_m.
 * 𝓛₀ y los 𝒦_m se arman una sola vez; A(t) solo combina matrices. Cuenta las evaluaciones (nfev).
 */
export function openSystem({ nq, H0, Hterms = [], coeffs = [], Ls = [] }) {
  const d = 2 ** nq, nr = d * d
  const L0 = commSuper(H0, d)
  LA.addScaled(L0, dissSuper(Ls, d), 1)
  const K = Hterms.map((H) => commSuper(H, d))
  const S0 = LA.scaled(H0, 0, -1)
  const Sm = Hterms.map((H) => LA.scaled(H, 0, -1))
  const sys = {
    nq, d, nr, dim: nr + d, blocks: [nr, d], nfev: 0, coeffs, H0, Hterms, Ls,
    /** Bloques de A(t): [𝓛(t) (d²×d²), −iH(t) (d×d)] */
    A(t) {
      sys.nfev++
      const L = L0.slice(), S = S0.slice()
      for (let m = 0; m < K.length; m++) {
        const c = coeffs[m](t)
        if (c !== 0) { LA.addScaled(L, K[m], c); LA.addScaled(S, Sm[m], c) }
      }
      return [L, S]
    },
    /** y0 = (vec |ψ⟩⟨ψ|, ψ); vec apila columnas: ρ_ij está en la posición i + d·j */
    y0(psi) {
      const y = new Float64Array(2 * (nr + d))
      for (let i = 0; i < d; i++) for (let j = 0; j < d; j++) {
        const ar = psi[2 * i], ai = psi[2 * i + 1], br = psi[2 * j], bi = -psi[2 * j + 1]
        y[2 * (i + d * j)] = ar * br - ai * bi
        y[2 * (i + d * j) + 1] = ar * bi + ai * br
      }
      y.set(psi, 2 * nr)
      return y
    },
  }
  return sys
}

// ---------------------------------------------------------------- operaciones por bloques
function blockMatvec(sys, Ab, y) {
  const out = new Float64Array(y.length)
  let off = 0
  Ab.forEach((M, b) => {
    const n = sys.blocks[b]
    LA.matvec(M, y.subarray(2 * off, 2 * (off + n)), n, out.subarray(2 * off, 2 * (off + n)))
    off += n
  })
  return out
}

function forBlocks(sys, y, fn) {
  const out = new Float64Array(y.length)
  let off = 0
  sys.blocks.forEach((n, b) => { out.set(fn(b, n, y.subarray(2 * off, 2 * (off + n))), 2 * off); off += n })
  return out
}

const axpy = (y, h, k) => { const o = new Float64Array(y.length); for (let i = 0; i < y.length; i++) o[i] = y[i] + h * k[i]; return o }

// ---------------------------------------------------------------- integradores de paso fijo
const C1 = 0.5 - Math.sqrt(3) / 6, C2 = 0.5 + Math.sqrt(3) / 6

export const STEPPERS = {
  /** y_{n+1} = y_n + h A(t_n) y_n */
  Euler: (sys, t, y, h) => axpy(y, h, blockMatvec(sys, sys.A(t), y)),

  /** predictor Euler + corrector trapecio */
  Heun: (sys, t, y, h) => {
    const k1 = blockMatvec(sys, sys.A(t), y)
    const k2 = blockMatvec(sys, sys.A(t + h), axpy(y, h, k1))
    return y.map((v, i) => v + (h / 2) * (k1[i] + k2[i]))
  },

  /** RK4 clásico; A(t + h/2) se evalúa una vez y sirve para k2 y k3 (3 evaluaciones por paso) */
  RK4: (sys, t, y, h) => {
    const A1 = sys.A(t), Am = sys.A(t + h / 2), A4 = sys.A(t + h)
    const k1 = blockMatvec(sys, A1, y)
    const k2 = blockMatvec(sys, Am, axpy(y, h / 2, k1))
    const k3 = blockMatvec(sys, Am, axpy(y, h / 2, k2))
    const k4 = blockMatvec(sys, A4, axpy(y, h, k3))
    return y.map((v, i) => v + (h / 6) * (k1[i] + 2 * k2[i] + 2 * k3[i] + k4[i]))
  },

  /** (I − h/2 M) y_{n+1} = (I + h/2 M) y_n con M = A(t + h/2); sistema lineal por LU con pivoteo */
  'Crank-Nicolson': (sys, t, y, h) => {
    const Mb = sys.A(t + h / 2)
    return forBlocks(sys, y, (b, n, yb) => {
      const lhs = LA.eye(n)
      LA.addScaled(lhs, Mb[b], -h / 2)
      const rhs = LA.matvec(Mb[b], yb, n)
      for (let i = 0; i < rhs.length; i++) rhs[i] = yb[i] + (h / 2) * rhs[i]
      return LA.solve(lhs, rhs, n)
    })
  },

  /** Ω = h/2 (A1 + A2) − (√3 h²/12)[A1, A2] en los nodos de Gauss; y_{n+1} = e^Ω y_n */
  Magnus4: (sys, t, y, h) => {
    const A1 = sys.A(t + C1 * h), A2 = sys.A(t + C2 * h)
    return forBlocks(sys, y, (b, n, yb) => {
      const Om = LA.scaled(A1[b], h / 2)
      LA.addScaled(Om, A2[b], h / 2)
      const c = (Math.sqrt(3) * h * h) / 12
      LA.addScaled(Om, LA.matmul(A1[b], A2[b], n), -c)
      LA.addScaled(Om, LA.matmul(A2[b], A1[b], n), c)
      return LA.matvec(LA.expm(Om, n), yb, n)
    })
  },
}

/** Integración de paso fijo. Guarda cada `every` pasos. h debe dividir el intervalo. */
export function integrate(method, sys, y0, t0, tf, h, every = 1) {
  const N = Math.round((tf - t0) / h)
  if (Math.abs(N * h - (tf - t0)) > 1e-9 * Math.max(1, tf)) throw new Error('h debe dividir la duración de las compuertas')
  const step = STEPPERS[method]
  let y = Float64Array.from(y0)
  const ts = [t0], ys = [y]
  for (let n = 0; n < N; n++) {
    y = step(sys, t0 + n * h, y, h)
    if ((n + 1) % every === 0 || n === N - 1) { ts.push(t0 + (n + 1) * h); ys.push(y) }
  }
  return { ts, ys }
}

// ---------------------------------------------------------------- Dormand-Prince 5(4) adaptativo
export const DP = {
  c: [0, 1 / 5, 3 / 10, 4 / 5, 8 / 9, 1, 1],
  a: [[], [1 / 5], [3 / 40, 9 / 40], [44 / 45, -56 / 15, 32 / 9],
    [19372 / 6561, -25360 / 2187, 64448 / 6561, -212 / 729],
    [9017 / 3168, -355 / 33, 46732 / 5247, 49 / 176, -5103 / 18656],
    [35 / 384, 0, 500 / 1113, 125 / 192, -2187 / 6784, 11 / 84]],
  b5: [35 / 384, 0, 500 / 1113, 125 / 192, -2187 / 6784, 11 / 84, 0],
  b4: [5179 / 57600, 0, 7571 / 16695, 393 / 640, -92097 / 339200, 187 / 2100, 1 / 40],
}
const DP_E = DP.b5.map((b, i) => b - DP.b4[i])

/**
 * RK45 con control de paso: err = RMS(|y5 − y4| / (atol + rtol·max|y|)),
 * h_nuevo = h·min(5, max(0.2, 0.9·err^(−1/5))). FSAL: la etapa 7 es la etapa 1 del siguiente paso.
 * Si se da `tOut`, el paso se recorta para caer exactamente en esos instantes (para animar).
 */
export function integrateRK45(sys, y0, t0, tf, { rtol = 1e-6, atol = 1e-9, h0 = 0.1, tOut = null } = {}) {
  const f = (t, y) => blockMatvec(sys, sys.A(t), y)
  let t = t0, y = Float64Array.from(y0), h = h0, k1 = f(t, y), rejected = 0
  const ts = [t], ys = [y], steps = [], rejections = []
  let iOut = 0
  const nC = y.length / 2
  while (t < tf - 1e-12) {
    const target = tOut ? Math.min(tOut[iOut] ?? tf, tf) : tf
    const clipped = h > target - t, hTry = clipped ? target - t : h
    const K = [k1]
    let yi
    for (let i = 1; i < 7; i++) {
      yi = Float64Array.from(y)
      DP.a[i].forEach((a, j) => { if (a !== 0) for (let q = 0; q < yi.length; q++) yi[q] += hTry * a * K[j][q] })
      K.push(f(t + DP.c[i] * hTry, yi))
    }
    const y5 = yi
    let acc = 0
    for (let q = 0; q < nC; q++) {
      let er = 0, ei = 0
      for (let s = 0; s < 7; s++) { er += DP_E[s] * K[s][2 * q]; ei += DP_E[s] * K[s][2 * q + 1] }
      const sc = atol + rtol * Math.max(Math.hypot(y[2 * q], y[2 * q + 1]), Math.hypot(y5[2 * q], y5[2 * q + 1]))
      acc += (Math.hypot(er, ei) * hTry / sc) ** 2
    }
    const err = Math.sqrt(acc / nC)
    if (err <= 1) {
      t += hTry; y = y5; k1 = K[6]
      steps.push({ t, h: hTry })
      if (!tOut || Math.abs(t - target) < 1e-12) { ts.push(t); ys.push(y); if (tOut) iOut++ }
    } else { rejected++; rejections.push({ t, h: hTry }) }
    const hNew = hTry * Math.min(5, Math.max(0.2, 0.9 * (err + 1e-16) ** (-1 / 5)))
    h = clipped && err <= 1 ? Math.max(h, hNew) : hNew          // un recorte por la rejilla no achica el paso
  }
  return { ts, ys, steps, rejected, rejections }
}

// ---------------------------------------------------------------- pulsos y Grover
const ERF_SQRT2 = 0.9544997361036416   // erf(√2): con σ = t_g/4 el argumento t_g/(2√2σ) siempre vale √2

/** Gaussiana truncada en ±2σ (σ = t_g/4), desplazada para empezar y terminar en 0, con área `area`. */
export function gaussPulse(t, t0, tg, area) {
  if (t < t0 || t > t0 + tg) return 0
  const s = tg / 4
  const off = Math.exp(-((tg / 2) ** 2) / (2 * s * s))
  const norm = s * Math.sqrt(2 * Math.PI) * ERF_SQRT2 - tg * off
  return (area * (Math.exp(-((t - t0 - tg / 2) ** 2) / (2 * s * s)) - off)) / norm
}

export const CHANNELS = ['x1', 'y1', 'x2', 'y2', 'J']

/** H⊗H · CZ · H⊗H · X⊗X · CZ · X⊗X · H⊗H, con H = Rx(π)·Ry(π/2) y X = Rx(π) */
export function groverSchedule(t1q = 20, tcz = 40, areaErr = 0) {
  const sched = Object.fromEntries(CHANNELS.map((c) => [c, []]))
  const gates = []
  let t = 0
  for (const g of ['H', 'CZ', 'H', 'X', 'CZ', 'X', 'H']) {
    const t0 = t
    if (g === 'CZ') { sched.J.push([t, tcz, Math.PI]); t += tcz }
    else {
      const layers = g === 'H' ? [['y', Math.PI / 2], ['x', Math.PI]] : [['x', Math.PI]]
      for (const [ax, ang] of layers) {
        for (const q of [1, 2]) sched[ax + q].push([t, t1q, ang * (1 + areaErr)])
        t += t1q
      }
    }
    gates.push({ nombre: g, t0, t1: t })
  }
  return { sched, tf: t, gates }
}

export const OPS = {
  X1: opOn(SX, 0, 2), Y1: opOn(SY, 0, 2), Z1: opOn(SZ, 0, 2),
  X2: opOn(SX, 1, 2), Y2: opOn(SY, 1, 2), Z2: opOn(SZ, 1, 2),
  P11: (() => { const P = LA.zeros(4); P[2 * 15] = 1; return P })(),
}

export function buildProcessor({ T1 = Infinity, T2 = null, deltaMHz = 0, t1q = 20, areaErr = 0 } = {}) {
  const { sched, tf, gates } = groverSchedule(t1q, 2 * t1q, areaErr)
  const coeffs = CHANNELS.map((c) => (t) => sched[c].reduce((s, [t0, tg, a]) => s + gaussPulse(t, t0, tg, a), 0))
  const H0 = LA.zeros(4)
  LA.addScaled(H0, OPS.Z1, (deltaMHz * MHz) / 2)
  LA.addScaled(H0, OPS.Z2, (deltaMHz * MHz) / 2)
  const Hterms = [LA.scaled(OPS.X1, 0.5), LA.scaled(OPS.Y1, 0.5), LA.scaled(OPS.X2, 0.5), LA.scaled(OPS.Y2, 0.5), OPS.P11]
  const sys = openSystem({ nq: 2, H0, Hterms, coeffs, Ls: noiseOps(2, T1, T2) })
  return Object.assign(sys, { tf, gates, sched })
}

/** 1 qubit: H = Δ/2 σz + Ω(t)/2 σx, con ruido T1, T2 (para las pruebas analíticas) */
export function buildOneQubit({ T1 = Infinity, T2, delta = 0, omega = null } = {}) {
  return openSystem({
    nq: 1, H0: LA.scaled(SZ, delta / 2), Hterms: omega ? [LA.scaled(SX, 0.5)] : [], coeffs: omega ? [omega] : [],
    Ls: noiseOps(1, T1, T2),
  })
}

export const PSI00 = Float64Array.of(1, 0, 0, 0, 0, 0, 0, 0)

// ---------------------------------------------------------------- diagnósticos
/** valores propios de una matriz real simétrica (Jacobi cíclico) */
function eigSym(A, n) {
  A = A.slice()
  for (let sweep = 0; sweep < 50; sweep++) {
    let off = 0
    for (let p = 0; p < n; p++) for (let q = p + 1; q < n; q++) off += A[p * n + q] ** 2
    if (off < 1e-24) break
    for (let p = 0; p < n; p++)
      for (let q = p + 1; q < n; q++) {
        const apq = A[p * n + q]
        if (Math.abs(apq) < 1e-300) continue
        const th = (A[q * n + q] - A[p * n + p]) / (2 * apq)
        const t = Math.sign(th || 1) / (Math.abs(th) + Math.sqrt(th * th + 1))
        const c = 1 / Math.sqrt(t * t + 1), s = t * c
        for (let k = 0; k < n; k++) { const akp = A[k * n + p], akq = A[k * n + q]; A[k * n + p] = c * akp - s * akq; A[k * n + q] = s * akp + c * akq }
        for (let k = 0; k < n; k++) { const apk = A[p * n + k], aqk = A[q * n + k]; A[p * n + k] = c * apk - s * aqk; A[q * n + k] = s * apk + c * aqk }
      }
  }
  return Array.from({ length: n }, (_, i) => A[i * n + i])
}

/** λ_min de la parte hermítica de ρ: la matriz real [[Re, −Im], [Im, Re]] tiene los mismos valores propios, duplicados */
function lambdaMin(rho, d) {
  const n = 2 * d, M = new Float64Array(n * n)
  for (let i = 0; i < d; i++) for (let j = 0; j < d; j++) {
    const re = 0.5 * (rho[2 * (i * d + j)] + rho[2 * (j * d + i)])
    const im = 0.5 * (rho[2 * (i * d + j) + 1] - rho[2 * (j * d + i) + 1])
    M[i * n + j] = re; M[(i + d) * n + j + d] = re
    M[i * n + j + d] = -im; M[(i + d) * n + j] = im
  }
  return Math.min(...eigSym(M, n))
}

const expect = (rho, O, d) => {           // Re Tr(ρ O)
  let s = 0
  for (let i = 0; i < d; i++) for (let j = 0; j < d; j++) {
    const a = 2 * (i * d + j), b = 2 * (j * d + i)
    s += rho[a] * O[b] - rho[a + 1] * O[b + 1]
  }
  return s
}

/** ρ por filas (re/im intercalados) a partir de y = (vec ρ por columnas, ψ) */
export function rhoOf(y, d) {
  const rho = new Float64Array(2 * d * d)
  for (let i = 0; i < d; i++) for (let j = 0; j < d; j++) {
    rho[2 * (i * d + j)] = y[2 * (i + d * j)]
    rho[2 * (i * d + j) + 1] = y[2 * (i + d * j) + 1]
  }
  return rho
}

export function diagnostics(y, d = 4) {
  const rho = rhoOf(y, d), psi = y.subarray(2 * d * d)
  let tr = 0, herm = 0, pur = 0, nrm = 0, F = 0
  const pops = []
  for (let i = 0; i < d; i++) { pops.push(rho[2 * (i * d + i)]); tr += rho[2 * (i * d + i)] }
  for (let i = 0; i < d; i++) for (let j = 0; j < d; j++) {
    const a = 2 * (i * d + j), b = 2 * (j * d + i)
    herm = Math.max(herm, Math.hypot(rho[a] - rho[b], rho[a + 1] + rho[b + 1]))
    pur += rho[a] * rho[b] - rho[a + 1] * rho[b + 1]                  // Re Tr(ρ²)
    const pr = psi[2 * i], pi = -psi[2 * i + 1], qr = psi[2 * j], qi = psi[2 * j + 1]   // F = ψ† ρ ψ
    const xr = rho[a] * qr - rho[a + 1] * qi, xi = rho[a] * qi + rho[a + 1] * qr
    F += pr * xr - pi * xi
  }
  for (let i = 0; i < 2 * d; i++) nrm += psi[i] ** 2
  const out = { rho, pops, trazaErr: Math.abs(tr - 1), hermErr: herm, pureza: pur, normaPsi: Math.sqrt(nrm), fidelidad: F / nrm, lambdaMin: lambdaMin(rho, d) }
  if (d === 4) {
    out.bloch1 = [expect(rho, OPS.X1, 4), expect(rho, OPS.Y1, 4), expect(rho, OPS.Z1, 4)]
    out.bloch2 = [expect(rho, OPS.X2, 4), expect(rho, OPS.Y2, 4), expect(rho, OPS.Z2, 4)]
  }
  return out
}

// ---------------------------------------------------------------- simulación completa de Grover
const EVALS_PER_STEP = { Euler: 1, Heun: 2, RK4: 3, 'Crank-Nicolson': 1, Magnus4: 2 }

export function simulate({ T1 = Infinity, T2 = null, deltaMHz = 0, t1q = 20, areaErr = 0, method = 'RK4', h = 0.25, rtol = 1e-6 } = {}) {
  const sys = buildProcessor({ T1, T2, deltaMHz, t1q, areaErr })
  const y0 = sys.y0(PSI00)
  const c0 = performance.now()
  let ts, ys, rk45 = null
  if (method === 'RK45') {
    sys.nfev = 0
    const free = integrateRK45(sys, y0, 0, sys.tf, { rtol, atol: rtol * 1e-2 })    // corrida libre: costo y pasos
    rk45 = { steps: free.steps, rejected: free.rejected, rejections: free.rejections, nfev: sys.nfev, yFinal: free.ys.at(-1) }
    const tOut = Array.from({ length: Math.round(sys.tf) }, (_, i) => i + 1)
    ;({ ts, ys } = integrateRK45(sys, y0, 0, sys.tf, { rtol, atol: rtol * 1e-2, tOut }))
  } else {
    ;({ ts, ys } = integrate(method, sys, y0, 0, sys.tf, h, Math.max(1, Math.round(1 / h))))
  }
  const cpuMs = performance.now() - c0
  const frames = ts.map((t, k) => ({ t, ...diagnostics(ys[k]) }))
  if (rk45) { frames[frames.length - 1] = { t: sys.tf, ...diagnostics(rk45.yFinal) }; ys[ys.length - 1] = rk45.yFinal }   // final = corrida libre
  const evals = method === 'RK45' ? rk45.nfev : Math.round(sys.tf / h) * EVALS_PER_STEP[method]
  return {
    frames, gates: sys.gates, tf: sys.tf, cpuMs, evals, rk45, yFinal: ys.at(-1),
    pulses: Object.fromEntries(CHANNELS.map((c, m) => [c, ts.map((t) => sys.coeffs[m](t))])),
  }
}
