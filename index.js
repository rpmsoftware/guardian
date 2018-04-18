var useEnv = process.env['CG_CONFIG'] != undefined;
var configs = useEnv ? JSON.parse(process.env['CG_CONFIG']) : require('./config/config');
var CoastGuard = require('./lib/coast-guard').CoastGuard;
var CronJob = require('cron').CronJob;

process.env['APP_NAME'] = configs.app.name;
if (!useEnv) {
    // Ignore SSL cert errors
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
}
if (process.env['USE_CRON'] === 'YES') {
    console.log('Running as cron job');
    new CronJob({
        cronTime: '0 8 * * *',
        start: true,
        timeZone: 'America/Edmonton',
        onTick: runTests
    });
} else {
    console.log('Running once');
    runTests();
}

function runTests(i) {
    if (i === undefined) {
        i = 0;
    }
    if (i == configs.subscribers.length) {
        return;
    }
    runTest(i).then(function() {
        runTests(i+1);
    });
}

function runTest(i) {
    var config = configs.subscribers[i];
    var cg = new CoastGuard(config, configs.mailer, {notification_email: configs.notification_email});
    return cg.runAllTests();
}