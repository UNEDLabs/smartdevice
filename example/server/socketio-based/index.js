var app = require('express')();  
var server = require('http').Server(app); 
var io = require('socket.io')(server); 

var os = require('os'); 

app.use(function(req, res, next) {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
  next();
});

app.get('/', function(req, res){
  res.send('<h1>Smart Device Template</h1>');
});

server.listen(10010, function() {  
    console.log('Listening on *:10010');
});

// tag: client
app.get('/client', function(req, res){
  console.log("Request in client: " + req.query.message);
  var response;
  
  if(typeof req.query !== 'undefined' && typeof req.query.message !== 'undefined') {
	  var msg = JSON.parse(req.query.message);
	  
	  if(typeof msg.method !== 'undefined' && msg.method == 'getClients') { 
		response = {
			"method": "getClients",
			"clients": [
				{
					"type": "OpenSocial gadget",
					"url": "http://redlab.epfl.ch/client/s1.xml"
				}
			]
		};
	  } else {
		response = {'code': 405};
	  }
  } else {
	response = {'code': 422};	  
  }
  
  res.send(response);  
});

// tag: sensor
var lastMeasured = new Date().toISOString();

app.get('/sensor', function(req, res){
  console.log("Request in sensor: " + req.query.message);
  var response;
  
  if(typeof req.query !== 'undefined' && typeof req.query.message !== 'undefined') {
	  var msg = JSON.parse(req.query.message);
	  
	  if(typeof msg.method !== 'undefined' && msg.method == 'getSensorMetadata') { 
		  response = {
			"method": "getSensorMetadata",
			"sensors": [
				{ "sensorId": "cpuload",
				  "fullName": "cpuload",
				  "description": "CPU load average in the last 1 minute",
				  "webSocketType": "text",
				  "singleWebSocketRecommended": true,
				  "produces": "application/json",
				  "values": [
					{ "name": "cpuload",
					  "unit": "processes",
					  "lastMeasured": lastMeasured,
					  "rangeMinimum": 0
					}
				  ],
				  "accessMode": {
					"type": "push",
					"userModifiableFrequency": true
				  }
				}
			]
		  }
	  } else {
		  response = {'code': 405};
	  }	  
  } else {
	response = {'code': 422};	  
  }
  
  res.send(response);  
});

function cpuResponse(msg) {
	var cpuload = os.loadavg()[0];
	lastMeasured = new Date().toISOString();
	var result = { 'method': msg.method, 'sensorId': msg.sensorId, 'accessRole': msg.accessRole,  
				   'responseData': { 'valueNames': ['cpuload'], 'data': [cpuload], 'lastMeasured': [lastMeasured] } };
	return result;
}
	
var nsSensor = io.of('/sensor');
nsSensor.on('connection', function(socket) {  
    console.log('A user connected to Sensor: ' + socket.id);
	var intervalId = false;
    
	socket.on('message', function (msg) {
		console.log('Received a private message from ' + socket.id + ' saying ', msg);
		if(typeof msg.method !== 'undefined' && msg.method == 'getSensorData') {
			var updateFrequency = msg.updateFrequency || 0;
			var sensorId = msg.sensorId || 'cpuload';
			var authToken = msg.authToken || '';
			var accessRole = msg.accessRole || '';
			var configuration = msg.configuration || [];
			
			if(intervalId) {
				clearInterval(intervalId)
				intervalId = false;
			}
			
			if(updateFrequency > 0) {
				intervalId = setInterval(function(msg) { socket.emit('message', cpuResponse(msg)) }, updateFrequency, msg);
			} else {
				socket.emit('message', cpuResponse(msg));
			}
			
		} else {
			console.log('Error 405');
			socket.emit('message', {'code': 405});
		}
	});
});

// tag: actuator
var lastMeasured = new Date().toISOString();

app.get('/actuator', function(req, res){
  console.log("Request in actuator: " + req.query.message);
  var response;
  
  if(typeof req.query !== 'undefined' && typeof req.query.message !== 'undefined') {
	  var msg = JSON.parse(req.query.message);
	  
	  if(typeof msg.method !== 'undefined' && msg.method == 'getActuatorMetadata') { 
		  response = {
			"method": "getActuatorMetadata",
			"actuators": [
				{
					"actuatorId": "dummy",
					"fullName": "dummy",
					"description": "set the a value",
					"webSocketType": "text",
					"produces": "application/json",
					"consumes": "application/json",
					"values": [
						{
							"name": "dummyValue",
							"unit": "unit"
						}
					],
					"accessMode": {
						"type": "push",
						"nominalUpdateInterval": 100,
						"userModifiableFrequency": false
					}
				}
			]
		  }
	  } else {
		  response = {'code': 405};
	  }	  
  } else {
	response = {'code': 422};	  
  }
  
  res.send(response);  
});

var nsActuator = io.of('/actuator');
nsActuator.on('connection', function(socket) {  
    console.log('A user connected to Actuator: ' + socket.id);
    
	socket.on('message', function (msg) {
		console.log('Received a private message from ' + socket.id + ' saying ', msg);
		if(typeof msg.method !== 'undefined' && msg.method == 'sendActuatorData') {
			var actuatorId = msg.actuatorId || 'dummy';
			var authToken = msg.authToken || '';
			var accessRole = msg.accessRole || '';
			var valueNames = msg.valueNames || [];
			var data = msg.data || [];
			
			if (data.length > 0 && valueNames.length > 0 && valueNames[0] == 'dummyValue') {
				// do something
				var response = { "method": "sendActuatorData", "lastMeasured": new Date().toISOString(), "accessRole": accessRole,
				"payload": { "actuatorId": actuatorId, "valueNames": valueNames, "data": data} };

				socket.emit('message', response);
			}
			
		} else {
			console.log('Error 405');
			socket.emit('message', {'code': 405});
		}
	});
});

