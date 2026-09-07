'use client';

import React, { useState, useMemo, useCallback } from 'react';
import { Badge } from '../ui';

const GRID_LEVELS = [0.2, 0.4, 0.6, 0.8, 1.0];

/**
 * Accessible SVG Radar Chart for Student Concept Mastery
 * Uses real backend concept scores (never fabricates categories).
 * Features toggleable view between SVG polygon and fully accessible semantic HTML table.
 */
function RadarChartComponent({
  items = [],
  title = 'Conceptual Mastery Radar',
  description = 'Multidimensional visualization of student comprehension across topics.'
}) {
  const [activeView, setActiveView] = useState('chart'); // 'chart' | 'table'

  // Filter out any items without valid labels or values
  const validData = useMemo(() => {
    return items
      .filter((item) => item && (item.label || item.name || item.conceptId))
      .map((item) => ({
        label: item.label || item.conceptName || item.conceptId || item.name,
        value: Math.min(100, Math.max(0, Math.round(item.value ?? item.masteryScore ?? 0))),
        level: item.level || item.masteryLevel || (item.value >= 80 ? 'Strong' : item.value < 60 ? 'Needs Practice' : 'Developing'),
        attempts: item.attemptsCount ?? item.attempts ?? 0
      }));
  }, [items]);

  // Dimensions - 380 gives ample label margin for 320-1920 screens
  const size = 380;
  const center = size / 2;
  const radius = center - 68; // Leave margin for text labels
  const total = validData.length;

  // Helper to compute (x, y) on radial axis
  const getCoordinates = useCallback(
    (index, fraction) => {
      if (total === 0) return { x: center, y: center };
      const angle = -Math.PI / 2 + (index * 2 * Math.PI) / total;
      const r = radius * fraction;
      return {
        x: center + r * Math.cos(angle),
        y: center + r * Math.sin(angle)
      };
    },
    [total, center, radius]
  );

  // Generate grid polygon points for each concentric level
  const gridPolygons = useMemo(() => {
    if (total < 3) return [];
    return GRID_LEVELS.map((level) => {
      const points = validData.map((_, i) => {
        const { x, y } = getCoordinates(i, level);
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      });
      return points.join(' ');
    });
  }, [total, validData, getCoordinates]);

  // Generate student data polygon points
  const dataPolygonPoints = useMemo(() => {
    if (total < 3) return '';
    return validData
      .map((item, i) => {
        const fraction = item.value / 100;
        const { x, y } = getCoordinates(i, fraction);
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(' ');
  }, [total, validData, getCoordinates]);

  // If there are no concepts, render an empty state
  if (validData.length === 0) {
    return (
      <div className="text-center" style={{ padding: 'var(--spacing-8) 0', color: 'var(--text-muted)' }}>
        <p>No concept mastery records recorded yet.</p>
      </div>
    );
  }

  return (
    <div className="radar-chart-wrapper" role="region" aria-label={title}>
      {/* Top Controls: View Toggle (Chart vs Table) */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', flexWrap: 'wrap', gap: 'var(--spacing-3)' }}>
        <div>
          <h3 className="text-h3" style={{ margin: 0 }}>{title}</h3>
          <p className="text-caption" style={{ color: 'var(--text-muted)', marginTop: '2px' }}>
            {description}
          </p>
        </div>

        <div className="view-toggle-group" role="tablist" aria-label="Radar chart display modes">
          <button
            type="button"
            role="tab"
            aria-selected={activeView === 'chart'}
            className={`view-toggle-btn ${activeView === 'chart' ? 'view-toggle-btn--active' : ''}`}
            onClick={() => setActiveView('chart')}
          >
            Visual Chart
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeView === 'table'}
            className={`view-toggle-btn ${activeView === 'table' ? 'view-toggle-btn--active' : ''}`}
            onClick={() => setActiveView('table')}
          >
            Accessible Table
          </button>
        </div>
      </div>

      {/* Mode A: Visual SVG Radar Chart */}
      {activeView === 'chart' && (
        <>
          {total >= 3 ? (
            <div className="radar-chart-container">
              <svg
                viewBox={`0 0 ${size} ${size}`}
                className="radar-chart-svg"
                role="img"
                aria-label={`Radar chart showing mastery across ${total} concepts`}
              >
                <title>{title}</title>
                <desc>{description}</desc>

                {/* Concentric Grid Polygons */}
                {gridPolygons.map((points, idx) => (
                  <polygon
                    key={idx}
                    points={points}
                    className="radar-grid-polygon"
                  />
                ))}

                {/* Axis lines from center to perimeter */}
                {validData.map((_, i) => {
                  const { x, y } = getCoordinates(i, 1.0);
                  return (
                    <line
                      key={i}
                      x1={center}
                      y1={center}
                      x2={x}
                      y2={y}
                      className="radar-axis-line"
                    />
                  );
                })}

                {/* Student Mastery Filled Polygon */}
                <polygon
                  points={dataPolygonPoints}
                  className="radar-data-area"
                />

                {/* Data Points on vertices */}
                {validData.map((item, i) => {
                  const { x, y } = getCoordinates(i, item.value / 100);
                  return (
                    <circle
                      key={i}
                      cx={x}
                      cy={y}
                      r="4"
                      className="radar-data-dot"
                    >
                      <title>{`${item.label}: ${item.value}% (${item.level})`}</title>
                    </circle>
                  );
                })}

                {/* Perimeter Axis Labels */}
                {validData.map((item, i) => {
                  const { x, y } = getCoordinates(i, 1.18);
                  const angle = -Math.PI / 2 + (i * 2 * Math.PI) / total;
                  let textAnchor = 'middle';
                  if (Math.cos(angle) > 0.3) textAnchor = 'start';
                  if (Math.cos(angle) < -0.3) textAnchor = 'end';

                  // Truncate long labels for small SVG
                  const displayLabel = item.label.length > 14 ? `${item.label.substring(0, 12)}...` : item.label;

                  return (
                    <text
                      key={i}
                      x={x}
                      y={y + 4}
                      textAnchor={textAnchor}
                      className="radar-axis-text"
                    >
                      {displayLabel} ({item.value}%)
                    </text>
                  );
                })}
              </svg>
            </div>
          ) : (
            /* Fallback comparison bars if fewer than 3 concepts */
            <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 'var(--spacing-3)' }}>
              {validData.map((item, idx) => (
                <div key={idx} className="stack-xs">
                  <div className="flex justify-between items-center text-small">
                    <strong>{item.label}</strong>
                    <span>{item.value}%</span>
                  </div>
                  <div style={{ width: '100%', height: '8px', borderRadius: '4px', backgroundColor: 'var(--surface-tertiary)' }}>
                    <div style={{ width: `${item.value}%`, height: '100%', borderRadius: '4px', backgroundColor: 'var(--color-primary-600)' }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Mode B: Accessible Semantic Data Table (Also available as alternative view) */}
      <div
        className="progress-table-container"
        style={{ display: activeView === 'table' ? 'block' : 'none' }}
      >
        <table className="progress-table" aria-label="Tabular concept mastery scores">
          <thead>
            <tr>
              <th scope="col">Concept Name</th>
              <th scope="col">Mastery Score</th>
              <th scope="col">Mastery Level</th>
              <th scope="col">Total Attempts</th>
            </tr>
          </thead>
          <tbody>
            {validData.map((item, idx) => (
              <tr key={idx}>
                <th scope="row">{item.label}</th>
                <td><strong>{item.value}%</strong></td>
                <td>
                  <Badge variant={item.value >= 80 ? 'success' : item.value < 60 ? 'danger' : 'warning'}>
                    {item.level}
                  </Badge>
                </td>
                <td>{item.attempts}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export const RadarChart = React.memo(RadarChartComponent);
export default RadarChart;
