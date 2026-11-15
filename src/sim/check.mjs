// Autoprueba: el simulador en JS debe reproducir la trayectoria que exporta el notebook de Python.
// Uso: npm test
import { readFileSync } from 'node:fs'
import assert from 'node:assert/strict'
import { simulate } from './quantum.js'

const ref = JSON.parse(readFileSync(new URL('../../public/datos.json', import.meta.url), 'utf8'))

// 1) Grover ideal: P(|11⟩) = 1
const ideal = simulate({ method: 'RK4', h: 0.25 })
const P11 = ideal.frames.at(-1).pops[3]
assert.ok(Math.abs(P11 - 1) < 1e-5, `Grover ideal: P11 = ${P11}`)

// 2) misma trayectoria que Python (T1 = 2 µs, T2 = 1.5 µs)
const { T1_ns, T2_ns } = ref.parametros
const js = simulate({ T1: T1_ns, T2: T2_ns, method: 'RK4', h: 0.25 })
assert.equal(js.frames.length, ref.t.length)
let maxDiff = 0
js.frames.forEach((fr, k) => fr.pops.forEach((p, i) => { maxDiff = Math.max(maxDiff, Math.abs(p - ref.poblaciones[k][i])) }))
assert.ok(maxDiff < 1e-5, `JS vs Python: diferencia máxima ${maxDiff}`)

// 3) λ_min del estado inicial puro = 0, y Euler con h grande produce probabilidades negativas
assert.ok(Math.abs(ideal.frames[0].lambdaMin) < 1e-12)
const euler = simulate({ T1: 1000, T2: 1000, method: 'Euler', h: 2 })
assert.ok(Math.min(...euler.frames.map((f) => f.lambdaMin)) < -1, 'Euler debería romper la positividad')

console.log(`✔ Grover ideal P11 = ${P11.toFixed(8)}`)
console.log(`✔ JS vs Python: diferencia máxima en poblaciones = ${maxDiff.toExponential(2)}`)
console.log(`✔ RK4 (h = 0.25 ns) en ${js.cpuMs.toFixed(0)} ms`)
