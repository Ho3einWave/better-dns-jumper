import antfu from '@antfu/eslint-config'

export default antfu({
    formatters: true,
    react: true,
    stylistic: {
        indent: 4,
        tabWidth: 4,
    },
    rules: {
        'no-console': 'off',
        'react-hooks-extra/no-direct-set-state-in-use-effect': 'off',
    },
    yaml: false,
    ignores: [
        'src-tauri/target/**',
    ],
})
