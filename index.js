var configs = require('./config/config');
var Guardian = require('./lib/guardian').Guardian;

for (var i = configs.length - 1; i >= 0; i--) {
    var config = configs[i];
    var guardian = new Guardian(config);
    guardian.runAllTests();
};
