/**
 * Storage Factory - Dynamic storage selection based on configuration
 */

import { SQLiteStorage } from './sqlite-storage';
import { PostgresStorage } from './postgres-storage';
import type { IStorage, StorageOptions } from './types';

export type StorageType = 'sqlite' | 'postgres' | 'postgresql';

export interface StorageFactoryOptions {
  type?: StorageType;
  sqlite?: {
    database_path?: string;
    in_memory?: boolean;
  };
  postgres?: {
    host?: string;
    port?: number;
    database?: string;
    user?: string;
    password?: string;
    max?: number;
    ssl?: boolean | { rejectUnauthorized: boolean };
  };
}

/**
 * Create storage instance based on configuration
 */
export function createStorage(options: StorageFactoryOptions = {}): IStorage {
  // Determine storage type from options or environment
  const storageType = (
    options.type ||
    process.env.STORAGE_TYPE ||
    'sqlite'
  ).toLowerCase() as StorageType;

  switch (storageType) {
    case 'postgres':
    case 'postgresql':
      return createPostgresStorage(options.postgres);

    case 'sqlite':
    default:
      return createSQLiteStorage(options.sqlite);
  }
}

/**
 * Create SQLite storage instance
 */
function createSQLiteStorage(options: StorageFactoryOptions['sqlite'] = {}): SQLiteStorage {
  return new SQLiteStorage({
    database_path: options.database_path || process.env.DATABASE_PATH || './data/uwg.db',
    in_memory: options.in_memory || process.env.STORAGE_IN_MEMORY === 'true',
  });
}

/**
 * Create PostgreSQL storage instance
 */
function createPostgresStorage(options: StorageFactoryOptions['postgres'] = {}): PostgresStorage {
  return new PostgresStorage({
    host: options.host || process.env.POSTGRES_HOST || 'localhost',
    port: options.port || parseInt(process.env.POSTGRES_PORT || '5432'),
    database: options.database || process.env.POSTGRES_DB || 'uwg',
    user: options.user || process.env.POSTGRES_USER || 'postgres',
    password: options.password || process.env.POSTGRES_PASSWORD,
    max: options.max || parseInt(process.env.POSTGRES_MAX_CONNECTIONS || '20'),
    ssl: options.ssl !== undefined
      ? options.ssl
      : process.env.POSTGRES_SSL === 'true'
        ? { rejectUnauthorized: false }
        : undefined,
  });
}

/**
 * Get storage type from environment or options
 */
export function getStorageType(): StorageType {
  const type = (process.env.STORAGE_TYPE || 'sqlite').toLowerCase();
  return type === 'postgresql' ? 'postgres' : type as StorageType;
}

/**
 * Check if PostgreSQL is configured
 */
export function isPostgresConfigured(): boolean {
  return !!(
    process.env.POSTGRES_HOST &&
    process.env.POSTGRES_DB &&
    process.env.POSTGRES_USER
  );
}

/**
 * Get recommended storage type based on environment
 */
export function getRecommendedStorageType(): StorageType {
  // Use PostgreSQL in production if configured
  if (process.env.NODE_ENV === 'production' && isPostgresConfigured()) {
    return 'postgres';
  }

  // Use SQLite for development/testing
  return 'sqlite';
}

/**
 * Singleton storage instance (lazy-loaded)
 */
let storageInstance: IStorage | null = null;

/**
 * Get or create singleton storage instance
 */
export function getStorage(): IStorage {
  if (!storageInstance) {
    const type = getStorageType();
    console.log(`Initializing ${type} storage...`);

    storageInstance = createStorage({ type });

    // Initialize storage
    storageInstance.initialize().catch((error) => {
      console.error('Failed to initialize storage:', error);
      throw error;
    });
  }

  return storageInstance;
}

/**
 * Reset singleton (useful for testing)
 */
export function resetStorage(): void {
  if (storageInstance) {
    storageInstance.close().catch(console.error);
    storageInstance = null;
  }
}
