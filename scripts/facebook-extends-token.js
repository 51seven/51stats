var graph = require('fbgraph')
  , when = require('when')
  , Datastore = require('nedb')
  , readline = require('readline');

var db = new Datastore({ filename: '../memory/facebook.db', autoload: true });

var rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

var config = require('../config/facebook').app;

// Permissions:
// user_about_me (?)
// user_actions.music (?)
// user_activities (?)
// read_stream

function dbUpdateToken(name, access_token) {
  return when.promise(function(resolve, reject) {
    db.update(
      { name: name },
      { $set: { access_token: access_token } },
      { upsert: true },
      function(err) {
        if(err) reject(err);
        else resolve();
      }
    );
  });
}

function readInput(write) {
  return when.promise(function(resolve, reject) {
    rl.question(write, function(res) {
      resolve(res);
    });
  });
}


function extendedToken(access_token) {
  return when.promise(function(resolve, reject) {
    graph.setAccessToken(access_token);

    graph.extendAccessToken({
      'client_id': config.appId,
      'client_secret': config.appSecret
    }, function(err, res) {
      if(err) reject(err);
      else resolve(res);
    });
  });
}

var glob = {};

readInput("Name in Database: ")
  .then(function(name) {
    glob.name = name;
    return readInput("Short live-time access_token: ")
  })
  .then(function(access_token) {
    return extendedToken(access_token);
  })
  .then(function(res) {
    glob.access_token = res.access_token;
    glob.expires = res.expires;
    return dbUpdateToken(glob.name, res.access_token);
  })
  .then(function() {
    console.log('New access_token for %s created and saved in database.', glob.name);
    var days = parseFloat(glob.expires/60/60/24).toFixed(3);
    console.log('Expires in %d (that\s %s days)', glob.expires, days);
    return;
  })
  .catch(function(err) {
    console.log('Oh no, error!');
    console.log(err);
    console.log('==========');
    if(glob.access_token) {
      console.log('Generated access_token:');
      console.log(glob.access_token);
    }
  })
  .finally(function() {
    db.persistence.compactDatafile();
    process.exit(0);
  });