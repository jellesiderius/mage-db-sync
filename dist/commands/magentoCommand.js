"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const tslib_1 = require("tslib");
const magentoController_1 = tslib_1.__importDefault(require("../controllers/magentoController"));
const console_1 = require("../utils/console");
exports.default = (program) => program
    .command('start')
    .description('Starts the database synchronizer')
    .action((service) => {
    (new magentoController_1.default()).executeStart(service).catch(err => console_1.error(err.message));
});
//# sourceMappingURL=magentoCommand.js.map