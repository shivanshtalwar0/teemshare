let testurl = "ws://104.45.152.100:48505"
let secureurl = "wss://janus.onemandev.tech/websocket"
let websocket = new WebSocket(testurl, "janus-protocol")
let apisecret = { "apisecret": "SecureIt" }
let sessionId = null;
let handleId = null;
let room = 1234
let pc = null;
let transactions = {}

let createMessage = (message, jsep, session, handle, transaction) => {

    let request = {
        "janus": "message",
        session_id: session,
        handle_id: handle,
        "transaction": transaction,
        ...apisecret,
        body: message
    };
    if (jsep != null) {
        request["jsep"] = { "type": jsep.type, "sdp": jsep.sdp };
    }

    return request;

}

websocket.onopen = () => {
    let transaction = "somerandom"

    websocket.send(JSON.stringify({
        "janus": "create",
        "transaction": transaction,
        ...apisecret
    }));
    transactions[transaction] = (json) => {
        console.log(json)
        sessionId = json.data.id;

        setInterval(() => {
            // important to send keepalive events inorder to make session active otherwise session will be destroyed :(
            websocket.send(JSON.stringify({
                "janus": "keepalive", "session_id": sessionId, "transaction": "sBJNyUhH6Vc6",
                ...apisecret
            }))
        }, 5000);



        let attachTransaction = "attachTransaction"
        let plugin = "janus.plugin.videoroom"
        let attachPlugin = {
            "janus": "attach",
            session_id: sessionId,
            "plugin": plugin,
            "transaction": attachTransaction,
            ...apisecret
        }
        websocket.send(JSON.stringify(attachPlugin))
        transactions[attachTransaction] = async (json) => {
            console.log(json);
            handleId = json.data.id;
            pc = new RTCPeerConnection({
                iceServers: [{
                    urls: "stun:104.45.152.100:3478",
                    username: "onemandev",
                    credential: "SecureIt"
                },
                {
                    urls: "turn:104.45.152.100:3478",
                    username: "onemandev",
                    credential: "SecureIt"
                }
                ]
            });
            const localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
            localStream.getTracks().forEach(track => {
                pc.addTrack(track, localStream);
            })
            pc.ontrack = (trackevent) => {
                console.log(trackevent.data.tracks);
            }

            let register = {
                request: "join",
                room: room,
                ptype: "publisher",
                display: "shivansh"
            };
            let joinTransaction = "joinTransaction"
            websocket.send(JSON.stringify(createMessage(register, null, sessionId, handleId, joinTransaction)))
            transactions[joinTransaction] = (json) => {
                console.log(json)
                let publish = { request: "configure", audio: true, video: true };
                let publishTransaction = "publishTransaction"
                transactions[publishTransaction] = (json) => {
                    console.log(json)
                    pc.setRemoteDescription(new RTCSessionDescription(json.jsep))
                }
                pc.onicecandidate = (candidate) => {
                    console.log('got candidate');
                    console.log(candidate);
                    var request = { "janus": "trickle", "candidate": candidate.candidate, "transaction": "sendtrickle" };
                    request.session_id = sessionId;
                    request.handle_id = handleId;
                    request.apisecret = "SecureIt"
                    websocket.send(JSON.stringify(request))
                    transactions["sendtrickle"] = async (json) => {
                        console.log(json);
                        await pc.addIceCandidate(json.candidate);
                    }
                    // pc.addIceCandidate(candidate.candidate);
                }
                pc.oniceconnectionstatechange = (event) => {
                    console.log(pc.connectionState)
                }

                pc.createOffer({ offerToReceiveAudio: true, offerToReceiveVideo: true }).then((offer) => {
                    pc.setLocalDescription(offer);
                    websocket.send(JSON.stringify(createMessage(publish, offer, sessionId, handleId, publishTransaction)))
                })


            }




        }

    }


}
websocket.onmessage = (msgevent) => {
    console.log(msgevent.data);

    let json = JSON.parse(msgevent.data);
    if (json.janus === "success" || json.janus === "event")
        transactions[json.transaction](json);

    if (json.janus == "trickle") {
        console.log(json)
        if (json.candidate)
            transactions["sendtrickle"](json)
    }

}