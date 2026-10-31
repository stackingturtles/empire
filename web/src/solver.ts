import { restraints, validateProject, type Project, type Member, type Section } from './model';

type Matrix = number[][];
export interface NodeResult {
  id: number;
  ux: number;
  uy: number;
  rotation: number;
  rx: number;
  ry: number;
  reactionMoment: number;
}
export interface Station {
  x: number;
  axial: number;
  shear: number;
  moment: number;
  u: number;
  v: number;
  stress: number;
}
export interface MemberResult {
  id: number;
  length: number;
  endForces: number[];
  localDisplacements: number[];
  stations: Station[];
  maxDisplacement: number;
  maxStress: number;
}
export interface AnalysisResult {
  nodes: NodeResult[];
  members: MemberResult[];
  mass: number;
  maxDisplacement: number;
  maxStress: number;
  freeDofs: number;
  warnings: string[];
}
interface Element {
  member: Member;
  section: Section;
  length: number;
  cos: number;
  sin: number;
  dofs: number[];
  fullK: Matrix;
  fullP: number[];
  k: Matrix;
  p: number[];
  transform: Matrix;
  released: number[];
  retained: number[];
  q0: number;
  q1: number;
  px: number;
}
const zeros = (rows: number, columns = rows): Matrix =>
  Array.from({ length: rows }, () => Array<number>(columns).fill(0));
const multiplyVector = (a: Matrix, b: number[]): number[] =>
  a.map((row) => row.reduce((sum, value, j) => sum + value * b[j], 0));
const transpose = (a: Matrix): Matrix => a[0].map((_, j) => a.map((row) => row[j]));
function multiply(a: Matrix, b: Matrix): Matrix {
  return a.map((row) =>
    b[0].map((_, j) => row.reduce((sum, value, k) => sum + value * b[k][j], 0)),
  );
}

/** Partial-pivot elimination on a copy; used for small condensation systems too. */
function linearSolve(matrix: Matrix, rhs: number[], tolerance = 1e-11): number[] {
  const n = rhs.length;
  if (n === 0) return [];
  const a = matrix.map((row, i) => [...row, rhs[i]]);
  const norm = Math.max(...matrix.map((row) => Math.max(...row.map(Math.abs))));
  for (let column = 0; column < n; column++) {
    let pivot = column;
    for (let row = column + 1; row < n; row++) {
      if (Math.abs(a[row][column]) > Math.abs(a[pivot][column])) pivot = row;
    }
    if (!Number.isFinite(a[pivot][column]) || Math.abs(a[pivot][column]) <= norm * tolerance) {
      throw new Error(
        'The frame is unstable or numerically ill-conditioned. Check supports, disconnected nodes, and member-end releases.',
      );
    }
    [a[column], a[pivot]] = [a[pivot], a[column]];
    for (let row = column + 1; row < n; row++) {
      const factor = a[row][column] / a[column][column];
      a[row][column] = 0;
      for (let j = column + 1; j <= n; j++) a[row][j] -= factor * a[column][j];
    }
  }
  const result = Array<number>(n).fill(0);
  for (let row = n - 1; row >= 0; row--) {
    let value = a[row][n];
    for (let column = row + 1; column < n; column++) value -= a[row][column] * result[column];
    result[row] = value / a[row][row];
  }
  return result;
}

