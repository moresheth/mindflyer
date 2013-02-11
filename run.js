	// https://github.com/felixge/node-ar-drone
var arDrone         = require('ar-drone'),
	// https://github.com/voodootikigod/node-serialport
	serialport      = require('serialport'),
	// http://nodejs.org/api/net.html
	net             = require('net'),

	// Mindwave host
	mindwave_host   = '127.0.0.1',
	mindwave_port   = 13854,

	// Our key players.
	drone,
	mindwave,
	razor,

	attentionThreshold = 10,
	attentionDelay = 2000,
	attentionGained = false,
	attentionTimer = null,

	headThreshold = 5,

	flying = false,

	offsetYaw = 0,
	offsetPitch = 0,
	offsetRoll = 0,
	maxYaw = 30,
	maxPitch = 30,
	maxRoll = 30,
	dirYaw = '0',
	dirPitch = '0',
	dirRoll = '0',

	// Max height in meters.
	maxAltitude = 3,
	// As a string, so we can compare easier.
	speedDir = '0',

	// This changes as data comes in.
	env = {
		yaw: 0,
		pitch: 0,
		roll: 0,
		attention: 0,
		altitude: 0
	};

	start();

function start() {
	// TODO: These need some sort of reconnect functionality.
	initDrone();
	initMindwave();
	initRazor();
}

function initDrone() {
	drone = arDrone.createClient();
	drone.disableEmergency();
	drone.config('general:navdata_demo', 'FALSE');
	drone.on('navdata', handleDrone );
//	console.log(drone);
}

function initMindwave() {
	mindwave = new net.Socket();

	mindwave.connect( mindwave_port, mindwave_host, function() {
		console.log('mindwave connect: ' + mindwave_host + ':' + mindwave_port);
		mindwave.write("{\"enableRawOutput\": false, \"format\": \"Json\"}\n");
	});

	mindwave.on('data', handleMindwave );

	// Rest of this is just logging.

	mindwave.on('connect', function() {
		console.log('mindwave connected');
	});

	mindwave.on('end', function(e) {
		console.log('mindwave end', e);
	});

	mindwave.on('timeout', function(e) {
		console.log('mindwave timeout', e);
	});

	mindwave.on('drain', function() {
		console.log('mindwave drain');
	});

	mindwave.on('error', function(e) {
		console.log('mindwave error', e);
	});

	mindwave.on('close', function(e) {
		console.log('mindwave close', e);
	});
}

function initRazor() {
	razor = new serialport.SerialPort('/dev/tty.FireFly-E2C0-SPP', { 
		baudrate: 57600,
		parser: serialport.parsers.readline("\n") 
	});

	razor.on('open', function () {

		console.log('razor open');

		razor.on('data', handleRazor );

	});

	razor.on('error', function (e) {
		console.log('razor error', e);
	});
}

function json(data) {
	var obj = {};
	try {
		obj = JSON.parse( data );
	} catch (e) {
		console.log( 'error parsing: ' + data );
	}
	return obj;
}

