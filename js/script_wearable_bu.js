//function for logging to console with time/date

log = function(str) {
  console.log('[' + new Date().toUTCString() + '] ' + str);
}

// ==================================================
//
//        bluetooth functions for connecting
//
//===================================================

var bluetoothDevice;
var dataCharacteristic;

//checks to see if web bluetooth is enabled
function isWebBluetoothEnabled() {
  if (navigator.bluetooth) {
    return true;
  } else {
    window.alert('Web Bluetooth API is not available (only available in Chrome)\n');
    $("#bluetooth_help").show();
    return false;
  }
}

//requesting/connecting to device

function requestDevice() {
  log('Requesting any Bluetooth Device...');
  return navigator.bluetooth.requestDevice({
     "filters": [{
       "services": [0x2220]
     }]})
  .then(device => {
    log("Connected with: ", device.name);
    bluetoothDevice = device;
    bluetoothDevice.addEventListener('gattserverdisconnected', onDisconnected);
  });
}

function onReadBatteryLevelButtonClick() {
  return (bluetoothDevice ? Promise.resolve() : requestDevice())
  .then(connectDeviceAndCacheCharacteristics)
  .then(_ => {
    log('Reading Dormio Data...');
    return dataCharacteristic.readValue();
  })
  .catch(error => {
    log('Argh! ' + error);
  });
}


function connectDeviceAndCacheCharacteristics() {
  if (bluetoothDevice.gatt.connected && dataCharacteristic) {
    log("Bluetooth device already connected and dataCharacteristic already defined");
    return Promise.resolve();
  }

  log('Connecting to GATT Server...');
  return bluetoothDevice.gatt.connect()
  .then(server => {
    log('Getting Dormio Service...');
    return server.getPrimaryService(0x2220);
  }, () => {log("device.gatt.connect() promise rejected!");})
  .then(service => {
    log('Getting Data Characteristic...');
    return service.getCharacteristic(0x2221);
  })
  .then(characteristic => {
    dataCharacteristic = characteristic;
    dataCharacteristic.addEventListener('characteristicvaluechanged',
        handleBatteryLevelChanged);
    dataCharacteristic.startNotifications();
  });
}

/* This function will be called when `readValue` resolves and
 * characteristic value changes since `characteristicvaluechanged` event
 * listener has been added. */

 //handles reading inputs from pins and updating variable
function handleBatteryLevelChanged(event) {

  //read from pins
  let valFLEX = event.target.value.getUint32(0, true);
  let valHR = event.target.value.getUint32(4, true);
  let valEDA = event.target.value.getUint32(8, true);

  oldHr = hr;
  flex = valFLEX;
  hr = valHR;
  eda = valEDA;

  //push hr onto list, if list is greater than 600 remove first elem
  buffer.push(hr);
  if (buffer.length > 600) {
    buffer.shift();
  }

  //push all 3 stats onto list, if greater than 1800 remove first elem
  bigBuffer.push([flex, hr, eda])
  if (bigBuffer.length > 1800) {
    bigBuffer.shift();
  }
  
  //write stats to read/parse files
  if (recording) {
    fileReadOutput += "Flex: " + flex + ", Heart Rate: " + hr + ", EDA: " + eda + "|";
    fileParseOutput += flex + "," + hr + "," + eda + "|";
  }
  
  //if calibrating, write stats + means onto labels
  if (calibrationStatus == "CALIBRATING" && meanEDA != null) {
    $('#flex').text(flex + " (" + meanFlex + ")");
    $('#eda').text(eda + " (" + meanEDA + ")");

  } else if (calibrationStatus == "CALIBRATED") {
    $('#flex').text(flex + " (" + addSign(flex, meanFlex) + ")");
    $('#eda').text(eda + " (" + addSign(eda, meanEDA) + ")");

  } else {
    $('#flex').text(flex);
    $('#eda').text(eda);
  }

  //counting beats/changing bg
  if(hr - oldHr > thresh && now - lastBeat > .4){
    //document.getElementById("channel-bpm").style.background = 'rgba(255,0,0,0.8)';
    document.getElementById("hr-img").src = "img/hr_2.svg";
    lastBeat = new Date().getTime()/1000;
  } else {
    //document.getElementById("channel-bpm").style.background = 'rgba(255,0,0,0.1)';
    document.getElementById("hr-img").src = "img/hr.svg";
  }

  now = new Date().getTime()/1000;
  if (!bpmInit) {
    if(now - prev >= 20) {
      MT.process(processBPM, setBPM)(buffer, thresh);
      prev = now;
      bpmInit = true;
    }
  } else {
    if(now - prev >= 1) {
      MT.process(processBPM, setBPM)(buffer, thresh);
      prev = now;
    }
  }
}


