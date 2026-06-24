import { useMemo } from 'react';
import { useA11y } from '@/contexts/A11yContext';

const BASE_COLORS = {
  amber: '#F5A623',
  amberLight: '#FFD470',
  amberDark: '#D4890A',
  amberGlow: 'rgba(245,166,35,0.18)',
  amberMuted: 'rgba(245,166,35,0.55)',
  bg: '#0A0A0A',
  surface: '#141414',
  surfaceLight: '#1C1C1C',
  green: '#00B894',
  red: '#FF6B6B',
  text: '#F0EDE8',
  textMuted: '#9A938A',
  textDim: '#8A857F',
  border: 'rgba(255,255,255,0.18)',
  overlay: 'rgba(0,0,0,0.75)',
};

const HIGH_CONTRAST_COLORS = {
  ...BASE_COLORS,
  amber: '#FFC04D',
  amberLight: '#FFD980',
  amberDark: '#E0A040',
  amberGlow: 'rgba(255,192,77,0.28)',
  amberMuted: 'rgba(255,192,77,0.7)',
  text: '#FFFFFF',
  textMuted: '#D8D2C8',
  textDim: '#B5AFA6',
  border: 'rgba(255,255,255,0.45)',
};

export const COLORS = BASE_COLORS;

export type Colors = typeof BASE_COLORS;

export function useColors(): Colors {
  const { highContrast } = useA11y();
  return useMemo(() => (highContrast ? HIGH_CONTRAST_COLORS : BASE_COLORS), [highContrast]);
}

export default COLORS;
