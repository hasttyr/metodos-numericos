<script setup>
import { computed } from 'vue'
import Tex from '../components/Tex.vue'
import PlotlyChart from '../components/PlotlyChart.vue'
import { datos, params, physical } from '../store.js'
import { AX, fmt } from '../ui.js'
import { simulate } from '../sim/quantum.js'

const T1us = computed(() => 10 ** params.logT1)
const T2us = computed(() => 10 ** params.logT2)

const e8 = computed(() => {
  const E = datos.value?.E8
  if (!E) return null
  return {
    data: [
      { type: 'contour', x: E.T1_us, y: E.T2_us, z: E.P11, zmin: 0.75, zmax: 1,
        colorscale: [[0, '#b5321f'], [0.35, '#e07a2e'], [0.65, '#d99a2b'], [1, '#5b6b1f']],
        contours: { coloring: 'heatmap', showlabels: true, start: 0.8, end: 1, size: 0.05, labelfont: { color: '#f8f1e0' } },
        colorbar: { title: { text: 'P(|11⟩)' }, outlinewidth: 0 }, hovertemplate: 'T₁=%{x:.1f} µs<br>T₂=%{y:.1f} µs<br>P=%{z:.4f}<extra></extra>' },
      { x: E.T1_us, y: E.T1_us.map((v) => 2 * v), mode: 'lines', name: 'T₂ = 2T₁ (límite físico)', line: { color: '#2b2118', dash: 'dash' } },
      { x: [T1us.value], y: [T2us.value], mode: 'markers', name: 'configuración del simulador', marker: { size: 16, color: '#f8f1e0', symbol: 'star', line: { color: '#2b2118', width: 2 } } },
    ],
    layout: { height: 420, xaxis: { ...AX, type: 'log', title: 'T₁ (µs)' }, yaxis: { ...AX, type: 'log', title: 'T₂ (µs)', range: [0, Math.log10(400)] } },
  }
})

// modelo de mínimos cuadrados contra simulación en vivo
const model = computed(() => {
  const A = datos.value?.E8.ajuste
  if (!A || params.ideal) return null
  const tf = 12 * params.t1q
  const pred = 1 - (A.a * tf) / (T1us.value * 1000) - (A.b * tf) / (T2us.value * 1000)
  const { T1, T2, t1q } = physical()
  const sim = simulate({ T1, T2, t1q, method: 'Magnus4', h: 1 }).frames.at(-1).pops[3]
  return { tf, pred, sim, A }
})

const e9 = computed(() => {
  const E = datos.value?.E9
  if (!E) return null
  const lay = (xt) => ({ height: 280, xaxis: { ...AX, title: xt }, yaxis: { ...AX, title: 'P(|11⟩)', range: [0.6, 1.02] }, showlegend: false })
  return {
    eps: { data: [{ x: E.eps.map((v) => 100 * v), y: E.P_eps, mode: 'lines', line: { color: '#2f6f6a', width: 2 } }, { x: E.eps.map((v) => 100 * v), y: E.eps.map((v) => 1 + 0.5 * E.d2_eps * v * v), mode: 'lines', line: { color: '#b5321f', dash: 'dot' } }], layout: lay('error de área ε (%)') },
    del: { data: [{ x: E.delta_MHz, y: E.P_delta, mode: 'lines', line: { color: '#7a4f8a', width: 2 } }, { x: E.delta_MHz, y: E.delta_MHz.map((v) => 1 + 0.5 * E.d2_delta * v * v), mode: 'lines', line: { color: '#b5321f', dash: 'dot' } }], layout: lay('desintonía Δ/2π (MHz)') },
    epsMax: Math.sqrt((2 * 0.01) / Math.abs(E.d2_eps)) * 100, delMax: Math.sqrt((2 * 0.01) / Math.abs(E.d2_delta)), E,
  }
})
</script>