/*
drone: {"header":1432778632,"droneState":{"flying":0,"videoEnabled":0,"visionEnabled":0,"controlAlgorithm":0,"altitudeControlAlgorithm":1,"startButtonState":0,"controlCommandAck":1,"cameraReady":1,"travellingEnabled":0,"usbReady":0,"navdataDemo":0,"navdataBootstrap":0,"motorProblem":0,"communicationLost":0,"softwareFault":0,"lowBattery":0,"userEmergencyLanding":0,"timerElapsed":0,"MagnometerNeedsCalibration":0,"anglesOutOfRange":0,"tooMuchWind":0,"ultrasonicSensorDeaf":0,"cutoutDetected":0,"picVersionNumberOk":1,"atCodecThreadOn":1,"navdataThreadOn":1,"videoThreadOn":1,"acquisitionThreadOn":1,"controlWatchdogDelay":0,"adcWatchdogDelay":0,"comWatchdogProblem":0,"emergencyLanding":0},"sequenceNumber":52696,"visionFlag":0,"demo":{"controlState":"CTRL_LANDED","flyState":"FLYING_OK","batteryPercentage":62,"rotation":{"frontBack":-4.778,"pitch":-4.778,"theta":-4.778,"y":-4.778,"leftRight":-8.158,"roll":-8.158,"phi":-8.158,"x":-8.158,"clockwise":125.817,"yaw":125.817,"psi":125.817,"z":125.817},"frontBackDegrees":-4.778,"leftRightDegrees":-8.158,"clockwiseDegrees":125.817,"altitude":0,"altitudeMeters":0,"velocity":{"x":0,"y":0,"z":0},"xVelocity":0,"yVelocity":0,"zVelocity":0,"frameIndex":0,"detection":{"camera":{"rotation":{"m11":0,"m12":0,"m13":0,"m21":0,"m22":0,"m23":0,"m31":0,"m32":0,"m33":0},"translation":{"x":0,"y":0,"z":0},"type":3},"tagIndex":0},"drone":{"camera":{"rotation":{"m11":-0.5831679701805115,"m12":-0.8095991611480713,"m13":-0.06681817770004272,"m21":0.8080699443817139,"m22":-0.5696945190429688,"m23":-0.1499047577381134,"m31":0.08329682052135468,"m32":-0.1414133906364441,"m33":0.9864400029182434},"translation":{"x":0,"y":0,"z":0}}}},"time":629110.198,"rawMeasures":{"accelerometers":{"x":2048,"y":2004,"z":2548},"gyroscopes":{"x":10,"y":45,"z":-6},"gyrometers":{"x":10,"y":45,"z":-6},"gyroscopes110":{"x":0,"y":0},"gyrometers110":[0,0],"batteryMilliVolt":11876,"us":{"echo":{"start":0,"end":0,"association":3758,"distance":0},"curve":{"time":12241,"value":0,"ref":120}},"usDebutEcho":0,"usFinEcho":0,"usAssociationEcho":3758,"usDistanceEcho":0,"usCourbeTemps":12241,"usCourbeValeur":0,"usCourbeRef":120,"echo":{"flagIni":1,"num":0,"sum":0},"flagEchoIni":1,"nbEcho":0,"sumEcho":0,"altTemp":0,"altTempRaw":0},"physMeasures":{"temperature":{"accelerometer":38.76713562011719,"gyroscope":54665},"accelerometers":{"x":-73.73023986816406,"y":-25.513608932495117,"z":-955.75390625},"gyroscopes":{"x":0.06118830293416977,"y":-0.039636868983507156,"z":-0.03892124816775322},"alim3V3":0,"vrefEpson":0,"vrefIDG":0},"gyrosOffsets":{"x":0.6195113658905029,"y":-1.818678379058838,"z":0},"eulerAngles":{"theta":-4409,"phi":1529},"references":{"theta":0,"phi":0,"thetaI":0,"phiI":0,"pitch":0,"roll":0,"yaw":0,"psi":0,"vx":0,"vy":0,"thetaMod":0,"phiMod":0,"kVX":0,"kVY":0,"kMode":0,"ui":{"time":0,"theta":0,"phi":0,"psi":0,"psiAccuracy":0,"seq":0}},"trims":{"angularRates":{"r":0},"eulerAngles":{"theta":595.5101928710938,"phi":8899.1015625}},"rcReferences":{"pitch":-1,"roll":-1,"yaw":0,"gaz":0,"ag":0},"pwm":{"motors":[0,0,0,0],"satMotors":[255,255,255,255],"gazFeedForward":0,"gazAltitude":0,"altitudeIntegral":0,"vzRef":0,"uPitch":0,"uRoll":0,"uYaw":0,"yawUI":0,"uPitchPlanif":0,"uRollPlanif":0,"uYawPlanif":0,"uGazPlanif":0,"motorCurrents":[0,0,0,0],"altitudeProp":0,"altitudeDer":0},"altitude":{"vision":0,"velocity":0,"ref":0,"raw":0,"observer":{"acceleration":0,"altitude":0,"x":{"x":0,"y":0,"z":0},"state":0},"estimated":{"vb":{"x":0,"y":0},"state":0}},"visionRaw":{"tx":0,"ty":0,"tz":0},"visionOf":{"dx":[0,0,0,0,0],"dy":[0,0,0,0,0]},"vision":{"state":2,"misc":0,"phi":{"trim":0,"refProp":0},"theta":{"trim":0,"refProp":0},"newRawPicture":0,"capture":{"theta":-0.08336781710386276,"phi":-0.14243896305561066,"psi":2.1958768367767334,"altitude":0,"time":629.103},"bodyV":{"x":0,"y":0,"z":0},"delta":{"phi":0,"theta":0,"psi":0},"gold":{"defined":0,"reset":0,"x":0,"y":0}},"visionPerf":{"szo":0,"corners":0,"compute":0,"tracking":0,"trans":0,"update":0,"custom":[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0]},"trackersSend":{"locked":[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],"point":[{"x":0,"y":0},{"x":0,"y":0},{"x":0,"y":0},{"x":0,"y":0},{"x":0,"y":0},{"x":0,"y":0},{"x":0,"y":0},{"x":0,"y":0},{"x":0,"y":0},{"x":0,"y":0},{"x":0,"y":0},{"x":0,"y":0},{"x":0,"y":0},{"x":0,"y":0},{"x":0,"y":0},{"x":0,"y":0},{"x":0,"y":0},{"x":0,"y":0},{"x":0,"y":0},{"x":0,"y":0},{"x":0,"y":0},{"x":0,"y":0},{"x":0,"y":0},{"x":0,"y":0},{"x":0,"y":0},{"x":0,"y":0},{"x":0,"y":0},{"x":0,"y":0},{"x":0,"y":0},{"x":0,"y":0}]},"visionDetect":{"nbDetected":0,"type":[0,0,0,0],"xc":[0,0,0,0],"yc":[0,0,0,0],"width":[0,0,0,0],"height":[0,0,0,0],"dist":[0,0,0,0],"orientationAngle":[0,0,0,0],"rotation":[{"m11":0,"m12":0,"m13":0,"m21":0,"m22":0,"m23":0,"m31":0,"m32":0,"m33":0},{"m11":0,"m12":0,"m13":0,"m21":0,"m22":0,"m23":0,"m31":0,"m32":0,"m33":0},{"m11":0,"m12":0,"m13":0,"m21":0,"m22":0,"m23":0,"m31":0,"m32":0,"m33":0},{"m11":0,"m12":0,"m13":0,"m21":0,"m22":0,"m23":0,"m31":0,"m32":0,"m33":0}],"translation":[{"x":0,"y":0,"z":0},{"x":0,"y":0,"z":0},{"x":0,"y":0,"z":0},{"x":0,"y":0,"z":0}],"cameraSource":[0,0,0,0]},"watchdog":5000,"adcDataFrame":{"version":0,"dataFrame":[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0]},"videoStream":{"quant":0,"frame":{"size":1807,"number":17209},"atcmd":{"sequence":76,"meanGap":0,"varGap":1.4142135381698608,"quality":0},"bitrate":{"out":0,"desired":0},"data":[0,0,0,0,0],"tcpQueueLevel":0,"fifoQueueLevel":0},"games":{"counters":{"doubleTap":0,"finishLine":0}},"pressureRaw":{"up":40097,"ut":32573,"temperature":384,"pressure":98265},"magneto":{"mx":49,"my":51,"mz":-83,"raw":{"x":-182.28515625,"y":-174.5625,"z":305.4140625},"rectified":{"x":-449.49859619140625,"y":-2.957611083984375,"z":436.89410400390625},"offset":{"x":229.25946044921875,"y":-104.53890991210938,"z":-162.19891357421875},"heading":{"unwrapped":0,"gyroUnwrapped":0,"fusionUnwrapped":125.81727600097656},"ok":1,"state":257,"radius":6.866915773588841e+22,"error":{"mean":7047325825544225000,"variance":-8.142592188369272e-25}},"windSpeed":{"speed":0,"angle":0,"compensation":{"theta":0,"phi":0},"stateX":[0,0,0,0,129.43069458007812,-1520.5174560546875],"debug":[0,0,0]},"kalmanPressure":{"offsetPressure":98322,"estimated":{"altitude":0,"velocity":0,"angle":{"pwm":0,"pressure":0},"us":{"offset":0,"prediction":0},"covariance":{"alt":0.0005193915567360818,"pwm":0.5342205166816711,"velocity":0.025059189647436142},"groundEffect":true,"sum":1.401298464324817e-45,"reject":false,"uMultisinus":0,"gazAltitude":0,"flagMultisinus":false,"flagMultisinusStart":false}},"hdvideoStream":{"hdvideoState":0,"storageFifo":{"nbPackets":0,"size":0},"usbkey":{"size":0,"freespace":0,"remainingTime":0},"frameNumber":0},"wifi":{"linkQuality":1},"zimmu3000":{"vzimmuLSB":0,"vzfind":0}}
*/
function handleDrone(data) {
//	console.log('drone: %j', data);
	if ( data && data.demo && data.demo.altitudeMeters ) env.altitude = data.demo.altitudeMeters;
//	console.log('drone: %j', env.altitude );
}

