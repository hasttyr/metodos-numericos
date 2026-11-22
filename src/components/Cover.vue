<script setup>
const integrantes = [
  'Nilson Aldair Molina Rengifo',
  'Julian Enrique Rojas Joaqui',
  'Hernan David Rodriguez Blanco',
  'Julian David Martinez Martinez',
  'Luis Miguel Pérez Coy',
]
</script>

<template>
  <section class="cover">
    <div class="arc arc-tr" aria-hidden="true"></div>
    <div class="arc arc-bl" aria-hidden="true"></div>

    <div class="cover-inner">
      <img src="/logo.png" alt="Universidad Central" class="logo" />

      <p class="kicker">Proyecto · Métodos Numéricos</p>
      <h1>Simulación numérica de un procesador cuántico superconductor de 2 qubits con decoherencia</h1>
      <p class="subtitle">El algoritmo de Grover ejecutado con pulsos de control y la ecuación maestra de Lindblad</p>

      <div class="cover-grid">
        <div>
          <h4>Integrantes</h4>
          <ul>
            <li v-for="n in integrantes" :key="n">{{ n }}</li>
          </ul>
        </div>
        <div>
          <h4>Curso</h4>
          <p>Métodos Numéricos</p>
          <h4>Profesor</h4>
          <p>Juan Carlos Martinez Escobar</p>
          <h4>Programa</h4>
          <p>Ingeniería de Sistemas y Computación</p>
        </div>
      </div>

      <a href="#simulacion" class="cta">Iniciar simulación ↓</a>
    </div>
  </section>
</template>
