<script setup>
import { ref, shallowRef, computed, watch } from 'vue'
import PlotlyChart from '../components/PlotlyChart.vue'
import { datos } from '../store.js'
import { AX, METHOD_COLORS, fmt, fexp } from '../ui.js'
import { simulate } from '../sim/quantum.js'

const test = ref('Rabi')
const E1 = computed(() => {
  const T = datos.value?.E1[test.value]
  if (!T) return null
  return {
    data: [{ x: T.t, y: T.exacta, mode: 'lines', name: 'exacta', line: { color: '#2b2118', width: 6 }, opacity: 0.25 },
      ...Object.entries(T.metodos).map(([m, y]) => ({ x: T.t, y, mode: 'lines', name: m, line: { color: METHOD_COLORS[m], width: 1.5 } }))],
    layout: { height: 330, xaxis: { ...AX, title: 't (ns)' }, yaxis: { ...AX, title: test.value === 'Ramsey' ? '⟨σx⟩' : 'P₁', range: test.value === 'Ramsey' ? [-1.5, 1.5] : [-0.1, 1.6] } },
    T,
  }
})
const DESC = {
  Rabi: 'Ω₀ = 2π·50 MHz constante, sin ruido. Exacta: P₁ = sin²(Ω₀t/2). Valores propios imaginarios puros.',
  T1: 'Desde |1⟩ con T₁ = 1 µs. Exacta: P₁ = e^(−t/T₁). Valor propio real negativo.',
  Ramsey: 'Desde |+⟩ con Δ = 2π·10 MHz, T₂ = 0.8 µs. Exacta: ⟨σx⟩ = e^(−t/T₂) cos Δt. Valores propios complejos.',
}

const jsPy = shallowRef(null)
watch(datos, (d) => {
  if (!d || jsPy.value) return
  const { T1_ns, T2_ns } = d.parametros
  jsPy.value = ['Magnus4', 'RK4'].map((m) => {
    const js = simulate({ T1: T1_ns, T2: T2_ns, method: m, h: 0.25 })
    return { m, diff: Math.max(...js.frames.flatMap((f, i) => f.pops.map((v, j) => Math.abs(v - d.poblaciones[i][j])))), ms: js.cpuMs }
  })
}, { immediate: true })
</script>

