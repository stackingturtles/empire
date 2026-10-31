import { ArrowDownRight, CircleDot, Info, Trash2 } from 'lucide-react';
import {
  SUPPORT_LABELS,
  type FrameNode,
  type Member,
  type Project,
  type Section,
  type Selection,
  type Support,
} from '../model';
import type { AnalysisResult } from '../solver';

interface NumericFieldProps {
  label: string;
  value: number;
  unit?: string;
  positive?: boolean;
  onCommit: (value: number) => void;
}
function NumericField({ label, value, unit, positive, onCommit }: NumericFieldProps) {
  return (
    <label className="field">
      <span>{label}</span>
      <div className="input-unit">
        <input
          key={value}
          type="number"
          aria-label={label}
          step="any"
          defaultValue={value}
          min={positive ? 0.00000001 : undefined}
          onKeyDown={(event) => {
            if (event.key === 'Enter') event.currentTarget.blur();
          }}
          onBlur={(event) => {
            const next = event.currentTarget.valueAsNumber;
            if (!Number.isFinite(next) || (positive && next <= 0)) {
              event.currentTarget.value = String(value);
              return;
            }
            event.currentTarget.value = String(value);
            if (next !== value) onCommit(next);
          }}
        />
        {unit ? <span>{unit}</span> : null}
      </div>
    </label>
  );
}
function TextField({
  label,
  value,
  required,
  onCommit,
}: {
  label: string;
  value: string;
  required?: boolean;
  onCommit: (value: string) => void;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      <input
        key={value}
        defaultValue={value}
        aria-label={label}
        maxLength={120}
        onKeyDown={(event) => {
          if (event.key === 'Enter') event.currentTarget.blur();
        }}
        onBlur={(event) => {
          const text = event.currentTarget.value.trim();
          if (required && !text) {
            event.currentTarget.value = value;
            return;
          }
          event.currentTarget.value = value;
          if (text !== value) onCommit(text);
        }}
      />
    </label>
  );
}
function Subheading({ children }: { children: React.ReactNode }) {
  return <h3 className="inspector-subheading">{children}</h3>;
}
function Readout({ label, value, unit }: { label: string; value: number; unit: string }) {
  return (
    <div className="readout">
      <span>{label}</span>
      <b>
        {Math.abs(value) < 1e-8 ? '0.000' : value.toFixed(3)} <small>{unit}</small>
      </b>
    </div>
  );
}

