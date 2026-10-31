# Empire 2D web project format, version 1

The web application saves UTF-8 JSON files named `*.empire.json`. They are **not** original binary `.EL2` files.

The executable source of truth for validation is `web/src/model.ts` (`projectSchema`). Unknown keys and unsupported versions are rejected rather than silently discarded. All numbers must be finite.

## Minimal example

```json
{
  "format": "empire-2d-web",
  "version": 1,
  "name": "Cantilever",
  "engineer": "",
  "description": "3 m cantilever with a downward tip force",
  "selfWeight": false,
  "nodes": [
    { "id": 1, "x": 0, "y": 0, "support": "fixed", "fx": 0, "fy": 0, "moment": 0 },
    { "id": 2, "x": 3, "y": 0, "support": "free", "fx": 0, "fy": -5, "moment": 0 }
  ],
  "members": [
    {
      "id": 1,
      "start": 1,
      "end": 2,
      "section": 1,
      "releaseStart": false,
      "releaseEnd": false,
      "qStart": 0,
      "qEnd": 0
    }
  ],
  "sections": [
    {
      "id": 1,
      "name": "HE100A · steel",
      "area": 2123,
      "inertia": 3492251,
      "modulus": 72755,
      "elasticModulus": 210000,
      "density": 7850
    }
  ]
}
```

## Fields

### Project

| Field | Meaning / bounds |
| --- | --- |
| `format` | Exactly `"empire-2d-web"` |
| `version` | Exactly `1` |
| `name` | Nonempty trimmed string, maximum 120 characters |
| `engineer` | String, maximum 120 characters |
| `description` | String, maximum 2,000 characters |
| `selfWeight` | Include global downward gravity at 9.81 m/s² |
| `nodes` | Up to 150 nodes; can be empty while editing |
| `members` | Up to 300 members; can be empty while editing |
| `sections` | Between 1 and 80 section definitions |

IDs are positive integers unique **within each entity collection**. Member endpoint and section references must exist. JSON import is limited to 2 MB.

### Node

| Field | Unit / meaning |
| --- | --- |
| `id` | Node ID |
| `x`, `y` | Global coordinates [m], between −10,000 and +10,000 |
| `support` | One of `free`, `fixed`, `pin`, `roller-y`, `roller-x` |
| `fx`, `fy` | Global applied nodal force [kN], +X right and +Y up |
| `moment` | Applied nodal moment [kN·m], counterclockwise positive |

Support constraints:

| Support | X translation | Y translation | Rotation |
| --- | --- | --- | --- |
| `free` | free | free | free |
| `fixed` | zero | zero | zero |
| `pin` | zero | zero | free |
| `roller-y` | free | zero | free |
| `roller-x` | zero | free | free |

An applied load at a restrained DOF is valid and is included in reaction recovery. Nonzero settlements/prescribed rotations are not represented in this version.

### Member

| Field | Unit / meaning |
| --- | --- |
| `id` | Member ID |
| `start`, `end` | Existing node IDs defining local +X from start to end |
| `section` | Existing section ID |
| `releaseStart`, `releaseEnd` | True releases the corresponding local end rotation; axial/transverse connectivity remains |
| `qStart`, `qEnd` | Transverse load [kN/m] at start/end, varying linearly |

Local +Y is 90° counterclockwise from local +X. A **negative** `qStart`/`qEnd` acts downward on a member directed left-to-right. Reversing a member changes its local axes; convert the loads accordingly rather than assuming sign invariance.

Member endpoints must occupy distinct positions separated by at least 10⁻⁶ m. Nodes may be unconnected while editing, but the solver rejects disconnected nodes. Crossing members are **not automatically connected** at intersections; add intermediate nodes and split the geometry yourself.

### Section

| Field | Unit / meaning |
| --- | --- |
| `id` | Section ID |
| `name` | Nonempty trimmed name, maximum 80 characters |
| `area` | A [mm²], positive |
| `inertia` | In-plane bending second moment I [mm⁴], positive |
| `modulus` | In-plane bending elastic section modulus W [mm³], positive |
| `elasticModulus` | E [N/mm² = MPa], positive |
| `density` | [kg/m³], between 0 and 30,000 |

The field named `modulus` is the **section modulus W**, not material E. There is one active bending axis in the web format. To model another orientation, supply the appropriate I and W explicitly, usually through a separate section definition.

## Deliberately excluded from project files

Calculated results, view zoom/pan, active selection, undo history, and temporary tool state are not persisted. This keeps model inputs portable and prevents a changed project from carrying stale calculated results.

Original Empire fields that are not represented by this format must not be silently dropped by a future legacy importer. That importer will need explicit unsupported-field diagnostics or a preservation mechanism.
