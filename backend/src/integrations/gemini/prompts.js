/**
 * EduBridge Adaptive - Gemini Prompt Engineering Templates
 *
 * Designed specifically for visually impaired learners:
 * - Emphasizes spatial descriptions, audio cues, tactile analogies, and voice prompts
 * - Enforces strict, schema-compliant JSON outputs
 */

const Prompts = {
  /**
   * Prompt for Multimodal OCR and Diagram Spatial Description (Authoritative Image Source)
   */
  textbookOcr: ({ title, subject, chapterTitle }) => `You are the visual content extraction engine for an educational application.
Analyze the uploaded textbook/lesson image directly.
The pixels in the uploaded image are the authoritative source.

Extract only information that is visibly supported by the image.
Do not assume the topic from the filename.
Do not infer missing text.
Do not fill unreadable areas using general knowledge.
Do not invent facts.
Do not invent headings.
Do not invent examples.
Do not invent diagrams.
Do not invent labels.
Do not invent formulas.
If text is unreadable, explicitly mark it as unreadable or uncertain.
If a diagram is present, describe only visible relationships and labels.
If a chart is present, identify visible axes, labels, legends, values and trends.
If a table is present, extract its visible rows and columns.
If a mathematical expression is present, preserve it carefully.
If the image contains multiple sections, preserve their order.
If the page contains images alongside text, analyze both.

DETERMINE CONTENT TYPE:
Classify image into one of: TEXTBOOK_PAGE, DIAGRAM, CHART, GRAPH, TABLE, MATHEMATICAL_CONTENT, SCIENCE_FIGURE, MAP, INFOGRAPHIC, SLIDE, WORKSHEET, QUESTION_PAPER, HANDWRITTEN_NOTES, MIXED_CONTENT, OTHER.

Respond ONLY with valid JSON conforming to this structure:
{
  "title": "${title || 'Lesson Title'}",
  "documentTitle": "${title || 'Textbook Page'}",
  "pageNumber": null,
  "contentType": "TEXTBOOK_PAGE",
  "language": "en",
  "headings": [],
  "paragraphs": [],
  "lists": [],
  "keyTerms": [],
  "definitions": [],
  "examples": [],
  "captions": [],
  "figures": [],
  "diagrams": [],
  "tables": [],
  "charts": [],
  "formulas": [],
  "labels": [],
  "importantFacts": [],
  "questions": [],
  "uncertainContent": [],
  "visualObservations": [],
  "rawText": "Full plain extracted text...",
  "sections": [
    { "heading": "Section Heading", "content": "Section text...", "orderIndex": 1 }
  ],
  "concepts": [
    { "name": "Concept Name", "description": "Clear explanation", "visualCue": "Spatial cue", "tactileAnalogy": "Everyday tactile analogy" }
  ],
  "diagramDescriptions": [
    {
      "figureIndex": 1,
      "caption": "Figure Caption",
      "spatialLayout": "Top left to bottom right orientation...",
      "tactileDescription": "Raised border with smooth interior...",
      "audioDescription": "Detailed spoken description for screen reader..."
    }
  ],
  "confidenceScore": 0.95
}`,

  imageAnalysis: ({ title, subject, gradeLevel }) => `You are the visual content extraction engine for an educational application.
Analyze the uploaded textbook/lesson image directly.
The pixels in the uploaded image are the authoritative source.

Extract only information that is visibly supported by the image.
Do not assume the topic from the filename.
Do not infer missing text.
Do not fill unreadable areas using general knowledge.
Do not invent facts.
Do not invent headings.
Do not invent examples.
Do not invent diagrams.
Do not invent labels.
Do not invent formulas.
If text is unreadable, explicitly mark it as unreadable or uncertain.
If a diagram is present, describe only visible relationships and labels.
If a chart is present, identify visible axes, labels, legends, values and trends.
If a table is present, extract its visible rows and columns.
If a mathematical expression is present, preserve it carefully.
If the image contains multiple sections, preserve their order.
If the page contains images alongside text, analyze both.

Respond ONLY with valid JSON.`,

  /**
   * Prompt for Multimodal Accessible Lesson Generation based strictly on extracted source
   */
  lessonGeneration: ({ textbookTitle, subject, gradeLevel, extractedContent, diagramDescriptions = [] }) => `You are a master accessibility curriculum designer creating a student-friendly lesson based ONLY on the verified extracted source content.
Textbook: ${textbookTitle}
Subject: ${subject}
Grade Level: ${gradeLevel}

VERIFIED EXTRACTED SOURCE CONTENT:
${typeof extractedContent === 'string' ? extractedContent : JSON.stringify(extractedContent)}

DIAGRAM DESCRIPTIONS:
${diagramDescriptions.join('; ')}

RULES FOR LESSON GENERATION:
- Do NOT introduce unsupported facts or world knowledge not present in the extracted source.
- Simplify difficult language while preserving factual meaning.
- Clearly distinguish source content from AI explanation.
- Replace visual jargon ("as seen here") with concrete acoustic and tactile analogies for visually impaired students.

Output ONLY valid JSON:
{
  "title": "${textbookTitle || 'Accessible Lesson'}",
  "summary": "2-sentence audio summary",
  "simplifiedText": "Full readable lesson formatted naturally for speech narration...",
  "screenReaderTranscript": "Full transcript with explicit auditory cues and spatial markers...",
  "sourceContent": {
    "heading": "Extracted Heading",
    "paragraphs": ["Extracted Paragraph 1..."],
    "keyTerms": ["Term 1"]
  },
  "aiExplanation": {
    "simpleExplanation": "Simplified student-friendly audio explanation...",
    "analogy": "Tactile or acoustic analogy",
    "additionalContext": "Pedagogical scaffolding"
  },
  "sections": [
    {
      "sectionTitle": "Section Title",
      "content": "Section text...",
      "sourceReferences": [{ "type": "paragraph", "index": 1 }]
    }
  ],
  "concepts": [
    {
      "name": "Concept Name",
      "description": "Clear, accessible explanation",
      "visualCue": "Spatial layout cue",
      "tactileAnalogy": "Concrete real-world tactile analogy"
    }
  ],
  "analogies": [
    {
      "targetConcept": "Concept Name",
      "sensoryModality": "tactile",
      "analogy": "Analogy text...",
      "physicalAnchor": "Everyday object"
    }
  ],
  "examples": [
    { "title": "Example", "problem": "Scenario", "solution": "Explanation" }
  ],
  "takeaways": [
    "Key takeaway point 1",
    "Key takeaway point 2"
  ],
  "sourceReferences": [{ "type": "paragraph", "index": 1 }]
}`,

  /**
   * Prompt for Grounding Validation
   */
  groundingValidation: ({ extractedSource, generatedLesson }) => `You are an educational quality auditor.
Extracted Source Content from textbook image:
${typeof extractedSource === 'string' ? extractedSource : JSON.stringify(extractedSource)}

Generated Lesson Content:
${typeof generatedLesson === 'string' ? generatedLesson : JSON.stringify(generatedLesson)}

TASK:
Verify whether each meaningful claim in the generated lesson is supported by the extracted source content.
Identify any unsupported claims or external facts that were not present in the source image.

Output strictly valid JSON:
{
  "groundingScore": 0.95,
  "claims": [
    {
      "claim": "Claim text from lesson",
      "supported": true,
      "sourceReferences": [{ "type": "paragraph", "index": 1 }]
    }
  ],
  "unsupportedClaims": [],
  "warnings": []
}`,

  /**
   * Prompt for Text-to-Speech Narration Script Formatting
   */
  narrationScript: ({ title, summary, sourceContent, aiExplanation }) => `Convert the following verified educational lesson into a clean, smooth, natural speech script for text-to-speech synthesis:

Title: ${title}
Summary: ${summary}
Source Content: ${typeof sourceContent === 'string' ? sourceContent : JSON.stringify(sourceContent)}
Explanation: ${typeof aiExplanation === 'string' ? aiExplanation : JSON.stringify(aiExplanation)}

STRICT RULES FOR NARRATION SCRIPT:
- No Markdown formatting (no asterisks, hashes, backticks, or bullets)
- No JSON or code syntax
- No UI instructions or source reference citations (no "[paragraph 1]")
- Pronounce mathematical and scientific symbols in clear spoken words
- Expand common abbreviations naturally
- Use short, natural, conversational sentences suitable for speech
- Do NOT introduce any new facts not present in the lesson

Output ONLY the plain speech text script.`,

  /**
   * Prompt for Comprehension Questions Generation
   */
  questionGeneration: ({ lessonTitle, subject, concepts = [], count = 3, targetDifficulty = 'medium' }) => `You are an educational assessment architect specializing in voice-accessible testing for blind students.
Lesson: ${lessonTitle}
Subject: ${subject}
Concepts to test: ${concepts.map(c => c.name || c).join(', ')}
Difficulty: ${targetDifficulty}
Target Count: ${count}

REQUIREMENTS:
- Design voice-friendly multiple-choice or speech-prompt questions.
- Include an "audioPromptHint" instructing the student how to respond by speech (e.g. "Say option 1, 2, 3, or 4").
- Each question MUST have exactly one verified "correctAnswer" and a thorough "explanation".

Output strictly valid JSON:
{
  "questions": [
    {
      "questionText": "Clear question text?",
      "questionType": "MULTIPLE_CHOICE",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correctAnswer": "Option A",
      "explanation": "Why this answer is correct",
      "audioPromptHint": "Say option 1, 2, 3, or 4",
      "difficultyLevel": "${targetDifficulty}",
      "conceptId": "optional_concept_name"
    }
  ]
}`,

  /**
   * Prompt for Student Answer Evaluation
   */
  answerEvaluation: ({ questionText, correctAnswer, explanation, studentAnswer, conceptName }) => `You are a supportive, warm educational evaluator assessing a visually impaired student's verbal or typed response.
Question: ${questionText}
Concept: ${conceptName || 'Core Concept'}
Correct Answer: ${correctAnswer}
Standard Explanation: ${explanation}
Student's Response: "${studentAnswer}"

TASK:
1. Determine if the student demonstrates understanding of the core concept.
2. Accept synonyms, speech recognition transcription approximations, and colloquial phrasing.
3. If incorrect, pinpoint the specific misconception.
4. Formulate encouraging, audio-first voice feedback.

Output strictly valid JSON:
{
  "isCorrect": true,
  "score": 95,
  "feedback": "Conversational, encouraging audio feedback explaining why it is correct or offering a helpful hint.",
  "weakConcepts": [],
  "recommendedNextDifficulty": "medium",
  "followupQuestion": null
}`,

  /**
   * Prompt for Scaffolded Simpler Explanation
   */
  simplerExplanation: ({ conceptName, currentExplanation, studentMisconception }) => `A visually impaired student struggled with the following concept:
Concept: ${conceptName}
Current Explanation: ${currentExplanation}
Student Misconception / Weakness: ${studentMisconception || 'Unclear understanding'}

Generate an ultra-simplified, scaffolded re-explanation:
- Use an everyday auditory or tactile analogy (e.g., sound of running water, feeling a sponge).
- Provide a 3-step intuitive breakdown.

Output strictly valid JSON:
{
  "conceptName": "${conceptName}",
  "simplifiedExplanation": "Crystal clear 2-sentence explanation...",
  "auditoryAnalogy": "Acoustic analogy...",
  "tactileAnalogy": "Physical touch analogy...",
  "stepByStepBreakdown": [
    "Step 1...",
    "Step 2...",
    "Step 3..."
  ]
}`,

  /**
   * Prompt for Follow-up Question
   */
  followupQuestion: ({ weakConcept, misconception, difficulty = 'easy' }) => `Create an adaptive follow-up question to help a visually impaired student solidify this struggling concept:
Concept: ${weakConcept}
Misconception: ${misconception || 'Incomplete grasp'}
Target Difficulty: ${difficulty}

Output strictly valid JSON:
{
  "questionText": "Follow-up question?",
  "questionType": "MULTIPLE_CHOICE",
  "options": ["Choice 1", "Choice 2", "Choice 3", "Choice 4"],
  "correctAnswer": "Choice 1",
  "explanation": "Explanation...",
  "audioPromptHint": "Say choice 1, 2, 3, or 4",
  "difficultyLevel": "${difficulty}",
  "conceptId": "${weakConcept}"
}`
};

module.exports = Prompts;
