# Simulador cuántico · Grover (app web)

App estática (Vite + Vue 3 + Three.js + Plotly). No tiene backend ni base de datos.

- `src/sim/quantum.js`: simulador en JS (Lindblad + Schrödinger, Euler/Heun/RK4). Corre en vivo en el navegador.
- `public/datos.json`: resultados del notebook (`grover_trayectoria.json`), usados para E2, E4, E8 y la validación.
- `src/components/`: esferas de Bloch y cityscape (Three.js), gráficas (Plotly).

## Correr en local

```bash
npm install
npm run dev      # http://localhost:5173
npm test         # verifica que el simulador JS coincide con Python
```

## Desplegar en Vercel

1. Subir el repositorio a GitHub.
2. En vercel.com → *Add New Project* → importar el repositorio.
3. En **Root Directory** elegir `app`. Vercel detecta Vite solo (build `npm run build`, salida `dist`).
4. *Deploy*.

Si se vuelve a correr el notebook, copiar el nuevo `grover_trayectoria.json` a `public/datos.json`.
