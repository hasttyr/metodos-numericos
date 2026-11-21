// Constantes visuales y utilidades de formato compartidas.
export const METHOD_COLORS = {
  Euler: '#b5321f', Heun: '#e07a2e', RK4: '#5b6b1f', RK45: '#c28a1c', 'RK45 (DP5)': '#c28a1c',
  'Crank-Nicolson': '#2f6f6a', Magnus4: '#7a4f8a', 'Magnus2 (sin conmutador)': '#b08cbf',
}
export const AX = { gridcolor: '#e2d3b2', zerolinecolor: '#b9a47c', linecolor: '#2b2118' }
export const LOGAX = { ...AX, type: 'log', exponentformat: 'power' }
export const STATES = ['|00⟩', '|01⟩', '|10⟩', '|11⟩']

/** número legible: fijo para valores normales, exponencial para muy grandes o muy pequeños */
export function fmt(v, d = 4) {
  if (v === null || v === undefined || Number.isNaN(v)) return '—'
  if (!isFinite(v)) return v > 0 ? '∞' : '−∞'
  if (v === 0) return '0'
  return Math.abs(v) >= 1e4 || Math.abs(v) < 1e-3 ? v.toExponential(2) : v.toFixed(d)
}
export const fexp = (v, d = 1) => (v === null || v === undefined ? '—' : !isFinite(v) ? '∞' : v === 0 ? '0' : v.toExponential(d))

/** agrupa por la clave del método (Object.groupBy no existe en Safari < 17.4) */
export const groupBy = (rows, key) => rows.reduce((acc, r) => ((acc[key(r)] ??= []).push(r), acc), {})

/** pendiente de mínimos cuadrados de log e contra log h */
export function slope(hs, es) {
  const pts = hs.map((h, i) => [Math.log(h), Math.log(es[i])]).filter(([, y]) => isFinite(y))
  const n = pts.length, mx = pts.reduce((s, p) => s + p[0], 0) / n, my = pts.reduce((s, p) => s + p[1], 0) / n
  let num = 0, den = 0
  for (const [x, y] of pts) { num += (x - mx) * (y - my); den += (x - mx) ** 2 }
  return num / den
}

/** sombreado de compuertas para gráficas Plotly */
export const gateShapes = (gates, opacity = 0.06) => gates.map((g) => ({
  type: 'rect', xref: 'x', yref: 'paper', x0: g.t0, x1: g.t1, y0: 0, y1: 1,
  fillcolor: g.nombre === 'CZ' ? '#d99a2b' : '#2f6f6a', opacity, line: { width: 0 },
}))
