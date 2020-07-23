let kurento = require('kurento-client');
const { json } = require('body-parser');
const { priorityQueue } = require('async');
let sockets = {};
let rooms = {};
let kurentoClient;
let argv;
let candidatesQueue = {};
let viewers = [];

sockets.init = (server, arg) => {
    // socket.io setup
    argv = arg;
    let io = require('socket.io').listen(server);
    io.of('/stream').on('connection', (socket) => {


        // socket.on('error', function (error) {
        //     console.log('Connection ' + sessionId + ' error');
        //     stopStreaming(sessionId);
        // });

        // socket.on('close', function () {
        //     console.log('Connection ' + sessionId + ' closed');
        //     stopStreaming(sessionId);
        // });


        socket.on('message', (_message) => {
            let message = JSON.parse(_message);
            let eventName = message.id;
            let sessionId = message.socketId;
            let roomId = message.roomId;
            console.log('Connection ' + sessionId + ' received message ', message);
            switch (eventName) {
                case 'presenter':
                    presenterFlow(roomId, sessionId, socket, message.sdpOffer);
                    break;
                case 'viewer':
                    viwerFlow(roomId, sessionId, socket, message.sdpOffer);
                    break;
                case 'onIceCandidate':
                    onIceCandidate(roomId, sessionId, message.candidate);
                    break;
                case 'stop':
                    stopStreaming(roomId, sessionId, socket);
                    break;
                default:
                    let data = JSON.stringify({ id: 'error', message: `Invalid message  ${message}`, roomId });
                    socket.emit("onmessage", data);
                    break;
            };
        });
    });

}


let getKurentoClient = () => {
    return Promise.resolve()
        .then(() => {
            return kurentoClient ? kurentoClient : kurento(argv.ws_uri)
        })
        .then((_kurentoClient) => {
            kurentoClient = kurentoClient ? kurentoClient : _kurentoClient;
            return kurentoClient;
        })
        .catch((err) => {
            return Promise.reject(err);
        });
}


let presenterFlow = (roomId, sessionId, socket, sdpOffer) => {
    return Promise.resolve()
        .then(() => {
            return startPresenter(roomId, sessionId, socket, sdpOffer);
        })
        .then((sdpAnswer) => {
            let data = JSON.stringify({ id: 'presenterResponse', response: 'accepted', sdpAnswer, roomId });
            socket.emit('onmessage', data);
        })
        .catch((err) => {
            console.log(err);
            let data = JSON.stringify({ id: 'presenterResponse', response: 'rejected', message: err, roomId });
            socket.emit('onmessage', data);
        });
}

let viwerFlow = (roomId, sessionId, socket, sdpOffer) => {
    return Promise.resolve()
        .then(() => {
            return startViewer(roomId, sessionId, socket, sdpOffer);
        })
        .then((sdpAnswer) => {
            let data = JSON.stringify({ id: 'viewerResponse', response: 'accepted', sdpAnswer, roomId });
            socket.emit('onmessage', data);
        })
        .catch((err) => {
            console.log(err);
            let data = JSON.stringify({ id: 'viewerResponse', response: 'rejected', message: err, roomId });
            socket.emit('onmessage', data);
        })
}

let onIceCandidate = (roomId, sessionId, _candidate) => {
    let candidate = kurento.getComplexType('IceCandidate')(_candidate);
    let roomInfo = rooms[roomId];
    let viewInfo = viewers[roomId];

    if (roomInfo && roomInfo.presenter.id === sessionId && roomInfo.presenter.webRtcEndpoint) {
        console.info('Sending presenter candidate');
        rooms[roomId].presenter.webRtcEndpoint.addIceCandidate(candidate);
    }

    else if (viewInfo && viewInfo[sessionId] && viewInfo[sessionId].webRtcEndpoint) {
        console.info('Sending viewer candidate');
        viewers[roomId][sessionId].webRtcEndpoint.addIceCandidate(candidate);
    }

    else {
        console.info('Queueing candidate');
        if (!candidatesQueue[roomId]) {
            candidatesQueue[roomId] = { [sessionId]: [] };
        }
        try {
            candidatesQueue[roomId][sessionId].push(candidate);
        }
        catch (err) {
            candidatesQueue[roomId] = { [sessionId]: [] };
            candidatesQueue[roomId][sessionId].push(candidate);
        }
    }
}

