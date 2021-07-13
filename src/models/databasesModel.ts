import stagingDatabases from "../../config/databases/staging.json";
import productionDatabases from "../../config/databases/production.json";

class DatabasesModel {
	public databasesList: { [k: string]: any } = [];
	public databaseData: { [k: string]: any } = {};

	// Collect databases | collect single database
	collectDatabaseData = async (databaseKey: string | void, databaseType: string | void ) => {
		// @ts-ignore
		var databases = stagingDatabases.databases;

		if (databaseType == 'production') {
			// @ts-ignore
			databases = productionDatabases.databases;
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
				this.databaseData.externalPhpPath = database.externalPhpPath
			} else {
				// Collect all database
				this.databasesList.push(`${database.domainFolder} / ${database.username} (${key})`);
			}
		}
	}
}

export default DatabasesModel;