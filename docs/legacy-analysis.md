# Empire 2D: legacy analysis and migration map

## Scope and evidence

This analysis was performed on a local legacy archive. The original Delphi sources, forms, assets, executables, DLLs and ZIPs are deliberately excluded from this repository; filenames below identify the inspected evidence, not files shipped with the web rebuild.

The analysis is based on reading the Pascal source, inspecting Delphi binary-form/resource strings, and listing the supplied ZIP archive. The original Windows executables have **not** been run. No original project files or reference calculation outputs were found in the initial top-level inventory or the listing of `EMPIRE2D.ZIP`.

There was no README, project guidance file, documentation directory, or Git repository in the initial folder. The legacy application files remain untouched; the web app and these documents are additions.

## Identification

Empire 2D is a desktop **2D frame-construction calculation program**, not a game or generic drawing utility. The English report dictionary `EMPLSTGB.LAN` explicitly describes it as “Calculation program for frame constructions.”

The executable `Empire2d.exe` is identified as an MS-DOS executable with an **NE Windows 3.x** header, consistent with a 16-bit Windows program. `EL2.DPR` creates the VCL forms and sets the title to `EMPIRE-2D`.

The folder contains 36 `.PAS` files, project files, compiled `.DCU` units, binary `.DFM` forms, resources, bitmaps, cursors, language dictionaries, Windows binaries, and ZIP archives. The `.DFM` files include Delphi `TPF0` component streams; an automatic file identification reporting one as JPEG XL is a signature collision, not evidence of a modern image format.

There are multiple snapshots:

- `EMPIRE2D.ZIP` contains 132 entries, including source and executables with many June 1996 timestamps.
- The top-level `EL2.DPR` has March 1997 change notes.
- The top-level `EL_ALG.PAS` declares `Versie = '10-2010'`.

These do not establish that all sources, compiled units, and executables represent one consistent release. Equivalence needs to target an identified original executable/version rather than assuming everything matches.

## Architecture recovered from source

| Original unit | Role | Web mapping / status |
| --- | --- | --- |
| `EL2.DPR` | Program startup, form creation, single-instance handling | `web/src/main.tsx`; browser lifecycle replaces Windows process lifecycle |
| `EL_ALG.PAS` | Global records, model allocation, native save/load, defaults and settings | `model.ts`; typed project object, immutable edits, JSON schema |
| `EL_INPGR.PAS` | Main graphical editor, tools, menus, zoom, file and analysis commands | `App.tsx`, `Explorer.tsx`, `FrameCanvas.tsx` |
| `EL_TEKEN.PAS` | Drawing members, supports, loads, diagrams | SVG drawing; intentionally new visual design |
| `EL_EDIT.PAS` | Tabular editing of model entities and project data | Properties inspector and explorer; full spreadsheet editor deferred |
| `EL_INPPR.PAS`, `EL_PROF.PAS`, `EL_MAT.PAS` | Profile/material selection and database editing | Custom section definitions; catalogue recovery deferred |
| `EL_INPKR.PAS` | Force input | Nodal loads and member distributed loads; interior point loads deferred |
| `EL_BER1.PAS` | Element stiffness, assembly, loads, solving, forces, stresses, buckling and deflection | `solver.ts` implements the core elastic-frame mechanics, not full stress/buckling parity |
| `EL_BERR.PAS`, `EL_BEROP.PAS` | Model checks, calculation control/options | Schema/model validation and solver errors; advanced options deferred |
| `EL_NUMM.PAS`, `EL_TXT.PAS` | Numerical results and reports | Results tables and CSV export |
| `EL_PRINS.PAS`, `EL_PRINT.PAS` | Printer setup/output | Browser print stylesheet and PDF via print dialog |
| `EL_DXF.PAS` | DXF lines/profile outlines | Deferred |
| `EL_VERST.PAS` | Member subdivision | Deferred; users can model intermediate nodes manually |
| `EL_GRSN.PAS` | Grid, snap, display configuration | Fixed 0.5 m placement snap, labels, pan and zoom; full options deferred |
| `EL_TAAL.PAS`, `ACC_LAN*.PAS` | Language selection/dictionary lookup | English first; original dictionaries preserved |
| `CHKIDAPI.PAS` | Borland database-engine setup via Windows INI files | Not required by JSON/browser implementation |

### Original model records

`EL_ALG.PAS` defines:

- **AlgemRec:** project metadata, drawing bounds, grid/snap, gravity, displacement amplification, load/material factors, calculation steps, output toggles, derived mass/centroid, language and release information.
- **KnoopRec:** node coordinates, force/moment fields, displacements/rotation, and three freedom flags. `bfh`, `bfv`, and `bm` mean **free** when true, which is the inverse of many modern “fixed DOF” flags.
- **StaafRec:** node indices, rigid/hinged end flags (`VL`/`VR` true means rigid), profile reference, left/right distributed loads, buckling data and result forces.
- **ProfRec:** two-axis section geometry, section moduli, shear-related geometry, drawing outlines, material elasticity/yield/density, and section rotation.
- **KrachtRec:** a load targeted at a node or member, force, angle, and an overloaded distance-or-moment field.

The top-level constants include 500 nodes, 500 members, 80 profiles and 360 forces, but `MaxMatrix = 600` and three DOFs per node. The declared node limit must not be interpreted as proof the solver supports 500-node frames. The web prototype sets its own explicitly bounded dense-solver limits.

