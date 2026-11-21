<script setup>
import { ref, shallowRef, computed, onBeforeUnmount } from 'vue'
import Tex from '../components/Tex.vue'
import PlotlyChart from '../components/PlotlyChart.vue'
import { datos } from '../store.js'
import { groupBy, LOGAX, METHOD_COLORS, fmt, fexp, slope } from '../ui.js'
import { FIXED, ORDER } from '../sim/quantum.js'

// ---------- experimento en vivo (Web Worker)
const HS = [2, 1, 0.5, 0.25, 0.125, 0.0625]
const chosen = ref([...FIXED])
const preset = ref('20-15')
const PRESETS = { '20-15': { T1: 20000, T2: 15000, label: 'T₁ = 20 µs, T₂ = 15 µs (como E2)' }, '1-1': { T1: 1000, T2: 1000, label: 'T₁ = T₂ = 1 µs (2009)' }, ideal: { T1: Infinity, T2: Infinity, label: 'sin ruido' } }
const running = ref(false), progress = ref(0), status = ref(''), live = shallowRef(null)
let worker
function runLive() {
  worker?.terminate()
  worker = new Worker(new URL('../sim/worker.js', import.meta.url), { type: 'module' })
  running.value = true; progress.value = 0; live.value = null
  const { T1, T2 } = PRESETS[preset.value]
  worker.onerror = (e) => { running.value = false; status.value = `Error: ${e.message}`; worker.terminate() }
  worker.onmessage = ({ data }) => {
    if (data.type === 'progress') { progress.value = data.value; status.value = data.label }
    else { live.value = data.rows; running.value = false; worker.terminate() }
  }
  worker.postMessage({ type: 'convergence', phys: { T1, T2 }, hs: HS, methods: [...chosen.value] })
}
onBeforeUnmount(() => worker?.terminate())

const liveFit = computed(() => {
  if (!live.value) return null
  const by = groupBy(live.value, (r) => r.metodo)
  const out = Object.entries(by).map(([m, rows]) => {
    const ok = rows.filter((r) => r.error > 1e-11).slice(-3)
    return { m, rows, p: ok.length >= 2 ? slope(ok.map((r) => r.param), ok.map((r) => r.error)) : NaN }
  })
  return {
    out,
    data: out.map(({ m, rows, p }) => ({ x: rows.map((r) => r.param), y: rows.map((r) => r.error), mode: 'lines+markers', name: `${m} (pendiente ${fmt(p, 2)})`, line: { color: METHOD_COLORS[m] } })),
    layout: { height: 380, xaxis: { ...LOGAX, title: 'h (ns)' }, yaxis: { ...LOGAX, title: 'error en y(t_f)' }, legend: { x: 1, xanchor: 'right', y: 0, bgcolor: 'rgba(248,241,224,0.85)' } },
  }
})

// ---------- resultados del notebook
const tab = ref('global')
const nbPlot = computed(() => {
  const E = datos.value?.E2
  if (!E) return null
  const series = (blk, dash = 'solid', suffix = '') => Object.entries(blk.error).map(([m, e]) => ({ x: blk.h, y: e, mode: 'lines+markers', name: `${m}${suffix} (${fmt(blk.pendiente[m], 2)})`, line: { color: METHOD_COLORS[m], dash } }))
  const lay = (xt, yt) => ({ height: 380, xaxis: { ...LOGAX, title: xt }, yaxis: { ...LOGAX, title: yt }, legend: { x: 1, xanchor: 'right', y: 0, bgcolor: 'rgba(248,241,224,0.85)' } })
  if (tab.value === 'global') return { data: series(E), layout: lay('h (ns)', 'error global en y(t_f)') }
  if (tab.value === 'local') return { data: series(E.local), layout: lay('h (ns)', 'error de un paso') }
  if (tab.value === 'malla') return { data: [...series(E, 'dot', ' alineada').map((t) => ({ ...t, opacity: 0.35 })), ...series(E.desalineada, 'solid', ' desalineada')], layout: lay('h (ns)', 'error global') }
  if (tab.value === 'magnus') return {
    data: [{ x: E.h, y: E.error.Magnus4, mode: 'lines+markers', name: `Magnus 4 (${fmt(E.pendiente.Magnus4, 2)})`, line: { color: METHOD_COLORS.Magnus4 } },
      { x: E.magnus2.h, y: E.magnus2.error, mode: 'lines+markers', name: `sin conmutador (${fmt(E.magnus2.pendiente, 2)})`, line: { color: METHOD_COLORS['Magnus2 (sin conmutador)'], dash: 'dash' } }],
    layout: lay('h (ns)', 'error global'),
  }
  return null
})
const TABS = [['global', 'Error global'], ['local', 'Error local'], ['malla', 'Malla desalineada'], ['magnus', 'Magnus sin conmutador'], ['richardson', 'Richardson']]
</script>

