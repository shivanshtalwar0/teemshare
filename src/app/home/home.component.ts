import {Component, OnInit} from '@angular/core';
import {Router} from '@angular/router';
import WebRTCAdapter from "webrtc-adapter";


import JanusJs from "../../assets/janus";
import {ConstructorOptions, InitOptions, Janus, PluginHandle, PluginMessage} from "../../assets/janusTs";
import {FormControl, FormGroup, Validators} from "@angular/forms";


@Component({
  selector: 'app-home',
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.scss'],
})

export class HomeComponent implements OnInit {

  constructor(private router: Router) {
  }

  textRoom: PluginHandle;
  videoRoom: PluginHandle;
  janus: Janus;
  registerForm: FormGroup = new FormGroup({username: new FormControl('', Validators.required)})
  videoPluginInitialized = false

  registerUser() {
    if (!this.videoPluginInitialized) {
      this.attachVideoPlugin()
    }
    var register = {
      request: "join",
      room: 1234,
      ptype: "publisher",
      display: this.registerForm.value.username
    };
    this.videoRoom.send({message: register});

  }

  leaveRoom() {
    this.videoPluginInitialized = false
    let leave = {
      request: "leave"
    }
    this.videoRoom.send({
      message: {
        request: "unpublish"
      }
    })
    this.videoRoom.send({message: leave});
  }

  publishOwnFeed(useAudio) {
    // Publish our stream
    // $('#publish').attr('disabled', true).unbind('click');
    this.videoRoom.createOffer(
      {
        // Add data:true here if you want to publish datachannels as well
        media: {audioRecv: false, videoRecv: false, audioSend: useAudio, videoSend: true},	// Publishers are sendonly
        // If you want to test simulcasting (Chrome and Firefox only), then
        // pass a ?simulcast=true when opening this demo page: it will turn
        // the following 'simulcast' property to pass to janus.js to true
        simulcast: true,
        simulcast2: false,
        success: (jsep) => {
          console.debug("Got publisher SDP!", jsep);
          var publish = {request: "configure", audio: useAudio, video: true};
          // You can force a specific codec to use when publishing by using the
          // audiocodec and videocodec properties, for instance:
          // 		publish["audiocodec"] = "opus"
          // to force Opus as the audio codec to use, or:
          // 		publish["videocodec"] = "vp9"
          // to force VP9 as the videocodec to use. In both case, though, forcing
          // a codec will only work if: (1) the codec is actually in the SDP (and
          // so the browser supports it), and (2) the codec is in the list of
          // allowed codecs in a room. With respect to the point (2) above,
          // refer to the text in janus.plugin.videoroom.jcfg for more details
          this.videoRoom.send({message: publish, jsep: jsep});
        },
        error: (error) => {
          console.error("WebRTC error:", error);
          if (useAudio) {
            this.publishOwnFeed(false);
          } else {
            console.error("WebRTC error... " + error.message);
            // $('#publish').removeAttr('disabled').click(function() { publishOwnFeed(true); });
          }
        }
      });
  }


