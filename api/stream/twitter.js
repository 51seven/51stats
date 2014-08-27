var util 	= require('util'),
	_ 		= require('underscore'),
	twitter = require('twitter');

var twitterauth = require('../../config/twitter').auth,
	accounts = require('../../config/twitter').users,
	twit = new twitter(twitterauth);

module.exports = function(io) {

	var user_ids = _.map(accounts, function(key, value) {
		return key.id;
	});

	twit.stream('user', { track: 'timotestetdinge' }, function(stream) {
		stream.on('data', function(data) {
			if(!data.friends && _.indexOf(user_ids, data.user.id) > -1) {
				var send = {
					type: 'twitter',
					user: {
						id: data.user.id,
						name: data.user.screen_name
					},
					text: data.text
				};
				io.emit('news', send);
			}	
		});
	});
};