var Promised = require("promised-io/promise");
var Util     = require('./Util').Util;
var moment   = require('moment');

var SLCRC_NAME = 'StatusLevelChangeReminderCheck';
/*
    Checks forms for status leve change reminders:

    Forms in the Actions process are created with status 'New' and
    after one day an action should have been created.
*/
exports.StatusLevelChangeReminderCheck = function(config) {
    this.deferred = Util.deferred();
    this.config = config;
    Util.request(
        'ProcForms', config,
        {
            'Process': 'Actions'
        }
    ).then(
        formListReceived.bind(this)
    );
}

function resolve(deferred, isError, reason) {
    deferred.resolve({
        isError: isError,
        reason: reason
    });
}

function formListReceived(response) {
    if (response.isError && response.data.Error.Message === 'No forms') {
        // Nothing to check (this should only happen once)
        return;
    }
    var forms = response.data.Forms;
    var creationDateColumn = response.data.Columns.indexOf('Started');
    var formCheckers = forms.map(function(form) {
        
        var created = moment(form.Values[creationDateColumn], 'M/DD/YYYY h:mm:ss a');
        var diff = moment().diff(created, 'days', true);
        var isYesterday = diff >= 1 && diff < 2 || true;
        if (!isYesterday) {
            return;
        }

        return Util.request('ProcForm', this.config, {
            'FormID': form.FormID
        });
    }.bind(this));

    Promised.all(
        formCheckers
    ).then(
        formsDataReceived.bind(this)
    );
}

function formsDataReceived(forms) {
    forms.forEach(function(form) {
        var formData = form.data.Form;
        var actions = formData.Actions;
        console.log();
        console.log('form received, actions:');
        console.log(actions);
        console.log();
        if (actions.length === 0) {
            resolve(this.deferred, true, 'No actions created');
        };
        
    });
}