  attachVideoPlugin() {
    this.videoPluginInitialized = true;
    this.janus.attach(
      {
        plugin: "janus.plugin.videoroom",
        opaqueId: "12346677",
        success: (pluginHandle) => {
          // $('#details').remove();
          // sfutest = pluginHandle;
          this.videoRoom = pluginHandle
          // Janus.log("Plugin attached! (" + sfutest.getPlugin() + ", id=" + sfutest.getId() + ")");
          // Janus.log("  -- This is a publisher/manager");
          // Prepare the username registration
          // $('#videojoin').removeClass('hide').show();
          // $('#registernow').removeClass('hide').show();
          // $('#register').click(registerUsername);
          // $('#username').focus();
          // $('#start').removeAttr('disabled').html("Stop")
          //   .click(function () {
          //     $(this).attr('disabled', true);
          //     janus.destroy();
          //   });
        },
        error: function (error) {
          // Janus.error("  -- Error attaching plugin...", error);
          // bootbox.alert("Error attaching plugin... " + error);
        },
        consentDialog: function (on) {
          console.debug("Consent dialog should be " + (on ? "on" : "off") + " now");

        },
        iceState: function (state) {
          console.log("ICE state changed to " + state);
        },
        // mediaState: (medium, on)=> {
        //   console.log("Janus " + (on ? "started" : "stopped") + " receiving our " + medium);
        // },
        webrtcState: (on) => {
          console.log("Janus says our WebRTC PeerConnection is " + (on ? "up" : "down") + " now");
          // $("#videolocal").parent().parent().unblock();
          // if (!on)
          //   return;
          // $('#publish').remove();
          // // This controls allows us to override the global room bitrate cap
          // $('#bitrate').parent().parent().removeClass('hide').show();
          // $('#bitrate a').click(function () {
          //   var id = $(this).attr("id");
          //   var bitrate = parseInt(id) * 1000;
          //   if (bitrate === 0) {
          //     Janus.log("Not limiting bandwidth via REMB");
          //   } else {
          //     Janus.log("Capping bandwidth to " + bitrate + " via REMB");
          //   }
          //   $('#bitrateset').html($(this).html() + '<span class="caret"></span>').parent().removeClass('open');
          this.videoRoom.send({message: {request: "configure"}});
          return false;
        },
        onmessage: (msg, jsep) => {
          console.debug(" ::: Got a message (publisher) :::", msg);
          var event = msg["videoroom"];
          console.debug("Event: " + event);
          if (event) {
            if (event === "joined") {
              // Publisher/manager created, negotiate WebRTC and attach to existing feeds, if any
              let myid = msg["id"];
              let mypvtid = msg["private_id"];
              console.log("Successfully joined room " + msg["room"] + " with ID " + myid);
              this.publishOwnFeed(true);
              // Any new feed to attach to?
              if (msg["publishers"]) {
                var list = msg["publishers"];
                console.debug("Got a list of available publishers/feeds:", list);
                for (var f in list) {
                  var id = list[f]["id"];
                  var display = list[f]["display"];
                  var audio = list[f]["audio_codec"];
                  var video = list[f]["video_codec"];
                  console.debug("  >> [" + id + "] " + display + " (audio: " + audio + ", video: " + video + ")");
                  this.newRemoteFeed(id, display, audio, video);
                }
              }
            } else if (event === "destroyed") {
              // The room has been destroyed
              console.warn("The room has been destroyed!");
              // bootbox.alert("The room has been destroyed", function () {
              //   window.location.reload();
              // });
            } else if (event === "event") {
              // Any new feed to attach to?
              if (msg["publishers"]) {
                var list = msg["publishers"];
                console.debug("Got a list of available publishers/feeds:", list);
                for (var f in list) {
                  var id = list[f]["id"];
                  var display = list[f]["display"];
                  var audio = list[f]["audio_codec"];
                  var video = list[f]["video_codec"];
                  console.debug("  >> [" + id + "] " + display + " (audio: " + audio + ", video: " + video + ")");
                  this.newRemoteFeed(id, display, audio, video);
                }
              } else if (msg["leaving"]) {
                // One of the publishers has gone away?
                var leaving = msg["leaving"];
                console.log("Publisher left: " + leaving);
                var remoteFeed = null;
                // for (var i = 1; i < 6; i++) {
                //   if (feeds[i] && feeds[i].rfid == leaving) {
                //     remoteFeed = feeds[i];
                //     break;
                //   }
                // }
                if (remoteFeed != null) {
                  console.debug("Feed " + remoteFeed.rfid + " (" + remoteFeed.rfdisplay + ") has left the room, detaching");
                  // $('#remote' + remoteFeed.rfindex).empty().hide();
                  // $('#videoremote' + remoteFeed.rfindex).empty();
                  // feeds[remoteFeed.rfindex] = null;
                  remoteFeed.detach();
                }
              } else if (msg["unpublished"]) {
                // One of the publishers has unpublished?
                var unpublished = msg["unpublished"];
                console.log("Publisher left: " + unpublished);
                if (unpublished === 'ok') {
                  // That's us
                  this.videoRoom.hangup();
                  return;
                }
                var remoteFeed = null;
                for (var i = 1; i < 6; i++) {
                  // if (feeds[i] && feeds[i].rfid == unpublished) {
                  //   remoteFeed = feeds[i];
                  //   break;
                  // }
                }
                if (remoteFeed != null) {
                  console.debug("Feed " + remoteFeed.rfid + " (" + remoteFeed.rfdisplay + ") has left the room, detaching");
                  // $('#remote' + remoteFeed.rfindex).empty().hide();
                  // $('#videoremote' + remoteFeed.rfindex).empty();
                  // feeds[remoteFeed.rfindex] = null;
                  remoteFeed.detach();
                }
              } else if (msg["error"]) {
                if (msg["error_code"] === 426) {
                  // This is a "no such room" error: give a more meaningful description
                  // bootbox.alert(
                  //   "<p>Apparently room <code>" + myroom + "</code> (the one this demo uses as a test room) " +
                  //   "does not exist...</p><p>Do you have an updated <code>janus.plugin.videoroom.jcfg</code> " +
                  //   "configuration file? If not, make sure you copy the details of room <code>" + myroom + "</code> " +
                  //   "from that sample in your current configuration file, then restart Janus and try again."
                  // );
                } else {
                  // bootbox.alert(msg["error"]);
                }
              }
            }
          }
          if (jsep) {
            console.debug("Handling SDP as well...", jsep);
            this.videoRoom.handleRemoteJsep({jsep: jsep});
            // Check if any of the media we wanted to publish has
            // been rejected (e.g., wrong or unsupported codec)
            var audio = msg["audio_codec"];
            // if (mystream && mystream.getAudioTracks() && mystream.getAudioTracks().length > 0 && !audio) {
            //   // Audio has been rejected
            //   toastr.warning("Our audio stream has been rejected, viewers won't hear us");
            // }
            var video = msg["video_codec"];
            // if (mystream && mystream.getVideoTracks() && mystream.getVideoTracks().length > 0 && !video) {
            //   // Video has been rejected
            //   toastr.warning("Our video stream has been rejected, viewers won't see us");
            //   // Hide the webcam video
            //   $('#myvideo').hide();
            //   $('#videolocal').append(
            //     '<div class="no-video-container">' +
            //     '<i class="fa fa-video-camera fa-5 no-video-icon" style="height: 100%;"></i>' +
            //     '<span class="no-video-text" style="font-size: 16px;">Video rejected, no webcam</span>' +
            //     '</div>');
            // }
          }
        },
        onlocalstream: function (stream) {
          console.debug(" ::: Got a local stream :::", stream);
          let mystream = stream;
          console.warn('got my local stream')
          // console.log(mystream.getVideoTracks()[0])
          let my_video: HTMLVideoElement = <HTMLVideoElement>(document.getElementById('my_view'))
          my_video.srcObject = stream
          my_video.muted = true
          // my_video.src=mystream.getVideoTracks()[0]
          // $('#videojoin').hide();
          // $('#videos').removeClass('hide').show();
          // if ($('#myvideo').length === 0) {
          //   $('#videolocal').append('<video class="rounded centered" id="myvideo" width="100%" height="100%" autoplay playsinline muted="muted"/>');
          //   // Add a 'mute' button
          //   $('#videolocal').append('<button class="btn btn-warning btn-xs" id="mute" style="position: absolute; bottom: 0px; left: 0px; margin: 15px;">Mute</button>');
          //   $('#mute').click(toggleMute);
          //   // Add an 'unpublish' button
          //   $('#videolocal').append('<button class="btn btn-warning btn-xs" id="unpublish" style="position: absolute; bottom: 0px; right: 0px; margin: 15px;">Unpublish</button>');
          //   $('#unpublish').click(unpublishOwnFeed);
          // }
          // $('#publisher').removeClass('hide').html(myusername).show();
          // Janus.attachMediaStream($('#myvideo').get(0), stream);
          // $("#myvideo").get(0).muted = "muted";
          // if (sfutest.webrtcStuff.pc.iceConnectionState !== "completed" &&
          //   sfutest.webrtcStuff.pc.iceConnectionState !== "connected") {
          //   $("#videolocal").parent().parent().block({
          //     message: '<b>Publishing...</b>',
          //     css: {
          //       border: 'none',
          //       backgroundColor: 'transparent',
          //       color: 'white'
          //     }
          //   });
          // }
          var videoTracks = stream.getVideoTracks();
          if (!videoTracks || videoTracks.length === 0) {
            // No webcam
            // $('#myvideo').hide();
            // if ($('#videolocal .no-video-container').length === 0) {
            //   $('#videolocal').append(
            //     '<div class="no-video-container">' +
            //     '<i class="fa fa-video-camera fa-5 no-video-icon"></i>' +
            //     '<span class="no-video-text">No webcam available</span>' +
            //     '</div>');
            // }
          } else {
            // $('#videolocal .no-video-container').remove();
            // $('#myvideo').removeClass('hide').show();
          }
        },
        onremotestream: function (stream) {
          console.warn('got remote stream')
          console.log(stream)
          // The publisher stream is sendonly, we don't expect anything here
        },
        oncleanup: function () {
          console.log("video plugin destroyed")
          // Janus.log(" ::: Got a cleanup notification: we are unpublished now :::");
          // mystream = null;
          // $('#videolocal').html('<button id="publish" class="btn btn-primary">Publish</button>');
          // $('#publish').click(function () {
          //   publishOwnFeed(true);
          // });
          // $("#videolocal").parent().parent().unblock();
          // $('#bitrate').parent().parent().addClass('hide');
          // $('#bitrate a').unbind('click');
        }
      });


  }

