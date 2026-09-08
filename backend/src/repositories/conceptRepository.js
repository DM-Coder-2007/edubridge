/**
 * EduBridge Adaptive - Concept Repository (Snowflake)
 */

const { v4: uuidv4 } = require('uuid');
const db = require('../database/snowflake');

class ConceptRepository {
  async create({
    lessonId,
    name,
    explanation,
    description,
    simplifiedAnalogy = null,
    analogyText = null,
    audioCueHint = null,
    difficultyLevel = 'medium',
    difficulty = 'medium',
    orderIndex = 0
  }) {
    const id = uuidv4();
    const finalExplanation = explanation || description || name || 'Core learning concept.';
    const finalAnalogy = simplifiedAnalogy || analogyText || null;
    const finalDifficulty = difficultyLevel || difficulty || 'medium';

    const record = {
      ID: id,
      CONCEPT_ID: id,
      LESSON_ID: lessonId,
      NAME: name,
      CONCEPT_NAME: name,
      EXPLANATION: finalExplanation,
      SIMPLIFIED_ANALOGY: finalAnalogy,
      AUDIO_CUE_HINT: audioCueHint,
      DIFFICULTY_LEVEL: finalDifficulty,
      DIFFICULTY: finalDifficulty,
      ORDER_INDEX: orderIndex,
      CREATED_AT: new Date().toISOString()
    };

    await db.insert('EDUBRIDGE_ADAPTIVE.APP.CONCEPTS', record);
    return this._format(record);
  }

  async createMany(concepts) {
    const results = [];
    for (let i = 0; i < concepts.length; i++) {
      const c = concepts[i];
      const created = await this.create({
        lessonId: c.lessonId,
        name: c.name || c.conceptName,
        explanation: c.explanation || c.definition || '',
        simplifiedAnalogy: c.simplifiedAnalogy || c.sensoryAnalogy || null,
        audioCueHint: c.audioCueHint || null,
        difficultyLevel: c.difficultyLevel || 'medium',
        orderIndex: c.orderIndex !== undefined ? c.orderIndex : i
      });
      results.push(created);
    }
    return results;
  }

  async findByLessonId(lessonId) {
    const rows = await db.query('SELECT * FROM EDUBRIDGE_ADAPTIVE.APP.CONCEPTS WHERE LESSON_ID = ? ORDER BY ORDER_INDEX ASC', [lessonId]);
    return rows.map(r => this._format(r));
  }

  async findById(id) {
    if (!id) return null;
    const row = await db.queryOne('SELECT * FROM EDUBRIDGE_ADAPTIVE.APP.CONCEPTS WHERE ID = ? OR CONCEPT_ID = ? LIMIT 1', [id, id]);
    return this._format(row);
  }

  _format(row) {
    if (!row) return null;
    return {
      id: row.ID || row.CONCEPT_ID,
      conceptId: row.CONCEPT_ID || row.ID,
      lessonId: row.LESSON_ID,
      name: row.NAME || row.CONCEPT_NAME,
      conceptName: row.CONCEPT_NAME || row.NAME,
      explanation: row.EXPLANATION,
      simplifiedAnalogy: row.SIMPLIFIED_ANALOGY,
      audioCueHint: row.AUDIO_CUE_HINT,
      difficultyLevel: row.DIFFICULTY_LEVEL || row.DIFFICULTY,
      orderIndex: parseInt(row.ORDER_INDEX || 0, 10),
      createdAt: row.CREATED_AT
    };
  }
}

module.exports = new ConceptRepository();
