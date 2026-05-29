import type { z } from "zod";
import { callAimlapiJson, getAimlapiConfig } from "@/lib/llm-providers/aimlapi/client";
import type { AimlapiCallResult } from "@/lib/llm-providers/aimlapi/types";

export async function generateAgentJson<T>(
  schema: z.ZodType<T>,
  system: string,
  payload: unknown
): Promise<AimlapiCallResult<T>> {
  const config = getAimlapiConfig();
  return callAimlapiJson(schema, {
    model: config.agentModel,
    system,
    user: payload,
    temperature: 0.1
  });
}

export async function generateVerdictJson<T>(
  schema: z.ZodType<T>,
  system: string,
  payload: unknown
): Promise<AimlapiCallResult<T>> {
  const config = getAimlapiConfig();
  return callAimlapiJson(schema, {
    model: config.verdictModel,
    system,
    user: payload,
    temperature: 0.15
  });
}
