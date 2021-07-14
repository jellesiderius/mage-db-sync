// @ts-ignore
import download from 'download-git-repo'
import {getInstalledPath} from 'get-installed-path'
// @ts-ignore
import packageJson from '../../package.json'

class SelfUpdateController {
    executeStart = async (serviceName: string | undefined): Promise<boolean> => {
        // Get NPM path to this module
        let npmPath = '';
        let oldVersion = packageJson.version;
        let newVersion = '';

        await getInstalledPath('mage-db-sync').then((path) => {
            npmPath = path;
        });

        await download('jellesiderius/mage-db-sync', npmPath, function (err: any) {
            newVersion = packageJson.version;
        });

        await console.log(`Updated from ${oldVersion} to ${newVersion}`);

        return true;
    }
}

export default SelfUpdateController