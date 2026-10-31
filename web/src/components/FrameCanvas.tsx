import { useRef, useState } from 'react';
import { Maximize, Minus, Plus } from 'lucide-react';
import type { Diagram, FrameNode, Project, Selection, Tool } from '../model';
import type { AnalysisResult } from '../solver';

interface Props {
  project: Project;
  selection: Selection;
  tool: Tool;
  diagram: Diagram;
  result: AnalysisResult | null;
  pendingNode: number | null;
  onSelect: (selection: Selection) => void;
  onNodeClick: (id: number) => void;
  onAddNode: (x: number, y: number) => void;
  snap: boolean;
  showLabels: boolean;
}
const f = (value: number) => (Math.abs(value) < 1e-7 ? '0' : Number(value.toFixed(2)).toString());
function SupportSymbol({ node, x, y }: { node: FrameNode; x: number; y: number }) {
  if (node.support === 'free') return null;
  if (node.support === 'fixed')
    return (
      <g className="support-symbol" transform={`translate(${x} ${y})`}>
        <path d="M-17 7H17 M-14 7l-7 10 M-5 7l-7 10 M4 7l-7 10 M13 7l-7 10 M22 7l-7 10" />
        <path d="M0 0V7" />
      </g>
    );
  return (
    <g
      className="support-symbol"
      transform={`translate(${x} ${y})${node.support === 'roller-x' ? ' rotate(-90)' : ''}`}
    >
      <path d="M0 5l-13 20h26Z" fill="#f8fafc" />
      {node.support.startsWith('roller') ? (
        <>
          <circle cx="-7" cy="29" r="3" />
          <circle cx="7" cy="29" r="3" />
          <path d="M-18 34H18" />
        </>
      ) : (
        <path d="M-18 28H18 M-13 28l-5 6 M-3 28l-5 6 M7 28l-5 6 M17 28l-5 6" />
      )}
    </g>
  );
}
export function FrameCanvas({
  project,
  selection,
  tool,
  diagram,
  result,
  pendingNode,
  onSelect,
  onNodeClick,
  onAddNode,
  snap,
  showLabels,
}: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const drag = useRef<{ x: number; y: number; originalX: number; originalY: number } | null>(null);
  const xs = project.nodes.map((node) => node.x);
  const ys = project.nodes.map((node) => node.y);
  const minX = xs.length ? Math.min(...xs) : 0;
  const maxX = xs.length ? Math.max(...xs) : 6;
  const minY = ys.length ? Math.min(...ys) : 0;
  const maxY = ys.length ? Math.max(...ys) : 4;
  const spanX = Math.max(maxX - minX, 2);
  const spanY = Math.max(maxY - minY, 2);
  const scale = Math.min(700 / spanX, 340 / spanY) * zoom;
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  const point = (x: number, y: number) => ({
    x: 500 + (x - cx) * scale + pan.x,
    y: 355 - (y - cy) * scale + pan.y,
  });
  const origin = point(0, 0);
  const nodeMap = new Map(project.nodes.map((node) => [node.id, node]));
  const amplification =
    result && result.maxDisplacement > 1e-12
      ? (Math.max(spanX, spanY) * 0.1) / result.maxDisplacement
      : 1;
  const diagramMaximum =
    result && diagram !== 'model' && diagram !== 'displacement'
      ? Math.max(
          1e-10,
          ...result.members.flatMap((member) =>
            member.stations.map((station) => Math.abs(station[diagram])),
          ),
        )
      : 1;
  const stationScale = 70 / diagramMaximum;
  function coordinates(clientX: number, clientY: number) {
    const matrix = svgRef.current?.getScreenCTM();
    if (!matrix) return { x: 500, y: 325 };
    return new DOMPoint(clientX, clientY).matrixTransform(matrix.inverse());
  }
  function backgroundClick(event: React.MouseEvent<SVGSVGElement>) {
    if (tool === 'node') {
      const position = coordinates(event.clientX, event.clientY);
      let x = (position.x - 500 - pan.x) / scale + cx;
      let y = -(position.y - 355 - pan.y) / scale + cy;
      if (snap) {
        x = Math.round(x * 2) / 2;
        y = Math.round(y * 2) / 2;
      }
      onAddNode(Number(x.toFixed(4)), Number(y.toFixed(4)));
    } else if (tool === 'select') onSelect({ kind: 'project' });
  }
  const grid = Math.max(8, scale * 0.5);
  return (
    <div className={`canvas-container tool-${tool}`}>
      <div className="canvas-caption">
        <span className="eyebrow">STRUCTURAL MODEL / 01</span>
        <h1>{project.name}</h1>
        <p>
          {diagram === 'model'
            ? 'Geometry & applied loads'
            : diagram === 'displacement'
              ? 'Deformed shape · exaggerated for visibility'
              : diagram === 'moment'
                ? 'Bending moment diagram'
                : `${diagram[0].toUpperCase()}${diagram.slice(1)} force diagram`}
        </p>
      </div>
      <div className="canvas-mode">
        <span className={result ? 'status-dot green' : 'status-dot'} />
        {result ? 'Analysis complete' : 'Linear static model'}
      </div>
      <svg
        ref={svgRef}
        className="frame-canvas"
        viewBox="0 0 1000 650"
        aria-label="Structural frame drawing"
        onClick={backgroundClick}
        onPointerDown={(event) => {
          if (tool !== 'pan') return;
          const p = coordinates(event.clientX, event.clientY);
          drag.current = { x: p.x, y: p.y, originalX: pan.x, originalY: pan.y };
          event.currentTarget.setPointerCapture(event.pointerId);
        }}
        onPointerMove={(event) => {
          if (!drag.current) return;
          const p = coordinates(event.clientX, event.clientY);
          setPan({
            x: drag.current.originalX + p.x - drag.current.x,
            y: drag.current.originalY + p.y - drag.current.y,
          });
        }}
        onPointerUp={() => {
          drag.current = null;
        }}
        onPointerCancel={() => {
          drag.current = null;
        }}
      >
        <defs>
          <pattern
            id="grid"
            width={grid}
            height={grid}
            x={origin.x}
            y={origin.y}
            patternUnits="userSpaceOnUse"
          >
            <circle cx="0" cy="0" r="1" fill="#cbd3de" />
          </pattern>
          <marker
            id="load-arrow"
            viewBox="0 0 8 8"
            refX="7"
            refY="4"
            markerWidth="6"
            markerHeight="6"
            orient="auto-start-reverse"
          >
            <path d="M0 0L8 4L0 8Z" fill="#c36d3b" />
          </marker>
        </defs>
        <rect width="1000" height="650" fill="url(#grid)" />
        {/* Dimension strings stay outside the member envelope. */}
        {project.nodes.length > 1 && diagram === 'model' ? (
          <g className="dimensions" pointerEvents="none">
            {maxX - minX > 0.01
              ? (() => {
                  const a = point(minX, minY);
                  const b = point(maxX, minY);
                  return (
                    <>
                      <path
                        d={`M${a.x} ${a.y + 44}v26 M${b.x} ${b.y + 44}v26 M${a.x} ${a.y + 60}H${b.x}`}
                      />
                      <path d={`M${a.x - 4} ${a.y + 64}l8 -8 M${b.x - 4} ${b.y + 64}l8 -8`} />
                      <text x={(a.x + b.x) / 2} y={a.y + 55} textAnchor="middle">
                        {f(maxX - minX)} m
                      </text>
                    </>
                  );
                })()
              : null}
            {maxY - minY > 0.01
              ? (() => {
                  const a = point(minX, minY);
                  const b = point(minX, maxY);
                  return (
                    <>
                      <path
                        d={`M${a.x - 44} ${a.y}h-26 M${b.x - 44} ${b.y}h-26 M${a.x - 60} ${a.y}V${b.y}`}
                      />
                      <text
                        transform={`translate(${a.x - 68} ${(a.y + b.y) / 2}) rotate(-90)`}
                        textAnchor="middle"
                      >
                        {f(maxY - minY)} m
                      </text>
                    </>
                  );
                })()
              : null}
          </g>
        ) : null}
        {project.members.map((member) => {
          const na = nodeMap.get(member.start)!;
          const nb = nodeMap.get(member.end)!;
          const a = point(na.x, na.y);
          const b = point(nb.x, nb.y);
          const length = Math.hypot(nb.x - na.x, nb.y - na.y);
          const cos = (nb.x - na.x) / length;
          const sin = (nb.y - na.y) / length;
          const selected = selection.kind === 'member' && selection.id === member.id;
          const analysed = result?.members.find((item) => item.id === member.id);
          return (
            <g key={member.id}>
              <line
                x1={a.x}
                y1={a.y}
                x2={b.x}
                y2={b.y}
                className={`member-line ${selected ? 'selected' : ''} ${diagram !== 'model' ? 'ghost' : ''}`}
              />
              <polygon
                points={`${a.x + sin * 10},${a.y + cos * 10} ${b.x + sin * 10},${b.y + cos * 10} ${b.x - sin * 10},${b.y - cos * 10} ${a.x - sin * 10},${a.y - cos * 10}`}
                fill="transparent"
                role="button"
                tabIndex={0}
                aria-label={`Select member ${member.id}`}
                className="member-hit"
                onClick={(event) => {
                  event.stopPropagation();
                  if (tool === 'select') onSelect({ kind: 'member', id: member.id });
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    onSelect({ kind: 'member', id: member.id });
                  }
                }}
              />
              {showLabels ? (
                <text
                  className="member-label"
                  x={(a.x + b.x) / 2 - sin * 16}
                  y={(a.y + b.y) / 2 - cos * 16}
                  textAnchor="middle"
                  pointerEvents="none"
                >
                  M{member.id}
                </text>
              ) : null}
              {member.releaseStart ? (
                <circle className="release-symbol" cx={a.x + cos * 12} cy={a.y - sin * 12} r="5" />
              ) : null}
              {member.releaseEnd ? (
                <circle className="release-symbol" cx={b.x - cos * 12} cy={b.y + sin * 12} r="5" />
              ) : null}
              {diagram === 'model' && (member.qStart !== 0 || member.qEnd !== 0)
                ? (() => {
                    const maxLoad = Math.max(Math.abs(member.qStart), Math.abs(member.qEnd));
                    const tips = Array.from({ length: 11 }, (_, i) => {
                      const t = i / 10;
                      const q = member.qStart * (1 - t) + member.qEnd * t;
                      const direction = q >= 0 ? 1 : -1;
                      const tip = {
                        x: a.x + (b.x - a.x) * t + sin * direction * 10,
                        y: a.y + (b.y - a.y) * t + cos * direction * 10,
                      };
                      return {
                        q,
                        tip,
                        tail: {
                          x: tip.x + ((sin * q) / maxLoad) * 45,
                          y: tip.y + ((cos * q) / maxLoad) * 45,
                        },
                      };
                    });
                    const mid = tips[5].tail;
                    return (
                      <g className="load-lines" pointerEvents="none">
                        <polyline
                          points={tips.map((item) => `${item.tail.x},${item.tail.y}`).join(' ')}
                        />
                        {tips
                          .filter((item) => Math.abs(item.q) > 1e-10)
                          .map((item, index) => (
                            <line
                              key={index}
                              x1={item.tail.x}
                              y1={item.tail.y}
                              x2={item.tip.x}
                              y2={item.tip.y}
                              markerEnd="url(#load-arrow)"
                            />
                          ))}
                        <text x={mid.x} y={mid.y - 14} textAnchor="middle">
                          {f(member.qStart)}
                          {member.qStart === member.qEnd ? '' : ` → ${f(member.qEnd)}`} kN/m
                        </text>
                      </g>
                    );
                  })()
                : null}
              {analysed && diagram !== 'model'
                ? (() => {
                    const points = analysed.stations.map((station) => {
                      if (diagram === 'displacement')
                        return point(
                          na.x +
                            cos * station.x +
                            amplification * (cos * station.u - sin * station.v),
                          na.y +
                            sin * station.x +
                            amplification * (sin * station.u + cos * station.v),
                        );
                      const value = station[diagram] * stationScale;
                      return {
                        x: a.x + cos * station.x * scale + sin * value,
                        y: a.y - sin * station.x * scale + cos * value,
                      };
                    });
                    const line = points.map((p) => `${p.x},${p.y}`).join(' ');
                    return (
                      <g className={`result-diagram ${diagram}`} pointerEvents="none">
                        {diagram !== 'displacement' ? (
                          <polygon points={`${a.x},${a.y} ${line} ${b.x},${b.y}`} />
                        ) : null}
                        <polyline points={line} />
                        {diagram !== 'displacement' ? (
                          <text x={points[40].x + 8} y={points[40].y + 16}>
                            {f(analysed.stations[40][diagram])}
                          </text>
                        ) : null}
                      </g>
                    );
                  })()
                : null}
            </g>
          );
        })}
        {project.nodes.map((node) => {
          const p = point(node.x, node.y);
          const selected =
            (selection.kind === 'node' && selection.id === node.id) || pendingNode === node.id;
          return (
            <g key={node.id}>
              <SupportSymbol node={node} x={p.x} y={p.y} />
              {diagram === 'model' ? (
                <g className="load-lines" pointerEvents="none">
                  {node.fx !== 0 ? (
                    <>
                      <line
                        x1={p.x - Math.sign(node.fx) * 77}
                        y1={p.y}
                        x2={p.x - Math.sign(node.fx) * 13}
                        y2={p.y}
                        markerEnd="url(#load-arrow)"
                      />
                      <text x={p.x - Math.sign(node.fx) * 47} y={p.y - 12} textAnchor="middle">
                        {f(node.fx)} kN
                      </text>
                    </>
                  ) : null}
                  {node.fy !== 0 ? (
                    <>
                      <line
                        x1={p.x}
                        y1={p.y + Math.sign(node.fy) * 77}
                        x2={p.x}
                        y2={p.y + Math.sign(node.fy) * 13}
                        markerEnd="url(#load-arrow)"
                      />
                      <text x={p.x + 10} y={p.y + Math.sign(node.fy) * 56}>
                        {f(node.fy)} kN
                      </text>
                    </>
                  ) : null}
                  {node.moment !== 0 ? (
                    <>
                      <path
                        d={`M${p.x + 23} ${p.y + 15} A28 28 0 1 ${node.moment > 0 ? 0 : 1} ${p.x - 23} ${p.y + 15}`}
                        markerEnd="url(#load-arrow)"
                      />
                      <text x={p.x + 32} y={p.y - 25}>
                        {f(node.moment)} kN·m
                      </text>
                    </>
                  ) : null}
                </g>
              ) : null}
              {selected ? <circle cx={p.x} cy={p.y} r="14" fill="#315bca" opacity="0.13" /> : null}
              <circle
                cx={p.x}
                cy={p.y}
                r="5.5"
                className={`node-point ${selected ? 'selected' : ''}`}
              />
              <circle
                cx={p.x}
                cy={p.y}
                r="17"
                fill="transparent"
                role="button"
                tabIndex={0}
                aria-label={`Select node ${node.id}`}
                className="node-hit"
                onClick={(event) => {
                  event.stopPropagation();
                  onNodeClick(node.id);
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    onNodeClick(node.id);
                  }
                }}
              />
              {showLabels ? (
                <text className="node-label" x={p.x + 13} y={p.y + 23} pointerEvents="none">
                  N{node.id}
                </text>
              ) : null}
            </g>
          );
        })}
        {!project.nodes.length ? (
          <text x="500" y="325" textAnchor="middle" className="empty-canvas">
            Place your first node to begin.
          </text>
        ) : null}
      </svg>
      <div className="canvas-axis" aria-hidden="true">
        <svg width="54" height="54" viewBox="0 0 54 54">
          <path d="M12 43V9m0 34h34" fill="none" stroke="#728197" strokeWidth="1.5" />
          <path d="M8 14l4-6 4 6 M41 39l6 4-6 4" fill="none" stroke="#728197" />
          <text x="21" y="15">
            Y
          </text>
          <text x="42" y="32">
            X
          </text>
        </svg>
      </div>
      <div className="canvas-legend">
        <span>
          <i className="legend-line" />
          {diagram === 'model'
            ? 'Frame member'
            : diagram === 'displacement'
              ? `Deformed ×${f(amplification)}`
              : `${diagram} · ${diagram === 'moment' ? 'kN·m' : 'kN'}`}
        </span>
        {diagram === 'model' ? (
          <span>
            <i className="legend-line load" />
            Applied load
          </span>
        ) : null}
        {project.selfWeight ? <span>+ self-weight (not drawn)</span> : null}
      </div>
      <div className="zoom-control">
        <button
          aria-label="Zoom out"
          onClick={() => setZoom((value) => Math.max(0.25, value / 1.25))}
        >
          <Minus size={15} />
        </button>
        <span>{Math.round(zoom * 100)}%</span>
        <button aria-label="Zoom in" onClick={() => setZoom((value) => Math.min(4, value * 1.25))}>
          <Plus size={15} />
        </button>
        <button
          aria-label="Fit model"
          onClick={() => {
            setZoom(1);
            setPan({ x: 0, y: 0 });
          }}
        >
          <Maximize size={15} />
        </button>
      </div>
    </div>
  );
}
