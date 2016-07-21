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

if (!process.env.SLACK_BOT_WEBHOOK) {
    console.log('Error: Specify slack token in .env file');
    process.exit(1);
}

if (!process.env.TMDB_API_KEY) {
    console.log('Error: Specify moviedb api key in .env file');
    process.exit(1);
}

var Botkit = require('botkit');
var os = require('os');
var request = require('request');
var moment = require('moment');

var configuration = null;
moviedb('/configuration', {}, function (res) {
    configuration = res;
});

var controller = Botkit.slackbot({
    debug: true
});

var bot = controller.spawn({
    token: process.env.SLACK_BOT_WEBHOOK
}).startRTM();

// Run a simple web server for slack commands
controller.setupWebserver(process.env.SERVER_PORT, function (err, webserver) {
    controller.createWebhookEndpoints(controller.webserver);
});

controller.on('slash_command', function (bot, message) {
    console.log(message);
    switch (message.command) {
        case '/movie':
            movieCommand(bot, message);
            break;
        case '/actor':
            actorCommand(bot, message);
            break;
        default:
            bot.replyPrivate(message, 'Your command is not allowed');
    }
});

function actorCommand(bot, message) {
    if (message.token == process.env.SLACK_ACTOR_CMD_TOKEN) {
        moviedb('/search/person', {query: message.text}, function (res) {
            console.log(res);
            if (res.results.length != 0) {
                replyActor(bot, message, res.results[0]);
            } else {
                bot.replyPrivate(message, 'No results found for “'+message.text+'”.');
            }
        });
    }
}

function movieCommand(bot, message) {
    if (message.token == process.env.SLACK_MOVIE_CMD_TOKEN) {
        var params = message.text.split(',');
        var options = {query: params[0]};
        if (params.length > 1) {
            options.year = params[1];
        }
        moviedb('/search/movie', options, function (res) {
            if (res.results.length != 0) {
                replyMovie(bot, message, res.results[0]);
            } else {
                bot.replyPrivate(message, 'No results found for “'+message.text+'”.');
            }
        });
    }
}

function moviedb(path, options, callback) {
    var api = 'https://api.themoviedb.org/3';
    options.api_key = process.env.TMDB_API_KEY;
    request({
        url: api + path,
        qs: options
    }, function (error, response, body) {
        if (!error && response.statusCode == 200) {
            callback(JSON.parse(body));
        }
    });
}

function replyActor(bot, message, actor) {
    moviedb('/person/'+actor.id, {}, function (bio) {
        var thumb = configuration.images.base_url
            + configuration.images.profile_sizes[0]
            + actor.profile_path;
        var bday = moment(bio.birthday);
        var dday = moment(bio.deathday);
        var end = bio.deathday ? dday : moment();
        var age = end.diff(bio.birthday, 'Y');
        var deceasedText = bday.format('YYYY') + ' - ' + dday.format('YYYY');
        age += bio.deathday ? (' _Deceased, ' + deceasedText + '_') : (' _Born ' + bday.format('MMM Do, YYYY') + '_');
        var reply = {
            text: 'This is what I found for “' + message.text + '”',
            attachments: [
                {
                    mrkdwn_in: ['text', 'pretext', 'fields'],
                    title: actor.name,
                    title_link: bio.homepage,
                    thumb_url: thumb,
                    text: bio.biography,
                    fields: [
                        {
                            title: 'Age',
                            value: age,
                            short: true
                        },
                        {
                            title: 'Hometown',
                            value: bio.place_of_birth,
                            short: true
                        },
                        {
                            title: 'Known For',
                            value: actor.known_for.map(function (cur) {
                                var year = moment(cur.release_date).format('YYYY');
                                return cur.original_title + ' (' + year + ')  _' + cur.vote_average + '/10_';
                            }).join('\n'),
                            short: false
                        },
                        // {
                        //     title: 'TMDB Rating',
                        //     value: info.vote_average + '/10 (' + info.vote_count + ')',
                        //     short: true
                        // }
                    ]
                }
            ]
        };
        bot.replyPublic(message, reply);
    });
}

function replyMovie(bot, message, movie) {
    moviedb('/movie/'+movie.id, {}, function (info) {
        moviedb('/movie/'+movie.id+'/credits', {}, function (credits) {
            var year = info.release_date.substring(0, 4);
            var thumb = configuration.images.base_url
                + configuration.images.poster_sizes[0]
                + info.poster_path;
            var release = moment(info.release_date).format('dddd, MMMM Do YYYY');
            bot.replyPublic(message, {
                text: 'This is what I found for “' + message.text + '”',
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
                    }
                ]
            });
        });
    });
}
