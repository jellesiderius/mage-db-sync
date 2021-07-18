// @ts-ignore
import download from 'download-git-repo'
// @ts-ignore
import {getInstalledPath} from 'get-installed-path'
import {consoleCommand, success} from "../utils/console";
// @ts-ignore
import packageFile from '../../package.json';
import VersionCheck from "../utils/versionCheck";

class SelfUpdateController {
    private versionCheck = new VersionCheck();

    executeStart = async (serviceName: string | undefined): Promise<boolean> => {
        await this.versionCheck.getToolVersions();

        let self = this;
        let config = {
            'npmPath': '',
            'currentVersion': this.versionCheck.config.currentVersion,
            'latestVersion': this.versionCheck.config.latestVersion
        };

        await getInstalledPath('mage-db-sync').then((path: string) => {
            config.npmPath = path;
        });

        if (config.currentVersion < config.latestVersion) {
            await consoleCommand(`cd ${config.npmPath}; rm -rf dist`);

            await download('jellesiderius/mage-db-sync#master', config.npmPath, async function (err: any) {
                await consoleCommand(`cd ${config.npmPath}; npm install`);
                success(`Updated mage-db-sync from ${config.currentVersion} to ${config.latestVersion}`);
            });
        } else {
            success(`mage-db-sync is already up to date`);
        }

        return true;
    }
}

export default SelfUpdateController