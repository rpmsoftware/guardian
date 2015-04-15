var $ = require('node-class');
var __class = $.class;
var util = require('util');
var CoastGuardTest = require('./base/CoastGuardTest');
var CGUtils        = require('../CGUtils').CGUtils;
var Promised       = require('promised-io/promise');
var Serial         = require('node-serial');
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
        var serial = new Serial();
        serial
            .add(
                this.checkYesterdayForms.bind(this)
            )
            .add(
                this.createTodayForms.bind(this)
            );
        serial.done(function() {
            this.done();
        }.bind(this))
        return this.__parent();
    },
    checkYesterdayForms:function(done, ctx) {
        CGUtils.request(
            'ProcForms', this.config,
            {
                'Process': 'Actions'
            }
        ).then(function(response) {
            this.formListReceived(response, done, ctx);
        }.bind(this));
    },
    formListReceived: function(response, done, ctx) {
        if (response.isError) {
            if (response.data.Message === 'No forms') {
                this.success(
                    'Checking yesterday\'s form',
                    'No forms have been created on RPM yet.'
                );
            } else {
                this.error('Error while checking yesterday\'s form', response.data.Message);
            }
            done();
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
            done();
            return;
        }

        Promised.all(
            formCheckers
        ).then(function(forms) {
            this.formsDataReceived(forms, done, ctx)
        }.bind(this));
    },
    formsDataReceived: function(forms, done, ctx) {
        this.registerRaw('FormsData', forms);

        var errorsFound = false;
        var reports = [];
        var results = forms.map(function(form) {
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
                return {
                    form:formData,
                    isError: true,
                    reason: 'No actions created'
                };
            };

            var matching = actions.filter(function(action) {
                return EXPECTED_ACTIONS.indexOf(action.Action) >= 0;
            });

            if (matching.length !== EXPECTED_ACTIONS.length) {
                errorsFound = true;

                reports.push(
                    {
                        title: 'Checking yesterday\'s form',
                        description : util.format(
                            'Some actions were not created on form %s.\nExpected <ul><li>%s</li></ul>',
                            formData.Number,
                            EXPECTED_ACTIONS.join('</li><li>')
                        ),
                        isError: true
                    }
                );

                return {
                    form: formData,
                    isError: true,
                    reason: 'Some actions were not created, expected: ' + EXPECTED_ACTIONS.join(',')
                };
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

            return {
                form:formData,
                isError: false
            };
        });
        this.success('Actions checked', reports);
        done();
    },
    createTodayForms: function(done, ctx) {
        if(this.foundTodayForms) {
            this.success('Forms for tomorrow', 'Forms have been found and will be checked tomorrow');
            done();
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
                    done();
                    return;
                };
                this.success(
                    'Form for tomorrow',
                    util.format(
                        'The form %s was created on process %s.',
                        info.data.Form.Number, info.data.Process
                    )
                );
                done();
            }.bind(this))
    }
});

exports.Test = ActionTest;