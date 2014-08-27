var util    = require('util'),
    _       = require('underscore'),
    twitter = require('twitter');

var twitterauth = require('../../config/twitter').auth,
    accounts = require('../../config/twitter').users,
    twit = new twitter(twitterauth);

module.exports = function(io) {

    // Build an array containing just the user IDs.
    var user_ids = _.map(accounts, function(key, value) {
        return key.id;
    });

    // Twitter Site Streaming is not avaible for everyone. Instead we use User Streaming.
    // This assumes that the authenticated user is following all the users written in the config.
    twit.stream('user', { track: user_ids.join(',') }, function(stream) {
        stream.on('data', function(data) {
            // When connecting Twitter returns an array with the key 'friends'.
            // We don't need that.
                                // Also, just make something when the received data is from one of the given users,
                                // not when somebody mentions them.
            if(!data.friends && _.indexOf(user_ids, data.user.id) > -1) {
                var send = {
                    type: 'twitter',
                    user: {
                        id: data.user.id,
                        name: data.user.screen_name
                    },
                    text: data.text
                };

                // Send a message to all connected sockets who are listening on 'news'.
                io.emit('news', send);
                console.log(send);
            }   
        });
    });
};