function onResetButtonClick() {
  if (dataCharacteristic) {
    dataCharacteristic.removeEventListener('characteristicvaluechanged',
        handleBatteryLevelChanged);
    dataCharacteristic.stopNotifications()
    dataCharacteristic = null;
  }
  // Note that it doesn't disconnect device.
  bluetoothDevice = null;
  log('> Bluetooth Device reset');
}

function onDisconnected() {
  log('> Bluetooth Device disconnected');
  connectDeviceAndCacheCharacteristics()
  .catch(error => {
    log('Argh! ' + error);
  });
}

function addSign(x, mean) {
  var ret = x - mean;
  if (ret > 0) {
    return "+" + ret;
  } else {
    return ret;
  }
}

function setBPM(_bpm) {
  if (calibrationStatus == "CALIBRATING" && meanHR != null) {
    $('#bpm').text(_bpm + " (" + meanHR + ")");
  } else if (calibrationStatus == "CALIBRATED") {
    $('#bpm').text(_bpm + " (" + addSign(_bpm, meanHR) + ")");
  } else {
    $('#bpm').text(_bpm);
  }
  bpmBuffer.push(_bpm)
  if (bpmBuffer.length > 180) {
    bpmBuffer.shift();
  }
}


//declare vars

var flex = 0,
    hr = 0,
    oldHr = 0,
    thresh = 50,
    bpm = 0,
    eda = 0;
var prev = new Date().getTime()/1000;
var now = new Date().getTime()/1000;
var lastBeat = new Date().getTime()/1000;
var delay = 20;
var buffer = [];
var bigBuffer = [];
var bpmBuffer = [];
var bpmInit = false;

var meanEDA = null;
var meanFlex = null;
var meanHR = null;

var fileReadOutput = "";
var fileParseOutput = "";

var nextWakeupTimer = null;
var wakeups = 0;

var defaults = {
  "loops" : 3,
  "hypna-latency" : 30,
  "time-between-sleep" : 7,
  "calibration-time" : 3,
  "recording-time" : 30,
  "delta-eda" : 4,
  "delta-flex": 5,
  "delta-hr": 6
}

var num_threads = 2;
var MT = new Multithread(num_threads);

var calibrationStatus = null;

var nowDateObj;
var nowDate;
var nowTime;

var minTime;
var maxTime;

var startSleepDetectTime;

var calibrateTimer = null;
var countdown = 0;
var countdownTimer = null;

var recording = false;
var isConnected = false;

var wakeup_msg_recording, sleep_msg_recording;
var audio_recordings = []

var is_recording_wake = false;
var is_recording_sleep = false;

var wakeupSelect1;
var wakeupSelect2;
var wakeupSelect3;
var wakeupSelect4;
var wakeupSelect5;
var wakeupSelect6;
var wakeupSelect7;
var wakeupSelect8;
var wakeupSelect9;
var wakeupSelect10;

var currentSelected;


// ==================================================
//        on page load, do this
//==================================================

$(document).ready(function()
{
	//initial alert instructions after page load
    setTimeout(function()
    {
    alert("To begin, first set your desired thresholds for heart rate, muscle flex, and electrodermal activity on the right. Then, press 'Connect' to connect your dormio wearable device.\n\nNote: To enable Web Bluetooth API, copy chrome://flags/#enable-experimental-web-platform-features to your Chrome address bar.")
    }, 
    4000);

});


