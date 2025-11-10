import {getInstalledPath} from 'get-installed-path';
import {consoleCommand, success, error} from "../utils/Console";
import VersionCheck from "../utils/VersionCheck";
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

class SelfUpdateController {
    private versionCheck = new VersionCheck();

    // V2 compatibility method
    public async execute(): Promise<void> {
        await this.executeStart(undefined);
    }

    executeStart = async (_serviceName: string | undefined): Promise<boolean> => {
        await this.versionCheck.getToolVersions();

        let config = {
            'npmPath': '',
            'currentVersion': this.versionCheck.config.currentVersion,
            'latestVersion': this.versionCheck.config.latestVersion
        };

        await getInstalledPath('mage-db-sync').then((path: string) => {
            config.npmPath = path;
        });

        if (config.currentVersion < config.latestVersion) {
            try {
                // Use npm update which is secure and reliable
                await execAsync('npm update -g mage-db-sync');
                success(`Updated mage-db-sync from ${config.currentVersion} to ${config.latestVersion}`);
                return true;
            } catch (err) {
                error(`Failed to update: ${err instanceof Error ? err.message : 'Unknown error'}`);
                error(`Please run manually: npm update -g mage-db-sync`);
                return false;
            }
        } else {
            success(`mage-db-sync is already up to date`);
            return false;
        }
    }
}

export default SelfUpdateController;
export { SelfUpdateController };  // Named export for V2
