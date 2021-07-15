// @ts-ignore
import download from 'download-git-repo'
// @ts-ignore
import {getInstalledPath} from 'get-installed-path'
import {success} from "../utils/console";
import {ExecException} from "child_process";
// @ts-ignore
import * as fetch from 'node-fetch'
// @ts-ignore
import packageFile from '../../package.json';

class SelfUpdateController {
    executeStart = async (serviceName: string | undefined): Promise<boolean> => {
        let self = this;
        let config = {
            'npmPath': '',
            'latestVersion': '',
            'currentVersion': packageFile.version
        }

        await getInstalledPath('mage-db-sync').then((path: string) => {
            config.npmPath = path;
        });

        // @ts-ignore
        await fetch('https://raw.githubusercontent.com/jellesiderius/mage-db-sync/master/package.json')
            .then((res: { json: () => any; }) => res.json())
            .then((json: { version: string; }) => config.latestVersion = json.version);

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