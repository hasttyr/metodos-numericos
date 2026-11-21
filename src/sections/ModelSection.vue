<script setup>
import { ref, computed } from 'vue'
import Tex from '../components/Tex.vue'
import PlotlyChart from '../components/PlotlyChart.vue'
import { buildProcessor } from '../sim/quantum.js'
import { norm1 } from '../sim/linalg.js'
import { physical, params } from '../store.js'
import { AX, gateShapes } from '../ui.js'

const tSel = ref(10)
const sys = computed(() => buildProcessor(physical()))   // physical() registra las dependencias de T₁, T₂, Δ, t₁q

// |A(t)| como matriz 20×20 (bloques 𝓛 16×16 y −iH 4×4)
const heat = computed(() => {
  const [L, S] = sys.value.A(tSel.value)
  const z = Array.from({ length: 20 }, () => Array(20).fill(null))
  for (let i = 0; i < 16; i++) for (let j = 0; j < 16; j++) { const v = Math.hypot(L[2 * (i * 16 + j)], L[2 * (i * 16 + j) + 1]); z[i][j] = v > 1e-15 ? Math.log10(v) : null }
  for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) { const v = Math.hypot(S[2 * (i * 4 + j)], S[2 * (i * 4 + j) + 1]); z[16 + i][16 + j] = v > 1e-15 ? Math.log10(v) : null }
  const nnz = z.flat().filter((v) => v !== null).length
  return {
    nnz,
    data: [{ type: 'heatmap', z, colorscale: [[0, '#f3e6c6'], [0.5, '#d99a2b'], [1, '#5b3a1f']], zmin: -4, zmax: 0, hoverongaps: false,
      colorbar: { title: { text: 'log₁₀|a_ij|' }, outlinewidth: 0 }, hovertemplate: 'fila %{y}, col %{x}<br>log₁₀|a| = %{z:.2f}<extra></extra>' }],
    layout: { height: 340, margin: { l: 40, r: 10, t: 10, b: 30 }, xaxis: { ...AX, showgrid: false }, yaxis: { ...AX, autorange: 'reversed', showgrid: false },
      shapes: [{ type: 'line', x0: 15.5, x1: 15.5, y0: -0.5, y1: 19.5, line: { color: '#b5321f' } }, { type: 'line', y0: 15.5, y1: 15.5, x0: -0.5, x1: 19.5, line: { color: '#b5321f' } }] },
  }
})
const normCurve = computed(() => {
  const ts = Array.from({ length: 241 }, (_, i) => (i * sys.value.tf) / 240)
  const n = ts.map((t) => { const [L, S] = sys.value.A(t); return Math.max(norm1(L, 16), norm1(S, 4)) })
  return {
    data: [{ x: ts, y: n, mode: 'lines', line: { color: '#2f6f6a', width: 2 }, name: '‖A(t)‖₁' }],
    layout: { height: 200, margin: { l: 55, r: 10, t: 10, b: 40 }, xaxis: { ...AX, title: 't (ns)' }, yaxis: { ...AX, title: '‖A(t)‖₁ (rad/ns)' }, shapes: [...gateShapes(sys.value.gates), { type: 'line', x0: tSel.value, x1: tSel.value, yref: 'paper', y0: 0, y1: 1, line: { color: '#b5321f', dash: 'dot' } }], showlegend: false },
  }
})
</script>

