'use client';

import React, { useRef } from 'react';

/**
 * Accessible Tabs Component
 *
 * @param {Object} props
 * @param {Array<{ id: string, label: string, icon?: React.ReactNode, content: React.ReactNode, disabled?: boolean }>} props.tabs
 * @param {string} props.activeTab - Currently active tab id
 * @param {function} props.onChange - Callback with newly selected tab id
 * @param {string} [props.ariaLabel='Navigation Tabs']
 * @param {string} [props.className='']
 */
export default function Tabs({
  tabs = [],
  activeTab,
  onChange,
  ariaLabel = 'Navigation Tabs',
  className = ''
}) {
  const tabListRef = useRef(null);

  const handleKeyDown = (e, index) => {
    const enabledTabs = tabs.filter((t) => !t.disabled);
    const currentIndex = enabledTabs.findIndex((t) => t.id === tabs[index].id);

    let nextTab = null;

    if (e.key === 'ArrowRight') {
      const nextIndex = (currentIndex + 1) % enabledTabs.length;
      nextTab = enabledTabs[nextIndex];
    } else if (e.key === 'ArrowLeft') {
      const prevIndex = (currentIndex - 1 + enabledTabs.length) % enabledTabs.length;
      nextTab = enabledTabs[prevIndex];
    } else if (e.key === 'Home') {
      nextTab = enabledTabs[0];
    } else if (e.key === 'End') {
      nextTab = enabledTabs[enabledTabs.length - 1];
    }

    if (nextTab) {
      e.preventDefault();
      onChange(nextTab.id);
      const tabButtons = tabListRef.current?.querySelectorAll('button[role="tab"]:not([disabled])');
      const targetBtn = Array.from(tabButtons || []).find(
        (btn) => btn.getAttribute('data-tab-id') === nextTab.id
      );
      targetBtn?.focus();
    }
  };

  const activeTabObj = tabs.find((t) => t.id === activeTab) || tabs[0];

  return (
    <div className={`tabs-container ${className}`.trim()}>
      <div
        ref={tabListRef}
        role="tablist"
        aria-label={ariaLabel}
        className="tabs-list"
      >
        {tabs.map((tab, idx) => {
          const isSelected = tab.id === (activeTabObj?.id || '');
          const tabId = `tab-${tab.id}`;
          const panelId = `panel-${tab.id}`;

          return (
            <button
              key={tab.id}
              id={tabId}
              role="tab"
              type="button"
              data-tab-id={tab.id}
              aria-selected={isSelected}
              aria-controls={panelId}
              tabIndex={isSelected ? 0 : -1}
              disabled={tab.disabled}
              onClick={() => onChange(tab.id)}
              onKeyDown={(e) => handleKeyDown(e, idx)}
              className={`tab-item ${isSelected ? 'tab-selected' : ''}`.trim()}
            >
              {tab.icon && <span aria-hidden="true">{tab.icon}</span>}
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {activeTabObj && (
        <div
          id={`panel-${activeTabObj.id}`}
          role="tabpanel"
          aria-labelledby={`tab-${activeTabObj.id}`}
          tabIndex={0}
          className="tab-panel"
        >
          {activeTabObj.content}
        </div>
      )}
    </div>
  );
}
