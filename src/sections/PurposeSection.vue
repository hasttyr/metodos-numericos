<script setup>
const USOS = [
  {
    n: '01', titulo: 'Saber qué hardware hace falta antes de construirlo',
    texto: 'Un computador cuántico falla por el ruido. Fabricar un chip superconductor y enfriarlo cerca del cero absoluto cuesta millones. El simulador funciona como un laboratorio virtual que responde cuánta coherencia necesitan los qubits para que el algoritmo acierte.',
    dato: 'T₁ ≥ 16 µs para acertar el 99 % de las veces: unas 16 veces lo que se tenía en 2009.', link: '#ingenieria',
  },
  {
    n: '02', titulo: 'Fijar tolerancias de calibración',
    texto: 'Cada compuerta es un pulso de microondas. El simulador dice qué tan preciso debe ser ese pulso, igual que una especificación de ingeniería fija las tolerancias de una pieza.',
    dato: 'Error de amplitud < 1.4 % y de frecuencia < 2.6 MHz para mantener P ≥ 0.99.', link: '#ingenieria',
  },
  {
    n: '03', titulo: 'Probar compuertas como pulsos antes de enviarlas al chip',
    texto: 'Los equipos de software cuántico simulan sus pulsos de control antes de ejecutarlos en hardware real, con herramientas como QuTiP o Qiskit Dynamics. Aquí se construyó una versión propia desde cero y se validó contra QuTiP.',
    dato: 'Diferencia con QuTiP < 10⁻⁹; fidelidad de cada compuerta = 1.0000000000.', link: '#validacion',
  },
  {
    n: '04', titulo: 'Mostrar que el método numérico decide si el simulador dice la verdad',
    texto: 'Con Euler el simulador da una probabilidad de −5914 y aun así parece funcionar, porque la traza se conserva. Esto vale para cualquier simulación de ingeniería (circuitos, estructuras, clima): un mal integrador da respuestas falsas con apariencia válida. Por eso se miden el orden, la estabilidad y el costo de cada método.',
    dato: 'Con los mismos datos, Magnus 4 necesita 12 veces menos evaluaciones que RK4 mientras Euler no llega a error 10⁻⁶ con ningún paso razonable.', link: '#fisica',
  },
]
</script>

<template>
  <section id="proposito" class="doc purpose">
    <p class="kicker">¿Para qué sirve?</p>
    <h2 class="doc-title">Un laboratorio virtual para diseñar hardware cuántico</h2>
    <p class="lead">El proyecto simula el procesador de 2 qubits con el que DiCarlo et al. (Yale, 2009) ejecutaron por primera vez el algoritmo de Grover en un chip superconductor, incluido el ruido que lo hace fallar. Sirve para cuatro cosas:</p>
    <div class="usos">
      <a v-for="u in USOS" :key="u.n" :href="u.link" class="card uso">
        <span class="un">{{ u.n }}</span>
        <h3>{{ u.titulo }}</h3>
        <p>{{ u.texto }}</p>
        <p class="dato">{{ u.dato }}</p>
      </a>
    </div>
  </section>
</template>
