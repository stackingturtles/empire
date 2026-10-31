import { useState } from 'react';
import { ArrowDownToLine, Check, ChevronDown } from 'lucide-react';
import { SUPPORT_LABELS, type Project } from '../model';
import type { AnalysisResult } from '../solver';

function num(value: number, digits = 3) {
  return Math.abs(value) < 10 ** -digits / 2 ? (0).toFixed(digits) : value.toFixed(digits);
}
export function ResultsPanel({
  project,
  result,
  onExport,
}: {
  project: Project;
  result: AnalysisResult | null;
  onExport: () => void;
}) {
  const [tab, setTab] = useState<'displacements' | 'reactions' | 'members'>('displacements');
  const [collapsed, setCollapsed] = useState(false);
  return (
    <section
      className={`results-panel ${collapsed ? 'collapsed' : ''}`}
      aria-label="Analysis results"
    >
      <div className="results-heading">
        <div>
          <span className="panel-title">Analysis results</span>
          {result ? (
            <span className="result-badge">
              <Check size={12} />
              Solved · {result.freeDofs} free DOFs
            </span>
          ) : (
            <span className="muted">Run an analysis to see results</span>
          )}
        </div>
        <div className="inline-actions">
          <button
            className="icon-button"
            aria-label="Export results CSV"
            disabled={!result}
            onClick={onExport}
          >
            <ArrowDownToLine size={16} />
          </button>
          <button
            className="icon-button"
            aria-label={collapsed ? 'Expand results' : 'Collapse results'}
            onClick={() => setCollapsed((value) => !value)}
          >
            <ChevronDown
              size={17}
              style={{ transform: collapsed ? 'rotate(180deg)' : undefined }}
            />
          </button>
        </div>
      </div>
      {!collapsed ? (
        result ? (
          <>
            <div className="result-tabs">
              {(['displacements', 'reactions', 'members'] as const).map((value) => (
                <button
                  key={value}
                  className={tab === value ? 'active' : ''}
                  onClick={() => setTab(value)}
                >
                  {value[0].toUpperCase() + value.slice(1)}
                </button>
              ))}
              <span>Global X → · Y ↑ · CCW +</span>
            </div>
            {result.warnings.map((warning) => (
              <p className="analysis-warning" key={warning}>
                {warning}
              </p>
            ))}
            <div
              className="result-table-wrap"
              tabIndex={0}
              role="region"
              aria-label="Numerical results table"
            >
              <table>
                <thead>
                  <tr>
                    {(tab === 'displacements'
                      ? ['Node', 'Support', 'ΔX [mm]', 'ΔY [mm]', 'Rotation [°]']
                      : tab === 'reactions'
                        ? ['Node', 'Support', 'RX [kN]', 'RY [kN]', 'M [kN·m]']
                        : [
                            'Member',
                            'Length [m]',
                            '|N|max ≈ [kN]',
                            '|V|max ≈ [kN]',
                            '|M|max ≈ [kN·m]',
                            'δmax ≈ [mm]',
                            'σmax ≈ [MPa]',
                          ]
                    ).map((label) => (
                      <th key={label}>{label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {tab === 'members'
                    ? result.members.map((member) => (
                        <tr key={member.id}>
                          <td>
                            <b>M{member.id}</b>
                          </td>
                          <td>{num(member.length)}</td>
                          <td>
                            {num(Math.max(...member.stations.map((item) => Math.abs(item.axial))))}
                          </td>
                          <td>
                            {num(Math.max(...member.stations.map((item) => Math.abs(item.shear))))}
                          </td>
                          <td>
                            {num(Math.max(...member.stations.map((item) => Math.abs(item.moment))))}
                          </td>
                          <td>{num(member.maxDisplacement * 1000)}</td>
                          <td>{num(member.maxStress)}</td>
                        </tr>
                      ))
                    : result.nodes
                        .filter(
                          (node) =>
                            tab !== 'reactions' ||
                            project.nodes.find((item) => item.id === node.id)?.support !== 'free',
                        )
                        .map((node) => (
                          <tr key={node.id}>
                            <td>
                              <b>N{node.id}</b>
                            </td>
                            <td>
                              {
                                SUPPORT_LABELS[
                                  project.nodes.find((item) => item.id === node.id)!.support
                                ]
                              }
                            </td>
                            {(tab === 'displacements'
                              ? [node.ux * 1000, node.uy * 1000, (node.rotation * 180) / Math.PI]
                              : [node.rx, node.ry, node.reactionMoment]
                            ).map((value, index) => (
                              <td key={index}>{num(value)}</td>
                            ))}
                          </tr>
                        ))}
                </tbody>
              </table>
            </div>
            <p className="results-footnote">
              Member peaks are sampled at 81 stations. Normal stress = |N|/A + |M|/W; not a capacity
              or buckling check.
            </p>
          </>
        ) : (
          <div className="results-empty">
            <div className="empty-chart">
              <span />
              <span />
              <span />
              <span />
              <span />
            </div>
            <div>
              <b>Your model, in numbers.</b>
              <p>Analyse the frame to inspect displacements, reactions and member forces.</p>
            </div>
            <kbd>Analyse ↗</kbd>
          </div>
        )
      ) : null}
      <div className="print-tables">
        {result ? (
          <>
            <h2>{project.name} — experimental analysis</h2>
            <p>{project.description}</p>
            <p>
              Linear elastic, small-displacement 2D frame. Not validated against the original
              executable. Not for engineering design. Member peaks are sampled.
            </p>
            <table>
              <thead>
                <tr>
                  <th>Node</th>
                  <th>ux [mm]</th>
                  <th>uy [mm]</th>
                  <th>Rotation [°]</th>
                  <th>Rx [kN]</th>
                  <th>Ry [kN]</th>
                  <th>M [kN·m]</th>
                </tr>
              </thead>
              <tbody>
                {result.nodes.map((node) => (
                  <tr key={node.id}>
                    <td>{node.id}</td>
                    {[
                      node.ux * 1000,
                      node.uy * 1000,
                      (node.rotation * 180) / Math.PI,
                      node.rx,
                      node.ry,
                      node.reactionMoment,
                    ].map((v, i) => (
                      <td key={i}>{num(v)}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            <h3>Sampled member peaks</h3>
            <table>
              <thead>
                <tr>
                  <th>Member</th>
                  <th>δmax [mm]</th>
                  <th>σmax [MPa]</th>
                </tr>
              </thead>
              <tbody>
                {result.members.map((member) => (
                  <tr key={member.id}>
                    <td>{member.id}</td>
                    <td>{num(member.maxDisplacement * 1000)}</td>
                    <td>{num(member.maxStress)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {result.warnings.map((warning) => (
              <p key={warning}>{warning}</p>
            ))}
          </>
        ) : null}
      </div>
    </section>
  );
}
