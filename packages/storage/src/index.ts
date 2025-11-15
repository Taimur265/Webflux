/**
 * UWG Storage Package
 * Export storage implementations
 */

export * from './types';
export { SQLiteStorage } from './sqlite-storage';
export { PostgresStorage } from './postgres-storage';
export { RedisCache } from './redis-cache';
export * from './storage-factory';

// Export singleton instance (dynamic based on env)
import { getStorage } from './storage-factory';

export const defaultStorage = getStorage();
