"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const tslib_1 = require("tslib");
const startController_1 = tslib_1.__importDefault(require("../controllers/startController"));
const console_1 = require("../utils/console");
exports.default = (program) => program
    .command('start')
    .description('Starts the database synchronizer')
    .action((service) => {
    (new startController_1.default()).executeStart(service).catch(err => console_1.error(err.message));
});
//# sourceMappingURL=startCommand.js.map