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

        var checkedPromise = new SLCRC(config)
        
        return checkedPromise.promise;
    }
};