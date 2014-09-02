// Little pipi kaka explanation
// Basic Wrapper


// npm install nodemon -g
// Anstatt mit 'node index' kann man die App ebenfalls mit 'nodemon index' starten,
// was den Server bei Änderungen an Dateien neu startet.

// node index no-socket // nodemon index no-socket
// Startet den Server ohne die socket.io anbindung an den Twitter-Stream.
// Der buggt ein bisschen rum und kann den Server zum Absturz bringen, was suckt.

// fs = filesystem, included in node
var fs = require('fs'),
    when = require('when'); // when = library for promises, via npm install

// Nützliche weitere packages:
// - underscore oder lodash -> Package mit nützlichen Funktionen
// - async -> Package um Funktionen asynchron ausführen zu können
//            Beispielsweise auch ein each-loop nacheinander ausführen,
//            da in Node selbst das synchron ausgeführt wird.


// Helper Function / Wrapper for fs.readFile, returns a promise
// Was ist ein Promise?
// Kurz abstrakt formuliert: Ein Promise ist eine Funktion mit mehreren Methoden, um Befehle nacheinander ausführen zu können.
// Eine Methode ist unter anderem then(). then() wird ausgeführt, wenn im Promise resolve() ausgegeben wird.
// Eine weitere Methode ist catch(), was dann ausgeführt wird, wenn im Promise reject() ausgegeben wird.
// Im resolve() und reject() können Parameter übergegeben werden, die von then() bzw. catch() aufgegriffen werden können.
function myReadFile(file) {
  return when.promise(function(resolve, reject) {
    fs.readFile(file, function(err, data) {
      if (err) reject(err);
      else resolve(data);
    });
  });
}

// module.exports ist die Function, die "ausgeführt" wird, wenn an einer anderen Stelle die Datei mit require() eingebunden wird.
// Im restify Server hat diese Funktion die Parameter req (request), res (response) und next.
// In req stehen informationen über den Request.
// res beinhaltet Methoden um den Response auszuführen
// next muss nicht zwingend angegeben werden, ist aber nützlich (und empfohlen), damit restify nach senden des Responses weitere Dinge ausführen kann.
// (Senden des Response bedeutet nicht zwingend, dass das Skript damit beendet wird)
module.exports = function(req, res, next) {

  myReadFile('./package.json')
  .then(function(data) { // then ist verfügbar, da myReadFile einen Promise ausgibt
    return JSON.parse(data);
  })
  .then(function(data) { // then's sind verkettbar und können durch ein return im vorigen then weitergegeben werden
    var obj = [];        // data entspricht hier dem JSON.parse(data) aus dem vorigen Then
    obj.push({ name: data.name }); // REST APIs geben immer JSON Daten zurück. JSON = JavaScript Object Notation, also das ganze schön als Objekt formatieren
    obj.push({ name: data.main });
    res.send(obj); // Response senden
  })
  .catch(function(err) { // catch fängt alle Fehler ab
    return next(err); // ein error, dem man dem next() übergibt, kann von restify behandelt und ausgegeben werden.
  });
}