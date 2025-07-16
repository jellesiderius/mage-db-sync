"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const tslib_1 = require("tslib");
const openFolderController_1 = (0, tslib_1.__importDefault)(require("../controllers/openFolderController"));
const console_1 = require("../utils/console");
exports.default = (program) => program
    .command('open-folder')
    .description('Opens the Mage-DB sync folder')
    .action((service) => {
    (new openFolderController_1.default()).executeStart(service).catch(err => (0, console_1.error)(err.message));
});
//# sourceMappingURL=openFolderCommand.js.map