  newRemoteFeed(id, display, audio, video) {
    // A new feed has been published, create a new plugin handle and attach to it as a subscriber
    var remoteFeed = null;
    this.janus.attach(
      {
        plugin: "janus.plugin.videoroom",
        opaqueId: "12346677",
        success: function (pluginHandle) {
          remoteFeed = pluginHandle;
          remoteFeed.simulcastStarted = false;
          console.log("Plugin attached! (" + remoteFeed.getPlugin() + ", id=" + remoteFeed.getId() + ")");
          console.log("  -- This is a subscriber");
          // We wait for the plugin to send us an offer
          var subscribe = {
            request: "join",
            room: 1234,
            ptype: "subscriber",
            feed: id,
          };
          // In case you don't want to receive audio, video or data, even if the
          // publisher is sending them, set the 'offer_audio', 'offer_video' or
          // 'offer_data' properties to false (they're true by default), e.g.:
          // 		subscribe["offer_video"] = false;
          // For example, if the publisher is VP8 and this is Safari, let's avoid video
          if (JanusJs.webRTCAdapter.browserDetails.browser === "safari" &&
            (video === "vp9" || (video === "vp8" && !JanusJs.safariVp8))) {
            if (video)
              video = video.toUpperCase()
            // toastr.warning("Publisher is using " + video + ", but Safari doesn't support it: disabling video");
            subscribe["offer_video"] = false;
          }
          remoteFeed.videoCodec = video;
          remoteFeed.send({message: subscribe});
        },
        error: function (error) {
          // Janus.error("  -- Error attaching plugin...", error);
          // bootbox.alert("Error attaching plugin... " + error);
        },
        onmessage: function (msg, jsep) {
          console.debug(" ::: Got a message (subscriber) :::", msg);
          var event = msg["videoroom"];
          console.debug("Event: " + event);
          if (msg["error"]) {
            // bootbox.alert(msg["error"]);
          } else if (event) {
            console.log(event)
            if (event === "attached") {
              // Subscriber created and attached
              // for(var i=1;i<6;i++) {
              //   if(!feeds[i]) {
              //     feeds[i] = remoteFeed;
              //     remoteFeed.rfindex = i;
              //     break;
              //   }
              // }
              remoteFeed.rfid = msg["id"];
              remoteFeed.rfdisplay = msg["display"];
              // if (!remoteFeed.spinner) {
              //   var target = document.getElementById('videoremote' + remoteFeed.rfindex);
              //   // remoteFeed.spinner = new Spinner({top:100}).spin(target);
              // } else {
              //   remoteFeed.spinner.spin();
              // }
              console.log("Successfully attached to feed " + remoteFeed.rfid + " (" + remoteFeed.rfdisplay + ") in room " + msg["room"]);
              // $('#remote'+remoteFeed.rfindex).removeClass('hide').html(remoteFeed.rfdisplay).show();
            } else if (event === "event") {
              // Check if we got an event on a simulcast-related event from this publisher
              var substream = msg["substream"];
              var temporal = msg["temporal"];
              if ((substream !== null && substream !== undefined) || (temporal !== null && temporal !== undefined)) {
                if (!remoteFeed.simulcastStarted) {
                  remoteFeed.simulcastStarted = true;
                  // Add some new buttons
                  // addSimulcastButtons(remoteFeed.rfindex, remoteFeed.videoCodec === "vp8" || remoteFeed.videoCodec === "h264");
                }
                // We just received notice that there's been a switch, update the buttons
                // updateSimulcastButtons(remoteFeed.rfindex, substream, temporal);
              }
            } else {
              // What has just happened?
            }
          }
          if (jsep) {
            console.debug("Handling SDP as well...", jsep);
            // Answer and attach
            remoteFeed.createAnswer(
              {
                jsep: jsep,
                // Add data:true here if you want to subscribe to datachannels as well
                // (obviously only works if the publisher offered them in the first place)
                media: {audioSend: false, videoSend: false},	// We want recvonly audio/video
                success: function (jsep) {
                  console.debug("Got SDP!", jsep);
                  var body = {request: "start", room: 1234};
                  remoteFeed.send({message: body, jsep: jsep});
                },
                error: function (error) {
                  console.error("WebRTC error:", error);
                  // bootbox.alert("WebRTC error... " + error.message);
                }
              });
          }
        },
        iceState: function (state) {
          console.log("ICE state of this WebRTC PeerConnection (feed #" + remoteFeed.rfindex + ") changed to " + state);
        },
        webrtcState: function (on) {
          console.log("Janus says this WebRTC PeerConnection (feed #" + remoteFeed.rfindex + ") is " + (on ? "up" : "down") + " now");
        },
        onlocalstream: function (stream) {
          // The subscriber stream is recvonly, we don't expect anything here
        },
        onremotestream: function (stream) {
          // console.debug("Remote feed #" + remoteFeed.rfindex + ", stream:", stream);
          // var addButtons = false;
          console.warn('got remote stream on subscribing channel')
          console.log(stream)
          // if($('#remotevideo'+remoteFeed.rfindex).length === 0) {
          //   addButtons = true;
          // No remote video yet
          // $('#videoremote'+remoteFeed.rfindex).append('<video class="rounded centered" id="waitingvideo' + remoteFeed.rfindex + '" width=320 height=240 />');
          // $('#videoremote'+remoteFeed.rfindex).append('<video class="rounded centered relative hide" id="remotevideo' + remoteFeed.rfindex + '" width="100%" height="100%" autoplay playsinline/>');
          // $('#videoremote'+remoteFeed.rfindex).append(
          //   '<span class="label label-primary hide" id="curres'+remoteFeed.rfindex+'" style="position: absolute; bottom: 0px; left: 0px; margin: 15px;"></span>' +
          //   '<span class="label label-info hide" id="curbitrate'+remoteFeed.rfindex+'" style="position: absolute; bottom: 0px; right: 0px; margin: 15px;"></span>');
          // Show the video, hide the spinner and show the resolution when we get a playing event
          // $("#remotevideo"+remoteFeed.rfindex).bind("playing", function () {
          //   if(remoteFeed.spinner)
          //     remoteFeed.spinner.stop();
          //   remoteFeed.spinner = null;
          // $('#waitingvideo'+remoteFeed.rfindex).remove();
          // if(this.videoWidth)
          //   $('#remotevideo'+remoteFeed.rfindex).removeClass('hide').show();
          var width = this.videoWidth;
          var height = this.videoHeight;
          // $('#curres'+remoteFeed.rfindex).removeClass('hide').text(width+'x'+height).show();
          // // if(Janus.webRTCAdapter.browserDetails.browser === "firefox") {
          // //   // Firefox Stable has a bug: width and height are not immediately available after a playing
          // //   setTimeout(function() {
          // //     var width = $("#remotevideo"+remoteFeed.rfindex).get(0).videoWidth;
          // //     var height = $("#remotevideo"+remoteFeed.rfindex).get(0).videoHeight;
          // //     $('#curres'+remoteFeed.rfindex).removeClass('hide').text(width+'x'+height).show();
          // //   }, 2000);
          // }
          // });
          // }
          // let vid=<HTMLVideoElement>(document.getElementById('remote_stream1'))
          // vid.srcObject=stream/
          JanusJs.attachMediaStream(document.getElementById('remote_stream1'), stream);
          var videoTracks = stream.getVideoTracks();
          if (!videoTracks || videoTracks.length === 0) {
            // No remote video
            // $('#remotevideo'+remoteFeed.rfindex).hide();
            // if($('#videoremote'+remoteFeed.rfindex + ' .no-video-container').length === 0) {
            //   $('#videoremote'+remoteFeed.rfindex).append(
            //     '<div class="no-video-container">' +
            //     '<i class="fa fa-video-camera fa-5 no-video-icon"></i>' +
            //     '<span class="no-video-text">No remote video available</span>' +
            //     '</div>');
          }
          //  else {
          //   // $('#videoremote'+remoteFeed.rfindex+ ' .no-video-container').remove();
          //   // $('#remotevideo'+remoteFeed.rfindex).removeClass('hide').show();
          // }
          // if(!addButtons)
          //   return;
          // if(Janus.webRTCAdapter.browserDetails.browser === "chrome" || Janus.webRTCAdapter.browserDetails.browser === "firefox" ||
          //   Janus.webRTCAdapter.browserDetails.browser === "safari") {
          //   // $('#curbitrate'+remoteFeed.rfindex).removeClass('hide').show();
          //   // bitrateTimer[remoteFeed.rfindex] = setInterval(function() {
          //   //   // Display updated bitrate, if supported
          //   //   var bitrate = remoteFeed.getBitrate();
          //   //   $('#curbitrate'+remoteFeed.rfindex).text(bitrate);
          //   //   // Check if the resolution changed too
          //   //   var width = $("#remotevideo"+remoteFeed.rfindex).get(0).videoWidth;
          //   //   var height = $("#remotevideo"+remoteFeed.rfindex).get(0).videoHeight;
          //   //   // if(width > 0 && height > 0)
          //   //     // $('#curres'+remoteFeed.rfindex).removeClass('hide').text(width+'x'+height).show();
          //   // }, 1000);
          // }
        },
        oncleanup: function () {
          console.log(" ::: Got a cleanup notification (remote feed " + id + ") :::");
          // if (remoteFeed.spinner)
          //   remoteFeed.spinner.stop();
          // remoteFeed.spinner = null;
          // $('#remotevideo'+remoteFeed.rfindex).remove();
          // $('#waitingvideo'+remoteFeed.rfindex).remove();
          // $('#novideo'+remoteFeed.rfindex).remove();
          // $('#curbitrate'+remoteFeed.rfindex).remove();
          // $('#curres'+remoteFeed.rfindex).remove();
          // if(bitrateTimer[remoteFeed.rfindex])
          //   clearInterval(bitrateTimer[remoteFeed.rfindex]);
          // bitrateTimer[remoteFeed.rfindex] = null;
          // remoteFeed.simulcastStarted = false;
          // $('#simulcast'+remoteFeed.rfindex).remove();
        }
      });
  }

