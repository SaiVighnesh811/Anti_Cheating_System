import { useEffect, useState, useCallback } from 'react';

/**
 * useLockdown — Anti-Cheat Browser Lockdown Hook
 * Attaches event listeners to block restricted browser actions during an active exam.
 * Only activates when isActive === true. Zero interference with other hooks.
 *
 * @param {boolean} isActive - Whether the exam lockdown should be active
 * @returns {{ toastMessage: string|null, clearToast: Function }}
 */
export const useLockdown = (isActive) => {
  const [toastMessage, setToastMessage] = useState(null);
  const toastTimerRef = { current: null };

  const showToast = useCallback((message) => {
    setToastMessage(message);
    // Clear any existing timer
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => {
      setToastMessage(null);
    }, 2500);
  }, []);

  const clearToast = useCallback(() => {
    setToastMessage(null);
  }, []);

  useEffect(() => {
    if (!isActive) return;

    // Block right-click context menu
    const handleContextMenu = (e) => {
      e.preventDefault();
      showToast('🚫 Action not allowed during exam');
    };

    // Block keyboard shortcuts
    const handleKeyDown = (e) => {
      const ctrl = e.ctrlKey || e.metaKey;

      // Ctrl+C (copy)
      if (ctrl && e.key === 'c') {
        e.preventDefault();
        showToast('🚫 Copying is not allowed during exam');
        return;
      }

      // Ctrl+V (paste)
      if (ctrl && e.key === 'v') {
        e.preventDefault();
        showToast('🚫 Pasting is not allowed during exam');
        return;
      }

      // Ctrl+X (cut)
      if (ctrl && e.key === 'x') {
        e.preventDefault();
        showToast('🚫 Cutting is not allowed during exam');
        return;
      }

      // Ctrl+Shift+I (DevTools)
      if (ctrl && e.shiftKey && e.key === 'I') {
        e.preventDefault();
        showToast('🚫 Developer Tools are blocked during exam');
        return;
      }

      // Ctrl+Shift+J (DevTools Console - Chrome)
      if (ctrl && e.shiftKey && e.key === 'J') {
        e.preventDefault();
        showToast('🚫 Developer Tools are blocked during exam');
        return;
      }

      // Ctrl+Shift+C (Inspector)
      if (ctrl && e.shiftKey && e.key === 'C') {
        e.preventDefault();
        showToast('🚫 Action not allowed during exam');
        return;
      }

      // F12 (DevTools)
      if (e.key === 'F12') {
        e.preventDefault();
        showToast('🚫 Developer Tools are blocked during exam');
        return;
      }

      // Ctrl+U (View Source)
      if (ctrl && e.key === 'u') {
        e.preventDefault();
        showToast('🚫 Action not allowed during exam');
        return;
      }

      // Ctrl+S (Save page source)
      if (ctrl && e.key === 's') {
        e.preventDefault();
        showToast('🚫 Action not allowed during exam');
        return;
      }

      // Ctrl+P (Print)
      if (ctrl && e.key === 'p') {
        e.preventDefault();
        showToast('🚫 Printing is not allowed during exam');
        return;
      }
    };

    // Block copy/cut/paste events at the document level (covers drag-select copy too)
    const handleCopy = (e) => {
      e.preventDefault();
      showToast('🚫 Copying is not allowed during exam');
    };

    const handleCut = (e) => {
      e.preventDefault();
      showToast('🚫 Cutting is not allowed during exam');
    };

    // Allow paste only for inputs (so students can paste answers if needed)
    // Paste is blocked at the shortcut level; document-level paste block is optional
    // Keeping this OUT to avoid blocking answer input fields

    document.addEventListener('contextmenu', handleContextMenu);
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('copy', handleCopy);
    document.addEventListener('cut', handleCut);

    return () => {
      document.removeEventListener('contextmenu', handleContextMenu);
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('copy', handleCopy);
      document.removeEventListener('cut', handleCut);
    };
  }, [isActive, showToast]);

  return { toastMessage, clearToast };
};
