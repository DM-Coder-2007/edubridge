'use client';

/**
 * EduBridge Adaptive — Public Landing Page
 *
 * This is the root route: /
 * It ALWAYS renders the public landing page regardless of authentication state.
 *
 * Authentication state controls which CTA buttons are shown:
 *   - Unauthenticated: "Get Started" + "Login"
 *   - Authenticated: "Go to Dashboard"
 *
 * Authentication state does NOT redirect away from this page.
 * Routing: / → Landing Page (always)
 */

import React, { useState } from 'react';
import Link from 'next/link';
import { useAuth } from '../context/AuthContext';
import { useRouter } from 'next/navigation';
import { Button } from '../components/ui';

// ─── Accessible SVG icons (aria-hidden) ──────────────────────────────────────

function IconAI() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M12 2L2 7l10 5 10-5-10-5z"/>
      <path d="M2 17l10 5 10-5"/>
      <path d="M2 12l10 5 10-5"/>
    </svg>
  );
}

function IconBook() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/>
      <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>
    </svg>
  );
}

function IconAudio() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
      <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"/>
    </svg>
  );
}

function IconAdaptive() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <circle cx="12" cy="12" r="3"/>
      <path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83"/>
    </svg>
  );
}

function IconProgress() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <line x1="18" y1="20" x2="18" y2="10"/>
      <line x1="12" y1="20" x2="12" y2="4"/>
      <line x1="6" y1="20" x2="6" y2="14"/>
    </svg>
  );
}

function IconOffline() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
      <polyline points="7 10 12 15 17 10"/>
      <line x1="12" y1="15" x2="12" y2="3"/>
    </svg>
  );
}

function IconReadAloud() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M12 20h9"/>
      <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
    </svg>
  );
}

function IconContrast() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <circle cx="12" cy="12" r="10"/>
      <path d="M12 2a10 10 0 0 1 0 20V2z" fill="currentColor" stroke="none"/>
    </svg>
  );
}

function IconKeyboard() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <rect x="2" y="6" width="20" height="12" rx="2"/>
      <path d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M8 14h8"/>
    </svg>
  );
}

function IconText() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <polyline points="4 7 4 4 20 4 20 7"/>
      <line x1="9" y1="20" x2="15" y2="20"/>
      <line x1="12" y1="4" x2="12" y2="20"/>
    </svg>
  );
}

function IconUpload() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
      <polyline points="17 8 12 3 7 8"/>
      <line x1="12" y1="3" x2="12" y2="15"/>
    </svg>
  );
}

function IconLesson() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
      <polyline points="14 2 14 8 20 8"/>
      <line x1="16" y1="13" x2="8" y2="13"/>
      <line x1="16" y1="17" x2="8" y2="17"/>
      <polyline points="10 9 9 9 8 9"/>
    </svg>
  );
}

function IconStar() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
    </svg>
  );
}

// ─── Main Landing Page Component ─────────────────────────────────────────────