<template>
  <section id="validacion" class="doc">
    <p class="kicker">8 · Validación</p>
    <h2 class="doc-title">¿Cómo se sabe que el simulador está bien?</h2>
    <p class="lead">Ningún resultado se da por bueno porque "se ve razonable". El modelo y los métodos se validaron en siete capas independientes:</p>
    <ol class="layers">
      <li><b>Álgebra</b>: la vectorización coincide con la fórmula matricial de Lindblad (error 10⁻¹⁵); propiedades de Pauli y Kronecker.</li>
      <li><b>Espectro</b>: los valores propios de 𝓛 de 1 qubit son exactamente {0, −1/T₁, −1/T₂ ∓ iΔ}, como dice la deducción analítica.</li>
      <li><b>Condiciones de orden</b>: las 17 condiciones de Butcher hasta orden 5, verificadas con fracciones exactas para cada tabla.</li>
      <li><b>Soluciones analíticas</b>: Rabi, T₁ y Ramsey (E1, abajo).</li>
      <li><b>Compuertas</b>: la fidelidad de cada pulso con su compuerta ideal es 1.0000000000, y Grover ideal da P(11) = 1.</li>
      <li><b>Librería independiente</b>: QuTiP coincide hasta 10⁻⁸ (E7, abajo).</li>
      <li><b>Segunda implementación</b>: este simulador en JavaScript reproduce la trayectoria de Python (abajo y en <code>npm test</code>).</li>
    </ol>

    <div v-if="datos && datos.E7" class="grid2 even">
      <div class="card">
        <h3>E1 · Soluciones analíticas de 1 qubit</h3>
        <div class="tabs"><button v-for="t in ['Rabi', 'T1', 'Ramsey']" :key="t" :class="{ on: test === t }" @click="test = t">{{ t }}</button></div>
        <p class="hint">{{ DESC[test] }} h = {{ E1.T.h }} ns.</p>
        <PlotlyChart :data="E1.data" :layout="E1.layout" />
        <div class="table-wrap">
          <table class="data compact"><thead><tr><th v-for="(v, m) in E1.T.error" :key="m" :style="{ color: METHOD_COLORS[m] }">{{ m }}</th></tr></thead>
            <tbody><tr><td v-for="(v, m) in E1.T.error" :key="m">{{ fexp(v) }}</td></tr></tbody></table>
        </div>
        <p class="explain">Error absoluto máximo. Magnus queda en el redondeo: con H constante, e^(hA) es la solución exacta del paso. Euler diverge en Rabi y también en Ramsey: allí |1 + hλ| ≈ 1.0007 &gt; 1 y en 2000 pasos crece ≈ 4 veces.</p>
      </div>
      <div class="card">
        <h3>E7 · Contra QuTiP {{ datos.E7.version }} (mesolve)</h3>
        <div class="table-wrap">
          <table class="data compact"><thead><tr><th>Método</th><th>h = 0.5</th><th>h = 0.25</th><th>h = 0.125</th></tr></thead>
            <tbody><tr v-for="m in ['RK4', 'Magnus4', 'Crank-Nicolson']" :key="m"><td :style="{ color: METHOD_COLORS[m] }">{{ m }}</td><td v-for="h in [0.5, 0.25, 0.125]" :key="h">{{ fexp(datos.E7.filas.find((r) => r.metodo === m && r.h === h).error, 2) }}</td></tr></tbody></table>
        </div>
        <p class="explain">Máxima diferencia en ρ(t) a lo largo de Grover (T₁ = T₂ = 1 µs). RK4 converge a QuTiP con orden 4 y Crank-Nicolson con orden 2. Magnus se estanca en ≈ 10⁻⁸. Para probar que ese piso es de la referencia, el notebook repite QuTiP con rtol = 10⁻¹²: las dos corridas de QuTiP difieren en 1.3·10⁻⁸ y Magnus contra la corrida estricta baja a 5.8·10⁻¹⁰. P(11) según QuTiP: {{ fmt(datos.E7.P11_qutip, 6) }}.</p>

        <h3 class="mt">JavaScript (esta página) contra Python (notebook)</h3>
        <div v-if="jsPy" class="valid">
          <div v-for="r in jsPy" :key="r.m"><span>{{ r.m }} en JS vs Magnus 4 en Python</span><strong>{{ fexp(r.diff, 1) }}</strong><small>diferencia máxima en las 4 probabilidades, 241 instantes · {{ r.ms.toFixed(0) }} ms</small></div>
        </div>
        <p class="explain">Con el mismo método las dos implementaciones coinciden hasta el redondeo. Con RK4 la diferencia es el error de truncamiento de RK4 con h = 0.25 ns.</p>

        <h3 class="mt">E3 · Marco del laboratorio contra marco rotante (pulso π de 20 ns, RK4)</h3>
        <div class="table-wrap">
          <table class="data compact"><thead><tr><th>Marco</th><th>h (ns)</th><th>pasos</th><th>error en P₁</th></tr></thead>
            <tbody><tr v-for="(r, i) in datos.E3" :key="i"><td>{{ r.marco }}</td><td>{{ r.h }}</td><td>{{ r.pasos }}</td><td :class="{ bad: r.error > 1 }">{{ fexp(r.error) }}</td></tr></tbody></table>
        </div>
        <p class="explain">En el laboratorio, h = 0.1 ns ya supera la cota de estabilidad 2√2/ω_q = 0.090 ns y la solución explota. Para un error ~10⁻⁵ el laboratorio necesita 4 000 pasos y el marco rotante 20.</p>
      </div>
    </div>
  </section>
</template>
