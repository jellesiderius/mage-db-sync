import download from 'download-git-repo';
import {getInstalledPath} from 'get-installed-path';
import {consoleCommand, success, error, info} from "../utils/Console";
import VersionCheck from "../utils/VersionCheck";
import { promisify } from 'util';

const downloadAsync = promisify(download);

class SelfUpdateController {
    private versionCheck = new VersionCheck();

    // V2 compatibility method
    public async execute(): Promise<void> {
        await this.executeStart();
    }

    executeStart = async (): Promise<boolean> => {
        await this.versionCheck.getToolVersions();
        const config = {
            'npmPath': '',
            'currentVersion': this.versionCheck.config.currentVersion,
            'latestVersion': this.versionCheck.config.latestVersion
        };

        await getInstalledPath('mage-db-sync').then((path: string) => {
            config.npmPath = path;
        });

        if (config.currentVersion < config.latestVersion) {
            try {
                info(`Updating from ${config.currentVersion} to ${config.latestVersion}...`);

                // Remove old dist folder
                await consoleCommand(`cd ${config.npmPath}; rm -rf dist`, true);

                // Download the latest version from GitHub
                info('Downloading latest version from GitHub...');
                await downloadAsync('jellesiderius/mage-db-sync#master', config.npmPath);

                // Install dependencies
                info('Installing dependencies...');
                await consoleCommand(`cd ${config.npmPath}; npm install`, true);

                success(`Updated mage-db-sync from ${config.currentVersion} to ${config.latestVersion}`);

                process.exit();
            } catch (err) {
                error(`Update failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
                process.exit();
            }
        } else {
            success(`mage-db-sync is already up to date`);
            process.exit();
        }
    }
}

export default SelfUpdateController;
export {SelfUpdateController};  // Named export for V2
