module.exports = {
  root: true,
  parserOptions: {
    ecmaVersion: 8,
    sourceType: 'module',
    ecmaFeatures: {
      jsx: true
    }
  },
  env: {
    mocha: true,
    es6: true,
    node: true
  },
  extends: 'standard',
  rules: {
    "comma-dangle": ["error", {
      "arrays": "only-multiline",
      "objects": "only-multiline",
    }],
    "no-trailing-spaces": ["error", {
      "skipBlankLines": true
    }],
    'eqeqeq': 0,
    'camelcase': 0,
    'no-unused-vars': 2,
    'semi': 2,
    'space-before-function-paren': 'off',
    'generator-star-spacing': 'off',
    'no-var': 'error',
    'prefer-const': 'error',
    'no-useless-escape': 'off',
    'no-debugger': process.env.NODE_ENV === 'production' ? 'error' : 'off'
  }
}
