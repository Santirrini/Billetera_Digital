import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { announce, useReduceMotion } from '@/utils/a11y';

type A11yContextValue = {
  highContrast: boolean;
  setHighContrast: (v: boolean) => void;
  toggleHighContrast: () => void;
  systemReduceMotion: boolean;
  announceMessage: (message: string) => void;
};

const A11yContext = createContext<A11yContextValue | null>(null);

export function A11yProvider({ children }: { children: React.ReactNode }) {
  const [highContrast, setHighContrast] = useState(false);
  const systemReduceMotion = useReduceMotion();

  const toggleHighContrast = useCallback(() => {
    setHighContrast((prev) => {
      const next = !prev;
      announce(next ? 'Modo alto contraste activado' : 'Modo alto contraste desactivado');
      return next;
    });
  }, []);

  const announceMessage = useCallback((message: string) => {
    announce(message);
  }, []);

  const value = useMemo<A11yContextValue>(
    () => ({
      highContrast,
      setHighContrast,
      toggleHighContrast,
      systemReduceMotion,
      announceMessage,
    }),
    [highContrast, toggleHighContrast, systemReduceMotion, announceMessage],
  );

  return <A11yContext.Provider value={value}>{children}</A11yContext.Provider>;
}

export function useA11y(): A11yContextValue {
  const ctx = useContext(A11yContext);
  if (!ctx) {
    return {
      highContrast: false,
      setHighContrast: () => {},
      toggleHighContrast: () => {},
      systemReduceMotion: false,
      announceMessage: () => {},
    };
  }
  return ctx;
}
