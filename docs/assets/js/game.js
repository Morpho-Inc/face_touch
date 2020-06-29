const state = {
    video: null,
    gyroscope: null,
    segmentationID: null,
    tickID: null,
    deviceShaking: false,
    faceExists: false,
};

const params = {
    segmentationInterval: 300,
    minTouchCount: 4,
    gyroShakeThreshold: 1.0,
};

const challenges = [
    [10, 'otanjoubi_birthday_present_balloon.png'],
    [20, 'sweets_cake_pavlova.png'],
    [30, 'game_coin.png'],
    [40, 'coin_medal_gold.png'],
    [50, 'yusyou_cup_bronze.png'],
    [60, 'yusyou_cup_silver.png'],
    [120, 'yusyou_cup_gold.png'],
    [180, 'kaizoku_takara.png'],
    [300, 'royal_king_gyokuza.png']
];

const sounds = {
    start: new Audio("assets/audio/start.mp3"),
    stop: new Audio("assets/audio/stop.mp3"),
    tick: new Audio("assets/audio/tick.mp3"),
    cleared: new Audio("assets/audio/success.mp3"),
    completed: new Audio("assets/audio/completed.mp3"),
    failed: new Audio("assets/audio/dame.mp3"),
}

function loadSounds() {
    for (let key in sounds) {
        sounds[key].load();
    }
}

function playSound(s) {
    if (parseInt(localStorage.getItem("playSound") || 1)) {
        s.play();
    }
}

async function getVideoInputs() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) {
        console.log('enumerateDevices() not supported.');
        return [];
    }

    const devices = await navigator.mediaDevices.enumerateDevices();
    const videoDevices = devices.filter(device => device.kind === 'videoinput');

    return videoDevices;
}

function stopExistingVideoCapture() {
    if (state.video && state.video.srcObject) {
        state.video.srcObject.getTracks().forEach(track => {
            track.stop();
        })
        state.video.srcObject = null;
    }
}

async function getDeviceIdForLabel(cameraLabel) {
    const videoInputs = await getVideoInputs();

    for (let i = 0; i < videoInputs.length; i++) {
        const videoInput = videoInputs[i];
        if (videoInput.label === cameraLabel) {
            return videoInput.deviceId;
        }
    }

    return null;
}

async function getConstraints(cameraLabel) {
    let constraints = true;

    if (cameraLabel) {
        let id = await getDeviceIdForLabel(cameraLabel);
        let currentFacingMode = 'environment';
        constraints = {
            width: { ideal: 640 },
            height: { ideal: 320 },
            deviceId: { ideal: id },
            facingMode: currentFacingMode,
        };
    };
    return constraints;
}

async function setupCamera(cameraLabel) {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error(
            'Browser API navigator.mediaDevices.getUserMedia not available');
    }

    const videoElement = document.getElementById('video');

    stopExistingVideoCapture();

    const constraints = await getConstraints(cameraLabel);
    const stream = await navigator.mediaDevices.getUserMedia(
        { audio: false, video: constraints });
    videoElement.srcObject = stream;

    return new Promise((resolve) => {
        videoElement.onloadedmetadata = () => {
            videoElement.width = videoElement.videoWidth;
            videoElement.height = videoElement.videoHeight;

            resolve(videoElement);
        };
    });
}

async function loadVideo() {
    const cameraLabel = localStorage.getItem("cameraLabel");
    try {
        state.video = await setupCamera(cameraLabel);

        document.getElementById('game-page').style.display = "block";

        startSegmentation();
    } catch (e) {
        let info = 'this browser does not support video capture,' +
            'or this device does not have a camera';
        alert(info)
        throw e;
    }

    state.video.play();
}

function onVideoSourceChange() {
    const cameraLabel = document.getElementById("videoSource").value;
    localStorage.setItem("cameraLabel", cameraLabel);
}

