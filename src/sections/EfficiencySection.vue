<script setup>
import { ref, computed } from 'vue'
import Tex from '../components/Tex.vue'
import PlotlyChart from '../components/PlotlyChart.vue'
import { datos } from '../store.js'
import { groupBy, LOGAX, METHOD_COLORS, fmt, fexp } from '../ui.js'

const axis = ref('nfev')
const pareto = computed(() => {
  const P = datos.value?.E6.puntos
  if (!P) return null
  const by = groupBy(P, (r) => r.metodo)
  return {
    data: Object.entries(by).map(([m, rows]) => ({
      x: rows.map((r) => (axis.value === 'nfev' ? r.nfev : r.cpu)), y: rows.map((r) => r.error), mode: 'lines+markers', name: m,
      text: rows.map((r) => (m === 'RK45' ? `tol = ${r.param}` : `h = ${r.param} ns`)), hovertemplate: '%{text}<br>error %{y:.2e}<extra>' + m + '</extra>', line: { color: METHOD_COLORS[m] },
    })),
    layout: { height: 400, xaxis: { ...LOGAX, title: axis.value === 'nfev' ? 'evaluaciones de A(t)' : 'tiempo de CPU (s, Python)' }, yaxis: { ...LOGAX, title: 'error en y(t_f)' },
      shapes: [{ type: 'line', xref: 'paper', x0: 0, x1: 1, y0: 1e-6, y1: 1e-6, line: { color: '#6e5f4a', dash: 'dot', width: 1 } }], legend: { x: 1, xanchor: 'right', y: 1, bgcolor: 'rgba(248,241,224,0.85)' } },
  }
})
const best = computed(() => {
  const P = datos.value?.E6.puntos
  if (!P) return []
  return Object.entries(groupBy(P, (r) => r.metodo)).map(([m, rows]) => {
    const ok = rows.filter((r) => r.error <= 1e-6).sort((a, b) => a.nfev - b.nfev)[0]
    return { m, ok, min: Math.min(...rows.map((r) => r.error)) }
  }).sort((a, b) => (a.ok?.nfev ?? Infinity) - (b.ok?.nfev ?? Infinity))
})

const roundoff = computed(() => {
  const E = datos.value?.E10
  if (!E) return null
  const eps64 = 2.22e-16, eps32 = 1.19e-7, tf = 20
  return {
    data: [
      { x: E.h, y: E.float64, mode: 'lines+markers', name: 'RK4 float64', line: { color: '#5b6b1f' } },
      { x: E.h.filter((_, i) => E.float32[i] !== null), y: E.float32.filter((v) => v !== null), mode: 'lines+markers', name: 'RK4 float32', line: { color: '#b5321f' } },
      { x: E.h, y: E.h.map((h) => (tf * h ** 4) / 120), mode: 'lines', name: 'truncamiento t_f h⁴/120', line: { color: '#2b2118', dash: 'dash', width: 1 } },
      { x: E.h, y: E.h.map((h) => Math.sqrt(tf / h) * eps64), mode: 'lines', name: 'redondeo √N·ε₆₄', line: { color: '#6e5f4a', dash: 'dot', width: 1 } },
      { x: E.h, y: E.h.map((h) => Math.sqrt(tf / h) * eps32), mode: 'lines', name: 'redondeo √N·ε₃₂', line: { color: '#b5321f', dash: 'dot', width: 1 } },
    ],
    layout: { height: 380, xaxis: { ...LOGAX, title: 'h' }, yaxis: { ...LOGAX, title: '|y_N − e^{iωt_f}|', range: [-16.5, 0.5] }, legend: { x: 0, y: 1, bgcolor: 'rgba(248,241,224,0.85)' } },
  }
})
</script>

