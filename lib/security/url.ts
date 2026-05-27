const PRIVATE_HOST_PATTERNS = [
  /^localhost$/i,
  /^127\./,
  /^10\./,
  /^192\.168\./,
  /^169\.254\./,
  /^172\.(1[6-9]|2[0-9]|3[0-1])\./,
  /^\[?::1\]?$/i,
  /^0\.0\.0\.0$/,
  /^fc00:/i,
  /^fd00:/i
];

export function validatePublicHttpUrl(rawUrl: string) {
  let parsed: URL;

  try {
    parsed = new URL(rawUrl);
  } catch {
    return {
      ok: false,
      reason: "URL is not valid"
    };
  }

  if (!["http:", "https:"].includes(parsed.protocol)) {
    return {
      ok: false,
      reason: "Only http and https inventory URLs are allowed"
    };
  }

  const hostname = parsed.hostname.toLowerCase();
  const blocked = PRIVATE_HOST_PATTERNS.some((pattern) => pattern.test(hostname));

  if (blocked) {
    return {
      ok: false,
      reason: "Inventory URLs cannot target localhost or internal network addresses"
    };
  }

  return {
    ok: true,
    normalizedUrl: parsed.toString()
  };
}