  sendData(roomId, msg) {

    var message = {
      textroom: "message",
      transaction: "ggvfccrcrcrc",
      room: roomId,
      text: msg,
    };
    // Note: messages are always acknowledged by default. This means that you'll
    // always receive a confirmation back that the message has been received by the
    // server and forwarded to the recipients. If you do not want this to happen,
    // just add an ack:false property to the message above, and server won't send
    // you a response (meaning you just have to hope it succeeded).
    this.textRoom.data({
      text: JSON.stringify(message),
      error: (reason) => {
        console.error(reason)
      },
      success: () => {
        console.log('msg sent')
      }
    });
  }

  attachTextRoomPlugin() {
    this.janus.attach(
      {
        opaqueId: "testroom1234",
        plugin: "janus.plugin.textroom",
        success: (pluginHandle: PluginHandle) => {
          console.log(pluginHandle)
          this.textRoom = pluginHandle;
          pluginHandle.send(<PluginMessage>{
            message: {request: "setup"},
          })
          // Plugin attached! 'pluginHandle' is our handle
        },
        ondataopen: (open) => {
          //initiating joining to room
          var register = {
            textroom: "join",
            transaction: "1234567random",
            /*
            *by default janus create demo room with id 1234. we can create more using
            * POST:- http://127.0.0.1:8088/janus/<session_id>/<handle_id>
            * {
              "janus":"message",
               "transaction":"cbcdbscjbcjscv",
              "body":{
                  "request":"create",
                  "room":5734113183535872,
                  "textroom" : "list",
                  "description" : "hello",
                  "is_private" : false,
                  "permanent" : false
              }
          }
            *
            *
            *
            * */
            room: 1234,
            username: "shivansh",
            display: "shivansh"
          };
          this.textRoom.data({
            text: JSON.stringify(register), error: (e) => {
              console.log(e)
            }
          })
          this.sendData(1234, "hey bro")
        },
        ondata: (data) => {
          var json = JSON.parse(data);
          console.log(data)
        },
        error: (cause) => {
          // Couldn't attach to the plugin
        },
        consentDialog: (on) => {
          // e.g., Darken the screen if on=true (getUserMedia incoming), restore it otherwise
        },
        onmessage: (msg, jsep) => {
          console.log(msg)
          // janus.debug(" ::: Got a message :::", msg);
          // console.log(msg)
          // if(msg.error) {
          //   console.error(msg.error);
          // }
          if (jsep) {
            //   // Answer
            this.textRoom.createAnswer(
              {
                jsep: jsep,
                media: {audio: false, video: false, data: true},	// We only use datachannels
                success: (jsep) => {
                  // JanusJs.debug("Got SDP!", jsep);
                  var body = {request: "ack"};
                  this.textRoom.send({message: body, jsep: jsep});
                },
                error: (error) => {
                  // janus.error("WebRTC error:", error);
                  console.error("WebRTC error... " + error.message);
                }
              });
          }
          // We got a message/event (msg) from the plugin
          // If jsep is not null, this involves a WebRTC negotiation
        },
        onlocalstream: (stream) => {
          // We have a local stream (getUserMedia worked!) to display
        },
        onremotestream: (stream) => {
          // We have a remote stream (working PeerConnection!) to display
        },
        oncleanup: () => {
          // PeerConnection with the plugin closed, clean the UI
          // The plugin handle is still valid so we can create a new one
        },
        detached: () => {
          console.log("plugin detached")
          // Connection with the plugin closed, get rid of its features
          // The plugin handle is not valid anymore
        },
      });

  }


  async ngOnInit(): Promise<void> {


    JanusJs.init(<InitOptions>{
      debug: true,
      dependencies: JanusJs.useDefaultDependencies({
        adapter: WebRTCAdapter
      }), // or: Janus.useOldDependencies() to get the behaviour of previous Janus versions
      callback: () => {
        console.log("setup ready!")
      }
    });
    this.janus = new JanusJs(
      <ConstructorOptions>{
        apisecret: "SecureIt",
        token: "",
        withCredentials: false,
        iceServers: [<RTCIceServer>{
          username: "onemandev",
          credential: "SecureIt",
          urls: ["stun:onemandev.tech:3478", "turn:onemandev.tech:3478"],
          //   //  use coturn docker for ice servers
        }],
        //g
        server: ['ws://104.45.152.100:37457','http://104.45.152.100:55493/janus'],
        success: () => {
          // this.attachTextRoomPlugin();
          this.attachVideoPlugin();
        },
        error: (cause) => {
          // Error, can't go on...
          console.log(cause)
        },
        destroyed: () => {
          // I should get rid of this
        }
      });


  }
}
