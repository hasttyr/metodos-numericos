<script setup>
import * as THREE from 'three'
import { ref, onMounted, onBeforeUnmount, watch } from 'vue'
import { createScene, textSprite } from '../three-scene.js'

// traj: vectores de Bloch [x, y, z] en el tiempo; k: cuadro actual
const props = defineProps({ traj: Array, k: Number, color: String })
const el = ref(null)
let S, arrow, trail

// Bloch (x, y, z) con z hacia arriba → Three.js (x, z, −y) con y hacia arriba (misma orientación)
const toThree = ([x, y, z]) => new THREE.Vector3(x, z, -y)

function circle(rotate) {
  const pts = Array.from({ length: 97 }, (_, i) => { const a = (i / 96) * 2 * Math.PI; return new THREE.Vector3(Math.cos(a), 0, Math.sin(a)) })
  const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: 0x8a7656, transparent: true, opacity: 0.7 }))
  rotate(line)
  return line
}

function buildTrail() {
  if (trail) { S.scene.remove(trail); trail.geometry.dispose() }
  trail = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints(props.traj.map((v) => toThree(v).clampLength(0, 1.4))),
    new THREE.LineBasicMaterial({ color: props.color, transparent: true, opacity: 0.55 }),
  )
  S.scene.add(trail)
}

function update() {
  const v = toThree(props.traj[props.k] ?? [0, 0, 0])
  const len = v.length()
  arrow.visible = len > 1e-3 && isFinite(len)
  if (arrow.visible) {
    arrow.setDirection(v.clone().normalize())
    const L = Math.min(len, 1.4)                       // con Euler la norma explota: se recorta solo para dibujar
    arrow.setLength(L, Math.min(0.15, L * 0.4), Math.min(0.08, L * 0.25))
  }
  trail.geometry.setDrawRange(0, props.k + 1)
  S.render()
}

onMounted(() => {
  S = createScene(el.value, [2.9, 2.1, 2.9])
  S.scene.add(new THREE.Mesh(new THREE.SphereGeometry(1, 48, 32),
    new THREE.MeshPhongMaterial({ color: 0xd9a33a, transparent: true, opacity: 0.12, depthWrite: false })))
  S.scene.add(circle(() => {}), circle((l) => (l.rotation.x = Math.PI / 2)), circle((l) => (l.rotation.z = Math.PI / 2)))
  const axes = [[1, 0, 0], [0, 1, 0], [0, 0, 1]].map(([a, b, c]) =>
    new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(-a * 1.2, -b * 1.2, -c * 1.2), new THREE.Vector3(a * 1.2, b * 1.2, c * 1.2)]),
      new THREE.LineBasicMaterial({ color: 0xb9a47c })))
  S.scene.add(...axes)
  const labels = [['|0⟩', [0, 1.32, 0]], ['|1⟩', [0, -1.32, 0]], ['x', [1.35, 0, 0]], ['y', [0, 0, -1.35]]]
  for (const [txt, p] of labels) { const s = textSprite(txt); s.position.set(...p); S.scene.add(s) }
  arrow = new THREE.ArrowHelper(new THREE.Vector3(0, 1, 0), new THREE.Vector3(), 1, props.color)
  S.scene.add(arrow)
  buildTrail()
  update()
})

watch(() => props.traj, () => { buildTrail(); update() })
watch(() => props.k, update)
onBeforeUnmount(() => S.dispose())
</script>

<template><div ref="el" class="canvas3d"></div></template>
