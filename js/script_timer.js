log = function(str) {
  console.log('[' + new Date().toUTCString() + '] ' + str);
}

//declare vars
var fileReadOutput = "";
var fileParseOutput = "";

var nextWakeupTimer = null;
var wakeups = 0;

var defaults = {
  "loops" : 3,
  "hypna-latency" : 3,
  "time-until-sleep-min": 10,
  "time-until-sleep-max": 15,
  "time-between-sleep" : 7,
  "recording-time" : 60
}

var num_threads = 2;
var MT = new Multithread(num_threads);

var nowDateObj;
var nowDate;
var nowTime;

var timeUntilSleep;
var timeBetweenSleep;
var hypnaLatency;
var recordingTime;
var loops;

var recording = false;
var isConnected = false;

var wakeup_msg_recording, sleep_msg_recording;
var audio_recordings = []

var is_recording_wake = false;
var is_recording_sleep = false;

// ==================================================
//        on page load, do this
//==================================================

$(function(){

  //hide currently unnecessary components
  $("#before-timer").hide();
  $("#loop-clock-container").hide();
  $("#session-buttons").hide();
  $("#new-button").hide();

  //pull out form 
  setTimeout(openForm, 1000);

  //populate the form with default elements
  for (var key in defaults){
    $("#" + key).val(defaults[key]);
  }

  //make record sleep buttons work

    $("#record-sleep-message").click(function() {

    if(!is_recording_sleep) {
      console.log("starting to record sleep message");
      document.getElementById("record-sleep-message").style.background = "rgba(255, 0, 0, 0.3)";
      $('#record-sleep-message').val("stop");
      startRecording("sleep.mp3", "sleep");
      is_recording_sleep = true;

    } else {
      $('#record-sleep-message').val("record");
      document.getElementById("record-sleep-message").style.background = "transparent";
      stopRecording();
      is_recording_sleep = false;
    }
     });

    $("#listen-sleep-message").click(function() {
      playPrompt();
  });

  $("#clear-sleep-message").click(function() {
    sleep_msg_recording = null;
  });

  //make record wakeup buttons work
   $("#record-wakeup-message").click(function() {
    if(!is_recording_wake) {
      console.log("starting to record wake message");
      document.getElementById("record-wakeup-message").style.background = "rgba(255, 0, 0, 0.3)";
      $('#record-wakeup-message').val("stop");
      startRecording("wakeup.mp3", "wakeup");
      is_recording_wake = true;
    } else {
      $('#record-wakeup-message').val("record")
      document.getElementById("record-wakeup-message").style.background = "transparent";
      stopRecording();
      is_recording_wake = false;
    }
  });

  $("#listen-wakeup-message").click(function() {
        if(wakeup_msg_recording != null){
      wakeup_msg_player = new Audio(wakeup_msg_recording.url);
      wakeup_msg_player.play();
    }
  });

  $("#clear-wakeup-message").click(function() {
    wakeup_msg_recording = null;
});

// ==========================================================================

//        when start timer button is pressed, do this

//===========================================================================

$("#start_button").click(function(){
    
    // Validations that everything is filled!

    
    //if dream subject is empty, alert user

    if ($.trim($("#dream-subject").val()) == '') {
      alert('Please fill in a dream subject.');
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
        alert('Please fill in a valid ' + key + ".");
        recording = !recording;
        return;
      }
    }

    // if recordings are empty, alert user

    if ((sleep_msg_recording == null)){
      alert ('Please record a prompt message');
      recording != recording;
      return;
    }

    if ((wakeup_msg_recording == null)){
      alert ('Please record a wakeup message');
      recording != recording;
      return;
    }


    //if it passes above, everything is filled in correctly, so we can begin!!


    //disable the input fields during the session
    $("#dream-subject").prop('disabled', true);
    for (var key in defaults) {
      $("#" + key).prop('disabled', true);
    }

    //hide the start button so people don't click it again if they ever open the form
    $("#start-button-container").hide();

    //roll back the complete form to the side
    setTimeout(closeForm, 1000);

    //hide timer and display go to sleep message instead
    $("#countdown-timer").hide();
    $("#before-timer").show();

    //get the time and date of the click to write the start date/time
    nowDateObj = new Date();
    nowDate = nowDateObj.getFullYear()+'-'+(nowDateObj.getMonth()+1)+'-'+nowDateObj.getDate();
    nowTime = nowDateObj.getHours() + ":" + nowDateObj.getMinutes() + ":" + nowDateObj.getSeconds();

    //write the date and time to necessary files
    fileReadOutput = $("#dream-subject").val() + "||||" + nowDate + "\n";
    fileParseOutput = $("#dream-subject").val() + "||||";
    log("Start Session");
    fileReadOutput += "Session Start: " + nowTime + "\n---------------------------------------------------\n";

    //start recording
    recording = true;

    //parse the user's time until sleep
    var timeUntilSleepMin = parseInt($("#time-until-sleep-min").val());
    var timeUntilSleepMax = parseInt($("#time-until-sleep-max").val());

    //pick random number in the range they provided
    var timeUntilSleepRandom = getRandomInt(timeUntilSleepMin, timeUntilSleepMax); 
    console.log("random chosen time: " + timeUntilSleepRandom);

    //convert to seconds for the code to handle
    timeUntilSleep = timeUntilSleepRandom * 60;
   // console.log(timeUntilSleep);
    
    //convert to a string for the countdown timer

    if (timeUntilSleepRandom > 61){
    	var timeUntilSleepDecimal = timeUntilSleepRandom/60 + "";

    	var timeUntilSleepNum = Math.round(10 * timeUntilSleepDecimal)/10 + "";

    	var res = timeUntilSleepNum.split(".");

  	  	var hrString = res[0];

  	  	var minString = "0." + res[1];
  	  	console.log("minString" + minString)

  	  	var minNum = parseFloat(minString) * 60;
  	  	console.log("minNum" + minNum);


   		var timeUntilSleepString = hrString + ":" + minNum + ":00";

	}else{

		var timeUntilSleepString = "00:" + timeUntilSleepRandom + ":00";
	}
    

    console.log(timeUntilSleepString);

    //parse time between sleep and convert to seconds
    var timeBetweenSleepMin = parseInt($("#time-between-sleep").val());
    timeBetweenSleep = timeBetweenSleepMin * 60;

    //parse hypna latency, recording time and #loops
    hypnaLatency = parseInt($("#hypna-latency").val()) * 60;
    recordingTime = parseInt($("#recording-time").val()); 
    loops = parseInt($("#loops").val());

    //show start timer after a minute to give user time to lay down 
    var startTimer = setTimeout(function() {
      $("#before-timer").hide();
      $("#countdown-timer").show(); 
      initTimer(timeUntilSleepString);
      $("#session-buttons").show();
    }, 60 * 1000);

    //play prompt
    playPrompt();

    nextWakeupTimer = setTimeout(function() {
      firstWakeup();
    }, timeUntilSleep * 1000);
  });

function playPrompt(){

    log("playPrompt");

    //play prompt again
    if (sleep_msg_recording != null) {
      sleep_msg_player = new Audio(sleep_msg_recording.url);
      sleep_msg_player.play();
    }else{
    	console.log(sleep_msg_recording);
    	console.log("no sleep recording");
    }
}

function firstWakeup(){

  //hide the first countdown timer
  $("#countdown-timer").hide();

  //show the loop-clock
  $("#loop-clock-container").show();
  document.getElementById("loops-remaining").innerHTML = "<h3>dreams left to catch: " + loops + "</h3>";

  drawChart();
  playPrompt();

  var nextWakeupTimer = setTimeout(function(){
    startWakeup();
  }, (hypnaLatency) * 1000);

}

//wake up
function startWakeup() {
  // //change button color
  // $("#wakeup").css("background-color", "rgba(0, 255, 0, .4)");

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
  }, recordingTime * 1000);
}

