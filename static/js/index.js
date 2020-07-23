let socket = io('/stream');
let video;
let webRtcPeer;
let socketId;
let roomId = "34234";
window.onload = function () {
	console = new Console();
	video = document.getElementById('video');
	document.getElementById('call').addEventListener('click', function () { presenter(); });
	document.getElementById('viewer').addEventListener('click', function () { viewer(); });
	document.getElementById('terminate').addEventListener('click', function () { stop(); });
}

window.onbeforeunload = function () {
	socket.close();
}

socket.on('connect', () => {
	socketId = socket.io.engine.id;

	socket.on("onmessage", (message) => {
		let parsedMessage = JSON.parse(message);
		if (roomId == parsedMessage.roomId) {
			console.info(`Received message: ${message}`);
			switch (parsedMessage.id) {
				case 'presenterResponse':
					presenterResponse(parsedMessage);
					break;
				case 'viewerResponse':
					viewerResponse(parsedMessage);
					break;
				case 'stopCommunication':
					dispose();
					break;
				case 'iceCandidate':
					webRtcPeer.addIceCandidate(parsedMessage.candidate)
					break;
				default:
					console.error('Unrecognized message', parsedMessage);
			}
		}
	});
});


function presenterResponse(message) {
	if (message.response != 'accepted') {
		var errorMsg = message.message ? message.message : 'Unknow error';
		console.warn('Call not accepted for the following reason: ' + errorMsg);
		dispose();
	} else {
		webRtcPeer.processAnswer(message.sdpAnswer);
	}
}

function viewerResponse(message) {
	if (message.response != 'accepted') {
		var errorMsg = message.message ? message.message : 'Unknow error';
		console.warn('Call not accepted for the following reason: ' + errorMsg);
		dispose();
	} else {
		webRtcPeer.processAnswer(message.sdpAnswer);
	}
}

function presenter() {
	if (!webRtcPeer) {
		showSpinner(video);

		var options = {
			localVideo: video,
			onicecandidate: onIceCandidate
		}

		webRtcPeer = kurentoUtils.WebRtcPeer.WebRtcPeerSendonly(options, function (error) {
			if (error) return onError(error);

			this.generateOffer(onOfferPresenter);
		});
	}
}

function onOfferPresenter(error, offerSdp) {
	if (error) return onError(error);

	var message = {
		id: 'presenter',
		sdpOffer: offerSdp,
	};
	sendMessage(message);
}

function viewer() {
	if (!webRtcPeer) {
		showSpinner(video);

		var options = {
			remoteVideo: video,
			onicecandidate: onIceCandidate
		}

		webRtcPeer = kurentoUtils.WebRtcPeer.WebRtcPeerRecvonly(options, function (error) {
			if (error) return onError(error);

			this.generateOffer(onOfferViewer);
		});
	}
}

function onOfferViewer(error, offerSdp) {
	if (error) return onError(error)

	var message = {
		id: 'viewer',
		sdpOffer: offerSdp
	}
	sendMessage(message);
}

function onIceCandidate(candidate) {
	console.log('Local candidate' + JSON.stringify(candidate));

	var message = {
		id: 'onIceCandidate',
		candidate: candidate
	}
	sendMessage(message);
}

function stop() {
	if (webRtcPeer) {
		var message = {
			id: 'stop'
		}
		sendMessage(message);
		dispose();
	}
}

function dispose() {
	if (webRtcPeer) {
		webRtcPeer.dispose();
		webRtcPeer = null;
	}
	hideSpinner(video);
}

function sendMessage(message) {
	message["roomId"] = roomId;
	message["socketId"] = socketId;
	var jsonMessage = JSON.stringify(message);
	console.log('Sending message: ' + jsonMessage);
	socket.emit('message', jsonMessage);
}

function showSpinner() {
	for (var i = 0; i < arguments.length; i++) {
		arguments[i].poster = './img/transparent-1px.png';
		arguments[i].style.background = 'center transparent url("./img/spinner.gif") no-repeat';
	}
}

function hideSpinner() {
	for (var i = 0; i < arguments.length; i++) {
		arguments[i].src = '';
		arguments[i].poster = './img/webrtc.png';
		arguments[i].style.background = '';
	}
}

/**
 * Lightbox utility (to display media pipeline image in a modal dialog)
 */
$(document).delegate('*[data-toggle="lightbox"]', 'click', function (event) {
	event.preventDefault();
	$(this).ekkoLightbox();
});