### Numerical method

The core solver is recognizable rather than opaque:

1. `LokaleMatrix` builds the six-by-six local axial/bending stiffness matrix, with four end-fixity combinations.
2. `TransformatieMatrix` builds the local/global rotation.
3. `GlobaleMatrix` computes `Tᵀ k T`.
4. `PlaatsInMatrix` assembles element contributions into the full frame stiffness.
5. `PlaatsBelastingenVerplaatsingen` distinguishes known displacements from known forces.
6. `QBelStaafLok` and `FBelStaafLok` produce consistent loads for linearly varying distributed and member point loads.
7. `RangschikMatrix` and the matrix routines solve the unknown displacement system and recover reactions.
8. `StaafKrachten`, `MomFd`, and `StaafAfwijking` recover member forces, diagrams, and deflection.

The original self-weight routine creates temporary point loads along each member. The web implementation instead applies a consistent continuous gravity load in both local axial and transverse directions. This is an intentional modelling improvement/difference, not a byte-for-byte port.

The original buckling routine computes slenderness in two axes, calls `Omega`, and derives effective lengths using a sampled bending/rotation procedure. The combined stress routine calls `SigmaId` and uses additional section shear geometry. Those functions are referenced through the missing `DAE_Alg` unit. The web stress readout intentionally does **not** pretend to reproduce them.

### Units

Source evidence is more useful than names alone:

- Profile area/inertia/modulus are stored in mm²/mm⁴/mm³; elasticity is N/mm² (MPa).
- `EL_INPPR.PAS` explicitly displays legacy density as **kg/dm³**.
- The demo density is `7.8`; treating this as modern kg/m³ would introduce a factor-of-1,000 error.
- The calculation and default coordinate ranges indicate internal legacy mm/N units, while report labels include m/kN and mm.

The web format makes its conversions explicit. Geometry is m, external force kN, moment kN·m, section dimensions mm-based, and density kg/m³. See [project-format.md](project-format.md).

## Dependencies and missing material

### Not present in the initial top-level source inventory

- `DAE_Alg`: general numeric/string/file helpers, including design-related `Omega` and `SigmaId` references.
- `Dongle`: referenced by `EL_INPGR.PAS`; its exact implementation was not recovered.
- Windows help files such as `EMP2D-NL.HLP`.
- `PROFIEL.DB` and the language-specific profile directories referred to by the application.
- Representative `.EL2` project fixtures and known-good numerical outputs.

### Present or partly recoverable

- `ACCUSER.DPR` and `ACCUSER.DLL` provide external identity/licence-related functions used by the main form.
- `CHKIDAPI.PAS` manipulates Borland IDAPI configuration; VCL database units are used throughout the catalogue forms.
- The ZIP contains `EL2MAT.DB` and `TEST.DB`; the material data is potentially recoverable. Neither the complete profile catalogue nor compatibility with a particular database revision has been established.
- Report dictionaries are present for GB, NL, DE and FR; other `.LAN` files contain UI/localization data. This is not yet a verified complete multilingual resource set.
- Profile properties for a demo HE100A section are hard-coded in `HE100A_Demo` and were used as an explicit seed, not as a complete catalogue.

Windows runtime/licensing/database integration is outside the browser implementation. The web application does not patch binaries or reproduce hardware-dongle behaviour.

## Why `.EL2` import is a separate task

`LoadSpant`/`SaveSpant` use `BlockRead`/`BlockWrite` directly on records:

1. `SpantVersie` (`Str5`).
2. Eight count/current-selection integers.
3. `AlgemRec`.
4. All node records.
5. All member records.
6. All profile records.
7. All force records.

The actual layout depends on compiler/version assumptions: 16-bit integers, Delphi/Turbo Pascal short strings, six-byte `Real` representation where applicable, record alignment and exact release-specific record definitions. Also note the longer top-level version literal assigned to a `Str5` value. It is not safe to infer compatibility from the displayed version text.

A robust importer should:

- Identify known layout variants using file size, version bytes and bounded counts.
- Decode numeric fields explicitly, never by JavaScript/native struct reinterpretation.
- Reject truncated, contradictory or non-finite data before mutating the open project.
- Map freedom flags, angle/force signs, section rotation and old density units deliberately.
- Preserve original raw data/metadata where a web feature is not representable.
- Be tested against multiple real files, including non-default supports, releases, settlements, point loads and catalogue profiles.

The requested first milestone deliberately uses JSON instead.

## Verification gates for a replacement

1. **Core web prototype:** editor + solver + versioned projects + analytical regression tests. Implemented here.
2. **Behaviour comparison:** run a chosen original build in a suitable Windows VM/emulator; collect input/output fixtures and screenshots. Do not assume the supplied source matches the chosen binary.
3. **Legacy import:** decode and test representative `.EL2` files with explicit version support.
4. **Data recovery:** export material/profile tables to documented, versioned data; check units and axes.
5. **Feature completion:** interior member point loads, settlements, factors, catalogue/rotation workflows, subdivision, DXF and localization.
6. **Design-check reconstruction:** recover or independently specify the missing helper algorithms and governing standard; have engineering specialists validate buckling and combined-stress behaviour.
7. **Release qualification:** compare reactions, displacements, member forces/diagrams and reports across a regression corpus with explicit tolerances and independently reviewed sign conventions.

Analytical tests are necessary but do not constitute engineering certification or full legacy parity.
