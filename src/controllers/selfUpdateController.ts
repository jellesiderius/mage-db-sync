// @ts-ignore
import download from 'download-git-repo'
import {getInstalledPath} from 'get-installed-path'

class SelfUpdateController {
    executeStart = async (serviceName: string | undefined): Promise<boolean> => {
        // Get NPM path to this module
        let npmPath = '';
        await getInstalledPath('mage-db-sync').then((path) => {
            npmPath = path;
        });

        download('jellesiderius/mage-db-sync', npmPath, function (err: any) {

        })
        return true;
    }
}

export default SelfUpdateController