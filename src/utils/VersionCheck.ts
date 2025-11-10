import packageFile from "../../package.json";
import latestVersion from 'latest-version';

class VersionCheck {
    public config = {
        'latestVersion': '',
        'currentVersion': packageFile.version
    }

    // Get latest version from npm registry
    getToolVersions = async (): Promise<void> => {
        try {
            this.config.latestVersion = await latestVersion('mage-db-sync');
        } catch (err) {
            // If fetch fails, set latestVersion to currentVersion to prevent errors
            this.config.latestVersion = this.config.currentVersion;
            throw new Error(`Failed to fetch latest version: ${err instanceof Error ? err.message : 'Unknown error'}`);
        }
    }
}

export default VersionCheck;
