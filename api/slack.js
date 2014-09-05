var _         = require('underscore'),
    async     = require('async'),
    when      = require('when');

var accounts     = require('../config/slack').users,
    token        = require('../config/slack').token,
    Slack        = require('slack-node'),
    customEmojis = [];

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

/* Returns the favorite (speak: most frequently used) emoji of a user. */
function getFavoriteEmoji(emojisUsed) {
    return when.promise(function(resolve, reject, notify) {
        var emojiFrequency = {},
            maxValue = 0,
            maxKey   = null;


        //console.log(typeof emojisUsed);
        // Remove the custom emojis from the list.
        // Not everyone outside needs to see them.
        var cleanEmojis = _.difference(emojisUsed,customEmojis);

        // Check if the given emoji has already bee noted in the emojiFrequency Object.
        _.each(cleanEmojis, function(emoji) {

            //console.log('Current emoji checked: ' + emoji);
            // If so, just increase the count by one.
            if(emoji in emojiFrequency) {
                var oldFreq = emojiFrequency[emoji];
                emojiFrequency[emoji] = ++oldFreq;
            }
            // Else, make an entry in the object for the emoji
            else {
                emojiFrequency[emoji] = 1;
            }
        }); 

        // Find the most frequently used emoji in emojiFrequency
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
                        var tempEmojis = messages.text.match(/:([\w]+?):/g);
                        var plainEmojis = _.map(tempEmojis, function(emoji) {
                            return emoji.replace(/:/g, '');
                        });
                        _.each(plainEmojis, function(emoji) {
                            emojisUsed.push(emoji);
                        });
                        
                        emojiCount++;
                    }
                    
                }
            });
    

            getFavoriteEmoji(emojisUsed).then(function(data) {
                            favoriteEmoji = data;

                            // Write the counts in the returned object
                            accountsData.favoriteEmoji   = favoriteEmoji;
                            accountsData.messages        = messagesCount;
                            accountsData.chars           = charCount;
                            accountsData.charsPerMessage = parseInt(charCount/messagesCount);
                            accountsData.links           = linkCount;
                            accountsData.videos          = videoCount;
                            accountsData.emojisUsed      = emojiCount;
                    
                            callback();
            });
    
            
            }, function() {
                // This is a little tricky.
                // The resolve in here makes sure, that all users from config/slack.js have been treated before it
                // hands over the accounts to the res.send()
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

    // Has to be called before the main function because it makes an API-Call
    getCustomEmojis().then(function(data) {
        customEmojis = data;
    });

    // This is the main part.
    // Gets all channels first
    getChannelIds().then(function(data) {
        // Then, from these channels, gets all the messages
        getMessagesWrittenToday(data).then(function(data) {
            // Then, from the messages, gets all the required data
            getMessagesPerUserPerDay(data).then(function(data) {
                // Finally send out the result
                res.send(data);  
            })
            
        });
    });

    // I have no idea what this is, but Timo will seriously hurt me if I delete it. Please help me!
    return next();

};