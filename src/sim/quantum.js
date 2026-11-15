// Simulador del procesador de 2 qubits (port a JS del notebook).
//   dρ/dt = −i[H(t), ρ] + Σ_k ( L_k ρ L_k† − ½{L_k† L_k, ρ} )      (16 EDOs complejas)
//   dψ/dt = −i H(t) ψ                                               (4 EDOs complejas)
// Estado y = Float64Array(40): ρ (4×4 complejo, re/im intercalados, por filas) y luego ψ.
// Unidades: tiempo en ns, frecuencias en rad/ns.

const D = 4
const MHz = 2 * Math.PI * 1e-3

// ---------- álgebra compleja mínima (matrices 4×4 y 2×2 en Float64Array re/im) ----------
const zeros = (n = D) => new Float64Array(2 * n * n)

function mul(A, B, n = D) {
  const C = zeros(n)
  for (let i = 0; i < n; i++)
    for (let k = 0; k < n; k++) {
      const ar = A[2 * (i * n + k)], ai = A[2 * (i * n + k) + 1]
      if (ar === 0 && ai === 0) continue
      for (let j = 0; j < n; j++) {
        const br = B[2 * (k * n + j)], bi = B[2 * (k * n + j) + 1]
        C[2 * (i * n + j)] += ar * br - ai * bi
        C[2 * (i * n + j) + 1] += ar * bi + ai * br
      }
    }
  return C
}

function dag(A, n = D) {
  const C = zeros(n)
  for (let i = 0; i < n; i++)
    for (let j = 0; j < n; j++) {
      C[2 * (j * n + i)] = A[2 * (i * n + j)]
      C[2 * (j * n + i) + 1] = -A[2 * (i * n + j) + 1]
    }
  return C
}

const addScaled = (out, A, s) => { for (let i = 0; i < out.length; i++) out[i] += s * A[i] }

function kron(a, b) {               // a, b: 2×2 → 4×4
  const C = zeros()
  for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++)
    for (let k = 0; k < 2; k++) for (let l = 0; l < 2; l++) {
      const ar = a[2 * (i * 2 + j)], ai = a[2 * (i * 2 + j) + 1]
      const br = b[2 * (k * 2 + l)], bi = b[2 * (k * 2 + l) + 1]
      const idx = 2 * ((2 * i + k) * D + (2 * j + l))
      C[idx] = ar * br - ai * bi
      C[idx + 1] = ar * bi + ai * br
    }
  return C
}

const m2 = (rows) => Float64Array.from(rows.flat(2))   // [[ [re,im], [re,im] ], ...]
const I2 = m2([[[1, 0], [0, 0]], [[0, 0], [1, 0]]])
const SX = m2([[[0, 0], [1, 0]], [[1, 0], [0, 0]]])
const SY = m2([[[0, 0], [0, -1]], [[0, 1], [0, 0]]])
const SZ = m2([[[1, 0], [0, 0]], [[0, 0], [-1, 0]]])
const SM = m2([[[0, 0], [1, 0]], [[0, 0], [0, 0]]])    // σ₋ = |0⟩⟨1|

const onQ = (op, j) => (j === 0 ? kron(op, I2) : kron(I2, op))
const scale = (A, s) => A.map((v) => v * s)

export const OPS = {
  X1: onQ(SX, 0), Y1: onQ(SY, 0), Z1: onQ(SZ, 0),
  X2: onQ(SX, 1), Y2: onQ(SY, 1), Z2: onQ(SZ, 1),
  P11: (() => { const P = zeros(); P[2 * 15] = 1; return P })(),
}

// ---------- pulsos y secuencia de Grover ----------
export function gaussPulse(t, t0, tg, area) {
  if (t < t0 || t > t0 + tg) return 0
  const s = tg / 4
  const off = Math.exp(-((tg / 2) ** 2) / (2 * s * s))
  const norm = s * Math.sqrt(2 * Math.PI) * erf(tg / (2 * Math.SQRT2 * s)) - tg * off
  return (area * (Math.exp(-((t - t0 - tg / 2) ** 2) / (2 * s * s)) - off)) / norm
}

function erf(x) {                    // Abramowitz-Stegun 7.1.26 (error < 1.5e-7)
  const t = 1 / (1 + 0.3275911 * Math.abs(x))
  const y = 1 - ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x)
  return x >= 0 ? y : -y
}

export const CHANNELS = ['x1', 'y1', 'x2', 'y2', 'J']

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

