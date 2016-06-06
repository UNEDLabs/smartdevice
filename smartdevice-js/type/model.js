// require: schema-markup

var Model = function (name, definition, models, modelPropertyMacro) {
  this.definition = definition || {};
  this.isArray = definition.type === 'array';
  this.models = models || {};
  this.name = name || definition.title || 'Inline Model';
  this.modelPropertyMacro = modelPropertyMacro || function (property) {
    return property.default;
  };

  return this;
};

// Note!  This function will be removed in 2.2.x!
Model.prototype.createJSONSample = Model.prototype.getSampleValue = function (modelsToIgnore) {
  modelsToIgnore = modelsToIgnore || {};

  modelsToIgnore[this.name] = this;

  // Response support
  if (this.examples && _.isPlainObject(this.examples) && this.examples['application/json']) {
    this.definition.example = this.examples['application/json'];

    if (_.isString(this.definition.example)) {
      this.definition.example = jsyaml.safeLoad(this.definition.example);
    }
  } else if (!this.definition.example) {
    this.definition.example = this.examples;
  }

  return schemaToJSON(this.definition, this.models, modelsToIgnore, this.modelPropertyMacro);
};

Model.prototype.getMockSignature = function () {
  return schemaToHTML(this.name, this.definition, this.models, this.modelPropertyMacro);
};
