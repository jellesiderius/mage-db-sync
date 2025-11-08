import packageFile from "../../package.json";
import fetch from 'node-fetch';

class VersionCheck {
	public config = {
		'latestVersion': '',
		'currentVersion': packageFile.version
	}

	// versions
	getToolVersions = async () => {
		await fetch('https://raw.githubusercontent.com/jellesiderius/mage-db-sync/master/package.json')
			.then((res: { json: () => any; }) => res.json())
			.then((json: { version: string; }) => this.config.latestVersion = json.version);
	}
}

export default VersionCheck;