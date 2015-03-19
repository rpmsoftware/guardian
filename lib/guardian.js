var RESTClient = require('node-rest-client').Client;
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

var moment = require('moment');

var S = require('string');
S.extendPrototype();

var Promised = require("promised-io/promise");
var Deferred = Promised.Deferred;

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
        return Util.sendRequest({
            args: args,
            url: Util.url(config, 'Info')
        });
    }

    this.testActionsCreated = function() {
        var args = RequestArgs;
        args.data = {
            'Process': 'Actions'
        }
        var formsPromise = Util.sendRequest({
            args: args,
            url: Util.url(config, 'ProcForms')
        });
        formsPromise.then(
            function(response) {
                if (response.isError && response.data.Error.Message === 'No forms') {
                    // Nothing to check
                    return;
                }
                var creationDateColumn = response.data.Columns.indexOf('Started');
                var forms = response.data.Forms.filter(function(form) {
                    var diff = moment().diff(form.Values[creationDateColumn], 'days', true);
                    return diff >= 1 && diff < 2;
                });
                
                console.log(forms);
            }
        );
        return formsPromise;
    }

};

var Util = {
    sendRequest: function(options) {
        var deferred = new Deferred();
        var restClient = new RESTClient();
        restClient.post(options.url, options.args, function(data, response) {

            var endpoint = response.req.path.split('/').pop();
            var isError = data.Result.Error !== undefined;

            deferred.resolve({
                endpoint: endpoint,
                data    : isError ? data.Result.Error: data.Result,
                isError : isError
            });
        });
        return deferred.promise;
    },
    getHeaders: function(config) {
        return {
            'RpmApiKey': config.key
        }
    },
    url: function(config, endpoint) {
        var url = config.url.ensureRight('/');
        if (!url.endsWith('/rpm/')) {
            url = url.ensureRight('/rpm/')
        }
        url = url.ensureRight('Api2.svc/');
        return url + endpoint;
    }

}