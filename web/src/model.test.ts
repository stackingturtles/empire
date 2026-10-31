import { describe, expect, it } from 'vitest';
import {
  emptyProject,
  historyReducer,
  parseProject,
  portalExample,
  serializeProject,
} from './model';

describe('versioned project persistence', () => {
  it('round trips all project fields', () => {
    const project = portalExample();
    expect(parseProject(serializeProject(project))).toEqual(project);
  });
  it('rejects invalid JSON and legacy formats with useful errors', () => {
    expect(() => parseProject('not-json')).toThrow(/Legacy/);
    expect(() => parseProject('{"version":99}')).toThrow(/Invalid project/);
  });
  it('rejects duplicate identifiers', () => {
    const project = portalExample();
    project.nodes[1].id = project.nodes[0].id;
    expect(() => parseProject(JSON.stringify(project))).toThrow(/Duplicate/);
  });
  it('rejects unknown keys and references, null numbers and oversized files', () => {
    expect(() => parseProject(JSON.stringify({ ...portalExample(), surprise: true }))).toThrow();
    const project = portalExample();
    project.members[0].section = 99;
    expect(() => parseProject(JSON.stringify(project))).toThrow(/missing section/);
    project.nodes[0].x = NaN;
    expect(() => parseProject(JSON.stringify(project))).toThrow();
    expect(() => parseProject(' '.repeat(2_000_001))).toThrow(/too large/);
  });
  it('accepts an empty project with its default section', () => {
    expect(parseProject(serializeProject(emptyProject())).nodes).toEqual([]);
  });
});

describe('edit history', () => {
  it('undoes, redoes, then clears redo on a new edit', () => {
    const first = portalExample();
    const second = { ...first, name: 'Second' };
    let history = { past: [], present: first, future: [] } as Parameters<typeof historyReducer>[0];
    history = historyReducer(history, { type: 'change', project: second });
    history = historyReducer(history, { type: 'undo' });
    expect(history.present).toEqual(first);
    history = historyReducer(history, { type: 'redo' });
    expect(history.present).toEqual(second);
    history = historyReducer(history, { type: 'undo' });
    history = historyReducer(history, { type: 'change', project: emptyProject() });
    expect(history.future).toEqual([]);
  });
  it('limits retained snapshots and resets when replacing a project', () => {
    let state = { past: [], present: portalExample(), future: [] } as Parameters<
      typeof historyReducer
    >[0];
    for (let i = 0; i < 70; i++)
      state = historyReducer(state, {
        type: 'change',
        project: { ...state.present, name: String(i) },
      });
    expect(state.past).toHaveLength(50);
    expect(historyReducer(state, { type: 'replace', project: emptyProject() }).past).toEqual([]);
  });
});