// ---------- modelo ----------
function buildModel({ T1, T2, deltaMHz = 0, t1q = 20, areaErr = 0 }) {
  const { sched, tf, gates } = groverSchedule(t1q, 2 * t1q, areaErr)
  const coeff = CHANNELS.map((c) => (t) => sched[c].reduce((s, [t0, tg, a]) => s + gaussPulse(t, t0, tg, a), 0))
  const Hterms = [scale(OPS.X1, 0.5), scale(OPS.Y1, 0.5), scale(OPS.X2, 0.5), scale(OPS.Y2, 0.5), OPS.P11]
  const H0 = zeros()
  addScaled(H0, OPS.Z1, (deltaMHz * MHz) / 2)
  addScaled(H0, OPS.Z2, (deltaMHz * MHz) / 2)

  const g1 = isFinite(T1) ? 1 / T1 : 0
  const gphi = (isFinite(T2) ? 1 / T2 : 0) - g1 / 2
  if (gphi < -1e-15) throw new Error('T2 > 2·T1 no es físico')
  const Ls = []
  for (const j of [0, 1]) {
    if (g1 > 0) Ls.push(scale(onQ(SM, j), Math.sqrt(g1)))
    if (gphi > 0) Ls.push(scale(onQ(SZ, j), Math.sqrt(gphi / 2)))
  }
  const Lterms = Ls.map((L) => ({ L, Ld: dag(L), LdL: mul(dag(L), L) }))

  const H = (t) => {
    const M = H0.slice()
    coeff.forEach((f, m) => { const c = f(t); if (c !== 0) addScaled(M, Hterms[m], c) })
    return M
  }

  // lado derecho del sistema de 40 EDOs reales
  const f = (t, y) => {
    const rho = y.subarray(0, 32), psi = y.subarray(32)
    const Ht = H(t)
    const dy = new Float64Array(40)
    const Hr = mul(Ht, rho), rH = mul(rho, Ht)
    for (let i = 0; i < 32; i += 2) {           // −i(Hρ − ρH):  −i·(a + ib) = b − ia
      dy[i] = Hr[i + 1] - rH[i + 1]
      dy[i + 1] = -(Hr[i] - rH[i])
    }
    for (const { L, Ld, LdL } of Lterms) {
      const LrLd = mul(mul(L, rho), Ld), A1 = mul(LdL, rho), A2 = mul(rho, LdL)
      for (let i = 0; i < 32; i++) dy[i] += LrLd[i] - 0.5 * (A1[i] + A2[i])
    }
    for (let i = 0; i < D; i++) {                // −iHψ
      let re = 0, im = 0
      for (let k = 0; k < D; k++) {
        const hr = Ht[2 * (i * D + k)], hi = Ht[2 * (i * D + k) + 1], pr = psi[2 * k], pi = psi[2 * k + 1]
        re += hr * pr - hi * pi
        im += hr * pi + hi * pr
      }
      dy[32 + 2 * i] = im
      dy[32 + 2 * i + 1] = -re
    }
    return dy
  }
  return { f, H, coeff, tf, gates }
}

// ---------- integradores explícitos ----------
const axpy = (y, h, k) => { const o = new Float64Array(y.length); for (let i = 0; i < y.length; i++) o[i] = y[i] + h * k[i]; return o }

export const STEPPERS = {
  Euler: (f, t, y, h) => axpy(y, h, f(t, y)),
  Heun: (f, t, y, h) => {
    const k1 = f(t, y), k2 = f(t + h, axpy(y, h, k1))
    return y.map((v, i) => v + (h / 2) * (k1[i] + k2[i]))
  },
  RK4: (f, t, y, h) => {
    const k1 = f(t, y), k2 = f(t + h / 2, axpy(y, h / 2, k1))
    const k3 = f(t + h / 2, axpy(y, h / 2, k2)), k4 = f(t + h, axpy(y, h, k3))
    return y.map((v, i) => v + (h / 6) * (k1[i] + 2 * k2[i] + 2 * k3[i] + k4[i]))
  },
}

// ---------- diagnósticos ----------
// valores propios de una matriz real simétrica (Jacobi cíclico)
function eigSym(A, n) {
  A = A.slice()
  for (let sweep = 0; sweep < 50; sweep++) {
    let off = 0
    for (let p = 0; p < n; p++) for (let q = p + 1; q < n; q++) off += A[p * n + q] ** 2
    if (off < 1e-22) break
    for (let p = 0; p < n; p++)
      for (let q = p + 1; q < n; q++) {
        const apq = A[p * n + q]
        if (Math.abs(apq) < 1e-300) continue
        const th = (A[q * n + q] - A[p * n + p]) / (2 * apq)
        const t = Math.sign(th || 1) / (Math.abs(th) + Math.sqrt(th * th + 1))
        const c = 1 / Math.sqrt(t * t + 1), s = t * c
        for (let k = 0; k < n; k++) {
          const akp = A[k * n + p], akq = A[k * n + q]
          A[k * n + p] = c * akp - s * akq
          A[k * n + q] = s * akp + c * akq
        }
        for (let k = 0; k < n; k++) {
          const apk = A[p * n + k], aqk = A[q * n + k]
          A[p * n + k] = c * apk - s * aqk
          A[q * n + k] = s * apk + c * aqk
        }
      }
  }
  return Array.from({ length: n }, (_, i) => A[i * n + i])
}

