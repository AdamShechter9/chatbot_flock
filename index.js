'use strict';

var fs = require('fs');
var dbFile = 'db.json';
var configD = require('./configDict.js');
var flock = require('flockos');
var express = require('express');
var unirest = require('unirest');

// *********************************************
var db = {
    users: {}
}

var readDatabase = function () {
    try {
        var stringText = fs.readFileSync(dbFile);
        db = JSON.parse(stringText);
    } catch (e) {
        console.log('No db found.creating %s', dbFile);
    }
}

var saveDatabase = function () {
    console.log('Saving db');
    var stringText = JSON.stringify(db);
    fs.writeFileSync(dbFile, stringText);
}

readDatabase();
process.on('SIGINT', function () { console.log('SIGINT'); process.exit(); });
process.on('SIGTERM', function () { console.log('SIGTERM'); process.exit(); });
process.on('exit', saveDatabase);


var getToken = function (userId) {
    return db.users[userId];
};

var saveToken = function (userId, token) {
    db.users[userId] = token;
};

// *********************************************

flock.appId = configD.appId;
flock.appSecret = configD.appSecret;

var app = express();
app.use(flock.events.tokenVerifier);
app.post('/dict/events', flock.events.listener);
app.post('/trans/events', flock.events.listener);

app.listen(8080, function () {
    console.log('Listening.  Port 8080')
});

flock.events.on('app.install', function(event, callback) {
    console.log("app install event", event);
    saveToken(event.userId, event.token);
    callback();
});

flock.events.on('client.slashCommand', function (event, callback) {
    console.log(event);
    if (event.command == 'dictionary') {
        if (event.text) {
            console.log("Received this: ", event.text);
            callback(null, {"text": ""});
            lookupDefinition(event.userId, event.text);
        } else {
            flock.chat.sendMessage(configD.botToken, {
                "to": event.userId,
                "text": "Hello.  I'm a language assistant. How may I help you?"
            });
            setTimeout(function() {
                flock.chat.sendMessage(configD.botToken, {
                    "to": event.userId,
                    "text": "Use /dictionary <word> for definitions.  Type anything here, and I will translate it for you."
                });
            }, 1000);

        }
    }
});

flock.events.on('chat.receiveMessage', function (event, callback) {
    console.log("got a chat message!", event);
    lookupTranslation(event.message.from, event.message.text);
    callback(null, {"text": ""});
});

var lookupDefinition = function (userId, myword) {
    console.log("in lookupDefinition ", userId, myword);
    sendAPIGetRequest(userId,myword);
};

var lookupTranslation = function (userId, phrase) {
    console.log("in lookupTranslation", userId, phrase);
    sendAPITransGetRequest(userId, phrase);
}

var sendMessage = function(userId, myresult) {
    console.log("in sendMessage ", userId, myresult);
    // Test that response is valid here.

    //
    var attachments = [];
    var myword = myresult.word;
    flock.chat.sendMessage(configD.botToken, {
        "to": userId,
        "text": "definition: "+myword,
    });
    setTimeout(function() {
        for (let i of myresult.definitions){
            console.log(i);
            let attachment = {
                "title": myword,
                "views": {
                    "flockml": "<flockml><em>"+i.partOfSpeech+"</em> "+i.definition+"</flockml>"
                }
            }
            flock.chat.sendMessage(configD.botToken, {
                "to": userId,
                "attachments": [attachment]
            });
        }
    }, 500);

};

var sendAPIGetRequest = function(userId, myword) {
    var url = "https://wordsapiv1.p.mashape.com/words/" + myword + "/definitions";
    console.log("search url: ",url)
    unirest.get(url)
    .header("X-Mashape-Key", "************************************************")
    .header("Accept", "application/json")
    .end(function (result) {
      console.log(result.status, result.headers, result.body);
      if (result.status==200){
          sendMessage(userId, result.body);
      } else {
          flock.chat.sendMessage(configD.botToken, {
              "to": userId,
              "text": "'"+myword+"' Error.  Unknown word, or bad input."
          });
      }
    });
};


var sendAPITransGetRequest = function (userId, phrase) {
    var APIKEY = "********************************************************************************";
    var url = "https://translate.yandex.net/api/v1.5/tr.json/translate?lang=en&key="+APIKEY+"&text="+phrase;
    console.log("translate url: ",url)
    unirest.get(url)
    .end(function (result) {
      console.log(result.status, result.headers, result.body);
      if (result.status==200){
          flock.chat.sendMessage(configD.botToken, {
              "to": userId,
              "text": "language: "+ result.body.lang
          });
          setTimeout(function() {
              flock.chat.sendMessage(configD.botToken, {
                  "to": userId,
                  "text": result.body.text[0]
              });
              flock.chat.sendMessage(configD.botToken, {
                  "to": userId,
                  "text": "Powered by Yandex.Translate"
              });
          }, 100);

      } else {
          flock.chat.sendMessage(configD.botToken, {
              "to": userId,
              "text": "Failure."
          });
      }
    });
};
// https://translate.yandex.net/api/v1.5/tr.json/getLangs ?
// key=<API key>
//  & [ui=<language code>]
//  & [callback=<name of the callback function>]
