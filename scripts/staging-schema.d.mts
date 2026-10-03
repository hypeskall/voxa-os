export type CatalogRow = { kind: string; key: string; definition: Record<string, unknown> };
export function compareSchema(expected: CatalogRow[], actual: CatalogRow[]): string[];
