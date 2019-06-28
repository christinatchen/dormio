//bluetooth stuff
log = function(str) {
  console.log('[' + new Date().toUTCString() + '] ' + str);
}

//declare vars
var fileReadOutput = "";
var fileParseOutput = "";

var nextWakeupTimer = null;
var wakeups = 0;

var hypnaDepth = {
  'light' : 30,
  'medium' : 60,
  'deep' : 90
}
var defaults = {
  "time-until-sleep": 600,
  "time-between-sleep" : 340,
  "hypna-latency" : hypnaDepth['light'],
  "loops" : 3,
  "recording-time" : 30
}

var num_threads = 2;
var MT = new Multithread(num_threads);

var nowDateObj;
var nowDate;
var nowTime;

var playedPrompt = null;

function firstWakeup(){

  if (prompt_msg_recording != null) {
      prompt_msg_player = new Audio(prompt_msg_recording.url)
      prompt_msg_player.play()
      playedPrompt = true;
    }

    var thing = parseInt($("#hypna-latency").val());


  var nextWakeupTimer = setTimeout(function(){
    startWakeup();
  }, (thing + 10) * 1000);

}

//wake up
function startWakeup() {
  //change button color
  $("#wakeup").css("background-color", "rgba(0, 255, 0, .4)");

  //increment wakeups and log
  wakeups += 1;
  log("startWakeup #" + wakeups + "/" + $("#loops").val())

  //record wakeup event onto files
  if (recording) {
    nowDateObj = new Date();
    nowTime = nowDateObj.getHours() + ":" + nowDateObj.getMinutes() + ":" + nowDateObj.getSeconds();

    fileReadOutput += "EVENT,wakeup | " + nowTime + "\n";
    fileParseOutput += "EVENT,wakeup|"

  }

  //play wake up report message
  if(wakeup_msg_recording != null){
      wakeup_msg_player = new Audio(wakeup_msg_recording.url)
      wakeup_msg_player.play()

      //record dream report
      wakeup_msg_player.onended = () => {
          startRecording("dream_"+wakeups+"_"+new Date().toISOString() + '.mp3', "dream");
      }
  }

  //end wake-up after recording time is over
  nextWakeupTimer = setTimeout(function() {
    endWakeup();
  }, parseInt($("#recording-time").val()) * 1000);
}

//end wakeup
function endWakeup() {

  //change button color
  $("#wakeup").css("background-color", "rgba(0, 0, 0, .1)")

  //log end
  log("endWakeup #" + wakeups + "/" + $("#loops").val())
  
  //stop recording dream report
  if (wakeup_msg_recording) {
    stopRecording();
  }

  //if incomplete #loops, play go to sleep message
  if (wakeups < parseInt($("#loops").val())) {
    if (prompt_msg_recording != null) {
      prompt_msg_player = new Audio(prompt_msg_recording.url)
      prompt_msg_player.play()
    }

    //do next wakeup after time between sleeps
    nextWakeupTimer = setTimeout(function() {
      startWakeup();
    }, parseInt($("#time-between-sleep").val()) * 1000);

    //if completed all loops, alarm and end session
  } else {
    gongs = 0;
    gong.play();

    nextWakeupTimer = setTimeout(function() {
      endSession();
    }, 4000);
  }
}


//end session
function endSession() {

  //hide buttons
  $("#session_buttons").hide();
  $("#start_buttons").show();
  recording = false;

  nowDateObj = new Date();
  nowTime = nowDateObj.getHours() + ":" + nowDateObj.getMinutes() + ":" + nowDateObj.getSeconds();
  fileReadOutput += "-------------------------------\nSession End: " + nowTime;

  //zip folders
  var prefix = $("#dream-subject").val()
  var zip = new JSZip();
  var audioZipFolder = zip.folder("audioRecordings")
  zip.file(prefix + ".raw.read.txt", fileReadOutput);
  zip.file(prefix + '.raw.txt', fileParseOutput);

  //add recordings to files
  if (wakeup_msg_recording) {
    audioZipFolder.file(wakeup_msg_recording.filename, wakeup_msg_recording.blob)
  }
  if (prompt_msg_recording) {
    audioZipFolder.file(prompt_msg_recording.filename, prompt_msg_recording.blob)
  }
  for (var audioRec of audio_recordings) {
    console.log("zipping: ",audioRec)
    audioZipFolder.file(audioRec.filename, audioRec.blob)
  }
  zip.generateAsync({type:"blob"})
  .then(function(content) {
      // see FileSaver.js
      saveAs(content, prefix + ".zip");
  });

  log("End Session");

  $("#dream-subject").prop('disabled', false);
  for (var key in defaults) {
    $("#" + key).prop('disabled', false);
  }
}

var recording = false;
var isConnected = false;

var wakeup_msg_recording, prompt_msg_recording;
var audio_recordings = []

var is_recording_wake = false;
var is_recording_prompt = false;

var gongs = 0;
var gong = new Audio('audio/gong.wav');
gong.addEventListener('ended',function() {
  gongs += 1;
  if (gongs < 3) {
    gong.play()
  }
})

