# Database synchronizer for Magento
This tool downloads clean/stripped Magento databases over SSH, imports and configures it for development purposes. Have a fully functional production or staging environment on your local machine within minutes. Making life a little bit easier.

Go here for the [mage-db-sync documentation](https://github.com/jellesiderius/mage-db-sync/wiki).

### NOTES
- Currently only tested on macOS
- The import function does only show "yes" when your current directory is a Magento installed directory or if a local project folder is set in the database json file
- Everything is developed/tested with Magerun2 version 4.7.0. Make sure at least this version is installed
- Tool requires `magerun2` command to be globally available in shell
- Wordpress import is currently experimental
- Overwrites current localhost's Magento database with the staging/production database. Be aware that you might lose data on your localhost
