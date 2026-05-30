import { z } from "zod";
import type { AimlapiCallResult, AimlapiConfig } from "@/lib/llm-providers/aimlapi/types";

function readBoolean(value: string | undefined, fallback: boolean) {
  if (!value) {
    return fallback;
  }

  return value.toLowerCase() === "true";
}

function readInt(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}

export function getAimlapiConfig(): AimlapiConfig {
  return {
    apiKey: process.env.AIMLAPI_API_KEY?.trim(),
    baseUrl: process.env.AIMLAPI_BASE_URL?.trim() || "https://api.aimlapi.com/v1",
    enabled: readBoolean(process.env.AIMLAPI_ENABLED, true),
    model: process.env.AIMLAPI_MODEL?.trim() || "google/gemini-2.5-flash",
    agentModel: process.env.AIMLAPI_AGENT_MODEL?.trim() || process.env.AIMLAPI_MODEL?.trim() || "google/gemini-2.5-flash-lite-preview",
    verdictModel: process.env.AIMLAPI_VERDICT_MODEL?.trim() || process.env.AIMLAPI_MODEL?.trim() || "google/gemini-2.5-flash",
    timeoutMs: readInt(process.env.AIMLAPI_TIMEOUT_MS, 30_000)
  };
}

export function validateAimlapiEnv(config = getAimlapiConfig()) {
  const missing: string[] = [];

  if (!config.apiKey) {
    missing.push("AIMLAPI_API_KEY");
  }

  if (!config.baseUrl) {
    missing.push("AIMLAPI_BASE_URL");
  }

  return {
    configured: missing.length === 0,
    missing
  };
}

function safeError(error: unknown) {
  if (error instanceof z.ZodError) {
    return "AIMLAPI response did not match the expected structured JSON schema.";
  }

  if (error instanceof Error) {
    return error.message.replace(/Bearer\s+[A-Za-z0-9._-]+/g, "Bearer [redacted]");
  }

  return "Unknown AIMLAPI error";
}

function extractJson(content: string) {
  const trimmed = content.trim();

  if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
    return trimmed;
  }

  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);

  if (fenced?.[1]) {
    return fenced[1].trim();
  }

  const first = trimmed.indexOf("{");
  const last = trimmed.lastIndexOf("}");

  if (first >= 0 && last > first) {
    return trimmed.slice(first, last + 1);
  }

  return trimmed;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function normalizeStructuredCandidate(value: unknown): unknown {
  if (!isRecord(value)) {
    return value;
  }

  const next = { ...value };

  for (const key of ["agentType", "status", "riskLevel", "priority"]) {
    const current = next[key];

    if (typeof current === "string") {
      next[key] = current.toLowerCase().replace(/\s+/g, "_");
    }
  }

  return next;
}

function candidateObjects(parsed: unknown) {
  if (!isRecord(parsed)) {
    return [parsed];
  }

  const envelopeKeys = [
    "output",
    "result",
    "response",
    "data",
    "json",
    "orchestrator",
    "orchestratorSynthesis",
    "synthesis",
    "verdict",
    "finalVerdict"
  ];
  const candidates: unknown[] = [parsed];

  for (const key of envelopeKeys) {
    if (isRecord(parsed[key])) {
      candidates.push(parsed[key]);
    }
  }

  const objectValues = Object.values(parsed).filter(isRecord);

  if (objectValues.length === 1) {
    candidates.push(objectValues[0]);
  }

  return candidates;
}

export async function callAimlapiJson<T>(
  schema: z.ZodType<T>,
  options: {
    model: string;
    system: string;
    user: unknown;
    temperature?: number;
  },
  overrideConfig?: Partial<AimlapiConfig>
): Promise<AimlapiCallResult<T>> {
  const config = { ...getAimlapiConfig(), ...overrideConfig };
  const env = validateAimlapiEnv(config);

  if (!config.enabled) {
    return { status: "disabled", model: options.model, safeError: "AIMLAPI_ENABLED is false." };
  }

  if (!env.configured) {
    return { status: "not_configured", model: options.model, safeError: `AIMLAPI is not configured: ${env.missing.join(", ")}.` };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.timeoutMs);

  try {
    const response = await fetch(`${config.baseUrl.replace(/\/$/, "")}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: options.model,
        temperature: options.temperature ?? 0.2,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content: `${options.system}\nReturn only strict JSON. Do not include markdown.`
          },
          {
            role: "user",
            content: JSON.stringify(options.user)
          }
        ]
      }),
      signal: controller.signal
    });
    const payload = await response.json().catch(async () => ({ raw: await response.text().catch(() => "") }));

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: AIMLAPI request failed`);
    }

    const content = payload?.choices?.[0]?.message?.content;

    if (typeof content !== "string") {
      throw new Error("AIMLAPI response did not include a JSON message.");
    }

    const parsed = JSON.parse(extractJson(content));
    let output: T | undefined;

    for (const candidate of candidateObjects(parsed)) {
      const normalized = normalizeStructuredCandidate(candidate);
      const attempt = schema.safeParse(normalized);

      if (attempt.success) {
        output = attempt.data;
        break;
      }
    }

    if (!output) {
      output = schema.parse(normalizeStructuredCandidate(parsed));
    }

    return {
      status: "live",
      model: options.model,
      output
    };
  } catch (error) {
    return {
      status: "error",
      model: options.model,
      safeError: safeError(error)
    };
  } finally {
    clearTimeout(timeout);
  }
}
