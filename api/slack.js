var _         = require('underscore'),
    async     = require('async'),
    when      = require('when');

var accounts     = require('../config/slack').users,
    token        = require('../config/slack').token,
    Slack        = require('slack-node'),
    customEmojis = [],
    returnData   = [];

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


/*  Returns an array of custom emojis used in the team */
function getCustomEmojis() {
    var emojiArray = [];
    return when.promise(function(resolve, reject, notify) {
        slack.api("emoji.list", function(err, data) {
            if(err) {
                console.log(err);
            }
            else {
                for(var key in data.emoji) {
                    emojiArray.push(key);
                }
                resolve(emojiArray);
            }
        });
    });
};

function getFavoriteEmoji(emojisUsed) {
    return when.promise(function(resolve, reject, notify) {
        var emojiFrequency = {},
            maxValue = 0,
            maxKey   = null;

        var cleanEmojis = _.difference(emojisUsed,customEmojis);

        _.each(cleanEmojis, function(emoji) {
            if(emoji in emojiFrequency) {
                var oldFreq = emojiFrequency[emoji];
                emojiFrequency[emoji] = ++oldFreq;
            }
            else {
                emojiFrequency[emoji] = 1;
            }
        }); 

        for(key in emojiFrequency) {
            if(emojiFrequency[key] > maxValue) {
                maxValue = emojiFrequency[key];
                maxKey = key;
            }
        }
        
        resolve(maxKey);
    });
};

/* Checks which messages was send by which user.
   Alters the accounts.messages value. */
function getMessagesPerUserPerDay(messagesToday) {
    return when.promise(function(resolve, reject, notify) {
    async.each(accounts, function(accountsData, callback) {
        
        // Some variables to count with
        var messagesCount = 0,
            charCount     = 0,
            linkCount     = 0,
            videoCount    = 0,
            emojiCount    = 0,
            emojisUsed    = [],
            favoriteEmoji = null;

        _.each(messagesToday, function(messages) {
            
            // Count messages and chars
            if (messages.user === accountsData.id){
                messagesCount++;
                var chars = messages.text.length;

                // Check if the message contains one or more links.
                if(messages.text.match(/<http(.*?)>/g)) {
                    // Get AAAAALLL the links
                    var links       = messages.text.match(/<http(.*?)>/g),
                        linksLength = 0;

                    // Check if there is more than one Link in a message
                    if(links.length > 1) {
                        // Keep track of how many links were sent
                        linkCount += links.length;

                        // If so, add the Langth up for the links
                        _.each(links, function(singleLink) {
                            linksLength += String(singleLink).length; 
                            console.log(singleLink);
                        }); 
                        chars -= linksLength;
                    }
                    else {
                        linkCount++;
                        linksLength = String(links[0]).length;
                        chars -= linksLength;
                    }
                }
                charCount += chars;

                // Count YouTube attachments
                if(messages.attachments) {
                    // Only checks for YT. Possibility to check for other services in the future.
                    if(messages.attachments[0].service_name === 'YouTube') {
                        videoCount++;
                    }
                }

                // Emoji-thingy, still dev
                if(messages.text.match(/:([\w]+?):/g)) {
                    emojisUsed.push((String(messages.text.match(/:([\w]+?):/g)).replace(/:/g, '')));
                    emojiCount++;
                }

                

            }
        });

        getFavoriteEmoji(emojisUsed).then(function(data) {
                        favoriteEmoji = data;
                        console.log(favoriteEmoji); // DEBUG
                        accountsData.favoriteEmoji   = favoriteEmoji;
                        // Write the counts in the returned object
                        accountsData.messages        = messagesCount;
                        accountsData.chars           = charCount;
                        accountsData.charsPerMessage = parseInt(charCount/messagesCount);
                        accountsData.links           = linkCount;
                        accountsData.videos          = videoCount;
                        accountsData.emojisUsed      = emojiCount;

                                              
                
                        //console.log(accountsData.name + ': ' + accountsData.messages); // DEBUG
                        //console.log('All emojis used: ' + emojisUsed); // DEBUG
                
                        callback();
        });

        
    }, function() {
        // Nothing to do here, but I think async needs this work properly.
        resolve(accounts);
    });
})

};




/* Here's the main part of the module.
   We've got the req object which contains a bunch of stuff from the request.
   We've got the res object to send a bunch of stuff back to the client.
   We've got the next function what is essential to call at the end.
   
   The Object which will be passed to the res.send is the whole object for your response.
   Think smart, structure it well. */
module.exports = function(req, res, next) {

    getCustomEmojis().then(function(data) {
                    customEmojis = data;
                    console.log(data); // DEBUG
                });

    getChannelIds().then(function(data) {
        getMessagesWrittenToday(data).then(function(data) {
            getMessagesPerUserPerDay(data).then(function(data) {
                res.send(data);  
            })
            
        });
    });
    return next();

};