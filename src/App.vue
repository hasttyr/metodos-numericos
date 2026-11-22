<script setup>
import { onMounted } from 'vue'
import { loadDatos, datosError } from './store.js'
import Cover from './components/Cover.vue'
import NavBar from './components/NavBar.vue'
import References from './components/References.vue'
import PurposeSection from './sections/PurposeSection.vue'
import SimulatorSection from './sections/SimulatorSection.vue'
import ModelSection from './sections/ModelSection.vue'
import MethodsSection from './sections/MethodsSection.vue'
import StabilitySection from './sections/StabilitySection.vue'
import ConvergenceSection from './sections/ConvergenceSection.vue'
import EfficiencySection from './sections/EfficiencySection.vue'
import PhysicsSection from './sections/PhysicsSection.vue'
import ValidationSection from './sections/ValidationSection.vue'
import EngineeringSection from './sections/EngineeringSection.vue'
import FaqSection from './sections/FaqSection.vue'

onMounted(loadDatos)
</script>

<template>
  <Cover />
  <NavBar />
  <p v-if="datosError" class="err banner" role="alert">{{ datosError }} <button class="cta-small" @click="loadDatos">Reintentar</button></p>
  <PurposeSection />
  <SimulatorSection />
  <ModelSection />
  <MethodsSection />
  <StabilitySection />
  <ConvergenceSection />
  <EfficiencySection />
  <PhysicsSection />
  <ValidationSection />
  <EngineeringSection />
  <FaqSection />
  <References />
  <footer>Métodos Numéricos · Ingeniería de Sistemas y Computación · Basado en DiCarlo et al., Nature 460, 240 (2009) · Todo el cálculo de esta página corre en su navegador</footer>
</template>
