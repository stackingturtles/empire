import { z } from 'zod';

const number = z.number().finite();
const id = number.int().positive().safe();
export const supportSchema = z.enum(['free', 'fixed', 'pin', 'roller-y', 'roller-x']);
export type Support = z.infer<typeof supportSchema>;

const nodeSchema = z
  .object({
    id,
    x: number.min(-10000).max(10000),
    y: number.min(-10000).max(10000),
    support: supportSchema,
    fx: number,
    fy: number,
    moment: number,
  })
  .strict();
const memberSchema = z
  .object({
    id,
    start: id,
    end: id,
    section: id,
    releaseStart: z.boolean(),
    releaseEnd: z.boolean(),
    qStart: number,
    qEnd: number,
  })
  .strict();
const sectionSchema = z
  .object({
    id,
    name: z.string().trim().min(1).max(80),
    // User-facing section units: mm², mm⁴, mm³, N/mm², kg/m³.
    area: number.positive(),
    inertia: number.positive(),
    modulus: number.positive(),
    elasticModulus: number.positive(),
    density: number.min(0).max(30000),
  })
  .strict();
export const projectSchema = z
  .object({
    format: z.literal('empire-2d-web'),
    version: z.literal(1),
    name: z.string().trim().min(1).max(120),
    engineer: z.string().max(120),
    description: z.string().max(2000),
    selfWeight: z.boolean(),
    nodes: z.array(nodeSchema).max(150),
    members: z.array(memberSchema).max(300),
    sections: z.array(sectionSchema).min(1).max(80),
  })
  .strict();
export type FrameNode = z.infer<typeof nodeSchema>;
export type Member = z.infer<typeof memberSchema>;
export type Section = z.infer<typeof sectionSchema>;
export type Project = z.infer<typeof projectSchema>;
export type Selection = { kind: 'project' } | { kind: 'node' | 'member' | 'section'; id: number };
export type Tool = 'select' | 'node' | 'member' | 'pan';
export type Diagram = 'model' | 'displacement' | 'moment' | 'shear' | 'axial';

export const SUPPORT_LABELS: Record<Support, string> = {
  free: 'Free',
  fixed: 'Fixed',
  pin: 'Pinned',
  'roller-y': 'Roller · Y restrained',
  'roller-x': 'Roller · X restrained',
};
export function restraints(support: Support): boolean[] {
  return [
    support === 'fixed' || support === 'pin' || support === 'roller-x',
    support === 'fixed' || support === 'pin' || support === 'roller-y',
    support === 'fixed',
  ];
}
export function newNode(id: number, x: number, y: number): FrameNode {
  return { id, x, y, support: 'free', fx: 0, fy: 0, moment: 0 };
}
export function newMember(id: number, start: number, end: number, section: number): Member {
  return { id, start, end, section, releaseStart: false, releaseEnd: false, qStart: 0, qEnd: 0 };
}
export function nextId(items: { id: number }[]): number {
  return items.reduce((max, item) => Math.max(max, item.id), 0) + 1;
}
export function validateProject(project: Project): void {
  const parsed = projectSchema.safeParse(project);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    throw new Error(`${issue.path.join('.') || 'Project'}: ${issue.message}`);
  }
  for (const key of ['nodes', 'members', 'sections'] as const) {
    if (new Set(project[key].map((item) => item.id)).size !== project[key].length) {
      throw new Error(`Duplicate IDs in ${key}.`);
    }
  }
  const nodes = new Map(project.nodes.map((node) => [node.id, node]));
  const sections = new Set(project.sections.map((section) => section.id));
  for (const member of project.members) {
    const a = nodes.get(member.start);
    const b = nodes.get(member.end);
    if (!a || !b) throw new Error(`Member ${member.id} references a missing node.`);
    if (a.id === b.id || Math.hypot(b.x - a.x, b.y - a.y) < 1e-6) {
      throw new Error(`Member ${member.id} must connect two distinct positions.`);
    }
    if (!sections.has(member.section))
      throw new Error(`Member ${member.id} references a missing section.`);
  }
}
export function parseProject(text: string): Project {
  if (text.length > 2_000_000) throw new Error('Project file is too large (maximum 2 MB).');
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    throw new Error('This is not a valid JSON project. Legacy .EL2 files are not supported yet.');
  }
  const parsed = projectSchema.safeParse(value);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    throw new Error(`Invalid project at ${issue.path.join('.') || 'root'}: ${issue.message}`);
  }
  validateProject(parsed.data);
  return parsed.data;
}
export function serializeProject(project: Project): string {
  validateProject(project);
  return JSON.stringify(project, null, 2);
}

