/**
 * SSHService - SSH connection and operations
 */

import { NodeSSH } from 'node-ssh';
import { SSHConnection } from '../types';
import { SSHError } from '../types/errors';

export class SSHService {
    private ssh: NodeSSH;
    private connected: boolean = false;

    constructor() {
        this.ssh = new NodeSSH();
    }

    /**
     * Connect to SSH server
     */
    public async connect(config: SSHConnection): Promise<void> {
        try {
            await this.ssh.connect({
                host: config.host,
                port: config.port,
                username: config.username,
                password: config.password,
                privateKey: config.privateKey,
                passphrase: config.passphrase
            });
            this.connected = true;
        } catch (error) {
            throw new SSHError(`Failed to connect to SSH: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    /**
     * Execute command on remote server
     */
    public async exec(command: string): Promise<string> {
        if (!this.connected) {
            throw new SSHError('Not connected to SSH server');
        }

        try {
            const result = await this.ssh.execCommand(command);
            if (result.code !== 0) {
                throw new SSHError(`Command failed: ${result.stderr}`);
            }
            return result.stdout;
        } catch (error) {
            if (error instanceof SSHError) {
                throw error;
            }
            throw new SSHError(`Failed to execute command: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    /**
     * Upload file to remote server
     */
    public async uploadFile(localPath: string, remotePath: string): Promise<void> {
        if (!this.connected) {
            throw new SSHError('Not connected to SSH server');
        }

        try {
            await this.ssh.putFile(localPath, remotePath);
        } catch (error) {
            throw new SSHError(`Failed to upload file: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    /**
     * Download file from remote server
     */
    public async downloadFile(remotePath: string, localPath: string): Promise<void> {
        if (!this.connected) {
            throw new SSHError('Not connected to SSH server');
        }

        try {
            await this.ssh.getFile(localPath, remotePath);
        } catch (error) {
            throw new SSHError(`Failed to download file: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    /**
     * Disconnect from SSH server
     */
    public disconnect(): void {
        if (this.connected) {
            this.ssh.dispose();
            this.connected = false;
        }
    }

    /**
     * Check if connected
     */
    public isConnected(): boolean {
        return this.connected;
    }

    /**
     * Get SSH connection instance
     */
    public getConnection(): NodeSSH {
        return this.ssh;
    }
}
