/**
 * CacheService - In-memory caching with TTL support
 * 
 * Features:
 * - TTL (Time To Live) support
 * - Automatic cleanup of expired entries
 * - Type-safe cache operations
 * - Cache statistics
 */

import { LoggerService } from './LoggerService';

interface CacheEntry<T> {
    value: T;
    expires: number;
    created: number;
}

interface CacheStats {
    hits: number;
    misses: number;
    size: number;
    hitRate: number;
}

export class CacheService {
    private static instance: CacheService;
    private cache: Map<string, CacheEntry<unknown>>;
    private logger: LoggerService;
    private stats: { hits: number; misses: number };
    private cleanupInterval: NodeJS.Timeout | null = null;
    private readonly defaultTTL = 5 * 60 * 1000; // 5 minutes

    private constructor() {
        this.cache = new Map();
        this.logger = LoggerService.getInstance();
        this.stats = { hits: 0, misses: 0 };
        
        // Start cleanup interval
        this.startCleanup();
    }

    public static getInstance(): CacheService {
        if (!CacheService.instance) {
            CacheService.instance = new CacheService();
        }
        return CacheService.instance;
    }

    /**
     * Get value from cache
     */
    public get<T>(key: string): T | null {
        const entry = this.cache.get(key) as CacheEntry<T> | undefined;

        if (!entry) {
            this.stats.misses++;
            this.logger.debug(`Cache miss: ${key}`);
            return null;
        }

        // Check if expired
        if (Date.now() > entry.expires) {
            this.cache.delete(key);
            this.stats.misses++;
            this.logger.debug(`Cache expired: ${key}`);
            return null;
        }

        this.stats.hits++;
        this.logger.debug(`Cache hit: ${key}`);
        return entry.value;
    }

    /**
     * Set value in cache with optional TTL
     */
    public set<T>(key: string, value: T, ttlMs?: number): void {
        const ttl = ttlMs || this.defaultTTL;
        const entry: CacheEntry<T> = {
            value,
            expires: Date.now() + ttl,
            created: Date.now()
        };

        this.cache.set(key, entry as CacheEntry<unknown>);
        this.logger.debug(`Cache set: ${key} (TTL: ${ttl}ms)`);
    }

    /**
     * Check if key exists and is not expired
     */
    public has(key: string): boolean {
        const entry = this.cache.get(key);
        if (!entry) return false;
        
        if (Date.now() > entry.expires) {
            this.cache.delete(key);
            return false;
        }

        return true;
    }

    /**
     * Delete value from cache
     */
    public delete(key: string): boolean {
        const deleted = this.cache.delete(key);
        if (deleted) {
            this.logger.debug(`Cache deleted: ${key}`);
        }
        return deleted;
    }

    /**
     * Clear all cache entries
     */
    public clear(): void {
        this.cache.clear();
        this.stats = { hits: 0, misses: 0 };
        this.logger.info('Cache cleared');
    }

    /**
     * Get or set pattern - fetch if not in cache
     */
    public async getOrSet<T>(
        key: string,
        fetcher: () => Promise<T>,
        ttlMs?: number
    ): Promise<T> {
        const cached = this.get<T>(key);
        if (cached !== null) {
            return cached;
        }

        const value = await fetcher();
        this.set(key, value, ttlMs);
        return value;
    }

    /**
     * Get cache statistics
     */
    public getStats(): CacheStats {
        const total = this.stats.hits + this.stats.misses;
        const hitRate = total > 0 ? this.stats.hits / total : 0;

        return {
            hits: this.stats.hits,
            misses: this.stats.misses,
            size: this.cache.size,
            hitRate: Math.round(hitRate * 100) / 100
        };
    }

    /**
     * Start automatic cleanup of expired entries
     */
    private startCleanup(): void {
        // Run cleanup every minute
        this.cleanupInterval = setInterval(() => {
            this.cleanup();
        }, 60 * 1000);
    }

    /**
     * Clean up expired entries
     */
    private cleanup(): void {
        const now = Date.now();
        let cleaned = 0;

        for (const [key, entry] of this.cache.entries()) {
            if (now > entry.expires) {
                this.cache.delete(key);
                cleaned++;
            }
        }

        if (cleaned > 0) {
            this.logger.debug(`Cache cleanup: removed ${cleaned} expired entries`);
        }
    }

    /**
     * Stop cleanup interval (for testing/shutdown)
     */
    public stopCleanup(): void {
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
            this.cleanupInterval = null;
        }
    }
}
