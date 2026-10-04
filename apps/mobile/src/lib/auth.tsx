import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AppState, Platform } from 'react-native';
import * as LocalAuthentication from 'expo-local-authentication';
import { api, setAccessToken, setUnauthorizedHandler } from './api';
import { secureStorage } from './storage';

const TOKEN_KEY = 'civicpass.accessToken';
const BIOMETRIC_KEY = 'civicpass.biometricLock';
/** Relock after the app has been in the background this long. */
const RELOCK_AFTER_MS = 60_000;

type Status = 'loading' | 'signedOut' | 'locked' | 'signedIn';

interface Auth {
  status: Status;
  biometricLock: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  completeRegistration: (accessToken: string) => Promise<void>;
  signOut: () => Promise<void>;
  unlock: () => Promise<boolean>;
  setBiometricLock: (on: boolean) => Promise<void>;
}

const Ctx = createContext<Auth | null>(null);

async function biometricsAvailable(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  return (await LocalAuthentication.hasHardwareAsync()) && (await LocalAuthentication.isEnrolledAsync());
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<Status>('loading');
  const [biometricLock, setBiometricLockState] = useState(false);
  const backgroundedAt = useRef<number | null>(null);

  const signOut = useCallback(async () => {
    setAccessToken(null);
    await secureStorage.remove(TOKEN_KEY);
    setStatus('signedOut');
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(() => void signOut());
    (async () => {
      const [token, lock] = await Promise.all([secureStorage.get(TOKEN_KEY), secureStorage.get(BIOMETRIC_KEY)]);
      const lockOn = lock === 'true' && (await biometricsAvailable());
      setBiometricLockState(lockOn);
      if (!token) return setStatus('signedOut');
      setAccessToken(token);
      setStatus(lockOn ? 'locked' : 'signedIn');
    })();
  }, [signOut]);

  // Relock when returning from background.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => {
      if (next === 'background') backgroundedAt.current = Date.now();
      if (next === 'active' && backgroundedAt.current && biometricLock) {
        if (Date.now() - backgroundedAt.current > RELOCK_AFTER_MS) setStatus((s) => (s === 'signedIn' ? 'locked' : s));
        backgroundedAt.current = null;
      }
    });
    return () => sub.remove();
  }, [biometricLock]);

  const persistSession = useCallback(async (token: string) => {
    setAccessToken(token);
    await secureStorage.set(TOKEN_KEY, token);
    setStatus('signedIn');
  }, []);

  const signIn = useCallback(
    async (email: string, password: string) => {
      const { accessToken } = await api.login(email, password);
      await persistSession(accessToken);
    },
    [persistSession],
  );

  const unlock = useCallback(async () => {
    const result = await LocalAuthentication.authenticateAsync({ promptMessage: 'Unlock CivicPass' });
    if (result.success) setStatus('signedIn');
    return result.success;
  }, []);

  const setBiometricLock = useCallback(async (on: boolean) => {
    if (on) {
      if (!(await biometricsAvailable())) throw new Error('Biometrics are not set up on this device.');
      const result = await LocalAuthentication.authenticateAsync({ promptMessage: 'Confirm to enable' });
      if (!result.success) return;
    }
    await secureStorage.set(BIOMETRIC_KEY, String(on));
    setBiometricLockState(on);
  }, []);

  const value = useMemo(
    () => ({ status, biometricLock, signIn, completeRegistration: persistSession, signOut, unlock, setBiometricLock }),
    [status, biometricLock, signIn, persistSession, signOut, unlock, setBiometricLock],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth(): Auth {
  const v = useContext(Ctx);
  if (!v) throw new Error('useAuth outside AuthProvider');
  return v;
}
