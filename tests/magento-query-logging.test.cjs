const assert = require('node:assert/strict');
const { test } = require('node:test');
const consoleUtils = require('../dist/utils/Console');
const MagentoConfigureTask = require('../dist/tasks/MagentoConfigureTask').default;

for (const isDdevActive of [false, true]) {
    test(`disable query logging before applying development configuration (${isDdevActive ? 'DDEV' : 'local'})`, async (t) => {
        const config = {
            settings: {
                currentFolder: '/tmp/mage-db-sync-test-project',
                magerun2CommandLocal: isDdevActive ? 'ddev exec magerun2' : '/custom/php /custom/magerun2.phar',
                isDdevActive
            },
            finalMessages: {}
        };
        let queryLoggingEnabled = true;
        let databaseConfigured = false;

        t.mock.method(consoleUtils, 'sshMagentoRootFolderMagerunCommand', () => '');

        t.mock.method(consoleUtils, 'localhostMagentoRootExec', async (command, commandConfig, skipErrors = false) => {
            assert.equal(commandConfig, config);
            if (command.endsWith(' dev:query-log:disable')) {
                assert.equal(skipErrors, false);
                assert.equal(command, isDdevActive
                    ? 'ddev exec bin/magento dev:query-log:disable'
                    : '/custom/php /custom/magerun2.phar dev:query-log:disable');
                queryLoggingEnabled = false;
                return 'DB query logging disabled.';
            }

            if (command.includes('SELECT value FROM core_config_data')) {
                return 'value\nopensearch\n';
            }

            if (command === 'rm -rf generated/code') return '';

            if (command.includes('DELETE FROM core_config_data')) {
                assert.equal(queryLoggingEnabled, false, 'configuration queries must not grow db.log');
                databaseConfigured = true;
                return '';
            }

            assert.fail(`Unexpected command before development configuration: ${command}`);
        });

        let tasks;
        const list = { add: (group) => group.task({}, { newListr: (items) => { tasks = items; } }) };
        await new MagentoConfigureTask().configure(list, config);

        // Run the actual task sequence until development configuration is applied.
        for (const task of tasks) {
            await task.task({}, {});
            if (databaseConfigured) break;
        }

        assert.equal(queryLoggingEnabled, false);
        assert.equal(databaseConfigured, true);
        assert.equal(config.settings.searchEngine, 'opensearch');
    });
}