<template>
  <section id="eficiencia" class="doc">
    <p class="kicker">6 · Eficiencia</p>
    <h2 class="doc-title">¿Qué método da más precisión por menos trabajo?</h2>
    <p class="lead">El costo que no depende de la máquina es el número de evaluaciones de <Tex e="A(t)" />. El tiempo de CPU incluye además la LU de Crank-Nicolson y la exponencial de Magnus. En el diagrama de Pareto, abajo a la izquierda es mejor.</p>

    <div v-if="datos" class="grid2 even">
      <div class="card">
        <h3>Diagrama de eficiencia (E6, Grover con T₁ = 20 µs, T₂ = 15 µs)</h3>
        <div class="seg small"><button :class="{ on: axis === 'nfev' }" @click="axis = 'nfev'">evaluaciones de A</button><button :class="{ on: axis === 'cpu' }" @click="axis = 'cpu'">tiempo de CPU</button></div>
        <PlotlyChart v-if="pareto" v-bind="pareto" />
      </div>
      <div class="card">
        <h3>Costo mínimo para error ≤ 10⁻⁶</h3>
        <div class="table-wrap">
          <table class="data compact">
            <thead><tr><th>Método</th><th>parámetro</th><th>evaluaciones</th><th>CPU</th><th>error</th></tr></thead>
            <tbody>
              <tr v-for="b in best" :key="b.m">
                <td :style="{ color: METHOD_COLORS[b.m] }">{{ b.m }}</td>
                <template v-if="b.ok"><td>{{ b.m === 'RK45' ? `tol ${b.ok.param}` : `h = ${b.ok.param} ns` }}</td><td>{{ b.ok.nfev.toLocaleString('es') }}</td><td>{{ (b.ok.cpu * 1000).toFixed(0) }} ms</td><td>{{ fexp(b.ok.error) }}</td></template>
                <template v-else><td colspan="3" class="bad">no lo alcanza con los h probados</td><td>{{ fexp(b.min) }}</td></template>
              </tr>
            </tbody>
          </table>
        </div>
        <p class="explain"><b>Magnus 4 gana</b>: con h = 1 ns ya llega a 5·10⁻⁷ con 480 evaluaciones. RK4 necesita h = 0.125 ns (5 760 evaluaciones). Su constante de error es diminuta porque, con la malla alineada, los pulsos conmutan consigo mismos dentro de cada paso: lo único que no conmuta es el ruido con los pulsos, un efecto O(1/T). <b>En flops empatan</b>: un paso de Magnus cuesta ≈ 47 k multiplicaciones complejas (conmutador + exponencial) y uno de RK4 ≈ 5.2 k, así que 240 pasos ≈ 11 M contra 1 920 pasos ≈ 10 M. En Python Magnus gana en CPU (el intérprete cobra un costo fijo por paso). En este navegador RK4 es algo más rápido. Lo que no depende de la máquina: 12 veces menos evaluaciones de A(t).</p>
        <p class="explain">RK45 queda en medio: su error sigue a la tolerancia (error ∝ tol^{{ fmt(datos.E6.pendiente_tol, 2) }}), pero rechaza muchos pasos en los bordes de los pulsos. Aquí casi no hay tramos sin pulsos donde pueda alargar el paso.</p>
        <p class="explain">Euler, Heun y Crank-Nicolson no llegan a 10⁻⁶: extrapolando sus rectas, Crank-Nicolson necesitaría h ≈ 0.0045 ns (~53 000 pasos) y Heun h ≈ 0.003 ns (~75 000 pasos).</p>
      </div>
    </div>

    <div v-if="datos" class="grid2 even">
      <div class="card">
        <h3>Redondeo contra truncamiento (E10)</h3>
        <PlotlyChart v-if="roundoff" v-bind="roundoff" />
      </div>
      <div class="card">
        <h3>¿Por qué no usar h diminuto y olvidarse del método?</h3>
        <Tex block e="E(h)\approx\underbrace{Ch^{p}}_{\text{truncamiento}} + \underbrace{\sqrt{N}\,c\,\varepsilon}_{\text{redondeo}},\qquad N = t_f/h" />
        <p class="explain">El error de truncamiento baja con h, pero cada paso agrega un error de redondeo del orden del ε de máquina, y hay más pasos. El error total tiene un mínimo. Ecuación de prueba y′ = iy hasta t = 20 con RK4:</p>
        <ul class="explain">
          <li><b>float64</b> (ε ≈ 2.2·10⁻¹⁶): mínimo ≈ {{ fexp(Math.min(...datos.E10.float64)) }} con h ≈ 2⁻¹³. Por debajo deja de mejorar.</li>
          <li><b>float32</b> (ε ≈ 1.2·10⁻⁷): mínimo ≈ {{ fexp(Math.min(...datos.E10.float32.filter((v) => v !== null))) }} con h = 2⁻⁶. Con h = 2⁻¹² el error es casi 400 veces mayor.</li>
        </ul>
        <p class="explain">Por eso conviene un método de <b>orden alto</b>: llega a la precisión deseada con pocos pasos y, por lo tanto, con poco redondeo acumulado. También por eso, en convergencia, las pendientes se ajustan solo con errores mayores que 10⁻¹¹.</p>
      </div>
    </div>
  </section>
</template>
