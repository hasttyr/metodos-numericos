<script setup>
import * as THREE from 'three'
import { ref, onMounted, onBeforeUnmount, watch } from 'vue'
import { createScene, textSprite } from '../three-scene.js'

// rho: matriz 4×4 compleja (Float64Array re/im intercalados); part: 're' | 'im'
const props = defineProps({ rho: Float64Array, part: String })
const el = ref(null)
let S
const bars = []
const POS = new THREE.Color('#5b6b1f'), NEG = new THREE.Color('#b5321f')
const BASIS = ['00', '01', '10', '11']

function update() {
  bars.forEach((bar, n) => {
    const raw = props.rho[2 * n + (props.part === 'im' ? 1 : 0)]
    const v = Math.max(-1.2, Math.min(1.2, isFinite(raw) ? raw : 0))   // recorte solo visual
    bar.scale.y = Math.max(Math.abs(v), 1e-3)
    bar.position.y = v / 2
    bar.material.color.copy(v >= 0 ? POS : NEG)
  })
  S.render()
}

onMounted(() => {
  S = createScene(el.value, [4.2, 3.4, 4.2])
  const grid = new THREE.GridHelper(4, 4, 0x8a7656, 0xb9a47c)
  S.scene.add(grid)
  for (let i = 0; i < 4; i++)
    for (let j = 0; j < 4; j++) {
      const bar = new THREE.Mesh(new THREE.BoxGeometry(0.62, 1, 0.62), new THREE.MeshPhongMaterial({ color: POS, transparent: true, opacity: 0.9 }))
      bar.position.set(j - 1.5, 0, i - 1.5)
      S.scene.add(bar)
      bars.push(bar)
    }
  BASIS.forEach((b, i) => {
    const r = textSprite(b, '#6e5f4a', 0.4); r.position.set(-2.4, 0, i - 1.5); S.scene.add(r)
    const c = textSprite(b, '#6e5f4a', 0.4); c.position.set(i - 1.5, 0, -2.4); S.scene.add(c)
  })
  update()
})

watch(() => [props.rho, props.part], update)
onBeforeUnmount(() => S.dispose())
</script>

<template><div ref="el" class="canvas3d"></div></template>
