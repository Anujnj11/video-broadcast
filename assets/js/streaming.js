'use strict';

/* globals MediaRecorder */

let mediaRecorder;
let recordedBlobs = [];
let mediaBuffer;
let students = [];
let socket = io('/stream');
let teacherInfo;
let socketId = '';
let room;
let teacherName;
let isTeacher;
let lecInfo;
let studentMediaSource;
let sourceBuffer;
var buffer = null;
var queue = [];




const errorMsgElement = document.querySelector('span#errorMsg');
const recordedVideo = document.querySelector('video#recorded');
const recordButton = document.querySelector('button#record');
const teacherVideoDiv = document.getElementById("teacherVideo");




studentMediaSource = new MediaSource();
recordedVideo.src = window.URL.createObjectURL(studentMediaSource);
studentMediaSource.addEventListener('sourceopen', sourceBufferHandle)


function sourceBufferHandle() {
    buffer = studentMediaSource.addSourceBuffer('video/webm; codecs="vp8"');
    buffer.mode = 'sequence';

    buffer.addEventListener('update', function () { // Note: Have tried 'updateend'
        console.log('update');
        updateBuffer();
    });

    buffer.addEventListener('updateend', function () {
        console.log('updateend');
        updateBuffer();
    });

}


function updateBuffer() {
    if (queue.length > 0 && !buffer.updating) {
        buffer.appendBuffer(queue.shift());
    }
}

recordButton.addEventListener('click', () => {
    if (recordButton.textContent === 'Start Recording') {
        startRecording();
    } else {
        stopRecording();
        recordButton.textContent = 'Start Recording';
        playButton.disabled = false;
        downloadButton.disabled = false;
    }
});

const playButton = document.querySelector('button#play');
playButton.addEventListener('click', () => {
    const superBuffer = new Blob(recordedBlobs, { type: 'video/webm' });
    recordedVideo.src = null;
    recordedVideo.srcObject = null;
    recordedVideo.src = window.URL.createObjectURL(superBuffer);
    recordedVideo.controls = true;
    recordedVideo.play();
});

const downloadButton = document.querySelector('button#download');
downloadButton.addEventListener('click', () => {
    const blob = new Blob(recordedBlobs, { type: 'video/webm' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.style.display = 'none';
    a.href = url;
    a.download = 'test.webm';
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
    }, 100);
});

function handleDataAvailable(event) {
    console.log('handleDataAvailable', event);
    if (event.data && event.data.size > 0) {
        recordedBlobs.push(event.data);
    }
    socket.emit("streamBuffer", { room, socketId, streamBuffer: event.data });
}

function startRecording() {
    recordedBlobs = [];
    let options = { mimeType: 'video/webm;codecs=vp9,opus' };
    if (!MediaRecorder.isTypeSupported(options.mimeType)) {
        console.error(`${options.mimeType} is not supported`);
        options = { mimeType: 'video/webm;codecs=vp8,opus' };
        if (!MediaRecorder.isTypeSupported(options.mimeType)) {
            console.error(`${options.mimeType} is not supported`);
            options = { mimeType: 'video/webm' };
            if (!MediaRecorder.isTypeSupported(options.mimeType)) {
                console.error(`${options.mimeType} is not supported`);
                options = { mimeType: '' };
            }
        }
    }
    try {
        mediaRecorder = new MediaRecorder(window.stream, options);
    } catch (e) {
        console.error('Exception while creating MediaRecorder:', e);
        errorMsgElement.innerHTML = `Exception while creating MediaRecorder: ${JSON.stringify(e)}`;
        return;
    }

    console.log('Created MediaRecorder', mediaRecorder, 'with options', options);
    recordButton.textContent = 'Stop Recording';
    playButton.disabled = true;
    downloadButton.disabled = true;
    mediaRecorder.ondataavailable = handleDataAvailable;
    mediaRecorder.onstop = (event) => {
        console.log('Recorder stopped: ', event);
        console.log('Recorded Blobs: ', recordedBlobs);
    };
    socket.emit("startStreaming", { room, socketId });
    mediaRecorder.start();
    console.log('MediaRecorder started', mediaRecorder);
    mediaBuffer = setInterval(() => mediaRecorder.requestData(), 10000);
}

