/**
 * UWG Storage Package
 * Export storage implementations
 */

export * from './types';
export { SQLiteStorage } from './sqlite-storage';

// Export singleton instance
import { SQLiteStorage } from './sqlite-storage';

export const defaultStorage = new SQLiteStorage();