function createElement(project: Project, member: Member, indices: Map<number, number>): Element {
  const a = project.nodes[indices.get(member.start)!];
  const b = project.nodes[indices.get(member.end)!];
  const section = project.sections.find((item) => item.id === member.section)!;
  const length = Math.hypot(b.x - a.x, b.y - a.y);
  const cos = (b.x - a.x) / length;
  const sin = (b.y - a.y) / length;
  // Convert exactly once to consistent kN–m units.
  const ea = section.elasticModulus * 1000 * section.area * 1e-6;
  const ei = section.elasticModulus * 1000 * section.inertia * 1e-12;
  const axial = ea / length;
  const k12 = (12 * ei) / length ** 3;
  const k6 = (6 * ei) / length ** 2;
  const k4 = (4 * ei) / length;
  const k2 = (2 * ei) / length;
  const fullK = [
    [axial, 0, 0, -axial, 0, 0],
    [0, k12, k6, 0, -k12, k6],
    [0, k6, k4, 0, -k6, k2],
    [-axial, 0, 0, axial, 0, 0],
    [0, -k12, -k6, 0, k12, -k6],
    [0, k6, k2, 0, -k6, k4],
  ];
  const weight = project.selfWeight ? (-section.area * 1e-6 * section.density * 9.81) / 1000 : 0;
  const px = weight * sin;
  const q0 = member.qStart + weight * cos;
  const q1 = member.qEnd + weight * cos;
  const fullP = [
    (px * length) / 2,
    (length * (7 * q0 + 3 * q1)) / 20,
    (length ** 2 * (3 * q0 + 2 * q1)) / 60,
    (px * length) / 2,
    (length * (3 * q0 + 7 * q1)) / 20,
    (-(length ** 2) * (2 * q0 + 3 * q1)) / 60,
  ];
  const transform = [
    [cos, sin, 0, 0, 0, 0],
    [-sin, cos, 0, 0, 0, 0],
    [0, 0, 1, 0, 0, 0],
    [0, 0, 0, cos, sin, 0],
    [0, 0, 0, -sin, cos, 0],
    [0, 0, 0, 0, 0, 1],
  ];
  const released: number[] = [];
  if (member.releaseStart) released.push(2);
  if (member.releaseEnd) released.push(5);
  const retained = [0, 1, 2, 3, 4, 5].filter((i) => !released.includes(i));
  const k = fullK.map((row) => [...row]);
  const p = [...fullP];
  if (released.length) {
    const krr = released.map((i) => released.map((j) => fullK[i][j]));
    const releasedLoad = linearSolve(
      krr,
      released.map((i) => fullP[i]),
    );
    for (const i of retained) {
      p[i] -= released.reduce((sum, r, index) => sum + fullK[i][r] * releasedLoad[index], 0);
      for (const j of retained) {
        const column = linearSolve(
          krr,
          released.map((r) => fullK[r][j]),
        );
        k[i][j] -= released.reduce((sum, r, index) => sum + fullK[i][r] * column[index], 0);
      }
    }
    for (const r of released) {
      p[r] = 0;
      for (let i = 0; i < 6; i++) {
        k[r][i] = 0;
        k[i][r] = 0;
      }
    }
  }
  const start = indices.get(member.start)! * 3;
  const end = indices.get(member.end)! * 3;
  return {
    member,
    section,
    length,
    cos,
    sin,
    dofs: [start, start + 1, start + 2, end, end + 1, end + 2],
    fullK,
    fullP,
    k,
    p,
    transform,
    released,
    retained,
    q0,
    q1,
    px,
  };
}

function memberResult(element: Element, displacements: number[]): MemberResult {
  const { fullK, fullP, released, retained, length, section, q0, q1, px } = element;
  const local = multiplyVector(
    element.transform,
    element.dofs.map((i) => displacements[i]),
  );
  if (released.length) {
    const recovered = linearSolve(
      released.map((i) => released.map((j) => fullK[i][j])),
      released.map((i) => fullP[i] - retained.reduce((sum, j) => sum + fullK[i][j] * local[j], 0)),
    );
    released.forEach((r, index) => {
      local[r] = recovered[index];
    });
  }
  const endForces = multiplyVector(fullK, local).map((value, i) => value - fullP[i]);
  const ea = section.elasticModulus * 1000 * section.area * 1e-6;
  const ei = section.elasticModulus * 1000 * section.inertia * 1e-12;
  const slope = (q1 - q0) / length;
  const stations = Array.from({ length: 81 }, (_, index): Station => {
    const x = (length * index) / 80;
    const axial = -endForces[0] - px * x;
    const shear = endForces[1] + q0 * x + (slope * x ** 2) / 2;
    const moment = -endForces[2] + endForces[1] * x + (q0 * x ** 2) / 2 + (slope * x ** 3) / 6;
    const u = local[0] + (-endForces[0] * x - (px * x ** 2) / 2) / ea;
    // Integrate EI v'' = M exactly, including the load's particular solution.
    const v =
      local[1] +
      local[2] * x +
      ((-endForces[2] * x ** 2) / 2 +
        (endForces[1] * x ** 3) / 6 +
        (q0 * x ** 4) / 24 +
        (slope * x ** 5) / 120) /
        ei;
    const stress =
      (Math.abs(axial) / (section.area * 1e-6) + Math.abs(moment) / (section.modulus * 1e-9)) /
      1000;
    return { x, axial, shear, moment, u, v, stress };
  });
  return {
    id: element.member.id,
    length,
    endForces,
    localDisplacements: local,
    stations,
    maxDisplacement: Math.max(...stations.map((station) => Math.hypot(station.u, station.v))),
    maxStress: Math.max(...stations.map((station) => station.stress)),
  };
}

