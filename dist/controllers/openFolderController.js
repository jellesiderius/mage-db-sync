"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const tslib_1 = require("tslib");
const console_1 = require("../utils/console");
const path_1 = tslib_1.__importDefault(require("path"));
class openFolderController {
    constructor() {
        this.executeStart = (serviceName) => tslib_1.__awaiter(this, void 0, void 0, function* () {
            let mageDbSyncRootFolder = path_1.default.join(__dirname, '../../');
            yield (0, console_1.consoleCommand)(`open ${mageDbSyncRootFolder}`, false);
        });
    }
}
exports.default = openFolderController;
//# sourceMappingURL=openFolderController.js.map