function handleMindwave(data) {
//	console.log('mindwave: '+data);
	var obj = json(data),
		att = 0;

	if ( !obj.eSense ) return true;

	if ( obj.poorSignalLevel === 0 ) {
		// Only using attention level for now.
		att = obj.eSense.attention;
	}

	// Log it.
//	console.log('mindwave attention: '+att);

	// Store it in the environment.
	env.attention = att;
	// Whenever the attention level is greater than 20 for 2 seconds
	// If we just now gained attention, setTimer.

	// If we didn't already have the attention, and it's higher than 10,
	if ( !attentionTimer && !attentionGained && att >= attentionThreshold ) {
		// Set a timer to make sure it holds for a second.
		attentionTimer = setTimeout( checkAttentionUp, attentionDelay );

	// Or we did have the attention, and it
	} else if ( !attentionTimer && attentionGained && att < attentionThreshold ) {
		attentionTimer = setTimeout( checkAttentionDown, attentionDelay );
	}

	// If we are in flight, and the attention is above the threshold,
	// apply the attention as the altitude.
	if ( flying && att >= attentionThreshold ) {
		setAltitude( att );
	}
}

function checkAttentionUp() {
	console.log('checkAttentionUp');
	attentionTimer = null;
	// If it held, take off.
	if ( env.attention >= attentionThreshold ) {
		attentionGained = true;
		takeoff();
	}
}

