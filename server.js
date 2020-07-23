let path = require('path');
let url = require('url');
let express = require('express');
let minimist = require('minimist');
// var ws = require('ws');
let sockets = require('./kurentoSocket');
let kurento = require('kurento-client');
let fs = require('fs');
let https = require('https');

let argv = minimist(process.argv.slice(2), {
    default: {
        as_uri: 'https://localhost:8443/',
        ws_uri: 'ws://localhost:8888/kurento'
    }
});

let options =
{
    key: fs.readFileSync('keys/server.key'),
    cert: fs.readFileSync('keys/server.crt')
};

let app = express();


let idCounter = 0;
let candidatesQueue = {};
let kurentoClient = null;
let presenter = null;
let viewers = [];
let noPresenterMessage = 'No active presenter. Try again later...';

/*
 * Server startup
 */
let asUrl = url.parse(argv.as_uri);
let port = asUrl.port;
let server = https.createServer(options, app).listen(port, () => {
    console.log('Kurento Tutorial started');
    console.log('Open ' + url.format(asUrl) + ' with a WebRTC capable browser');
});


sockets.init(server,argv);
app.use(express.static(path.join(__dirname, 'static')));
