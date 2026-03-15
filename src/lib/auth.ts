const AUTH_SESSION_KEY = 'pool-hall-authenticated';
const DEFAULT_APP_PASSWORD = 'BreaaakRooom64@@';

const getAppPassword = () => import.meta.env.VITE_APP_PASSWORD || DEFAULT_APP_PASSWORD;

export const isAuthenticated = () => {
  if (typeof window === 'undefined') return false;
  return window.sessionStorage.getItem(AUTH_SESSION_KEY) === 'true';
};

export const loginWithPassword = (password: string) => {
  const isValid = password === getAppPassword();
  if (isValid && typeof window !== 'undefined') {
    window.sessionStorage.setItem(AUTH_SESSION_KEY, 'true');
  }
  return isValid;
};

export const logout = () => {
  if (typeof window === 'undefined') return;
  window.sessionStorage.removeItem(AUTH_SESSION_KEY);
};