function loadGyroscope() {
    if (typeof Gyroscope === "function") {
        state.gyroscope = new Gyroscope({ frequency: 30 });
        let gyroArray = new Array(60).fill(0);
        let gyroIndex = 0;

        state.gyroscope.addEventListener('reading', e => {
            const abs = Math.abs(state.gyroscope.x) + Math.abs(state.gyroscope.y) + Math.abs(state.gyroscope.z);
            gyroArray[gyroIndex] = abs;

            gyroIndex = (gyroIndex + 1) % gyroArray.length;
            max = gyroArray.reduce((a, b) => a > b ? a : b);

            if (max > params.gyroShakeThreshold) {
                state.deviceShaking = true;
                document.getElementById("alert-message-gyro").innerText = "Please don't move your device.";
            } else {
                state.deviceShaking = false;
                document.getElementById("alert-message-gyro").innerText = "";
            }
        });
    }
}

function setupGui(cameras) {
    cameras.forEach(camera => {
        const option = document.createElement('option');
        option.text = camera.label;
        option.value = camera.label;

        if (localStorage.getItem("cameraLabel") == option.value) {
            option.selected = true;
        }
        document.getElementById("videoSource").appendChild(option);
    });

    const checkBox = document.getElementById("playSound");
    checkBox.checked = parseInt(localStorage.getItem("playSound") || 1);
    checkBox.addEventListener("change", () => {
        if (checkBox.checked) {
            localStorage.setItem("playSound", 1);
        } else {
            localStorage.setItem("playSound", 0);
        }
    });

    for (let i = 1; i <= challenges.length; i++) {
        const div = document.createElement("div");
        div.classList.add("reward");

        const level = document.createElement("p");
        level.classList.add("level");
        level.innerText = "Lv." + String(i) + " (" + getTimeString(challenges[i - 1][0], false, true) + ")";
        div.appendChild(level);

        const img = document.createElement("img");
        img.id = "reward-img-level-" + String(i);
        img.src = "assets/images/reward/" + challenges[i - 1][1];
        div.appendChild(img)

        document.getElementById("reward-body").appendChild(div);
    }

    $('#rewardsModal').on('show.bs.modal', function (e) {
        for (let i = 1; i <= challenges.length; i++) {
            const id = "reward-img-level-" + String(i);
            const element = document.getElementById(id);
            const level = parseInt(localStorage.getItem("level") || "0");

            if (i <= level) {
                element.src = "assets/images/reward/small/" + challenges[i - 1][1];
            } else {
                element.src = "assets/images/reward/small/mark_question.png"
            }
        }
    })
}

function resetLevel() {
    if (confirm("Are you sure? Your level is reset to Zero.")) {
        localStorage.clear();
        location.reload();
    }
}

function getTimeString(seconds, forCountDown = false, shorten = false) {
    let h = parseInt(seconds / 3600);
    let m = parseInt((seconds / 60) % 60);
    let s = parseInt(seconds % 60);

    if (forCountDown) {
        if (h < 10) { h = "0" + h; }
        if (m < 10) { m = "0" + m; }
        if (s < 10) { s = "0" + s; }

        return m + ':' + s;
    }

    if (s != 0) {
        return s + (shorten ? "sec" : " seconds");
    } else if (m == 1) {
        return m + (shorten ? "min" : " minute");
    } else if (m != 0) {
        return m + (shorten ? "min" : " minutes");
    } else if (h == 1) {
        return h + " hour";
    } else {
        return h + " hours";
    }
}

function startTick() {
    const level = parseInt(localStorage.getItem("level") || "0");

    let startDate = new Date();
    let timeLimit = challenges[Math.min(challenges.length - 1, level)][0];
    let timeRemain = timeLimit;

    function tick() {
        if (!state.faceExists) {
            document.getElementById("alert-message-face").innerText = "No Face";
        }

        if (state.faceExists && !document.hidden) {
            document.getElementById("alert-message-face").innerText = "";

            const elapsed = parseInt((new Date().getTime() - startDate.getTime()) / 1000);
            timeRemain = timeLimit - elapsed;

            const timeString = getTimeString(timeRemain, true);
            document.getElementById('countdown-timer').innerText = timeString;

            if (timeRemain <= 0) {
                challengeFinished("success");
            } else {
                playSound(sounds.tick);
            }
        } else {
            startDate = new Date();
            timeLimit = timeRemain;
        }
    }

    tick();
    state.tickID = setInterval(tick, 1000);
}

