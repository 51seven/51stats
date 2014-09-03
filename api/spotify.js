var when          = require('when'),
    async         = require('async'),
    _             = require('underscore'),
    SpotifyWebApi = require('spotify-web-api-node'),
    Datastore     = require('nedb'),
    spotifyScrape = require('../modules/spotify-web-profile-scraper'),
    facebookMusic = require('../modules/spotify-facebook-activity');

var db = new Datastore({ filename: './memory/spotify.db', autoload: true });

function getCredentialsOfUser(id) {
    return when.promise(function(resolve, reject) {
        db.find({ user: id }, function(err, docs) {
            if(err) reject(err);
            resolve(docs);
        });
    });
}

function saveCredentaislOfUser(id, refreshToken) {
    return when.promise(function(resolve, reject) {
        db.update({ user: id }, { $set: { refresh_token: refreshToken } }, { upsert: true }, function(err, num) {
            if(err) reject(err);
            else resolve(num)
        });
    });
}

function checkHistoryData(userid, playlists, playlist_tracks, library, songcount, songduration) {
    return when.promise(function(resolve, reject) {
        db.findOne({ user: userid }, function(err, docs) {
            if(err) reject(err);
            else {
                var yesterday = new Date();
                yesterday.setHours(0,0,0,0);
                yesterday.setDate(yesterday.getDate() - 1);

                if(docs.history && yesterday - docs.history.yesterday.date === 0) {
                    resolve(docs.history);
                } else {
                    db.update(
                        { user: userid },
                        { $set: {
                            history: {
                                yesterday: {
                                    date: yesterday,
                                    playlist_count: playlists,
                                    playlist_tracks: playlist_tracks,
                                    library_count: library,
                                    song_count: songcount,
                                    song_duration: songduration
                                }
                            }
                        }},
                        { upsert: true}, function(err, num, docs) {
                            if (err) reject(err);
                            else resolve(
                                {
                                    yesterday: {
                                        date: yesterday,
                                        playlist_count: playlists,
                                        playlist_tracks: playlist_tracks,
                                        library_count: library,
                                        song_count: songcount,
                                        song_duration: songduration
                                    }
                                }
                            );
                        });
                }
            }
        });
    });
}

var auth = require('../config/spotify').auth,
    users = require('../config/spotify').users,
    scopes = require('../config/spotify').scopes;

var spotify = new SpotifyWebApi(auth);
//console.log(spotify.createAuthorizeURL(scopes, 'i-have-no-idea-what-i-am-doing-lol'));

// Return promise fulfilled with track data
function topTrackData(id, pos) {
    return when.promise(function(resolve, reject) {
        spotify.getTrack(id)
        .then(function(re) {
            // Yip, this notation is no wow. But sometimes it messes up and I don't know why
            // but this works, so ... yeah.
            var toptrack = {};
            toptrack.position = pos;

            toptrack.artist = {};
            toptrack.artist.id = re.artists[0].id;
            toptrack.artist.name = re.artists[0].name;

            toptrack.title = {};
            toptrack.title.id = re.id;
            toptrack.title.name = re.name;
            toptrack.title.preview = re.preview_url;

            toptrack.images = re.album.images;

            resolve(toptrack);
        }, function(err) {
            reject(err)
        });
    });
}


function getTracksInPlaylist(userid, playlistid) {
    return when.promise(function(resolve, reject) {
        spotify.getPlaylist(userid, playlistid)
        .then(function(data) {
            console.log(data.items.length);
            resolve(data.items.length);
        }, function(err) {
            console.log(err);
        });
    });
}

// WICKEEEEEEED
module.exports = function(req, res, next) {
    var result = [];

    // Yo, loop each user
    async.each(users, function(user, callback) {

        // All data for this user lives in this object
        var obj = {};

        // Scrape the data out of him
        spotifyScrape(user.id)
            .then(function(data) {
                obj.user = {
                    id: user.id,
                    name: data.name
                    //profile_img: (data.img).replace(/\t/g, '')
                };
                return data;
            })
            .then(function(data) {
                // Haz user some toptracks listed or isn't he cool?
                if(data.top_tracks[0]) {

                    // First three tracks?
                    // Combine all the promises. Promise the shit out of them.
                    var allData = when.join(
                        topTrackData(data.top_tracks[0], 1),
                        topTrackData(data.top_tracks[1], 2),
                        topTrackData(data.top_tracks[2], 3)
                    ).then(function(results) {
                        return results;
                    });

                    return allData;
                } else {
                    return false;
                }
            })
            .then(function(toptrackdata) {
                // Save toptracks in user object
                if(toptrackdata) {
                    obj.toptracks = toptrackdata;
                }
                return true;
            })
            .then(function() {
                // OAuth, yo!
                return getCredentialsOfUser(user.id);
            })
            .then(function(docs) {
                if(docs.length > 0) { // Do I know this user?
                    spotify.setRefreshToken(docs[0].refresh_token);
                    return spotify.refreshAccessToken().then(function(data) {
                        return spotify.setAccessToken(data.access_token);
                    });
                } else { // Save the user if I don't know him
                    console.log(user.code);
                    return spotify.authorizationCodeGrant(user.code).then(function(code) {
                        spotify.setAccessToken(code['access_token']);
                        spotify.setRefreshToken(code['refresh_token']);
                        return saveCredentaislOfUser(user.id, code['refresh_token']);
                    }, function(err) {
                        console.log(err);
                    });
                }
            })
            .then(function() {
                return spotify.getUserPlaylists(user.id);
            })
            .then(function(playlists) {
                return _.filter(playlists.items, function(item) {
                    // Track only non-collaborative playlists from this user
                    return (!item.collaborative && item.owner.id == user.id);
                });
            })
            .then(function(myplaylists) {
                // Summary of playlist data (count and track count)
                obj.summary = {};
                obj.summary.today = {};
                var titlecount = 0;
                _.each(myplaylists, function(item) {
                    titlecount += item.tracks.total;
                });
                obj.summary.today.playlist_count = myplaylists.length;
                obj.summary.today.playlist_tracks = titlecount;
                obj.summary.yesterday = {};
                return;
            })
            .then(function() {
                return spotify.getMySavedTracks({ limit:1 });
            })
            .then(function(saved) {
                // Summary of library data
                obj.summary.today.library_count = saved.total;
                return facebookMusic(user.fbid);
            })
            .then(function(music) {
                obj.listens = {};
                obj.listens.today = music;
                obj.listens.yesterday = {};
                return checkHistoryData(user.id, obj.summary.playlist_count, obj.summary.playlist_tracks, obj.summary.today.library_count, music.count, music.duration);
            })
            .then(function(history) {
                var yesterday = history.yesterday;
                obj.summary.yesterday.playlist_count = yesterday.playlist_count;
                obj.summary.yesterday.playlist_tracks = yesterday.playlist_tracks;
                obj.summary.yesterday.library_count = yesterday.library_count;
                obj.listens.yesterday.song_count = yesterday.song_count;
                obj.listens.yesterday.song_duration = obj.listens.today.duration - yesterday.song_duration;
                
            })
            .then(function() {
                result.push(obj);
                callback();
            })
            .catch(function(err) {
                // Callback, meh.
                callback(err);
            });
    }, function(err) {
        // HERES THE CALLBACK OF THE ASYNC CALLED SEVERAL TIMES ABOVE
        // YO
        if(err) {
            db.persistence.compactDatafile();
            return next(err);
        } else {
            res.charSet('utf-8');
            res.send(_.sortBy(result, function(obj) {
                return obj.user.name;
            }));
            db.persistence.compactDatafile();
            return next();
        }
    });
};