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
  "loops" : 3,
  "hypna-latency" : 45,
  "time-until-sleep": 15,
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

function firstWakeup(){

  $("#timer").hide();
  $("#loop-clock-stuff").show();
  console.log("did it work?")
  //document.getElementById("loops-remaining").innerHTML = "dreams left to catch: " + loops;
  drawChart();
  playPrompt();

  var nextWakeupTimer = setTimeout(function(){
    startWakeup();
  }, (hypnaLatency) * 1000);

}

function playPrompt(){

    log("playPrompt");

    //play prompt again
		if (sleep_msg_recording != null) {
      sleep_msg_player = new Audio(sleep_msg_recording.url)
      sleep_msg_player.play()
    }
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
  }, recordingTime * 1000);
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
  if (wakeups < loops) {
    if (sleep_msg_recording != null) {
      sleep_msg_player = new Audio(sleep_msg_recording.url)
      sleep_msg_player.play()
    }

    //document.getElementById("loops-remaining").innerHTML = "dreams left to catch: " + (loops-wakeups);


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

  $("#dream-subject").prop('disabled', false);
  for (var key in defaults) {
    $("#" + key).prop('disabled', false);
  }
}

var recording = false;
var isConnected = false;

var wakeup_msg_recording, sleep_msg_recording;
var audio_recordings = []

