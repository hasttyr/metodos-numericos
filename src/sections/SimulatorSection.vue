<script setup>
import { ref, shallowRef, computed, watch, onBeforeUnmount } from 'vue'
import { simulate, CHANNELS, METHODS } from '../sim/quantum.js'
import { params as p, physical } from '../store.js'
import { AX, STATES, METHOD_COLORS, fmt, gateShapes } from '../ui.js'
import BlochSphere from '../components/BlochSphere.vue'
import Cityscape from '../components/Cityscape.vue'
import PlotlyChart from '../components/PlotlyChart.vue'

const T1us = computed(() => 10 ** p.logT1)
const T2us = computed(() => 10 ** p.logT2)
watch(() => p.logT1, () => { if (p.logT2 > p.logT1 + Math.log10(2)) p.logT2 = p.logT1 + Math.log10(2) })   // T2 ≤ 2·T1

const INFO = {
  Euler: { orden: 1, evals: '1 evaluación de A por paso', nota: 'No contiene el eje imaginario: amplifica toda oscilación. Pruebe h = 1 ns.' },
  Heun: { orden: 2, evals: '2 evaluaciones de A por paso', nota: '|R(iy)|² = 1 + y⁴/4: también crece, pero mucho más despacio.' },
  RK4: { orden: 4, evals: '3 evaluaciones de A por paso', nota: 'Estable en el eje imaginario hasta |hλ| ≤ 2√2. Pruebe h = 2 ns: estable pero impreciso.' },
  RK45: { orden: '5(4)', evals: '6 evaluaciones por paso aceptado', nota: 'Paso adaptativo: lo elige el estimador de error. Vea abajo los pasos aceptados y rechazados.' },
  'Crank-Nicolson': { orden: 2, evals: '1 evaluación + 1 sistema lineal (LU) por paso', nota: 'A-estable y conserva ‖ψ‖ exactamente, pero λ_min puede quedar negativo.' },
  Magnus4: { orden: 4, evals: '2 evaluaciones + 1 exponencial de matriz por paso', nota: 'Conserva ‖ψ‖ exactamente. Pruebe h = 5 ns: sigue dando P(11) correcto, porque aquí los pulsos conmutan dentro de cada paso.' },
}

const result = shallowRef(null)    // shallowRef: Vue no debe envolver en proxies los arreglos grandes
const error = ref('')
let pending = 0
function run() {
  clearTimeout(pending)
  const slow = p.method === 'Magnus4' || p.method === 'Crank-Nicolson' || (p.method === 'RK45' && p.logTol < -8)
  pending = setTimeout(() => {        // agrupa cambios rápidos de los deslizadores (más espera si el método es caro)
    try {
      result.value = simulate({ ...physical(), method: p.method, h: p.h, rtol: 10 ** p.logTol })
      error.value = ''
      k.value = Math.min(k.value, result.value.frames.length - 1)
    } catch (e) { error.value = e.message }
  }, slow ? 150 : 16)
}

// ---------------- reproducción ----------------
const k = ref(0)
const playing = ref(false)
const speed = ref(30)   // ns de simulación por segundo real
let raf, last, acc = 0
function tick(now) {
  if (!playing.value) return
  acc += ((now - (last ?? now)) / 1000) * speed.value
  last = now
  const fr = result.value.frames
  while (k.value < fr.length - 1 && acc >= fr[k.value + 1].t - fr[k.value].t) { acc -= fr[k.value + 1].t - fr[k.value].t; k.value++ }
  if (k.value >= fr.length - 1) { k.value = fr.length - 1; playing.value = false }
  raf = requestAnimationFrame(tick)
}
function togglePlay() {
  if (!playing.value && k.value >= result.value.frames.length - 1) k.value = 0
  playing.value = !playing.value
  last = undefined; acc = 0
  cancelAnimationFrame(raf)
  if (playing.value) raf = requestAnimationFrame(tick)
}
onBeforeUnmount(() => { cancelAnimationFrame(raf); clearTimeout(pending) })

watch(p, run)
// la primera simulación es síncrona para que la página no arranque vacía
result.value = simulate({ ...physical(), method: p.method, h: p.h, rtol: 10 ** p.logTol })

