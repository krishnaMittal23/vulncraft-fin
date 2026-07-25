// Centralized JWT token storage + auth header helper.

const TOKEN_KEY = "token";

export const getToken = () => localStorage.getItem(TOKEN_KEY);

export const setToken = (token) =>
  localStorage.setItem(TOKEN_KEY, token);

export const clearToken = () => localStorage.removeItem(TOKEN_KEY);

/**
 * Returns an Authorization header object when a token is present, else `{}`.
 * Spread into a fetch `headers` object: `headers: { ...authHeaders() }`.
 */
export const authHeaders = () => {
  const token = getToken();
  return token
    ? { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }
    : { "Content-Type": "application/json" };
};

/**
 * fetch wrapper that injects auth headers and provides global 401 recovery.
 * On a 401 it clears the stored token + user and redirects to the login page,
 * then still returns the response so callers can handle it.
 */
export const authFetch = async (
  url,
  options = {}
) => {
  const res = await fetch(url, {
    ...options,
    headers: { ...authHeaders(), ...(options.headers || {}) },
  });
  if (res.status === 401) {
    clearToken();
    localStorage.removeItem("user");
    window.location.assign("/");
  }
  return res;
};
