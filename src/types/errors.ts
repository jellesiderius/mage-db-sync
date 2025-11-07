/**
 * Custom error classes for mage-db-sync v2
 */

export class MageDbSyncError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'MageDbSyncError';
    }
}

export class ConfigurationError extends MageDbSyncError {
    constructor(message: string) {
        super(message);
        this.name = 'ConfigurationError';
    }
}

export class SSHError extends MageDbSyncError {
    constructor(message: string) {
        super(message);
        this.name = 'SSHError';
    }
}

export class DatabaseError extends MageDbSyncError {
    constructor(message: string) {
        super(message);
        this.name = 'DatabaseError';
    }
}

export class ValidationError extends MageDbSyncError {
    constructor(message: string) {
        super(message);
        this.name = 'ValidationError';
    }
}

export class FileSystemError extends MageDbSyncError {
    constructor(message: string) {
        super(message);
        this.name = 'FileSystemError';
    }
}