const frame = computed(() => result.value.frames[k.value])
const final = computed(() => result.value.frames.at(-1))
const bloch1 = computed(() => result.value.frames.map((f) => f.bloch1))
const bloch2 = computed(() => result.value.frames.map((f) => f.bloch2))
const rhoPart = ref('re')
const currentGate = computed(() => result.value.gates.find((g) => frame.value.t >= g.t0 && frame.value.t <= g.t1)?.nombre ?? '—')

const worst = computed(() => {
  const f = result.value.frames
  return {
    lmin: Math.min(...f.map((x) => x.lambdaMin)), pur: Math.max(...f.map((x) => x.pureza)),
    norm: f.at(-1).normaPsi, tr: Math.max(...f.map((x) => x.trazaErr)), herm: Math.max(...f.map((x) => x.hermErr)),
  }
})
const metrics = computed(() => {
  const f = frame.value
  return [
    { label: 'Fidelidad F', value: fmt(f.fidelidad), bad: false },
    { label: 'Pureza Tr ρ²', value: fmt(f.pureza), bad: f.pureza > 1 + 1e-6, why: 'mayor que 1: el método creó información' },
    { label: 'λ mín(ρ)', value: fmt(f.lambdaMin, 5), bad: f.lambdaMin < -1e-6, why: 'negativo: probabilidades imposibles' },
    { label: '‖ψ‖ ideal', value: fmt(f.normaPsi, 6), bad: Math.abs(f.normaPsi - 1) > 1e-3, why: 'la norma debería ser 1' },
    { label: '|Tr ρ − 1|', value: fmt(f.trazaErr), bad: f.trazaErr > 1e-6 },
    { label: '‖ρ − ρ†‖', value: fmt(f.hermErr), bad: f.hermErr > 1e-6 },
  ]
})

// ---------------- gráficas ----------------
const CRT_AX = { gridcolor: '#24402a', zerolinecolor: '#2f5a37', linecolor: '#2f5a37', color: '#8fe3a0' }
const PULSE_COLORS = { x1: '#7dff9b', y1: '#ffb547', x2: '#5ee7ff', y2: '#ff8a5c', J: '#fff27a' }
const PULSE_NAMES = { x1: 'Ωx,1', y1: 'Ωy,1', x2: 'Ωx,2', y2: 'Ωy,2', J: 'J (CZ)' }
const SCOPE_POP = ['#9fb8a3', '#5ee7ff', '#ffb547', '#7dff9b']
const POP_COLORS = ['#a8977a', '#2f6f6a', '#d99a2b', '#5b6b1f']

const scopeData = computed(() => {
  const r = result.value, t = r.frames.map((f) => f.t)
  return [
    ...CHANNELS.map((c) => ({ x: t, y: r.pulses[c], name: PULSE_NAMES[c], line: { color: PULSE_COLORS[c], width: 1.6 }, hoverinfo: 'skip' })),
    ...STATES.map((s, i) => ({ x: t, y: r.frames.map((f) => f.pops[i]), name: `P${s}`, yaxis: 'y2', line: { color: SCOPE_POP[i], width: 2, dash: i === 0 ? 'dot' : 'solid' }, hoverinfo: 'skip' })),
  ]
})
const scopeLayout = computed(() => ({
  height: 360, margin: { l: 55, r: 15, t: 30, b: 80 },
  legend: { orientation: 'h', y: -0.2, bgcolor: 'rgba(0,0,0,0)' },
  font: { color: '#8fe3a0', size: 11, family: 'Space Mono, monospace' },
  xaxis: { ...CRT_AX, title: 't (ns)', range: [0, result.value.tf] },
  yaxis: { ...CRT_AX, domain: [0.58, 1], title: 'pulsos (rad/ns)' },
  yaxis2: { ...CRT_AX, domain: [0, 0.48], title: 'probabilidad', range: [-0.05, 1.08] },
  shapes: [
    ...result.value.gates.map((g) => ({ type: 'rect', xref: 'x', yref: 'paper', x0: g.t0, x1: g.t1, y0: 0, y1: 1, fillcolor: g.nombre === 'CZ' ? '#fff27a' : '#5ee7ff', opacity: 0.05, line: { width: 0 } })),
    { type: 'line', xref: 'x', yref: 'paper', x0: frame.value.t, x1: frame.value.t, y0: 0, y1: 1, line: { color: '#ffffff', width: 1.5, dash: 'dot' } },
  ],
  annotations: result.value.gates.map((g) => ({ x: (g.t0 + g.t1) / 2, y: 1.02, xref: 'x', yref: 'paper', text: g.nombre, showarrow: false, font: { size: 10, color: '#8fe3a0' } })),
}))

