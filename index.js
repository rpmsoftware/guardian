var configs = require('./config/config');
var Guardian = require('./lib/guardian').Guardian;

process.env['APP_NAME'] = configs.app.name;

for (var i = configs.subscribers.length - 1; i >= 0; i--) {
    var config = configs.subscribers[i];
    var guardian = new Guardian(config, configs.mailer);
    guardian.runAllTests();
};
