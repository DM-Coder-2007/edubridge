'use client';

import React, { useState, useRef, useEffect } from 'react';

const INITIAL_NOTIFICATIONS = [
  {
    id: 1,
    title: 'Textbook Processed',
    message: 'Biology Chapter 4 diagrams converted with tactile alt-text.',
    time: '5m ago'
  },
  {
    id: 2,
    title: 'Piper Audio Ready',
    message: 'Narration synthesized with Lessac voice at 1.0x rate.',
    time: '20m ago'
  },
  {
    id: 3,
    title: 'Concept Mastery Gained',
    message: 'Photosynthesis mastery updated in Snowflake database.',
    time: '1h ago'
  }
];

export default function NotificationArea() {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState(INITIAL_NOTIFICATIONS);
  const containerRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const unreadCount = notifications.length;

  return (
    <div className="dropdown-container" ref={containerRef}>
      <button
        type="button"
        className="notification-btn"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-label={`Notifications: ${unreadCount} unread updates`}
        aria-haspopup="true"
        aria-expanded={isOpen}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>

        {unreadCount > 0 && <span className="notification-badge-dot" aria-hidden="true" />}
      </button>

      {isOpen && (
        <div
          role="region"
          aria-label="Recent notifications"
          className="dropdown-menu notification-popover"
        >
          <div className="notification-header">
            <span className="notification-title">Notifications</span>
            {unreadCount > 0 && (
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                style={{ fontSize: '0.75rem', padding: '2px 6px', minHeight: 'auto' }}
                onClick={() => setNotifications([])}
              >
                Clear all
              </button>
            )}
          </div>

          <div className="notification-list" tabIndex={0}>
            {notifications.length === 0 ? (
              <div style={{ padding: 'var(--spacing-4)', textAlign: 'center', color: 'var(--text-muted)' }} className="text-small">
                No new notifications
              </div>
            ) : (
              notifications.map((item) => (
                <div key={item.id} className="notification-item">
                  <div className="notification-item-text">
                    <strong>{item.title}</strong>: {item.message}
                  </div>
                  <div className="notification-item-time">{item.time}</div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
