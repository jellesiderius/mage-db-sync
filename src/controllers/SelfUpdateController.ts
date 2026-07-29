import {getInstalledPath} from 'get-installed-path';
import { success, error, info, warning} from "../utils/Console";
import VersionCheck from "../utils/VersionCheck";
import { execFile } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import semver from 'semver';

const execFileAsync = promisify(execFile);

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

        console.log('');

        info(`Current version: ${config.currentVersion}`);
        info(`Latest version: ${config.latestVersion}`);

        if (semver.lt(config.currentVersion, config.latestVersion)) {
            try {
                info(`\nUpdating mage-db-sync from ${config.currentVersion} to ${config.latestVersion}...`);
                info('This may take a minute...\n');

                // Update via npm
                info('Installing latest version from npm...');
                const npmExecutable = process.platform === 'win32' ? 'npm.cmd' : 'npm';
                await execFileAsync(
                    npmExecutable,
                    ['install', '-g', `mage-db-sync@${config.latestVersion}`],
                    { env: { ...process.env, NODE_ENV: 'production' } }
                );

                info('Verifying the installed package...');
                try {
                    const verifyScript = path.join(
                        config.npmPath,
                        'scripts',
                        'verify-installed.js'
                    );
                    await execFileAsync(
                        process.execPath,
                        [verifyScript, config.npmPath, config.latestVersion],
                        { env: { ...process.env, NODE_ENV: 'production' } }
                    );
                } catch (verificationError) {
                    warning('The updated package failed its integrity check. Rolling back...');

                    try {
                        await execFileAsync(
                            npmExecutable,
                            ['install', '-g', `mage-db-sync@${config.currentVersion}`],
                            { env: { ...process.env, NODE_ENV: 'production' } }
                        );
                    } catch (rollbackError) {
                        throw new Error(
                            `Update verification failed and rollback to ${config.currentVersion} also failed.`,
                            { cause: rollbackError }
                        );
                    }

                    throw new Error(
                        `Update verification failed. Restored mage-db-sync ${config.currentVersion}.`,
                        { cause: verificationError }
                    );
                }

                success(`\n✓ Successfully updated mage-db-sync to ${config.latestVersion}!`);
                info('\n💡 Your configuration files in ~/.mage-db-sync/config remain unchanged.\n');

                process.exit(0);
            } catch (err) {
                error(`\n✗ Update failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
                warning('\nYou can manually update by running: npm install -g mage-db-sync@latest\n');
                process.exit(1);
            }
        } else {
            console.log('');
            success(`\nmage-db-sync is already up to date (v${config.currentVersion})\n`);
            process.exit(0);
        }
    }
}

export default SelfUpdateController;
export {SelfUpdateController};  // Named export for V2
