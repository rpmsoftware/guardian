// Using endsWith, ensureRight
require('string').extendPrototype();
var URL         = require('url');
var Promised    = require("promised-io/promise");
var Deferred    = Promised.Deferred;
var RESTClient  = require('node-rest-client').Client;

exports.CGUtils = {
    request: function(endpoint, config, data) {
        var url = this.url(config, endpoint);
        var args = {headers: this.getHeaders(config), data:data};
        var deferred = this.deferred();
        console.log('\nPOST ' + url + '\n\n' + JSON.stringify(data) + '\n\n');

        var options = {};
        if (process.env.QUOTAGUARDSTATIC_URL) {
            var parsed = URL.parse(process.env.QUOTAGUARDSTATIC_URL);
            var auth = parsed.auth.split(':');
            options.proxy = {
                host: parsed.hostname,
                port: parsed.port || 80,
                user: auth[0],
                password: auth[1],
                tunnel: true 
            };
        };
        var request = new RESTClient(options);
        request.post(url, args, function(data, response) { 
            var receivedData = JSON.stringify(data);
            if (url.endsWith('ProcForms') && data.Result.Forms) {
                receivedData = data.Result.Forms.length + ' Form(s)';
            }
            console.log('\nRESPONSE ' + url + '\n\n' + receivedData + '\n\n' + response);
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
            request.removeAllListeners();
            console.log('Response Received', config.url, endpoint, doneData);
            deferred.resolve(
                this.dataForCoastGuard(endpoint, isError, doneData)
            );
        }.bind(this));

        request.on('error', function(err) {
            request.removeAllListeners();
            console.log ('Error', config.url, err);
            deferred.resolve(
                this.dataForCoastGuard(endpoint, true, { Message: err })
            );
        }.bind(this));

        request.on('requestTimeout',function(req){
            request.removeAllListeners();
            console.log("Request Timeout", config.url);
            req.abort();
            deferred.resolve(
                this.dataForCoastGuard(endpoint, true, {Message: 'Resquest timeout'})
            );
        });

        request.on('responseTimeout',function(res){
            request.removeAllListeners();
            console.log("responseTimeout", config.url);
            deferred.resolve(
                this.dataForCoastGuard(endpoint, true, {Message: 'Response timeout'})
            );
        });

        return deferred.promise;
    },
    dataForCoastGuard: function(testName, isError, data, report) {
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