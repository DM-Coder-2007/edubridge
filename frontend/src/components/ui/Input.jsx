'use client';

import React, { useId } from 'react';

/**
 * Accessible Input Component
 *
 * @param {Object} props
 * @param {string} [props.id]
 * @param {string} [props.name]
 * @param {string} [props.label]
 * @param {string} [props.type='text']
 * @param {string|number} [props.value]
 * @param {function} [props.onChange]
 * @param {string} [props.placeholder]
 * @param {string} [props.error]
 * @param {string} [props.helperText]
 * @param {boolean} [props.required=false]
 * @param {boolean} [props.disabled=false]
 * @param {React.ReactNode} [props.leftIcon]
 * @param {React.ReactNode} [props.rightIcon]
 * @param {string} [props.className='']
 * @param {string} [props.inputClassName='']
 */
export default function Input({
  id: customId,
  name,
  label,
  type = 'text',
  value,
  onChange,
  placeholder,
  error,
  helperText,
  required = false,
  disabled = false,
  leftIcon,
  rightIcon,
  className = '',
  inputClassName = '',
  'aria-label': ariaLabelProp,
  ...rest
}) {
  const generatedId = useId();
  const inputId = customId || `input-${generatedId}`;
  const errorId = `${inputId}-error`;
  const helperId = `${inputId}-helper`;

  const describedBy = [
    error ? errorId : null,
    helperText ? helperId : null
  ].filter(Boolean).join(' ') || undefined;

  const hasLeftIcon = Boolean(leftIcon);
  const hasRightIcon = Boolean(rightIcon);

  return (
    <div className={`form-group ${className}`.trim()}>
      {label && (
        <label htmlFor={inputId} className="form-label">
          <span>{label}</span>
          {required && (
            <span className="form-label-required" aria-hidden="true">*</span>
          )}
        </label>
      )}

      <div
        className={`input-container ${hasLeftIcon ? 'input-has-icon-left' : ''} ${hasRightIcon ? 'input-has-icon-right' : ''}`.trim()}
      >
        {hasLeftIcon && (
          <span className="input-icon-left" aria-hidden="true">
            {leftIcon}
          </span>
        )}

        <input
          id={inputId}
          name={name}
          type={type}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          required={required}
          disabled={disabled}
          aria-invalid={Boolean(error)}
          aria-describedby={describedBy}
          aria-label={!label ? ariaLabelProp || placeholder : undefined}
          className={`input-control ${inputClassName}`.trim()}
          {...rest}
        />

        {hasRightIcon && (
          <span className="input-icon-right" aria-hidden="true">
            {rightIcon}
          </span>
        )}
      </div>

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
