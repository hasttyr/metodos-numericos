<script setup>
const FAQ = [
  ['¿Por qué 40 EDOs reales si solo 24 son independientes?', 'ρ es hermítica: bastan 4 reales de la diagonal y 6 complejos fuera de ella, más 4 complejos de ψ, es decir 24 reales. Se integran las 16 componentes complejas de ρ a propósito. Así el código sigue la ecuación de Lindblad tal cual, y ‖ρ − ρ†‖ sirve de prueba: si hubiera un error de signo en el código, la hermiticidad se rompería.'],
  ['¿Por qué la ecuación es lineal?', 'Cada término de Lindblad es de la forma AρB, y vec(AXB) = (Bᵀ ⊗ A) vec X. Lo difícil es que los coeficientes dependen del tiempo y que A(t) no conmuta consigo misma en tiempos distintos, así que la solución NO es exp(∫A dt).'],
  ['¿Por qué Euler diverge aunque h sea pequeño?', 'R(z) = 1 + z, y |R(iy)| = √(1 + y²) > 1 para todo y ≠ 0. Los valores propios de este problema son casi imaginarios. Cada paso multiplica la norma por 1 + O(h²): de forma exacta, ‖ψₙ₊₁‖² = ‖ψₙ‖² + h²‖Hψₙ‖². Reducir h solo hace el crecimiento más lento.'],
  ['Si todos conservan la traza, ¿cómo se detecta que Euler está mal?', 'La traza es un invariante lineal, y todo método de Runge-Kutta los conserva. La positividad (λ_min ≥ 0), la pureza (≤ 1) y ‖ψ‖ = 1 no son lineales: esas revelan el problema. Con h = 5 ns Euler da P(11) = −5914 y la traza sigue en 10⁻¹³.'],
  ['¿Qué diferencia hay entre estabilidad y precisión?', 'La estabilidad dice que el error no crece sin control. La precisión dice que el error es pequeño. RK4 con h = 2 ns es estable (todos los hλ dentro de su región; la cota es 4.8 ns) y aun así da P(11) = 0.767 en vez de 0.778. Con h = 5 ns, apenas por encima de la cota, no explota pero da 0.61.'],
  ['¿Por qué el error local tiene pendiente p + 1 y el global p?', 'Para llegar a t_f se dan N = t_f/h pasos y cada uno deja un error local O(h^(p+1)). Si el método es estable, los errores se propagan sin amplificarse demasiado y suman N · O(h^(p+1)) = O(h^p). Medido: 2, 3, 5, 3, 5 (local) contra 1, 2, 4, 2, 4 (global).'],
  ['¿Por qué h debe dividir la duración de las compuertas?', 'La derivada de los pulsos salta en sus bordes. Un paso que cruza un borde tiene error O(h²), porque la cuadratura implícita en el método falla ante una esquina. Hay un número fijo de bordes, así que el error global cae a O(h²): RK4 pasa de pendiente 4.00 a 1.99.'],
  ['¿Por qué Crank-Nicolson evalúa A en el punto medio?', 'Con el mismo M = A(t + h/2) a los dos lados, la matriz de paso de Schrödinger es una transformación de Cayley, (I − hM/2)⁻¹(I + hM/2), exactamente unitaria porque M es antihermítica. Con A(tₙ) a un lado y A(tₙ₊₁) al otro se pierde esa propiedad.'],
  ['Crank-Nicolson es implícito: ¿por qué no se usa Newton?', 'Porque el problema es lineal. La ecuación implícita de cada paso ya es un sistema lineal, que se resuelve con una factorización LU con pivoteo parcial escrita a mano. La matriz es casi la identidad, así que su número de condición es ≈ 1.'],
  ['Magnus es el más caro por paso: ¿de verdad es el más eficiente?', 'En evaluaciones de A sí: 480 contra 5 760 de RK4 para error 10⁻⁶, porque admite pasos 8 veces más largos. En flops empatan (≈ 11 M contra ≈ 10 M): un paso de Magnus cuesta ≈ 9 veces uno de RK4. En tiempo real depende de la plataforma: en Python gana Magnus y en JavaScript RK4. Su constante de error es diminuta porque, con la malla alineada, los pulsos conmutan consigo mismos dentro de cada paso; solo el ruido no conmuta con ellos.'],
  ['Si Euler no es estable para ningún h con valores propios imaginarios, ¿por qué converge con orden 1?', 'Porque la convergencia exige cero-estabilidad (h → 0 con T fijo), no estabilidad absoluta (h fijo). El crecimiento acumulado de Euler en [0, T] es (1 + h²ω²)^(T/2h) ≈ e^(hω²T/2), que tiende a 1 cuando h → 0. Converge, pero la constante crece con T: es inútil para simulaciones largas.'],
  ['¿Cómo se calcula e^Ω? ¿Por qué no con la serie de Taylor?', 'Con Padé [6/6] sobre X = Ω/2ˢ, con ‖X‖₁ ≤ 1/2, y luego s productos E ← E². Taylor directo sufre cancelación catastrófica: para e⁻³⁰ da un error relativo de 10⁸. La cota de error de Padé con q = 6 es 2·10⁻¹⁷, menor que el ε de máquina.'],
  ['¿Cómo sabe RK45 su error sin conocer la solución?', 'Con las mismas 7 etapas calcula una solución de orden 5 y otra de orden 4. Su diferencia estima el error local. Como ese error ∝ h⁵, el paso nuevo es h · (1/err)^(1/5) con un factor de seguridad de 0.9.'],
  ['¿Por qué no usar h = 10⁻¹⁰?', 'Porque el redondeo crece con el número de pasos. En float64 el error deja de bajar cerca de 10⁻¹⁴, y en float32 el mejor h es 2⁻⁶. Además el costo es ∝ 1/h: harían falta 2.4·10¹² pasos.'],
  ['¿El problema es rígido?', 'No. El cociente de rigidez es ≈ 2 y lo que domina son las partes imaginarias de los valores propios, unas 300 veces mayores que las reales. Basta un método explícito que cubra bien el eje imaginario, como RK4.'],
  ['¿Por qué el marco rotante?', 'En el laboratorio |λ| ≈ 31 rad/ns y RK4 necesita h ≤ 0.09 ns solo para ser estable. En el marco rotante |λ| ≲ 0.6 rad/ns y se consigue más precisión con ~200 veces menos pasos. La RWA introduce un error de ≈ 4·10⁻⁶.'],
  ['¿Por qué la secante usa menos evaluaciones que la bisección? ¿Por qué no usarla siempre?', 'La secante converge con orden ≈ 1.618 porque usa el valor de g y no solo su signo: 7 – 13 evaluaciones contra 18 de la bisección. Pero puede diverger si g es casi plana o si arranca lejos de la raíz. La bisección siempre converge si hay cambio de signo.'],
  ['Crank-Nicolson es A-estable: ¿por qué da λ_min < 0?', 'La A-estabilidad dice que el error no crece, no que el resultado sea un estado físico. En Grover no hay componentes rápidas (|h Re λ| ≤ 0.01): la causa es el error O(h²) de CN en los valores propios que valen ≈ 0, porque el estado es casi puro. Ningún método de Runge-Kutta de orden > 1 garantiza la positividad para todo h (Bolley-Crouzeix); Euler implícito sí. Además CN no es L-estable: R(z) → −1 cuando z → −∞.'],
  ['¿Qué tiene que ver esto con Ingeniería de Sistemas?', 'Es un proyecto de software científico completo: modelado, algoritmos numéricos implementados y probados desde cero, análisis de costo, validación contra otra librería, una segunda implementación en otro lenguaje con pruebas automáticas y una aplicación interactiva. Además responde una pregunta de requisitos de hardware para un algoritmo.'],
]
</script>

<template>
  <section id="preguntas" class="doc">
    <p class="kicker">10 · Discusión</p>
    <h2 class="doc-title">Preguntas clave sobre los métodos</h2>
    <p class="lead">Las dudas que aparecen al comparar los seis métodos, respondidas con los resultados del proyecto.</p>
    <div class="faq">
      <details v-for="([q, a], i) in FAQ" :key="i" class="card">
        <summary><span class="qn">{{ String(i + 1).padStart(2, '0') }}</span>{{ q }}</summary>
        <p>{{ a }}</p>
      </details>
    </div>
  </section>
</template>
