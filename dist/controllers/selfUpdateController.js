"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const tslib_1 = require("tslib");
// @ts-ignore
const download_git_repo_1 = tslib_1.__importDefault(require("download-git-repo"));
// @ts-ignore
const get_installed_path_1 = require("get-installed-path");
const console_1 = require("../utils/console");
class SelfUpdateController {
    constructor() {
        this.executeStart = (serviceName) => tslib_1.__awaiter(this, void 0, void 0, function* () {
            let npmPath = '';
            var self = this;
            yield get_installed_path_1.getInstalledPath('mage-db-sync').then((path) => {
                npmPath = path;
            });
            yield download_git_repo_1.default('jellesiderius/mage-db-sync#master', npmPath, function (err) {
                return tslib_1.__awaiter(this, void 0, void 0, function* () {
                    yield self.execShellCommand(`cd ${npmPath}; npm i -g`);
                    console_1.success(`Updated to newest version of mage-db-sync`);
                });
            });
            return true;
        });
        // Execute shell command with a Promise
        this.execShellCommand = (cmd) => {
            const exec = require('child_process').exec;
            return new Promise((resolve, reject) => {
                exec(cmd, (error, stdout, stderr) => {
                    resolve(stdout ? stdout : stderr);
                });
            });
        };
    }
}
exports.default = SelfUpdateController;
//# sourceMappingURL=selfUpdateController.js.map