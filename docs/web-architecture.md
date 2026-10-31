# Web architecture and solver notes

## Technology and boundaries

The prototype is a static React 19 + TypeScript application built by Vite. It does not need a server-side runtime or database. All package versions are recorded in `web/package-lock.json`.

- **`model.ts`:** Zod schema, model validation, examples, support semantics, and bounded immutable undo/redo history.
- **`solver.ts`:** pure numerical API `solveFrame(project): AnalysisResult`, independent of React/browser APIs.
- **`App.tsx`:** project lifecycle, local storage, file import/export, tool state and explicit analysis actions.
- **`FrameCanvas.tsx`:** SVG geometry and result diagrams; model coordinates are not inferred from rendered pixels except when placing a node. Coordinate conversion uses the SVG inverse screen transform.
- **`Explorer.tsx`:** selection and keyboard-accessible creation alternatives.
- **`Inspector.tsx`:** project, node, member and section editing.
- **`ResultsPanel.tsx`:** numerical tables, result exports, and a complete print-only nodal table.

Analysis is explicit rather than running on every keystroke. Every valid model edit, undo/redo or replacement clears results immediately, so stale results cannot masquerade as a recalculation. Results are never persisted into project JSON or browser storage.

## Consistent units

The solver converts section values at the element boundary:

```text
A [m²]      = area_mm2 × 10⁻⁶
I [m⁴]      = inertia_mm4 × 10⁻¹²
W [m³]      = modulus_mm3 × 10⁻⁹
E [kN/m²]   = elasticModulus_MPa × 10³
weight [kN/m] = −A × density_kg_m3 × 9.81 / 1000
```

Translations are solved in m, rotations in radians, forces in kN and moments in kN·m. The UI converts translations to mm, rotations to degrees and normal stress to MPa.

## Element formulation

Each prismatic member uses local displacement ordering:

```text
[u_start, v_start, theta_start, u_end, v_end, theta_end]
```

The standard linear-elastic axial/Euler–Bernoulli bending matrix uses `EA/L`, `12EI/L³`, `6EI/L²`, `4EI/L` and `2EI/L`. For member angle `alpha`, `T` maps global displacements to local axes; assembly uses `Tᵀ k T` and `Tᵀ p`.

### Member-end hinges

Releasing an end is not implemented by simply zeroing a matrix row. For released rotations `r` and retained coordinates `a`, static condensation uses:

```text
k_condensed = k_aa − k_ar k_rr⁻¹ k_ra
p_condensed = p_a  − k_ar k_rr⁻¹ p_r
```

The released rows/columns are then removed from the element's nodal contribution. After solving, the independent member-end rotations are recovered from:

```text
d_r = k_rr⁻¹ (p_r − k_ra d_a)
```

A node rotation with no attached rigid member ends is ignored only if it has no applied moment. An applied moment at a completely released, unrestrained rotation is an error. Translational mechanisms are never silently restrained.

### Applied loads

Nodal loads use global X/Y components and counterclockwise-positive moment. Member transverse loading varies linearly from `q0` to `q1`, positive along local +Y. Its consistent local nodal load vector is:

```text
[0,
 L (7q0 + 3q1) / 20,
 L² (3q0 + 2q1) / 60,
 0,
 L (3q0 + 7q1) / 20,
−L² (2q0 + 3q1) / 60]
```

Self-weight is a uniform global downward load. It is transformed to both local axial and transverse components before consistent load construction. Axial gravity contributes `px L/2` at each end. Self-weight is included numerically when enabled but is not drawn as separate arrows; the canvas legend says so.

### Boundary conditions and linear solve

Supports prescribe zero translations/rotation as defined in the project schema. Nonzero prescribed displacements are not implemented yet.

After assembly, the free-DOF system is diagonally scaled:

```text
D_ii = 1 / sqrt(K_ii)
(D K_ff D) z = D f_f
u_f = D z
```

The code uses partial-pivot Gaussian elimination with a relative pivot tolerance of `1e-11`. It fails closed on singular/very ill-conditioned systems; it does not claim a calculated condition number or implement a full structural mechanism diagnostic.

Reactions are recovered as **`K u − f`**, using the total applied-load vector, including forces directly on supports. Only restrained components are reported as reactions.

