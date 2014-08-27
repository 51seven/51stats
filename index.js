var fs      = require('fs'),
    _       = require('underscore'),
    restify = require('restify');

var server = restify.createServer({
    name: '51stats',
    version: '0.0.1'
});

if(process.argv[2] !== 'no-socket') {
    console.log('Socket.io server binded to %s', server.name);
    var io = require('socket.io').listen(server.server);
}

server.use(restify.acceptParser(server.acceptable));
server.use(restify.queryParser());
server.use(restify.bodyParser());

fs.readdir('api', function(err, files) {
    _.each(files, function(file, index, list) {
        if(!fs.lstatSync('api/'+file).isDirectory()) {
            server.get('/'+file.replace('.js', ''), require('./api/'+file));
        }
    });
});


if(process.argv[2] !== 'no-socket') {
    fs.readdir('api/stream', function(err, files) {
        _.each(files, function(file, index, list) {
            require('./api/stream/'+file)(io);
        });
    });
}


// TODO: Caching component (wtf do I need Redis for this?)

server.listen(8080, function () {
    console.log('%s listening at %s', server.name, server.url);
});