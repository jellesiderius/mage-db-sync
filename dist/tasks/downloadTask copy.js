"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const tslib_1 = require("tslib");
const mainTasks_1 = tslib_1.__importDefault(require("./mainTasks"));
const fs = tslib_1.__importStar(require("fs"));
class DownloadTasks extends mainTasks_1.default {
    constructor() {
        super(...arguments);
        this.tasks = [];
        this.magerun2VersionCheck = {
            title: 'Checking Magerun2 version',
            task: (ctx, task) => tslib_1.__awaiter(this, void 0, void 0, function* () {
                if ('5.0' < this.config.requirements.magerun2Version) {
                    throw new Error(`Your current Magerun2 version is too low. Magerun version ${this.magerun2Version} is required`);
                }
                return true;
            })
        };
        this.downloadFolderCheck = {
            title: 'Checking if download folder exists',
            task: () => tslib_1.__awaiter(this, void 0, void 0, function* () {
                // Check if download folder exists
                if (fs.existsSync(this.config.customConfig.localDatabaseFolderLocation)) {
                    return true;
                }
                throw new Error(`Download folder ${this.config.customConfig.localDatabaseFolderLocation} does not exist. This can be configured in config/settings.json`);
            })
        };
        this.addMainChecks = (list) => tslib_1.__awaiter(this, void 0, void 0, function* () {
            list.add(this.magerun2VersionCheck);
            list.add(this.downloadFolderCheck);
            return list;
        });
    }
}
exports.default = DownloadTasks;
//# sourceMappingURL=downloadTask%20copy.js.map