<script setup>
import { ref, shallowRef, reactive, computed, watch, onMounted, onBeforeUnmount } from 'vue'
import { simulate, CHANNELS } from './sim/quantum.js'
import BlochSphere from './components/BlochSphere.vue'
import Cityscape from './components/Cityscape.vue'
import PlotlyChart from './components/PlotlyChart.vue'
import Cover from './components/Cover.vue'

// ---------------- parámetros del procesador ----------------
const p = reactive({ logT1: Math.log10(2), logT2: Math.log10(1.5), ideal: false, deltaMHz: 0, areaErrPct: 0, t1q: 20, method: 'RK4', h: 0.25 })
const T1us = computed(() => 10 ** p.logT1)
const T2us = computed(() => 10 ** p.logT2)
watch(() => p.logT1, () => { if (p.logT2 > p.logT1 + Math.log10(2)) p.logT2 = p.logT1 + Math.log10(2) })   // T2 ≤ 2·T1

const result = shallowRef(null)    // shallowRef: Vue no debe envolver en proxies los arreglos grandes
const error = ref('')
function run() {
  try {
    result.value = simulate({
      T1: p.ideal ? Infinity : T1us.value * 1000, T2: p.ideal ? Infinity : T2us.value * 1000,
      deltaMHz: p.deltaMHz, areaErr: p.areaErrPct / 100, t1q: p.t1q, method: p.method, h: p.h,
    })
    error.value = ''
    k.value = Math.min(k.value, result.value.frames.length - 1)
  } catch (e) { error.value = e.message }
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
  while (acc >= fr[1].t - fr[0].t) { acc -= fr[1].t - fr[0].t; k.value++ }
  if (k.value >= fr.length - 1) { k.value = fr.length - 1; playing.value = false }
  raf = requestAnimationFrame(tick)
}
function togglePlay() {
  if (!playing.value && k.value >= result.value.frames.length - 1) k.value = 0
  playing.value = !playing.value
  last = undefined; acc = 0
  if (playing.value) raf = requestAnimationFrame(tick)
}
onBeforeUnmount(() => cancelAnimationFrame(raf))

watch(p, run, { immediate: true })

const frame = computed(() => result.value.frames[k.value])
const final = computed(() => result.value.frames.at(-1))
const bloch1 = computed(() => result.value.frames.map((f) => f.bloch1))
const bloch2 = computed(() => result.value.frames.map((f) => f.bloch2))
const rhoPart = ref('re')
const currentGate = computed(() => result.value.gates.find((g) => frame.value.t >= g.t0 && frame.value.t <= g.t1)?.nombre ?? '—')

const fmt = (v, d = 4) => (isFinite(v) ? (Math.abs(v) > 1e4 || (Math.abs(v) < 1e-3 && v !== 0) ? v.toExponential(2) : v.toFixed(d)) : '∞')
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
const AX = { gridcolor: '#e2d3b2', zerolinecolor: '#b9a47c', linecolor: '#2b2118' }
const CRT_AX = { gridcolor: '#24402a', zerolinecolor: '#2f5a37', linecolor: '#2f5a37', color: '#8fe3a0' }
// trazas del osciloscopio: tonos fósforo (verde, ámbar, cian) sobre pantalla CRT
const PULSE_COLORS = { x1: '#7dff9b', y1: '#ffb547', x2: '#5ee7ff', y2: '#ff8a5c', J: '#fff27a' }
const PULSE_NAMES = { x1: 'Ωx,1', y1: 'Ωy,1', x2: 'Ωx,2', y2: 'Ωy,2', J: 'J (CZ)' }
const SCOPE_POP = ['#9fb8a3', '#5ee7ff', '#ffb547', '#7dff9b']
const POP_COLORS = ['#a8977a', '#2f6f6a', '#d99a2b', '#5b6b1f']
const STATES = ['|00⟩', '|01⟩', '|10⟩', '|11⟩']

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

// ---------------- análisis (datos exportados por el notebook) ----------------
const datos = shallowRef(null)
const tab = ref('E8')
const jsVsPy = ref(null)
onMounted(async () => {
  datos.value = await (await fetch('/datos.json')).json()
  const { T1_ns, T2_ns } = datos.value.parametros
  const js = simulate({ T1: T1_ns, T2: T2_ns, method: 'RK4', h: 0.25 })
  jsVsPy.value = Math.max(...js.frames.flatMap((f, i) => f.pops.map((v, j) => Math.abs(v - datos.value.poblaciones[i][j]))))
})