function checkTouch(segmentation) {
    const width = segmentation.width;
    const height = segmentation.height;
    let touched = false;
    let faceExists = false;

    for (let y = 0; y < height; ++y) {
        for (let x = 0; x < width; ++x) {
            let face = false;
            let hand = false;
            for (let yy = y; yy <= y + 1; yy++) {
                for (let xx = x; xx <= x + 1; xx++) {
                    const ii = (xx + yy * width);
                    const v = segmentation.data[ii];

                    if (v == 0 || v == 1) {
                        face = true;
                        faceExists = true;
                    } else if (v == 10 || v == 11) {
                        hand = true;
                    }
                }
            }
            if (face && hand) {
                touched = true;
            }
        }
    }

    return [touched, faceExists];
}

async function startSegmentation() {
    const net = await bodyPix.load({
        architecture: 'MobileNetV1',
        outputStride: 16,
        multiplier: 0.75,
        quantBytes: 2
    });

    let touchCount = 0;
    let initialized = false;

    async function segmentation() {
        let touched = false;
        if (state.video.readyState === 4) {
            if (document.hidden) {
                // skip inference when tab is inactive
            } else {
                const segmentation = await net.segmentPersonParts(state.video, {
                    flipHorizontal: false,
                    internalResolution: 0.5,
                    segmentationThreshold: 0.80,
                });
                [touched, state.faceExists] = checkTouch(segmentation);

                if (state.deviceShaking) {
                    touched = false; // avoid false detection
                }

                if (!initialized) {
                    if (null != state.gyroscope) {
                        state.gyroscope.start();
                    }
                    document.getElementById('loading-page').style.display = "none";
                    startTick();
                    initialized = true;
                } else {
                    if (touched) {
                        touchCount++;
                    } else {
                        touchCount = 0;
                    }
                }

                if (touchCount == params.minTouchCount) {
                    challengeFinished("failed");
                }
            }
        }
    }
    state.segmentationID = setInterval(segmentation, params.segmentationInterval);
}

function updateChallengeTime(level) {
    const challengeTime = challenges[Math.min(challenges.length - 1, level)][0];
    const timeString = getTimeString(challengeTime);
    document.getElementById("challenge-time").innerText = timeString;
}

function initializeScreen() {
    document.getElementById('reward-page').style.display = "none";
    document.getElementById('game-page').style.display = "none";
    document.getElementById("loading-page").style.display = "none";

    document.getElementById("alert-message-gyro").innerText = "";

    const level = parseInt(localStorage.getItem("level") || "0");
    updateChallengeTime(level);
}

async function startChallenge() {
    document.getElementById("loading-page").style.display = "block";
    loadSounds();
    playSound(sounds.start);
    try {
        await loadVideo();
    } catch(err){
        challengeFinished("stop");
    }
}

function challengeFinished(status) {
    clearInterval(state.segmentationID);
    clearInterval(state.tickID);
    document.getElementById('countdown-timer').innerText = "";

    if (null != state.gyroscope) {
        state.gyroscope.stop();
    }

    stopExistingVideoCapture();
    document.getElementById('reward-page').style.display = "block";

    const message = document.getElementById("message-reward");
    const image = document.getElementById("reward-img");

    if ("success" == status) {
        let level = parseInt(localStorage.getItem("level") || "0");
        level++;
        updateChallengeTime(level);
        localStorage.setItem("level", level);

        image.src = "assets/images/reward/" + challenges[Math.min(challenges.length - 1, level - 1)][1];

        if (level >= challenges.length) {
            playSound(sounds.completed);
            message.innerText = "All Cleared!"
        } else {
            playSound(sounds.cleared);
            message.innerText = "Cleared!"
        }
    } else if ("failed" == status) {
        playSound(sounds.failed);

        message.innerText = "Failed!";
        image.src = "assets/images/virus_hand.png";
    } else if ("stop" == status) {
        initializeScreen();
        playSound(sounds.stop);
    }
}

async function main() {
    initializeScreen();
    navigator.mediaDevices.getUserMedia({ audio: false, video: true });
    const cameras = await getVideoInputs();
    setupGui(cameras);
    loadGyroscope();
}

navigator.getUserMedia = navigator.getUserMedia ||
    navigator.webkitGetUserMedia || navigator.mozGetUserMedia;

main();