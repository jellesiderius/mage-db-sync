import {success, error, info} from "../utils/Console";
import VersionCheck from "../utils/VersionCheck";
import { exec } from 'child_process';
import { promisify } from 'util';
import * as semver from 'semver';
import inquirer from 'inquirer';

const execAsync = promisify(exec);

class SelfUpdateController {
    private versionCheck = new VersionCheck();

    // V2 compatibility method
    public async execute(): Promise<void> {
        await this.executeStart(undefined);
    }

    executeStart = async (_serviceName: string | undefined): Promise<boolean> => {
        try {
            // Fetch latest version from npm registry
            await this.versionCheck.getToolVersions();
        } catch (err) {
            error(`Failed to check for updates: ${err instanceof Error ? err.message : 'Unknown error'}`);
            return false;
        }

        const currentVersion = this.versionCheck.config.currentVersion;
        const latestVersion = this.versionCheck.config.latestVersion;

        // Validate versions
        if (!semver.valid(currentVersion) || !semver.valid(latestVersion)) {
            error('Invalid version format detected');
            return false;
        }

        // Compare versions using semver
        if (semver.gt(latestVersion, currentVersion)) {
            info(`Current version: ${currentVersion}`);
            info(`Latest version: ${latestVersion}`);

            // Ask for confirmation before updating
            const answers = await inquirer.prompt([
                {
                    type: 'confirm',
                    name: 'confirmUpdate',
                    message: `Do you want to update from ${currentVersion} to ${latestVersion}?`,
                    default: true
                }
            ]);

            if (!answers.confirmUpdate) {
                info('Update cancelled');
                process.exit();
            }

            try {
                info('Updating mage-db-sync...');
                // Use npm install for explicit update
                await execAsync('npm install -g mage-db-sync@latest');
                success(`Successfully updated mage-db-sync from ${currentVersion} to ${latestVersion}`);
                info('Please restart the tool to use the new version');
            } catch (err) {
                error(`Failed to update: ${err instanceof Error ? err.message : 'Unknown error'}`);
                error(`Please try running manually: npm install -g mage-db-sync@latest`);
            }
        } else {
            success(`mage-db-sync is already up to date (${currentVersion})`);
        }

        process.exit();
    }
}

export default SelfUpdateController;
export { SelfUpdateController };  // Named export for V2
