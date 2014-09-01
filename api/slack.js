var _         = require('underscore'),
    async     = require('async'),
    when      = require('when');

var accounts = require('../config/slack').users,
    token = require('../config/slack').token,
    Slack = require('slack-node');

// Authorize the app
var slack = new Slack(token);

/*  Gets the IDs of alle existing channels for the user and writes it into an Array.
    NOTICE: Only gets the IDs of the channels the user is member of due to the user token!
            Results may vary for a different user token. */
function getChannelIds() {
    return when.promise(function(resolve, reject, notify){
        slack.api("channels.list", function(err, response) {
            if(err) {
                console.log(err);
            }
            else {
                var channelIds = [];
        
                // Write the IDs into an array
                _.each(response.channels, function(data) {
                    channelIds.push(data.id);
                });
            resolve(channelIds);
            }
        });
    });
};

/* Gets all messages written in all channels on the present day.
   Saves the whole message objects to an array. */
function getMessagesWrittenToday(channelIds) {
    return when.promise(function(resolve, reject, notify) {
        var messagesToday = [];

        async.each(channelIds, function(data, callback) {
                console.log(data);
                slack.api("channels.history",{channel: data.toString()}, function(err, data) {
                    if(err) {
                        console.log(err);
                    }
                    else { 
                        var today         = new Date();
                        today.setHours(0,0,0,0);
                
                        _.each(data.messages, function(data) {
                            var timestamp = parseInt(data.ts);
                            var date = new Date(timestamp * 1000);
                            date.setHours(0,0,0,0);
                
                            if(today - date === 0){
                                messagesToday.push(data);
                            }
                        });
                        callback();
                    }
                });
        },function() {
            resolve(messagesToday);
        });
    });
};

/* Checks which messages was send by which user.
   Alters the accounts.messages value. */
function getMessagesPerUserPerDay(messagesToday) {
    async.each(accounts, function(data, callback) {
        var messagesCount = 0;
        _.each(messagesToday, function(messages) {
            if (messages.user === data.id){
                messagesCount++;
            }
        });
        data.messages = messagesCount;
        console.log(data.name + ': ' + data.messages);
        callback();
    }, function() {
    });
};




/* Here's the main part of the module.
   We've got the req object which contains a bunch of stuff from the request.
   We've got the res object to send a bunch of stuff back to the client.
   We've got the next function what is essential to call at the end.
   
   The Object which will be passed to the res.send is the whole object for your response.
   Think smart, structure it well. */
module.exports = function(req, res, next) {

    getChannelIds().then(function(data) {
        getMessagesWrittenToday(data).then(function(data) {
            getMessagesPerUserPerDay(data);
            res.send(accounts);
        });
    });
    return next();

};