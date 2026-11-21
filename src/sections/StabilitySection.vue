<script setup>
import { ref, computed } from 'vue'
import Tex from '../components/Tex.vue'
import PlotlyChart from '../components/PlotlyChart.vue'
import { datos, params } from '../store.js'
import { AX, METHOD_COLORS, fmt } from '../ui.js'

// ---------- funciones de estabilidad R(z), z = x + iy (aritmética compleja a mano)
const cmul = ([a, b], [c, d]) => [a * c - b * d, a * d + b * c]
const cdiv = ([a, b], [c, d]) => { const q = c * c + d * d; return [(a * c + b * d) / q, (b * c - a * d) / q] }
const poly = (coef) => (z) => coef.reduceRight((acc, c) => { const m = cmul(acc, z); return [m[0] + c, m[1]] }, [0, 0])
const RF = {
  Euler: poly([1, 1]),
  Heun: poly([1, 1, 1 / 2]),
  RK4: poly([1, 1, 1 / 2, 1 / 6, 1 / 24]),
  RK45: poly([1, 1, 1 / 2, 1 / 6, 1 / 24, 1 / 120, 1 / 600]),
  'Crank-Nicolson': ([x, y]) => cdiv([1 + x / 2, y / 2], [1 - x / 2, -y / 2]),
  Magnus4: ([x, y]) => [Math.exp(x) * Math.cos(y), Math.exp(x) * Math.sin(y)],
}
const absR = (m, z) => Math.hypot(...RF[m](z))

const show = ref(['Euler', 'Heun', 'RK4', 'RK45', 'Crank-Nicolson'])
const hView = ref(params.h)

// ---------- laboratorio de la ecuación de prueba
const reL = ref(-0.05), imL = ref(1), hT = ref(0.8), nT = ref(25)
const z = computed(() => [reL.value * hT.value, imL.value * hT.value])

const grids = computed(() => {           // depende solo de los métodos visibles (las rejillas son caras)
  const xs = Array.from({ length: 181 }, (_, i) => -4.5 + (i * 6) / 180), ys = Array.from({ length: 181 }, (_, i) => -4 + (i * 8) / 180)
  return show.value.filter((m) => m !== 'Magnus4').map((m) => ({
    type: 'contour', x: xs, y: ys, z: ys.map((y) => xs.map((x) => Math.min(absR(m, [x, y]), 3))), name: m, showlegend: true, showscale: false,
    contours: { coloring: 'none', start: 1, end: 1, size: 1 }, line: { color: METHOD_COLORS[m], width: 2.2 }, hoverinfo: 'skip',
  }))
})
const regions = computed(() => {
  const E = datos.value?.E4
  const traces = [...grids.value]
  traces.push({ x: [0, 0], y: [-4, 4], mode: 'lines', name: 'Magnus4 (Re z = 0)', line: { color: METHOD_COLORS.Magnus4, width: 2, dash: 'dash' } })
  if (E) traces.push({ x: E.re.map((v) => v * hView.value), y: E.im.map((v) => v * hView.value), mode: 'markers', name: `h·λ(A(t)) de Grover, h = ${hView.value} ns`, marker: { size: 4, color: '#2b2118' } })
  traces.push({ x: [z.value[0]], y: [z.value[1]], mode: 'markers', name: 'z del laboratorio', marker: { size: 14, symbol: 'star', color: '#f8f1e0', line: { color: '#b5321f', width: 2 } } })
  return { data: traces, layout: { height: 440, xaxis: { ...AX, type: 'linear', title: 'Re z', range: [-4.5, 1.5], autorange: false, constrain: 'domain' }, yaxis: { ...AX, type: 'linear', title: 'Im z', range: [-4, 4], autorange: false, scaleanchor: 'x' }, legend: { orientation: 'h', y: -0.18 } } }
})

