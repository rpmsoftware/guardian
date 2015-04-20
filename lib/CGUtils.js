require('string').extendPrototype();

var Promised    = require("promised-io/promise");
var Deferred    = Promised.Deferred;
var RESTClient  = require('node-rest-client').Client;

exports.CGUtils = {
    request: function(endpoint, config, data) {
        var url = this.url(config, endpoint);
        var args = {headers: this.getHeaders(config), data:data};
        var deferred = this.deferred();
        console.log('\nPOST ' + url + '\n\n' + JSON.stringify(data) + '\n\n');
        new RESTClient().post(url, args, function(data, response) {

            var endpoint = response.req.path.split('/').pop();
            var doneData = {};
            var isError = false;
            if (data.Result) {
                if (data.Result.Error) {
                    isError = data.Result.Error !== undefined;
                }
                doneData = isError ? data.Result.Error: data.Result;
            } else {
                isError = true;
                doneData = {
                    Message: data
                };
            }
            deferred.resolve(
                this.dataForGuardian(endpoint, isError, doneData)
            );
        }.bind(this));
        return deferred.promise;
    },
    dataForGuardian: function(testName, isError, data, report) {
        return {
            testName: testName,
            data    : data,
            isError : isError,
            report  : report
        };
    },
    getHeaders: function(config) {
        return {
            'RpmApiKey': config.key
        }
    },
    url: function(config, endpoint) {
        var url = config.url.toLowerCase().ensureRight('/');
        if (!url.endsWith('/rpm/')) {
            url = url.ensureRight('/rpm/')
        }
        url = url.ensureRight('Api2.svc/');
        return url + endpoint;
    },
    deferred: function() {
        return new Deferred();
    }

}