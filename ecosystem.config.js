module.exports = {
  apps: [{
    name: 'freetube-web',
    script: '_scripts/dev-runner.js',
    args: '--web',
    cwd: 'C:\\Users\\jeffb\\Desktop\\code\\FreeTube',
    env: {
      NODE_ENV: 'development'
    }
  }]
}
