"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const tslib_1 = require("tslib");
const console_1 = require("../utils/console");
const testController_1 = tslib_1.__importDefault(require("../controllers/testController"));
exports.default = (program) => program
    .command('test')
    .description('Run tests')
    .action((service) => {
    (new testController_1.default()).executeStart(service).catch((err) => console_1.error(err.message));
});
//# sourceMappingURL=testCommand.js.map