# Swagger-based Smart Device Metadata Specification

[Swagger](http://swagger.io/)-based Smart Device Metadata Specification is a step forward in the [Go-Lab Smart Device Metadata Specification](https://github.com/go-lab/smart-device-metadata) in order to make easy the deployment Smart Device services.

This Specification keeps backward compatibility, so any Smart Device service based on Go-Lab Specification can be described by our Swagger-based Specification. 

The changes between one specification and the other are simple and all of them are relative to [migrate the Swagger 1.2 JSON to the Swagger 2.0 JSON](https://github.com/OAI/OpenAPI-Specification/wiki/Swagger-1.2-to-2.0-Migration-Guide).

# Swagger-based Smart Device JS library

If you have a Smart Device service described by our Specification, your service clients can use the Smart Device JavaScript library included in this repository.

This library is a fork of [swagger-js](https://github.com/swagger-api/swagger-js), but mainly adding support for WebSockets as a protocol.

## Smart Device example

### Server
 * Sensor: CPU Load
 * Actuator: Dummy register
 
There are two implementations for this server:
 * ws-based: node.js + express + ws
 * socketio-based: node.js + express + socket.io 

### Client

The Smart Device client is a simple web page that uses Smart Devive JS library. 
It uses a service metadata described by our Swagger-based Smart Device Metadata Specification.

```
var wsclient = new SmartDeviceClient({
	url: "../metadata/metadata_ws_2.0.json",		// service metadata
	success: function () {	
		var request = { 
			authToken: "", 
			method: "getSensorData", 
			sensorId: "mycpu", 
			updateFrequency: 100, 
			accessRole: "controller" 
		};
		
		wsclient.sensor.getSensorData ({message: request}, {responseContentType: 'application/json'}, 
			function(data) {
				// do something with data
			}
		);
	}
});
```

## Authors

Smart Device Metadata Specification (original):
* Go-Lab (https://github.com/go-lab)

Swagger-based Smart Device Metadata Specification:
* Felix J. Garcia (https://github.com/felixgarcia)
* Luis de la Torre (https://github.com/Ravenink)