<template>
  <section id="ingenieria" class="doc">
    <p class="kicker">9 · La pregunta de ingeniería</p>
    <h2 class="doc-title">¿Qué tan buenos deben ser los qubits?</h2>
    <p class="lead">Con los métodos ya validados, se usa el simulador como herramienta de diseño: un barrido de 136 combinaciones de (T₁, T₂) con Magnus 4 (h = 1 ns, error ≈ 5·10⁻⁷), dos métodos de búsqueda de raíces y un modelo de mínimos cuadrados.</p>

    <div v-if="datos" class="grid2 even">
      <div class="card">
        <h3>E8 · Probabilidad de éxito de Grover</h3>
        <PlotlyChart v-if="e8" v-bind="e8" />
        <p class="explain">La región sobre la línea discontinua no es física (T₂ &gt; 2T₁). Con el hardware de 2009 (T₁ ≈ T₂ ≈ 1 µs), P(11) ≈ 0.78. La estrella es la configuración del simulador.</p>
      </div>
      <div class="card">
        <h3>E8b · T₁ mínimo: bisección contra secante</h3>
        <div class="table-wrap">
          <table class="data compact">
            <thead><tr><th>P(11) ≥</th><th>caso</th><th>T₁ mínimo</th><th>evaluaciones bisección</th><th>evaluaciones secante</th></tr></thead>
            <tbody><tr v-for="(r, i) in datos.E8.min_T1" :key="i"><td>{{ r.objetivo }}</td><td>{{ r.caso }}</td><td><b>{{ fmt(r.T1_bis, 2) }} µs</b></td><td>{{ r.nev_bis }}</td><td class="good">{{ r.nev_sec }}</td></tr></tbody>
          </table>
        </div>
        <Tex block e="u_{k+1} = u_k - g(u_k)\,\frac{u_k - u_{k-1}}{g(u_k) - g(u_{k-1})}\quad\text{(secante)},\qquad |b-a|/2^k \le \text{tol}\quad\text{(bisección)}" />
        <p class="explain">Se busca la raíz de g(u) = P₁₁(T₁ = 10ᵘ µs) − P_objetivo, con tolerancia 10⁻⁴ en u (T₁ con precisión relativa de 0.02 %; el simulador, Magnus 4 con h = 1 ns, tiene error ≈ 5·10⁻⁷ en P). Cada evaluación de g es una simulación completa de Grover. La <b>bisección</b> divide el intervalo a la mitad en cada paso (convergencia lineal, 18 evaluaciones). La <b>secante</b> usa el valor de g y no solo su signo (orden ≈ 1.618) y llega al mismo T₁ con 7 – 13 evaluaciones, aunque sin garantía de convergencia global.</p>

        <h3 class="mt">E8c · Fórmula de diseño (mínimos cuadrados)</h3>
        <Tex block :e="`1 - P_{11}\\approx ${datos.E8.ajuste.a.toFixed(3)}\\,\\frac{t_f}{T_1} + ${datos.E8.ajuste.b.toFixed(3)}\\,\\frac{t_f}{T_2},\\qquad R^2 = ${datos.E8.ajuste.R2.toFixed(4)}`" />
        <p class="explain">Ajuste con las ecuaciones normales XᵀXβ = Xᵀy (resueltas con la LU propia y comparadas con SVD). El error crece con el tiempo de la secuencia dividido por los tiempos de coherencia, Como 1/T₂ ya contiene 1/(2T₁), conviene leerlo en tasas independientes: 1 − P ≈ {{ (datos.E8.ajuste.a + datos.E8.ajuste.b / 2).toFixed(3) }}·t_f·γ₁ + {{ datos.E8.ajuste.b.toFixed(3) }}·t_f·γ_φ, así que por unidad de tasa el desfase puro daña ≈ {{ (datos.E8.ajuste.b / (datos.E8.ajuste.a + datos.E8.ajuste.b / 2)).toFixed(2) }} veces lo que la relajación. cond(X) = 3.1 y cond(XᵀX) = 9.6 = cond(X)²: aquí las ecuaciones normales sirven, pero en general se prefiere QR o SVD. Para mejorar, sirve tanto subir T₁ y T₂ como acortar las compuertas.</p>
        <div v-if="model" class="valid">
          <div><span>Modelo, con los T₁ y T₂ del simulador</span><strong>{{ fmt(model.pred) }}</strong><small>t_f = {{ model.tf }} ns (12 × compuerta de 1 qubit)</small></div>
          <div><span>Simulación Magnus 4 en vivo (h = 1 ns)</span><strong>{{ fmt(model.sim) }}</strong><small>diferencia {{ fmt(Math.abs(model.pred - model.sim)) }}{{ params.t1q !== 20 ? ' · el ajuste se hizo con t_f = 240 ns' : '' }}</small></div>
        </div>
      </div>
    </div>

    <div v-if="e9" class="grid2 even">
      <div class="card">
        <h3>E9 · Sensibilidad al error de área de los pulsos</h3>
        <PlotlyChart v-bind="e9.eps" />
        <p class="explain">Sin ruido. Como P = 1 es un máximo, la sensibilidad es cuadrática: P ≈ 1 + ½P″ε². La segunda derivada se estimó con diferencia finita central, P″(0) ≈ [P(δ) − 2P(0) + P(−δ)]/δ² = {{ fmt(e9.E.d2_eps, 1) }}, con error O(δ²) (curva punteada). Para P ≥ 0.99 hace falta |ε| ≤ {{ e9.epsMax.toFixed(2) }} %.</p>
      </div>
      <div class="card">
        <h3>E9 · Sensibilidad a la desintonía</h3>
        <PlotlyChart v-bind="e9.del" />
        <p class="explain">P″(0) ≈ {{ fmt(e9.E.d2_delta, 4) }} por MHz². Para P ≥ 0.99, |Δ/2π| ≤ {{ e9.delMax.toFixed(2) }} MHz. La calibración importa tanto como la coherencia: un 1.4 % de error en el área de los pulsos cuesta lo mismo (ΔP = 0.01) que pasar de qubits perfectos a qubits con T₁ = 16 µs.</p>
      </div>
    </div>

    <div class="card conclusion">
      <h3>Respuesta</h3>
      <p>Para que Grover acierte con <b>P ≥ 0.99</b> hacen falta <b>T₁ ≥ 16.2 µs</b> (sin desfase puro) o <b>T₁ ≥ 26.4 µs</b> (si T₂ = T₁), unas 16 a 26 veces más coherencia que en 2009. Además, los pulsos deben estar calibrados mejor que el 1.4 % en área y 2.6 MHz en frecuencia. Para P ≥ 0.999 hacen falta 163 – 266 µs. Con los ~100 µs de los procesadores actuales, P ≈ 0.997.</p>
    </div>
  </section>
</template>
