var $          = require('node-class');
var __class    = $.class;
var Promised   = require("promised-io/promise");
var Deferred   = Promised.Deferred;

TestResultPromise = __class('TestResultPromise', {
    title: '',
    content: '',
    isError: false,
    deferred: null,
    initialize: function() {
        this.deferred = new Deferred();
    }
});

module.exports = TestResultPromise;