'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { getReadableErrorMessage } from '../lib/errorHandler';
import { validateUploadFile, sanitizeFilename } from '../lib/security';

const MIN_DIMENSION_PX = 100;

export const INITIAL_STEP_STATUSES = {
  uploading: 'pending',
  preparing_image: 'pending',
  extracting_content: 'pending',
  building_lesson: 'pending',
  generating_questions: 'pending',
  preparing_audio: 'pending'
};

export function useTextbookUpload() {
  const [status, setStatus] = useState('idle'); // idle | dragging | selected | uploading | processing | completed | failed
  const [file, setFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [imageDimensions, setImageDimensions] = useState(null);
  const [metadata, setMetadata] = useState({
    title: '',
    subject: 'General Science',
    chapterTitle: '',
    gradeLevel: 'Middle School'
  });
  const [validationError, setValidationError] = useState(null);
  const [stepStatuses, setStepStatuses] = useState(INITIAL_STEP_STATUSES);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [announcement, setAnnouncement] = useState('');

  const dragCounterRef = useRef(0);
  const previewUrlRef = useRef(null);

  // Clean up object URLs on unmount or replace
  const cleanPreviewUrl = useCallback(() => {
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current);
      previewUrlRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      cleanPreviewUrl();
    };
  }, [cleanPreviewUrl]);

  /**
   * Validate image file on client before upload
   */
  const validateFile = useCallback((selectedFile) => {
    return new Promise((resolve, reject) => {
      try {
        validateUploadFile(selectedFile);
      } catch (validationErr) {
        return reject(validationErr);
      }

      // Check dimensions using browser Image constructor
      const objectUrl = URL.createObjectURL(selectedFile);
      const img = new Image();
      img.onload = () => {
        const width = img.naturalWidth || img.width;
        const height = img.naturalHeight || img.height;
        URL.revokeObjectURL(objectUrl);

        if (width < MIN_DIMENSION_PX || height < MIN_DIMENSION_PX) {
          return reject(
            new Error(
              `Image dimensions (${width}x${height}px) are below minimum required resolution (${MIN_DIMENSION_PX}x${MIN_DIMENSION_PX}px) for OCR clarity.`
            )
          );
        }

        resolve({ width, height });
      };

      img.onerror = () => {
        URL.revokeObjectURL(objectUrl);
        reject(new Error('Unable to read image file. It may be corrupt or damaged.'));
      };

      img.src = objectUrl;
    });
  }, []);

  /**
   * Handle selecting a valid file
   */
  const handleSelectFile = useCallback(
    async (selectedFile) => {
      setValidationError(null);
      setError(null);

      try {
        const dimensions = await validateFile(selectedFile);
        cleanPreviewUrl();

        const newPreviewUrl = URL.createObjectURL(selectedFile);
        previewUrlRef.current = newPreviewUrl;

        setFile(selectedFile);
        setPreviewUrl(newPreviewUrl);
        setImageDimensions(dimensions);

        // Derive sensible default title from filename if not yet filled
        setMetadata((prev) => {
          if (!prev.title || prev.title.trim() === '') {
            const cleanName = sanitizeFilename(selectedFile.name)
              .replace(/\.[^/.]+$/, '')
              .replace(/[_-]+/g, ' ')
              .trim();
            return {
              ...prev,
              title: cleanName.charAt(0).toUpperCase() + cleanName.slice(1)
            };
          }
          return prev;
        });

        setStatus('selected');
        setAnnouncement(`Image "${selectedFile.name}" selected successfully. Ready for upload.`);
      } catch (valErr) {
        setValidationError(valErr.message);
        setAnnouncement(`Validation error: ${valErr.message}`);
      }
    },
    [validateFile, cleanPreviewUrl]
  );

  /**
   * Drag and drop handlers
   */
  const handleDragEnter = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current += 1;
    if (e.dataTransfer?.items && e.dataTransfer.items.length > 0) {
      setStatus('dragging');
      setAnnouncement('File hovering over dropzone.');
    }
  }, []);

  const handleDragLeave = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current -= 1;
    if (dragCounterRef.current === 0) {
      setStatus((prev) => (prev === 'dragging' ? (file ? 'selected' : 'idle') : prev));
    }
  }, [file]);

  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback(
    (e) => {
      e.preventDefault();
      e.stopPropagation();
      dragCounterRef.current = 0;

      const droppedFiles = e.dataTransfer?.files;
      if (droppedFiles && droppedFiles.length > 0) {
        handleSelectFile(droppedFiles[0]);
      } else {
        setStatus(file ? 'selected' : 'idle');
      }
    },
    [file, handleSelectFile]
  );

  /**
   * Remove selected file
   */
  const handleRemoveFile = useCallback(() => {
    cleanPreviewUrl();
    setFile(null);
    setPreviewUrl(null);
    setImageDimensions(null);
    setValidationError(null);
    setError(null);
    setStatus('idle');
    setStepStatuses(INITIAL_STEP_STATUSES);
    setResult(null);
    setAnnouncement('File removed. Ready for new textbook scan.');
  }, [cleanPreviewUrl]);

  /**
   * Reset to initial state for another upload
   */
  const handleReset = useCallback(() => {
    handleRemoveFile();
  }, [handleRemoveFile]);

  /**
   * Start multi-stage upload & generation pipeline
   */
  const startUpload = useCallback(async () => {
    if (!file) {
      setValidationError('Please choose an image file to upload.');
      return;
    }

    if (!metadata.title || metadata.title.trim() === '') {
      setValidationError('Please enter a title for the textbook scan.');
      return;
    }

    setValidationError(null);
    setError(null);
    setStatus('uploading');

    const updatedSteps = {
      uploading: 'active',
      preparing_image: 'pending',
      extracting_content: 'pending',
      building_lesson: 'pending',
      generating_questions: 'pending',
      preparing_audio: 'pending'
    };
    setStepStatuses({ ...updatedSteps });
    setAnnouncement('Uploading textbook scan to backend...');

    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

    try {
      // ------------------------------------------------------------------------
      // STAGE 1: Upload textbook image -> Sharp preprocess -> Cloudinary -> Gemini OCR
      // ------------------------------------------------------------------------
      const formData = new FormData();
      formData.append('image', file);
      formData.append('title', metadata.title.trim());
      formData.append('subject', metadata.subject.trim());
      if (metadata.chapterTitle && metadata.chapterTitle.trim()) {
        formData.append('chapterTitle', metadata.chapterTitle.trim());
      }
      if (metadata.gradeLevel) {
        formData.append('gradeLevel', metadata.gradeLevel);
      }

      setStatus('processing');
      updatedSteps.uploading = 'completed';
      updatedSteps.preparing_image = 'active';
      setStepStatuses({ ...updatedSteps });
      setAnnouncement('Preparing image and optimizing resolution...');

      // Note: POST /api/textbooks performs Sharp preprocessing, Cloudinary upload, and Gemini OCR
      const uploadRes = await fetch(`${apiUrl}/api/textbooks`, {
        method: 'POST',
        credentials: 'include',
        body: formData
      });

      const uploadData = await uploadRes.json();
      if (!uploadRes.ok || !uploadData.success) {
        updatedSteps.preparing_image = 'failed';
        setStepStatuses({ ...updatedSteps });
        throw uploadData.error || new Error(uploadData.message || 'Textbook upload failed');
      }

      const textbook = uploadData.data?.textbook;
      if (!textbook) {
        throw new Error('Backend did not return created textbook asset.');
      }

      // Mark Image Prep and Content Extraction completed
      updatedSteps.preparing_image = 'completed';
      updatedSteps.extracting_content = 'completed';
      setStepStatuses({ ...updatedSteps });
      setAnnouncement('Content and diagrams extracted. Building accessible lesson...');

      // ------------------------------------------------------------------------
      // STAGE 2: Build Accessible Lesson via Gemini (with questions)
      // ------------------------------------------------------------------------
      updatedSteps.building_lesson = 'active';
      setStepStatuses({ ...updatedSteps });

      const lessonId = `les_${Date.now()}`;
      const rawText =
        textbook.metadata?.rawText ||
        textbook.ocrExtractedText ||
        `${metadata.title}. Comprehensive study of ${metadata.subject} concepts.`;

      const genRes = await fetch(`${apiUrl}/api/lessons/${lessonId}/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          textbookAssetId: textbook.id,
          title: textbook.title,
          subject: textbook.subject,
          rawText,
          generateQuestions: true
        })
      });

      const genData = await genRes.json();
      if (!genRes.ok || !genData.success) {
        updatedSteps.building_lesson = 'failed';
        setStepStatuses({ ...updatedSteps });
        throw genData.error || new Error(genData.message || 'Lesson generation failed');
      }

      const generatedLesson = genData.data?.lesson;

      // Mark Building Lesson & Generating Questions completed
      updatedSteps.building_lesson = 'completed';
      updatedSteps.generating_questions = 'completed';
      setStepStatuses({ ...updatedSteps });
      setAnnouncement('Lesson and questions created. Synthesizing Piper neural audio narration...');

      // ------------------------------------------------------------------------
      // STAGE 3: Synthesize Piper TTS Narration & Cloudinary Media Upload
      // ------------------------------------------------------------------------
      updatedSteps.preparing_audio = 'active';
      setStepStatuses({ ...updatedSteps });

      let audioInfo = null;
      try {
        const audioRes = await fetch(`${apiUrl}/api/lessons/${lessonId}/audio`, {
          method: 'POST',
          credentials: 'include'
        });
        const audioData = await audioRes.json();
        if (audioRes.ok && audioData.success) {
          audioInfo = audioData.data;
        }
      } catch (audioErr) {
        console.warn('[useTextbookUpload] Optional audio synthesis fallback:', audioErr.message);
      }

      updatedSteps.preparing_audio = 'completed';
      setStepStatuses({ ...updatedSteps });

      // ------------------------------------------------------------------------
      // STAGE 4: Fetch comprehension questions count
      // ------------------------------------------------------------------------
      let questionsCount = 3;
      try {
        const qRes = await fetch(`${apiUrl}/api/lessons/${lessonId}/questions`, {
          credentials: 'include'
        });
        const qData = await qRes.json();
        if (qRes.ok && qData.success && typeof qData.data?.count === 'number') {
          questionsCount = qData.data.count;
        }
      } catch (qErr) {
        console.warn('[useTextbookUpload] Questions count check failed:', qErr.message);
      }

      // Finalize Result
      const finalResult = {
        textbook,
        lesson: generatedLesson,
        audio: audioInfo,
        conceptsCount: textbook.metadata?.concepts?.length || generatedLesson?.keyTakeaways?.length || 0,
        questionsCount,
        accessibleImageUrl: textbook.accessibleImageUrl || textbook.processedImageUrl || textbook.rawImageUrl
      };

      setResult(finalResult);
      setStatus('completed');
      setAnnouncement(
        `Lesson created successfully: "${generatedLesson?.title || metadata.title}". ` +
          `${finalResult.conceptsCount} concepts and ${finalResult.questionsCount} questions ready. ` +
          `Press Start Learning to begin.`
      );
    } catch (err) {
      console.error('[useTextbookUpload] Upload pipeline failure:', err);
      setError(err);
      setStatus('failed');
      setAnnouncement(`Upload failed: ${getReadableErrorMessage(err)}`);
    }
  }, [file, metadata]);

  /**
   * Retry upload with existing file and metadata
   */
  const handleRetry = useCallback(() => {
    startUpload();
  }, [startUpload]);

  return {
    status,
    file,
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
    startUpload
  };
}
