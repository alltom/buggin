var connect = require('connect');
var app = connect()
  .use(connect.logger('dev'))
  .use(connect.staticTom('public'))
  .listen(3000);