function checkAttentionDown() {
	console.log('checkAttentionDown');
	attentionTimer = null;
	// If it held, land.
	if ( env.attention < attentionThreshold ) {
		attentionGained = false;
		land();
	}
}

function handleRazor(data) {
//	console.log('razor: '+data);
	var obj = json(data);
	// Apply the new settings to the current.
	env.yaw = obj.yaw;
	env.pitch = obj.pitch;
	env.roll = obj.roll;
	setYaw();
	setPitch();
	setRoll();
	console.log('yaw: ' + (env.yaw - offsetYaw).toFixed(2) + ', pitch: ' + (env.pitch - offsetPitch).toFixed(2) + ', roll: ' + (env.roll - offsetRoll).toFixed(2) );
}

function snapshotYPR() {
	console.log('snapshotting: '+env.yaw+','+env.pitch+','+env.roll);
	offsetYaw = env.yaw;
	offsetPitch = env.pitch;
	offsetRoll = env.roll;
}

function takeoff() {
	console.log('drone takeoff');
	if ( !flying ) {
		flying = true;
		snapshotYPR();
		if ( drone ) drone.takeoff();
	} else {
		console.log('Was not landed, so not taking off.');
	}
}

function land() {
	console.log('drone land');
	if ( flying ) {
		flying = false;
		if ( drone ) drone.land();
	} else {
		console.log('Was not flying, so not landing.');
	}
}

function setAltitude( num ) {
	// We get the desired alt by considering it a percentage of max height.
	var targetAltitude = Math.round( num * maxAltitude / 10 ) / 10;
	// If it's the same, then don't do anything.
//	if ( targetAltitude === env.altitude ) return true;
	// We'll want to determine how fast it should change based on difference.
	var diff = Math.abs( env.altitude - targetAltitude );
	var speed = Math.round( ( diff / maxAltitude ) * 10 ) / 10;
	// Giving status for altitude.
	console.log('attention: ' + num + ', env.altitude: '+env.altitude + ', targetAltitude: '+targetAltitude + ', diff: ' + diff + ', speed: ' + speed);
	// If we're already going that fast, just keep doing it.
	// If the current altitude is less than the target, go up.
	if ( env.altitude < targetAltitude ) {
		var speedIdent = 'up_' + speed;
		if ( drone && speedIdent !== speedDir ) {
			speedDir = speedIdent;
			drone.up(speed);
		}
	} else {
		var speedIdent = 'down_' + speed;
		if ( drone && speedIdent !== speedDir ) {
			speedDir = speedIdent;
			drone.down(speed);
		}
	}
}


