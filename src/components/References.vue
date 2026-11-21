<script setup>
// Referencias de la propuesta y de los métodos numéricos.
const refs = [
  { autores: 'DiCarlo, L. et al.', anio: 2009, titulo: 'Demonstration of two-qubit algorithms with a superconducting quantum processor', fuente: 'Nature, 460, 240–244', doi: '10.1038/nature08121', arxiv: '0903.2030', uso: 'Experimento que se reproduce: el procesador de 2 qubits y Grover.' },
  { autores: 'Lindblad, G.', anio: 1976, titulo: 'On the generators of quantum dynamical semigroups', fuente: 'Communications in Mathematical Physics, 48, 119–130', doi: '10.1007/BF01608499', uso: 'Ecuación maestra que gobierna ρ(t).' },
  { autores: 'Gorini, V., Kossakowski, A., & Sudarshan, E. C. G.', anio: 1976, titulo: 'Completely positive dynamical semigroups of N-level systems', fuente: 'Journal of Mathematical Physics, 17, 821–825', doi: '10.1063/1.522979', uso: 'Forma GKSL de la ecuación de Lindblad.' },
  { autores: 'Manzano, D.', anio: 2020, titulo: 'A short introduction to the Lindblad master equation', fuente: 'AIP Advances, 10, 025106', doi: '10.1063/1.5115323', arxiv: '1906.04478', uso: 'Introducción a Lindblad y su forma vectorizada.' },
  { autores: 'Krantz, P. et al.', anio: 2019, titulo: "A quantum engineer's guide to superconducting qubits", fuente: 'Applied Physics Reviews, 6, 021318', doi: '10.1063/1.5089550', arxiv: '1904.06560', uso: 'Hamiltoniano, marco rotante, compuertas y valores de T₁ y T₂.' },
  { autores: 'Blais, A., Grimsmo, A. L., Girvin, S. M., & Wallraff, A.', anio: 2021, titulo: 'Circuit quantum electrodynamics', fuente: 'Reviews of Modern Physics, 93, 025005', doi: '10.1103/RevModPhys.93.025005', arxiv: '2005.12667', uso: 'Física de los qubits transmon y del control con pulsos.' },
  { autores: 'Grover, L. K.', anio: 1996, titulo: 'A fast quantum mechanical algorithm for database search', fuente: 'Proc. 28th ACM STOC, 212–219', doi: '10.1145/237814.237866', arxiv: 'quant-ph/9605043', uso: 'Algoritmo de búsqueda que ejecuta el procesador.' },
  { autores: 'Blanes, S., Casas, F., Oteo, J. A., & Ros, J.', anio: 2009, titulo: 'The Magnus expansion and some of its applications', fuente: 'Physics Reports, 470, 151–238', doi: '10.1016/j.physrep.2008.11.001', arxiv: '0810.5488', uso: 'Integrador de Magnus de 4.º orden.' },
  { autores: 'Johansson, J. R., Nation, P. D., & Nori, F.', anio: 2012, titulo: 'QuTiP: An open-source Python framework for the dynamics of open quantum systems', fuente: 'Computer Physics Communications, 183, 1760–1772', doi: '10.1016/j.cpc.2012.02.021', arxiv: '1110.0573', uso: 'Librería de referencia para validar el solver (E7).' },
  { autores: 'Nielsen, M. A., & Chuang, I. L.', anio: 2010, titulo: 'Quantum Computation and Quantum Information (10th Anniversary ed.)', fuente: 'Cambridge University Press', doi: '10.1017/CBO9780511976667', uso: 'Teoría de Grover (cap. 6) y de ruido cuántico (cap. 8).' },
  { autores: 'Iserles, A., & Nørsett, S. P.', anio: 1999, titulo: 'On the solution of linear differential equations in Lie groups', fuente: 'Phil. Trans. R. Soc. A, 357, 983–1019', doi: '10.1098/rsta.1999.0362', uso: 'Integradores de Magnus con cuadratura de Gauss.' },
  { autores: 'Dormand, J. R., & Prince, P. J.', anio: 1980, titulo: 'A family of embedded Runge-Kutta formulae', fuente: 'Journal of Computational and Applied Mathematics, 6, 19–26', doi: '10.1016/0771-050X(80)90013-3', uso: 'Par encajado 5(4) del método RK45 adaptativo.' },
  { autores: 'Moler, C., & Van Loan, C.', anio: 2003, titulo: 'Nineteen dubious ways to compute the exponential of a matrix, twenty-five years later', fuente: 'SIAM Review, 45, 3–49', doi: '10.1137/S00361445024180', uso: 'Padé con scaling and squaring para e^Ω.' },
  { autores: 'Hairer, E., Nørsett, S. P., & Wanner, G.', anio: 1993, titulo: 'Solving Ordinary Differential Equations I: Nonstiff Problems (2nd ed.)', fuente: 'Springer', doi: '10.1007/978-3-540-78862-1', uso: 'Orden, condiciones de Butcher, error global y control de paso.' },
  { autores: 'Hairer, E., & Wanner, G.', anio: 1996, titulo: 'Solving Ordinary Differential Equations II: Stiff and Differential-Algebraic Problems (2nd ed.)', fuente: 'Springer', doi: '10.1007/978-3-642-05221-7', uso: 'A-estabilidad, L-estabilidad y rigidez.' },
  { autores: 'Butcher, J. C.', anio: 2016, titulo: 'Numerical Methods for Ordinary Differential Equations (3rd ed.)', fuente: 'Wiley', doi: '10.1002/9781119121534', uso: 'Tablas de Butcher y árboles de las condiciones de orden.' },
  { autores: 'Golub, G. H., & Welsch, J. H.', anio: 1969, titulo: 'Calculation of Gauss quadrature rules', fuente: 'Mathematics of Computation, 23, 221–230', doi: '10.1090/S0025-5718-69-99647-1', uso: 'Nodos de Gauss-Legendre (los mismos de Magnus).' },
  { autores: 'Higham, N. J.', anio: 2002, titulo: 'Accuracy and Stability of Numerical Algorithms (2nd ed.)', fuente: 'SIAM', doi: '10.1137/1.9780898718027', uso: 'Redondeo, pivoteo parcial y estabilidad de la LU.' },
]
</script>

<template>
  <section class="refs" id="referencias">
    <div class="card">
      <h2>Referencias</h2>
      <ol>
        <li v-for="r in refs" :key="r.doi">
          <p class="cite">{{ r.autores }} ({{ r.anio }}). <em>{{ r.titulo }}</em>. {{ r.fuente }}.</p>
          <p class="uso">{{ r.uso }}</p>
          <p class="links">
            <a :href="`https://doi.org/${r.doi}`" target="_blank" rel="noopener">DOI {{ r.doi }}</a>
            <a v-if="r.arxiv" :href="`https://arxiv.org/abs/${r.arxiv}`" target="_blank" rel="noopener">arXiv {{ r.arxiv }}</a>
          </p>
        </li>
      </ol>
    </div>
  </section>
</template>
