/*~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
           ______     ______     ______   __  __     __     ______
          /\  == \   /\  __ \   /\__  _\ /\ \/ /    /\ \   /\__  _\
          \ \  __<   \ \ \/\ \  \/_/\ \/ \ \  _"-.  \ \ \  \/_/\ \/
           \ \_____\  \ \_____\    \ \_\  \ \_\ \_\  \ \_\    \ \_\
            \/_____/   \/_____/     \/_/   \/_/\/_/   \/_/     \/_/


This is a sample Slack bot built with Botkit.

This bot demonstrates many of the core features of Botkit:

* Connect to Slack using the real time API
* Receive messages based on "spoken" patterns
* Reply to messages
* Use the conversation system to ask questions
* Use the built in storage system to store and retrieve information
  for a user.

# RUN THE BOT:

  Get a Bot token from Slack:

    -> http://my.slack.com/services/new/bot

  Run your bot from the command line:

    SLACK_TOKEN=<MY TOKEN> node slack_bot.js

~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~*/

require('dotenv').config();

if (!process.env.SLACK_TOKEN) {
    console.log('Error: Specify slack token in .env file');
    process.exit(1);
}

if (!process.env.MOVIEDB_API_KEY) {
    console.log('Error: Specify moviedb api key in .env file');
    process.exit(1);
}

var Botkit = require('botkit');
var os = require('os');
var request = require('request');
var dateFormat = require('dateFormat');

var configuration = null;
moviedb('/configuration', {}, function (res) {
    configuration = res;
});

var controller = Botkit.slackbot({
    debug: true
});

var bot = controller.spawn({
    token: process.env.SLACK_TOKEN
}).startRTM();

controller.hears(['[“"](.*?)[”"]'], 'direct_message,direct_mention,mention', function (bot, message) {
    var search = message.match[1];
    imdb(bot, message, search);
});

controller.hears(['(.*)'], 'direct_message,direct_mention,mention', function (bot, message) {
    var search = message.match[1];
    imdb(bot, message, search);
});

function moviedb(path, options, callback) {
    var api = 'https://api.themoviedb.org/3';
    options.api_key = process.env.MOVIEDB_API_KEY;
    request({
        url: api + path,
        qs: options
    }, function (error, response, body) {
        if (!error && response.statusCode == 200) {
            callback(JSON.parse(body));
        }
    });
}

function imdb(bot, message, search) {
    // var URL = 'http://www.imdb.com/xml/find?json=1&nr=1&q='+encodeURIComponent(search);
    // http.request(URL, function (response) {
    //     var str = '';
    //     response.on('data', function (chunk) {
    //         str += chunk;
    //     });
    //     response.on('end', function () {
    //         var results = JSON.parse(str);
    //         var popular = results.title_popular[0];
    //         var id = popular.id;
    //         var type = id.substring(0, 2);
    //
    //         if (type == 'tt') {
    //             replyMovie(bot, message, id, search);
    //         } else if (type == 'nm') {
    //             replyActor(bot, message, id, search);
    //         }
    //     });
    // }).end();

    moviedb('/search/multi', {query: search}, function (res) {
        if (res.results.length != 0) {
            var result = res.results[0];
            if (result.media_type == 'movie') {
                replyMovie(bot, message, search, result);
            } else if (result.media_type == 'person') {
                replyPerson(bot, message, search, result);
            } else if (result.media_type == 'tv') {
                //
            }
        }
    });
}

function replyMovie(bot, message, search, movie) {

    moviedb('/movie/'+movie.id, {}, function (info) {
        moviedb('/movie/'+movie.id+'/credits', {}, function (credits) {
            var year = info.release_date.substring(0, 4);
            var thumb = configuration.images.base_url
                + configuration.images.poster_sizes[0]
                + info.poster_path;
            var release = dateFormat(info.release_date, 'fullDate');
            bot.reply(message, {
                response_type: 'ephemeral',
                text: 'This is what I found for “' + search + '”',
                attachments: [
                    {
                        title: info.original_title + ' (' + year + ')',
                        title_link: 'http://www.imdb.com/title/'+info.imdb_id,
                        thumb_url: thumb,
                        text: info.overview,
                        fields: [
                            {
                                title: 'Released',
                                value: release,
                                short: true
                            },
                            {
                                title: 'Runtime',
                                value: (info.runtime) + ' min',
                                short: true
                            },
                            {
                                title: 'Cast',
                                value: credits.cast.slice(0, 4).map(function (cur) {
                                    return cur.name;
                                }).join(', '),
                                short: true
                            },
                            {
                                title: 'TMDB Rating',
                                value: info.vote_average + '/10 (' + info.vote_count + ')',
                                short: true
                            }
                        ]
                    },
                    {
                        title: 'Do you want to interact with my buttons?',
                        callback_id: '123',
                        attachment_type: 'default',
                        actions: [
                            {
                                "name":"yes",
                                "text": "Yes",
                                "value": "yes",
                                "type": "button",
                            },
                            {
                                "name":"no",
                                "text": "No",
                                "value": "no",
                                "type": "button",
                            }
                        ]
                    }
                ]
            });
        });
    });

    // http.request('http://app.imdb.com/title/maindetails?tconst='+id, function (response) {
    //     var str = '';
    //     response.on('data', function (chunk) {
    //         str += chunk;
    //     });
    //     response.on('end', function () {
    //         var data = JSON.parse(str).data;
    //
    //         var thumb = data.image.url.replace('.jpg', 'UX182_CR0,0,75,75.jpg');
    //
    //
    //     });
    // }).end();
}

function replyPerson(bot, message, search, person) {

}

controller.hears(['shutdown'], 'direct_message,direct_mention,mention', function(bot, message) {

    bot.startConversation(message, function(err, convo) {

        convo.ask('Are you sure you want me to shutdown?', [
            {
                pattern: bot.utterances.yes,
                callback: function(response, convo) {
                    convo.say('Bye!');
                    convo.next();
                    setTimeout(function() {
                        process.exit();
                    }, 3000);
                }
            },
        {
            pattern: bot.utterances.no,
            default: true,
            callback: function(response, convo) {
                convo.say('*Phew!*');
                convo.next();
            }
        }
        ]);
    });
});


controller.hears(['uptime', 'identify yourself', 'who are you', 'what is your name'],
    'direct_message,direct_mention,mention', function(bot, message) {

        var hostname = os.hostname();
        var uptime = formatUptime(process.uptime());

        bot.reply(message,
            ':robot_face: I am a bot named <@' + bot.identity.name +
             '>. I have been running for ' + uptime + ' on ' + hostname + '.');

    });

function formatUptime(uptime) {
    var unit = 'second';
    if (uptime > 60) {
        uptime = uptime / 60;
        unit = 'minute';
    }
    if (uptime > 60) {
        uptime = uptime / 60;
        unit = 'hour';
    }
    if (uptime != 1) {
        unit = unit + 's';
    }

    uptime = uptime + ' ' + unit;
    return uptime;
}
