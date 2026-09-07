/**
 * EduBridge Adaptive - Quiz Repository (Snowflake)
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

    await db.insert('QUESTIONS', record);
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
    const rows = await db.query('SELECT * FROM QUESTIONS WHERE LESSON_ID = ? ORDER BY ORDER_INDEX ASC', [lessonId]);
    return rows.map(r => this._formatQuestion(r));
  }

  async findQuestionById(id) {
    const row = await db.queryOne('SELECT * FROM QUESTIONS WHERE ID = ? LIMIT 1', [id]);
    return this._formatQuestion(row);
  }

  async createAttempt({ userId, lessonId, totalQuestions = 0 }) {
    const id = uuidv4();
    const record = {
      ID: id,
      USER_ID: userId,
      LESSON_ID: lessonId,
      TOTAL_QUESTIONS: totalQuestions,
      CORRECT_QUESTIONS: 0,
      SCORE_PERCENTAGE: 0.0,
      TIME_SPENT_SECONDS: 0,
      STARTED_AT: new Date().toISOString(),
      COMPLETED_AT: null
    };

    await db.insert('ATTEMPTS', record);
    return this._formatAttempt(record);
  }

  async updateAttemptScore(attemptId, { correctQuestions, totalQuestions, scorePercentage, timeSpentSeconds }) {
    const record = {
      CORRECT_QUESTIONS: correctQuestions,
      TOTAL_QUESTIONS: totalQuestions,
      SCORE_PERCENTAGE: scorePercentage,
      TIME_SPENT_SECONDS: timeSpentSeconds,
      COMPLETED_AT: new Date().toISOString()
    };

    await db.update('ATTEMPTS', record, 'ID = ?', [attemptId]);
    return this.findAttemptById(attemptId);
  }

  async findAttemptById(id) {
    const row = await db.queryOne('SELECT * FROM ATTEMPTS WHERE ID = ? LIMIT 1', [id]);
    return this._formatAttempt(row);
  }

  async findAttemptsByUserAndLesson(userId, lessonId) {
    const rows = await db.query(
      'SELECT * FROM ATTEMPTS WHERE USER_ID = ? AND LESSON_ID = ? ORDER BY STARTED_AT DESC',
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
    const id = uuidv4();
    const record = {
      ID: id,
      ATTEMPT_ID: attemptId,
      QUESTION_ID: questionId,
      USER_ID: userId,
      USER_ANSWER_TEXT: userAnswerText,
      IS_CORRECT: Boolean(isCorrect),
      AI_SCORE: aiScore,
      AI_FEEDBACK: aiFeedback,
      ADAPTIVE_FOLLOWUP_QUESTION: adaptiveFollowupQuestion,
      CREATED_AT: new Date().toISOString()
    };

    await db.insert('ANSWERS', record);
    return this._formatAnswer(record);
  }

  async findAnswersByAttemptId(attemptId) {
    const rows = await db.query('SELECT * FROM ANSWERS WHERE ATTEMPT_ID = ? ORDER BY CREATED_AT ASC', [attemptId]);
    return rows.map(r => this._formatAnswer(r));
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
      id: row.ID,
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
    return {
      id: row.ID,
      userId: row.USER_ID,
      lessonId: row.LESSON_ID,
      totalQuestions: parseInt(row.TOTAL_QUESTIONS || 0, 10),
      correctQuestions: parseInt(row.CORRECT_QUESTIONS || 0, 10),
      scorePercentage: parseFloat(row.SCORE_PERCENTAGE || 0),
      timeSpentSeconds: parseInt(row.TIME_SPENT_SECONDS || 0, 10),
      startedAt: row.STARTED_AT,
      completedAt: row.COMPLETED_AT,
      status: row.COMPLETED_AT ? 'COMPLETED' : 'IN_PROGRESS'
    };
  }

  _formatAnswer(row) {
    if (!row) return null;
    return {
      id: row.ID,
      attemptId: row.ATTEMPT_ID,
      questionId: row.QUESTION_ID,
      userId: row.USER_ID,
      userAnswerText: row.USER_ANSWER_TEXT,
      isCorrect: Boolean(row.IS_CORRECT),
      aiScore: parseFloat(row.AI_SCORE || 0),
      aiFeedback: row.AI_FEEDBACK,
      adaptiveFollowupQuestion: row.ADAPTIVE_FOLLOWUP_QUESTION,
      createdAt: row.CREATED_AT
    };
  }
}

module.exports = new QuizRepository();
