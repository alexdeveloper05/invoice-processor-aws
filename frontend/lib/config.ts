export type RuntimeConfig = {
  awsRegion: string;
  cognitoUserPoolId: string;
  cognitoClientId: string;
  apiBaseUrl: string;
};

let cachedConfig: Promise<RuntimeConfig> | null = null;

export function getRuntimeConfig(): Promise<RuntimeConfig> {
  if (!cachedConfig) {
    cachedConfig = fetch("/config.json").then((response) => {
      if (!response.ok) {
        throw new Error("Failed to load runtime config");
      }
      return response.json() as Promise<RuntimeConfig>;
    });
  }
  return cachedConfig;
}