const lab = computed(() => {
  const methods = ['Euler', 'Heun', 'RK4', 'RK45', 'Crank-Nicolson', 'Magnus4']
  const traces = methods.map((m) => {
    const R = RF[m](z.value); let y = [1, 0]
    const pts = [y]
    for (let n = 0; n < nT.value; n++) { y = cmul(R, y); pts.push(y) }
    return { x: pts.map((p) => p[0]), y: pts.map((p) => p[1]), mode: 'lines+markers', name: m, line: { color: METHOD_COLORS[m], width: 1.5 }, marker: { size: 4 } }
  })
  const ex = Array.from({ length: 200 }, (_, i) => { const t = (i / 199) * nT.value * hT.value; return [Math.exp(reL.value * t) * Math.cos(imL.value * t), Math.exp(reL.value * t) * Math.sin(imL.value * t)] })
  traces.unshift({ x: ex.map((p) => p[0]), y: ex.map((p) => p[1]), mode: 'lines', name: 'exacta e^(λt)', line: { color: '#2b2118', width: 4 }, opacity: 0.25 })
  const rows = methods.map((m) => ({ m, R: absR(m, z.value), yN: absR(m, z.value) ** nT.value, exact: Math.exp(reL.value * hT.value * nT.value) }))
  return { data: traces, layout: { height: 380, xaxis: { ...AX, type: 'linear', title: 'Re y', range: [-1.6, 1.6], autorange: false, constrain: 'domain' }, yaxis: { ...AX, type: 'linear', title: 'Im y', range: [-1.6, 1.6], autorange: false, scaleanchor: 'x' }, legend: { orientation: 'h', y: -0.2 } }, rows }
})
</script>

