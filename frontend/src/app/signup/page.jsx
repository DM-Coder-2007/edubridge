'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../context/AuthContext';
import { useAccessibility } from '../../context/AccessibilityContext';
import { Card, CardBody, Button, Input, InlineError } from '../../components/ui';

import { getReadableErrorMessage } from '../../lib/errorHandler';

export default function SignupPage() {
  const router = useRouter();
  const { signup } = useAuth();
  const { isHighContrast, toggleHighContrast } = useAccessibility();

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [role, setRole] = useState('student');
  const [showPassword, setShowPassword] = useState(false);

  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});

  // Password strength checks (matches backend rules)
  const isLengthValid = password.length >= 8;
  const hasLetter = /[a-zA-Z]/.test(password);
  const hasDigit = /[0-9]/.test(password);
  const isPasswordValid = isLengthValid && hasLetter && hasDigit;

  const validateForm = () => {
    const errors = {};

    if (!fullName.trim() || fullName.trim().length < 2) {
      errors.fullName = 'Full name is required (at least 2 characters)';
    }

    if (!email.trim()) {
      errors.email = 'Email address is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      errors.email = 'Please enter a valid email address';
    }

    if (!password) {
      errors.password = 'Password is required';
    } else if (!isPasswordValid) {
      errors.password = 'Password must be at least 8 characters and include at least one letter and one number';
    }

    if (password !== confirmPassword) {
      errors.confirmPassword = 'Passwords do not match';
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage('');

    if (!validateForm()) return;

    setIsLoading(true);
    try {
      // NOTE: Do NOT send confirmPassword to backend (backend contract doesn't expect it)
      await signup({
        fullName: fullName.trim(),
        email: email.trim().toLowerCase(),
        password,
        role
      });

      router.push('/dashboard');
    } catch (err) {
      setErrorMessage(getReadableErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: 'var(--bg-app)',
        padding: 'var(--spacing-6) var(--spacing-4)'
      }}
    >
      <header
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 'var(--spacing-3)',
          maxWidth: '480px',
          width: '100%',
          margin: '0 auto var(--spacing-4) auto'
        }}
      >
        <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-2)', textDecoration: 'none', color: 'inherit' }}>
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 'var(--radius-md)',
              backgroundColor: 'var(--color-primary-700)',
              color: 'white',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 'bold'
            }}
            aria-hidden="true"
          >
            EB
          </div>
          <span style={{ fontWeight: 'bold', fontSize: '1.125rem' }}>EduBridge Adaptive</span>
        </Link>

        <Button
          variant={isHighContrast ? 'accent' : 'outline'}
          size="sm"
          onClick={toggleHighContrast}
          ariaLabel="Toggle high contrast accessibility theme"
        >
          {isHighContrast ? 'High Contrast ON' : 'High Contrast'}
        </Button>
      </header>

      <main
        style={{
          maxWidth: '480px',
          width: '100%',
          margin: 'auto auto',
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--spacing-4)'
        }}
      >
        <Card>
          <CardBody>
            <div style={{ textAlign: 'center', marginBottom: 'var(--spacing-6)' }}>
              <h1 className="text-h2">Create Your Account</h1>
              <p className="text-small" style={{ marginTop: 'var(--spacing-1)' }}>
                Join EduBridge Adaptive for AI-guided sensory learning and accessible textbooks.
              </p>
            </div>

            {errorMessage && (
              <InlineError
                message={errorMessage}
                style={{ marginBottom: 'var(--spacing-4)' }}
              />
            )}


            <form onSubmit={handleSubmit} noValidate className="stack">
              <Input
                label="Full Name"
                name="fullName"
                placeholder="Alex Johnson"
                value={fullName}
                onChange={(e) => {
                  setFullName(e.target.value);
                  if (fieldErrors.fullName) setFieldErrors((prev) => ({ ...prev, fullName: '' }));
                }}
                error={fieldErrors.fullName}
                required
                autoComplete="name"
              />

              <Input
                label="Email Address"
                type="email"
                name="email"
                placeholder="alex@edubridge.org"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (fieldErrors.email) setFieldErrors((prev) => ({ ...prev, email: '' }));
                }}
                error={fieldErrors.email}
                required
                autoComplete="email"
              />

              {/* Role Selection */}
              <div className="form-group">
                <label htmlFor="role-select" className="form-label">
                  <span>Account Role</span>
                  <span className="form-label-required" aria-hidden="true">*</span>
                </label>
                <select
                  id="role-select"
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  className="input-control"
                >
                  <option value="student">Student</option>
                  <option value="teacher">Educator / Teacher</option>
                  <option value="parent">Parent / Guardian</option>
                </select>
              </div>

              {/* Password with Show/Hide toggle */}
              <div style={{ position: 'relative' }}>
                <Input
                  label="Password"
                  type={showPassword ? 'text' : 'password'}
                  name="password"
                  placeholder="Create a strong password"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (fieldErrors.password) setFieldErrors((prev) => ({ ...prev, password: '' }));
                  }}
                  error={fieldErrors.password}
                  required
                  autoComplete="new-password"
                  rightIcon={
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      aria-label={showPassword ? 'Hide password text' : 'Show password text'}
                      suppressHydrationWarning
                      style={{
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        color: 'var(--text-muted)',
                        padding: '4px',
                        display: 'flex',
                        alignItems: 'center'
                      }}
                    >
                      {showPassword ? (
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                          <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                          <line x1="1" y1="1" x2="23" y2="23" />
                        </svg>
                      ) : (
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                          <circle cx="12" cy="12" r="3" />
                        </svg>
                      )}
                    </button>
                  }
                />
              </div>

              {/* Password Strength Guidance */}
              <div
                style={{
                  backgroundColor: 'var(--bg-surface-subtle)',
                  padding: 'var(--spacing-3)',
                  borderRadius: 'var(--radius-md)',
                  fontSize: 'var(--font-size-caption)'
                }}
              >
                <div style={{ fontWeight: 'bold', marginBottom: 'var(--spacing-1)' }}>Password Requirements:</div>
                <div className="flex flex-col gap-1">
                  <div style={{ color: isLengthValid ? 'var(--color-success-700)' : 'var(--text-muted)' }}>
                    {isLengthValid ? '✓' : '•'} At least 8 characters
                  </div>
                  <div style={{ color: hasLetter ? 'var(--color-success-700)' : 'var(--text-muted)' }}>
                    {hasLetter ? '✓' : '•'} At least one letter
                  </div>
                  <div style={{ color: hasDigit ? 'var(--color-success-700)' : 'var(--text-muted)' }}>
                    {hasDigit ? '✓' : '•'} At least one number
                  </div>
                </div>
              </div>

              {/* Confirm Password */}
              <Input
                label="Confirm Password"
                type={showPassword ? 'text' : 'password'}
                name="confirmPassword"
                placeholder="Re-enter your password"
                value={confirmPassword}
                onChange={(e) => {
                  setConfirmPassword(e.target.value);
                  if (fieldErrors.confirmPassword) setFieldErrors((prev) => ({ ...prev, confirmPassword: '' }));
                }}
                error={fieldErrors.confirmPassword}
                required
                autoComplete="new-password"
              />

              <Button
                type="submit"
                variant="primary"
                fullWidth
                loading={isLoading}
              >
                Create Account
              </Button>
            </form>
          </CardBody>
        </Card>

        <div style={{ textAlign: 'center' }} className="text-small">
          Already registered?{' '}
          <Link href="/login" style={{ color: 'var(--text-link)', fontWeight: 'bold' }}>
            Sign in here
          </Link>
        </div>
      </main>
    </div>
  );
}
