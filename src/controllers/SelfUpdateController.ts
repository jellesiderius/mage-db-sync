import {getInstalledPath} from 'get-installed-path';
import { success, error, info, warning} from "../utils/Console";
import VersionCheck from "../utils/VersionCheck";
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

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

        info(`Current version: ${config.currentVersion}`);
        info(`Latest version: ${config.latestVersion}`);

        if (config.currentVersion < config.latestVersion) {
            try {
                info(`\nUpdating mage-db-sync from ${config.currentVersion} to ${config.latestVersion}...`);
                info('This may take a minute...\n');

                // Update via npm
                info('Installing latest version from npm...');
                await execAsync('npm install -g mage-db-sync@latest', {
                    env: { ...process.env, NODE_ENV: 'production' }
                });

                success(`\n✓ Successfully updated mage-db-sync to ${config.latestVersion}!`);
                info('\n💡 Your configuration files in ~/.mage-db-sync/config remain unchanged.\n');

                process.exit(0);
            } catch (err) {
                error(`\n✗ Update failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
                warning('\nYou can manually update by running: npm install -g mage-db-sync@latest\n');
                process.exit(1);
            }
        } else {
            success(`\n✓ mage-db-sync is already up to date (v${config.currentVersion})\n`);
            process.exit(0);
        }
    }
}

export default SelfUpdateController;
export {SelfUpdateController};  // Named export for V2
