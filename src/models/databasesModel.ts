// @ts-ignore
import stagingDatabases from "../../config/databases/staging.json";
// @ts-ignore
import productionDatabases from "../../config/databases/production.json";
import path from "path";
import fs from "fs";
import os from "os";

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
		'stagingUsername': '',
		'externalElasticsearchPort': '',
		'sshKeyLocation': ''
	};

	public databaseDataSecond = {
		'username': '',
		'password': '',
		'server': '',
		'domainFolder': '',
		'port': 22,
		'stagingUsername': '',
		'localProjectFolder': '',
		'externalProjectFolder': '',
		'wordpress': false,
		'externalPhpPath': '',
		'localProjectUrl': '',
		'commandsFolder': '',
		'externalElasticsearchPort': ''
	};

	// Collect databases | collect single database
	collectDatabaseData = async (databaseKey: string | void, databaseType: string | void, collectStaging: boolean | void, config: any | void) => {
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
				// @ts-ignore
				if (database.externalElasticsearchPort) {
					// @ts-ignore
					databaseDataType.externalElasticsearchPort = database.externalElasticsearchPort;
				}
				// @ts-ignore
				if (database.sshKeyName) {
					// @ts-ignore
					config.customConfig.sshKeyLocation = os.userInfo().homedir + '/.ssh/' + database.sshKeyName;
				}

				// @ts-ignore
				if (database.commandsFolder) {
					// @ts-ignore
					databaseDataType.commandsFolder = database.commandsFolder;

					let projectDatabasesRoot = path.join(__dirname, '../../config/databases');
					let commandsPath = path.join(projectDatabasesRoot, databaseDataType.commandsFolder);

					if (fs.existsSync(commandsPath)) {
						// @ts-ignore
						let filesArray = fs.readdirSync(commandsPath).filter(file => fs.lstatSync(commandsPath+'/'+file).isFile());
						if (filesArray.length > 0) {
							for (const file of filesArray) {
								let filePath = commandsPath + '/' + file;

								if (file == 'database.txt') {
									let data = fs.readFileSync(filePath, 'utf8');
									let dataString = data.toString().split('\n').join('');

									config.settings.databaseCommand = dataString;
								}

								if (file == 'magerun2.txt') {
									let data = fs.readFileSync(filePath, 'utf8');
									let dataString = data.toString().split('\n').join('');

									config.settings.magerun2Command = dataString;
								}
							}
						}
					}
				}

				// @ts-ignore
				if (database.stagingUsername) {
					// @ts-ignore
					databaseDataType.stagingUsername = database.stagingUsername;
					await this.collectDatabaseData(databaseDataType.stagingUsername, 'staging', true, config)
				}
			} else {
				// Collect all database
				this.databasesList.push(`${database.domainFolder} / ${database.username} (${key})`);
			}
		}
	}
}

export default DatabasesModel;
