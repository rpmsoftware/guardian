var Promised = require("promised-io/promise");
var Util     = require('./Util').Util;
var moment   = require('moment');
var Reporter = require('./Reporter').Reporter;
var util      = require('util');

var SLCRC_NAME = 'StatusLevelChangeReminderCheck';
var EXPECTED_ACTIONS = [
    'It has been 1 day since status is New',
    'Action created 1 day after "The date field"'
];
/*
    Checks forms for status leve change reminders:

    Forms in the Actions process are created with status 'New' and
    after one day an action should have been created.
*/
exports.StatusLevelChangeReminderCheck = function(config) {
    this.deferred = Util.deferred();
    this.config = config;
    this.todayFormsFound = false;

    Util.request(
        'ProcForms', config,
        {
            'Process': 'Actions'
        }
    ).then(
        formListReceived.bind(this)
    );
}

function resolve(deferred, isError, raw, title, content) {
    deferred.resolve({
        isError: isError,
        raw    : raw,
        title  : title,
        content: content
    });
}

function formListReceived(response) {
    if (response.isError && response.data.Error.Message === 'No forms') {
        var noFormsReport = Reporter.render(
            'report_entry',
            {
                title:'No forms to check :)',
                description : 'No forms have been created on RPM yet.',
                isError: false
            }
        );
        resolve(this.deferred, false, null, 'No forms to check :D', noFormsReport);
        return;
    }

    var forms = response.data.Forms;
    var creationDateColumn = response.data.Columns.indexOf('Started');
    var formCheckers = forms
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
        }.bind(this))
        .map(function(form) {
            return Util.request('ProcForm', this.config, {
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
        resolve(this.deferred, true, null, 'Yesterday\'s forms not found!', noFormsReportError);
        return;
    }

    Promised.all(
        formCheckers
    ).then(
        formsDataReceived.bind(this)
    );
}

function formsDataReceived(forms) {
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
                form:formData,
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
                    description : '',
                    isError: false
                }
            )
        );

        return {
            form:formData,
            isError: false
        };
    });

    resolve(this.deferred, errorsFound, results, '', reports.join(''));
}