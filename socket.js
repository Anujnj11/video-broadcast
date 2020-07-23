let sockets = {};
let rooms = {};
sockets.init = (server) => {
    // socket.io setup
    let io = require('socket.io').listen(server);
    io.of('/stream').on('connection', (socket) => {
        // io.sockets.on('connection', (socket) => {
        socket.on('teacherJoin', (data) => {
            let { room, socketId } = data;
            socket.join(room);
            socket.join(socketId);
            rooms[room] = { "teacherSocketId": data.socketId, students: [] };
            socket.to(socketId).emit('teacherJoined', { roomInfo: rooms[room] });
            //Inform other members in the room of new user's arrival
            // if (socket.adapter.rooms[data.room].length > 1) {
            //     socket.to(data.room).emit('new user', { socketId: data.socketId, userInfo: data.userInfo });
            // }
        });

        socket.on('newStudentJoined', (data) => {
            let { socketId, room } = data;
            let studentIp = socket.handshake.address;
            let studentInfo = { socketId, studentIp, room, userInfo: data.userInfo };
            socket.join(room);
            socket.join(socketId);
            rooms[room].students.push(studentInfo);
            socket.to(room).emit('newStudentJoined', studentInfo);
        });

        socket.on('startStreaming', (data) => {
            let { room, socketId } = data;
            socket.in(room).emit('startedStreaming', { socketId, room });
        });

        socket.on('streamBuffer', (data) => {
            let { room, socketId, streamBuffer } = data;
            socket.to(room).emit('streamBuffered', { socketId, room, streamBuffer });
        });


        // socket.on('sdp', (data) => {
        //     socket.to(data.to).emit('sdp', { description: data.description, sender: data.sender });
        // });


        // socket.on('ice candidates', (data) => {
        //     socket.to(data.to).emit('ice candidates', { candidate: data.candidate, sender: data.sender });
        // });


        // socket.on('chat', (data) => {
        //     socket.to(data.room).emit('chat', { sender: data.sender, msg: data.msg });
        // });

        // socket.on('toggleMediaDevice', (data) => {
        //     let { isAudio, isVideo } = data;
        //     socket.to(data.room).emit('teacherToggleMediaDevice', { isAudio, isVideo });
        // });

        // socket.on('teacherInfo', (data) => {
        //     socket.to(data.room).emit('teacherInfo', { socketId: data.socketId, userInfo: data.userInfo });
        // });

    });

}

module.exports = sockets;