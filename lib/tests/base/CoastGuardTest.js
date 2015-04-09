var $                 = require('node-class'),
    __class           = $.class,
    Promised   = require("promised-io/promise"),
    Deferred   = Promised.Deferred,
    Reporter = require('../../Reporter').Reporter;

CoastGuardTest = __class('CoastGuardTest', {
    raw: {},
    name: 'CoastGuardTest',
    resultPromise: null,
    deferred: null,
    isError: false,
    results: [],
    initialize: function() {
        this.deferred = new Deferred();
    },
    runTest: function(config) {
        return this.deferred;
    },
    error: function(title, content) {
        this.isError = true;
        this._resolve(true, title, content);
    },
    success: function(title, content) {
        this._resolve(false, title, content);
    },
    _resolve: function(isError, title, content) {
        if (typeof content === 'string') {
            content = [{
                title: title,
                content: content,
                isError: isError
            }];
        }
        content = content.map(function(entry) {
            return Reporter.render(
                'report_entry',
                entry
            );
        }).join('\n');
        this.results.push({
            isError : isError,
            title   : title,
            content : content
        });
    },
    registerRaw: function(key, value) {
        this.raw[key] = value;
    },
    done: function() {
        this.deferred.resolve({
            test: this,
            rendered: this._render()
        });
    },
    _render: function() {
        console.log(this.results);
        var rendered = this.results.map(function(result) {
            return Reporter.render('report_section', result);
        }).join('\n');
        return rendered;
    }
});