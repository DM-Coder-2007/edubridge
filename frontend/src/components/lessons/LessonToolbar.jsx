'use client';

import React from 'react';
import { Button } from '../ui';

export function LessonToolbar({
  searchQuery,
  onSearchChange,
  statusFilter,
  onStatusChange,
  subjectFilter,
  onSubjectChange,
  audioOnlyFilter,
  onAudioOnlyChange,
  sortBy,
  onSortChange,
  availableSubjects,
  totalCount,
  filteredCount,
  onResetFilters
}) {
  const hasActiveFilters =
    searchQuery.trim() !== '' ||
    statusFilter !== 'ALL' ||
    subjectFilter !== 'ALL' ||
    audioOnlyFilter ||
    sortBy !== 'recent';

  return (
    <section className="lessons-toolbar" aria-label="Lesson filters and search">
      {/* Search Input & Sort Controls */}
      <div className="lessons-toolbar-top">
        <div className="lessons-search-input-wrapper">
          <svg
            className="lessons-search-icon"
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            aria-hidden="true"
          >
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="search"
            className="lessons-search-input"
            placeholder="Search lessons by title, subject, or concepts..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            aria-label="Search lessons"
          />
        </div>

        <div className="lessons-controls-group">
          {/* Subject Filter Dropdown */}
          {availableSubjects.length > 0 && (
            <select
              className="lessons-select"
              value={subjectFilter}
              onChange={(e) => onSubjectChange(e.target.value)}
              aria-label="Filter by subject"
            >
              <option value="ALL">All Subjects</option>
              {availableSubjects.map((subj) => (
                <option key={subj} value={subj}>
                  {subj}
                </option>
              ))}
            </select>
          )}

          {/* Sort By Dropdown */}
          <select
            className="lessons-select"
            value={sortBy}
            onChange={(e) => onSortChange(e.target.value)}
            aria-label="Sort lessons by"
          >
            <option value="recent">Recently Active</option>
            <option value="newest">Newest First</option>
            <option value="progress">Highest Progress</option>
            <option value="mastery">Highest Mastery</option>
            <option value="title">Title (A-Z)</option>
          </select>
        </div>
      </div>

      {/* Status Chips Row & Secondary Filters */}
      <div className="flex justify-between items-center flex-wrap gap-3">
        <div className="lessons-chips-row" role="radiogroup" aria-label="Filter by lesson completion status">
          <button
            type="button"
            className={`lessons-filter-chip ${statusFilter === 'ALL' ? 'lessons-filter-chip--active' : ''}`}
            onClick={() => onStatusChange('ALL')}
            aria-pressed={statusFilter === 'ALL'}
          >
            All Lessons
          </button>
          <button
            type="button"
            className={`lessons-filter-chip ${statusFilter === 'IN_PROGRESS' ? 'lessons-filter-chip--active' : ''}`}
            onClick={() => onStatusChange('IN_PROGRESS')}
            aria-pressed={statusFilter === 'IN_PROGRESS'}
          >
            In Progress
          </button>
          <button
            type="button"
            className={`lessons-filter-chip ${statusFilter === 'COMPLETED' ? 'lessons-filter-chip--active' : ''}`}
            onClick={() => onStatusChange('COMPLETED')}
            aria-pressed={statusFilter === 'COMPLETED'}
          >
            Completed
          </button>
          <button
            type="button"
            className={`lessons-filter-chip ${statusFilter === 'NOT_STARTED' ? 'lessons-filter-chip--active' : ''}`}
            onClick={() => onStatusChange('NOT_STARTED')}
            aria-pressed={statusFilter === 'NOT_STARTED'}
          >
            Not Started
          </button>
        </div>

        <div className="flex items-center gap-3">
          {/* Audio Only Toggle */}
          <label className="flex items-center gap-2 text-small cursor-pointer user-select-none">
            <input
              type="checkbox"
              checked={audioOnlyFilter}
              onChange={(e) => onAudioOnlyChange(e.target.checked)}
              style={{ width: '18px', height: '18px', accentColor: 'var(--color-primary-600)' }}
            />
            <span>Audio Narration Ready</span>
          </label>

          {/* Reset Filters CTA */}
          {hasActiveFilters && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onResetFilters}
              aria-label="Reset all search queries and active filters"
            >
              Reset Filters
            </Button>
          )}

          {/* Result Count Badge */}
          <span className="text-caption font-semibold" style={{ color: 'var(--text-muted)' }} aria-live="polite">
            Showing {filteredCount} of {totalCount}
          </span>
        </div>
      </div>
    </section>
  );
}
