import { describe, expect, it } from 'vitest';
import {
  beamExample,
  cantileverExample,
  newMember,
  newNode,
  portalExample,
  type Project,
} from './model';
import { solveFrame } from './solver';

const ei = 210000 * 1000 * 3492251e-12;
const ea = 210000 * 1000 * 2123e-6;
function near(actual: number, expected: number): void {
  expect(Math.abs(actual - expected)).toBeLessThan(1e-8 * Math.max(1, Math.abs(expected)));
}

describe('Euler–Bernoulli frame benchmarks', () => {
  it('cantilever tip force: PL³/3EI, PL²/2EI and reactions', () => {
    const result = solveFrame(cantileverExample());
    near(result.nodes[1].uy, (-5 * 3 ** 3) / (3 * ei));
    near(result.nodes[1].rotation, (-5 * 3 ** 2) / (2 * ei));
    near(result.nodes[0].ry, 5);
    near(result.nodes[0].reactionMoment, 15);
    near(result.members[0].stations[0].moment, -15);
    near(result.members[0].stations.at(-1)!.moment, 0);
    near(result.members[0].stations.at(-1)!.v, result.nodes[1].uy);
  });
  it('cantilever nodal moment: ML²/2EI and ML/EI', () => {
    const model = cantileverExample();
    model.nodes[1] = { ...model.nodes[1], fy: 0, moment: 2 };
    const result = solveFrame(model);
    near(result.nodes[1].uy, (2 * 3 ** 2) / (2 * ei));
    near(result.nodes[1].rotation, (2 * 3) / ei);
    near(result.nodes[0].reactionMoment, -2);
  });
  it('axial bar: PL/EA and tensile stress P/A', () => {
    const model = cantileverExample();
    model.nodes[1] = { ...model.nodes[1], fx: 10, fy: 0 };
    const result = solveFrame(model);
    near(result.nodes[1].ux, (10 * 3) / ea);
    near(result.nodes[0].rx, -10);
    near(result.members[0].maxStress, 10000 / 2123);
  });
  it('simply supported UDL: qL/2, qL²/8, 5qL⁴/384EI (including internal deflection)', () => {
    const result = solveFrame(beamExample());
    near(result.nodes[0].ry, 15);
    near(result.nodes[1].ry, 15);
    near(result.members[0].stations[40].moment, (5 * 6 ** 2) / 8);
    near(result.members[0].stations[40].v, (-5 * 5 * 6 ** 4) / (384 * ei));
    near(result.members[0].stations.at(-1)!.v, 0);
    near(result.nodes[0].reactionMoment, 0);
  });
  it('fixed-fixed UDL: zero nodal displacements but nonzero qL⁴/384EI internal deflection', () => {
    const model = beamExample();
    model.nodes.forEach((node) => {
      node.support = 'fixed';
    });
    const result = solveFrame(model);
    near(result.members[0].stations[40].v, (-5 * 6 ** 4) / (384 * ei));
    near(result.nodes[0].reactionMoment, (5 * 6 ** 2) / 12);
    near(result.nodes[1].reactionMoment, (-5 * 6 ** 2) / 12);
    near(result.members[0].stations.at(-1)!.v, 0);
  });
  it('triangular load: qL/6 and qL/3 reactions', () => {
    const model = beamExample();
    model.members[0].qStart = 0;
    model.members[0].qEnd = -9;
    const result = solveFrame(model);
    near(result.nodes[0].ry, 9);
    near(result.nodes[1].ry, 18);
    near(result.members[0].stations.at(-1)!.moment, 0);
    near(result.members[0].stations.at(-1)!.v, 0);
  });
  it('released member ends retain exact simply supported behaviour and recover rotations', () => {
    const model = beamExample();
    model.members[0].releaseStart = true;
    model.members[0].releaseEnd = true;
    const result = solveFrame(model);
    near(result.nodes[0].ry, 15);
    near(result.nodes[1].ry, 15);
    near(result.members[0].endForces[2], 0);
    near(result.members[0].endForces[5], 0);
    near(result.members[0].stations[40].v, (-5 * 5 * 6 ** 4) / (384 * ei));
  });
  it.each([true, false])(
    'single release condensation matches propped cantilever (start release=%s)',
    (releaseStart) => {
      const model = beamExample();
      model.nodes.forEach((node) => {
        node.support = 'fixed';
      });
      model.members[0].releaseStart = releaseStart;
      model.members[0].releaseEnd = !releaseStart;
      const result = solveFrame(model);
      const pinned = releaseStart ? 0 : 1;
      near(result.nodes[pinned].ry, (3 * 5 * 6) / 8);
      near(result.nodes[1 - pinned].ry, (5 * 5 * 6) / 8);
      near(result.members[0].endForces[releaseStart ? 2 : 5], 0);
      near(result.members[0].stations.at(-1)!.v, 0);
    },
  );
  it('load directly on a support is subtracted from the support reaction', () => {
    const model = beamExample();
    model.nodes[0].fx = 12;
    model.nodes[0].fy = -7;
    const result = solveFrame(model);
    near(result.nodes[0].rx, -12);
    near(result.nodes[0].ry, 22);
  });
  it('self weight of a vertical column becomes an axial load', () => {
    const model = cantileverExample();
    model.nodes[1] = { ...model.nodes[1], x: 0, y: 3, fy: 0 };
    model.selfWeight = true;
    const result = solveFrame(model);
    const totalWeight = (2123e-6 * 3 * 7850 * 9.81) / 1000;
    near(result.nodes[0].ry, totalWeight);
    near(result.nodes[1].uy, (-totalWeight * 3) / (2 * ea));
    near(result.members[0].stations.at(-1)!.u, result.nodes[1].uy);
  });
  it('inclined member transforms axial and transverse tip displacements', () => {
    const model = cantileverExample();
    model.nodes[1] = {
      ...model.nodes[1],
      x: 3 / Math.sqrt(2),
      y: 3 / Math.sqrt(2),
      fx: 5 / Math.sqrt(2),
      fy: 5 / Math.sqrt(2),
    };
    const result = solveFrame(model);
    near(result.nodes[1].ux, (5 * 3) / ea / Math.sqrt(2));
    near(result.nodes[1].uy, (5 * 3) / ea / Math.sqrt(2));
  });
  it('portal satisfies global force and moment equilibrium, and end compatibility', () => {
    const model = portalExample();
    const result = solveFrame(model);
    near(
      result.nodes.reduce((sum, node) => sum + node.rx, 0),
      -12,
    );
    near(
      result.nodes.reduce((sum, node) => sum + node.ry, 0),
      48,
    );
    const supportMoment = result.nodes.reduce((sum, node) => {
      const original = model.nodes.find((item) => item.id === node.id)!;
      return sum + node.reactionMoment + node.ry * original.x - node.rx * original.y;
    }, 0);
    near(supportMoment, 12 * 4 + 48 * 3);
    for (const member of result.members) {
      near(member.stations.at(-1)!.v, member.localDisplacements[4]);
      near(member.stations.at(-1)!.u, member.localDisplacements[3]);
    }
  });
  it('two beam elements reproduce midpoint point-load analytical solution', () => {
    const model = beamExample();
    model.nodes.push({ ...newNode(3, 3, 0), fy: -10 });
    model.members = [newMember(1, 1, 3, 1), newMember(2, 3, 2, 1)];
    const result = solveFrame(model);
    near(result.nodes[2].uy, (-10 * 6 ** 3) / (48 * ei));
    near(result.nodes[0].ry, 5);
    near(result.nodes[1].ry, 5);
  });
  it('reversing member orientation with the equivalent local load preserves results', () => {
    const model = beamExample();
    const reference = solveFrame(model);
    model.members[0] = { ...model.members[0], start: 2, end: 1, qStart: 5, qEnd: 5 };
    const result = solveFrame(model);
    near(result.nodes[0].ry, reference.nodes[0].ry);
    near(result.nodes[0].rotation, reference.nodes[0].rotation);
  });
});