/** Linear, small-displacement, prismatic Euler–Bernoulli 2D frame analysis. Not a design-code check. */
export function solveFrame(project: Project): AnalysisResult {
  validateProject(project);
  if (project.nodes.length < 2 || project.members.length === 0)
    throw new Error('Add at least two nodes and one member before analysing.');
  const connected = new Set(project.members.flatMap((member) => [member.start, member.end]));
  const orphan = project.nodes.find((node) => !connected.has(node.id));
  if (orphan)
    throw new Error(`Node ${orphan.id} is disconnected. Connect it to a member or remove it.`);
  const indices = new Map(project.nodes.map((node, index) => [node.id, index]));
  const elements = project.members.map((member) => createElement(project, member, indices));
  const n = project.nodes.length * 3;
  const stiffness = zeros(n);
  const loads = project.nodes.flatMap((node) => [node.fx, node.fy, node.moment]);
  const fixed = project.nodes.flatMap((node) => restraints(node.support));
  for (const element of elements) {
    const tt = transpose(element.transform);
    const globalK = multiply(multiply(tt, element.k), element.transform);
    const globalP = multiplyVector(tt, element.p);
    element.dofs.forEach((i, row) => {
      loads[i] += globalP[row];
      element.dofs.forEach((j, column) => {
        stiffness[i][j] += globalK[row][column];
      });
    });
  }
  const free: number[] = [];
  for (let i = 0; i < n; i++) {
    if (fixed[i]) continue;
    // A node at which every connected end is hinged has no structural rotational DOF.
    // Ignore it only if unloaded. Translational zero stiffness is always an instability.
    if (stiffness[i][i] === 0 && i % 3 === 2 && Math.abs(loads[i]) < 1e-12) continue;
    if (stiffness[i][i] <= 0)
      throw new Error(
        `Node ${project.nodes[Math.floor(i / 3)].id} has an unrestrained ${['X translation', 'Y translation', 'rotation'][i % 3]}. Check supports and releases.`,
      );
    free.push(i);
  }
  const scales = free.map((i) => 1 / Math.sqrt(stiffness[i][i]));
  const reduced = free.map((i, row) =>
    free.map((j, column) => stiffness[i][j] * scales[row] * scales[column]),
  );
  const solution = linearSolve(
    reduced,
    free.map((i, row) => loads[i] * scales[row]),
  );
  const displacements = Array<number>(n).fill(0);
  free.forEach((i, row) => {
    displacements[i] = solution[row] * scales[row];
  });
  const reactions = multiplyVector(stiffness, displacements).map((value, i) => value - loads[i]);
  const nodes = project.nodes.map((node, index): NodeResult => ({
    id: node.id,
    ux: displacements[index * 3],
    uy: displacements[index * 3 + 1],
    rotation: displacements[index * 3 + 2],
    rx: fixed[index * 3] ? reactions[index * 3] : 0,
    ry: fixed[index * 3 + 1] ? reactions[index * 3 + 1] : 0,
    reactionMoment: fixed[index * 3 + 2] ? reactions[index * 3 + 2] : 0,
  }));
  const members = elements.map((element) => memberResult(element, displacements));
  const maxDisplacement = Math.max(...members.map((member) => member.maxDisplacement));
  const maxStress = Math.max(...members.map((member) => member.maxStress));
  const mass = elements.reduce(
    (sum, element) => sum + element.length * element.section.area * 1e-6 * element.section.density,
    0,
  );
  const minLength = Math.min(...elements.map((element) => element.length));
  const allValues = [
    ...displacements,
    ...reactions,
    mass,
    maxDisplacement,
    maxStress,
    ...members.flatMap((member) => member.stations.flatMap((station) => Object.values(station))),
  ];
  if (allValues.some((value) => !Number.isFinite(value)))
    throw new Error(
      'Analysis exceeded the numerical range. Check model dimensions, loads and section properties.',
    );
  return {
    nodes,
    members,
    mass,
    maxDisplacement,
    maxStress,
    freeDofs: free.length,
    warnings:
      maxDisplacement / minLength > 0.02
        ? [
            'Large displacement relative to member length: small-displacement analysis may be inappropriate.',
          ]
        : [],
  };
}
