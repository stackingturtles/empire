import { useEffect, useReducer, useRef, useState } from 'react';
import {
  ArrowUpRight,
  Check,
  ChevronDown,
  CircleHelp,
  CirclePlus,
  Download,
  FilePlus2,
  FolderOpen,
  Hand,
  MousePointer2,
  Play,
  Plus,
  Redo2,
  Save,
  Slash,
  Undo2,
  X,
} from 'lucide-react';
import {
  beamExample,
  cantileverExample,
  emptyProject,
  historyReducer,
  newMember,
  newNode,
  nextId,
  parseProject,
  portalExample,
  serializeProject,
  threeBayFourStoreyExample,
  validateProject,
  type Diagram,
  type Project,
  type Selection,
  type Tool,
} from './model';
import { solveFrame, type AnalysisResult } from './solver';
import { Explorer } from './components/Explorer';
import { Inspector } from './components/Inspector';
import { FrameCanvas } from './components/FrameCanvas';
import { ResultsPanel } from './components/ResultsPanel';

const STORAGE_KEY = 'empire-2d.project.v1';
function loadInitialProject(): { project: Project; error: string | null } {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return { project: saved ? parseProject(saved) : portalExample(), error: null };
  } catch (error) {
    return {
      project: portalExample(),
      error: `Could not restore the local project: ${message(error)} The stored copy will not be overwritten until you make an edit or load a project.`,
    };
  }
}
function message(error: unknown) {
  return error instanceof Error ? error.message : 'An unexpected error occurred.';
}
function download(content: string, filename: string, mime: string) {
  const url = URL.createObjectURL(new Blob([content], { type: mime }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function filename(project: Project) {
  return (
    project.name
      .replace(/[^a-z0-9-_]+/gi, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 80) || 'empire-project'
  );
}

export function App() {
  const [initial] = useState(loadInitialProject);
  const [history, dispatch] = useReducer(historyReducer, {
    past: [],
    present: initial.project,
    future: [],
  });
  const project = history.present;
  const [selection, setSelection] = useState<Selection>({ kind: 'project' });
  const [tool, setTool] = useState<Tool>('select');
  const [pendingNode, setPendingNode] = useState<number | null>(null);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [diagram, setDiagram] = useState<Diagram>('model');
  const [snap, setSnap] = useState(true);
  const [showLabels, setShowLabels] = useState(true);
  const [notice, setNotice] = useState<{ text: string; error: boolean } | null>(
    initial.error ? { text: initial.error, error: true } : null,
  );
  const [hasEdited, setHasEdited] = useState(false);
  const [storageError, setStorageError] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const aboutDialog = useRef<HTMLDialogElement>(null);
  const savedLocally = !storageError && (!initial.error || hasEdited);

  useEffect(() => {
    if (initial.error && !hasEdited) return;
    try {
      localStorage.setItem(STORAGE_KEY, serializeProject(project));
      setStorageError(false);
    } catch {
      setStorageError(true);
    }
  }, [project, initial.error, hasEdited]);

  function notify(text: string, error = false) {
    setNotice({ text, error });
  }
  function invalidate() {
    setResult(null);
    setDiagram('model');
  }
  function change(next: Project) {
    try {
      validateProject(next);
      dispatch({ type: 'change', project: next });
      setHasEdited(true);
      invalidate();
    } catch (error) {
      notify(message(error), true);
    }
  }
  function replace(next: Project) {
    if (
      !window.confirm(
        'Replace the current model? Download a JSON copy first if you want to keep it.',
      )
    )
      return;
    dispatch({ type: 'replace', project: next });
    setHasEdited(true);
    setSelection({ kind: 'project' });
    setPendingNode(null);
    setTool('select');
    invalidate();
    notify('Project loaded. Run analysis to calculate results.');
  }
  function undoRedo(type: 'undo' | 'redo') {
    dispatch({ type });
    setPendingNode(null);
    invalidate();
    setHasEdited(true);
  }
  function chooseTool(next: Tool) {
    setTool(next);
    setPendingNode(null);
  }
  function addNode(x: number, y: number) {
    if (project.nodes.length >= 150) {
      notify('This first web version supports up to 150 nodes.', true);
      return;
    }
    const existing = project.nodes.find((node) => Math.hypot(node.x - x, node.y - y) < 1e-6);
    if (existing) {
      setSelection({ kind: 'node', id: existing.id });
      notify(`A node already exists here (N${existing.id}).`);
      return;
    }
    const id = nextId(project.nodes);
    change({ ...project, nodes: [...project.nodes, newNode(id, x, y)] });
    setSelection({ kind: 'node', id });
  }
  function addNodeFromList() {
    const last = project.nodes.at(-1);
    let x = last ? last.x + 1 : 0;
    const y = last?.y ?? 0;
    while (project.nodes.some((node) => node.x === x && node.y === y)) x++;
    addNode(x, y);
    chooseTool('select');
  }
  function addMember(start: number, end: number) {
    if (project.members.length >= 300) {
      notify('This first web version supports up to 300 members.', true);
      return;
    }
    if (start === end) {
      notify('Choose a different end node.', true);
      return;
    }
    const id = nextId(project.members);
    change({
      ...project,
      members: [...project.members, newMember(id, start, end, project.sections[0].id)],
    });
    setSelection({ kind: 'member', id });
    setPendingNode(null);
  }
  function addMemberFromList() {
    if (project.nodes.length < 2) return;
    // Provides a keyboard-accessible alternative to connecting nodes on the drawing.
    const pairs = project.nodes.flatMap((a, index) =>
      project.nodes.slice(index + 1).map((b) => [a.id, b.id]),
    );
    const pair = pairs.find(
      ([a, b]) =>
        !project.members.some(
          (member) =>
            (member.start === a && member.end === b) || (member.start === b && member.end === a),
        ),
    );
    if (!pair) {
      notify('All node pairs are connected. Select a member to edit its connectivity.');
      return;
    }
    addMember(pair[0], pair[1]);
    chooseTool('select');
  }
  function nodeClick(id: number) {
    if (tool === 'member') {
      if (pendingNode === null) {
        setPendingNode(id);
        setSelection({ kind: 'node', id });
      } else addMember(pendingNode, id);
    } else if (tool !== 'pan') setSelection({ kind: 'node', id });
  }
  function addSection() {
    const id = nextId(project.sections);
    change({
      ...project,
      sections: [...project.sections, { ...project.sections[0], id, name: `Custom section ${id}` }],
    });
    setSelection({ kind: 'section', id });
  }
  function deleteSelection() {
    if (selection.kind === 'project') return;
    if (selection.kind === 'node') {
      if (
        project.members.some(
          (member) => member.start === selection.id || member.end === selection.id,
        )
      ) {
        notify('Delete or reconnect attached members before deleting this node.', true);
        return;
      }
      change({ ...project, nodes: project.nodes.filter((node) => node.id !== selection.id) });
    } else if (selection.kind === 'member')
      change({
        ...project,
        members: project.members.filter((member) => member.id !== selection.id),
      });
    else {
      if (project.sections.length === 1) {
        notify('Keep at least one section in the project.', true);
        return;
      }
      if (project.members.some((member) => member.section === selection.id)) {
        notify('Reassign members before deleting their section.', true);
        return;
      }
      change({
        ...project,
        sections: project.sections.filter((section) => section.id !== selection.id),
      });
    }
    setSelection({ kind: 'project' });
    setPendingNode(null);
  }
  function analyse() {
    try {
      const solved = solveFrame(project);
      setResult(solved);
      setDiagram('displacement');
      chooseTool('select');
      notify(
        solved.warnings.length
          ? solved.warnings.join(' ')
          : 'Analysis complete. Results are experimental and are not design-code checks.',
        solved.warnings.length > 0,
      );
    } catch (error) {
      invalidate();
      notify(message(error), true);
    }
  }
  function exportProject() {
    download(serializeProject(project), `${filename(project)}.empire.json`, 'application/json');
    notify('JSON copy downloaded. Keep this file as a portable backup.');
  }
  function exportResults() {
    if (!result) return;
    const rows: (string | number)[][] = [
      ['EXPERIMENTAL EMPIRE 2D WEB - NOT FOR ENGINEERING DESIGN'],
      ['Node', 'ux [mm]', 'uy [mm]', 'rotation [degrees]', 'Rx [kN]', 'Ry [kN]', 'M [kN m]'],
      ...result.nodes.map((node) => [
        node.id,
        node.ux * 1000,
        node.uy * 1000,
        (node.rotation * 180) / Math.PI,
        node.rx,
        node.ry,
        node.reactionMoment,
      ]),
      [],
      [
        'Member',
        'x [m]',
        'N [kN]',
        'V [kN]',
        'M [kN m]',
        'u local [mm]',
        'v local [mm]',
        'normal stress bound [MPa]',
      ],
      ...result.members.flatMap((member) =>
        member.stations.map((station) => [
          member.id,
          station.x,
          station.axial,
          station.shear,
          station.moment,
          station.u * 1000,
          station.v * 1000,
          station.stress,
        ]),
      ),
    ];
    download(
      rows
        .map((row) => row.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(','))
        .join('\r\n'),
      `${filename(project)}-results.csv`,
      'text/csv',
    );
  }
  async function importFile(file?: File) {
    if (!file) return;
    try {
      if (file.size > 2_000_000) throw new Error('Project file is too large (maximum 2 MB).');
      const loaded = parseProject(await file.text());
      replace(loaded);
    } catch (error) {
      notify(message(error), true);
    } finally {
      if (fileInput.current) fileInput.current.value = '';
    }
  }
  const toolHint =
    tool === 'node'
      ? `Click the drawing to place a node${snap ? ' · 0.5 m snap' : ''}`
      : tool === 'member'
        ? pendingNode === null
          ? 'Select the start node of the new member'
          : `Start: N${pendingNode} · select an end node`
        : tool === 'pan'
          ? 'Drag the drawing to pan · use Fit model to reset'
          : 'Select a node or member to edit its properties';

  return (
    <div className="app-shell">
      <header className="app-header">
        <a
          className="brand"
          href="#"
          onClick={(event) => {
            event.preventDefault();
            setSelection({ kind: 'project' });
          }}
          title="Empire 2D home"
        >
          <span className="brand-symbol">
            <i />
            <i />
            <i />
          </span>
          <span>
            EMPIRE<span className="brand-2d">2D</span>
            <small>STRUCTURAL WORKSPACE</small>
          </span>
        </a>
        <div className="header-divider" />
        <div className="header-project">
          <span>{project.name}</span>
          <small>
            <span className={`status-dot ${savedLocally ? 'green' : ''}`} />
            {savedLocally ? 'Saved on this device' : 'Local save unavailable · download a copy'}
          </small>
        </div>
        <div className="header-actions">
          <button className="button quiet" onClick={() => fileInput.current?.click()}>
            <FolderOpen size={16} />
            <span>Open</span>
          </button>
          <button className="button quiet" onClick={exportProject}>
            <Save size={16} />
            <span>Save copy</span>
          </button>
          <button
            className="icon-button help-button"
            aria-label="About and instructions"
            onClick={() => aboutDialog.current?.showModal()}
          >
            <CircleHelp size={19} />
          </button>
          <button className="button primary" onClick={analyse}>
            <Play size={14} fill="currentColor" />
            Analyse
            <span className="analyse-arrow">
              <ArrowUpRight size={16} />
            </span>
          </button>
        </div>
        <input
          ref={fileInput}
          type="file"
          accept=".json,application/json"
          hidden
          aria-label="Open project file"
          onChange={(event) => {
            void importFile(event.target.files?.[0]);
          }}
        />
      </header>
      <section className="migration-notice" aria-label="Rebuild status">
        <span className="preview-label">WEB PREVIEW</span>
        <span>
          Rebuilt from the original Delphi source. Experimental calculations — not yet validated for
          engineering design.
        </span>
        <button onClick={() => aboutDialog.current?.showModal()}>
          About this rebuild <ArrowUpRight size={12} />
        </button>
      </section>
      <nav className="workspace-toolbar" aria-label="Workspace controls">
        <div className="workspace-tab">
          <span className="tab-model-icon">⌑</span>Model workspace
          <span className="tab-dot" />
        </div>
        <div className="toolbar-actions">
          <button
            className="icon-button"
            aria-label="Undo"
            disabled={!history.past.length}
            onClick={() => undoRedo('undo')}
          >
            <Undo2 size={16} />
          </button>
          <button
            className="icon-button"
            aria-label="Redo"
            disabled={!history.future.length}
            onClick={() => undoRedo('redo')}
          >
            <Redo2 size={16} />
          </button>
          <span className="toolbar-separator" />
          <details className="dropdown">
            <summary>
              Examples
              <ChevronDown size={13} />
            </summary>
            <div className="dropdown-menu">
              <button
                onClick={(event) => {
                  replace(portalExample());
                  event.currentTarget.closest('details')?.removeAttribute('open');
                }}
              >
                Portal frame <small>6 × 4 m</small>
              </button>
              <button
                onClick={(event) => {
                  replace(threeBayFourStoreyExample());
                  event.currentTarget.closest('details')?.removeAttribute('open');
                }}
              >
                Three-bay, four-storey frame
              </button>
              <button
                onClick={(event) => {
                  replace(beamExample());
                  event.currentTarget.closest('details')?.removeAttribute('open');
                }}
              >
                Simply supported beam
              </button>
              <button
                onClick={(event) => {
                  replace(cantileverExample());
                  event.currentTarget.closest('details')?.removeAttribute('open');
                }}
              >
                Cantilever beam
              </button>
              <button
                onClick={(event) => {
                  replace(emptyProject());
                  event.currentTarget.closest('details')?.removeAttribute('open');
                }}
              >
                <FilePlus2 size={14} />
                Blank project
              </button>
            </div>
          </details>
          <details className="dropdown">
            <summary>
              <Download size={14} />
              Export
              <ChevronDown size={13} />
            </summary>
            <div className="dropdown-menu right">
              <button
                onClick={(event) => {
                  exportProject();
                  event.currentTarget.closest('details')?.removeAttribute('open');
                }}
              >
                Project JSON
              </button>
              <button
                disabled={!result}
                onClick={(event) => {
                  exportResults();
                  event.currentTarget.closest('details')?.removeAttribute('open');
                }}
              >
                Results CSV
              </button>
              <button disabled={!result} onClick={() => window.print()}>
                Print / save PDF
              </button>
            </div>
          </details>
        </div>
      </nav>
      <div className="workspace">
        <nav className="tool-rail" aria-label="Drawing tools">
          {(
            [
              ['select', MousePointer2, 'Select objects'],
              ['node', CirclePlus, 'Place node'],
              ['member', Slash, 'Connect nodes'],
              ['pan', Hand, 'Pan drawing'],
            ] as const
          ).map(([value, Icon, label]) => (
            <button
              key={value}
              className={tool === value ? 'active' : ''}
              aria-label={label}
              title={label}
              aria-pressed={tool === value}
              onClick={() => chooseTool(value)}
            >
              <Icon size={19} />
            </button>
          ))}
          <span className="rail-divider" />
          <button
            aria-label="Add custom section"
            title="Add custom section"
            disabled={project.sections.length >= 80}
            onClick={addSection}
          >
            <span className="section-tool">I</span>
          </button>
          <div className="rail-bottom">2D</div>
        </nav>
        <Explorer
          project={project}
          selection={selection}
          onSelect={(value) => {
            setSelection(value);
            chooseTool('select');
          }}
          onAddNode={addNodeFromList}
          onAddMember={addMemberFromList}
          onAddSection={addSection}
        />
        <main className="main-workspace">
          <div className="view-toolbar">
            <div className="view-tabs" aria-label="Diagram views">
              {(['model', 'displacement', 'moment', 'shear', 'axial'] as const).map((value) => (
                <button
                  key={value}
                  disabled={value !== 'model' && !result}
                  className={diagram === value ? 'active' : ''}
                  onClick={() => setDiagram(value)}
                >
                  {value === 'model'
                    ? 'Model'
                    : value === 'displacement'
                      ? 'Deformation'
                      : value[0].toUpperCase() + value.slice(1)}
                </button>
              ))}
            </div>
            <span className="view-unit">kN · m</span>
          </div>
          <FrameCanvas
            key={project.name}
            project={project}
            selection={selection}
            tool={tool}
            diagram={diagram}
            result={result}
            pendingNode={pendingNode}
            onSelect={setSelection}
            onNodeClick={nodeClick}
            onAddNode={addNode}
            snap={snap}
            showLabels={showLabels}
          />
          <div className="drawing-status">
            <span>
              <MousePointer2 size={12} />
              {toolHint}
            </span>
            <div>
              <label>
                <input
                  type="checkbox"
                  checked={snap}
                  onChange={(event) => setSnap(event.target.checked)}
                />
                Snap 0.5 m
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={showLabels}
                  onChange={(event) => setShowLabels(event.target.checked)}
                />
                Labels
              </label>
            </div>
          </div>
          <ResultsPanel project={project} result={result} onExport={exportResults} />
        </main>
        <Inspector
          project={project}
          selection={selection}
          result={result}
          onChange={change}
          onDelete={deleteSelection}
        />
      </div>
      <footer className="app-footer">
        <span>
          <span className={`status-dot ${result ? 'green' : ''}`} />
          {storageError
            ? 'Autosave unavailable · download a copy'
            : result
              ? 'Analysis complete · linear elastic'
              : 'Ready to model'}
        </span>
        <span>
          {project.nodes.length} nodes<span className="footer-separator">/</span>
          {project.members.length} members<span className="footer-separator">/</span>
          {project.sections.length} sections
        </span>
        <span>
          EMPIRE 2D<span className="footer-version">WEB v0.1</span>
        </span>
      </footer>
      {notice ? (
        <div
          className={`toast ${notice.error ? 'error' : ''}`}
          role={notice.error ? 'alert' : 'status'}
        >
          <span>{notice.error ? <CircleHelp size={18} /> : <Check size={18} />}</span>
          <p>{notice.text}</p>
          <button aria-label="Dismiss notification" onClick={() => setNotice(null)}>
            <X size={16} />
          </button>
        </div>
      ) : null}
      <dialog ref={aboutDialog} className="about-dialog" aria-labelledby="about-title">
        <div className="dialog-header">
          <span className="eyebrow">A NEW HOME FOR A CLASSIC TOOL</span>
          <button
            className="icon-button"
            aria-label="Close help"
            onClick={() => aboutDialog.current?.close()}
          >
            <X size={20} />
          </button>
        </div>
        <h2 id="about-title">Empire 2D, rebuilt for the web.</h2>
        <p>
          A source-based reimplementation of the Delphi frame-analysis application found in this
          folder. The Windows binaries have not been run for comparison.
        </p>
        <div className="dialog-warning">
          <b>Experimental. Not for engineering design.</b>
          <p>
            Analytical regression tests cover core beam and frame mechanics, not full equivalence to
            the original program. No buckling, yielding, code compliance, second-order effects, or
            shear deformation checks are performed. Member peaks are sampled.
          </p>
        </div>
        <h3>Start modelling</h3>
        <ol>
          <li>
            Choose an example, or open a blank project from <b>Examples</b>.
          </li>
          <li>
            Add nodes with the drawing tool or the <Plus size={12} /> in Model explorer. Edit
            coordinates, supports and nodal loads in Properties.
          </li>
          <li>
            Connect nodes with the member tool, then assign sections, end releases and distributed
            loads. Explorer’s add-member button also creates connections without using the drawing.
          </li>
          <li>
            Choose <b>Analyse</b>, inspect diagrams and numerical results, then export CSV or print
            a report.
          </li>
        </ol>
        <h3>Local by design</h3>
        <p>
          Models autosave in this browser when storage is available. Save a JSON copy for a portable
          backup. Files use a versioned web format; original binary .EL2 projects are not supported
          yet. There are no accounts or cloud uploads.
        </p>
        <h3>What comes next</h3>
        <p>
          Original-executable validation, legacy project import, section database recovery, member
          point loads, settlements, load factors, buckling checks, DXF export and translations. See{' '}
          <code>docs/legacy-analysis.md</code> for the migration map.
        </p>
        <button className="button primary" onClick={() => aboutDialog.current?.close()}>
          Back to workspace <ArrowUpRight size={16} />
        </button>
      </dialog>
    </div>
  );
}
