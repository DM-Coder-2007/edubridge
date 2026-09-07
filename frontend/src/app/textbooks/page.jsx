/* eslint-disable @next/next/no-img-element */
'use client';


import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { PageContainer } from '../../components/shell';
import { ProtectedRoute } from '../../components/auth';
import {
  Card,
  CardBody,
  Badge,
  Button,
  LoadingSkeleton,
  EmptyState,
  ErrorState,
  RetryButton
} from '../../components/ui';
import apiClient from '../../lib/apiClient';
import { API_ENDPOINTS } from '../../config/api';
import { parseApiError } from '../../lib/errorParser';
import { getOptimizedThumbnailUrl } from '../../lib/cloudinary';

export default function TextbooksPage() {
  const [textbooks, setTextbooks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchTextbooks = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const data = await apiClient.get(API_ENDPOINTS.TEXTBOOKS);
      const list = data?.textbooks || (Array.isArray(data) ? data : []);
      setTextbooks(list);
    } catch (err) {
      console.warn('[TextbooksPage] Fetch error:', err);
      setError(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTextbooks();
  }, [fetchTextbooks]);

  return (
    <ProtectedRoute>
      <PageContainer>
        <div className="stack-lg">
          {/* Header */}
          <header className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <div className="flex items-center gap-2" style={{ marginBottom: 'var(--spacing-1)' }}>
                <Badge variant="primary">Cloudinary Media Pipeline</Badge>
                <Badge variant="accent">Gemini Multimodal OCR</Badge>
              </div>
              <h1 className="text-h1">Textbooks Library</h1>
              <p className="text-body" style={{ color: 'var(--text-secondary)' }}>
                Original textbook page scans and their extracted OCR concepts, tactile graphics, and accessible narration.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <RetryButton
                onRetry={fetchTextbooks}
                isRetrying={loading}
                label="Refresh"
                variant="outline"
                size="sm"
              />
              <Link href="/upload">
                <Button variant="primary">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="17 8 12 3 7 8" />
                    <line x1="12" y1="3" x2="12" y2="15" />
                  </svg>
                  <span>Upload Textbook</span>
                </Button>
              </Link>
            </div>
          </header>

          {/* 1. Loading State */}
          {loading && (
            <LoadingSkeleton
              preset="card"
              count={3}
              ariaLabel="Loading your textbook scans library"
            />
          )}

          {/* 2. Error State */}
          {!loading && error && (
            <ErrorState
              error={error}
              title="Unable to load textbooks"
              onRetry={fetchTextbooks}
              retryText="Retry Loading"
              secondaryAction={
                <Link href="/upload">
                  <Button variant="outline">Upload New Scan</Button>
                </Link>
              }
            />
          )}

          {/* 3. Empty State */}
          {!loading && !error && textbooks.length === 0 && (
            <EmptyState
              title="No textbooks scanned yet"
              description="Upload a page scan or photo of your textbook. EduBridge will extract text with Gemini OCR, generate tactile analogies, and create accessible lessons."
              icon={
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
                  <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
                </svg>
              }
              action={
                <Link href="/upload">
                  <Button variant="primary" size="lg">
                    Upload Your First Textbook Scan
                  </Button>
                </Link>
              }
              secondaryAction={
                <Link href="/lessons">
                  <Button variant="outline" size="lg">
                    Explore Existing Lessons
                  </Button>
                </Link>
              }
            />
          )}

          {/* 4. Success State: Textbook Cards Grid */}
          {!loading && !error && textbooks.length > 0 && (
            <main id="main-content" tabIndex={-1}>
              <div className="grid grid-cols-1 grid-cols-sm-2 grid-cols-lg-3 gap-6">
                {textbooks.map((tb) => {
                  const status = tb.processingStatus || 'COMPLETED';
                  const isDone = status === 'COMPLETED';
                  const isProcessing = status === 'PROCESSING' || status === 'PENDING';

                  return (
                    <Card key={tb.id} className="textbook-card">
                      {tb.rawImageUrl && (
                        <div
                          style={{
                            height: '180px',
                            background: 'var(--color-neutral-100)',
                            position: 'relative',
                            overflow: 'hidden',
                            borderTopLeftRadius: 'var(--radius-lg)',
                            borderTopRightRadius: 'var(--radius-lg)'
                          }}
                        >
                          <img
                            src={getOptimizedThumbnailUrl(tb.processedImageUrl || tb.rawImageUrl, 600)}
                            alt={tb.title || 'Textbook scan page'}
                            loading="lazy"
                            decoding="async"
                            style={{
                              width: '100%',
                              height: '100%',
                              objectFit: 'cover'
                            }}
                          />
                          <div style={{ position: 'absolute', top: '12px', right: '12px' }}>
                            <Badge variant={isDone ? 'success' : isProcessing ? 'warning' : 'danger'}>
                              {isDone ? 'OCR Completed' : isProcessing ? 'Processing...' : 'Needs Attention'}
                            </Badge>
                          </div>
                        </div>
                      )}

                      <CardBody>
                        <div className="stack-sm">
                          <div className="flex items-center gap-2">
                            <span className="text-caption font-semibold" style={{ color: 'var(--color-primary-700)' }}>
                              {tb.subject || 'Science'}
                            </span>
                            {tb.gradeLevel && (
                              <span className="text-caption" style={{ color: 'var(--text-muted)' }}>
                                • Grade {tb.gradeLevel}
                              </span>
                            )}
                          </div>

                          <h2 className="text-h3" style={{ fontSize: '1.2rem', margin: 0 }}>
                            {tb.title || 'Textbook Page'}
                          </h2>

                          {tb.chapterTitle && (
                            <p className="text-small" style={{ color: 'var(--text-secondary)' }}>
                              Chapter: {tb.chapterTitle}
                            </p>
                          )}

                          <div
                            style={{
                              marginTop: 'auto',
                              paddingTop: 'var(--spacing-3)',
                              display: 'flex',
                              gap: 'var(--spacing-2)'
                            }}
                          >
                            <Link href="/lessons" style={{ flexGrow: 1 }}>
                              <Button variant="primary" size="sm" style={{ width: '100%' }}>
                                View Lessons
                              </Button>
                            </Link>
                          </div>
                        </div>
                      </CardBody>
                    </Card>
                  );
                })}
              </div>
            </main>
          )}
        </div>
      </PageContainer>
    </ProtectedRoute>
  );
}
