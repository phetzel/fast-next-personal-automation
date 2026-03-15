export const ACCESS_TOKEN_MAX_AGE_SECONDS = 60 * 30;
export const REFRESH_TOKEN_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;

type CookieSetter = {
  set: (
    name: string,
    value: string,
    options: {
      httpOnly: boolean;
      secure: boolean;
      sameSite: "lax";
      maxAge: number;
      path: string;
    }
  ) => void;
};

const AUTH_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
};

export function setAccessTokenCookie(target: CookieSetter, accessToken: string) {
  target.set("access_token", accessToken, {
    ...AUTH_COOKIE_OPTIONS,
    maxAge: ACCESS_TOKEN_MAX_AGE_SECONDS,
  });
}

export function setRefreshTokenCookie(target: CookieSetter, refreshToken: string) {
  target.set("refresh_token", refreshToken, {
    ...AUTH_COOKIE_OPTIONS,
    maxAge: REFRESH_TOKEN_MAX_AGE_SECONDS,
  });
}

export function setAuthCookies(
  target: CookieSetter,
  tokens: { access_token: string; refresh_token: string }
) {
  setAccessTokenCookie(target, tokens.access_token);
  setRefreshTokenCookie(target, tokens.refresh_token);
}

export function clearAuthCookies(target: CookieSetter) {
  target.set("access_token", "", {
    ...AUTH_COOKIE_OPTIONS,
    maxAge: 0,
  });

  target.set("refresh_token", "", {
    ...AUTH_COOKIE_OPTIONS,
    maxAge: 0,
  });
}
