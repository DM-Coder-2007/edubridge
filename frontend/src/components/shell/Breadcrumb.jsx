'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const ROUTE_LABELS = {
  dashboard: 'Dashboard',
  lessons: 'My Lessons',
  textbooks: 'Textbooks',
  progress: 'Progress',
  mastery: 'Concept Mastery',
  settings: 'Settings'
};

/**
 * Accessible Breadcrumb Component
 *
 * @param {Object} props
 * @param {Array<{ label: string, href?: string }>} [props.customItems]
 */
export default function Breadcrumb({ customItems }) {
  const pathname = usePathname();

  let items = customItems;

  if (!items) {
    const segments = pathname.split('/').filter(Boolean);
    items = [{ label: 'Home', href: '/dashboard' }];

    let currentHref = '';
    segments.forEach((seg, idx) => {
      currentHref += `/${seg}`;
      const label = ROUTE_LABELS[seg] || (seg.charAt(0).toUpperCase() + seg.slice(1).replace(/-/g, ' '));
      const isLast = idx === segments.length - 1;
      items.push({
        label,
        href: isLast ? undefined : currentHref
      });
    });
  }

  // If on home/dashboard root with only 1 item, still render a clean accessible trail
  if (items.length <= 1 && items[0].href === '/dashboard' && pathname === '/dashboard') {
    items = [{ label: 'Dashboard' }];
  }

  return (
    <nav className="breadcrumbs-nav" aria-label="Breadcrumb">
      <ol className="breadcrumbs-list">
        {items.map((item, idx) => {
          const isLast = idx === items.length - 1;

          return (
            <li key={idx} className="breadcrumbs-item">
              {idx > 0 && (
                <span className="breadcrumbs-separator" aria-hidden="true">
                  /
                </span>
              )}

              {item.href && !isLast ? (
                <Link href={item.href} className="breadcrumbs-link">
                  {item.label}
                </Link>
              ) : (
                <span className="breadcrumbs-current" aria-current="page">
                  {item.label}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
