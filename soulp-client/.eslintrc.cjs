module.exports = {
  extends: [
    'eslint:recommended',
    'plugin:react/recommended',
    'plugin:react/jsx-runtime' // 新增JSX运行时规则
  ],
  settings: {
    react: {
      version: '18.0' // 明确指定React版本
    }
  }
};