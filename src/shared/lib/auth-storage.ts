const TOKEN_KEY = 'fb_auth_jwt_v1';
const USER_KEY = 'fb_auth_user_v1';

export interface StoredAuthData<TUser = unknown> {
  token: string | null;
  user: TUser | null;
}

export function getStoredAuth<TUser = unknown>(): StoredAuthData<TUser> {
  try {
    const token = localStorage.getItem(TOKEN_KEY);
    const userRaw = localStorage.getItem(USER_KEY);
    const user = userRaw ? (JSON.parse(userRaw) as TUser) : null;
    return { token: token || null, user };
  } catch {
    return { token: null, user: null };
  }
}

export function setStoredAuth<TUser = unknown>(token: string, user: TUser): void {
  try {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  } catch {
    // Ignore quota issues
  }
}

export function clearStoredAuth(): void {
  try {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  } catch {
    // Ignore
  }
}
