// require: lodash

function log() {
  // Only log if available and we're not testing
  if (console) {
    console.log(Array.prototype.slice.call(arguments)[0]);
  }
};

function optionHtml(label, value) {
  return '<tr><td class="optionName">' + label + ':</td><td>' + value + '</td></tr>';
};

function resolveSchema (schema) {
  if (_.isPlainObject(schema.schema)) {
    schema = resolveSchema(schema.schema);
  }

  return schema;
};

function simpleRef (name) {
  if (typeof name === 'undefined') {
    return null;
  }

  if (name.indexOf('#/definitions/') === 0) {
    return name.substring('#/definitions/'.length);
  } else {
    return name;
  }
};

