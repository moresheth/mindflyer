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

	attentionThreshold = 20,
	attentionDelay = 2000,
	attentionGained = false,
	attentionTimer = null,

	headThreshold = 2,

	flying = false,

	offsetYaw = 0,
	offsetPitch = 0,
	offsetRoll = 0,

	// Max height in feet.
	maxAltitude = 10,

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
//	drone.on('navdata', 'drone: ' + console.log);
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

function handleMindwave(data) {
//	console.log('mindwave: '+data);
	var obj = json(data);

	if ( !obj.eSense ) return true;
	// Only using attention level for now.
	var att = obj.eSense.attention;

	// Log it.
	console.log('mindwave attention: '+att);

	// Store it in the environment.
	env.attention = att;
	// Whenever the attention level is greater than 20 for 2 seconds
	// If we just now gained attention, setTimer.

	// If we didn't already have the attention, and it's higher than 30,
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
//	console.log('yaw: ' + (env.yaw - offsetYaw).toFixed(2) + ', pitch: ' + (env.pitch - offsetPitch).toFixed(2) + ', roll: ' + (env.roll - offsetRoll).toFixed(2) );
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
	var targetAltitude = Math.round( ( num / maxAltitude ) * 100 ) / 100;
	// If it's the same, then don't do anything.
	if ( targetAltitude === env.altitude ) return true;
	// We'll want to determine how fast it should change based on difference.
	var speed = Math.round( Math.abs( env.altitude - targetAltitude ) / maxAltitude * 10 ) / 10;
	// If the current altitude is less than the target, go up.
	if ( env.altitude < targetAltitude ) {
		if ( drone ) drone.up(speed);
	} else {
		if ( drone ) drone.down(speed);
	}
}


// Negative yaw - counter-clockwise
// Positive yaw - clockwise

function setYaw() {
	var speed = 0.5;
	if ( env.yaw < 0-headThreshold ) {
		if ( drone ) drone.counterClockwise(speed);
	} else if ( env.yaw > headThreshold ) {
		if ( drone ) drone.clockwise(speed);
	}
}

// Negative pitch - down
// Positive pitch - up

function setPitch() {
	var speed = 0.5;
	if ( env.pitch < 0-headThreshold ) {
		if ( drone ) drone.front(speed);
	} else if ( env.pitch > headThreshold ) {
		if ( drone ) drone.back(speed);
	}
}

// Negative roll - right
// Positive roll - left

function setRoll() {
	var speed = 0.5;
	if ( env.roll < 0-headThreshold ) {
		if ( drone ) drone.right(speed);
	} else if ( env.roll > headThreshold ) {
		if ( drone ) drone.left(speed);
	}
}
