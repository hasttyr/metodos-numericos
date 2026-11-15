<script setup>
import Plotly from 'plotly.js-dist-min'
import { ref, onMounted, watch, onBeforeUnmount } from 'vue'

const props = defineProps({ data: Array, layout: Object })
const el = ref(null)

const base = {
  paper_bgcolor: 'rgba(0,0,0,0)', plot_bgcolor: 'rgba(0,0,0,0)',
  font: { color: '#2b2118', size: 12, family: 'Fraunces, Georgia, serif' },
  margin: { l: 55, r: 15, t: 20, b: 42 },
  legend: { orientation: 'h', y: 1.12, bgcolor: 'rgba(0,0,0,0)' },
}
const draw = () => Plotly.react(el.value, props.data, { ...base, ...props.layout }, { displaylogo: false, responsive: true, displayModeBar: false })

onMounted(draw)
watch(() => [props.data, props.layout], draw)
onBeforeUnmount(() => Plotly.purge(el.value))
</script>

<template><div ref="el" class="plot"></div></template>
