'use client';

import React from 'react';
import Link from 'next/link';
import Script from 'next/script';
import { PageContainer } from '../../components/shell';
import { ProtectedRoute } from '../../components/auth';
import { Card, CardBody, Badge, Button } from '../../components/ui';
import { useTextbookUpload } from '../../hooks/useTextbookUpload';
import {
  Dropzone,
  ImagePreview,
  ProcessingProgress,
  SuccessView,
  FailureView
} from '../../components/upload';

export default function UploadPage() {
  const {
    status,
    file,
    cloudinaryAsset,
    previewUrl,
    imageDimensions,
    metadata,
    setMetadata,
    validationError,
    stepStatuses,
    result,
    error,
    announcement,
    handleSelectFile,
    handleDragEnter,
    handleDragLeave,
    handleDragOver,
    handleDrop,
    handleRemoveFile,
    handleRetry,
    handleReset,
    openCloudinaryWidget,
    startUpload
  } = useTextbookUpload();

  return (
    <ProtectedRoute>
      <Script
        id="cloudinary-widget-loader"
        src="https://upload-widget.cloudinary.com/global/all.js"
        strategy="afterInteractive"
      />
      <PageContainer>
        <div className="stack-lg">
          {/* Accessible Screen Reader Announcer */}
          <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">
            {announcement}
          </div>

          {/* Header */}
          <header className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <div className="flex items-center gap-2" style={{ marginBottom: 'var(--spacing-1)' }}>
                <Badge variant="accent">Cloudinary & Gemini Powered</Badge>
                <Badge variant="secondary">Piper TTS</Badge>
              </div>
              <h1 className="text-h1">Intelligent Textbook Upload</h1>
              <p className="text-body" style={{ color: 'var(--text-secondary)' }}>
                Upload original textbook page scans to automatically generate accessible multimodal lessons, tactile analogies, and neural audio.
              </p>
            </div>

            <Link href="/textbooks">
              <Button variant="outline" size="sm">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
                  <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
                </svg>
                <span>View Textbooks Library</span>
              </Button>
            </Link>
          </header>

          {/* Main Upload Stage Views */}
          <main id="main-content" tabIndex={-1}>
            {/* 1. Idle & Dragging State */}
            {(status === 'idle' || status === 'dragging') && (
              <div className="stack-lg">
                <Dropzone
                  status={status}
                  validationError={validationError}
                  onSelectFile={handleSelectFile}
                  onDragEnter={handleDragEnter}
                  onDragLeave={handleDragLeave}
                  onDragOver={handleDragOver}
                  onDrop={handleDrop}
                  onOpenCloudinaryWidget={openCloudinaryWidget}
                />

                {/* Scan Tips for Visually Impaired & Sighted Learners */}
                <Card>
                  <CardBody>
                    <div className="stack-sm">
                      <h3 className="text-h3" style={{ fontSize: '1.15rem' }}>Tips for Optimal Accessibility Processing</h3>
                      <div className="grid grid-cols-1 grid-cols-md-3 gap-4" style={{ marginTop: 'var(--spacing-2)' }}>
                        <div className="flex gap-3">
                          <div
                            style={{
                              width: '32px',
                              height: '32px',
                              borderRadius: 'var(--radius-full)',
                              backgroundColor: 'rgba(37, 99, 235, 0.1)',
                              color: 'var(--color-primary-600)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontWeight: 'bold',
                              flexShrink: 0
                            }}
                          >
                            1
                          </div>
                          <div>
                            <div className="font-semibold text-small">Good Contrast & Lighting</div>
                            <p className="text-caption" style={{ color: 'var(--text-secondary)' }}>
                              Ensure even light across the textbook page without harsh shadows over diagrams.
                            </p>
                          </div>
                        </div>

                        <div className="flex gap-3">
                          <div
                            style={{
                              width: '32px',
                              height: '32px',
                              borderRadius: 'var(--radius-full)',
                              backgroundColor: 'rgba(37, 99, 235, 0.1)',
                              color: 'var(--color-primary-600)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontWeight: 'bold',
                              flexShrink: 0
                            }}
                          >
                            2
                          </div>
                          <div>
                            <div className="font-semibold text-small">Flat Orientation</div>
                            <p className="text-caption" style={{ color: 'var(--text-secondary)' }}>
                              Align the page as straight as possible. Sharp edge-detection auto-rotates within 15 degrees.
                            </p>
                          </div>
                        </div>

                        <div className="flex gap-3">
                          <div
                            style={{
                              width: '32px',
                              height: '32px',
                              borderRadius: 'var(--radius-full)',
                              backgroundColor: 'rgba(37, 99, 235, 0.1)',
                              color: 'var(--color-primary-600)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontWeight: 'bold',
                              flexShrink: 0
                            }}
                          >
                            3
                          </div>
                          <div>
                            <div className="font-semibold text-small">Multi-sensory Diagrams</div>
                            <p className="text-caption" style={{ color: 'var(--text-secondary)' }}>
                              Charts and diagrams are automatically converted into spatial, tactile verbal descriptions.
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardBody>
                </Card>
              </div>
            )}

            {/* 2. Selected State: Image Preview & Metadata Input */}
            {status === 'selected' && (
              <ImagePreview
                file={file}
                cloudinaryAsset={cloudinaryAsset}
                previewUrl={previewUrl}
                imageDimensions={imageDimensions}
                metadata={metadata}
                setMetadata={setMetadata}
                validationError={validationError}
                onReplaceFile={handleSelectFile}
                onOpenCloudinaryWidget={openCloudinaryWidget}
                onRemoveFile={handleRemoveFile}
                onStartUpload={startUpload}
              />
            )}

            {/* 3. Uploading & Processing State: Step-by-Step Progress Pipeline */}
            {(status === 'uploading' || status === 'processing') && (
              <ProcessingProgress stepStatuses={stepStatuses} />
            )}

            {/* 4. Completed State: Success View with Result Summary & Start Learning Button */}
            {status === 'completed' && (
              <SuccessView
                result={result}
                onUploadAnother={handleReset}
              />
            )}

            {/* 5. Failed State: What Went Wrong & Retry Options */}
            {status === 'failed' && (
              <div className="stack">
                <FailureView
                  error={error}
                  file={file}
                  onRetry={handleRetry}
                  onChooseAnother={handleReset}
                />
              </div>
            )}
          </main>
        </div>
      </PageContainer>
    </ProtectedRoute>
  );
}
