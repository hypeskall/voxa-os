export function readEnv(file: string): Record<string, string>;
export function stagingEnv(file?: string): { env: Record<string, string>; ref: string; origin: string; publicKey: string };
