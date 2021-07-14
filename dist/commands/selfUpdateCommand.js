"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const tslib_1 = require("tslib");
const console_1 = require("../utils/console");
const selfUpdateController_1 = tslib_1.__importDefault(require("../controllers/selfUpdateController"));
exports.default = (program) => program
    .command('self-update')
    .description('Updates the database synchronizer to the latest version')
    .action((service) => {
    (new selfUpdateController_1.default()).executeStart(service).catch((err) => console_1.error(err.message));
});
//# sourceMappingURL=selfUpdateCommand.js.map