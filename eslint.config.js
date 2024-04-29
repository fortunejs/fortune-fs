const js = require('@eslint/js')
const stylisticJS = require('@stylistic/eslint-plugin-js')

module.exports = [
  js.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: 'latest',
      globals: {
        __dirname: true,
        console: true,
        module: true,
        process: true,
        require: true,
        setTimeout: true,
      },
    },
    plugins: { '@stylistic/js': stylisticJS },
    rules: {
      "no-trailing-spaces": "error",
      semi: ["error", "never"],
      '@stylistic/js/indent': ['error', 2],
    }
  }
]
