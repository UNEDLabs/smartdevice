// require: auth, model, operation, operationGroup, resolver, http, lodash

var supportedOperationMethods = ['delete', 'get', 'head', 'options', 'patch', 'post', 'put', 'send', 'emit'];

var SmartDeviceClient = function (url, options) {
  this.authorizations = null;
  this.authorizationScheme = null;
  this.basePath = null;
  this.debug = false;
  this.enableCookies = false;
  this.info = null;
  this.isBuilt = false;
  this.isValid = false;
  this.modelsArray = [];
  this.resourceCount = 0;
  this.url = null;
  this.swaggerObject = {};

  this.clientAuthorizations = new SwaggerAuthorizations();

  if (typeof url !== 'undefined') {
    return this.initialize(url, options);
  } else {
    return this;
  }
};

SmartDeviceClient.prototype.initialize = function (url, options) {
  this.models = {};
  this.sampleModels = {};

  if (typeof url === 'string') {
    this.url = url;
  } else if (_.isObject(url)) {
    options = url;
    this.url = options.url;
  }

  options = options || {};
  this.clientAuthorizations.add(options.authorizations);
  this.smartDeviceRequestHeaders = options.smartDeviceRequestHeaders || 'application/json;charset=utf-8,*/*';
  this.defaultSuccessCallback = options.defaultSuccessCallback || null;
  this.defaultErrorCallback = options.defaultErrorCallback || null;
  this.modelPropertyMacro = options.modelPropertyMacro || null;
  this.parameterMacro = options.parameterMacro || null;

  if (typeof options.success === 'function') {
    this.success = options.success;
  }

  if (options.enableCookies) {
    this.enableCookies = options.enableCookies;
  }

  this.options = options || {};

  this.supportedSubmitMethods = options.supportedSubmitMethods || [];
  this.failure = options.failure || function (err) { throw err; };
  this.progress = options.progress || function () {};
  this.spec = _.cloneDeep(options.spec); // Clone so we do not alter the provided document

  if (options.scheme) {
    this.scheme = options.scheme;
  }

  if (typeof options.success === 'function') {
    this.ready = true;
    return this.build();
  }
};

SmartDeviceClient.prototype.build = function (mock) {
  if (this.isBuilt) {
    return this;
  }

  var self = this;

  this.progress('fetching resource list: ' + this.url + '; Please wait.');

  var obj = {
    url: this.url,
    method: 'get',
    headers: {
      accept: this.smartDeviceRequestHeaders
    },
    on: {
      error: function (response) {
        if (self.url.substring(0, 4) !== 'http') {
          return self.fail('Please specify the protocol for ' + self.url);
        } else if (response.status === 0) {
          return self.fail('Can\'t read from server.  It may not have the appropriate access-control-origin settings.');
        } else if (response.status === 404) {
          return self.fail('Can\'t read swagger JSON from ' + self.url);
        } else {
          return self.fail(response.status + ' : ' + response.statusText + ' ' + self.url);
        }
      },
      response: function (resp) {

        var responseObj = resp.obj;
        if(!responseObj) {
          return self.fail('failed to parse JSON/YAML response');
        }

		self.apiVersion = responseObj.apiVersion;
        self.swaggerObject = responseObj;

        if (responseObj.swagger && parseInt(responseObj.swagger) === 2) {
          self.swaggerVersion = responseObj.swagger;

          new Resolver().resolve(responseObj, self.url, self.buildFromSpec, self);

          self.isValid = true;
        }
      }
    }
  };

  if (this.spec) {
    self.swaggerObject = this.spec;
    setTimeout(function () {
      new Resolver().resolve(self.spec, self.url, self.buildFromSpec, self);
    }, 10);
  } else {
    this.clientAuthorizations.apply(obj);

    if (mock) {
      return obj;
    }

    new SwaggerHttp().execute(obj, this.options);
  }

  return this;
};

