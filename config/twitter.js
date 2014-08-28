var keys = {
    api_key: 'xxxxx',
    api_secret: 'xxxxx',
    access_token: 'xxxxx',
    access_token_secret: 'xxxxx'
};

exports.auth = {
    consumer_key: keys.api_key,
    consumer_secret: keys.api_secret,
    access_token_key: keys.access_token,
    access_token_secret: keys.access_token_secret
};

exports.users = [
    {
        name: 'verwebbt',
        id: 54593592,
        tweets: {
            start: 8279
        }
    },
    {
        name: '_chrispop',
        id: 170442377,
        tweets: {
            start: 6004
        }
    },
    {
        name: 'zvaehn',
        id: 1081613545,
        tweets: {
            start: 1905
        }
    },
    {
        name: 'janni_kek',
        id: 1541530670,
        tweets: {
            start: 94
        }
    },
    {
        name: 'timotestetdinge',
        id: 2773066591,
        tweets: {
            start: 27
        }
    },
];

exports.config = {
    req_tweets: 150,
    since: new Date(2014, 7, 28, 0, 0, 0, 0)
};