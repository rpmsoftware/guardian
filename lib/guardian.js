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
                return test.runTest(config);
            });

        Promised.all(promises).then(
            function(results) {
                var hasErrors = false;
                var report = results.map(function(result) {
                    if (result.test.isError) {
                        hasErrors = true;
                    };
                    return Reporter.render('report_section', {
                        title: result.test.title,
                        description: result.test.content
                    });
                }).join('\n');


                report = Reporter.render('email', {
                    'AppName': process.env['APP_NAME'],
                    'Content': report
                });

                Mailer.sendEmail({
                    to: mailerConfig.to,
                    subject: util.format('%s report: %s', process.env['APP_NAME'], hasErrors ? 'ERRORS': 'OK'),
                    content: report
                }, mailerConfig);
            }
        );        
    }

    this.createFormsForTomorrow = function() {
        var formData = {
            Process: 'Actions',
            Form: {
                Fields: [
                    {
                        'Field': 'The date field',
                        'Value': new Date()
                    }
                ]
            }
        };
        return CGUtils.request('ProcFormAdd', config, formData);
    }
};