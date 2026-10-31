# Empire 2D — Delphi to web

[Nederlands: LEESMIJ.md](LEESMIJ.md)

A browser-based reimplementation of the **Empire 2D structural frame-analysis application**, built with React and TypeScript in [`web/`](web/).

**Status: working core prototype, not a validated engineering replacement.** The web solver is tested against analytical beam/frame cases, but has not been compared with the original Windows executable or representative `.EL2` projects. Do not use this preview for engineering design or safety decisions.

The original Delphi application was analysed in a separate local archive. Its Pascal sources, forms, resources, executables, DLLs, and ZIP files are **not included in this repository**. They remain untouched in the original working folder; the root `.gitignore` permits only the new web application and documentation.

## Run the web application

Requires Node.js 22.12+ and npm (Node 22 or 24 LTS recommended).

```sh
cd web
npm ci
npm run dev
```

Open **http://127.0.0.1:5173**. If that port is occupied, Vite prints the next available port.

```sh
npm test          # Analytical solver, JSON validation, and history tests
npm run lint     # TypeScript/React lint
npm run build    # Strict TypeScript checks and production bundle
npm run format:check # Check source formatting
npm run preview  # Serve the production bundle locally
npm run test:e2e # Browser workflow tests; Google Chrome required by default
```

The Playwright configuration uses locally installed Chrome. To use Playwright's downloaded Chromium instead, remove `channel: 'chrome'` from `web/playwright.config.ts` and run `npx playwright install chromium` from `web/`.

## Deploy to Vercel

The Vercel project is **`empire`** under the **Stacking Turtles** team (`stacking-turtles`), connected to `stackingturtles/empire` on GitHub. [Open the project dashboard](https://vercel.com/stacking-turtles/empire).

Project settings: root directory **`web`**, framework **Vite**, install command **`npm ci`**, build command **`npm run build`**, and output directory **`dist`**. No application environment variables or backend services are required.

To create a preview deployment from a clean checkout of this repository, run from the repository root:

```sh
vercel link --repo --scope stacking-turtles --yes
vercel deploy --project empire --scope stacking-turtles --target=preview --yes
```

Use the explicit `--target=preview` flag: Vercel may otherwise treat the first deployment of a new project as production. Local `.vercel/` link metadata is ignored by Git. The original legacy archive is not part of this repository or its deployment.

The GitHub integration automatically deploys future pushes: **`main` publishes to production**, while other branches create previews. Only push to `main` when a production release is intended.

## What works

- Modern, responsive modelling workspace with an SVG frame drawing.
- Add, select, edit, and delete nodes, members, and custom section definitions.
- Fixed, pinned, horizontal-roller and vertical-roller support conditions.
- Nodal X/Y forces and moments; linearly varying transverse member loads.
- Rigid or hinged member ends, including independent release of either end.
- Optional self-weight based on section area, density, and global gravity.
- Linear elastic 2D frame analysis using three degrees of freedom per node.
- Deformation, bending-moment, shear-force, and axial-force diagrams.
- Nodal displacements, support reactions, sampled member-force peaks and normal stresses.
- Portal, three-bay/four-storey building, simply supported beam, and cantilever examples.
- Undo/redo, drawing pan/zoom, 0.5 m placement snap, and labels.
- Versioned JSON import/export, browser-local autosave, CSV result export, and printable reports/PDF through the browser.
- Validation for malformed projects, missing references, invalid sections, disconnected nodes, and singular/unstable models.

The first version is deliberately **browser-local**: no backend, database service, accounts, or project uploads. Fonts are self-hosted with the application. A JSON download is the portable backup; browser storage is not a durable archive.

## First steps

1. The app opens with an illustrative portal frame.
2. Select a node or member in the drawing or Model explorer; edit its properties on the right. Numeric/text edits commit on blur or Enter.
3. Add nodes with the drawing tool, or use **+** beside Nodes for a keyboard-accessible alternative. Connect two nodes with the member tool, or add a connection through Model explorer and edit its endpoints.
4. Edit section properties and support conditions, then choose **Analyse**.
5. Switch between result diagrams or the numerical result tabs. Any model edit or undo/redo clears stale results.
6. Use **Save copy** to download a `.empire.json` project. **Open** loads that web format, not legacy binary `.EL2` files.

For the larger building model, choose **Examples → Three-bay, four-storey frame**, then **Analyse**. It has 20 nodes, 28 rigid-jointed members, three 6 m bays, four 3.5 m storeys, fixed bases, floor/roof loads, lateral loads and self-weight. Its two custom welded I-sections are idealised rather than catalogue-certified. See [the model specification](docs/three-bay-four-storey.md) or [download its JSON project](web/public/examples/three-bay-four-storey.empire.json).

The supplied HE100A geometry comes from `HE100A_Demo` in the locally analysed legacy `EL_ALG.PAS`. Its web density is explicitly assumed as 7,850 kg/m³, rather than claiming catalogue certification. The portal's deliberately slender section can produce a large-displacement warning under the sample loads; it is not a structural design recommendation.

## Limits and remaining migration work

This release supports one linear-static load case, up to 150 nodes, 300 members, and 80 section definitions. It is not feature-complete with the Delphi application.

Not yet implemented: original `.EL2` binary import/export, original material/profile catalogue recovery, concentrated loads within members, prescribed support displacements/settlements, user-defined gravity vectors, load/material factors, the original buckling and combined-stress checks, section rotation/catalogue tools, member subdivision, DXF export, legacy display/printing options, and translations.

The solver uses small-displacement Euler–Bernoulli beam theory. It does not perform second-order, nonlinear, plastic, dynamic, shear-deformation, or design-code checks. Reported member peaks are sampled at 81 stations, not guaranteed mathematical extrema. Stress is the normal-stress bound `|N|/A + |M|/W`, **not** a safety/capacity assessment.

## Documentation

- [Legacy analysis and migration map](docs/legacy-analysis.md)
- [Web architecture and numerical method](docs/web-architecture.md)
- [JSON project format and units](docs/project-format.md)
- [Three-bay, four-storey example](docs/three-bay-four-storey.md)

## Layout

```text
.gitignore                 Keeps the local legacy archive out of version control
docs/                      Analysis, example specifications, and numerical notes
web/                       React + TypeScript + Vite application
  src/model.ts             Versioned schema, validation, examples, history
  src/solver.ts            UI-independent structural solver
  src/components/          Drawing, explorer, properties, and results
  public/examples/         Downloadable web-format sample projects
  src/*.test.ts            Numerical, example, and model unit tests
  tests/                   Playwright browser workflow tests
```
