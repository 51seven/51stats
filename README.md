51stats REST API
=======

This is a wrapper for some statistics of a bunch of people made with some APIs.

## Getting started

### How do I include an API?
Add a file into the `api` directory. The name of your file will be the URL, without the `.js` extension.

A simple file named `file.js` is avaible under `/file` and can look like this:
``` js
module.exports = function(req, res, next) {
	res.send('Hello World!');
	return next();
};
```

### Structure configs
You can put a few configurations of your API module into the `config`-directory. Would be great if the name of the file is somehow related to the module.

### Securing your API keys
Open accessible API keys are meh. Put them into a configuration file, censor them (maybe with `xxxx`), add the file to the `.gitignore`, push the whole thing and then insert them again. No one will see them (unless you want to update your config-file).

### Stream APIs
Listen to streams by adding a file into the `api/stream` directory. There's a socket.io server listening, so you can emit news easily.

A simple file can look like this:
``` js
module.exports = function(io) {
	[some stream event listener], function() {
		io.emit('news', { hello: 'world' });
	});
};
```

In a Browser you can connect to the websocket like this:
``` html
<script src="https://cdn.socket.io/socket.io-1.0.6.js"></script>
<script>
var socket = io('http://localhost:8080'); // or wherever the server is located
socket.on('news', function (data) {
	console.log(data);
});
</script>
```

## Troubleshooting

### The provided example with the Twitter API won't work!!1
The API Keys for Twitter are censored. For testing register your own twitter app.

### I get an error when launching the app
1. Try `npm install`
1. Restify runs on port 8080, maybe some other process is running on that port?
1. You've edited something and made a mistake

## TODO

* restify Caching
* private `POST`/`PUT` methods
*