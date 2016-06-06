// require: jquery, lodash, socketio

/*
 * JQueryHttpClient is a light-weight, node or browser HTTP client
 */
var JQueryHttpClient = function () {
  this.type = 'JQueryHttpClient';
};

/*
 * SocketIOClient is a browser WebSocket client
 */
var SocketIOClient = function () {
  this.type = 'SocketIOClient';
};

SocketIOClient.socketList = {};

/*
 * NativeWSClient is a browser WebSocket client
 */
var NativeWSClient = function () {
  this.type = 'NativeWSClient';
};

NativeWSClient.socketList = {};

/**
 * SwaggerHttp is a wrapper for executing requests
 */
var SwaggerHttp = function () {};

SwaggerHttp.prototype.execute = function (obj, opts) {
  var client;
  
  if(obj.method == 'EMIT') {  // socketio op	
	client = new SocketIOClient(opts);
  } else if(obj.method == 'SEND') {  // websocket op	
	client = new NativeWSClient(opts);
  } else { // http op
    client = new JQueryHttpClient(opts);
  }
  
  var success = obj.on.response

  var requestInterceptor = function(data) {
    if(opts && opts.requestInterceptor) {
      data = opts.requestInterceptor.apply(data);
    }
    return data;
  };

  var responseInterceptor = function(data) {
    if(opts && opts.responseInterceptor) {
      data = opts.responseInterceptor.apply(data);
    }
    return success(data);
  };

  if(_.isFunction(obj.on.response)) obj.on.response = function(data) {
    responseInterceptor(data);
  };

  if (_.isObject(obj) && _.isObject(obj.body)) {
    // special processing for file uploads via jquery
    if (obj.body.type && obj.body.type === 'formData'){
      obj.contentType = false;
      obj.processData = false;

      delete obj.headers['Content-Type'];
    } else {
      obj.body = JSON.stringify(obj.body);
    }
  }

  obj = requestInterceptor(obj) || obj;
  if (obj.beforeSend) {
    obj.beforeSend(function(_obj) {
      client.execute(_obj || obj);
    });
  } else {
    client.execute(obj);
  }

  return (obj.deferred) ? obj.deferred.promise : obj;
};

function waitForSocketConnection(socket, callback) {
	setTimeout(
		function () {
			if (socket.readyState === 1) {
				callback();
				return;
			} else {
				waitForSocketConnection(socket, callback);
			}
		}, 5); // wait 5 milisecond for the connection...
}

NativeWSClient.prototype.execute = function (obj) {
	var socketList = NativeWSClient.socketList;
	var socket;

	if(typeof socketList[obj.url] === 'undefined') { // socket must be created		
		socket = socketList[obj.url] = new WebSocket(obj.url);
		socket.onopen = function () {
			
			socket.onclose = function() {
				// console.log('disconnected ' + obj.url);
			};
			
			socket.send(obj.body);
		};
	} else {
		socket = socketList[obj.url];
		waitForSocketConnection(socket, function() { socket.send(obj.body); });
	}
	
	if(_.isFunction(obj.on.response)) {
		socket.onmessage = function (evt) {
			// console.log('Received data: ' + JSON.stringify(evt.data));
			var data = JSON.parse(evt.data);
			var body = obj.body;
			var check = true;
			for(var j in data) {
				if(_.isString(body[j]) && body[j] != data[j]) {
					check = false;
					break;
				}
			}
			if(check) {
				// console.log('Response callback for ' + body);
				obj.on.response(data);
			}
		};		
	}
	
	if(_.isFunction(obj.on.error)) {
		socket.onerror = function(event) {
			console.log('Error callback for ' + obj.body);
			obj.on.error(event);
		};			
	}
}

SocketIOClient.prototype.execute = function (obj) {
	var socketList = SocketIOClient.socketList;

	if(typeof socketList[obj.url] === 'undefined') { // socket must be created		
		this.socket = socketList[obj.url] = io.connect(obj.url, function () {
			// console.log('connecttion ' + obj.url);
			
			this.socket.on('disconnected', function() {
				// console.log('disconnected ' + obj.url);
			});				
		});
	} else {
		this.socket = socketList[obj.url];
	}
	
	this.socket.emit('message',JSON.parse(obj.body));
	
	if(_.isFunction(obj.on.response)) {
		this.socket.on('message', function (data) {
			// console.log('Received data: ' + JSON.stringify(data));
			var body = obj.body;
			var check = true;
			for(var j in data) {
				if(_.isString(body[j]) && body[j] != data[j]) {
					check = false;
					break;
				}
			}
			if(check) {
				// console.log('Response callback for ' + body);
				obj.on.response(data);
			}
		});
	}
	
	if(_.isFunction(obj.on.response)) {	
		this.socket.on('error', function(event) {
			console.log('Error callback for ' + obj.body);
			obj.on.error(event);
		});	
	}
}

JQueryHttpClient.prototype.execute = function (obj) {
  var jq = this.jQuery || (typeof window !== 'undefined' && window.jQuery);
  var cb = obj.on;
  var request = obj;

  if(typeof jq === 'undefined' || jq === false) {
    throw new Error('Unsupported configuration! JQuery is required but not available');
  }

  obj.type = obj.method;
  obj.cache = false;
  delete obj.useJQuery;

  /*
  obj.beforeSend = function (xhr) {
    var key, results;
    if (obj.headers) {
      results = [];
      for (key in obj.headers) {
        if (key.toLowerCase() === 'content-type') {
          results.push(obj.contentType = obj.headers[key]);
        } else if (key.toLowerCase() === 'accept') {
          results.push(obj.accepts = obj.headers[key]);
        } else {
          results.push(xhr.setRequestHeader(key, obj.headers[key]));
        }
      }
      return results;
    }
  };*/

  obj.data = obj.body;

  delete obj.body;

  obj.complete = function (response) {
    var headers = {};
    var headerArray = response.getAllResponseHeaders().split('\n');

    for (var i = 0; i < headerArray.length; i++) {
      var toSplit = headerArray[i].trim();

      if (toSplit.length === 0) {
        continue;
      }

      var separator = toSplit.indexOf(':');

      if (separator === -1) {
        // Name but no value in the header
        headers[toSplit] = null;

        continue;
      }

      var name = toSplit.substring(0, separator).trim();
      var value = toSplit.substring(separator + 1).trim();

      headers[name] = value;
    }

    var out = {
      url: request.url,
      method: request.method,
      status: response.status,
      statusText: response.statusText,
      data: response.responseText,
      headers: headers
    };

    try {
      // var possibleObj =  response.responseJSON || jsyaml.safeLoad(response.responseText);
	  var possibleObj =  response.responseJSON;

      out.obj = (typeof possibleObj === 'string') ? {} : possibleObj;
    } catch (ex) {
      // do not set out.obj
      console.log('unable to parse JSON/YAML content');
    }

    // I can throw, or parse null?
    out.obj = out.obj || null;

    if (response.status >= 200 && response.status < 300) {
      if(_.isFunction(cb.response)) cb.response(out);
    } else if (response.status === 0 || (response.status >= 400 && response.status < 599)) {
      if(_.isFunction(cb.error)) cb.error(out);
    } else {
	  if(_.isFunction(cb.response)) cb.response(out);
    }
  };

  jq.support.cors = true;

  return jq.ajax(obj);
};
