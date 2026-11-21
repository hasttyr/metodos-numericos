// Álgebra lineal compleja mínima, escrita a mano (igual que en el notebook).
// Una matriz n×n es un Float64Array de 2n² números: parte real e imaginaria intercaladas, por filas.
//   A[2(i·n + j)] = Re a_ij,  A[2(i·n + j) + 1] = Im a_ij
// Un vector complejo de n componentes es un Float64Array de 2n números.

export const zeros = (n) => new Float64Array(2 * n * n)

export function eye(n) {
  const I = zeros(n)
  for (let i = 0; i < n; i++) I[2 * (i * n + i)] = 1
  return I
}

/** y = A x */
export function matvec(A, x, n, out = new Float64Array(2 * n)) {
  for (let i = 0; i < n; i++) {
    let re = 0, im = 0
    const row = 2 * i * n
    for (let k = 0; k < n; k++) {
      const ar = A[row + 2 * k], ai = A[row + 2 * k + 1]
      if (ar === 0 && ai === 0) continue
      const xr = x[2 * k], xi = x[2 * k + 1]
      re += ar * xr - ai * xi
      im += ar * xi + ai * xr
    }
    out[2 * i] = re
    out[2 * i + 1] = im
  }
  return out
}

/** C = A B */
export function matmul(A, B, n) {
  const C = zeros(n)
  for (let i = 0; i < n; i++)
    for (let k = 0; k < n; k++) {
      const ar = A[2 * (i * n + k)], ai = A[2 * (i * n + k) + 1]
      if (ar === 0 && ai === 0) continue
      for (let j = 0; j < n; j++) {
        const br = B[2 * (k * n + j)], bi = B[2 * (k * n + j) + 1]
        C[2 * (i * n + j)] += ar * br - ai * bi
        C[2 * (i * n + j) + 1] += ar * bi + ai * br
      }
    }
  return C
}

/** out += (sr + i·si) · A   (in place) */
export function addScaled(out, A, sr, si = 0) {
  if (si === 0) { for (let i = 0; i < out.length; i++) out[i] += sr * A[i]; return out }
  for (let i = 0; i < out.length; i += 2) {
    out[i] += sr * A[i] - si * A[i + 1]
    out[i + 1] += sr * A[i + 1] + si * A[i]
  }
  return out
}

export const scaled = (A, sr, si = 0) => addScaled(new Float64Array(A.length), A, sr, si)

export function dagger(A, n) {
  const C = zeros(n)
  for (let i = 0; i < n; i++)
    for (let j = 0; j < n; j++) {
      C[2 * (j * n + i)] = A[2 * (i * n + j)]
      C[2 * (j * n + i) + 1] = -A[2 * (i * n + j) + 1]
    }
  return C
}

export function transpose(A, n) {
  const C = zeros(n)
  for (let i = 0; i < n; i++)
    for (let j = 0; j < n; j++) {
      C[2 * (j * n + i)] = A[2 * (i * n + j)]
      C[2 * (j * n + i) + 1] = A[2 * (i * n + j) + 1]
    }
  return C
}

export function conj(A) {
  const C = A.slice()
  for (let i = 1; i < C.length; i += 2) C[i] = -C[i]
  return C
}

/** Producto de Kronecker de A (p×p) y B (q×q) → (pq)×(pq) */
export function kron(A, p, B, q) {
  const n = p * q, C = zeros(n)
  for (let i = 0; i < p; i++) for (let j = 0; j < p; j++) {
    const ar = A[2 * (i * p + j)], ai = A[2 * (i * p + j) + 1]
    if (ar === 0 && ai === 0) continue
    for (let k = 0; k < q; k++) for (let l = 0; l < q; l++) {
      const br = B[2 * (k * q + l)], bi = B[2 * (k * q + l) + 1]
      const idx = 2 * ((i * q + k) * n + (j * q + l))
      C[idx] = ar * br - ai * bi
      C[idx + 1] = ar * bi + ai * br
    }
  }
  return C
}

/** Norma 1 (máxima suma de columna de |a_ij|) */
export function norm1(A, n) {
  let best = 0
  for (let j = 0; j < n; j++) {
    let s = 0
    for (let i = 0; i < n; i++) s += Math.hypot(A[2 * (i * n + j)], A[2 * (i * n + j) + 1])
    if (s > best) best = s
  }
  return best
}

/**
 * Factorización PM = LU con pivoteo parcial (Doolittle). Devuelve LU compacto (L con diagonal 1
 * implícita) y la permutación de filas. Costo ≈ (2/3)n³ operaciones complejas.
 */
