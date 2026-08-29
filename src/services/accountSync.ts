import { AuthResponse, UserAccountData, UserProfile, WishlistItem, NotificationAlert } from '../types';

const AUTH_TOKEN_KEY = 'cozy_auth_token';

export function getStoredAuthToken(): string | null {
  try {
    return localStorage.getItem(AUTH_TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setStoredAuthToken(token: string): void {
  try {
    localStorage.setItem(AUTH_TOKEN_KEY, token);
  } catch {}
}

export function clearStoredAuthToken(): void {
  try {
    localStorage.removeItem(AUTH_TOKEN_KEY);
  } catch {}
}

export async function loginAccount(email: string, password: string): Promise<AuthResponse> {
  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    const data: AuthResponse = await res.json();
    if (data.success && data.token) {
      setStoredAuthToken(data.token);
    }
    return data;
  } catch (err: any) {
    return { success: false, error: err.message || 'Unable to connect to server.' };
  }
}

export async function signupAccount(
  email: string, 
  password: string, 
  username?: string, 
  initialData?: {
    profile?: Partial<UserProfile>;
    wishlistedGameIds?: string[];
    wishlistItems?: WishlistItem[];
    bookmarkedArticleIds?: string[];
    notifications?: NotificationAlert[];
  }
): Promise<AuthResponse> {
  try {
    const res = await fetch('/api/auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, username, initialData })
    });
    const data: AuthResponse = await res.json();
    if (data.success && data.token) {
      setStoredAuthToken(data.token);
    }
    return data;
  } catch (err: any) {
    return { success: false, error: err.message || 'Unable to connect to server.' };
  }
}

export async function logoutAccount(): Promise<void> {
  const token = getStoredAuthToken();
  if (token) {
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ token })
      });
    } catch {}
  }
  clearStoredAuthToken();
}

export async function fetchCloudUserData(): Promise<UserAccountData | null> {
  const token = getStoredAuthToken();
  if (!token) return null;

  try {
    const res = await fetch('/api/user/sync', {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });

    if (res.status === 401) {
      clearStoredAuthToken();
      return null;
    }

    const data = await res.json();
    if (data.success && data.user) {
      return data.user as UserAccountData;
    }
    return null;
  } catch {
    return null;
  }
}

export async function pushCloudUserData(payload: {
  profile?: UserProfile;
  wishlistedGameIds?: string[];
  wishlistItems?: WishlistItem[];
  bookmarkedArticleIds?: string[];
  notifications?: NotificationAlert[];
}): Promise<UserAccountData | null> {
  const token = getStoredAuthToken();
  if (!token) return null;

  try {
    const res = await fetch('/api/user/sync', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify(payload)
    });

    if (res.status === 401) {
      clearStoredAuthToken();
      return null;
    }

    const data = await res.json();
    if (data.success && data.user) {
      return data.user as UserAccountData;
    }
    return null;
  } catch {
    return null;
  }
}
