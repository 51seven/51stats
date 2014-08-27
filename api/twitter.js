var when 	= require('when'),
	_ 		= require('underscore'),
	async 	= require('async'),
	twitter = require('twitter'),
	util 	= require('util');

var accounts = require('../config/twitter').users,
	twitterauth = require('../config/twitter').auth,
	config = require('../config/twitter').config;

// Authorize the app on twitter
var twit = new twitter(twitterauth);

// Save todays date and remove the hours, minutes, seconds ans ms
var today = new Date();
	today.setHours(0,0,0,0);


// This is fancy function to get the number of tweets by username.
// No need to understand this mess.
function getTodaysTweetCountOf(name) {
	var count = 0;

	// Parameter for the twitter API request.
	// Will be added to the twit.get as GET parameters.
	var params = {
		screen_name: name,
		trim_user: 1,
		count: config.req_tweets
	};

	// Because requests take some time, this needs to be async with a promise.
	// The then() of the called function (see below) will be called,
	// when resolve() is triggered.
	return when.promise(function(resolve, reject, notify) {
		twit.get('/statuses/user_timeline.json', params, function(data) {
			var date;

			_.each(data, function(tweet) {
				date = new Date(tweet.created_at);
				date.setHours(0,0,0,0);
				if(today - date === 0) {
					count++;
				}
			});

			resolve(count);
		});
	});
}

/* Here's the main part of the module.
   We've got the req object which contains a bunch of stuff from the request.
   We've got the res object to send a bunch of stuff back to the client.
   We've got the next function what is essential to call at the end.
   
   The Object which will be passed to the res.send is the whole object for your response.
   Think smart, structure it well. */
module.exports = function(req, res, next) {
	
	var result = [];

	// The async.each method will call the last function,
	// when all callbacks in the loop have been called.
	async.each(accounts, function(user, callback) {


		getTodaysTweetCountOf(user.name)
		.then(function(number) {
			result.push({
				id: user.id,
				name: user.name,
				count: number
			});
			callback();
		});
	}, function(err) {
		// Send the response with a object sorted by the name property
		res.send(_.sortBy(result, function(obj) {
			return obj.name
		}));

		// Don't forget this:
		return next();
	});

};