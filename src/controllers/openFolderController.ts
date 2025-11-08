// @ts-ignore
import {getInstalledPath} from 'get-installed-path'
import {consoleCommand, success} from "../utils/Console";
import path from "path";

class OpenFolderController {
    // V2 compatibility method
    public async execute(): Promise<void> {
        await this.executeStart(undefined);
    }

    executeStart = async (serviceName: string | undefined): Promise<boolean> => {
        let mageDbSyncRootFolder = path.join(__dirname, '../../')
        await consoleCommand(`open ${mageDbSyncRootFolder}`, false);
        return true;
    }
}

export default OpenFolderController;
export { OpenFolderController };
