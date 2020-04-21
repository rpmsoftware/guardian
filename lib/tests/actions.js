var $ = require('node-class');
var __class = $.class;
var util = require('util');
var CoastGuardTest  = require('./base/CoastGuardTest');
var CGUtils         = require('../CGUtils').CGUtils;
var Promised        = require('promised-io/promise');
var Seq             = Promised.seq;
var Deferred        = Promised.Deferred;
var moment          = require('moment');
var ImapClient      = require('emailjs-imap-client');
var gmail           = require('../gmail');
var _               = require('lodash');
var quotedPrintable = require('quoted-printable');
var parseHeaders    = require('parse-headers');
var jsdom           = require('jsdom');
var https           = require('https');
var URL             = require('url');
var base64          = require('js-base64').Base64;

var EXPECTED_ACTIONS = [
    'It has been 1 day since status is New',
    'Action created 1 day after "The date field"'
];
ActionTest = __class('Action', {
    extends: ['CoastGuardTest'],
    name: 'Automatic action creation check',
    foundTodayForms: false,
    runTest: function(config, otherConfigs) {
        this.config = config;
        this.otherConfigs = otherConfigs;

        var testsPromise = Seq(
            [
                this.checkYesterdayForms.bind(this),
                this.createTodayForms.bind(this),
                this.checkNotificationEmails.bind(this)
            ]
        );
        testsPromise.then(function() {
            console.log('DONE!');
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
                var formCreatedDate = form.Values[creationDateColumn];
                var created = moment(formCreatedDate, 'M/DD/YYYY h:mm:ss a');
                if (!created.isValid()) {
                    created = moment(formCreatedDate);
                }

                created.hour(8);
                created.minutes(0);
                created.seconds(0);

                var today = moment();
                created.hour(0);
                created.minutes(0);
                created.seconds(0);

                var diff = today.diff(created, 'days', false);
                var isToday = diff < 1;
                if (isToday) {
                    this.foundTodayForms = true;
                }
                var isYesterday = diff >= 1 && diff < 2;
                return isYesterday;
            }.bind(this));

        forms = forms.map(function(form) {
            response.data.Columns.forEach(function(column, i) {
                form[column] = form.Values[i]; 
            });
            return form;
        });

        this.registerRaw('YesterdayForm', forms[0]);

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
                            matching.map(function(action) { return action.Action;}).join('</li><li>')
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
            }.bind(this));
        return checkDone.promise;
    },
    checkNotificationEmails: async function() {
        var checkDone = new Deferred();

        const emails = await gmail.getInboxEmails();
        var yesterdayForm = this.getRaw('YesterdayForm');
        if (!yesterdayForm) {
            console.log('Notification email', 'Yesterday\'s form not found so cannot find notification email')
            this.error('Notification email', 'Cannot check notification email without yesterday\'s form');
            checkDone.resolve();
            return checkDone.promise;
        }
        
        var expectedSubject = this.config.name + ' Actions ' + yesterdayForm.Number;
        const email = this.findGmail(emails, expectedSubject);
        if (email === undefined) {
            console.log('Notification email', 'Expected an email with subject "' + expectedSubject + '"')
            this.error('Notification email', 'Expected an email with subject "' + expectedSubject + '"');
            checkDone.resolve();
            return checkDone.promise;
        }
        await this.checkGmail(email, checkDone);

        return checkDone.promise;
    },
    findGmail: function(emails,expectedSubject) {
        const  found = _.find(emails, e => {
            var subject = _.find(e.payload.headers, header => {
                return header.name ===  'Subject';
            });
            return subject.value === expectedSubject
        });
        if (found === undefined) {
            return found;
        }
        return found;
    },
    checkGmail: async function(email, checkDone) {
        var body =  this._getGmailBody(email.payload);
        var dom = new jsdom.JSDOM(body);
        var links = dom.window.document.getElementsByTagName('a');
        var viewInText = 'View in ' + this.config.name;
        links = _.filter(links, function(link) {
            var text = link.innerHTML.trim();
            return text === viewInText;
        }).map(function(link) {
            return link.href;
        });

        if (links.length !== 1) {
            this.error('Notification email', 'Could not find "' +  viewInText + '" link.');
            checkDone.resolve();
            return;
        }
        
        var form = this.getRaw('YesterdayForm');
        var expectedURL = URL.parse(this.config.url);
        var host = expectedURL.hostname.split('.');
        host.shift();
        host.splice(0,0, 'secure');

        expectedURL = 'https://' + host.join('.') + expectedURL.pathname + 'Page/Form.aspx?Item=' + form.FormID;
        expectedURL = expectedURL.toLowerCase();

        var url = links[0];
        https.get(url,function(response) {
            if (response.headers.location.toLowerCase() !== expectedURL) {
                this.error(
                    'Notification email', 
                    'Link URL did not match "' +  expectedURL + '".'
                );
            } else {
                this.success(
                    'Notification email',
                    'Found email with "' +  viewInText + '" link and URL "' +  expectedURL + '".'
                );
            }

            checkDone.resolve();
        }.bind(this));

        await gmail.archiveAndMarkEmailRead(email.id);
        
        return checkDone.promise;
    },
    _getGmailBody: function(message) {
        var body = '';
        if(message.parts === undefined)
        {
            body = message.body.data;
        }
        else
        {
            body = this._getGmailHTMLPart(message.parts);
        }
        return this._decodeBase64(body);
    },
    _getGmailHTMLPart: function(arr) {
        for(var x = 0; x <= arr.length; x++)
        {
          if(arr[x].parts === undefined)
          {
            if(arr[x].mimeType === 'text/html')
            {
              return arr[x].body.data;
            }
          }
          else
          {
            return getHTMLPart(arr[x].parts);
          }
        }
        return '';
    },
    _decodeBase64: function(body) {
        body = body.replace(/-/g, '+');
        body = body.replace(/_/g, '/');
        body = body.replace(/\s/g, '');
        return base64.decode(body);
    }
});

exports.Test = ActionTest;