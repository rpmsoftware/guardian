require('string').extendPrototype();

var Promised    = require("promised-io/promise");
var Deferred    = Promised.Deferred;
var RESTClient  = require('node-rest-client').Client;
// Ignore SSL cert errors
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";



exports.Util = {
    request: function(endpoint, config, data) {
        var url = this.url(config, endpoint);
        var args = {headers: this.getHeaders(config), data:data};
        var deferred = this.deferred();
        new RESTClient().post(url, args, function(data, response) {

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
    },
    deferred: function() {
        return new Deferred();
    }

}