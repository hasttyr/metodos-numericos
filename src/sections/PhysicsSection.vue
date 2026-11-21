<script setup>
import { ref, shallowRef, computed } from 'vue'
import Tex from '../components/Tex.vue'
import { datos, params, physical } from '../store.js'
import { METHOD_COLORS, fmt } from '../ui.js'
import { simulate, METHODS } from '../sim/quantum.js'

const hSel = ref(1)
const e5 = computed(() => datos.value?.E5.filter((r) => r.h === hSel.value) ?? [])

// comparación en vivo de los 6 métodos con la configuración del simulador
const live = shallowRef(null), busy = ref(false)
function compare() {
  busy.value = true
  setTimeout(() => {
    live.value = METHODS.map((m) => {
      const r = simulate({ ...physical(), method: m, h: params.h, rtol: 10 ** params.logTol })
      const f = r.frames
      return { m, P11: f.at(-1).pops[3], lmin: Math.min(...f.map((x) => x.lambdaMin)), pur: Math.max(...f.map((x) => x.pureza)), norm: f.at(-1).normaPsi, tr: Math.max(...f.map((x) => x.trazaErr)), herm: Math.max(...f.map((x) => x.hermErr)), ms: r.cpuMs, evals: r.evals }
    })
    busy.value = false
  }, 20)
}
const cls = {
  lmin: (v) => (v < -1e-6 ? 'bad' : v < -1e-12 ? 'warn' : 'good'),
  pur: (v) => (v > 1 + 1e-6 ? 'bad' : 'good'),
  norm: (v) => (Math.abs(v - 1) > 1e-3 ? 'bad' : Math.abs(v - 1) > 1e-10 ? 'warn' : 'good'),
  small: (v) => (v > 1e-10 ? 'bad' : 'good'),
}
</script>