const e8 = computed(() => {
  const E = datos.value.E8
  return {
    data: [
      { type: 'contour', x: E.T1_us, y: E.T2_us, z: E.P11, zmin: 0.75, zmax: 1,
        colorscale: [[0, '#b5321f'], [0.35, '#e07a2e'], [0.65, '#d99a2b'], [1, '#5b6b1f']],
        contours: { coloring: 'heatmap', showlabels: true, start: 0.8, end: 1, size: 0.05, labelfont: { color: '#f8f1e0' } },
        colorbar: { title: { text: 'P(|11⟩)' }, outlinewidth: 0 }, hovertemplate: 'T₁=%{x:.1f} µs<br>T₂=%{y:.1f} µs<br>P=%{z:.4f}<extra></extra>' },
      { x: E.T1_us, y: E.T1_us.map((v) => 2 * v), mode: 'lines', name: 'T₂ = 2T₁ (límite físico)', line: { color: '#2b2118', dash: 'dash' } },
      { x: [T1us.value], y: [T2us.value], mode: 'markers', name: 'configuración actual', marker: { size: 16, color: '#f8f1e0', symbol: 'star', line: { color: '#2b2118', width: 2 } } },
    ],
    layout: { height: 380, xaxis: { ...AX, type: 'log', title: 'T₁ (µs)' }, yaxis: { ...AX, type: 'log', title: 'T₂ (µs)', range: [0, Math.log10(400)] } },
  }
})

const METHOD_COLORS = { Euler: '#b5321f', Heun: '#e07a2e', RK4: '#5b6b1f', 'Crank-Nicolson': '#2f6f6a', Magnus4: '#7a4f8a' }
const e2 = computed(() => {
  const E = datos.value.E2
  return {
    data: Object.entries(E.error).map(([m, err]) => ({ x: E.h, y: err, mode: 'lines+markers', name: `${m} (pendiente ${E.pendiente[m].toFixed(2)})`, line: { color: METHOD_COLORS[m] } })),
    layout: { height: 380, xaxis: { ...AX, type: 'log', title: 'h (ns)' }, yaxis: { ...AX, type: 'log', title: 'error en el estado final', exponentformat: 'power' }, legend: { orientation: 'v', x: 1, xanchor: 'right', y: 0 } },
  }
})

// E4: regiones de estabilidad |R(hλ)| ≤ 1 y valores propios de A(t)·h con el h elegido en el panel
const R = {
  Euler: (x, y) => Math.hypot(1 + x, y),
  Heun: (x, y) => Math.hypot(1 + x + (x * x - y * y) / 2, y + x * y),
  RK4: (x, y) => {
    let re = 1, im = 0, tr = 1, ti = 0
    for (let n = 1; n <= 4; n++) { [tr, ti] = [(tr * x - ti * y) / n, (tr * y + ti * x) / n]; re += tr; im += ti }
    return Math.hypot(re, im)
  },
}
const e4 = computed(() => {
  const xs = Array.from({ length: 161 }, (_, i) => -4.5 + (i * 6) / 160), ys = Array.from({ length: 161 }, (_, i) => -4 + i / 20)
  const E = datos.value.E4
  return {
    data: [
      ...Object.entries(R).map(([m, f]) => ({
        type: 'contour', x: xs, y: ys, z: ys.map((y) => xs.map((x) => f(x, y))), name: m, showlegend: true, showscale: false,
        contours: { coloring: 'none', start: 1, end: 1, size: 1 }, line: { color: METHOD_COLORS[m], width: 2 }, hoverinfo: 'skip',
      })),
      { x: E.re.map((v) => v * p.h), y: E.im.map((v) => v * p.h), mode: 'markers', name: `h·λ(A(t)), h = ${p.h} ns`, marker: { size: 4, color: '#2b2118' } },
    ],
    layout: { height: 380, xaxis: { ...AX, title: 'Re(hλ)', range: [-4.5, 1.5] }, yaxis: { ...AX, title: 'Im(hλ)', range: [-4, 4], scaleanchor: 'x' } },
  }
})
</script>