const histData = computed(() => [{
  type: 'bar', x: STATES, y: frame.value.pops, marker: { color: POP_COLORS },
  text: frame.value.pops.map((v) => (isFinite(v) ? v.toFixed(3) : '')), textposition: 'outside', hoverinfo: 'skip',
}])
const histLayout = { height: 230, margin: { l: 40, r: 10, t: 15, b: 30 }, yaxis: { ...AX, range: [-0.1, 1.15] }, xaxis: AX, showlegend: false }

const rkPlot = computed(() => {
  const r = result.value.rk45
  if (!r) return null
  return {
    data: [
      { x: r.steps.map((s) => s.t), y: r.steps.map((s) => s.h), mode: 'lines+markers', name: 'paso aceptado', line: { color: METHOD_COLORS.RK45, width: 1.5 }, marker: { size: 4 } },
      { x: r.rejections.map((s) => s.t + s.h), y: r.rejections.map((s) => s.h), mode: 'markers', name: 'paso rechazado', marker: { color: '#b5321f', symbol: 'x', size: 7 } },
    ],
    layout: { height: 240, xaxis: { ...AX, title: 't (ns)', range: [0, result.value.tf] }, yaxis: { ...AX, type: 'log', title: 'h (ns)' }, shapes: gateShapes(result.value.gates), margin: { l: 55, r: 15, t: 10, b: 42 } },
  }
})
</script>

