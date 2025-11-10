import download from 'download-git-repo';
import {getInstalledPath} from 'get-installed-path';
import {consoleCommand, success} from "../utils/Console";
import VersionCheck from "../utils/VersionCheck";

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
            await consoleCommand(`cd ${config.npmPath}; rm -rf dist`, false);

            download('jellesiderius/mage-db-sync#master', config.npmPath, async function () {
                await consoleCommand(`cd ${config.npmPath}; npm install`, false);
                success(`Updated mage-db-sync from ${config.currentVersion} to ${config.latestVersion}`);
            });
        } else {
            success(`mage-db-sync is already up to date`);
        }

        process.exit();
    }
}

export default SelfUpdateController;
export {SelfUpdateController};  // Named export for V2
