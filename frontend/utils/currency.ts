import { AccessibilityInfo } from 'react-native';

const UNITS = [
  'cero', 'uno', 'dos', 'tres', 'cuatro', 'cinco', 'seis', 'siete', 'ocho', 'nueve',
  'diez', 'once', 'doce', 'trece', 'catorce', 'quince', 'dieciséis', 'diecisiete',
  'dieciocho', 'diecinueve', 'veinte', 'veintiuno', 'veintidós', 'veintitrés',
  'veinticuatro', 'veinticinco', 'veintiséis', 'veintisiete', 'veintiocho', 'veintinueve',
];

const TENS = ['', '', '', 'treinta', 'cuarenta', 'cincuenta', 'sesenta', 'setenta', 'ochenta', 'noventa'];
const HUNDREDS = ['', 'ciento', 'doscientos', 'trescientos', 'cuatrocientos', 'quinientos', 'seiscientos', 'setecientos', 'ochocientos', 'novecientos'];

function under100(n: number): string {
  if (n < 30) return UNITS[n];
  const t = Math.floor(n / 10);
  const u = n % 10;
  if (u === 0) return TENS[t];
  return `${TENS[t]} y ${UNITS[u]}`;
}

function under1000(n: number): string {
  if (n === 100) return 'cien';
  if (n < 100) return under100(n);
  const h = Math.floor(n / 100);
  const r = n % 100;
  if (r === 0) return HUNDREDS[h];
  return `${HUNDREDS[h]} ${under100(r)}`;
}

export function numberToSpanishWords(n: number): string {
  if (!Number.isFinite(n)) return '';
  if (n === 0) return 'cero';
  const negative = n < 0;
  const abs = Math.abs(Math.trunc(n));
  let result = '';

  if (abs >= 1_000_000_000) {
    const billions = Math.floor(abs / 1_000_000_000);
    result += `${numberToSpanishWords(billions)} mil millones`;
    const rem = abs % 1_000_000_000;
    if (rem) result += ` ${numberToSpanishWords(rem)}`;
  } else if (abs >= 1_000_000) {
    const millions = Math.floor(abs / 1_000_000);
    result += millions === 1 ? 'un millón' : `${numberToSpanishWords(millions)} millones`;
    const rem = abs % 1_000_000;
    if (rem) result += ` ${numberToSpanishWords(rem)}`;
  } else if (abs >= 1_000) {
    const thousands = Math.floor(abs / 1_000);
    result += thousands === 1 ? 'mil' : `${numberToSpanishWords(thousands)} mil`;
    const rem = abs % 1_000;
    if (rem) result += ` ${numberToSpanishWords(rem)}`;
  } else {
    result = under1000(abs);
  }

  return negative ? `menos ${result}` : result;
}

export function formatCOP(amount: number): string {
  return `$${amount.toLocaleString('es-CO', { minimumFractionDigits: 0 })}`;
}

export function formatCOPForSR(amount: number, currency = 'pesos colombianos'): string {
  const value = numberToSpanishWords(Math.abs(Math.trunc(amount)));
  const prefix = amount < 0 ? 'menos ' : '';
  return `${prefix}${value} ${currency}`;
}
