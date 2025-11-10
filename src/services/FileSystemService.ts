/**
 * FileSystemService - File system operations
 */

import fs from 'fs';
import path from 'path';
import { FileSystemError } from '../types/errors';

export class FileSystemService {
    private static instance: FileSystemService;

    private constructor() {}

    public static getInstance(): FileSystemService {
        if (!FileSystemService.instance) {
            FileSystemService.instance = new FileSystemService();
        }
        return FileSystemService.instance;
    }
    /**
     * Check if directory exists
     */
    public directoryExists(dirPath: string): boolean {
        try {
            return fs.existsSync(dirPath) && fs.statSync(dirPath).isDirectory();
        } catch {
            return false;
        }
    }

    /**
     * Check if file exists
     */
    public fileExists(filePath: string): boolean {
        try {
            return fs.existsSync(filePath) && fs.statSync(filePath).isFile();
        } catch {
            return false;
        }
    }

    /**
     * Create directory if it doesn't exist
     */
    public ensureDirectory(dirPath: string): void {
        try {
            if (!this.directoryExists(dirPath)) {
                fs.mkdirSync(dirPath, { recursive: true });
            }
        } catch (error) {
            throw new FileSystemError(`Failed to create directory: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    /**
     * Delete file
     */
    public deleteFile(filePath: string): void {
        try {
            if (this.fileExists(filePath)) {
                fs.unlinkSync(filePath);
            }
        } catch (error) {
            throw new FileSystemError(`Failed to delete file: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    /**
     * Delete directory recursively
     */
    public deleteDirectory(dirPath: string): void {
        try {
            if (this.directoryExists(dirPath)) {
                fs.rmSync(dirPath, { recursive: true, force: true });
            }
        } catch (error) {
            throw new FileSystemError(`Failed to delete directory: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    /**
     * Read file contents
     */
    public readFile(filePath: string): string {
        try {
            if (!this.fileExists(filePath)) {
                throw new FileSystemError(`File not found: ${filePath}`);
            }
            return fs.readFileSync(filePath, 'utf-8');
        } catch (error) {
            if (error instanceof FileSystemError) {
                throw error;
            }
            throw new FileSystemError(`Failed to read file: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    /**
     * Write file contents
     */
    public writeFile(filePath: string, content: string): void {
        try {
            const dir = path.dirname(filePath);
            this.ensureDirectory(dir);
            fs.writeFileSync(filePath, content, 'utf-8');
        } catch (error) {
            throw new FileSystemError(`Failed to write file: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    /**
     * Clean up old files
     */
    public cleanupOldFiles(filePaths: string[]): void {
        for (const filePath of filePaths) {
            try {
                if (this.fileExists(filePath)) {
                    this.deleteFile(filePath);
                }
            } catch (_error) {
                // Continue even if deletion fails
                console.warn(`Warning: Could not delete ${filePath}`);
            }
        }
    }
}
