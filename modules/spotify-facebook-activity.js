var graph = require('fbgraph')
  , when = require('when')
  , _ = require('underscore')
  , Datastore = require('nedb');

var config = require('../config/facebook').app;

var db = new Datastore({ filename: './memory/facebook.db', autoload: true });
var listened;

function getAccessToken(fbid) {
  return when.promise(function(resolve, reject) {
    fbid += "";
    db.findOne({ 'id': fbid }, function(err, docs) {
      if(err) reject(err);
      else {
        resolve(docs.access_token);
      }
    });
  });
}

function getMusic(url) {
  return when.promise(function(resolve, reject) {
    graph.get(url, function(err, res) {
      if(err) reject(err);
      else resolve(res);
    });
  });
}

function checkMusicForToday(data) {
  return when.promise(function(resolve, reject) {
    var count = 0;
    var duration = 0;
    var now = new Date();
    now.setHours(0,0,0,0);
    _.each(data, function(obj) {
      var start_time = new Date(obj.start_time);
      var end_time = new Date(obj.end_time);
      var start_date = new Date(obj.start_time);
      start_date.setHours(0,0,0,0);
      if(start_date - now === 0) {
        count++;
        duration += end_time - start_time;
      }
    });
    resolve({ count: count, duration: duration });
  });
}

function getTodayMusic() {
  return when.promise(function(resolve, reject) {
    var result = {};
    getMusic("me/music.listens?limit=125").then(function(res) {
      result.last = res.data[0];
      return checkMusicForToday(res.data);
    }).then(function(obj) {
      if(obj.count === 125) {
        getMusic("me/music.listens?limit=125&offset=125").then(function(res) {
          checkMusicForToday(res.data).then(function(obj2) {
            obj.count += obj2.count;
            obj.duration += obj2.duration;
            result.count = obj.count;
            result.duration = obj.duration;
            resolve(result);
          })
        });
      } else {
        result.count = obj.count;
        result.duration = obj.duration;
        resolve(result);
      }
    });
  });
}

function init(fbid) {
  return when.promise(function(resolve, reject) {
    return getAccessToken(fbid)
      .then(function(access_token) {
        graph.setAccessToken(access_token);
        return;
      })
      .then(function() {
        return getTodayMusic();
      })
      .then(function(mus) {
        resolve(mus);
      });
  });
}

module.exports = function(fbid) {
  return init(fbid);
}