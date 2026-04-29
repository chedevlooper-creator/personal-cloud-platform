export interface SharedCorsOptions {
  origin: true | string[];
  credentials: true;
}

export function createCorsOptions(
  nodeEnv: string,
  allowedOrigins = process.env.CORS_ALLOWED_ORIGINS,
): SharedCorsOptions {
  if (nodeEnv !== 'production') {
    return { origin: true, credentials: true };
  }

  return {
    origin: parseAllowedCorsOrigins(allowedOrigins),
    credentials: true,
  };
}

export function parseAllowedCorsOrigins(value: string | undefined): string[] {
  const entries = value
    ?.split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  if (!entries?.length) {
    throw new Error('CORS_ALLOWED_ORIGINS must be set in production');
  }

  return Array.from(new Set(entries.map(normalizeCorsOrigin)));
}

function normalizeCorsOrigin(origin: string): string {
  if (origin === '*') {
    throw new Error('CORS_ALLOWED_ORIGINS must not contain wildcard origins in production');
  }

  let parsed: URL;
  try {
    parsed = new URL(origin);
  } catch {
    throw new Error(`CORS_ALLOWED_ORIGINS contains an invalid URL: ${origin}`);
  }

  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    throw new Error(`CORS_ALLOWED_ORIGINS only supports http(s) origins: ${origin}`);
  }

  if (parsed.pathname !== '/' || parsed.search || parsed.hash || parsed.username || parsed.password) {
    throw new Error(
      `CORS_ALLOWED_ORIGINS entries must be origins only, without paths or credentials: ${origin}`,
    );
  }

  return parsed.origin;
}
