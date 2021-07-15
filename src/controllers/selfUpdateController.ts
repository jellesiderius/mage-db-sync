// @ts-ignore
import download from 'download-git-repo'
// @ts-ignore
import {getInstalledPath} from 'get-installed-path'
import {success} from "../utils/console";
import {ExecException} from "child_process";
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
            await download('jellesiderius/mage-db-sync#master', config.npmPath, async function (err: any) {
                await self.execShellCommand(`cd ${config.npmPath}; npm install`);
                success(`Updated mage-db-sync from ${config.currentVersion} to ${config.latestVersion}`);
            });
        } else {
            success(`mage-db-sync is already up to date`);
        }

        return true;
    }

    // Execute shell command with a Promise
    execShellCommand = (cmd: string) => {
        const exec = require('child_process').exec;
        return new Promise((resolve, reject) => {
            exec(cmd, (error: ExecException | null, stdout: string, stderr: string) => {
                resolve(stdout ? stdout : stderr);
            });
        });
    }
}

export default SelfUpdateController