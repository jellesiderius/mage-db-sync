// @ts-ignore
import download from 'download-git-repo'
// @ts-ignore
import {getInstalledPath} from 'get-installed-path'
import {success} from "../utils/console";
import {ExecException} from "child_process";

class SelfUpdateController {
    executeStart = async (serviceName: string | undefined): Promise<boolean> => {
        let npmPath = '';
        var self = this;

        await getInstalledPath('mage-db-sync').then((path: string) => {
            npmPath = path;
        });

        await download('jellesiderius/mage-db-sync#master', npmPath, async function (err: any) {
            await self.execShellCommand(`cd ${npmPath}; npm i -g`);
            success(`Updated to newest version of mage-db-sync`);
        });

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