let startPresenter = (roomId, sessionId, socket, sdpOffer) => {
    // clearCandidatesQueue(sessionId);
    let objWebRtcEndpoint, objSdpAnswer;
    return Promise.resolve()
        .then(() => {
            socket.join(roomId);
            socket.join(sessionId);
            let presenter = {
                id: sessionId,
                pipeline: null,
                webRtcEndpoint: null
            }
            rooms[roomId] = { presenter };
            return getKurentoClient()
        })
        .then((kurentoClient) => {
            return kurentoClient.create('MediaPipeline');
        })
        .then((pipeline) => {
            rooms[roomId]["presenter"].pipeline = pipeline;
            return pipeline.create('WebRtcEndpoint')
        })
        .then((webRtcEndpoint) => {
            objWebRtcEndpoint = webRtcEndpoint;
            rooms[roomId]["presenter"].webRtcEndpoint = webRtcEndpoint;
            if (candidatesQueue[roomId][sessionId]) {
                while (candidatesQueue[roomId][sessionId].length) {
                    let candidate = candidatesQueue[roomId][sessionId].shift();
                    webRtcEndpoint.addIceCandidate(candidate);
                }
            }

            webRtcEndpoint.on('OnIceCandidate', function (event) {
                let candidate = kurento.getComplexType('IceCandidate')(event.candidate);
                socket.emit('onmessage', JSON.stringify({ id: 'iceCandidate', candidate, roomId }));
            });

            return webRtcEndpoint.processOffer(sdpOffer)
        })
        .then((sdpAnswer) => {
            objSdpAnswer = sdpAnswer
            return objWebRtcEndpoint.gatherCandidates();
        })
        .then(() => {
            return objSdpAnswer;
        })
        .catch((err) => {
            console.log(err);
            return Promise.reject(err);
        });
}


let startViewer = (roomId, sessionId, socket, sdpOffer) => {
    // clearCandidatesQueue(sessionId);
    let objWebRtcEndpoint, objSdpAnswer;
    return Promise.resolve()
        .then(() => {
            socket.join(roomId);
            socket.join(sessionId);
            let roomInfo = rooms[roomId];
            return !roomInfo ? Promise.reject("Left") : roomInfo.presenter.pipeline.create('WebRtcEndpoint');
        })
        .then((webRtcEndpoint) => {
            objWebRtcEndpoint = webRtcEndpoint;
            viewers[roomId] = { [sessionId]: { "webRtcEndpoint": webRtcEndpoint, } };


            if (candidatesQueue[roomId][sessionId]) {
                while (candidatesQueue[roomId][sessionId].length) {
                    let candidate = candidatesQueue[roomId][sessionId].shift();
                    webRtcEndpoint.addIceCandidate(candidate);
                }
            }

            webRtcEndpoint.on('OnIceCandidate', function (event) {
                let candidate = kurento.getComplexType('IceCandidate')(event.candidate);
                socket.emit('onmessage', JSON.stringify({ id: 'iceCandidate', candidate, roomId }));
            });

            return webRtcEndpoint.processOffer(sdpOffer);
        })
        .then((sdpAnswer) => {
            objSdpAnswer = sdpAnswer;
            let roomInfo = rooms[roomId];
            return roomInfo.presenter.webRtcEndpoint.connect(objWebRtcEndpoint);
        })
        .then(() => {
            return objWebRtcEndpoint.gatherCandidates()
        })
        .then(() => {
            return objSdpAnswer;
        })
        .catch((err) => {
            console.log(err);
            return Promise.reject(err);
        });
};



let stopStreaming = (roomId, sessionId, socket) => {
    return Promise.resolve()
        .then(() => {
            if (roomId) {
                let roomInfo = rooms[roomId];
                // let viewInfo = viewers[roomId];
                if (roomInfo && roomInfo.presenter && roomInfo.presenter.id == sessionId) {
                    let data = JSON.stringify({ id: 'stopCommunication', roomId });
                    socket.in(roomId).emit("onmessage", data);
                    roomInfo.presenter.pipeline.release();
                    delete rooms[roomId];
                    viewers[roomId] = [];
                } else if (viewers[roomId][sessionId]) {
                    viewers[roomId][sessionId].webRtcEndpoint.release();
                    delete viewers[roomId][sessionId];
                }
                clearCandidatesQueue(roomId, sessionId);
                if (viewers.length < 1 && !Object.keys(length).length) {
                    console.log('Closing kurento client');
                    kurentoClient && kurentoClient.close();
                    kurentoClient = null;
                }
            }
        })
        .catch((err) => {
            console.log(err);
        });
}


let clearCandidatesQueue = (roomId, sessionId) => {
    if (candidatesQueue[roomId][sessionId]) {
        delete candidatesQueue[roomId][sessionId];
    }
}

module.exports = sockets;