SmartDeviceClient.prototype.buildFromSpec = function (response) {
  if (this.isBuilt) {
    return this;
  }

  this.apis = {};
  this.apisArray = [];
  this.basePath = response.basePath || '';
  this.consumes = response.consumes;
  this.host = response.host || '';
  this.info = response.info || {};
  this.produces = response.produces;
  this.schemes = response.schemes || [];
  this.securityDefinitions = response.securityDefinitions;
  this.security = response.security;
  this.title = response.title || '';

  if (response.externalDocs) {
    this.externalDocs = response.externalDocs;
  }

  // legacy support
  this.authSchemes = response.securityDefinitions;

  var definedTags = {};
  var k;

  if (Array.isArray(response.tags)) {
    definedTags = {};

    for (k = 0; k < response.tags.length; k++) {
      var t = response.tags[k];
      definedTags[t.name] = t;
    }
  }

  var location;

  if (typeof this.url === 'string') {
    location = this.parseUri(this.url);
    if (typeof this.scheme === 'undefined' && typeof this.schemes === 'undefined' || this.schemes.length === 0) {
      this.scheme = location.scheme || 'http';
    } else if (typeof this.scheme === 'undefined') {
      this.scheme = this.schemes[0] || location.scheme;
    }

    if (typeof this.host === 'undefined' || this.host === '') {
      this.host = location.host;

      if (location.port) {
        this.host = this.host + ':' + location.port;
      }
    }
  }
  else {
    if (typeof this.schemes === 'undefined' || this.schemes.length === 0) {
      this.scheme = 'http';
    }
    else if (typeof this.scheme === 'undefined') {
      this.scheme = this.schemes[0];
    }
  }

  this.definitions = response.definitions;

  var key;

  for (key in this.definitions) {
    var model = new Model(key, this.definitions[key], this.models, this.modelPropertyMacro);

    if (model) {
      this.models[key] = model;
    }
  }

  // get paths, create functions for each operationId
  var self = this;

  // Bind help to 'client.apis'
  self.apis.help = _.bind(self.help, self);

  _.forEach(response.paths, function (pathObj, path) {
    // Only process a path if it's an object
    if (!_.isPlainObject(pathObj)) {
      return;
    }

    _.forEach(supportedOperationMethods, function (method) {
	  var operationList = [];

      if (_.isUndefined(pathObj[method])) {
        // Operation does not exist
        return;
      } else if (_.isArray(pathObj[method])) {
		operationList = pathObj[method];  
	  } else if (_.isPlainObject(pathObj[method])) {
		operationList.push(pathObj[method]);
	  } else { 
        // Operation exists but it is not an Operation Object.  Since this is invalid, log it.
        console.log('The \'' + method + '\' operation for \'' + path + '\' path is not an Operation Object');

        return;
      }

	  for(var i in operationList) {
		  var operation = operationList[i];
		  var tags = operation.tags;

		  if (_.isUndefined(tags) || !_.isArray(tags) || tags.length === 0) {
			tags = operation.tags = [ 'default' ];
		  }

		  var operationId = self.idFromOp(path, method, operation);

		  var operationObject = new Operation(self,
			operation.scheme,
			operationId,
			method,
			path,
			operation,
			self.definitions,
			self.models,
			self.clientAuthorizations);

		  // bind self operation's execute command to the api
		  _.forEach(tags, function (tag) {
			var clientProperty = tag;
			var apiProperty = tag;
			var operationGroup = self[clientProperty];

			if (_.isUndefined(operationGroup)) {
			  operationGroup = self[clientProperty] = self.apis[apiProperty] = {};

			  operationGroup.operations = {};
			  operationGroup.label = apiProperty;
			  operationGroup.apis = {};

			  var tagDef = definedTags[tag];

			  if (!_.isUndefined(tagDef)) {
				operationGroup.description = tagDef.description;
				operationGroup.externalDocs = tagDef.externalDocs;
			  }

			  self[clientProperty].help = _.bind(self.help, operationGroup);
			  self.apisArray.push(new OperationGroup(tag, operationGroup.description, operationGroup.externalDocs, operationObject));
			}

			operationId = self.makeUniqueOperationId(operationId, self.apis[apiProperty]);

			// Bind tag help
			if (!_.isFunction(operationGroup.help)) {
			  operationGroup.help = _.bind(self.help, operationGroup);
			}

			// bind to the apis object
			self.apis[apiProperty][operationId] = operationGroup[operationId] = _.bind(operationObject.execute,
																					  operationObject);
			self.apis[apiProperty][operationId].help = operationGroup[operationId].help = _.bind(operationObject.help,
																								 operationObject);
			self.apis[apiProperty][operationId].asCurl = operationGroup[operationId].asCurl = _.bind(operationObject.asCurl,
																									 operationObject);

			operationGroup.apis[operationId] = operationGroup.operations[operationId] = operationObject;

			// legacy UI feature
			var api = _.find(self.apisArray, function (api) {
			  return api.tag === tag;
			});

			if (api) {
			  api.operationsArray.push(operationObject);
			}
		  });
	  }
    });
  });

  // sort the apisArray according to the tags
  var sortedApis = [];
  _.forEach(Object.keys(definedTags), function (tag) {
    var _apiToAdd;
    var pos;
    for(pos in self.apisArray) {
      var _api = self.apisArray[pos];
      if(_api && tag === _api.name) {
        sortedApis.push(_api);
        self.apisArray[pos] = null;
      }
    }
  });
  // add anything left
  _.forEach(self.apisArray, function (api) {
    if(api) {
      sortedApis.push(api);
    }
  });
  self.apisArray = sortedApis;

  _.forEach(response.definitions, function (definitionObj, definition) {
    definitionObj['id'] = definition.toLowerCase();
    definitionObj['name'] = definition;
    self.modelsArray.push(definitionObj);
  });

  this.isBuilt = true;

  if (this.success) {
    this.success();
  }

  return this;
};