$(function(){

  //read audio text files to populate the dropdown boxes for wakeups
  readAudioTxt();

  //hide calibrate and stop session buttons on load
    $("#stop_session").hide()
  $("#calibrate").hide()

  //populate default variables
  for (var key in defaults){
    $("#" + key).val(defaults[key]);
  }

  //when connect button is clicked, do this
  $('#connect').click(function() {

    //read input from delta boxes
    var inputDeltaEDA = parseInt($('#delta-eda').val());
    var inputDeltaFlex = parseInt($('#delta-flex').val());
    var inputDeltaHR = parseInt($('#delta-hr').val());

    if (isWebBluetoothEnabled()) {
      if (isConnected) {
        onResetButtonClick();
        document.getElementById("connect").innerHTML = "Connect";

      } else {
        onReadBatteryLevelButtonClick();
        document.getElementById("connect").innerHTML = "Reset";

        //open form after 3 seconds to continue process if connect is successful
        setTimeout(function()
        {openForm()},10000);
      }
      isConnected = !isConnected;
    }
  });

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


  if (sleep_msg_recording == null) {
      console.log("no sleep recording");
    }else{
      sleep_msg_player = new Audio(sleep_msg_recording.url);
      sleep_msg_player.play();
    }

  });

  $("#clear-sleep-message").click(function() {
    sleep_msg_recording = null;

    console.log("clear sleep message");
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

//when confirm wakeups is clicked, do this
  $("#confirm_wakeups").click(function() {

    var numWakeups = $("#loops").val();
    console.log(numWakeups);

     for (var i = 0; i < numWakeups; i++) {
    initializeWakeups(i + 1);

     var wakeupNum = i + 1
     var wakeupID = "subject-wakeup-" + wakeupNum;
     document.getElementById(wakeupID).style.display = "block";
    }
  });

//when calibrate is clicked, do this
    $("#calibrate").click(function() {
    if (calibrationStatus == "CALIBRATING") {
      endCalibrating();
    } else if (calibrationStatus == "CALIBRATED") {
      startCalibrating();
    }
  });

// ==============================================================
//        when start biosignal button is pressed, do this
//===============================================================

$("#start_biosignal").click(function(){

    // Validations
    
    //if subject name is empty, alert
    if ($.trim($("#subject-name").val()) == '') {
      alert('Please fill in the subject name.');
      recording = !recording;
      return;
    }

    //if any necessary fields are empty, alert
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

   // if device isn't connected on start, alert
    if (!isConnected){
      alert('Dormio device is not connected');
      recording != recording;
      return;
    }

    //if sleep recordings are null
    if ((sleep_msg_recording == null)){
      alert ('Please record a prompt message');
      recording != recording;
      return;
    }

    //if wakeup recordings are null
    if ((wakeup_msg_recording == null)){
      alert ('Please record a wakeup message');
      recording != recording;
      return;
    }

    //disable fields on form after start is pressed
    $("#user-name").prop('disabled', true);
    for (var key in defaults) {
      $("#" + key).prop('disabled', true);
    }

    //hide the start button so people don't click it again if they ever open the form
    $("#start-button-container").hide();

    //roll back the complete form to the side
    setTimeout(closeForm, 1000);

    recording = true;

    nowDateObj = new Date();
    nowDate = nowDateObj.getFullYear()+'-'+(nowDateObj.getMonth()+1)+'-'+nowDateObj.getDate();
    nowTime = nowDateObj.getHours() + ":" + nowDateObj.getMinutes() + ":" + nowDateObj.getSeconds();

    fileReadOutput = $("#user-name").val() + "||||" + nowDate + "\n";
    fileParseOutput = $("#user-name").val() + "||||"


    log("Start Session");

    fileReadOutput += "Session Start: " + nowTime + "\n---------------------------------------------------\n";

    currentSelected = selectWakeup1.getSelected();
    fileReadOutput += "\nwords for wakeup 1:" + currentSelected + " \n";


    $("#calibrate").show();
    startCalibrating();
    $("#stop_session").show();
   });

  	$("#stop_session").click(function(){
    	endSession();
    });

 //calibrate
function startCalibrating() {

  //record calibrate event onto files
  if (recording) {
    fileReadOutput += "EVENT, calibrate_start |\n"
    fileParseOutput += "EVENT,calibrate_start|"
  }

  log("startCalibrating");

  //declare vars
  bigBuffer = [];
  bpmBuffer = [];
  meanEDA = null;
  meanFlex = null;
  meanHR = null;

  //change button color and label
  $("#calibrate").html("Calibrating...")
  $("#calibrate").css("background-color", "rgba(255, 0, 0, .4)")

  calibrationStatus = "CALIBRATING";

  countdown = parseInt($('#calibration-time').val());
  countdownSecs = countdown * 60;

  //end timer after calibration time is over
  calibrateTimer = setTimeout(function() {
    endCalibrating();
  }, countdownSecs * 1000)

  //countdown for label
  countdownTimer = setInterval(function() {
    countdown--;
    var minutes = Math.floor(countdown / 60)
    var seconds = Math.floor(countdown % 60)
    $("#calibrate").html("Calibrating... (" + minutes + ":" + ("0"+seconds).slice(-2) + ")")
    updateMeans();

    if (countdown <= 0) {
      clearInterval(countdownTimer)
    }
  }, 1000);
}

function updateMeans() {

  //if lists with all stats and bpm are 0, do nothing
  if (bigBuffer.length == 0 || bpmBuffer.length == 0) {
    return
  }

  tmpEDA = 0;
  tmpFlex = 0;

  //for list of stats, tmpEDA and tmpFlex are all added
  for (var i = 0; i < bigBuffer.length; i++) {
    tmpEDA += bigBuffer[i][2];
    tmpFlex += bigBuffer[i][0];
  }

  //calculate means for EDA and Flex
  meanEDA = Math.round(tmpEDA / bigBuffer.length)
  meanFlex = Math.round(tmpFlex / bigBuffer.length)

  tmpHR = 0;
  
  for (var i = 0; i < bpmBuffer.length; i++) {
    tmpHR += bpmBuffer[i];

  }
  
  //calculate means for hr
  meanHR = Math.round(tmpHR / bpmBuffer.length)
}

//end calibrating
function endCalibrating() {

  updateMeans();

  log("endCalibrating");

  //log event to files
  if (recording) {
    fileReadOutput += "EVENT, calibrate_end |" + "Mean Flex: " + meanFlex + ", Mean Heart Rate: " + meanHR + ", Mean EDA:" + meanEDA + "|\n";
    fileParseOutput += "EVENT,calibrate_end," + meanFlex + "," + meanHR + "," + meanEDA + "|";
  }

  calibrationStatus = "CALIBRATED";

  //change label and color
  $("#calibrate").html("Calibrated");
  $("#calibrate").css("background-color", "rgba(0, 255, 0, .4)");

  //clear timers
  if (calibrateTimer) {
    clearTimeout(calibrateTimer)
    calibrateTimer = null;
  }
  if (countdownTimer) {
    clearTimeout(countdownTimer);
    countdownTimer = null;
  }

  playPrompt();


minTime = parseInt($('#time-until-sleep-min').val());
maxTime = parseInt($('#time-until-sleep-max').val());

var minTimeSecs = minTime * 60;
var maxTimeSecs = maxTime * 60;


    //if either of the values in min or max time are null, detect sleep onset right away
  if ((minTime == null) || (maxTime == null)){

        startDetectSleepOnset();
        console.log("both values null");

  }else{

      console.log("detect sleep onset after" + minTime + "secs");

      var startSleepDetection = setTimeout(function(){
          startDetectSleepOnset();
      }, minTimeSecs * 1000);

    }
}

//if both windows are null, do nothing and guess sleep onset right away
//if not, we wait for min time to start detecting sleep onset.
//we allow detect sleep onset to continue for the time between maxtime and mintime
//if sleep onset isn't true at the time, just have sleep be detected

function startDetectSleepOnset(){

  
  log("startDetectSleepOnset");

  //record event onto files
  if (recording) {
    fileReadOutput += "EVENT, start detect sleep onset |\n"
    //fileParseOutput += "EVENT,calibrate_start|"
  }

  startSleepDetectTime = new Date();
  console.log("detect sleep onset starting at" + startSleepDetectTime);

  detectSleepOnset();
}


function detectSleepOnset(){

  tmpEDA = 0;
	tmpFlex = 0;

	//accumulate last 100 entries ~approx 10 seconds of data
	for (var i = 1; i < 101; i++){
		place = bigBuffer.length - i;
		tmpEDA += bigBuffer[place][2];
		tmpFlex += bigBuffer[place][0];
	}

	//average entries
  var recentMeanEDA = Math.round(tmpEDA / 100);
  var recentMeanFlex = Math.round(tmpFlex / 100);

  tmpHR = 0;

  //accumulate last 10 entries ~approx 10 seconds of data
  for (var i = 1; i < 11; i++){
		place = bpmBuffer.length - i;
  	tmpHR += bpmBuffer[place];
  }

  //average entries
  var recentMeanHR = Math.round(tmpHR / 10);

  //calculate delta from calibration mean
  var deltaEDA = Math.abs(meanEDA - recentMeanEDA);
  var deltaFlex = Math.abs(meanFlex - recentMeanFlex);
  var deltaHR = Math.abs(meanHR - recentMeanHR);

  //retrieve user input delta
  var inputDeltaEDA = parseInt($('#delta-eda').val());
  var inputDeltaFlex = parseInt($('#delta-flex').val());
  var inputDeltaHR = parseInt($('#delta-hr').val());

  //if threshold is reached
  if (deltaEDA >= inputDeltaEDA || deltaFlex >= inputDeltaFlex || deltaHR >= inputDeltaHR){

    console.log("sleep detected");
    endDetectSleepOnset();

  }else{

    //check the time now
    nowTime = new Date();

    var timeDiff = nowTime - startSleepDetectTime; //in ms
    // strip the ms
    timeDiff /= 1000;

    var seconds = Math.round(timeDiff);

    var detectSleepWindow = maxTimeSecs - minTimeSecs;

    if (seconds >= detectSleepWindow){

      console.log("window elapsed");
      endDetectSleepOnset();

    }else{

      //run detectSleepOnset in the next second
      console.log("continuing to detect sleep");
      var checkAgain = setTimeout(function() {
      detectSleepOnset();
      }, 1000);

    }

  }
}

function endDetectSleepOnset(){

  playPrompt();

  var thing = parseInt($("#hypna-latency").val());

     console.log("starting wakeup after hypna latency");

    //do next wakeup after hypnagogic depth
      var nextWakeupTimer = setTimeout(function(){
          startWakeup();
      }, thing * 1000);

}


//wake up
function startWakeup() {

  //change button color
  $("#wakeup").css("background-color", "rgba(0, 255, 0, .4)");

  //add wakeup event to plot
  g.append("g")
    .attr("clip-path", "url(#clip)")
  .append("line")
    .attr("x1", width)
    .attr("y1", 0)
    .attr("x2", width)
    .attr("y2", height)
    .attr("class", "line-wakeup")
  .transition()
    .duration(6650)
    .ease(d3.easeLinear)
    .attr("x1",-1)
    .attr("x2",-1);

  //increment wakeups and log
  wakeups += 1;
  log("startWakeup #" + wakeups + "/" + $("#loops").val())

  changeCurrentSelected(wakeups);


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
    
    //play prompt again
	  
    playPrompt();

    duringSleep();

    //if completed all loops, alarm and end session
  } else {
    gongs = 0;
    gong.play();

    nextWakeupTimer = setTimeout(function() {
      endSession();
    }, 4000);
  }
}

function duringSleep(){

  var timeBetween = parseInt($('#time-between-sleep').val());
  var timeBetweenSecs = timeBetween * 60;

  var promptHypnagogia = setTimeout(function(){
        playPrompt();
    },  timeBetweenSecs * 1000);

  var hypnaLatency = parseInt($('#hypna-latency').val());

  var nextWakeupTime = timeBetween + hypnaLatency;

  var nextWakeupTimer = setTimeout(function(){
        startWakeup();
    }, nextWakeupTime * 1000);
}

function playPrompt(){

  log("playPrompt");

    //play prompt again
		if (sleep_msg_recording != null) {
      sleep_msg_player = new Audio(sleep_msg_recording.url)
      sleep_msg_player.play()
    }

    playSelected(currentSelected);
}

var audioFileTxt = '';
var audioTxtResult = [];

function readAudioTxt(){

  // var txt = '';
  var xmlhttp = new XMLHttpRequest();
  xmlhttp.open("GET","audio.txt",true);
  // console.log("audioText");

  xmlhttp.responseType = 'text';

  xmlhttp.onreadystatechange = function(){
    if(xmlhttp.readyState===xmlhttp.DONE){
      if(xmlhttp.status===200){
        //console.log(xmlhttp.response);
        //console.log(xmlhttp.responseText);
        audioFileTxt=xmlhttp.responseText + "";
        audioFileTxt=audioFileTxt.replace(/<&#91;^>&#93;*>/g, "");

        audioTxtResult = audioFileTxt.split(";");

        for (var i = 0; i < audioTxtResult.length; i++){
            console.log(audioTxtResult[i]);
          }

        console.log(audioTxtResult);
      }
    }
  }
 xmlhttp.send(null);
}



function initializeWakeups(num){

  var initParentID = "subject-wakeup-" + num;
  var wakeupInputID = "#wakeup-" + num;

  var currentParentID = document.getElementById("wakeup-" + num).parentElement.className + ""; 


  if(currentParentID == "user-elem"){

    switch (num) {

      case 1:

        var selectWakeup1 = sellect(wakeupInputID, {
            originList : audioTxtResult,
            destinationList: []
        });  
        console.log(wakeupInputID + " initialized");
        //console.log(audioTxtResult);
        
        selectWakeup1.init();

        break;

      case 2:

        var selectWakeup2 = sellect(wakeupInputID, {
            originList : audioTxtResult,
            destinationList: []
        });  
        console.log(wakeupInputID + " initialized");
        //console.log(audioTxtResult);
        
        selectWakeup2.init();

        break;

      case 3:

        var selectWakeup3 = sellect(wakeupInputID, {
            originList : audioTxtResult,
            destinationList: []
        });  
        console.log(wakeupInputID + " initialized");
        //console.log(audioTxtResult);
        
        selectWakeup3.init();

        break;

      case 4:

        var selectWakeup4 = sellect(wakeupInputID, {
            originList : audioTxtResult,
            destinationList: []
        });  
        console.log(wakeupInputID + " initialized");
        //console.log(audioTxtResult);
        
        selectWakeup4.init();

        break;

      case 5:

        var selectWakeup5 = sellect(wakeupInputID, {
            originList : audioTxtResult,
            destinationList: []
        });  
        console.log(wakeupInputID + " initialized");
        //console.log(audioTxtResult);
        
        selectWakeup5.init();

        break;

      case 6:

        var selectWakeup6 = sellect(wakeupInputID, {
            originList : audioTxtResult,
            destinationList: []
        });  
        console.log(wakeupInputID + " initialized");
        //console.log(audioTxtResult);
        
        selectWakeup6.init();

        break;

      case 7:

       var selectWakeup7 = sellect(wakeupInputID, {
            originList : audioTxtResult,
            destinationList: []
        });  
        console.log(wakeupInputID + " initialized");
        //console.log(audioTxtResult);
        
        selectWakeup7.init();

        break;

       case 8:
        var selectWakeup8 = sellect(wakeupInputID, {
            originList : audioTxtResult,
            destinationList: []
        });  
        console.log(wakeupInputID + " initialized");
        //console.log(audioTxtResult);
        
        selectWakeup8.init();

        break;

       case 9:
        var selectWakeup9 = sellect(wakeupInputID, {
            originList : audioTxtResult,
            destinationList: []
        });  
        console.log(wakeupInputID + " initialized");
        //console.log(audioTxtResult);
        
        selectWakeup9.init();

        break;

       case 10:

       var selectWakeup10 = sellect(wakeupInputID, {
            originList : audioTxtResult,
            destinationList: []
        });  
        console.log(wakeupInputID + " initialized");
        //console.log(audioTxtResult);
        
        selectWakeup10.init();

        break;
    }
  }
}

//end session
function endSession() {

  //hide buttons
  $("#calibrate").hide();
  $("#stop_session").hide();

  recording = false;

  nowDateObj = new Date();
  nowTime = nowDateObj.getHours() + ":" + nowDateObj.getMinutes() + ":" + nowDateObj.getSeconds();
  fileReadOutput += "-------------------------------\nSession End: " + nowTime;

  //zip folders
  var prefix = $("#user-name").val()
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

  $("#user-name").prop('disabled', false);
  for (var key in defaults) {
    $("#" + key).prop('disabled', false);
  }

  //clear timers
  $("#calibrate").hide()
  if (calibrateTimer) {
    clearTimeout(calibrateTimer)
  }
  if (countdownTimer) {
    clearTimeout(countdownTimer)
  }
  if (nextWakeupTimer) {
    clearTimeout(nextWakeupTimer)
  }
}

var g, width, height;

var gongs = 0;
var gong = new Audio('audio/gong.wav');
gong.addEventListener('ended',function() {
  gongs += 1;
  if (gongs < 3) {
    gong.play()
  }
})

//plot stuff
  var n = 1000,
      dataFlex = d3.range(n).map(() => {return 0;});
      dataHR = d3.range(n).map(() => {return 0;});
      dataEDA = d3.range(n).map(() => {return 0;});
  var svg = d3.select("#plot"),
      margin = {top: 20, right: 20, bottom: 20, left: 40};
      width = parseInt(svg.style("width").slice(0, -2));
      width = width  - margin.left - margin.right;
      height = parseInt(svg.style("height").slice(0, -2));
      height = height - margin.top - margin.bottom;
      g = svg.append("g").attr("transform", "translate(" + margin.left + "," + margin.top + ")");

  var x = d3.scaleLinear()
    .domain([0, n - 1])
    .range([0, width]);

  var y = d3.scaleLinear()
    //.domain([0, 300])
    .domain([0, 1023])
    .range([height, 0]);

  var lineFlex = d3.line()
    .x(function(d, i) { return x(i); })
    .y(function(d, i) { return y(d); });
  var lineHR = d3.line()
    .x(function(d, i) { return x(i); })
    .y(function(d, i) { return y(d); })
    .curve(d3.curveCardinal);
  var lineEDA = d3.line()
    .x(function(d, i) { return x(i); })
    .y(function(d, i) { return y(d); });

  g.append("defs").append("clipPath")
  .attr("id", "clip")
  .append("rect")
  .attr("width", width)
  .attr("height", height);

  g.append("g")
  .attr("class", "axis axis--x")
  .attr("transform", "translate(0," + y(0) + ")")
  .call(d3.axisBottom(x));

  g.append("g")
  .attr("class", "axis axis--y")
  .call(d3.axisLeft(y));

  g.append("g")
    .attr("clip-path", "url(#clip)")
  .append("path")
    .datum(dataFlex)
    .attr("class", "line-flex")
  .transition()
    .duration(delay)
    .ease(d3.easeLinear)
    .on("start", tick);

  g.append("g")
    .attr("clip-path", "url(#clip)")
  .append("path")
    .datum(dataHR)
    .attr("class", "line-hr")
  .transition()
    .duration(delay)
    .ease(d3.easeLinear)
    //.ease(d3.easeElasticInOut)
    .on("start", tick);

  g.append("g")
    .attr("clip-path", "url(#clip)")
  .append("path")
    .datum(dataEDA)
    .attr("class", "line-eda")
  .transition()
    .duration(delay)
    .ease(d3.easeLinear)
    .on("start", tick);

  $("#wakeup").click(function() {
    startWakeup();
  })

  function tick() {
    // Push a new data point onto the back.
    dataFlex.push(flex);
    dataHR.push(hr);
    dataEDA.push(eda);// * 25);

    // Redraw the line.
    d3.select(this)
      .attr("d", lineFlex)
      .attr("d", lineHR)
      .attr("d", lineEDA)
      .attr("transform", null);
    // Slide it to the left.
    d3.active(this)
      .attr("transform", "translate(" + x(-1) + ",0)")
      .transition()
      .on("start", tick);

    // Pop the old data point off the front.
    dataFlex.shift();
    dataHR.shift();
    dataEDA.shift();
  }
});

