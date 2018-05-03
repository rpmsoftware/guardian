var sgMail = require('@sendgrid/mail');
var inlineCss = require('inline-css');

exports.Mailer = {
	sendEmail: function(email, config) {
		// console.log('to:', email.to);
		// console.log('subject:', email.subject);
		// console.log('content:\n', email.content);
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
				console.error('SendGrid Error:', e.toString());
			  });
		});
	}	
}