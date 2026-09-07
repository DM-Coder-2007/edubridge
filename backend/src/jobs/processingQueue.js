/**
 * EduBridge Adaptive - Background Processing Job Queue
 * 
 * In-memory resilient async job runner for long-running multimodal AI
 * and neural speech synthesis jobs.
 */

const logger = require('../utils/logger');

class ProcessingQueue {
  constructor() {
    this.jobs = new Map();
  }

  addJob(jobId, jobData, processFn) {
    const initialJobState = {
      id: jobId,
      status: 'PROCESSING',
      step: 'UPLOADING',
      progressPercent: 10,
      assetId: jobData.assetId || null,
      lessonId: null,
      createdAt: new Date().toISOString(),
      data: jobData
    };

    this.jobs.set(jobId, initialJobState);

    // Execute asynchronously
    setImmediate(async () => {
      try {
        const result = await processFn(jobData, (step, progressPercent, extraData = {}) => {
          this.updateJobStep(jobId, step, progressPercent, extraData);
        });

        const current = this.jobs.get(jobId) || {};
        this.jobs.set(jobId, {
          ...current,
          status: 'COMPLETED',
          step: 'COMPLETED',
          progressPercent: 100,
          result,
          lessonId: result?.lesson?.id || result?.lessonId || current.lessonId,
          completedAt: new Date().toISOString()
        });
        logger.info(`[ProcessingQueue] Job ${jobId} finished successfully.`);
      } catch (err) {
        const current = this.jobs.get(jobId) || {};
        this.jobs.set(jobId, {
          ...current,
          status: 'FAILED',
          step: 'FAILED',
          error: err.message,
          failedAt: new Date().toISOString()
        });
        logger.error(`[ProcessingQueue] Job ${jobId} failed:`, err.message);
      }
    });

    return this.jobs.get(jobId);
  }

  updateJobStep(jobId, step, progressPercent, extraData = {}) {
    const existing = this.jobs.get(jobId);
    if (!existing) return;

    this.jobs.set(jobId, {
      ...existing,
      step,
      progressPercent: progressPercent !== undefined ? progressPercent : existing.progressPercent,
      lessonId: extraData.lessonId || existing.lessonId,
      assetId: extraData.assetId || existing.assetId,
      updatedAt: new Date().toISOString(),
      ...extraData
    });
  }

  getJob(jobId) {
    return this.jobs.get(jobId) || null;
  }
}

module.exports = new ProcessingQueue();
