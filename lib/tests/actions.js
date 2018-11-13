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
var _               = require('lodash');
var quotedPrintable = require('quoted-printable');
var parseHeaders    = require('parse-headers');
var jsdom           = require('jsdom');
var https           = require('https');
var URL             = require('url');

var EXPECTED_ACTIONS = [
    'It has been 1 day since status is New',
    'Action created 1 day after "The date field"'
];

var sharedClient = null;
var getImapInstance = function(email, password, error, done) {
    if (sharedClient === null) {
        sharedClient = new ImapClient.default('imap.gmail.com', 993, {
            auth: {
                user: email,
                pass: password
            },
            logLevel: 1000
        });
        sharedClient.onerror = function(error) {
            console.log('Notification email IMAP error', error);
            error('Notification email', 'An error occurred while fetching the email from ' + email);
            done(client, checkDone);
        }.bind(this);
    }
    return sharedClient;
}

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
                var created = moment(form.Values[creationDateColumn], 'M/DD/YYYY h:mm:ss a');
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
    checkNotificationEmails: function() {
        var checkDone = new Deferred();

        var notification_email = this.otherConfigs.notification_email.address;
        var notification_password = this.otherConfigs.notification_email.password;
        var client = getImapInstance(
            notification_email,
            notification_password,
            this.error,
            this.finishEmailCheck
        );

        if (client._state < 3) {
            console.log('IMAP connecting');
            client.connect().then(function() {
                this.loadEmails(client, checkDone);
            }.bind(this))
            .catch(function(error) {
                console.log('checkNotificationEmails ERROR' , error);
                this.error('Notification email',  'An error occurred while connecting to the notifications email inbox at ' + notification_email);
                this.finishEmailCheck(client, checkDone);
            }.bind(this));
        } else {
            this.loadEmails(client, checkDone);
        }
        return checkDone.promise;
    },
    _emails: null,
    loadEmails: function(client, checkDone) {
        console.log('IMAP loading emails');
        var expectedSubject = this.config.name + ' Actions ' + this.getRaw('YesterdayForm').Number;

        console.log('IMAP connect done, listing messages...');
        var fetchItems = [
            'uid',
            'body[header.fields (content-type)]',
            'body[header.fields (content-transfer-encoding)]',
            'body[header.fields (subject)]',
            'body[text]'
        ];
        client.listMessages('INBOX', '1:*', fetchItems).then(function(emails) {
            console.log('IMAP email list received');
            var email = this.findEmail(emails, expectedSubject);
            if (email === false) {
                this.error('Notification email', 'Expected an email with subject "' + expectedSubject + '"');
                this.finishEmailCheck(client, checkDone);
                return;
            }
            this.checkEmail(email, client, checkDone);
        }.bind(this)).catch(function(err) {
            console.log('IMAP listMessages error', err);
            this.error('Notification email',  'An error occurred while fetching the email from ' + notification_email);
            this.finishEmailCheck(client, checkDone);
        }.bind(this));
    },
    findEmail: function(emails, expectedSubject) {
        emails = _.filter(emails, function(email) {
            var subject = email['body[header.fields (subject)]'].replace('Subject: ', '').trim();
            return subject.indexOf(expectedSubject) === 0;
        }.bind(this));
        if (emails.length !== 1) {
            return false;
        }
        return emails[0];
    },
    checkEmail: function(email, client, checkDone) {
        var contentType = email['body[header.fields (content-type)]'];
        var body = email['body[text]'].trim();
        var isQuotedPrintable = email['body[header.fields (content-transfer-encoding)]'].indexOf('quoted-printable') !== -1;
        if (contentType.indexOf('boundary="') !== -1) {
            var boundary = contentType.replace(/.*boundary="([^"]+)".*/, '$1').trim();
            body = body.split('--' + boundary);
            body = _.filter(body, function(part) {
                return part.trim().indexOf('Content-Type: text/html') === 0;
            });
            body = body[0].trim().replace(/\r/g, '').split('\n\n'); 
            var headers = body.shift();
            headers = parseHeaders(headers);
            isQuotedPrintable = isQuotedPrintable || headers['content-transfer-encoding'] === 'quoted-printable';
        } else {
            body = [body];
        }

        if (body.length === 0) {
            this.error('Notification email', 'Error parsing email (html body not found).');
            return;
        }
        body = body.join('\n\n');
        
        if (isQuotedPrintable) {
            body = quotedPrintable.decode(body);
        }
        
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
            this.finishEmailCheck(client, checkDone);
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
                this.error('Notification email', 'Link URL did not match "' +  expectedURL + '".');
                this.finishEmailCheck(client, checkDone);
                return;
            }
            this.success(
                'Notification email',
                'Found email with "' +  viewInText + '" link and URL "' +  expectedURL + '".'
            );

            client.deleteMessages('INBOX', email.uid, {byUid: true}).then(function() {
                this.finishEmailCheck(client, checkDone);
            }.bind(this));
        }.bind(this));
    },
    finishEmailCheck: function(client, promise) {
        if (this.config.isLast) {
            client.close().then(() => {
                promise.resolve();
            }).catch(function(error) {
                this.error('Notification email', 'Error while disconnecting from the email inbox ' + this.otherConfigs.notification_email.address);
                promise.resolve();
            }.bind(this));
        } else {
            promise.resolve();
        }
    }
});

exports.Test = ActionTest;