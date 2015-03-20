var Mustache  = require('mustache');
var fs        = require('fs');
var util      = require('util');

exports.Reporter = {
	render: function(template, data) {
		var path     = __dirname  + '/templates/' + template + '.html';
		var html     = fs.readFileSync(path, {encoding: 'utf8'});
		var content  = Mustache.render(html, data, true);


		return content;
	}
};