<template>
  <section id="convergencia" class="doc">
    <p class="kicker">5 · Convergencia</p>
    <h2 class="doc-title">¿Cada método tiene el orden que promete?</h2>
    <p class="lead">Si el error global es <Tex e="e(h)\approx Ch^p" />, entonces <Tex e="\log e = \log C + p\log h" />: en escala log-log la <b>pendiente</b> es el orden. Si h se divide entre 2, el error baja <Tex e="2^p" /> veces (2 para Euler, 4 para Heun y Crank-Nicolson, 16 para RK4 y Magnus).</p>

    <div class="grid2 even">
      <div class="card">
        <h3>Experimento en vivo (en su navegador)</h3>
        <div class="row-controls">
          <label>Ruido
            <select v-model="preset"><option v-for="(v, key) in PRESETS" :key="key" :value="key">{{ v.label }}</option></select>
          </label>
          <div class="checks">
            <label v-for="m in FIXED" :key="m" :style="{ color: METHOD_COLORS[m] }"><input type="checkbox" :value="m" v-model="chosen" /> {{ m }}</label>
          </div>
        </div>
        <button class="cta-small" :disabled="running || !chosen.length" @click="runLive">{{ running ? 'Calculando…' : 'Correr convergencia (h = 2 … 1/16 ns)' }}</button>
        <div v-if="running" class="progress"><div :style="{ width: `${progress * 100}%` }"></div><span>{{ status }}</span></div>
        <template v-if="liveFit">
          <PlotlyChart :data="liveFit.data" :layout="liveFit.layout" />
          <div class="table-wrap">
            <table class="data compact">
              <thead><tr><th>Método</th><th>pendiente medida</th><th>orden teórico</th><th>evaluaciones de A (h = 1/16)</th></tr></thead>
              <tbody><tr v-for="r in liveFit.out" :key="r.m"><td :style="{ color: METHOD_COLORS[r.m] }">{{ r.m }}</td><td :class="Math.abs(r.p - ORDER[r.m]) < 0.2 ? 'good' : 'bad'">{{ fmt(r.p, 2) }}</td><td>{{ ORDER[r.m] }}</td><td>{{ r.rows.at(-1).nfev.toLocaleString('es') }}</td></tr></tbody>
            </table>
          </div>
        </template>
        <p class="explain">La referencia es Magnus 4 con h = 1/32 ns. La pendiente se ajusta por mínimos cuadrados con los 3 h más pequeños que siguen por encima de 10⁻¹¹. Es la <b>zona asintótica</b>, donde el término Chᵖ domina el error; más abajo manda el redondeo. Sin ruido, Magnus llega al redondeo muy rápido. Euler puede no estar todavía en su zona asintótica.</p>
      </div>

      <div v-if="datos" class="card">
        <h3>Resultados del notebook (E2)</h3>
        <div class="tabs"><button v-for="t in TABS" :key="t[0]" :class="{ on: tab === t[0] }" @click="tab = t[0]">{{ t[1] }}</button></div>
        <PlotlyChart v-if="nbPlot" v-bind="nbPlot" />
        <div v-if="tab === 'richardson'" class="table-wrap">
          <table class="data compact">
            <thead><tr><th>Método</th><th>h → h/2</th><th>error real</th><th>estimado</th><th>estimado / real</th><th>error extrapolado</th></tr></thead>
            <tbody><tr v-for="(r, i) in datos.E2.richardson" :key="i"><td :style="{ color: METHOD_COLORS[r.metodo] }">{{ r.metodo }}</td><td>{{ r.h }}</td><td>{{ fexp(r.real, 2) }}</td><td>{{ fexp(r.estimado, 2) }}</td><td :class="Math.abs(r.cociente - 1) < 0.05 ? 'good' : ''">{{ fmt(r.cociente, 3) }}</td><td>{{ fexp(r.extrapolado, 2) }}</td></tr></tbody>
          </table>
        </div>
        <p v-if="tab === 'global'" class="explain">Pendientes medidas: {{ Object.entries(datos.E2.pendiente).map(([m, p]) => `${m} ${p.toFixed(2)}`).join(' · ') }}. Coinciden con la teoría (1, 2, 4, 2, 4).</p>
        <p v-if="tab === 'local'" class="explain">Un solo paso desde el estado exacto en t = 10 ns. La pendiente es p + 1 ({{ Object.entries(datos.E2.local.pendiente).map(([m, p]) => `${m} ${p.toFixed(2)}`).join(' · ') }}): los N = T/h errores locales O(h^(p+1)) se acumulan en O(h^p).</p>
        <p v-if="tab === 'malla'" class="explain">Con h = 240/N y N no múltiplo de 12, los bordes de los pulsos caen dentro de un paso. Ahí la derivada de A(t) salta, y la cuadratura implícita en el método tiene error O(h²). RK4 y Magnus caen de orden 4 a ≈ 2 ({{ fmt(datos.E2.desalineada.pendiente.RK4, 2) }} y {{ fmt(datos.E2.desalineada.pendiente.Magnus4, 2) }}). Por eso el simulador exige que h divida la duración de las compuertas.</p>
        <p v-if="tab === 'magnus'" class="explain">Sin el término −(√3h²/12)[A₁, A₂], Magnus solo aproxima la primera integral de la serie y baja a orden 2. Aquí, con la malla alineada, los pulsos conmutan consigo mismos dentro de cada paso; solo el ruido no conmuta con ellos. Por eso [A₁, A₂] es diminuto: la versión sin conmutador es de orden 2, pero con una constante tan pequeña que las curvas apenas se separan. Sin ruido darían lo mismo.</p>
        <p v-if="tab === 'richardson'" class="explain">
          <Tex e="y - y_{h/2}\approx\dfrac{y_{h/2}-y_h}{2^p-1}" />: con dos corridas se estima el error sin conocer la solución. Si el cociente estimado / real ≈ 1, el método está en la zona asintótica. El valor extrapolado <Tex e="y_R = y_{h/2} + \frac{y_{h/2}-y_h}{2^p-1}" /> elimina el término principal del error y gana un orden.
        </p>
      </div>
    </div>

    <div class="card">
      <h3>Error local, error global y cuándo se cumple el orden</h3>
      <div class="mgrid three">
        <div>
          <h4>Error local de truncamiento</h4>
          <Tex block e="\tau_{n+1} = \mathbf y(t_{n+1}) - \big[\mathbf y(t_n) + h\Phi(t_n,\mathbf y(t_n),h)\big] = O(h^{p+1})" />
          <p class="explain">Es el error de un solo paso que parte de la solución exacta. Se obtiene comparando el método con el desarrollo de Taylor (o con las condiciones de orden de Butcher).</p>
        </div>
        <div>
          <h4>Error global</h4>
          <Tex block e="\|e_N\|\le\frac{Ch^p}{L}\big(e^{LT}-1\big) = O(h^p)" />
          <p class="explain">Con N = T/h pasos y una función de incremento Lipschitz (constante L), los errores locales se propagan y suman. Por eso el orden global es uno menos que el local.</p>
        </div>
        <div>
          <h4>Supuesto de suavidad</h4>
          <p class="explain">El orden p solo se observa si la solución tiene p + 1 derivadas continuas en cada paso. Los pulsos gaussianos son suaves por dentro pero su derivada salta en los bordes. Con la malla alineada a los bordes se recupera el orden completo.</p>
        </div>
      </div>
    </div>
  </section>
</template>
