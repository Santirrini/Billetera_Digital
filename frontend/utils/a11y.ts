import { AccessibilityInfo, Platform } from 'react-native';
import { useEffect, useState } from 'react';

export function announce(message: string): void {
  if (!message) return;
  AccessibilityInfo.announceForAccessibility(message);
}

export function useScreenReaderEnabled(): boolean {
  const [enabled, setEnabled] = useState(false);
  useEffect(() => {
    AccessibilityInfo.isScreenReaderEnabled().then(setEnabled);
    const sub = AccessibilityInfo.addEventListener('screenReaderChanged', setEnabled);
    return () => sub.remove();
  }, []);
  return enabled;
}

export function useReduceMotion(): boolean {
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduce);
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduce);
    return () => sub.remove();
  }, []);
  return reduce;
}

export const HIT_SLOP = { top: 12, bottom: 12, left: 12, right: 12 };
export const MIN_TOUCH = 44;

export const a11yButton = (
  label: string,
  opts?: { hint?: string; disabled?: boolean; busy?: boolean; selected?: boolean },
) => ({
  accessible: true,
  accessibilityRole: 'button' as const,
  accessibilityLabel: label,
  accessibilityHint: opts?.hint,
  accessibilityState: {
    disabled: !!opts?.disabled,
    busy: !!opts?.busy,
    selected: opts?.selected,
  },
});

export const a11yLink = (label: string, hint?: string) => ({
  accessible: true,
  accessibilityRole: 'link' as const,
  accessibilityLabel: label,
  accessibilityHint: hint,
});

export const a11yRadio = (label: string, selected: boolean, hint?: string) => ({
  accessible: true,
  accessibilityRole: 'radio' as const,
  accessibilityLabel: label,
  accessibilityHint: hint,
  accessibilityState: { selected, disabled: false },
});

export const a11yText = (label: string, hint?: string) => ({
  accessible: true,
  accessibilityRole: 'text' as const,
  accessibilityLabel: label,
  accessibilityHint: hint,
});

export const a11yLive = (politeness: 'polite' | 'assertive' = 'polite') => ({
  accessibilityLiveRegion: politeness,
  importantForAccessibility: 'yes' as const,
});

export const a11yHidden = {
  accessible: false,
  importantForAccessibility: 'no-hide-descendants' as const,
  accessibilityElementsHidden: true,
};

export function isAndroid(): boolean {
  return Platform.OS === 'android';
}