export default function LandingPage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const isAuthenticated = !!user;

  const handleGetStarted = () => {
    router.push(isAuthenticated ? '/dashboard' : '/signup');
  };

  return (
    <div className="landing-root">

      {/* ─── Navigation ─────────────────────────────────────────────── */}
      <header className="landing-nav" role="banner">
        <div className="landing-nav-inner">

          {/* Brand */}
          <Link href="/" className="landing-brand" aria-label="EduBridge Adaptive — Home">
            <div className="landing-brand-mark" aria-hidden="true">EB</div>
            <span className="landing-brand-name">
              EduBridge <span>Adaptive</span>
            </span>
          </Link>

          {/* Desktop Nav Links */}
          <nav aria-label="Site navigation">
            <ul className="landing-nav-links">
              <li><a href="#how-it-works">How It Works</a></li>
              <li><a href="#features">Features</a></li>
              <li><a href="#accessibility">Accessibility</a></li>
            </ul>
          </nav>

          {/* Desktop Auth Actions */}
          <div className="landing-nav-actions">
            {!isLoading && (
              isAuthenticated ? (
                <>
                  <Link href="/dashboard">
                    <Button variant="primary" size="sm">Go to Dashboard</Button>
                  </Link>
                </>
              ) : (
                <>
                  <Link href="/login" className="landing-nav-login">
                    <Button variant="ghost" size="sm">Login</Button>
                  </Link>
                  <Link href="/signup">
                    <Button variant="primary" size="sm">Get Started</Button>
                  </Link>
                </>
              )
            )}
          </div>

          {/* Mobile Hamburger */}
          <button
            type="button"
            className="landing-mobile-toggle"
            aria-label={mobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
            aria-expanded={mobileMenuOpen}
            onClick={() => setMobileMenuOpen((o) => !o)}
          >
            {mobileMenuOpen ? (
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            ) : (
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
                <line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/>
              </svg>
            )}
          </button>
        </div>

        {/* Mobile Menu */}
        <nav className={`landing-mobile-menu${mobileMenuOpen ? ' open' : ''}`} aria-label="Mobile navigation">
          <a href="#how-it-works" onClick={() => setMobileMenuOpen(false)}>How It Works</a>
          <a href="#features" onClick={() => setMobileMenuOpen(false)}>Features</a>
          <a href="#accessibility" onClick={() => setMobileMenuOpen(false)}>Accessibility</a>
          <div className="landing-mobile-divider" />
          {!isLoading && (
            isAuthenticated ? (
              <Link href="/dashboard" onClick={() => setMobileMenuOpen(false)}>
                <Button variant="primary" fullWidth>Go to Dashboard</Button>
              </Link>
            ) : (
              <>
                <Link href="/login" onClick={() => setMobileMenuOpen(false)}>
                  <Button variant="outline" fullWidth>Login</Button>
                </Link>
                <Link href="/signup" onClick={() => setMobileMenuOpen(false)}>
                  <Button variant="primary" fullWidth>Get Started — It&apos;s Free</Button>
                </Link>
              </>
            )
          )}
        </nav>
      </header>

      {/* ─── Main Content ─────────────────────────────────────────────── */}
      <main className="landing-main" id="main-content">

        {/* ── Hero ─────────────────────────────────────────────────── */}
        <section className="landing-hero" aria-labelledby="hero-heading">
          <div className="landing-hero-badge" aria-label="AI-powered platform announcement">
            <span className="landing-hero-badge-dot" aria-hidden="true" />
            Powered by Gemini AI · Piper TTS · Cloudinary
          </div>

          <h1 className="landing-hero-title" id="hero-heading">
            Learn Smarter.{' '}
            <span className="landing-hero-title-accent">Learn Your Way.</span>
          </h1>

          <p className="landing-hero-subtitle">
            EduBridge Adaptive transforms your textbook content into personalized,
            accessible multimodal learning experiences — with audio narration,
            adaptive feedback, and read-aloud support designed for every learner.
          </p>

          <div className="landing-hero-ctas">
            {!isLoading && (
              isAuthenticated ? (
                <Link href="/dashboard">
                  <Button variant="primary" size="lg">Go to Dashboard</Button>
                </Link>
              ) : (
                <>
                  <Link href="/upload">
                    <Button variant="primary" size="lg">Upload Your Textbook</Button>
                  </Link>
                  <Link href="/login">
                    <Button variant="outline" size="lg">Sign In</Button>
                  </Link>
                </>
              )
            )}
          </div>

          <div className="landing-hero-trust" aria-label="Key capabilities">
            <span>🎧 Audio Narration</span>
            <span className="landing-hero-trust-divider" aria-hidden="true" />
            <span>🧠 Adaptive Feedback</span>
            <span className="landing-hero-trust-divider" aria-hidden="true" />
            <span>📖 Read Aloud</span>
            <span className="landing-hero-trust-divider" aria-hidden="true" />
            <span>📴 Offline Audio</span>
            <span className="landing-hero-trust-divider" aria-hidden="true" />
            <span>♿ WCAG 2.1 AAA</span>
          </div>
        </section>

        {/* ── How It Works ──────────────────────────────────────────── */}
        <section id="how-it-works" className="landing-section" aria-labelledby="how-heading">
          <div className="landing-section-header">
            <p className="landing-section-eyebrow">Simple 4-step process</p>
            <h2 className="landing-section-title" id="how-heading">How EduBridge Works</h2>
            <p className="landing-section-desc">
              From textbook scan to mastery in minutes — with AI handling the complexity.
            </p>
          </div>

          <div className="landing-steps">
            {[
              {
                num: 1,
                title: 'Upload Your Textbook',
                desc: 'Photograph or scan any textbook page. EduBridge accepts images in any format and extracts the content automatically.'
              },
              {
                num: 2,
                title: 'AI Understands the Content',
                desc: 'Gemini multimodal AI reads, comprehends, and structures the content — including diagrams, equations, and dense text.'
              },
              {
                num: 3,
                title: 'Personalized Lesson Generated',
                desc: 'A structured accessible lesson is created with audio narration via Piper TTS, tactile analogies, and concept summaries.'
              },
              {
                num: 4,
                title: 'Practice & Adaptive Feedback',
                desc: 'Answer comprehension questions and receive individualized feedback that adapts to your learning progress in real time.'
              }
            ].map((step) => (
              <article key={step.num} className="landing-step">
                <div className="landing-step-num" aria-hidden="true">{step.num}</div>
                <h3 className="landing-step-title">{step.title}</h3>
                <p className="landing-step-desc">{step.desc}</p>
              </article>
            ))}
          </div>
        </section>

        {/* ── Key Features ──────────────────────────────────────────── */}
        <section id="features" className="landing-section" style={{ paddingTop: 0 }} aria-labelledby="features-heading">
          <div className="landing-section-header">
            <p className="landing-section-eyebrow">Everything you need</p>
            <h2 className="landing-section-title" id="features-heading">Built for Real Learning</h2>
            <p className="landing-section-desc">
              Every feature is crafted for accessibility, clarity, and measurable progress.
            </p>
          </div>

          <div className="landing-features">
            {[
              {
                icon: <IconAI />,
                accent: false,
                title: 'AI-Powered Understanding',
                desc: 'Gemini multimodal AI extracts meaning from any textbook — text, diagrams, equations — and turns it into structured lessons.'
              },
              {
                icon: <IconAdaptive />,
                accent: true,
                title: 'Adaptive Learning',
                desc: 'The platform tracks your mastery level per concept and tailors question difficulty and feedback to close learning gaps.'
              },
              {
                icon: <IconAudio />,
                accent: false,
                title: 'Audio Narration',
                desc: 'Every lesson is narrated by Piper TTS with support for 6 playback speeds (0.75×–2×) and waveform visualization.'
              },
              {
                icon: <IconReadAloud />,
                accent: true,
                title: 'Read Aloud',
                desc: 'Any text on screen can be read aloud using the browser\'s built-in Speech Synthesis API — no external service required.'
              },
              {
                icon: <IconProgress />,
                accent: false,
                title: 'Progress Tracking',
                desc: 'Visual mastery radar charts and lesson completion tracking stored in Snowflake give you a clear picture of your growth.'
              },
              {
                icon: <IconOffline />,
                accent: true,
                title: 'Offline Audio',
                desc: 'Download lesson audio for offline listening via the Service Worker Cache API. Study anywhere, even without internet.'
              }
            ].map((f, i) => (
              <article key={i} className="landing-feature-card">
                <div className={`landing-feature-icon${f.accent ? ' accent' : ''}`} aria-hidden="true">
                  {f.icon}
                </div>
                <h3 className="landing-feature-title">{f.title}</h3>
                <p className="landing-feature-desc">{f.desc}</p>
              </article>
            ))}
          </div>
        </section>

        {/* ── Accessibility Section ──────────────────────────────────── */}
        <div id="accessibility" className="landing-a11y-wrap">
          <section className="landing-a11y" aria-labelledby="a11y-heading">
            <div className="landing-a11y-grid">

              {/* Left: Copy */}
              <div>
                <p className="landing-section-eyebrow" style={{ color: 'var(--color-accent-300)' }}>
                  Accessibility First
                </p>
                <h2 className="landing-a11y-title" id="a11y-heading">
                  Designed for Every Learner
                </h2>
                <p className="landing-a11y-desc">
                  EduBridge Adaptive is built from the ground up for visually impaired students and
                  learners with diverse needs. WCAG 2.1 AAA compliance is not an afterthought — it
                  is the foundation.
                </p>
                <div className="landing-a11y-pills">
                  {['WCAG 2.1 AAA', 'Screen Reader Ready', 'Keyboard Navigation', 'High Contrast', 'Reduced Motion'].map((p) => (
                    <span key={p} className="landing-a11y-pill">{p}</span>
                  ))}
                </div>
              </div>

              {/* Right: Feature list */}
              <div className="landing-a11y-features" aria-label="Accessibility features">
                {[
                  { icon: <IconReadAloud />, title: 'Read Aloud', desc: 'Any text, anywhere in the app, can be read aloud using the browser Speech Synthesis API.' },
                  { icon: <IconText />, title: 'Text Size Control', desc: 'Three scales: Normal, Large, and Extra Large — applied globally via CSS custom properties, not browser zoom.' },
                  { icon: <IconContrast />, title: 'High Contrast Mode', desc: 'A polished dark high-contrast theme with at least 7:1 contrast ratios. Not just a color inversion.' },
                  { icon: <IconKeyboard />, title: 'Keyboard Navigation', desc: 'Every interactive element is reachable and operable by keyboard. Visible focus indicators always on.' },
                  { icon: <IconAudio />, title: 'Audio Learning', desc: 'Piper TTS narrates lessons. Cloudinary streams audio at variable speeds. Service Worker enables offline play.' },
                ].map((item) => (
                  <div key={item.title} className="landing-a11y-item">
                    <div className="landing-a11y-item-icon" aria-hidden="true">{item.icon}</div>
                    <div>
                      <p className="landing-a11y-item-title">{item.title}</p>
                      <p className="landing-a11y-item-desc">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>

            </div>
          </section>
        </div>

        {/* ── Learning Flow Visualization ────────────────────────────── */}
        <section className="landing-section" style={{ paddingTop: '3rem' }} aria-labelledby="flow-heading">
          <div className="landing-section-header">
            <p className="landing-section-eyebrow">Your journey</p>
            <h2 className="landing-section-title" id="flow-heading">From Textbook to Mastery</h2>
            <p className="landing-section-desc">
              Every upload begins a structured learning journey that ends in verified mastery.
            </p>
          </div>

          <div className="landing-flow" role="list" aria-label="Learning flow steps">
            {[
              { label: 'Textbook', icon: <IconBook /> },
              { label: 'AI Analysis', icon: <IconAI /> },
              { label: 'Lesson', icon: <IconLesson /> },
              { label: 'Practice', icon: <IconUpload /> },
              { label: 'Mastery', icon: <IconStar /> },
            ].map((node, i, arr) => (
              <React.Fragment key={node.label}>
                <div className="landing-flow-node" role="listitem">
                  <div className="landing-flow-circle" aria-hidden="true">{node.icon}</div>
                  <span className="landing-flow-label">{node.label}</span>
                </div>
                {i < arr.length - 1 && (
                  <span className="landing-flow-arrow" aria-hidden="true">→</span>
                )}
              </React.Fragment>
            ))}
          </div>
        </section>

        {/* ── Final CTA ─────────────────────────────────────────────── */}
        <div className="landing-cta-wrap">
          <section className="landing-cta" aria-labelledby="cta-heading">
            <h2 className="landing-cta-title" id="cta-heading">
              Start Learning Smarter
            </h2>
            <p className="landing-cta-subtitle">
              Upload your first textbook today and let EduBridge Adaptive create
              a personalized accessible lesson in seconds.
            </p>
            <div className="landing-cta-actions">
              {!isLoading && (
                isAuthenticated ? (
                  <Link href="/dashboard">
                    <Button variant="secondary" size="lg">Go to Dashboard</Button>
                  </Link>
                ) : (
                  <>
                    <Link href="/signup">
                      <Button variant="secondary" size="lg">Create Free Account</Button>
                    </Link>
                    <Link href="/login">
                      <Button
                        size="lg"
                        style={{ background: 'rgba(255,255,255,0.12)', color: 'white', border: '1px solid rgba(255,255,255,0.25)' }}
                      >
                        Sign In
                      </Button>
                    </Link>
                  </>
                )
              )}
            </div>
          </section>
        </div>

      </main>

      {/* ─── Footer ───────────────────────────────────────────────────── */}
      <footer className="landing-footer" role="contentinfo">
        <div className="landing-footer-inner">
          <div>
            <Link href="/" className="landing-footer-brand" aria-label="EduBridge Adaptive Home">
              <div className="landing-brand-mark" aria-hidden="true">EB</div>
              <span style={{ fontWeight: 700 }}>EduBridge Adaptive</span>
            </Link>
            <p className="landing-footer-copy">
              AI-powered accessible learning. Built for every student.
            </p>
          </div>

          <nav aria-label="Footer navigation">
            <div className="landing-footer-links">
              <a href="#how-it-works">How It Works</a>
              <a href="#features">Features</a>
              <a href="#accessibility">Accessibility</a>
              <Link href="/login">Login</Link>
              <Link href="/signup">Sign Up</Link>
            </div>
          </nav>
        </div>
      </footer>

    </div>
  );
}
