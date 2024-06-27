"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = default_1;
const tslib_1 = require("tslib");
const fs_1 = tslib_1.__importDefault(require("fs"));
const path_1 = tslib_1.__importDefault(require("path"));
// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
function default_1(program) {
    const commands = [];
    const loadPath = path_1.default.dirname(__filename);
    // Loop through command files
    fs_1.default.readdirSync(loadPath).filter(function (filename) {
        return (/\.js$/.test(filename) && filename !== 'index.js');
    }).forEach(function (filename) {
        // const name: string = filename.substr(0, filename.lastIndexOf('.'))
        // Require command
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const command = require(path_1.default.join(loadPath, filename));
        // Initialize command
        commands.push(command.default(program));
    });
    return commands;
}
//# sourceMappingURL=index.js.map