// Negative yaw - counter-clockwise
// Positive yaw - clockwise

function setYaw() {
	if ( !flying ) return true;
	// absolute value
	var amt = Math.round( Math.abs( env.yaw - offsetYaw ) * 10 ) / 10,
		// Used for not sending same commands over and over.
		speedIdent = '0',
		// The speed is a percent of the max.
		speed = Math.round( amt * maxYaw / 100 ) / 10;
//	console.log('val: ' + env.yaw + ', offset: ' + offsetYaw + ', amt: ' + amt + ', speed: ' + speed);
	if ( speed > 1 ) speed = 1;
	if ( env.yaw - offsetYaw < 0-headThreshold ) {
		speedIdent = 'counterClockwise_' + speed;
		if ( drone && speedIdent !== dirYaw ) {
			dirYaw = speedIdent;
			drone.counterClockwise(speed);
		}
	} else if ( env.yaw - offsetYaw > headThreshold ) {
		speedIdent = 'clockwise_' + speed;
		if ( drone && speedIdent !== dirYaw ) {
			dirYaw = speedIdent;
			drone.clockwise(speed);
		}
	} else {
		speedIdent = 'clockwise_0';
		if ( drone && speedIdent !== dirYaw ) {
			dirYaw = speedIdent;
			drone.clockwise(0);
		}
	}
//	console.log(speedIdent);
}

// Negative pitch - down
// Positive pitch - up

function setPitch() {
	if ( !flying ) return true;
	// absolute value
	var amt = Math.round( Math.abs( env.pitch - offsetPitch ) * 10 ) / 10,
		// Used for not sending same commands over and over.
		speedIdent = '0',
		// The speed is a percent of the max.
		speed = Math.round( amt * maxPitch / 100 ) / 10;
//	console.log('val: ' + env.pitch + ', offset: ' + offsetPitch + ', amt: ' + amt + ', speed: ' + speed);
	if ( speed > 1 ) speed = 1;
	if ( env.pitch - offsetPitch < 0-headThreshold ) {
		speedIdent = 'back_' + speed;
		if ( drone && speedIdent !== dirPitch ) {
			dirPitch = speedIdent;
			drone.back(speed);
		}
	} else if ( env.pitch - offsetPitch > headThreshold ) {
		speedIdent = 'front_' + speed;
		if ( drone && speedIdent !== dirPitch ) {
			dirPitch = speedIdent;
			drone.front(speed);
		}
	} else {
		speedIdent = 'back_0';
		if ( drone && speedIdent !== dirPitch ) {
			dirPitch = speedIdent;
			drone.back(0);
		}
	}
//	console.log(speedIdent);
}

// Negative roll - right
// Positive roll - left

function setRoll() {
	if ( !flying ) return true;
	// absolute value
	var amt = Math.round( Math.abs( env.roll - offsetRoll ) * 10 ) / 10,
		// Used for not sending same commands over and over.
		speedIdent = '0',
		// The speed is a percent of the max.
		speed = Math.round( amt * maxRoll / 100 ) / 10;
//	console.log('val: ' + env.roll + ', offset: ' + offsetRoll + ', amt: ' + amt + ', speed: ' + speed);
	if ( speed > 1 ) speed = 1;
	if ( env.roll - offsetRoll < 0-headThreshold ) {
		speedIdent = 'right_' + speed;
		if ( drone && speedIdent !== dirRoll ) {
			dirRoll = speedIdent;
			drone.right(speed);
		}
	} else if ( env.roll - offsetRoll > headThreshold ) {
		speedIdent = 'left_' + speed;
		if ( drone && speedIdent !== dirRoll ) {
			dirRoll = speedIdent;
			drone.left(speed);
		}
	} else {
		speedIdent = 'right_0';
		if ( drone && speedIdent !== dirRoll ) {
			dirRoll = speedIdent;
			drone.right(0);
		}
	}
//	console.log(speedIdent);
}
