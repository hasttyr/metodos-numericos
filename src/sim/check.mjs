// Pruebas automáticas del simulador en JS (npm test).
// 1) álgebra lineal propia, 2) soluciones analíticas, 3) Grover ideal, 4) orden de convergencia,
// 5) invariantes y positividad, 6) RK45, 7) coincidencia con la trayectoria exportada por Python.
import { readFileSync } from 'node:fs'
import assert from 'node:assert/strict'
import * as LA from './linalg.js'
import { simulate, buildProcessor, buildOneQubit, integrate, integrateRK45, STEPPERS, FIXED, ORDER, PSI00, rhoOf, diagnostics } from './quantum.js'

const ok = (msg) => console.log(`✔ ${msg}`)
const maxAbs = (a, b) => a.reduce((m, v, i) => Math.max(m, Math.abs(v - b[i])), 0)

// ---------- 1) álgebra lineal
{
  let seed = 12345
  const rnd = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648 - 0.5 }   // LCG reproducible
  const n = 20, M = new Float64Array(2 * n * n).map(rnd), b = new Float64Array(2 * n).map(rnd)
  const x = LA.solve(M, b, n)
  assert.ok(maxAbs(LA.matvec(M, x, n), b) < 1e-12, 'LU: residuo grande')
  const th = 1.3, G = Float64Array.of(0, 0, -th, 0, th, 0, 0, 0)        // [[0, −θ], [θ, 0]]
  const E = LA.expm(G, 2)
  assert.ok(maxAbs(E, [Math.cos(th), 0, -Math.sin(th), 0, Math.sin(th), 0, Math.cos(th), 0]) < 1e-14, 'expm: rotación')
  const big = LA.expm(Float64Array.of(-30, 0), 1)[0]
  assert.ok(Math.abs(big / Math.exp(-30) - 1) < 1e-13, 'expm con scaling and squaring')
  ok('LU con pivoteo y exponencial de Padé [6/6]')
}

// ---------- 2) soluciones analíticas de 1 qubit (como E1)
{
  const W0 = 2 * Math.PI * 0.05
  const rabi = buildOneQubit({ omega: () => W0 })
  const T1 = 1000, decay = buildOneQubit({ T1 })
  for (const m of FIXED) {
    const r = integrate(m, rabi, rabi.y0(Float64Array.of(1, 0, 0, 0)), 0, 100, 0.5)
    const errR = Math.max(...r.ts.map((t, k) => Math.abs(rhoOf(r.ys[k], 2)[6] - Math.sin(W0 * t / 2) ** 2)))
    const d = integrate(m, decay, decay.y0(Float64Array.of(0, 0, 1, 0)), 0, 3000, 10)
    const errT = Math.max(...d.ts.map((t, k) => Math.abs(rhoOf(d.ys[k], 2)[6] - Math.exp(-t / T1))))
    const tolR = { Euler: 10, Heun: 0.1, RK4: 1e-4, 'Crank-Nicolson': 0.05, Magnus4: 1e-12 }[m]
    assert.ok(errR < tolR, `${m}: error Rabi ${errR}`)
    assert.ok(errT < 3e-3, `${m}: error T1 ${errT}`)
  }
  ok('Rabi y decaimiento T₁ contra la solución exacta (5 métodos de paso fijo)')
}

// ---------- 3) Grover ideal
for (const m of ['RK4', 'Magnus4']) {
  const P11 = simulate({ method: m, h: 0.25 }).frames.at(-1).pops[3]
  assert.ok(Math.abs(P11 - 1) < 1e-5, `Grover ideal con ${m}: P11 = ${P11}`)
}
ok('Grover ideal: P(|11⟩) = 1 con RK4 y Magnus 4')

// ---------- 4) orden de convergencia (E2 reducido)
{
  const sys = buildProcessor({ T1: 20000, T2: 15000 }), y0 = sys.y0(PSI00)
  const yRef = integrate('Magnus4', sys, y0, 0, sys.tf, 1 / 32, 1e9).ys.at(-1)
  const hs = { Euler: [0.25, 0.125, 0.0625], Heun: [0.5, 0.25, 0.125], RK4: [1, 0.5, 0.25], 'Crank-Nicolson': [0.5, 0.25, 0.125], Magnus4: [2, 1, 0.5] }
  const out = []
  for (const m of FIXED) {
    const e = hs[m].map((h) => maxAbs(integrate(m, sys, y0, 0, sys.tf, h, 1e9).ys.at(-1), yRef))
    const p = Math.log(e[0] / e[2]) / Math.log(hs[m][0] / hs[m][2])
    out.push(`${m} ${p.toFixed(2)}`)
    assert.ok(Math.abs(p - ORDER[m]) < 0.25, `${m}: orden medido ${p}`)
  }
  ok(`orden de convergencia: ${out.join(' · ')}`)
}