var is_recording_wake = false;
var is_recording_sleep = false;

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
  $("#loop-clock-stuff").hide();

  //initTimer("0000"); // other ways --> "0:15" "03:5" "5:2"

  for (var key in defaults){
    $("#" + key).val(defaults[key]);
  }


   $("#record-wakeup-message").click(function() {
    if(!is_recording_wake) {
      console.log("starting to record wake message");
      document.getElementById("recording-circle-wakeup").style.background = "rgba(255, 0, 0, 0.5)";
      $('#record-wakeup-message').val("stop");
      startRecording("wakeup.mp3", "wakeup");
      is_recording_wake = true;
    } else {
      $('#record-wakeup-message').val("record")
      document.getElementById("recording-circle-wakeup").style.background = "rgba(0, 0, 0, 0.1)";
      stopRecording();
      is_recording_wake = false;
    }
  });

  $("#listen-wakeup-message").click(function() {
        if(wakeup_msg_recording != null){
      wakeup_msg_player = new Audio(wakeup_msg_recording.url)
      wakeup_msg_player.play()
    }
  });

  $("#clear-wakeup-message").click(function() {
    wakeup_msg_recording = null;
  });

  $("#record-sleep-message").click(function() {
    if(!is_recording_sleep) {
      console.log("starting to record sleep message");
      document.getElementById("recording-circle-sleep").style.background = "rgba(255, 0, 0, 0.5)";
      $('#record-sleep-message').val("stop");
      startRecording("sleep.mp3", "sleep");
      is_recording_sleep = true;
    } else {
      $('#record-sleep-message').val("record");
      document.getElementById("recording-circle-sleep").style.background = "rgba(0, 0, 0, 0.1)";
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

  $("#start_timer").click(function(){
    // Validations
    
    //if dream subject is empty, alert
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

    //if recordings are null
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

    var timeUntilSleepMin = parseInt($("#time-until-sleep").val());
    timeUntilSleep = timeUntilSleepMin * 60;
    
    var timeUntilSleepString = timeUntilSleepMin + ":00";
    console.log(timeUntilSleepString);

    var timeBetweenSleepMin = parseInt($("#time-between-sleep").val());
    timeBetweenSleep = timeBetweenSleepMin * 60;


    hypnaLatency = parseInt($("#hypna-latency").val());
    recordingTime = parseInt($("#recording-time").val()); 

    loops = parseInt($("#loops").val());
 

    log("Start Session");

    fileReadOutput += "Session Start: " + nowTime + "\n---------------------------------------------------\n";

    initTimer(timeUntilSleepString);
    console.log('why');

    playPrompt();

    nextWakeupTimer = setTimeout(function() {
      firstWakeup();
    }, timeUntilSleep * 1000);
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
        sleep_msg_recording = audioRecording
        console.log("sleep_msg_recording is now: ", sleep_msg_recording)
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

// Path to arrow images
  var arrowImage = './img/dropdown.svg'; // Regular arrow
  // var arrowImageOver = './img/select_arrow_over.gif';  // Mouse over
  // var arrowImageDown = './img/select_arrow_down.gif';  // Mouse down

  
  var selectBoxIds = 0;
  var currentlyOpenedOptionBox = false;
  var editableSelect_activeArrow = false;
  

  
  // function selectBox_switchImageUrl()
  // {
  //   if(this.src.indexOf(arrowImage)>=0){
  //     this.src = this.src.replace(arrowImage,arrowImageOver); 
  //   }else{
  //     this.src = this.src.replace(arrowImageOver,arrowImage);
  //   }
  // }
  
  function selectBox_showOptions()
  {
    if(editableSelect_activeArrow && editableSelect_activeArrow!=this){
      editableSelect_activeArrow.src = arrowImage;
      
    }
    editableSelect_activeArrow = this;
    
    var numId = this.id.replace(/[^\d]/g,'');
    var optionDiv = document.getElementById('selectBoxOptions' + numId);
    if(optionDiv.style.display=='block'){
      optionDiv.style.display='none';
      if(navigator.userAgent.indexOf('MSIE')>=0)document.getElementById('selectBoxIframe' + numId).style.display='none';
      //this.src = arrowImageOver;  
    }else{      
      optionDiv.style.display='block';
      if(navigator.userAgent.indexOf('MSIE')>=0)document.getElementById('selectBoxIframe' + numId).style.display='block';
      //this.src = arrowImageDown;  
      if(currentlyOpenedOptionBox && currentlyOpenedOptionBox!=optionDiv)currentlyOpenedOptionBox.style.display='none'; 
      currentlyOpenedOptionBox= optionDiv;      
    }
  }
  
  function selectOptionValue()
  {
    var parentNode = this.parentNode.parentNode;
    var textInput = parentNode.getElementsByTagName('INPUT')[0];
    textInput.value = this.innerHTML; 
    this.parentNode.style.display='none'; 
    //document.getElementById('arrowSelectBox' + parentNode.id.replace(/[^\d]/g,'')).src = arrowImageOver;
    
    if(navigator.userAgent.indexOf('MSIE')>=0)document.getElementById('selectBoxIframe' + parentNode.id.replace(/[^\d]/g,'')).style.display='none';
    
  }

  var activeOption;
  function highlightSelectBoxOption()
  {
    if(this.style.backgroundColor=='#316AC5'){
      this.style.backgroundColor='';
      this.style.color='';
    }else{
      this.style.backgroundColor='#316AC5';
      this.style.color='#FFF';      
    } 
    
    if(activeOption){
      activeOption.style.backgroundColor='';
      activeOption.style.color='';      
    }
    activeOption = this;
    
  }
  
  function createEditableSelect(dest)
  {

    dest.className='selectBoxInput';    
    var div = document.createElement('DIV');
    // div.style.styleFloat = 'left';
    // div.style.position = 'relative';
    div.id = 'selectBox' + selectBoxIds;
    var parent = dest.parentNode;
    parent.insertBefore(div,dest);
    div.appendChild(dest);  
    div.className='selectBox';
    div.style.zIndex = 10000 - selectBoxIds;

    var img = document.createElement('IMG');
    img.src = arrowImage;
    img.className = 'selectBoxArrow';
    
    // img.onmouseover = selectBox_switchImageUrl;
    // img.onmouseout = selectBox_switchImageUrl;
    img.onclick = selectBox_showOptions;
    img.id = 'arrowSelectBox' + selectBoxIds;

    div.appendChild(img);
    
    var optionDiv = document.createElement('DIV');
    optionDiv.id = 'selectBoxOptions' + selectBoxIds;
    optionDiv.className='selectBoxOptionContainer';
    optionDiv.style.width = div.offsetWidth-2 + 'px';
    div.appendChild(optionDiv);
    
    if(navigator.userAgent.indexOf('MSIE')>=0){
      var iframe = document.createElement('<IFRAME src="about:blank" frameborder=0>');
      iframe.style.width = optionDiv.style.width;
      iframe.style.height = optionDiv.offsetHeight + 'px';
      iframe.style.display='none';
      iframe.id = 'selectBoxIframe' + selectBoxIds;
      div.appendChild(iframe);
    }
    
    if(dest.getAttribute('selectBoxOptions')){
      var options = dest.getAttribute('selectBoxOptions').split(';');
      var optionsTotalHeight = 0;
      var optionArray = new Array();
      for(var no=0;no<options.length;no++){
        var anOption = document.createElement('DIV');
        anOption.innerHTML = options[no];
        anOption.className='selectBoxAnOption';
        anOption.onclick = selectOptionValue;
        anOption.style.width = optionDiv.style.width.replace('px','') - 2 + 'px'; 
        anOption.onmouseover = highlightSelectBoxOption;
        optionDiv.appendChild(anOption);  
        optionsTotalHeight = optionsTotalHeight + anOption.offsetHeight;
        optionArray.push(anOption);
      }
      if(optionsTotalHeight > optionDiv.offsetHeight){        
        for(var no=0;no<optionArray.length;no++){
          optionArray[no].style.width = optionDiv.style.width.replace('px','') - 22 + 'px';   
        } 
      }   
      optionDiv.style.display='none';
      optionDiv.style.visibility='visible';
    }
    
    selectBoxIds = selectBoxIds + 1;
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

  tbsMin = tbs * 60;

  fullClock = hyp + rc + tbsMin;
  console.log(fullClock);
  document.getElementById("tick").style = 'animation: rotate ' + fullClock + 's infinite linear';

  //replace data with variable names
  var data = google.visualization.arrayToDataTable([
    ['Cycle', 'Sleep'],
    ['hypna latency',     hyp],
    ['recording time',     rc],
    ['time between sleep',  tbsMin],
        ]);
    var options = {
      legend: {position: 'labeled'},
      pieSliceText: 'none',
      chartArea: {width:'80%',height:'85%'},
      colors: ['#680099', '#372975','#75296c'],
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
       minutesGroupEl = timerEl.querySelector('.minutes-group'),
       secondsGroupEl = timerEl.querySelector('.seconds-group'),

       minutesGroup = {
          firstNum: minutesGroupEl.querySelector('.first'),
          secondNum: minutesGroupEl.querySelector('.second')
       },

       secondsGroup = {
          firstNum: secondsGroupEl.querySelector('.first'),
          secondNum: secondsGroupEl.querySelector('.second')
       };

   var time = {
      min: t.split(':')[0],
      sec: t.split(':')[1]
   };

   var timeNumbers;

   function updateTimer() {

      var timestr;
      var date = new Date();

      date.setHours(0);
      date.setMinutes(time.min);
      date.setSeconds(time.sec);

      var newDate = new Date(date.valueOf() - 1000);
      var temp = newDate.toTimeString().split(" ");
      var tempsplit = temp[0].split(':');

      time.min = tempsplit[1];
      time.sec = tempsplit[2];

      timestr = time.min + time.sec + '';
      timeNumbers = timestr.split('');
      updateTimerDisplay(timeNumbers);

      if(timestr === '0000')
         countdownFinished();

      if(timestr != '0000')
         setTimeout(updateTimer, 1000);

   }

   function updateTimerDisplay(arr) {

      animateNum(minutesGroup.firstNum, arr[0]);
      animateNum(minutesGroup.secondNum, arr[1]);
      animateNum(secondsGroup.firstNum, arr[2]);
      animateNum(secondsGroup.secondNum, arr[3]);

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