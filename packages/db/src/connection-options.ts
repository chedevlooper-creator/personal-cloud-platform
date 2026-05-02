export const DEFAULT_DB_SEARCH_PATH = 'cloudmind,public';

export type PostgresConnectionOptions = {
  max: number;
  connection: {
    search_path: string;
  };
};

export function normalizeDbSearchPath(value: string | null | undefined): string {
  const raw = value?.trim() ? value : DEFAULT_DB_SEARCH_PATH;
  const parts = raw
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);

  return parts.length > 0 ? parts.join(',') : DEFAULT_DB_SEARCH_PATH;
}

export function createPostgresOptions(input: {
  maxConnections: number;
  searchPath?: string | null;
}): PostgresConnectionOptions {
  return {
    max: input.maxConnections,
    connection: {
      search_path: normalizeDbSearchPath(input.searchPath),
    },
  };
}
