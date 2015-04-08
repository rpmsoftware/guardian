var $ = require('node-class');
var __class = $.class;
var util = require('util');
var CoastGuardTest = require('./base/CoastGuardTest');
var CGUtils        = require('../CGUtils').CGUtils;
var moment         = require('moment');
var Reporter       = require('../Reporter').Reporter;
var Promised       = require('promised-io/promise');

var EXPECTED_ACTIONS = [
    'It has been 1 day since status is New',
    'Action created 1 day after "The date field"'
];

ActionTest = __class('Action', {
    extends: ['CoastGuardTest'],
    runTest: function(config) {
        this.config = config;
        CGUtils.request(
            'ProcForms', config,
            {
                'Process': 'Actions'
            }
        ).then(
            this.formListReceived.bind(this)
        );
        return this.__parent();
    },
    formListReceived: function(response) {
        if (response.isError) {
            if (response.data.Message === 'No forms') {
                var noFormsReport = Reporter.render(
                    'report_entry',
                    {
                        title:'No forms to check :)',
                        description : 'No forms have been created on RPM yet.',
                        isError: false
                    }
                );
                this.success('No forms to check :D', noFormsReport);
            } else {
                this.error('Error', response.data.Message);
            }
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
                    this.todayFormsFound = true;
                }
                var isYesterday = diff >= 1 && diff < 2;

                return isYesterday;
            }.bind(this));

        this.registerRaw('FormList', forms);

        var formCheckers = forms
            .map(function(form) {
                console.log(this.config);
                return CGUtils.request('ProcForm', this.config, {
                    'FormID': form.FormID
                });
            }.bind(this));

        if (formCheckers.length === 0) {
            var noFormsReportError = Reporter.render(
                'report_entry',
                {
                    title:'Yesterday\'s form not found!',
                    description : 'Form not found.',
                    isError: true
                }
            );
            this.error('Yesterday\'s forms not found!', noFormsReportError);
            return;
        }

        Promised.all(
            formCheckers
        ).then(
            this.formsDataReceived.bind(this)
        );
    },
    formsDataReceived: function(forms) {
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
                    Reporter.render(
                        'report_entry',
                        {
                            title: util.format(
                                'No actions found on form %s',
                                formData.Number
                            ),
                            description : '',
                            isError: true
                        }
                    )
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
                    Reporter.render(
                        'report_entry',
                        {
                            title: util.format(
                                'Some actions were not created on form %s',
                                formData.Number
                            ),
                            description : util.format(
                                'Expected <ul><li>%s</li></ul>',
                                EXPECTED_ACTIONS.join('</li><li>')
                            ),
                            isError: true
                        }
                    )
                );

                return {
                    form: formData,
                    isError: true,
                    reason: 'Some actions were not created, expected: ' + EXPECTED_ACTIONS.join(',')
                };
            }

            reports.push(
                Reporter.render(
                    'report_entry',
                    {
                        title: util.format(
                            'All actions created on form %s',
                            formData.Number
                        ),
                        description :  util.format(
                            'Actions checked <ul><li>%s</li></ul>',
                            EXPECTED_ACTIONS.join('</li><li>')
                        ),
                        isError: false
                    }
                )
            );

            return {
                form:formData,
                isError: false
            };
        });

        this.success('Actions checked', reports.join(''));
    }
});

exports.Test = ActionTest;


 

