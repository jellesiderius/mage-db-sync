/**
 * VersionCheckService - Version management
 */

import fetch from 'node-fetch';

export class VersionCheckService {
    private static instance: VersionCheckService;
    public latestVersion: string = '';
    private currentVersion: string = '';

    private constructor() {}

    public static getInstance(): VersionCheckService {
        if (!VersionCheckService.instance) {
            VersionCheckService.instance = new VersionCheckService();
        }
        return VersionCheckService.instance;
    }

    public setCurrentVersion(version: string): void {
        this.currentVersion = version;
    }

    /**
     * Fetch latest version from GitHub
     */
    public async fetchLatestVersion(): Promise<void> {
        try {
            const response = await fetch('https://api.github.com/repos/jellesiderius/mage-db-sync/releases/latest');
            const data: any = await response.json();
            this.latestVersion = data.tag_name || this.currentVersion;
        } catch (_error) {
            // If fetch fails, use current version
            this.latestVersion = this.currentVersion;
        }
    }

    /**
     * Check if update is available
     */
    public async isUpdateAvailable(): Promise<boolean> {
        if (!this.latestVersion) {
            await this.fetchLatestVersion();
        }
        return this.compareVersions(this.currentVersion, this.latestVersion) < 0;
    }

    /**
     * Get current version
     */
    public getCurrentVersion(): string {
        return this.currentVersion;
    }

    /**
     * Compare two version strings
     */
    private compareVersions(v1: string, v2: string): number {
        const v1parts = v1.replace(/^v/, '').split('.').map(Number);
        const v2parts = v2.replace(/^v/, '').split('.').map(Number);

        for (let i = 0; i < Math.max(v1parts.length, v2parts.length); i++) {
            const part1 = v1parts[i] || 0;
            const part2 = v2parts[i] || 0;

            if (part1 < part2) return -1;
            if (part1 > part2) return 1;
        }

        return 0;
    }
}
