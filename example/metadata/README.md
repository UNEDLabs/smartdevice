# Metadata Example

 * `metadata_1.2.json`: original Go-Lab Smart Device Metadata
 * `metadata_socketio_2.0.json`: Swagger-based Smart Device Metadata for socketio-based server
 * `metadata_ws_2.0.json`: original Swagger-based Smart Device Metadata for ws-based server

You must set your host in the key "host".
 
# Migration details

Note that the method 'emit' is used with socketio-based server and the method 'send' is used with ws-based server.
 
Also note these changes in the migration:
 * Extra info: contact, license, licenseUrl
 * API version ("apiVersion": "2.0.0")
 * Swagger scheme based on WebSocket, but Smart Device Metadata includes the operation 'send' ("schemes": [ "ws" ])
 * The type 'message' used in operation 'send' to reference when the parameters are sent as a message ("in": "message")
