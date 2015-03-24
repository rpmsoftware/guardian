var $                 = require('node-class'),
    __class           = $.class,
    TestResultPromise = require('./TestResultPromise');


CoastGuardTest = __class('CoastGuardTest', {
    raw: {},
    result: null,
    initialize: function() {
        this.result = new TestResultPromise();
    },
    runTest: function(config) {
        return this.result.deferred;
    },
    error: function(title, content) {
        this._resolve(true, title, content);
    },
    success: function(title, content) {
        this._resolve(false, title, content);
    },
    _resolve: function(isError, title, content) {
        this.isError = isError;
        this.title   = title;
        this.content = content;
        this.result.deferred.resolve({
            test: this
        });
    },
    registerRaw: function(key, value) {
        this.raw[key] = value;
    }
});