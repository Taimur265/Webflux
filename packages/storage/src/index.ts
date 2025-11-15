/**
 * UWG Storage Package
 * Export storage implementations
 */

export * from './types';
export { SQLiteStorage } from './sqlite-storage';
export { PostgresStorage } from './postgres-storage';
export { RedisCache } from './redis-cache';

// Export singleton instance
import { SQLiteStorage } from './sqlite-storage';

export const defaultStorage = new SQLiteStorage();
