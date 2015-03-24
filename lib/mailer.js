var mandrill = require('mandrill-api/mandrill');


exports.Mailer = {
	sendEmail: function(email, config) {
		console.log('to:', email.to);
		console.log('subject:', email.subject);
		console.log('content:\n', email.content);

		var message = {
			'from_email': config.from_email,
			'from_name': config.from_name,
			'html': email.content,
			'subject': email.subject,
			'to': email.to,
			'inline_css': true,
			'auto_text': true
		};
		// return;
		var mandrill_client = new mandrill.Mandrill(config.api_key);
		mandrill_client.messages.send(
			{
				message: message,
				async: true
			},
			function(result) {
				console.log(result);
			}
		);
	}
}