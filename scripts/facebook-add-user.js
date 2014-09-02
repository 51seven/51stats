var when = require('when')
  , Datastore = require('nedb')
  , readline = require('readline');

db = new Datastore({ filename: '../memory/facebook.db', autoload: true });

var rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function readInput(write) {
  return when.promise(function(resolve, reject) {
    rl.question(write, function(res) {
      resolve(res);
    });
  });
}

function dbInsert(name, fbid) {
  return when.promise(function(resolve, reject) {
    db.insert({ name: name, id: fbid },
      function(err, docs) {
        if(err) reject(err);
        else resolve();
      }
    );
  });
}

var glob = {};

readInput("Name in lowercase: ")
  .then(function(name) {
    glob.name = name;
    return readInput("Facebook ID: ");
  })
  .then(function(fbid) {
    glob.fbid = fbid;
    return dbInsert(glob.name, glob.fbid);
  })
  .then(function() {
    console.log('User %s with ID %d added to database.', glob.name, glob.fbid);
  })
  .catch(function(err) {
    console.log('DB Error!');
    console.log(err);
  })
  .finally(function() {
    db.persistence.compactDatafile();
    process.exit(0);
  });
