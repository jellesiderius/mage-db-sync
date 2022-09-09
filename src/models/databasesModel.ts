// @ts-ignore
import stagingDatabases from "../../config/databases/staging.json";
// @ts-ignore
import productionDatabases from "../../config/databases/production.json";

class DatabasesModel {
	public databasesList: { [k: string]: any } = [];
	public databaseData = {
		'username': '',
		'password': '',
		'server': '',
		'domainFolder': '',
		'port': 22,
		'localProjectFolder': '',
		'externalProjectFolder': '',
		'wordpress': false,
		'externalPhpPath': '',
		'localProjectUrl': '',
		'commandsFolder': '',
		'stagingUsername': ''
	};

	public databaseDataSecond = {
		'username': '',
		'password': '',
		'server': '',
		'domainFolder': '',
		'port': 22,
		'localProjectFolder': '',
		'externalProjectFolder': '',
		'wordpress': false,
		'externalPhpPath': '',
		'localProjectUrl': '',
		'commandsFolder': '',
		'stagingUsername': ''
	};

	// Collect databases | collect single database
	collectDatabaseData = async (databaseKey: string | void, databaseType: string | void, collectStaging: boolean | void) => {
		// @ts-ignore
		var databases = stagingDatabases.databases;
		// @ts-ignore
		var databaseDataType = this.databaseData;

		if (collectStaging) {
			databaseDataType = this.databaseDataSecond;
		}

		if (databaseType == 'production') {
			// @ts-ignore
			databases = productionDatabases.databases;
		}

		for (let [key, database] of Object.entries(databases)) {
			if (databaseKey == key) {
				// Collect single database info
				databaseDataType.username = database.username;
				// @ts-ignore
				databaseDataType.password = database.password;
				databaseDataType.server = database.server;
				databaseDataType.domainFolder = database.domainFolder;
				// @ts-ignore
				databaseDataType.port = database.port;
				databaseDataType.localProjectFolder = database.localProjectFolder;
				databaseDataType.externalProjectFolder = database.externalProjectFolder;
				// @ts-ignore
				databaseDataType.wordpress = database.wordpress;
				// @ts-ignore
				databaseDataType.externalPhpPath = database.externalPhpPath;
				// @ts-ignore
				databaseDataType.localProjectUrl = database.localProjectUrl;

				if (database.commandsFolder) {
					databaseDataType.commandsFolder = database.commandsFolder;
				}

				if (database.stagingUsername) {
					databaseDataType.stagingUsername = database.stagingUsername;
					await this.collectDatabaseData(databaseDataType.stagingUsername, 'staging', true)
				}
			} else {
				// Collect all database
				this.databasesList.push(`${database.domainFolder} / ${database.username} (${key})`);
			}
		}
	}
}

export default DatabasesModel;
