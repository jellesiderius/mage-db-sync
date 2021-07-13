"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const tslib_1 = require("tslib");
const staging_json_1 = tslib_1.__importDefault(require("../../config/databases/staging.json"));
const production_json_1 = tslib_1.__importDefault(require("../../config/databases/production.json"));
class DatabasesModel {
    constructor() {
        this.databasesList = [];
        this.databaseData = {};
        // Collect databases | collect single database
        this.collectDatabaseData = (databaseKey, databaseType) => tslib_1.__awaiter(this, void 0, void 0, function* () {
            // @ts-ignore
            var databases = staging_json_1.default.databases;
            if (databaseType == 'production') {
                // @ts-ignore
                databases = production_json_1.default.databases;
            }
            for (let [key, database] of Object.entries(databases)) {
                if (databaseKey == key) {
                    // Collect single database info
                    this.databaseData.username = database.username;
                    // @ts-ignore
                    this.databaseData.password = database.password;
                    this.databaseData.server = database.server;
                    this.databaseData.domainFolder = database.domainFolder;
                    this.databaseData.port = database.port;
                    // @ts-ignore
                    this.databaseData.localProjectFolder = database.localProjectFolder;
                    // @ts-ignore
                    this.databaseData.externalProjectFolder = database.externalProjectFolder;
                    // @ts-ignore
                    this.databaseData.wordpress = database.wordpress;
                    // @ts-ignore
                    this.databaseData.externalPhpPath = database.externalPhpPath;
                }
                else {
                    // Collect all database
                    this.databasesList.push(`${database.domainFolder} / ${database.username} (${key})`);
                }
            }
        });
    }
}
exports.default = DatabasesModel;
//# sourceMappingURL=databasesModel.js.map