describe('invalid and unstable models', () => {
  it('rejects an unsupported frame', () => {
    const model = cantileverExample();
    model.nodes[0].support = 'free';
    expect(() => solveFrame(model)).toThrow(/unstable|unrestrained/);
  });
  it('rejects a hinged cantilever mechanism', () => {
    const model = cantileverExample();
    model.members[0].releaseStart = true;
    expect(() => solveFrame(model)).toThrow(/unstable|unrestrained/);
  });
  it('does not silently discard a moment at a completely released rotation', () => {
    const model = beamExample();
    model.members[0].releaseStart = true;
    model.nodes[0].moment = 3;
    expect(() => solveFrame(model)).toThrow(/rotation/);
  });
  it('rejects a disconnected node even if it has a fixed support', () => {
    const model = cantileverExample();
    model.nodes.push({ ...newNode(3, 7, 0), support: 'fixed' });
    expect(() => solveFrame(model)).toThrow(/disconnected/);
  });
  it('rejects zero-length members, missing references and invalid section properties', () => {
    const model = cantileverExample();
    model.nodes[1].x = 0;
    expect(() => solveFrame(model)).toThrow(/distinct/);
    model.members[0].end = 99;
    expect(() => solveFrame(model)).toThrow(/missing node/);
    model.sections[0].inertia = -1;
    expect(() => solveFrame(model)).toThrow(/inertia/);
  });
  it('rejects non-finite data at the solver boundary', () => {
    const model = cantileverExample();
    model.nodes[1].fy = Infinity;
    expect(() => solveFrame(model as Project)).toThrow();
  });
});
