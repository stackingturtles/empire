import { ChevronDown, Circle, FileBox, Layers, Plus, Slash, SquareStack } from 'lucide-react';
import type { Project, Selection } from '../model';

interface Props {
  project: Project;
  selection: Selection;
  onSelect: (selection: Selection) => void;
  onAddNode: () => void;
  onAddMember: () => void;
  onAddSection: () => void;
}
export function Explorer({
  project,
  selection,
  onSelect,
  onAddNode,
  onAddMember,
  onAddSection,
}: Props) {
  function active(kind: 'node' | 'member' | 'section', id: number) {
    return selection.kind === kind && selection.id === id;
  }
  return (
    <aside className="explorer" aria-label="Model explorer">
      <div className="panel-heading">
        <span>MODEL EXPLORER</span>
        <Layers size={15} />
      </div>
      <button
        className={`project-row ${selection.kind === 'project' ? 'active' : ''}`}
        onClick={() => onSelect({ kind: 'project' })}
      >
        <FileBox size={19} />
        <span>
          {project.name}
          <small>2D frame model</small>
        </span>
      </button>
      <div className="explorer-scroll">
        <div className="tree-heading">
          <ChevronDown size={13} />
          <Circle size={14} />
          <b>Nodes</b>
          <span>{project.nodes.length}</span>
          <button aria-label="Add node" onClick={onAddNode} disabled={project.nodes.length >= 150}>
            <Plus size={14} />
          </button>
        </div>
        <div className="tree-items">
          {project.nodes.map((node) => (
            <button
              key={node.id}
              className={`tree-row ${active('node', node.id) ? 'active' : ''}`}
              onClick={() => onSelect({ kind: 'node', id: node.id })}
            >
              <i className={`tree-dot ${node.support !== 'free' ? 'supported' : ''}`} />
              <span>Node {node.id}</span>
              <small>
                {node.x}, {node.y}
              </small>
            </button>
          ))}
          {!project.nodes.length ? <p className="tree-empty">Add a node to get started.</p> : null}
        </div>
        <div className="tree-heading">
          <ChevronDown size={13} />
          <Slash size={15} />
          <b>Members</b>
          <span>{project.members.length}</span>
          <button
            aria-label="Add member"
            onClick={onAddMember}
            disabled={project.nodes.length < 2 || project.members.length >= 300}
          >
            <Plus size={14} />
          </button>
        </div>
        <div className="tree-items">
          {project.members.map((member) => (
            <button
              key={member.id}
              className={`tree-row ${active('member', member.id) ? 'active' : ''}`}
              onClick={() => onSelect({ kind: 'member', id: member.id })}
            >
              <span className="tree-member-icon" aria-hidden="true">
                ╱
              </span>
              <span>Member {member.id}</span>
              <small>
                N{member.start}—N{member.end}
              </small>
            </button>
          ))}
          {!project.members.length ? <p className="tree-empty">Connect two nodes.</p> : null}
        </div>
        <div className="tree-heading">
          <ChevronDown size={13} />
          <SquareStack size={15} />
          <b>Sections</b>
          <span>{project.sections.length}</span>
          <button
            aria-label="Add section"
            onClick={onAddSection}
            disabled={project.sections.length >= 80}
          >
            <Plus size={14} />
          </button>
        </div>
        <div className="tree-items">
          {project.sections.map((section) => (
            <button
              key={section.id}
              className={`tree-row section-row ${active('section', section.id) ? 'active' : ''}`}
              onClick={() => onSelect({ kind: 'section', id: section.id })}
            >
              <span className="section-glyph" aria-hidden="true">
                I
              </span>
              <span>{section.name}</span>
            </button>
          ))}
        </div>
      </div>
      <div className="explorer-footer">
        <span className="local-indicator" />
        <div>
          Made for the browser<small>Your model stays on this device.</small>
        </div>
      </div>
    </aside>
  );
}