document.addEventListener('keydown', function (event) {
  if (event.defaultPrevented) {
    return;
  }

  //tagging events abc
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
    console.log("filename is:", filename)
    // audioZip.file(filename, blob);
    audioRecording = {"blob":blob, "encoding": encoding, "filename":filename, "url":url}
    return audioRecording;
}

//Plays the sound
function play(url) {
  new Audio(url).play();
}

function playSelected(list){

  //var gongs = 0;
for (var i = 0; i < list.length; i++){
  var audio = new Audio('audio/' + list[i] + ".m4a");
  audio.addEventListener('ended',function(){
    audio.play();
  })

}
}


function changeCurrentSelected(num){

   switch (num) {

      case 1:

        currentSelected = selectWakeup2.getSelected();

        break;

      case 2:

        currentSelected = selectWakeup3.getSelected();

        break;

      case 3:

        currentSelected = selectWakeup4.getSelected();

        break;

      case 4:

        currentSelected = selectWakeup5.getSelected();

        break;

      case 5:

        currentSelected = selectWakeup6.getSelected();

        break;

      case 6:

        currentSelected = selectWakeup7.getSelected();

        break;

      case 7:

       currentSelected = selectWakeup8.getSelected();

        break;

       case 8:
        currentSelected = selectWakeup9.getSelected();

        break;

       case 9:
        currentSelected = selectWakeup10.getSelected();

        break;
    }

 fileReadOutput += "\n" + currentSelected + " \n";
 
};