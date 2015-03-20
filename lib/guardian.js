var Util = require('./Util').Util;
var util = require('util');
var SLCRC = require('./StatusLevelChangeReminderCheck').StatusLevelChangeReminderCheck;

var RESTClient = require('node-rest-client').Client;
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

var Promised = require('promised-io/promise');
var Mailer = require('./mailer').Mailer;

var Reporter = require('./Reporter').Reporter;

exports.Guardian = function init(config, mailerConfig) {
    
    var RequestArgs = {
        'headers': Util.getHeaders(config)
    };

    this.runAllTests = function() {
        var promises = [];

        Object.getOwnPropertyNames(this).forEach(function(property) {
            if (!property.startsWith('test')) {
                return;
            }
            var p = this[property];
            if (typeof(p) !== 'function') {
                return;
            }
            var promise = this[property]();
            promises.push(promise);
        }.bind(this))

        Promised.all(promises).then(
            function(results) {
                var report = results.map(function(result) {
                    return result.report;
                }).join('');
                report = Reporter.render('email', {
                    'AppName': process.env['APP_NAME'],
                    'Content': report
                })
                Mailer.sendEmail({
                    to: [{
                        'name': 'Joaquin',
                        'email': 'joaquin@rpmsoftware.com',
                        'type': 'to'
                    }],
                    subject: util.format('%s daily report', process.env['APP_NAME']),
                    content: report
                }, mailerConfig);
                // console.log('all done', results);

            }
        );
    }

    this.testInfo = function() {
        var args = RequestArgs;
        return Util.request('Info', config, {});
    }

    this.testActionsCreated = function() {
        var deferred = Util.deferred();
        var check = new SLCRC(config);
        var data = null;
        check.deferred.then(function(result) {
            // console.log('result', result);return;
            if (!check.todayFormsFound) {
                var promise = this.createFormsForTomorrow();
                promise.then(function(formCreated) {
                    var isError = result.isError && formCreated.isError;
                    this.resolveTestActionsCreated(deferred, result, isError, formCreated.data);
                });
            } else {
                this.resolveTestActionsCreated(deferred, result, result.isError, false);
            }
            
        }.bind(this));
        return deferred.promise;
    }

    this.resolveTestActionsCreated = function(deferred, result, isError, formsAdded) {
        var report = Reporter.render(
            'report_section',
            {
                title: 'Reminders checked',
                items: result.content
            }
        ); 
        var data = Util.dataForGuardian(
            'Status level change reminders', isError,
            {
                'ActionsCheck': result.reason,
                'FormsAdded'  : formsAdded
            },report
        );
        deferred.resolve(data);
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
        return Util.request('ProcFormAdd', config, formData);
    }
};