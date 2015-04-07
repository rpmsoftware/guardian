var configs = require('./config/config');
var Guardian = require('./lib/guardian').Guardian;
var CronJob = require('cron').CronJob;

process.env['APP_NAME'] = configs.app.name;
new CronJob({
    cronTime: '30 8 * * *',
    start: true,
    timeZone: 'America/Edmonton',
    onTick: function() {
        for (var i = configs.subscribers.length - 1; i >= 0; i--) {
            var config = configs.subscribers[i];
            var guardian = new Guardian(config, configs.mailer);
            guardian.runAllTests();
        };
    }
});
