var sgMail = require('@sendgrid/mail');
var inlineCss = require('inline-css');

var Mailer = {
	sendEmail: function(email, config, retryCount) {
		// console.log('to:', email.to);
		// console.log('subject:', email.subject);
		// console.log('content:\n', email.content);
		if (retryCount === undefined) {
			retryCount = 0;
		}
		inlineCss(email.content, {url: ' '}).then(function(html) {
			sgMail.setApiKey(config.api_key);
			var message = {
				'from': {
					'email': config.from_email,
					'name': config.from_name
				},
				'html': html,
				'subject': email.subject,
				'to': email.to
			};
			sgMail.send(message).then(() => {
				console.log('Email sent');
			  }).catch(e => {
					if(retryCount === 2) {
						console.error('SendGrid Error:', e.toString());
						console.log('Full message: \n', JSON.stringify(e), '\n\n');
						return;
					}
					Mailer.sendEmail(email, config, retryCount+1);
			  });
		});
	}	
}

exports.Mailer = Mailer;