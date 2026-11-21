<script setup>
// Fórmula LaTeX renderizada con KaTeX. `block` la centra en su propia línea.
import { computed } from 'vue'
import katex from 'katex'
import 'katex/dist/katex.min.css'

const props = defineProps({ e: { type: String, required: true }, block: Boolean })
const html = computed(() => katex.renderToString(props.e, { displayMode: props.block, throwOnError: false, strict: false }))
</script>

<template>
  <div v-if="block" class="tex-block" v-html="html"></div>
  <span v-else class="tex" v-html="html"></span>
</template>
