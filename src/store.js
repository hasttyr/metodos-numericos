// Estado compartido entre secciones: parámetros del simulador y datos exportados por el notebook.
import { reactive, shallowRef } from 'vue'

export const params = reactive({
  logT1: Math.log10(2), logT2: Math.log10(1.5), ideal: false,
  deltaMHz: 0, areaErrPct: 0, t1q: 20,
  method: 'RK4', h: 0.25, logTol: -6,
})

export const datos = shallowRef(null)
export const datosError = shallowRef('')
let loading = null
export function loadDatos() {
  loading ??= fetch(`${import.meta.env.BASE_URL}datos.json`)
    .then((r) => { if (!r.ok) throw new Error(`datos.json: HTTP ${r.status}`); return r.json() })
    .then((d) => { datos.value = d; datosError.value = '' })
    .catch((e) => { loading = null; datosError.value = `No se pudieron cargar los resultados del notebook (${e.message}). Las secciones con simulación en vivo siguen funcionando.` })
  return loading
}

/** Selecciona un método en el simulador y lleva la vista hasta él */
export function tryMethod(method, h) {
  params.method = method
  if (h !== undefined) params.h = h
  document.getElementById('simulacion')?.scrollIntoView({ behavior: 'smooth' })
}

/** Parámetros físicos en ns a partir del panel */
export const physical = () => ({
  T1: params.ideal ? Infinity : 10 ** params.logT1 * 1000,
  T2: params.ideal ? Infinity : 10 ** params.logT2 * 1000,
  deltaMHz: params.deltaMHz, areaErr: params.areaErrPct / 100, t1q: params.t1q,
})
