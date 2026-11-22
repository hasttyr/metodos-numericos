# Simulador cuántico · Grover (app web)

App estática (Vite + Vue 3 + Three.js + Plotly.js + KaTeX), sin backend. Explica y ejecuta en vivo los métodos numéricos del proyecto.

## Qué hay en la página

| Sección | Contenido |
|---|---|
| 1 · Simulador | Grover con ruido resuelto en vivo con **los 6 métodos** (Euler, Heun, RK4, RK45, Crank-Nicolson, Magnus 4); esferas de Bloch, cityscape de ρ, osciloscopio, diagnósticos físicos, pasos aceptados/rechazados de RK45 |
| 2 · Modelo | De la matriz de densidad a dy/dt = A(t)y (40 EDOs reales); la matriz A(t) en vivo; Grover como pulsos |
| 3 · Métodos | Cada método: idea, paso, error, tabla de Butcher, R(z), estabilidad, costo, ventajas y desventajas |
| 4 · Estabilidad | Regiones \|R(z)\| ≤ 1 con el espectro real de A(t), laboratorio de la ecuación de prueba, límites β/α, rigidez |
| 5 · Convergencia | Experimento de convergencia en vivo (Web Worker) + error local, malla desalineada, Magnus sin conmutador, Richardson |
| 6 · Eficiencia | Diagrama de Pareto, costo mínimo para error 10⁻⁶, redondeo contra truncamiento |
| 7 · Física | Invariantes (traza, hermiticidad) contra positividad; comparación en vivo de los 6 métodos |
| 8 · Validación | Soluciones analíticas, QuTiP, laboratorio contra marco rotante, JS contra Python |
| 9 · Ingeniería | Mapa P(T₁, T₂), bisección contra secante, modelo de mínimos cuadrados, sensibilidad a la calibración |
| 10 · Discusión | Preguntas clave sobre los métodos, respondidas con los resultados |

## Código

- `src/sim/linalg.js`: álgebra lineal compleja propia (LU con pivoteo parcial, exponencial de Padé [6/6] con scaling and squaring).
- `src/sim/quantum.js`: modelo (superoperador de Lindblad, pulsos, Grover) y los 6 integradores. Misma vectorización (por columnas) que el notebook.
- `src/sim/worker.js`: experimentos caros en un Web Worker.
- `src/sim/check.mjs`: pruebas automáticas.
- `public/datos.json`: resultados del notebook (`grover_trayectoria.json`): experimentos E1–E10.

## Correr en local

```bash
npm install
npm run dev      # http://localhost:5173
npm test         # álgebra lineal, soluciones analíticas, orden de convergencia, invariantes, RK45 y JS vs Python
npm run build
```

## Desplegar en Vercel

1. Subir el repositorio a GitHub.
2. En vercel.com → *Add New Project* → importar el repositorio.
3. En **Root Directory** elegir `app`. Vercel detecta Vite solo (build `npm run build`, salida `dist`).
4. *Deploy*.

Si se vuelve a correr el notebook, copiar el nuevo `grover_trayectoria.json` a `public/datos.json` y correr `npm test`.