//end wakeup
function endWakeup() {

  //change button color
  // $("#wakeup").css("background-color", "rgba(0, 0, 0, .1)")

  //log end
  log("endWakeup #" + wakeups + "/" + $("#loops").val())
  
  //stop recording dream report
  if (wakeup_msg_recording) {
    stopRecording();
  }

  //if incomplete #loops, play go to sleep message
  if (wakeups < loops) {
    playPrompt();

    document.getElementById("loops-remaining").innerHTML = "<h3>dreams left to catch: " + (loops-wakeups) + "</h3>";


    //do next wakeup after time between sleeps
    nextWakeupTimer = setTimeout(function() {
      startWakeup();
    }, timeBetweenSleep * 1000);

    //if completed all loops, alarm and end session
  } else {
  	  document.getElementById("tick").style = 'animation: none';

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
  $("#session-buttons").hide();
  $("#countdown-timer").hide();
  $("#loop-clock-container").hide();

  console.log("hidden");

  $("#new-button").show();

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
  if (sleep_msg_recording) {
    audioZipFolder.file(sleep_msg_recording.filename, sleep_msg_recording.blob)
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
}

var gongs = 0;
var gong = new Audio('audio/gong.wav');
gong.addEventListener('ended',function() {
  gongs += 1;
  if (gongs < 3) {
    gong.play()
  }
})


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
      console.log("Recording.onComplete called")
      audioRecording = getAudio(blob, recorder.encoding, filename);

      if (mode == "wakeup") {
        wakeup_msg_recording = audioRecording
        console.log("wakeup_msg_recording is now: ", wakeup_msg_recording)
        new Audio(audioRecording.url).play()

      } else if (mode == "sleep") {
        sleep_msg_recording = audioRecording
        console.log("sleep_msg_recording is now: ", sleep_msg_recording)
        new Audio(audioRecording.url).play()

      } else {
        console.log("pushed new dream recording: ", audioRecording)
        audio_recordings.push(audioRecording);
      }

      console.log(sleep_msg_recording);
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

//define the chart package
//google.charts.load('current', {'packages':['corechart']});
//set what is supposed to happen when the page loads. You typically want a state of the chart to show on load, but in this case, there is no data on load.
//google.charts.setOnLoadCallback(drawChart);
     
//submit requires text inputs to use parseInt to work as numbers

function drawChart() {
  hyp = parseInt(document.getElementById('hypna-latency').value);
  rc = parseInt(document.getElementById('recording-time').value);
  tbs = parseInt(document.getElementById('time-between-sleep').value);

  //get the full number of minutes for the loop
  fullClock = hypnaLatency + recordingTime + timeBetweenSleep;
  
  document.getElementById("tick").style = 'animation: rotate ' + fullClock + 's infinite linear';

  //replace data with variable names
  var data = google.visualization.arrayToDataTable([
    ['Cycle', 'Sleep'],
    ['hypna latency',     hypnaLatency],
    ['recording time',     recordingTime],
    ['time between sleep',  timeBetweenSleep],
        ]);
    var options = {
      backgroundColor: "transparent",
      // legend: '{position: 'labeled'}',
      legend: 'none',
      pieSliceText: 'label',
      pieSliceTextStyle: {color: 'white', fontName: "Arial" , fontSize: "12"},
      chartArea: {width:'80%',height:'85%'},
      colors: ['#330036', '#4F0333','#4C0F47'],
      // enableInteractivity: false
        };
    
    //the id is the DOM location to draw the chart    
    var chart = new google.visualization.PieChart(document.getElementById('loop-clock'));
    chart.draw(data, options);
  }


TweenLite.defaultEase = Expo.easeOut;

var reloadBtn = document.querySelector('.reload');

var timerEl = document.querySelector('.timer');

function initTimer (t) {
   
   var self = this,
       timerEl = document.querySelector('.timer'),
       hoursGroupEl = timerEl.querySelector('.hours-group'),
       minutesGroupEl = timerEl.querySelector('.minutes-group'),
       secondsGroupEl = timerEl.querySelector('.seconds-group'),

       hoursGroup = {
       		firstNum: hoursGroupEl.querySelector('.first'),
       		secondNum: hoursGroupEl.querySelector('.second')
       },

       minutesGroup = {
          firstNum: minutesGroupEl.querySelector('.first'),
          secondNum: minutesGroupEl.querySelector('.second')
       },

       secondsGroup = {
          firstNum: secondsGroupEl.querySelector('.first'),
          secondNum: secondsGroupEl.querySelector('.second')
       };

   var time = {
   	  hr: t.split(':')[0],
      min: t.split(':')[1],
      sec: t.split(':')[2]
   };

   var timeNumbers;

   function updateTimer() {

      var timestr;
      var date = new Date();

      date.setHours(time.hr);
      date.setMinutes(time.min);
      date.setSeconds(time.sec);

      var newDate = new Date(date.valueOf() - 1000);

      var temp = newDate.toTimeString().split(" ");

      var tempsplit = temp[0].split(':');

      time.hr = tempsplit[0];
      time.min = tempsplit[1];
      time.sec = tempsplit[2];

      timestr = time.hr + time.min + time.sec + '';
      timeNumbers = timestr.split('');
      updateTimerDisplay(timeNumbers);

      if(timestr === '000000')
         countdownFinished();

      if(timestr != '000000')
         setTimeout(updateTimer, 1000);

   }

   function updateTimerDisplay(arr) {

      animateNum(hoursGroup.firstNum, arr[0]);
      animateNum(hoursGroup.secondNum, arr[1]);
      animateNum(minutesGroup.firstNum, arr[2]);
      animateNum(minutesGroup.secondNum, arr[3]);
      animateNum(secondsGroup.firstNum, arr[4]);
      animateNum(secondsGroup.secondNum, arr[5]);

   }

   function animateNum (group, arrayValue) {

      TweenMax.killTweensOf(group.querySelector('.number-grp-wrp'));
      TweenMax.to(group.querySelector('.number-grp-wrp'), 1, {
         y: - group.querySelector('.num-' + arrayValue).offsetTop
      });

   }
   
   setTimeout(updateTimer, 1000);

}

function countdownFinished() {
   setTimeout(function () {
      TweenMax.set(reloadBtn, { scale: 0.8, display: 'block' });
      TweenMax.to(timerEl, 1, { opacity: 0.2 });
      TweenMax.to(reloadBtn, 0.5, { scale: 1, opacity: 1 }); 
   }, 1000);
}

function countdownStopped() {
   console.log(timeNumbers);
}

function openForm() {
  $("#other").hide();
  document.getElementById("userform").style.width = "100%";
  setTimeout(function(){
    $("#opener").hide();
    showCloser();
  }, 500);
}

function showCloser(){
  document.getElementById("closer").style.display = "flex";
  document.getElementById("closer").style.position = "fixed";
  document.getElementById("closer").style.property = "justify-content: center";
}

function closeForm() {
  document.getElementById("userform").style.width = "0%";
  document.getElementById("closer").style.display = "none";
  setTimeout(function(){
    $("#other").show();
    $("#opener").show();
  }, 300);
}

function getRandomInt(min, max) {
    min = Math.ceil(min);
    max = Math.floor(max);
    return Math.floor(Math.random() * (max - min + 1)) + min;
}