The dense solve is O(n³) time and O(n²) memory. The prototype caps projects at 150 nodes and 300 members and runs on an explicit button click on the main thread. Larger models should move the solver to a worker and use a sparse method with improved conditioning diagnostics. Input size limits are not a guarantee that every allowed extreme-valued model is well-conditioned; non-finite computations are rejected.

## Force, displacement and stress recovery

Member end actions are `f_end = k_full d_local − p_full` after recovering releases. For station coordinate `x`, transverse load gradient `s = (q1 − q0)/L`, and constant local axial load `px`:

```text
N(x) = −f0 − px x
V(x) =  f1 + q0 x + s x²/2
M(x) = −f2 + f1 x + q0 x²/2 + s x³/6

u(x) = u0 + (−f0 x − px x²/2) / EA
v(x) = v0 + theta0 x
       + (−f2 x²/2 + f1 x³/6 + q0 x⁴/24 + s x⁵/120) / EI
```

The displacement expression includes the distributed-load particular solution. Using only cubic interpolation of nodal displacements would incorrectly show zero deflection for a single fixed-fixed loaded beam and zero interior deformation for some supported beams.

`N > 0` denotes tension. In these conventions `dM/dx = V` and `dV/dx = q`. Positive force-diagram ordinates are plotted on the member's local −Y side. The member direction is always start → end, even when the drawing runs right-to-left or vertically.

Diagrams sample 81 evenly spaced stations, including both ends. Member peak displacement, force and stress values are approximate sampled maxima. They are not exact extrema, and local axial/transverse displacements should not be confused with deflection relative to a displaced chord.

The reported stress bound is:

```text
sigma_bound [MPa] = (|N|/A + |M|/W) / 1000
```

This excludes shear stress, instability, material nonlinearity, yield/capacity comparisons and code-specific interaction equations. The web UI never labels it a safety pass/fail.

A warning is shown if the sampled peak displacement exceeds 2% of the shortest member length. This is a simple indication that the small-displacement assumption may be inappropriate, **not** a design criterion or a substitute for stability analysis.

## Persistence and fault handling

- Browser autosave key: `empire-2d.project.v1`.
- Import is parsed and validated in full before replacing the open project; replacement asks for confirmation.
- Invalid imports leave the current model unchanged.
- If a stored project cannot be parsed, the app opens the example and reports the recovery error. It does not overwrite that stored copy until the user deliberately edits/loads another project.
- If browser storage is unavailable/full, the UI indicates the failure and JSON download still works.
- JSON files are capped at 2 MB; arrays and string lengths are bounded by schema.
- Referential integrity, unique IDs and positive/finite section properties are checked at import, edit, and analysis boundaries.
- Undo retains up to 50 edit snapshots; replacement starts a new history.
- Printable/CSV output is explicitly labelled experimental.

The application assets, including fonts, are local once installed/built. It does not have a service worker or claim offline installation support.

## Verification

Unit tests cover analytical cases for cantilever force/moment/axial loading, simply supported and fixed-fixed beams, triangular loads, single/double end releases, nodal loads on supports, gravity on a vertical member, inclined transformations, split-member point loading, direction reversal, global equilibrium and element compatibility. Negative tests exercise singular systems and malformed models.

Model tests cover schema rejection, full JSON round trips, duplicate/reference errors, file-size bounds and history semantics. Playwright tests exercise creation/editing, analysis, result invalidation, undo/redo, JSON download/import, reload recovery, instability handling, SVG tools, mobile width and accessible help-dialog behaviour. Browser tests currently target Chrome.

Automated axe accessibility scans cover the initial workspace, calculated results and help dialog, including contrast and keyboard access to the scrollable result table. These checks complement, rather than replace, manual desktop/mobile inspection.

### Dependency audit

The installed production dependency tree passes `npm audit --omit=dev` with no reported vulnerabilities at implementation time. The full audit still reports moderate development-tooling findings through `minimatch` in ESLint/TypeScript ESLint dependencies; npm currently offers no compatible fix for those chains. They are not part of the static browser bundle. The dev server is bound to loopback; do not expose development/test tooling as a public service. Recheck the lockfile and upstream fixes before a production rollout.

These are prototype-level verification checks. Independent implementation review, a legacy comparison corpus, and engineering-domain validation remain outstanding.
