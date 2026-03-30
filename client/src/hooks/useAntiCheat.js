import { useEffect, useRef, useState } from 'react';
import api from '../services/api';

export const useAntiCheat = (attemptId, isExamActive = true) => {
  const [warnings, setWarnings] = useState(0);
  const [isWarningVisible, setIsWarningVisible] = useState(false);
  
  const attemptIdRef = useRef(attemptId);
  const isExamActiveRef = useRef(isExamActive);
  
  useEffect(() => {
    attemptIdRef.current = attemptId;
    isExamActiveRef.current = isExamActive;
  }, [attemptId, isExamActive]);

  const logViolation = async (type) => {
    if (!attemptIdRef.current || !isExamActiveRef.current) return;
    try {
      await api.post(`/attempts/${attemptIdRef.current}/violation`, { type });
      setWarnings(prev => prev + 1);
      setIsWarningVisible(true);
    } catch (error) {
      console.error('Failed to log violation', error);
    }
  };

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        logViolation('tab-switch');
      }
    };

    const handleBlur = () => {
      logViolation('window-blur');
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleBlur);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleBlur);
    };
  }, []);

  const dismissWarning = () => setIsWarningVisible(false);

  return { warnings, isWarningVisible, dismissWarning, logViolation };
};