<template>
  <section id="fisica" class="doc">
    <p class="kicker">7 · Física preservada</p>
    <h2 class="doc-title">Un error pequeño no garantiza un estado posible</h2>
    <p class="lead">La solución exacta de Lindblad siempre es una matriz de densidad válida (el flujo es completamente positivo y preserva la traza). Un método numérico no hereda esa garantía. Hay propiedades que se conservan siempre y otras que no.</p>

    <div class="mgrid three">
      <div class="card">
        <h3>Traza: se conserva siempre</h3>
        <Tex block e="\operatorname{Tr}\rho = \mathbf w^T\vec\rho,\quad \mathbf w^T\mathcal L(t) = 0" />
        <p class="explain">Es un invariante lineal. Cada etapa de un Runge-Kutta cumple <Tex e="\mathbf w^T\mathbf k_i = \mathbf w^TA\,Y_i = 0" />, así que <Tex e="\mathbf w^T\mathbf y_{n+1} = \mathbf w^T\mathbf y_n" />. Lo mismo vale para Magnus (<Tex e="\mathbf w^T\Omega = 0" />) y para Crank-Nicolson. <b>Todos</b> la conservan hasta el redondeo, incluso Euler cuando da resultados absurdos.</p>
      </div>
      <div class="card">
        <h3>Hermiticidad: se conserva siempre</h3>
        <Tex block e="\mathcal L(\rho^\dagger) = \mathcal L(\rho)^\dagger" />
        <p class="explain">Todos los coeficientes de los métodos (pesos de Butcher, coeficientes de Padé, h) son reales, así que cada paso conmuta con la operación ρ ↦ ρ†. Si ρ₀ es hermítica, ρₙ también lo es. El código integra las 16 componentes sin imponer la simetría precisamente para poder comprobarlo.</p>
      </div>
      <div class="card">
        <h3>Positividad y pureza: no se conservan</h3>
        <Tex block e="\rho\succeq0\ \ (\lambda_{\min}\ge 0),\qquad \operatorname{Tr}\rho^2\le 1" />
        <p class="explain">No son propiedades lineales. Ejemplo mínimo: con Euler, el decaimiento de |1⟩ da <Tex e="\rho_{11}^{n+1} = (1 - h\gamma_1)\rho_{11}^n" />, que es negativo si <Tex e="h\gamma_1 > 1" />. Estas son las métricas que delatan a un mal método.</p>
      </div>
    </div>

    <div class="grid2 even">
      <div v-if="datos" class="card">
        <h3>Grover con T₁ = T₂ = 1 µs: peores valores en toda la trayectoria (E5)</h3>
        <label class="inline">h <select v-model.number="hSel"><option v-for="v in [0.25, 1, 2, 5]" :key="v" :value="v">{{ v }} ns</option></select></label>
        <div class="table-wrap">
          <table class="data compact">
            <thead><tr><th>Método</th><th>P(11)</th><th>λ_min</th><th>pureza máx.</th><th>‖ψ‖</th><th>|Tr ρ − 1|</th><th>‖ρ − ρ†‖</th></tr></thead>
            <tbody><tr v-for="r in e5" :key="r.metodo"><td :style="{ color: METHOD_COLORS[r.metodo] }">{{ r.metodo }}</td><td>{{ fmt(r.P11) }}</td><td :class="cls.lmin(r.lmin)">{{ fmt(r.lmin, 4) }}</td><td :class="cls.pur(r.pureza)">{{ fmt(r.pureza) }}</td><td :class="cls.norm(r.normapsi)">{{ fmt(r.normapsi, 6) }}</td><td :class="cls.small(r.traza)">{{ fmt(r.traza) }}</td><td :class="cls.small(r.herm)">{{ fmt(r.herm) }}</td></tr></tbody>
          </table>
        </div>
        <p class="explain">El valor convergido es P(11) = 0.7779. Euler falla con todos los h, incluso con 0.25 ns: su h máximo estable es ≈ 0.012 ns. Heun y Crank-Nicolson dan λ_min ligeramente negativo. RK4 con h = 5 ns es estable pero da 0.61. <b>Magnus nunca dio λ_min &lt; 0</b> y da 0.7779 incluso con h = 5 ns. Mientras tanto, traza y hermiticidad quedan en ~10⁻¹⁵ en todos los casos.</p>
      </div>
      <div class="card">
        <h3>Compare los 6 métodos con la configuración del simulador</h3>
        <p class="hint">Usa T₁, T₂, Δ, error de área y h del panel (RK45 usa la tolerancia del panel).</p>
        <button class="cta-small" :disabled="busy" @click="compare">{{ busy ? 'Simulando…' : 'Comparar ahora' }}</button>
        <div v-if="live" class="table-wrap">
          <table class="data compact">
            <thead><tr><th>Método</th><th>P(11)</th><th>λ_min</th><th>pureza máx.</th><th>‖ψ‖</th><th>|Tr ρ − 1|</th><th>evaluaciones</th><th>ms</th></tr></thead>
            <tbody><tr v-for="r in live" :key="r.m"><td :style="{ color: METHOD_COLORS[r.m] }">{{ r.m }}</td><td>{{ fmt(r.P11) }}</td><td :class="cls.lmin(r.lmin)">{{ fmt(r.lmin, 4) }}</td><td :class="cls.pur(r.pur)">{{ fmt(r.pur) }}</td><td :class="cls.norm(r.norm)">{{ fmt(r.norm, 6) }}</td><td :class="cls.small(r.tr)">{{ fmt(r.tr) }}</td><td>{{ r.evals.toLocaleString('es') }}</td><td>{{ r.ms.toFixed(0) }}</td></tr></tbody>
          </table>
        </div>
        <p class="explain">Rojo: estado imposible o norma rota. Ámbar: violación pequeña (del tamaño del error de truncamiento). Pruebe h = 2 ns con T₁ = T₂ = 1 µs y compare con la tabla de la izquierda.</p>
      </div>
    </div>
  </section>
</template>
