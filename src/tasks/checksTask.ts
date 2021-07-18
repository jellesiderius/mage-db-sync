import MainTasks from './mainTasks'
import * as fs from 'fs'

class ChecksTask {
    public tasks = [];
    public config = {};

    public magerun2VersionCheck =  {
        title: 'Checking Magerun2 version',
        task: async (ctx, task): Promise<boolean> => {
            if ('5.5' < this.config.requirements.magerun2Version) {
                throw new Error(`Your current Magerun2 version is too low. Magerun version ${this.magerun2Version} is required`);
            }

            return true;
        }
    };

    public downloadFolderCheck = {
        title: 'Checking if download folder exists',
        task: async (): Promise<Boolean> => {
            // Check if download folder exists
            if (fs.existsSync(this.config.customConfig.localDatabaseFolderLocation)) {
                return true;
            }

            throw new Error(`Download folder ${this.config.customConfig.localDatabaseFolderLocation} does not exist. This can be configured in config/settings.json`);
        }
    };

    configure = async (list: any, config: any) => {
        this.config = config;
        
        if (config.settings.import) {
            list.add(this.magerun2VersionCheck);
        }
        
        list.add(this.downloadFolderCheck);
        
        return list;
    }
}

export default ChecksTask