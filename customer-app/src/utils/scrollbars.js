import { Platform } from 'react-native';

/**
 * Initializes cross-browser smooth scrolling and scrollbar-hiding architecture.
 * Supports Chrome, Safari, Edge, Firefox, iOS Safari, Android Webview, and desktop browsers.
 * Preserves 100% of mouse wheel, touch swipe, trackpad, keyboard, and programmatic scrolling.
 */
export function setupGlobalScrollbars() {
  if (Platform.OS === 'web' && typeof document !== 'undefined') {
    const styleId = 'mendroo-global-hidden-scrollbars';
    if (!document.getElementById(styleId)) {
      const style = document.createElement('style');
      style.id = styleId;
      style.textContent = `
        /* Smooth scrolling with reduced-motion accessibility */
        html {
          scroll-behavior: smooth !important;
        }
        @media (prefers-reduced-motion: reduce) {
          html, :root, * {
            scroll-behavior: auto !important;
          }
        }

        /* Hide scrollbars cross-browser on all elements, containers, and views */
        html, body, #root, * {
          scrollbar-width: none !important; /* Firefox */
          -ms-overflow-style: none !important; /* IE 10+ and Edge */
        }

        /* WebKit / Chromium (Chrome, Edge, Safari, Opera) */
        *::-webkit-scrollbar {
          display: none !important;
          width: 0 !important;
          height: 0 !important;
          background: transparent !important;
          -webkit-appearance: none !important;
        }

        *::-webkit-scrollbar-thumb,
        *::-webkit-scrollbar-track,
        *::-webkit-scrollbar-corner {
          display: none !important;
          background: transparent !important;
        }
      `;
      document.head.appendChild(style);
    }
  }
}

// Auto-execute immediately upon module import
setupGlobalScrollbars();