$(function(){
  $("#session_buttons").hide();

  $("#hypna-depth").change(function() {
    $("#hypna-latency").val(hypnaDepth[this.value]);
  })

  for (var key in defaults){
    $("#" + key).val(defaults[key]);
  }


  $("#record-wakeup-message").click(function() {
    if(!is_recording_wake) {
      console.log("starting to record wake message")
      $('#record-wakeup-message').val("Stop")
      startRecording("wakeup.mp3", "wakeup")
      is_recording_wake = true;
    } else {
      $('#record-wakeup-message').val("Record")
      stopRecording()
      is_recording_wake = false;
    }
  });

  $("#record-prompt-message").click(function() {
    if(!is_recording_prompt) {
      console.log("starting to record sleep message")
      $('#record-prompt-message').val("Stop")
      startRecording("prompt.mp3", "prompt")
      is_recording_prompt = true;
    } else {
      $('#record-prompt-message').val("Record")
      stopRecording()
      is_recording_prompt = false;
    }
  });


  $("#start_timer").click(function(){
   
        // Validations
    
    //if dream subject is empty, alert
    if ($.trim($("#dream-subject").val()) == '') {
      alert('Have to fill Dream Subject!');
      recording = !recording;
      return;
    }

    //if any fields are empty, alert
    for (var key in defaults) {
      var tag = "#" + key;

      //get number value of input field
      var thing = parseInt($(tag).val());

      //if it isn't a number, alert user
      if (isNaN(+(thing))){
      	 console.log("field not filled");
      	 alert('Have to fill a valid ' + key);
      	 recording = !recording;
      	 return;
      }
    }

    if recordings are null
    if ((sleep_msg_recording == null)){
    	alert ('Please record a prompt message');
    	recording != recording;
    	return;
    }

    //if recordings are null
    if ((wakeup_msg_recording == null)){
    	alert ('Please record a wakeup message');
    	recording != recording;
    	return;
    }

    $("#dream-subject").prop('disabled', true);
    for (var key in defaults) {
      $("#" + key).prop('disabled', true);
    }

    $("#start_buttons").hide();
    $("#session_buttons").show();

    recording = true;

    nowDateObj = new Date();
    nowDate = nowDateObj.getFullYear()+'-'+(nowDateObj.getMonth()+1)+'-'+nowDateObj.getDate();
    nowTime = nowDateObj.getHours() + ":" + nowDateObj.getMinutes() + ":" + nowDateObj.getSeconds();

    fileReadOutput = $("#dream-subject").val() + "||||" + nowDate + "\n";
    fileParseOutput = $("#dream-subject").val() + "||||"


    log("Start Session");

    fileReadOutput += "Session Start: " + nowTime + "\n---------------------------------------------------\n";

    playPrompt();
    //}

    nextWakeupTimer = setTimeout(function() {
      firstWakeup();
    }, parseInt($("#time-until-sleep").val()) * 1000);
  });

  $("#stop_session").click(function(){
    endSession();
  });


  $("#wakeup").click(function() {
    startWakeup();
  })

});

//event tagging
document.addEventListener('keydown', function (event) {
  if (event.defaultPrevented) {
    return;
  }

  var key = event.key || event.keyCode;

  if (key === 'a' || key === 'b' || key === 'c'){
    nowDateObj = new Date();
    nowTime = nowDateObj.getHours() + ":" + nowDateObj.getMinutes() + ":" + nowDateObj.getSeconds();

    fileReadOutput += "EVENT " + key + " | " + nowTime + "\n";
    fileParseOutput += "EVENT," + key + "|";

    }
});


var gumStream; //stream from getUserMedia()

var recorder; //WebAudioRecorder object

var input; //MediaStreamAudioSourceNode we'll be recording var encodingType;

var encodeAfterRecord = true; // waits until recording is finished before encoding to mp3

var audioContext;//new audio context to help us record

function startRecording(filename, mode = "dream") {

  var constraints = {
      audio: true,
      video: false
  }

  navigator.mediaDevices.getUserMedia(constraints).then(function(stream) {
   audioContext  = new AudioContext;

   gumStream = stream;
   /* use the stream */
   input = audioContext.createMediaStreamSource(stream);
   //stop the input from playing back through the speakers
   //input.connect(audioContext.destination) //get the encoding
   //disable the encoding selector
   recorder = new WebAudioRecorder(input, {
       workerDir: "js/",
       encoding: "mp3",
   });

   recorder.setOptions({
      timeLimit: 480,
      encodeAfterRecord: encodeAfterRecord,
      ogg: {
          quality: 0.5
      },
      mp3: {
          bitRate: 160
      }
  });


   recorder.onComplete = function(recorder, blob) {
      console.log("Recording.oncCmplete called")
      audioRecording = getAudio(blob, recorder.encoding, filename);

      if (mode == "wakeup") {
        wakeup_msg_recording = audioRecording
        console.log("wakeup_msg_recording is now: ", wakeup_msg_recording)
        new Audio(audioRecording.url).play()
      } else if (mode == "sleep") {
        prompt_msg_recording = audioRecording
        console.log("prompt_msg_recording is now: ", prompt_msg_recording)
        new Audio(audioRecording.url).play()
      } else {
        console.log("pushed new dream recording: ", audioRecording)
        audio_recordings.push(audioRecording);
      }
  }
      recorder.startRecording();
  console.log("Audio Recording Started");
  }).catch(function(err) {
  console.log("error", err);
  });
}

function stopRecording() {
    //stop microphone access
    gumStream.getAudioTracks()[0].stop();
    //tell the recorder to finish the recording (stop recording + encode the recorded audio)
    recorder.finishRecording();

    console.log("Audio Recording Stopped");
}

function getAudio(blob, encoding, filename) {
    var url = URL.createObjectURL(blob);
    console.log("filename is:", filename )
    // audioZip.file(filename, blob);
    audioRecording = {"blob":blob, "encoding": encoding, "filename":filename, "url":url}
    return audioRecording;
}

//Plays the sound
function play(url) {
  new Audio(url).play();
}