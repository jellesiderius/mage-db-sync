/**
 * CommandService - Local and remote command execution
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import CommandExists from 'command-exists';
import { CommandResult } from '../types';

const execAsync = promisify(exec);

export class CommandService {
    private static instance: CommandService;

    private constructor() {}

    public static getInstance(): CommandService {
        if (!CommandService.instance) {
            CommandService.instance = new CommandService();
        }
        return CommandService.instance;
    }
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
    public async checkMagerun2(_version: string = '7.4.0'): Promise<boolean> {
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
     * @param targetDir Optional directory to check (defaults to current working directory)
     */
    public async isDdevActive(targetDir?: string): Promise<boolean> {
        try {
            // Use ddev describe with JSON output for reliable parsing
            const options = targetDir ? { cwd: targetDir } : {};
            const result = await this.execLocal('ddev', ['describe', '-j'], options);

            if (result.exitCode !== 0) {
                return false;
            }

            // Parse JSON output to check status
            const data = JSON.parse(result.stdout);

            // Verify the project exists and is running
            if (!data || !data.raw) {
                return false;
            }

            // Check if project is running
            const isRunning = data.raw.status === 'running';

            // Verify the approot matches the target directory (resolve both to absolute paths)
            const path = require('path');
            const checkDir = targetDir ? path.resolve(targetDir) : process.cwd();
            const approot = data.raw.approot ? path.resolve(data.raw.approot) : null;

            // Both must match and project must be running
            return isRunning && approot === checkDir;
        } catch {
            return false;
        }
    }
}
