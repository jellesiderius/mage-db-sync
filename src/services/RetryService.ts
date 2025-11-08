/**
 * RetryService - Retry logic for resilient network operations
 * 
 * Features:
 * - Exponential backoff
 * - Configurable retry policies
 * - Error filtering (only retry on specific errors)
 * - Timeout support
 */

import { LoggerService } from './LoggerService';

export interface RetryOptions {
    maxAttempts?: number;
    initialDelayMs?: number;
    maxDelayMs?: number;
    backoffMultiplier?: number;
    timeout?: number;
    retryableErrors?: string[];
    onRetry?: (error: Error, attempt: number) => void;
}

const DEFAULT_OPTIONS: Required<Omit<RetryOptions, 'onRetry' | 'retryableErrors'>> = {
    maxAttempts: 3,
    initialDelayMs: 1000,
    maxDelayMs: 30000,
    backoffMultiplier: 2,
    timeout: 120000 // 2 minutes
};

export class RetryService {
    private static instance: RetryService;
    private logger: LoggerService;

    private constructor() {
        this.logger = LoggerService.getInstance();
    }

    public static getInstance(): RetryService {
        if (!RetryService.instance) {
            RetryService.instance = new RetryService();
        }
        return RetryService.instance;
    }

    /**
     * Execute function with retry logic
     */
    public async execute<T>(
        fn: () => Promise<T>,
        options: RetryOptions = {}
    ): Promise<T> {
        const opts = { ...DEFAULT_OPTIONS, ...options };
        let lastError: Error;
        let attempt = 0;

        while (attempt < opts.maxAttempts) {
            attempt++;

            try {
                this.logger.debug(`Executing operation (attempt ${attempt}/${opts.maxAttempts})`);
                
                // Execute with timeout if specified
                if (opts.timeout) {
                    return await this.withTimeout(fn(), opts.timeout);
                } else {
                    return await fn();
                }
            } catch (error) {
                lastError = error as Error;
                
                // Check if error is retryable
                if (!this.isRetryable(lastError, options.retryableErrors)) {
                    this.logger.warn(`Non-retryable error encountered: ${lastError.message}`);
                    throw lastError;
                }

                // Don't wait after last attempt
                if (attempt >= opts.maxAttempts) {
                    break;
                }

                // Calculate delay with exponential backoff
                const delay = Math.min(
                    opts.initialDelayMs * Math.pow(opts.backoffMultiplier, attempt - 1),
                    opts.maxDelayMs
                );

                this.logger.warn(
                    `Operation failed (attempt ${attempt}/${opts.maxAttempts}): ${lastError.message}. Retrying in ${delay}ms...`,
                    { operation: 'retry', attempt, delay }
                );

                // Call onRetry callback if provided
                if (options.onRetry) {
                    options.onRetry(lastError, attempt);
                }

                // Wait before retry
                await this.sleep(delay);
            }
        }

        // All attempts failed
        this.logger.error(
            `Operation failed after ${opts.maxAttempts} attempts`,
            lastError!,
            { operation: 'retry', maxAttempts: opts.maxAttempts }
        );

        throw new Error(
            `Operation failed after ${opts.maxAttempts} attempts. Last error: ${lastError!.message}`
        );
    }

    /**
     * Execute with timeout
     */
    private async withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
        return Promise.race([
            promise,
            new Promise<T>((_, reject) =>
                setTimeout(() => reject(new Error(`Operation timed out after ${timeoutMs}ms`)), timeoutMs)
            )
        ]);
    }

    /**
     * Check if error is retryable
     */
    private isRetryable(error: Error, retryableErrors?: string[]): boolean {
        // If no specific errors specified, retry on common network errors
        if (!retryableErrors) {
            const networkErrors = [
                'ECONNREFUSED',
                'ECONNRESET',
                'ETIMEDOUT',
                'ENOTFOUND',
                'EAI_AGAIN',
                'ENETUNREACH',
                'EHOSTUNREACH'
            ];

            return networkErrors.some(code => error.message.includes(code));
        }

        // Check if error message matches any retryable patterns
        return retryableErrors.some(pattern => error.message.includes(pattern));
    }

    /**
     * Sleep for specified milliseconds
     */
    private sleep(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Retry SSH operations specifically
     */
    public async retrySSH<T>(fn: () => Promise<T>): Promise<T> {
        return this.execute(fn, {
            maxAttempts: 3,
            initialDelayMs: 2000,
            retryableErrors: [
                'ECONNREFUSED',
                'ECONNRESET',
                'ETIMEDOUT',
                'All configured authentication methods failed'
            ],
            onRetry: (error, attempt) => {
                console.log(`⚠️  SSH connection failed (attempt ${attempt}/3). Retrying...`);
            }
        });
    }

    /**
     * Retry download operations specifically
     */
    public async retryDownload<T>(fn: () => Promise<T>): Promise<T> {
        return this.execute(fn, {
            maxAttempts: 5,
            initialDelayMs: 1000,
            timeout: 300000, // 5 minutes
            retryableErrors: ['ECONNRESET', 'ETIMEDOUT', 'socket hang up'],
            onRetry: (error, attempt) => {
                console.log(`⚠️  Download interrupted (attempt ${attempt}/5). Resuming...`);
            }
        });
    }
}
