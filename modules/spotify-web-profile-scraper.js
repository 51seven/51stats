var https      = require('https'),
	when       = require('when'),
	cheerio    = require('cheerio'),
	async 	   = require('async');

// HTTPS GET Request to Spotify User Profil Page
function getPublicProfile(userid) {
	return when.promise(function(resolve, reject, notify) {
		https.get({ host: 'open.spotify.com', path: '/user/' + userid }, function(res) {
			var body = '';

			res.on('data', function(chunk) {
				body += chunk;
			});
			res.on('end', function() {
				resolve(body);
			});
		}).on('error', function(err) {
			reject(err);
		});
	});
}

module.exports = function(userid) {
	return when.promise(function(resolve, reject) {
		getPublicProfile(userid)
			.then(function(body) {
				var $ = cheerio.load(body),
					track_ids = [],
					name, profile_pic;

				if(body.indexOf('<h3>Top Tracks') > -1) {
					$('li.single-track').each(function(i, elem) {
						track_ids[i] = $(this).attr('data-id');
					});
				}

				name = $('meta[property="og:title"]').attr('content');
				profile_pic = $('#big-cover').attr('src');

				return {
					name: name,
					img: profile_pic,
					top_tracks: track_ids
				};

			})
			.then(function(result) {
				resolve(result);
			})
			.catch(function(err) {
				reject(err)
			});
	});
};