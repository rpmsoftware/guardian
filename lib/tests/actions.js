var $ = require('node-class');
var __class = $.class;
var util = require('util');
var CoastGuardTest = require('./base/CoastGuardTest');
var CGUtils        = require('../CGUtils').CGUtils;
var Promised       = require('promised-io/promise');
var Seq            = Promised.seq;
var Deferred       = Promised.Deferred;
var moment         = require('moment');

var EXPECTED_ACTIONS = [
    'It has been 1 day since status is New',
    'Action created 1 day after "The date field"'
];

ActionTest = __class('Action', {
    extends: ['CoastGuardTest'],
    name: 'Automatic action creation check',
    foundTodayForms: false,
    runTest: function(config) {
        this.config = config;
        var testsPromise = Seq(
            [
                this.checkYesterdayForms.bind(this),
                this.createTodayForms.bind(this)
            ]
        );
        testsPromise.then(function() {
            this.done();
        }.bind(this));
        return this.__parent();
    },
    checkYesterdayForms:function() {
        var checkDone = new Deferred();
        CGUtils.request(
            'ProcForms', this.config,
            {
                'Process': 'Actions'
            }
        ).then(function(response) {
            this.formListReceived(response, checkDone);
        }.bind(this));
        return checkDone.promise;
    },
    formListReceived: function(response, checkDone) {
        if (response.isError) {
            if (response.data.Message === 'No forms') {
                this.success(
                    'Checking yesterday\'s form',
                    'No forms have been created on RPM yet.'
                );
            } else {
                this.error('Error while checking yesterday\'s form', response.data.Message);
            }
            checkDone.resolve();
            return;
        }

        var creationDateColumn = response.data.Columns.indexOf('Started');
        var forms = response.data.Forms
            .filter(function(form) {
                var created = moment(form.Values[creationDateColumn], 'M/DD/YYYY h:mm:ss a');
                created.hour(8);
                created.minutes(30);
                created.seconds(0);

                var diff = moment().diff(created, 'days', false);
                var isToday = diff < 1;
                if (isToday) {
                    this.foundTodayForms = true;
                }
                var isYesterday = diff >= 1 && diff < 2;

                return isYesterday;
            }.bind(this));

        this.registerRaw('FormList', forms);

        var formCheckers = forms
            .map(function(form) {
                return CGUtils.request('ProcForm', this.config, {
                    'FormID': form.FormID
                });
            }.bind(this));

        if (formCheckers.length === 0) {
            this.error(
                'Checking yesterday\'s form',
                'Yesterday\'s forms not found!'
            );
            checkDone.resolve();
            return;
        }

        Promised.all(
            formCheckers
        ).then(function(forms) {
            this.formsDataReceived(forms, checkDone)
        }.bind(this));
    },
    formsDataReceived: function(forms, checkDone) {
        this.registerRaw('FormsData', forms);

        var errorsFound = false;
        var reports = [];
        forms.forEach(function(form) {
            var formData = form.data.Form;
            var actions = formData.Actions;
            var report = '';
            
            if (actions.length === 0) {
                errorsFound = true;

                reports.push(
                    {
                        title: 'Checking yesterday\'s form',
                        content: util.format(
                            'No actions found on form %s',
                            formData.Number
                        ),
                        isError: true
                    }
                );
                return;
            }

            var matching = actions.filter(function(action) {
                return EXPECTED_ACTIONS.indexOf(action.Action) >= 0;
            });

            if (matching.length !== EXPECTED_ACTIONS.length) {
                errorsFound = true;
                reports.push(
                    {
                        title: 'Checking yesterday\'s form',
                        content : util.format(
                            'Did not get the exact number of actions expected on form %s.\n' + 
                            'Expected <ul><li>%s</li></ul>\n' + 
                            'Got <ul><li>%s</li></ul>\n',
                            formData.Number,
                            EXPECTED_ACTIONS.join('</li><li>'),
                            matching.join('</li><li>')
                        ),
                        isError: true
                    }
                );
                return;
            }

            reports.push(
                {
                    title: 'Checking yesterday\'s form',
                    content:  util.format(
                        'All actions created on form %s.\nActions checked <ul><li>%s</li></ul>',
                        formData.Number,
                        EXPECTED_ACTIONS.join('</li><li>')
                    ),
                    isError: false
                }
            );
        });

        if (errorsFound) {
            this.error('Actions checked', reports);
        } else {
            this.success('Actions checked', reports);
        }
        checkDone.resolve();
    },
    createTodayForms: function() {
        var checkDone = new Deferred();
        if(this.foundTodayForms) {
            this.success('Forms for tomorrow', 'Forms have been found and will be checked tomorrow');
            checkDone.resolve();
            return;
        }
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
        CGUtils.request('ProcFormAdd', this.config, formData)
            .then(function(info) {
                if (info.isError) {
                    this.error(
                        'Error while creating forms for tomorrow',
                        info.data.Message
                    );
                    checkDone.resolve();
                    return;
                }
                this.success(
                    'Form for tomorrow',
                    util.format(
                        'The form %s was created on process %s.',
                        info.data.Form.Number, info.data.Process
                    )
                );
                checkDone.resolve();
            }.bind(this))
        return checkDone.promise;
    }
});

exports.Test = ActionTest;