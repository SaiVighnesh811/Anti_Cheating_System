import { useEffect, useRef, useState } from 'react';
import api from '../services/api';

export const useAntiCheat = (attemptId, isExamActive = true, userRole = 'student') => {
  const [warnings, setWarnings] = useState(0);
  const [isWarningVisible, setIsWarningVisible] = useState(false);
  const [isDisqualified, setIsDisqualified] = useState(false);
  
  const attemptIdRef = useRef(attemptId);
  const isExamActiveRef = useRef(isExamActive);
  const userRoleRef = useRef(userRole);
  const isDisqualifiedRef = useRef(isDisqualified);
  
  useEffect(() => {
    attemptIdRef.current = attemptId;
    isExamActiveRef.current = isExamActive;
    userRoleRef.current = userRole;
    isDisqualifiedRef.current = isDisqualified;
  }, [attemptId, isExamActive, userRole, isDisqualified]);

  // Fetch initial violation count on load/resume
  useEffect(() => {
    const fetchInitialViolations = async () => {
      if (!attemptId || userRole !== 'student') return;
      try {
        const { data } = await api.get(`/attempts/${attemptId}/violations`);
        setWarnings(data.length);
      } catch (error) {
        console.error('Failed to fetch initial violations', error);
      }
    };
    fetchInitialViolations();
  }, [attemptId, userRole]);

  const logViolation = async (type) => {
    if (!attemptIdRef.current || !isExamActiveRef.current) return;
    if (userRoleRef.current !== 'student') return;
    if (isDisqualifiedRef.current) return; // Halt unconditionally if disqualified
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

  const triggerDisqualification = () => {
    setIsDisqualified(true);
  };

  return { warnings, isWarningVisible, dismissWarning, logViolation, triggerDisqualification };
};
