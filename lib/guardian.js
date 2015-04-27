var CGUtils = require('./CGUtils').CGUtils;
var util = require('util');

var RESTClient = require('node-rest-client').Client;
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

var Promised = require('promised-io/promise');
var Mailer = require('./mailer').Mailer;

var Reporter = require('./Reporter').Reporter;

var fs = require('fs');



exports.Guardian = function init(config, mailerConfig) {
    
    var RequestArgs = {
        'headers': CGUtils.getHeaders(config)
    };

    this.runAllTests = function() {
        var path = __dirname + '/tests/';
        var promises = fs.readdirSync(path)
            .filter(function(file) {
                return file.indexOf('.js') > 0;
            }).map(function(file) {
                var TestClass = require(path + file).Test;
                var test = new TestClass();
                console.log('\nTest started: ' + file + '\n' + JSON.stringify(config) + '\n\n');
                var promise = test.runTest(config);
                return promise;
            });

        Promised.all(promises).then(
            function(results) {
                console.log('\nTest done: \n' + JSON.stringify(results) + '\n\n');
                var hasErrors = false;
                var report = results.map(function(result) {
                    if (result.test.isError) {
                        hasErrors = true;
                    }
                    return result.rendered;
                }).join('\n');


                report = Reporter.render('email', {
                    'AppName': process.env['APP_NAME'],
                    'Subscriber': config.name,
                    'URL': config.url.toLowerCase()
                        .replace('https', 'http')
                        .replace('http://', '')
                        .replace('/rpm/', ''),
                    'Message': hasErrors ?
                        'Kids, you tried your best and you failed miserably. The lesson is, never try.' :
                        'Woohoo! The Coast is clear!',
                    'Content': report
                });

                Mailer.sendEmail({
                    to: mailerConfig.to,
                    subject: util.format(
                        '%s report for %s: %s [%s]', 
                        process.env['APP_NAME'],
                        config.name,
                        hasErrors ? 'ERRORS': 'OK',
                        new Date().toDateString()
                    ),
                    content: report
                }, mailerConfig);
            }
        );
    }
};