function stopRecording() {
    mediaRecorder.stop();
    window.clearInterval(mediaBuffer);
}

function handleSuccess(stream) {
    recordButton.disabled = false;
    console.log('getUserMedia() got stream:', stream);
    window.stream = stream;

    const gumVideo = document.querySelector('video#gum');
    gumVideo.srcObject = stream;
}

async function init(constraints) {
    try {
        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        handleSuccess(stream);
    } catch (e) {
        console.error('navigator.getUserMedia error:', e);
        errorMsgElement.innerHTML = `navigator.getUserMedia error:${e.toString()}`;
    }
}

document.querySelector('button#start').addEventListener('click', async () => {
    const hasEchoCancellation = document.querySelector('#echoCancellation').checked;
    const constraints = {
        audio: {
            echoCancellation: { exact: hasEchoCancellation }
        },
        video: {
            width: 1280, height: 720
        }
    };
    console.log('Using media constraints:', constraints);
    await init(constraints);
});

function getIndexValue(url, index) {
    let returnValue = url.split("/");
    returnValue = returnValue[index] ? returnValue[index] : "";
    return returnValue;
};


// function playStream(chucks) {
//     console.log(chucks);
//     sourceBuffer = studentMediaSource.addSourceBuffer('video/webm; codecs="vorbis,vp8"');

//     sourceBuffer.addEventListener('updateend', function (_) {
//         studentMediaSource.endOfStream();
//         recordedVideo.play();
//         //console.log(mediaSource.readyState); // ended
//     });
//     sourceBuffer.appendBuffer(chucks);
// }

socket.on('connect', () => {
    socketId = socket.io.engine.id;
    isTeacher && socket.emit('teacherJoin', { room, socketId, userInfo: teacherInfo });
    !isTeacher && socket.emit('newStudentJoined', { room, socketId, userInfo: {} });


    socket.on("teacherJoined", (data) => {
        console.log("TEACHER JOINED STREAMING", data);
    });


    socket.on('newStudentJoined', (data) => {
        console.log(data);
        isTeacher && students.push(data);
    });

    socket.on("startedStreaming", (data) => {
        console.log("TEACHER STARTED STREAMING", data);
    });

    function sourceOpen(chucks) {
        //console.log(this.readyState); // open
        sourceBuffer = studentMediaSource.addSourceBuffer('video/webm;codecs=vp9,opus');
        // fetchAB(assetURL, function (buf) {
        sourceBuffer.addEventListener('updateend', function (_) {
            studentMediaSource.endOfStream();
            recordedVideo.play();
            //console.log(mediaSource.readyState); // ended
        });
        sourceBuffer && sourceBuffer.appendBuffer(chucks);
        // });
    };

    socket.on("streamBuffered", (data) => {
        console.log(data);
        recordedBlobs.push(data.streamBuffer);
        if (buffer.updating || queue.length > 0) {
            queue.push(data.streamBuffer);
        } else {
            buffer.appendBuffer(data.streamBuffer);
            recordedVideo.play();
        }

        // let playChucks = [data.streamBuffer];
        // const superBuffer = new Blob(playChucks, { type: 'video/webm' });
        // // recordedVideo.src = null;
        // // recordedVideo.srcObject = null;
        // recordedVideo.src = window.URL.createObjectURL(superBuffer);
        // recordedVideo.controls = true;
        // recordedVideo.play();
        // // const superBuffer = new Blob(recordedBlobs, { type: 'video/webm' });
        // // recordedVideo.src = null;
        // // recordedVideo.srcObject = null;
        // // recordedVideo.src = window.URL.createObjectURL(data.streamBuffer);
        // // // recordedVideo.controls = true;
        // // recordedVideo.play().then((data)=>{
        // //     console.log(data)
        // // })
        // // .catch((err)=>{
        // //     console.log(err);
        // // })
    });

});




(function () {
    room = getIndexValue(location.pathname, 2);
    teacherName = localStorage.getItem('teacherName');
    isTeacher = localStorage.getItem("isTeacher");
    lecInfo = localStorage.getItem("lecInfo");
    teacherVideoDiv.style = !isTeacher ? "display:none" : "";
    recoredVideo.style = isTeacher ? "display:none" : "";
})();