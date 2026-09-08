/**
 * EduBridge Adaptive - Quiz Repository (Snowflake)
 * Mapped to EDUBRIDGE_ADAPTIVE.APP.QUESTIONS and EDUBRIDGE_ADAPTIVE.APP.ATTEMPTS
 */

const { v4: uuidv4 } = require('uuid');
const db = require('../database/snowflake');

class QuizRepository {
  async createQuestion({
    lessonId,
    conceptId = null,
    questionText,
    questionType = 'MULTIPLE_CHOICE',
    options = [],
    correctAnswer,
    explanation,
    audioPromptHint = null,
    difficultyLevel = 'medium',
    orderIndex = 0
  }) {
    const id = uuidv4();
    const record = {
      ID: id,
      QUESTION_ID: id,
      LESSON_ID: lessonId,
      CONCEPT_ID: conceptId,
      QUESTION_TEXT: questionText,
      QUESTION_TYPE: questionType,
      OPTIONS: typeof options === 'string' ? options : JSON.stringify(options),
      CORRECT_ANSWER: correctAnswer,
      EXPLANATION: explanation,
      AUDIO_PROMPT_HINT: audioPromptHint,
      DIFFICULTY_LEVEL: difficultyLevel,
      ORDER_INDEX: orderIndex,
      CREATED_AT: new Date().toISOString()
    };

    await db.insert('EDUBRIDGE_ADAPTIVE.APP.QUESTIONS', record);
    return this._formatQuestion(record);
  }

