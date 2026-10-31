import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  parseProject,
  serializeProject,
  threeBayFourStoreyExample,
  validateProject,
} from './model';
import { solveFrame } from './solver';

const near = (actual: number, expected: number) =>
  expect(Math.abs(actual - expected)).toBeLessThan(1e-8 * Math.max(1, Math.abs(expected)));

describe('three-bay, four-storey building example', () => {
  it('creates a valid 18 m × 14 m grid with 20 nodes, four fixed bases and rigid joints', () => {
    const project = threeBayFourStoreyExample();
    expect(() => validateProject(project)).not.toThrow();
    expect(project.nodes).toHaveLength(20);
    expect(project.members).toHaveLength(28);
    expect(project.sections).toHaveLength(2);
    expect([...new Set(project.nodes.map((node) => node.x))]).toEqual([0, 6, 12, 18]);
    expect([...new Set(project.nodes.map((node) => node.y))]).toEqual([0, 3.5, 7, 10.5, 14]);
    expect(project.nodes.filter((node) => node.support === 'fixed').map((node) => node.id)).toEqual(
      [1, 2, 3, 4],
    );
    expect(
      project.nodes.filter((node) => node.y > 0).every((node) => node.support === 'free'),
    ).toBe(true);
    expect(project.members.every((member) => !member.releaseStart && !member.releaseEnd)).toBe(
      true,
    );
  });

  it('connects every floor to the bases through 16 columns and 12 beams', () => {
    const project = threeBayFourStoreyExample();
    const nodes = new Map(project.nodes.map((node) => [node.id, node]));
    const columns = project.members.filter((member) => member.section === 1);
    const beams = project.members.filter((member) => member.section === 2);
    expect(columns).toHaveLength(16);
    expect(beams).toHaveLength(12);
    for (const member of columns) {
      const a = nodes.get(member.start)!;
      const b = nodes.get(member.end)!;
      expect(b.x).toBe(a.x);
      expect(b.y - a.y).toBe(3.5);
    }
    for (const member of beams) {
      const a = nodes.get(member.start)!;
      const b = nodes.get(member.end)!;
      expect(b.y).toBe(a.y);
      expect(b.x - a.x).toBe(6);
    }
    const visited = new Set([1]);
    for (let i = 0; i < project.nodes.length; i++) {
      for (const member of project.members) {
        if (visited.has(member.start)) visited.add(member.end);
        if (visited.has(member.end)) visited.add(member.start);
      }
    }
    expect(visited.size).toBe(20);
    expect(new Set(project.members.map((member) => `${member.start}:${member.end}`)).size).toBe(28);
  });

  it('uses explicit illustrative floor, roof and wind loads with steel self-weight', () => {
    const project = threeBayFourStoreyExample();
    expect(project.selfWeight).toBe(true);
    expect(
      project.nodes.filter((node) => node.fx !== 0).map((node) => [node.x, node.y, node.fx]),
    ).toEqual([
      [0, 3.5, 8],
      [0, 7, 12],
      [0, 10.5, 16],
      [0, 14, 20],
    ]);
    expect(project.nodes.every((node) => node.fy === 0 && node.moment === 0)).toBe(true);
    for (const member of project.members) {
      const start = project.nodes.find((node) => node.id === member.start)!;
      const q = member.section === 1 ? 0 : start.y === 14 ? -7.5 : -10;
      expect(member.qStart).toBe(q);
      expect(member.qEnd).toBe(q);
    }
    expect(project.sections.map((section) => section.area)).toEqual([16320, 8940]);
    for (const section of project.sections) {
      expect(section.elasticModulus).toBe(210000);
      expect(section.density).toBe(7850);
    }
  });

  it('solves 48 free DOFs with global force and moment equilibrium and element compatibility', () => {
    const project = threeBayFourStoreyExample();
    const result = solveFrame(project);
    const expectedMass = (16 * 3.5 * 16320e-6 + 12 * 6 * 8940e-6) * 7850;
    const totalGravity = 18 * (3 * 10 + 7.5) + (expectedMass * 9.81) / 1000;
    expect(result.freeDofs).toBe(48);
    expect(result.nodes).toHaveLength(20);
    expect(result.members).toHaveLength(28);
    near(result.mass, expectedMass);
    near(
      result.nodes.reduce((sum, node) => sum + node.rx, 0),
      -56,
    );
    near(
      result.nodes.reduce((sum, node) => sum + node.ry, 0),
      totalGravity,
    );
    const reactionMoment = result.nodes.reduce((sum, node) => {
      const original = project.nodes.find((item) => item.id === node.id)!;
      return sum + node.reactionMoment + original.x * node.ry - original.y * node.rx;
    }, 0);
    near(reactionMoment, totalGravity * 9 + 8 * 3.5 + 12 * 7 + 16 * 10.5 + 20 * 14);
    for (const node of result.nodes.slice(0, 4)) {
      expect([node.ux, node.uy, node.rotation]).toEqual([0, 0, 0]);
    }
    expect(result.nodes.filter((node) => node.id >= 17).every((node) => node.ux > 0)).toBe(true);
    for (const member of result.members) {
      near(member.stations.at(-1)!.u, member.localDisplacements[3]);
      near(member.stations.at(-1)!.v, member.localDisplacements[4]);
      expect(Number.isFinite(member.maxDisplacement)).toBe(true);
      expect(Number.isFinite(member.maxStress)).toBe(true);
    }
  });

  it('preserves geometric symmetry under gravity-only loading', () => {
    const project = threeBayFourStoreyExample();
    project.nodes.forEach((node) => {
      node.fx = 0;
    });
    const result = solveFrame(project);
    for (let floor = 0; floor <= 4; floor++) {
      for (let column = 0; column < 2; column++) {
        const a = result.nodes[floor * 4 + column];
        const b = result.nodes[floor * 4 + 3 - column];
        near(a.ux, -b.ux);
        near(a.uy, b.uy);
        near(a.rotation, -b.rotation);
        near(a.ry, b.ry);
      }
    }
  });

  it('provides independent editable instances and round-trips the project format', () => {
    const project = threeBayFourStoreyExample();
    const copy = threeBayFourStoreyExample();
    expect(parseProject(serializeProject(project))).toEqual(project);
    project.nodes[0].x = 1;
    project.members[0].releaseStart = true;
    project.sections[0].area = 1;
    expect(copy.nodes[0].x).toBe(0);
    expect(copy.members[0].releaseStart).toBe(false);
    expect(copy.sections[0].area).toBe(16320);
  });

  it('keeps the downloadable JSON model identical to the selectable example', () => {
    const text = readFileSync(
      new URL('../public/examples/three-bay-four-storey.empire.json', import.meta.url),
      'utf8',
    );
    expect(parseProject(text)).toEqual(threeBayFourStoreyExample());
  });
});
