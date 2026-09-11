/**
 * EduBridge Adaptive - Structured OCR Output Schema
 *
 * Defines the canonical data contract for multimodal OCR results extracted
 * from textbook scans via Gemini Vision and processed for visually impaired students.
 */

/**
 * Creates an empty structured OCR result with valid default structures
 *
 * @param {object} [overrides={}] - Initial values
 * @returns {object} Canonical OCR data structure
 */
function createDefaultOcrResult(overrides = {}) {
  return {
    title: overrides.title || 'Untitled Textbook Page',
    rawText: overrides.rawText || '',
    sections: Array.isArray(overrides.sections) ? overrides.sections : [],
    concepts: Array.isArray(overrides.concepts) ? overrides.concepts : [],
    formulas: Array.isArray(overrides.formulas) ? overrides.formulas : [],
    examples: Array.isArray(overrides.examples) ? overrides.examples : [],
    diagramDescriptions: Array.isArray(overrides.diagramDescriptions) ? overrides.diagramDescriptions : [],
    qualityMetrics: {
      confidenceScore: overrides.qualityMetrics?.confidenceScore || 0.95,
      isLowQuality: Boolean(overrides.qualityMetrics?.isLowQuality),
      detectedLanguage: overrides.qualityMetrics?.detectedLanguage || 'en',
      resolution: {
        width: overrides.qualityMetrics?.resolution?.width || 0,
        height: overrides.qualityMetrics?.resolution?.height || 0
      }
    }
  };
}

/**
 * Normalizes raw Gemini output into the strict canonical EduBridge OCR schema.
 * Tolerates variations in key names from AI generation.
 *
 * @param {object} rawOutput - Raw parsed JSON response from Gemini
 * @param {object} [extraContext={}] - Additional context (metadata, resolution)
 * @returns {object} Guaranteed canonical structure
 */
function normalizeOcrResult(rawOutput = {}, extraContext = {}) {
  const result = createDefaultOcrResult();

  // 1. Title
  result.title = String(rawOutput.title || rawOutput.chapterTitle || rawOutput.heading || extraContext.title || 'Untitled Lesson').trim();

  // 2. Raw Text
  result.rawText = String(rawOutput.rawText || rawOutput.extractedText || rawOutput.text || '').trim();

  // 3. Sections
  if (Array.isArray(rawOutput.sections)) {
    result.sections = rawOutput.sections.map((sec, idx) => {
      let content = sec.content !== undefined ? sec.content : (sec.text !== undefined ? sec.text : (sec.body || ''));
      let textContent = '';
      if (Array.isArray(content)) {
        textContent = content
          .map(item => (typeof item === 'object' && item !== null ? (item.text || JSON.stringify(item)) : String(item)))
          .join('\n\n')
          .trim();
      } else {
        textContent = String(content || '').trim();
      }

      return {
        heading: String(sec.heading || sec.title || `Section ${idx + 1}`).trim(),
        content: textContent,
        structuredContent: Array.isArray(content) ? content : [{ type: 'paragraph', text: textContent }],
        orderIndex: typeof sec.orderIndex === 'number' ? sec.orderIndex : idx + 1
      };
    });
  } else if (result.rawText) {
    // If raw sections weren't explicitly split by Gemini, create a primary section
    result.sections = [{
      heading: result.title,
      content: result.rawText,
      structuredContent: [{ type: 'paragraph', text: result.rawText }],
      orderIndex: 1
    }];
  }

  // Synthesize rawText from sections if rawText was empty
  if (!result.rawText && result.sections.length > 0) {
    result.rawText = result.sections.map(s => `${s.heading}\n\n${s.content}`).join('\n\n').trim();
  }

  // 4. Concepts
  if (Array.isArray(rawOutput.concepts)) {
    result.concepts = rawOutput.concepts.map(c => {
      if (typeof c === 'string') {
        return {
          name: c,
          description: c,
          visualCue: '',
          tactileAnalogy: ''
        };
      }
      return {
        name: String(c.name || c.topic || 'Core Concept').trim(),
        description: String(c.description || c.explanation || '').trim(),
        visualCue: String(c.visualCue || c.diagram || '').trim(),
        tactileAnalogy: String(c.tactileAnalogy || c.simplifiedAnalogy || '').trim()
      };
    });
  } else if (Array.isArray(rawOutput.keyTopics)) {
    result.concepts = rawOutput.keyTopics.map(topic => ({
      name: String(topic).trim(),
      description: `Educational concept extracted from ${result.title}`,
      visualCue: '',
      tactileAnalogy: ''
    }));
  }

  // 5. Formulas / Equations
  if (Array.isArray(rawOutput.formulas)) {
    result.formulas = rawOutput.formulas.map(f => {
      if (typeof f === 'string') {
        return { latex: f, explanation: f, plainText: f };
      }
      return {
        latex: String(f.latex || f.equation || '').trim(),
        explanation: String(f.explanation || f.meaning || '').trim(),
        plainText: String(f.plainText || f.audioFormat || f.latex || '').trim()
      };
    });
  }

  // 6. Examples / Exercises
  if (Array.isArray(rawOutput.examples)) {
    result.examples = rawOutput.examples.map((ex, idx) => ({
      title: String(ex.title || `Example ${idx + 1}`).trim(),
      problem: String(ex.problem || ex.question || '').trim(),
      solution: String(ex.solution || ex.answer || '').trim()
    }));
  }

  // 7. Diagram & Figure Descriptions (Spatial & Tactile)
  if (Array.isArray(rawOutput.diagramDescriptions)) {
    result.diagramDescriptions = rawOutput.diagramDescriptions.map((diag, idx) => {
      if (typeof diag === 'string') {
        return {
          figureIndex: idx + 1,
          caption: `Figure ${idx + 1}`,
          spatialLayout: 'Visual diagram on textbook page',
          tactileDescription: diag,
          audioDescription: diag
        };
      }
      return {
        figureIndex: typeof diag.figureIndex === 'number' ? diag.figureIndex : idx + 1,
        caption: String(diag.caption || `Figure ${idx + 1}`).trim(),
        spatialLayout: String(diag.spatialLayout || '').trim(),
        tactileDescription: String(diag.tactileDescription || diag.tactileGuide || '').trim(),
        audioDescription: String(diag.audioDescription || diag.description || '').trim()
      };
    });
  }

  // 8. Quality metrics
  result.qualityMetrics = {
    confidenceScore: typeof rawOutput.confidenceScore === 'number' ? rawOutput.confidenceScore : 0.95,
    isLowQuality: Boolean(extraContext.isLowQuality),
    detectedLanguage: rawOutput.language || 'en',
    resolution: {
      width: extraContext.resolution?.width || 0,
      height: extraContext.resolution?.height || 0
    }
  };

  // 9. Additional Structured Metadata (Requirement 8)
  result.excludedContent = Array.isArray(rawOutput.excludedContent) ? rawOutput.excludedContent : [];
  result.needsReview = Boolean(rawOutput.needsReview);
  result.overallConfidence = typeof rawOutput.overallConfidence === 'number'
    ? rawOutput.overallConfidence
    : (typeof rawOutput.confidence === 'number' ? rawOutput.confidence : result.qualityMetrics.confidenceScore);

  return result;
}

module.exports = {
  createDefaultOcrResult,
  normalizeOcrResult
};
