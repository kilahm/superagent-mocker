'use strict';

/**
 * Dependencies
 */
var pathtoRegexp = require('path-to-regexp');

/**
 * Expose public API
 */
module.exports = mock;
mock.get       = defineRoute.bind(null, 'GET');
mock.post      = defineRoute.bind(null, 'POST');
mock.put       = defineRoute.bind(null, 'PUT');
mock.del       = defineRoute.bind(null, 'DELETE');

/**
 * Request timeout
 * @type {number|function}
 */
mock.timeout    = 0;

/**
 * List of registred callbacks
 */
var callbacks = [];

/**
 * Unregister all callbacks
 */
mock.clearRoutes = function() {
    callbacks.splice(0, callbacks.length)
}

/**
 * Mock
 */
function mock(superagent) {

  // don't patch if superagent was patched already
  if (superagent._patchedBySuperagentMocker) return mock;
  superagent._patchedBySuperagentMocker = true;

  // The room for matched route
  var state = { current: null };

  // Patch superagent
  patch(superagent, 'get', 'GET', state);
  patch(superagent, 'post', 'POST', state);
  patch(superagent, 'put', 'PUT', state);
  patch(superagent, 'del', 'DELETE', state);

  // Patch Request.end()
  var oldEnd = superagent.Request.prototype.end;
  superagent.Request.prototype.end = function(cb) {
    var current = state.current;
    if (current) {
      setTimeout(function() {
        try {
          cb && cb(null, current());
        } catch (ex) {
          cb && cb(ex, null);
        }
      }, value(mock.timeout));
    } else {
      oldEnd.call(this, cb);
    }
  };

  return mock; // chaining

}

/**
 * find route that matched with url and method
 * TODO: Remove data
 */
function match(method, url, data) {
  return callbacks.reduce(function(memo, cb) {
    var m = cb.match(method, url, data);
    return m ? m : memo;
  }, null);
}

/**
 * Register url and callback for `get`
 */
function defineRoute(method, url, callback) {
  callbacks.push(new Route({
    url: url,
    callback: callback,
    method: method
  }));
  return mock;
}

/**
 * Patch superagent method
 */
function patch(superagent, prop, method, state) {
  var old = superagent[prop];
  superagent[prop] = function (url, data, fn) {
    state.current = match(method, url, data);
    return state.current
      ? superagent(method, url, data, fn)
      : old.call(this, url, data, fn);
  };
}

/**
 * Route with given url
 */
var Route = function Route(state) {
  this.url    = state.url;
  this.fn     = state.callback;
  this.method = state.method;
  this.regexp = pathtoRegexp(this.url, this.keys = []);
};

/**
 * Match route with given url
 */
Route.prototype.match = function(method, url, body) {
  if (this.method !== method) return false;
  var params = {};
  var m = this.regexp.exec(url);
  if (!m) return false;
  for (var i = 1, len = m.length; i < len; ++i) {
    var key = this.keys[i - 1];
    var val = m[i];
    if (val !== undefined || !(hasOwnProperty.call(params, key.name))) {
      params[key.name] = val;
    }
  }
  var route = this;
  return function() {
    return route.fn({
      url: url,
      params: params || {},
      body: body || {}
    });
  };
};

/**
 * Exec function and return value, or just return arg
 * @param {fn|any} val Value or fn to exec
 */
function value(val) {
  return 'function' === typeof val
    ? val()
    : val;
}
