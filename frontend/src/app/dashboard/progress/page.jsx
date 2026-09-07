'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { LoadingSkeleton } from '../../../components/ui';
import { PageContainer } from '../../../components/shell';
import { ProtectedRoute } from '../../../components/auth';

export default function DashboardProgressRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/progress');
  }, [router]);

  return (
    <ProtectedRoute>
      <PageContainer>
        <div style={{ padding: 'var(--spacing-8) 0' }}>
          <LoadingSkeleton preset="page" ariaLabel="Navigating to Student Progress Center..." />
        </div>
      </PageContainer>
    </ProtectedRoute>
  );
}