<template>
  <Cover />

  <header id="simulacion" class="sim-header">
    <div>
      <h2>Procesador cuántico de 2 qubits</h2>
      <p class="sub">Algoritmo de Grover con pulsos de control y decoherencia · ecuación maestra de Lindblad resuelta en vivo (40 EDOs reales)</p>
    </div>
    <div v-if="result" class="big">
      <span>P(|11⟩) final</span>
      <strong :class="{ warn: final.pops[3] < 0.9 || final.pops[3] > 1.0001 }">{{ fmt(final.pops[3]) }}</strong>
    </div>
  </header>

  <main v-if="result">
    <!-- panel de control -->
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
      <div class="seg">
        <button v-for="m in ['Euler', 'Heun', 'RK4']" :key="m" :class="{ on: p.method === m }" @click="p.method = m">{{ m }}</button>
      </div>
      <label>Paso h
        <select v-model.number="p.h"><option v-for="v in [0.125, 0.25, 0.5, 1, 2, 5]" :key="v" :value="v">{{ v }} ns</option></select>
      </label>
      <p class="hint">Pruebe Euler con h = 1 ns: las probabilidades dejan de ser físicas.</p>
      <p class="hint">Simulado en {{ result.cpuMs.toFixed(0) }} ms · {{ result.evals.toLocaleString('es') }} evaluaciones de f(t, y)</p>
      <p v-if="error" class="err">{{ error }}</p>

      <h2>Diagnósticos en t = {{ frame.t.toFixed(0) }} ns</h2>
      <dl class="metrics">
        <template v-for="m in metrics" :key="m.label">
          <dt>{{ m.label }}</dt>
          <dd :class="{ bad: m.bad }" :title="m.bad ? m.why : ''">{{ m.value }}</dd>
        </template>
      </dl>
    </aside>

    <section class="stage">
      <!-- reproductor -->
      <div class="card player">
        <button class="play" @click="togglePlay">{{ playing ? '❚❚' : '▶' }}</button>
        <input type="range" min="0" :max="result.frames.length - 1" v-model.number="k" @input="playing = false" />
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
      <p class="explain">La flecha es el estado de cada qubit. Gira con los pulsos y se encoge hacia el centro cuando los qubits se entrelazan o pierden coherencia por el ruido. El cityscape muestra los 16 elementos de ρ: la diagonal son probabilidades y lo demás son coherencias, que el ruido apaga.</p>

      <div class="grid2">
        <div class="card crt">
          <h3>Osciloscopio: pulsos de control y probabilidades</h3>
          <div class="screen"><PlotlyChart :data="scopeData" :layout="scopeLayout" /></div>
        </div>
        <div class="card">
          <h3>Medición en t = {{ frame.t.toFixed(0) }} ns</h3>
          <PlotlyChart :data="histData" :layout="histLayout" />
          <p class="explain">Al final, Grover debe encontrar |11⟩ con probabilidad 1. El ruido y los errores de calibración la reducen.</p>
        </div>
      </div>

      <!-- análisis -->
      <div v-if="datos" class="card">
        <div class="tabs">
          <button v-for="t in [['E8', 'E8 · ¿Qué tan buenos deben ser los qubits?'], ['E2', 'E2 · Convergencia'], ['E4', 'E4 · Estabilidad'], ['V', 'Validación']]" :key="t[0]" :class="{ on: tab === t[0] }" @click="tab = t[0]">{{ t[1] }}</button>
        </div>
        <template v-if="tab === 'E8'">
          <PlotlyChart v-bind="e8" />
          <p class="explain">Probabilidad de éxito de Grover para cada combinación de T₁ y T₂, calculada en el notebook con RK4. La estrella es la configuración actual del panel. Para P ≥ 0.99 hace falta T₁ ≳ 16 µs, unas 16 veces más de lo que se tenía en 2009.</p>
        </template>
        <template v-if="tab === 'E2'">
          <PlotlyChart v-bind="e2" />
          <p class="explain">Error contra paso h en escala log-log. La pendiente de cada recta es el orden del método: si h se reduce a la mitad, el error baja 2ᵖ veces. Las pendientes medidas (1, 2, 2, 4, 4) coinciden con la teoría.</p>
        </template>
        <template v-if="tab === 'E4'">
          <PlotlyChart v-bind="e4" />
          <p class="explain">Las curvas encierran la región donde cada método es estable. Los puntos son los valores propios del sistema multiplicados por el h del panel. Euler no contiene el eje imaginario, por eso amplifica cualquier oscilación. RK4 sí lo contiene hasta |hλ| ≤ 2√2. Cambie h en el panel para ver moverse los puntos.</p>
        </template>
        <template v-if="tab === 'V'">
          <div class="valid">
            <div><span>Simulador JS vs notebook Python</span><strong>{{ jsVsPy?.toExponential(2) }}</strong><small>diferencia máxima en probabilidades (RK4 en JS vs Magnus 4 en Python, T₁ = 2 µs, T₂ = 1.5 µs)</small></div>
            <div><span>Métodos en esta app</span><strong>Euler · Heun · RK4</strong><small>Crank-Nicolson, Magnus 4, RK45 y la comparación con QuTiP están en el notebook</small></div>
          </div>
        </template>
      </div>
    </section>
  </main>

  <footer>Métodos Numéricos · Ingeniería de Sistemas y Computación · Basado en DiCarlo et al., Nature 460, 240 (2009)</footer>
</template>
