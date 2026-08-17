import {
  CognitoIdentityProviderClient,
  InitiateAuthCommand,
} from "@aws-sdk/client-cognito-identity-provider";
import { getRuntimeConfig } from "./config";

export type Session = {
  idToken: string;
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
};

const STORAGE_KEY = "invoice-processor.session";
const EXPIRY_BUFFER_MS = 60_000;

function loadStoredSession(): Session | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Session) : null;
  } catch {
    return null;
  }
}

function saveStoredSession(session: Session): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
}

function clearStoredSession(): void {
  localStorage.removeItem(STORAGE_KEY);
}

async function authenticate(
  authFlow: "USER_PASSWORD_AUTH" | "REFRESH_TOKEN_AUTH",
  authParameters: Record<string, string>,
  fallbackRefreshToken?: string
): Promise<Session> {
  const config = await getRuntimeConfig();
  const client = new CognitoIdentityProviderClient({ region: config.awsRegion });

  const result = await client.send(
    new InitiateAuthCommand({
      AuthFlow: authFlow,
      ClientId: config.cognitoClientId,
      AuthParameters: authParameters,
    })
  );

  const authResult = result.AuthenticationResult;
  const idToken = authResult?.IdToken;
  const accessToken = authResult?.AccessToken;
  const refreshToken = authResult?.RefreshToken ?? fallbackRefreshToken;
  if (!idToken || !accessToken || !refreshToken) {
    throw new Error("Login failed");
  }

  const expiresAt = Date.now() + (authResult.ExpiresIn ?? 3600) * 1000;
  return { idToken, accessToken, refreshToken, expiresAt };
}

export async function login(email: string, password: string): Promise<Session> {
  const session = await authenticate("USER_PASSWORD_AUTH", {
    USERNAME: email,
    PASSWORD: password,
  });
  saveStoredSession(session);
  return session;
}

export function logout(): void {
  clearStoredSession();
}

/**
 * Returns the current session, transparently refreshing the short-lived
 * access/ID tokens (1h) via the refresh token (10d) when needed. Returns
 * null once the refresh token itself has expired or there's no session.
 */
export async function getSession(): Promise<Session | null> {
  const stored = loadStoredSession();
  if (!stored) return null;

  if (stored.expiresAt - Date.now() > EXPIRY_BUFFER_MS) {
    return stored;
  }

  try {
    const refreshed = await authenticate(
      "REFRESH_TOKEN_AUTH",
      { REFRESH_TOKEN: stored.refreshToken },
      stored.refreshToken
    );
    saveStoredSession(refreshed);
    return refreshed;
  } catch {
    clearStoredSession();
    return null;
  }
}
