import '../styles/globals.css';
import { ToastProvider, ErrorBoundary } from '../components/ui';
import { ServiceWorkerRegistration } from '../components/shell';
import { AuthProvider } from '../context/AuthContext';
import { AccessibilityProvider } from '../context/AccessibilityContext';
import { LoadingProvider } from '../context/LoadingContext';

export const metadata = {
  title: 'EduBridge Adaptive — Accessible Multimodal Learning Platform',
  description: 'AI-powered, highly accessible learning platform designed for visually impaired students, backed by Snowflake, Cloudinary, Gemini, Piper TTS, and faster-whisper.'
};

export const viewport = {
  width: 'device-width',
  initialScale: 1.0,
  maximumScale: 5.0
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body suppressHydrationWarning>
        <a href="#main-content" className="skip-link">
          Skip to main content
        </a>
        <ServiceWorkerRegistration />
        <AuthProvider>
          <AccessibilityProvider>
            <LoadingProvider>
              <ToastProvider>
                <ErrorBoundary>
                  <div className="min-h-screen flex flex-col">
                    {children}
                  </div>
                </ErrorBoundary>
              </ToastProvider>
            </LoadingProvider>
          </AccessibilityProvider>
        </AuthProvider>
      </body>
    </html>
  );
}

