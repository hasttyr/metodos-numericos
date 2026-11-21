// Web Worker: experimentos caros (convergencia y eficiencia) sin congelar la página.
import { buildProcessor, integrate, integrateRK45, FIXED, PSI00 } from './quantum.js'

const maxAbs = (a, b) => a.reduce((m, v, i) => Math.max(m, Math.abs(v - b[i])), 0)

self.onmessage = ({ data }) => {
  const { type, phys, hs, methods = FIXED, tols = [] } = data
  const sys = buildProcessor(phys)
  const y0 = sys.y0(PSI00)
  const total = methods.length * hs.length + tols.length + 1
  let done = 0
  const progress = (label) => self.postMessage({ type: 'progress', value: ++done / total, label })

  // referencia: Magnus 4 con h = 1/32 ns (error ≈ 1e−12 según el notebook)
  const t0 = performance.now()
  const yRef = integrate('Magnus4', sys, y0, 0, sys.tf, 1 / 32, 1e9).ys.at(-1)
  progress(`referencia (Magnus 4, h = 1/32 ns) en ${(performance.now() - t0).toFixed(0)} ms`)

  const rows = []
  for (const m of methods)
    for (const h of hs) {
      sys.nfev = 0
      const c = performance.now()
      const y = integrate(m, sys, y0, 0, sys.tf, h, 1e9).ys.at(-1)
      rows.push({ metodo: m, param: h, nfev: sys.nfev, cpu: performance.now() - c, error: maxAbs(y, yRef) })
      progress(`${m}, h = ${h} ns`)
    }
  for (const tol of tols) {
    sys.nfev = 0
    const c = performance.now()
    const r = integrateRK45(sys, y0, 0, sys.tf, { rtol: tol, atol: tol * 1e-2 })
    rows.push({ metodo: 'RK45', param: tol, nfev: sys.nfev, cpu: performance.now() - c, error: maxAbs(r.ys.at(-1), yRef), rechazos: r.rejected })
    progress(`RK45, tol = ${tol}`)
  }
  self.postMessage({ type: 'done', kind: type, rows })
}
