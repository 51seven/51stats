var when          = require('when'),
    async         = require('async'),
    _             = require('underscore'),
    SpotifyWebApi = require('spotify-web-api-node'),
    spotifyScrape = require('../modules/spotify-web-profile-scraper');

var auth = require('../config/spotify').auth,
    users = require('../config/spotify').users;

var spotify = new SpotifyWebApi(auth);

module.exports = function(req, res, next) {
    var result = [];

    async.each(users, function(user, callback) {
        var obj = {};
        spotifyScrape(user)
            .then(function(data) {
                obj.user = {
                    id: user,
                    name: data.name,
                    profile_img: (data.img).replace(/\t/g, '')
                };
                return data;
            })
            .then(function(data) {
                if(data.top_tracks[0]) {
                    spotify.getTrack(data.top_tracks[0])
                        .then(function(re) {
                            obj.toptrack = {
                                artist: {
                                    id: re.artists[0].id,
                                    name: re.artists[0].name
                                },
                                title: {
                                    id: re.id,
                                    name: re.name,
                                    preview: re.preview_url
                                },
                                images: re.album.images
                            };
                            result.push(obj);
                            callback();
                        }, function(err) {
                            callback(err);
                        });
                } else {
                    result.push(obj);
                    callback();
                }
            })
            .catch(function(err) {
                callback(err);
            });
    }, function(err) {
        if(err) {
            res.send(err);
            return next();
        } else {
            res.charSet('utf-8');
            res.send(_.sortBy(result, function(obj) {
                return obj.user.name;
            }));
            return next();
        }
    });
};