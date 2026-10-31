# Three-bay, four-storey building frame

An illustrative, unbraced 2D steel moment frame for exercising the web editor and solver. **Not a structural design, a code-compliant load case, or an engineering-validated building.** No new design-code or stability checks are implied by this example.

## Open it

At http://127.0.0.1:5173 choose **Examples → Three-bay, four-storey frame**, confirm replacement of the open model, then choose **Analyse**. Download a copy of any existing work before replacing it.

A portable JSON copy is available at [`web/public/examples/three-bay-four-storey.empire.json`](../web/public/examples/three-bay-four-storey.empire.json). The running app also serves it at `/examples/three-bay-four-storey.empire.json`; download it and use **Open** to import it.

## Geometry and connectivity

- Three equal **6 m bays**; total width **18 m**.
- Four equal **3.5 m storeys**; total height **14 m**.
- Four column lines at X = 0, 6, 12 and 18 m.
- Five node levels at Y = 0, 3.5, 7, 10.5 and 14 m.
- **20 nodes**, numbered left-to-right at each level, bottom-to-top.
- Four fixed base nodes: N1–N4. The remaining 16 nodes have three free DOFs each: **48 free DOFs**.
- **16 column members**, M1–M16, directed upwards, storey-by-storey.
- **12 beam members**, M17–M28, directed left-to-right, floor-by-floor.
- All joints are rigid; no member-end releases and no diagonal bracing.

```text
Y [m]
14.0   N17───M26───N18───M27───N19───M28───N20  → 20 kN at N17
        │          │          │          │
10.5   N13───M23───N14───M24───N15───M25───N16  → 16 kN at N13
        │          │          │          │
 7.0    N9───M20───N10───M21───N11───M22───N12  → 12 kN at N9
        │          │          │          │
 3.5    N5───M17────N6───M18────N7───M19────N8   →  8 kN at N5
        │          │          │          │
 0.0    N1         N2         N3         N4      fixed bases
        0          6         12         18      X [m]
```

## Illustrative loads

| Level | Downward distributed load on every beam | Global +X nodal load at left column |
| --- | --- | --- |
| 1, Y = 3.5 m | 10 kN/m | 8 kN at N5 |
| 2, Y = 7 m | 10 kN/m | 12 kN at N9 |
| 3, Y = 10.5 m | 10 kN/m | 16 kN at N13 |
| Roof, Y = 14 m | 7.5 kN/m | 20 kN at N17 |

Self-weight is enabled in addition to those loads, using global downward gravity at 9.81 m/s². Floor/roof line loads are already specified per unit member length; no slab tributary-width conversion is applied. The lateral forces are schematic floor resultants, not wind-code calculations.

The explicit beam loads total **675 kN downward**; the lateral forces total **56 kN to the right** and produce **560 kN·m clockwise** overturning moment about the origin. Self-weight adds a further gravity load. The gravity resultant acts at X = 9 m by symmetry.

## Sections and material

These are custom idealised welded I-sections, not named commercial sections. Dimensions below are in mm, in the order **overall depth × flange width × web thickness × flange thickness**.

| Assignment | Dimensions | Area [mm²] |
| --- | --- | --- |
| All columns, section 1 | 400 × 300 × 12 × 20 | 16,320 |
| All beams, section 2 | 350 × 180 × 10 × 16 | 8,940 |

For each section, with depth `h`, width `b`, web `tw` and flange `tf`:

```text
clear web depth = h − 2 tf
A = 2 b tf + tw (h − 2 tf)
I = [b h³ − (b − tw) (h − 2 tf)³] / 12
W = I / (h / 2)
```

These formulas use the strong bending axis and neglect fillets, weld geometry and other section details. Material assumptions are E = **210,000 MPa** and density = **7,850 kg/m³**. No yield strength or member capacity is asserted.

## Checks performed

Automated tests check:

- Counts, geometry, unique connections and complete connectivity to the bases.
- Rigid joints, correct beam/column section assignments and load directions.
- A finite solution with 48 free DOFs.
- Global horizontal/vertical force and moment equilibrium, including self-weight.
- Fixed-base displacement constraints and element-end displacement compatibility.
- Symmetric results when the lateral loads are removed.
- JSON round-trip fidelity and equality of the downloadable fixture to the in-app example.
- Browser loading, analysis, diagrams, result counts, and persistence.

These checks establish internal consistency, **not independent engineering validation**. The existing linear solver still omits P–Δ effects, buckling, yielding, load combinations, 3D behaviour and design-code checks. Member peaks are sampled, and stresses are not capacity assessments.
