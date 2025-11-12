import { UI } from './UI';

export interface PerformanceMetric {
    name: string;
    startTime: number;
    endTime?: number;
    duration?: number;
}

export class PerformanceMonitor {
    private static metrics: Map<string, PerformanceMetric> = new Map();
    private static globalStart: number = Date.now();

    /**
     * Start timing an operation
     */
    static start(name: string): void {
        this.metrics.set(name, {
            name,
            startTime: Date.now()
        });
    }

    /**
     * End timing an operation
     */
    static end(name: string): number {
        const metric = this.metrics.get(name);
        if (!metric) {
            console.warn(`No metric found for: ${name}`);
            return 0;
        }

        metric.endTime = Date.now();
        metric.duration = metric.endTime - metric.startTime;

        return metric.duration;
    }

    /**
     * Get duration of an operation
     */
    static getDuration(name: string): number {
        const metric = this.metrics.get(name);
        return metric?.duration || 0;
    }

    /**
     * Clear all metrics
     */
    static clear(): void {
        this.metrics.clear();
        this.globalStart = Date.now();
    }

    /**
     * Estimate remaining time based on progress
     */
    static estimateRemaining(completed: number, total: number, elapsedMs: number): string {
        if (completed === 0) return 'calculating...';

        const avgTimePerItem = elapsedMs / completed;
        const remaining = total - completed;
        const estimatedMs = remaining * avgTimePerItem;

        return UI.duration(estimatedMs);
    }
}

/**
 * Connection pool for SSH connections to improve performance
 */
export class SSHConnectionPool {
    private static connections: Map<string, any> = new Map();

    /**
     * Get or create SSH connection
     */
    static async getConnection(host: string, config: any, createFn: () => Promise<any>): Promise<any> {
        const key = `${host}:${config.port}`;

        if (this.connections.has(key)) {
            const conn = this.connections.get(key);
            // Check if connection is still alive
            if (conn && conn.isConnected && conn.isConnected()) {
                return conn;
            }
            // Remove stale connection
            this.connections.delete(key);
        }

        // Create new connection
        const connection = await createFn();
        this.connections.set(key, connection);

        return connection;
    }

    /**
     * Close all connections
     */
    static async closeAll(): Promise<void> {
        const closePromises = Array.from(this.connections.values())
            .filter(conn => conn && conn !== null && typeof conn.dispose === 'function')
            .map(conn => {
                try {
                    const disposeResult = conn.dispose();
                    return disposeResult && typeof disposeResult.catch === 'function'
                        ? disposeResult.catch(() => {})
                        : Promise.resolve();
                } catch (_e) {
                    return Promise.resolve();
                }
            });

        await Promise.allSettled(closePromises);
        this.connections.clear();
    }

    /**
     * Close specific connection
     */
    static async close(host: string, port: number): Promise<void> {
        const key = `${host}:${port}`;
        const conn = this.connections.get(key);

        if (conn && typeof conn.dispose === 'function') {
            await conn.dispose().catch(() => {});
        }

        this.connections.delete(key);
    }
}

/**
 * Decorator to measure function execution time
 */
export function measure(metricName?: string) {
    return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
        const originalMethod = descriptor.value;
        const name = metricName || `${target.constructor.name}.${propertyKey}`;

        descriptor.value = async function (...args: any[]) {
            PerformanceMonitor.start(name);
            try {
                const result = await originalMethod.apply(this, args);
                return result;
            } finally {
                const duration = PerformanceMonitor.end(name);
                console.log(`  [TIME] ${name}: ${UI.duration(duration)}`);
            }
        };

        return descriptor;
    };
}
