// On production, create an env variable "CG_CONFIG" with JSON value of configs
var configs = {
	"app": {
		"name": "Guardian"
	},
	"subscribers": [
		{
			"name": "RPM Server Name",
			"url" : "https://...",
			"key" : "RPM_API_KEY"
		}
	],
	"mailer": {
		"api_key": "MANDRILL_API_KEY",
		"from_email": "guardian@example.com",
		"from_name": "Guardian",
		"to": [
			{
				"name": "Lisa",
				"email": "lisa@example.com",
				"type": "to"
			}
		]
	},
    "notification_email": {
        "address": "",
        "password": ""
    }
};

module.exports = configs;