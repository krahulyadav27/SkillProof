import type { CorsOptions } from "cors";

const localFrontendOrigin = "http://localhost:5173";

function normalizeOrigin(value: string): string | undefined {
  try {
    const url = new URL(value.trim());
    if ((url.protocol !== "http:" && url.protocol !== "https:") || url.username || url.password) return undefined;
    if (url.pathname !== "/" || url.search || url.hash) return undefined;
    return url.origin;
  } catch {
    return undefined;
  }
}

export function createCorsOptions(env: NodeJS.ProcessEnv = process.env): CorsOptions {
  const configuredOrigins = [env.CLIENT_ORIGINS, env.CLIENT_ORIGIN]
    .flatMap(value => value?.split(",") ?? [])
    .map(normalizeOrigin)
    .filter((origin): origin is string => !!origin && origin !== "*");
  const allowedOrigins = new Set([localFrontendOrigin, ...configuredOrigins]);

  return {
    origin: (origin, callback) => callback(null, !origin || allowedOrigins.has(origin)),
    credentials: true
  };
}
