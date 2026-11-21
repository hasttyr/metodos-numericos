<script setup>
import { ref } from 'vue'
import Tex from '../components/Tex.vue'
import { tryMethod, params } from '../store.js'
import { METHOD_COLORS } from '../ui.js'

const METHODS = [
  {
    id: 'Euler', nombre: 'Euler explícito', orden: 1, tipo: 'explícito · 1 etapa',
    idea: 'Trunca la serie de Taylor después del término lineal: avanza en la dirección de la derivada al inicio del paso.',
    paso: String.raw`\mathbf y_{n+1} = \mathbf y_n + h\,A(t_n)\,\mathbf y_n`,
    error: String.raw`\tau = \tfrac{h^2}{2}\ddot{\mathbf y}(\xi) = O(h^2)\ \Rightarrow\ e_N = O(h)`,
    butcher: String.raw`\begin{array}{c|c} 0 & 0\\ \hline & 1\end{array}`,
    R: String.raw`R(z) = 1+z`,
    estab: String.raw`|R(iy)| = \sqrt{1+y^2} > 1\ \ \forall y\neq0`,
    estabTxt: 'Su región es el disco |1 + z| ≤ 1, que solo toca el eje imaginario en el origen. Toda oscilación pura crece. En la parte de Schrödinger, de forma exacta: ‖ψₙ₊₁‖² = ‖ψₙ‖² + h²‖Hψₙ‖².',
    costo: '1 evaluación de A(t) y 1 producto matriz-vector', pro: ['El más simple', 'Sirve de línea base'], contra: ['Inestable para oscilaciones con cualquier h', 'Orden 1: error enorme'], h: 1,
  },
  {
    id: 'Heun', nombre: 'Heun (RK2)', orden: 2, tipo: 'explícito · 2 etapas · predictor-corrector',
    idea: 'Regla del trapecio en la que el valor final se predice con un paso de Euler y luego se corrige con el promedio de las pendientes.',
    paso: String.raw`\mathbf k_1 = A(t_n)\mathbf y_n,\quad \mathbf k_2 = A(t_n+h)(\mathbf y_n + h\mathbf k_1),\quad \mathbf y_{n+1} = \mathbf y_n + \tfrac h2(\mathbf k_1+\mathbf k_2)`,
    error: String.raw`\tau = O(h^3)\ \Rightarrow\ e_N = O(h^2)`,
    butcher: String.raw`\begin{array}{c|cc} 0 & & \\ 1 & 1 & \\ \hline & \tfrac12 & \tfrac12\end{array}`,
    R: String.raw`R(z) = 1 + z + \tfrac{z^2}{2}`,
    estab: String.raw`|R(iy)|^2 = 1 + \tfrac{y^4}{4} > 1`,
    estabTxt: 'Tampoco contiene el eje imaginario, pero el crecimiento por paso es 1 + O(h⁴) en vez de 1 + O(h²): con h pequeño es casi imperceptible en 240 ns.',
    costo: '2 evaluaciones de A(t) y 2 productos matriz-vector', pro: ['Orden 2 con muy poco código', 'Buen ejemplo de predictor-corrector'], contra: ['Inestable en el eje imaginario', 'λ_min < 0 incluso con h pequeño'], h: 0.5,
  },
  {
    id: 'RK4', nombre: 'Runge-Kutta clásico (RK4)', orden: 4, tipo: 'explícito · 4 etapas',
    idea: 'Promedia cuatro pendientes (inicio, dos en el punto medio y final) con pesos 1-2-2-1, como la regla de Simpson aplicada a la derivada.',
    paso: String.raw`\mathbf y_{n+1} = \mathbf y_n + \tfrac h6(\mathbf k_1 + 2\mathbf k_2 + 2\mathbf k_3 + \mathbf k_4)`,
    error: String.raw`\tau = O(h^5)\ \Rightarrow\ e_N = O(h^4)`,
    butcher: String.raw`\begin{array}{c|cccc} 0 & & & & \\ \tfrac12 & \tfrac12 & & & \\ \tfrac12 & 0 & \tfrac12 & & \\ 1 & 0 & 0 & 1 & \\ \hline & \tfrac16 & \tfrac13 & \tfrac13 & \tfrac16\end{array}`,
    R: String.raw`R(z) = 1 + z + \tfrac{z^2}{2} + \tfrac{z^3}{6} + \tfrac{z^4}{24}`,
    estab: String.raw`|R(iy)|^2 = 1 - \tfrac{y^6}{72} + \tfrac{y^8}{576} \le 1 \iff |y|\le 2\sqrt2`,
    estabTxt: 'Los términos en y² y y⁴ se cancelan al calcular |R(iy)|². Por eso RK4 contiene el tramo |y| ≤ 2√2 ≈ 2.83 del eje imaginario. Dentro, |R| < 1: disipa un poco (‖ψ‖ baja ~10⁻⁶).',
    costo: '3 evaluaciones de A(t) (la del punto medio sirve para k₂ y k₃) y 4 productos matriz-vector', pro: ['Orden 4 con código simple', 'Estable para oscilaciones si h|λ| ≤ 2√2'], contra: ['Estable no es preciso: con h = 2 ns (dentro de la cota de 4.8 ns) falla por 0.01 en P(11)', 'Pierde orden si la malla no cae en los bordes de los pulsos'], h: 0.25,
  },
  {
    id: 'RK45', nombre: 'Dormand-Prince RK45 adaptativo', orden: '5(4)', tipo: 'explícito · 7 etapas · par encajado 5(4) · FSAL',
    idea: 'Con las mismas 7 etapas calcula dos soluciones, de orden 5 y de orden 4. Su diferencia estima el error local sin conocer la solución y con eso elige el siguiente paso.',
    paso: String.raw`\text{err} = \Big\|\frac{h\sum_i(b_i-\hat b_i)\mathbf k_i}{\text{atol} + \text{rtol}\,|\mathbf y|}\Big\|_{\text{RMS}},\qquad h_{\text{nuevo}} = h\cdot\min\!\big(5,\max(0.2,\,0.9\,\text{err}^{-1/5})\big)`,
    error: String.raw`\text{acepta si err}\le1;\ \text{si no, repite con } h_{\text{nuevo}}`,
    butcher: String.raw`\begin{array}{c|ccccccc} 0 \\ \frac15 & \frac15 \\ \frac{3}{10} & \frac{3}{40} & \frac{9}{40} \\ \frac45 & \frac{44}{45} & -\frac{56}{15} & \frac{32}{9} \\ \frac89 & \frac{19372}{6561} & \cdots \\ 1 & \cdots \\ 1 & \frac{35}{384} & 0 & \frac{500}{1113} & \frac{125}{192} & -\frac{2187}{6784} & \frac{11}{84} \\ \hline & \frac{35}{384} & 0 & \frac{500}{1113} & \frac{125}{192} & -\frac{2187}{6784} & \frac{11}{84} & 0\end{array}`,
    R: String.raw`R(z) = \textstyle\sum_{k=0}^{5}\frac{z^k}{k!} + \frac{z^6}{600}`,
    estab: String.raw`\beta\approx 1.0\ (\text{eje imaginario}),\quad \alpha\approx3.3\ (\text{eje real})`,
    estabTxt: 'Su región llega lejos en el eje real pero cubre poco del eje imaginario: está pensada para problemas con amortiguamiento, no para oscilaciones puras. Las 17 condiciones hasta orden 5 se verificaron con fracciones exactas en el notebook.',
    costo: '6 evaluaciones nuevas por paso aceptado (la 7.ª es la 1.ª del siguiente: FSAL) + los pasos rechazados', pro: ['No hay que elegir h: se elige la tolerancia', 'Pasos largos donde la solución es suave'], contra: ['Rechaza ~1 de cada 5 intentos; el 78 % de los rechazos son pasos que contienen un borde de pulso (E6)', 'Aquí casi no hay tramos sin pulsos para aprovechar'], h: 0.25,
  },
  {
    id: 'Crank-Nicolson', nombre: 'Crank-Nicolson (punto medio implícito)', orden: 2, tipo: 'implícito · A-estable',
    idea: 'Usa el promedio de los extremos del paso con A evaluada en el punto medio. El valor nuevo aparece a los dos lados: hay que resolver un sistema lineal en cada paso.',
    paso: String.raw`\big(I - \tfrac h2 M\big)\,\mathbf y_{n+1} = \big(I + \tfrac h2 M\big)\,\mathbf y_n,\qquad M = A(t_n + \tfrac h2)`,
    error: String.raw`\tau = O(h^3)\ \Rightarrow\ e_N = O(h^2)`,
    butcher: String.raw`\begin{array}{c|c} \tfrac12 & \tfrac12\\ \hline & 1\end{array}`,
    R: String.raw`R(z) = \frac{1+z/2}{1-z/2}`,
    estab: String.raw`|1+\tfrac z2|^2 - |1-\tfrac z2|^2 = 2\operatorname{Re}z \le 0`,
    estabTxt: 'A-estable: estable con cualquier h si Re λ ≤ 0. En el eje imaginario |R| = 1 exactamente. Para Schrödinger, M es antihermítica y la matriz de paso es una transformación de Cayley, exactamente unitaria: ‖ψ‖ se conserva aun con H(t) variable. No es L-estable: R(z) → −1 cuando z → −∞.',
    costo: '1 evaluación de A(t) + 1 factorización LU con pivoteo parcial (≈ ⅔n³) por paso. Como el problema es lineal, no hace falta Newton.', pro: ['Estable con cualquier h', 'Conserva ‖ψ‖ exactamente'], contra: ['Solo orden 2', 'λ_min < 0 y oscilaciones de signo en componentes rígidas'], h: 1,
  },
  {
    id: 'Magnus4', nombre: 'Magnus de 4.º orden', orden: 4, tipo: 'integrador exponencial · geométrico',
    idea: 'Para y′ = A(t)y la solución es y = e^Ω y₀. Se trunca la serie de Magnus en el término del conmutador y las integrales se hacen con cuadratura de Gauss-Legendre de 2 nodos.',
    paso: String.raw`\Omega_n = \frac h2(A_1 + A_2) - \frac{\sqrt3\,h^2}{12}[A_1,A_2],\quad A_i = A\big(t_n + (\tfrac12\mp\tfrac{\sqrt3}{6})h\big),\quad \mathbf y_{n+1} = e^{\Omega_n}\mathbf y_n`,
    error: String.raw`\tau = O(h^5)\ \Rightarrow\ e_N = O(h^4)\quad(\text{sin el conmutador: } O(h^2))`,
    butcher: String.raw`e^{\Omega}\approx D_6(X)^{-1}N_6(X)\ \text{(Padé [6/6])},\quad X = \Omega/2^s,\ \|X\|_1\le\tfrac12,\quad e^{\Omega} = (e^{X})^{2^s}`,
    R: String.raw`R(z) = e^{z}`,
    estab: String.raw`|e^{z}|\le1 \iff \operatorname{Re}z\le0`,
    estabTxt: 'Para Schrödinger Ω es antihermítica y e^Ω es exactamente unitaria. Para el escalar y el bloque ψ esto es exacto. Para el bloque de Lindblad, con el término del conmutador, no está demostrado: la parte principal de Ω es un promedio de generadores de Lindblad (exponencial completamente positiva) y el conmutador solo involucra el ruido contra los pulsos, que es diminuto. En todas las pruebas Magnus nunca dio λ_min < 0, pero es un resultado empírico. ¿Por qué es tan preciso aquí? Con la malla alineada cada capa usa un solo eje de rotación, así que los pulsos conmutan consigo mismos dentro del paso. Esta ventaja no se mantendría con pulsos simultáneos en dos ejes ni con Δ ≠ 0.',
    costo: '2 evaluaciones de A(t), 2 productos matriz-matriz (conmutador) y 1 exponencial de matriz por paso', pro: ['El que menos evaluaciones de A necesita: 480 para error 10⁻⁶ (en flops empata con RK4)', 'Respeta la estructura del problema'], contra: ['El más caro por paso', 'Necesita una exponencial de matriz robusta'], h: 1,
  },
]
const open = ref('RK4')
</script>

