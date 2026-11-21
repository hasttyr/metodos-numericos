import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'

// Escena Three.js con cámara orbital. Renderiza bajo demanda (solo cuando algo cambia).
export function createScene(container, cameraPos = [2.4, 1.7, 2.4]) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  container.appendChild(renderer.domElement)

  const scene = new THREE.Scene()
  const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 100)
  camera.position.set(...cameraPos)
  const controls = new OrbitControls(camera, renderer.domElement)
  controls.enableDamping = false

  scene.add(new THREE.AmbientLight(0xffffff, 0.8))
  const light = new THREE.DirectionalLight(0xffffff, 1.6)
  light.position.set(3, 5, 2)
  scene.add(light)

  const render = () => renderer.render(scene, camera)
  controls.addEventListener('change', render)
  const ro = new ResizeObserver(() => {
    const w = container.clientWidth, h = container.clientHeight
    if (!w || !h) return
    renderer.setSize(w, h)
    camera.aspect = w / h
    camera.updateProjectionMatrix()
    render()
  })
  ro.observe(container)

  return {
    scene, render,
    dispose() {
      ro.disconnect(); controls.dispose()
      scene.traverse((o) => { o.geometry?.dispose(); o.material?.map?.dispose(); o.material?.dispose() })
      renderer.dispose(); renderer.domElement.remove()
    },
  }
}

export function textSprite(text, color = '#2b2118', size = 0.2) {
  const canvas = document.createElement('canvas')
  canvas.width = 256; canvas.height = 128
  const ctx = canvas.getContext('2d')
  ctx.font = '600 72px Fraunces, Georgia, serif'
  ctx.fillStyle = color
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
  ctx.fillText(text, 128, 64)
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(canvas), depthTest: false, transparent: true }))
  sprite.scale.set(size * 2, size, 1)
  return sprite
}
