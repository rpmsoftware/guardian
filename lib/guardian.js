var Util = require('./Util').Util;
var SLCRC = require('./StatusLevelChangeReminderCheck').StatusLevelChangeReminderCheck;

var RESTClient = require('node-rest-client').Client;
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

var Promised = require("promised-io/promise");


exports.Guardian = function init(config) {
    
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
                console.log('all done', results);
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
            if (!check.todayFormsFound) {
                var promise = this.createFormsForTomorrow();
                promise.then(function(formCreated) {
                    var isError = result.isError && formCreated.isError;
                    data = Util.dataForGuardian(
                        'Status level change reminders', isError, {
                            'ActionsCheck': result.reason,
                            'FormsAdded' : formCreated.data
                        }
                    );
                    deferred.resolve(data);
                    console.log('new form created', isError, data);
                });
            } else {
                data = Util.dataForGuardian(
                    'Status level change reminders',
                    result.isError,
                    {
                        'ActionsCheck': result.reason,
                        'FormsAdded'  : false
                    }
                );
                deferred.resolve(data);    
            }
            
        }.bind(this));
        return deferred.promise;
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