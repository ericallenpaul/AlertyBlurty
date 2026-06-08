const tokenKey = "authToken";

export function getToken(): string | null {
  return window.localStorage.getItem(tokenKey);
}

export function setToken(token: string): void {
  window.localStorage.setItem(tokenKey, token);
}

export function clearToken(): void {
  window.localStorage.removeItem(tokenKey);
}