SmartDeviceClient.prototype.makeUniqueOperationId = function(operationId, api) {
  var count = 0;
  var name = operationId;

  // make unique across this operation group
  while(true) {
    var matched = false;
    _.forEach(api.operations, function (operation) {
      if(operation.nickname === name) {
        matched = true;
      }
    });
    if(!matched) {
      return name;
    }
    name = operationId + '_' + count;
    count ++;
  }

  return operationId;
};

SmartDeviceClient.prototype.parseUri = function (uri) {
  var urlParseRE = /^(((([^:\/#\?]+:)?(?:(\/\/)((?:(([^:@\/#\?]+)(?:\:([^:@\/#\?]+))?)@)?(([^:\/#\?\]\[]+|\[[^\/\]@#?]+\])(?:\:([0-9]+))?))?)?)?((\/?(?:[^\/\?#]+\/+)*)([^\?#]*)))?(\?[^#]+)?)(#.*)?/;
  var parts = urlParseRE.exec(uri);

  return {
    scheme: parts[4] ? parts[4].replace(':','') : undefined,
    host: parts[11],
    port: parts[12],
    path: parts[15]
  };
};

SmartDeviceClient.prototype.help = function (dontPrint) {
  var output = '';

  if (this instanceof SmartDeviceClient) {
    _.forEach(this.apis, function (api, name) {
      if (_.isPlainObject(api)) {
        output += 'operations for the \'' + name + '\' tag\n';

        _.forEach(api.operations, function (operation, name) {
          output += '  * ' + name + ': ' + operation.summary + '\n';
        });
      }
    });
  } else if (this instanceof OperationGroup || _.isPlainObject(this)) {
    output += 'operations for the \'' + this.label + '\' tag\n';

    _.forEach(this.apis, function (operation, name) {
      output += '  * ' + name + ': ' + operation.summary + '\n';
    });
  }

  if (dontPrint) {
    return output;
  } else {
    console.log(output);

    return output;
  }
};

SmartDeviceClient.prototype.tagFromLabel = function (label) {
  return label;
};

SmartDeviceClient.prototype.idFromOp = function (path, httpMethod, op) {
  if(!op || !op.operationId) {
    op = op || {};
    op.operationId = httpMethod + '_' + path;
  }
  var opId = op.operationId.replace(/[\s!@#$%^&*()_+=\[{\]};:<>|.\/?,\\'""-]/g, '_') || (path.substring(1) + '_' + httpMethod);

  opId = opId.replace(/((_){2,})/g, '_');
  opId = opId.replace(/^(_)*/g, '');
  opId = opId.replace(/([_])*$/g, '');

  return opId;
};

SmartDeviceClient.prototype.setHost = function (host) {
  this.host = host;

  if(this.apis) {
    _.forEach(this.apis, function(api) {
      if(api.operations) {
        _.forEach(api.operations, function(operation) {
          operation.host = host;
        });
      }
    });
  }
};

SmartDeviceClient.prototype.setBasePath = function (basePath) {
  this.basePath = basePath;

  if(this.apis) {
    _.forEach(this.apis, function(api) {
      if(api.operations) {
        _.forEach(api.operations, function(operation) {
          operation.basePath = basePath;
        });
      }
    });
  }
};

SmartDeviceClient.prototype.setSchemes = function (schemes) {
  this.schemes = schemes;

  if(schemes && schemes.length > 0) {
    if(this.apis) {
      _.forEach(this.apis, function (api) {
        if (api.operations) {
          _.forEach(api.operations, function (operation) {
            operation.scheme = schemes[0];
          });
        }
      });
    }
  }
};


SmartDeviceClient.prototype.fail = function (message) {
  if (this.failure) {
    this.failure(message);
  }
  else {
    this.failure(message);
  }
};