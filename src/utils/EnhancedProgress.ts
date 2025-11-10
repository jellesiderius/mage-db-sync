/**
 * EnhancedProgress - Rich progress feedback for all operations
 * 
 * Features:
 * - Detailed percentage tracking
 * - Step indicators (Step X/Y)
 * - Live status updates
 * - Speed and ETA calculations
 * - Beautiful formatting
 */

import chalk from 'chalk';
import { ProgressDisplay } from './ProgressDisplay';

export interface ProgressOptions {
    currentStep?: number;
    totalSteps?: number;
    showSpeed?: boolean;
    showETA?: boolean;
    showBytes?: boolean;
}

export class EnhancedProgress {
    private static startTime: number = 0;
    private static lastBytes: number = 0;
    private static lastUpdate: number = 0;

    /**
     * Format progress with percentage and optional extras
     */
    public static format(
        current: number,
        total: number,
        options: ProgressOptions = {}
    ): string {
        const percentage = Math.round((current / total) * 100);
        const progressBar = this.createProgressBar(percentage);
        
        let output = `${progressBar} ${chalk.cyan(percentage + '%')}`;

        // Add step indicator if provided
        if (options.currentStep && options.totalSteps) {
            output = `${chalk.gray(`[Step ${options.currentStep}/${options.totalSteps}]`)} ${output}`;
        }

        return output;
    }

    /**
     * Create visual progress bar
     */
    public static createProgressBar(percentage: number, width: number = 20): string {
        const filled = Math.round((percentage / 100) * width);
        const empty = width - filled;
        
        const filledBar = chalk.green('█'.repeat(filled));
        const emptyBar = chalk.gray('░'.repeat(empty));
        
        return `${filledBar}${emptyBar}`;
    }

    /**
     * Track download progress with speed and ETA
     */
    public static trackDownload(
        bytesReceived: number,
        totalBytes: number,
        options: { step?: number; totalSteps?: number } = {}
    ): string {
        const now = Date.now();
        
        if (this.startTime === 0) {
            this.startTime = now;
            this.lastBytes = 0;
            this.lastUpdate = now;
        }

        // Calculate speed (only update every 500ms for stability)
        let speedText = '';
        if (now - this.lastUpdate >= 500) {
            const timeDiff = (now - this.lastUpdate) / 1000; // seconds
            const bytesDiff = bytesReceived - this.lastBytes;
            const speed = bytesDiff / timeDiff;
            
            speedText = ` ${chalk.green('[DOWN]')} ${chalk.cyan(ProgressDisplay.formatSpeed(speed))}`;
            
            this.lastBytes = bytesReceived;
            this.lastUpdate = now;
        }

        // Calculate ETA
        const totalTime = (now - this.startTime) / 1000;
        const remainingBytes = totalBytes - bytesReceived;
        const avgSpeed = bytesReceived / totalTime;
        const etaSeconds = avgSpeed > 0 ? Math.round(remainingBytes / avgSpeed) : 0;
        const etaText = etaSeconds > 0 ? ` ${chalk.gray('ETA:')} ${chalk.yellow(this.formatETA(etaSeconds))}` : '';

        // Format sizes
        const receivedText = ProgressDisplay.formatBytes(bytesReceived);
        const totalText = ProgressDisplay.formatBytes(totalBytes);
        
        // Build output
        const percentage = Math.round((bytesReceived / totalBytes) * 100);
        const progressBar = this.createProgressBar(percentage, 25);

        let output = `${progressBar} ${chalk.cyan(percentage + '%')} ${chalk.gray(`(${receivedText}/${totalText})`)}${speedText}${etaText}`;

        if (options.step && options.totalSteps) {
            output = `${chalk.gray(`[${options.step}/${options.totalSteps}]`)} ${output}`;
        }

        return output;
    }

    /**
     * Reset download tracking (call before new download)
     */
    public static resetDownload(): void {
        this.startTime = 0;
        this.lastBytes = 0;
        this.lastUpdate = 0;
    }

    /**
     * Format ETA in human readable form
     */
    private static formatETA(seconds: number): string {
        if (seconds < 60) {
            return `${seconds}s`;
        }
        
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = seconds % 60;
        
        if (minutes < 60) {
            return remainingSeconds > 0 ? `${minutes}m ${remainingSeconds}s` : `${minutes}m`;
        }
        
        const hours = Math.floor(minutes / 60);
        const remainingMinutes = minutes % 60;
        return `${hours}h ${remainingMinutes}m`;
    }

    /**
     * Create spinner for long operations
     */
    public static spinner(frame: number, text: string): string {
        const frames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
        const spinner = chalk.cyan(frames[frame % frames.length]);
        return `${spinner} ${text}`;
    }

    /**
     * Format operation status
     */
    public static status(
        status: 'pending' | 'running' | 'success' | 'error',
        text: string
    ): string {
        const icons = {
            pending: chalk.gray('○'),
            running: chalk.yellow('⟳'),
            success: chalk.green('✓'),
            error: chalk.red('[ERROR]')
        };

        return `${icons[status]} ${text}`;
    }

    /**
     * Show step progress
     */
    public static step(current: number, total: number, description: string): string {
        const percentage = Math.round((current / total) * 100);
        return `${chalk.cyan(`[${current}/${total}]`)} ${chalk.gray(`(${percentage}%)`)} ${description}`;
    }

    /**
     * Create info box for current operation
     */
    public static operationBox(data: {
        operation: string;
        status: string;
        details?: string[];
        progress?: number;
    }): void {
        const width = 60;
        
        console.log('\n┌' + '─'.repeat(width) + '┐');
        console.log('│ ' + chalk.bold.cyan(data.operation.padEnd(width - 2)) + ' │');
        
        if (data.progress !== undefined) {
            const bar = this.createProgressBar(data.progress, width - 10);
            console.log('│ ' + bar + ' ' + chalk.cyan(data.progress + '%').padStart(6) + ' │');
        }
        
        console.log('│ ' + chalk.gray(data.status.padEnd(width - 2)) + ' │');
        
        if (data.details && data.details.length > 0) {
            console.log('├' + '─'.repeat(width) + '┤');
            data.details.forEach(detail => {
                console.log('│ ' + detail.padEnd(width - 2) + ' │');
            });
        }
        
        console.log('└' + '─'.repeat(width) + '┘\n');
    }

    /**
     * Show live activity feed
     */
    public static activity(message: string, icon: string = '•'): void {
        const timestamp = new Date().toLocaleTimeString('en-US', { 
            hour12: false,
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });
        
        console.log(`${chalk.gray(timestamp)} ${chalk.cyan(icon)} ${message}`);
    }

    /**
     * Show comparison (before/after)
     */
    public static comparison(label: string, before: string, after: string): string {
        return `${chalk.gray(label + ':')} ${chalk.yellow(before)} ${chalk.gray('→')} ${chalk.green(after)}`;
    }
}
