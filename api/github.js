var when 	= require('when'),
	_ 		= require('underscore'),
	async 	= require('async'),
	GitHubApi = require('github');

var github = new GitHubApi({
    version: "3.0.0",
    timeout: 5000
});

function getCommits(user, callback) {
	/*github.user.getFollowingFromUser({ user: user }, function(err, commits) {
		callback(commits);
	});*/

	github.events.getFromOrg({org: '51seven'}, function(err, commits) {
		callback(commits);
	});
}

/*
*/
module.exports = function(req, res, next) {
	var result = [];
	var users = ['test'];//['zvaehn', 'verwebbt', 'Plsr'];

	async.each(users, function(user, callback) {
		getCommits(user, function(commits) {
			result.push(commits);
			callback();
		});	
	}, function() {
		var filtered_results = [];
		result = result[0];
		var login;
		
		for (var key in result) {
			var now = new Date();
			var created_at = new Date(result[key].created_at);

			if(result[key].hasOwnProperty("actor")) {
				if(now-created_at < 60*60*24*1000) { // 1 day in ms
					login = result[key].actor.login;

					// Creating a new author in the results array
					if(filtered_results[login] === undefined) {
						filtered_results[login] = {};
						filtered_results[login].commit_count = 0;
					}
					
					filtered_results[login].commit_count++;
				}
			}
		}

		//console.log(filtered_results);
		// res.send(results);

		res.send(filtered_results);
	});

	
	// Don't forget this:
	return next();
};