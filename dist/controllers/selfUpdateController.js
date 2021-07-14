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
            yield get_installed_path_1.getInstalledPath('mage-db-sync').then((path) => {
                npmPath = path;
            });
            yield download_git_repo_1.default('jellesiderius/mage-db-sync#master', npmPath, function (err) {
                console_1.success(`Updated to newest version of mage-db-sync`);
            });
            return true;
        });
    }
}
exports.default = SelfUpdateController;
//# sourceMappingURL=selfUpdateController.js.map