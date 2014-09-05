var when          = require('when')
  , async         = require('async')
  , _             = require('underscore')
  , SpotifyWebApi = require('spotify-web-api-node')
  , Datastore     = require('nedb')
  , spotifyScrape = require('../modules/spotify-web-profile-scraper')
  , facebookMusic = require('../modules/spotify-facebook-activity');

var db = new Datastore({ filename: './memory/spotify.db', autoload: true });

var auth = require('../config/spotify').auth
  , users = require('../config/spotify').users
  , scopes = require('../config/spotify').scopes;

var spotify = new SpotifyWebApi(auth);

// Uncomment next line for echoing Authorize URL
// console.log(spotify.createAuthorizeURL(scopes, 'i-have-no-idea-what-i-am-doing-lol'));


// This script should run at leastsomewhen before midnight
// for best stat quality


// Main program structure should be something like this
// 
// #1: Get user doc
// #2: Fetch all data from APIs
//     Includes generating access_token and safe refresh_token
// #3: Check if today from doc is really today
//     ->  no: set today to yesterday
//     -> yes: go on
// #4: Update today's data
// #5: Get refreshed data
//     to avoid a db.findOne() one does simply
//     carry the doc from #1 around and change it


// API response should be something like this
// {
//   user
//     id (-> Spotify ID)
//     name
//     picture (idk, there's just the facebook picture, if the user is connected with facebook)
//   top_tracks
//     [
//       top_position
//       (sort of a spotify track object)
//     ]
//   stats
//     [
//       date
//       playlist_count
//       playlist_track_count
//       library_track_count
//       listening_count
//       listening_duration
//     ]
//   listening_to
//     (sort of a spotify track object)
// }

/**
 * Gets the doc for one user by its ID
 *
 * @param {Integer} userid Users Spotify ID
 * @fulfill {<Object, null>} user data from database or null if not found
 * @reject {DatabaseError} Connection error
 */
function getUserFromDB(userid) {
  return when.promise(function(resolve, reject) {
    db.findOne({ user: userid }, function(err, docs) {
          if(err) reject(err);
          if(!docs) resolve(null);
          else resolve(docs);
      });
  });
}

/**
 * Saves refresh_token in database
 * 
 * @param  {Integer} userid Users Spotify ID
 * @param  {string} refreshToken new created refresh_token of user
 * 
 * @fulfill {<empty, Object>} empty if user already exists or user data from database if (s)he's new
 * @reject {DatabaseError} Connection error
 * @returns {Promise}
 */
function saveCredentaislOfUser(userid, refreshToken) {
  return when.promise(function(resolve, reject) {
    db.update({ user: userid }, { $set: { refresh_token: refreshToken } }, { upsert: true }, function(err, num, newDoc) {
      if(err) reject(err);
      else resolve(newDoc);
    });
  });
}

/**
 * Updates the stats->yesterday object to a new given object
 * 
 * @param  {Integer} userid Users Spotify ID
 * @param  {Object} oldtoday Updated object
 *
 * @fulfill {empty}
 * @reject {DatabaseError} Connection error
 * @returns {Promise}
 */
function changeTodayToYesterday(userid, oldtoday) {
  return when.promise(function(resolve, reject) {
    db.update(
      { user: userid },
      { $set: { 'stats.yesterday': oldtoday } },
      { upsert: true },
      function(err) {
        if(err) reject(err);
        else resolve();
      }
    );
  });
}

/**
 * Updates the stats->today object to a new given object
 * 
 * @param  {Integer} userid Users Spotify ID
 * @param  {Object} newtoday Updated object
 *
 * @fulfill {empty}
 * @reject {DatabaseError} Connection error
 * @returns {Promise}
 */
function setToday(userid, newtoday) {
  return when.promise(function(resolve, reject) {
    db.update(
      { user: userid },
      { $set: { 'stats.today': newtoday } },
      { upsert: true },
      function(err) {
        if(err) reject(err);
        else resolve();
      }
    );
  });
}

/**
 * Gets track data of multiple tracks from Spotify
 * 
 * @param  {Array} tracks Array of track ids
 *
 * @fulfill {Object} Spotify Response Object {@link https://developer.spotify.com/web-api/object-model/#track-object-full}
 * @reject {APIError} Spotify API Error
 */
function multipleTracksData(track_ids) {
  return when.promise(function(resolve, reject) {
    spotify.getTracks(track_ids).then(function(res) {
      resolve(res);
    }, function(err) {
      reject(err);
    });
  });
}

/**
 * Refresh and set access_token
 *
 * @fulfill {null}
 * 
 * @returns {Promise}
 */
function newAccessToken() {
  return when.promise(function(resolve, reject) {
    spotify.refreshAccessToken().then(function(token_data) {
      return spotify.setAccessToken(token_data.access_token);
    }).then(function() {
        resolve(null);
    });
  });
}

/**
 * Auth user with code grant, sets access_token and refresh_token,
 * saved refresh_token in database
 * 
 * @param  {Integer} userid Users Spotify ID
 * @param {String} user_code code grant from user.config
 *
 * @return {Promise}
 */
function AuthUserAndSave(userid, user_code) {
  return spotify.authorizationCodeGrant(user_code).then(function(code) {
    spotify.setAccessToken(code['access_token']);
    spotify.setRefreshToken(code['refresh_token']);
    return saveCredentaislOfUser(userid, code['refresh_token']);
  }, function(err) {
    throw new Error(err);
  });
}


