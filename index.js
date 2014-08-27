var fs 		= require('fs'),
	_ 		= require('underscore'),
	restify = require('restify');

var server = restify.createServer({
	name: '51stats',
	version: '0.0.1'
});

server.use(restify.acceptParser(server.acceptable));
server.use(restify.queryParser());
server.use(restify.bodyParser());

fs.readdir('api', function(err, files) {
	_.each(files, function(element, index, list) {
		server.get('/'+element.replace('.js', ''), require('./api/'+element));
	});
});

// TODO: Caching component (wtf do I need Redis for this?)

server.listen(8080, function () {
	console.log('%s listening at %s', server.name, server.url);
});