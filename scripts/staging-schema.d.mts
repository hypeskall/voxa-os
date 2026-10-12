export type CatalogRow = { kind: string; key: string; definition: Record<string, unknown> };
export function compareSchema(expected: CatalogRow[], actual: CatalogRow[]): string[];
export function managementQuery(ref: string, token: string, query: string): Promise<Record<string, unknown>[]>;
