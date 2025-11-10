import {consoleCommand} from "../utils/Console";
import path from "path";

class OpenFolderController {
    // V2 compatibility method
    public async execute(): Promise<void> {
        await this.executeStart(undefined);
    }

    executeStart = async (_serviceName: string | undefined): Promise<boolean> => {
        const mageDbSyncRootFolder = path.join(__dirname, '../../')
        await consoleCommand(`open ${mageDbSyncRootFolder}`, false);
        process.exit();
    }
}

export default OpenFolderController;
export {OpenFolderController};