<template>
  <section id="modelo" class="doc">
    <p class="kicker">2 · El modelo matemático</p>
    <h2 class="doc-title">Del qubit a un sistema de 40 EDOs</h2>
    <p class="lead">Antes de hablar de métodos hay que saber qué ecuación se resuelve, por qué es lineal y qué estructura tiene. Esa estructura decide qué métodos funcionan.</p>

    <div class="steps">
      <article class="card step">
        <span class="num">1</span>
        <h3>El estado: la matriz de densidad ρ</h3>
        <p>Con ruido, el estado de 2 qubits no es un vector sino una matriz 4×4 compleja <Tex e="\rho = \sum_k p_k|\psi_k\rangle\langle\psi_k|" />. La diagonal son las probabilidades de medir |00⟩, |01⟩, |10⟩ y |11⟩. Los elementos fuera de la diagonal (coherencias) guardan la información de fase, que es la que el ruido destruye.</p>
        <table class="mini">
          <tr><th>Propiedad</th><th>Significado</th><th>¿La conserva un método numérico?</th></tr>
          <tr><td><Tex e="\rho=\rho^\dagger" /></td><td>probabilidades reales</td><td class="good">sí, todos (coeficientes reales)</td></tr>
          <tr><td><Tex e="\operatorname{Tr}\rho=1" /></td><td>suman 1</td><td class="good">sí, todos (invariante lineal)</td></tr>
          <tr><td><Tex e="\rho\succeq0" /></td><td>no hay probabilidades negativas: el menor valor propio λ_min ≥ 0</td><td class="bad">no en general</td></tr>
          <tr><td><Tex e="\operatorname{Tr}\rho^2\le1" /></td><td>pureza</td><td class="bad">no en general</td></tr>
        </table>
      </article>

      <article class="card step">
        <span class="num">2</span>
        <h3>La dinámica: ecuación maestra de Lindblad</h3>
        <Tex block e="\frac{d\rho}{dt} = \underbrace{-i[H(t),\rho]}_{\text{pulsos}} + \underbrace{\sum_k\Big(L_k\rho L_k^\dagger - \tfrac12\{L_k^\dagger L_k,\rho\}\Big)}_{\text{ruido}}" />
        <p>El hamiltoniano en el marco rotante tiene los pulsos de microondas (compuertas de 1 qubit) y el pulso de flujo (CZ):</p>
        <Tex block e="H(t) = \sum_{j=1}^{2}\Big[\tfrac{\Delta_j}{2}\sigma_z^{(j)} + \tfrac{\Omega_{x,j}(t)}{2}\sigma_x^{(j)} + \tfrac{\Omega_{y,j}(t)}{2}\sigma_y^{(j)}\Big] + J(t)\,|11\rangle\langle 11|" />
        <p>Hay 4 operadores de ruido: relajación <Tex e="\sqrt{1/T_1}\,\sigma_-" /> y desfase <Tex e="\sqrt{\gamma_\varphi/2}\,\sigma_z" /> en cada qubit, con <Tex e="\gamma_\varphi = 1/T_2 - 1/(2T_1)" />. Por eso <Tex e="T_2\le 2T_1" />.</p>
      </article>

      <article class="card step">
        <span class="num">3</span>
        <h3>Vectorizar: de matriz a vector</h3>
        <p>Los integradores trabajan con vectores. Con la identidad <Tex e="\operatorname{vec}(AXB) = (B^T\otimes A)\operatorname{vec}(X)" />, cada término <Tex e="A\rho B" /> se vuelve una matriz 16×16 que multiplica a <Tex e="\vec\rho" />:</p>
        <Tex block e="\mathcal L(t) = -i\left(I\otimes H - H^{T}\otimes I\right) + \sum_k \Big( \bar{L}_k\otimes L_k - \tfrac{1}{2}\, I\otimes L_k^{\dagger}L_k - \tfrac{1}{2}\,(L_k^{\dagger}L_k)^{T}\otimes I \Big)" />
        <p>Como <Tex e="\mathcal L" /> es lineal en <Tex e="H" />, se arma una sola vez <Tex e="\mathcal L(t) = \mathcal L_0 + \sum_m c_m(t)\mathcal K_m" /> y en cada instante solo se combinan 5 matrices.</p>
      </article>

      <article class="card step">
        <span class="num">4</span>
        <h3>El sistema que se integra</h3>
        <Tex block e="\dot{\mathbf y} = A(t)\,\mathbf y,\qquad \mathbf y = (\vec\rho,\ \psi)\in\mathbb C^{20},\qquad A(t) = \begin{pmatrix}\mathcal L(t) & 0\\ 0 & -iH(t)\end{pmatrix}" />
        <p><b>20 EDOs complejas = 40 reales</b>, lineales, acopladas y con coeficientes que dependen del tiempo. El estado ideal ψ (sin ruido) se integra junto con ρ para medir la fidelidad <Tex e="F = \langle\psi|\rho|\psi\rangle" />. Como ρ es hermítica, solo 24 ecuaciones reales son independientes. Se integran las 40 a propósito, para usar <Tex e="\|\rho-\rho^\dagger\|" /> como prueba del código.</p>
      </article>

      <article class="card step">
        <span class="num">5</span>
        <h3>El algoritmo: Grover como una secuencia de pulsos</h3>
        <p>Grover busca el elemento marcado |11⟩ entre N = 4 con <b>una sola consulta</b> al oráculo. Con <Tex e="\sin\theta = 1/\sqrt N" />, después de k iteraciones la probabilidad de éxito es <Tex e="\sin^2((2k+1)\theta)" />, que con N = 4 y k = 1 da exactamente 1.</p>
        <pre class="circuit">|00⟩ ─ H⊗H ─ CZ ─ H⊗H ─ X⊗X ─ CZ ─ X⊗X ─ H⊗H ─ medir → |11⟩
        superposición  oráculo  └──── difusión 2|s⟩⟨s| − I ────┘</pre>
        <p>Cada compuerta es un pulso cuyo ángulo es su área: <Tex e="X = R_x(\pi)" />, <Tex e="H \propto R_x(\pi)R_y(\pi/2)" /> y <Tex e="\text{CZ}" /> con <Tex e="\int J\,dt = \pi" />. Son 8 capas de 20 ns y 2 CZ de 40 ns: <b>240 ns</b>. Los pulsos son gaussianas truncadas, desplazadas para empezar y terminar en 0: son continuas, pero su derivada salta en los bordes. Eso importa para el orden de los métodos (sección 5).</p>
      </article>
    </div>

    <div class="grid2 even">
      <div class="card">
        <h3>La matriz A(t) en t = {{ tSel.toFixed(1) }} ns · {{ heat.nnz }} de 400 elementos no nulos</h3>
        <input type="range" min="0" :max="sys.tf" step="0.5" v-model.number="tSel" aria-label="Instante t" />
        <PlotlyChart v-bind="heat" />
        <p class="explain">Es diagonal por bloques: arriba a la izquierda el bloque de Lindblad 𝓛 (16×16), abajo a la derecha −iH (4×4). Mueva t: durante un pulso aparecen los elementos del conmutador; entre pulsos solo queda el ruido (valores ~10⁻³). Usa los T₁, T₂ y Δ del simulador.</p>
      </div>
      <div class="card">
        <h3>Escala de frecuencias: ‖A(t)‖₁</h3>
        <PlotlyChart v-bind="normCurve" />
        <p class="explain">La norma de A(t) acota sus valores propios, |λ| ≤ ‖A‖. Durante los pulsos llega a ~0.6 rad/ns y en los instantes entre un pulso y el siguiente baja a ~10⁻³ rad/ns (la secuencia no tiene tramos de espera). Esta escala fija el paso máximo de los métodos explícitos (sección 4) y explica por qué el paso de RK45 crece en los bordes suaves de cada pulso.</p>
        <h3 class="mt">¿Por qué el marco rotante?</h3>
        <p class="explain">En el laboratorio el qubit oscila a ω_q ≈ 2π·5 GHz y los valores propios son ≈ ±31 i rad/ns. RK4 necesitaría h ≤ 2√2/ω_q = 0.09 ns solo para ser estable. Al pasar al marco rotante (con la aproximación de onda rotante) las oscilaciones rápidas desaparecen y se obtiene la misma precisión con ~200 veces menos pasos (4 000 contra 20 para un error ~10⁻⁵). El error que introduce la RWA es ≈ 4·10⁻⁶ (experimento E3 del notebook).</p>
      </div>
    </div>
  </section>
</template>