<template>
  <section id="metodos" class="doc">
    <p class="kicker">3 · Los seis métodos</p>
    <h2 class="doc-title">Seis formas de avanzar un paso</h2>
    <p class="lead">Todos resuelven el mismo <Tex e="\dot{\mathbf y} = A(t)\mathbf y" /> en la malla <Tex e="t_n = nh" />. Difieren en cuántas veces evalúan <Tex e="A(t)" /> por paso, en el error que dejan (orden) y en qué valores de <Tex e="h\lambda" /> toleran sin explotar (estabilidad). Todos están escritos desde cero, en Python (notebook) y en JavaScript (esta página).</p>

    <div class="method-tabs" role="tablist">
      <button v-for="m in METHODS" :key="m.id" role="tab" :aria-selected="open === m.id" :class="{ on: open === m.id }" :style="{ '--mc': METHOD_COLORS[m.id] }" @click="open = m.id">
        <span class="dot"></span>{{ m.nombre }}<small>orden {{ m.orden }}</small>
      </button>
    </div>

    <template v-for="m in METHODS" :key="m.id">
      <article v-if="open === m.id" class="card method-card" :style="{ '--mc': METHOD_COLORS[m.id] }">
        <header>
          <div>
            <h3>{{ m.nombre }}</h3>
            <p class="tipo">{{ m.tipo }} · orden {{ m.orden }}</p>
          </div>
          <button class="cta-small" @click="tryMethod(m.id, m.h)">Probar en el simulador{{ m.id !== 'RK45' ? ` (h = ${m.h} ns)` : '' }} ↑</button>
        </header>
        <p class="idea">{{ m.idea }}</p>
        <div class="mgrid">
          <div>
            <h4>Paso</h4>
            <Tex block :e="m.paso" />
            <h4>Error</h4>
            <Tex block :e="m.error" />
            <h4>Costo por paso</h4>
            <p>{{ m.costo }}</p>
          </div>
          <div>
            <h4>{{ m.id === 'Magnus4' ? 'Exponencial de matriz' : 'Tabla de Butcher' }}</h4>
            <Tex block :e="m.butcher" />
            <h4>Función de estabilidad (y′ = λy, z = hλ)</h4>
            <Tex block :e="m.R" />
            <Tex block :e="m.estab" />
            <p>{{ m.estabTxt }}</p>
          </div>
        </div>
        <div class="procon">
          <ul class="pro"><li v-for="x in m.pro" :key="x">{{ x }}</li></ul>
          <ul class="con"><li v-for="x in m.contra" :key="x">{{ x }}</li></ul>
        </div>
      </article>
    </template>

    <div class="card">
      <h3>Herramientas auxiliares (también escritas a mano)</h3>
      <div class="mgrid three">
        <div>
          <h4>LU con pivoteo parcial (para Crank-Nicolson y Padé)</h4>
          <Tex block e="PM = LU,\quad l_{ik} = a_{ik}/a_{kk},\quad p = \arg\max_{i\ge k}|a_{ik}|" />
          <p class="explain">Eliminación gaussiana; luego <Tex e="L\mathbf z = P\mathbf b" /> hacia adelante y <Tex e="U\mathbf x = \mathbf z" /> hacia atrás. Costo ≈ ⅔n³ para factorizar y 2n² por sustitución. El pivote de mayor módulo evita dividir por números diminutos: sin él, la matriz [[10⁻¹⁷, 1], [1, 1]] da x = [0, 1] en vez de [1, 1]. En Crank-Nicolson la matriz I − (h/2)M es casi la identidad (cond ≈ 1): está bien condicionada. Se validó contra LAPACK con residuos ~10⁻¹⁴.</p>
        </div>
        <div>
          <h4>Exponencial de matriz: Padé [6/6] + scaling and squaring</h4>
          <Tex block e="e^{X}\approx D_6(X)^{-1}N_6(X),\quad c_k = c_{k-1}\frac{q-k+1}{k(2q-k+1)},\quad e^{\Omega} = \big(e^{\Omega/2^s}\big)^{2^s}" />
          <p class="explain">Se escala hasta ‖X‖₁ ≤ ½. Allí el error del aproximante es ≤ (q!)²/((2q)!(2q+1)!)·2⁻¹³ ≈ 2·10⁻¹⁷, menor que ε; las s elevaciones al cuadrado amplifican el redondeo ~2ˢ. Cuesta ≈ 6 productos matriz-matriz + 1 LU con n lados derechos + s cuadrados. ¿Por qué no Taylor? Para e⁻³⁰ la serie suma términos de 10¹² con signos alternos y da un error relativo de 10⁸ (cancelación catastrófica). Padé con escalado da 10⁻¹⁴.</p>
        </div>
        <div>
          <h4>Cuadratura: Simpson y Gauss-Legendre</h4>
          <Tex block e="\int_a^b f\approx\tfrac h3\big[f_0 + 4\textstyle\sum f_{\text{impar}} + 2\sum f_{\text{par}} + f_n\big],\quad E = -\tfrac{(b-a)h^4}{180}f^{(4)}(\xi)" />
          <p class="explain">Con ellas se verificó que el área de cada pulso es exactamente θ: Simpson converge con pendiente −4.03 y Gauss-Legendre (exacta hasta grado 2n − 1, nodos por Golub-Welsch) llega al redondeo con 16 nodos. Conexión: Gauss-Legendre con n = 2 da los nodos ½ ∓ √3/6 de Magnus, y RK4 es "Simpson aplicado a la derivada". Por eso, si la derivada de A(t) salta dentro de un paso, la cuadratura implícita pierde orden (sección 5).</p>
        </div>
      </div>
      <h4>Verificación del orden (aritmética exacta)</h4>
      <p class="explain">Un método tiene orden p si cumple las condiciones de Butcher hasta p: <Tex e="\mathbf b^T\mathbf 1 = 1" />, <Tex e="\mathbf b^T\mathbf c = \tfrac12" />, <Tex e="\mathbf b^T\mathbf c^2 = \tfrac13" />, <Tex e="\mathbf b^TA\mathbf c = \tfrac16" />, <Tex e="\mathbf b^T\mathbf c^3 = \tfrac14" />, <Tex e="\mathbf b^TCA\mathbf c = \tfrac18" />, <Tex e="\mathbf b^TA\mathbf c^2 = \tfrac1{12}" />, <Tex e="\mathbf b^TA^2\mathbf c = \tfrac1{24}" /> (8 hasta orden 4; 17 hasta orden 5). En el notebook se evalúan con fracciones exactas (<code>fractions.Fraction</code>): Euler 1, Heun 2, RK4 4, Dormand-Prince 5 y su estimador 4, con residuo exactamente 0.</p>
    </div>

    <div class="card">
      <h3>Comparación</h3>
      <div class="table-wrap">
        <table class="data">
          <thead><tr><th>Método</th><th>Orden</th><th>Evaluaciones de A por paso</th><th>Operación extra</th><th>Eje imaginario</th><th>‖ψ‖</th><th>Para este problema</th></tr></thead>
          <tbody>
            <tr><td>Euler</td><td>1</td><td>1</td><td>—</td><td class="bad">no</td><td class="bad">crece</td><td class="bad">no sirve</td></tr>
            <tr><td>Heun</td><td>2</td><td>2</td><td>—</td><td class="bad">no</td><td class="bad">crece O(h⁴)</td><td>didáctico</td></tr>
            <tr><td>RK4</td><td>4</td><td>3</td><td>—</td><td class="good">hasta 2√2</td><td>disipa O(h⁶)</td><td class="good">muy bueno</td></tr>
            <tr><td>RK45</td><td>5(4)</td><td>6 + rechazos</td><td>control de paso</td><td>hasta ≈ 1.0</td><td>casi</td><td>bueno</td></tr>
            <tr><td>Crank-Nicolson</td><td>2</td><td>1</td><td>LU 20×20</td><td class="good">todo</td><td class="good">exacta</td><td>estable, poco preciso</td></tr>
            <tr><td>Magnus 4</td><td>4</td><td>2</td><td>e^Ω 20×20</td><td class="good">todo</td><td class="good">exacta</td><td class="good">el mejor</td></tr>
          </tbody>
        </table>
      </div>
      <p class="explain">Método activo en el simulador: <b>{{ params.method }}</b>. Marco teórico común: un método es de orden p si el error de un paso (error local) es O(h^(p+1)). Los N = T/h errores locales se acumulan en un error global O(h^p). Si además es cero-estable (los errores no explotan cuando h → 0), converge: teorema de equivalencia de Dahlquist. Todos los Runge-Kutta son cero-estables. Por eso Euler converge en la prueba de convergencia aunque no sea absolutamente estable para oscilaciones con h fijo.</p>
    </div>
  </section>
</template>
