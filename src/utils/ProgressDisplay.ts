/**
 * ProgressDisplay - Enhanced progress visualization for speed improvements
 *
 * Features:
 * - Multi-bar progress (parallel operations)
 * - Speed indicators with ETA
 * - Live throughput display
 * - Compression ratio tracking
 */

import cliProgress from 'cli-progress';
import chalk from 'chalk';

export interface ProgressConfig {
    total: number;
    label: string;
    unit?: string;
}

export class ProgressDisplay {
    private multibar: cliProgress.MultiBar | null = null;
    private bars: Map<string, cliProgress.SingleBar> = new Map();

    /**
     * Create multibar for parallel progress tracking
     */
    public createMultiBar(): void {
        this.multibar = new cliProgress.MultiBar({
            clearOnComplete: false,
            hideCursor: true,
            format: ' {bar} | {label} | {value}/{total} {unit} | {percentage}% | ETA: {eta_formatted} | Speed: {speed}',
            barCompleteChar: '\u2588',
            barIncompleteChar: '\u2591',
        }, cliProgress.Presets.shades_classic);
    }

    /**
     * Add progress bar for a specific operation
     */
    public addBar(id: string, config: ProgressConfig): void {
        if (!this.multibar) {
            this.createMultiBar();
        }

        const bar = this.multibar!.create(config.total, 0, {
            label: chalk.cyan(config.label.padEnd(30)),
            unit: config.unit || 'items',
            speed: '0/s',
            percentage: '0'
        });

        this.bars.set(id, bar);
    }

    /**
     * Update progress bar
     */
    public update(id: string, value: number, speed?: string): void {
        const bar = this.bars.get(id);
        if (bar) {
            const updates: any = {
                percentage: Math.round((value / bar.getTotal()) * 100)
            };

            if (speed) {
                updates.speed = chalk.green(speed);
            }

            bar.update(value, updates);
        }
    }

    /**
     * Complete a progress bar
     */
    public complete(id: string, message?: string): void {
        const bar = this.bars.get(id);
        if (bar) {
            bar.update(bar.getTotal(), {
                label: chalk.green(`${message || 'Complete'}`.padEnd(30)),
                speed: chalk.green('Done'),
                percentage: '100'
            });
            bar.stop();
        }
    }

    /**
     * Stop all progress bars
     */
    public stop(): void {
        if (this.multibar) {
            this.multibar.stop();
        }
        this.bars.clear();
    }

    /**
     * Format bytes to human readable
     */
    public static formatBytes(bytes: number): string {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    /**
     * Format speed (bytes/sec)
     */
    public static formatSpeed(bytesPerSecond: number): string {
        return `${ProgressDisplay.formatBytes(bytesPerSecond)}/s`;
    }

    /**
     * Format duration
     */
    public static formatDuration(ms: number): string {
        const seconds = Math.floor(ms / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);

        if (hours > 0) {
            return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
        } else if (minutes > 0) {
            return `${minutes}m ${seconds % 60}s`;
        } else {
            return `${seconds}s`;
        }
    }

    /**
     * Display summary box with speed metrics
     */
    public static showSpeedSummary(data: {
        operation: string;
        duration: number;
        originalSize: number;
        compressedSize?: number;
        parallelOps?: number;
        speedBoost?: string;
    }): void {
        const { operation, duration, originalSize, compressedSize, parallelOps, speedBoost } = data;

        console.log('\n┌' + '─'.repeat(70) + '┐');
        console.log('│ ' + chalk.bold.green(`${operation} Complete`) + ' '.repeat(70 - operation.length - 12) + '│');
        console.log('├' + '─'.repeat(70) + '┤');

        console.log('│  Duration:        ' + chalk.cyan(ProgressDisplay.formatDuration(duration)) + ' '.repeat(70 - 31 - ProgressDisplay.formatDuration(duration).length) + '│');
        console.log('│  Original Size:   ' + chalk.cyan(ProgressDisplay.formatBytes(originalSize)) + ' '.repeat(70 - 31 - ProgressDisplay.formatBytes(originalSize).length) + '│');

        if (compressedSize) {
            const ratio = ((1 - compressedSize / originalSize) * 100).toFixed(1);
            console.log('│  Compressed:      ' + chalk.green(ProgressDisplay.formatBytes(compressedSize)) + ` (${ratio}% smaller)` + ' '.repeat(70 - 43 - ProgressDisplay.formatBytes(compressedSize).length - ratio.length) + '│');
        }

        if (parallelOps) {
            console.log('│  Parallel Ops:    ' + chalk.yellow(`${parallelOps} simultaneous`) + ' '.repeat(70 - 35 - String(parallelOps).length) + '│');
        }

        if (speedBoost) {
            console.log('│  Speed Boost:     ' + chalk.bold.green(speedBoost) + ' '.repeat(70 - 31 - speedBoost.length) + '│');
        }

        const avgSpeed = originalSize / (duration / 1000);
        console.log('│  Avg Speed:       ' + chalk.cyan(ProgressDisplay.formatSpeed(avgSpeed)) + ' '.repeat(70 - 31 - ProgressDisplay.formatSpeed(avgSpeed).length) + '│');

        console.log('└' + '─'.repeat(70) + '┘\n');
    }
}