<template>
  <section id="estabilidad" class="doc">
    <p class="kicker">4 · Estabilidad</p>
    <h2 class="doc-title">¿Por qué Euler explota y RK4 no?</h2>
    <p class="lead">Para la ecuación de prueba <Tex e="\dot y = \lambda y" />, cada método da <Tex e="y_{n+1} = R(z)\,y_n" /> con <Tex e="z = h\lambda" />. Después de <Tex e="n" /> pasos <Tex e="y_n = R(z)^n y_0" />: si <Tex e="|R(z)| > 1" /> el error crece en cada paso. Un método es <b>A-estable</b> si su región contiene todo el semiplano Re z ≤ 0, y <b>L-estable</b> si además <Tex e="R(z)\to0" /> cuando <Tex e="z\to-\infty" /> (amortigua del todo los modos muy rápidos). Como el sistema es lineal, el método es estable si <b>todos</b> los <Tex e="h\lambda_i" /> de <Tex e="A(t)" /> caen dentro de la región <Tex e="|R(z)|\le1" />.</p>

    <div class="grid2 even">
      <div class="card">
        <h3>Regiones de estabilidad |R(z)| ≤ 1</h3>
        <div class="row-controls">
          <label>h para escalar los valores propios
            <select v-model.number="hView"><option v-for="v in [0.25, 0.5, 1, 2, 5, 10]" :key="v" :value="v">{{ v }} ns</option></select>
          </label>
          <div class="checks">
            <label v-for="m in ['Euler', 'Heun', 'RK4', 'RK45', 'Crank-Nicolson']" :key="m" :style="{ color: METHOD_COLORS[m] }"><input type="checkbox" :value="m" v-model="show" /> {{ m }}</label>
          </div>
        </div>
        <PlotlyChart v-bind="regions" />
        <p class="explain">Cada curva encierra la región donde el método es estable (Crank-Nicolson y Magnus son estables en todo el semiplano izquierdo). Los puntos negros son los valores propios de A(t) a lo largo de los 240 ns de Grover (T₁ = T₂ = 1 µs) multiplicados por h. Casi todos están sobre el eje imaginario: la decoherencia (parte real ~10⁻³) es diminuta frente a los pulsos (parte imaginaria ~0.3). Con h = 10 ns los puntos salen de la región de RK4.</p>
      </div>

      <div class="card">
        <h3>Laboratorio de la ecuación de prueba</h3>
        <div class="lab-sliders">
          <label>Re λ <b>{{ reL.toFixed(2) }}</b><input type="range" min="-3" max="0.3" step="0.01" v-model.number="reL" /></label>
          <label>Im λ <b>{{ imL.toFixed(2) }}</b><input type="range" min="0" max="3" step="0.01" v-model.number="imL" /></label>
          <label>h <b>{{ hT.toFixed(2) }}</b><input type="range" min="0.05" max="3" step="0.05" v-model.number="hT" /></label>
          <label>pasos <b>{{ nT }}</b><input type="range" min="5" max="80" step="1" v-model.number="nT" /></label>
        </div>
        <p class="hint">z = hλ = {{ z[0].toFixed(3) }} + {{ z[1].toFixed(3) }}i (estrella en la gráfica de regiones)</p>
        <PlotlyChart :data="lab.data" :layout="lab.layout" />
        <div class="table-wrap">
          <table class="data compact">
            <thead><tr><th>Método</th><th>|R(z)|</th><th>|y_N| numérico</th><th>|y_N| exacto</th><th></th></tr></thead>
            <tbody><tr v-for="r in lab.rows" :key="r.m"><td :style="{ color: METHOD_COLORS[r.m] }">{{ r.m }}</td><td>{{ fmt(r.R, 4) }}</td><td>{{ fmt(r.yN, 4) }}</td><td>{{ fmt(r.exact, 4) }}</td><td :class="r.R > 1 + 1e-12 ? 'bad' : 'good'">{{ r.R > 1 + 1e-12 ? 'crece' : 'acotado' }}</td></tr></tbody>
          </table>
        </div>
        <p class="explain">Con λ casi imaginario (oscilación con poco amortiguamiento, como en Grover), Euler y Heun salen en espiral hacia afuera. Ponga Re λ = −2, Im λ = 0 y h = 2 (un problema rígido): Crank-Nicolson queda acotado pero cambia de signo en cada paso (R = −1/3), porque es A-estable pero no L-estable.</p>
      </div>
    </div>

    <div class="grid2 even">
      <div class="card">
        <h3>Deducción: RK4 en el eje imaginario</h3>
        <Tex block e="R(iy) = \Big(1 - \tfrac{y^2}{2} + \tfrac{y^4}{24}\Big) + i\Big(y - \tfrac{y^3}{6}\Big)" />
        <Tex block e="|R(iy)|^2 = 1 \underbrace{- y^2 + y^2}_{0} \underbrace{+ \tfrac{y^4}{3} - \tfrac{y^4}{3}}_{0} - \frac{y^6}{72} + \frac{y^8}{576}" />
        <Tex block e="|R(iy)|\le 1 \iff y^2\le 8 \iff |y|\le 2\sqrt2\approx 2.83" />
        <p class="explain">Con el espectro de Grover (|λ| ≤ 0.59 rad/ns) esto da h ≲ 4.8 ns para RK4. En el marco del laboratorio (|λ| ≈ 31 rad/ns) daría h ≤ 0.09 ns.</p>
        <h3 class="mt">Deducción: Euler y la norma</h3>
        <Tex block e="\|\psi_{n+1}\|^2 = \psi_n^\dagger(I+ihH)(I-ihH)\psi_n = \|\psi_n\|^2 + h^2\|H\psi_n\|^2" />
        <p class="explain">La norma crece en cada paso, sin importar h. El notebook verifica esta fórmula contra la simulación con 12 cifras (E4c).</p>
      </div>
      <div v-if="datos" class="card">
        <h3>Límites calculados en el notebook (E4b)</h3>
        <div class="table-wrap">
          <table class="data compact">
            <thead><tr><th>Método</th><th>β (eje imag.)</th><th>α (eje real)</th><th>h máx. bloque 𝓛</th><th>h máx. bloque ψ</th></tr></thead>
            <tbody><tr v-for="r in datos.E4.limites" :key="r.metodo"><td :style="{ color: METHOD_COLORS[r.metodo] }">{{ r.metodo }}</td><td>{{ fmt(r.beta ?? Infinity, 3) }}</td><td>{{ fmt(r.alpha ?? Infinity, 3) }}</td><td>{{ fmt(r.hmax_L ?? Infinity, 3) }} ns</td><td>{{ fmt(r.hmax_psi ?? Infinity, 3) }} ns</td></tr></tbody>
          </table>
        </div>
        <p class="explain">β y α son el tramo del eje imaginario y del eje real negativo dentro de la región (barrido + bisección; coinciden con la teoría: 0, 0, 2√2 y 2, 2, 2.785). El h máximo se calcula con los valores propios reales de A(t). Para el bloque ψ, cuyos valores propios son imaginarios puros, Euler y Heun no son estables con ningún h. ∞ significa sin límite.</p>
        <h3 class="mt">‖ψ final‖ − 1 en Grover ideal (E4c)</h3>
        <div class="table-wrap">
          <table class="data compact">
            <thead><tr><th>Método</th><th>h = 0.5 ns</th><th>h = 2 ns</th></tr></thead>
            <tbody><tr v-for="m in ['Euler', 'Heun', 'RK4', 'Crank-Nicolson', 'Magnus4']" :key="m"><td :style="{ color: METHOD_COLORS[m] }">{{ m }}</td><td v-for="h in [0.5, 2]" :key="h">{{ fmt(datos.E4.norma.find((r) => r.metodo === m && r['h (ns)'] === h)['‖ψ_final‖ − 1'], 3) }}</td></tr></tbody>
          </table>
        </div>
      </div>
    </div>

    <div v-if="datos" class="card">
      <h3>¿Es un problema rígido? Y un modo de decaimiento rápido (E4d)</h3>
      <p class="explain">No. En Grover el cociente de rigidez max|Re λ| / min|Re λ| es ≈ 2, y las partes imaginarias son unas 300 veces mayores que las reales: es un problema <b>oscilatorio</b>. Para ver qué hace cada método con un modo de decaimiento rápido frente a h (|hλ| grande), el notebook resuelve un qubit ficticio con T₁ = 0.5 ns (λ = −2) desde |1⟩. Ese modo solo no es rígido; en un problema rígido convive con modos lentos que obligan a integrar por tiempos largos:</p>
      <div class="table-wrap">
        <table class="data compact">
          <thead><tr><th>h (z = −2h)</th><th v-for="m in ['Euler', 'Heun', 'RK4', 'Crank-Nicolson', 'Magnus4']" :key="m" :style="{ color: METHOD_COLORS[m] }">{{ m }}: P₁ final / mín.</th></tr></thead>
          <tbody><tr v-for="h in [0.25, 1, 2]" :key="h"><td>{{ h }} ns</td><td v-for="m in ['Euler', 'Heun', 'RK4', 'Crank-Nicolson', 'Magnus4']" :key="m" :class="{ bad: Math.abs(datos.E4.rigido.find((r) => r.h === h && r.metodo === m).P1_final) > 1e-3 || datos.E4.rigido.find((r) => r.h === h && r.metodo === m).P1_min < -1e-9 }">{{ fmt(datos.E4.rigido.find((r) => r.h === h && r.metodo === m).P1_final, 2) }} / {{ fmt(datos.E4.rigido.find((r) => r.h === h && r.metodo === m).P1_min, 2) }}</td></tr></tbody>
        </table>
      </div>
      <p class="explain">La solución exacta tiende a 0 sin cambiar de signo. Con z = −2, Euler oscila entre 1 y −1 (R = −1) y Heun no decae nunca (R = 1). Con z = −4, los tres explícitos explotan (|R| = 3, 5, 5). Crank-Nicolson queda acotado pero da P₁ = −1/3. Magnus da e^z, exacto para un problema constante. Si ese modo conviviera con modos lentos (rigidez de verdad), convendría un método L-estable (Euler implícito, BDF, Radau).</p>
    </div>
  </section>
</template>
