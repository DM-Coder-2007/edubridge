
const { startServer, server } = require('./src/server');

if (require.main === module) {
  startServer();
}

module.exports = {
  startServer,
  server
};
