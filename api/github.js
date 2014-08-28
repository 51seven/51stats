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
		
		async.each(result[0], function(key, callback) {
			var now = new Date();
			var created_at = new Date(key.created_at);
			var obj = {};
			var userinfo = {};
			var login;

			if(key.hasOwnProperty("actor")) {
				if(now-created_at < 60*60*24*1000) { // 1 day in ms
					login = key.actor.login;

					if(filtered_results.length > 0) {
						var found = false;

						for(var key in filtered_results) {
							if(filtered_results[key].name == login) {
								filtered_results[key].commit_count ++;
								found = true;
							}
						}

						if(!found) {
							obj.name = login;
							obj.commit_count = 1;
							filtered_results.push(obj);
						}
					}
					else {
						obj.name = login;
						obj.commit_count = 1;
						filtered_results.push(obj);
					}
				}
			} 

			callback();

		}, function() {
			
			res.send(filtered_results);
			
			// Don't forget this:
			return next();
		});
	});
};