export function portalExample(): Project {
  return {
    format: 'empire-2d-web',
    version: 1,
    name: 'Single-bay portal frame',
    engineer: '',
    description:
      'A 6 m × 4 m steel portal with fixed bases, a lateral nodal load and a roof load. Illustrative example, not a design.',
    selfWeight: false,
    nodes: [
      { ...newNode(1, 0, 0), support: 'fixed' },
      { ...newNode(2, 0, 4), fx: 12 },
      newNode(3, 6, 4),
      { ...newNode(4, 6, 0), support: 'fixed' },
    ],
    members: [
      newMember(1, 1, 2, 1),
      { ...newMember(2, 2, 3, 1), qStart: -8, qEnd: -8 },
      newMember(3, 4, 3, 1),
    ],
    // Geometric values recovered from HE100A_Demo in EL_ALG.PAS; density is an explicit modern assumption.
    sections: [
      {
        id: 1,
        name: 'HE100A · steel',
        area: 2123,
        inertia: 3492251,
        modulus: 72755,
        elasticModulus: 210000,
        density: 7850,
      },
    ],
  };
}
export function beamExample(): Project {
  const project = portalExample();
  return {
    ...project,
    name: 'Simply supported beam',
    description: 'A 6 m beam under a 5 kN/m downward load. Pin and vertical roller supports.',
    nodes: [
      { ...newNode(1, 0, 0), support: 'pin' },
      { ...newNode(2, 6, 0), support: 'roller-y' },
    ],
    members: [{ ...newMember(1, 1, 2, 1), qStart: -5, qEnd: -5 }],
  };
}
export function cantileverExample(): Project {
  const project = portalExample();
  return {
    ...project,
    name: 'Cantilever beam',
    description: 'A 3 m cantilever with a 5 kN downward tip load.',
    nodes: [
      { ...newNode(1, 0, 0), support: 'fixed' },
      { ...newNode(2, 3, 0), fy: -5 },
    ],
    members: [newMember(1, 1, 2, 1)],
  };
}
/** Idealised welded I-section: rectangular plates only, with no fillets or catalogue certification. */
function buildingISection(
  id: number,
  name: string,
  depth: number,
  width: number,
  web: number,
  flange: number,
): Section {
  const clearDepth = depth - 2 * flange;
  const inertia = (width * depth ** 3 - (width - web) * clearDepth ** 3) / 12;
  return {
    id,
    name,
    area: 2 * width * flange + web * clearDepth,
    inertia,
    modulus: inertia / (depth / 2),
    elasticModulus: 210000,
    density: 7850,
  };
}

export function threeBayFourStoreyExample(): Project {
  const bays = 3;
  const storeys = 4;
  const bayWidth = 6;
  const storeyHeight = 3.5;
  const windLoads = [8, 12, 16, 20];
  const nodeId = (level: number, column: number) => level * (bays + 1) + column + 1;
  const nodes: FrameNode[] = [];
  const members: Member[] = [];

  for (let level = 0; level <= storeys; level++) {
    for (let column = 0; column <= bays; column++) {
      nodes.push({
        ...newNode(nodeId(level, column), column * bayWidth, level * storeyHeight),
        support: level === 0 ? 'fixed' : 'free',
        fx: level > 0 && column === 0 ? windLoads[level - 1] : 0,
      });
    }
  }
  // Columns point upwards; beams point right, so negative q is globally downward.
  for (let level = 0; level < storeys; level++) {
    for (let column = 0; column <= bays; column++) {
      members.push(
        newMember(members.length + 1, nodeId(level, column), nodeId(level + 1, column), 1),
      );
    }
  }
  for (let level = 1; level <= storeys; level++) {
    const q = level === storeys ? -7.5 : -10;
    for (let bay = 0; bay < bays; bay++) {
      members.push({
        ...newMember(members.length + 1, nodeId(level, bay), nodeId(level, bay + 1), 2),
        qStart: q,
        qEnd: q,
      });
    }
  }
  return {
    format: 'empire-2d-web',
    version: 1,
    name: 'Three-bay, four-storey frame',
    engineer: '',
    description:
      'Illustrative unbraced steel moment frame, not a structural design. ' +
      'Three 6 m bays and four 3.5 m storeys (18 m wide × 14 m high); four fixed bases and rigid joints. ' +
      'Downward beam loads: 10 kN/m at levels 1–3 and 7.5 kN/m at the roof, plus member self-weight. ' +
      'Global +X floor loads: 8, 12, 16 and 20 kN at the left column, bottom to top. ' +
      'Idealised welded I-sections (depth × flange width × web × flange thickness, mm): ' +
      'columns 400 × 300 × 12 × 20; beams 350 × 180 × 10 × 16. ' +
      'E = 210000 MPa; density = 7850 kg/m³. No code-derived loads, buckling or second-order checks.',
    selfWeight: true,
    nodes,
    members,
    sections: [
      buildingISection(1, 'Column · welded I400×300×12×20', 400, 300, 12, 20),
      buildingISection(2, 'Beam · welded I350×180×10×16', 350, 180, 10, 16),
    ],
  };
}

export function emptyProject(): Project {
  return { ...portalExample(), name: 'Untitled frame', description: '', nodes: [], members: [] };
}

export interface History {
  past: Project[];
  present: Project;
  future: Project[];
}
export type HistoryAction =
  | { type: 'change'; project: Project }
  | { type: 'replace'; project: Project }
  | { type: 'undo' | 'redo' };
export function historyReducer(state: History, action: HistoryAction): History {
  switch (action.type) {
    case 'change':
      return {
        past: [...state.past.slice(-49), state.present],
        present: action.project,
        future: [],
      };
    case 'replace':
      return { past: [], present: action.project, future: [] };
    case 'undo': {
      const previous = state.past.at(-1);
      return previous
        ? {
            past: state.past.slice(0, -1),
            present: previous,
            future: [state.present, ...state.future],
          }
        : state;
    }
    case 'redo': {
      const next = state.future[0];
      return next
        ? { past: [...state.past, state.present], present: next, future: state.future.slice(1) }
        : state;
    }
  }
}
