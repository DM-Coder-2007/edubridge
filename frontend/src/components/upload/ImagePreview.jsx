'use client';

import React, { useRef } from 'react';
import { Card, CardHeader, CardTitle, CardBody, Button, Input } from '../ui';

export function ImagePreview({
  file,
  previewUrl,
  imageDimensions,
  metadata,
  setMetadata,
  validationError,
  onReplaceFile,
  onRemoveFile,
  onStartUpload
}) {
  const fileInputRef = useRef(null);

  const formatFileSize = (bytes) => {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const handleTriggerReplace = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleFileChange = (e) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      onReplaceFile(files[0]);
    }
    e.target.value = '';
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Selected Textbook Scan</CardTitle>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleTriggerReplace}
            aria-label="Replace current image"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />
            </svg>
            <span>Replace</span>
          </Button>

          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onRemoveFile}
            style={{ color: 'var(--color-danger-600)' }}
            aria-label="Remove current image"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <polyline points="3 6 5 6 21 6" />
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
            </svg>
            <span>Remove</span>
          </Button>
        </div>
      </CardHeader>

      <CardBody>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/tiff,image/bmp"
          onChange={handleFileChange}
          className="upload-file-input-hidden"
          tabIndex={-1}
          aria-hidden="true"
        />

        {validationError && (
          <div
            className="alert alert-danger"
            role="alert"
            style={{ marginBottom: 'var(--spacing-4)' }}
          >
            <div>
              <div className="alert-title">Required Information Missing</div>
              <div className="alert-description">{validationError}</div>
            </div>
          </div>
        )}

        <div className="upload-preview-wrapper">
          {/* Visual Scan Preview */}
          <div className="upload-preview-frame">
            {previewUrl && (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={previewUrl}
                alt={`Preview of textbook page: ${file?.name || 'Selected scan'}`}
                className="upload-preview-img"
              />
            )}
            <div className="upload-preview-badge-overlay">
              <span>{file?.name}</span>
              {imageDimensions && (
                <span> • {imageDimensions.width}×{imageDimensions.height}px</span>
              )}
              {file?.size && <span> • {formatFileSize(file.size)}</span>}
            </div>
          </div>

          {/* Lesson Metadata Form */}
          <form
            className="upload-meta-form"
            onSubmit={(e) => {
              e.preventDefault();
              onStartUpload();
            }}
          >
            <div className="stack-xs">
              <h3 className="text-h3" style={{ fontSize: '1.15rem' }}>Lesson Configuration</h3>
              <p className="text-caption" style={{ color: 'var(--text-muted)' }}>
                Provide context for Gemini to tailor the multimodal accessible lesson.
              </p>
            </div>

            <Input
              label="Textbook or Chapter Title"
              placeholder="e.g. Photosynthesis and Plant Cells"
              value={metadata.title}
              onChange={(e) => setMetadata((m) => ({ ...m, title: e.target.value }))}
              required
              helperText="Authoritative lesson title generated into Snowflake"
            />

            <div className="grid grid-cols-1 grid-cols-sm-2 gap-3">
              <Input
                label="Academic Subject"
                placeholder="e.g. Biology, Physics, History"
                value={metadata.subject}
                onChange={(e) => setMetadata((m) => ({ ...m, subject: e.target.value }))}
              />

              <Input
                label="Chapter / Unit (Optional)"
                placeholder="e.g. Chapter 4"
                value={metadata.chapterTitle}
                onChange={(e) => setMetadata((m) => ({ ...m, chapterTitle: e.target.value }))}
              />
            </div>

            <div className="input-wrapper">
              <label htmlFor="gradeLevel" className="input-label">
                Target Grade Level
              </label>
              <select
                id="gradeLevel"
                className="input input-md"
                value={metadata.gradeLevel}
                onChange={(e) => setMetadata((m) => ({ ...m, gradeLevel: e.target.value }))}
              >
                <option value="Elementary">Elementary (Grades 1-5)</option>
                <option value="Middle School">Middle School (Grades 6-8)</option>
                <option value="High School">High School (Grades 9-12)</option>
                <option value="College">College / Advanced</option>
              </select>
            </div>

            <div style={{ marginTop: 'var(--spacing-4)' }}>
              <Button
                type="submit"
                variant="primary"
                size="lg"
                fullWidth
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <path d="M12 2v10M17 7l-5-5-5 5" />
                  <path d="M2 17l10 5 10-5" />
                  <path d="M2 12l10 5 10-5" />
                </svg>
                <span>Upload & Generate Lesson</span>
              </Button>
            </div>
          </form>
        </div>
      </CardBody>
    </Card>
  );
}
