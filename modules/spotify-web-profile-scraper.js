var https      = require('https'),
    when       = require('when'),
    cheerio    = require('cheerio'),
    async      = require('async');

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
                    name;

                if(body.indexOf('<div>Top Tracks') > -1) {
                    $('tr.tl-row').each(function(i, elem) {
                        var uri = $(this).attr('data-uri');
                        var uria = uri.split(':');
                        track_ids[i] = uria[uria.length - 1];
                    });
                }

                name = $('meta[property="og:title"]').attr('content');

                return {
                    name: name,
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