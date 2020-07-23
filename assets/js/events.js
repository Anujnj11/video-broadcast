let createRoomBtn = document.getElementById("createRoom");
let teacherNameText = document.getElementById("teacherName");
let subject = document.getElementById("subject");
let chapter = document.getElementById("chapter");


let generateRandomString = () => {
    const crypto = window.crypto || window.msCrypto;
    let array = new Uint32Array(1);

    return crypto.getRandomValues(array).toString();
}

createRoomBtn.onclick = (e) => {
    e.preventDefault();
    if (teacherNameText.value) {
        let roomId = generateRandomString();
        localStorage.setItem("teacherName", teacherNameText.value);
        localStorage.setItem("isTeacher", true);
        let lecInfo = { subject: subject.value, chapter: chapter.value };
        localStorage.setItem("lecInfo", lecInfo);
        location.href = `/joinRoom/${roomId}`;
    } else {
        alert("Chutiyeah Naam de");
    }
}