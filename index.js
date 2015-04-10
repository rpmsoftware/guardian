var useEnv = process.env['CG_CONFIG'] != undefined;
var configs = useEnv ? JSON.parse(process.env['CG_CONFIG']) : require('./config/config');
var Guardian = require('./lib/guardian').Guardian;
var CronJob = require('cron').CronJob;

process.env['APP_NAME'] = configs.app.name;
if (!useEnv) {
    // Ignore SSL cert errors
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
}
if (process.env['USE_CRON'] === 'YES') {
    console.log('Running as cron job');
    new CronJob({
        cronTime: '30 8 * * *',
        start: true,
        timeZone: 'America/Edmonton',
        onTick: runTests
    });
} else {
    console.log('Running once');
    runTests();
}

function runTests() {
    console.log('Running tests!');
    for (var i = configs.subscribers.length - 1; i >= 0; i--) {
        var config = configs.subscribers[i];
        var guardian = new Guardian(config, configs.mailer);
        guardian.runAllTests();
    }
}