import { consoleCommand, info } from "../utils/Console";
import { ConfigPathResolver } from "../utils/ConfigPathResolver";

class OpenConfigController {
    // V2 compatibility method
    public async execute(): Promise<void> {
        await this.executeStart(undefined);
    }

    executeStart = async (_serviceName: string | undefined): Promise<boolean> => {
        const configDir = ConfigPathResolver.getUserConfigDir();
        info(`Opening config folder: ${configDir}`);
        await consoleCommand(`open ${configDir}`, false);
        process.exit();
    }
}

export default OpenConfigController;
export { OpenConfigController };
