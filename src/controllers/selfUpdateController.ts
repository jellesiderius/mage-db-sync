// @ts-ignore
import download from 'download-git-repo'
// @ts-ignore
import {getInstalledPath} from 'get-installed-path'
import {success} from "../utils/console";

class SelfUpdateController {
    executeStart = async (serviceName: string | undefined): Promise<boolean> => {
        let npmPath = '';

        await getInstalledPath('mage-db-sync').then((path: string) => {
            npmPath = path;
        });

        await download('jellesiderius/mage-db-sync#master', npmPath, function (err: any) {
            success(`Updated to newest version of mage-db-sync`);
        });

        return true;
    }
}

export default SelfUpdateController