// λ_min de la parte hermítica de ρ: la matriz real [[Re, −Im], [Im, Re]] (8×8) tiene los mismos valores propios, duplicados
function lambdaMin(rho) {
  const M = new Float64Array(64)
  for (let i = 0; i < D; i++)
    for (let j = 0; j < D; j++) {
      const re = 0.5 * (rho[2 * (i * D + j)] + rho[2 * (j * D + i)])
      const im = 0.5 * (rho[2 * (i * D + j) + 1] - rho[2 * (j * D + i) + 1])
      M[i * 8 + j] = re; M[(i + 4) * 8 + j + 4] = re
      M[i * 8 + j + 4] = -im; M[(i + 4) * 8 + j] = im
    }
  return Math.min(...eigSym(M, 8))
}

const expect = (rho, O) => {           // Re Tr(ρ O)
  let s = 0
  for (let i = 0; i < D; i++) for (let j = 0; j < D; j++) {
    const a = 2 * (i * D + j), b = 2 * (j * D + i)
    s += rho[a] * O[b] - rho[a + 1] * O[b + 1]
  }
  return s
}

export function diagnostics(y) {
  const rho = y.subarray(0, 32), psi = y.subarray(32)
  let tr = 0, herm = 0, pur = 0, nrm = 0, F = 0
  const pops = []
  for (let i = 0; i < D; i++) { pops.push(rho[2 * (i * D + i)]); tr += rho[2 * (i * D + i)] }
  for (let i = 0; i < D; i++) for (let j = 0; j < D; j++) {
    const a = 2 * (i * D + j), b = 2 * (j * D + i)
    herm = Math.max(herm, Math.hypot(rho[a] - rho[b], rho[a + 1] + rho[b + 1]))
    pur += rho[a] * rho[b] - rho[a + 1] * rho[b + 1]                  // Re Tr(ρ²)
    // F = ψ† ρ ψ
    const pr = psi[2 * i], pi = -psi[2 * i + 1], qr = psi[2 * j], qi = psi[2 * j + 1]
    const xr = rho[a] * qr - rho[a + 1] * qi, xi = rho[a] * qi + rho[a + 1] * qr
    F += pr * xr - pi * xi
  }
  for (let i = 0; i < 8; i++) nrm += psi[i] ** 2
  return {
    pops, trazaErr: Math.abs(tr - 1), hermErr: herm, pureza: pur, normaPsi: Math.sqrt(nrm),
    fidelidad: F / nrm, lambdaMin: lambdaMin(rho),
    bloch1: [expect(rho, OPS.X1), expect(rho, OPS.Y1), expect(rho, OPS.Z1)],
    bloch2: [expect(rho, OPS.X2), expect(rho, OPS.Y2), expect(rho, OPS.Z2)],
  }
}

// ---------- simulación completa ----------
export function simulate({ T1 = Infinity, T2 = Infinity, deltaMHz = 0, t1q = 20, areaErr = 0, method = 'RK4', h = 0.25 } = {}) {
  const model = buildModel({ T1, T2, deltaMHz, t1q, areaErr })
  const step = STEPPERS[method]
  const N = Math.round(model.tf / h)
  if (Math.abs(N * h - model.tf) > 1e-9) throw new Error('h debe dividir la duración de las compuertas')
  const every = Math.max(1, Math.round(1 / h))      // guarda ~1 cuadro por ns
  let y = new Float64Array(40)
  y[0] = 1; y[32] = 1                                 // ρ = |00⟩⟨00|, ψ = |00⟩
  const frames = [{ t: 0, y }]
  const t0 = performance.now()
  for (let n = 0; n < N; n++) {
    y = step(model.f, n * h, y, h)
    if ((n + 1) % every === 0 || n === N - 1) frames.push({ t: (n + 1) * h, y })
  }
  const cpuMs = performance.now() - t0
  const out = frames.map(({ t, y }) => ({ t, rho: y.slice(0, 32), ...diagnostics(y) }))
  return {
    frames: out, gates: model.gates, tf: model.tf, cpuMs, evals: N * { Euler: 1, Heun: 2, RK4: 4 }[method],
    pulses: Object.fromEntries(CHANNELS.map((c, m) => [c, out.map(({ t }) => model.coeff[m](t))])),
  }
}
