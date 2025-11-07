/**
 * CommandService - Local and remote command execution
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import CommandExists from 'command-exists';
import { CommandResult } from '../types';

const execAsync = promisify(exec);

export class CommandService {
    /**
     * Execute local command
     */
    public async execLocal(
        command: string,
        args: string[] = [],
        options: { shell?: boolean; cwd?: string } = {}
    ): Promise<CommandResult> {
        try {
            const fullCommand = args.length > 0 ? `${command} ${args.join(' ')}` : command;
            const execOptions: any = {
                cwd: options.cwd || process.cwd()
            };
            if (options.shell !== undefined) {
                execOptions.shell = options.shell;
            }
            const result = await execAsync(fullCommand, execOptions);

            return {
                stdout: String(result.stdout || '').trim(),
                stderr: String(result.stderr || '').trim(),
                exitCode: 0
            };
        } catch (error: any) {
            return {
                stdout: error.stdout || '',
                stderr: error.stderr || error.message,
                exitCode: error.code || 1
            };
        }
    }

    /**
     * Check if command exists
     */
    public async commandExists(command: string): Promise<boolean> {
        try {
            await CommandExists(command);
            return true;
        } catch {
            return false;
        }
    }

    /**
     * Check for magerun2 installation
     */
    public async checkMagerun2(version: string = '7.4.0'): Promise<boolean> {
        const exists = await this.commandExists('magerun2');
        return exists;
    }

    /**
     * Check for DDEV
     */
    public async checkDdev(): Promise<boolean> {
        return await this.commandExists('ddev');
    }

    /**
     * Check if DDEV is active in current directory
     */
    public async isDdevActive(): Promise<boolean> {
        try {
            const result = await this.execLocal('ddev', ['status']);
            return result.exitCode === 0 && result.stdout.includes('running');
        } catch {
            return false;
        }
    }
}
