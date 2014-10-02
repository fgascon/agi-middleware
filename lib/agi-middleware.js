var EventEmitter = require('events').EventEmitter;
var merge = require('utils-merge');
var proto = require('./proto');

exports = module.exports = createServer;

exports.proto = proto;

function createServer() {
	function app(req, res, next){
		app.handle(req, res, next);
	}
	merge(app, proto);
	merge(app, EventEmitter.prototype);
	app.route = '/';
	app.stack = [];
	return app;
}