// ---------- 5) invariantes y positividad
{
  for (const m of FIXED) {
    const r = simulate({ T1: 1000, T2: 1000, method: m, h: 1 })
    assert.ok(Math.max(...r.frames.map((f) => f.trazaErr)) < 1e-12, `${m}: traza`)
    assert.ok(Math.max(...r.frames.map((f) => f.hermErr)) < 1e-12, `${m}: hermiticidad`)
  }
  for (const m of ['Crank-Nicolson', 'Magnus4']) {
    const n = simulate({ method: m, h: 2 }).frames.at(-1).normaPsi
    assert.ok(Math.abs(n - 1) < 1e-12, `${m}: ‖ψ‖ = ${n}`)
  }
  assert.ok(simulate({ method: 'Euler', h: 1 }).frames.at(-1).normaPsi > 1.5, 'Euler debería aumentar ‖ψ‖')
  const euler = simulate({ T1: 1000, T2: 1000, method: 'Euler', h: 2 })
  assert.ok(Math.min(...euler.frames.map((f) => f.lambdaMin)) < -1, 'Euler debería romper la positividad')
  ok('traza y hermiticidad conservadas (todos); ‖ψ‖ exacta con CN y Magnus; Euler rompe ‖ψ‖ y λ_min')
}

// ---------- 6) RK45: el error sigue a la tolerancia
{
  const sys = buildProcessor({ T1: 20000, T2: 15000 }), y0 = sys.y0(PSI00)
  const yRef = integrate('Magnus4', sys, y0, 0, sys.tf, 1 / 32, 1e9).ys.at(-1)
  const e = [1e-5, 1e-8].map((tol) => maxAbs(integrateRK45(sys, y0, 0, sys.tf, { rtol: tol, atol: tol * 1e-2 }).ys.at(-1), yRef))
  assert.ok(e[1] < 1e-6 && e[0] / e[1] > 100, `RK45: errores ${e}`)
  ok(`RK45: error ${e[0].toExponential(1)} (tol 1e-5) → ${e[1].toExponential(1)} (tol 1e-8), notebook: 1.7e-3 → 4.5e-7; con tol 1e-8 el controlador elige otra secuencia de pasos por diferencias de redondeo, mismo orden de magnitud`)
}

// ---------- 7) misma trayectoria que Python (T1 = 2 µs, T2 = 1.5 µs, Magnus 4, h = 0.25 ns)
const ref = JSON.parse(readFileSync(new URL('../../public/datos.json', import.meta.url), 'utf8'))
{
  const { T1_ns, T2_ns } = ref.parametros
  const diff = (m) => {
    const js = simulate({ T1: T1_ns, T2: T2_ns, method: m, h: 0.25 })
    assert.equal(js.frames.length, ref.t.length)
    let d = 0
    js.frames.forEach((fr, k) => fr.pops.forEach((p, i) => { d = Math.max(d, Math.abs(p - ref.poblaciones[k][i])) }))
    return [d, js.cpuMs]
  }
  const [dM, cM] = diff('Magnus4'), [dR, cR] = diff('RK4')
  assert.ok(dM < 1e-10, `JS Magnus4 vs Python Magnus4: ${dM}`)
  assert.ok(dR < 1e-5, `JS RK4 vs Python Magnus4: ${dR}`)
  ok(`JS vs Python: Magnus4 ${dM.toExponential(1)} (mismo método) · RK4 ${dR.toExponential(1)} · CPU ${cM.toFixed(0)} / ${cR.toFixed(0)} ms`)
}

// ---------- 8) ρ completa (coherencias incluidas), casos borde y RK45 con rejilla de salida
{
  const { T1_ns, T2_ns } = ref.parametros
  const js = simulate({ T1: T1_ns, T2: T2_ns, method: 'Magnus4', h: 0.25 })
  let d = 0
  js.frames.forEach((fr, k) => { for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) {
    d = Math.max(d, Math.abs(fr.rho[2 * (i * 4 + j)] - ref.rho_re[k][i][j]), Math.abs(fr.rho[2 * (i * 4 + j) + 1] - ref.rho_im[k][i][j]))
  } })
  assert.ok(d < 1e-10, `ρ completa JS vs Python: ${d}`)
  assert.doesNotThrow(() => buildProcessor({ T1: 20000 }), 'T2 por defecto debe ser 2·T1')
  assert.throws(() => integrate('RK4', buildProcessor(), buildProcessor().y0(PSI00), 0, 240, 0.7), /dividir/)
  const sys = buildProcessor({ T1: 20000, T2: 15000 }), y0 = sys.y0(PSI00)
  const tOut = Array.from({ length: 240 }, (_, i) => i + 1)
  const free = integrateRK45(sys, y0, 0, sys.tf, { rtol: 1e-6, atol: 1e-8 })
  const grid = integrateRK45(sys, y0, 0, sys.tf, { rtol: 1e-6, atol: 1e-8, tOut })
  assert.equal(grid.ts.length, 241)
  assert.ok(grid.ts.every((t, i) => Math.abs(t - i) < 1e-9), 'RK45 debe caer en la rejilla de salida')
  assert.ok(grid.steps.length < 2.5 * free.steps.length, `RK45 con rejilla: ${grid.steps.length} pasos vs ${free.steps.length}`)
  ok(`ρ completa (Re e Im) JS vs Python ${d.toExponential(1)}; T₂ por defecto, h que no divide y RK45 con rejilla de salida`)
}
