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
        } catch (_err) {
            // If fetch fails, set latestVersion to currentVersion to prevent errors
            // This is non-critical, so we don't throw
            this.config.latestVersion = this.config.currentVersion;
        }
    }
}

export default VersionCheck;