module.exports = function(req, res, next) {
  // This array will be filled in the following async.each with the response for every user
  // and then send to the response
  var result = [];

  // Loop each user from config through whole API fetch / DB update process
  async.each(users, function(user, callback) {
    var user_obj = {}; // The pushed object to result
    var user_doc; // The user doc from database
                  // (will be modified in this process to safe a last db request)

    getUserFromDB(user.id).then(function(doc) {
      if(doc !== null) { // This user has already data in the database

        // Set returned doc to user_doc
        // This new obj will be modified until the end
        // to save a last db request
        user_doc = _.clone(doc);

        // set refresh token to generate new access token
        spotify.setRefreshToken(doc.refresh_token);


        // Generate and set new access_token
        return newAccessToken();
      }
      else {
        // Create new User, auth and grant with code, save refresh token in the database
        return AuthUserAndSave(user.id, user.code);
      }
    }).then(function(doc) {
      // doc will be the new user object if a new user was created
      if(doc) user_doc = _.clone(doc);
      return;
    }).then(function() {

      //
      // AT THIS POINT A USER WILL BE AUTHORIZED AND WILL HAVE A REFRESH_TOKEN IN HIS DOC.
      // API CALLS BEGIN HERE
      //
      
      // Start with scraping favorite tracks from https://open.spotify.com/[user]
      return spotifyScrape(user.id);
    }).then(function(scrape_data) {
      user_obj.user = {};
      user_obj.user.name = scrape_data.name;

      // TODO: missing user keys

      var top_tracks = scrape_data.top_tracks;
      if(top_tracks.length === 0) return null;

      // Only first 3 Elements are interesting
      var first_tracks = top_tracks.slice(0, 3);
      return multipleTracksData(first_tracks);
    }).then(function(top_tracks_data) {
      // Add top_position key to Spotify Object
      if(top_tracks_data !== null) {
        // TODO: This does not work
        _.each(top_tracks_data.tracks, function(it, i) {
          delete it.available_markets;
          delete it.album.available_markets;
          return it;
        });

        // TODO: Thin out spotify response object (eg. available_markets array)
        user_obj.top_tracks = top_tracks_data.tracks;
      }

      // Next: get user Playlists
      return spotify.getUserPlaylists(user.id);
    }).then(function(playlists) {
      var today = new Date();
      today.setHours(0,0,0,0);

      user_obj.stats = {};
      user_obj.stats.today = {};
      user_obj.stats.today.date = today;
      
      var filtered_playlist = _.filter(playlists.items, function(item) {
        // Track only non-collaborative playlists from this user
        return (!item.collaborative && item.owner.id == user.id);
      });

      var track_count = 0;
      _.each(filtered_playlist, function(item) {
        track_count += item.tracks.total;
      });

      user_obj.stats.today.playlist_count = filtered_playlist.length;
      user_obj.stats.today.playlist_track_count = track_count;

      // Next: get user Library
      // we only need to return one track since the response contains
      // informations about how many tracks there are in the library
      return spotify.getMySavedTracks({ limit:1 });
    }).then(function(library) {
      user_obj.stats.today.library_track_count = library.total;

      // Next: get count and duration of tracks user listened to today
      return facebookMusic(user.fbid);
    }).then(function(listened_to) {
      var now = new Date();
      user_obj.stats.today.listening_count = listened_to.count;
      user_obj.stats.today.listening_duration = listened_to.duration;

      // object 'last' contains informations about the last played song
      // if start_time and end_time (returned from facebook api) is between
      // now (+45 seconds to catch up mostly all publish delays), it will show
      // that the user is currently hearing a song
      var start_time = new Date(listened_to.last.start_time);
      var end_time = new Date(listened_to.last.end_time);
      end_time.setSeconds(end_time.getSeconds() + 45);

      if(now > start_time && now < end_time) {
        console.log('user listens');
        var track = listened_to.last.data.song.url.split('/');
        var track_id = track[track.length - 1];
        return spotify.getTrack(track_id);
      }
      else {
        return null;
      }
    }).then(function(track_result) {
      if(track_result === null) return;
      else {
        delete track_result.available_markets;
        delete track_result.album.available_markets;
        user_obj.listening_to = track_result;
        return;
      }
    }).then(function() {

      //
      // AT THIS POINT WE HAVE COLLECTED ALL THE STATS FROM TODAY.
      // NOW WE NEED TO CHECK IF 'TODAY' IN DATABASE IS REALLY TODAY
      // 
      
      if(!user_doc.stats) {
        return;
      }

      if(user_doc.stats.today && (user_doc.stats.today.date - user_obj.stats.today.date) === 0) {
        // Doc's 'today' have the same date as today
        return;
      }
      else {
        // We need to archive 'today' and set it as 'yesterday'
        return changeTodayToYesterday(user.id, user_doc.stats.today).then(function() {
          user_obj.stats.yesterday = user_doc.stats.today;
        });
      }
    }).then(function() {
      //
      // AT THIS POINT WE HAVE THE CORRECT 'yesterday' IN THE DB.
      // WE CAN UPDATE 'today' NOW
      // 
      user_obj.stats.yesterday = user_doc.stats.yesterday;
      return setToday(user.id, user_obj.stats.today);
    }).then(function() {
      //
      // AT THIS POINT WE HAVE THE CORRECT 'today' IN THE DB.
      // WE CAN RETURN THIS
      // 

      result.push(user_obj);
      callback();
    })
    .catch(function(err) {
        // async's callback flavoured with an error
        callback(err);
    });
  }, function(err) { // CALLBACK OF ASYNC.EACH
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