<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue'

const LINKS = [
  ['proposito', '¿Para qué?'], ['simulacion', 'Simulador'], ['modelo', 'Modelo'], ['metodos', 'Métodos'], ['estabilidad', 'Estabilidad'],
  ['convergencia', 'Convergencia'], ['eficiencia', 'Eficiencia'], ['fisica', 'Física'], ['validacion', 'Validación'],
  ['ingenieria', 'Ingeniería'], ['preguntas', 'Discusión'], ['referencias', 'Referencias'],
]
const active = ref('proposito')
let obs
onMounted(() => {
  obs = new IntersectionObserver((entries) => {
    for (const e of entries) if (e.isIntersecting) active.value = e.target.id
  }, { rootMargin: '-45% 0px -50% 0px' })
  for (const [id] of LINKS) { const el = document.getElementById(id); if (el) obs.observe(el) }
})
onBeforeUnmount(() => obs?.disconnect())
</script>

<template>
  <nav class="nav" aria-label="Secciones">
    <a v-for="[id, label] in LINKS" :key="id" :href="`#${id}`" :class="{ on: active === id }" :aria-current="active === id ? 'true' : undefined">{{ label }}</a>
  </nav>
</template>
