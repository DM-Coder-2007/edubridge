'use client';

import React from 'react';

export function QuestionInput({
  question,
  studentAnswer,
  onAnswerChange,
  disabled
}) {
  const rawType = (question.questionType || 'MULTIPLE_CHOICE').toUpperCase();
  const isMcq = rawType === 'MULTIPLE_CHOICE' || rawType === 'MCQ';
  const isTf = rawType === 'TRUE_FALSE' || rawType === 'BOOLEAN';
  const isShortAnswer = rawType === 'SHORT_ANSWER' || rawType === 'FREE_TEXT' || rawType === 'ESSAY';

  // Format options
  let options = [];
  if (Array.isArray(question.options)) {
    options = question.options;
  } else if (typeof question.options === 'string') {
    try {
      options = JSON.parse(question.options);
    } catch {
      options = [question.options];
    }
  }

  // 1. Multiple Choice Questions (MCQ)
  if (isMcq && options.length > 0) {
    return (
      <div
        className="quiz-options-list"
        role="radiogroup"
        aria-label="Select one option to answer the question"
      >
        {options.map((opt, idx) => {
          const letter = String.fromCharCode(65 + idx);
          const isSelected = studentAnswer === opt;
          return (
            <label
              key={idx}
              className={`quiz-option-label ${isSelected ? 'quiz-option-label--selected' : ''} ${disabled ? 'quiz-option-label--disabled' : ''}`}
            >
              <input
                type="radio"
                name={`question-${question.id}`}
                value={opt}
                checked={isSelected}
                onChange={() => onAnswerChange(opt)}
                disabled={disabled}
                className="quiz-option-radio"
                aria-label={`Option ${letter}: ${opt}`}
              />
              <span className="quiz-option-index" aria-hidden="true">
                {letter}
              </span>
              <span className="quiz-option-text">{opt}</span>
            </label>
          );
        })}
      </div>
    );
  }

  // 2. True / False Questions
  if (isTf) {
    return (
      <div className="quiz-tf-grid" role="group" aria-label="True or false selection">
        {['True', 'False'].map((val) => {
          const isSelected = studentAnswer?.toLowerCase() === val.toLowerCase();
          return (
            <button
              key={val}
              type="button"
              className={`quiz-tf-btn ${isSelected ? 'quiz-tf-btn--selected' : ''}`}
              onClick={() => onAnswerChange(val)}
              disabled={disabled}
              aria-pressed={isSelected}
            >
              <span aria-hidden="true">{val === 'True' ? '✓' : '✕'}</span>
              <span>{val}</span>
            </button>
          );
        })}
      </div>
    );
  }

  // 3. Short Answer / Free Text
  return (
    <div className="stack-xs">
      <textarea
        className="quiz-textarea"
        placeholder="Type your explanation or answer in your own words..."
        value={studentAnswer}
        onChange={(e) => onAnswerChange(e.target.value)}
        disabled={disabled}
        rows={4}
        aria-label="Your answer input"
      />
      <div className="text-caption" style={{ color: 'var(--text-muted)', textAlign: 'right' }}>
        {studentAnswer.length} characters
      </div>
    </div>
  );
}
