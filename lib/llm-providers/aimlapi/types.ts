export type AimlapiConfig = {
  apiKey?: string;
  baseUrl: string;
  enabled: boolean;
  model: string;
  agentModel: string;
  verdictModel: string;
  timeoutMs: number;
};

export type AimlapiCallResult<T> = {
  status: "live" | "fallback" | "disabled" | "not_configured" | "error";
  model: string;
  output?: T;
  safeError?: string;
};