interface Props {
  project: Project;
  selection: Selection;
  result: AnalysisResult | null;
  onChange: (project: Project) => void;
  onDelete: () => void;
}
export function Inspector({ project, selection, result, onChange, onDelete }: Props) {
  const node =
    selection.kind === 'node' ? project.nodes.find((item) => item.id === selection.id) : undefined;
  const member =
    selection.kind === 'member'
      ? project.members.find((item) => item.id === selection.id)
      : undefined;
  const section =
    selection.kind === 'section'
      ? project.sections.find((item) => item.id === selection.id)
      : undefined;
  const nodeResult = node ? result?.nodes.find((item) => item.id === node.id) : undefined;
  const memberResult = member ? result?.members.find((item) => item.id === member.id) : undefined;
  function updateNode(patch: Partial<FrameNode>) {
    onChange({
      ...project,
      nodes: project.nodes.map((item) => (item.id === node?.id ? { ...item, ...patch } : item)),
    });
  }
  function updateMember(patch: Partial<Member>) {
    onChange({
      ...project,
      members: project.members.map((item) =>
        item.id === member?.id ? { ...item, ...patch } : item,
      ),
    });
  }
  function updateSection(patch: Partial<Section>) {
    onChange({
      ...project,
      sections: project.sections.map((item) =>
        item.id === section?.id ? { ...item, ...patch } : item,
      ),
    });
  }
  const title = node
    ? `Node ${node.id}`
    : member
      ? `Member ${member.id}`
      : section
        ? 'Section properties'
        : 'Project properties';
  return (
    <aside className="inspector" aria-label="Properties inspector">
      <div className="panel-heading">
        <span>PROPERTIES</span>
        <CircleDot size={15} />
      </div>
      <div className="inspector-body">
        <div className="selection-heading">
          <div className="selection-icon">
            <ArrowDownRight size={20} />
          </div>
          <div>
            <h2>{title}</h2>
            <span>
              {node
                ? 'Junction & boundary conditions'
                : member
                  ? 'Prismatic frame element'
                  : section
                    ? 'In-plane bending properties'
                    : 'Model information'}
            </span>
          </div>
        </div>
        {node ? (
          <>
            <Subheading>POSITION</Subheading>
            <div className="field-pair">
              <NumericField
                label="X coordinate"
                value={node.x}
                unit="m"
                onCommit={(x) => updateNode({ x })}
              />
              <NumericField
                label="Y coordinate"
                value={node.y}
                unit="m"
                onCommit={(y) => updateNode({ y })}
              />
            </div>
            <Subheading>BOUNDARY CONDITION</Subheading>
            <label className="field">
              <span>Support</span>
              <select
                aria-label="Support"
                value={node.support}
                onChange={(event) => updateNode({ support: event.target.value as Support })}
              >
                {Object.entries(SUPPORT_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <Subheading>NODAL LOADS</Subheading>
            <NumericField
              label="Horizontal force"
              value={node.fx}
              unit="kN"
              onCommit={(fx) => updateNode({ fx })}
            />
            <NumericField
              label="Vertical force"
              value={node.fy}
              unit="kN"
              onCommit={(fy) => updateNode({ fy })}
            />
            <NumericField
              label="Applied moment"
              value={node.moment}
              unit="kN·m"
              onCommit={(moment) => updateNode({ moment })}
            />
            <p className="field-note">
              +X right · +Y up
              <br />
              Positive moment is counterclockwise.
            </p>
            {nodeResult ? (
              <>
                <Subheading>ANALYSIS RESULTS</Subheading>
                <Readout label="X displacement" value={nodeResult.ux * 1000} unit="mm" />
                <Readout label="Y displacement" value={nodeResult.uy * 1000} unit="mm" />
                <Readout label="Rotation" value={(nodeResult.rotation * 180) / Math.PI} unit="°" />
                <Readout label="Reaction X" value={nodeResult.rx} unit="kN" />
                <Readout label="Reaction Y" value={nodeResult.ry} unit="kN" />
                <Readout label="Reaction moment" value={nodeResult.reactionMoment} unit="kN·m" />
              </>
            ) : null}
          </>
        ) : member ? (
          <>
            <Subheading>CONNECTIVITY</Subheading>
            <div className="field-pair">
              {(['start', 'end'] as const).map((end) => (
                <label className="field" key={end}>
                  <span>{end === 'start' ? 'Start node' : 'End node'}</span>
                  <select
                    aria-label={end === 'start' ? 'Start node' : 'End node'}
                    value={member[end]}
                    onChange={(event) => updateMember({ [end]: Number(event.target.value) })}
                  >
                    {project.nodes.map((item) => (
                      <option key={item.id} value={item.id}>
                        N{item.id}
                      </option>
                    ))}
                  </select>
                </label>
              ))}
            </div>
            <Subheading>SECTION</Subheading>
            <label className="field">
              <span>Assigned section</span>
              <select
                aria-label="Assigned section"
                value={member.section}
                onChange={(event) => updateMember({ section: Number(event.target.value) })}
              >
                {project.sections.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </label>
            <Subheading>END RELEASES</Subheading>
            <label className="check-field">
              <input
                type="checkbox"
                checked={member.releaseStart}
                onChange={(event) => updateMember({ releaseStart: event.target.checked })}
              />
              Hinge at start
            </label>
            <label className="check-field">
              <input
                type="checkbox"
                checked={member.releaseEnd}
                onChange={(event) => updateMember({ releaseEnd: event.target.checked })}
              />
              Hinge at end
            </label>
            <Subheading>DISTRIBUTED LOAD</Subheading>
            <NumericField
              label="Load at start"
              value={member.qStart}
              unit="kN/m"
              onCommit={(qStart) => updateMember({ qStart })}
            />
            <NumericField
              label="Load at end"
              value={member.qEnd}
              unit="kN/m"
              onCommit={(qEnd) => updateMember({ qEnd })}
            />
            <p className="field-note">
              Linear variation. Positive acts in local +Y: 90° counterclockwise from start → end. A
              negative load acts downward on a left-to-right beam.
            </p>
            {memberResult ? (
              <>
                <Subheading>ANALYSIS RESULTS</Subheading>
                <Readout label="Member length" value={memberResult.length} unit="m" />
                <Readout
                  label="Peak displacement ≈"
                  value={memberResult.maxDisplacement * 1000}
                  unit="mm"
                />
                <Readout label="Peak normal stress ≈" value={memberResult.maxStress} unit="MPa" />
              </>
            ) : null}
          </>
        ) : section ? (
          <>
            <Subheading>IDENTIFICATION</Subheading>
            <TextField
              label="Section name"
              value={section.name}
              required
              onCommit={(name) => updateSection({ name })}
            />
            <Subheading>CROSS-SECTION</Subheading>
            <NumericField
              label="Area A"
              value={section.area}
              positive
              unit="mm²"
              onCommit={(area) => updateSection({ area })}
            />
            <NumericField
              label="Second moment I"
              value={section.inertia}
              positive
              unit="mm⁴"
              onCommit={(inertia) => updateSection({ inertia })}
            />
            <NumericField
              label="Section modulus W"
              value={section.modulus}
              positive
              unit="mm³"
              onCommit={(modulus) => updateSection({ modulus })}
            />
            <Subheading>MATERIAL</Subheading>
            <NumericField
              label="Elastic modulus E"
              value={section.elasticModulus}
              positive
              unit="MPa"
              onCommit={(elasticModulus) => updateSection({ elasticModulus })}
            />
            <NumericField
              label="Density"
              value={section.density}
              unit="kg/m³"
              onCommit={(density) => updateSection({ density })}
            />
            <p className="field-note">
              I and W refer to the bending axis in the model plane. Section properties are
              user-defined; this is not a certified section catalogue.
            </p>
          </>
        ) : (
          <>
            <Subheading>GENERAL</Subheading>
            <TextField
              label="Project name"
              value={project.name}
              required
              onCommit={(name) => onChange({ ...project, name })}
            />
            <TextField
              label="Engineer"
              value={project.engineer}
              onCommit={(engineer) => onChange({ ...project, engineer })}
            />
            <label className="field">
              <span>Description</span>
              <textarea
                key={project.description}
                aria-label="Description"
                defaultValue={project.description}
                rows={4}
                maxLength={2000}
                onBlur={(event) => {
                  if (event.target.value !== project.description)
                    onChange({ ...project, description: event.target.value });
                }}
              />
            </label>
            <Subheading>ANALYSIS SETTINGS</Subheading>
            <label className="check-field">
              <input
                type="checkbox"
                checked={project.selfWeight}
                onChange={(event) => onChange({ ...project, selfWeight: event.target.checked })}
              />
              Include self-weight
            </label>
            <p className="field-note">
              Gravity: 9.81 m/s² in global −Y.
              <br />
              Linear static · Euler–Bernoulli
              <br />
              One load case · rigid joints by default
            </p>
            <Subheading>MODEL UNITS</Subheading>
            <div className="unit-list">
              <span>
                Geometry <b>m</b>
              </span>
              <span>
                Forces <b>kN</b>
              </span>
              <span>
                Moments <b>kN·m</b>
              </span>
              <span>
                Displacements <b>mm</b>
              </span>
              <span>
                Stress <b>MPa</b>
              </span>
            </div>
          </>
        )}
        {node || member || section ? (
          <button className="delete-button" onClick={onDelete}>
            <Trash2 size={14} />
            Delete {node ? 'node' : member ? 'member' : 'section'}
          </button>
        ) : null}
      </div>
      <div className="inspector-note">
        <Info size={16} />
        <span>
          Changes clear previous results.
          <br />
          Run analysis to recalculate.
        </span>
      </div>
    </aside>
  );
}
