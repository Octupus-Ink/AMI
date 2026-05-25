const requiredForLiveMode = [
  "MONGODB_URI",
  "BRIGHT_DATA_API_KEY",
  "BRIGHT_DATA_SERP_ENDPOINT",
  "BRIGHT_DATA_WEB_UNLOCKER_ENDPOINT",
  "OPENAI_API_KEY"
];

export function isEnvConfigured(name: string) {
  return Boolean(process.env[name]?.trim());
}

export function getMissingEnvVars() {
  return requiredForLiveMode.filter((name) => !isEnvConfigured(name));
}

export function getIntegrationStatus() {
  return {
    mongodb: isEnvConfigured("MONGODB_URI"),
    brightData: isEnvConfigured("BRIGHT_DATA_API_KEY"),
    brightDataSerp: isEnvConfigured("BRIGHT_DATA_SERP_ENDPOINT"),
    brightDataWebUnlocker: isEnvConfigured("BRIGHT_DATA_WEB_UNLOCKER_ENDPOINT"),
    openai: isEnvConfigured("OPENAI_API_KEY")
  };
}

export function isDemoMode() {
  return getMissingEnvVars().length > 0;
}