  async createQuestions(questions) {
    const results = [];
    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      const created = await this.createQuestion({
        lessonId: q.lessonId,
        conceptId: q.conceptId || null,
        questionText: q.questionText,
        questionType: q.questionType || 'MULTIPLE_CHOICE',
        options: q.options || [],
        correctAnswer: q.correctAnswer,
        explanation: q.explanation || '',
        audioPromptHint: q.audioPromptHint || null,
        difficultyLevel: q.difficultyLevel || 'medium',
        orderIndex: q.orderIndex !== undefined ? q.orderIndex : i
      });
      results.push(created);
    }
    return results;
  }

  async findQuestionsByLessonId(lessonId) {
    const rows = await db.query(
      'SELECT * FROM EDUBRIDGE_ADAPTIVE.APP.QUESTIONS WHERE LESSON_ID = ? ORDER BY ORDER_INDEX ASC',
      [lessonId]
    );
    return rows.map(r => this._formatQuestion(r));
  }

  async findQuestionById(id) {
    const row = await db.queryOne(
      'SELECT * FROM EDUBRIDGE_ADAPTIVE.APP.QUESTIONS WHERE ID = ? OR QUESTION_ID = ? LIMIT 1',
      [id, id]
    );
    return this._formatQuestion(row);
  }

  async createAttempt({ userId, lessonId, totalQuestions = 0 }) {
    const id = uuidv4();
    const record = {
      ID: id,
      ATTEMPT_ID: id,
      USER_ID: userId,
      LESSON_ID: lessonId,
      TOTAL_QUESTIONS: parseInt(totalQuestions || 0, 10),
      CORRECT_QUESTIONS: 0,
      SCORE_PERCENTAGE: 0.0,
      TIME_SPENT_SECONDS: 0,
      STATUS: 'IN_PROGRESS',
      ANSWERS_SUMMARY: JSON.stringify([]),
      STARTED_AT: new Date().toISOString(),
      COMPLETED_AT: null,
      CREATED_AT: new Date().toISOString(),
      UPDATED_AT: new Date().toISOString()
    };

    await db.insert('EDUBRIDGE_ADAPTIVE.APP.ATTEMPTS', record);
    return this._formatAttempt(record);
  }

  async updateAttemptScore(attemptId, { correctQuestions, totalQuestions, scorePercentage, timeSpentSeconds }) {
    const record = {
      CORRECT_QUESTIONS: correctQuestions,
      TOTAL_QUESTIONS: totalQuestions,
      SCORE_PERCENTAGE: scorePercentage,
      TIME_SPENT_SECONDS: timeSpentSeconds,
      STATUS: 'COMPLETED',
      COMPLETED_AT: new Date().toISOString(),
      UPDATED_AT: new Date().toISOString()
    };

    await db.update('EDUBRIDGE_ADAPTIVE.APP.ATTEMPTS', record, 'ID = ? OR ATTEMPT_ID = ?', [attemptId, attemptId]);
    return this.findAttemptById(attemptId);
  }

  async findAttemptById(id) {
    const row = await db.queryOne(
      'SELECT * FROM EDUBRIDGE_ADAPTIVE.APP.ATTEMPTS WHERE ID = ? OR ATTEMPT_ID = ? LIMIT 1',
      [id, id]
    );
    return this._formatAttempt(row);
  }

  async findAttemptsByUserAndLesson(userId, lessonId) {
    const rows = await db.query(
      'SELECT * FROM EDUBRIDGE_ADAPTIVE.APP.ATTEMPTS WHERE USER_ID = ? AND LESSON_ID = ? ORDER BY STARTED_AT DESC',
      [userId, lessonId]
    );
    return rows.map(r => this._formatAttempt(r));
  }

  async recordAnswer({
    attemptId,
    questionId,
    userId,
    userAnswerText,
    isCorrect,
    aiScore = 0.0,
    aiFeedback = null,
    adaptiveFollowupQuestion = null
  }) {
    const attempt = await this.findAttemptById(attemptId);
    const id = uuidv4();
    const answerRecord = {
      id,
      attemptId,
      questionId,
      userId,
      userAnswerText,
      studentAnswer: userAnswerText,
      isCorrect: Boolean(isCorrect),
      aiScore: parseFloat(aiScore || 0),
      aiFeedback,
      adaptiveFollowupQuestion,
      createdAt: new Date().toISOString()
    };

    let summary = [];
    if (attempt && attempt.answersSummary) {
      summary = Array.isArray(attempt.answersSummary)
        ? [...attempt.answersSummary]
        : (typeof attempt.answersSummary === 'string' ? JSON.parse(attempt.answersSummary) : []);
    }
    summary.push(answerRecord);

    await db.update(
      'EDUBRIDGE_ADAPTIVE.APP.ATTEMPTS',
      {
        ANSWERS_SUMMARY: JSON.stringify(summary),
        UPDATED_AT: new Date().toISOString()
      },
      'ID = ? OR ATTEMPT_ID = ?',
      [attemptId, attemptId]
    );

    return answerRecord;
  }

  async findAnswersByAttemptId(attemptId) {
    const attempt = await this.findAttemptById(attemptId);
    if (!attempt || !attempt.answersSummary) return [];
    return Array.isArray(attempt.answersSummary)
      ? attempt.answersSummary
      : (typeof attempt.answersSummary === 'string' ? JSON.parse(attempt.answersSummary) : []);
  }

  _formatQuestion(row) {
    if (!row) return null;
    let opts = [];
    if (row.OPTIONS) {
      try {
        opts = typeof row.OPTIONS === 'string' ? JSON.parse(row.OPTIONS) : row.OPTIONS;
      } catch {
        opts = [];
      }
    }
    return {
      id: row.ID || row.QUESTION_ID,
      questionId: row.QUESTION_ID || row.ID,
      lessonId: row.LESSON_ID,
      conceptId: row.CONCEPT_ID,
      questionText: row.QUESTION_TEXT,
      questionType: row.QUESTION_TYPE,
      options: opts,
      correctAnswer: row.CORRECT_ANSWER,
      explanation: row.EXPLANATION,
      audioPromptHint: row.AUDIO_PROMPT_HINT,
      difficultyLevel: row.DIFFICULTY_LEVEL,
      orderIndex: parseInt(row.ORDER_INDEX || 0, 10),
      createdAt: row.CREATED_AT
    };
  }

  _formatAttempt(row) {
    if (!row) return null;
    let summary = [];
    if (row.ANSWERS_SUMMARY) {
      try {
        summary = typeof row.ANSWERS_SUMMARY === 'string' ? JSON.parse(row.ANSWERS_SUMMARY) : row.ANSWERS_SUMMARY;
      } catch {
        summary = [];
      }
    }
    return {
      id: row.ID || row.ATTEMPT_ID,
      attemptId: row.ATTEMPT_ID || row.ID,
      userId: row.USER_ID,
      lessonId: row.LESSON_ID,
      totalQuestions: parseInt(row.TOTAL_QUESTIONS || 0, 10),
      correctQuestions: parseInt(row.CORRECT_QUESTIONS || 0, 10),
      scorePercentage: parseFloat(row.SCORE_PERCENTAGE || 0),
      timeSpentSeconds: parseInt(row.TIME_SPENT_SECONDS || 0, 10),
      answersSummary: summary,
      startedAt: row.STARTED_AT,
      completedAt: row.COMPLETED_AT,
      status: row.STATUS || (row.COMPLETED_AT ? 'COMPLETED' : 'IN_PROGRESS')
    };
  }
}

module.exports = new QuizRepository();
