import { fileURLToPath } from 'node:url';
import tseslint from 'typescript-eslint';

export default [
    { ignores: ['**/node_modules/**', 'build/**', 'output/**', 'native/dist/**', 'native/.expo/**'] },
    {
        files: ['src/**/*.{ts,tsx}', 'native/**/*.{ts,tsx}'],
        languageOptions: {
            parser: tseslint.parser,
            parserOptions: { project: ['./tsconfig.json', './native/tsconfig.json'], tsconfigRootDir: fileURLToPath(new URL('.', import.meta.url)) },
        },
        plugins: { '@typescript-eslint': tseslint.plugin },
        linterOptions: { noInlineConfig: true, reportUnusedDisableDirectives: 'error' },
        rules: {
            '@typescript-eslint/no-explicit-any': 'error',
            '@typescript-eslint/no-unsafe-assignment': 'error',
            '@typescript-eslint/no-unsafe-argument': 'error',
            '@typescript-eslint/no-unsafe-call': 'error',
            '@typescript-eslint/no-unsafe-member-access': 'error',
            '@typescript-eslint/no-unsafe-return': 'error',
            '@typescript-eslint/no-require-imports': 'error',
            '@typescript-eslint/ban-ts-comment': ['error', {
                'ts-ignore': true, 'ts-nocheck': true, 'ts-expect-error': 'allow-with-description', minimumDescriptionLength: 20,
            }],
        },
    },
];
