import React from 'react';

/**
 * Accessible Progress Bar Component
 *
 * @param {Object} props
 * @param {number} props.value - Current progress value (e.g. 0 to 100)
 * @param {number} [props.max=100] - Maximum progress value
 * @param {string} [props.label] - Accessible label describing progress
 * @param {boolean} [props.showPercentage=false] - Display visible % text
 * @param {'primary' | 'success' | 'accent' | 'warning'} [props.variant='primary']
 * @param {'md' | 'lg'} [props.size='md']
 * @param {string} [props.className='']
 */
export default function ProgressBar({
  value,
  max = 100,
  label,
  showPercentage = false,
  variant = 'primary',
  size = 'md',
  className = ''
}) {
  const percentage = Math.min(100, Math.max(0, Math.round(((value || 0) / max) * 100)));

  return (
    <div className={`progress-bar-container ${className}`.trim()}>
      {(label || showPercentage) && (
        <div className="progress-header">
          {label && <span>{label}</span>}
          {showPercentage && <span className="text-small">{percentage}%</span>}
        </div>
      )}

      <div
        role="progressbar"
        aria-valuenow={percentage}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label || 'Progress'}
        className={`progress-track ${size === 'lg' ? 'progress-track-lg' : ''}`}
      >
        <div
          className={`progress-fill progress-fill-${variant}`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}
