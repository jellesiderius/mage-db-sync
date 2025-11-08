/**
 * V2 Enhanced UI utilities for beautiful CLI output
 */
import chalk from 'chalk';
import boxen from 'boxen';
import figlet from 'figlet';
import * as gradientString from 'gradient-string';
import ora, { Ora } from 'ora';

export class UI {
    private static spinners: Map<string, Ora> = new Map();

    /**
     * Display beautiful banner
     */
    static showBanner(): void {
        console.clear();
        const banner = figlet.textSync('mage-db-sync', {
            font: 'Standard',
            horizontalLayout: 'default'
        });
        const gradient = gradientString.cristal;
        console.log(gradient.multiline(banner));
        console.log(chalk.gray(' Database synchronizer for Magento & WordPress - V2'));
    }

    /**
     * Create a beautiful box around content
     */
    static box(content: string, options?: { title?: string; type?: 'success' | 'error' | 'warning' | 'info' }): void {
        const boxOptions: any = {
            padding: 1,
            margin: 1,
            borderStyle: 'round'
        };

        if (options?.title) {
            boxOptions.title = options.title;
        }

        switch (options?.type) {
            case 'success':
                boxOptions.borderColor = 'green';
                break;
            case 'error':
                boxOptions.borderColor = 'red';
                break;
            case 'warning':
                boxOptions.borderColor = 'yellow';
                break;
            case 'info':
                boxOptions.borderColor = 'blue';
                break;
        }

        console.log(boxen(content, boxOptions));
    }

    /**
     * Show success message
     */
    static success(message: string): void {
        console.log(chalk.green('✔') + ' ' + chalk.white(message));
    }

    /**
     * Show error message
     */
    static error(message: string): void {
        console.log(chalk.red('✖') + ' ' + chalk.white(message));
    }

    /**
     * Show warning message
     */
    static warning(message: string): void {
        console.log(chalk.yellow('⚠') + ' ' + chalk.white(message));
    }

    /**
     * Show info message
     */
    static info(message: string): void {
        console.log(chalk.blue('ℹ') + ' ' + chalk.white(message));
    }

    /**
     * Create a spinner for long-running operations
     */
    static spinner(text: string, id?: string): Ora {
        const spinner = ora({
            text,
            spinner: 'dots12',
            color: 'cyan'
        }).start();

        if (id) {
            this.spinners.set(id, spinner);
        }

        return spinner;
    }

    /**
     * Update spinner text
     */
    static updateSpinner(id: string, text: string): void {
        const spinner = this.spinners.get(id);
        if (spinner) {
            spinner.text = text;
        }
    }

    /**
     * Stop spinner with success
     */
    static succeedSpinner(id: string, text?: string): void {
        const spinner = this.spinners.get(id);
        if (spinner) {
            spinner.succeed(text);
            this.spinners.delete(id);
        }
    }

    /**
     * Stop spinner with failure
     */
    static failSpinner(id: string, text?: string): void {
        const spinner = this.spinners.get(id);
        if (spinner) {
            spinner.fail(text);
            this.spinners.delete(id);
        }
    }

    /**
     * Display section header
     */
    static section(title: string): void {
        console.log('\n' + chalk.bold.cyan('━'.repeat(50)));
        console.log(chalk.bold.white(`  ${title}`));
        console.log(chalk.bold.cyan('━'.repeat(50)) + '\n');
    }

    /**
     * Display table-like output
     */
    static table(data: Array<{ label: string; value: string }>): void {
        const maxLabelLength = Math.max(...data.map(d => d.label.length));

        data.forEach(({ label, value }) => {
            const padding = ' '.repeat(maxLabelLength - label.length + 2);
            console.log(chalk.gray(label + ':') + padding + chalk.white(value));
        });
    }

    /**
     * Show progress percentage
     */
    static progress(current: number, total: number, label?: string): void {
        const percentage = Math.round((current / total) * 100);
        const filled = Math.round(percentage / 2);
        const empty = 50 - filled;

        const bar = chalk.cyan('█'.repeat(filled)) + chalk.gray('░'.repeat(empty));
        const text = label ? ` ${label}` : '';

        process.stdout.write(`\r${bar} ${percentage}%${text}`);

        if (current === total) {
            process.stdout.write('\n');
        }
    }

    /**
     * Show duration in human-readable format
     */
    static duration(ms: number): string {
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
     * Create a divider
     */
    static divider(): void {
        console.log(chalk.gray('─'.repeat(80)));
    }
}
