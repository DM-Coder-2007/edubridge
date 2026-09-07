'use client';

import React, { useId } from 'react';

/**
 * Accessible Textarea Component
 *
 * @param {Object} props
 * @param {string} [props.id]
 * @param {string} [props.name]
 * @param {string} [props.label]
 * @param {string} [props.value]
 * @param {function} [props.onChange]
 * @param {string} [props.placeholder]
 * @param {number} [props.rows=4]
 * @param {string} [props.error]
 * @param {string} [props.helperText]
 * @param {boolean} [props.required=false]
 * @param {boolean} [props.disabled=false]
 * @param {string} [props.className='']
 * @param {string} [props.textareaClassName='']
 */
export default function Textarea({
  id: customId,
  name,
  label,
  value,
  onChange,
  placeholder,
  rows = 4,
  error,
  helperText,
  required = false,
  disabled = false,
  className = '',
  textareaClassName = '',
  'aria-label': ariaLabelProp,
  ...rest
}) {
  const generatedId = useId();
  const textareaId = customId || `textarea-${generatedId}`;
  const errorId = `${textareaId}-error`;
  const helperId = `${textareaId}-helper`;

  const describedBy = [
    error ? errorId : null,
    helperText ? helperId : null
  ].filter(Boolean).join(' ') || undefined;

  return (
    <div className={`form-group ${className}`.trim()}>
      {label && (
        <label htmlFor={textareaId} className="form-label">
          <span>{label}</span>
          {required && (
            <span className="form-label-required" aria-hidden="true">*</span>
          )}
        </label>
      )}

      <textarea
        id={textareaId}
        name={name}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        rows={rows}
        required={required}
        disabled={disabled}
        aria-invalid={Boolean(error)}
        aria-describedby={describedBy}
        aria-label={!label ? ariaLabelProp || placeholder : undefined}
        className={`textarea-control ${textareaClassName}`.trim()}
        {...rest}
      />

      {error && (
        <p id={errorId} className="form-error" role="alert">
          {error}
        </p>
      )}

      {!error && helperText && (
        <p id={helperId} className="form-helper">
          {helperText}
        </p>
      )}
    </div>
  );
}
