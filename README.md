# Database synchronizer for Magento
This tool downloads clean/stripped Magento databases over SSH, imports and configures it for development purposes. Have a fully functional production or staging environment on your local machine within minutes. Making life a little bit easier.

### Requirements
- NodeJS
- PHP
- Magerun2
- WP CLI

### NOTES
- Currently only tested on macOS
- The import function does only show "yes" when your current directory is a Magento installed directory or if a local project folder is set in the database json file
- Everything is developed/tested with Magerun2 version 4.7.0. Make sure at least this version is installed
- Tool requires `magerun2` command to be globally available in shell
- Wordpress import is currently experimental
- Overwrites current localhost's Magento database with the staging/production database. Be aware that you might lose data on your localhost

### Installation
1. `npm i -g` in the root folder of this tool
2. Remove .sample from `config/settings.json.sample` and fill in the config settings within `config/settings.json`
3. Remove .sample from the files in `config/database` and configure`config/databases/production.json` or `config/databases/staging.json`

### Configuring databases
in the files `config/databases/production.json` and `config/databases/staging.json` all the databases are configured. These files must contain the following placeholders:

- `username-1-placeholder` can be replaced with a name by choice, this is used as a key for the tool (Required)
- `username` is the ssh username to log in to the server (Required)
- `password` is the ssh password that goes with the ssh username. (Optional if you use SSH keys to login)
- `server` is the server to log in to (Required)
- `port` the server port (Required)
- `localProjectFolder` is the local Magento root folder (Optional)
- `externalProjectFolder` is the external Magento root folder (Optional)
- `externalPhpPath` is the PHP path on the server, use this if the logged in user has a different PHP version than the server's PHP version (Optional)
- `wordpress` can be set to `true/false` to synchronize wordpress database (Optional) [EXPERIMENTAL]

### Using this tool
Simply run `mage-db-sync start` in any CLI after installing it with `npm i -g` and follow the given options

### Updating this tool
Run the command `mage-db-sync self-update` in any CLI

### TODO
- Rsync for images (Magento and Wordpress)
- Import: Wordpress
    - Make import not only work when subfolder is '/wp/'
    - Before importing check if local wordpress folder +  exists
    - Create same admin user from settings.json
    - Split up Download & Import in 2 functions
- Import: Elasticsearch
    - Amasty / Mirasvit compatibility
- Synchronize between production / staging servers
- Clean up code
