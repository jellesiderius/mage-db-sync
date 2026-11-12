const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { test } = require('node:test');
const consoleUtils = require('../dist/utils/Console');
const ImportTask = require('../dist/tasks/ImportTask').default;

function createImport(t, { isDdevActive = false, compressed = false, syncExitCode = 0, importExitCode = 0 } = {}) {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'mage-db-sync-import-'));
    const project = path.join(root, "project 'quotes' $(touch PROJECT_INJECTED)");
    const bin = path.join(root, 'bin');
    const filename = "--dump 'quotes' $(touch INJECTED) `touch BACKTICK_INJECTED`; touch SEMICOLON_INJECTED;.sql" + (compressed ? '.gz' : '');
    const sqlFile = path.join(project, filename);
    const eventsFile = path.join(root, 'events.jsonl');
    fs.mkdirSync(project);
    fs.mkdirSync(bin);
    fs.writeFileSync(sqlFile, 'test database dump');
    fs.writeFileSync(path.join(root, 'exit-codes.json'), JSON.stringify({ syncExitCode, importExitCode }));

    // Real child processes record the arguments received and open the literal dump filename.
    const executable = [
        '#!/usr/bin/env node',
        "const fs = require('node:fs');",
        "const path = require('node:path');",
        "const root = path.join(__dirname, '..');",
        "const codes = JSON.parse(fs.readFileSync(path.join(root, 'exit-codes.json'), 'utf8'));",
        'const args = process.argv.slice(2);',
        "const record = (event) => fs.appendFileSync(path.join(root, 'events.jsonl'), JSON.stringify(event) + '\\n');",
        "if (args[0] === 'mutagen') {",
        "    record({ phase: 'sync-start', args, cwd: process.cwd() });",
        '    setTimeout(() => {',
        "        record({ phase: 'sync-complete' });",
        '        process.exit(codes.syncExitCode);',
        '    }, 30);',
        '} else {',
        "    const contents = fs.readFileSync(args.at(-1), 'utf8');",
        "    record({ phase: 'import', args, cwd: process.cwd(), contents });",
        "    process.stdout.write('\\rImporting... 50%\\r');",
        '    process.exit(codes.importExitCode);',
        '}'
    ].join('\n');
    for (const command of ['magerun2', 'ddev']) {
        fs.writeFileSync(path.join(bin, command), executable, { mode: 0o755 });
    }

    const originalPath = process.env.PATH;
    process.env.PATH = [bin, path.dirname(process.execPath), originalPath].join(path.delimiter);
    t.after(() => {
        if (originalPath === undefined) delete process.env.PATH;
        else process.env.PATH = originalPath;
        fs.rmSync(root, { recursive: true, force: true });
    });

    const authorization = t.mock.method(consoleUtils, 'localhostMagentoRootExec', async () => '');
    const importer = new ImportTask();
    importer.services = { getLogger: () => ({ info() {}, debug() {}, error() {} }) };
    const task = {};
    const config = { settings: { currentFolder: project, isDdevActive, magerun2CommandLocal: isDdevActive ? 'ddev exec magerun2' : 'magerun2' } };

    return {
        project, filename, task, config, authorization,
        run: () => importer.importDatabase(task, config, sqlFile, fs.statSync(sqlFile).size),
        events: () => fs.existsSync(eventsFile)
            ? fs.readFileSync(eventsFile, 'utf8').trim().split('\n').map((line) => JSON.parse(line))
            : []
    };
}

for (const isDdevActive of [false, true]) {
    for (const compressed of [false, true]) {
        test('import literal paths and filenames (' + (isDdevActive ? 'DDEV' : 'local') + ', ' + (compressed ? 'gzip' : 'SQL') + ')', async (t) => {
            const fixture = createImport(t, { isDdevActive, compressed });
            await fixture.run();

            const events = fixture.events();
            assert.deepEqual(events.map((event) => event.phase), isDdevActive
                ? ['sync-start', 'sync-complete', 'import']
                : ['import']);
            const imported = events.at(-1);
            assert.equal(fs.realpathSync(imported.cwd), fs.realpathSync(fixture.project));
            assert.equal(imported.contents, 'test database dump');
            assert.deepEqual(imported.args.slice(-2), ['--', fixture.filename]);
            assert.equal(imported.args.includes('--compression=gzip'), compressed);
            assert.equal(imported.args.includes('--optimize'), !compressed);
            for (const flag of ['--drop', '--force', '--skip-authorization-entry-creation']) {
                assert.ok(imported.args.includes(flag));
            }
            if (isDdevActive) assert.deepEqual(imported.args.slice(0, 5), ['exec', '--raw', '--', 'magerun2', 'db:import']);
            for (const marker of ['INJECTED', 'BACKTICK_INJECTED', 'SEMICOLON_INJECTED', 'PROJECT_INJECTED']) {
                assert.equal(fs.existsSync(path.join(fixture.project, marker)), false);
            }
            assert.match(fixture.task.output, /100%/);
            assert.equal(fixture.authorization.mock.callCount(), 1);
        });
    }
}

test('continue importing when Mutagen sync is unavailable', async (t) => {
    const fixture = createImport(t, { isDdevActive: true, syncExitCode: 1 });
    await fixture.run();
    assert.deepEqual(fixture.events().map((event) => event.phase), ['sync-start', 'sync-complete', 'import']);
});

test('report failed imports before adding authorization entries', async (t) => {
    const fixture = createImport(t, { importExitCode: 7 });
    await assert.rejects(fixture.run(), /magerun2 db:import failed with code 7/);
    assert.equal(fixture.authorization.mock.callCount(), 0);
});

test('report process startup errors', async (t) => {
    const fixture = createImport(t);
    fixture.config.settings.currentFolder = path.join(fixture.project, 'missing');
    await assert.rejects(fixture.run(), { code: 'ENOENT' });
    assert.deepEqual(fixture.events(), []);
    assert.equal(fixture.authorization.mock.callCount(), 0);
});
