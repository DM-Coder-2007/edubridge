'use client';

import React, { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '../../context/AuthContext';
import { Spinner } from '../ui';

/**
 * Higher-Order Protected Route Component
 * Ensures student or educator is authenticated before rendering protected content.
 * Redirects unauthenticated visitors to /login with ?redirect= return URL parameter.
 *
 * @param {Object} props
 * @param {React.ReactNode} props.children
 * @param {string[]} [props.allowedRoles]
 */
export default function ProtectedRoute({ children, allowedRoles }) {
  const { user, authenticated, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!loading && !authenticated) {
      const returnPath = (pathname && !pathname.startsWith('/login')) ? pathname : '/dashboard';
      const redirectUrl = encodeURIComponent(returnPath);
      router.replace(`/login?redirect=${redirectUrl}`);
    }
  }, [loading, authenticated, router, pathname]);

  if (loading) {
    return (
      <div
        className="flex flex-col items-center justify-center min-h-[50vh] gap-4"
        style={{ minHeight: '60vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}
        role="status"
        aria-live="polite"
      >
        <Spinner size="lg" color="var(--color-primary-600)" />
        <p className="text-small" style={{ color: 'var(--text-muted)' }}>
          Verifying secure session with Snowflake database...
        </p>
      </div>
    );
  }

  if (!authenticated) {
    return null;
  }

  if (allowedRoles && allowedRoles.length > 0 && user?.role) {
    if (!allowedRoles.includes(user.role)) {
      return (
        <div style={{ padding: 'var(--spacing-8)', textAlign: 'center' }} role="alert">
          <h2 className="text-h2" style={{ color: 'var(--color-danger-700)' }}>
            Access Restricted
          </h2>
          <p className="text-body" style={{ marginTop: 'var(--spacing-2)' }}>
            Your account role ({user.role}) does not have permission to view this resource.
          </p>
        </div>
      );
    }
  }

  return children;
}
