let express = require('express');
let app = express();
let server = require('http').Server(app);
// let io = require('socket.io')(server);
// let stream = require('./ws/stream');
let sockets = require('./socket');
let path = require('path');
let favicon = require('serve-favicon');
let PORT = process.env.PORT || 5000;


app.use(favicon(path.join(__dirname, 'favicon.ico')));
app.use('/assets', express.static(path.join(__dirname, 'assets')));

app.get('/', (req, res) => {
    // res.json({ status: 1 });
    res.sendFile(__dirname + '/index.html');
});

app.get('/joinRoom/:roomId', (req, res) => {
    console.log(req.params.roomId);
    res.sendFile(__dirname + '/joinRoom.html');
});


// io.of('/stream').on('connection', stream);

server.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});

sockets.init(server);
