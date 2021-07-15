"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const tslib_1 = require("tslib");
// @ts-ignore
const download_git_repo_1 = tslib_1.__importDefault(require("download-git-repo"));
// @ts-ignore
const get_installed_path_1 = require("get-installed-path");
const console_1 = require("../utils/console");
// @ts-ignore
const fetch = tslib_1.__importStar(require("node-fetch"));
// @ts-ignore
const package_json_1 = tslib_1.__importDefault(require("../../package.json"));
class SelfUpdateController {
    constructor() {
        this.executeStart = (serviceName) => tslib_1.__awaiter(this, void 0, void 0, function* () {
            let self = this;
            let config = {
                'npmPath': '',
                'latestVersion': '',
                'currentVersion': package_json_1.default.version
            };
            yield get_installed_path_1.getInstalledPath('mage-db-sync').then((path) => {
                config.npmPath = path;
            });
            // @ts-ignore
            yield fetch('https://raw.githubusercontent.com/jellesiderius/mage-db-sync/master/package.json')
                .then((res) => res.json())
                .then((json) => config.latestVersion = json.version);
            if (config.currentVersion < config.latestVersion) {
                yield download_git_repo_1.default('jellesiderius/mage-db-sync#master', config.npmPath, function (err) {
                    return tslib_1.__awaiter(this, void 0, void 0, function* () {
                        yield self.execShellCommand(`cd ${config.npmPath}; npm install`);
                        console_1.success(`Updated mage-db-sync from ${config.currentVersion} to ${config.latestVersion}`);
                    });
                });
            }
            else {
                console_1.success(`mage-db-sync is already up to date`);
            }
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