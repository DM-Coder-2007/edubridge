'use client';

import React, { useRef } from 'react';
import { Button, Badge } from '../ui';

export function Dropzone({
  status,
  validationError,
  onSelectFile,
  onDragEnter,
  onDragLeave,
  onDragOver,
  onDrop,
  onOpenCloudinaryWidget
}) {
  const fileInputRef = useRef(null);

  const handleClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleClick();
    }
  };

  const handleInputChange = (e) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      onSelectFile(files[0]);
    }
    // Clear input value so same file can be re-selected if removed
    e.target.value = '';
  };

  const isDragging = status === 'dragging';
  const hasError = Boolean(validationError);

  return (
    <div className="stack">
      {hasError && (
        <div
          className="alert alert-danger"
          role="alert"
          aria-live="assertive"
          style={{ marginBottom: 'var(--spacing-2)' }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <div>
            <div className="alert-title">Invalid File</div>
            <div className="alert-description">{validationError}</div>
          </div>
        </div>
      )}

      <div
        className={`upload-dropzone ${isDragging ? 'upload-dropzone--dragging' : ''} ${hasError ? 'upload-dropzone--error' : ''}`}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        onDragEnter={onDragEnter}
        onDragLeave={onDragLeave}
        onDragOver={onDragOver}
        onDrop={onDrop}
        role="button"
        tabIndex={0}
        aria-label="Upload textbook page scan. Use the Cloudinary upload button, browse files, or drag and drop an image file here."
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/tiff,image/bmp"
          onChange={handleInputChange}
          className="upload-file-input-hidden"
          tabIndex={-1}
          aria-hidden="true"
        />

        <div className="upload-dropzone-icon" aria-hidden="true">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="17 8 12 3 7 8" />
            <line x1="12" y1="3" x2="12" y2="15" />
          </svg>
        </div>

        <div className="stack-xs text-center">
          <div className="text-h3" style={{ fontSize: '1.25rem' }}>
            {isDragging ? 'Drop your textbook scan here' : 'Scan or upload textbook page'}
          </div>
          <p className="text-body" style={{ color: 'var(--text-secondary)' }}>
            Upload via the Cloudinary Widget, drag & drop your page scan, or choose a file from your device
          </p>
        </div>

        <div className="flex gap-2 flex-wrap items-center justify-center">
          <Badge variant="secondary">JPEG</Badge>
          <Badge variant="secondary">PNG</Badge>
          <Badge variant="secondary">WEBP</Badge>
          <Badge variant="secondary">TIFF</Badge>
          <Badge variant="secondary">Up to 25 MB</Badge>
          <Badge variant="primary">Min 100×100 px</Badge>
        </div>

        <div className="flex gap-3 flex-wrap items-center justify-center" style={{ marginTop: 'var(--spacing-2)' }}>
          {onOpenCloudinaryWidget && (
            <Button
              type="button"
              variant="primary"
              size="md"
              onClick={(e) => {
                e.stopPropagation();
                onOpenCloudinaryWidget();
              }}
              aria-label="Upload image using Cloudinary Upload Widget"
              id="cloudinary-upload-widget-btn"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z" />
                <polyline points="12 12 12 16 12 12" />
                <polyline points="9 13 12 10 15 13" />
              </svg>
              <span>Upload via Cloudinary Widget</span>
            </Button>
          )}

          <Button
            type="button"
            variant="outline"
            size="md"
            onClick={(e) => {
              e.stopPropagation();
              handleClick();
            }}
            aria-label="Browse files from device"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
              <circle cx="8.5" cy="8.5" r="1.5" />
              <polyline points="21 15 16 10 5 21" />
            </svg>
            <span>Choose Image File</span>
          </Button>
        </div>
      </div>
    </div>
  );
}
