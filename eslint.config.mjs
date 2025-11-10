import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';

export default [
    eslint.configs.recommended,
    ...tseslint.configs.recommended,
    {
        rules: {
            // Allow unused vars that start with underscore
            '@typescript-eslint/no-unused-vars': [
                'error',
                {
                    'argsIgnorePattern': '^_',
                    'varsIgnorePattern': '^_',
                    'caughtErrorsIgnorePattern': '^_'
                }
            ],
            'no-unused-vars': [
                'error',
                {
                    'argsIgnorePattern': '^_',
                    'varsIgnorePattern': '^_',
                    'caughtErrorsIgnorePattern': '^_'
                }
            ],
            // Allow redeclaring variables (common in SQL query building)
            'no-redeclare': 'off',
            '@typescript-eslint/no-redeclare': 'off',
            // Allow empty catch blocks with comment
            'no-empty': ['error', { 'allowEmptyCatch': true }],
            // Allow unreachable code (for error handling)
            'no-unreachable': 'warn',
            // Allow explicit any
            '@typescript-eslint/no-explicit-any': 'off',
            // Allow require statements (for CommonJS compatibility)
            '@typescript-eslint/no-var-requires': 'off',
            '@typescript-eslint/no-require-imports': 'off'
        },
        languageOptions: {
            parserOptions: {
                project: './tsconfig.json',
                tsconfigRootDir: import.meta.dirname,
            },
        },
    },
    {
        ignores: ['dist/**', 'node_modules/**', '*.js', '*.mjs']
    }
];
