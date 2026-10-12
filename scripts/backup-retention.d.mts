export const minimumBackupRetentionSeconds: number;
export function coversBackup(rules: unknown, objectKey: string, now?: number): boolean;
type Settings = { account: string; bucket: string; token: string };
export function assertBackupRetention(settings: Settings, objectKey: string, fetcher?: typeof fetch): Promise<void>;
export function configureBackupRetention(settings: Settings, fetcher?: typeof fetch): Promise<{ verified: boolean; prefix: string; minimumRetentionDays: number; verifiedAt: string }>;
