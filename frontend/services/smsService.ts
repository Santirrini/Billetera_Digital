import { NativeModules, Platform, PermissionsAndroid, Alert } from 'react-native';

const { SmsReceiverModule } = NativeModules;

interface SmsApiResult {
  success: boolean;
  statusCode?: number;
  response?: string;
  error?: string;
}

const BANCOLOMBIA_API_URL = 'https://billetera-digital.onrender.com/api/sms/process';

export async function requestSmsPermission(): Promise<boolean> {
  if (Platform.OS !== 'android') return false;

  try {
    const granted = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.RECEIVE_SMS,
      {
        title: 'Permiso de SMS',
        message: 'La app necesita acceso a tus SMS para procesar automáticamente las notificaciones de Bancolombia.',
        buttonNeutral: 'Preguntar después',
        buttonNegative: 'Cancelar',
        buttonPositive: 'Aceptar',
      }
    );
    return granted === PermissionsAndroid.RESULTS.GRANTED;
  } catch (err) {
    console.warn('SMS permission error:', err);
    return false;
  }
}

export async function checkSmsPermission(): Promise<boolean> {
  if (Platform.OS !== 'android') return false;

  try {
    const result = await PermissionsAndroid.check(
      PermissionsAndroid.PERMISSIONS.RECEIVE_SMS
    );
    return result;
  } catch (err) {
    console.warn('SMS permission check error:', err);
    return false;
  }
}

export async function sendSmsToApi(message: string): Promise<SmsApiResult> {
  if (Platform.OS !== 'android') {
    return { success: false, error: 'Only Android supported' };
  }

  if (!SmsReceiverModule) {
    return { success: false, error: 'Native module not available' };
  }

  try {
    const result = await SmsReceiverModule.sendSmsToApi(message, BANCOLOMBIA_API_URL);
    return result as SmsApiResult;
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export function isBancolombiaSms(message: string): boolean {
  return message.toLowerCase().includes('bancolombia');
}
