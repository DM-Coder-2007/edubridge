'use client';

import React, { useState, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '../../context/AuthContext';
import { useAccessibility } from '../../context/AccessibilityContext';
import { Card, CardBody, Button, Input, Spinner, InlineError } from '../../components/ui';

import { getReadableErrorMessage } from '../../lib/errorHandler';

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const rawRedirect = searchParams.get('redirect');
  const redirectUrl = (rawRedirect && !rawRedirect.startsWith('/login') && rawRedirect.startsWith('/'))
    ? decodeURIComponent(rawRedirect)
    : '/dashboard';

  const { login, user, isAuthenticated, loading: authLoading } = useAuth();
  const { isHighContrast, toggleHighContrast } = useAccessibility();

  // If already authenticated, redirect immediately away from login
  React.useEffect(() => {
    if (!authLoading && (isAuthenticated || user)) {
      router.replace(redirectUrl);
      if (typeof window !== 'undefined') {
        window.location.href = redirectUrl;
      }
    }
  }, [authLoading, isAuthenticated, user, redirectUrl, router]);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});

  const validateForm = () => {
    const errors = {};
    if (!email.trim()) {
      errors.email = 'Email address is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      errors.email = 'Please enter a valid email address';
    }

    if (!password) {
      errors.password = 'Password is required';
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
      const res = await login({
        email: email.trim().toLowerCase(),
        password
      });

      if (res) {
        // Double-barrel redirection: router.replace + window.location.href
        router.replace(redirectUrl);
        if (typeof window !== 'undefined') {
          window.location.href = redirectUrl;
        }
      }
    } catch (err) {
      setErrorMessage(getReadableErrorMessage(err));
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
      {/* Top Header with Contrast Toggle */}
      <header
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 'var(--spacing-3)',
          maxWidth: '440px',
          width: '100%',
          margin: '0 auto var(--spacing-6) auto'
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

      {/* Main Login Card */}
      <main
        style={{
          maxWidth: '440px',
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
              <h1 className="text-h2">Sign In to EduBridge</h1>
              <p className="text-small" style={{ marginTop: 'var(--spacing-1)' }}>
                Access your personalized multimodal lessons and Snowflake mastery profile.
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
                label="Email Address"
                type="email"
                name="email"
                placeholder="student@edubridge.org"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (fieldErrors.email) {
                    setFieldErrors((prev) => ({ ...prev, email: '' }));
                  }
                }}
                error={fieldErrors.email}
                required
                autoComplete="email"
              />

              <div style={{ position: 'relative' }}>
                <Input
                  label="Password"
                  type={showPassword ? 'text' : 'password'}
                  name="password"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (fieldErrors.password) {
                      setFieldErrors((prev) => ({ ...prev, password: '' }));
                    }
                  }}
                  error={fieldErrors.password}
                  required
                  autoComplete="current-password"
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

              <div className="flex justify-between items-center text-caption" style={{ color: 'var(--text-muted)' }}>
                <span>Session kept active for 7 days via secure cookie.</span>
              </div>

              <Button
                type="submit"
                variant="primary"
                fullWidth
                loading={isLoading}
              >
                Sign In
              </Button>
            </form>
          </CardBody>
        </Card>

        <div style={{ textAlign: 'center' }} className="text-small">
          Don&apos;t have an EduBridge account?{' '}
          <Link href="/signup" style={{ color: 'var(--text-link)', fontWeight: 'bold' }}>
            Create one here
          </Link>
        </div>
      </main>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Spinner size="lg" color="var(--color-primary-600)" />
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