<template>
  <header id="simulacion" class="sim-header">
    <div>
      <p class="kicker">1 · Simulador en vivo</p>
      <h2>Procesador cuántico de 2 qubits</h2>
      <p class="sub">El navegador resuelve las 40 EDOs reales de Lindblad + Schrödinger cada vez que se mueve un control.</p>
    </div>
    <div class="big">
      <span>P(|11⟩) final</span>
      <strong :class="{ warn: final.pops[3] < 0.9 || final.pops[3] > 1.0001 }">{{ fmt(final.pops[3]) }}</strong>
    </div>
  </header>

  <main class="sim">
    <aside class="card controls">
      <h2>Hardware</h2>
      <label class="check"><input type="checkbox" v-model="p.ideal" /> Qubits ideales (sin ruido)</label>
      <label :class="{ off: p.ideal }">T₁ (relajación) <b>{{ T1us.toFixed(2) }} µs</b>
        <input type="range" min="-0.5" max="2.5" step="0.01" v-model.number="p.logT1" :disabled="p.ideal" />
      </label>
      <label :class="{ off: p.ideal }">T₂ (coherencia) <b>{{ T2us.toFixed(2) }} µs</b>
        <input type="range" min="-0.8" :max="p.logT1 + Math.log10(2)" step="0.01" v-model.number="p.logT2" :disabled="p.ideal" />
      </label>
      <p class="hint">2009: T₁ ≈ T₂ ≈ 1 µs · hoy: ~100 µs. Siempre T₂ ≤ 2T₁.</p>

      <h2>Calibración</h2>
      <label>Desintonía Δ/2π <b>{{ p.deltaMHz.toFixed(1) }} MHz</b>
        <input type="range" min="-5" max="5" step="0.1" v-model.number="p.deltaMHz" />
      </label>
      <label>Error de área de los pulsos <b>{{ p.areaErrPct }} %</b>
        <input type="range" min="-20" max="20" step="1" v-model.number="p.areaErrPct" />
      </label>
      <label>Duración compuerta 1 qubit
        <select v-model.number="p.t1q"><option v-for="v in [10, 20, 40]" :key="v" :value="v">{{ v }} ns (CZ {{ 2 * v }} ns)</option></select>
      </label>

      <h2>Método numérico</h2>
      <div class="seg grid-seg">
        <button v-for="m in METHODS" :key="m" :aria-pressed="p.method === m" :class="{ on: p.method === m }" :style="{ '--mc': METHOD_COLORS[m] }" @click="p.method = m">{{ m === 'Crank-Nicolson' ? 'C-N' : m }}</button>
      </div>
      <label v-if="p.method !== 'RK45'">Paso h
        <select v-model.number="p.h"><option v-for="v in [0.125, 0.25, 0.5, 1, 2, 5]" :key="v" :value="v">{{ v }} ns ({{ Math.round(result.tf / v) }} pasos)</option></select>
      </label>
      <label v-else>Tolerancia rtol <b>10^{{ p.logTol }}</b>
        <input type="range" min="-10" max="-3" step="1" v-model.number="p.logTol" />
      </label>
      <p class="method-info"><b>Orden {{ INFO[p.method].orden }}</b> · {{ INFO[p.method].evals }}<br />{{ INFO[p.method].nota }}</p>
      <p class="hint">{{ result.cpuMs.toFixed(0) }} ms · {{ result.evals.toLocaleString('es') }} evaluaciones de A(t)<template v-if="result.rk45"> · {{ result.rk45.steps.length }} pasos, {{ result.rk45.rejected }} rechazados</template></p>
      <p v-if="error" class="err">{{ error }}</p>

      <h2>Diagnósticos en t = {{ frame.t.toFixed(0) }} ns</h2>
      <dl class="metrics">
        <template v-for="m in metrics" :key="m.label">
          <dt>{{ m.label }}</dt>
          <dd :class="{ bad: m.bad }" :title="m.bad ? m.why : ''">{{ m.value }}</dd>
        </template>
      </dl>
      <p class="hint">Peor valor en toda la trayectoria: λ_min = {{ fmt(worst.lmin, 5) }} · pureza máx. = {{ fmt(worst.pur) }} · |Tr ρ − 1| ≤ {{ fmt(worst.tr) }}</p>
    </aside>

    <section class="stage">
      <div class="card player">
        <button class="play" :aria-label="playing ? 'Pausar' : 'Reproducir'" @click="togglePlay">{{ playing ? '❚❚' : '▶' }}</button>
        <input type="range" min="0" :max="result.frames.length - 1" v-model.number="k" aria-label="Instante de la animación" @input="playing = false" />
        <span class="time">t = {{ frame.t.toFixed(0) }} / {{ result.tf }} ns · <b>{{ currentGate }}</b></span>
        <label class="speed">velocidad
          <select v-model.number="speed"><option :value="10">lenta</option><option :value="30">normal</option><option :value="90">rápida</option></select>
        </label>
      </div>

      <div class="grid3">
        <div class="card">
          <h3>Qubit 1 · esfera de Bloch</h3>
          <BlochSphere :traj="bloch1" :k="k" color="#b5321f" />
        </div>
        <div class="card">
          <h3>Qubit 2 · esfera de Bloch</h3>
          <BlochSphere :traj="bloch2" :k="k" color="#2f6f6a" />
        </div>
        <div class="card">
          <h3>Cityscape de ρ
            <span class="seg small"><button :class="{ on: rhoPart === 're' }" @click="rhoPart = 're'">Re</button><button :class="{ on: rhoPart === 'im' }" @click="rhoPart = 'im'">Im</button></span>
          </h3>
          <Cityscape :rho="frame.rho" :part="rhoPart" />
        </div>
      </div>
      <p class="explain">La flecha es el vector de Bloch de cada qubit (traza parcial de ρ). Gira con los pulsos y se encoge hacia el centro cuando los qubits se entrelazan o pierden coherencia por el ruido. El cityscape muestra los 16 elementos de ρ: la diagonal son probabilidades y lo demás son coherencias, que el ruido apaga.</p>

      <div class="grid2">
        <div class="card crt">
          <h3>Osciloscopio: pulsos de control y probabilidades</h3>
          <div class="screen"><PlotlyChart :data="scopeData" :layout="scopeLayout" /></div>
        </div>
        <div class="card">
          <h3>Medición en t = {{ frame.t.toFixed(0) }} ns</h3>
          <PlotlyChart :data="histData" :layout="histLayout" />
          <p class="explain">Al final, Grover debe encontrar |11⟩ con probabilidad 1. El ruido, los errores de calibración y un mal método numérico la cambian.</p>
        </div>
      </div>

      <div v-if="rkPlot" class="card">
        <h3>RK45: tamaño de paso elegido por el control de error</h3>
        <PlotlyChart v-bind="rkPlot" />
        <p class="explain">Corrida libre de RK45 (la animación de arriba usa además pasos recortados a una rejilla de 1 ns; el estado final y P(11) son los de la corrida libre). Cada punto es un paso aceptado y cada × un paso rechazado (el error estimado superó la tolerancia y se repitió con un h menor). Cerca de los bordes de los pulsos, donde la derivada de A(t) salta, el control rechaza más pasos. Baje la tolerancia para ver cómo se achica h.</p>
      </div>
    </section>
  </main>
</template>