export function luFactor(M, n) {
  const LU = M.slice(), piv = Int32Array.from({ length: n }, (_, i) => i)
  for (let k = 0; k < n - 1; k++) {
    let p = k, best = -1
    for (let i = k; i < n; i++) {                       // pivote: mayor módulo de la columna k
      const m = Math.hypot(LU[2 * (i * n + k)], LU[2 * (i * n + k) + 1])
      if (m > best) { best = m; p = i }
    }
    if (best === 0) throw new Error('matriz singular')
    if (p !== k) {
      for (let j = 0; j < 2 * n; j++) { const t = LU[2 * k * n + j]; LU[2 * k * n + j] = LU[2 * p * n + j]; LU[2 * p * n + j] = t }
      const t = piv[k]; piv[k] = piv[p]; piv[p] = t
    }
    const dr = LU[2 * (k * n + k)], di = LU[2 * (k * n + k) + 1], d2 = dr * dr + di * di
    for (let i = k + 1; i < n; i++) {
      const ar = LU[2 * (i * n + k)], ai = LU[2 * (i * n + k) + 1]
      const lr = (ar * dr + ai * di) / d2, li = (ai * dr - ar * di) / d2   // l_ik = a_ik / a_kk
      LU[2 * (i * n + k)] = lr; LU[2 * (i * n + k) + 1] = li
      if (lr === 0 && li === 0) continue
      for (let j = k + 1; j < n; j++) {                  // actualización de rango 1
        const ur = LU[2 * (k * n + j)], ui = LU[2 * (k * n + j) + 1]
        LU[2 * (i * n + j)] -= lr * ur - li * ui
        LU[2 * (i * n + j) + 1] -= lr * ui + li * ur
      }
    }
  }
  if (Math.hypot(LU[2 * (n * n - 1)], LU[2 * (n * n - 1) + 1]) === 0) throw new Error('matriz singular')
  return { LU, piv }
}

/** Resuelve M X = B con la factorización. B es n×m (m columnas), por filas. */
export function luSolve({ LU, piv }, B, n, m = 1) {
  const X = new Float64Array(2 * n * m)
  for (let i = 0; i < n; i++) for (let c = 0; c < 2 * m; c++) X[2 * i * m + c] = B[2 * piv[i] * m + c]
  for (let i = 1; i < n; i++)                             // L z = P b (hacia adelante)
    for (let k = 0; k < i; k++) {
      const lr = LU[2 * (i * n + k)], li = LU[2 * (i * n + k) + 1]
      if (lr === 0 && li === 0) continue
      for (let c = 0; c < m; c++) {
        const zr = X[2 * (k * m + c)], zi = X[2 * (k * m + c) + 1]
        X[2 * (i * m + c)] -= lr * zr - li * zi
        X[2 * (i * m + c) + 1] -= lr * zi + li * zr
      }
    }
  for (let i = n - 1; i >= 0; i--) {                      // U x = z (hacia atrás)
    for (let k = i + 1; k < n; k++) {
      const ur = LU[2 * (i * n + k)], ui = LU[2 * (i * n + k) + 1]
      if (ur === 0 && ui === 0) continue
      for (let c = 0; c < m; c++) {
        const xr = X[2 * (k * m + c)], xi = X[2 * (k * m + c) + 1]
        X[2 * (i * m + c)] -= ur * xr - ui * xi
        X[2 * (i * m + c) + 1] -= ur * xi + ui * xr
      }
    }
    const dr = LU[2 * (i * n + i)], di = LU[2 * (i * n + i) + 1], d2 = dr * dr + di * di
    for (let c = 0; c < m; c++) {
      const xr = X[2 * (i * m + c)], xi = X[2 * (i * m + c) + 1]
      X[2 * (i * m + c)] = (xr * dr + xi * di) / d2
      X[2 * (i * m + c) + 1] = (xi * dr - xr * di) / d2
    }
  }
  return X
}

export const solve = (M, B, n, m = 1) => luSolve(luFactor(M, n), B, n, m)

/**
 * e^A con el aproximante de Padé [q/q] y scaling and squaring:
 *   X = A / 2^s con ‖X‖₁ ≤ 1/2,  e^X ≈ D(X)⁻¹ N(X),  e^A = (e^X)^(2^s).
 * c_k = c_{k−1} (q − k + 1) / (k (2q − k + 1)).  Con q = 6 el error relativo es ~1e−17.
 */
export function expm(A, n, q = 6) {
  const nrm = norm1(A, n)
  const s = nrm <= 0.5 ? 0 : Math.ceil(Math.log2(nrm / 0.5))
  const X = scaled(A, 2 ** -s)
  const N = eye(n), D = eye(n)
  let Xk = eye(n), c = 1
  for (let k = 1; k <= q; k++) {
    c *= (q - k + 1) / (k * (2 * q - k + 1))
    Xk = matmul(Xk, X, n)
    addScaled(N, Xk, c)
    addScaled(D, Xk, k % 2 ? -c : c)
  }
  let E = solve(D, N, n, n)
  for (let i = 0; i < s; i++) E = matmul(E, E, n)
  return E
}
