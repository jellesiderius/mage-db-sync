// @ts-ignore
import {getInstalledPath} from 'get-installed-path'
import {consoleCommand, success} from "../utils/console";
import path from "path";

class openFolderController {
    executeStart = async (serviceName: string | undefined): Promise<boolean> => {
        let mageDbSyncRootFolder = path.join(__dirname, '../../')
        await consoleCommand(`open ${mageDbSyncRootFolder}`, false);
    }
}

export default openFolderController
