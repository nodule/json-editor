require=(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);throw new Error("Cannot find module '"+o+"'")}var f=n[o]={exports:{}};t[o][0].call(f.exports,function(e){var n=t[o][1][e];return s(n?n:e)},f,f.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

function EventEmitter() {
  this._events = this._events || {};
  this._maxListeners = this._maxListeners || undefined;
}
module.exports = EventEmitter;

// Backwards-compat with node 0.10.x
EventEmitter.EventEmitter = EventEmitter;

EventEmitter.prototype._events = undefined;
EventEmitter.prototype._maxListeners = undefined;

// By default EventEmitters will print a warning if more than 10 listeners are
// added to it. This is a useful default which helps finding memory leaks.
EventEmitter.defaultMaxListeners = 10;

// Obviously not all Emitters should be limited to 10. This function allows
// that to be increased. Set to zero for unlimited.
EventEmitter.prototype.setMaxListeners = function(n) {
  if (!isNumber(n) || n < 0 || isNaN(n))
    throw TypeError('n must be a positive number');
  this._maxListeners = n;
  return this;
};

EventEmitter.prototype.emit = function(type) {
  var er, handler, len, args, i, listeners;

  if (!this._events)
    this._events = {};

  // If there is no 'error' event listener then throw.
  if (type === 'error') {
    if (!this._events.error ||
        (isObject(this._events.error) && !this._events.error.length)) {
      er = arguments[1];
      if (er instanceof Error) {
        throw er; // Unhandled 'error' event
      }
      throw TypeError('Uncaught, unspecified "error" event.');
    }
  }

  handler = this._events[type];

  if (isUndefined(handler))
    return false;

  if (isFunction(handler)) {
    switch (arguments.length) {
      // fast cases
      case 1:
        handler.call(this);
        break;
      case 2:
        handler.call(this, arguments[1]);
        break;
      case 3:
        handler.call(this, arguments[1], arguments[2]);
        break;
      // slower
      default:
        len = arguments.length;
        args = new Array(len - 1);
        for (i = 1; i < len; i++)
          args[i - 1] = arguments[i];
        handler.apply(this, args);
    }
  } else if (isObject(handler)) {
    len = arguments.length;
    args = new Array(len - 1);
    for (i = 1; i < len; i++)
      args[i - 1] = arguments[i];

    listeners = handler.slice();
    len = listeners.length;
    for (i = 0; i < len; i++)
      listeners[i].apply(this, args);
  }

  return true;
};

EventEmitter.prototype.addListener = function(type, listener) {
  var m;

  if (!isFunction(listener))
    throw TypeError('listener must be a function');

  if (!this._events)
    this._events = {};

  // To avoid recursion in the case that type === "newListener"! Before
  // adding it to the listeners, first emit "newListener".
  if (this._events.newListener)
    this.emit('newListener', type,
              isFunction(listener.listener) ?
              listener.listener : listener);

  if (!this._events[type])
    // Optimize the case of one listener. Don't need the extra array object.
    this._events[type] = listener;
  else if (isObject(this._events[type]))
    // If we've already got an array, just append.
    this._events[type].push(listener);
  else
    // Adding the second element, need to change to array.
    this._events[type] = [this._events[type], listener];

  // Check for listener leak
  if (isObject(this._events[type]) && !this._events[type].warned) {
    var m;
    if (!isUndefined(this._maxListeners)) {
      m = this._maxListeners;
    } else {
      m = EventEmitter.defaultMaxListeners;
    }

    if (m && m > 0 && this._events[type].length > m) {
      this._events[type].warned = true;
      console.error('(node) warning: possible EventEmitter memory ' +
                    'leak detected. %d listeners added. ' +
                    'Use emitter.setMaxListeners() to increase limit.',
                    this._events[type].length);
      if (typeof console.trace === 'function') {
        // not supported in IE 10
        console.trace();
      }
    }
  }

  return this;
};

EventEmitter.prototype.on = EventEmitter.prototype.addListener;

EventEmitter.prototype.once = function(type, listener) {
  if (!isFunction(listener))
    throw TypeError('listener must be a function');

  var fired = false;

  function g() {
    this.removeListener(type, g);

    if (!fired) {
      fired = true;
      listener.apply(this, arguments);
    }
  }

  g.listener = listener;
  this.on(type, g);

  return this;
};

// emits a 'removeListener' event iff the listener was removed
EventEmitter.prototype.removeListener = function(type, listener) {
  var list, position, length, i;

  if (!isFunction(listener))
    throw TypeError('listener must be a function');

  if (!this._events || !this._events[type])
    return this;

  list = this._events[type];
  length = list.length;
  position = -1;

  if (list === listener ||
      (isFunction(list.listener) && list.listener === listener)) {
    delete this._events[type];
    if (this._events.removeListener)
      this.emit('removeListener', type, listener);

  } else if (isObject(list)) {
    for (i = length; i-- > 0;) {
      if (list[i] === listener ||
          (list[i].listener && list[i].listener === listener)) {
        position = i;
        break;
      }
    }

    if (position < 0)
      return this;

    if (list.length === 1) {
      list.length = 0;
      delete this._events[type];
    } else {
      list.splice(position, 1);
    }

    if (this._events.removeListener)
      this.emit('removeListener', type, listener);
  }

  return this;
};

EventEmitter.prototype.removeAllListeners = function(type) {
  var key, listeners;

  if (!this._events)
    return this;

  // not listening for removeListener, no need to emit
  if (!this._events.removeListener) {
    if (arguments.length === 0)
      this._events = {};
    else if (this._events[type])
      delete this._events[type];
    return this;
  }

  // emit removeListener for all listeners on all events
  if (arguments.length === 0) {
    for (key in this._events) {
      if (key === 'removeListener') continue;
      this.removeAllListeners(key);
    }
    this.removeAllListeners('removeListener');
    this._events = {};
    return this;
  }

  listeners = this._events[type];

  if (isFunction(listeners)) {
    this.removeListener(type, listeners);
  } else {
    // LIFO order
    while (listeners.length)
      this.removeListener(type, listeners[listeners.length - 1]);
  }
  delete this._events[type];

  return this;
};

EventEmitter.prototype.listeners = function(type) {
  var ret;
  if (!this._events || !this._events[type])
    ret = [];
  else if (isFunction(this._events[type]))
    ret = [this._events[type]];
  else
    ret = this._events[type].slice();
  return ret;
};

EventEmitter.listenerCount = function(emitter, type) {
  var ret;
  if (!emitter._events || !emitter._events[type])
    ret = 0;
  else if (isFunction(emitter._events[type]))
    ret = 1;
  else
    ret = emitter._events[type].length;
  return ret;
};

function isFunction(arg) {
  return typeof arg === 'function';
}

function isNumber(arg) {
  return typeof arg === 'number';
}

function isObject(arg) {
  return typeof arg === 'object' && arg !== null;
}

function isUndefined(arg) {
  return arg === void 0;
}

},{}],2:[function(require,module,exports){
if (typeof Object.create === 'function') {
  // implementation from standard node.js 'util' module
  module.exports = function inherits(ctor, superCtor) {
    ctor.super_ = superCtor
    ctor.prototype = Object.create(superCtor.prototype, {
      constructor: {
        value: ctor,
        enumerable: false,
        writable: true,
        configurable: true
      }
    });
  };
} else {
  // old school shim for old browsers
  module.exports = function inherits(ctor, superCtor) {
    ctor.super_ = superCtor
    var TempCtor = function () {}
    TempCtor.prototype = superCtor.prototype
    ctor.prototype = new TempCtor()
    ctor.prototype.constructor = ctor
  }
}

},{}],3:[function(require,module,exports){
(function (process){
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

// resolves . and .. elements in a path array with directory names there
// must be no slashes, empty elements, or device names (c:\) in the array
// (so also no leading and trailing slashes - it does not distinguish
// relative and absolute paths)
function normalizeArray(parts, allowAboveRoot) {
  // if the path tries to go above the root, `up` ends up > 0
  var up = 0;
  for (var i = parts.length - 1; i >= 0; i--) {
    var last = parts[i];
    if (last === '.') {
      parts.splice(i, 1);
    } else if (last === '..') {
      parts.splice(i, 1);
      up++;
    } else if (up) {
      parts.splice(i, 1);
      up--;
    }
  }

  // if the path is allowed to go above the root, restore leading ..s
  if (allowAboveRoot) {
    for (; up--; up) {
      parts.unshift('..');
    }
  }

  return parts;
}

// Split a filename into [root, dir, basename, ext], unix version
// 'root' is just a slash, or nothing.
var splitPathRe =
    /^(\/?|)([\s\S]*?)((?:\.{1,2}|[^\/]+?|)(\.[^.\/]*|))(?:[\/]*)$/;
var splitPath = function(filename) {
  return splitPathRe.exec(filename).slice(1);
};

// path.resolve([from ...], to)
// posix version
exports.resolve = function() {
  var resolvedPath = '',
      resolvedAbsolute = false;

  for (var i = arguments.length - 1; i >= -1 && !resolvedAbsolute; i--) {
    var path = (i >= 0) ? arguments[i] : process.cwd();

    // Skip empty and invalid entries
    if (typeof path !== 'string') {
      throw new TypeError('Arguments to path.resolve must be strings');
    } else if (!path) {
      continue;
    }

    resolvedPath = path + '/' + resolvedPath;
    resolvedAbsolute = path.charAt(0) === '/';
  }

  // At this point the path should be resolved to a full absolute path, but
  // handle relative paths to be safe (might happen when process.cwd() fails)

  // Normalize the path
  resolvedPath = normalizeArray(filter(resolvedPath.split('/'), function(p) {
    return !!p;
  }), !resolvedAbsolute).join('/');

  return ((resolvedAbsolute ? '/' : '') + resolvedPath) || '.';
};

// path.normalize(path)
// posix version
exports.normalize = function(path) {
  var isAbsolute = exports.isAbsolute(path),
      trailingSlash = substr(path, -1) === '/';

  // Normalize the path
  path = normalizeArray(filter(path.split('/'), function(p) {
    return !!p;
  }), !isAbsolute).join('/');

  if (!path && !isAbsolute) {
    path = '.';
  }
  if (path && trailingSlash) {
    path += '/';
  }

  return (isAbsolute ? '/' : '') + path;
};

// posix version
exports.isAbsolute = function(path) {
  return path.charAt(0) === '/';
};

// posix version
exports.join = function() {
  var paths = Array.prototype.slice.call(arguments, 0);
  return exports.normalize(filter(paths, function(p, index) {
    if (typeof p !== 'string') {
      throw new TypeError('Arguments to path.join must be strings');
    }
    return p;
  }).join('/'));
};


// path.relative(from, to)
// posix version
exports.relative = function(from, to) {
  from = exports.resolve(from).substr(1);
  to = exports.resolve(to).substr(1);

  function trim(arr) {
    var start = 0;
    for (; start < arr.length; start++) {
      if (arr[start] !== '') break;
    }

    var end = arr.length - 1;
    for (; end >= 0; end--) {
      if (arr[end] !== '') break;
    }

    if (start > end) return [];
    return arr.slice(start, end - start + 1);
  }

  var fromParts = trim(from.split('/'));
  var toParts = trim(to.split('/'));

  var length = Math.min(fromParts.length, toParts.length);
  var samePartsLength = length;
  for (var i = 0; i < length; i++) {
    if (fromParts[i] !== toParts[i]) {
      samePartsLength = i;
      break;
    }
  }

  var outputParts = [];
  for (var i = samePartsLength; i < fromParts.length; i++) {
    outputParts.push('..');
  }

  outputParts = outputParts.concat(toParts.slice(samePartsLength));

  return outputParts.join('/');
};

exports.sep = '/';
exports.delimiter = ':';

exports.dirname = function(path) {
  var result = splitPath(path),
      root = result[0],
      dir = result[1];

  if (!root && !dir) {
    // No dirname whatsoever
    return '.';
  }

  if (dir) {
    // It has a dirname, strip trailing slash
    dir = dir.substr(0, dir.length - 1);
  }

  return root + dir;
};


exports.basename = function(path, ext) {
  var f = splitPath(path)[2];
  // TODO: make this comparison case-insensitive on windows?
  if (ext && f.substr(-1 * ext.length) === ext) {
    f = f.substr(0, f.length - ext.length);
  }
  return f;
};


exports.extname = function(path) {
  return splitPath(path)[3];
};

function filter (xs, f) {
    if (xs.filter) return xs.filter(f);
    var res = [];
    for (var i = 0; i < xs.length; i++) {
        if (f(xs[i], i, xs)) res.push(xs[i]);
    }
    return res;
}

// String.prototype.substr - negative index don't work in IE8
var substr = 'ab'.substr(-1) === 'b'
    ? function (str, start, len) { return str.substr(start, len) }
    : function (str, start, len) {
        if (start < 0) start = str.length + start;
        return str.substr(start, len);
    }
;

}).call(this,require("uojqOp"))
},{"uojqOp":4}],4:[function(require,module,exports){
// shim for using process in browser

var process = module.exports = {};

process.nextTick = (function () {
    var canSetImmediate = typeof window !== 'undefined'
    && window.setImmediate;
    var canPost = typeof window !== 'undefined'
    && window.postMessage && window.addEventListener
    ;

    if (canSetImmediate) {
        return function (f) { return window.setImmediate(f) };
    }

    if (canPost) {
        var queue = [];
        window.addEventListener('message', function (ev) {
            var source = ev.source;
            if ((source === window || source === null) && ev.data === 'process-tick') {
                ev.stopPropagation();
                if (queue.length > 0) {
                    var fn = queue.shift();
                    fn();
                }
            }
        }, true);

        return function nextTick(fn) {
            queue.push(fn);
            window.postMessage('process-tick', '*');
        };
    }

    return function nextTick(fn) {
        setTimeout(fn, 0);
    };
})();

process.title = 'browser';
process.browser = true;
process.env = {};
process.argv = [];

function noop() {}

process.on = noop;
process.addListener = noop;
process.once = noop;
process.off = noop;
process.removeListener = noop;
process.removeAllListeners = noop;
process.emit = noop;

process.binding = function (name) {
    throw new Error('process.binding is not supported');
}

// TODO(shtylman)
process.cwd = function () { return '/' };
process.chdir = function (dir) {
    throw new Error('process.chdir is not supported');
};

},{}],5:[function(require,module,exports){
module.exports = function isBuffer(arg) {
  return arg && typeof arg === 'object'
    && typeof arg.copy === 'function'
    && typeof arg.fill === 'function'
    && typeof arg.readUInt8 === 'function';
}
},{}],6:[function(require,module,exports){
(function (process,global){
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

var formatRegExp = /%[sdj%]/g;
exports.format = function(f) {
  if (!isString(f)) {
    var objects = [];
    for (var i = 0; i < arguments.length; i++) {
      objects.push(inspect(arguments[i]));
    }
    return objects.join(' ');
  }

  var i = 1;
  var args = arguments;
  var len = args.length;
  var str = String(f).replace(formatRegExp, function(x) {
    if (x === '%%') return '%';
    if (i >= len) return x;
    switch (x) {
      case '%s': return String(args[i++]);
      case '%d': return Number(args[i++]);
      case '%j':
        try {
          return JSON.stringify(args[i++]);
        } catch (_) {
          return '[Circular]';
        }
      default:
        return x;
    }
  });
  for (var x = args[i]; i < len; x = args[++i]) {
    if (isNull(x) || !isObject(x)) {
      str += ' ' + x;
    } else {
      str += ' ' + inspect(x);
    }
  }
  return str;
};


// Mark that a method should not be used.
// Returns a modified function which warns once by default.
// If --no-deprecation is set, then it is a no-op.
exports.deprecate = function(fn, msg) {
  // Allow for deprecating things in the process of starting up.
  if (isUndefined(global.process)) {
    return function() {
      return exports.deprecate(fn, msg).apply(this, arguments);
    };
  }

  if (process.noDeprecation === true) {
    return fn;
  }

  var warned = false;
  function deprecated() {
    if (!warned) {
      if (process.throwDeprecation) {
        throw new Error(msg);
      } else if (process.traceDeprecation) {
        console.trace(msg);
      } else {
        console.error(msg);
      }
      warned = true;
    }
    return fn.apply(this, arguments);
  }

  return deprecated;
};


var debugs = {};
var debugEnviron;
exports.debuglog = function(set) {
  if (isUndefined(debugEnviron))
    debugEnviron = process.env.NODE_DEBUG || '';
  set = set.toUpperCase();
  if (!debugs[set]) {
    if (new RegExp('\\b' + set + '\\b', 'i').test(debugEnviron)) {
      var pid = process.pid;
      debugs[set] = function() {
        var msg = exports.format.apply(exports, arguments);
        console.error('%s %d: %s', set, pid, msg);
      };
    } else {
      debugs[set] = function() {};
    }
  }
  return debugs[set];
};


/**
 * Echos the value of a value. Trys to print the value out
 * in the best way possible given the different types.
 *
 * @param {Object} obj The object to print out.
 * @param {Object} opts Optional options object that alters the output.
 */
/* legacy: obj, showHidden, depth, colors*/
function inspect(obj, opts) {
  // default options
  var ctx = {
    seen: [],
    stylize: stylizeNoColor
  };
  // legacy...
  if (arguments.length >= 3) ctx.depth = arguments[2];
  if (arguments.length >= 4) ctx.colors = arguments[3];
  if (isBoolean(opts)) {
    // legacy...
    ctx.showHidden = opts;
  } else if (opts) {
    // got an "options" object
    exports._extend(ctx, opts);
  }
  // set default options
  if (isUndefined(ctx.showHidden)) ctx.showHidden = false;
  if (isUndefined(ctx.depth)) ctx.depth = 2;
  if (isUndefined(ctx.colors)) ctx.colors = false;
  if (isUndefined(ctx.customInspect)) ctx.customInspect = true;
  if (ctx.colors) ctx.stylize = stylizeWithColor;
  return formatValue(ctx, obj, ctx.depth);
}
exports.inspect = inspect;


// http://en.wikipedia.org/wiki/ANSI_escape_code#graphics
inspect.colors = {
  'bold' : [1, 22],
  'italic' : [3, 23],
  'underline' : [4, 24],
  'inverse' : [7, 27],
  'white' : [37, 39],
  'grey' : [90, 39],
  'black' : [30, 39],
  'blue' : [34, 39],
  'cyan' : [36, 39],
  'green' : [32, 39],
  'magenta' : [35, 39],
  'red' : [31, 39],
  'yellow' : [33, 39]
};

// Don't use 'blue' not visible on cmd.exe
inspect.styles = {
  'special': 'cyan',
  'number': 'yellow',
  'boolean': 'yellow',
  'undefined': 'grey',
  'null': 'bold',
  'string': 'green',
  'date': 'magenta',
  // "name": intentionally not styling
  'regexp': 'red'
};


function stylizeWithColor(str, styleType) {
  var style = inspect.styles[styleType];

  if (style) {
    return '\u001b[' + inspect.colors[style][0] + 'm' + str +
           '\u001b[' + inspect.colors[style][1] + 'm';
  } else {
    return str;
  }
}


function stylizeNoColor(str, styleType) {
  return str;
}


function arrayToHash(array) {
  var hash = {};

  array.forEach(function(val, idx) {
    hash[val] = true;
  });

  return hash;
}


function formatValue(ctx, value, recurseTimes) {
  // Provide a hook for user-specified inspect functions.
  // Check that value is an object with an inspect function on it
  if (ctx.customInspect &&
      value &&
      isFunction(value.inspect) &&
      // Filter out the util module, it's inspect function is special
      value.inspect !== exports.inspect &&
      // Also filter out any prototype objects using the circular check.
      !(value.constructor && value.constructor.prototype === value)) {
    var ret = value.inspect(recurseTimes, ctx);
    if (!isString(ret)) {
      ret = formatValue(ctx, ret, recurseTimes);
    }
    return ret;
  }

  // Primitive types cannot have properties
  var primitive = formatPrimitive(ctx, value);
  if (primitive) {
    return primitive;
  }

  // Look up the keys of the object.
  var keys = Object.keys(value);
  var visibleKeys = arrayToHash(keys);

  if (ctx.showHidden) {
    keys = Object.getOwnPropertyNames(value);
  }

  // IE doesn't make error fields non-enumerable
  // http://msdn.microsoft.com/en-us/library/ie/dww52sbt(v=vs.94).aspx
  if (isError(value)
      && (keys.indexOf('message') >= 0 || keys.indexOf('description') >= 0)) {
    return formatError(value);
  }

  // Some type of object without properties can be shortcutted.
  if (keys.length === 0) {
    if (isFunction(value)) {
      var name = value.name ? ': ' + value.name : '';
      return ctx.stylize('[Function' + name + ']', 'special');
    }
    if (isRegExp(value)) {
      return ctx.stylize(RegExp.prototype.toString.call(value), 'regexp');
    }
    if (isDate(value)) {
      return ctx.stylize(Date.prototype.toString.call(value), 'date');
    }
    if (isError(value)) {
      return formatError(value);
    }
  }

  var base = '', array = false, braces = ['{', '}'];

  // Make Array say that they are Array
  if (isArray(value)) {
    array = true;
    braces = ['[', ']'];
  }

  // Make functions say that they are functions
  if (isFunction(value)) {
    var n = value.name ? ': ' + value.name : '';
    base = ' [Function' + n + ']';
  }

  // Make RegExps say that they are RegExps
  if (isRegExp(value)) {
    base = ' ' + RegExp.prototype.toString.call(value);
  }

  // Make dates with properties first say the date
  if (isDate(value)) {
    base = ' ' + Date.prototype.toUTCString.call(value);
  }

  // Make error with message first say the error
  if (isError(value)) {
    base = ' ' + formatError(value);
  }

  if (keys.length === 0 && (!array || value.length == 0)) {
    return braces[0] + base + braces[1];
  }

  if (recurseTimes < 0) {
    if (isRegExp(value)) {
      return ctx.stylize(RegExp.prototype.toString.call(value), 'regexp');
    } else {
      return ctx.stylize('[Object]', 'special');
    }
  }

  ctx.seen.push(value);

  var output;
  if (array) {
    output = formatArray(ctx, value, recurseTimes, visibleKeys, keys);
  } else {
    output = keys.map(function(key) {
      return formatProperty(ctx, value, recurseTimes, visibleKeys, key, array);
    });
  }

  ctx.seen.pop();

  return reduceToSingleString(output, base, braces);
}


function formatPrimitive(ctx, value) {
  if (isUndefined(value))
    return ctx.stylize('undefined', 'undefined');
  if (isString(value)) {
    var simple = '\'' + JSON.stringify(value).replace(/^"|"$/g, '')
                                             .replace(/'/g, "\\'")
                                             .replace(/\\"/g, '"') + '\'';
    return ctx.stylize(simple, 'string');
  }
  if (isNumber(value))
    return ctx.stylize('' + value, 'number');
  if (isBoolean(value))
    return ctx.stylize('' + value, 'boolean');
  // For some reason typeof null is "object", so special case here.
  if (isNull(value))
    return ctx.stylize('null', 'null');
}


function formatError(value) {
  return '[' + Error.prototype.toString.call(value) + ']';
}


function formatArray(ctx, value, recurseTimes, visibleKeys, keys) {
  var output = [];
  for (var i = 0, l = value.length; i < l; ++i) {
    if (hasOwnProperty(value, String(i))) {
      output.push(formatProperty(ctx, value, recurseTimes, visibleKeys,
          String(i), true));
    } else {
      output.push('');
    }
  }
  keys.forEach(function(key) {
    if (!key.match(/^\d+$/)) {
      output.push(formatProperty(ctx, value, recurseTimes, visibleKeys,
          key, true));
    }
  });
  return output;
}


function formatProperty(ctx, value, recurseTimes, visibleKeys, key, array) {
  var name, str, desc;
  desc = Object.getOwnPropertyDescriptor(value, key) || { value: value[key] };
  if (desc.get) {
    if (desc.set) {
      str = ctx.stylize('[Getter/Setter]', 'special');
    } else {
      str = ctx.stylize('[Getter]', 'special');
    }
  } else {
    if (desc.set) {
      str = ctx.stylize('[Setter]', 'special');
    }
  }
  if (!hasOwnProperty(visibleKeys, key)) {
    name = '[' + key + ']';
  }
  if (!str) {
    if (ctx.seen.indexOf(desc.value) < 0) {
      if (isNull(recurseTimes)) {
        str = formatValue(ctx, desc.value, null);
      } else {
        str = formatValue(ctx, desc.value, recurseTimes - 1);
      }
      if (str.indexOf('\n') > -1) {
        if (array) {
          str = str.split('\n').map(function(line) {
            return '  ' + line;
          }).join('\n').substr(2);
        } else {
          str = '\n' + str.split('\n').map(function(line) {
            return '   ' + line;
          }).join('\n');
        }
      }
    } else {
      str = ctx.stylize('[Circular]', 'special');
    }
  }
  if (isUndefined(name)) {
    if (array && key.match(/^\d+$/)) {
      return str;
    }
    name = JSON.stringify('' + key);
    if (name.match(/^"([a-zA-Z_][a-zA-Z_0-9]*)"$/)) {
      name = name.substr(1, name.length - 2);
      name = ctx.stylize(name, 'name');
    } else {
      name = name.replace(/'/g, "\\'")
                 .replace(/\\"/g, '"')
                 .replace(/(^"|"$)/g, "'");
      name = ctx.stylize(name, 'string');
    }
  }

  return name + ': ' + str;
}


function reduceToSingleString(output, base, braces) {
  var numLinesEst = 0;
  var length = output.reduce(function(prev, cur) {
    numLinesEst++;
    if (cur.indexOf('\n') >= 0) numLinesEst++;
    return prev + cur.replace(/\u001b\[\d\d?m/g, '').length + 1;
  }, 0);

  if (length > 60) {
    return braces[0] +
           (base === '' ? '' : base + '\n ') +
           ' ' +
           output.join(',\n  ') +
           ' ' +
           braces[1];
  }

  return braces[0] + base + ' ' + output.join(', ') + ' ' + braces[1];
}


// NOTE: These type checking functions intentionally don't use `instanceof`
// because it is fragile and can be easily faked with `Object.create()`.
function isArray(ar) {
  return Array.isArray(ar);
}
exports.isArray = isArray;

function isBoolean(arg) {
  return typeof arg === 'boolean';
}
exports.isBoolean = isBoolean;

function isNull(arg) {
  return arg === null;
}
exports.isNull = isNull;

function isNullOrUndefined(arg) {
  return arg == null;
}
exports.isNullOrUndefined = isNullOrUndefined;

function isNumber(arg) {
  return typeof arg === 'number';
}
exports.isNumber = isNumber;

function isString(arg) {
  return typeof arg === 'string';
}
exports.isString = isString;

function isSymbol(arg) {
  return typeof arg === 'symbol';
}
exports.isSymbol = isSymbol;

function isUndefined(arg) {
  return arg === void 0;
}
exports.isUndefined = isUndefined;

function isRegExp(re) {
  return isObject(re) && objectToString(re) === '[object RegExp]';
}
exports.isRegExp = isRegExp;

function isObject(arg) {
  return typeof arg === 'object' && arg !== null;
}
exports.isObject = isObject;

function isDate(d) {
  return isObject(d) && objectToString(d) === '[object Date]';
}
exports.isDate = isDate;

function isError(e) {
  return isObject(e) &&
      (objectToString(e) === '[object Error]' || e instanceof Error);
}
exports.isError = isError;

function isFunction(arg) {
  return typeof arg === 'function';
}
exports.isFunction = isFunction;

function isPrimitive(arg) {
  return arg === null ||
         typeof arg === 'boolean' ||
         typeof arg === 'number' ||
         typeof arg === 'string' ||
         typeof arg === 'symbol' ||  // ES6 symbol
         typeof arg === 'undefined';
}
exports.isPrimitive = isPrimitive;

exports.isBuffer = require('./support/isBuffer');

function objectToString(o) {
  return Object.prototype.toString.call(o);
}


function pad(n) {
  return n < 10 ? '0' + n.toString(10) : n.toString(10);
}


var months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep',
              'Oct', 'Nov', 'Dec'];

// 26 Feb 16:19:34
function timestamp() {
  var d = new Date();
  var time = [pad(d.getHours()),
              pad(d.getMinutes()),
              pad(d.getSeconds())].join(':');
  return [d.getDate(), months[d.getMonth()], time].join(' ');
}


// log is just a thin wrapper to console.log that prepends a timestamp
exports.log = function() {
  console.log('%s - %s', timestamp(), exports.format.apply(exports, arguments));
};


/**
 * Inherit the prototype methods from one constructor into another.
 *
 * The Function.prototype.inherits from lang.js rewritten as a standalone
 * function (not on Function.prototype). NOTE: If this file is to be loaded
 * during bootstrapping this function needs to be rewritten using some native
 * functions as prototype setup using normal JavaScript does not work as
 * expected during bootstrapping (see mirror.js in r114903).
 *
 * @param {function} ctor Constructor function which needs to inherit the
 *     prototype.
 * @param {function} superCtor Constructor function to inherit prototype from.
 */
exports.inherits = require('inherits');

exports._extend = function(origin, add) {
  // Don't do anything if add isn't an object
  if (!add || !isObject(add)) return origin;

  var keys = Object.keys(add);
  var i = keys.length;
  while (i--) {
    origin[keys[i]] = add[keys[i]];
  }
  return origin;
};

function hasOwnProperty(obj, prop) {
  return Object.prototype.hasOwnProperty.call(obj, prop);
}

}).call(this,require("uojqOp"),typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"./support/isBuffer":5,"inherits":2,"uojqOp":4}],7:[function(require,module,exports){
'use strict';

var util = require('util');

function ConnectionMap() {

}

util.inherits(ConnectionMap, Object);

ConnectionMap.prototype.toJSON = function() {
  var json = {};
  var key;
  for (key in this) {
    if (this.hasOwnProperty(key)) {
      for (var i = 0; i < this[key].length; i++) {
        if (!json[key]) {
          json[key] = [];
        }
        json[key][i] = this[key][i].toJSON();
      }
    }
  }
  return json;
};

module.exports = ConnectionMap;

},{"util":6}],8:[function(require,module,exports){
'use strict';

var Packet = require('./packet');

// TODO: created something more flexible to load this on demand
var nodeTypes = {
  xNode: require('./node'),
  polymer: require('./node/polymer')
};
var xLink = require('./link');
var util = require('util');
var uuid = require('uuid').v4;
var Run = require('./run');
var Connector = require('./connector');
var validate = require('./validate');
var DefaultContextProvider = require('../lib/context/defaultProvider');
var IoMapHandler = require('../lib/io/mapHandler');
var DefaultProcessManager = require('../lib/process/defaultManager');
var Loader = require('chix-loader');
var multiSort = require('../lib/multisort');
var EventEmitter = require('events').EventEmitter;
var debug = require('debug')('chix:actor');

var Status = {};
Status.STOPPED = 'stopped';
Status.RUNNING = 'running';

/**
 *
 * Actor
 *
 * The Actor is responsible of managing a flow
 * it links and it's nodes.
 *
 * A node contains the actual programming logic.
 *
 * @api public
 * @author Rob Halff <rob.halff@gmail.com>
 * @constructor
 */
function Actor() {

  EventEmitter.apply(this, arguments);

  this.ioHandler = undefined;
  this.processManager = undefined;
  this.nodes = {};
  this.links = {};
  this.iips = {};
  this.view = [];
  this.status = undefined;

  // default to own id, map can overwrite
  this.id = uuid();

  this.type = 'flow';

  /**
   *
   * Added by default.
   *
   * If others need to be used they should be set before addMap();
   *
   */
  this.setIoHandler(new IoMapHandler());
  this.setProcessManager(new DefaultProcessManager());
  this.setLoader(new Loader());

}

util.inherits(Actor, EventEmitter);

/**
 *
 * Create/instantiate  a node
 *
 * Node at this stage is nothing more then:
 *
 *  { ns: "fs", name: "readFile" }
 *
 * @param {Object} node - Node as defined within a map
 * @param {Object} def  - Node Definition
 *
 * @api public
 */
Actor.prototype.createNode = function(node, def) {

  var self = this;

  if (!def) {
    throw new Error(
      util.format(
        'Failed to get node definition for %s:%s', node.ns, node.name
      )
    );
  }

  if (!node.id) {
    throw Error('Node should have an id');
  }

  if (!def.ports) {
    def.ports = {};
  }

  // merges expose, persist etc, with port definitions.
  // This is not needed with proper inheritance
  for (var type in node.ports) {
    if (node.ports.hasOwnProperty(type) &&
      def.ports.hasOwnProperty(type)
    ) {
      for (var name in node.ports[type]) {
        if (node.ports[type].hasOwnProperty(name) &&
          def.ports[type].hasOwnProperty(name)
        ) {

          for (var property in node.ports[type][name]) {
            if (node.ports[type][name].hasOwnProperty(property)) {
              // add or overwrite it.
              def.ports[type][name][property] =
                node.ports[type][name][property];
            }
          }
        }
      }
    }
  }

  // allow instance to overwrite other node definition data also.
  // probably make much more overwritable, although many
  // should not be overwritten, so maybe just keep it this way.
  if (node.title) {
    def.title = node.title;
  }

  if (node.description) {
    def.description = node.description;
  }

  var identifier = node.title || [
    node.ns, '::', node.name, '-',
    Object.keys(this.nodes).length
  ].join('');

  if (def.type === 'flow') {

    var xFlow = require('./flow'); // solve circular reference.

    validate.flow(def);

    this.nodes[node.id] = new xFlow(
      node.id,
      def,
      identifier,
      this.loader, // single(ton) instance (TODO: di)
      this.ioHandler, // single(ton) instance
      this.processManager // single(ton) instance
    );
    debug('%s: created %s', this.identifier, this.nodes[node.id].identifier);

  }
  else {

    var cls = def.type || 'xNode';

    if (nodeTypes.hasOwnProperty(cls)) {

      validate.nodeDefinition(def);

      this.nodes[node.id] = new nodeTypes[cls](
        node.id,
        def,
        identifier,
        this.ioHandler.CHI
      );

      debug('%s: created %s', this.identifier, this.nodes[node.id].identifier);

      // register and set pid, xFlow/actor adds itself to it (hack)
      this.processManager.register(this.nodes[node.id]);

    }
    else {

      throw Error(
        util.format('Unknown node type: `%s`', cls)
      );

    }

  }

  // add parent to both xflow's and node's
  // not very pure seperation, but it's just very convenient
  this.nodes[node.id].setParent(this);

  if (node.provider) {
    this.nodes[node.id].provider = node.provider;
  }

  // TODO: move this to something more general.
  // not on every node creation.
  if (!this.contextProvider) {
    this.addContextProvider(new DefaultContextProvider());
  }

  this.contextProvider.addContext(
    this.nodes[node.id],
    node.context
  );

  function nodeOutputHandlerActor(event) {
    self.ioHandler.output(event);
  }

  this.nodes[node.id].on('output', nodeOutputHandlerActor);

  this.nodes[node.id].on('freePort', function freePortHandlerActor(event) {

    var links;
    var i;

    debug('%s:%s freePortHandler', self.identifier, event.port);

    // get all current port connections
    links = this.portGetConnections(event.port);

    if (links.length) {

      for (i = 0; i < links.length; i++) {

        var link = links[i];

        // unlock if it was locked
        if (self.ioHandler.queueManager.isLocked(link.ioid)) {
          self.ioHandler.queueManager.unlock(link.ioid);
        }

      }

      if (event.link) {

        // remove the link belonging to this event
        if (event.link.has('dispose')) {

          // TODO: remove cyclic all together, just use core/forEach
          //  this will cause bugs if you send multiple cyclics because
          //  the port is never unplugged..
          if (!event.link.target.has('cyclic')) {
            self.removeLink(event.link);
          }
        }

      }

    }

  });

  this.emit('addNode', {
    node: this.nodes[node.id]
  });

  return this.nodes[node.id];

};

/**
 *
 * Plugs a source into a target node
 *
 *
 * @param {Connector} target
 */
Actor.prototype.plugNode = function(target) {

  return this.getNode(target.id).plug(target);

};

/**
 *
 * Unplugs a port for the node specified.
 *
 * @param {Connector} target
 */
Actor.prototype.unplugNode = function(target) {

  // could be gone, if called from freePort
  // when nodes are being removed.
  if (this.hasNode(target.id)) {
    return this.getNode(target.id).unplug(target);
  }

  return false;

};

/**
 *
 * Holds a Node
 *
 * @param {String} id
 * @api public
 */
Actor.prototype.hold = function(id) {

  this.getNode(id).hold();

  return this;

};

/**
 *
 * Starts the actor
 *
 * @param {Boolean} push
 * @api public
 */
Actor.prototype.start = function(push) {

  this.status = Status.RUNNING;

  debug('%s: start', this.identifier);

  // TODO: this means IIPs should be send after start.
  //       enforce this..
  this.clearIIPs();

  // start all nodes
  // (could also be started during addMap
  // runtime is skipping addMap.
  // so make sure start() is restartable.
  for (var id in this.nodes) {
    if (this.nodes.hasOwnProperty(id)) {
      this.getNode(id).start();
    }
  }

  if (push !== false) {
    this.push();
  }

  // there are many other ways to start
  // so this does not ensure much.
  // however the process manager listens to this.
  // Real determination if something is started or stopped
  // includes the ioHandler.
  // So let's just inform the io handler we are started.

  this.emit('start', {
    node: this
  });

  return this;

};

/**
 *
 * Stops the actor
 *
 * Use a callback to make sure it is stopped.
 *
 * @api public
 */
Actor.prototype.stop = function(cb) {

  var self = this;

  this.status = Status.STOPPED;

  if (this.ioHandler) {

    this.ioHandler.reset(function resetCallbackIoHandler() {

      // close ports opened by iips
      self.clearIIPs();

      self.emit('stop', {
        node: self
      });

      if (cb) {
        cb();
      }

    });

  }

};

Actor.prototype.pause = function() {

  this.status = Status.STOPPED;

  for (var id in this.nodes) {
    if (this.nodes.hasOwnProperty(id)) {
      this.getNode(id).hold();
    }
  }

  return this;

};

/**
 *
 * Resumes the actor
 *
 * All nodes which are on hold will resume again.
 *
 * @api public
 */
Actor.prototype.resume = function() {

  this.status = Status.RUNNING;

  for (var id in this.nodes) {
    if (this.nodes.hasOwnProperty(id)) {
      this.getNode(id).release();
    }
  }

  return this;

};

/**
 *
 * Get the current status
 *
 * @api public
 */
Actor.prototype.getStatus = function() {
  return this.status;
};

/**
 *
 * Create an actor
 *
 * @api public
 */
Actor.create = function(map, loader, ioHandler, processManager) {

  var actor = new Actor();
  loader = loader || new Loader();
  processManager = processManager || new DefaultProcessManager();
  ioHandler = ioHandler || new IoMapHandler();
  actor.addLoader(loader);
  actor.addIoHandler(ioHandler);
  actor.addProcessManager(processManager);
  actor.addMap(map);

  return actor;
};

/**
 *
 * Releases a node if it was on hold
 *
 * @param {String} id
 * @api public
 */
Actor.prototype.release = function(id) {
  return this.getNode(id).release();
};

/**
 *
 * Pushes the Actor
 *
 * Will send :start to all nodes without input
 * and all nodes which have all their input ports
 * filled by context already.
 *
 * @api public
 */
Actor.prototype.push = function() {

  this.status = Status.RUNNING;
  debug('%s: push()', this.identifier);

  for (var id in this.nodes) {
    if (this.nodes.hasOwnProperty(id)) {
      var node = this.getNode(id);
      if (node.isStartable()) {
        var iip = new Connector();
        iip.plug(id, ':start');
        this.sendIIP(iip, '');
      }
      else {
        console.log(node.identifier, ' not startable');
      }
    }
  }

  return this;
};

/**
 *
 * Adds the definition Loader
 *
 * This provides an api to get the required node definitions.
 *
 * The loader should already be init'ed
 *
 * e.g. the remote loader will already have loaded the definitions.
 * and is ready to respond to getNodeDefinition(ns, name, type, provider)
 *
 * e.g. An async loader could do something like this:
 *
 *   loader(flow, function() { actor.addLoader(loader); }
 *
 * With a sync loader it will just look like:
 *
 * actor.addLoader(loader);
 *
 * @api public
 */
Actor.prototype.addLoader = function(loader) {
  this.loader = loader;
  return this;
};

Actor.prototype.setLoader = Actor.prototype.addLoader;

/**
 *
 * Validate and read map
 *
 * @param {Object} map
 * @api public
 *
 */
Actor.prototype.addMap = function(map) {

  debug('%s: addMap()', this.identifier);

  var i;
  var self = this;

  if (typeof map === 'undefined') {
    throw new Error('map is not defined');
  }

  if (map !== Object(map)) {
    throw new Error('addMap expects an object');
  }

  try {
    validate.flow(map);
  }
  catch (e) {
    if (map.title) {
      throw Error(
        util.format('Flow `%s`: %s', map.title, e.message)
      );
    }
    else {
      throw Error(
        util.format('Flow %s:%s: %s', map.ns, map.name, e.message)
      );
    }
  }

  if (map.id) {
    // xFlow contains it, direct actors don't perse
    this.id = map.id;
  }

  // add ourselves (actor/xFlow) to the processmanager
  // this way links can store our id and pid
  // must be done *before* adding our nodes.
  // otherwise our nodes will be registered before ourselves.
  if (!this.pid) { // re-run
    this.processManager.register(this);
  }

  // allow a map to carry it's own definitions
  if (map.nodeDefinitions) {
    this.loader.addNodeDefinitions('@', map.nodeDefinitions);
  }

  // add nodes and links one by one so there is more control
  map.nodes.forEach(function(node) {

    if (!node.id) {
      throw new Error(
        util.format('Node lacks an id: %s:%s', node.ns, node.name)
      );
    }

    // give the node a default provider.
    if (!node.provider) {
      if (map.providers && map.providers.hasOwnProperty('@')) {
        node.provider = map.providers['@'].url;
      }
    }

    var def = self.loader.getNodeDefinition(node, map);
    if (!def) {

      throw new Error(
        util.format(
          'Failed to get node definition for %s:%s', node.ns, node.name
        )
      );
    }

    self.createNode(node, def);

  });

  // this.ensureConnectionNumbering(map);

  if (map.hasOwnProperty('links')) {
    map.links.forEach(function(link) {
      self.addLink(
        self.createLink(link)
      );
    });
  }

  for (i = 0; i < map.nodes.length; i++) {
    this.view.push(map.nodes[i].id);
  }

  /*
    Disabled. Actor.start() does this and xFlow.start()
    will start all their nodes, and then goes recursive.

    // all nodes & links setup, run start method on node
    for (var id in this.nodes) {
      if (this.nodes.hasOwnProperty(id)) {
        this.getNode(id).start();
      }
    }
  */

  return this;

};

/**
 *
 * Used by the process manager to set our id
 *
 */
Actor.prototype.setPid = function(pid) {
  this.pid = pid;
};

/**
 *
 * Adds a node to the map.
 *
 * The object format is like it's defined within a map.
 *
 * Right now this is only used during map loading.
 *
 * For dynamic loading care should be taken to make
 * this node resolvable by the loader.
 *
 * Which means the definition should either be found
 * at the default location defined within the map.
 * Or the node itself should carry provider information.
 *
 * A provider can be defined as:
 *
 *  - url:        https://serve.rhcloud.com/flows/{ns}/{name}
 *  - file:       ./{ns}/{name}
 *  - namespace:  MyNs
 *
 * Namespaces are defined within the map, so MyNs will point to
 * either the full url or filesystem location.
 *
 * Once a map is loaded _all_ nodes will carry the full url individually.
 * The namespace is just their to simplify the json format and for ease
 * of maintainance.
 *
 *
 * @param {Object} node
 * @api public
 *
 */
Actor.prototype.addNode = function(node) {

  this.createNode(node);

  return this;
};

/**
 *
 * Creates a new connection/link
 *
 * Basically takes a plain link object
 * and creates a proper xLink from it.
 *
 * The internal map holds xLinks, whereas
 * the source map is just plain JSON.
 *
 * Structurewise they are almost the same.
 *
 * @param {Object} ln
 * @return {xLink} link
 * @api public
 *
 */
Actor.prototype.createLink = function(ln) {

  return xLink.create(ln);

};

/**
 *
 * Adds a link
 *
 * @param {xLink} link
 */
Actor.prototype.addLink = function(link) {

  debug('%s: addLink()', this.identifier);

  if (link.constructor.name !== 'Link') {
    throw Error('Link must be of type Link');
  }

  if (link.source.id !== this.id) { // Warn: IIP has our own id
    var sourceNode = this.getNode(link.source.id);
    if (!sourceNode.portExists('output', link.source.port)) {
      throw Error(util.format(
        'Source node (%s:%s) does not have an output port named `%s`\n\n' +
        '\tOutput ports available:\t%s\n',
        sourceNode.ns,
        sourceNode.name,
        link.source.port,
        Object.keys(sourceNode.ports.output).join(', ')
      ));
    }
  }

  var targetNode = this.getNode(link.target.id);
  if (link.target.port !== ':start' &&
    !targetNode.portExists('input', link.target.port)
  ) {
    throw Error(
      util.format(
        'Target node (%s:%s) does not have an input port named `%s`\n\n' +
        '\tInput ports available:\t%s\n',
        targetNode.ns,
        targetNode.name,
        link.target.port,
        Object.keys(targetNode.ports.input).join(', ')
      )
    );
  }

  // var targetNode = this.getNode(link.target.id);

  // FIXME: rewriting sync property
  // to contain the process id of the node it's pointing
  // to not just the nodeId defined within the graph
  if (link.target.has('sync')) {
    link.target.set('sync', this.getNode(link.target.get('sync')).pid);
  }

  link.graphId = this.id;
  link.graphPid = this.pid;

  var self = this;

  var dataHandler = function dataHandler(p) {
    if (!this.ioid) {
      throw Error('LINK MISSING IOID');
    }

    self.__input(this, p);
  };

  link.on('data', dataHandler);

  if (link.source.id) {
    if (link.source.id === this.id) {
      link.setSourcePid(this.pid || this.id);
    }
    else {
      link.setSourcePid(this.getNode(link.source.id).pid);
    }
  }

  link.setTargetPid(this.getNode(link.target.id).pid);

  // remember our own links, so we can remove them
  // if it has data it's an iip
  if (undefined !== link.data) {
    this.iips[link.id] = link;
  }
  else {
    this.links[link.id] = link;
  }

  this.ioHandler.connect(link);

  this.plugNode(link.target);

  link.on('change', function changeLink(link) {
    self.emit('changeLink', link);
  });

  // bit inconsistent with event.node
  // should be event.link
  this.emit('addLink', link);

  // this.ensureConnectionNumbering();
  return link;

};

Actor.prototype.getLink = function(id) {
  return this.links[id];
};

Actor.prototype.unlockConnections = function(node) {

  // fix this, flow connections setup is different
  var conns = node.getConnections();
  for (var port in conns) {
    if (conns.hasOwnProperty(port)) {
      for (var i = 0; i < conns[port].length; i++) {
        this.ioHandler.unlock(conns[port][i]);
      }
    }
  }

};

Actor.prototype.__input = function(link, p) {

  var self = this;

  this.ioHandler.lock(link);

  var targetNode = this.getNode(link.target.id);

  var ret = targetNode.fill(link.target, p);

  // breakpoint
  if (util.isError(ret)) {

    // `hard reject`
    // set node in error state and output error to ioManager
    targetNode.error(ret);

    debug('%s: reject %s', this.identifier, ret);
    self.ioHandler.reject(ret, link, p);

  }
  else if (ret === false) {

    // something should unlock.
    // having this reject unlock it is too much free form.

    debug('%s: soft reject re-queue', this.identifier);
    // `soft reject`
    self.ioHandler.reject(ret, link, p);

  }
  else {
    // would like to unlock all

    // unlock *all* queues targeting this node.
    // the IOHandler can do this.
    debug('%s: unlock all queues', this.identifier);
    self.unlockConnections(targetNode);

    self.ioHandler.accept(link, p);
  }

};

Actor.prototype.clearIIP = function(link) {

  var id;
  var oldLink;

  for (id in this.iips) {

    if (this.iips.hasOwnProperty(id)) {

      oldLink = this.iips[id];

      // source is always us so do not have to check it.
      if ((
          oldLink.source.port === ':iip' ||
          oldLink.target.port === link.target.port ||
          oldLink.target.port === ':start' // huge uglyness
        ) &&
        oldLink.target.id === link.target.id) {

        this.unplugNode(oldLink.target);

        this.ioHandler.disconnect(oldLink);

        delete this.iips[oldLink.id];

        // TODO: just rename this to clearIIP
        this.emit('removeIIP', oldLink);

      }

    }
  }

};

/**
 *
 * Clear IIPs
 *
 * If target is specified, only those iips will be cleared.
 *
 */
Actor.prototype.clearIIPs = function(target) {

  var id;
  var iip;
  for (id in this.iips) {
    if (this.iips.hasOwnProperty(id)) {
      iip = this.iips[id];
      if (!target ||
        (target.id === iip.target.id && target.port === iip.target.port)) {
        this.clearIIP(this.iips[id]);
      }
    }
  }
};

/**
 *
 * Renames a node
 *
 * Renames the id of a node.
 * This should not rename the real id.
 *
 * @param {string} nodeId
 * @param {function} cb
 * @api public
 */
Actor.prototype.renameNode = function(/*nodeId, cb*/) {

};

/**
 *
 * Removes a node
 *
 * @param {string} nodeId
 * @param {function} cb
 * @api public
 */
Actor.prototype.removeNode = function(nodeId, cb) {

  var id;
  var ln;
  var self = this;
  for (id in this.links) {
    if (this.links.hasOwnProperty(id)) {

      ln = this.links[id];

      if (ln.source.id === nodeId ||
        ln.target.id === nodeId) {
        this.removeLink(ln);
      }

    }

  }

  // should wait for IO, especially there is a chance
  // system events are still spitting.

  // register and set pid
  this.processManager.unregister(this.getNode(nodeId),
    function unregisterHandlerActor() {

      var oldNode = self.getNode(nodeId).export();

      delete self.nodes[nodeId];

      self.emit('removeNode', {
        node: oldNode
      });

      if (cb) {
        cb();
      }

    });

};

Actor.prototype.removeNodes = function() {

  this.clear();

};

Actor.prototype.setMeta = function(nodeId, key, value) {

  var node = this.getNode(nodeId);

  node.setMeta(key, value);

  this.emit('metadata', {
    id: this.id,
    node: node.export()
  });

};

/**
 *
 * Removes link
 *
 * @param {Link} ln
 * @api public
 *
 */
Actor.prototype.removeLink = function(ln) {

  // we should be able to find a link without id.
  var link;
  var what = 'links';

  link = this.links[ln.id];
  if (!link) {
    link = this.iips[ln.id];
    if (!link) {
      //throw Error('Cannot find link');
      // TODO: Seems to happen with ip directly to subgraph (non-fatal)
      console.warn('FIXME: cannot find link');
      return;
    }
    what = 'iips';
  }

  this.unplugNode(link.target);

  this.ioHandler.disconnect(link);

  // io handler could do this.
  // removelink on the top-level actor/graph
  // is not very useful

  var oldLink = this[what][link.id];

  delete this[what][link.id];

  this.emit('removeLink', oldLink);

  return this;

};

/**
 *
 * Adds a port
 *
 * NOT IMPLEMENTED
 *
 * @api public
 */
Actor.prototype.addPort = function() {

  return this;

};

/**
 *
 * Removes a port
 *
 * NOT IMPLEMENTED
 *
 * @api public
 */
Actor.prototype.removePort = function() {

  return this;

};

/**
 *
 * Resets this instance so it can be re-used
 *
 * Note: The registered loader is left untouched.
 *
 * @api public
 *
 */
Actor.prototype.reset = function() {

  var id;

  for (id in this.nodes) {
    if (this.nodes.hasOwnProperty(id)) {
      this.getNode(id).reset();
    }
  }

  // if nothing has started yet
  // there is no ioHandler
  if (this.ioHandler) {
    this.ioHandler.reset();
  }

  return this;

};

Actor.prototype.clear = function(cb) {

  if (!cb) {
    throw Error('clear expects a callback');
  }

  var self = this;
  var nodeId;
  var cnt = 0;
  var total = Object.keys(this.nodes).length;

  if (total === 0) {
    cb();
  }

  function removeNodeHandler() {
      cnt++;
      if (cnt === total) {
        self.nodes = {};
        cb();
      }
    }
    // remove node will automatically remove all links
  for (nodeId in this.nodes) {
    if (this.nodes.hasOwnProperty(nodeId)) {
      // will remove links also.
      this.removeNode(nodeId, removeNodeHandler);
    }
  }

};

/**
 *
 * Add IO Handler.
 *
 * The IO Handler handles all the input and output.
 *
 * @param {IOHandler} handler
 * @api public
 *
 */
Actor.prototype.addIoHandler = function(handler) {

  this.ioHandler = handler;

  return this;

};

Actor.prototype.setIoHandler = Actor.prototype.addIoHandler;

/**
 *
 * Add Process Manager.
 *
 * The Process Manager holds all processes.
 *
 * @param {Object} manager
 * @api public
 *
 */
Actor.prototype.addProcessManager = function(manager) {

  this.processManager = manager;

  return this;

};

Actor.prototype.setProcessManager = Actor.prototype.addProcessManager;

/**
 *
 * Add a new context provider.
 *
 * A context provider pre-processes the raw context
 *
 * This is useful for example when using the command line.
 * All nodes which do not have context set can be asked for context.
 *
 * E.g. database credentials could be prompted for after which all
 *      input is fullfilled and the flow will start to run.
 *
 * @param {ContextProvider} provider
 * @api private
 *
 */
Actor.prototype.addContextProvider = function(provider) {
  this.contextProvider = provider;

  return this;

};

Actor.prototype.setContextProvider = Actor.prototype.addContextProvider;

/**
 *
 * Explains what input and output ports are
 * available for interaction.
 *
 */
Actor.prototype.help = function() {

};

/**
 *
 * Send IIPs
 *
 * Optionally with `options` for the port:
 *
 * e.g. { persist: true }
 *
 * Optionally with `source` information
 *
 * e.g. { index: 1 } // index for array port
 *
 * @param {Object} iips
 * @api public
 */
Actor.prototype.sendIIPs = function(iips) {

  var self = this;

  var links = [];

  iips.forEach(function(iip) {

    var xLink = self.createLink({
      source: {
        id: self.id, // we are the sender
        port: ':iip'
      },
      target: iip.target
    });

    // dispose after fill
    xLink.set('dispose', true);

    if (iip.data === undefined) {
      throw Error('IIP data is `undefined`');
    }

    xLink.data = iip.data;

    links.push(xLink);

  });

  links.forEach(function(iip) {

    // TODO: this doesn't happen anymore it's always a link.
    // make sure settings are always set also.
    if (iip.target.constructor.name !== 'Connector') {
      var target = new Connector();
      target.plug(iip.target.id, iip.target.port);
      for (var key in iip.target.setting) {
        if (iip.target.setting.hasOwnProperty(key)) {
          target.set(key, iip.target.setting[key]);
        }
      }
      iip.target = target;
    }

    if (!self.id) {
      throw Error('Actor must contain an id');
    }

    self.addLink(iip);

  });

  links.forEach(function(link) {

    self.ioHandler.emit('send', link);

    var p = new Packet(JSON.parse(JSON.stringify(link.data)));

    // a bit too direct, ioHandler should do this..
    self.ioHandler.queueManager.queue(link.ioid, p);

    // remove data bit.
    delete link.data;
  });

  return links;

};

/*
 * Send a single IIP to a port.
 *
 * Note: If multiple IIPs have to be send use sendIIPs instead.
 *
 * Source is mainly for testing, but essentially it allows you
 * to imposter a sender as long as you send along the right
 * id and source port name.
 *
 * Source is also used to set an index[] for array ports.
 * However, if you send multiple iips for an array port
 * they should be send as a group using sendIIPs
 *
 * This is because they should be added in reverse order.
 * Otherwise the process will start too early.
 *
 * @param {Connector} target
 * @param {Object} data
 * @api public
 */
Actor.prototype.sendIIP = function(target, data) {

  if (!this.id) {
    throw Error('Actor must contain an id');
  }

  if (undefined === data) {
    throw Error('Refused to send IIP without data');
  }

  var ln = {
    source: {
      id: this.id, // we are the sender
      pid: this.pid,
      port: ':iip'
    },
    target: target
  };

  var xLink = this.createLink(ln);
  xLink.data = data;

  // dispose after fill
  xLink.set('dispose', true);

  // makes use of xLink.data
  this.addLink(xLink);

  this.ioHandler.emit('send', xLink);

  var p = new Packet(JSON.parse(JSON.stringify(xLink.data)));

  this.ioHandler.queueManager.queue(xLink.ioid, p);

  // remove data bit.
  delete xLink.data;

  return xLink;

};

/**
 *
 * Retrieve a node by it's process id
 *
 * @param {String} pid - Process ID
 * @return {Object} node
 * @api public
 */
Actor.prototype.getNodeByPid = function(pid) {

  var id;
  var node;

  for (id in this.nodes) {
    if (this.nodes.hasOwnProperty(id)) {
      node = this.getNode(id);
      if (node.pid === pid) {
        return node;
      }
    }
  }

  return;
};

/**
 *
 * Get all node ids this node depends on.
 *
 * @param {String} nodeId
 * @return {Array} nodes
 * @api public
 */
Actor.prototype.getAncestorIds = function(nodeId) {

  var self = this;

  var pids = this.ioHandler.getAncestorPids(
    this.getNode(nodeId).pid
  );

  var ids = [];
  pids.forEach(function(pid) {
    ids.push(self.getNodeByPid(pid).id);
  });
  return ids;

};

/**
 *
 * Get the entire node branch this node depends on
 *
 * @param {String} nodeId
 * @return {Array} nodes
 * @api public
 */
Actor.prototype.getAncestorNodes = function(nodeId) {
  var i;
  var nodes = [];
  var ids = this.getAncestorIds(nodeId);

  for (i = 0; i < ids.length; i++) {
    nodes.push(this.getNode(ids[i]));
  }

  return nodes;
};

/**
 *
 * Get all node ids that target this node.
 *
 * @param {String} nodeId
 * @return {Array} ids
 * @api public
 */
Actor.prototype.getSourceIds = function(nodeId) {

  var self = this;
  var ids = [];

  var pids = this.ioHandler.getSourcePids(
    this.getNode(nodeId).pid
  );

  pids.forEach(function(pid) {
    var node = self.getNodeByPid(pid);
    if (node) { // iips will not be found
      ids.push(node.id);
    }
  });
  return ids;

};

/**
 *
 * Get all nodes that target this node.
 *
 * @param {String} nodeId
 * @return {Array} nodes
 * @api public
 */
Actor.prototype.getSourceNodes = function(nodeId) {

  var i;
  var nodes = [];
  var ids = this.getSourceIds(nodeId);

  for (i = 0; i < ids.length; i++) {
    nodes.push(this.getNode(ids[i]));
  }

  return nodes;

};

/**
 *
 * Get all nodes that use this node as a source .
 *
 * @param {String} nodeId
 * @return {Array} ids
 * @api public
 */
Actor.prototype.getTargetIds = function(nodeId) {

  var self = this;

  var pids = this.ioHandler.getTargetPids(
    this.getNode(nodeId).pid
  );

  var ids = [];
  pids.forEach(function(pid) {
    ids.push(self.getNodeByPid(pid).id);
  });
  return ids;

};

/**
 *
 * Use is a generic way of creating a new instance of self
 * And only act upon a subset of our map.
 *
 *
 */
Actor.prototype.use = function( /*name, context*/ ) {

  throw Error('TODO: reimplement actions');
  /*
    var i;
    var action;
    var map = {};
    var sub = new this.constructor();

    // Use this handlers events also on the action.
    sub._events = this._events;

    // Find our action
    if (!this.map.actions) {
      throw new Error('This flow has no actions');
    }

    if (!this.map.actions.hasOwnProperty(name)) {
      throw new Error('Action not found');
    }

    action = this.map.actions[name];

    // Create a reduced map
    map.env = this.map.env;
    map.title =  action.title;
    map.description = action.description;
    map.ports = this.map.ports;
    map.nodes = [];
    map.links = [];

    for (i = 0; i < this.map.nodes.length; i++) {
      if (action.nodes.indexOf(this.map.nodes[i].id) >= 0) {
        map.nodes.push(this.map.nodes[i]);
      }
    }

    for (i = 0; i < this.map.links.length; i++) {
      if (
        action.nodes.indexOf(this.map.links[i].source.id) >= 0 &&
        action.nodes.indexOf(this.map.links[i].target.id) >= 0) {
        map.links.push(this.map.links[i]);
      }
    }

    // re-use the loader
    sub.addLoader(this.loader);

    // add the nodes to our newly instantiated Actor
    sub.addMap(map);

    // hack to autostart it during run()
    // this only makes sense with actions.
    // TODO: doesn work anymore
    // sub.trigger = action.nodes[0];

    return sub;
  */

};

/**
 *
 * Run the current flow
 *
 * The flow starts by providing the ports with their context.
 *
 * Nodes which have all their ports filled by context will run immediatly.
 *
 * Others will wait until their unfilled ports are filled by connections.
 *
 * Internally the node will be set to a `contextGiven` state.
 * It's a method to tell the node we expect it to have enough
 * information to start running.
 *
 * If a port is not required and context was given and there are
 * no connections on it, it will not block the node from running.
 *
 * If a map has actions defined, run expects an action name to run.
 *
 * Combinations:
 *
 *   - run()
 *     run flow without callback
 *
 *   - run(callback)
 *     run with callback
 *
 *   - action('actionName').run()
 *     run action without callback
 *
 *   - action('actionName').run(callback)
 *     run action with callback
 *
 * The callback will receive the output of the (last) node(s)
 * Determined by which output ports are exposed.
 *
 * If we pass the exposed output, it can contain output from anywhere.
 *
 * If a callback is defined but there are no exposed output ports.
 * The callback will never fire.
 *
 * @api public
 */
Actor.prototype.run = function(callback) {

  return new Run(this, callback);

};
/**
 *
 * Need to do it like this, we want the new sub actor
 * to be returned to place events on etc.
 *
 * Otherwise it's hidden within the actor itself
 *
 * Usage: Actor.action('action').run(callback);
 *
 */
Actor.prototype.action = function(action, context) {

  var sub = this.use(action, context);
  return sub;

};

/**
 *
 * Get all nodes.
 *
 * TODO: unnecessary method
 *
 * @return {Object} nodes
 * @api public
 *
 */
Actor.prototype.getNodes = function() {

  return this.nodes;

};

/**
 *
 * Check if this node exists
 *
 * @param {String} id
 * @return {Object} node
 * @api public
 */
Actor.prototype.hasNode = function(id) {

  return this.nodes.hasOwnProperty(id);

};

/**
 *
 * Get a node by it's id.
 *
 * @param {String} id
 * @return {Object} node
 * @api public
 */
Actor.prototype.getNode = function(id) {

  if (this.nodes.hasOwnProperty(id)) {
    return this.nodes[id];
  }
  else {
    throw new Error(util.format('Node %s does not exist', id));
  }

};

/**
 *
 * JSON Status report about the nodes.
 *
 * Mainly meant to debug after shutdown.
 *
 * Should handle all stuff one can think of
 * why `it` doesn't work.
 *
 */
Actor.prototype.report = function() {

  var link;
  var node;
  var id;
  var size;
  var qm = this.ioHandler.queueManager;

  var report = {
    ok: true,
    flow: this.id,
    nodes: [],
    queues: []
  };

  for (id in this.nodes) {
    if (this.nodes.hasOwnProperty(id)) {
      node = this.nodes[id];
      if (node.status !== 'complete') {
        report.ok = false;
        report.nodes.push({
          node: node.report()
        });
      }
    }
  }

  for (id in this.links) {
    if (this.links.hasOwnProperty(id)) {
      link = this.links[id];
      if (qm.hasQueue(link.ioid)) {
        size = qm.size(link.ioid);
        report.ok = false;
        report.queues.push({
          link: link.toJSON(),
          port: link.target.port,
          // super weird, will be undefined if called here.
          // size: qm.size(link.ioid),
          size: size,
          node: this.getNode(link.target.id).report()
        });
      }
    }
  }

  return report;

};

/**
 *
 * If there are multiple connections to one port
 * the connections are numbered.
 *
 * If there is a index specified by using the
 * [] property, it will be considered.
 *
 * If it's not specified although there are
 * multiple connections to one port, it will be added.
 *
 * The sort takes care of adding connections where
 * [] is undefined to be placed last.
 *
 * The second loop makes sure they are correctly numbered.
 *
 * If connections are defined like:
 *
 *   undefined, [4],undefined, [3],[2]
 *
 * The corrected result will be:
 *
 * [2]        -> [0]
 * [3]        -> [1]
 * [4]        -> [2]
 * undefined  -> [3]
 * undefined  -> [4]
 *
 * Ports which only have one connection will be left unmodified.
 *
 */
Actor.prototype.ensureConnectionNumbering = function(map) {

  var c = 0;
  var i;
  var link;
  var last = {};
  var node;

  // first sort so order of appearance of
  // target.in is correct
  //
  // FIX: seems like multisort is messing up the array.
  // target suddenly has unknown input ports...
  if (map.links.length) {
    multiSort(map.links, ['target', 'in', 'index']);
  }

  for (i = 0; i < map.links.length; i++) {

    link = map.links[i];

    // Weird, the full node is not build yet here?
    // so have to look at the nodeDefinitions ns and name _is_
    // known at this point.
    node = this.nodes[link.target.id];

    if (this.nodeDefinitions[node.ns][node.name]
      .ports.input[link.target.port].type === 'array') {

      if (last.target.id === link.target.id &&
        last.target.port === link.target.port) {
        last.index = c++;
        link.index = c;
      }
      else {
        c = 0; // reset
      }
      last = link;

    }
  }

};

Actor.prototype.hasParent = function() {
  return false;
};

module.exports = Actor;

},{"../lib/context/defaultProvider":10,"../lib/io/mapHandler":13,"../lib/multisort":15,"../lib/process/defaultManager":22,"./connector":9,"./flow":11,"./link":14,"./node":16,"./node/polymer":18,"./packet":19,"./run":24,"./validate":28,"chix-loader":36,"debug":37,"events":1,"util":6,"uuid":49}],9:[function(require,module,exports){
'use strict';

var util    = require('util');
var Setting = require('./setting');

/**
 *
 * Connector
 *
 * The thing you plug into a port.
 *
 * Contains information about port and an optional
 * action to perform within the node (subgraph)
 *
 * Can also contains port specific settings.
 *
 * An xLink has a source and a target connector.
 *
 * ................... xLink ....................
 *
 *  -------------------.    .------------------
 * | Source Connector -------  Target Connector |
 *  ------------------'     `------------------
 *
 * When a link is plugged into a node, we do so
 * by plugging the target connector.
 *
 * @constructor
 * @public
 *
 */
function Connector(settings) {
  Setting.apply(this, [settings]);
  this.wire = undefined;
}

util.inherits(Connector, Setting);

/**
 *
 * Plug
 *
 * TODO: plug is not the correct name
 *
 * @param {String} id - TODO: not sure which id, from the node I pressume..
 * @param {String} port
 * @param {String} action
 */
Connector.prototype.plug = function(id, port, action) {
  this.id     = id;
  this.port   = port;
  if (action) {
    this.action = action;
  }
};

/**
 *
 * Create
 *
 * Creates a connector
 *
 * @param {String} id - TODO: not sure which id, from the node I pressume..
 * @param {String} port
 * @param {Object} settings
 * @param {String} action
 */
Connector.create = function(id, port, settings, action) {

  var c = new Connector(settings);
  c.plug(id, port, action);
  return c;

};

/**
 *
 * Register process id this connector handles.
 *
 */
Connector.prototype.setPid = function(pid) {
  this.pid = pid;
};

Connector.prototype.toJSON = function() {

  var ret = {
    id: this.id,
    port: this.port
  };

  if (this.setting) {
    ret.setting = JSON.parse(JSON.stringify(this.setting));
  }

  if (this.action) {
    ret.action = this.action;
  }

  return ret;

};

module.exports = Connector;

},{"./setting":27,"util":6}],10:[function(require,module,exports){
'use strict';

/**
 *
 * Default Context Provider
 *
 * @constructor
 * @public
 */
function DefaultProvider() {

}

DefaultProvider.prototype.addContext = function(node, defaultContext) {

  if (typeof defaultContext !== 'undefined') {
    node.addContext(defaultContext);
  }

};

module.exports = DefaultProvider;

},{}],11:[function(require,module,exports){
'use strict';

var Packet = require('./packet');
var util = require('util');
var xLink = require('./link');
var validate = require('./validate');
var Actor = require('./actor');
var Connections = require('./ConnectionMap');
var debug = require('debug')('chix:flow');

/**
 *
 * This FlowNode extends the Actor.
 *
 * What it mainly does is delegate what it it asked to do
 * To the nodes from the actor.
 *
 * External Interface is not really needed anymore.
 *
 * Because the flow has ports just like a normal node
 *
 * @constructor
 * @public
 *
 */
function Flow(id, map, identifier, loader, ioHandler, processManager) {

  var self = this;

  if (!id) {
    throw Error('xFlow requires an id');
  }

  if (!map) {
    throw Error('xFlow requires a map');
  }

  // Call the super's constructor
  Actor.apply(this, arguments);

  if (loader) {
    this.loader = loader;
  }
  if (ioHandler) {
    this.ioHandler = ioHandler;
  }

  if (processManager) {
    this.processManager = processManager;
  }

  // External vs Internal links
  this.linkMap = {};

  // indicates whether this is an action instance.
  this.actionName = undefined;

  // TODO: trying to solve provider issue
  this.provider = map.provider;

  this.providers = map.providers;

  this.actions = {};

  // initialize both input and output ports might
  // one of them be empty.
  if (!map.ports) {
    map.ports = {};
  }
  if (!map.ports.output) {
    map.ports.output = {};
  }
  if (!map.ports.input) {
    map.ports.input = {};
  }

  /*
    // make available always.
    node.ports.output['error'] = {
      title: 'Error',
      type: 'object'
    };
  */

  this.id = id;

  this.name = map.name;

  this.type = 'flow';

  this.title = map.title;

  this.description = map.description;

  this.ns = map.ns;

  this.active = false;

  this.metadata = map.metadata || {};

  this.identifier = identifier || [
    map.ns,
    ':',
    map.name
  ].join('');

  this.ports = JSON.parse(
    JSON.stringify(map.ports)
  );

  // Need to think about how to implement this for flows
  // this.ports.output[':complete'] = { type: 'any' };

  this.runCount = 0;

  this.inPorts = Object.keys(
    this.ports.input
  );

  this.outPorts = Object.keys(
    this.ports.output
  );

  //this.filled = 0;

  this.chi = undefined;

  this._interval = 100;

  // this.context = {};

  this.nodeTimeout = map.nodeTimeout || 3000;

  this.inputTimeout = typeof map.inputTimeout === 'undefined' ?
    3000 :
    map.inputTimeout;

  this._hold = false; // whether this node is on hold.

  this._inputTimeout = null;

  this._openPorts = [];

  this._connections = new Connections();

  this._forks = [];

  debug('%s: addMap', this.identifier);
  this.addMap(map);

  this.fork = function() {

    var Fork = function Fork() {
      this.nodes = {};
      //this.context = {};

      // same ioHandler, tricky..
      // this.ioHandler = undefined;
    };

    // Pre-filled baseActor is our prototype
    Fork.prototype = this.baseActor;

    var FActor = new Fork();

    // Remember all forks for maintainance
    self._forks.push(FActor);

    // Each fork should have their own event handlers.
    self.listenForOutput(FActor);

    return FActor;

  };

  this.listenForOutput();

  this.initPortOptions = function() {

    // Init port options.
    for (var port in self.ports.input) {
      if (self.ports.input.hasOwnProperty(port)) {

        // This flow's port
        var thisPort = self.ports.input[port];

        // set port option
        if (thisPort.options) {
          for (var opt in thisPort.options) {
            if (thisPort.options.hasOwnProperty(opt)) {
              self.setPortOption(
                'input',
                port,
                opt,
                thisPort.options[opt]);
            }
          }
        }

      }
    }
  };

  // Too late?
  this.setup();

  this.setStatus('created');

}

util.inherits(Flow, Actor);

Flow.prototype.action = function(action) {

  if (!this.actions.hasOwnProperty(action)) {

    throw Error('this.action should return something with the action map');
    /*
        var ActionActor = this.action(action);

        // ActionActor.map.ports = this.ports;

        // not sure what to do with the id and identifier.
        // I think they should stay the same, for now.
        //
        this.actions[action] = new Flow(
          this.id,
          // ActionActor, // BROKEN
          map, // action definition should be here
          this.identifier + '::' + action
        );

        // a bit loose this.
        this.actions[action].actionName = action;

        //this.actions[action].ports = this.ports;
    */

  }

  return this.actions[action];

};

Flow.prototype.setup = function() {

  this.initPortOptions();

};

/**
 *
 * For forking it is relevant when this addContext is done.
 * Probably this addContext should be done on baseActor.
 * So subsequent forks will have the updated context.
 * Yeah, baseActor is the fingerprint, currentActor is the
 * current one, this._actors is the array of instantiated forks.
 *
 */
Flow.prototype.addContext = function(context) {

  debug('%s: addContext', this.identifier);
  var port;
  for (port in context) {

    if (context.hasOwnProperty(port)) {

      var portDef = this.getPortDefinition(port, 'input');

      if (context.hasOwnProperty(port)) {
        this.getNode(portDef.nodeId)
          .setContextProperty(portDef.name, context[port]);

        // Maybe too easy, but see if it works.
        // Reset when all are filled, then fork.
        //this.filled++;

      }

    }
  }
};

Flow.prototype.setContextProperty = function(port, data) {

  var portDef = this.getPortDefinition(port, 'input');
  this.getNode(portDef.nodeId).setContextProperty(portDef.name, data);

};

Flow.prototype.clearContextProperty = function(port) {

  var portDef = this.getPortDefinition(port, 'input');
  this.getNode(portDef.nodeId).clearContextProperty(portDef.name);

};

Flow.prototype._delay = 0;

Flow.prototype.inputPortAvailable = function(target) {

  if (target.action && !this.isAction()) {

    return this.action(target.action).inputPortAvailable(target);

  }
  else {

    // little bit too much :start hacking..
    // probably causes the :start problem with clock
    if (target.port === ':start') {

      return true;

    }
    else {

      var portDef = this.getPortDefinition(target.port, 'input');

      if (!this.linkMap.hasOwnProperty(target.wire.id)) {
        throw Error('Cannot find internal link within linkMap');
      }

      return this.getNode(portDef.nodeId)
        .inputPortAvailable(this.linkMap[target.wire.id].target);

    }

  }
};

// TODO: both flow & node can inherit this stuff

Flow.prototype.getStatus = function() {

  return this.status;

};

Flow.prototype.setStatus = function(status) {

  this.status = status;
  this.event(':statusUpdate', {
    node: this.export(),
    status: this.status
  });

};

Flow.prototype.error = function(node, err) {

  var error = util.isError(err) ? err : Error(err);

  // TODO: better to have full (custom) error objects
  var eobj = {
    node: node.export(),
    msg: err
  };

  // Update our own status, this should status be resolved
  // Create a shell? yep..
  node.setStatus('error');

  // Used for in graph sending
  node.event(':error', eobj);

  // Used by Process Manager or whoever handles the node
  node.emit('error', eobj);

  return error;
};

Flow.prototype.fill = function(target, p) {

  debug('%s:%s fill', this.identifier, target.port);

  if (target.action && !this.isAction()) {

    // NOTE: action does not take fork into account?
    // test this later. it should be in the context of the currentActor.
    return this.action(target.action).fill(target, p);

  }
  else {

    if (target.port === ':start') {

      // :start is pushing the actor, so exposing a :start
      // port does not make much sense.
      this.event(':start', {
        node: this.export()
      });

      this.setStatus('started');
      debug('%s::start this.push()', this.identifier);
      this.push();
      return true;

    }
    else {

      // delegate this to the node this port belongs to.
      var portDef = this.getPortDefinition(target.port, 'input');

      var node = this.getNode(portDef.nodeId);

      if (!this.linkMap.hasOwnProperty(target.wire.id)) {
        throw Error('link not found within linkMap');
      }

      var err = node.fill(this.linkMap[target.wire.id].target, p);

      if (util.isError(err)) {

        Flow.error(this, err);

        return err;

      }
      else {

        this.event(':start', {
          node: this.export()
        });

        //this.filled++;
/*
        // fishy, also, is filled used at all for flow?
        // filled is irrelevant for flow.
        if (this.filled === this._connections.size) {

          // do not fork for now
          // this.currentActor = this.fork();
          // this.currentActor.run();

          this.filled = 0;

        }
*/

        return true;

      }

    }

  }

};

Flow.prototype.setMetadata = function(metadata) {
  this.metadata = metadata;
};

Flow.prototype.setMeta = function(key, value) {
  this.metadata[key] = value;
};

/**
 *
 * Checks whether the port exists at the node
 * this Flow is relaying for.
 *
 * @param {String} type
 * @param {String} port
 */
Flow.prototype.portExists = function(type, port) {

  // this returns whether this port exists for _us_
  // it only considers the exposed ports.
  var portDef = this.getPortDefinition(port, type);
  return this.getNode(portDef.nodeId).portExists(type, portDef.name);

};

/**
 *
 * Checks whether the port is open at the node
 * this Flow is relaying for.
 *
 * @param {String} port
 */
Flow.prototype.portIsOpen = function(port) {

  // the port open logic is about _our_ open and exposed ports.
  // yet ofcourse it should check the real node.
  // so also delegate.
  var portDef = this.getPortDefinition(port, 'input');
  // Todo there is no real true false in portIsOpen?
  // it will fail hard.
  return this.getNode(portDef.nodeId).portIsOpen(portDef.name);

};

/**
 *
 * Get _this_ Flow's port definition.
 *
 * The definition contains the _real_ portname
 * of the node _this_ port is relaying for.
 *
 * @param {String} port
 */

// JIKES, if we only need the ports we are all good..
Flow.prototype.getPortDefinition = function(port, type) {
  // uhm ok, we also need to add the start port
  if (this.ports[type].hasOwnProperty(port)) {
    return this.ports[type][port];
  }
  else {
    throw new Error(
      util.format(
        'Unable to find exported port definition for %s port `%s` (%s:%s)\n' +
        '\tAvailable ports: %s',
        type,
        port,
        this.ns,
        this.name,
        Object.keys(this.ports[type]).toString()
      )
    );
  }
};

Flow.prototype.getPort = function(type, name) {
  return this.getPortDefinition(name, type);
};

/**
 *
 * Get the port option at the node
 * this flow is relaying for.
 *
 * @param {String} type
 * @param {String} port
 * @param {String} option
 */
Flow.prototype.getPortOption = function(type, port, option) {

  // Exposed ports can also have options set.
  // if this is _our_ port (it is exposed)
  // just delegate this to the real node.
  var portDef = this.getPortDefinition(port, type);
  // Todo there is no real true false in portIsOpen?
  // it will fail hard.
  return this.getNode(portDef.nodeId).getPortOption(type, portDef.name, option);
};

/**
 *
 * Sets an input port option.
 *
 * The node schema for instance can specifiy whether a port is persistent.
 *
 * At the moment a connection can override these values.
 * It's a way of saying I give you this once so take care of it.
 *
 * Ok, with forks running this should eventually be much smarter.
 * If there are long running flows, all instances should have their
 * ports updated.
 *
 * Not sure when setPortOption is called, if it is called during 'runtime'
 * there is no problem and we could just set it on the current Actor.
 * I could also just already fix it and update baseActor and all _actors.
 * which would be sufficient.
 *
 * Anyway, this._actors is nice, however what to do with other forking methods.
 * Nevermind first do this.
 *
 */
Flow.prototype.setPortOption = function(type, port, opt, value) {
  var portDef = this.getPortDefinition(port, type);
  this.getNode(portDef.nodeId).setPortOption(type, portDef.name, opt, value);
};

Flow.prototype.openPort = function(port) {
  if (this._openPorts.indexOf(port) === -1) {
    this._openPorts.push(port);
  }
};

Flow.prototype.isAction = function() {

  return !!this.actionName;

};

// TODO: implement
//Flow.prototype.unplug = function(target) {
Flow.prototype.unplug = function(target) {

  if (target.action && !this.isAction()) {

    this.action(target.action).unplug(target);

  }
  else {

    // unplug logic

  }

};

/**
 *
 * Set port to open state
 *
 * This is a problem, xFlow has it's ports opened.
 * However this also means baseActor and all the forks
 * Should have their ports opened.
 *
 * Ok, not a problem, only that addition of the :start port
 * is a problem. Again not sure at what point plug()
 * is called. I think during setup, but later on also
 * in realtime. anyway for now I do not care so much about
 * realtime. Doesn't make sense most of the time.
 *
 * @param {Connector} target
 * @public
 */
Flow.prototype.plug = function(target) {

  if (target.action && !this.isAction()) {

    this.action(target.action).plug(target);

  }
  else {

    if (target.port === ':start') {
      this.addPort('input', ':start', {
        type: 'any'
      });
    }

    // delegate this to the real node
    // only if this is one of _our_ exposed nodes.
    //var portDef = this.getPortDefinition(target.port, 'input');
    var portDef = this.getPortDefinition(target.port, 'input');

    // start is not an internal port, we will do a push on the internal
    // actor and he may figure it out..
    //if (target.port !== ':start') {
    if (target.port !== ':start') {

      // The Node we are gating for
      var internalNode = this.getNode(portDef.nodeId);

      var xlink = new xLink();
      // just define our node as the source, and the external port
      xlink.setSource(this.id, target.port, {}, target.action);
      xlink.setTarget(target.id, portDef.name, {}, target.action);

      for (var k in target.setting) {
        if (target.setting.hasOwnProperty(k)) {
          xlink.target.set(k, target.setting[k]);
        }
      }

      // fixed settings
      if (portDef.hasOwnProperty('setting')) {
        for (k in portDef.setting) {
          if (portDef.setting.hasOwnProperty(k)) {
            xlink.target.set(k, portDef.setting[k]);
          }
        }
      }

      internalNode.plug(xlink.target);

      // Copy the port type, delayed type setting, :start is only known after
      // the port is opened...
      this.ports.input[target.port].type =
        internalNode.ports.input[xlink.target.port].type;

      // we add our internalLink as reference to our link.
      // a bit of a hack, it's not known by the definition of
      // Link itself
      target.wire.internalLink = xlink;

      // outer/inner mapping
      this.linkMap[target.wire.id] = xlink;

    }
    else {
      // what to do with start port?
    }

    // use same logic for our own ports
    if (!this._connections.hasOwnProperty(target.port)) {
      this._connections[target.port] = [];
    }

    this._connections[target.port].push(target.wire);

    this.openPort(target.port);

  }

};

Flow.prototype.exposePort = function(type, nodeId, port, name) {

  var p;
  var node = this.getNode(nodeId);

  if (node.ports[type]) {
    for (p in node.ports[type]) {

      if (node.ports[type].hasOwnProperty(p)) {

        if (p === port) {

          // not sure, is this all info?
          this.addPort(type, name, {
            nodeId: nodeId,
            name: port
          });

          continue;
        }
      }
    }
  }

  this.emit('addPort', {
    node: this.export(),
    port: name
  });

};

Flow.prototype.removePort = function(type, name) {

  if (this.ports[type][name]) {

    delete this.ports[type][name];

    this.emit('removePort', {
      node: this.export(),
      port: name
    });

  }

};

Flow.prototype.renamePort = function(type, from, to) {

  var id;

  if (this.ports[type][from]) {

    this.ports[type][to] = JSON.parse(
      JSON.stringify(this.ports[type][from])
    );

    // update links pointing to us.
    // updates ioHandler also because it holds
    // references to these links
    // TODO: pid/id warning...
    // renaming will only update this instance.
    // accidently these links will make each instance
    // point to the new ports, however not each instance
    // has it's port renamed..
    // For rename it's better to stop the graph
    // update the definition itself then start it again
    // Because for instance the io handler will still send
    // to old ports.
    for (id in this.links) {
      if (type === 'input' &&
        this.links[id].target.id === this.id &&
        this.links[id].target.port === from) {

        this.links[id].target.port = to;

      }
      else if (type === 'output' &&
        this.links[id].source.id === this.id &&
        this.links[id].source.port === from) {

        this.links[id].source.port = to;
      }
    }

    delete this.ports[type][from];

    this.emit('renamePort', {
      node: this.export(),
      from: from,
      to: to
    });

  }

};

Flow.prototype.addPort = function(type, name, def) {

  // add it to known ports
  if (!this.ports[type]) {
    this.ports[type] = {};
  }

  this.ports[type][name] = def;

  if (type === 'input') {
    this.inPorts = Object.keys(this.ports[type]);
  }
  else {
    this.outPorts = Object.keys(this.ports[type]);
  }
};

/**
 *
 * Close the port of the node we are relaying for
 * and also close our own port.
 *
 * @param {String} port
 */
Flow.prototype.closePort = function(port) {
  // delegate this to the real node
  // only if this is one of _our_ exposed nodes.
  var portDef = this.getPortDefinition(port, 'input');

  if (port !== ':start') {

    this.getNode(portDef.nodeId).closePort(portDef.name);
    // this._forks.forEach(function(fork) {
    //  fork.getNode(portDef.nodeId).closePort(portDef.name);
    //});
  }

  if (this.ports.input[port]) {
    this._openPorts.splice(
      this._openPorts.indexOf(port), 1
    );
  }

  this._connections[port].pop();

};

Flow.prototype.hasConnections = function() {
  return this._openPorts.length;
};

/**
 *
 * Puts this flow on hold.
 *
 * NOT IMPLEMENTED YET
 *
 * This should stop each and every fork.
 *
 */
Flow.prototype.hold = function() {

  // implement later, holds input for _this_ flow
  this._hold = true;
  this.stop();
  /*
  this._forks.forEach(function(fork) {
    fork.stop();
  });
  */
};

/**
 *
 * Releases the node if it was on hold
 *
 * This should resume each and every fork.
 *
 * @public
 */
Flow.prototype.release = function() {

  // TODO: these are all just on the actor, not sure Flow also needs it.

  this._hold = false;
  this.resume();
  /*
  this._forks.forEach(function(fork) {
    fork.resume();
  });
  */
};

/**
 *
 * Complete function
 *
 * @public
 */
Flow.prototype.complete = function() {

  // todo: check this.ready stuff logic.
  this.ready = false;
  this.active = false;

};

Flow.prototype.portHasConnection = function(port, link) {
  if (this._connections.hasOwnProperty(port)) {
    return this._connections[port].indexOf(link) >= 0;
  }
  else {
    return false;
  }
};

Flow.prototype.portHasConnections = function(port) {
  if (this._connections.hasOwnProperty(port)) {
    return this._connections[port].length >= 0;
  }
  else {
    return false;
  }
};

Flow.prototype.portGetConnections = function(port) {
  return this._connections[port];
};

/**
 *
 * Listen for output on 'our' ports
 *
 * The internal Actor will actually listen just like the normal actor.
 *
 * @public
 */
Flow.prototype.listenForOutput = function() {

  var port;
  var internalPort;
  var self = this;

  // not really used yet, but this would envolve just
  // commanding all nodes to shutdown,
  // which will be a simple loop.
  // baseActor loop doesn't make much sense but ah well.
  //
  function outputHandler(port, internalPort) {
    return function internalPortHandlerFlow(data) {
      if (internalPort === data.port) {

        debug('%s:%s output', self.identifier, port);
        self.sendPortOutput(port, data.out);

        // there is no real way to say a graph has executed.
        // So just consider each output as an execution.
        // TODO: a bit expensive
        self.event(':executed', {
          node: self.export()
        });

      }
    };
  }

  function freePortHandler(externalPort, internalPort) {

    return function freePortHandlerFlow(event) {

      if (internalPort === event.port) {

        if (self._connections.hasOwnProperty(externalPort)) {

          var extLink;
          var conns = self._connections[externalPort];
          for (var i = 0; i < conns.length; i++) {
            if (conns[i].internalLink === event.link) {
              extLink = conns[i];
              break; // yeay..
            }
          }

          if (!extLink) {
            throw Error('Cannot determine outer link');
          }
          else {
            debug('%s:%s :freePort', self.identifier, externalPort);
            self.event(':freePort', {
              node: self.export(),
              link: extLink,
              port: externalPort
            });

            self.emit('freePort', {
              node: self.export(),
              link: extLink,
              port: externalPort
            });
          }

        }
        else {
          // no connections.
        }

      }
    };
  }

  var internalNode;
  if (this.ports.output) {
    for (port in this.ports.output) {
      if (this.ports.output.hasOwnProperty(port)) {
        internalPort = this.ports.output[port];
        // These bypass the IOHandler, but that's ok, they
        // are just external internal port mappings.
        internalNode = this.getNode(internalPort.nodeId);
        internalNode.on('output', outputHandler(port, internalPort.name));
      }
    }
  }

  if (this.ports.input) {
    for (port in this.ports.input) {
      if (this.ports.input.hasOwnProperty(port)) {
        internalPort = this.ports.input[port];
        // These bypass the IOHandler, but that's ok, they
        // are just external internal port mappings.
        internalNode = this.getNode(internalPort.nodeId);
        internalNode.on('freePort', freePortHandler(port, internalPort.name));
      }
    }
  }
};

/**
 *
 * Runs the shutdown method of the blackbox
 *
 * NOT IMPLEMENTED
 *
 * @public
 */
Flow.prototype.shutdown = function() {

  // not really used yet, but this would envolve just
  // commanding all nodes to shutdown,
  // which will be a simple loop.
};

/**
 *
 * Return a serializable export of this flow.
 *
 * @public
 */
Flow.prototype.export = function() {

  return {

    id: this.id,
    pid: this.pid,
    ns: this.ns,
    name: this.name,
    identifier: this.identifier,
    ports: this.ports,
    // cycles: this.cycles,
    inPorts: this.inPorts,
    outPorts: this.outPorts,
    //filled: this.filled,
    // context: this.context,
    active: this.active,
    provider: this.provider,
    // input: this._filteredInput(),
    openPorts: this._openPorts,
    // nodeTimeout: this.nodeTimeout,
    // inputTimeout: this.inputTimeout
  };

};

/**
 *
 * Export this modified instance to a nodedefinition.
 *
 * @public
 */
Flow.prototype.toJSON = function() {

  var def = {
    id: this.id,
    ns: this.ns,
    name: this.name,
    title: this.title,
    type: this.type,
    description: this.description,
    // should not be the full nodes
    nodes: [],
    links: [],
    ports: this.ports,
    providers: this.providers
  };

  for (var name in this.nodes) {
    if (this.nodes.hasOwnProperty(name)) {
      def.nodes.push(this.nodes[name].toJSON());
    }
  }

  for (var id in this.links) {
    if (this.links.hasOwnProperty(id)) {
      def.links.push(this.links[id].toJSON());
    }
  }

  validate.flow(def);

  return def;

};

Flow.prototype.isStartable = function() {

  // err ok, how to determine this.
  // a flow is always startable?
  // ok for now it is..
  // it should'nt though..
  return true;

};

Flow.prototype.event = function(port, output) {
  var p = new Packet(output);
  this.sendPortOutput(port, p);
};

Flow.prototype.sendPortOutput = function(port, p) {

  // important identifies from what action this output came.
  // used by connections to determine if it should consume
  // the output.

  var out = {
    node: this.export(),
    port: port,
    out: p
  };

  if (this.isAction()) {
    out.action = self.action;
  }

  this.emit('output', out);

};

Flow.prototype.destroy = function() {

  // just ask all nodes to destroy themselves
  // and finally do the same with self
  for (var id in this.nodes) {
    if (this.nodes.hasOwnProperty(id)) {
      this.nodes.destroy();
    }
  }

};

Flow.prototype.setPid = function(pid) {

  this.pid = pid;

};

/**
 *
 * Create an xFlow
 *
 * Some kind of logic as the actor
 *
 * @api public
 */
Flow.create = function(map, loader, ioHandler, processManager) {

  var actor = new Flow(
    map.id,
    map,
    map.ns + ':' + map.name,
    loader,
    ioHandler,
    processManager
  );

  return actor;
};

Flow.prototype.reset = function() {

  this.runCount = 0;
  //this.filled = 0;

  // ask all our nodes to reset.
  // TODO: will be done double if the IO manager
  // also ask all nodes to reset itself.
  for (var id in this.nodes) {
    if (this.nodes.hasOwnProperty(id)) {
      this.nodes.reset();
    }
  }

};

/**
 *
 * Helper function to make the flow an npm module itself.
 *
 * Usage:
 *
 *   Ok, here is the clash...
 *   xFlow needs way to much information to initialize.
 *   It should have the same interface as actor.
 *
 *   var xflow = new xFlow:create(map, loader);
 *   xflow.addMap(map);
 *
 *   module.exports = xflow.expose;
 *
 *   ---
 *
 *   var flow = require('my-flow');
 *
 *   flow({
 *     in: 'some_data',
 *     in2: 'other_data'
 *   }, {
 *     out: function(data) {
 *       // do something with data..
 *     }
 *   });
 *
 * Ok, then what about the actions.
 *
 */
Flow.prototype.expose = function(input, output) {

  var iips = [];
  var key;
  var self = this;
  if (this.hasOwnProperty('ports')) {

    if (this.ports.hasOwnProperty('input')) {

      for (key in input) {

        if (input.hasOwnProperty(key)) {

          var iip;
          var inputPorts = this.ports.input;

          if (inputPorts.hasOwnProperty(key)) {

            iip = {
              target: {
                id: inputPorts[key].nodeId,
                port: inputPorts[key].name,
              },
              data: input[key]
            };

            iips.push(iip);

            // Within the exposed ports these should
            // already be set if they must be used.
            // (implement that) they are not properties
            // a caller should set.
            //
            // target.settings,
            // target.action

          }
          else {

            throw Error(util.format('No such input port %s', key));

          }

        }

      }

    }
    else {
      throw Error('The map provided does not have any input ports available');
    }

    if (output) {

      var cb = output;

      if (this.ports.hasOwnProperty('output')) {

        /////// setup callbacks
        this.on('output', function output(data) {
          if (data.node.id === self.id && cb.hasOwnProperty(data.port)) {
            cb[data.port](data.out);
          }
        });

      }
      else {
        throw Error(
          'The map provided does not have any output ports available'
        );
      }

    }

  }
  else {
    throw Error('The map provided does not have any ports available');
  }

  // start it all
  if (iips.length) {
    this.sendIIPs(iips);
  }

  this.push();

  return this;

};

Flow.prototype.getConnections = function() {
  return this._connections;
};

/**
 *
 * Adds the parent Actor.
 *
 * For now this is only used to copy the events.
 *
 * It causes all nested actors to report to the root
 * actor's listeners.
 *
 * Rather important, otherwise you would
 * only get the events from the first root Actor/Flow
 *
 * @param {Object} actor
 */
Flow.prototype.setParent = function(actor) {
  this.parent = actor;
};

Flow.prototype.getParent = function() {
  return this.parent;
};

Flow.prototype.hasParent = function() {
  return !!this.parent;
};

module.exports = Flow;

},{"./ConnectionMap":7,"./actor":8,"./link":14,"./packet":19,"./validate":28,"debug":37,"util":6}],12:[function(require,module,exports){
'use strict';

var util = require('util');

/**
 *
 * Handles the index
 *
 * @param {Link} link
 * @param {Packet} p
 * @api public
 */
module.exports = function handleIndex(link, p) {
  // TODO: data should be better defined and a typed object
  var index = link.source.get('index');
  if (/^\d+/.test(index)) {
    // numeric
    if (Array.isArray(p.data)) {
      if (index < p.data.length) {
        // new remember index.
        p.index = index;
        return p.data[index];
      }
      else {
        throw new Error(
          util.format(
            'index[] out-of-bounds on array output port `%s`',
            link.source.port
          )
        );
      }
    }
    else {
      throw new Error(
        util.format(
          'Got index[] on array output port `%s`, ' +
          'but data is not of the array type',
          link.source.port
        )
      );
    }
  }
  else {
    if (typeof p.data === 'object') {
      if (p.data.hasOwnProperty(index)) {
        // new remember index.
        p.index = index;
        return p.data[index];
      }
      else {
        // maybe do not fail hard and just send to the error port.
        console.log(p.data);
        throw new Error(
          util.format(
            'Property `%s` not found on object output port `%s`',
            index,
            link.source.port
          )
        );
      }
    }
    else {
      throw new Error(
        util.format(
          'Got index[] on non-object output port %s',
          link.source.port
        )
      );
    }
  }
};

},{"util":6}],13:[function(require,module,exports){
'use strict';
var Packet = require('../packet');
var EventEmitter = require('events').EventEmitter;
var util = require('util');
var CHI = require('chix-chi');
var uuid = require('uuid').v4;
var handleIndex = require('./indexHandler');
var isPlainObject = require('is-plain-object');
var DefaultQueueManager = require('../queue/defaultManager');
var debug = require('debug')('chix:io');

function cloneData(p, type) {
  /* function type does not mean the data itself is directly
   * a function, it can also be a plain object holding
   * functions. so what is specified is leading.
   */
  if (type === 'function') {
    return;
  }
  if (typeof p.data === 'object' && isPlainObject(p.data)) {
    p.data = JSON.parse(JSON.stringify(p.data));
  }
}

/**
 *
 * This is the IoMap Handler
 *
 * It should know:
 *
 *  - the connections.
 *  - address of the source UUID + port name
 *  - address of the target UUID + port name
 *  - relevant source & target connection settings.
 *
 * Connection settings can overlap with port settings.
 * Connection settings take precedence over port settings,
 * althought this is not set in stone.
 *
 * @constructor
 * @public
 *
 **/

function IoMapHandler() {
  this.CHI = new CHI();
  // todo: create maps from each of these and wrap them in a connections map
  // so all there wil be is this.connections.
  // connections.byTarget, connections.bySource etc.
  this.targetMap = {};
  this.connections = {};
  this.sourceMap = {};
  this.syncedTargetMap = {};
  this.pointerPorts = {};
  this._shutdown = false;
  this.addQueueManager(
    new DefaultQueueManager(this.receiveFromQueue.bind(this))
  );
  this.addCHI(this.CHI);
}

util.inherits(IoMapHandler, EventEmitter);

IoMapHandler.prototype.addCHI = function(CHI) {
  this.CHI = CHI;
  this.CHI.on('begingroup', this.beginGroup.bind(this));
  this.CHI.on('endgroup', this.sendGroup.bind(this));
  this.CHI.on('collected', this.collected.bind(this));
  this.CHI.on('synced', this.sendSynced.bind(this));
};

/**
 *
 * Connects ports together using the link information provided.
 *
 *  @param {xLink} link
 * @api public
 */
IoMapHandler.prototype.connect = function(link) {
  if (!link.source) {
    throw Error('Link requires a source');
  }
  if (!link.source.pid) {
    link.source.pid = link.source.id;
  }
  // TODO: quick fix, which never works..
  // ioHandler is the only one assigning these..
  // a link with ioid set should be rejected..
  if (!link.ioid) {
    link.ioid = uuid();
  }
  if (!link.target) {
    throw Error('Link requires a target');
  }
  if (!link.target.pid) {
    link.target.pid = link.target.id;
  }
  // register the connection
  this.connections[link.ioid] = link;
  if (!this.targetMap[link.source.pid]) {
    this.targetMap[link.source.pid] = [];
  }
  this.targetMap[link.source.pid].push(link);
  if (!this.sourceMap[link.target.pid]) {
    this.sourceMap[link.target.pid] = [];
  }
  this.sourceMap[link.target.pid].push(link);
  // build the syncedTargetMap, it contains a port array
  // (the group that wants a sync with some originId
  if (link.target.has('sync')) {
    if (!this.syncedTargetMap[link.target.pid]) {
      this.syncedTargetMap[link.target.pid] = {};
    }
    if (!this.syncedTargetMap[link.target.pid][link.target.get('sync')]) {
      this.syncedTargetMap[link.target.pid][link.target.get('sync')] = [];
    }
    this.syncedTargetMap[link.target.pid][link.target.get('sync')]
      .push(link.target.port);
    debug(
      '%s: syncing source port `%s` with target port %s',
      link.ioid, link.target.get('sync'), link.target.port
    );
  }
  if (link.source.get('pointer')) {
    if (!this.pointerPorts[link.source.pid]) {
      this.pointerPorts[link.source.pid] = [];
    }
    this.pointerPorts[link.source.pid].push(link.source.port);
    debug('%s: added pointer port `%s`', link.ioid, link.source.port);
  }

  debug('%s: link connected', link.ioid);

  this.emit('connect', link);
};

// TODO: ugly, source & target map
// should be one central place of registration.
// now a link is in two places.
IoMapHandler.prototype.get = function(link) {
  if (this.sourceMap[link.target.pid]) {
    return this.sourceMap[link.target.pid];
  }
};

IoMapHandler.prototype.lock = function(link) {
  debug('%s: lock', link.ioid);
  this.queueManager.lock(link.ioid);
};

IoMapHandler.prototype.unlock = function(link) {
  debug('%s: unlock', link.ioid);
  this.queueManager.unlock(link.ioid);
};

IoMapHandler.prototype.accept = function(link /*, p*/ ) {
  debug('%s: accept', link.ioid);
  // update the fill count.
  // normally belongs to a Port Object.
  link.fills++;
  // re-open queue for this link.
  if (this.queueManager.isLocked(link.ioid)) {
    // freePort will do this now.
    this.queueManager.unlock(link.ioid);
  }
};

IoMapHandler.prototype.reject = function(err, link, p) {
  // update the reject count.
  // normally belongs to a Port Object.
  link.rejects++;
  this.queueManager.lock(link.ioid);
  // Do not put it back in queue if there was a *real* error
  // Default error is `false`, which is just a normal reject.
  if (util.isError(err)) {
    debug('%s: reject (error)', link.ioid);
    // stays locked.
  }
  else {
    // put it back in queue.
    debug('%s: reject (requeue)', link.ioid);
    this.queueManager.unshift(link.ioid, p);
    // unlock again
    // stay locked, untill unlocked
    // IMPORTANT! unlock logic must just work
    // otherwise it goes beserk.
    // this.queueManager.unlock(link.ioid);
    // The process manager is listening for the node
    // which is already in error state
    // this.emit('error', err);
  }
};

/**
 *
 *  Disconnects a link
 *
 *  @param {xLink} link
 */
IoMapHandler.prototype.disconnect = function(link) {
  var src;
  var tgt;
  // unregister the connection
  if (this.connections.hasOwnProperty(link.ioid)) {
    delete this.connections[link.ioid];
  }
  else {
    throw Error('Cannot disconnect an unknown connection');
  }
  if (this.targetMap[link.source.pid]) {
    src = this.targetMap[link.source.pid];
    src.splice(src.indexOf(link), 1);
    if (src.length === 0) {
      delete this.targetMap[link.source.pid];
    }
  }
  if (this.sourceMap[link.target.pid]) {
    tgt = this.sourceMap[link.target.pid];
    tgt.splice(tgt.indexOf(link), 1);
    if (tgt.length === 0) {
      delete this.sourceMap[link.target.pid];
    }
  }
  if (this.syncedTargetMap[link.target.pid]) {
    tgt = this.syncedTargetMap[link.target.pid];
    tgt.splice(src.indexOf(link.target.port), 1);
    if (tgt.length === 0) {
      delete this.syncedTargetMap[link.target.pid];
    }
  }
  if (this.pointerPorts[link.source.pid]) {
    src = this.pointerPorts[link.source.pid];
    src.splice(src.indexOf(link.source.port), 1);
    if (src.length === 0) {
      delete this.pointerPorts[link.source.pid];
    }
  }
  debug('%s: disconnected', link.ioid);
  // prevents iip bug, where iip is still queued.
  // disconnect does not correctly take queueing into account.
  delete link.ioid;

  // used by actor to close ports
  this.emit('disconnect', link);
};

/**
 *
 * Get all node ids that target this node.
 *
 * TODO: return .id's not .pid ah well..
 *
 * @param {String} pid
 * @return {Array}
 * @api public
 */
IoMapHandler.prototype.getSourcePids = function(pid) {
  var i;
  var src;
  var ids = [];
  if (this.sourceMap.hasOwnProperty(pid)) {
    for (i = 0; i < this.sourceMap[pid].length; i++) {
      src = this.sourceMap[pid][i].source;
      if (ids.indexOf(src.pid) === -1) {
        ids.push(src.pid);
      }
    }
  }
  return ids;
};

/**
 *
 * Get all nodes that use this node as a source .
 *
 * @param {String} pid
 * @return {Array}
 * @api public
 */
IoMapHandler.prototype.getTargetPids = function(pid) {
  var i;
  var ids = [];
  if (this.targetMap.hasOwnProperty(pid)) {
    for (i = 0; i < this.targetMap[pid].length; i++) {
      ids.push(this.targetMap[pid][i].target.pid);
    }
  }
  return ids;
};

/**
 *
 * Get all node ids this node depends on.
 *
 * @param {String} pid
 * @return {Array}
 * @api public
 */
IoMapHandler.prototype.getAncestorPids = function(pid) {
  var i;
  var ids = [];
  var aIds = [];
  var u = [];
  aIds = ids = this.getSourcePids(pid);
  for (i = 0; i < ids.length; i++) {
    aIds = aIds.concat(this.getAncestorPids(ids[i]));
  }
  for (i = 0; i < aIds.length; i++) {
    if (u.indexOf(aIds[i]) === -1) {
      u.push(aIds[i]);
    }
  }
  return u;
};
IoMapHandler.prototype.reset = function(cb) {
  var self = this;
  this._shutdown = true;
  this.queueManager.reset(function() {
    // All writes should stop, queuemanager resets.
    // or maybe should wait for queuemanager to be empty.
    if (cb) {
      cb();
    }
    self._shutdown = false;
  });
};

IoMapHandler.prototype.receiveFromQueue = function(ioid, p) {
  debug('%s: receive from queue', ioid);
  if (this.connections.hasOwnProperty(ioid)) {
    this.send(this.connections[ioid], p);
  }
};

/**
 *
 * The method to provide input to this io handler.
 *
 * @param {Link} link
 * @param {Packet} p
 *
 */
IoMapHandler.prototype.send = function(link, p) {
  if (link.source.has('pointer')) { // is just a boolean
    debug('%s: handling pointer', link.ioid);
    var identifier;
    var pp;
    // THIS IS NOT THE PLACE TO CLONE, but let's try it.
    // WILL BREAK ANYWAY WITH references.
    //
    // Ok, what is _the_ location to clone.
    //
    // A package going different routes must clone.
    //
    // p = p.clone();
    // Create an identifier
    pp = this.getPointerPorts(link.source.pid);
    pp.unshift(link.source.pid);
    identifier = pp.join('-');
    // The source node+port are pointed to.
    // The packet has it's chi updated with the
    // source.pid as key and an assigned item id as value
    //
    this.CHI.pointer(
      link.source.pid,
      link.source.port,
      p,
      identifier
    );
  }
  if (link.target.has('sync')) {
    debug('%s: handling sync port', link.ioid);
    var syncPorts = this.getSyncedTargetPorts(link.target);
    this.CHI.sync(
      //link.target,
      link,
      link.target.get('sync'), // originId
      // TODO: should just only accept the packet
      p,
      syncPorts
    );
    // always return, react on CHI.on('synced')
    return;
  }
  this.__sendData(link, p);
};

/**
 *
 * The method to provide input to this io handler.
 *
 * Ok, what misses here is info on how to find the actor
 * Who needs the information
 *
 *
 * Actor:
 *
 *  ioHandler.listenTo(Object.keys(this.nodes),
 *
 * @param {Connector} target
 * @param {object} input
 * @param {object} chi
 * @private
 */

/*
 *
 * Send Data
 *
 * @param {xLink} link - Link to write to
 * @param {Any} data - The input data
 * @private
 */
IoMapHandler.prototype.__sendData = function(link, p) {
  if (this._shutdown) {
    // TODO:: probably does not both have to be dropped
    // during __sendData *and* during output
    this.drop(p, link);
  }
  else {
    var data;
    if (link.target.has('cyclic') &&
      Array.isArray(p.data) // second time it's not an array anymore
    ) {
      debug('%s: cycling', link.ioid);
      // grouping
      // The counter part will be 'collect'
      var g = this.CHI.group();
      if (p.data.length === 0) {
        return false;
      }
      // make a copy otherwise if output goes to several ports
      // it will receive a popped version.
      //
      // Ok, this has to be removed and source ports should set as cyclic.
      // Not target ports.
      data = JSON.parse(JSON.stringify(p.data));
      var i;
      for (i = 0; i < data.length; i++) {
        // create new packet
        var newp = new Packet(data[i]);
        // this is a copy taking place..
        newp.set('chi', p.chi ? JSON.parse(JSON.stringify(p.chi)) : {});
        g.item(newp.chi);
        this.queueManager.queue(link.ioid, newp);
      }
      // we are done grouping now.
      g.done();
      return; // RETURN
    }
    var cp = p; // current packet
    // too bad cannot check the receiver type.
    // TODO: maybe have p.type() so the packet can tell it's content type.
    // plain object is a bit harder though would have to introduce
    // PLAIN_OBJECT type or something
    // The packet itself should tell what it is,
    // not checking p.data externally like this.
    /*
    if (typeof cp.data === 'object' && isPlainObject(cp.data)) {
      cp.data = JSON.parse(JSON.stringify(cp.data));
    }
    */
    cloneData(cp, 'function');
    // TODO: not sure if index should stay within the packet.
    if (link.source.has('index') && !cp.hasOwnProperty('index')) {
      //if (link.source.has('index')) {
      // above already cloned if possible.
      // what is not cloned is CHI, so could cause a problem..
      cp.chi = JSON.parse(JSON.stringify(cp.chi));
      cp = p.clone(false); // important!
      if (undefined === cp.data[link.source.get('index')]) {
        // this is allowed now for async array ports.
        // the component will only send one index at a time.
        // this is useful for routing.
        // maybe only enable this with a certain setting on the port later on.
        debug('%s: INDEX UNDEFINED %s', link.ioid, link.source, cp.data);
        // does this stop the loop, because it should not.
        return; // nop
      }
      else {
        cp.data = handleIndex(link, cp);
      }
    }
    // TODO: probably just remove this emit. (chix-runtime is using it)
    this.emit('data', {
      link: link,
      data: cp.data // only emit the data
    });

    debug('%s: writing packet', link.ioid);

    link.write(cp);
    this.emit('receive', link);
  }
};

/**
 *
 * Handles the output of every node.
 *
 * This comes directly from the Actor, whom got it from the node.
 *
 * The emit should maybe come from the link write.
 *
 * If there is chi it will be passed along.
 *
 * @param {NodeEvent} event
 * @api public
 */
IoMapHandler.prototype.output = function(event) {
  // used by monitors
  this.emit('output', event);
  this.receive(event.node, event.port, event.out, event.action);
};

/**
 *
 * Monitor event types
 *
 * Optionally provided with a pid.
 *
 */
IoMapHandler.prototype.monitor = function(eventType, pid, cb) {
  this.__monitor(eventType, pid, cb, 'on');
};

IoMapHandler.prototype.monitorOnce = function(eventType, pid, cb) {
  this.__monitor(eventType, pid, cb, 'once');
};

IoMapHandler.prototype.__monitor = function(eventType, pid, cb, how) {
  debug('start monitoring %s', eventType);
  if (!cb) {
    cb = pid;
    pid = undefined;
  }
  var monitor = (function(pid, eventType, cb) {
    return function monitorCallback(event) {
      if (event.port === eventType) {
        if (!pid || event.node.pid === pid) {
          cb(event.out);
        }
      }
    };
  })(pid, eventType, cb);
  this[how]('output', monitor);
};

/**
 *
 * Handles the output of every node.
 *
 * If there is chi it will be passed along.
 *
 * @param {Object} dat
 * @private
 */

/*
 *  source.id
 *  source.port
 *  action should be in the source?
 *
 *  action is target information, but is the only setting used..
 *  so just have the third parameter be action for now.
 *
 *  source is the full source node.
 **/
//  this.receive(dat.node, dat.port, dat.out, dat.action);
IoMapHandler.prototype.receive = function(source, port, p, action) {
  var i;
  // If the output of this node has any target nodes
  if (this.targetMap.hasOwnProperty(source.pid)) {
    // If there are any target nodes defined
    if (this.targetMap[source.pid].length) {
      // Iterate those targets
      for (i = 0; i < this.targetMap[source.pid].length; i++) {
        // Process this link
        var xlink = this.targetMap[source.pid][i];
        // If the link is about this source port
        if (port === xlink.source.port) {
          // did this output came from an action
          // if so, is it an action we are listening for.
          if (!action || xlink.source.action === action) {
            if (xlink.source.get('collect')) {
              debug('%s: collecting packets', xlink.ioid);
              this.CHI.collect(xlink, p);
              continue; // will be handled by event
            }
            //var noQueue = xlink.target.has('noqueue');
            var noQueue = false;
            this.emit('send', xlink);
            // queue must always be used otherwise persist
            // will not work..
            if (noQueue) {
              // must be sure, really no queue, also not after input.
              this.send(xlink, p);
            }
            else {
              debug('%s: queueing', xlink.ioid);
              this.queueManager.queue(xlink.ioid, p);
            }
          }
        }
      }
    }
  }
};

// collected is about the link
// a group is collected for that link
// and is thus always an array.
// this means the target should be used to re-send
// the collected input.
// the group information is actually not interesting.
// we only know we want the data from the last group.
// and use it.
IoMapHandler.prototype.collected = function( /*target, p*/ ) {
  /*
  data.data
  data.link
  */
};

IoMapHandler.prototype.beginGroup = function( /*group*/ ) {};
IoMapHandler.prototype.sendGroup = function( /*group, data*/ ) {
  /*
  data.data
  data.link
  */
};

/**
 *
 * Add Queue Manager.
 *
 * @param {QueueManager} qm
 * @api private
 *
 */
IoMapHandler.prototype.addQueueManager = function(qm) {
  this.queueManager = qm;
};

IoMapHandler.prototype.getSyncedTargetPorts = function(target) {
  var originId = target.get('sync');
  if (!this.syncedTargetMap.hasOwnProperty(target.pid)) {
    throw new Error(util.format('Unkown sync: `%s`', target.pid));
  }
  if (!this.syncedTargetMap[target.pid].hasOwnProperty(originId)) {
    throw new Error(util.format('Unkown sync with: `%s`', originId));
  }
  // returns the ports array, those who wanna sync with originId
  return this.syncedTargetMap[target.pid][originId];
};

IoMapHandler.prototype.getPointerPorts = function(originId) {
  if (this.pointerPorts.hasOwnProperty(originId)) {
    return this.pointerPorts[originId];
  }
  else {
    throw new Error(util.format('%s has no pointer ports', originId));
  }
};

/**
 *
 * Send synchronized input
 *
 * TODO: Input is synced here then we
 *   throw it into the input sender.
 *   They probably stay synced, but
 *   it's not enforced anywhere after this.
 *
 * @param {string} targetId
 * @param {object} data
 */
IoMapHandler.prototype.sendSynced = function(targetId, data) {
  for (var targetPort in data) {
    if (data.hasOwnProperty(targetPort)) {
      var synced = data[targetPort];
      // opens all queues, a it radical..
      this.queueManager.flushAll();
      // keep in sync, do not use setImmediate
      debug('%s: sendSynced', synced.link.ioid);
      this.__sendData(synced.link, synced.p);
    }
  }
};

IoMapHandler.prototype.drop = function(packet, origin) {
  // TODO: drop data/packet gracefully
  debug('IoMapHandler: Dropping packet %s %s', packet, origin);
  this.emit('drop', packet);
};

module.exports = IoMapHandler;

},{"../packet":19,"../queue/defaultManager":23,"./indexHandler":12,"chix-chi":31,"debug":37,"events":1,"is-plain-object":42,"util":6,"uuid":49}],14:[function(require,module,exports){
'use strict';

var util = require('util');
var uuid = require('uuid').v4;
var Connector = require('./connector');
var Setting = require('./setting');
var validate = require('./validate');

/**
 *
 * xLink
 *
 *
 * Settings:
 *
 *   - ttl
 *   - expire
 *   - dispose: true
 *
 * Just need something to indicate it's an iip.
 *
 * @constructor
 * @public
 */
function Link(id, ioid) {

  this.fills = 0;
  this.writes = 0;
  this.rejects = 0;
  this.id = id === undefined ? uuid() : id;
  this.ioid = ioid || uuid();
  this.metadata = {};

}

util.inherits(Link, Setting);

Link.create = function(ln) {

  ln = ln || {};

  var link = new Link(ln.id, ln.ioid);

  if (ln.source || ln.target) {
    link.build(ln);
  }

  return link;

};

Link.prototype.build = function(ln) {

  if (!ln.source) {
    throw Error('Create link expects a source');
  }

  if (!ln.target) {
    throw Error('Create link expects a target');
  }

  validate.link(ln);

  this.setSource(
    ln.source.id,
    ln.source.port,
    ln.source.setting,
    ln.source.action
  );

  if (ln.metadata) {
    this.setMetadata(ln.metadata);
  } else {
    this.setMetadata({});
  }

  this.setTarget(
    ln.target.id,
    ln.target.port,
    ln.target.setting,
    ln.target.action
  );

};

/**
 *
 * Set target
 *
 * @param {String} targetId
 * @param {String} port
 * @param {Object} settings
 * @param {String} action
 * @public
 */
Link.prototype.setTarget = function(targetId, port, settings, action) {

  this.target = new Connector(settings);
  this.target.wire = this;
  this.target.plug(targetId, port, action);

};

Link.prototype.write = function(p) {

  this.writes++;

  // just re-emit
  this.emit('data', p);

};

/**
 *
 * Set Source
 *
 * @param {Object} sourceId
 * @param {String} port
 * @param {Object} settings
 * @param {String} action
 * @public
 */
Link.prototype.setSource = function(sourceId, port, settings, action) {

  this.source = new Connector(settings);
  this.source.wire = this;
  this.source.plug(sourceId, port, action);

};

/**
 *
 * Setting of pid's is delayed.
 * I would like them to be available during plug.
 * but whatever.
 *
 */

Link.prototype.setSourcePid = function(pid) {
  this.source.setPid(pid);
};

Link.prototype.setTargetPid = function(pid) {
  this.target.setPid(pid);
};

Link.prototype.setMetadata = function(metadata) {
  this.metadata = metadata;
};

Link.prototype.setMeta = function(key, val) {
  this.metadata[key] = val;
};

/**
 *
 * Set Title
 *
 * @param {String} title
 * @public
 */
Link.prototype.setTitle = function(title) {

  this.setMeta('title', title);

  this.emit('change', this, 'metadata', this.metadata);

};

Link.prototype.clear = function() {

  this.fills = 0;
  this.writes = 0;
  this.rejects = 0;

  this.emit('clear', this);

};

/**
 *
 * Update link by passing it a full object.
 *
 * Will only emit one change event.
 *
 */
Link.prototype.update = function(ln) {

  this.build(ln);

  this.emit('change', this);

};

Link.prototype.toJSON = function() {

  // TODO: use schema validation for toJSON
  if (!this.hasOwnProperty('source')) {
    console.log(this);
    throw Error('Link should have a source property');
  }
  if (!this.hasOwnProperty('target')) {
    throw Error('Link should have a target property');
  }

  var link = {
    id: this.id,
    source: this.source.toJSON(),
    target: this.target.toJSON()
  };

  if (this.metadata) {
    link.metadata = this.metadata;
  }

  if (this.fills) {
    link.fills = this.fills;
  }

  if (this.rejects) {
    link.rejects = this.rejects;
  }

  if (this.writes) {
    link.writes = this.writes;
  }

  if (this.data !== undefined) {
    link.data = JSON.parse(JSON.stringify(this.data));
  }

  return link;
};

module.exports = Link;

},{"./connector":9,"./setting":27,"./validate":28,"util":6,"uuid":49}],15:[function(require,module,exports){
'use strict';

/**
 * Function to sort multidimensional array
 *
 * Simplified version of:
 *
 *   https://coderwall.com/p/5fu9xw
 *
 * @param {array} a
 * @param {array} b
 * @param {array} columns List of columns to sort
 * @param {array} orderBy List of directions (ASC, DESC)
 * @param {array} index
 * @returns {array}
 */
function multisortRecursive(a, b, columns, orderBy, index) {
  var direction = orderBy[index] === 'DESC' ? 1 : 0;

  var x = a[columns[index]];
  var y = b[columns[index]];

  if (x < y) {
    return direction === 0 ? -1 : 1;
  }

  if (x === y)  {
    return columns.length - 1 > index ?
      multisortRecursive(a, b, columns, orderBy, index + 1) : 0;
  }

  return direction === 0 ? 1 : -1;
}

module.exports = function(arr, columns, orderBy) {

  var x;
  if (typeof columns === 'undefined') {
    columns = [];
    for (x = 0; x < arr[0].length; x++) {
      columns.push(x);
    }
  }

  if (typeof orderBy === 'undefined') {
    orderBy = [];
    for (x = 0; x < arr[0].length; x++) {
      orderBy.push('ASC');
    }
  }

  return arr.sort(function(a, b) {
    return multisortRecursive(a, b, columns, orderBy, 0);
  });
};

},{}],16:[function(require,module,exports){
'use strict';

/* jshint -W040 */

var Packet = require('./packet');
var Connector = require('./connector');
var util = require('util');
var NodeBox = require('./sandbox/node');
var PortBox = require('./sandbox/port');
var BaseNode = require('./node/interface');
var Port = require('./port');
var debug = require('debug')('chix:node');
var portFiller = require('./port/filler');

// Running within vm is also possible and api should stay
// compatible with that, but disable for now.
// vm = require('vm'),

/**
 * Error Event.
 *
 * @event Node#error
 * @type {object}
 * @property {object} node - An export of this node
 * @property {string} msg - The error message
 */

/**
 * Executed Event.
 *
 * @event Node#executed
 * @type {object}
 * @property {object} node - An export of this node
 */

/**
 * Context Update event.
 *
 * @event Node#contextUpdate
 */

/**
 * Output Event.
 *
 * Fired multiple times on output
 *
 * Once for every output port.
 *
 * @event Node#output
 * @type {object}
 * @property {object} node - An export of this node
 * @property {string} port - The output port
 * @property {string} out - A (reference) to the output
 */

/**
 *
 * Node
 *
 * TODO:
 *   do not copy all those properties extend the node object itself.
 *   however, do not forget the difference between a nodeDefinition
 *   and a node.
 *
 *   node contains the process definition, which is the node
 *   definition merged with the instance configuration.
 *
 * @author Rob Halff <rob.halff@gmail.com>
 * @param {String} id
 * @param {Object} node
 * @param {String} identifier
 * @param {CHI} CHI
 * @constructor
 * @public
 */
function xNode(id, node, identifier, CHI) {

  if (!(this instanceof xNode)) {
    return new xNode(id, node, identifier, CHI);
  }

  // detection of async is still needed.
  // Really should all just be different classes.
  // Problem now, we have to run the nodebox to
  // determine async, which is a super hacky way.
  this.async = node.type === 'async' ? true : false;
  this.async = node.async ? true : this.async;

  xNode.super_.apply(this, [id, node, identifier, CHI]);

  this.type = 'node';

  this.state = {};

  this.persist = {};

  // remember def for .compile()
  this.def = node;

  /**
   *
   * Indicates whether this instance is active.
   *
   * This works together with the active state
   * of the sandbox.
   *
   * When a blackbox sends async output done()
   * should be used to inform us it is done.
   *
   * @member {Boolean} active
   * @public
   */
  this.active = false;

  /**
   *
   * Indicates whether this node expects async input.
   *
   * Async input listening is done by:
   *
   *   on.input.<port-name> = function() {}
   *
   * Any node can send async output.
   *
   * Async nodes are handled differently, their function body
   * is only executed once, during startup.
   *
   * I think the port input function can be handled the same
   * as a normal function body, we'll just have several
   * functions to execute based on what input port is targeted.
   *
   * The common state is represented in the `state` object.
   * This is the only variable which is accessible to all ports
   * and during startup.
   *
   */
  this.nodebox = new NodeBox();

  // done() is added to the nodebox
  this.nodebox.set('done', this.complete.bind(this));
  this.nodebox.set('cb', this._asyncOutput.bind(this));
  this.nodebox.set('state', this.state);

  this._setup();

  /** @member {Mixed} chi */
  this.chi = {};

  /** delay interval */
  this.interval = 100;

  /** @member {Object} input */
  this.input = {};

  /** @member {Object} context */
  this.context = {};

  /** @member {Object} dependencies */
  this.dependencies = node.dependencies || {};

  /** @member {Array} expose */
  this.expose = node.expose;

  /** @member {String} fn */
  this.fn = node.fn;

  /**
   * @member {Numeric} nodeTimeout
   * @default 3000
   */
  this.nodeTimeout = node.nodeTimeout || 3000;

  /**
   *
   * inputTimeout in milliseconds
   *
   * If inputTimeout === `false` there will be no timeout
   *
   * @member {Mixed} inputTimeout
   * @default 3000
   */
  this.inputTimeout = typeof node.inputTimeout === 'undefined' ?
    3000 : node.inputTimeout;

  /** @private */
  this.__halted = false; // was halted by a hold

  /** @private */
  this._inputTimeout = null;

  // Solving yet another `design` problem
  // object containing the current connections in use
  // will be reset during free Port.
  // Also belongs to the port objects.
  this._activeConnections = {};

  this.status = 'init';

  // setup the core
  this._fillCore();

  // If this node is async, run it once
  // all ports will be setup and sandbox state will be filled.
  if (this._isPreloaded()) {

    // still need to add the precompiled function
    if (this.fn) {
      //this.nodebox.fill(this.fn);
      // not tested..
      this.nodebox.fill(this.fn);
    }

    if (this.async) {
      // how about nodebox.state?
      // state is now in the definition itself..
      // this should really also be a deep copy.
      this.nodebox.state = node.state;
      this._loadAsync();
    }

  }
  else {

    this.nodebox.compile(this.fn);

    if (this.async) {

      // This collects the port definitions they
      // attach to `on`
      this.nodebox.run();

      this._loadAsync();
    }
  }

}

util.inherits(xNode, BaseNode);

// TODO: this generic, however options does not exists anymore, it's settings
xNode.prototype._setup = function() {

  for (var port in this.ports.input) {
    if (this.ports.input.hasOwnProperty(port)) {
      if (this.ports.input[port].options) {
        for (var opt in this.ports.input[port].options) {
          if (this.ports.input[port].options.hasOwnProperty(opt)) {
            this.setPortOption(
              'input',
              port,
              opt,
              this.ports.input[port].options[opt]);
          }
        }
      }
    }
  }

};

xNode.prototype.start = function() {

  var sb;

  if (this.status === 'created') {

    this.setStatus('started');
    debug('%s: running on start', this.identifier);
    if (this.nodebox.on.start) {
      // Run onStart functionality first
      if (typeof this.nodebox.on.start === 'function') {
        sb = this._createPortBox(this.nodebox.on.start);
      } else {
        sb = this._createPortBox(this.nodebox.on.start.toString());
      }
      sb.run(this);
      this.nodebox.state = this.state = sb.state;
    }

    this.emit('started', {
      node: this.export()
    });

  }

};

xNode.prototype.hasData = function(port) {
  return undefined !== this.input[port];
};

xNode.prototype.fill = function(target, data, settings) {

  var p = data instanceof Packet ? data : new Packet(data);

  // allow for simple api
  if (typeof target === 'string') {
    var port = target;
    target = new Connector(settings || {});
    target.plug(this.id, port);
    // target.set('dispose', true); should be on wire
    if (settings) {
      target.set('persist', true);
    }
    this.plug(target);
  }

  var ret = this._receive(target, p);

  debug('%s:%s receive  %s', this.identifier, target.port, ret);

  if (ret !== true) { // Error or `false`
    if (this.ports.input.hasOwnProperty(target.port)) {
      this.ports.input[target.port].rejects++;
      this.ports.input[target.port].lastError = ret;
    }
  }

  return ret;

};

/**
 * Usage of `$`
 *
 * Idea is to do the reverse of super() all extending `classes`
 * only have $ methods.
 *
 * @param {type} port
 * @param {type} data
 * @returns {undefined}
 * @shielded
 */
xNode.prototype.$setContextProperty = function(port, data) {
  debug('%s:%s set context', this.identifier, port);
  this.context[port] = data;
};

xNode.prototype.clearContextProperty = function(port) {

  debug('%s:%s clear context', this.identifier, port);

  delete this.context[port];

  this.event(':contextClear', {
    node: this,
    port: port
  });
};

/**
 *
 * Starts the node
 *
 * TODO: dependencies are always the same, only input is different.
 * dependencies must be created during createScript.
 * also they must be wrapped within a function.
 * otherwise you cannot overwrite window and document etc.
 * ...Maybe statewise it's a good thing, dependencies are re-required.
 *
 * FIXME: this method does too much on it's own.
 *
 * Note: start is totally unprotected, it assumes the input is validated
 * and all required ports are filled.
 * Start should never really be called directly, the node starts when
 * input is ready.
 *
 * @param {Function} fn
 * @param {String} name
 * @fires Node#error
 * @fires Node#require
 * @fires Node#expose
 * @private
 */
xNode.prototype._delay = 0;

xNode.prototype.__start = function() {

  if (this.active) {
    // try again, note: this is different from input queueing..
    // used for longer running processes.
    debug('%s: node still active delaying', this.identifier);
    this._delay = this._delay + this.interval;
    setTimeout(this.start.bind(this), 500 + this._delay);
    return false;
  }

  // set active state.
  this.active = true;

  // Note: moved to the beginning.
  this.runCount++;

  if (!this.async) {
    if (this.nodebox.on) {
      if (this.nodebox.on.shutdown) {
        debug('%s: running shutdown', this.identifier);
        this.shutdown();
      }
    }
  }

  this.nodebox.input = this.input;

  // difference in notation, TODO: explain these constructions.
  // done before compile.
  // this.nodebox.output = this.async ? this._asyncOutput.bind(this) : {};

  this._runOnce();

};

/**
 *
 * Runs the node
 *
 * @fires Node#nodeTimeout
 * @fires Node#start
 * @fires Node#executed
 * @private
 */
xNode.prototype._runOnce = function() {

  var t = setTimeout(function() {

    debug('%s: node timeout', this.identifier);

    /**
     * Timeout Event.
     *
     * @event Node#nodeTimeout
     * @type {object}
     * @property {object} node - An export of this node
     */
    this.event(':nodeTimeout', {
      node: this.export()
    });

  }.bind(this), this.nodeTimeout);

  /**
   * Start Event.
   *
   * @event Node#start
   * @type {object}
   * @property {object} node - An export of this node
   */
  this.event(':start', {
    node: this.export()
  });

  //this.nodebox.runInNewContext(this.sandbox);
  //
  // ok, this depends on what is the code whether it's running or not...
  // that's why async should be definied per port.
  this.setStatus('running');

  this.nodebox.run();
  this.state = this.nodebox.state;

  debug('%s: nodebox executed', this.identifier);

  this.emit('executed', {
    node: this
  });
  this.event(':executed', {
    node: this
  });

  clearTimeout(t);

  this._output(this.nodebox.output);
};

/**
 *
 * Fills the core of this node with functionality.
 *
 * @fires Node#fillCore
 * @private
 */
xNode.prototype._fillCore = function() {

  debug('%s: fill core', this.identifier);

  /**
   * Fill Core Event.
   *
   * @event Node#fillCore
   * @type {object}
   * @property {object} node - An export of this node
   * @property {function} fn - The function being installed
   * @property {string} fn - The name of the function
   */
  this.event(':fillCore', {
    node: this.export(),
    fn: this.fn,
    name: this.name
  });

  this.nodebox.require(this.dependencies.npm);
  this.nodebox.expose(this.expose, this.CHI);

  this.nodebox.set('output', this.async ? this._asyncOutput.bind(this) : {});

  this.setStatus('created');

};

/**
 *
 * Executes the async variant
 *
 * state is the only variable which will persist.
 *
 * @param {string} fn - Portbox Function Body
 * @returns {PortBox}
 * @private
 */
xNode.prototype._createPortBox = function(fn, name) {

  debug('%s: creating portbox `%s`', this.identifier, name);

  var portbox = new PortBox(name);
  portbox.set('state', this.nodebox.state);
  portbox.set('output', this._asyncOutput.bind(this));

  // also absorbes already required.
  portbox.require(this.dependencies.npm, true);
  portbox.expose(this.expose, this.CHI);

  if (typeof fn !== 'function') {
    fn = fn.slice(
      fn.indexOf('{') + 1,
      fn.lastIndexOf('}')
    );
    portbox.compile(fn);
  } else {
    portbox.fill(fn);
  }

  return portbox;

};

/**
 *
 * Test whether this is a preloaded node.
 *
 * @private
 */
xNode.prototype._isPreloaded = function() {

  var ret;

  if (typeof this.fn === 'function') {
    return true;
  }

  for (var port in this.ports.input) {
    if (this.ports.input.hasOwnProperty(port)) {
      ret = !!this.ports.input[port].fn;
      if (ret) {
        return true;
      }
    }
  }

  return false;

};

/**
 *
 * @private
 */
xNode.prototype._loadAsync = function() {

  for (var port in this.ports.input) {

    if (this.ports.input.hasOwnProperty(port)) {

      // If there is a port function defined for this port
      // it means it's async
      if (this.nodebox.on.input.hasOwnProperty(port)) {

        this.ports.input[port].fn = this._createPortBox(
          this.nodebox.on.input[port].toString(), ('__' + port + '__')
          .toUpperCase()
        );

        this.async = true;
        this.ports.input[port].async = true;

      } else if (this.ports.input[port].fn) {

        // pre-compiled
        this.ports.input[port].fn = this._createPortBox(
          this.ports.input[port].fn, ('__' + port + '__').toUpperCase()
        );

        this.async = true;
        this.ports.input[port].async = true;

      }
      else {

        // It is a sync port

      }

    }
  }

  this.setStatus('created');

  // could just act on general status change event, who uses this?
  this.emit('created', {
    node: this.export()
  });

  this.state = this.nodebox.state;

};

/**
 *
 * Generic Callback wrapper
 *
 * Will collect the arguments and pass them on to the next node
 *
 * So technically the next node is the callback.
 *
 * Parameters are defined on the output as ports.
 *
 * Each callback argument must be defined as output port in the callee's schema
 *
 * e.g.
 *
 *  node style callback:
 *
 *  ports.output: { err: ..., result: ... }
 *
 *  connect style callback:
 *
 *  ports.output: { req: ..., res: ..., next: ... }
 *
 * The order of appearance of arguments must match those of the ports within
 * the json schema.
 *
 * TODO: Within the schema you must define the correct type otherwise output
 * will be refused
 *
 *
 * @private
 */
xNode.prototype._callbackWrapper = function() {

  var i;
  var obj = {};
  var ports;

  ports = this.outPorts;

  for (i = 0; i < arguments.length; i++) {

    if (!ports[i]) {

      // TODO: eventemitter expects a new Error()
      // not the object I send
      // Not sure what to do here, it's not really fatal.
      this.event(':error', {
        msg: Error(
          util.format('Unexpected extra port of type %s',
            typeof arguments[i] === 'object' ?
            arguments[i].constructor.name : typeof arguments[i]
          )
        )
      });

    }
    else {

      obj[ports[i]] = arguments[i];

    }
  }

  this._output(obj);

};

/**
 *
 * Execute the delegated callback for this node.
 *
 * [fs, 'readFile', '/etc/passwd']
 *
 * will execute:
 *
 * fs['readFile']('/etc/passwd', this.callbackWrapper);
 *
 * @param {Object} output
 * @fires Node#branching
 * @private
 */
xNode.prototype._delegate = function(output) {

  var fn = output.splice(0, 1).pop();
  var method = output.splice(0, 1).pop();

  output.push(this._callbackWrapper.bind(this));
  fn[method].apply(fn, output);
};

/**
 *
 * This node handles the output of the `blackbox`
 *
 * It is specific to the API of the internal Chix node function.
 *
 * out = { port1: data, port2: data }
 * out = [fs.readFile, arg1, arg2 ]
 *
 * Upon output the input will be freed.
 *
 * @param {Object} output
 * @param {Object} chi
 * @fires Node#output
 * @private
 */
xNode.prototype._asyncOutput = function(output, chi) {

  var port;

  // Ok, delegate and object output has
  // synchronous output on _all_ ports
  // however we do not know if we we're called from
  // the function type of output..
  for (port in output) {
    if (output.hasOwnProperty(port)) {
      this.sendPortOutput(port, output[port], chi);
    }
  }

};

/**
 *
 * Output
 *
 * Directs the output to the correct handler.
 *
 * If output is a function it is handled by asyncOutput.
 *
 * If it's an array, it means it's the shorthand variant
 *
 * e.g. output = [fs, 'readFile']
 *
 * This will be handled by the delegate() method.
 *
 * Otherwise it is a normal output object containing the output for the ports.
 *
 * e.g. { out1: ...,  out2: ...,  error: ... } etc.
 *
 * TODO: not sure if this should always call complete.
 *
 * @param {Object} output
 * @private
 */
xNode.prototype._output = function(output) {

  var port;

  if (typeof output === 'function') {
    output.call(this, this._asyncOutput.bind(this));
    return;
  }

  if (Array.isArray(output)) {
    this._delegate(output);
    return;
  }

  for (port in output) {
    if (output.hasOwnProperty(port)) {
      this.sendPortOutput(port, output[port]);
    }
  }

  this.complete();

};

/**
 *
 * @param {string} port
 * @private
 */

xNode.prototype._runPortBox = function(port) {

  var sb = this.ports.input[port].fn;
  // fill in the values

  this.event(':start', {
    node: this.export()
  });

  sb.set('data', this.input[port]);
  sb.set('x', this.chi);
  sb.set('state', this.state);
  // sb.set('source', source); is not used I hope
  sb.set('input', this.input); // add all (sync) input.

  this.setStatus('running');

  var ret = sb.run(this);

  this.nodebox.state = this.state = sb.state;

  if (ret === false) {
    // if ret === false input should be revoked and re-queued.
    // which means it must look like we didn't accept the packet in
    // the first place.

    // this.setStatus('idle');
    var d = this.input[port];

    // freePort somehow doesn't work
    // only the below + unlock during unshift works.
    // but has the danger of creating an infinite loop.
    // if rejection is always false.
    delete this.input[port];
    delete this._activeConnections[port];

    this.event(':portReject', {
      node: this.export(),
      port: port,
      data: d // TODO: other portReject emits full packet instead of data.
    });

    return false;
  }

  // todo portbox itself should probably also
  // maintain it's runcount, this one is cumulative
  this.runCount++;

  debug('%s:%s() executed', this.identifier, port);

  this.emit('executed', {
    node: this,
    port: port
  });

  this.event(':executed', {
    node: this,
    port: port
  });

};

/**
*
* Contains much of the port's logic, this should be abstracted out
* into port objects.
*
* For now just add extra functionality overhere.
*
* TODO:
*  - Detect if the input port is defined as Array.
*  - If it is an array, detect what is it's behaviour
*
* Behaviours:
*  - Multiple non-array ports are connected: wait until all have send
*    their input and release the array of data.
*  - One port is connect of the type Array, just accept it and run
*  - Multiple array ports give input/are connected... same as the above
*  Arrays will be handled one by one.
*  - So basically, if we receive an array, we process it.
*  If it is not we will join multiple connections.
*  - If there is only one port connected and it is not of an array type
*    We will just sit there and wait forever,
*    because we cannot make an array out of it.
* - I think the rules should be simple, if you want it more complex,
*   just solve it within the flow by adding extra nodes.
*   What a port does must be understandable.  So that's why it's also good if
*   you can specify different kind of port behaviour.
*   So if you do not like a certain kind of behaviour, just select another one.
*   Yet all should be simple to grasp. You could also explain an array as being
*   a port that expects multiple.
*
*   The filled concept stays the same, the only thing changing is when we
*   consider something to be filled.
*
*   So.. where is the port type information.
*
// TODO: once a connection overwrites a setting.
// it will not be put back, this is a choice.
// at what point do we set persistent from a link btw?
//
// TODO: has become a bit of a weird method now.
*/

xNode.prototype.handlePortSettings = function(port) {
  if (this.ports.input.hasOwnProperty(port)) {}
};

/**
 * Fill one of our ports.
 *
 * First the input data will be validated. A port
 * will only be filled if the data is of the correct type
 * or even structure.
 *
 * The following events will be emitted:
 *
 *   - `portFill`
 *   - `inputTimeout`
 *   - `clearTimeout` (TODO: remove this)
 *
 * FIXME:
 *  - options are set and overwritten on portFill
 *    which is probably undesired in most cases.
 *
 *  - portFill is the one who triggers the start of a node
 *    it's probably better to trigger an inputReady event.
 *    and start the node based on that.
 *
 * @param {Connector} target
 * @param {Packet} p
 * @returns {Node.error.error|Boolean}
 * #private
 */
xNode.prototype._fillPort = function(target, p) {

  var res;

  if (undefined === p.data) {
    return Error('data may not be `undefined`');
  }

  // Not used
  //this.handlePortSettings(target.port);

  // PACKET WRITE, TEST THIS
  p.data = this._handleFunctionType(target.port, p.data);

  res = this._validateInput(target.port, p.data);

  if (util.isError(res)) {

    return res;

  }
  else {

    if (target.has('persist')) {
			// do array index thing here also.
      this.persist[target.port] = p.data;
			return true;
		} else {
  // this is too early, defaults do not get filled this way.
  if (this.ports.input[target.port].async === true &&
    !this._allConnectedSyncFilled()) {

    this.event(':portReject', {
      node: this.export(),
      port: target.port,
      data: p
    });

    // do not accept
		console.log('early block');
    return false;
  }


      try {

        // CHI MERGING check this.
        // Or is this to early, can we still get a reject?
        this.CHI.merge(this.chi, p.chi);
      }
      catch (e) {
        // this means chi was not cleared,
        // yet the input which caused the chi setting
        // freed the port, so how is this possible.
        return this.error(util.format(
          '%s: chi item overlap during fill of port `%s`\n' +
          'chi arriving:\n%s\nchi already collected:\n%s',
          this.identifier,
          target.port,
          JSON.stringify(p.chi),
          JSON.stringify(this.chi)
        ));
      }

    }

    // this.filled++;

    if (!this._inputTimeout &&
      this.inputTimeout &&
      //!this.getPortOption('input', port, 'persist')
      !target.has('persist')
    ) {

      this._inputTimeout = setTimeout(function() {

        /**
         * Input Timeout Event.
         *
         * Occurs when there is an input timeout for this node.
         *
         * This depends on the inputTimeout property of the node.
         * If inputTimeout is false, this event will never occur.
         *
         * @event Node#inputTimeout
         * @type {object}
         * @property {object} node - An export of this node
         */
        this.event(':inputTimeout', {
          node: this.export()
        });

      }.bind(this), this.inputTimeout);
    }

    // used during free port to find back our connections.
    // Should belong to the port object (non existant yet)
    if (target.wire) { // direct node.fill() does not have it

      // does not really happen can be removed..
      if (this._activeConnections[target.port]) {
        throw Error('There still is a connection active');
      }
      else {
        this._activeConnections[target.port] = target.wire;
      }
    }

    // set input port data
    // this could be changed to still contain the Packet.
    this._fillInputPort(target.port, p.data);

    /**
     * Port Fill Event.
     *
     * Occurs when a port is filled with data
     *
     * At this point the data is already validated
     *
     * @event Node#portFill
     * @type {object}
     * @property {object} node - An export of this node
     * @property {string} port - Name of the port
     */
    //this.event(':portFill', {
    //todo: not all events are useful to send as output
    //TODO: just _do_ emit both
    this.emit('portFill', {
      node: this.export(),
      link: target.wire,
      port: target.port
    });

    this.event(':portFill', {
      node: this.export(),
      link: target.wire,
      port: target.port
    });

    var ret = this._readyOrNot();
    return ret;

  }

};

/**
 *
 * @param {string} port
 * @param {Mixed} value
 * @private
 */
xNode.prototype._fillInputPort = function(port, value) {

  debug('%s:%s fill', this.identifier, port);

  this.input[port] = value;

  // increment fill counter
  this.ports.input[port].fills++;

};

/* Unused?
xNode.prototype.syncFilled = function() {

  var port;

  for (port in this.input) {
    if (!this.ports.input[port].async &&
       typeof this.input[port] === 'undefined') {
      return false;
    }
  }

  return true;

};

xNode.prototype.syncFilledCount = function() {

  var port;

  var cnt = 0;
  for (port in this.input) {
    if (!this.ports.input[port].async &&
       typeof this.input[port] !== 'undefined') {
      cnt++;
    }
  }

  return cnt;

};
*/

/***
 *
 * Async problem.
 *
 * start() -> isStartable()
 *
 * If links are not connected yet, this logic will not work.
 * However, how to know we are complete.
 * addnode addnode addlink addlink etk
 *
 *
 *
 */
// ok, nice, multiple ip's will not be possible?, yep..
xNode.prototype.isStartable = function() {

  if (this.hasConnections()) {
    // should never happen with IIPs so fix that bug first
    return false;
  }

  var fillable = 0;
  for (var port in this.ports.input) {
    // null is possible..
    if (this.ports.input[port].default !== undefined) {
      fillable++;
    }
    else if (this.context[port]) {
      fillable++;
    }
    else if (port === ':start') {
      fillable++;
      //} else if (!this.ports.input[port].required) {
    }
    else if (this.ports.input[port].required === false) {
      fillable++;
    }
  }

  return fillable === this.inPorts.length;

};

/**
 *
 * Determines whether we are ready to go.
 * And starts the node accordingly.
 *
 * TODO: it's probably not so smart to consider default
 * it means we can never send an IIP to a port with a default.
 * Because the default will already trigger the node to run.
 *
 * @private
 */
xNode.prototype._readyOrNot = function() {

  // all connected ports are filled.
  if (this._allConnectedSyncFilled()) {

    if (this._inputTimeout) {
      clearTimeout(this._inputTimeout);
    }

    // Check context/defaults etc. and fill it
    var ret = portFiller.fill(
      this.ports.input,
      this.input,
      this.context,
      this.persist
    );

    // TODO: if all are async, just skip all the above
    // async must be as free flow as possible.
    if (util.isError(ret)) {

      debug('%s: filler error `%s`', this.identifier, ret);

      return ret;

    }
    else {

      // temp for debug
      //this.ready = true;

      // todo better to check for ready..
      if (this.status !== 'hold') {

        if (this.async) {

          // really have no clue why these must run together
          // and why I try to support 4 different ways of writing
          // a component and sqeeze it into one class.

          var async_ran = 0;
          for (var port in this.ports.input) {

            // run all async which have input.
            // persistent async will have input etc.
            if ((this.ports.input[port].async ||
              this.ports.input[port].fn) &&
              this.input[port] !== undefined) {

              ret = this._runPortBox(port);

              if (ret === false) {
                // revoke input
                if (async_ran > 0) {
                  // only problem now is the multpile async ports.
                  //
                  throw Error('Input revoked, yet one async already ran');
                }

                debug('%s:%s() revoked input', this.identifier, port);

                return Port.INPUT_REVOKED;
              }

              async_ran++;

            }
          }

          if (async_ran > 0) {
            this.freeInput();
          }

        }
        else { // not async

          if (Object.keys(this.input).length !== this.inPorts.length) {

            //return this.error(util.format(
            return Error(util.format(
              'Input does not match, Input: %s, InPorts: %s',
              Object.keys(this.input).toString(),
              this.inPorts.toString()
            ));

          }
          else {

            this.setStatus('running');
            this.__start();

          }

        }

      }
      else {
        this.__halted = true;
      }

    }

    return true;
  }

  // OK, this false has nothing to do with fill return codes..
  // yet above for async I treat false as a failed fill.
  // console.log('SYNC NOT FILLED!', ret, this.identifier);
  //return false;
  return true;

};

/**
 *
 * Frees the input
 *
 * After a node has run the input ports are freed,
 * removing their reference.
 *
 * Exceptions:
 *
 *  - If the port is set to persistent, it will keep it's
 *    reference to the variable and stay filled.
 *
 * NOTE: at the moment a port doesn't have a filled state.
 *  we only count how many ports are filled to determine
 *  if we are ready to run.
 *
 * if a node is still in active state it's input can also not
 * be freed... at the moment it will do so, which is bad.
 *
 * @public
 */
xNode.prototype.freeInput = function() {

  var i;

  // this.filled = 0;

  // Reset this.chi.
  // must be before freePort otherwise chi will overlap
  this.chi = {};

  var port;

  var freed = [];
  for (i = 0; i < this.inPorts.length; i++) {

    port = this.inPorts[i];

    // TODO: don't call freeInput in the first place if undefined
    if (this.input[port] !== undefined) {
      this.freePort(port);
      freed.push(port);
    }
  }

};

xNode.prototype.$portIsFilled = function(port) {
  return this.input.hasOwnProperty(port);
};

xNode.prototype.clearInput = function(port) {
  delete this.input[port];
};

xNode.prototype.freePort = function(port) {
/*
  var persist = this.getPortOption('input', port, 'persist');
  if (persist) {
    // persist, chi, hmz, seeze to exist.
    // but wouldn't matter much, with peristent ports.
    // TODO: this.filled is not used anymore.
    debug('%s:%s persisting', this.identifier, port);

    // indexes are persisted per index.
    // store inside persit
    if (Array.isArray(persist)) {
      // TODO: means object is not supported..
      this.persist[port] = [];
      for (var k in this.input[port]) {
        if (persist.indexOf(k) === -1) {
          //debug('%s:%s[%s] persisting', this.identifier, port, k);
          // remove
          //delete this.input[port][k];
        } else {
          debug('%s:%s[%s] persisting', this.identifier, port, k);
          this.perists[port][k] = this.input[port][k];
        }
        delete this.input[port][k];
      }
    } else {

      this.persist[port] = this.input[port];
      delete this.input[port];

    }
  }
*/
  //else {

  // this also removes context and default..
  this.clearInput(port);

  debug('%s:%s :freePort event', this.identifier, port);
  this.event(':freePort', {
    node: this.export(),
    link: this._activeConnections[port], // can be undefined, ok
    port: port
  });

  this.emit('freePort', {
    node: this.export(),
    link: this._activeConnections[port],
    port: port
  });

  // delete reference to active connection (if there was one)
  // delete this._activeConnections[port];
  this._activeConnections[port] = null;
  //}

};

/**
 *
 * Checks whether all required ports are filled
 *
 * Used to determine if this node should start running.
 *
 * @public
 */
xNode.prototype.allConnectedFilled = function() {
  for (var port in this.openPorts) {
    if (this.input[port] === undefined) {
      return Node.ALL_CONNECTED_NOT_FILLED;
    }
  }
  return true;
};

xNode.SYNC_NOT_FILLED = false;
xNode.ALL_CONNECTED_NOT_FILLED = false;

/**
 *
 * @private
 */
xNode.prototype._allConnectedSyncFilled = function() {

  for (var i = 0; i < this.openPorts.length; i++) {
    var port = this.openPorts[i];

    // .async test can be removed, .fn is enough
    if (!this.ports.input[port].async ||
      !this.ports.input[port].fn) {

      // should be better index check perhaps
      if (!this.persist.hasOwnProperty(port)) {

				if (this.ports.input[port].indexed) {
					if (/object/i.test(this.ports.input[port].type)) {
						return this._objectPortIsFilled(port);
					}
					else {
						return this._arrayPortIsFilled(port);
					}
				}
				else if (this.input[port] === undefined) {
					return xNode.SYNC_NOT_FILLED;
				}

			}
    }
  }

  return true;
};

/**
 *
 * Wires a source port to one of our ports
 *
 * target is the target object of the connection.
 * which consist of a source and target object.
 *
 * So in this calink.se the target is _our_ port.
 *
 * If a connection is made to the virtual `:start` port
 * it will be created automatically if it does not exist already.
 *
 * The port will be set to the open state and the connection
 * will be registered.
 *
 * A port can have multiple connections.
 *
 * TODO: the idea was to also keep track of
 *       what sources are connected.
 *
 * @private
 */
xNode.prototype._initStartPort = function() {
  // add it to known ports
  if (!this.portExists('input', ':start')) {
    debug('%s:%s initialized', this.identifier, ':start');
    this.addPort('input', ':start', {
      type: 'any',
      rejects: 0,
      fills: 0
    });
  }
};

/**
 *
 * Holds all input until release is called
 *
 * @public
 */
xNode.prototype.hold = function() {
  this.setStatus('hold');
};

/**
 *
 * Releases the node if it was on hold
 *
 * @public
 */
xNode.prototype.release = function() {

  this.setStatus('ready');

  if (this.__halted) {
    this.__halted = false;
  }
  return this._readyOrNot();
};

xNode.prototype.isHalted = function() {
  return this.__halted;
};

/**
 *
 * Node completion
 *
 * Sends an empty string to the :complete port.
 * Each node automatically has one of those available.
 *
 * Emits the complete event and frees all input ports.
 *
 * @private
 */
xNode.prototype.complete = function() {

  this.active = false;

  // uses this.event() now.
  // this.sendPortOutput(':complete', '', this.chi);

  /**
   * Complete Event.
   *
   * The node has completed.
   *
   * TODO: a node can set itself as being active
   * active must be taken into account before calling
   * a node complete. As long as a node is active
   * it is not complete.
   *
   * @event Node#complete
   * @type {object}
   * @property {object} node - An export of this node
   */

  this.freeInput();

  this.setStatus('complete');

  this.event(':complete', {
    node: this.export()
  });

};

/**
 *
 * Runs the shutdown method of the blackbox
 *
 * An asynchronous node can define a shutdown function:
 *
 *   on.shutdown = function() {
 *
 *     // do shutdown stuff
 *
 *   }
 *
 * When a network shuts down, this function will be called.
 * To make sure all nodes shutdown gracefully.
 *
 * e.g. A node starting a http server can use this
 *      method to shutdown the server.
 *
 * @param {function} cb
 * @returns {undefined}
 * @public
 */
xNode.prototype.shutdown = function(cb) {
  if (this.nodebox.on && this.nodebox.on.shutdown) {

    // TODO: nodes now do nothing with the callback, they should..
    // otherwise we will hang
    this.nodebox.on.shutdown(cb);

    // TODO: send the nodebox, or just the node export?
    this.event(':shutdown', this.nodebox);

  }
  else {
    if (cb) {
      cb();
    }
  }
};

/**
 *
 * Cleanup
 *
 * @public
 */
xNode.prototype.destroy = function() {
  for (var i = 0; i < xNode.events.length; i++) {
    this.removeAllListeners(xNode.events[i]);
  }
};

/**
 *
 * Live reset, connections, etc. stay alive.
 *
 */
xNode.prototype.reset = function() {

  debug('%s: reset', this.identifier);

  // clear persistence
  this.persist = {};

  // clear any input
  this.freeInput();

  // reset status
  // note: also will retrigger the .start thing on nodebox.
  this.status = 'created';

  // reset any internal state.
  this.state = {};

  this.runCount = 0;

};

module.exports = xNode;

},{"./connector":9,"./node/interface":17,"./packet":19,"./port":20,"./port/filler":21,"./sandbox/node":25,"./sandbox/port":26,"debug":37,"util":6}],17:[function(require,module,exports){
'use strict';

/* jshint -W040 */

var EventEmitter = require('events').EventEmitter;
var util = require('util');
var X = require('chix-chi');
var Port = require('../port');
var Packet = require('../packet');
var validate = require('../validate');
var Connections = require('../ConnectionMap');
var debug = require('debug')('chix:inode');

function INode(id, node, identifier, CHI) {

  if (!(this instanceof INode)) {
    return new INode(id, node, identifier, CHI);
  }

  this.pid = null;

  this.provider = node.provider;

  /**
   * @member {String} status
   * @public
   */
  this.status = 'unknown';

  /**
   * @member {String} id
   * @public
   */
  this.id = id;

  /**
   * @member {String} name
   * @public
   */
  this.name = node.name;

  /**
   * @member {String} ns
   * @public
   */
  this.ns = node.ns;

  /**
   * @member {String} title
   * @public
   */
  this.title = node.title;

  /**
   * @member {String} description
   * @public
   */
  this.description = node.description;

  /**
   * @member {Object} metadata
   * @public
   */
  this.metadata = node.metadata || {};

  /**
   * @member {String} identifier
   * @public
   */
  this.identifier = identifier || node.ns + ':' + node.name;

  if (!node.hasOwnProperty('ports')) {
    throw Error('INodeDefinition does not declare any ports');
  }

  if (!node.ports.output) {
    node.ports.output = {};
  }

  if (!node.ports.input) {
    node.ports.input = {};
  }

  if (CHI && CHI.constructor.name !== 'CHI') {
    throw Error('CHI should be instance of CHI');
  }

  this.CHI = CHI || new X();

  // let the node `interface` instantiate all port objects.
  // each extended will already have port object setup.

  /**
   *
   * Ports which are opened by openPort.
   *
   * The Actor opens each port when it connects to it.
   *
   * Also for IIPs the port will have to be opened first.
   *
   * @private
   **/
  this.openPorts = [];

  /**
   *
   * Will keep a list of connections to each port.
   *
   */
  this._connections = new Connections();

  /** @member {Object} ports */
  this.ports = this._clonePorts(node.ports);

  // how many times this node has run
  /** @member {Numeric} runCount */
  this.runCount = 0;

  // how many times this node gave port output
  /** @member {Numeric} outputCount */
  this.outputCount = 0;

  /** @member {Array} inPorts */
  Object.defineProperty(this, 'inPorts', {
    enumerable: true,
    get: function() {
      return Object.keys(this.ports.input);
    }
  });

  /** @member {Array} outPorts */
  Object.defineProperty(this, 'outPorts', {
    enumerable: true,
    get: function() {
      return Object.keys(this.ports.output);
    }
  });

  /** @member {Numeric} filled */
  Object.defineProperty(this, 'filled', {
    enumerable: true,
    configurable: false,
    get: function() {
      return Object.keys(this.input).length;
    }
  });

  // Always add complete port, :start port will be added
  // dynamicaly
  this.ports.output[':complete'] = {
    type: 'any'
  };

  var key;
  // TODO: should just be proper port objects.
  for (key in this.ports.input) {
    if (this.ports.input.hasOwnProperty(key)) {
      this.ports.input[key].fills = 0;
      this.ports.input[key].rejects = 0;
    }
  }

  for (key in this.ports.output) {
    if (this.ports.output.hasOwnProperty(key)) {
      this.ports.output[key].fills = 0;
    }
  }

}

util.inherits(INode, EventEmitter);

/**
 *
 * Create a Node
 *
 * @api public
 */
INode.create = function(id, def, identifier, CHI) {
  return new INode(id, def, identifier, CHI);
};

INode.prototype.getPid = function() {
  return this.pid;
};

INode.prototype._clonePorts = function(ports) {
  var type;
  var port;
  var copy = JSON.parse(JSON.stringify(ports));

  // keep fn in tact.
  // all same `instances` share this function.
  for (type in ports) {
    if (ports.hasOwnProperty(type)) {
      for (port in ports[type]) {
        if (ports[type].hasOwnProperty(port)) {
          if (ports[type][port].fn) {
            copy[type][port].fn = ports[type][port].fn;
            this.async = true; // TODO: remove the need of this flagging.
          }
        }
      }
    }
  }

  return copy;
};

/**
 *
 * @param {type} pid
 * @public
 */
INode.prototype.setPid = function(pid) {
  this.pid = pid;
};

/**
 *
 * Set Title
 *
 * Used to set the title of a node *within* a graph.
 * This property overwrites the setting of the node definition
 * and is returned during toJSON()
 *
 * @param {string} title
 * @public
 */
INode.prototype.setTitle = function(title) {
  this.title = title;
};

/**
 *
 * Set Description
 *
 * Used to set the description of a node *within* a graph.
 * This property overwrites the setting of the node definition
 * and is returned during toJSON()
 *
 * @param {string} description
 * @public
 */
INode.prototype.setDescription = function(description) {
  this.description = description;
};

/**
 *
 * Set metadata
 *
 * Currently:
 *
 *   x: x position hint for display
 *   y: y position hint for display
 *
 * These values are returned during toJSON()
 *
 * @param {object} metadata
 * @public
 */
INode.prototype.setMetadata = function(metadata) {
  for (var k in metadata) {
    if (metadata.hasOwnProperty(k)) {
      this.setMeta(k, metadata[k]);
    }
  }
};

/**
 *
 * Returns the node representation to be stored along
 * with the graph.
 *
 * This is not the full definition of the node itself.
 *
 * The full definition can be found using the ns/name pair
 * along with the provider property.
 *
 */
INode.prototype.toJSON = function() {

  var self = this;

  var json = {
    id: this.id,
    ns: this.ns,
    name: this.name
  };

  [
    'title',
    'description',
    'metadata',
    'provider'
  ].forEach(function(prop) {
    if (self[prop]) {
      if (typeof self[prop] !== 'object' ||
        Object.keys(self[prop]).length > 0) {
        json[prop] = self[prop];
      }
    }
  });

  return json;

};

/**
 *
 * @returns {Object}
 * @public
 */

INode.prototype.report = function() {

  return {
    id: this.id,
    identifier: this.identifier,
    title: this.title,
    filled: this.filled,
    runCount: this.runCount,
    outputCount: this.outputCount,
    status: this.status,
    input: this._filteredInput(),
    context: this.context,
    ports: this.ports,
    state: this.state,
    openPorts: this.openPorts,
    connections: this._connections.toJSON()
  };

};

/**
 *
 * @param {string} key
 * @param {any} value
 */
INode.prototype.setMeta = function(key, value) {
  this.metadata[key] = value;
};

/**
 *
 * Set node status.
 *
 * This is unused at the moment.
 *
 * Should probably contain states like:
 *
 *  - Hold
 *  - Complete
 *  - Ready
 *  - Error
 *  - Timeout
 *  - etc.
 *
 * Maybe something like Idle could also be implemented.
 * This would probably only make sense if there are persistent ports
 * which hold a reference to an instance upon which we can call methods.
 *
 * Such an `idle` state would indicate the node is ready to accept new
 * input.
 *
 * @param {String} status
 * @private
 */
INode.prototype.setStatus = function(status) {

  this.status = status;

  /**
   * Status Update Event.
   *
   * Fired multiple times on output
   *
   * Once for every output port.
   *
   * @event INode#statusUpdate
   * @type {object}
   * @property {object} node - An export of this node
   * @property {string} status - The status
   */
  this.event(':statusUpdate', {
    node: this.export(),
    status: this.status
  });

};

/**
 *
 * Get the current node status.
 *
 * This is unused at the moment.
 *
 * @public
 */
INode.prototype.getStatus = function() {

  return this.status;

};

INode.prototype.getParent = function() {
  return this.parent;
};

INode.prototype.setParent = function(node) {
  this.parent = node;
};

INode.prototype.hasParent = function() {
  return !!this.parent;
};

INode.events = [
  ':closePort',
  ':contextUpdate',
  ':contextClear',
  ':complete',
  ':error',
  ':executed',
  ':expose',
  ':fillCore',
  ':freePort',
  ':index',
  ':inputTimeout',
  ':inputValidated',
  ':nodeTimeout',
  ':openPort',
  ':output',
  ':plug',
  ':unplug',
  ':portFill',
  ':portReject',
  ':require',
  ':statusUpdate',
  ':start',
  ':shutdown'
];

/**
 *
 * @param {string} port
 * @param {Mixed} data
 * @private
 */
INode.prototype._handleFunctionType = function(port, data) {
  var portObj = this.getPort('input', port);
  // convert function if it's not already a function
  if (portObj.type === 'function' &&
    typeof data === 'string') {
    // args, can be used as a hint for named parms
    // if there are no arg names defined, use arguments
    var args = portObj.args ? portObj.args : [];
    data = new Function(args, data);
  }

  return data;
};

/**
 *
 * Fills the port.
 *
 * Does the same as fillPort, however it also checks:
 *
 *   - port availability
 *   - port settings
 *
 * FIXME: fill & fillPort can just be merged probably.
 *
 * @param {Object} target
 * @public
 */
INode.prototype.handleLinkSettings = function(target) {

  // FIX: hold is not handled anywhere as setting anymore
  if (target.has('hold')) {
    this.hold();
  }
  else if (target.has('persist')) {
    // FIX ME: has become a weird construction now
    //
    // THIS IS NOW BROKEN, on purpose.. :-)
    var index = target.get('index');

    // specialized case, make this more clear.
    // persist can be a boolean, or it becomes an array of
    // indexes to persist.
    if (index) {
      if (!Array.isArray(this.ports.input[target.port].persist)) {
        this.ports.input[target.port].persist = [];
      }
      this.ports.input[target.port].persist.push(index);
    }
    else {
      this.ports.input[target.port].persist = true;
    }
  }
};

INode.prototype._receive = function(target, p) {

  if (this.status === 'error') {
    return new Error('Port fill refused process is in error state');
  }

  if (!this.portExists('input', target.port)) {

    return new Error(util.format(
      'Process %s has no input port named `%s`\n\n' +
      '\tInput ports available:\n\n\t%s',
      this.identifier,
      target.port,
      this._portsAvailable()
    ));

  }

  if (!this.portIsOpen(target.port)) {
    return Error(util.format(
      'Trying to send to a closed port open it first: %s',
      target.port
    ));
  }

  // should probably moved somewhere later
  this.handleLinkSettings(target);

  var type = this.ports.input[target.port].type;

  if (type === 'array' && target.has('index')) {
    return this._handleArrayPort(target, p);
  }

  if (type === 'object' && target.has('index')) {
    return this._handleObjectPort(target, p);
  }

  // queue manager could just act on the false return
  // instead of checking inputPortAvailable by itself
  var ret = this.inputPortAvailable(target);
  if (!ret || util.isError(ret)) {

    /**
     * Port Reject Event.
     *
     * Fired when input on a port is rejected.
     *
     * @event INode#portReject
     * @type {object}
     * @property {object} node - An export of this node
     * @property {string} port - Name of the port this rejection occured
     */
    this.event(':portReject', {
      node: this.export(),
      port: target.port,
      data: p
    });

    return ret;

  }
  else {

    ret = this._fillPort(target, p);
    return ret;

  }

};

/**
 *
 * Handles an Array port
 *
 * [0,1,2]
 *
 * When sending IIPs the following can also happen:
 * [undefined, undefined, 2]
 * IIPs in this way must be send as a group.
 * That group will be added in reverse order.
 * This way 2 will create an array of length 3
 * This is important because we will check the length
 * whether we are ready to go.
 *
 * If 0 was added first, the length will be 1 and
 * it seems like we are ready to go, then 1 comes
 * and finds the process is already running..
 *
 * [undefined, undefined, 2]
 *
 * Connections:
 * [undefined, undefined, 2]
 *
 * @param {Connector} target
 * @param {Packet} p
 * @private
 */
INode.prototype._handleArrayPort = function(target, p) {

  // start building the array.
  if (target.has('index')) {

    // Marked the port as being indexed
    this.ports.input[target.port].indexed = true;

    // we have an index.
    // ok, one problem, with async, this.input
    // is never really filled...
    // look at that, will cause dangling data.
    if (!this.input[target.port]) {
      this.input[target.port] = [];
    }

    if (typeof this.input[target.port][target.get('index')] !== 'undefined') {
      // input not available, it will be queued.
      // (queue manager also stores [])
      return Port.INDEX_NOT_AVAILABLE;
    }
    else {

      this.event(':index', {
        node: this.export(),
        port: target.port,
        index: target.get('index')
      });

      this.input[target.port][target.get('index')] = p.data;
    }

    // it should at least be our length
    if (this._arrayPortIsFilled(target.port)) {

      // packet writing, CHECK THIS.
      p.data = this.input[target.port]; // the array we've created.

      // Unmark the port as being indexed
      delete this.ports.input[target.port].indexed;

      // ok, above all return true or false
      // this one is either returning true or an error.
      return this._fillPort(target, p);

    }
    else {

      // input length less than known connections length.
      return Port.AWAITING_INDEX;
    }

  }
  else {

    throw Error(util.format(
      '%s: `%s` value arriving at Array port `%s`, but no index[] is set',
      this.identifier,
      typeof p.data,
      target.port
    ));

  }
};

/**
 *
 * Handles an Object port
 *
 * @param {String} port
 * @param {Object} data
 * @param {Object} chi
 * @param {Object} source
 * @private
 */
// todo, the name of the variable should be target not source.
// source is only handled during output.
INode.prototype._handleObjectPort = function(target, p) {

  // start building the array.
  if (target.has('index')) {

    // we have a key.

    // Marked the port as being indexed
    this.ports.input[target.port].indexed = true;

    // Initialize empty object
    if (!this.input[target.port]) {
      this.input[target.port] = {};
    }

    // input not available, it will be queued.
    // (queue manager also stores [])
    if (typeof this.input[target.port][target.get('index')] !== 'undefined') {
      return false;
    }
    else {

      this.event(':index', {
        node: this.export(),
        port: target.port,
        index: target.get('index')
      });

      // define the key
      this.input[target.port][target.get('index')] = p.data;
    }

    // it should at least be our length
    //
    // Bug:
    //
    // This check is not executed when another port triggers
    // execution. the input object is filled, so it will
    // start anyway.
    //
    if (this._objectPortIsFilled(target.port)) {

      // PACKET WRITING CHECK THIS.
      p.data = this.input[target.port];

      // Unmark the port as being indexed
      delete this.ports.input[target.port].indexed;

      return this._fillPort(target, p);

    }
    else {
      // input length less than known connections length.
      return Port.AWAITING_INDEX;
    }

  }
  else {

    throw Error(util.format(
      '%s: `%s` value arriving at Object port `%s`, but no index[] is set',
      this.identifier,
      typeof p.data,
      target.port
    ));

  }
};

/**
 *
 * @param {string} port
 * @private
 */
INode.prototype._arrayPortIsFilled = function(port) {

  // Not even initialized
  if (typeof this.input[port] === undefined) {
    return false;
  }

  if (this.input[port].length < this._connections[port].length) {
    return false;
  }

  // Make sure we do not have undefined (unfulfilled ports)
  // (Should not really happen)
  for (var i = 0; i < this.input[port].length; i++) {
    if (this.input[port][i] === undefined) {
      return false;
    }
  }

  // Extra check for weird condition
  if (this.input[port].length > this._connections[port].length) {

    this.error(util.format(
      '%s: Array length out-of-bounds for port',
      this.identifier,
      port
    ));

    return false;

  }

  return true;

};

/**
 *
 * @param {string} port
 * @private
 */
INode.prototype._objectPortIsFilled = function(port) {

  // Not even initialized
  if (typeof this.input[port] === undefined) {
    return false;
  }

  // Not all connections have provided input yet
  if (Object.keys(this.input[port]).length < this._connections[port].length) {
    return false;
  }

  // Make sure we do not have undefined (unfulfilled ports)
  // (Should not really happen)
  for (var key in this.input[port]) {
    if (this.input[port][key] === undefined) {
      return false;
    }
  }

  // Extra check for weird condition
  if (Object.keys(this.input[port]).length > this._connections[port].length) {

    this.error(util.format(
      '%s: Object keys length out-of-bounds for port `%s`',
      this.identifier,
      port
    ));

    return false;

  }

  return true;

};

/**
 *
 * @param {string} port
 * @param {Mixed} data
 * @private
 */
INode.prototype._validateInput = function(port, data) {

  if (!this.ports.input.hasOwnProperty(port)) {

    var msg = Error(util.format('no such port: **%s**', port));

    return Error(msg);
  }

  if (!validate.data(this.ports.input[port].type, data)) {

    // TODO: emit these errors, with error constants
    var expected = this.ports.input[port].type;
    var real = Object.prototype.toString.call(data).match(/\s(\w+)/)[1];

    if (data && typeof data === 'object' &&
      data.constructor.name === 'Object') {
      var tmp = Object.getPrototypeOf(data).constructor.name;

      if (tmp) {
        // not sure, sometimes there is no name?
        // in witch case all you can do is type your name as being an 'object'
        real = tmp;
      }
    }

    return Error(util.format(
      'Expected `%s` got `%s` on port `%s`',
      expected, real, port));
  }

  /**
   * Input Validated Event.
   *
   * Occurs when a port was succesfully validated
   *
   * @event INode#inputValidated
   * @type {object}
   * @property {object} node - An export of this node
   * @property {string} port - Name of the port
   */
  this.event(':inputValidated', {
    node: this.export(),
    port: port
  });

  return true;
};

INode.prototype.sendPortOutput = function(port, output, chi) {

  if (!chi) {
    chi = {};
  }

  this.CHI.merge(chi, this.chi, false);

  if (output === undefined) {
    throw Error(
      util.format(
        '%s: Undefined output is not allowed `%s`', this.identifier, port
      )
    );
  }

  if (port === 'error' && output === null) {

    // allow nodes to send null error, but don't trigger it as output.

  }
  else {

    if (this.ports.output.hasOwnProperty(port) ||
      INode.events.indexOf(port) !== -1 // system events
    ) {

      if (this.ports.output.hasOwnProperty(port)) {
        this.ports.output[port].fills++;
        this.outputCount++;
      }

      // so basically all output is a new packet.
      // with chi sustained or enriched.
      var p = new Packet(output);
      p.set('chi', chi);

      debug('%s:%s output', this.identifier, port);

      this.emit('output', {
        node: this.export(),
        port: port,
        out: p
      });

    }
    else {
      throw Error(this.identifier + ': no such output port ' + port);
    }

  }

};

/**
 *
 * Validate a single value
 *
 * TODO: Object (and function) validation could be expanded
 * to match an expected object structure, this information
 * is already available.
 *
 * @param {String} type
 * @param {Object} data
 * @private
 */

/**
 *
 * Does both send events through output ports
 * and emits them.
 *
 * Not sure whether sending the chi is really necessary..
 *
 * @param {string} eventName
 * @param {Packet} p
 * @protected
 */
INode.prototype.event = function(eventName, p) {

  // event ports are prefixed with `:`
  this.sendPortOutput(eventName, p);

};

/**
 *
 * Could be used to externally set a node into error state
 *
 * INode.error(node, Error('you are bad');
 *
 * @param {Error} err
 * @returns {Error}
 */
INode.prototype.error = function(err) {

  var error = util.isError(err) ? err : Error(err);

  // Update our own status
  this.setStatus('error');

  // TODO: better to have full (custom) error objects
  var eobj = {
    //node: node.export(),
    node: this, // do not export so soon.
    msg: err
  };

  // Used for in graph sending
  this.event(':error', eobj);

  // Used by Process Manager or whoever handles the node
  this.emit('error', eobj);

  return error;
};

/**
 *
 * Add context.
 *
 * Must be set in one go.
 *
 * @param {Object} context
 * @public
 */
INode.prototype.addContext = function(context) {
  var port;
  for (port in context) {
    if (context.hasOwnProperty(port)) {
      this.setContextProperty(port, context[port]);
    }
  }
};

/**
 *
 * Do a lightweight export of this node.
 *
 * Used in emit's to give node information
 *
 *
 * @return {Object}
 * @public
 */
INode.prototype.export = function() {

  return {

    id: this.id,
    ns: this.ns,
    name: this.name,
    title: this.title,
    pid: this.pid,
    identifier: this.identifier,
    ports: this.ports,
    cycles: this.cycles,
    inPorts: this.inPorts,
    outPorts: this.outPorts,
    filled: this.filled,
    context: this.context,
    require: this.require,
    status: this.status,
    runCount: this.runCount,
    expose: this.expose,
    active: this.active,
    metadata: this.metadata,
    provider: this.provider,
    input: this._filteredInput(),
    openPorts: this.openPorts,
    nodeTimeout: this.nodeTimeout,
    inputTimeout: this.inputTimeout
  };

};

/**
 *
 * Set context to a port.
 *
 * Can be changed during runtime, but will never trigger
 * a start.
 *
 * Adding the whole context in one go could trigger a start.
 *
 * Packet wise thise content is anonymous.
 *
 * @param {String} port
 * @param {Mixed} data
 * @fires INode#contextUpdate
 * @private
 */
INode.prototype.setContextProperty = function(port, data) {

  if (port === ':start') {
    this.initStartPort();
  }

  var res = this._validateInput(port, data);

  if (util.isError(res)) {

    this.event(':error', {
      node: this.export(),
      msg: Error('setContextProperty: ' + res.message)
    });

  }
  else {

    data = this._handleFunctionType(port, data);

    this.$setContextProperty(port, data);

    this.event(':contextUpdate', {
      node: this,
      port: port,
      data: data
    });

  }
};

INode.prototype.setContext = INode.prototype.setContextProperty;

/**
 *
 * Filters the input for export.
 *
 * Leaving out everything defined as a function
 *
 * Note: depends on the stage of emit whether this value contains anything
 *
 * @return {Object} Filtered Input
 * @private
 */
INode.prototype._filteredInput = function() {
  var port;
  var type;
  var input = {};

  for (port in this.input) {
    if (this.portExists('input', port)) {
      type = this.ports.input[port].type;

      if (type === 'string' ||
        type === 'number' ||
        type === 'enum' ||
        type === 'boolean') {
        input[port] = this.input[port];
      }
      else {
        // can't think of anything better right now
        input[port] = Object.prototype.toString.call(this.input[port]);
      }

    }
    else {

      // faulty but used during export so we want to know
      input[port] = this.input[port];

    }
  }

  return input;
};

// TODO: these port function only make sense for a graph
//       or a dynamic node.

INode.prototype.addPort = function(type, port, def) {
  if (!this.portExists(type, port)) {
    this.ports[type][port] = def;
    return true;
  }
  else {
    return Error('Port already exists');
  }
};

INode.prototype.removePort = function(type, port) {
  if (this.portExists(type, port)) {
    delete this.ports[type][port];
    if (type === 'input') {
      this.clearInput(port);
      this.clearContextProperty(port);
      return true;
    }
  }
  else {
    //return Error(this, 'No such port');
    return Error('No such port');
  }
};

INode.prototype.renamePort = function(type, from, to) {
  if (this.portExists(type, from)) {
    this.ports[type][to] = this.ports[type][from];
    delete this.ports[type][from];
    return true;
  }
  else {
    //return Error(this, 'No such port');
    return Error('No such port');
  }
};

INode.prototype.getPort = function(type, name) {
  if (this.ports.hasOwnProperty(type) &&
    this.ports[type].hasOwnProperty(name)) {
    return this.ports[type][name];
  }
  else {
    throw new Error('Port `' + name + '` does not exist');
  }
};

INode.prototype.getPortOption = function(type, name, opt) {
  var port = this.getPort(type, name);
  if (port.hasOwnProperty(opt)) {
    return port[opt];
  }
  else {
    return undefined;
  }
};

INode.prototype.portExists = function(type, port) {
  return (this.ports[type] && this.ports[type].hasOwnProperty(port)) ||
    (type === 'output' && INode.events.indexOf(port) >= 0);
};

/**
 *
 *
 * @param {String} port
 * @public
 */
INode.prototype.openPort = function(port) {

  if (this.portExists('input', port)) {

    if (this.openPorts.indexOf(port) === -1) {

      this.openPorts.push(port);

      this.event(':openPort', {
        node: this.export(),
        port: port,
        connections: this._connections.hasOwnProperty(port) ?
          this._connections[port].length : // enough info for now
          0 // set by context
      });

    }

    // opening twice is allowed.
    return true;

  }
  else {

    // TODO: make these error codes, used many times, etc.
    return Error(util.format('no such port: **%s**', port));

  }

};

/**
 *
 * @param {string} port
 * @returns {Boolean}
 */
INode.prototype.closePort = function(port) {

  if (this.portExists('input', port)) {

    this.openPorts.splice(this.openPorts.indexOf(port), 1);

    this.event(':closePort', {
      node: this.export(),
      port: port
    });

    return true;

  }
  else {

    // TODO: make these error codes, used many times, etc.
    //return Error(this, util.format('no such port: **%s**', port));
    return Error(util.format('no such port: **%s**', port));

  }

};

/**
 * Whether a port is currently opened
 *
 * @param {String} port
 * @return {Boolean}
 * @private
 */
INode.prototype.portIsOpen = function(port) {
  return this.openPorts.indexOf(port) >= 0;
};

/**
 *
 * Checks whether the input port is available
 *
 * @param {Connector}  target
 * @public
 */
INode.prototype.inputPortAvailable = function(target) {

  if (target.has('index')) {

    if (this.ports.input[target.port].type !== 'array' &&
      this.ports.input[target.port].type !== 'object') {

      return Error([
        this.identifier,
        'Unexpected Index[] information on non array port:',
        target.port
      ].join(' '));
    }

    // not defined yet
    if (!this.input.hasOwnProperty(target.port)) {
      return Port.AVAILABLE;
    }

    // only available if [] is not already filled.
    if (this.input[target.port][target.get('index')] !== undefined) {
      return Port.INDEX_NOT_AVAILABLE;
    }

    if (this.input.length === this._connections[target.port].length) {
      return Port.ARRAY_PORT_FULL;
    }

    return Port.INDEX_AVAILABLE;

  }

  var ret = !this.$portIsFilled(target.port) ?
    Port.AVAILABLE : Port.UNAVAILABLE;
  return ret;

};

/**
 *
 * @param {Connector} target
 * @returns {Boolean}
 * @public
 */
INode.prototype.plug = function(target) {

  if (target.port === ':start') {
    this._initStartPort();
  }

  if (this.portExists('input', target.port)) {

    if (!this._connections[target.port]) {
      this._connections[target.port] = [];
    }

    // direct node fill does not have it.
    if (target.wire) {
      this._connections[target.port].push(target.wire);
    }

    this.event(':plug', {
      node: this.export(),
      port: target.port,
      connections: this._connections[target.port].length
    });

    this.openPort(target.port);

    return true;

  }
  else {

    // problem of whoever tries to attach
    return Error(util.format(
      'Process `%s` has no input port named `%s`\n\n\t' +
      'Input ports available: %s\n\n\t',
      this.identifier,
      target.port,
      this._portsAvailable()
    ));

  }

};

INode.prototype._portsAvailable = function() {
  var ports = [];
  var self = this;
  Object.keys(this.ports.input).forEach(function(port) {
    if (
      (!self.ports.input[port].hasOwnProperty('required') ||
        self.ports.input[port].required === true) &&
      !self.ports.input[port].hasOwnProperty('default')) {
      ports.push(port + '*');
    }
    else {
      ports.push(port);
    }
  });
  return ports.join(', ');
};

/**
 *
 * Determine whether this node has any connections
 *
 * FIX this.
 *
 * @return {Boolean}
 * @public
 */
INode.prototype.hasConnections = function() {
  //return this.openPorts.length;
  var port;
  for (port in this._connections) {
    if (this._connections[port] &&
      this._connections[port].length) {
      return true;
    }
  }

  return false;
};

/**
 *
 * Unplugs a connection from a port
 *
 * Will decrease the amount of connections to a port.
 *
 * TODO: make sure we remove the exact target
 *       right now it just uses pop()
 *
 * @param {Connector} target
 * @public
 */
INode.prototype.unplug = function(target) {

  if (this.portExists('input', target.port)) {

    // direct node fill does not have it
    if (target.wire) {

      if (!this._connections[target.port] ||
        !this._connections[target.port].length) {
        return this.error('No such connection');
      }

      var pos = this._connections[target.port].indexOf(target.wire);
      if (pos === -1) {
        // problem of whoever tries to unplug it
        //return Error(this, 'Link is not connected to this port');
        return Error('Link is not connected to this port');
      }

      this._connections[target.port].splice(pos, 1);
    }

    this.event(':unplug', {
      node: this.export(),
      port: target.port,
      connections: this._connections[target.port].length
    });

    // ok port should only be closed if there are no connections to it
    if (!this.portHasConnections(target.port)) {
      this.closePort(target.port);
    }

    // if this is the :start port also remove it from inports
    // this port is re-added next time during open port
    // TODO: figure out what happens with multiple connections to a :start port
    // because that's also possible, when true connections are made to it,
    // not iip onces,
    if (target.port === ':start' &&
      target.wire.source.port === ':iip' && // start always has a wire.
      this._connections[target.port].length === 0) {
      this.removePort('input', ':start');
    }

    return true;

  }
  else {

    // :start is dynamic, maybe the throw below is no necessary at all
    // no harm in unplugging something non-existent
    if (target.port !== ':start') {

      // problem of whoever tries to unplug
      return Error(util.format(
        'Process `%s` has no input port named `%s`\n\n\t' +
        'Input ports available: \n\n\t%s',
        this.identifier,
        target.port,
        this._portsAvailable()
      ));

    }

  }

};

INode.prototype.start = function() {
  throw Error('INode needs to implement start()');
};

/**
 *
 * Sets an input port option.
 *
 * The node schema for instance can specifiy whether a port is persistent.
 *
 * At the moment a connection can override these values.
 * It's a way of saying I give you this once so take care of it.
 *
 * @param {string} type
 * @param {string} name
 * @param {string} opt
 * @param {any} value
 * @returns {undefined}
 */
INode.prototype.setPortOption = function(type, name, opt, value) {
  var port = this.getPort(type, name);
  port[opt] = value;
};

INode.prototype.setPortOptions = function(type, options) {
  var opt;
  var port;
  for (port in options) {
    if (options.hasOwnProperty(port)) {
      for (opt in options[port]) {
        if (options[port].hasOwnProperty(opt)) {
          if (options.hasOwnProperty(opt)) {
            this.setPortOption(type, port, opt, options[opt]);
          }
        }
      }
    }
  }
};

// Connection Stuff, should be in the Port object
INode.prototype.portHasConnection = function(port, link) {
  return this._connections[port] && this._connections[port].indexOf(link) >= 0;
};
INode.prototype.portHasConnections = function(port) {
  return !!(this._connections[port] && this._connections[port].length > 0);
};

INode.prototype.portGetConnections = function(port) {
  return this._connections[port] || [];
};

INode.prototype.getConnections = function() {
  return this._connections;
};

module.exports = INode;

},{"../ConnectionMap":7,"../packet":19,"../port":20,"../validate":28,"chix-chi":31,"debug":37,"events":1,"util":6}],18:[function(require,module,exports){
'use strict';

/* global document */

var util = require('util');
var Packet = require('../packet');
var xNode = require('./interface');

/**
 *
 * This whole context, default thing is handled differently here.
 * They only make sense on startup as defaults.
 *
 * Since all they are is attributes.
 *
 * For non attribute input ports context & default make no sense.
 * so are ignored.
 *
 * @param {type} id
 * @param {type} node
 * @param {type} identifier
 * @param {type} CHI
 * @returns {PolymerNode}
 */

function PolymerNode(id, node, identifier, CHI) {

  // not sure where to call this yet.
  PolymerNode.super_.apply(this, arguments);

  var self = this;

  this.id = id;

  this.ns = node.ns;
  this.name = node.name;

  this.type = 'polymer';

  this.identifier = identifier;

  this.chi = {};

  this.CHI = CHI;

  /* wanna use this with a Polymer node? */
  this.input = {};

  var da = this.id.split('');
  da.forEach(function(v, i, arr) {
    if (/[A-Z]/.test(v)) {
      arr.splice(i, 1, (i > 0 ? '-' : '') + v.toLowerCase());
    }
  });

  this.elementId = da.join('');

  // TODO: will I use this.ports?
  // for required, default, type etc I still need it.

  /**
   *
   * Problem here is I use uuid's
   * This can be solved by not generating them.
   *
   **/
  this.wc = document.getElementById(this.elementId);
  if (!this.wc) {
    // automatically create the element
    console.log('creating', this.name);
    this.wc = document.createElement(this.name);
    this.wc.setAttribute('id', this.elementId);
    document.querySelector('body').appendChild(this.wc);
  }

  if (!this.wc) {
    throw Error('Polymer Web Component could not be found');
  }

  // TODO: do some basic check whether this really is a polymer element

  // there should be dynamic stuff for e.g. on-tap
  // Ok it's also clear .fbp graphs become just as nested
  // as the components itself, other wise it will not work.
  // one graph means one component.
  // Also if there are then template variable they need to be described.
  // blargh. :-)
  // Ok but these node definitions are so they are selectable within
  // the .fbp that's kinda solved.
  // I should not try to do to much logic for the UI itself.
  // that's not necessary and undoable.
  // So the best example is chix-configurator and the reason I've
  // created it in the first place.
  /*
  Problem a component is composite, defines properties.

  Graph is composite defines external ports.

  Fbpx Graph !== Composite Webcomponent.

  However I treat the composite component as a node Definition.
  So then I have the problem of the same component.
  representing a nodeDefinion but also a graph.

  Which would almost indicate a webcomponent is always also
  a graph, which could be possible, because a graph is also
  a nodeDefinition in chix.

  err, it is possible, but a bit complex.

  which means a polymerNode is closer to xFlow then to xNode.

  */
  function sendPortOutput(port) {
    return function(ev) {
      self.emit('output', {
        node: self.export(),
        port: port,
        out: new Packet(ev)
      });
    };
  }

  if (Object.keys(node.ports.output).length) {
    for (var port in node.ports.output) {
      if (node.ports.output.hasOwnProperty(port)) {
        this.wc.addEventListener(port, sendPortOutput(port));
      }
    }
  }

  this.status = 'ready';

}

util.inherits(PolymerNode, xNode);

PolymerNode.prototype.start = function() {
  /* nothing to do really */
  return true;
};

/**
 *
 * Must do the same kind of logic as xNode
 * Therefor having Ports at this point would be handy
 * Let's at least start by putting those methods in the `interface`.
 */
PolymerNode.prototype.fill = function(target, p) {

  /* input can be an attribute, or one of our methods */
  if (typeof this.wc[target.port] === 'function') {
    this.wc[target.port](p.data);
  }
  else {
    // must be an attribute
    this.wc.setAttribute(target.port, p.data);
  }

};

PolymerNode.prototype.$portIsFilled = function( /*port*/ ) {
  //return this.input.hasOwnProperty(port);
  return false;
};

/**
 *
 * Holds all input until release is called
 *
 * @public
 */
PolymerNode.prototype.hold = function() {
  this.setStatus('hold');
};

/**
 *
 * Releases the node if it was on hold
 *
 * @public
 */
PolymerNode.prototype.release = function() {

  this.setStatus('ready');

  if (this.__halted) {
    this.__halted = false;
    // not much to do
  }
};

module.exports = PolymerNode;

},{"../packet":19,"./interface":17,"util":6}],19:[function(require,module,exports){
'use strict';

/**
 *
 * A packet wraps the data.
 *
 * Enabling tracking and adding metadata
 *
 * Filters are not really creating new packets.
 * But modify the data.
 *
 * Maybe use getters and setters?
 *
 * var p = new Packet(data);
 *
 * drop(p);
 *
 * Packet containing it's own map of source & target.
 * Could be possible, only what will happen on split.
 *
 */
var nr = 10000000000;
function Packet(data, n, c) {

  this.data = data;
  this.chi = {};
  this.nr = n ? n : nr++;
  this.c = c ? c : 0; // clone version
  this.owner = undefined;

  // probably too much info for a basic packet.
  // this.created_at =
  // this.updated_at =

}

Packet.prototype.read = function() {
  return this.data;
};

Packet.prototype.write = function(data) {
  this.data = data;
};

// clone can only take place on plain object data.

/**
 * Clone the current packet
 *
 * In case of non plain objects it's mostly desired
 * not to clone the data itself, however do create a *new*
 * packet with the other cloned information.
 *
 * To enable this set cloneData to true.
 *
 * @param {Boolean} cloneData Whether or not to clone the data.
 */
Packet.prototype.clone = function(cloneData) {
  var p = new Packet(
    cloneData === undefined ?
    JSON.parse(JSON.stringify(this.data)) :
    this.data,
    this.nr,
    ++this.c
  );
  p.set('chi', JSON.parse(JSON.stringify(this.chi)));
  return p;
};

Packet.prototype.set = function(prop, val) {
  this[prop] = val;
};

Packet.prototype.get = function(prop) {
  return this[prop];
};

Packet.prototype.del = function(prop) {
  delete this[prop];
};

Packet.prototype.has = function(prop) {
  return this.hasOwnProperty(prop);
};

module.exports = Packet;

},{}],20:[function(require,module,exports){
'use strict';

/**
 *
 * Port
 *
 * Distinct between input & output port
 * Most methods are for input ports.
 *
 * @example
 *
 *  var port = new Port();
 *  port.receive(p);
 *  port.receive(p); // rejected
 *  port.read();
 *  port.read();
 *  port.receive(p);
 *
 */
function Port() {

  //if (!(this instanceof Port)) return new Port(options);

  // important to just name it input for refactor.
	// eventually can be renamed to something else.
  //
	// node.input[port] becomes node.getPort(port).input
  //
  this.input = undefined;

  this._open = false;

  // If async the value will pass right through a.k.a. non-blocking
	// If there are multiple async ports, the code implementation
	// consequently must be a state machine.
	// async + sync is still possible. One async port is just one
	// function call and thus not a state machine.
  this.async = false;
  this._connections = [];

}

// Important to make clear for debugging
// during port fill the message comes back.
// these names though are confusing.
// I want these to be like Errors but not errors.

// requeue
Port.INPUT_REVOKED       = false; // removed by a portbox
Port.NOT_FILLED          = false; // ??

// ok there is a mixture of functionality here.
// Port.AVAILABLE for example is just a return code for availability
// and does not indicate whether the port was filled.
/*
  Port.AVAILABLE;
  Port.INDEX_NOT_AVAILABLE;
  Port.ARRAY_PORT_FULL;
  Port.INDEX_AVAILABLE;
 Port.AVAILABLE : Port.UNAVAILABLE;
*/

// success

// used in input port available
Port.AVAILABLE           = true; // non index port was set
Port.UNAVAILABLE         = false; // not an index port but input is already set
Port.INDEX_AVAILABLE     = true; // index was set
Port.INDEX_NOT_AVAILABLE = false; // index already filled
// could be the same as index not available,
// this just tells it's full and will be processed
Port.ARRAY_PORT_FULL     = false;

// index was set, but waiting others to be filled
Port.AWAITING_INDEX      = true;

// this is a weird return code,
// because it's probably not about the filled port itself
Port.CONTEXT_SET         = true;
Port.PERSISTED_SET       = true; // idem
Port.DEFAULT_SET         = true; // idem
Port.NOT_REQUIRED        = true; // idem
Port.FILLED              = true; // port was filled.

/**
 *
 * Used from within a component to receive the port data
 *
 */
Port.prototype.receive = function() {
};

/**
 *
 * Used from within a component to close the port
 *
 * A component receives an open port.
 * When the port closes it's ready to be filled.
 * This also means there are two sides on a port
 * Open for input and open for output to the component.
 *
 */
Port.prototype.close = function() {
  this._open = false;
};

Port.prototype.open = function() {
  this._open = true;
};

// TODO: after refactor these will end up elsewhere
Port.prototype.hasConnection = function(link) {
  return this._connections && this._connections.indexOf(link) >= 0;
};
Port.prototype.hasConnections = function() {
  return this._connections.length > 0;
};

Port.prototype.getConnections = function() {
  return this._connections;
};

// this seems to be a wrong check?
// ah no, no property means not filled.
// but this is just wrong. array port for example is not filled, if it's set.
// it's being taken care of, but only causes more code to be necessary
Port.prototype.isFilled = function() {
  return this.input !== undefined;
};

Port.prototype.clearInput = function() {
  this.input = undefined;
};

Port.prototype.isAvailable = function() {
};

// Node freePort
Port.prototype.free = function() {

  var persist = this.getOption('persist');
  if (persist) {
    // persist, chi, hmz, seeze to exist.
    // but wouldn't matter much, with peristent ports.
    // TODO: this.filled is not used anymore.

    // indexes are persisted per index.
    if (Array.isArray(persist)) {
      for (var k in this.input) {
        if (persist.indexOf(k) === -1) {
          // remove
          delete this.input[k];
        }
      }
    }

  } else {

    // not sure, activeConnections could stay a node thing.

    // this also removes context and default..
    this.clearInput();

    this.event(':freePort', {
      node: this.export(),
      link: this._activeConnections,
      port: this.name
    });

    this.emit('freePort', {
      node: this.export(),
      link: this._activeConnections,
      port: this.name
    });

    // delete reference to active connection (if there was one)
    delete this._activeConnections;
  }

};

//Node.prototype.getPortOption = function(type, name, opt) {

// could become this.setting[opt], but that will change things too much
Port.prototype.getOption = function(opt) {
  if (this.hasOwnProperty(opt)) {
    return this[opt];
  } else {
    return undefined;
  }
};

/**
 *
 * Sets an input port option.
 *
 * The node schema for instance can specifiy whether a port is persistent.
 *
 * At the moment a connection can override these values.
 * It's a way of saying I give you this once so take care of it.
 *
 */
//Node.prototype.setPortOption = function(type, name, opt, value) {
Port.prototype.setOption = function(opt, value) {
  this[opt] = value;
};

//Node.prototype.setPortOptions = function(type, options) {
Port.prototype.setOptions = function(options) {
  var opt;
  var port;
  for (port in options) {
    if (options.hasOwnProperty(port)) {
      for (opt in options[port]) {
        if (options[port].hasOwnProperty(opt)) {
          if (options.hasOwnProperty(opt)) {
            this.setOption(opt, options[opt]);
          }
        }
      }
    }
  }
};

module.exports = Port;

},{}],21:[function(require,module,exports){
'use strict';

var Port = require('../port');
var util = require('util');

var portFill;

module.exports = portFill = exports;

exports.fill = function(ports, input, context, persist) {

  var ret;

  for (var port in ports) {
    if (ports.hasOwnProperty(port)) {
      ret = portFill.defaulter(
        port,
        ports,
        input,
        context,
        persist
      );
      if (util.isError(ret)) {
        return ret;
      }
    }
  }

  return true;

};

exports.check = function(obj, key, input, context, persist) {
  var ret;

  if (obj[key].properties) { //
    var init;

    if (!input[key]) {
      input[key] = {};
      init = true;
    }

    for (var k in obj[key].properties) {
      if (obj[key].properties.hasOwnProperty(k)) {

        ret = !portFill.check(
          obj[key].properties,
          k,
          input[key],
          context ? context[key] : {},
          persist ? persist[key] : {}
        );

        if (!ret) {

          // use this again, just return the value
          // this will have checked the nested schema definitions.
          // return ret;
          /*
                  throw new Error([
                    this.identifier + ': Cannot determine input for property:',
                    key + '[' + k + ']'
                  ].join(' '));
          */
        }
      }
    }

    if (!Object.keys(input[key]).length && init) {
      // remove empty object again
      delete input[key]; // er ref will not work probably.
    }

    // not sure, but at least should be true.
    return Port.FILLED;

  }
  else {

    // check whether input was defined for this port
    if (!input.hasOwnProperty(key)) {

      // This will not really work for persisted indexes
      // or at least it should check whether the array is full after
      // this fill
      if (persist && persist.hasOwnProperty(key)) {
        console.log('GOT PERSIST!', persist[key]);
        // ok this does not work, because persist should only be considered.
        // if it's the last one. which makes the IO manager the only one
        // who can really decided. you might say it's a property of the
        // packet.. which I think would be rather stable.
        // before I did not have a packet, which made it harder.
        // so this means all persist logic can be removed from node.
        input[key] = persist[key];
        return Port.PERSISTED_SET;
      }

      // if there is context, use that.
      if (context && context.hasOwnProperty(key)) {
        input[key] = context[key];
        return Port.CONTEXT_SET;
        // check the existance of default (a value of null is also valid)
      }

      if (obj[key].hasOwnProperty('default')) {
        input[key] = obj[key].default;
        return Port.DEFAULT_SET;
      }

      if (obj[key].required === false) {
        // filled but empty let the node handle it.
        input[key] = null;
        return Port.NOT_REQUIRED;
      }

      return Port.NOT_FILLED;

    }
    else {
      return Port.FILLED;
    }

  }
};

// also fill the defaults one level deep..
/**
 *
 * @param {string} port
 * @private
 */
exports.defaulter = function(port, ports, input, context, persist) {
  if (!portFill.check(
      ports,
      port,
      input,
      context,
      persist
    ) && !ports[port].async) {

    if (port[0] !== ':') {
      return Port.SYNC_PORTS_UNFULFILLED;
      /*
            // fail hard
            return Error(util.format(
              '%s: Cannot determine input for port `%s`',
              this.identifier,
              port
            ));
      */

    }

  }
};

},{"../port":20,"util":6}],22:[function(require,module,exports){
(function (process){
'use strict';

var util = require('util');
var uuid = require('uuid').v4;
var EventEmitter = require('events').EventEmitter;

var onExit = [];
if (process.on) { // old browserify
  process.on('exit', function onExitHandlerProcessManager() {
    onExit.forEach(function(instance) {

      var key;
      var process;
      var report;
      var reports = {};

      for (key in instance.processes) {
        if (instance.processes.hasOwnProperty(key)) {
          process = instance.processes[key];
          if (process.type === 'flow') {
            report = process.report();
            if (!report.ok) {
              reports[key] = report;
            }
          }
        }
      }

      if (Object.keys(reports).length) {
        instance.emit('report', reports);
      }

    });
  });
}

/**
 *
 * Default Process Manager
 *
 * @constructor
 * @public
 *
 */
function ProcessManager() {

  this.processes = {};

  onExit.push(this);

}

util.inherits(ProcessManager, EventEmitter);

ProcessManager.prototype.getMainGraph = function() {
  return this.getMainGraphs().pop();
};

ProcessManager.prototype.getMainGraphs = function() {

  var main = [];
  var key;
  var p;

  for (key in this.processes) {
    if (this.processes.hasOwnProperty(key)) {
      p = this.processes[key];
      if (p.type === 'flow' && !p.hasParent()) {
        main.push(p);
      }
    }
  }

  return main;

};

ProcessManager.prototype.onProcessStartHandler = function(event) {
  this.emit('startProcess', event.node);
};
ProcessManager.prototype.onProcessStopHandler = function(event) {
  this.emit('stopProcess', event.node);
};
ProcessManager.prototype.register = function(node) {

  if (node.pid) {
    throw new Error('Refusing to add node with existing process id');
  }

  var pid = uuid();
  node.setPid(pid);
  this.processes[pid] = node;

  // Note: at the moment only subgraphs emit the start event.
  // and only subgraphs can be stopped, this is good I think.
  // The process manager itself holds *all* nodes.
  // Start is a push on the actor.
  // However, when we start a network we only care about
  // the push on the main actor, not the subgraphs.
  // So this is something to think about when you listen
  // for startProcess.
  // Maybe for single stop and start of nodes the actor should be used
  // and the actor emits the stop & start events, with the node info
  // To stop a node: this.get(graphId).hold(nodeId);
  // Ok you just do not stop single nodes, you hold them.
  // Stop a node and your network is borked.
  this.processes[pid].on('start', this.onProcessStartHandler.bind(this));
  this.processes[pid].on('stop', this.onProcessStopHandler.bind(this));

  // Process manager handles all errors.
  // or in fact, ok we have to add a errorHandler ourselfes also
  // but the process manager will be able to do maintainance?
  node.on('error', this.processErrorHandler.bind(this));

  // pid is in node.pid
  this.emit('addProcess', node);

};

/**
 *
 * Process Error Handler.
 *
 * The only errors we receive come from the nodes themselves.
 * It's also garanteed if we receive an error the process itself
 * Is already within an error state.
 *
 */
ProcessManager.prototype.processErrorHandler = function(event) {

  if (event.node.status !== 'error') {
    console.log('STATUS', event.node.status);
    throw Error('Process is not within error state', event.node.status);
  }

  // Emit it, humans must solve this.
  this.emit('error', event);

};

ProcessManager.prototype.changePid = function(from, to) {

  if (this.processes.hasOwnProperty(from)) {
    this.processes[to] = this.processes[from];
    delete this.processes[from];
  }
  else {
    throw Error('Process id not found');
  }

  this.emit('changePid', {
    from: from,
    to: to
  });

};

// TODO: improve start, stop, hold, release logic..
ProcessManager.prototype.start = function(node) {

  // allow by pid and by node object
  var pid = typeof node === 'object' ? node.pid : node;

  if (this.processes.hasOwnProperty(pid)) {
    if (this.processes[pid].type === 'flow') {
      this.processes[pid].start();
    }
    else {
      this.processes[pid].release();
    }
  }
  else {
    throw Error('Process id not found');
  }
};

ProcessManager.prototype.stop = function(node, cb) {

  // allow by pid and by node object
  var pid = typeof node === 'object' ? node.pid : node;

  if (this.processes.hasOwnProperty(pid)) {
    if (this.processes[pid].type === 'flow') {
      this.processes[pid].stop(cb);
    }
    else {
      this.processes[pid].hold(cb);
    }
  }
  else {
    throw Error('Process id not found');
  }
};

// TODO: just deleting is not enough.
// links also contains the pids
// on remove process those links should also be removed.
ProcessManager.prototype.unregister = function(node, cb) {

  var self = this;

  if (!node.pid) {
    throw new Error('Process id not found');
  }

  function onUnregister(node, cb) {

    /*
    node.removeListener('start', self.onProcessStartHandler);
    node.removeListener('stop', self.onProcessStopHandler);
    node.removeListener('error', self.processErrorHandler);
    */

    node.removeAllListeners('start');
    node.removeAllListeners('stop');
    node.removeAllListeners('error');

    delete self.processes[node.pid];

    // remove pid
    delete node.pid;

    // todo maybe normal nodes should also use stop + cb?
    if (cb) {
      cb(node);
    }

    self.emit('removeProcess', node);

  }

  if (this.processes[node.pid].type === 'flow') {

    // wait for `subnet` to be finished
    self.stop(node, onUnregister.bind(this, node, cb));

  }
  else {

    node.shutdown(onUnregister.bind(this, node, cb));

  }

};

/**
 *
 * Get Process
 * Either by id or it's pid.
 *
 */
ProcessManager.prototype.get = function(pid) {

  return this.processes[pid];

};

/**
 *
 * Using the same subgraph id for processes can work for a while.
 *
 * This method makes it possible to find graphs by id.
 *
 * Will throw an error if there is a process id conflict.
 *
 * If a containing actor is passed as second parameter
 * the uniqueness of the node is garanteed.
 *
 */
ProcessManager.prototype.getById = function(id, actor) {
  return this.findBy('id', id, actor);
};

ProcessManager.prototype.findBy = function(prop, value, actor) {
  var found;
  var process;
  var node;
  for (process in this.processes) {
    if (this.processes.hasOwnProperty(process)) {
      node = this.processes[process];
      if (node[prop] === value &&
        (!actor || actor.hasNode(node.id))) {
        if (found) {
          console.log(this.processes);
          throw Error(
            'conflict: multiple ' + prop + 's matching ' + value
          );
        }
        found = node;
      }
    }
  }
  return found;
};

ProcessManager.prototype.filterByStatus = function(status) {
  return this.filterBy('status', status);
};

ProcessManager.prototype.filterBy = function(prop, value) {

  var id;
  var filtered = [];

  for (id in this.processes) {
    if (this.processes.hasOwnProperty(id)) {
      if (this.processes[id][prop] === value) {
        filtered.push(this.processes[id]);
      }
    }
  }

  return filtered;

};

module.exports = ProcessManager;

}).call(this,require("uojqOp"))
},{"events":1,"uojqOp":4,"util":6,"uuid":49}],23:[function(require,module,exports){
'use strict';

var util = require('util');
var debug = require('debug')('chix:queue');

function Queue() {
  this.lock = false;
  this.queue = [];
  this.pounders = 0;
}

/**
 *
 * Default Queue Manager
 *
 * @constructor
 * @public
 *
 */
function QueueManager(dataHandler) {

  this.queues = {};
  this._shutdown = false;

  this.locks = {}; /* node locks */

  this.pounders = 0; /* cumulative count */

  Object.defineProperty(this, 'inQueue', {
    enumerable: true,
    get: function() {
      // snapshot of queueLength
      var id;
      var inQ = 0;
      for (id in this.queues) {
        if (this.queues.hasOwnProperty(id)) {
          inQ += this.queues[id].queue.length;
        }
      }
      return inQ;
    }
  });

  this.onData(dataHandler);
}

QueueManager.prototype.onData = function(handler) {
  this.sendData = handler;
};

QueueManager.prototype.pounder = function() {

  var self = this.self;
  if (!self.queues.hasOwnProperty(this.id)) {
    throw Error('Unclean shutdown: Pounding on non-exist substance');
  }

  var queue = self.queues[this.id];
  queue.pounders--;
  self.pounders--;

  var inQueue = queue.queue.length;
  if (inQueue === 0) {
    throw Error('nothing in queue this should not happen!');
  }

  var p = self.pick(this.id);

  if (self._shutdown) {

    self.drop('queued', this.id, p);

  }
  else if (self.isLocked(this.id)) {
    self.unshift(this.id, p);

  }
  else {
    debug('%s:%s.%s send data', this.id, p.nr, p.c);
    self.sendData(this.id, p);
  }

};

QueueManager.prototype.getQueue = function(id) {

  if (this.queues.hasOwnProperty(id)) {
    return this.queues[id];
  }

  throw Error(util.format('queue id: `%s` is unmanaged', id));

};

QueueManager.prototype.pound = function(id) {

  if (!id) {
    throw Error('no id!');
  }

  this.getQueue(id).pounders++;
  this.pounders++;

  setTimeout(
    this.pounder.bind({
      id: id,
      self: this
    }), 0
  );

};

QueueManager.prototype.get = function(id) {
  return this.getQueue(id).queue;
};

/**
 *
 * Queue data for the link given
 *
 * @param {string} id
 * @param {Packet} p
 * @public
 */
QueueManager.prototype.queue = function(id, p) {

  if (p.constructor.name !== 'Packet') {
    throw Error('not an instance of Packet');
  }

  if (this._shutdown) {
    this.drop('queue', id, p);
  }
  else {

    this.init(id);
    this.getQueue(id).queue.push(p);

    // as many pounds as there are items within queue.
    // the callback is just picking the last item not per se
    // the item we have just put within queue.
    this.pound(id);

  }

};

QueueManager.prototype.init = function(id) {
  if (!this.queues.hasOwnProperty(id)) {
    this.queues[id] = new Queue();
  }
};

QueueManager.prototype.unshift = function(id, p) {

  var queue = this.getQueue(id);
  queue.queue.unshift(p);

};

/**
 *
 * Pick an item from the queue.
 *
 * @param {id} id
 * @public
 */
QueueManager.prototype.pick = function(id) {
  if (this.hasQueue(id)) {
    return this.queues[id].queue.shift();
  }
};

/**
 *
 * Determine whether there is a queue for this link.
 *
 * @param {string} id
 * @public
 */
QueueManager.prototype.hasQueue = function(id) {
  return this.queues[id] && this.queues[id].queue.length > 0;
};

QueueManager.prototype.isManaged = function(id) {
  return this.queues.hasOwnProperty(id);
};

QueueManager.prototype.size = function(id) {
  return this.getQueue(id).queue.length;
};

/**
 *
 * Reset this queue manager
 *
 * @public
 */
QueueManager.prototype.reset = function(cb) {

  var self = this;
  var retries;
  var countdown;

  this._shutdown = true;

  // all unlocked
  this.unlockAll();

  countdown = retries = 10; // 1000;

  var func = function ShutdownQueManager() {

    if (countdown === 0) {
      debug('Failed to stop queue after %s cycles', retries);
    }

    if (self.inQueue === 0 || countdown === 0) {

      self.queues = {};

      self._shutdown = false;

      if (cb) {
        cb();
      }

    }
    else {

      countdown--;
      setTimeout(func, 0);

    }

  };

  // put ourselves at the back of all unlocks.
  setTimeout(func, 0);

};

QueueManager.prototype.isLocked = function(id) {
  // means whether it has queue length..
  if (!this.isManaged(id)) {
    return false;
  }
  var q = this.getQueue(id);
  return q.lock;
};

QueueManager.prototype.lock = function(id) {
  debug('%s: lock', id);
  this.init(id);
  var q = this.getQueue(id);
  q.lock = true;

};

QueueManager.prototype.flushAll = function() {
  debug('flush all');
  var id;
  for (id in this.queues) {
    if (this.queues.hasOwnProperty(id)) {
      this.flush(id);
    }
  }
};

QueueManager.prototype.purgeAll = function() {
  debug('purge all');
  var id;
  for (id in this.queues) {
    if (this.queues.hasOwnProperty(id)) {
      this.purge(this.queues[id]);
    }
  }
};

QueueManager.prototype.purge = function(q) {
  debug('%s: purge', q.id);
  while (q.queue.length) {
    this.drop('purge', q.queue.pop());
  }
};

QueueManager.prototype.unlockAll = function() {
  debug('unlock all');
  var id;
  for (id in this.queues) {
    if (this.queues.hasOwnProperty(id)) {
      this.unlock(id);
    }
  }
};

QueueManager.prototype.unlock = function(id) {
  debug('%s: unlock', id);
  if (this.isLocked(id)) {
    this.flush(id);
  }
};

QueueManager.prototype.flush = function(id) {

  debug('%s: flush', id);
  var i;
  var q = this.getQueue(id);

  // first determine current length
  var currentLength = (q.queue.length - q.pounders);

  q.lock = false;

  for (i = 0; i < currentLength; i++) {
    this.pound(id);
  }
};

// not sure, maybe make only the ioHandler responsible for this?
QueueManager.prototype.drop = function(type) {
  debug('dropping packet: %s %s', type, this.inQueue);
};

/**
 *
 * Used to get all queues which have queues.
 * Maybe I should just remove queues.
 * But queues reappear so quickly it's not
 * worth removing it.
 *
 * Something to fix later, in that case this.queues
 * would always be queues which have items.
 *
 * Anyway for debugging it's also much easier
 * because there will not be a zillion empty queues.
 *
 * Usage:
 *
 * if (qm.inQueue()) {
 *   var queued = qm.getQueued();
 * }
 *
 */
QueueManager.prototype.getQueues = function() {

  var id;
  var queued = {};
  for (id in this.queues) {
    if (this.queues.hasOwnProperty(id)) {
      if (this.queues[id].queue.length > 0) {
        queued[id] = this.queues[id];
      }
    }
  }
  return queued;
};

module.exports = QueueManager;

},{"debug":37,"util":6}],24:[function(require,module,exports){
'use strict';

var DefaultContextProvider = require('./context/defaultProvider');

/**
 *
 * We will run inside an instance.
 *
 * At the moment the run context is purely the callback.
 * TODO: which fails hard
 *
 */
function Run(actor, callback) {

  var iId;

  this.actor = actor;

  // Used with callback handling
  // Keeps track of the number of exposed output ports
  this.outputPorts = [];

  // data we will give to the callback
  this.output = {};
  this.outputCount = 0;

  this.callback = callback;

  if (!actor.contextProvider) {
    actor.contextProvider = new DefaultContextProvider();
  }

  for (iId in actor.nodes) {
    if (actor.nodes.hasOwnProperty(iId)) {

      // Als deze node in onze view zit
      if (actor.view.indexOf(iId) >= 0) {

        if (
          this.callback &&
          actor.nodes[iId].ports &&
          actor.nodes[iId].ports.output
          ) {

          for (var key in actor.nodes[iId].ports.output) {
            // this is related to actions.
            // not sure If I want to keep that..
            // Anyway expose is gone, so this is never
            // called now.
            //
            // expose bestaat niet meer, de integrerende flow
            // krijgt gewoon de poorten nu.
            if (actor.nodes[iId].ports.output[key].expose) {
              this.outputPorts.push(key);
            }
          }

          actor.nodes[iId].on(
            'output',
            this.handleOutput.bind(this)
          );

        }
      }

    }

  }

  if (this.callback && !this.outputPorts.length) {

    throw new Error('No exposed output ports available for callback');

  }

  if (actor.trigger) {
    actor.sendIIP(actor.trigger, '');
  }

}

Run.prototype.handleOutput = function(data) {

  if (this.outputPorts.indexOf(data.port) >= 0) {

    if (!this.output.hasOwnProperty(data.node.id)) {
      this.output[data.node.id] = {};
    }

    this.output[data.node.id][data.port] = data.out;

    this.outputCount++;

    if (this.outputPorts.length === this.outputCount) {

      this.outputCount = 0; // reset

      this.callback.apply(this.actor, [this.output]);

      this.output = {};

    }

  }

};

module.exports = Run;

},{"./context/defaultProvider":10}],25:[function(require,module,exports){
(function (process,global){
'use strict';

var IOBox = require('iobox');
var util = require('util');
var path = require('path');

// taken from underscore.string.js
function _underscored(str) {
  // also underscore dot
  return str
    .replace(/([a-z\d])([A-Z]+)/g, '$1_$2')
    .replace(/[\.\-\s]+/g, '_')
    .toLowerCase();
}

/**
 *
 * NodeBox
 *
 * @constructor
 * @public
 *
 */
function NodeBox(name) {

  if (!(this instanceof NodeBox)) {
    return new NodeBox(name);
  }

  IOBox.apply(this, arguments);

  this.name = name || 'NodeBox';

  this.define();

}

util.inherits(NodeBox, IOBox);

NodeBox.prototype.define = function() {

  // Define the structure
  this.addArg('input', {});
  this.addArg('output', {});
  this.addArg('state', {});
  this.addArg('done', null);
  this.addArg('cb', null);
  //this.addArg('console', console);

  this.addArg('on', {
    input: {}
  }); // dynamic construction

  // what to return from the function
  this.addReturn('output');
  this.addReturn('state');
  this.addReturn('on');
};

/**
 *
 * Add requires to the sandbox.
 *
 * xNode should use check = true and then have
 * a try catch block.
 *
 * @param {Object} requires
 * @param {Boolean} check
 */
NodeBox.prototype.require = function(requires, check) {

  // Ok, the generic sandbox should do the same logic
  // for adding the requires but should not check if
  // they are available.
  var key;
  var ukey;

  // 'myrequire': '<version'
  for (key in requires) {

    if (requires.hasOwnProperty(key)) {

      // only take last part e.g. chix-flow/SomeThing-> some_thing
      ukey = _underscored(key.split('/').pop());

      this.emit('require', {
        require: key
      });

      if (check !== false) {

        if (typeof requires[key] !== 'string') {

          // assume it's already required.
          // the npm installed versions use this.
          // e.g. nodule-template
          this.addArg(ukey, requires[key]);

        }
        else {

          try {

            this.addArg(ukey, require(key));

          }
          catch (e) {

            // last resort, used by cli
            var p = path.resolve(
              process.cwd(),
              'node_modules',
              key
            );

            this.addArg(ukey, require(p));
          }

        }

      }
      else {

        // just register it, used for generate
        this.addArg(ukey, undefined);

      }
    }
  }
};

NodeBox.prototype.expose = function(expose, CHI) {

  var i;
  // created to allow window to be exposed to a node.
  // only meant to be used for dom nodes.
  var g = typeof window === 'undefined' ? global : window;

  if (expose) {

    for (i = 0; i < expose.length; i++) {

      this.emit('expose', {
        expose: expose[i]
      });

      if (expose[i] === 'window') {
        this.addArg('win', window);
      }
      else if (expose[i] === 'chi') {
        this.addArg('chi', CHI);
      }
      else if (expose[i] === 'self') {
        this.addArg('self', this);
      }
      else {
        // Do not re-expose anything already going in
        if (!this.args.hasOwnProperty(expose[i])) {
          this.addArg(expose[i], g[expose[i]]);
        }
      }
    }

  }
};

NodeBox.prototype.compile = function(fn) {

  return IOBox.prototype.compile.call(
    this, fn, true // return as object
  );

};

/**
 *
 * Runs the sandbox.
 *
 */
NodeBox.prototype.run = function(bind) {

  var k;
  var res = IOBox.prototype.run.apply(this, [bind]);
  var ret;

  // puts the result back into our args/state
  // TODO: I do not think this is needed?

  for (k in res) {
    if (k === 'return') {
      ret = res['return'];
    }
    else if (res.hasOwnProperty(k)) {
      this.set(k, res[k]);
    }
  }
  return ret; // original return value
};

module.exports = NodeBox;

}).call(this,require("uojqOp"),typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"iobox":41,"path":3,"uojqOp":4,"util":6}],26:[function(require,module,exports){
'use strict';

var NodeBox = require('./node');
var util = require('util');

/**
 *
 * PortBox
 *
 * @constructor
 * @public
 *
 */
function PortBox(name) {

  if (!(this instanceof PortBox)) {
    return new PortBox(name);
  }

  NodeBox.apply(this, arguments);

  this.name = name || 'PortBox';

}

util.inherits(PortBox, NodeBox);

PortBox.prototype.define = function() {
  // Define the structure
  this.addArg('data', null);
  this.addArg('x', {}); // not sure, _is_ used but set later
  this.addArg('source', null); // not sure..
  this.addArg('state', {});
  this.addArg('input', {});
  this.addArg('output', null); // output function should be set manually

  // what to return from the function.
  this.addReturn('state');
};

module.exports = PortBox;

},{"./node":25,"util":6}],27:[function(require,module,exports){
'use strict';

var util = require('util');
var EventEmitter = require('events').EventEmitter;

/**
 *
 * Setting
 *
 * Both used by Connector and xLink
 *
 * @constructor
 * @public
 *
 */
function Setting(settings) {

  for (var key in settings) {
    if (settings.hasOwnProperty(key)) {
      this.set(key, settings[key]);
    }
  }
}

util.inherits(Setting, EventEmitter);

/**
 *
 * Set
 *
 * Sets a setting
 *
 * @param {String} name
 * @param {Any} val
 */
Setting.prototype.set = function(name, val) {
  if (undefined !== val) {
    if (!this.setting) {
      this.setting = {};
    }
    this.setting[name] = val;

    this.emit('change', this, 'setting', this.setting);
  }
};

/**
 *
 * Get
 *
 * Returns the setting or undefined.
 *
 * @returns {Any}
 */
Setting.prototype.get = function(name) {
  return this.setting ? this.setting[name] : undefined;
};

/**
 *
 * Delete a setting
 *
 * @returns {Any}
 */
Setting.prototype.del = function(name) {
  if (this.setting && this.setting.hasOwnProperty(name)) {
    delete this.setting[name];
  }
};

/**
 *
 * Check whether a setting is set.
 *
 * @returns {Any}
 */
Setting.prototype.has = function(name) {
  return this.setting && this.setting.hasOwnProperty(name);
};

module.exports = Setting;

},{"events":1,"util":6}],28:[function(require,module,exports){
'use strict';

var jsongate = require('json-gate');
var mSjson = require('../schemas/map.json');
var nDjson = require('../schemas/node.json');
var ljson = require('../schemas/link.json');
var mapSchema = jsongate.createSchema(mSjson);
var nodeSchema = jsongate.createSchema(nDjson);
var linkSchema = jsongate.createSchema(ljson);
var isPlainObject = require('is-plain-object');
var instanceOf = require('instance-of');

function ValidationError(message, id, obj) {
  this.message = message;
  this.id = id;
  this.obj = obj;
  this.name = 'ValidationError';
}

/**
 *
 * Check if we are not adding a (rotten) flow. Where there are id's which
 * overlap other ids in other flows.
 *
 * This shouldn't happen but just perform this check always.
 *
 */
function _checkIds(flow, nodeDefinitions) {

  var i;
  var knownIds = [];
  var nodes = {};
  var node;
  var link;
  var source;
  var target;

  if (flow.nodes.length > 0 && !nodeDefinitions) {
    throw new Error('Cannot validate without nodeDefinitions');
  }

  // we will not add the flow, we will show a warning and stop adding the
  // flow.
  for (i = 0; i < flow.nodes.length; i++) {

    node = flow.nodes[i];

    // nodeDefinition should be loaded
    if (!node.ns) {
      throw new ValidationError(
          'NodeDefinition without namespace: ' + node.name
          );
    }
    if (!nodeDefinitions[node.ns]) {
      throw new ValidationError(
          'Cannot find nodeDefinition namespace: ' + node.ns
          );
    }
    if (!nodeDefinitions[node.ns][node.name]) {
      throw new ValidationError(
          'Cannot find nodeDefinition name ' + node.ns + ' ' + node.name
          );
    }

    knownIds.push(node.id);
    nodes[node.id] = node;

    //_checkPortDefinitions(nodeDefinitions[node.ns][node.name]);
  }

  for (i = 0; i < flow.links.length; i++) {

    link = flow.links[i];

    // links should not point to non-existing nodes.
    if (knownIds.indexOf(link.source.id) === -1) {
      throw new ValidationError(
        'Source node does not exist ' + link.source.id
      );
    }
    if (knownIds.indexOf(link.target.id) === -1) {
      throw new ValidationError(
        'Target node does not exist ' + link.target.id
      );
    }

    // check if what is specified as port.out is an input port on the target
    source = nodes[link.source.id];
    target = nodes[link.target.id];

    // allow :start
    if (link.source.port[0] !== ':' &&
        !nodeDefinitions[source.ns][source.name]
        .ports.output[link.source.port]) {
      throw new ValidationError([
          'Process',
          link.source.id,
          'has no output port named',
          link.source.port,
          '\n\n\tOutput ports available:',
          '\n\n\t',
          Object.keys(
            nodeDefinitions[source.ns][source.name].ports.output
            ).join(', ')
          ].join(' '));
    }

    if (link.target.port[0] !== ':' &&
        !nodeDefinitions[target.ns][target.name]
        .ports.input[link.target.port]) {
      throw new ValidationError([
          'Process',
          link.target.id,
          'has no input port named',
          link.target.port,
          '\n\n\tInput ports available:',
          '\n\n\t',
          Object.keys(
            nodeDefinitions[target.ns][target.name].ports.input
            ).join(', ')
          ].join(' '));
    }

  }

  return true;

}

/**
 *
 * Validates a nodeDefinition
 *
 */
function validateNodeDefinition(nodeDef) {

  nodeSchema.validate(nodeDef);

  // _checkIds(flow, nodeDefinitions);

  // make sure the id's are correct

}

function validateLink(ln) {
  linkSchema.validate(ln);
}

/**
 *
 * Validates the flow
 *
 */
function validateFlow(flow) {

  mapSchema.validate(flow);

  // _checkIds(flow, nodeDefinitions);

  // make sure the id's are correct

}

function validateData(type, data) {

  switch (type) {

    case 'string':
      return typeof data === 'string';

    case 'array':
      return Object.prototype.toString.call(data) === '[object Array]';

    case 'integer':
    case 'number':
      return Object.prototype.toString.call(data) === '[object Number]';

    case 'null':
      type = type.charAt(0).toUpperCase() + type.slice(1);
      return Object.prototype.toString.call(data) === '[object ' + type + ']';

    case 'boolean':
    case 'bool':
      return data === true || data === false || data === 0 || data === 1;

    case 'any':
      return true;
    case 'object':
      if (isPlainObject(data)) {
        return true;
      }
      // TODO: not sure if I meant to return all objects as valid objects.
      return instanceOf(data, type);
    case 'function':
      return true;

    default:
      return instanceOf(data, type);
  }

}

module.exports = {
  data: validateData,
  flow: validateFlow,
  link: validateLink,
  nodeDefinition: validateNodeDefinition,
  nodeDefinitions: _checkIds
};

},{"../schemas/link.json":50,"../schemas/map.json":51,"../schemas/node.json":52,"instance-of":40,"is-plain-object":42,"json-gate":45}],"chix-flow":[function(require,module,exports){
module.exports=require('jXAsbI');
},{}],"jXAsbI":[function(require,module,exports){
'use strict';

var xNode = require('./lib/node');
var xFlow = require('./lib/flow');
var xLink = require('./lib/link');
var Actor = require('./lib/actor');
var mapSchema = require('./schemas/map.json');
var nodeSchema = require('./schemas/node.json');
var stageSchema = require('./schemas/stage.json');
var Validate = require('./lib/validate');

module.exports = {
  Node: xNode,
  Flow: xFlow,
  Link: xLink,
  Actor: Actor,
  Validate: Validate,
  Schema: {
    Map: mapSchema,
    Node: nodeSchema,
    Stage: stageSchema
  }
};

},{"./lib/actor":8,"./lib/flow":11,"./lib/link":14,"./lib/node":16,"./lib/validate":28,"./schemas/map.json":51,"./schemas/node.json":52,"./schemas/stage.json":53}],31:[function(require,module,exports){
'use strict';

var util         = require('util');
var Store        = require('./store');
var Group        = require('./group');
var PortSyncer   = require('./portSyncer');
var PortPointer  = require('./portPointer');
var EventEmitter = require('events').EventEmitter;

function CHI() {

  if (!(this instanceof CHI)) return new CHI();

  this.groups   = new Store(); // for groups
  this.pointers = new Store(); // for 'pointers'
  this._sync    = new Store(); // for 'syncing'

  this.queue = {};
}

util.inherits(CHI, EventEmitter);

/**
 *
 * Creates a new group/collection
 *
 */
CHI.prototype.group = function(port, cb) {
  // Generates new groupID
  var g = new Group(port, cb);

  this.groups.set(g.gid(), g);
  this.emit('begingroup', g);

  return g;
};

/**
 *
 * Simple way to give a unique common id to the data
 * at the output ports which want to be synced later on.
 *
 *  *in indicates we want to take along the common id of
 *  the other ports also pointing to the process.
 *
 *  Later this can be used with input ports that have
 *  been set to `sync` with the output originating from
 *  a process they specify.
 *
 * @param {String} nodeId
 * @param {String} port      The current port
 * @param {Object} chi
 * @param {Array}  syncPorts Array of port names to sync
 */
CHI.prototype.pointer = function(sourceId, port, p, identifier) {

  if(p.chi.hasOwnProperty(sourceId)) {
    return;
    /*
    throw new Error(
      'item already set'
    );
    */
  }

  var pp = this.pointers.get(sourceId);

  if(!pp) {
    pp = new PortPointer(identifier);
    this.pointers.set(sourceId, pp);
  }

  // will give the correct id, based on the ports queue
  var itemId = pp.add(port);

  // send along with the chi.
  // note: is within the same space as the groups.
  //
  // The packet now remembers the item id given by this node.
  // The Port Pointer which is created per node, stores this
  // item id.
  //
  // The only job of the PortPointer is assigning unique
  // itemIds, ids which are incremented.
  //
  // Then this.pointers keeps track of these PortPointers
  // per node.
  //
  // So what we end up with is a node tagging each and every
  // node who wanted a pointer and keeping track of
  // what ids were assigned. The collection name *is* a PortPointer
  //
  // Then now, how is the match then actually made?
  //
  // Ah... going different routes, that what this was about.
  // The origin is *one* output event *one* item.
  //
  // Then traveling different paths we ask for port sync.
  //
  // This sync is then based on this id, there became different
  // packets carrying this same item id.
  //
  // So probably the problem is cloning, I just have send
  // the chi along and copied that, so everywhere where that's
  // taking place a clone should take place.
  //
  // If I'll look at how sync works, there is probably
  // not a lot which could go wrong. it's the cloning not taking
  // place. I think something get's overwritten constantly.
  // ending up with the last `contents`
  //
  // De packet data keeps changing which is ok, but the chi
  // changes along with it or something.
  p.chi[sourceId] = itemId;

};

CHI.prototype.sync = function(link, originId, p, syncPorts) {

  var ps = this._sync.get(link.target.pid);
  if(!ps) {
    ps = new PortSyncer(originId, syncPorts);
    this._sync.set(link.target.pid, ps);
  }

  //var ret = ps.add(link, data, chi);
  //
  // This returns whatever is synced
  // And somehow this doesn't give us correct syncing.
  var ret = ps.add(link, p);
  if(ret !== undefined) {
    // what do we get returned?
    this.emit('synced', link.target.pid, ret);
  }

  // chi, need not be removed it could be re-used.
};

//CHI.prototype.collect = function(link, output, chi) {
CHI.prototype.collect = function(link, p) {

  var idx, mx = -1, self = this;

  // ok this is actually hard to determine.
  for(var gid in p.chi) {
    if(p.chi.hasOwnProperty(gid)) {
      // determine last group
      idx = this.groups.order.indexOf(gid);
      mx = idx > mx ? idx : mx;
    }
  }

  if(mx === -1) {
    throw Error('Could not match group');
  }

  gid = this.groups.order[mx];

  if(!this.queue.hasOwnProperty(link.ioid)) {
    this.queue[link.ioid] = {};
  }

  if(!Array.isArray(this.queue[link.ioid][gid])) {
    this.queue[link.ioid][gid] = [];
    this.groups.get(gid).on('complete', function() {
      //self.readySend(link, gid, chi);
      self.readySend(link, gid, p);
    });
  }

  // only push the data, last packet is re-used
  // to write the data back.
  this.queue[link.ioid][gid].push(p.data);

  //this.readySend(link, gid, chi);
  this.readySend(link, gid, p);

};

// TODO: should not work on link here..
//CHI.prototype.readySend = function(link, gid, chi) {
CHI.prototype.readySend = function(link, gid, p) {

  // get group
  var group = this.groups.get(gid);

  if(
     // if group is complete
     group.complete &&
     // if queue length matches the group length
     this.queue[link.ioid][gid].length === group.length
     ) {

    // Important: group seizes to exist for _this_ path.
    delete p.chi[gid];

    // Reusing last collected packet to write the group data
    p.write(this.queue[link.ioid][gid]);
    link.write(p);

    // reset
    this.queue[link.ioid][gid] = [];

    /* Not sure..
      delete output.chi[gid];        // remove it for our requester
      // group still exists for other paths.
      delete this.store[gid];        // remove from the store
      this.groupOrder.splice(mx, 1); // remove from the groupOrder.
    */
  }

};

// TODO: could just accept a packet and merge it.
CHI.prototype.merge = function (newChi, oldChi, unique) {

  // nothing to merge
  if(Object.keys(oldChi).length) {

    for(var c in oldChi) {
      if(oldChi.hasOwnProperty(c)) {

        if(newChi.hasOwnProperty(c) &&
          newChi[c] !== oldChi[c]
          ) {

          // problem here is, you are overwriting itemId's
          // Test, not sure if this should never happen.
          // When we merge that *is* what is happening no?
          if(unique) {
            throw new Error('refuse to overwrite chi item');
          }
        } else {
          newChi[c] = oldChi[c];
        }
      }
    }
  }
};

module.exports = CHI;

},{"./group":32,"./portPointer":33,"./portSyncer":34,"./store":35,"events":1,"util":6}],32:[function(require,module,exports){
'use strict';

var util = require('util'),
  uuid = require('uuid').v4,
  EventEmitter = require('events').EventEmitter;

/**
 *
 * Simple grouping.
 *
 * Group can be used from within blackbox.
 *
 * Or is used during cyclic and collect mode.
 *
 * During cyclic mode it can be considered virtual grouping.
 *
 * The virtual group will be recollected during collect mode.
 *
 * For now this will be simple, there can only be one collector
 * and the group will seize too exists once it's collected.
 *
 */
function Group(port, cb) {
  if(arguments.length !== 2) {
    throw new Error('Not enough arguments');
  }

  // these are undefined in virtual mode
  this.cb = cb;
  this.port = port;

  var prefix = 'gid-';
  prefix    += port ? port : '';

  this.info = {
    gid: Group.gid(prefix + '-'),
    complete: false,
    items: []
  };

  Object.defineProperty(this, 'length', {
    get: function() {
      return this.info.items.length;
    }
  });

  Object.defineProperty(this, 'complete', {
    get: function() {
      return this.info.complete;
    }
  });

  /**
   *
   * Used to collect incomming data.
   * Until everything from this group is received.
   *
   */
  this.store = [];

  // send out the group info
  // Ok this will not work with the virtual ones
  // there is no port to send to.
  this.send();
}

util.inherits(Group, EventEmitter);

// allow (tests) to overwrite them
Group.gid    = function(prefix) { return prefix + uuid(); };
Group.itemId = uuid;

/**
 *
 * Generates a new itemId and returns
 * The group and itemId
 *
 * Used like this:
 *
 *  cb({
 *    match: match
 *  }, g.item());
 *
 * The item id is send across 'the wire' and we
 * maintain the total group info overhere.
 *
 * [<gid>] = itemId
 * [<gid>] = itemId
 *
 * Which is a bit too magical, so that must change.
 *
 */
Group.prototype.item = function(obj) {

  // auto merging, could be a bit risky
  // no idea if item is ever called without obj?
  obj = obj || {};
  if(obj.hasOwnProperty(this.info.gid)) {
    throw Error('Object is already within group');
  }

  var id = Group.itemId();

  // This is an ordered array
  this.info.items.push(id);

  obj[this.info.gid] = id;
  return obj;
};

/**
 *
 *
 */
Group.prototype.collect = function(packet) {

  this.store.push(packet);

};

Group.prototype.done = function() {
  // ok, now the send should take place.
  // so this triggers the whole output handling
  // of the node, which is what we want.
  // this is the asyncOutput btw..
  this.info.complete = true;
  // check here if something want's this group.
  // or just emit to CHI and let that class check it.
  this.send();

  this.emit('complete', this);

};

// TODO: remove done..
Group.prototype.end = Group.prototype.done;

/***
 *
 * Sends the output using the callback of the
 * node who requested the group.
 *
 * In case of grouping during cyclic mode, for now,
 * there is nothing to send to. In which case
 * the callback is empty.
 *
 */
Group.prototype.send = function() {

  // only send out if we have a callback.
  if(this.cb) {
    var out = {};
    out[this.port] = {
      gid: this.info.gid,
      complete: !!this.info.complete, // loose reference
      items: this.info.items
    };
    this.cb(out);
  }

};

Group.prototype.items = function() {
  return this.info.items;
};

Group.prototype.gid = function() {
  return this.info.gid;
};

module.exports = Group;

},{"events":1,"util":6,"uuid":49}],33:[function(require,module,exports){
'use strict';

var uuid = require('uuid').v4;

/**
 *
 * The PortPointer initializes
 * each source with the same unique
 * itemId.
 *
 * These are then increased per port.
 * So their id's stay in sync.
 *
 * This does give the restriction both
 * ports should give an equal amount of output.
 *
 * Which is err. pretty errorprone :-)
 * Or at least it depends per node, whether it is.
 */
function PortPointer(identifier) {

  // little more unique than just a number.
  this.id = PortPointer.uid(identifier ? identifier + '-' : '');

  // the idea of this counter is increment
  this.counter = 0;

  //this.cols = cols;

  this.store = {};
}

PortPointer.uid = function(prefix) {
  return prefix + uuid().split('-')[0];
};

/**
 *
 * Should take care of having what come out of the ports
 * have the correct same id's
 *
 */
PortPointer.prototype.add = function(port) {

  if(!this.store.hasOwnProperty(port)) {
    this.store[port] = [this.counter];
  }

  // not just taking store[port].length, don't want to reset during flush
  var nr = this.store[port][this.store[port].length - 1];
  this.store[port].push(++nr);

  // At some point we actually do not care about the id's anymore.
  // that's when all ports have the same id. fix that later.

  return this.id + '-' + nr;

};

module.exports = PortPointer;

},{"uuid":49}],34:[function(require,module,exports){
'use strict';

////
//
// Ok a syncArray is made per nodeId.
// So this is with that scope.
//
// chi: {
//   <nodeId>: <uuid>
// }
//
// We keep on serving as a gate for the
// synced ports here.
//
function PortSyncer(originId, syncPorts) {

  this.syncPorts = syncPorts;
  this.originId  = originId;

  this.store = {};

}

/**
 *
 * Should take care of having what come out of the ports
 * have the correct same id's
 *
 * If we send the data, we can remove it from our store..
 *
 */
//PortSyncer.prototype.add = function(link, data, chi) {
PortSyncer.prototype.add = function(link, p) {

  if(!p.chi.hasOwnProperty(this.originId)) {
    // that's a fail
    throw new Error([
      'Origin Node',
      this.originId,
      'not found within chi'
    ].join(' '));

  }

  if(this.syncPorts.indexOf(link.target.port) === -1) {
    throw new Error([
      'Refuse to handle data for unknown port:',
      link.target.port
      ].join('')
    );
  }

  // <originId>: <itemId>
  // Read back the item id the PortPointer for this node gave us
  var itemId = p.chi[this.originId];

  // if there is no store yet for this item id, create one
  if(!this.store.hasOwnProperty(itemId)) {
    // Create an object for the sync group
    // To contain the data per port.
    this.store[itemId] = {};
  }

  // store this port's data.
  this.store[itemId][link.target.port] = { link: link, p: p };

  // Ok the case of pointing twice with a port
  // using several links is not covered yet..

  // if we have synced all ports, both have added their data
  // then we are ready to send it back.
  // This is done by CHI.sync based on what is returned here.
  // So.. THE reason why we get wrong merged content can only
  // be if some `chi` has stored the wrong item id.
  // And this can only happen, during merging.
  // However merging does this check, so it does not happen
  // during CHI.merge. If it doesn't happen during CHI.merge
  // We have reference somewhere, where there shouldn't be
  // a reference. we re-use a packet.
  // Nice, so where does that take place.
  // and how to prevent it. at least where itemid is set
  // there should be a check whether it's already set.
  if(Object.keys(this.store[itemId]).length === this.syncPorts.length) {

    // return { in1: <data>, in2: <data> }
    // the synced stuff.
    var dat = this.store[itemId];

    // we will never see this itemId again
    delete this.store[itemId];

    return dat;

  } else {

    // not ready yet.
    return undefined;
  }

};

module.exports = PortSyncer;

},{}],35:[function(require,module,exports){
'use strict';

function Store() {
  this.store = {};
  this.order = [];

  Object.defineProperty(this, 'length', {
    get: function() {
      return this.order.length;
    }
  });
}

Store.prototype.set = function(id, obj) {
  this.store[id] = obj;
  this.order.push(id);
};

Store.prototype.get = function(id) {
  return this.store[id];
};

Store.prototype.del = function(id) {
  this.order.splice(this.order.indexOf(id), 1);
  delete this.store[id];
};

Store.prototype.items = function() {
  return this.store;
};

Store.prototype.pop = function() {
  var id  = this.order.pop();
  var ret = this.store[id];
  delete this.store[id];
  return ret;
};

Store.prototype.shift = function() {
  var id  = this.order.shift();
  var ret = this.store[id];
  delete this.store[id];
  return ret;
};

Store.prototype.isEmpty = function() {
  return Object.keys(this.store).length === 0 &&
    this.order.length === 0;
};

module.exports = Store;

},{}],36:[function(require,module,exports){
'use strict';

var EventEmitter = require('events').EventEmitter;
var util = require('util');

/**
 *
 * Loader
 *
 * This is the base loader class
 * Ít can be used to implement a definition loader
 * for Chix
 *
 * @api public
 * @author Rob Halff <rob.halff@gmail.com>
 * @constructor
 */
function Loader() {

  this.dependencies = {};

  /**
   *
   * Format:
   *
   * Keeps track of all known nodeDefinitions.
   *
   * {
   *  'http://....': { // url in this case is the identifier
   *
   *    fs: {
   *       readFile:  <definition>
   *       writeFile: <definition>
   *    }
   *
   *  }
   *G
   * }
   *
   */
  this.nodeDefinitions = {};

}

util.inherits(Loader, EventEmitter);

/**
 *
 * This is the main method all child classes should implement.
 *
 * @param {Object} graphs
 * @param {Function} callback
 * @api public
 */
Loader.prototype.load = function(graphs, callback /*, update dependencies*/) {

  return callback(
    new Error([
      this.constructor.name,
      'must implement a load method'
    ].join(' ')
    )
  );

};

/**
 *
 * Add node definitions
 *
 * Used to `statically` add nodeDefinitions.
 *
 * @param {String} identifier
 * @param {Object} nodeDefs
 * @api public
 */
Loader.prototype.addNodeDefinitions = function(identifier, nodeDefs) {

  var ns;
  var name;
  var i;

  if (Array.isArray(nodeDefs)) {

    for (i = 0; i < nodeDefs.length; i++) {
      this.addNodeDefinition(identifier, nodeDefs[i]);
    }

  } else {

    for (ns in nodeDefs) {
      if (nodeDefs.hasOwnProperty(ns)) {
        for (name in nodeDefs[ns]) {
          if (nodeDefs[ns].hasOwnProperty(name)) {
            this.addNodeDefinition(identifier, nodeDefs[ns][name]);
          }
        }
      }
    }

  }
};

/**
 *
 * Add a node definition
 *
 * @param {String} identifier
 * @param {Object} nodeDef
 * @api public
 */
Loader.prototype.addNodeDefinition = function(identifier, nodeDef) {

  if (!nodeDef.hasOwnProperty('ns')) {
    throw new Error([
      'Nodefinition for',
      identifier,
      'lacks an ns property'
    ].join(' '));
  }

  if (!nodeDef.hasOwnProperty('name')) {
    throw new Error([
      'Nodefinition for',
      identifier,
      'lacks an name property'
    ].join(' '));
  }

  // store the provider url along with the nodeDefinition
  // Needed for fetching back from storage.
  nodeDef.provider = identifier;

  if (nodeDef.type !== 'flow') {

    // Do normal nodeDefinition stuff
    this.dependencies = this._parseDependencies(this.dependencies, nodeDef);

  } else {
    // also setting default provider here?
    // check this later, if addNodeDefinition(s) is used
    // there will otherwise be no default provider.
    // where is default provider, in chix-loader-remote.. err..
    // I think addNodefinition(s) should set it maybe
    // It's also a bit weird, because if you only add them manually
    // there ain't really an url or path.
    if (!nodeDef.providers || Object.keys(nodeDef.providers).length === 0) {
      nodeDef.providers = {
        '@': {
          url: identifier
        }
      };
    }
  }

  if (!this.nodeDefinitions.hasOwnProperty(identifier)) {
    this.nodeDefinitions[identifier] = {};
  }

  if (!this.nodeDefinitions[identifier].hasOwnProperty(nodeDef.ns)) {
    this.nodeDefinitions[identifier][nodeDef.ns] = {};
  }

  if (!this.nodeDefinitions[identifier][nodeDef.ns]
    .hasOwnProperty([nodeDef.name])) {
    this.nodeDefinitions[identifier][nodeDef.ns][nodeDef.name] = nodeDef;
  }

};

Loader.prototype._parseDependencies = function(dependencies, nodeDef) {
  var r;
  var type;

  if (nodeDef.require) {
    throw Error(
      nodeDef.ns + '/' + nodeDef.name +
      ': nodeDef.require is DEPRECATED, use nodeDef.dependencies'
    );
  }

  if (nodeDef.dependencies) {
    for (type in nodeDef.dependencies) {
      if (nodeDef.dependencies.hasOwnProperty(type)) {

        for (r in nodeDef.dependencies[type]) {

          if (nodeDef.dependencies[type].hasOwnProperty(r)) {

            if (type === 'npm') {
              if (nodeDef.dependencies.npm[r] !== 'builtin') {
                // translate to require string, bower should do the same
                //
                // I think this should be delayed, to when the actual
                // require takes place.
                /*
                requireString = r + '@' + nodeDef.dependencies.npm[r];
                if (requires.indexOf(requireString) === -1) {
                  requires.push(requireString);
                }
                */
                if (!dependencies.hasOwnProperty('npm')) {
                  dependencies.npm = {};
                }

                // TODO: check for duplicates and pick the latest one.
                dependencies.npm[r] = nodeDef.dependencies.npm[r];

              }
            } else if (type === 'bower') {

              if (!dependencies.hasOwnProperty('bower')) {
                dependencies.bower = {};
              }

              // TODO: check for duplicates and pick the latest one.
              dependencies.bower[r] = nodeDef.dependencies.bower[r];

            } else {

              throw Error('Unkown package manager:' + type);

            }

          }

        }

      }
    }
  }
  return dependencies;
};

Loader.prototype.saveNodeDefinition = function() {

  throw new Error([
    this.constructor.name,
    'must implement a save method'
  ].join(' '));

};

/**
 *
 * Ok now it becomes intresting.
 *
 * We will read the definition and are going to detect whether this
 * definition is about a flow, if it is about a flow.
 * We are also going to load those definitions, unless we already
 * have that definition ofcourse.
 *
 * This way we only have to provide the actor with ourselves.
 * The loader. The loader will then already know about all the
 * node definitions it needs. This keeps the actor simpler.
 * All it has to do is .getNodeDefinition() wherever in
 * the hierarchy it is.
 *
 */

/**
 *
 * Check whether we have the definition
 *
 * @param {String} providerUrl
 * @param {String} ns
 * @param {String} name
 * @api public
 */
Loader.prototype.hasNodeDefinition = function(providerUrl, ns, name) {
  return this.nodeDefinitions.hasOwnProperty(providerUrl) &&
    this.nodeDefinitions[providerUrl].hasOwnProperty(ns) &&
    this.nodeDefinitions[providerUrl][ns].hasOwnProperty(name);

};

/**
 *
 * Easier method to just get an already loaded definition
 * TODO: Unrafel getNodeDefinition and make it simpler
 *
 * Anyway, this is the way, we do not want to keep a store of id's
 * in the loader also, so getById can go also.
 */
Loader.prototype.getNodeDefinitionFrom = function(provider, ns, name) {

  if (this.hasNodeDefinition(provider, ns, name)) {
    return this.nodeDefinitions[provider][ns][name];
  }

};

/**
 *
 * Loads the NodeDefinition for a node.
 *
 * In order to do so each node must know the provider url
 * it was loaded from.
 *
 * This is normally not stored directly into flows,
 * but the flow is saved with the namespaces in used.
 *
 * TODO: this really should just be (provider, name, ns, version)
 * Else use the load method.
 *
 * ah this is the exact same as loadDefnition only without callback.
 *
 */
Loader.prototype.getNodeDefinition = function(node, map) {

  var def = this.loadNodeDefinition(node, map);

  // merge the schema of the internal node.
  if (node.type === 'flow') {
    this._mergeSchema(def); // in place
  }

  return def;

};

// this is still the map so nodes are an array
// saves us from having to maintain a nodes list.
// making this mergeSchema more self-reliant
Loader.prototype.findNodeWithinGraph = function(nodeId, graph) {

  for (var i = 0; i < graph.nodes.length; i++) {
    if (nodeId === graph.nodes[i].id) {
      // ok that's the node, but still it needs to be resolved
      // we need to get it's definition
      return graph.nodes[i];
    }
  }

  throw Error('Could not find internal node within graph');

};

Loader.prototype._mergeSchema = function(graph) {
  for (var type in graph.ports) {
    if (graph.ports.hasOwnProperty(type)) {
      for (var port in graph.ports[type]) {
        if (graph.ports[type].hasOwnProperty(port)) {
          var externalPort = graph.ports[type][port];
          if (externalPort.hasOwnProperty('nodeId')) {
            var internalDef = this.getNodeDefinition(
              this.findNodeWithinGraph(externalPort.nodeId, graph),
              graph
            );
            var copy    = JSON.parse(
              JSON.stringify(internalDef.ports[type][externalPort.name])
            );
            copy.title  = externalPort.title;
            copy.name   = externalPort.name;
            copy.nodeId = externalPort.nodeId;
            graph.ports[type][port] = copy;
          } else {
            // not pointing to an internal node. :start etc.
          }
        }
      }
    }
  }
};

/***
 *
 * Recursivly returns the requires.
 *
 * Assumes the map, node is already loaded.
 *
 * Note: Will break if node.provider is an url already.
 *
 * @private
 */
Loader.prototype._collectDependencies = function(dependencies, def) {

  var self = this;
  def.nodes.forEach(function(node) {
    var provider;

    // Just makes this a simple function, used in several locations.
    if (/:\/\//.test(node.provider)) {
      provider = node.provider;
    } else {
      var da = node.provider ? node.provider : '@';
      provider = def.providers[da].url || def.providers[da].path;
    }

    var nDef = self.nodeDefinitions[provider][node.ns][node.name];
    if (node.type === 'flow') {
      dependencies = self._collectDependencies(dependencies, nDef);
    } else {
      dependencies = self._parseDependencies(dependencies, nDef);
    }
  });

  return dependencies;

};

/**
 *
 * Get the dependencies for a certain provider.
 *
 * @param {Object} def
 * @private
 */
Loader.prototype._loadDependencies = function(def) {

  var dependencies = {};

  if (def.type === 'flow') {
    dependencies = this._collectDependencies(dependencies, def);
    return dependencies;
  } else {
    dependencies = this._parseDependencies(dependencies, def);
    return dependencies;
  }

};

// Loader itself only expects preloaded nodes.
// There is no actual load going on.
// Remote loader does implement loading.
Loader.prototype.loadNode = function(providerDef, cb) {

  var provider = providerDef.providerLocation;
  var ns       = providerDef.ns;
  var name     = providerDef.name;
  if (this.nodeDefinitions[provider] &&
    this.nodeDefinitions[provider].hasOwnProperty(ns) &&
    this.nodeDefinitions[provider][ns].hasOwnProperty(name)) {

    cb(null, {
      nodeDef: this.nodeDefinitions[provider][ns][name]
    });

  } else {

    cb(
      Error(
        util.format('Could not load node %s/%s from %s', ns, name, provider)
      )
    );

  }

};

Loader.prototype.loadNodeDefinitionFrom =
  function(provider, ns, name, callback) {

  var self = this;

  // I want cumulative dependencies.
  // Instead of only knowing all dependencies known
  // or only the dependency from the current node.
  // self.load could send this within the callback
  // and then also remember the dependency from this single node.
  // for self.load it's the second argument of the callback.
  var dependencies = {};

  this.loadNode({
    ns: ns,
    name: name,
    url: provider.replace('{ns}', ns).replace('{name}', name),
    providerLocation: provider
  }, function(err, res) {

    if (err) {
      throw err;
    }

    var nodeDef = res.nodeDef;
    // res.providerLocation

    dependencies = self._parseDependencies(dependencies, nodeDef);

    // quick hacking
    if (!self.nodeDefinitions[provider]) {
      self.nodeDefinitions[provider] = {};
    }
    if (!self.nodeDefinitions[provider].hasOwnProperty(ns)) {
      self.nodeDefinitions[provider][ns] = {};
    }
    self.nodeDefinitions[provider][ns][name] = nodeDef;

    if (nodeDef.type === 'flow') {

      self.load(nodeDef, function(/*err, ret*/) {
        callback(
          self.nodeDefinitions[provider][ns][name],
          self._loadDependencies(
            self.nodeDefinitions[provider][ns][name]
          )
        );
      }, false, dependencies);

    } else {
      callback(
        self.nodeDefinitions[provider][ns][name],
        self._loadDependencies(
          self.nodeDefinitions[provider][ns][name]
        )
      );
    }

  });

};

// Ok this, seems weird, it is loading the map?
// I give it a node which has either a provider as short key
// or the full url, the map is needed to resolve that.
// but then I start loading the full map.
// which seems weird, to say the least.
Loader.prototype.loadNodeDefinition = function(node, map, callback) {

  var location;
  var provider;
  var self = this;

  if (node.provider && node.provider.indexOf('://') >= 0) {
    // it's already an url
    location = node.provider;

  } else if (!node.provider && (!map || !map.providers)) {
    // for direct additions (only @ is possible)
    location = '@';

  } else {

    if (!map) {

      throw Error(
        'loadNodeDefinition needs a map or a node with a full provider url'
      );

    }

    if (node.provider) {
      // 'x': ..
      provider = map.providers[node.provider];
    } else {
      provider = map.providers['@'];
    }

    // fix: find provider by path or url, has to do with provider
    // already resolved (sub.sub.graphs)
    if (!provider) {
      for (var key in map.providers) {
        if (map.providers[key].url === node.provider ||
          map.providers[key].path === node.provider) {
          provider = map.providers[key];
        }
      }
      if (!provider) {
        throw Error('unable to find provider');
      }
    }

    if (provider.hasOwnProperty('path')) {

      location = provider.path;

    } else if (provider.hasOwnProperty('url')) {

      location = provider.url;

    } else {
      throw new Error('Do not know how to handle provider');
    }

    // Remember the provider, this is important to call getDefinition
    // at a later stage, see actor.addMap and createNode.
    // createNode is called without a map.
    // not perfect this, so redo this later.
    // when empty maps are added, createNode should also be
    // able to figure out where it's definitions are.
    // this means the map should be preloaded.
    // This preload should be done with an URL not with @
    // The along with that getNodeDefinitionFrom(providerUrl)
    // should be used. providerUrl is the only way subgraphs
    // are indexed correctly '@' by itself is not unique enough
    // to serve as a provider key. it is for single graphs but
    // is not useable anything beyond that.
    // Also however when a graph is saved the expanded
    // urls should be translated back into short form (fix that)
    // by looking up the provider within providers and putting
    // the key back where now the expanded url is.
    node.provider = location;

  }

  if (!this.nodeDefinitions.hasOwnProperty(location) ||
    !this.nodeDefinitions[location].hasOwnProperty(node.ns) ||
    !this.nodeDefinitions[location][node.ns].hasOwnProperty(node.name)) {

    if (!callback) {
      return false;
    } else {
      // not sure.. node has a full url.
      // but it's not loaded, then we ask to load the full map.
      // which works if provider is x but not if it's already expanded.
      //
      this.load(map, function() {
        callback(self.nodeDefinitions[location][node.ns][node.name]);
      });
    }

  } else {

    if (callback) {
      callback(this.nodeDefinitions[location][node.ns][node.name]);
    } else {
      return this.nodeDefinitions[location][node.ns][node.name];
    }

  }

};

/**
 *
 * Get dependencies for the type given.
 *
 * type is either `npm` or `bower`
 *
 * If no type is given will return all dependencies.
 *
 * Note: this method changed in behavior, used to be
 *  what _loadDependencies is now. which used to be getRequires()...
 *
 * @param {string} type
 * @public
 */
Loader.prototype.getDependencies = function(type) {
  if (type) {
    if (this.dependencies.hasOwnProperty(type)) {
      return this.dependencies[type];
    } else {
      return {};
    }
  } else {
    return this.dependencies;
  }
};

/**
 *
 * Checks whether there are any dependencies.
 *
 * Type can be `npm` or `bower`
 *
 * If no type is given it will tell whether there are *any* dependencies
 *
 * @param {string} type
 * @public
 **/
Loader.prototype.hasDependencies = function(type) {

  if (type) {
    if (this.dependencies.hasOwnProperty(type)) {
      return Object.keys(this.dependencies[type]).length;
    }
  } else {
    for (type in this.dependencies) {
      if (this.dependencies.hasOwnProperty(type)) {
        if (this.hasDependencies(type)) {
          return true;
        }
      }
    }
  }
  return false;
};

/**
 *
 * Get Nodedefinitions
 *
 * Optionally with a provider url so it returns only the node definitions
 * at that provider.
 *
 * @param {String} provider (Optional)
 */
Loader.prototype.getNodeDefinitions = function(provider) {

  if (provider) {
    return this.nodeDefinitions[provider];
  } else {
    return this.nodeDefinitions;
  }

};

module.exports = Loader;

},{"events":1,"util":6}],37:[function(require,module,exports){

/**
 * This is the web browser implementation of `debug()`.
 *
 * Expose `debug()` as the module.
 */

exports = module.exports = require('./debug');
exports.log = log;
exports.formatArgs = formatArgs;
exports.save = save;
exports.load = load;
exports.useColors = useColors;

/**
 * Colors.
 */

exports.colors = [
  'lightseagreen',
  'forestgreen',
  'goldenrod',
  'dodgerblue',
  'darkorchid',
  'crimson'
];

/**
 * Currently only WebKit-based Web Inspectors, Firefox >= v31,
 * and the Firebug extension (any Firefox version) are known
 * to support "%c" CSS customizations.
 *
 * TODO: add a `localStorage` variable to explicitly enable/disable colors
 */

function useColors() {
  // is webkit? http://stackoverflow.com/a/16459606/376773
  return ('WebkitAppearance' in document.documentElement.style) ||
    // is firebug? http://stackoverflow.com/a/398120/376773
    (window.console && (console.firebug || (console.exception && console.table))) ||
    // is firefox >= v31?
    // https://developer.mozilla.org/en-US/docs/Tools/Web_Console#Styling_messages
    (navigator.userAgent.toLowerCase().match(/firefox\/(\d+)/) && parseInt(RegExp.$1, 10) >= 31);
}

/**
 * Map %j to `JSON.stringify()`, since no Web Inspectors do that by default.
 */

exports.formatters.j = function(v) {
  return JSON.stringify(v);
};


/**
 * Colorize log arguments if enabled.
 *
 * @api public
 */

function formatArgs() {
  var args = arguments;
  var useColors = this.useColors;

  args[0] = (useColors ? '%c' : '')
    + this.namespace
    + (useColors ? ' %c' : ' ')
    + args[0]
    + (useColors ? '%c ' : ' ')
    + '+' + exports.humanize(this.diff);

  if (!useColors) return args;

  var c = 'color: ' + this.color;
  args = [args[0], c, 'color: inherit'].concat(Array.prototype.slice.call(args, 1));

  // the final "%c" is somewhat tricky, because there could be other
  // arguments passed either before or after the %c, so we need to
  // figure out the correct index to insert the CSS into
  var index = 0;
  var lastC = 0;
  args[0].replace(/%[a-z%]/g, function(match) {
    if ('%%' === match) return;
    index++;
    if ('%c' === match) {
      // we only are interested in the *last* %c
      // (the user may have provided their own)
      lastC = index;
    }
  });

  args.splice(lastC, 0, c);
  return args;
}

/**
 * Invokes `console.log()` when available.
 * No-op when `console.log` is not a "function".
 *
 * @api public
 */

function log() {
  // This hackery is required for IE8,
  // where the `console.log` function doesn't have 'apply'
  return 'object' == typeof console
    && 'function' == typeof console.log
    && Function.prototype.apply.call(console.log, console, arguments);
}

/**
 * Save `namespaces`.
 *
 * @param {String} namespaces
 * @api private
 */

function save(namespaces) {
  try {
    if (null == namespaces) {
      localStorage.removeItem('debug');
    } else {
      localStorage.debug = namespaces;
    }
  } catch(e) {}
}

/**
 * Load `namespaces`.
 *
 * @return {String} returns the previously persisted debug modes
 * @api private
 */

function load() {
  var r;
  try {
    r = localStorage.debug;
  } catch(e) {}
  return r;
}

/**
 * Enable namespaces listed in `localStorage.debug` initially.
 */

exports.enable(load());

},{"./debug":38}],38:[function(require,module,exports){

/**
 * This is the common logic for both the Node.js and web browser
 * implementations of `debug()`.
 *
 * Expose `debug()` as the module.
 */

exports = module.exports = debug;
exports.coerce = coerce;
exports.disable = disable;
exports.enable = enable;
exports.enabled = enabled;
exports.humanize = require('ms');

/**
 * The currently active debug mode names, and names to skip.
 */

exports.names = [];
exports.skips = [];

/**
 * Map of special "%n" handling functions, for the debug "format" argument.
 *
 * Valid key names are a single, lowercased letter, i.e. "n".
 */

exports.formatters = {};

/**
 * Previously assigned color.
 */

var prevColor = 0;

/**
 * Previous log timestamp.
 */

var prevTime;

/**
 * Select a color.
 *
 * @return {Number}
 * @api private
 */

function selectColor() {
  return exports.colors[prevColor++ % exports.colors.length];
}

/**
 * Create a debugger with the given `namespace`.
 *
 * @param {String} namespace
 * @return {Function}
 * @api public
 */

function debug(namespace) {

  // define the `disabled` version
  function disabled() {
  }
  disabled.enabled = false;

  // define the `enabled` version
  function enabled() {

    var self = enabled;

    // set `diff` timestamp
    var curr = +new Date();
    var ms = curr - (prevTime || curr);
    self.diff = ms;
    self.prev = prevTime;
    self.curr = curr;
    prevTime = curr;

    // add the `color` if not set
    if (null == self.useColors) self.useColors = exports.useColors();
    if (null == self.color && self.useColors) self.color = selectColor();

    var args = Array.prototype.slice.call(arguments);

    args[0] = exports.coerce(args[0]);

    if ('string' !== typeof args[0]) {
      // anything else let's inspect with %o
      args = ['%o'].concat(args);
    }

    // apply any `formatters` transformations
    var index = 0;
    args[0] = args[0].replace(/%([a-z%])/g, function(match, format) {
      // if we encounter an escaped % then don't increase the array index
      if (match === '%%') return match;
      index++;
      var formatter = exports.formatters[format];
      if ('function' === typeof formatter) {
        var val = args[index];
        match = formatter.call(self, val);

        // now we need to remove `args[index]` since it's inlined in the `format`
        args.splice(index, 1);
        index--;
      }
      return match;
    });

    if ('function' === typeof exports.formatArgs) {
      args = exports.formatArgs.apply(self, args);
    }
    var logFn = enabled.log || exports.log || console.log.bind(console);
    logFn.apply(self, args);
  }
  enabled.enabled = true;

  var fn = exports.enabled(namespace) ? enabled : disabled;

  fn.namespace = namespace;

  return fn;
}

/**
 * Enables a debug mode by namespaces. This can include modes
 * separated by a colon and wildcards.
 *
 * @param {String} namespaces
 * @api public
 */

function enable(namespaces) {
  exports.save(namespaces);

  var split = (namespaces || '').split(/[\s,]+/);
  var len = split.length;

  for (var i = 0; i < len; i++) {
    if (!split[i]) continue; // ignore empty strings
    namespaces = split[i].replace(/\*/g, '.*?');
    if (namespaces[0] === '-') {
      exports.skips.push(new RegExp('^' + namespaces.substr(1) + '$'));
    } else {
      exports.names.push(new RegExp('^' + namespaces + '$'));
    }
  }
}

/**
 * Disable debug output.
 *
 * @api public
 */

function disable() {
  exports.enable('');
}

/**
 * Returns true if the given mode name is enabled, false otherwise.
 *
 * @param {String} name
 * @return {Boolean}
 * @api public
 */

function enabled(name) {
  var i, len;
  for (i = 0, len = exports.skips.length; i < len; i++) {
    if (exports.skips[i].test(name)) {
      return false;
    }
  }
  for (i = 0, len = exports.names.length; i < len; i++) {
    if (exports.names[i].test(name)) {
      return true;
    }
  }
  return false;
}

/**
 * Coerce `val`.
 *
 * @param {Mixed} val
 * @return {Mixed}
 * @api private
 */

function coerce(val) {
  if (val instanceof Error) return val.stack || val.message;
  return val;
}

},{"ms":39}],39:[function(require,module,exports){
/**
 * Helpers.
 */

var s = 1000;
var m = s * 60;
var h = m * 60;
var d = h * 24;
var y = d * 365.25;

/**
 * Parse or format the given `val`.
 *
 * Options:
 *
 *  - `long` verbose formatting [false]
 *
 * @param {String|Number} val
 * @param {Object} options
 * @return {String|Number}
 * @api public
 */

module.exports = function(val, options){
  options = options || {};
  if ('string' == typeof val) return parse(val);
  return options.long
    ? long(val)
    : short(val);
};

/**
 * Parse the given `str` and return milliseconds.
 *
 * @param {String} str
 * @return {Number}
 * @api private
 */

function parse(str) {
  var match = /^((?:\d+)?\.?\d+) *(ms|seconds?|s|minutes?|m|hours?|h|days?|d|years?|y)?$/i.exec(str);
  if (!match) return;
  var n = parseFloat(match[1]);
  var type = (match[2] || 'ms').toLowerCase();
  switch (type) {
    case 'years':
    case 'year':
    case 'y':
      return n * y;
    case 'days':
    case 'day':
    case 'd':
      return n * d;
    case 'hours':
    case 'hour':
    case 'h':
      return n * h;
    case 'minutes':
    case 'minute':
    case 'm':
      return n * m;
    case 'seconds':
    case 'second':
    case 's':
      return n * s;
    case 'ms':
      return n;
  }
}

/**
 * Short format for `ms`.
 *
 * @param {Number} ms
 * @return {String}
 * @api private
 */

function short(ms) {
  if (ms >= d) return Math.round(ms / d) + 'd';
  if (ms >= h) return Math.round(ms / h) + 'h';
  if (ms >= m) return Math.round(ms / m) + 'm';
  if (ms >= s) return Math.round(ms / s) + 's';
  return ms + 'ms';
}

/**
 * Long format for `ms`.
 *
 * @param {Number} ms
 * @return {String}
 * @api private
 */

function long(ms) {
  return plural(ms, d, 'day')
    || plural(ms, h, 'hour')
    || plural(ms, m, 'minute')
    || plural(ms, s, 'second')
    || ms + ' ms';
}

/**
 * Pluralization helper.
 */

function plural(ms, n, name) {
  if (ms < n) return;
  if (ms < n * 1.5) return Math.floor(ms / n) + ' ' + name;
  return Math.ceil(ms / n) + ' ' + name + 's';
}

},{}],40:[function(require,module,exports){
module.exports = function InstanceOf(obj, type) {
  if(obj === null) return false;
  if(type === 'array') type = 'Array';
  var t = typeof obj;
  if(t === 'object') {
    if(type.toLowerCase() === t) return true; // Object === object
    if(obj.constructor.name === type) return true;
    if(obj.constructor.toString().match(/function (\w*)/)[1] === type) return true;
    return InstanceOf(Object.getPrototypeOf(obj), type);
  } else {
    return t === type;
  }
};

},{}],41:[function(require,module,exports){
'use strict';

var util = require('util');
var EventEmitter = require('events').EventEmitter;

/**
 *
 * IO Box
 *
 * @param {String} name
 */
var IOBox = function (name, args, returns) {

  if (!(this instanceof IOBox)) {
    return new IOBox(name, args, returns);
  }

  EventEmitter.apply(this, arguments);

  this.name = name || 'UNNAMED';

  // to ensure correct order
  this._keys = [];

  args = args || [];
  returns = returns || [];

  this.setup(args, returns);

};

util.inherits(IOBox, EventEmitter);

/**
 *
 * Setup
 *
 * @param {Array} args
 * @param {Array} returns
 */
IOBox.prototype.setup = function (args, returns) {

  var i;

  this.args = {};
  this.returns = [];
  this.fn = undefined;

  // setup the empty input arguments object
  for (i = 0; i < args.length; i++) {
    this.addArg(args[i], undefined);
  }

  for (i = 0; i < returns.length; i++) {
    this.addReturn(returns[i]);
  }
};

/**
 *
 * Used to access the properties at the top level,
 * but still be able to get all relevant arguments
 * at once using this.args
 *
 * @param {String} key
 * @param {Mixed} initial
 */
IOBox.prototype.addArg = function (key, initial) {

  Object.defineProperty(this, key, {
    set: function (val) {
      this.args[key] = val;
    },
    get: function () {
      return this.args[key];
    }
  });

  this._keys.push(key);

  this[key] = initial; // can be undefined

};

IOBox.prototype.addReturn = function (r) {
  if (this.returns.indexOf(r) === -1) {
    if (this._keys.indexOf(r) !== -1) {
      this.returns.push(r);
    }
    else {
      throw Error([
        'Output `',
        r,
        '` is not one of',
        this._keys.join(', ')
      ].join(' '));
    }
  }
};

/**
 *
 * Sets a property of the sandbox.
 * Because the keys determine what arguments will
 * be generated for the function, it is important
 * we keep some kind of control over what is set.
 *
 * @param {String} key
 * @param {Mixed} value
 *
 */
IOBox.prototype.set = function (key, value) {

  if (this.args.hasOwnProperty(key)) {
    this.args[key] = value;
  }
  else {
    throw new Error([
      'Will not set unknown property',
      key
    ].join(' '));
  }
};

/**
 *
 * Compiles and returns the generated function.
 *
 * @param {String} fn
 * @param {Boolean} asObject
 * @return {String}
 */
IOBox.prototype.compile = function (fn, asObject) {

  if (!this.code) {
    this.generate(fn ? fn.trim() : fn, asObject);
  }

  this.fn = new Function(this.code)();

  return this.fn;

};

/**
 *
 * Fill with a precompiled function
 *
 * Return type in this case is determined by compiled function
 *
 * @param {String} fn
 * @return {String}
 */
IOBox.prototype.fill = function (fn) {

  // argument signature check?

  this.fn = fn;

  return this.fn;

};

/**
 *
 * Wraps the function in yet another function
 *
 * This way it's possible to get the original return.
 *
 * @param {String} fn
 * @return {String}
 */
IOBox.prototype._returnWrap = function (fn) {
  return ['function() {', fn, '}.call(this)'].join('\n');
};
/**
 *
 * Clear generated code
 */
IOBox.prototype.clear = function () {
  this.code = null;
};

/**
 *
 * Generates the function.
 *
 * This can be used directly
 *
 * @param {String} fn
 * @param {Boolean} asObject
 * @return {String}
 */
IOBox.prototype.generate = function (fn, asObject) {

  this.code = [
    'return function ',
    this.name,
    '(',
    this._keys.join(','),
    ') {\n',
    'var r = ', // r goes to 'return'
    this._returnWrap(fn),
    '; return ',
    asObject ? this._asObject() : this._asArray(),
    '; }'
  ].join('');

  return this.code;
};

/**
 *
 * Return output as array.
 *
 * @return {String}
 */
IOBox.prototype._asArray = function () {
  return '[' + this.returns.join(',') + ',r]';
};

/**
 *
 * Return output as object.
 *
 * @return {String}
 */
IOBox.prototype._asObject = function () {
  var ret = [];
  for (var i = 0; i < this.returns.length; i++) {
    ret.push(this.returns[i] + ':' + this.returns[i]);
  }
  ret.push('return:' + 'r');

  return '{' + ret.join(',') + '}';
};

/**
 *
 * Renders the function to string.
 *
 * @return {String}
 */
IOBox.prototype.toString = function () {
  if (this.fn) return this.fn.toString();
  return this.fn;
};

/**
 *
 * Runs the generated function
 *
 * @param {Mixed} bind   Context to bind to the function
 * @return {Mixed}
 */
IOBox.prototype.run = function (bind) {

  var v = [];
  var k;

  for (k in this.args) {
    if (this.args.hasOwnProperty(k)) {
      v[this._keys.indexOf(k)] = this.args[k];
    }
    else {
      throw new Error('unknown input ' + k);
    }
  }

  // returns the output, format depends on the `compile` step
  return this.fn.apply(bind, v);

};

module.exports = IOBox;

},{"events":1,"util":6}],42:[function(require,module,exports){
/*!
 * is-plain-object <https://github.com/jonschlinkert/is-plain-object>
 *
 * Copyright (c) 2014 Jon Schlinkert, contributors.
 * Licensed under the MIT License
 */

'use strict';

module.exports = function isPlainObject(o) {
  return !!o && typeof o === 'object' && o.constructor === Object;
};
},{}],43:[function(require,module,exports){
exports.getType = function (obj) {
	switch (Object.prototype.toString.call(obj)) {
		case '[object String]':
			return 'string';
		case '[object Number]':
			return (obj % 1 === 0) ? 'integer' : 'number';
		case '[object Boolean]':
			return 'boolean';
		case '[object Object]':
			return 'object';
		case '[object Array]':
			return 'array';
		case '[object Null]':
			return 'null';
		default:
			return 'undefined';
	}
}

exports.prettyType = function(type) {
	switch (type) {
		case 'string':
		case 'number':
		case 'boolean':
			return 'a ' + type;
		case 'integer':
		case 'object':
		case 'array':
			return 'an ' + type;
		case 'null':
			return 'null';
		case 'any':
			return 'any type';
		case 'undefined':
			return 'undefined';
		default:
			if (typeof type === 'object') {
				return 'a schema'
			} else {
				return type;
			}
	}
}


exports.isOfType = function (obj, type) {
	switch (type) {
		case 'string':
		case 'number':
		case 'boolean':
		case 'object':
		case 'array':
		case 'null':
			type = type.charAt(0).toUpperCase() + type.slice(1);
			return Object.prototype.toString.call(obj) === '[object ' + type + ']';
		case 'integer':
			return Object.prototype.toString.call(obj) === '[object Number]' && obj % 1 === 0;
		case 'any':
		default:
			return true;
	}
}

exports.getName = function (names) {
	return names.length === 0 ? '' : ' property \'' + names.join('.') + '\'';
};

exports.deepEquals = function (obj1, obj2) {
	var p;

	if (Object.prototype.toString.call(obj1) !== Object.prototype.toString.call(obj2)) {
		return false;
	}

	switch (typeof obj1) {
		case 'object':
			if (obj1.toString() !== obj2.toString()) {
				return false;
			}
			for (p in obj1) {
				if (!(p in obj2)) {
					return false;
				}
				if (!exports.deepEquals(obj1[p], obj2[p])) {
					return false;
				}
			}
			for (p in obj2) {
				if (!(p in obj1)) {
					return false;
				}
			}
			return true;
		case 'function':
			return obj1[p].toString() === obj2[p].toString();
		default:
			return obj1 === obj2;
	}
};

},{}],44:[function(require,module,exports){
var RE_0_TO_100 = '([1-9]?[0-9]|100)';
var RE_0_TO_255 = '([1-9]?[0-9]|1[0-9][0-9]|2[0-4][0-9]|25[0-5])';

function validateFormatUtcMillisec(obj) {
	return obj >= 0;
}

function validateFormatRegExp(obj) {
	try {
		var re = RegExp(obj);
		return true;
	} catch(err) {
		return false;
	}
}

var COLORS = ['aqua', 'black', 'blue', 'fuchsia', 'gray', 'green', 'lime', 'maroon', 'navy', 'olive', 'orange', 'purple', 'red', 'silver', 'teal', 'white', 'yellow'];
var colorsReHex3 = /^#[0-9A-Fa-f]{3}$/; // #rgb
var colorsReHex6 = /^#[0-9A-Fa-f]{6}$/; // #rrggbb
var colorsReRgbNum = RegExp('^rgb\\(\\s*' + RE_0_TO_255 + '(\\s*,\\s*' + RE_0_TO_255 + '\\s*){2}\\)$'); // rgb(255, 0, 128)
var colorsReRgbPerc = RegExp('^rgb\\(\\s*' + RE_0_TO_100 + '%(\\s*,\\s*' + RE_0_TO_100 + '%\\s*){2}\\)$'); // rgb(100%, 0%, 50%)

function validateFormatColor(obj) {
	return COLORS.indexOf(obj) !== -1 || obj.match(colorsReHex3) || obj.match(colorsReHex6)
		|| obj.match(colorsReRgbNum) || obj.match(colorsReRgbPerc);
}

var phoneReNational = /^(\(\d+\)|\d+)( \d+)*$/;
var phoneReInternational = /^\+\d+( \d+)*$/;

function validateFormatPhone(obj) {
	return obj.match(phoneReNational) || obj.match(phoneReInternational);
}

var formats = {
	'date-time': { // ISO 8601 (YYYY-MM-DDThh:mm:ssZ in UTC time)
		types: ['string'],
		regex: /^\d{4}-\d{2}-\d{2}T[0-2]\d:[0-5]\d:[0-5]\d([.,]\d+)?Z$/
	},
	'date': { // YYYY-MM-DD
		types: ['string'],
		regex: /^\d{4}-\d{2}-\d{2}$/
	},
	'time': { // hh:mm:ss
		types: ['string'],
		regex: /^[0-2]\d:[0-5]\d:[0-5]\d$/
	},
	'utc-millisec': {
		types: ['number', 'integer'],
		func: validateFormatUtcMillisec
	},
	'regex': { // ECMA 262/Perl 5
		types: ['string'],
		func: validateFormatRegExp
	},
	'color': { // W3C.CR-CSS21-20070719
		types: ['string'],
		func: validateFormatColor
	},
	/* TODO: support style
		* style - A string containing a CSS style definition, based on CSS 2.1 [W3C.CR-CSS21-20070719].
		Example: `'color: red; background-color:#FFF'`.

	'style': { // W3C.CR-CSS21-20070719
		types: ['string'],
		func: validateFormatStyle
	},*/
   	'phone': { // E.123
		types: ['string'],
		func: validateFormatPhone
	},
	'uri': {
		types: ['string'],
		regex: RegExp("^([a-z][a-z0-9+.-]*):(?://(?:((?:[a-z0-9-._~!$&'()*+,;=:]|%[0-9A-F]{2})*)@)?((?:[a-z0-9-._~!$&'()*+,;=]|%[0-9A-F]{2})*)(?::(\\d*))?(/(?:[a-z0-9-._~!$&'()*+,;=:@/]|%[0-9A-F]{2})*)?|(/?(?:[a-z0-9-._~!$&'()*+,;=:@]|%[0-9A-F]{2})+(?:[a-z0-9-._~!$&'()*+,;=:@/]|%[0-9A-F]{2})*)?)(?:\\?((?:[a-z0-9-._~!$&'()*+,;=:/?@]|%[0-9A-F]{2})*))?(?:#((?:[a-z0-9-._~!$&'()*+,;=:/?@]|%[0-9A-F]{2})*))?$", 'i')
	},
	'email': {
		types: ['string'],
		regex: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,4}$/i
	},
	'ip-address': {
		types: ['string'],
		regex: RegExp('^' + RE_0_TO_255 + '(\\.' + RE_0_TO_255 + '){3}$')
	},
	'ipv6': {
		types: ['string'],
		regex: /^((?=.*::)(?!.*::.+::)(::)?([\dA-F]{1,4}:(:|\b)|){5}|([\dA-F]{1,4}:){6})((([\dA-F]{1,4}((?!\3)::|:\b|$))|(?!\2\3)){2}|(((2[0-4]|1\d|[1-9])?\d|25[0-5])\.?\b){4})$/i
	},
	'host-name': {
		types: ['string'],
		regex: /^(([a-zA-Z0-9]|[a-zA-Z0-9][a-zA-Z0-9\-]*[a-zA-Z0-9])\.)*([A-Za-z0-9]|[A-Za-z0-9][A-Za-z0-9\-]*[A-Za-z0-9])$/
	}
};

exports.formats = formats;

},{}],45:[function(require,module,exports){
var validateSchema = require('./valid-schema'),
	validateObject = require('./valid-object');

var Schema = function(schema) {
	this.schema = schema;
	validateSchema(schema);

	this.validate = function(obj, done) {
		validateObject(obj, schema, done);
	}
}

module.exports.createSchema = function (schema) {
	return new Schema(schema);
}

},{"./valid-object":46,"./valid-schema":47}],46:[function(require,module,exports){
var formats = require('./formats').formats;
var common = require('./common'),
	getType = common.getType,
	prettyType = common.prettyType,
	isOfType = common.isOfType,
	getName = common.getName,
	deepEquals = common.deepEquals;

function throwInvalidValue(names, value, expected) {
	throw new Error('JSON object' + getName(names) + ' is ' + value + ' when it should be ' + expected);
}

function throwInvalidAttributeValue(names, attribFullName, value, expected) {
	throw new Error('JSON object' + getName(names) + ': ' + attribFullName + ' is ' + value + ' when it should be ' + expected);
}

function throwInvalidType(names, value, expected) {
	throw new Error('JSON object' + getName(names) + ' is ' + prettyType(getType(value)) + ' when it should be ' + expected);
}

function throwInvalidDisallow(names, value, expected) {
	throw new Error('JSON object' + getName(names) + ' is ' + prettyType(getType(value)) + ' when it should not be ' + expected);
}

function validateRequired(obj, schema, names) {
	//console.log('***', names, 'validateRequired');
	if (schema.required) {
		if (obj === undefined) {
			throw new Error('JSON object' + getName(names) + ' is required');
		}
	}
}

function applyDefault(obj, schema, names) {
	//console.log('***', names, 'applyDefault');
	if (schema.default !== undefined) {
		obj = schema.default;
	}

	return obj;
}

function validateType(obj, schema, names) {
	//console.log('***', names, 'validateType');
	if (schema.type !== undefined) {
		switch (getType(schema.type)) {
			case 'string':
				// simple type
				if (!isOfType(obj, schema.type)) {
					throwInvalidType(names, obj, prettyType(schema.type));
				}
				break;
			case 'array':
				// union type
				for (var i = 0; i < schema.type.length; ++i) {
					switch (getType(schema.type[i])) {
						case 'string':
							// simple type (inside union type)
							if (isOfType(obj, schema.type[i])) {
								return; // success
							}
							break;
						case 'object':
							// schema (inside union type)
							try {
								return validateSchema(obj, schema.type[i], names);
							} catch(err) {
								// validation failed
								// TOOD: consider propagating error message upwards
							}
							break;
					}
				}
				throwInvalidType(names, obj, 'either ' + schema.type.map(prettyType).join(' or '));
				break;
		}
	}
}

function validateDisallow(obj, schema, names) {
	//console.log('***', names, 'validateDisallow');
	if (schema.disallow !== undefined) {
		switch (getType(schema.disallow)) {
			case 'string':
				// simple type
				if (isOfType(obj, schema.disallow)) {
					throwInvalidDisallow(names, obj, prettyType(schema.disallow));
				}
				break;
			case 'array':
				// union type
				for (var i = 0; i < schema.disallow.length; ++i) {
					switch (getType(schema.disallow[i])) {
						case 'string':
							// simple type (inside union type)
							if (isOfType(obj, schema.disallow[i])) {
								throwInvalidType(names, obj, 'neither ' + schema.disallow.map(prettyType).join(' nor '));
							}
							break;
						case 'object':
							// schema (inside union type)
							try {
								validateSchema(obj, schema.disallow[i], names);
							} catch(err) {
								// validation failed
								continue;
							}
							throwInvalidType(names, obj, 'neither ' + schema.disallow.map(prettyType).join(' nor '));
							// TOOD: consider propagating error message upwards
							break;
					}
				}
				break;
		}
	}
}

function validateEnum(obj, schema, names) {
	//console.log('***', names, 'validateEnum');
	if (schema['enum'] !== undefined) {
		for (var i = 0; i < schema['enum'].length; ++i) {
			if (deepEquals(obj, schema['enum'][i])) {
				return;
			}
		}
		throw new Error('JSON object' + getName(names) + ' is not in enum');
	}
}

function validateArray(obj, schema, names) {
	//console.log('***', names, 'validateArray');
	var i, j;

	if (schema.minItems !== undefined) {
		if (obj.length < schema.minItems) {
			throwInvalidAttributeValue(names, 'number of items', obj.length, 'at least ' + schema.minItems);
		}
	}

	if (schema.maxItems !== undefined) {
		if (obj.length > schema.maxItems) {
			throwInvalidAttributeValue(names, 'number of items', obj.length, 'at most ' + schema.maxItems);
		}
	}

	if (schema.items !== undefined) {
		switch (getType(schema.items)) {
			case 'object':
				// all the items in the array MUST be valid according to the schema
				for (i = 0; i < obj.length; ++i) {
					obj[i] = validateSchema(obj[i], schema.items, names.concat([ '['+i+']' ]));
				}
				break;
			case 'array':
				// each position in the instance array MUST conform to the schema in the corresponding position for this array
				var numChecks = Math.min(obj.length, schema.items.length);
				for (i = 0; i < numChecks; ++i) {
					obj[i] = validateSchema(obj[i], schema.items[i], names.concat([ '['+i+']' ]));
				}
				if (obj.length > schema.items.length) {
					if (schema.additionalItems !== undefined) {
						if (schema.additionalItems === false) {
							throwInvalidAttributeValue(names, 'number of items', obj.length, 'at most ' + schema.items.length + ' - the length of schema items');
						}
						for (; i < obj.length; ++i) {
							obj[i] = validateSchema(obj[i], schema.additionalItems, names.concat([ '['+i+']' ]));
						}
					}
				}
				break;
		}
	}

	if (schema.uniqueItems !== undefined) {
		for (i = 0; i < obj.length - 1; ++i) {
			for (j = i + 1; j < obj.length; ++j) {
				if (deepEquals(obj[i], obj[j])) {
					throw new Error('JSON object' + getName(names) + ' items are not unique: element ' + i + ' equals element ' + j);
				}
			}
		}
	}
}

function validateObject(obj, schema, names) {
	//console.log('***', names, 'validateObject');
	var prop, property;
	if (schema.properties !== undefined) {
		for (property in schema.properties) {
			prop = validateSchema(obj[property], schema.properties[property], names.concat([property]));
			if (prop === undefined) {
				delete obj[property];
			} else {
				obj[property] = prop;
			}
		}
	}

	var matchingProperties = {};
	if (schema.patternProperties !== undefined) {
		for (var reStr in schema.patternProperties) {
			var re = RegExp(reStr);
			for (property in obj) {
				if (property.match(re)) {
					matchingProperties[property] = true;
					prop = validateSchema(obj[property], schema.patternProperties[reStr], names.concat(['patternProperties./' + property + '/']));
					if (prop === undefined) {
						delete obj[property];
					} else {
						obj[property] = prop;
					}
				}
			}
		}
	}

	if (schema.additionalProperties !== undefined) {
		for (property in obj) {
			if (schema.properties !== undefined && property in schema.properties) {
				continue;
			}
			if (property in matchingProperties) {
				continue;
			}
			// additional
			if (schema.additionalProperties === false) {
				throw new Error('JSON object' + getName(names.concat([property])) + ' is not explicitly defined and therefore not allowed');
			}
			obj[property] = validateSchema(obj[property], schema.additionalProperties, names.concat([property]));
		}
	}

	if (schema.dependencies !== undefined) {
		for (property in schema.dependencies) {
			switch (getType(schema.dependencies[property])) {
				case 'string':
					// simple dependency
					if (property in obj && !(schema.dependencies[property] in obj)) {
						throw new Error('JSON object' + getName(names.concat([schema.dependencies[property]])) + ' is required by property \'' + property + '\'');
					}
					break;
				case 'array':
					// simple dependency tuple
					for (var i = 0; i < schema.dependencies[property].length; ++i) {
						if (property in obj && !(schema.dependencies[property][i] in obj)) {
							throw new Error('JSON object' + getName(names.concat([schema.dependencies[property][i]])) + ' is required by property \'' + property + '\'');
						}
					}
					break;
				case 'object':
					// schema dependency
					validateSchema(obj, schema.dependencies[property], names.concat([ '[dependencies.'+property+']' ]));
					break;
			}
		}
	}
}

function validateNumber(obj, schema, names) {
	//console.log('***', names, 'validateNumber');

	if (schema.minimum !== undefined) {
		if (schema.exclusiveMinimum ? obj <= schema.minimum : obj < schema.minimum) {
			throwInvalidValue(names, obj, (schema.exclusiveMinimum ? 'greater than' : 'at least') + ' ' + schema.minimum);
		}
	}

	if (schema.maximum !== undefined) {
		if (schema.exclusiveMaximum ? obj >= schema.maximum : obj > schema.maximum) {
			throwInvalidValue(names, obj, (schema.exclusiveMaximum ? 'less than' : 'at most') + ' ' + schema.maximum);
		}
	}

	if (schema.divisibleBy !== undefined) {
		if (!isOfType(obj / schema.divisibleBy, 'integer')) {
			throwInvalidValue(names, obj, 'divisible by ' + schema.divisibleBy);
		}
	}
}

function validateString(obj, schema, names) {
	//console.log('***', names, 'validateString');

	if (schema.minLength !== undefined) {
		if (obj.length < schema.minLength) {
			throwInvalidAttributeValue(names, 'length', obj.length, 'at least ' + schema.minLength);
		}
	}

	if (schema.maxLength !== undefined) {
		if (obj.length > schema.maxLength) {
			throwInvalidAttributeValue(names, 'length', obj.length, 'at most ' + schema.maxLength);
		}
	}

	if (schema.pattern !== undefined) {
		if (!obj.match(RegExp(schema.pattern))) {
			throw new Error('JSON object' + getName(names) + ' does not match pattern');
		}
	}
}

function validateFormat(obj, schema, names) {
	//console.log('***', names, 'validateFormat');
	if (schema.format !== undefined) {
		var format = formats[schema.format];
		if (format !== undefined) {
			var conforms = true;
			if (format.regex) {
				conforms = obj.match(format.regex);
			} else if (format.func) {
				conforms = format.func(obj);
			}
			if (!conforms) {
				throw new Error('JSON object' + getName(names) + ' does not conform to the \'' + schema.format + '\' format');
			}
		}
	}
}

function validateItem(obj, schema, names) {
	//console.log('***', names, 'validateItem');
	switch (getType(obj)) {
		case 'number':
		case 'integer':
			validateNumber(obj, schema, names);
			break;
		case 'string':
			validateString(obj, schema, names);
			break;
	}

	validateFormat(obj, schema, names);
}

function validateSchema(obj, schema, names) {
	//console.log('***', names, 'validateSchema');

	validateRequired(obj, schema, names);
	if (obj === undefined) {
		obj = applyDefault(obj, schema, names);
	}
	if (obj !== undefined) {
		validateType(obj, schema, names);
		validateDisallow(obj, schema, names);
		validateEnum(obj, schema, names);

		switch (getType(obj)) {
			case 'object':
				validateObject(obj, schema, names);
				break;
			case 'array':
				validateArray(obj, schema, names);
				break;
			default:
				validateItem(obj, schema, names);
		}
	}

	return obj;
}

// Two operation modes:
// * Synchronous - done callback is not provided. will return nothing or throw error
// * Asynchronous - done callback is provided. will not throw error.
//        will call callback with error as first parameter and object as second
// Schema is expected to be validated.
module.exports = function(obj, schema, done) {
	try {
		validateSchema(obj, schema, []);
	} catch(err) {
		if (done) {
			done(err);
			return;
		} else {
			throw err;
		}
	} 

	if (done) {
		done(null, obj);
	}
};

},{"./common":43,"./formats":44}],47:[function(require,module,exports){
var formats = require('./formats').formats;
var common = require('./common'),
	getType = common.getType,
	prettyType = common.prettyType,
	isOfType = common.isOfType,
	getName = common.getName,
	validateObjectVsSchema = require('./valid-object');

function throwInvalidType(names, attribFullName, value, expected) {
	throw new Error('Schema' + getName(names) + ': ' + attribFullName + ' is ' + prettyType(getType(value)) + ' when it should be ' + expected);
}

function assertType(schema, attribName, expectedType, names) {
	if (schema[attribName] !== undefined) {
		if (!isOfType(schema[attribName], expectedType)) {
			throwInvalidType(names, '\'' + attribName + '\' attribute', schema[attribName], prettyType(expectedType));
		}
	}
}

function validateRequired(schema, names) {
	assertType(schema, 'required', 'boolean', names);
}

function validateDefault(schema, names) {
	if (schema.default !== undefined) {
		try {
			validateObjectVsSchema(schema.default, schema);
		} catch(err) {
			throw new Error('Schema' + getName(names) + ': \'default\' attribute value is not valid according to the schema: ' + err.message);
		}
	}
}

function validateType(schema, names) {
	if (schema.type !== undefined) {
		switch (getType(schema.type)) {
			case 'string':
				// simple type - nothing to validate
				break;
			case 'array':
				// union type
				if (schema.type.length < 2) {
					throw new Error('Schema' + getName(names) + ': \'type\' attribute union length is ' + schema.type.length + ' when it should be at least 2');
				}
				for (var i = 0; i < schema.type.length; ++i) {
					switch (getType(schema.type[i])) {
						case 'string':
							// simple type (inside union type) - nothing to validate
							break;
						case 'object':
							// schema (inside union type)
							try {
								validateSchema(schema.type[i], []);
							} catch(err) {
								throw new Error('Schema' + getName(names) + ': \'type\' attribute union element ' + i + ' is not a valid schema: ' + err.message);
							}
							break;
						default:
							throwInvalidType(names, '\'type\' attribute union element ' + i, schema.type[i], 'either an object (schema) or a string');
					}
				}
				break;
			default:
				throwInvalidType(names, '\'type\' attribute', schema.type, 'either a string or an array');
		}
	}
}

function validateDisallow(schema, names) {
	if (schema.disallow !== undefined) {
		switch (getType(schema.disallow)) {
			case 'string':
				// simple type - nothing to validate
				break;
			case 'array':
				// union type
				if (schema.disallow.length < 2) {
					throw new Error('Schema' + getName(names) + ': \'disallow\' attribute union length is ' + schema.disallow.length + ' when it should be at least 2');
				}
				for (var i = 0; i < schema.disallow.length; ++i) {
					switch (getType(schema.disallow[i])) {
						case 'string':
							// simple type (inside union type) - nothing to validate
							break;
						case 'object':
							// schema (inside union type)
							try {
								validateSchema(schema.disallow[i], []);
							} catch(err) {
								throw new Error('Schema' + getName(names) + ': \'disallow\' attribute union element ' + i + ' is not a valid schema: ' + err.message);
							}
							break;
						default:
							throwInvalidType(names, '\'disallow\' attribute union element ' + i, schema.disallow[i], 'either an object (schema) or a string');
					}
				}
				break;
			default:
				throwInvalidType(names, '\'disallow\' attribute', schema.disallow, 'either a string or an array');
		}
	}
}

function validateEnum(schema, names) {
	assertType(schema, 'enum', 'array', names);
}

function validateArray(schema, names) {
	assertType(schema, 'minItems', 'integer', names);
	assertType(schema, 'maxItems', 'integer', names);

	if (schema.items !== undefined) {
		var i;
		switch (getType(schema.items)) {
			case 'object':
				// all the items in the array MUST be valid according to the schema
				try {
					validateSchema(schema.items, []);
				} catch(err) {
					throw new Error('Schema' + getName(names) + ': \'items\' attribute is not a valid schema: ' + err.message);
				}
				break;
			case 'array':
				// each position in the instance array MUST conform to the schema in the corresponding position for this array
				for (i = 0; i < schema.items.length; ++i) {
					try {
						validateSchema(schema.items[i], []);
					} catch(err) {
						throw new Error('Schema' + getName(names) + ': \'items\' attribute element ' + i + ' is not a valid schema: ' + err.message);
					}
				}
				break;
			default:
				throwInvalidType(names, '\'items\' attribute', schema.items, 'either an object (schema) or an array');
		}
	}

	if (schema.additionalItems !== undefined) {
		if (schema.additionalItems === false) {
			// ok
		} else if (!isOfType(schema.additionalItems, 'object')) {
			throwInvalidType(names, '\'additionalItems\' attribute', schema.additionalItems, 'either an object (schema) or false');
		} else {
			try {
				validateSchema(schema.additionalItems, []);
			} catch(err) {
				throw new Error('Schema' + getName(names) + ': \'additionalItems\' attribute is not a valid schema: ' + err.message);
			}
		}
	}

	assertType(schema, 'uniqueItems', 'boolean', names);
}

function validateObject(schema, names) {
	assertType(schema, 'properties', 'object', names);
	if (schema.properties !== undefined) {
		for (var property in schema.properties) {
			validateSchema(schema.properties[property], names.concat([property]));
		}
	}

	assertType(schema, 'patternProperties', 'object', names);
	if (schema.patternProperties !== undefined) {
		for (var reStr in schema.patternProperties) {
			validateSchema(schema.patternProperties[reStr], names.concat(['patternProperties./' + reStr + '/']));
		}
	}

	if (schema.additionalProperties !== undefined) {
		if (schema.additionalProperties === false) {
			// ok
		} else if (!isOfType(schema.additionalProperties, 'object')) {
			throwInvalidType(names, '\'additionalProperties\' attribute', schema.additionalProperties, 'either an object (schema) or false');
		} else {
			try {
				validateSchema(schema.additionalProperties, []);
			} catch(err) {
				throw new Error('Schema' + getName(names) + ': \'additionalProperties\' attribute is not a valid schema: ' + err.message);
			}
		}
	}

	assertType(schema, 'dependencies', 'object', names);
	if (schema.dependencies !== undefined) {
		for (var property in schema.dependencies) {
			switch (getType(schema.dependencies[property])) {
				case 'string':
					// simple dependency - nothing to validate
					break;
				case 'array':
					// simple dependency tuple
					for (var i = 0; i < schema.dependencies[property].length; ++i) {
						if (isOfType(schema.dependencies[property][i], 'string')) {
							// simple dependency (inside array) - nothing to validate
						} else {
							throwInvalidType(names, '\'dependencies\' attribute: value of property \'' + property + '\' element ' + i, schema.dependencies[property][i], 'a string');
						}
					}
					break;
				case 'object':
					// schema dependency
					try {
						validateSchema(schema.dependencies[property], []);
					} catch(err) {
						throw new Error('Schema' + getName(names) + ': \'dependencies\' attribute: value of property \'' + property + '\' is not a valid schema: ' + err.message);
					}
					break;
				default:
					throwInvalidType(names, '\'dependencies\' attribute: value of property \'' + property + '\'', schema.dependencies[property], 'either a string, an array or an object (schema)');
			}
		}
	}
}

function validateNumber(schema, names) {
	assertType(schema, 'minimum', 'number', names);
	assertType(schema, 'exclusiveMinimum', 'boolean', names);
	assertType(schema, 'maximum', 'number', names);
	assertType(schema, 'exclusiveMaximum', 'boolean', names);
	assertType(schema, 'divisibleBy', 'number', names);
	if (schema.divisibleBy !== undefined) {
		if (schema.divisibleBy === 0) {
			throw new Error('Schema' + getName(names) + ': \'divisibleBy\' attribute must not be 0');
		}
	}
};

function validateString(schema, names) {
	assertType(schema, 'minLength', 'integer', names);
	assertType(schema, 'maxLength', 'integer', names);
	assertType(schema, 'pattern', 'string', names);
}

function validateFormat(schema, names) {
	assertType(schema, 'format', 'string', names);

	if (schema.format !== undefined) {
		if (schema.format in formats) {
			if (formats[schema.format].types.indexOf(schema.type) === -1) {
				throw new Error('Schema' + getName(names) + ': \'type\' attribute does not conform to the \'' + schema.format + '\' format');
			}
		}
	}
}

function validateItem(schema, names) {
	validateNumber(schema, names);
	validateString(schema, names);
	validateFormat(schema, names);
}

function validateSchema(schema, names) {
	if (!isOfType(schema, 'object')) {
		throw new Error('Schema' + getName(names) + ' is ' + prettyType(getType(schema)) + ' when it should be an object');
	}
	validateRequired(schema, names);
	validateType(schema, names);
	validateDisallow(schema, names);
	validateEnum(schema, names);
	validateObject(schema, names);
	validateArray(schema, names);
	validateItem(schema, names);
	// defaults are applied last after schema is validated
	validateDefault(schema, names);
}

module.exports = function(schema) {
	if (schema === undefined) {
		throw new Error('Schema is undefined');
	}

	// validate schema parameters for object root
	if (!isOfType(schema, 'object')) {
		throw new Error('Schema is ' + prettyType(getType(schema)) + ' when it should be an object');
	}

	validateSchema(schema, []);
};

},{"./common":43,"./formats":44,"./valid-object":46}],48:[function(require,module,exports){
(function (global){

var rng;

if (global.crypto && crypto.getRandomValues) {
  // WHATWG crypto-based RNG - http://wiki.whatwg.org/wiki/Crypto
  // Moderately fast, high quality
  var _rnds8 = new Uint8Array(16);
  rng = function whatwgRNG() {
    crypto.getRandomValues(_rnds8);
    return _rnds8;
  };
}

if (!rng) {
  // Math.random()-based (RNG)
  //
  // If all else fails, use Math.random().  It's fast, but is of unspecified
  // quality.
  var  _rnds = new Array(16);
  rng = function() {
    for (var i = 0, r; i < 16; i++) {
      if ((i & 0x03) === 0) r = Math.random() * 0x100000000;
      _rnds[i] = r >>> ((i & 0x03) << 3) & 0xff;
    }

    return _rnds;
  };
}

module.exports = rng;


}).call(this,typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{}],49:[function(require,module,exports){
//     uuid.js
//
//     Copyright (c) 2010-2012 Robert Kieffer
//     MIT License - http://opensource.org/licenses/mit-license.php

// Unique ID creation requires a high quality random # generator.  We feature
// detect to determine the best RNG source, normalizing to a function that
// returns 128-bits of randomness, since that's what's usually required
var _rng = require('./rng');

// Maps for number <-> hex string conversion
var _byteToHex = [];
var _hexToByte = {};
for (var i = 0; i < 256; i++) {
  _byteToHex[i] = (i + 0x100).toString(16).substr(1);
  _hexToByte[_byteToHex[i]] = i;
}

// **`parse()` - Parse a UUID into it's component bytes**
function parse(s, buf, offset) {
  var i = (buf && offset) || 0, ii = 0;

  buf = buf || [];
  s.toLowerCase().replace(/[0-9a-f]{2}/g, function(oct) {
    if (ii < 16) { // Don't overflow!
      buf[i + ii++] = _hexToByte[oct];
    }
  });

  // Zero out remaining bytes if string was short
  while (ii < 16) {
    buf[i + ii++] = 0;
  }

  return buf;
}

// **`unparse()` - Convert UUID byte array (ala parse()) into a string**
function unparse(buf, offset) {
  var i = offset || 0, bth = _byteToHex;
  return  bth[buf[i++]] + bth[buf[i++]] +
          bth[buf[i++]] + bth[buf[i++]] + '-' +
          bth[buf[i++]] + bth[buf[i++]] + '-' +
          bth[buf[i++]] + bth[buf[i++]] + '-' +
          bth[buf[i++]] + bth[buf[i++]] + '-' +
          bth[buf[i++]] + bth[buf[i++]] +
          bth[buf[i++]] + bth[buf[i++]] +
          bth[buf[i++]] + bth[buf[i++]];
}

// **`v1()` - Generate time-based UUID**
//
// Inspired by https://github.com/LiosK/UUID.js
// and http://docs.python.org/library/uuid.html

// random #'s we need to init node and clockseq
var _seedBytes = _rng();

// Per 4.5, create and 48-bit node id, (47 random bits + multicast bit = 1)
var _nodeId = [
  _seedBytes[0] | 0x01,
  _seedBytes[1], _seedBytes[2], _seedBytes[3], _seedBytes[4], _seedBytes[5]
];

// Per 4.2.2, randomize (14 bit) clockseq
var _clockseq = (_seedBytes[6] << 8 | _seedBytes[7]) & 0x3fff;

// Previous uuid creation time
var _lastMSecs = 0, _lastNSecs = 0;

// See https://github.com/broofa/node-uuid for API details
function v1(options, buf, offset) {
  var i = buf && offset || 0;
  var b = buf || [];

  options = options || {};

  var clockseq = options.clockseq !== undefined ? options.clockseq : _clockseq;

  // UUID timestamps are 100 nano-second units since the Gregorian epoch,
  // (1582-10-15 00:00).  JSNumbers aren't precise enough for this, so
  // time is handled internally as 'msecs' (integer milliseconds) and 'nsecs'
  // (100-nanoseconds offset from msecs) since unix epoch, 1970-01-01 00:00.
  var msecs = options.msecs !== undefined ? options.msecs : new Date().getTime();

  // Per 4.2.1.2, use count of uuid's generated during the current clock
  // cycle to simulate higher resolution clock
  var nsecs = options.nsecs !== undefined ? options.nsecs : _lastNSecs + 1;

  // Time since last uuid creation (in msecs)
  var dt = (msecs - _lastMSecs) + (nsecs - _lastNSecs)/10000;

  // Per 4.2.1.2, Bump clockseq on clock regression
  if (dt < 0 && options.clockseq === undefined) {
    clockseq = clockseq + 1 & 0x3fff;
  }

  // Reset nsecs if clock regresses (new clockseq) or we've moved onto a new
  // time interval
  if ((dt < 0 || msecs > _lastMSecs) && options.nsecs === undefined) {
    nsecs = 0;
  }

  // Per 4.2.1.2 Throw error if too many uuids are requested
  if (nsecs >= 10000) {
    throw new Error('uuid.v1(): Can\'t create more than 10M uuids/sec');
  }

  _lastMSecs = msecs;
  _lastNSecs = nsecs;
  _clockseq = clockseq;

  // Per 4.1.4 - Convert from unix epoch to Gregorian epoch
  msecs += 12219292800000;

  // `time_low`
  var tl = ((msecs & 0xfffffff) * 10000 + nsecs) % 0x100000000;
  b[i++] = tl >>> 24 & 0xff;
  b[i++] = tl >>> 16 & 0xff;
  b[i++] = tl >>> 8 & 0xff;
  b[i++] = tl & 0xff;

  // `time_mid`
  var tmh = (msecs / 0x100000000 * 10000) & 0xfffffff;
  b[i++] = tmh >>> 8 & 0xff;
  b[i++] = tmh & 0xff;

  // `time_high_and_version`
  b[i++] = tmh >>> 24 & 0xf | 0x10; // include version
  b[i++] = tmh >>> 16 & 0xff;

  // `clock_seq_hi_and_reserved` (Per 4.2.2 - include variant)
  b[i++] = clockseq >>> 8 | 0x80;

  // `clock_seq_low`
  b[i++] = clockseq & 0xff;

  // `node`
  var node = options.node || _nodeId;
  for (var n = 0; n < 6; n++) {
    b[i + n] = node[n];
  }

  return buf ? buf : unparse(b);
}

// **`v4()` - Generate random UUID**

// See https://github.com/broofa/node-uuid for API details
function v4(options, buf, offset) {
  // Deprecated - 'format' argument, as supported in v1.2
  var i = buf && offset || 0;

  if (typeof(options) == 'string') {
    buf = options == 'binary' ? new Array(16) : null;
    options = null;
  }
  options = options || {};

  var rnds = options.random || (options.rng || _rng)();

  // Per 4.4, set bits for version and `clock_seq_hi_and_reserved`
  rnds[6] = (rnds[6] & 0x0f) | 0x40;
  rnds[8] = (rnds[8] & 0x3f) | 0x80;

  // Copy bytes to buffer, if provided
  if (buf) {
    for (var ii = 0; ii < 16; ii++) {
      buf[i + ii] = rnds[ii];
    }
  }

  return buf || unparse(rnds);
}

// Export public API
var uuid = v4;
uuid.v1 = v1;
uuid.v4 = v4;
uuid.parse = parse;
uuid.unparse = unparse;

module.exports = uuid;

},{"./rng":48}],50:[function(require,module,exports){
module.exports={
  "type": "object",
  "title": "Chiχ Link",
  "properties": {
    "id": {
      "type": "string",
      "required": false
    },
    "source": {
      "type": "object",
      "required": true,
      "properties": {
        "id": {
          "type": "string",
          "required": true
        },
        "port": {
          "type": "string",
          "required": true
        },
        "index": {
          "type": ["string", "number"],
          "required": false
        },
        "settings": {
          "type": "object"
        }
      }
    },
    "target": {
      "type": "object",
      "required": true,
      "properties": {
        "id": {
          "type": "string",
          "required": true
        },
        "port": {
          "type": "string",
          "required": true
        },
        "index": {
          "type": ["string", "number"],
          "required": false
        },
        "settings": {
          "type": "object",
          "properties": {
            "persist": {
              "type": "boolean"
            },
            "sync": {
              "type": "string"
            },
            "cyclic": {
              "type": "boolean"
            }
          }
        }
      }
    },
    "settings": {
      "type": "object",
      "properties": {
        "dispose": {
          "type": "boolean"
        }
      }
    },
    "metadata": {
      "type": "object"
    }
  },
  "additionalProperties": false
}

},{}],51:[function(require,module,exports){
module.exports={
  "type":"object",
  "title":"Chiχ Map",
  "collectionName": "flows",
  "properties":{
    "id": {
      "type":"string",
      "required": false
    },
    "type": {
      "type":"string",
      "required": true
    },
    "env": {
      "type":"string",
      "required": false
    },
    "ns": {
      "type":"string",
      "required": false
    },
    "name": {
      "type":"string",
      "required": false
    },
    "title": {
      "type":"string",
      "required": false
    },
    "description": {
      "type":"string"
    },
    "provider": {
      "type":"string"
    },
    "providers": {
      "type":"object"
    },
    "keywords": {
      "type":"array"
    },
    "nodeDefinitions": {
      "type": "object"
    },
    "ports": {
      "type":"object",
      "properties": {
        "input": {
          "type":"object"
        },
        "output": {
          "type":"object"
        }
      }
    },
    "nodes": {
      "type":"array",
      "title":"Nodes",
      "required": true,
      "items": {
        "type": "object",
        "title": "Node",
        "properties":{
          "id": {
            "type":"string",
            "required": true
          },
          "ns": {
            "type":"string",
            "required": true
          },
          "name": {
            "type":"string",
            "required": true
          },
          "version": {
            "type":"string",
            "required": false
          },
          "context": {
            "type":"object",
            "required": false
          }
        }
      }
    },
    "links": {
      "type":"array",
      "title":"Links",
      "required": false,
      "items": {
        "type": "object",
        "title": "Link",
        "properties":{
          "id": {
            "type":"string",
            "required": false
          },
          "source": {
            "type":"object",
            "required": true,
             "properties":{
               "id": {
                 "type": "string",
                 "required": true
               },
               "port": {
                 "type": "string",
                 "required": true
               },
               "index": {
                 "type": ["string","number"],
                 "required": false
               }
             }
          },
          "target": {
            "type":"object",
            "required": true,
             "properties":{
               "id": {
                 "type": "string",
                 "required": true
               },
               "port": {
                 "type": "string",
                 "required": true
               },
               "index": {
                 "type": ["string","number"],
                 "required": false
               }
             }
          },
          "settings": {
            "persist": {
              "type":"boolean",
              "required": false
            },
            "cyclic": {
              "type":"boolean",
              "required": false
            }
          }
        }
      }
    }
  },
  "additionalProperties": false
}

},{}],52:[function(require,module,exports){
module.exports={
  "type":"object",
  "title":"Chiχ Nodes",
  "properties":{
    "title": {
      "type":"string",
      "required": false
    },
    "description": {
      "type":"string",
      "required": false
    },
    "_id": {
      "type":"string"
    },
    "name": {
      "type":"string",
      "required": true
    },
    "ns": {
      "type":"string",
      "required": true
    },
    "state": {
      "type":"any"
    },
    "phrases": {
      "type":"object"
    },
    "env": {
      "type":"string",
      "enum": ["server","browser","polymer","phonegap"]
    },
    "async": {
      "type":"boolean",
      "required": false
    },
    "dependencies": {
      "type":"object",
      "required": false
    },
    "provider": {
      "required": false,
      "type":"string"
    },
    "providers": {
      "required": false,
      "type":"object"
    },
    "expose": {
      "type":"array",
      "required": false
    },
    "fn": {
      "type":"string",
      "required": false
    },
    "ports": {
      "type":"object",
      "required": true,
      "properties":{
        "input": {
          "type":"object"
        },
        "output": {
          "type":"object"
        },
        "event": {
          "type":"object"
        }
      }
    },
    "type": {
      "enum":["node","flow","provider","data","polymer"],
      "required": false
    }
  },
  "additionalProperties": false
}

},{}],53:[function(require,module,exports){
module.exports={
  "type":"object",
  "title":"Chiχ Stage",
  "properties":{
    "id": {
      "type":"string",
      "required": false
    },
    "env": {
      "type":"string",
      "required": false
    },
    "title": {
      "type":"string",
      "required": true
    },
    "description": {
      "type":"string",
      "required": true
    },
    "actors": {
      "type":"array",
      "title":"Actors",
      "required": true,
      "items": {
        "type": "object",
        "title": "Actor",
        "properties":{
          "id": {
            "type":"string",
            "required": true
          },
          "ns": {
            "type":"string",
            "required": true
          },
          "name": {
            "type":"string",
            "required": true
          },
          "version": {
            "type":"string",
            "required": false
          },
          "context": {
            "type":"object",
            "required": false
          }
        }
      }
    },
    "links": {
      "type":"array",
      "title":"Links",
      "required": true,
      "items": {
        "type": "object",
        "title": "Link",
        "properties":{
          "id": {
            "type":"string",
            "required": false
          },
          "source": {
            "type":"string",
            "required": true
          },
          "target": {
            "type":"string",
            "required": true
          },
          "out": {
            "type":"string",
            "required": false
          },
          "in": {
            "type":"string",
            "required": false
          },
          "settings": {
            "persist": {
              "type":"boolean",
              "required": false
            },
            "cyclic": {
              "type":"boolean",
              "required": false
            }
          }
        }
      }
    }
  }
}

},{}],54:[function(require,module,exports){
'use strict';

/**
 *
 * Ok, this should be a general listener interface.
 *
 * One who will use it is the Actor.
 * But I want to be able to do the same for e.g. Loader.
 *
 * They will all be in chix-monitor-*
 *
 * npmlog =  Listener(instance, options);
 *
 * The return is just in case you want to do other stuff.
 *
 * e.g. fbpx wants to add this to npmlog:
 *
 * Logger.level = program.verbose ? 'verbose' : program.debug;
 *
 */
// function NpmLogActorMonitor(actor, opts) {
module.exports = function NpmLogActorMonitor(Logger, actor) {

   // TODO: just make an NpmLogIOMonitor.
   var ioHandler = actor.ioHandler;

   actor.on('removeLink', function(event) {
     Logger.debug(
       event.node ? event.node.identifier : 'Some Actor',
       'removed link'
     );
   });

   // Ok emiting each and every output I don't like for the IOHandler.
   // but whatever can change it later.
   ioHandler.on('output', function(data) {

     // I don't like this data.out.port thing vs data.port
     switch(data.port) {

        case ':plug':
         Logger.debug(
           data.node.identifier,
           'port %s plugged (%d)',
           data.out.read().port,
           data.out.read().connections);
        break;

        case ':unplug':
         Logger.debug(
           data.node.identifier,
           'port %s unplugged (%d)',
           data.out.read().port,
           data.out.read().connections);
        break;

        case ':portFill':
         Logger.info(
           data.node.identifier,
           'port %s filled with data',
           data.out.read().port);
        break;

        case ':contextUpdate':
         Logger.info(
           data.node.identifier,
           'port %s filled with context',
           data.out.read().port);
        break;

        case ':inputValidated':
          Logger.debug(data.node.identifier, 'input validated');
        break;

        case ':start':
          Logger.info(data.node.identifier, 'START');
        break;

        case ':freePort':
          Logger.debug(data.node.identifier, 'free port %s', data.out.read().port);
        break;

/*
       case ':queue':
         Logger.debug(
           data.node,
           'queue: %s',
           data.port
         );
       break;
*/

       case ':openPort':
         Logger.info(
           data.node.identifier,
           'opened port %s (%d)',
           data.out.read().port,
           data.out.read().connections
           );
       break;

       case ':closePort':
         Logger.info(
           data.node.identifier,
           'closed port %s',
           data.out.read().port
           );
       break;

       case ':index':
         Logger.info(
           data.node.identifier,
           '[%s] set on port `%s`',
           data.out.read().index,
           data.out.read().port
           );
       break;

       case ':nodeComplete':
         // console.log('nodeComplete', data);
         Logger.info(data.node.identifier, 'completed');
       break;

       case ':portReject':
         Logger.debug(
           data.node.identifier,
           'rejected input on port %s',
           data.out.read().port
         );
       break;

       case ':inputRequired':
         Logger.error(
           data.node.identifier,
           'input required on port %s',
           data.out.read().port);
       break;

       case ':error':
         Logger.error(
           data.node.identifier,
           data.out.read().msg
         );
       break;

       case ':nodeTimeout':
         Logger.error(
           data.node.identifier,
           'node timeout'
         );
       break;

       case ':executed':
         Logger.info(
           data.node.identifier,
           'EXECUTED'
         );
       break;

       case ':inputTimeout':
         Logger.info(
           data.node.identifier,
           'input timeout, got %s need %s',
           Object.keys(data.node.input).join(', '),
           data.node.openPorts.join(', '));
       break;

       default:
         // TODO: if the above misses a system port it will be reported
         //       as default normal output.
         Logger.info(data.node.identifier, 'output on port %s', data.port);
       break;

     }

   });

   return Logger;

};

},{}],55:[function(require,module,exports){
'use strict';

/**
 *
 * NpmLog monitor for the Loader
 *
 */
module.exports = function NpmLogLoaderMonitor(Logger, loader) {

  loader.on('loadUrl', function(data) {
    Logger.info( 'loadUrl', data.url);
  });

  loader.on('loadFile', function(data) {
    Logger.info( 'loadFile', data.path);
  });

  loader.on('loadCache', function(data) {
    Logger.debug( 'cache', 'loaded cache file %s', data.file);
  });

  loader.on('purgeCache', function(data) {
    Logger.debug( 'cache', 'purged cache file %s', data.file);
  });

  loader.on('writeCache', function(data) {
    Logger.debug( 'cache', 'wrote cache file %s', data.file);
  });

  return Logger;

};

},{}],"chix-monitor-npmlog":[function(require,module,exports){
module.exports=require('HNG52E');
},{}],"HNG52E":[function(require,module,exports){
exports.Actor = require('./lib/actor');
exports.Loader = require('./lib/loader');

},{"./lib/actor":54,"./lib/loader":55}],"UsqOEx":[function(require,module,exports){

/**
 * Expose `parse`.
 */

module.exports = parse;

/**
 * Tests for browser support.
 */

var div = document.createElement('div');
// Setup
div.innerHTML = '  <link/><table></table><a href="/a">a</a><input type="checkbox"/>';
// Make sure that link elements get serialized correctly by innerHTML
// This requires a wrapper element in IE
var innerHTMLBug = !div.getElementsByTagName('link').length;
div = undefined;

/**
 * Wrap map from jquery.
 */

var map = {
  legend: [1, '<fieldset>', '</fieldset>'],
  tr: [2, '<table><tbody>', '</tbody></table>'],
  col: [2, '<table><tbody></tbody><colgroup>', '</colgroup></table>'],
  // for script/link/style tags to work in IE6-8, you have to wrap
  // in a div with a non-whitespace character in front, ha!
  _default: innerHTMLBug ? [1, 'X<div>', '</div>'] : [0, '', '']
};

map.td =
map.th = [3, '<table><tbody><tr>', '</tr></tbody></table>'];

map.option =
map.optgroup = [1, '<select multiple="multiple">', '</select>'];

map.thead =
map.tbody =
map.colgroup =
map.caption =
map.tfoot = [1, '<table>', '</table>'];

map.text =
map.circle =
map.ellipse =
map.line =
map.path =
map.polygon =
map.polyline =
map.rect = [1, '<svg xmlns="http://www.w3.org/2000/svg" version="1.1">','</svg>'];

/**
 * Parse `html` and return a DOM Node instance, which could be a TextNode,
 * HTML DOM Node of some kind (<div> for example), or a DocumentFragment
 * instance, depending on the contents of the `html` string.
 *
 * @param {String} html - HTML string to "domify"
 * @param {Document} doc - The `document` instance to create the Node for
 * @return {DOMNode} the TextNode, DOM Node, or DocumentFragment instance
 * @api private
 */

function parse(html, doc) {
  if ('string' != typeof html) throw new TypeError('String expected');

  // default to the global `document` object
  if (!doc) doc = document;

  // tag name
  var m = /<([\w:]+)/.exec(html);
  if (!m) return doc.createTextNode(html);

  html = html.replace(/^\s+|\s+$/g, ''); // Remove leading/trailing whitespace

  var tag = m[1];

  // body support
  if (tag == 'body') {
    var el = doc.createElement('html');
    el.innerHTML = html;
    return el.removeChild(el.lastChild);
  }

  // wrap map
  var wrap = map[tag] || map._default;
  var depth = wrap[0];
  var prefix = wrap[1];
  var suffix = wrap[2];
  var el = doc.createElement('div');
  el.innerHTML = prefix + html + suffix;
  while (depth--) el = el.lastChild;

  // one element
  if (el.firstChild == el.lastChild) {
    return el.removeChild(el.firstChild);
  }

  // several elements
  var fragment = doc.createDocumentFragment();
  while (el.firstChild) {
    fragment.appendChild(el.removeChild(el.firstChild));
  }

  return fragment;
}

},{}],"domify":[function(require,module,exports){
module.exports=require('UsqOEx');
},{}],"dot-object":[function(require,module,exports){
module.exports=require('C/EKgi');
},{}],"C/EKgi":[function(require,module,exports){
'use strict';

function DotObject(seperator, override) {

  if (!(this instanceof DotObject)) {
    return new DotObject(seperator, override);
  }

  if (typeof seperator === 'undefined') { seperator = '.'; }
  if (typeof override === 'undefined') { override = false; }
  this.seperator = seperator;
  this.override = override;
}

DotObject.prototype._fill = function(a, obj, v, mod) {
  var k = a.shift();

  if (a.length > 0) {
    obj[k] = obj[k] || {};

    if (obj[k] !== Object(obj[k])) {
      if (this.override) {
        obj[k] = {};
      } else {
        throw new Error(
          'Trying to redefine `' + k + '` which is a ' + typeof obj[k]
        );
      }
    }

    this._fill(a, obj[k], v, mod);
  } else {
    if (obj[k] === Object(obj[k]) && Object.keys(obj[k]).length) {
      throw new Error('Trying to redefine non-empty obj[\'' + k + '\']');
    }

    obj[k] = this.process(v, mod);
  }
};

DotObject.prototype.process = function(v, mod) {
  var i;

  if (typeof mod === 'function') {
    v = mod(v);
  } else if (mod instanceof Array) {
    for (i = 0; i < mod.length; i++) {
      v = mod[i](v);
    }
  }

  return v;
};

DotObject.prototype.object = function(obj, mods) {
  var self = this;

  Object.keys(obj).forEach(function(k) {
    var mod = mods === undefined ? null : mods[k];

    if (k.indexOf(self.seperator) !== -1) {
      self._fill(k.split(self.seperator), obj, obj[k], mod);
      delete obj[k];
    } else if (self.override) {
      obj[k] = self.process(obj[k], mod);
    }
  });
};

/**
 *
 * @param {String} str
 * @param {String} v
 * @param {Object} obj
 * @param {Function|Array} mod
 *
 */
DotObject.prototype.str = function(str, v, obj, mod) {
  if (str.indexOf(this.seperator) !== -1) {
    this._fill(str.split(this.seperator), obj, v, mod);
  } else if (this.override) {
    obj[str] = this.process(v, mod);
  }
};

/**
 *
 * Pick a value from an object using dot notation.
 *
 * Optionally remove the value
 *
 * @param {String} path
 * @param {Object} obj
 * @param {Boolean} remove
 */
DotObject.prototype.pick = function(path, obj, remove) {
  var i;
  var keys;
  var val;

  if (path.indexOf(this.seperator) !== -1) {
    keys = path.split(this.seperator);
    for (i = 0; i < keys.length; i++) {
      if (obj.hasOwnProperty(keys[i])) {
        if (i === (keys.length - 1)) {
          if (remove) {
            val = obj[keys[i]];
            delete obj[keys[i]];
            return val;
          } else {
            return obj[keys[i]];
          }
        } else {
          obj = obj[keys[i]];
        }
      } else {
        return undefined;
      }
    }
    return obj;
  } else {
    if (remove) {
      val = obj[path];
      delete obj[path];
      return val;
    } else {
      return obj[path];
    }
  }
};

/**
 *
 * Move a property from one place to the other.
 *
 * If the source path does not exist (undefined)
 * the target property will not be set.
 *
 * @param {String} source
 * @param {String} target
 * @param {Object} obj
 * @param {Boolean} merge
 *
 */
DotObject.prototype.move = function(source, target, obj, merge) {

  this.set(target, this.pick(source, obj, true), obj, merge);

  return obj;

};

/**
 *
 * Transfer a property from one object to another object.
 *
 * If the source path does not exist (undefined)
 * the property on the other object will not be set.
 *
 * @param {String} source
 * @param {String} target
 * @param {Object} obj1
 * @param {Object} obj2
 * @param {Boolean} merge
 */
DotObject.prototype.transfer = function(source, target, obj1, obj2, merge) {

  this.set(target, this.pick(source, obj1, true), obj2, merge);

  return obj2;

};

/**
 *
 * Copy a property from one object to another object.
 *
 * If the source path does not exist (undefined)
 * the property on the other object will not be set.
 *
 * @param {String} source
 * @param {String} target
 * @param {Object} obj1
 * @param {Object} obj2
 * @param {Boolean} merge
 */
DotObject.prototype.copy = function(source, target, obj1, obj2, merge) {

  this.set(target, this.pick(source, obj1, false), obj2, merge);

  return obj2;

};

function isObject(val) {
  return Object.prototype.toString.call(val) === '[object Object]';
}

/**
 *
 * Set a property on an object using dot notation.
 *
 * @param {String} path
 * @param {Mixed} val
 * @param {Object} obj
 * @param {Boolean} merge
 */
DotObject.prototype.set = function(path, val, obj, merge) {
  var i;
  var k;
  var keys;

  // Do not operate if the value is undefined.
  if (typeof val === 'undefined') {
    return obj;
  }

  if (path.indexOf(this.seperator) !== -1) {
    keys = path.split(this.seperator);
    for (i = 0; i < keys.length; i++) {
      if (i === (keys.length - 1)) {
        if (merge && isObject(val) && isObject(obj[keys[i]])) {
          for (k in val) {
            if (val.hasOwnProperty(k)) {
              obj[keys[i]][k] = val[k];
            }
          }

        } else if (Array.isArray(obj[keys[i]]) && Array.isArray(val)) {
          for (var j = 0; j < val.length; j++) {
            obj[keys[i]].push(val[j]);
          }
        } else {
          obj[keys[i]] = val;
        }
      } else if (
        // force the value to be an object
        !obj.hasOwnProperty(keys[i]) ||
        !isObject(obj[keys[i]])) {
        obj[keys[i]] = {};
      }
      obj = obj[keys[i]];
    }
    return obj;
  } else {
    if (merge && isObject(val)) {
      for (k in val) {
        if (val.hasOwnProperty(k)) {
          obj[path][k] = val[k];
        }
      }
    } else if (Array.isArray(obj[path]) && Array.isArray(val)) {
      obj[path].push(val);
    } else {
      obj[path] = val;
    }
    return obj;
  }
};

module.exports = DotObject;

},{}],"json-editor":[function(require,module,exports){
module.exports=require('pRDjjY');
},{}],"pRDjjY":[function(require,module,exports){
/*! JSON Editor v0.7.13 - JSON Schema -> HTML Editor
 * By Jeremy Dorn - https://github.com/jdorn/json-editor/
 * Released under the MIT license
 *
 * Date: 2014-11-11
 */

/**
 * See README.md for requirements and usage info
 */

(function() {

/*jshint loopfunc: true */
/* Simple JavaScript Inheritance
 * By John Resig http://ejohn.org/
 * MIT Licensed.
 */
// Inspired by base2 and Prototype
var Class;
(function(){
  var initializing = false, fnTest = /xyz/.test(function(){window.postMessage("xyz");}) ? /\b_super\b/ : /.*/;

  // The base Class implementation (does nothing)
  Class = function(){};

  // Create a new Class that inherits from this class
  Class.extend = function(prop) {
    var _super = this.prototype;

    // Instantiate a base class (but only create the instance,
    // don't run the init constructor)
    initializing = true;
    var prototype = new this();
    initializing = false;

    // Copy the properties over onto the new prototype
    for (var name in prop) {
      // Check if we're overwriting an existing function
      prototype[name] = typeof prop[name] == "function" &&
        typeof _super[name] == "function" && fnTest.test(prop[name]) ?
        (function(name, fn){
          return function() {
            var tmp = this._super;

            // Add a new ._super() method that is the same method
            // but on the super-class
            this._super = _super[name];

            // The method only need to be bound temporarily, so we
            // remove it when we're done executing
            var ret = fn.apply(this, arguments);
            this._super = tmp;

            return ret;
          };
        })(name, prop[name]) :
        prop[name];
    }

    // The dummy class constructor
    function Class() {
      // All construction is actually done in the init method
      if ( !initializing && this.init )
        this.init.apply(this, arguments);
    }

    // Populate our constructed prototype object
    Class.prototype = prototype;

    // Enforce the constructor to be what we expect
    Class.prototype.constructor = Class;

    // And make this class extendable
    Class.extend = arguments.callee;

    return Class;
  };

  return Class;
})();

// CustomEvent constructor polyfill
// From MDN
(function () {
  function CustomEvent ( event, params ) {
    params = params || { bubbles: false, cancelable: false, detail: undefined };
    var evt = document.createEvent( 'CustomEvent' );
    evt.initCustomEvent( event, params.bubbles, params.cancelable, params.detail );
    return evt;
  }

  CustomEvent.prototype = window.Event.prototype;

  window.CustomEvent = CustomEvent;
})();

// requestAnimationFrame polyfill by Erik Möller. fixes from Paul Irish and Tino Zijdel
// MIT license
(function() {
    var lastTime = 0;
    var vendors = ['ms', 'moz', 'webkit', 'o'];
    for(var x = 0; x < vendors.length && !window.requestAnimationFrame; ++x) {
        window.requestAnimationFrame = window[vendors[x]+'RequestAnimationFrame'];
        window.cancelAnimationFrame = window[vendors[x]+'CancelAnimationFrame'] ||
                                      window[vendors[x]+'CancelRequestAnimationFrame'];
    }

    if (!window.requestAnimationFrame)
        window.requestAnimationFrame = function(callback, element) {
            var currTime = new Date().getTime();
            var timeToCall = Math.max(0, 16 - (currTime - lastTime));
            var id = window.setTimeout(function() { callback(currTime + timeToCall); },
              timeToCall);
            lastTime = currTime + timeToCall;
            return id;
        };

    if (!window.cancelAnimationFrame)
        window.cancelAnimationFrame = function(id) {
            clearTimeout(id);
        };
}());

// Array.isArray polyfill
// From MDN
(function() {
	if(!Array.isArray) {
	  Array.isArray = function(arg) {
		return Object.prototype.toString.call(arg) === '[object Array]';
	  };
	}
}());
var $isplainobject = function( obj ) {
  // Not own constructor property must be Object
  if ( obj.constructor &&
    !obj.hasOwnProperty('constructor') &&
    !obj.constructor.prototype.hasOwnProperty('isPrototypeOf')) {
    return false;
  }

  // Own properties are enumerated firstly, so to speed up,
  // if last one is own, then all properties are own.

  var key;
  for ( key in obj ) {}

  return key === undefined || obj.hasOwnProperty(key);
};

var $extend = function(destination) {
  var source, i,property;
  for(i=1; i<arguments.length; i++) {
    source = arguments[i];
    for (property in source) {
      if(!source.hasOwnProperty(property)) continue;
      if(source[property] && $isplainobject(source[property])) {
        if(!destination.hasOwnProperty(property)) destination[property] = {};
        $extend(destination[property], source[property]);
      }
      else {
        destination[property] = source[property];
      }
    }
  }
  return destination;
};

var $each = function(obj,callback) {
  if(!obj) return;
  var i;
  if(typeof obj.length !== 'undefined') {
    for(i=0; i<obj.length; i++) {
      if(callback(i,obj[i])===false) return;
    }
  }
  else {
    for(i in obj) {
      if(!obj.hasOwnProperty(i)) continue;
      if(callback(i,obj[i])===false) return;
    }
  }
};

var $trigger = function(el,event) {
  var e = document.createEvent('HTMLEvents');
  e.initEvent(event, true, true);
  el.dispatchEvent(e);
};
var $triggerc = function(el,event) {
  var e = new CustomEvent(event,{
    bubbles: true,
    cancelable: true
  });

  el.dispatchEvent(e);
};

function JSONEditor(element,options) {
  options = $extend({},JSONEditor.defaults.options,options||{});
  this.element = element;
  this.options = options;
  this.init();
}
JSONEditor.constructor.name = 'JSONEditor';
JSONEditor.prototype = {
  init: function() {
    var self = this;

    this.ready = false;

    var theme_class = JSONEditor.defaults.themes[this.options.theme || JSONEditor.defaults.theme];
    if(!theme_class) throw "Unknown theme " + (this.options.theme || JSONEditor.defaults.theme);

    this.schema = this.options.schema;
    this.theme = new theme_class();
    this.template = this.options.template;
    this.refs = this.options.refs || {};
    this.uuid = 0;
    this.__data = {};

    var icon_class = JSONEditor.defaults.iconlibs[this.options.iconlib || JSONEditor.defaults.iconlib];
    if(icon_class) this.iconlib = new icon_class();

    this.root_container = this.theme.getContainer();
    this.element.appendChild(this.root_container);

    this.translate = this.options.translate || JSONEditor.defaults.translate;

    // Fetch all external refs via ajax
    this._loadExternalRefs(this.schema, function() {
      self._getDefinitions(self.schema);
      self.validator = new JSONEditor.Validator(self);

      // Create the root editor
      var editor_class = self.getEditorClass(self.schema);
      self.root = self.createEditor(editor_class, {
        jsoneditor: self,
        schema: self.schema,
        required: true,
        container: self.root_container
      });

      self.root.preBuild();
      self.root.build();
      self.root.postBuild();

      // Starting data
      if(self.options.startval) self.root.setValue(self.options.startval);

      self.validation_results = self.validator.validate(self.root.getValue());
      self.root.showValidationErrors(self.validation_results);
      self.ready = true;

      // Fire ready event asynchronously
      window.requestAnimationFrame(function() {
        if(!self.ready) return;
        self.validation_results = self.validator.validate(self.root.getValue());
        self.root.showValidationErrors(self.validation_results);
        self.trigger('ready');
        self.trigger('change');
      });
    });
  },
  getValue: function() {
    if(!this.ready) throw "JSON Editor not ready yet.  Listen for 'ready' event before getting the value";

    return this.root.getValue();
  },
  setValue: function(value) {
    if(!this.ready) throw "JSON Editor not ready yet.  Listen for 'ready' event before setting the value";

    this.root.setValue(value);
    return this;
  },
  validate: function(value) {
    if(!this.ready) throw "JSON Editor not ready yet.  Listen for 'ready' event before validating";

    // Custom value
    if(arguments.length === 1) {
      return this.validator.validate(value);
    }
    // Current value (use cached result)
    else {
      return this.validation_results;
    }
  },
  destroy: function() {
    if(this.destroyed) return;
    if(!this.ready) return;

    this.schema = null;
    this.options = null;
    this.root.destroy();
    this.root = null;
    this.root_container = null;
    this.validator = null;
    this.validation_results = null;
    this.theme = null;
    this.iconlib = null;
    this.template = null;
    this.__data = null;
    this.ready = false;
    this.element.innerHTML = '';

    this.destroyed = true;
  },
  on: function(event, callback) {
    this.callbacks = this.callbacks || {};
    this.callbacks[event] = this.callbacks[event] || [];
    this.callbacks[event].push(callback);

    return this;
  },
  off: function(event, callback) {
    // Specific callback
    if(event && callback) {
      this.callbacks = this.callbacks || {};
      this.callbacks[event] = this.callbacks[event] || [];
      var newcallbacks = [];
      for(var i=0; i<this.callbacks[event].length; i++) {
        if(this.callbacks[event][i]===callback) continue;
        newcallbacks.push(this.callbacks[event][i]);
      }
      this.callbacks[event] = newcallbacks;
    }
    // All callbacks for a specific event
    else if(event) {
      this.callbacks = this.callbacks || {};
      this.callbacks[event] = [];
    }
    // All callbacks for all events
    else {
      this.callbacks = {};
    }

    return this;
  },
  trigger: function(event) {
    if(this.callbacks && this.callbacks[event] && this.callbacks[event].length) {
      for(var i=0; i<this.callbacks[event].length; i++) {
        this.callbacks[event][i]();
      }
    }

    return this;
  },
  setOption: function(option, value) {
    if(option === "show_errors") {
      this.options.show_errors = value;
      this.onChange();
    }
    // Only the `show_errors` option is supported for now
    else {
      throw "Option "+option+" must be set during instantiation and cannot be changed later";
    }

    return this;
  },
  getEditorClass: function(schema) {
    var classname;

    schema = this.expandSchema(schema);

    $each(JSONEditor.defaults.resolvers,function(i,resolver) {
      var tmp = resolver(schema);
      if(tmp) {
        if(JSONEditor.defaults.editors[tmp]) {
          classname = tmp;
          return false;
        }
      }
    });

    if(!classname) throw "Unknown editor for schema "+JSON.stringify(schema);
    if(!JSONEditor.defaults.editors[classname]) throw "Unknown editor "+classname;

    return JSONEditor.defaults.editors[classname];
  },
  createEditor: function(editor_class, options) {
    options = $extend({},editor_class.options||{},options);
    return new editor_class(options);
  },
  onChange: function() {
    if(!this.ready) return;

    if(this.firing_change) return;
    this.firing_change = true;

    var self = this;

    window.requestAnimationFrame(function() {
      self.firing_change = false;
      if(!self.ready) return;

      // Validate and cache results
      self.validation_results = self.validator.validate(self.root.getValue());

      if(self.options.show_errors !== "never") {
        self.root.showValidationErrors(self.validation_results);
      }
      else {
        self.root.showValidationErrors([]);
      }

      // Fire change event
      self.trigger('change');
    });

    return this;
  },
  compileTemplate: function(template, name) {
    name = name || JSONEditor.defaults.template;

    var engine;

    // Specifying a preset engine
    if(typeof name === 'string') {
      if(!JSONEditor.defaults.templates[name]) throw "Unknown template engine "+name;
      engine = JSONEditor.defaults.templates[name]();

      if(!engine) throw "Template engine "+name+" missing required library.";
    }
    // Specifying a custom engine
    else {
      engine = name;
    }

    if(!engine) throw "No template engine set";
    if(!engine.compile) throw "Invalid template engine set";

    return engine.compile(template);
  },
  _data: function(el,key,value) {
    // Setting data
    if(arguments.length === 3) {
      var uuid;
      if(el.hasAttribute('data-jsoneditor-'+key)) {
        uuid = el.getAttribute('data-jsoneditor-'+key);
      }
      else {
        uuid = this.uuid++;
        el.setAttribute('data-jsoneditor-'+key,uuid);
      }

      this.__data[uuid] = value;
    }
    // Getting data
    else {
      // No data stored
      if(!el.hasAttribute('data-jsoneditor-'+key)) return null;

      return this.__data[el.getAttribute('data-jsoneditor-'+key)];
    }
  },
  registerEditor: function(editor) {
    this.editors = this.editors || {};
    this.editors[editor.path] = editor;
    return this;
  },
  unregisterEditor: function(editor) {
    this.editors = this.editors || {};
    this.editors[editor.path] = null;
    return this;
  },
  getEditor: function(path) {
    if(!this.editors) return;
    return this.editors[path];
  },
  watch: function(path,callback) {
    this.watchlist = this.watchlist || {};
    this.watchlist[path] = this.watchlist[path] || [];
    this.watchlist[path].push(callback);

    return this;
  },
  unwatch: function(path,callback) {
    if(!this.watchlist || !this.watchlist[path]) return this;
    // If removing all callbacks for a path
    if(!callback) {
      this.watchlist[path] = null;
      return this;
    }

    var newlist = [];
    for(var i=0; i<this.watchlist[path].length; i++) {
      if(this.watchlist[path][i] === callback) continue;
      else newlist.push(this.watchlist[path][i]);
    }
    this.watchlist[path] = newlist.length? newlist : null;
    return this;
  },
  notifyWatchers: function(path) {
    if(!this.watchlist || !this.watchlist[path]) return this;
    for(var i=0; i<this.watchlist[path].length; i++) {
      this.watchlist[path][i]();
    }
  },
  isEnabled: function() {
    return !this.root || this.root.isEnabled();
  },
  enable: function() {
    this.root.enable();
  },
  disable: function() {
    this.root.disable();
  },
  _getDefinitions: function(schema,path) {
    path = path || '#/definitions/';
    if(schema.definitions) {
      for(var i in schema.definitions) {
        if(!schema.definitions.hasOwnProperty(i)) continue;
        this.refs[path+i] = schema.definitions[i];
        if(schema.definitions[i].definitions) {
          this._getDefinitions(schema.definitions[i],path+i+'/definitions/');
        }
      }
    }
  },
  _getExternalRefs: function(schema) {
    var refs = {};
    var merge_refs = function(newrefs) {
      for(var i in newrefs) {
        if(newrefs.hasOwnProperty(i)) {
          refs[i] = true;
        }
      }
    };

    if(schema.$ref && schema.$ref.substr(0,1) !== "#" && !this.refs[schema.$ref]) {
      refs[schema.$ref] = true;
    }

    for(var i in schema) {
      if(!schema.hasOwnProperty(i)) continue;
      if(schema[i] && typeof schema[i] === "object" && Array.isArray(schema[i])) {
        for(var j=0; j<schema[i].length; j++) {
          if(typeof schema[i][j]==="object") {
            merge_refs(this._getExternalRefs(schema[i][j]));
          }
        }
      }
      else if(schema[i] && typeof schema[i] === "object") {
        merge_refs(this._getExternalRefs(schema[i]));
      }
    }

    return refs;
  },
  _loadExternalRefs: function(schema, callback) {
    var self = this;
    var refs = this._getExternalRefs(schema);

    var done = 0, waiting = 0, callback_fired = false;

    $each(refs,function(url) {
      if(self.refs[url]) return;
      if(!self.options.ajax) throw "Must set ajax option to true to load external ref "+url;
      self.refs[url] = 'loading';
      waiting++;

      var r = new XMLHttpRequest();
      r.open("GET", url, true);
      r.onreadystatechange = function () {
        if (r.readyState != 4) return;
        // Request succeeded
        if(r.status === 200) {
          var response;
          try {
            response = JSON.parse(r.responseText);
          }
          catch(e) {
            window.console.log(e);
            throw "Failed to parse external ref "+url;
          }
          if(!response || typeof response !== "object") throw "External ref does not contain a valid schema - "+url;

          self.refs[url] = response;
          self._loadExternalRefs(response,function() {
            done++;
            if(done >= waiting && !callback_fired) {
              callback_fired = true;
              callback();
            }
          });
        }
        // Request failed
        else {
          window.console.log(r);
          throw "Failed to fetch ref via ajax- "+url;
        }
      };
      r.send();
    });

    if(!waiting) {
      callback();
    }
  },
  expandRefs: function(schema) {
    schema = $extend({},schema);

    while (schema.$ref) {
      var ref = schema.$ref;
      delete schema.$ref;
      schema = this.extendSchemas(schema,this.refs[ref]);
    }
    return schema;
  },
  expandSchema: function(schema) {
    var self = this;
    var extended = $extend({},schema);
    var i;

    // Version 3 `type`
    if(typeof schema.type === 'object') {
      // Array of types
      if(Array.isArray(schema.type)) {
        $each(schema.type, function(key,value) {
          // Schema
          if(typeof value === 'object') {
            schema.type[key] = self.expandSchema(value);
          }
        });
      }
      // Schema
      else {
        schema.type = self.expandSchema(schema.type);
      }
    }
    // Version 3 `disallow`
    if(typeof schema.disallow === 'object') {
      // Array of types
      if(Array.isArray(schema.disallow)) {
        $each(schema.disallow, function(key,value) {
          // Schema
          if(typeof value === 'object') {
            schema.disallow[key] = self.expandSchema(value);
          }
        });
      }
      // Schema
      else {
        schema.disallow = self.expandSchema(schema.disallow);
      }
    }
    // Version 4 `anyOf`
    if(schema.anyOf) {
      $each(schema.anyOf, function(key,value) {
        schema.anyOf[key] = self.expandSchema(value);
      });
    }
    // Version 4 `dependencies` (schema dependencies)
    if(schema.dependencies) {
      $each(schema.dependencies,function(key,value) {
        if(typeof value === "object" && !(Array.isArray(value))) {
          schema.dependencies[key] = self.expandSchema(value);
        }
      });
    }
    // Version 4 `not`
    if(schema.not) {
      schema.not = this.expandSchema(schema.not);
    }

    // allOf schemas should be merged into the parent
    if(schema.allOf) {
      for(i=0; i<schema.allOf.length; i++) {
        extended = this.extendSchemas(extended,this.expandSchema(schema.allOf[i]));
      }
      delete extended.allOf;
    }
    // extends schemas should be merged into parent
    if(schema.extends) {
      // If extends is a schema
      if(!(Array.isArray(schema.extends))) {
        extended = this.extendSchemas(extended,this.expandSchema(schema.extends));
      }
      // If extends is an array of schemas
      else {
        for(i=0; i<schema.extends.length; i++) {
          extended = this.extendSchemas(extended,this.expandSchema(schema.extends[i]));
        }
      }
      delete extended.extends;
    }
    // parent should be merged into oneOf schemas
    if(schema.oneOf) {
      var tmp = $extend({},extended);
      delete tmp.oneOf;
      for(i=0; i<schema.oneOf.length; i++) {
        extended.oneOf[i] = this.extendSchemas(this.expandSchema(schema.oneOf[i]),tmp);
      }
    }

    return this.expandRefs(extended);
  },
  extendSchemas: function(obj1, obj2) {
    obj1 = $extend({},obj1);
    obj2 = $extend({},obj2);

    var self = this;
    var extended = {};
    $each(obj1, function(prop,val) {
      // If this key is also defined in obj2, merge them
      if(typeof obj2[prop] !== "undefined") {
        // Required arrays should be unioned together
        if(prop === 'required' && typeof val === "object" && Array.isArray(val)) {
          // Union arrays and unique
          extended.required = val.concat(obj2[prop]).reduce(function(p, c) {
            if (p.indexOf(c) < 0) p.push(c);
            return p;
          }, []);
        }
        // Type should be intersected and is either an array or string
        else if(prop === 'type' && (typeof val === "string" || Array.isArray(val))) {
          // Make sure we're dealing with arrays
          if(typeof val === "string") val = [val];
          if(typeof obj2.type === "string") obj2.type = [obj2.type];


          extended.type = val.filter(function(n) {
            return obj2.type.indexOf(n) !== -1;
          });

          // If there's only 1 type and it's a primitive, use a string instead of array
          if(extended.type.length === 1 && typeof extended.type[0] === "string") {
            extended.type = extended.type[0];
          }
        }
        // All other arrays should be intersected (enum, etc.)
        else if(typeof val === "object" && Array.isArray(val)){
          extended[prop] = val.filter(function(n) {
            return obj2[prop].indexOf(n) !== -1;
          });
        }
        // Objects should be recursively merged
        else if(typeof val === "object" && val !== null) {
          extended[prop] = self.extendSchemas(val,obj2[prop]);
        }
        // Otherwise, use the first value
        else {
          extended[prop] = val;
        }
      }
      // Otherwise, just use the one in obj1
      else {
        extended[prop] = val;
      }
    });
    // Properties in obj2 that aren't in obj1
    $each(obj2, function(prop,val) {
      if(typeof obj1[prop] === "undefined") {
        extended[prop] = val;
      }
    });

    return extended;
  }
};

JSONEditor.defaults = {
  themes: {},
  templates: {},
  iconlibs: {},
  editors: {},
  languages: {},
  resolvers: [],
  custom_validators: []
};

JSONEditor.Validator = Class.extend({
  init: function(jsoneditor,schema) {
    this.jsoneditor = jsoneditor;
    this.schema = schema || this.jsoneditor.schema;
    this.options = {};
    this.translate = this.jsoneditor.translate || JSONEditor.defaults.translate;
  },
  validate: function(value) {
    return this._validateSchema(this.schema, value);
  },
  _validateSchema: function(schema,value,path) {
    var errors = [];
    var valid, i, j;
    var stringified = JSON.stringify(value);

    path = path || 'root';

    // Work on a copy of the schema
    schema = $extend({},this.jsoneditor.expandRefs(schema));

    /*
     * Type Agnostic Validation
     */

    // Version 3 `required`
    if(schema.required && schema.required === true) {
      if(typeof value === "undefined") {
        errors.push({
          path: path,
          property: 'required',
          message: this.translate("error_notset")
        });

        // Can't do any more validation at this point
        return errors;
      }
    }
    // Value not defined
    else if(typeof value === "undefined") {
      // If required_by_default is set, all fields are required
      if(this.jsoneditor.options.required_by_default) {
        errors.push({
          path: path,
          property: 'required',
          message: this.translate("error_notset")
        });
      }
      // Not required, no further validation needed
      else {
        return errors;
      }
    }

    // `enum`
    if(schema.enum) {
      valid = false;
      for(i=0; i<schema.enum.length; i++) {
        if(stringified === JSON.stringify(schema.enum[i])) valid = true;
      }
      if(!valid) {
        errors.push({
          path: path,
          property: 'enum',
          message: this.translate("error_enum")
        });
      }
    }

    // `extends` (version 3)
    if(schema.extends) {
      for(i=0; i<schema.extends.length; i++) {
        errors = errors.concat(this._validateSchema(schema.extends[i],value,path));
      }
    }

    // `allOf`
    if(schema.allOf) {
      for(i=0; i<schema.allOf.length; i++) {
        errors = errors.concat(this._validateSchema(schema.allOf[i],value,path));
      }
    }

    // `anyOf`
    if(schema.anyOf) {
      valid = false;
      for(i=0; i<schema.anyOf.length; i++) {
        if(!this._validateSchema(schema.anyOf[i],value,path).length) {
          valid = true;
          break;
        }
      }
      if(!valid) {
        errors.push({
          path: path,
          property: 'anyOf',
          message: this.translate('error_anyOf')
        });
      }
    }

    // `oneOf`
    if(schema.oneOf) {
      valid = 0;
      var oneof_errors = [];
      for(i=0; i<schema.oneOf.length; i++) {
        // Set the error paths to be path.oneOf[i].rest.of.path
        var tmp = this._validateSchema(schema.oneOf[i],value,path);
        if(!tmp.length) {
          valid++;
        }

        for(j=0; j<tmp.length; j++) {
          tmp[j].path = path+'.oneOf['+i+']'+tmp[j].path.substr(path.length);
        }
        oneof_errors = oneof_errors.concat(tmp);

      }
      if(valid !== 1) {
        errors.push({
          path: path,
          property: 'oneOf',
          message: this.translate('error_oneOf', [valid])
        });
        errors = errors.concat(oneof_errors);
      }
    }

    // `not`
    if(schema.not) {
      if(!this._validateSchema(schema.not,value,path).length) {
        errors.push({
          path: path,
          property: 'not',
          message: this.translate('error_not')
        });
      }
    }

    // `type` (both Version 3 and Version 4 support)
    if(schema.type) {
      // Union type
      if(Array.isArray(schema.type)) {
        valid = false;
        for(i=0;i<schema.type.length;i++) {
          if(this._checkType(schema.type[i], value)) {
            valid = true;
            break;
          }
        }
        if(!valid) {
          errors.push({
            path: path,
            property: 'type',
            message: this.translate('error_type_union')
          });
        }
      }
      // Simple type
      else {
        if(!this._checkType(schema.type, value)) {
          errors.push({
            path: path,
            property: 'type',
            message: this.translate('error_type', [schema.type])
          });
        }
      }
    }


    // `disallow` (version 3)
    if(schema.disallow) {
      // Union type
      if(Array.isArray(schema.disallow)) {
        valid = true;
        for(i=0;i<schema.disallow.length;i++) {
          if(this._checkType(schema.disallow[i], value)) {
            valid = false;
            break;
          }
        }
        if(!valid) {
          errors.push({
            path: path,
            property: 'disallow',
            message: this.translate('error_disallow_union')
          });
        }
      }
      // Simple type
      else {
        if(this._checkType(schema.disallow, value)) {
          errors.push({
            path: path,
            property: 'disallow',
            message: this.translate('error_disallow', [schema.disallow])
          });
        }
      }
    }

    /*
     * Type Specific Validation
     */

    // Number Specific Validation
    if(typeof value === "number") {
      // `multipleOf` and `divisibleBy`
      if(schema.multipleOf || schema.divisibleBy) {
        valid = value / (schema.multipleOf || schema.divisibleBy);
        if(valid !== Math.floor(valid)) {
          errors.push({
            path: path,
            property: schema.multipleOf? 'multipleOf' : 'divisibleBy',
            message: this.translate('error_multipleOf', [schema.multipleOf || schema.divisibleBy])
          });
        }
      }

      // `maximum`
      if(schema.hasOwnProperty('maximum')) {
        if(schema.exclusiveMaximum && value >= schema.maximum) {
          errors.push({
            path: path,
            property: 'maximum',
            message: this.translate('error_maximum_excl', [schema.maximum])
          });
        }
        else if(!schema.exclusiveMaximum && value > schema.maximum) {
          errors.push({
            path: path,
            property: 'maximum',
            message: this.translate('error_maximum_incl', [schema.maximum])
          });
        }
      }

      // `minimum`
      if(schema.hasOwnProperty('minimum')) {
        if(schema.exclusiveMinimum && value <= schema.minimum) {
          errors.push({
            path: path,
            property: 'minimum',
            message: this.translate('error_minimum_excl', [schema.minimum])
          });
        }
        else if(!schema.exclusiveMinimum && value < schema.minimum) {
          errors.push({
            path: path,
            property: 'minimum',
            message: this.translate('error_minimum_incl', [schema.minimum])
          });
        }
      }
    }
    // String specific validation
    else if(typeof value === "string") {
      // `maxLength`
      if(schema.maxLength) {
        if((value+"").length > schema.maxLength) {
          errors.push({
            path: path,
            property: 'maxLength',
            message: this.translate('error_maxLength', [schema.maxLength])
          });
        }
      }

      // `minLength`
      if(schema.minLength) {
        if((value+"").length < schema.minLength) {
          errors.push({
            path: path,
            property: 'minLength',
            message: this.translate((schema.minLength===1?'error_notempty':'error_minLength'), [schema.minLength])
          });
        }
      }

      // `pattern`
      if(schema.pattern) {
        if(!(new RegExp(schema.pattern)).test(value)) {
          errors.push({
            path: path,
            property: 'pattern',
            message: this.translate('error_pattern')
          });
        }
      }
    }
    // Array specific validation
    else if(typeof value === "object" && value !== null && Array.isArray(value)) {
      // `items` and `additionalItems`
      if(schema.items) {
        // `items` is an array
        if(Array.isArray(schema.items)) {
          for(i=0; i<value.length; i++) {
            // If this item has a specific schema tied to it
            // Validate against it
            if(schema.items[i]) {
              errors = errors.concat(this._validateSchema(schema.items[i],value[i],path+'.'+i));
            }
            // If all additional items are allowed
            else if(schema.additionalItems === true) {
              break;
            }
            // If additional items is a schema
            // TODO: Incompatibility between version 3 and 4 of the spec
            else if(schema.additionalItems) {
              errors = errors.concat(this._validateSchema(schema.additionalItems,value[i],path+'.'+i));
            }
            // If no additional items are allowed
            else if(schema.additionalItems === false) {
              errors.push({
                path: path,
                property: 'additionalItems',
                message: this.translate('error_additionalItems')
              });
              break;
            }
            // Default for `additionalItems` is an empty schema
            else {
              break;
            }
          }
        }
        // `items` is a schema
        else {
          // Each item in the array must validate against the schema
          for(i=0; i<value.length; i++) {
            errors = errors.concat(this._validateSchema(schema.items,value[i],path+'.'+i));
          }
        }
      }

      // `maxItems`
      if(schema.maxItems) {
        if(value.length > schema.maxItems) {
          errors.push({
            path: path,
            property: 'maxItems',
            message: this.translate('error_maxItems', [schema.maxItems])
          });
        }
      }

      // `minItems`
      if(schema.minItems) {
        if(value.length < schema.minItems) {
          errors.push({
            path: path,
            property: 'minItems',
            message: this.translate('error_minItems', [schema.minItems])
          });
        }
      }

      // `uniqueItems`
      if(schema.uniqueItems) {
        var seen = {};
        for(i=0; i<value.length; i++) {
          valid = JSON.stringify(value[i]);
          if(seen[valid]) {
            errors.push({
              path: path,
              property: 'uniqueItems',
              message: this.translate('error_uniqueItems')
            });
            break;
          }
          seen[valid] = true;
        }
      }
    }
    // Object specific validation
    else if(typeof value === "object" && value !== null) {
      // `maxProperties`
      if(schema.maxProperties) {
        valid = 0;
        for(i in value) {
          if(!value.hasOwnProperty(i)) continue;
          valid++;
        }
        if(valid > schema.maxProperties) {
          errors.push({
            path: path,
            property: 'maxProperties',
            message: this.translate('error_maxProperties', [schema.maxProperties])
          });
        }
      }

      // `minProperties`
      if(schema.minProperties) {
        valid = 0;
        for(i in value) {
          if(!value.hasOwnProperty(i)) continue;
          valid++;
        }
        if(valid < schema.minProperties) {
          errors.push({
            path: path,
            property: 'minProperties',
            message: this.translate('error_minProperties', [schema.minProperties])
          });
        }
      }

      // Version 4 `required`
      if(schema.required && Array.isArray(schema.required)) {
        for(i=0; i<schema.required.length; i++) {
          if(typeof value[schema.required[i]] === "undefined") {
            errors.push({
              path: path,
              property: 'required',
              message: this.translate('error_required', [schema.required[i]])
            });
          }
        }
      }

      // `properties`
      var validated_properties = {};
      if(schema.properties) {
        for(i in schema.properties) {
          if(!schema.properties.hasOwnProperty(i)) continue;
          validated_properties[i] = true;
          errors = errors.concat(this._validateSchema(schema.properties[i],value[i],path+'.'+i));
        }
      }

      // `patternProperties`
      if(schema.patternProperties) {
        for(i in schema.patternProperties) {
          if(!schema.patternProperties.hasOwnProperty(i)) continue;

          var regex = new RegExp(i);

          // Check which properties match
          for(j in value) {
            if(!value.hasOwnProperty(j)) continue;
            if(regex.test(j)) {
              validated_properties[j] = true;
              errors = errors.concat(this._validateSchema(schema.patternProperties[i],value[j],path+'.'+j));
            }
          }
        }
      }

      // The no_additional_properties option currently doesn't work with extended schemas that use oneOf or anyOf
      if(typeof schema.additionalProperties === "undefined" && this.jsoneditor.options.no_additional_properties && !schema.oneOf && !schema.anyOf) {
        schema.additionalProperties = false;
      }

      // `additionalProperties`
      if(typeof schema.additionalProperties !== "undefined") {
        for(i in value) {
          if(!value.hasOwnProperty(i)) continue;
          if(!validated_properties[i]) {
            // No extra properties allowed
            if(!schema.additionalProperties) {
              errors.push({
                path: path,
                property: 'additionalProperties',
                message: this.translate('error_additional_properties', [i])
              });
              break;
            }
            // Allowed
            else if(schema.additionalProperties === true) {
              break;
            }
            // Must match schema
            // TODO: incompatibility between version 3 and 4 of the spec
            else {
              errors = errors.concat(this._validateSchema(schema.additionalProperties,value[i],path+'.'+i));
            }
          }
        }
      }

      // `dependencies`
      if(schema.dependencies) {
        for(i in schema.dependencies) {
          if(!schema.dependencies.hasOwnProperty(i)) continue;

          // Doesn't need to meet the dependency
          if(typeof value[i] === "undefined") continue;

          // Property dependency
          if(Array.isArray(schema.dependencies[i])) {
            for(j=0; j<schema.dependencies[i].length; j++) {
              if(typeof value[schema.dependencies[i][j]] === "undefined") {
                errors.push({
                  path: path,
                  property: 'dependencies',
                  message: this.translate('error_dependency', [schema.dependencies[i][j]])
                });
              }
            }
          }
          // Schema dependency
          else {
            errors = errors.concat(this._validateSchema(schema.dependencies[i],value,path));
          }
        }
      }
    }

    // Custom type validation
    $each(JSONEditor.defaults.custom_validators,function(i,validator) {
      errors = errors.concat(validator(schema,value,path));
    });

    return errors;
  },
  _checkType: function(type, value) {
    // Simple types
    if(typeof type === "string") {
      if(type==="string") return typeof value === "string";
      else if(type==="number") return typeof value === "number";
      else if(type==="integer") return typeof value === "number" && value === Math.floor(value);
      else if(type==="boolean") return typeof value === "boolean";
      else if(type==="array") return Array.isArray(value);
      else if(type === "object") return value !== null && !(Array.isArray(value)) && typeof value === "object";
      else if(type === "null") return value === null;
      else return true;
    }
    // Schema
    else {
      return !this._validateSchema(type,value).length;
    }
  }
});

/**
 * All editors should extend from this class
 */
JSONEditor.AbstractEditor = Class.extend({
  onChildEditorChange: function(editor) {
    this.onChange(true);
  },
  notify: function() {
    this.jsoneditor.notifyWatchers(this.path);
  },
  change: function() {
    if(this.parent) this.parent.onChildEditorChange(this);
    else this.jsoneditor.onChange();
  },
  onChange: function(bubble) {
    this.notify();
    if(this.watch_listener) this.watch_listener();
    if(bubble) this.change();
  },
  register: function() {
    this.jsoneditor.registerEditor(this);
    this.onChange();
  },
  unregister: function() {
    if(!this.jsoneditor) return;
    this.jsoneditor.unregisterEditor(this);
  },
  getNumColumns: function() {
    return 12;
  },
  init: function(options) {
    this.jsoneditor = options.jsoneditor;

    this.theme = this.jsoneditor.theme;
    this.template_engine = this.jsoneditor.template;
    this.iconlib = this.jsoneditor.iconlib;

    this.original_schema = options.schema;
    this.schema = this.jsoneditor.expandSchema(this.original_schema);

    this.options = $extend({}, (this.options || {}), (options.schema.options || {}), options);

    if(!options.path && !this.schema.id) this.schema.id = 'root';
    this.path = options.path || 'root';
    this.formname = options.formname || this.path.replace(/\.([^.]+)/g,'[$1]');
    if(this.jsoneditor.options.form_name_root) this.formname = this.formname.replace(/^root\[/,this.jsoneditor.options.form_name_root+'[');
    this.key = this.path.split('.').pop();
    this.parent = options.parent;

    this.link_watchers = [];

    if(options.container) this.setContainer(options.container);
  },
  setContainer: function(container) {
    this.container = container;
    if(this.schema.id) this.container.setAttribute('data-schemaid',this.schema.id);
    if(this.schema.type && typeof this.schema.type === "string") this.container.setAttribute('data-schematype',this.schema.type);
    this.container.setAttribute('data-schemapath',this.path);
  },

  preBuild: function() {

  },
  build: function() {

  },
  postBuild: function() {
    this.setupWatchListeners();
    this.addLinks();
    this.setValue(this.getDefault(), true);
    this.updateHeaderText();
    this.register();
    this.onWatchedFieldChange();
  },

  setupWatchListeners: function() {
    var self = this;

    // Watched fields
    this.watched = {};
    if(this.schema.vars) this.schema.watch = this.schema.vars;
    this.watched_values = {};
    this.watch_listener = function() {
      if(self.refreshWatchedFieldValues()) {
        self.onWatchedFieldChange();
      }
    };

    this.register();
    if(this.schema.hasOwnProperty('watch')) {
      var path,path_parts,first,root,adjusted_path;

      for(var name in this.schema.watch) {
        if(!this.schema.watch.hasOwnProperty(name)) continue;
        path = this.schema.watch[name];

        if(Array.isArray(path)) {
          path_parts = [path[0]].concat(path[1].split('.'));
        }
        else {
          path_parts = path.split('.');
          if(!self.theme.closest(self.container,'[data-schemaid="'+path_parts[0]+'"]')) path_parts.unshift('#');
        }
        first = path_parts.shift();

        if(first === '#') first = self.jsoneditor.schema.id || 'root';

        // Find the root node for this template variable
        root = self.theme.closest(self.container,'[data-schemaid="'+first+'"]');
        if(!root) throw "Could not find ancestor node with id "+first;

        // Keep track of the root node and path for use when rendering the template
        adjusted_path = root.getAttribute('data-schemapath') + '.' + path_parts.join('.');

        self.jsoneditor.watch(adjusted_path,self.watch_listener);

        self.watched[name] = adjusted_path;
      }
    }

    // Dynamic header
    if(this.schema.headerTemplate) {
      this.header_template = this.jsoneditor.compileTemplate(this.schema.headerTemplate, this.template_engine);
    }
  },

  addLinks: function() {
    // Add links
    if(!this.no_link_holder) {
      this.link_holder = this.theme.getLinksHolder();
      this.container.appendChild(this.link_holder);
      if(this.schema.links) {
        for(var i=0; i<this.schema.links.length; i++) {
          this.addLink(this.getLink(this.schema.links[i]));
        }
      }
    }
  },


  getButton: function(text, icon, title) {
    var btnClass = 'json-editor-btn-'+icon;
    if(!this.iconlib) icon = null;
    else icon = this.iconlib.getIcon(icon);

    if(!icon && title) {
      text = title;
      title = null;
    }

    var btn = this.theme.getButton(text, icon, title);
    btn.className += ' ' + btnClass + ' ';
    return btn;
  },
  setButtonText: function(button, text, icon, title) {
    if(!this.iconlib) icon = null;
    else icon = this.iconlib.getIcon(icon);

    if(!icon && title) {
      text = title;
      title = null;
    }

    return this.theme.setButtonText(button, text, icon, title);
  },
  addLink: function(link) {
    if(this.link_holder) this.link_holder.appendChild(link);
  },
  getLink: function(data) {
    var holder, link;

    // Get mime type of the link
    var mime = data.mediaType || 'application/javascript';
    var type = mime.split('/')[0];

    // Template to generate the link href
    var href = this.jsoneditor.compileTemplate(data.href,this.template_engine);

    // Image links
    if(type === 'image') {
      holder = this.theme.getBlockLinkHolder();
      link = document.createElement('a');
      link.setAttribute('target','_blank');
      var image = document.createElement('img');

      this.theme.createImageLink(holder,link,image);

      // When a watched field changes, update the url
      this.link_watchers.push(function(vars) {
        var url = href(vars);
        link.setAttribute('href',url);
        link.setAttribute('title',data.rel || url);
        image.setAttribute('src',url);
      });
    }
    // Audio/Video links
    else if(['audio','video'].indexOf(type) >=0) {
      holder = this.theme.getBlockLinkHolder();

      link = this.theme.getBlockLink();
      link.setAttribute('target','_blank');

      var media = document.createElement(type);
      media.setAttribute('controls','controls');

      this.theme.createMediaLink(holder,link,media);

      // When a watched field changes, update the url
      this.link_watchers.push(function(vars) {
        var url = href(vars);
        link.setAttribute('href',url);
        link.textContent = data.rel || url;
        media.setAttribute('src',url);
      });
    }
    // Text links
    else {
      holder = this.theme.getBlockLink();
      holder.setAttribute('target','_blank');
      holder.textContent = data.rel;

      // When a watched field changes, update the url
      this.link_watchers.push(function(vars) {
        var url = href(vars);
        holder.setAttribute('href',url);
        holder.textContent = data.rel || url;
      });
    }

    return holder;
  },
  refreshWatchedFieldValues: function() {
    if(!this.watched_values) return;
    var watched = {};
    var changed = false;
    var self = this;

    if(this.watched) {
      var val,editor;
      for(var name in this.watched) {
        if(!this.watched.hasOwnProperty(name)) continue;
        editor = self.jsoneditor.getEditor(this.watched[name]);
        val = editor? editor.getValue() : null;
        if(self.watched_values[name] !== val) changed = true;
        watched[name] = val;
      }
    }

    watched.self = this.getValue();
    if(this.watched_values.self !== watched.self) changed = true;

    this.watched_values = watched;

    return changed;
  },
  getWatchedFieldValues: function() {
    return this.watched_values;
  },
  updateHeaderText: function() {
    if(this.header) {
      this.header.textContent = this.getHeaderText();
    }
  },
  getHeaderText: function(title_only) {
    if(this.header_text) return this.header_text;
    else if(title_only) return this.schema.title;
    else return this.getTitle();
  },
  onWatchedFieldChange: function() {
    var vars;
    if(this.header_template) {
      vars = $extend(this.getWatchedFieldValues(),{
        key: this.key,
        i: this.key,
        i0: (this.key*1),
        i1: (this.key*1+1),
        title: this.getTitle()
      });
      var header_text = this.header_template(vars);

      if(header_text !== this.header_text) {
        this.header_text = header_text;
        this.updateHeaderText();
        this.notify();
        //this.fireChangeHeaderEvent();
      }
    }
    if(this.link_watchers.length) {
      vars = this.getWatchedFieldValues();
      for(var i=0; i<this.link_watchers.length; i++) {
        this.link_watchers[i](vars);
      }
    }
  },
  setValue: function(value) {
    this.value = value;
  },
  getValue: function() {
    return this.value;
  },
  refreshValue: function() {

  },
  getChildEditors: function() {
    return false;
  },
  destroy: function() {
    var self = this;
    this.unregister(this);
    $each(this.watched,function(name,adjusted_path) {
      self.jsoneditor.unwatch(adjusted_path,self.watch_listener);
    });
    this.watched = null;
    this.watched_values = null;
    this.watch_listener = null;
    this.header_text = null;
    this.header_template = null;
    this.value = null;
    if(this.container && this.container.parentNode) this.container.parentNode.removeChild(this.container);
    this.container = null;
    this.jsoneditor = null;
    this.schema = null;
    this.path = null;
    this.key = null;
    this.parent = null;
  },
  getDefault: function() {
    if(this.schema.default) return this.schema.default;
    if(this.schema.enum) return this.schema.enum[0];

    var type = this.schema.type || this.schema.oneOf;
    if(type && Array.isArray(type)) type = type[0];
    if(type && typeof type === "object") type = type.type;
    if(type && Array.isArray(type)) type = type[0];

    if(typeof type === "string") {
      if(type === "number") return 0.0;
      if(type === "boolean") return false;
      if(type === "integer") return 0;
      if(type === "string") return "";
      if(type === "object") return {};
      if(type === "array") return [];
    }

    return null;
  },
  getTitle: function() {
    return this.schema.title || this.key;
  },
  enable: function() {
    this.disabled = false;
  },
  disable: function() {
    this.disabled = true;
  },
  isEnabled: function() {
    return !this.disabled;
  },
  getDisplayText: function(arr) {
    var disp = [];
    var used = {};

    // Determine how many times each attribute name is used.
    // This helps us pick the most distinct display text for the schemas.
    $each(arr,function(i,el) {
      if(el.title) {
        used[el.title] = used[el.title] || 0;
        used[el.title]++;
      }
      if(el.description) {
        used[el.description] = used[el.description] || 0;
        used[el.description]++;
      }
      if(el.format) {
        used[el.format] = used[el.format] || 0;
        used[el.format]++;
      }
      if(el.type) {
        used[el.type] = used[el.type] || 0;
        used[el.type]++;
      }
    });

    // Determine display text for each element of the array
    $each(arr,function(i,el)  {
      var name;

      // If it's a simple string
      if(typeof el === "string") name = el;
      // Object
      else if(el.title && used[el.title]<=1) name = el.title;
      else if(el.format && used[el.format]<=1) name = el.format;
      else if(el.type && used[el.type]<=1) name = el.type;
      else if(el.description && used[el.description]<=1) name = el.descripton;
      else if(el.title) name = el.title;
      else if(el.format) name = el.format;
      else if(el.type) name = el.type;
      else if(el.description) name = el.description;
      else if(JSON.stringify(el).length < 50) name = JSON.stringify(el);
      else name = "type";

      disp.push(name);
    });

    // Replace identical display text with "text 1", "text 2", etc.
    var inc = {};
    $each(disp,function(i,name) {
      inc[name] = inc[name] || 0;
      inc[name]++;

      if(used[name] > 1) disp[i] = name + " " + inc[name];
    });

    return disp;
  },
  getOption: function(key) {
    try {
      throw "getOption is deprecated";
    }
    catch(e) {
      window.console.error(e);
    }

    return this.options[key];
  },
  showValidationErrors: function(errors) {

  }
});

JSONEditor.defaults.editors.null = JSONEditor.AbstractEditor.extend({
  getValue: function() {
    return null;
  },
  setValue: function() {
    this.onChange();
  },
  getNumColumns: function() {
    return 2;
  }
});

JSONEditor.defaults.editors.string = JSONEditor.AbstractEditor.extend({
  register: function() {
    this._super();
    if(!this.input) return;
    this.input.setAttribute('name',this.formname);
  },
  unregister: function() {
    this._super();
    if(!this.input) return;
    this.input.removeAttribute('name');
  },
  setValue: function(value,initial,from_template) {
    var self = this;

    if(this.template && !from_template) {
      return;
    }

    if(value === null) value = "";
    else if(typeof value === "object") value = JSON.stringify(value);
    else if(typeof value !== "string") value = ""+value;

    if(value === this.serialized) return;

    // Sanitize value before setting it
    var sanitized = this.sanitize(value);

    if(this.input.value === sanitized) {
      return;
    }

    this.input.value = sanitized;

    // If using SCEditor, update the WYSIWYG
    if(this.sceditor_instance) {
      this.sceditor_instance.val(sanitized);
    }
    else if(this.epiceditor) {
      this.epiceditor.importFile(null,sanitized);
    }
    else if(this.ace_editor) {
      this.ace_editor.setValue(sanitized);
    }

    var changed = from_template || this.getValue() !== value;

    this.refreshValue();

    if(initial) this.is_dirty = false;
    else if(this.jsoneditor.options.show_errors === "change") this.is_dirty = true;

    // Bubble this setValue to parents if the value changed
    this.onChange(changed);
  },
  getNumColumns: function() {
    var min = Math.ceil(Math.max(this.getTitle().length,this.schema.maxLength||0,this.schema.minLength||0)/5);
    var num;

    if(this.input_type === 'textarea') num = 6;
    else if(['text','email'].indexOf(this.input_type) >= 0) num = 4;
    else num = 2;

    return Math.min(12,Math.max(min,num));
  },
  build: function() {
    var self = this, i;
    if(!this.options.compact) this.header = this.label = this.theme.getFormInputLabel(this.getTitle());
    if(this.schema.description) this.description = this.theme.getFormInputDescription(this.schema.description);

    this.format = this.schema.format;
    if(!this.format && this.schema.media && this.schema.media.type) {
      this.format = this.schema.media.type.replace(/(^(application|text)\/(x-)?(script\.)?)|(-source$)/g,'');
    }
    if(!this.format && this.options.default_format) {
      this.format = this.options.default_format;
    }
    if(this.options.format) {
      this.format = this.options.format;
    }

    // Specific format
    if(this.format) {
      // Text Area
      if(this.format === 'textarea') {
        this.input_type = 'textarea';
        this.input = this.theme.getTextareaInput();
      }
      // Range Input
      else if(this.format === 'range') {
        this.input_type = 'range';
        var min = this.schema.minimum || 0;
        var max = this.schema.maximum || Math.max(100,min+1);
        var step = 1;
        if(this.schema.multipleOf) {
          if(min%this.schema.multipleOf) min = Math.ceil(min/this.schema.multipleOf)*this.schema.multipleOf;
          if(max%this.schema.multipleOf) max = Math.floor(max/this.schema.multipleOf)*this.schema.multipleOf;
          step = this.schema.multipleOf;
        }

        this.input = this.theme.getRangeInput(min,max,step);
      }
      // Source Code
      else if([
          'actionscript',
          'batchfile',
          'bbcode',
          'c',
          'c++',
          'cpp',
          'coffee',
          'csharp',
          'css',
          'dart',
          'django',
          'ejs',
          'erlang',
          'golang',
          'handlebars',
          'haskell',
          'haxe',
          'html',
          'ini',
          'jade',
          'java',
          'javascript',
          'json',
          'less',
          'lisp',
          'lua',
          'makefile',
          'markdown',
          'matlab',
          'mysql',
          'objectivec',
          'pascal',
          'perl',
          'pgsql',
          'php',
          'python',
          'r',
          'ruby',
          'sass',
          'scala',
          'scss',
          'smarty',
          'sql',
          'stylus',
          'svg',
          'twig',
          'vbscript',
          'xml',
          'yaml'
        ].indexOf(this.format) >= 0
      ) {
        this.input_type = this.format;
        this.source_code = true;

        this.input = this.theme.getTextareaInput();
      }
      // HTML5 Input type
      else {
        this.input_type = this.format;
        this.input = this.theme.getFormInputField(this.input_type);
      }
    }
    // Normal text input
    else {
      this.input_type = 'text';
      this.input = this.theme.getFormInputField(this.input_type);
    }

    // minLength, maxLength, and pattern
    if(typeof this.schema.maxLength !== "undefined") this.input.setAttribute('maxlength',this.schema.maxLength);
    if(typeof this.schema.pattern !== "undefined") this.input.setAttribute('pattern',this.schema.pattern);
    else if(typeof this.schema.minLength !== "undefined") this.input.setAttribute('pattern','.{'+this.schema.minLength+',}');

    if(this.options.compact) this.container.setAttribute('class',this.container.getAttribute('class')+' compact');

    if(this.schema.readOnly || this.schema.readonly || this.schema.template) {
      this.always_disabled = true;
      this.input.disabled = true;
    }

    this.input
      .addEventListener('change',function(e) {
        e.preventDefault();
        e.stopPropagation();

        // Don't allow changing if this field is a template
        if(self.schema.template) {
          this.value = self.value;
          return;
        }

        var val = this.value;

        // sanitize value
        var sanitized = self.sanitize(val);
        if(val !== sanitized) {
          this.value = sanitized;
        }

        self.is_dirty = true;

        self.refreshValue();
        self.onChange(true);
      });

    if(this.format) this.input.setAttribute('data-schemaformat',this.format);

    this.control = this.theme.getFormControl(this.label, this.input, this.description);
    this.container.appendChild(this.control);

    // Any special formatting that needs to happen after the input is added to the dom
    window.requestAnimationFrame(function() {
      // Skip in case the input is only a temporary editor,
      // otherwise, in the case of an ace_editor creation,
      // it will generate an error trying to append it to the missing parentNode
      if(self.input.parentNode) self.afterInputReady();
    });

    // Compile and store the template
    if(this.schema.template) {
      this.template = this.jsoneditor.compileTemplate(this.schema.template, this.template_engine);
      this.refreshValue();
    }
    else {
      this.refreshValue();
    }
  },
  enable: function() {
    if(!this.always_disabled) {
      this.input.disabled = false;
      // TODO: WYSIWYG and Markdown editors
    }
    this._super();
  },
  disable: function() {
    this.input.disabled = true;
    // TODO: WYSIWYG and Markdown editors
    this._super();
  },
  afterInputReady: function() {
    var self = this, options;

    // Code editor
    if(this.source_code) {
      // WYSIWYG html and bbcode editor
      if(this.options.wysiwyg &&
        ['html','bbcode'].indexOf(this.input_type) >= 0 &&
        window.jQuery && window.jQuery.fn && window.jQuery.fn.sceditor
      ) {
        options = $extend({},{
          plugins: self.input_type==='html'? 'xhtml' : 'bbcode',
          emoticonsEnabled: false,
          width: '100%',
          height: 300
        },JSONEditor.plugins.sceditor,self.options.sceditor_options||{});

        window.jQuery(self.input).sceditor(options);

        self.sceditor_instance = window.jQuery(self.input).sceditor('instance');

        self.sceditor_instance.blur(function() {
          // Get editor's value
          var val = window.jQuery("<div>"+self.sceditor_instance.val()+"</div>");
          // Remove sceditor spans/divs
          window.jQuery('#sceditor-start-marker,#sceditor-end-marker,.sceditor-nlf',val).remove();
          // Set the value and update
          self.input.value = val.html();
          self.value = self.input.value;
          self.is_dirty = true;
          self.onChange(true);
        });
      }
      // EpicEditor for markdown (if it's loaded)
      else if (this.input_type === 'markdown' && window.EpicEditor) {
        this.epiceditor_container = document.createElement('div');
        this.input.parentNode.insertBefore(this.epiceditor_container,this.input);
        this.input.style.display = 'none';

        options = $extend({},JSONEditor.plugins.epiceditor,{
          container: this.epiceditor_container,
          clientSideStorage: false
        });

        this.epiceditor = new window.EpicEditor(options).load();

        this.epiceditor.importFile(null,this.getValue());

        this.epiceditor.on('update',function() {
          var val = self.epiceditor.exportFile();
          self.input.value = val;
          self.value = val;
          self.is_dirty = true;
          self.onChange(true);
        });
      }
      // ACE editor for everything else
      else if(window.ace) {
        var mode = this.input_type;
        // aliases for c/cpp
        if(mode === 'cpp' || mode === 'c++' || mode === 'c') {
          mode = 'c_cpp';
        }

        this.ace_container = document.createElement('div');
        this.ace_container.style.width = '100%';
        this.ace_container.style.position = 'relative';
        this.ace_container.style.height = '400px';
        this.input.parentNode.insertBefore(this.ace_container,this.input);
        this.input.style.display = 'none';
        this.ace_editor = window.ace.edit(this.ace_container);

        this.ace_editor.setValue(this.getValue());

        // The theme
        if(JSONEditor.plugins.ace.theme) this.ace_editor.setTheme('ace/theme/'+JSONEditor.plugins.ace.theme);
        // The mode
        mode = window.ace.require("ace/mode/"+mode);
        if(mode) this.ace_editor.getSession().setMode(new mode.Mode());

        // Listen for changes
        this.ace_editor.on('change',function() {
          var val = self.ace_editor.getValue();
          self.input.value = val;
          self.refreshValue();
          self.is_dirty = true;
          self.onChange(true);
        });
      }
    }

    self.theme.afterInputReady(self.input);
  },
  refreshValue: function() {
    this.value = this.input.value;
    if(typeof this.value !== "string") this.value = '';
    this.serialized = this.value;
  },
  destroy: function() {
    // If using SCEditor, destroy the editor instance
    if(this.sceditor_instance) {
      this.sceditor_instance.destroy();
    }
    else if(this.epiceditor) {
      this.epiceditor.unload();
    }
    else if(this.ace_editor) {
      this.ace_editor.destroy();
    }


    this.template = null;
    if(this.input && this.input.parentNode) this.input.parentNode.removeChild(this.input);
    if(this.label && this.label.parentNode) this.label.parentNode.removeChild(this.label);
    if(this.description && this.description.parentNode) this.description.parentNode.removeChild(this.description);

    this._super();
  },
  /**
   * This is overridden in derivative editors
   */
  sanitize: function(value) {
    return value;
  },
  /**
   * Re-calculates the value if needed
   */
  onWatchedFieldChange: function() {
    var self = this, vars, j;

    // If this editor needs to be rendered by a macro template
    if(this.template) {
      vars = this.getWatchedFieldValues();
      this.setValue(this.template(vars),false,true);
    }

    this._super();
  },
  showValidationErrors: function(errors) {
    var self = this;

    if(this.jsoneditor.options.show_errors === "always") {}
    else if(!this.is_dirty && this.previous_error_setting===this.jsoneditor.options.show_errors) return;

    this.previous_error_setting = this.jsoneditor.options.show_errors;

    var messages = [];
    $each(errors,function(i,error) {
      if(error.path === self.path) {
        messages.push(error.message);
      }
    });

    if(messages.length) {
      this.theme.addInputError(this.input, messages.join('. ')+'.');
    }
    else {
      this.theme.removeInputError(this.input);
    }
  }
});

JSONEditor.defaults.editors.number = JSONEditor.defaults.editors.string.extend({
  sanitize: function(value) {
    return (value+"").replace(/[^0-9\.\-eE]/g,'');
  },
  getNumColumns: function() {
    return 2;
  },
  getValue: function() {
    return this.value*1;
  }
});

JSONEditor.defaults.editors.integer = JSONEditor.defaults.editors.number.extend({
  sanitize: function(value) {
    value = value + "";
    return value.replace(/[^0-9\-]/g,'');
  },
  getNumColumns: function() {
    return 2;
  }
});

JSONEditor.defaults.editors.object = JSONEditor.AbstractEditor.extend({
  getDefault: function() {
    return $extend({},this.schema.default || {});
  },
  getChildEditors: function() {
    return this.editors;
  },
  register: function() {
    this._super();
    if(this.editors) {
      for(var i in this.editors) {
        if(!this.editors.hasOwnProperty(i)) continue;
        this.editors[i].register();
      }
    }
  },
  unregister: function() {
    this._super();
    if(this.editors) {
      for(var i in this.editors) {
        if(!this.editors.hasOwnProperty(i)) continue;
        this.editors[i].unregister();
      }
    }
  },
  getNumColumns: function() {
    return Math.max(Math.min(12,this.maxwidth),3);
  },
  enable: function() {
    if(this.editjson_button) this.editjson_button.disabled = false;
    if(this.addproperty_button) this.addproperty_button.disabled = false;

    this._super();
    if(this.editors) {
      for(var i in this.editors) {
        if(!this.editors.hasOwnProperty(i)) continue;
        this.editors[i].enable();
      }
    }
  },
  disable: function() {
    if(this.editjson_button) this.editjson_button.disabled = true;
    if(this.addproperty_button) this.addproperty_button.disabled = true;
    this.hideEditJSON();

    this._super();
    if(this.editors) {
      for(var i in this.editors) {
        if(!this.editors.hasOwnProperty(i)) continue;
        this.editors[i].disable();
      }
    }
  },
  layoutEditors: function() {
    var self = this, i, j;

    if(!this.row_container) return;

    // Sort editors by propertyOrder
    this.property_order = Object.keys(this.editors);
    this.property_order = this.property_order.sort(function(a,b) {
      var ordera = self.editors[a].schema.propertyOrder;
      var orderb = self.editors[b].schema.propertyOrder;
      if(typeof ordera !== "number") ordera = 1000;
      if(typeof orderb !== "number") orderb = 1000;

      return ordera - orderb;
    });

    var container;

    if(this.format === 'grid') {
      var rows = [];
      $each(this.property_order, function(j,key) {
        var editor = self.editors[key];
        if(editor.property_removed) return;
        var found = false;
        var width = editor.options.hidden? 0 : editor.getNumColumns();
        var height = editor.options.hidden? 0 : editor.container.offsetHeight;
        // See if the editor will fit in any of the existing rows first
        for(var i=0; i<rows.length; i++) {
          // If the editor will fit in the row horizontally
          if(rows[i].width + width <= 12) {
            // If the editor is close to the other elements in height
            // i.e. Don't put a really tall editor in an otherwise short row or vice versa
            if(!height || (rows[i].minh*0.5 < height && rows[i].maxh*2 > height)) {
              found = i;
            }
          }
        }

        // If there isn't a spot in any of the existing rows, start a new row
        if(found === false) {
          rows.push({
            width: 0,
            minh: 999999,
            maxh: 0,
            editors: []
          });
          found = rows.length-1;
        }

        rows[found].editors.push({
          key: key,
          //editor: editor,
          width: width,
          height: height
        });
        rows[found].width += width;
        rows[found].minh = Math.min(rows[found].minh,height);
        rows[found].maxh = Math.max(rows[found].maxh,height);
      });

      // Make almost full rows width 12
      // Do this by increasing all editors' sizes proprotionately
      // Any left over space goes to the biggest editor
      // Don't touch rows with a width of 6 or less
      for(i=0; i<rows.length; i++) {
        if(rows[i].width < 12) {
          var biggest = false;
          var new_width = 0;
          for(j=0; j<rows[i].editors.length; j++) {
            if(biggest === false) biggest = j;
            else if(rows[i].editors[j].width > rows[i].editors[biggest].width) biggest = j;
            rows[i].editors[j].width *= 12/rows[i].width;
            rows[i].editors[j].width = Math.floor(rows[i].editors[j].width);
            new_width += rows[i].editors[j].width;
          }
          if(new_width < 12) rows[i].editors[biggest].width += 12-new_width;
          rows[i].width = 12;
        }
      }

      // layout hasn't changed
      if(this.layout === JSON.stringify(rows)) return false;
      this.layout = JSON.stringify(rows);

      // Layout the form
      container = document.createElement('div');
      for(i=0; i<rows.length; i++) {
        var row = this.theme.getGridRow();
        container.appendChild(row);
        for(j=0; j<rows[i].editors.length; j++) {
          var key = rows[i].editors[j].key;
          var editor = this.editors[key];

          if(editor.options.hidden) editor.container.style.display = 'none';
          else this.theme.setGridColumnSize(editor.container,rows[i].editors[j].width);
          editor.container.className += ' container-' + key;
          row.appendChild(editor.container);
        }
      }
    }
    // Normal layout
    else {
      container = document.createElement('div');
      $each(this.property_order, function(i,key) {
        var editor = self.editors[key];
        if(editor.property_removed) return;
        var row = self.theme.getGridRow();
        container.appendChild(row);

        if(editor.options.hidden) editor.container.style.display = 'none';
        else self.theme.setGridColumnSize(editor.container,12);
        editor.container.className += ' container-' + key;
        row.appendChild(editor.container);
      });
    }
    this.row_container.innerHTML = '';
    this.row_container.appendChild(container);
  },
  getPropertySchema: function(key) {
    // Schema declared directly in properties
    var schema = this.schema.properties[key] || {};
    schema = $extend({},schema);

    // Any matching patternProperties should be merged in
    if(this.schema.patternProperties) {
      for(var i in this.schema.patternProperties) {
        if(!this.schema.patternProperties.hasOwnProperty(i)) continue;
        var regex = new RegExp(i);
        if(regex.test(key)) {
          schema.allOf = schema.allOf || [];
          schema.allOf.push(this.schema.patternProperties[i]);
        }
      }
    }

    return schema;
  },
  preBuild: function() {
    this._super();

    this.editors = {};
    this.cached_editors = {};
    var self = this;

    this.format = this.options.layout || this.options.object_layout || this.schema.format || this.jsoneditor.options.object_layout || 'normal';

    this.schema.properties = this.schema.properties || {};

    this.minwidth = 0;
    this.maxwidth = 0;

    // If the object should be rendered as a table row
    if(this.options.table_row) {
      $each(this.schema.properties, function(key,schema) {
        var editor = self.jsoneditor.getEditorClass(schema);
        self.editors[key] = self.jsoneditor.createEditor(editor,{
          jsoneditor: self.jsoneditor,
          schema: schema,
          path: self.path+'.'+key,
          parent: self,
          compact: true,
          required: true
        });
        self.editors[key].preBuild();

        var width = self.editors[key].options.hidden? 0 : self.editors[key].getNumColumns();

        self.minwidth += width;
        self.maxwidth += width;
      });
      this.no_link_holder = true;
    }
    // If the object should be rendered as a table
    else if(this.options.table) {
      // TODO: table display format
      throw "Not supported yet";
    }
    // If the object should be rendered as a div
    else {
      this.defaultProperties = this.schema.defaultProperties || Object.keys(this.schema.properties);

      // Increase the grid width to account for padding
      self.maxwidth += 1;

      $each(this.defaultProperties, function(i,key) {
        self.addObjectProperty(key, true);

        if(self.editors[key]) {
          self.minwidth = Math.max(self.minwidth,self.editors[key].getNumColumns());
          self.maxwidth += self.editors[key].getNumColumns();
        }
      });
    }

    // Sort editors by propertyOrder
    this.property_order = Object.keys(this.editors);
    this.property_order = this.property_order.sort(function(a,b) {
      var ordera = self.editors[a].schema.propertyOrder;
      var orderb = self.editors[b].schema.propertyOrder;
      if(typeof ordera !== "number") ordera = 1000;
      if(typeof orderb !== "number") orderb = 1000;

      return ordera - orderb;
    });
  },
  build: function() {
    var self = this;

    // If the object should be rendered as a table row
    if(this.options.table_row) {
      this.editor_holder = this.container;
      $each(this.editors, function(key,editor) {
        var holder = self.theme.getTableCell();
        self.editor_holder.appendChild(holder);

        editor.setContainer(holder);
        editor.build();
        editor.postBuild();

        if(self.editors[key].options.hidden) {
          holder.style.display = 'none';
        }
      });
    }
    // If the object should be rendered as a table
    else if(this.options.table) {
      // TODO: table display format
      throw "Not supported yet";
    }
    // If the object should be rendered as a div
    else {
      this.header = document.createElement('span');
      this.header.textContent = this.getTitle();
      this.title = this.theme.getHeader(this.header);
      this.container.appendChild(this.title);
      this.container.style.position = 'relative';

      // Edit JSON modal
      this.editjson_holder = this.theme.getModal();
      this.editjson_textarea = this.theme.getTextareaInput();
      this.editjson_textarea.style.height = '170px';
      this.editjson_textarea.style.width = '300px';
      this.editjson_textarea.style.display = 'block';
      this.editjson_save = this.getButton('Save','save','Save');
      this.editjson_save.addEventListener('click',function(e) {
        e.preventDefault();
        e.stopPropagation();
        self.saveJSON();
      });
      this.editjson_cancel = this.getButton('Cancel','cancel','Cancel');
      this.editjson_cancel.addEventListener('click',function(e) {
        e.preventDefault();
        e.stopPropagation();
        self.hideEditJSON();
      });
      this.editjson_holder.appendChild(this.editjson_textarea);
      this.editjson_holder.appendChild(this.editjson_save);
      this.editjson_holder.appendChild(this.editjson_cancel);

      // Manage Properties modal
      this.addproperty_holder = this.theme.getModal();
      this.addproperty_list = document.createElement('div');
      this.addproperty_list.style.width = '295px';
      this.addproperty_list.style.maxHeight = '160px';
      this.addproperty_list.style.padding = '5px 0';
      this.addproperty_list.style.overflowY = 'auto';
      this.addproperty_list.style.overflowX = 'hidden';
      this.addproperty_list.style.paddingLeft = '5px';
      this.addproperty_add = this.getButton('add','add','add');
      this.addproperty_input = this.theme.getFormInputField('text');
      this.addproperty_input.setAttribute('placeholder','Property name...');
      this.addproperty_input.style.width = '220px';
      this.addproperty_input.style.marginBottom = '0';
      this.addproperty_input.style.display = 'inline-block';
      this.addproperty_add.addEventListener('click',function(e) {
        e.preventDefault();
        e.stopPropagation();
        if(self.addproperty_input.value) {
          if(self.editors[self.addproperty_input.value]) {
            window.alert('there is already a property with that name');
            return;
          }

          self.addObjectProperty(self.addproperty_input.value);
          if(self.editors[self.addproperty_input.value]) {
            self.editors[self.addproperty_input.value].disable();
          }
          self.onChange(true);
        }
      });
      this.addproperty_holder.appendChild(this.addproperty_list);
      this.addproperty_holder.appendChild(this.addproperty_input);
      this.addproperty_holder.appendChild(this.addproperty_add);
      var spacer = document.createElement('div');
      spacer.style.clear = 'both';
      this.addproperty_holder.appendChild(spacer);


      // Description
      if(this.schema.description) {
        this.description = this.theme.getDescription(this.schema.description);
        this.container.appendChild(this.description);
      }

      // Validation error placeholder area
      this.error_holder = document.createElement('div');
      this.container.appendChild(this.error_holder);

      // Container for child editor area
      this.editor_holder = this.theme.getIndentedPanel();
      this.editor_holder.style.paddingBottom = '0';
      this.container.appendChild(this.editor_holder);

      // Container for rows of child editors
      this.row_container = this.theme.getGridContainer();
      this.editor_holder.appendChild(this.row_container);

      $each(this.editors, function(key,editor) {
        var holder = self.theme.getGridColumn();
        self.row_container.appendChild(holder);

        editor.setContainer(holder);
        editor.build();
        editor.postBuild();
      });

      // Control buttons
      this.title_controls = this.theme.getHeaderButtonHolder();
      this.editjson_controls = this.theme.getHeaderButtonHolder();
      this.addproperty_controls = this.theme.getHeaderButtonHolder();
      this.title.appendChild(this.title_controls);
      this.title.appendChild(this.editjson_controls);
      this.title.appendChild(this.addproperty_controls);

      // Show/Hide button
      this.collapsed = false;
      this.toggle_button = this.getButton('','collapse','Collapse');
      this.title_controls.appendChild(this.toggle_button);
      this.toggle_button.addEventListener('click',function(e) {
        e.preventDefault();
        e.stopPropagation();
        if(self.collapsed) {
          self.editor_holder.style.display = '';
          self.collapsed = false;
          self.setButtonText(self.toggle_button,'','collapse','Collapse');
        }
        else {
          self.editor_holder.style.display = 'none';
          self.collapsed = true;
          self.setButtonText(self.toggle_button,'','expand','Expand');
        }
      });

      // If it should start collapsed
      if(this.options.collapsed) {
        $trigger(this.toggle_button,'click');
      }

      // Collapse button disabled
      if(this.schema.options && typeof this.schema.options.disable_collapse !== "undefined") {
        if(this.schema.options.disable_collapse) this.toggle_button.style.display = 'none';
      }
      else if(this.jsoneditor.options.disable_collapse) {
        this.toggle_button.style.display = 'none';
      }

      // Edit JSON Button
      this.editjson_button = this.getButton('JSON','edit','Edit JSON');
      this.editjson_button.addEventListener('click',function(e) {
        e.preventDefault();
        e.stopPropagation();
        self.toggleEditJSON();
      });
      this.editjson_controls.appendChild(this.editjson_button);
      this.editjson_controls.appendChild(this.editjson_holder);

      // Edit JSON Buttton disabled
      if(this.schema.options && typeof this.schema.options.disable_edit_json !== "undefined") {
        if(this.schema.options.disable_edit_json) this.editjson_button.style.display = 'none';
      }
      else if(this.jsoneditor.options.disable_edit_json) {
        this.editjson_button.style.display = 'none';
      }

      // Object Properties Button
      this.addproperty_button = this.getButton('Properties','edit','Object Properties');
      this.addproperty_button.addEventListener('click',function(e) {
        e.preventDefault();
        e.stopPropagation();
        self.toggleAddProperty();
      });
      this.addproperty_controls.appendChild(this.addproperty_button);
      this.addproperty_controls.appendChild(this.addproperty_holder);
      this.refreshAddProperties();
    }

    // Fix table cell ordering
    if(this.options.table_row) {
      this.editor_holder = this.container;
      $each(this.property_order,function(i,key) {
        self.editor_holder.appendChild(self.editors[key].container);
      });
    }
    // Layout object editors in grid if needed
    else {
      // Initial layout
      this.layoutEditors();
      // Do it again now that we know the approximate heights of elements
      this.layoutEditors();
    }
  },
  showEditJSON: function() {
    if(!this.editjson_holder) return;
    this.hideAddProperty();

    // Position the form directly beneath the button
    // TODO: edge detection
    this.editjson_holder.style.left = this.editjson_button.offsetLeft+"px";
    this.editjson_holder.style.top = this.editjson_button.offsetTop + this.editjson_button.offsetHeight+"px";

    // Start the textarea with the current value
    this.editjson_textarea.value = JSON.stringify(this.getValue(),null,2);

    // Disable the rest of the form while editing JSON
    this.disable();

    this.editjson_holder.style.display = '';
    this.editjson_button.disabled = false;
    this.editing_json = true;
  },
  hideEditJSON: function() {
    if(!this.editjson_holder) return;
    if(!this.editing_json) return;

    this.editjson_holder.style.display = 'none';
    this.enable();
    this.editing_json = false;
  },
  saveJSON: function() {
    if(!this.editjson_holder) return;

    try {
      var json = JSON.parse(this.editjson_textarea.value);
      this.setValue(json);
      this.hideEditJSON();
    }
    catch(e) {
      window.alert('invalid JSON');
      throw e;
    }
  },
  toggleEditJSON: function() {
    if(this.editing_json) this.hideEditJSON();
    else this.showEditJSON();
  },
  insertPropertyControlUsingPropertyOrder: function (property, control, container) {
    var propertyOrder = this.schema.properties[property].propertyOrder;
    if (typeof propertyOrder !== "number") propertyOrder = 1000;
    control.propertyOrder = propertyOrder;

    for (var i = 0; i < container.childNodes.length; i++) {
      var child = container.childNodes[i];
      if (control.propertyOrder < child.propertyOrder) {
        this.addproperty_list.insertBefore(control, child);
        control = null;
        break;
      }
    }
    if (control) {
      this.addproperty_list.appendChild(control);
    }
  },
  addPropertyCheckbox: function(key) {
    var self = this;
    var checkbox, label, labelText, control;

    checkbox = self.theme.getCheckbox();
    checkbox.style.width = 'auto';

    labelText = this.schema.properties[key].title ? this.schema.properties[key].title : key;
    label = self.theme.getCheckboxLabel(labelText);

    control = self.theme.getFormControl(label,checkbox);
    control.style.paddingBottom = control.style.marginBottom = control.style.paddingTop = control.style.marginTop = 0;
    control.style.height = 'auto';
    //control.style.overflowY = 'hidden';

    this.insertPropertyControlUsingPropertyOrder(key, control, this.addproperty_list);

    checkbox.checked = key in this.editors;
    checkbox.addEventListener('change',function() {
      if(checkbox.checked) {
        self.addObjectProperty(key);
      }
      else {
        self.removeObjectProperty(key);
      }
      self.onChange(true);
    });
    self.addproperty_checkboxes[key] = checkbox;

    return checkbox;
  },
  showAddProperty: function() {
    if(!this.addproperty_holder) return;
    this.hideEditJSON();

    // Position the form directly beneath the button
    // TODO: edge detection
    this.addproperty_holder.style.left = this.addproperty_button.offsetLeft+"px";
    this.addproperty_holder.style.top = this.addproperty_button.offsetTop + this.addproperty_button.offsetHeight+"px";

    // Disable the rest of the form while editing JSON
    this.disable();

    this.adding_property = true;
    this.addproperty_button.disabled = false;
    this.addproperty_holder.style.display = '';
    this.refreshAddProperties();
  },
  hideAddProperty: function() {
    if(!this.addproperty_holder) return;
    if(!this.adding_property) return;

    this.addproperty_holder.style.display = 'none';
    this.enable();

    this.adding_property = false;
  },
  toggleAddProperty: function() {
    if(this.adding_property) this.hideAddProperty();
    else this.showAddProperty();
  },
  removeObjectProperty: function(property) {
    if(this.editors[property]) {
      this.editors[property].unregister();
      delete this.editors[property];

      this.refreshValue();
      this.layoutEditors();
    }
  },
  addObjectProperty: function(name, prebuild_only) {
    var self = this;

    // Property is already added
    if(this.editors[name]) return;

    // Property was added before and is cached
    if(this.cached_editors[name]) {
      this.editors[name] = this.cached_editors[name];
      if(prebuild_only) return;
      this.editors[name].register();
    }
    // New property
    else {
      if(!this.canHaveAdditionalProperties() && (!this.schema.properties || !this.schema.properties[name])) {
        return;
      }

      var schema = self.getPropertySchema(name);


      // Add the property
      var editor = self.jsoneditor.getEditorClass(schema);

      self.editors[name] = self.jsoneditor.createEditor(editor,{
        jsoneditor: self.jsoneditor,
        schema: schema,
        path: self.path+'.'+name,
        parent: self
      });
      self.editors[name].preBuild();

      if(!prebuild_only) {
        var holder = self.theme.getChildEditorHolder();
        self.editor_holder.appendChild(holder);
        self.editors[name].setContainer(holder);
        self.editors[name].build();
        self.editors[name].postBuild();
      }

      self.cached_editors[name] = self.editors[name];
    }

    // If we're only prebuilding the editors, don't refresh values
    if(!prebuild_only) {
      self.refreshValue();
      self.layoutEditors();
    }
  },
  onChildEditorChange: function(editor) {
    this.refreshValue();
    this._super(editor);
  },
  canHaveAdditionalProperties: function() {
    return (this.schema.additionalProperties === true) || !this.jsoneditor.options.no_additional_properties;
  },
  destroy: function() {
    $each(this.cached_editors, function(i,el) {
      el.destroy();
    });
    if(this.editor_holder) this.editor_holder.innerHTML = '';
    if(this.title && this.title.parentNode) this.title.parentNode.removeChild(this.title);
    if(this.error_holder && this.error_holder.parentNode) this.error_holder.parentNode.removeChild(this.error_holder);

    this.editors = null;
    this.cached_editors = null;
    if(this.editor_holder && this.editor_holder.parentNode) this.editor_holder.parentNode.removeChild(this.editor_holder);
    this.editor_holder = null;

    this._super();
  },
  getValue: function() {
    var result = this._super();
    if(this.jsoneditor.options.remove_empty_properties || this.options.remove_empty_properties) {
      for(var i in result) {
        if(result.hasOwnProperty(i)) {
          if(!result[i]) delete result[i];
        }
      }
    }
    return result;
  },
  refreshValue: function() {
    this.value = {};
    var self = this;

    for(var i in this.editors) {
      if(!this.editors.hasOwnProperty(i)) continue;
      this.value[i] = this.editors[i].getValue();
    }

    if(this.adding_property) this.refreshAddProperties();
  },
  refreshAddProperties: function() {
    if(this.options.disable_properties || (this.options.disable_properties !== false && this.jsoneditor.options.disable_properties)) {
      this.addproperty_controls.style.display = 'none';
      return;
    }

    var can_add = false, can_remove = false, num_props = 0, i, show_modal = false;

    // Get number of editors
    for(i in this.editors) {
      if(!this.editors.hasOwnProperty(i)) continue;
      num_props++;
    }

    // Determine if we can add back removed properties
    can_add = this.canHaveAdditionalProperties() && !(typeof this.schema.maxProperties !== "undefined" && num_props >= this.schema.maxProperties);

    if(this.addproperty_checkboxes) {
      this.addproperty_list.innerHTML = '';
    }
    this.addproperty_checkboxes = {};

    // Check for which editors can't be removed or added back
    for(i in this.cached_editors) {
      if(!this.cached_editors.hasOwnProperty(i)) continue;

      this.addPropertyCheckbox(i);

      if(this.isRequired(this.cached_editors[i]) && i in this.editors) {
        this.addproperty_checkboxes[i].disabled = true;
      }

      if(typeof this.schema.minProperties !== "undefined" && num_props <= this.schema.minProperties) {
        this.addproperty_checkboxes[i].disabled = this.addproperty_checkboxes[i].checked;
        if(!this.addproperty_checkboxes[i].checked) show_modal = true;
      }
      else if(!(i in this.editors)) {
        if(!can_add  && !this.schema.properties.hasOwnProperty(i)) {
          this.addproperty_checkboxes[i].disabled = true;
        }
        else {
          this.addproperty_checkboxes[i].disabled = false;
          show_modal = true;
        }
      }
      else {
        show_modal = true;
        can_remove = true;
      }
    }

    if(this.canHaveAdditionalProperties()) {
      show_modal = true;
    }

    // Additional addproperty checkboxes not tied to a current editor
    for(i in this.schema.properties) {
      if(!this.schema.properties.hasOwnProperty(i)) continue;
      if(this.cached_editors[i]) continue;
      show_modal = true;
      this.addPropertyCheckbox(i);
    }

    // If no editors can be added or removed, hide the modal button
    if(!show_modal) {
      this.hideAddProperty();
      this.addproperty_controls.style.display = 'none';
    }
    // If additional properties are disabled
    else if(!this.canHaveAdditionalProperties()) {
      this.addproperty_add.style.display = 'none';
      this.addproperty_input.style.display = 'none';
    }
    // If no new properties can be added
    else if(!can_add) {
      this.addproperty_add.disabled = true;
    }
    // If new properties can be added
    else {
      this.addproperty_add.disabled = false;
    }
  },
  isRequired: function(editor) {
    if(typeof editor.schema.required === "boolean") return editor.schema.required;
    else if(Array.isArray(this.schema.required)) return this.schema.required.indexOf(editor.key) > -1;
    else if(this.jsoneditor.options.required_by_default) return true;
    else return false;
  },
  setValue: function(value, initial) {
    var self = this;
    value = value || {};

    if(typeof value !== "object" || Array.isArray(value)) value = {};

    // First, set the values for all of the defined properties
    $each(this.cached_editors, function(i,editor) {
      // Value explicitly set
      if(typeof value[i] !== "undefined") {
        self.addObjectProperty(i);
        editor.setValue(value[i],initial);
      }
      // Otherwise, remove value unless this is the initial set or it's required
      // else if(!initial && !self.isRequired(editor)) {
      //  self.removeObjectProperty(i);
      //}
      // Otherwise, set the value to the default
      else {
        editor.setValue(editor.getDefault(),initial);
      }
    });

    $each(value, function(i,val) {
      if(!self.cached_editors[i]) {
        self.addObjectProperty(i);
        if(self.editors[i]) self.editors[i].setValue(val,initial);
      }
    });

    this.refreshValue();
    this.layoutEditors();
    this.onChange();
  },
  showValidationErrors: function(errors) {
    var self = this;

    // Get all the errors that pertain to this editor
    var my_errors = [];
    var other_errors = [];
    $each(errors, function(i,error) {
      if(error.path === self.path) {
        my_errors.push(error);
      }
      else {
        other_errors.push(error);
      }
    });

    // Show errors for this editor
    if(this.error_holder) {
      if(my_errors.length) {
        var message = [];
        this.error_holder.innerHTML = '';
        this.error_holder.style.display = '';
        $each(my_errors, function(i,error) {
          self.error_holder.appendChild(self.theme.getErrorMessage(error.message));
        });
      }
      // Hide error area
      else {
        this.error_holder.style.display = 'none';
      }
    }

    // Show error for the table row if this is inside a table
    if(this.options.table_row) {
      if(my_errors.length) {
        this.theme.addTableRowError(this.container);
      }
      else {
        this.theme.removeTableRowError(this.container);
      }
    }

    // Show errors for child editors
    $each(this.editors, function(i,editor) {
      editor.showValidationErrors(other_errors);
    });
  }
});

JSONEditor.defaults.editors.array = JSONEditor.AbstractEditor.extend({
  getDefault: function() {
    return this.schema.default || [];
  },
  register: function() {
    this._super();
    if(this.rows) {
      for(var i=0; i<this.rows.length; i++) {
        this.rows[i].register();
      }
    }
  },
  unregister: function() {
    this._super();
    if(this.rows) {
      for(var i=0; i<this.rows.length; i++) {
        this.rows[i].unregister();
      }
    }
  },
  getNumColumns: function() {
    var info = this.getItemInfo(0);
    // Tabs require extra horizontal space
    if(this.tabs_holder) {
      return Math.max(Math.min(12,info.width+2),4);
    }
    else {
      return info.width;
    }
  },
  enable: function() {
    if(this.add_row_button) this.add_row_button.disabled = false;
    if(this.remove_all_rows_button) this.remove_all_rows_button.disabled = false;
    if(this.delete_last_row_button) this.delete_last_row_button.disabled = false;

    if(this.rows) {
      for(var i=0; i<this.rows.length; i++) {
        this.rows[i].enable();

        if(this.rows[i].moveup_button) this.rows[i].moveup_button.disabled = false;
        if(this.rows[i].movedown_button) this.rows[i].movedown_button.disabled = false;
        if(this.rows[i].delete_button) this.rows[i].delete_button.disabled = false;
      }
    }
    this._super();
  },
  disable: function() {
    if(this.add_row_button) this.add_row_button.disabled = true;
    if(this.remove_all_rows_button) this.remove_all_rows_button.disabled = true;
    if(this.delete_last_row_button) this.delete_last_row_button.disabled = true;

    if(this.rows) {
      for(var i=0; i<this.rows.length; i++) {
        this.rows[i].disable();

        if(this.rows[i].moveup_button) this.rows[i].moveup_button.disabled = true;
        if(this.rows[i].movedown_button) this.rows[i].movedown_button.disabled = true;
        if(this.rows[i].delete_button) this.rows[i].delete_button.disabled = true;
      }
    }
    this._super();
  },
  preBuild: function() {
    this._super();

    this.rows = [];
    this.row_cache = [];

    this.hide_delete_buttons = this.options.disable_array_delete || this.jsoneditor.options.disable_array_delete;
    this.hide_move_buttons = this.options.disable_array_reorder || this.jsoneditor.options.disable_array_reorder;
    this.hide_add_button = this.options.disable_array_add || this.jsoneditor.options.disable_array_add;
  },
  build: function() {
    var self = this;

    if(!this.options.compact) {
      this.header = document.createElement('span');
      this.header.textContent = this.getTitle();
      this.title = this.theme.getHeader(this.header);
      this.container.appendChild(this.title);
      this.title_controls = this.theme.getHeaderButtonHolder();
      this.title.appendChild(this.title_controls);
      if(this.schema.description) {
        this.description = this.theme.getDescription(this.schema.description);
        this.container.appendChild(this.description);
      }
      this.error_holder = document.createElement('div');
      this.container.appendChild(this.error_holder);

      if(this.schema.format === 'tabs') {
        this.controls = this.theme.getHeaderButtonHolder();
        this.title.appendChild(this.controls);
        this.tabs_holder = this.theme.getTabHolder();
        this.container.appendChild(this.tabs_holder);
        this.row_holder = this.theme.getTabContentHolder(this.tabs_holder);

        this.active_tab = null;
      }
      else {
        this.panel = this.theme.getIndentedPanel();
        this.container.appendChild(this.panel);
        this.row_holder = document.createElement('div');
        this.panel.appendChild(this.row_holder);
        this.controls = this.theme.getButtonHolder();
        this.panel.appendChild(this.controls);
      }
    }
    else {
        this.panel = this.theme.getIndentedPanel();
        this.container.appendChild(this.panel);
        this.controls = this.theme.getButtonHolder();
        this.panel.appendChild(this.controls);
        this.row_holder = document.createElement('div');
        this.panel.appendChild(this.row_holder);
    }

    // Add controls
    this.addControls();
  },
  onChildEditorChange: function(editor) {
    this.refreshValue();
    this.refreshTabs(true);
    this._super(editor);
  },
  getItemTitle: function() {
    if(!this.item_title) {
      if(this.schema.items && !Array.isArray(this.schema.items)) {
        var tmp = this.jsoneditor.expandRefs(this.schema.items);
        this.item_title = tmp.title || 'item';
      }
      else {
        this.item_title = 'item';
      }
    }
    return this.item_title;
  },
  getItemSchema: function(i) {
    if(Array.isArray(this.schema.items)) {
      if(i >= this.schema.items.length) {
        if(this.schema.additionalItems===true) {
          return {};
        }
        else if(this.schema.additionalItems) {
          return $extend({},this.schema.additionalItems);
        }
      }
      else {
        return $extend({},this.schema.items[i]);
      }
    }
    else if(this.schema.items) {
      return $extend({},this.schema.items);
    }
    else {
      return {};
    }
  },
  getItemInfo: function(i) {
    var schema = this.getItemSchema(i);

    // Check if it's cached
    this.item_info = this.item_info || {};
    var stringified = JSON.stringify(schema);
    if(typeof this.item_info[stringified] !== "undefined") return this.item_info[stringified];

    // Get the schema for this item
    schema = this.jsoneditor.expandRefs(schema);

    this.item_info[stringified] = {
      title: schema.title || "item",
      'default': schema.default,
      width: 12,
      child_editors: schema.properties || schema.items
    };

    return this.item_info[stringified];
  },
  getElementEditor: function(i) {
    var item_info = this.getItemInfo(i);
    var schema = this.getItemSchema(i);
    schema = this.jsoneditor.expandRefs(schema);
    schema.title = item_info.title+' '+(i+1);

    var editor = this.jsoneditor.getEditorClass(schema);

    var holder;
    if(this.tabs_holder) {
      holder = this.theme.getTabContent();
    }
    else if(item_info.child_editors) {
      holder = this.theme.getChildEditorHolder();
    }
    else {
      holder = this.theme.getIndentedPanel();
    }

    this.row_holder.appendChild(holder);

    var ret = this.jsoneditor.createEditor(editor,{
      jsoneditor: this.jsoneditor,
      schema: schema,
      container: holder,
      path: this.path+'.'+i,
      parent: this,
      required: true
    });
    ret.preBuild();
    ret.build();
    ret.postBuild();

    if(!ret.title_controls) {
      ret.array_controls = this.theme.getButtonHolder();
      holder.appendChild(ret.array_controls);
    }

    return ret;
  },
  destroy: function() {
    this.empty(true);
    if(this.title && this.title.parentNode) this.title.parentNode.removeChild(this.title);
    if(this.description && this.description.parentNode) this.description.parentNode.removeChild(this.description);
    if(this.row_holder && this.row_holder.parentNode) this.row_holder.parentNode.removeChild(this.row_holder);
    if(this.controls && this.controls.parentNode) this.controls.parentNode.removeChild(this.controls);
    if(this.panel && this.panel.parentNode) this.panel.parentNode.removeChild(this.panel);

    this.rows = this.row_cache = this.title = this.description = this.row_holder = this.panel = this.controls = null;

    this._super();
  },
  empty: function(hard) {
    if(!this.rows) return;
    var self = this;
    $each(this.rows,function(i,row) {
      if(hard) {
        if(row.tab && row.tab.parentNode) row.tab.parentNode.removeChild(row.tab);
        self.destroyRow(row,true);
        self.row_cache[i] = null;
      }
      self.rows[i] = null;
    });
    self.rows = [];
    if(hard) self.row_cache = [];
  },
  destroyRow: function(row,hard) {
    var holder = row.container;
    if(hard) {
      row.destroy();
      if(holder.parentNode) holder.parentNode.removeChild(holder);
      if(row.tab && row.tab.parentNode) row.tab.parentNode.removeChild(row.tab);
    }
    else {
      if(row.tab) row.tab.style.display = 'none';
      holder.style.display = 'none';
      row.unregister();
    }
  },
  getMax: function() {
    if((Array.isArray(this.schema.items)) && this.schema.additionalItems === false) {
      return Math.min(this.schema.items.length,this.schema.maxItems || Infinity);
    }
    else {
      return this.schema.maxItems || Infinity;
    }
  },
  refreshTabs: function(refresh_headers) {
    var self = this;
    $each(this.rows, function(i,row) {
      if(!row.tab) return;

      if(refresh_headers) {
        row.tab_text.textContent = row.getHeaderText();
      }
      else {
        if(row.tab === self.active_tab) {
          self.theme.markTabActive(row.tab);
          row.container.style.display = '';
        }
        else {
          self.theme.markTabInactive(row.tab);
          row.container.style.display = 'none';
        }
      }
    });
  },
  setValue: function(value, initial) {
    // Update the array's value, adding/removing rows when necessary
    value = value || [];

    if(!(Array.isArray(value))) value = [value];

    var serialized = JSON.stringify(value);
    if(serialized === this.serialized) return;

    // Make sure value has between minItems and maxItems items in it
    if(this.schema.minItems) {
      while(value.length < this.schema.minItems) {
        value.push(this.getItemInfo(value.length).default);
      }
    }
    if(this.getMax() && value.length > this.getMax()) {
      value = value.slice(0,this.getMax());
    }

    var self = this;
    $each(value,function(i,val) {
      if(self.rows[i]) {
        // TODO: don't set the row's value if it hasn't changed
        self.rows[i].setValue(val,initial);
      }
      else if(self.row_cache[i]) {
        self.rows[i] = self.row_cache[i];
        self.rows[i].setValue(val,initial);
        self.rows[i].container.style.display = '';
        if(self.rows[i].tab) self.rows[i].tab.style.display = '';
        self.rows[i].register();
      }
      else {
        self.addRow(val,initial);
      }
    });

    for(var j=value.length; j<self.rows.length; j++) {
      self.destroyRow(self.rows[j]);
      self.rows[j] = null;
    }
    self.rows = self.rows.slice(0,value.length);

    // Set the active tab
    var new_active_tab = null;
    $each(self.rows, function(i,row) {
      if(row.tab === self.active_tab) {
        new_active_tab = row.tab;
        return false;
      }
    });
    if(!new_active_tab && self.rows.length) new_active_tab = self.rows[0].tab;

    self.active_tab = new_active_tab;

    self.refreshValue(initial);
    self.refreshTabs();

    self.onChange();

    // TODO: sortable
  },
  refreshValue: function(force) {
    var self = this;
    var oldi = this.value? this.value.length : 0;
    this.value = [];

    $each(this.rows,function(i,editor) {
      // Get the value for this editor
      self.value[i] = editor.getValue();
    });

    if(oldi !== this.value.length || force) {
      // If we currently have minItems items in the array
      var minItems = this.schema.minItems && this.schema.minItems >= this.rows.length;

      $each(this.rows,function(i,editor) {
        // Hide the move down button for the last row
        if(editor.movedown_buttons) {
          if(i === self.rows.length - 1) {
            editor.movedown_button.style.display = 'none';
          }
          else {
            editor.movedown_button.style.display = '';
          }
        }

        // Hide the delete button if we have minItems items
        if(editor.delete_button) {
          if(minItems) {
            editor.delete_button.style.display = 'none';
          }
          else {
            editor.delete_button.style.display = '';
          }
        }

        // Get the value for this editor
        self.value[i] = editor.getValue();
      });

      var controls_needed = false;

      if(!this.value.length) {
        this.delete_last_row_button.style.display = 'none';
        this.remove_all_rows_button.style.display = 'none';
      }
      else if(this.value.length === 1) {
        this.remove_all_rows_button.style.display = 'none';

        // If there are minItems items in the array, hide the delete button beneath the rows
        if(minItems || this.hide_delete_buttons) {
          this.delete_last_row_button.style.display = 'none';
        }
        else {
          this.delete_last_row_button.style.display = '';
          controls_needed = true;
        }
      }
      else {
        // If there are minItems items in the array, hide the delete button beneath the rows
        if(minItems || this.hide_delete_buttons) {
          this.delete_last_row_button.style.display = 'none';
          this.remove_all_rows_button.style.display = 'none';
        }
        else {
          this.delete_last_row_button.style.display = '';
          this.remove_all_rows_button.style.display = '';
          controls_needed = true;
        }
      }

      // If there are maxItems in the array, hide the add button beneath the rows
      if((this.getMax() && this.getMax() <= this.rows.length) || this.hide_add_button){
        this.add_row_button.style.display = 'none';
      }
      else {
        this.add_row_button.style.display = '';
        controls_needed = true;
      }

      if(!this.collapsed && controls_needed) {
        this.controls.style.display = 'inline-block';
      }
      else {
        this.controls.style.display = 'none';
      }
    }
  },
  addRow: function(value, initial) {
    var self = this;
    var i = this.rows.length;

    self.rows[i] = this.getElementEditor(i);
    self.row_cache[i] = self.rows[i];

    if(self.tabs_holder) {
      self.rows[i].tab_text = document.createElement('span');
      self.rows[i].tab_text.textContent = self.rows[i].getHeaderText();
      self.rows[i].tab = self.theme.getTab(self.rows[i].tab_text);
      self.rows[i].tab.addEventListener('click', function(e) {
        self.active_tab = self.rows[i].tab;
        self.refreshTabs();
        e.preventDefault();
        e.stopPropagation();
      });

      self.theme.addTab(self.tabs_holder, self.rows[i].tab);
    }

    var controls_holder = self.rows[i].title_controls || self.rows[i].array_controls;

    // Buttons to delete row, move row up, and move row down
    if(!self.hide_delete_buttons) {
      self.rows[i].delete_button = this.getButton(self.getItemTitle(),'delete','Delete '+self.getItemTitle());
      self.rows[i].delete_button.className += ' delete';
      self.rows[i].delete_button.setAttribute('data-i',i);
      self.rows[i].delete_button.addEventListener('click',function(e) {
        e.preventDefault();
        e.stopPropagation();
        var i = this.getAttribute('data-i')*1;

        var value = self.getValue();

        var newval = [];
        var new_active_tab = null;
        $each(value,function(j,row) {
          if(j===i) {
            // If the one we're deleting is the active tab
            if(self.rows[j].tab === self.active_tab) {
              // Make the next tab active if there is one
              // Note: the next tab is going to be the current tab after deletion
              if(self.rows[j+1]) new_active_tab = self.rows[j].tab;
              // Otherwise, make the previous tab active if there is one
              else if(j) new_active_tab = self.rows[j-1].tab;
            }

            return; // If this is the one we're deleting
          }
          newval.push(row);
        });
        self.setValue(newval);
        if(new_active_tab) {
          self.active_tab = new_active_tab;
          self.refreshTabs();
        }

        self.onChange(true);
      });

      if(controls_holder) {
        controls_holder.appendChild(self.rows[i].delete_button);
      }
    }

    if(i && !self.hide_move_buttons) {
      self.rows[i].moveup_button = this.getButton('','moveup','Move up');
      self.rows[i].moveup_button.className += ' moveup';
      self.rows[i].moveup_button.setAttribute('data-i',i);
      self.rows[i].moveup_button.addEventListener('click',function(e) {
        e.preventDefault();
        e.stopPropagation();
        var i = this.getAttribute('data-i')*1;

        if(i<=0) return;
        var rows = self.getValue();
        var tmp = rows[i-1];
        rows[i-1] = rows[i];
        rows[i] = tmp;

        self.setValue(rows);
        self.active_tab = self.rows[i-1].tab;
        self.refreshTabs();

        self.onChange(true);
      });

      if(controls_holder) {
        controls_holder.appendChild(self.rows[i].moveup_button);
      }
    }

    if(!self.hide_move_buttons) {
      self.rows[i].movedown_button = this.getButton('','movedown','Move down');
      self.rows[i].movedown_button.className += ' movedown';
      self.rows[i].movedown_button.setAttribute('data-i',i);
      self.rows[i].movedown_button.addEventListener('click',function(e) {
        e.preventDefault();
        e.stopPropagation();
        var i = this.getAttribute('data-i')*1;

        var rows = self.getValue();
        if(i>=rows.length-1) return;
        var tmp = rows[i+1];
        rows[i+1] = rows[i];
        rows[i] = tmp;

        self.setValue(rows);
        self.active_tab = self.rows[i+1].tab;
        self.refreshTabs();
        self.onChange(true);
      });

      if(controls_holder) {
        controls_holder.appendChild(self.rows[i].movedown_button);
      }
    }

    if(value) self.rows[i].setValue(value, initial);
    self.refreshTabs();
  },
  addControls: function() {
    var self = this;

    this.collapsed = false;
    this.toggle_button = this.getButton('','collapse','Collapse');
    this.title_controls.appendChild(this.toggle_button);
    var row_holder_display = self.row_holder.style.display;
    var controls_display = self.controls.style.display;
    this.toggle_button.addEventListener('click',function(e) {
      e.preventDefault();
      e.stopPropagation();
      if(self.collapsed) {
        self.collapsed = false;
        if(self.panel) self.panel.style.display = '';
        self.row_holder.style.display = row_holder_display;
        if(self.tabs_holder) self.tabs_holder.style.display = '';
        self.controls.style.display = controls_display;
        self.setButtonText(this,'','collapse','Collapse');
      }
      else {
        self.collapsed = true;
        self.row_holder.style.display = 'none';
        if(self.tabs_holder) self.tabs_holder.style.display = 'none';
        self.controls.style.display = 'none';
        if(self.panel) self.panel.style.display = 'none';
        self.setButtonText(this,'','expand','Expand');
      }
    });

    // If it should start collapsed
    if(this.options.collapsed) {
      $trigger(this.toggle_button,'click');
    }

    // Collapse button disabled
    if(this.schema.options && typeof this.schema.options.disable_collapse !== "undefined") {
      if(this.schema.options.disable_collapse) this.toggle_button.style.display = 'none';
    }
    else if(this.jsoneditor.options.disable_collapse) {
      this.toggle_button.style.display = 'none';
    }

    // Add "new row" and "delete last" buttons below editor
    this.add_row_button = this.getButton(this.getItemTitle(),'add','Add '+this.getItemTitle());

    this.add_row_button.addEventListener('click',function(e) {
      e.preventDefault();
      e.stopPropagation();
      var i = self.rows.length;
      if(self.row_cache[i]) {
        self.rows[i] = self.row_cache[i];
        self.rows[i].container.style.display = '';
        if(self.rows[i].tab) self.rows[i].tab.style.display = '';
        self.rows[i].register();
      }
      else {
        self.addRow();
      }
      self.active_tab = self.rows[i].tab;
      self.refreshTabs();
      self.refreshValue();
      self.onChange(true);
    });
    self.controls.appendChild(this.add_row_button);

    this.delete_last_row_button = this.getButton('Last '+this.getItemTitle(),'delete','Delete Last '+this.getItemTitle());
    this.delete_last_row_button.addEventListener('click',function(e) {
      e.preventDefault();
      e.stopPropagation();
      var rows = self.getValue();

      var new_active_tab = null;
      if(self.rows.length > 1 && self.rows[self.rows.length-1].tab === self.active_tab) new_active_tab = self.rows[self.rows.length-2].tab;

      rows.pop();
      self.setValue(rows);
      if(new_active_tab) {
        self.active_tab = new_active_tab;
        self.refreshTabs();
      }
      self.onChange(true);
    });
    self.controls.appendChild(this.delete_last_row_button);

    this.remove_all_rows_button = this.getButton('All','delete','Delete All');
    this.remove_all_rows_button.addEventListener('click',function(e) {
      e.preventDefault();
      e.stopPropagation();
      self.setValue([]);
      self.onChange(true);
    });
    self.controls.appendChild(this.remove_all_rows_button);

    if(self.tabs) {
      this.add_row_button.style.width = '100%';
      this.add_row_button.style.textAlign = 'left';
      this.add_row_button.style.marginBottom = '3px';

      this.delete_last_row_button.style.width = '100%';
      this.delete_last_row_button.style.textAlign = 'left';
      this.delete_last_row_button.style.marginBottom = '3px';

      this.remove_all_rows_button.style.width = '100%';
      this.remove_all_rows_button.style.textAlign = 'left';
      this.remove_all_rows_button.style.marginBottom = '3px';
    }
  },
  showValidationErrors: function(errors) {
    var self = this;

    // Get all the errors that pertain to this editor
    var my_errors = [];
    var other_errors = [];
    $each(errors, function(i,error) {
      if(error.path === self.path) {
        my_errors.push(error);
      }
      else {
        other_errors.push(error);
      }
    });

    // Show errors for this editor
    if(this.error_holder) {
      if(my_errors.length) {
        var message = [];
        this.error_holder.innerHTML = '';
        this.error_holder.style.display = '';
        $each(my_errors, function(i,error) {
          self.error_holder.appendChild(self.theme.getErrorMessage(error.message));
        });
      }
      // Hide error area
      else {
        this.error_holder.style.display = 'none';
      }
    }

    // Show errors for child editors
    $each(this.rows, function(i,row) {
      row.showValidationErrors(other_errors);
    });
  }
});

JSONEditor.defaults.editors.table = JSONEditor.defaults.editors.array.extend({
  register: function() {
    this._super();
    if(this.rows) {
      for(var i=0; i<this.rows.length; i++) {
        this.rows[i].register();
      }
    }
  },
  unregister: function() {
    this._super();
    if(this.rows) {
      for(var i=0; i<this.rows.length; i++) {
        this.rows[i].unregister();
      }
    }
  },
  getNumColumns: function() {
    return Math.max(Math.min(12,this.width),3);
  },
  preBuild: function() {
    var item_schema = this.jsoneditor.expandRefs(this.schema.items || {});

    this.item_title = item_schema.title || 'row';
    this.item_default = item_schema.default || null;
    this.item_has_child_editors = item_schema.properties || item_schema.items;
    this.width = 12;
    this._super();
  },
  build: function() {
    var self = this;
    this.table = this.theme.getTable();
    this.container.appendChild(this.table);
    this.thead = this.theme.getTableHead();
    this.table.appendChild(this.thead);
    this.header_row = this.theme.getTableRow();
    this.thead.appendChild(this.header_row);
    this.row_holder = this.theme.getTableBody();
    this.table.appendChild(this.row_holder);

    // Determine the default value of array element
    var tmp = this.getElementEditor(0,true);
    this.item_default = tmp.getDefault();
    this.width = tmp.getNumColumns() + 2;

    if(!this.options.compact) {
      this.title = this.theme.getHeader(this.getTitle());
      this.container.appendChild(this.title);
      this.title_controls = this.theme.getHeaderButtonHolder();
      this.title.appendChild(this.title_controls);
      if(this.schema.description) {
        this.description = this.theme.getDescription(this.schema.description);
        this.container.appendChild(this.description);
      }
      this.panel = this.theme.getIndentedPanel();
      this.container.appendChild(this.panel);
      this.error_holder = document.createElement('div');
      this.panel.appendChild(this.error_holder);
    }
    else {
      this.panel = document.createElement('div');
      this.container.appendChild(this.panel);
    }

    this.panel.appendChild(this.table);
    this.controls = this.theme.getButtonHolder();
    this.panel.appendChild(this.controls);

    if(this.item_has_child_editors) {
      $each(tmp.getChildEditors(), function(i,editor) {
        var th = self.theme.getTableHeaderCell(editor.getTitle());
        if(editor.options.hidden) th.style.display = 'none';
        self.header_row.appendChild(th);
      });
    }
    else {
      self.header_row.appendChild(self.theme.getTableHeaderCell(this.item_title));
    }

    tmp.destroy();
    this.row_holder.innerHTML = '';

    // Row Controls column
    this.controls_header_cell = self.theme.getTableHeaderCell(" ");
    self.header_row.appendChild(this.controls_header_cell);

    // Add controls
    this.addControls();
  },
  onChildEditorChange: function(editor) {
    this.refreshValue();
    this._super();
  },
  getItemDefault: function() {
    return $extend({},{default:this.item_default}).default;
  },
  getItemTitle: function() {
    return this.item_title;
  },
  getElementEditor: function(i,ignore) {
    var schema_copy = $extend({},this.schema.items);
    var editor = this.jsoneditor.getEditorClass(schema_copy, this.jsoneditor);
    var row = this.row_holder.appendChild(this.theme.getTableRow());
    var holder = row;
    if(!this.item_has_child_editors) {
      holder = this.theme.getTableCell();
      row.appendChild(holder);
    }

    var ret = this.jsoneditor.createEditor(editor,{
      jsoneditor: this.jsoneditor,
      schema: schema_copy,
      container: holder,
      path: this.path+'.'+i,
      parent: this,
      compact: true,
      table_row: true
    });

    ret.preBuild();
    if(!ignore) {
      ret.build();
      ret.postBuild();

      ret.controls_cell = row.appendChild(this.theme.getTableCell());
      ret.row = row;
      ret.table_controls = this.theme.getButtonHolder();
      ret.controls_cell.appendChild(ret.table_controls);
      ret.table_controls.style.margin = 0;
      ret.table_controls.style.padding = 0;
    }

    return ret;
  },
  destroy: function() {
    this.innerHTML = '';
    if(this.title && this.title.parentNode) this.title.parentNode.removeChild(this.title);
    if(this.description && this.description.parentNode) this.description.parentNode.removeChild(this.description);
    if(this.row_holder && this.row_holder.parentNode) this.row_holder.parentNode.removeChild(this.row_holder);
    if(this.table && this.table.parentNode) this.table.parentNode.removeChild(this.table);
    if(this.panel && this.panel.parentNode) this.panel.parentNode.removeChild(this.panel);

    this.rows = this.title = this.description = this.row_holder = this.table = this.panel = null;

    this._super();
  },
  setValue: function(value, initial) {
    // Update the array's value, adding/removing rows when necessary
    value = value || [];

    // Make sure value has between minItems and maxItems items in it
    if(this.schema.minItems) {
      while(value.length < this.schema.minItems) {
        value.push(this.getItemDefault());
      }
    }
    if(this.schema.maxItems && value.length > this.schema.maxItems) {
      value = value.slice(0,this.schema.maxItems);
    }

    var serialized = JSON.stringify(value);
    if(serialized === this.serialized) return;

    var numrows_changed = false;

    var self = this;
    $each(value,function(i,val) {
      if(self.rows[i]) {
        // TODO: don't set the row's value if it hasn't changed
        self.rows[i].setValue(val);
      }
      else {
        self.addRow(val);
        numrows_changed = true;
      }
    });

    for(var j=value.length; j<self.rows.length; j++) {
      var holder = self.rows[j].container;
      if(!self.item_has_child_editors) {
        self.rows[j].row.parentNode.removeChild(self.rows[j].row);
      }
      self.rows[j].destroy();
      if(holder.parentNode) holder.parentNode.removeChild(holder);
      self.rows[j] = null;
      numrows_changed = true;
    }
    self.rows = self.rows.slice(0,value.length);

    self.refreshValue();
    if(numrows_changed || initial) self.refreshRowButtons();

    self.onChange();

    // TODO: sortable
  },
  refreshRowButtons: function() {
    var self = this;

    // If we currently have minItems items in the array
    var minItems = this.schema.minItems && this.schema.minItems >= this.rows.length;

    var need_row_buttons = false;
    $each(this.rows,function(i,editor) {
      // Hide the move down button for the last row
      if(editor.movedown_button) {
        if(i === self.rows.length - 1) {
          editor.movedown_button.style.display = 'none';
        }
        else {
          need_row_buttons = true;
          editor.movedown_button.style.display = '';
        }
      }

      // Hide the delete button if we have minItems items
      if(editor.delete_button) {
        if(minItems) {
          editor.delete_button.style.display = 'none';
        }
        else {
          need_row_buttons = true;
          editor.delete_button.style.display = '';
        }
      }

      if(editor.moveup_button) {
        need_row_buttons = true;
      }
    });

    // Show/hide controls column in table
    $each(this.rows,function(i,editor) {
      if(need_row_buttons) {
        editor.controls_cell.style.display = '';
      }
      else {
        editor.controls_cell.style.display = 'none';
      }
    });
    if(need_row_buttons) {
      this.controls_header_cell.style.display = '';
    }
    else {
      this.controls_header_cell.style.display = 'none';
    }

    var controls_needed = false;

    if(!this.value.length) {
      this.delete_last_row_button.style.display = 'none';
      this.remove_all_rows_button.style.display = 'none';
      this.table.style.display = 'none';
    }
    else if(this.value.length === 1  || this.hide_delete_buttons) {
      this.table.style.display = '';
      this.remove_all_rows_button.style.display = 'none';

      // If there are minItems items in the array, hide the delete button beneath the rows
      if(minItems || this.hide_delete_buttons) {
        this.delete_last_row_button.style.display = 'none';
      }
      else {
        this.delete_last_row_button.style.display = '';
        controls_needed = true;
      }
    }
    else {
      this.table.style.display = '';
      // If there are minItems items in the array, hide the delete button beneath the rows
      if(minItems || this.hide_delete_buttons) {
        this.delete_last_row_button.style.display = 'none';
        this.remove_all_rows_button.style.display = 'none';
      }
      else {
        this.delete_last_row_button.style.display = '';
        this.remove_all_rows_button.style.display = '';
        controls_needed = true;
      }
    }

    // If there are maxItems in the array, hide the add button beneath the rows
    if((this.schema.maxItems && this.schema.maxItems <= this.rows.length) || this.hide_add_button) {
      this.add_row_button.style.display = 'none';
    }
    else {
      this.add_row_button.style.display = '';
      controls_needed = true;
    }

    if(!controls_needed) {
      this.controls.style.display = 'none';
    }
    else {
      this.controls.style.display = '';
    }
  },
  refreshValue: function() {
    var self = this;
    this.value = [];

    $each(this.rows,function(i,editor) {
      // Get the value for this editor
      self.value[i] = editor.getValue();
    });
    this.serialized = JSON.stringify(this.value);
  },
  addRow: function(value) {
    var self = this;
    var i = this.rows.length;

    self.rows[i] = this.getElementEditor(i);

    var controls_holder = self.rows[i].table_controls;

    // Buttons to delete row, move row up, and move row down
    if(!this.hide_delete_buttons) {
      self.rows[i].delete_button = this.getButton('','delete','Delete');
      self.rows[i].delete_button.className += ' delete';
      self.rows[i].delete_button.setAttribute('data-i',i);
      self.rows[i].delete_button.addEventListener('click',function(e) {
        e.preventDefault();
        e.stopPropagation();
        var i = this.getAttribute('data-i')*1;

        var value = self.getValue();

        var newval = [];
        $each(value,function(j,row) {
          if(j===i) return; // If this is the one we're deleting
          newval.push(row);
        });
        self.setValue(newval);
        self.onChange(true);
      });
      controls_holder.appendChild(self.rows[i].delete_button);
    }


    if(i && !this.hide_move_buttons) {
      self.rows[i].moveup_button = this.getButton('','moveup','Move up');
      self.rows[i].moveup_button.className += ' moveup';
      self.rows[i].moveup_button.setAttribute('data-i',i);
      self.rows[i].moveup_button.addEventListener('click',function(e) {
        e.preventDefault();
        e.stopPropagation();
        var i = this.getAttribute('data-i')*1;

        if(i<=0) return;
        var rows = self.getValue();
        var tmp = rows[i-1];
        rows[i-1] = rows[i];
        rows[i] = tmp;

        self.setValue(rows);
        self.onChange(true);
      });
      controls_holder.appendChild(self.rows[i].moveup_button);
    }

    if(!this.hide_move_buttons) {
      self.rows[i].movedown_button = this.getButton('','movedown','Move down');
      self.rows[i].movedown_button.className += ' movedown';
      self.rows[i].movedown_button.setAttribute('data-i',i);
      self.rows[i].movedown_button.addEventListener('click',function(e) {
        e.preventDefault();
        e.stopPropagation();
        var i = this.getAttribute('data-i')*1;
        var rows = self.getValue();
        if(i>=rows.length-1) return;
        var tmp = rows[i+1];
        rows[i+1] = rows[i];
        rows[i] = tmp;

        self.setValue(rows);
        self.onChange(true);
      });
      controls_holder.appendChild(self.rows[i].movedown_button);
    }

    if(value) self.rows[i].setValue(value);
  },
  addControls: function() {
    var self = this;

    this.collapsed = false;
    this.toggle_button = this.getButton('','collapse','Collapse');
    if(this.title_controls) {
      this.title_controls.appendChild(this.toggle_button);
      this.toggle_button.addEventListener('click',function(e) {
        e.preventDefault();
        e.stopPropagation();

        if(self.collapsed) {
          self.collapsed = false;
          self.panel.style.display = '';
          self.setButtonText(this,'','collapse','Collapse');
        }
        else {
          self.collapsed = true;
          self.panel.style.display = 'none';
          self.setButtonText(this,'','expand','Expand');
        }
      });

      // If it should start collapsed
      if(this.options.collapsed) {
        $trigger(this.toggle_button,'click');
      }

      // Collapse button disabled
      if(this.schema.options && typeof this.schema.options.disable_collapse !== "undefined") {
        if(this.schema.options.disable_collapse) this.toggle_button.style.display = 'none';
      }
      else if(this.jsoneditor.options.disable_collapse) {
        this.toggle_button.style.display = 'none';
      }
    }

    // Add "new row" and "delete last" buttons below editor
    this.add_row_button = this.getButton(this.getItemTitle(),'add','Add '+this.getItemTitle());
    this.add_row_button.addEventListener('click',function(e) {
      e.preventDefault();
      e.stopPropagation();

      self.addRow();
      self.refreshValue();
      self.refreshRowButtons();
      self.onChange(true);
    });
    self.controls.appendChild(this.add_row_button);

    this.delete_last_row_button = this.getButton('Last '+this.getItemTitle(),'delete','Delete Last '+this.getItemTitle());
    this.delete_last_row_button.addEventListener('click',function(e) {
      e.preventDefault();
      e.stopPropagation();

      var rows = self.getValue();
      rows.pop();
      self.setValue(rows);
      self.onChange(true);
    });
    self.controls.appendChild(this.delete_last_row_button);

    this.remove_all_rows_button = this.getButton('All','delete','Delete All');
    this.remove_all_rows_button.addEventListener('click',function(e) {
      e.preventDefault();
      e.stopPropagation();

      self.setValue([]);
      self.onChange(true);
    });
    self.controls.appendChild(this.remove_all_rows_button);
  }
});

// Multiple Editor (for when `type` is an array)
JSONEditor.defaults.editors.multiple = JSONEditor.AbstractEditor.extend({
  register: function() {
    if(this.editors) {
      for(var i=0; i<this.editors.length; i++) {
        if(!this.editors[i]) continue;
        this.editors[i].unregister();
      }
      if(this.editors[this.type]) this.editors[this.type].register();
    }
    this._super();
  },
  unregister: function() {
    this._super();
    if(this.editors) {
      for(var i=0; i<this.editors.length; i++) {
        if(!this.editors[i]) continue;
        this.editors[i].unregister();
      }
    }
  },
  getNumColumns: function() {
    if(!this.editors[this.type]) return 4;
    return Math.max(this.editors[this.type].getNumColumns(),4);
  },
  enable: function() {
    if(this.editors) {
      for(var i=0; i<this.editors.length; i++) {
        if(!this.editors[i]) continue;
        this.editors[i].enable();
      }
    }
    this.switcher.disabled = false;
    this._super();
  },
  disable: function() {
    if(this.editors) {
      for(var i=0; i<this.editors.length; i++) {
        if(!this.editors[i]) continue;
        this.editors[i].disable();
      }
    }
    this.switcher.disabled = true;
    this._super();
  },
  switchEditor: function(i) {
    var self = this;

    if(!this.editors[i]) {
      this.buildChildEditor(i);
    }

    self.type = i;

    self.register();

    var current_value = self.getValue();

    $each(self.editors,function(type,editor) {
      if(!editor) return;
      if(self.type === type) {
        editor.setValue(current_value,true);
        editor.container.style.display = '';
      }
      else editor.container.style.display = 'none';
    });
    self.refreshValue();
    self.refreshHeaderText();
  },
  buildChildEditor: function(i) {
    var self = this;
    var type = this.types[i];
    var holder = self.theme.getChildEditorHolder();
    self.editor_holder.appendChild(holder);

    var schema;

    if(typeof type === "string") {
      schema = $extend({},self.schema);
      schema.type = type;
    }
    else {
      schema = $extend({},self.schema,type);
      schema = self.jsoneditor.expandRefs(schema);

      // If we need to merge `required` arrays
      if(type.required && Array.isArray(type.required) && self.schema.required && Array.isArray(self.schema.required)) {
        schema.required = self.schema.required.concat(type.required);
      }
    }

    var editor = self.jsoneditor.getEditorClass(schema);

    self.editors[i] = self.jsoneditor.createEditor(editor,{
      jsoneditor: self.jsoneditor,
      schema: schema,
      container: holder,
      path: self.path,
      parent: self,
      required: true
    });
    self.editors[i].preBuild();
    self.editors[i].build();
    self.editors[i].postBuild();

    if(self.editors[i].header) self.editors[i].header.style.display = 'none';

    self.editors[i].option = self.switcher_options[i];

    holder.addEventListener('change_header_text',function() {
      self.refreshHeaderText();
    });

    if(i !== self.type) holder.style.display = 'none';
  },
  preBuild: function() {
    var self = this;

    this.types = [];
    this.type = 0;
    this.editors = [];
    this.validators = [];

    if(this.schema.oneOf) {
      this.oneOf = true;
      this.types = this.schema.oneOf;
      $each(this.types,function(i,oneof) {
        //self.types[i] = self.jsoneditor.expandSchema(oneof);
      });
      delete this.schema.oneOf;
    }
    else {
      if(!this.schema.type || this.schema.type === "any") {
        this.types = ['string','number','integer','boolean','object','array','null'];

        // If any of these primitive types are disallowed
        if(this.schema.disallow) {
          var disallow = this.schema.disallow;
          if(typeof disallow !== 'object' || !(Array.isArray(disallow))) {
            disallow = [disallow];
          }
          var allowed_types = [];
          $each(this.types,function(i,type) {
            if(disallow.indexOf(type) === -1) allowed_types.push(type);
          });
          this.types = allowed_types;
        }
      }
      else if(Array.isArray(this.schema.type)) {
        this.types = this.schema.type;
      }
      else {
        this.types = [this.schema.type];
      }
      delete this.schema.type;
    }

    this.display_text = this.getDisplayText(this.types);
  },
  build: function() {
    var self = this;
    var container = this.container;

    this.header = this.label = this.theme.getFormInputLabel(this.getTitle());
    this.container.appendChild(this.header);

    this.switcher = this.theme.getSwitcher(this.display_text);
    container.appendChild(this.switcher);
    this.switcher.addEventListener('change',function(e) {
      e.preventDefault();
      e.stopPropagation();

      self.switchEditor(self.display_text.indexOf(this.value));
      self.onChange(true);
    });
    this.switcher.style.marginBottom = 0;
    this.switcher.style.width = 'auto';
    this.switcher.style.display = 'inline-block';
    this.switcher.style.marginLeft = '5px';

    this.editor_holder = document.createElement('div');
    container.appendChild(this.editor_holder);

    this.switcher_options = this.theme.getSwitcherOptions(this.switcher);
    $each(this.types,function(i,type) {
      self.editors[i] = false;

      var schema;

      if(typeof type === "string") {
        schema = $extend({},self.schema);
        schema.type = type;
      }
      else {
        schema = $extend({},self.schema,type);

        // If we need to merge `required` arrays
        if(type.required && Array.isArray(type.required) && self.schema.required && Array.isArray(self.schema.required)) {
          schema.required = self.schema.required.concat(type.required);
        }
      }

      self.validators[i] = new JSONEditor.Validator(self.jsoneditor,schema);
    });

    this.switchEditor(0);
  },
  onChildEditorChange: function(editor) {
    if(this.editors[this.type]) {
      this.refreshValue();
      this.refreshHeaderText();
    }

    this._super();
  },
  refreshHeaderText: function() {
    var display_text = this.getDisplayText(this.types);
    $each(this.switcher_options, function(i,option) {
      option.textContent = display_text[i];
    });
  },
  refreshValue: function() {
    this.value = this.editors[this.type].getValue();
  },
  setValue: function(val,initial) {
    // Determine type by getting the first one that validates
    var self = this;
    $each(this.validators, function(i,validator) {
      if(!validator.validate(val).length) {
        self.type = i;
        self.switcher.value = self.display_text[i];
        return false;
      }
    });

    this.switchEditor(this.type);

    this.editors[this.type].setValue(val,initial);

    this.refreshValue();
    self.onChange();
  },
  destroy: function() {
    $each(this.editors, function(type,editor) {
      if(editor) editor.destroy();
    });
    if(this.editor_holder && this.editor_holder.parentNode) this.editor_holder.parentNode.removeChild(this.editor_holder);
    if(this.switcher && this.switcher.parentNode) this.switcher.parentNode.removeChild(this.switcher);
    this._super();
  },
  showValidationErrors: function(errors) {
    var self = this;

    // oneOf error paths need to remove the oneOf[i] part before passing to child editors
    if(this.oneOf) {
      $each(this.editors,function(i,editor) {
        if(!editor) return;
        var check = self.path+'.oneOf['+i+']';
        var new_errors = [];
        $each(errors, function(j,error) {
          if(error.path.substr(0,check.length)===check) {
            var new_error = $extend({},error);
            new_error.path = self.path+new_error.path.substr(check.length);
            new_errors.push(new_error);
          }
        });

        editor.showValidationErrors(new_errors);
      });
    }
    else {
      $each(this.editors,function(type,editor) {
        if(!editor) return;
        editor.showValidationErrors(errors);
      });
    }
  }
});

// Enum Editor (used for objects and arrays with enumerated values)
JSONEditor.defaults.editors.enum = JSONEditor.AbstractEditor.extend({
  getNumColumns: function() {
    return 4;
  },
  build: function() {
    var container = this.container;
    this.title = this.header = this.label = this.theme.getFormInputLabel(this.getTitle());
    this.container.appendChild(this.title);

    this.options.enum_titles = this.options.enum_titles || [];

    this.enum = this.schema.enum;
    this.selected = 0;
    this.select_options = [];
    this.html_values = [];

    var self = this;
    for(var i=0; i<this.enum.length; i++) {
      this.select_options[i] = this.options.enum_titles[i] || "Value "+(i+1);
      this.html_values[i] = this.getHTML(this.enum[i]);
    }

    // Switcher
    this.switcher = this.theme.getSwitcher(this.select_options);
    this.container.appendChild(this.switcher);
    this.switcher.style.width = 'auto';
    this.switcher.style.display = 'inline-block';
    this.switcher.style.marginLeft = '5px';
    this.switcher.style.marginBottom = 0;

    // Display area
    this.display_area = this.theme.getIndentedPanel();
    this.display_area.style.paddingTop = 0;
    this.display_area.style.paddingBottom = 0;
    this.container.appendChild(this.display_area);

    if(this.options.hide_display) this.display_area.style.display = "none";

    this.switcher.addEventListener('change',function() {
      self.selected = self.select_options.indexOf(this.value);
      self.value = self.enum[self.selected];
      self.refreshValue();
      self.onChange(true);
    });
    this.value = this.enum[0];
    this.refreshValue();

    if(this.enum.length === 1) this.switcher.style.display = 'none';
  },
  refreshValue: function() {
    var self = this;
    self.selected = -1;
    var stringified = JSON.stringify(this.value);
    $each(this.enum, function(i, el) {
      if(stringified === JSON.stringify(el)) {
        self.selected = i;
        return false;
      }
    });

    if(self.selected<0) {
      self.setValue(self.enum[0]);
      return;
    }

    this.switcher.value = this.select_options[this.selected];
    this.display_area.innerHTML = this.html_values[this.selected];
  },
  enable: function() {
    if(!this.always_disabled) this.switcher.disabled = false;
    this._super();
  },
  disable: function() {
    this.switcher.disabled = true;
    this._super();
  },
  getHTML: function(el) {
    var self = this;

    if(el === null) {
      return '<em>null</em>';
    }
    // Array or Object
    else if(typeof el === "object") {
      // TODO: use theme
      var ret = '';

      $each(el,function(i,child) {
        var html = self.getHTML(child);

        // Add the keys to object children
        if(!(Array.isArray(el))) {
          // TODO: use theme
          html = '<div><em>'+i+'</em>: '+html+'</div>';
        }

        // TODO: use theme
        ret += '<li>'+html+'</li>';
      });

      if(Array.isArray(el)) ret = '<ol>'+ret+'</ol>';
      else ret = "<ul style='margin-top:0;margin-bottom:0;padding-top:0;padding-bottom:0;'>"+ret+'</ul>';

      return ret;
    }
    // Boolean
    else if(typeof el === "boolean") {
      return el? 'true' : 'false';
    }
    // String
    else if(typeof el === "string") {
      return el.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    }
    // Number
    else {
      return el;
    }
  },
  setValue: function(val) {
    if(this.value !== val) {
      this.value = val;
      this.refreshValue();
      this.onChange();
    }
  },
  destroy: function() {
    if(this.display_area && this.display_area.parentNode) this.display_area.parentNode.removeChild(this.display_area);
    if(this.title && this.title.parentNode) this.title.parentNode.removeChild(this.title);
    if(this.switcher && this.switcher.parentNode) this.switcher.parentNode.removeChild(this.switcher);

    this._super();
  }
});

JSONEditor.defaults.editors.select = JSONEditor.AbstractEditor.extend({
  setValue: function(value,initial) {
    value = this.typecast(value||'');

    // Sanitize value before setting it
    var sanitized = value;
    if(this.enum_values.indexOf(sanitized) < 0) {
      sanitized = this.enum_values[0];
    }

    if(this.value === sanitized) {
      return;
    }

    this.input.value = this.enum_options[this.enum_values.indexOf(sanitized)];
    if(this.select2) this.select2.select2('val',this.input.value);
    this.value = sanitized;
    this.onChange();
  },
  register: function() {
    this._super();
    if(!this.input) return;
    this.input.setAttribute('name',this.formname);
  },
  unregister: function() {
    this._super();
    if(!this.input) return;
    this.input.removeAttribute('name');
  },
  getNumColumns: function() {
    if(!this.enum_options) return 3;
    var longest_text = this.getTitle().length;
    for(var i=0; i<this.enum_options.length; i++) {
      longest_text = Math.max(longest_text,this.enum_options[i].length+4);
    }
    return Math.min(12,Math.max(longest_text/7,2));
  },
  typecast: function(value) {
    if(this.schema.type === "boolean") {
      return !!value;
    }
    else if(this.schema.type === "number") {
      return 1*value;
    }
    else if(this.schema.type === "integer") {
      return Math.floor(value*1);
    }
    else {
      return ""+value;
    }
  },
  getValue: function() {
    return this.value;
  },
  preBuild: function() {
    var self = this;
    this.input_type = 'select';
    this.enum_options = [];
    this.enum_values = [];
    this.enum_display = [];

    // Enum options enumerated
    if(this.schema.enum) {
      var display = this.schema.options && this.schema.options.enum_titles || [];

      $each(this.schema.enum,function(i,option) {
        self.enum_options[i] = ""+option;
        self.enum_display[i] = ""+(display[i] || option);
        self.enum_values[i] = self.typecast(option);
      });
    }
    // Boolean
    else if(this.schema.type === "boolean") {
      self.enum_display = ['true','false'];
      self.enum_options = ['1',''];
      self.enum_values = [true,false];
    }
    // Dynamic Enum
    else if(this.schema.enumSource) {
      this.enumSource = [];
      this.enum_display = [];
      this.enum_options = [];
      this.enum_values = [];

      // Shortcut declaration for using a single array
      if(!(Array.isArray(this.schema.enumSource))) {
        if(this.schema.enumValue) {
          this.enumSource = [
            {
              source: this.schema.enumSource,
              value: this.schema.enumValue
            }
          ];
        }
        else {
          this.enumSource = [
            {
              source: this.schema.enumSource
            }
          ];
        }
      }
      else {
        for(i=0; i<this.schema.enumSource.length; i++) {
          // Shorthand for watched variable
          if(typeof this.schema.enumSource[i] === "string") {
            this.enumSource[i] = {
              source: this.schema.enumSource[i]
            };
          }
          // Make a copy of the schema
          else if(!(Array.isArray(this.schema.enumSource[i]))) {
            this.enumSource[i] = $extend({},this.schema.enumSource[i]);
          }
          else {
            this.enumSource[i] = this.schema.enumSource[i];
          }
        }
      }

      // Now, enumSource is an array of sources
      // Walk through this array and fix up the values
      for(i=0; i<this.enumSource.length; i++) {
        if(this.enumSource[i].value) {
          this.enumSource[i].value = this.jsoneditor.compileTemplate(this.enumSource[i].value, this.template_engine);
        }
        if(this.enumSource[i].title) {
          this.enumSource[i].title = this.jsoneditor.compileTemplate(this.enumSource[i].title, this.template_engine);
        }
        if(this.enumSource[i].filter) {
          this.enumSource[i].filter = this.jsoneditor.compileTemplate(this.enumSource[i].filter, this.template_engine);
        }
      }
    }
    // Other, not supported
    else {
      throw "'select' editor requires the enum property to be set.";
    }
  },
  build: function() {
    var self = this;
    if(!this.options.compact) this.header = this.label = this.theme.getFormInputLabel(this.getTitle());
    if(this.schema.description) this.description = this.theme.getFormInputDescription(this.schema.description);

    if(this.options.compact) this.container.setAttribute('class',this.container.getAttribute('class')+' compact');

    this.input = this.theme.getSelectInput(this.enum_options);
    this.theme.setSelectOptions(this.input,this.enum_options,this.enum_display);

    if(this.schema.readOnly || this.schema.readonly) {
      this.always_disabled = true;
      this.input.disabled = true;
    }

    this.input.addEventListener('change',function(e) {
      e.preventDefault();
      e.stopPropagation();
      self.onInputChange();
    });

    this.control = this.theme.getFormControl(this.label, this.input, this.description);
    this.container.appendChild(this.control);

    this.value = this.enum_values[0];
  },
  onInputChange: function() {
    var val = this.input.value;

    var sanitized = val;
    if(this.enum_options.indexOf(val) === -1) {
      sanitized = this.enum_options[0];
    }

    this.value = this.enum_values[this.enum_options.indexOf(val)];

    this.onChange(true);
  },
  setupSelect2: function() {
    // If the Select2 library is loaded use it when we have lots of items
    if(window.jQuery && window.jQuery.fn && window.jQuery.fn.select2 && (this.enum_options.length > 2 || (this.enum_options.length && this.enumSource))) {
      var options = $extend({},JSONEditor.plugins.select2);
      if(this.schema.options && this.schema.options.select2_options) options = $extend(options,this.schema.options.select2_options);
      this.select2 = window.jQuery(this.input).select2(options);
      var self = this;
      this.select2.on('select2-blur',function() {
        self.input.value = self.select2.select2('val');
        self.onInputChange();
      });
    }
    else {
      this.select2 = null;
    }
  },
  postBuild: function() {
    this._super();
    this.theme.afterInputReady(this.input);
    this.setupSelect2();
  },
  onWatchedFieldChange: function() {
    var self = this, vars, j;

    // If this editor uses a dynamic select box
    if(this.enumSource) {
      vars = this.getWatchedFieldValues();
      var select_options = [];
      var select_titles = [];

      for(var i=0; i<this.enumSource.length; i++) {
        // Constant values
        if(Array.isArray(this.enumSource[i])) {
          select_options = select_options.concat(this.enumSource[i]);
          select_titles = select_titles.concat(this.enumSource[i]);
        }
        // A watched field
        else if(vars[this.enumSource[i].source]) {
          var items = vars[this.enumSource[i].source];

          // Only use a predefined part of the array
          if(this.enumSource[i].slice) {
            items = Array.prototype.slice.apply(items,this.enumSource[i].slice);
          }
          // Filter the items
          if(this.enumSource[i].filter) {
            var new_items = [];
            for(j=0; j<items.length; j++) {
              if(this.enumSource[i].filter({i:j,item:items[j]})) new_items.push(items[j]);
            }
            items = new_items;
          }

          var item_titles = [];
          var item_values = [];
          for(j=0; j<items.length; j++) {
            var item = items[j];

            // Rendered value
            if(this.enumSource[i].value) {
              item_values[j] = this.enumSource[i].value({
                i: j,
                item: item
              });
            }
            // Use value directly
            else {
              item_values[j] = items[j];
            }

            // Rendered title
            if(this.enumSource[i].title) {
              item_titles[j] = this.enumSource[i].title({
                i: j,
                item: item
              });
            }
            // Use value as the title also
            else {
              item_titles[j] = item_values[j];
            }
          }

          // TODO: sort

          select_options = select_options.concat(item_values);
          select_titles = select_titles.concat(item_titles);
        }
      }

      var prev_value = this.value;

      this.theme.setSelectOptions(this.input, select_options, select_titles);
      this.enum_options = select_options;
      this.enum_display = select_titles;
      this.enum_values = select_options;

      if(this.select2) {
        this.select2.select2('destroy');
      }

      // If the previous value is still in the new select options, stick with it
      if(select_options.indexOf(prev_value) !== -1) {
        this.input.value = prev_value;
        this.value = prev_value;
      }
      // Otherwise, set the value to the first select option
      else {
        this.input.value = select_options[0];
        this.value = select_options[0] || "";
        if(this.parent) this.parent.onChildEditorChange(this);
        else this.jsoneditor.onChange();
        this.jsoneditor.notifyWatchers(this.path);
      }

      this.setupSelect2();
    }

    this._super();
  },
  enable: function() {
    if(!this.always_disabled) {
      this.input.disabled = false;
      if(this.select2) this.select2.select2("enable",true);
    }
    this._super();
  },
  disable: function() {
    this.input.disabled = true;
    if(this.select2) this.select2.select2("enable",false);
    this._super();
  },
  destroy: function() {
    if(this.label && this.label.parentNode) this.label.parentNode.removeChild(this.label);
    if(this.description && this.description.parentNode) this.description.parentNode.removeChild(this.description);
    if(this.input && this.input.parentNode) this.input.parentNode.removeChild(this.input);
    if(this.select2) {
      this.select2.select2('destroy');
      this.select2 = null;
    }

    this._super();
  }
});

JSONEditor.defaults.editors.multiselect = JSONEditor.AbstractEditor.extend({
  preBuild: function() {
    this._super();

    this.select_options = {};
    this.select_values = {};

    var items_schema = this.jsoneditor.expandRefs(this.schema.items || {});

    var e = items_schema.enum || [];
    this.option_keys = [];
    for(i=0; i<e.length; i++) {
      // If the sanitized value is different from the enum value, don't include it
      if(this.sanitize(e[i]) !== e[i]) continue;

      this.option_keys.push(e[i]+"");
      this.select_values[e[i]+""] = e[i];
    }
  },
  build: function() {
    var self = this, i;
    if(!this.options.compact) this.header = this.label = this.theme.getFormInputLabel(this.getTitle());
    if(this.schema.description) this.description = this.theme.getFormInputDescription(this.schema.description);

    if((!this.schema.format && this.option_keys.length < 8) || this.schema.format === "checkbox") {
      this.input_type = 'checkboxes';

      this.inputs = {};
      this.controls = {};
      for(i=0; i<this.option_keys.length; i++) {
        this.inputs[this.option_keys[i]] = this.theme.getCheckbox();
        this.select_options[this.option_keys[i]] = this.inputs[this.option_keys[i]];
        var label = this.theme.getCheckboxLabel(this.option_keys[i]);
        this.controls[this.option_keys[i]] = this.theme.getFormControl(label, this.inputs[this.option_keys[i]]);
      }

      this.control = this.theme.getMultiCheckboxHolder(this.controls,this.label,this.description);
    }
    else {
      this.input_type = 'select';
      this.input = this.theme.getSelectInput(this.option_keys);
      this.input.multiple = true;
      this.input.size = Math.min(10,this.option_keys.length);

      for(i=0; i<this.option_keys.length; i++) {
        this.select_options[this.option_keys[i]] = this.input.children[i];
      }

      if(this.schema.readOnly || this.schema.readonly) {
        this.always_disabled = true;
        this.input.disabled = true;
      }

      this.control = this.theme.getFormControl(this.label, this.input, this.description);
    }

    this.container.appendChild(this.control);
    this.control.addEventListener('change',function(e) {
      e.preventDefault();
      e.stopPropagation();

      var new_value = [];
      for(i = 0; i<self.option_keys.length; i++) {
        if(self.select_options[self.option_keys[i]].selected || self.select_options[self.option_keys[i]].checked) new_value.push(self.select_values[self.option_keys[i]]);
      }

      self.updateValue(new_value);
      self.onChange(true);
    });
  },
  setValue: function(value, initial) {
    var i;
    value = value || [];
    if(typeof value !== "object") value = [value];
    else if(!(Array.isArray(value))) value = [];

    // Make sure we are dealing with an array of strings so we can check for strict equality
    for(i=0; i<value.length; i++) {
      if(typeof value[i] !== "string") value[i] += "";
    }

    // Update selected status of options
    for(i in this.select_options) {
      if(!this.select_options.hasOwnProperty(i)) continue;

      this.select_options[i][this.input_type === "select"? "selected" : "checked"] = (value.indexOf(i) !== -1);
    }

    this.updateValue(value);
    this.onChange();
  },
  register: function() {
    this._super();
    if(!this.input) return;
    this.input.setAttribute('name',this.formname);
  },
  unregister: function() {
    this._super();
    if(!this.input) return;
    this.input.removeAttribute('name');
  },
  getNumColumns: function() {
    var longest_text = this.getTitle().length;
    for(var i in this.select_values) {
      if(!this.select_values.hasOwnProperty(i)) continue;
      longest_text = Math.max(longest_text,(this.select_values[i]+"").length+4);
    }

    return Math.min(12,Math.max(longest_text/7,2));
  },
  updateValue: function(value) {
    var changed = false;
    var new_value = [];
    for(var i=0; i<value.length; i++) {
      if(!this.select_options[value[i]+""]) {
        changed = true;
        continue;
      }
      var sanitized = this.sanitize(this.select_values[value[i]]);
      new_value.push(sanitized);
      if(sanitized !== value[i]) changed = true;
    }
    this.value = new_value;
    return changed;
  },
  sanitize: function(value) {
    if(this.schema.items.type === "number") {
      return 1*value;
    }
    else if(this.schema.items.type === "integer") {
      return Math.floor(value*1);
    }
    else {
      return ""+value;
    }
  },
  enable: function() {
    if(!this.always_disabled) {
      if(this.input) {
        this.input.disabled = false;
      }
      else if(this.inputs) {
        for(var i in this.inputs) {
          if(!this.inputs.hasOwnProperty(i)) continue;
          this.inputs[i].disabled = false;
        }
      }
    }
    this._super();
  },
  disable: function() {
    if(this.input) {
      this.input.disabled = true;
    }
    else if(this.inputs) {
      for(var i in this.inputs) {
        if(!this.inputs.hasOwnProperty(i)) continue;
        this.inputs[i].disabled = true;
      }
    }
    this._super();
  }
});

JSONEditor.defaults.editors.base64 = JSONEditor.AbstractEditor.extend({
  getNumColumns: function() {
    return 4;
  },
  build: function() {
    var self = this;
    this.title = this.header = this.label = this.theme.getFormInputLabel(this.getTitle());

    // Input that holds the base64 string
    this.input = this.theme.getFormInputField('hidden');
    this.container.appendChild(this.input);

    // Don't show uploader if this is readonly
    if(!this.schema.readOnly && !this.schema.readonly) {
      if(!window.FileReader) throw "FileReader required for base64 editor";

      // File uploader
      this.uploader = this.theme.getFormInputField('file');

      this.uploader.addEventListener('change',function(e) {
        e.preventDefault();
        e.stopPropagation();

        if(this.files && this.files.length) {
          var fr = new FileReader();
          fr.onload = function(evt) {
            self.value = evt.target.result;
            self.refreshPreview();
            self.onChange(true);
            fr = null;
          };
          fr.readAsDataURL(this.files[0]);
        }
      });
    }

    this.preview = this.theme.getFormInputDescription(this.schema.description);
    this.container.appendChild(this.preview);

    this.control = this.theme.getFormControl(this.label, this.uploader||this.input, this.preview);
    this.container.appendChild(this.control);
  },
  refreshPreview: function() {
    if(this.last_preview === this.value) return;
    this.last_preview = this.value;

    this.preview.innerHTML = '';

    if(!this.value) return;

    var mime = this.value.match(/^data:([^;,]+)[;,]/);
    if(mime) mime = mime[1];

    if(!mime) {
      this.preview.innerHTML = '<em>Invalid data URI</em>';
    }
    else {
      this.preview.innerHTML = '<strong>Type:</strong> '+mime+', <strong>Size:</strong> '+Math.floor((this.value.length-this.value.split(',')[0].length-1)/1.33333)+' bytes';
      if(mime.substr(0,5)==="image") {
        this.preview.innerHTML += '<br>';
        var img = document.createElement('img');
        img.style.maxWidth = '100%';
        img.style.maxHeight = '100px';
        img.src = this.value;
        this.preview.appendChild(img);
      }
    }
  },
  enable: function() {
    if(this.uploader) this.uploader.disabled = false;
    this._super();
  },
  disable: function() {
    if(this.uploader) this.uploader.disabled = true;
    this._super();
  },
  setValue: function(val) {
    if(this.value !== val) {
      this.value = val;
      this.input.value = this.value;
      this.refreshPreview();
      this.onChange();
    }
  },
  destroy: function() {
    if(this.preview && this.preview.parentNode) this.preview.parentNode.removeChild(this.preview);
    if(this.title && this.title.parentNode) this.title.parentNode.removeChild(this.title);
    if(this.input && this.input.parentNode) this.input.parentNode.removeChild(this.input);
    if(this.uploader && this.uploader.parentNode) this.uploader.parentNode.removeChild(this.uploader);

    this._super();
  }
});

JSONEditor.defaults.editors.upload = JSONEditor.AbstractEditor.extend({
  getNumColumns: function() {
    return 4;
  },
  build: function() {
    var self = this;
    this.title = this.header = this.label = this.theme.getFormInputLabel(this.getTitle());

    // Input that holds the base64 string
    this.input = this.theme.getFormInputField('hidden');
    this.container.appendChild(this.input);

    // Don't show uploader if this is readonly
    if(!this.schema.readOnly && !this.schema.readonly) {

      if(!this.jsoneditor.options.upload) throw "Upload handler required for upload editor";

      // File uploader
      this.uploader = this.theme.getFormInputField('file');

      this.uploader.addEventListener('change',function(e) {
        e.preventDefault();
        e.stopPropagation();

        if(this.files && this.files.length) {
          var fr = new FileReader();
          fr.onload = function(evt) {
            self.preview_value = evt.target.result;
            self.refreshPreview();
            self.onChange(true);
            fr = null;
          };
          fr.readAsDataURL(this.files[0]);
        }
      });
    }

    var description = this.schema.description;
    if (!description) description = '';

    this.preview = this.theme.getFormInputDescription(description);
    this.container.appendChild(this.preview);

    this.control = this.theme.getFormControl(this.label, this.uploader||this.input, this.preview);
    this.container.appendChild(this.control);
  },
  refreshPreview: function() {
    if(this.last_preview === this.preview_value) return;
    this.last_preview = this.preview_value;

    this.preview.innerHTML = '';

    if(!this.preview_value) return;

    var self = this;

    var mime = this.preview_value.match(/^data:([^;,]+)[;,]/);
    if(mime) mime = mime[1];
    if(!mime) mime = 'unknown';

    var file = this.uploader.files[0];

    this.preview.innerHTML = '<strong>Type:</strong> '+mime+', <strong>Size:</strong> '+file.size+' bytes';
    if(mime.substr(0,5)==="image") {
      this.preview.innerHTML += '<br>';
      var img = document.createElement('img');
      img.style.maxWidth = '100%';
      img.style.maxHeight = '100px';
      img.src = this.preview_value;
      this.preview.appendChild(img);
    }

    this.preview.innerHTML += '<br>';
    var uploadButton = this.getButton('Upload', 'upload', 'Upload');
    this.preview.appendChild(uploadButton);
    uploadButton.addEventListener('click',function(event) {
      event.preventDefault();

      uploadButton.setAttribute("disabled", "disabled");
      self.theme.removeInputError(self.uploader);

      if (self.theme.getProgressBar) {
        self.progressBar = self.theme.getProgressBar();
        self.preview.appendChild(self.progressBar);
      }

      self.jsoneditor.options.upload(self.path, file, {
        success: function(url) {
          self.setValue(url);

          if(self.parent) self.parent.onChildEditorChange(self);
          else self.jsoneditor.onChange();

          if (self.progressBar) self.preview.removeChild(self.progressBar);
          uploadButton.removeAttribute("disabled");
        },
        failure: function(error) {
          self.theme.addInputError(self.uploader, error);
          if (self.progressBar) self.preview.removeChild(self.progressBar);
          uploadButton.removeAttribute("disabled");
        },
        updateProgress: function(progress) {
          if (self.progressBar) {
            if (progress) self.theme.updateProgressBar(self.progressBar, progress);
            else self.theme.updateProgressBarUnknown(self.progressBar);
          }
        }
      });
    });
  },
  enable: function() {
    if(this.uploader) this.uploader.disabled = false;
    this._super();
  },
  disable: function() {
    if(this.uploader) this.uploader.disabled = true;
    this._super();
  },
  setValue: function(val) {
    if(this.value !== val) {
      this.value = val;
      this.input.value = this.value;
      this.onChange();
    }
  },
  destroy: function() {
    if(this.preview && this.preview.parentNode) this.preview.parentNode.removeChild(this.preview);
    if(this.title && this.title.parentNode) this.title.parentNode.removeChild(this.title);
    if(this.input && this.input.parentNode) this.input.parentNode.removeChild(this.input);
    if(this.uploader && this.uploader.parentNode) this.uploader.parentNode.removeChild(this.uploader);

    this._super();
  }
});

JSONEditor.AbstractTheme = Class.extend({
  getContainer: function() {
    return document.createElement('div');
  },
  getFloatRightLinkHolder: function() {
    var el = document.createElement('div');
    el.style = el.style || {};
    el.style.cssFloat = 'right';
    el.style.marginLeft = '10px';
    return el;
  },
  getModal: function() {
    var el = document.createElement('div');
    el.style.backgroundColor = 'white';
    el.style.border = '1px solid black';
    el.style.boxShadow = '3px 3px black';
    el.style.position = 'absolute';
    el.style.zIndex = '10';
    el.style.display = 'none';
    return el;
  },
  getGridContainer: function() {
    var el = document.createElement('div');
    return el;
  },
  getGridRow: function() {
    var el = document.createElement('div');
    el.className = 'row';
    return el;
  },
  getGridColumn: function() {
    var el = document.createElement('div');
    return el;
  },
  setGridColumnSize: function(el,size) {

  },
  getLink: function(text) {
    var el = document.createElement('a');
    el.setAttribute('href','#');
    el.appendChild(document.createTextNode(text));
    return el;
  },
  disableHeader: function(header) {
    header.style.color = '#ccc';
  },
  disableLabel: function(label) {
    label.style.color = '#ccc';
  },
  enableHeader: function(header) {
    header.style.color = '';
  },
  enableLabel: function(label) {
    label.style.color = '';
  },
  getFormInputLabel: function(text) {
    var el = document.createElement('label');
    el.appendChild(document.createTextNode(text));
    return el;
  },
  getCheckboxLabel: function(text) {
    var el = this.getFormInputLabel(text);
    el.style.fontWeight = 'normal';
    return el;
  },
  getHeader: function(text) {
    var el = document.createElement('h3');
    if(typeof text === "string") {
      el.textContent = text;
    }
    else {
      el.appendChild(text);
    }

    return el;
  },
  getCheckbox: function() {
    var el = this.getFormInputField('checkbox');
    el.style.display = 'inline-block';
    el.style.width = 'auto';
    return el;
  },
  getMultiCheckboxHolder: function(controls,label,description) {
    var el = document.createElement('div');

    if(label) {
      label.style.display = 'block';
      el.appendChild(label);
    }

    for(var i in controls) {
      if(!controls.hasOwnProperty(i)) continue;
      controls[i].style.display = 'inline-block';
      controls[i].style.marginRight = '20px';
      el.appendChild(controls[i]);
    }

    if(description) el.appendChild(description);

    return el;
  },
  getSelectInput: function(options) {
    var select = document.createElement('select');
    if(options) this.setSelectOptions(select, options);
    return select;
  },
  getSwitcher: function(options) {
    var switcher = this.getSelectInput(options);
    switcher.style.backgroundColor = 'transparent';
    switcher.style.height = 'auto';
    switcher.style.fontStyle = 'italic';
    switcher.style.fontWeight = 'normal';
    switcher.style.padding = '0 0 0 3px';
    return switcher;
  },
  getSwitcherOptions: function(switcher) {
    return switcher.getElementsByTagName('option');
  },
  setSwitcherOptions: function(switcher, options, titles) {
    this.setSelectOptions(switcher, options, titles);
  },
  setSelectOptions: function(select, options, titles) {
    titles = titles || [];
    select.innerHTML = '';
    for(var i=0; i<options.length; i++) {
      var option = document.createElement('option');
      option.setAttribute('value',options[i]);
      option.textContent = titles[i] || options[i];
      select.appendChild(option);
    }
  },
  getTextareaInput: function() {
    var el = document.createElement('textarea');
    el.style = el.style || {};
    el.style.width = '100%';
    el.style.height = '300px';
    el.style.boxSizing = 'border-box';
    return el;
  },
  getRangeInput: function(min,max,step) {
    var el = this.getFormInputField('range');
    el.setAttribute('min',min);
    el.setAttribute('max',max);
    el.setAttribute('step',step);
    return el;
  },
  getFormInputField: function(type) {
    var el = document.createElement('input');
    el.setAttribute('type',type);
    return el;
  },
  afterInputReady: function(input) {

  },
  getFormControl: function(label, input, description) {
    var el = document.createElement('div');
    el.className = 'form-control';
    if(label) el.appendChild(label);
    if(input.type === 'checkbox') {
      label.insertBefore(input,label.firstChild);
    }
    else {
      el.appendChild(input);
    }

    if(description) el.appendChild(description);
    return el;
  },
  getIndentedPanel: function() {
    var el = document.createElement('div');
    el.style = el.style || {};
    el.style.paddingLeft = '10px';
    el.style.marginLeft = '10px';
    el.style.borderLeft = '1px solid #ccc';
    return el;
  },
  getChildEditorHolder: function() {
    return document.createElement('div');
  },
  getDescription: function(text) {
    var el = document.createElement('p');
    el.appendChild(document.createTextNode(text));
    return el;
  },
  getCheckboxDescription: function(text) {
    return this.getDescription(text);
  },
  getFormInputDescription: function(text) {
    return this.getDescription(text);
  },
  getHeaderButtonHolder: function() {
    return this.getButtonHolder();
  },
  getButtonHolder: function() {
    return document.createElement('div');
  },
  getButton: function(text, icon, title) {
    var el = document.createElement('button');
    this.setButtonText(el,text,icon,title);
    return el;
  },
  setButtonText: function(button, text, icon, title) {
    button.innerHTML = '';
    if(icon) {
      button.appendChild(icon);
      button.innerHTML += ' ';
    }
    button.appendChild(document.createTextNode(text));
    if(title) button.setAttribute('title',title);
  },
  getTable: function() {
    return document.createElement('table');
  },
  getTableRow: function() {
    return document.createElement('tr');
  },
  getTableHead: function() {
    return document.createElement('thead');
  },
  getTableBody: function() {
    return document.createElement('tbody');
  },
  getTableHeaderCell: function(text) {
    var el = document.createElement('th');
    el.textContent = text;
    return el;
  },
  getTableCell: function() {
    var el = document.createElement('td');
    return el;
  },
  getErrorMessage: function(text) {
    var el = document.createElement('p');
    el.style = el.style || {};
    el.style.color = 'red';
    el.appendChild(document.createTextNode(text));
    return el;
  },
  addInputError: function(input, text) {
  },
  removeInputError: function(input) {
  },
  addTableRowError: function(row) {
  },
  removeTableRowError: function(row) {
  },
  getTabHolder: function() {
    var el = document.createElement('div');
    el.innerHTML = "<div style='float: left; width: 130px;' class='tabs'></div><div class='content' style='margin-left: 130px;'></div><div style='clear:both;'></div>";
    return el;
  },
  applyStyles: function(el,styles) {
    el.style = el.style || {};
    for(var i in styles) {
      if(!styles.hasOwnProperty(i)) continue;
      el.style[i] = styles[i];
    }
  },
  closest: function(elem, selector) {
    var matchesSelector = elem.matches || elem.webkitMatchesSelector || elem.mozMatchesSelector || elem.msMatchesSelector;

    while (elem && elem !== document) {
      try {
        var f = matchesSelector.bind(elem);
        if (f(selector)) {
          return elem;
        } else {
          elem = elem.parentNode;
        }
      }
      catch(e) {
        return false;
      }
    }
    return false;
  },
  getTab: function(span) {
    var el = document.createElement('div');
    el.appendChild(span);
    el.style = el.style || {};
    this.applyStyles(el,{
      border: '1px solid #ccc',
      borderWidth: '1px 0 1px 1px',
      textAlign: 'center',
      lineHeight: '30px',
      borderRadius: '5px',
      borderBottomRightRadius: 0,
      borderTopRightRadius: 0,
      fontWeight: 'bold',
      cursor: 'pointer'
    });
    return el;
  },
  getTabContentHolder: function(tab_holder) {
    return tab_holder.children[1];
  },
  getTabContent: function() {
    return this.getIndentedPanel();
  },
  markTabActive: function(tab) {
    this.applyStyles(tab,{
      opacity: 1,
      background: 'white'
    });
  },
  markTabInactive: function(tab) {
    this.applyStyles(tab,{
      opacity:0.5,
      background: ''
    });
  },
  addTab: function(holder, tab) {
    holder.children[0].appendChild(tab);
  },
  getBlockLink: function() {
    var link = document.createElement('a');
    link.style.display = 'block';
    return link;
  },
  getBlockLinkHolder: function() {
    var el = document.createElement('div');
    return el;
  },
  getLinksHolder: function() {
    var el = document.createElement('div');
    return el;
  },
  createMediaLink: function(holder,link,media) {
    holder.appendChild(link);
    media.style.width='100%';
    holder.appendChild(media);
  },
  createImageLink: function(holder,link,image) {
    holder.appendChild(link);
    link.appendChild(image);
  }
});

JSONEditor.defaults.themes.bootstrap2 = JSONEditor.AbstractTheme.extend({
  getRangeInput: function(min, max, step) {
    // TODO: use bootstrap slider
    return this._super(min, max, step);
  },
  getGridContainer: function() {
    var el = document.createElement('div');
    el.className = 'container-fluid';
    return el;
  },
  getGridRow: function() {
    var el = document.createElement('div');
    el.className = 'row-fluid';
    return el;
  },
  getFormInputLabel: function(text) {
    var el = this._super(text);
    el.style.display = 'inline-block';
    el.style.fontWeight = 'bold';
    return el;
  },
  setGridColumnSize: function(el,size) {
    el.className = 'span'+size;
  },
  getSelectInput: function(options) {
    var input = this._super(options);
    input.style.width = 'auto';
    input.style.maxWidth = '98%';
    return input;
  },
  getFormInputField: function(type) {
    var el = this._super(type);
    el.style.width = '98%';
    return el;
  },
  afterInputReady: function(input) {
    if(input.controlgroup) return;
    input.controlgroup = this.closest(input,'.control-group');
    input.controls = this.closest(input,'.controls');
    if(this.closest(input,'.compact')) {
      input.controlgroup.className = input.controlgroup.className.replace(/control-group/g,'').replace(/[ ]{2,}/g,' ');
      input.controls.className = input.controlgroup.className.replace(/controls/g,'').replace(/[ ]{2,}/g,' ');
      input.style.marginBottom = 0;
    }

    // TODO: use bootstrap slider
  },
  getIndentedPanel: function() {
    var el = document.createElement('div');
    el.className = 'well well-small';
    return el;
  },
  getFormInputDescription: function(text) {
    var el = document.createElement('p');
    el.className = 'help-inline';
    el.textContent = text;
    return el;
  },
  getFormControl: function(label, input, description) {
    var ret = document.createElement('div');
    ret.className = 'control-group';

    var controls = document.createElement('div');
    controls.className = 'controls';

    if(label && input.getAttribute('type') === 'checkbox') {
      ret.appendChild(controls);
      label.className += ' checkbox';
      label.appendChild(input);
      controls.appendChild(label);
      controls.style.height = '30px';
    }
    else {
      if(label) {
        label.className += ' control-label';
        ret.appendChild(label);
      }
      controls.appendChild(input);
      ret.appendChild(controls);
    }

    if(description) controls.appendChild(description);

    return ret;
  },
  getHeaderButtonHolder: function() {
    var el = this.getButtonHolder();
    el.style.marginLeft = '10px';
    return el;
  },
  getButtonHolder: function() {
    var el = document.createElement('div');
    el.className = 'btn-group';
    return el;
  },
  getButton: function(text, icon, title) {
    var el =  this._super(text, icon, title);
    el.className += ' btn btn-default';
    return el;
  },
  getTable: function() {
    var el = document.createElement('table');
    el.className = 'table table-bordered';
    el.style.width = 'auto';
    el.style.maxWidth = 'none';
    return el;
  },
  addInputError: function(input,text) {
    if(!input.controlgroup || !input.controls) return;
    input.controlgroup.className += ' error';
    if(!input.errmsg) {
      input.errmsg = document.createElement('p');
      input.errmsg.className = 'help-block errormsg';
      input.controls.appendChild(input.errmsg);
    }
    else {
      input.errmsg.style.display = '';
    }

    input.errmsg.textContent = text;
  },
  removeInputError: function(input) {
    if(!input.errmsg) return;
    input.errmsg.style.display = 'none';
    input.controlgroup.className = input.controlgroup.className.replace(/\s?error/g,'');
  },
  getTabHolder: function() {
    var el = document.createElement('div');
    el.className = 'tabbable tabs-left';
    el.innerHTML = "<ul class='nav nav-tabs span2' style='margin-right: 0;'></ul><div class='tab-content span10' style='overflow:visible;'></div>";
    return el;
  },
  getTab: function(text) {
    var el = document.createElement('li');
    var a = document.createElement('a');
    a.setAttribute('href','#');
    a.appendChild(text);
    el.appendChild(a);
    return el;
  },
  getTabContentHolder: function(tab_holder) {
    return tab_holder.children[1];
  },
  getTabContent: function() {
    var el = document.createElement('div');
    el.className = 'tab-pane active';
    return el;
  },
  markTabActive: function(tab) {
    tab.className += ' active';
  },
  markTabInactive: function(tab) {
    tab.className = tab.className.replace(/\s?active/g,'');
  },
  addTab: function(holder, tab) {
    holder.children[0].appendChild(tab);
  },
  getProgressBar: function() {
    var container = document.createElement('div');
    container.className = 'progress';

    var bar = document.createElement('div');
    bar.className = 'bar';
    bar.style.width = '0%';
    container.appendChild(bar);

    return container;
  },
  updateProgressBar: function(progressBar, progress) {
    if (!progressBar) return;

    progressBar.firstChild.style.width = progress + "%";
  },
  updateProgressBarUnknown: function(progressBar) {
    if (!progressBar) return;

    progressBar.className = 'progress progress-striped active';
    progressBar.firstChild.style.width = '100%';
  }
});

JSONEditor.defaults.themes.bootstrap3 = JSONEditor.AbstractTheme.extend({
  getSelectInput: function(options) {
    var el = this._super(options);
    el.className += 'form-control';
    //el.style.width = 'auto';
    return el;
  },
  setGridColumnSize: function(el,size) {
    el.className = 'col-md-'+size;
  },
  afterInputReady: function(input) {
    if(input.controlgroup) return;
    input.controlgroup = this.closest(input,'.form-group');
    if(this.closest(input,'.compact')) {
      input.controlgroup.style.marginBottom = 0;
    }

    // TODO: use bootstrap slider
  },
  getTextareaInput: function() {
    var el = document.createElement('textarea');
    el.className = 'form-control';
    return el;
  },
  getRangeInput: function(min, max, step) {
    // TODO: use better slider
    return this._super(min, max, step);
  },
  getFormInputField: function(type) {
    var el = this._super(type);
    if(type !== 'checkbox') {
      el.className += 'form-control';
    }
    return el;
  },
  getFormControl: function(label, input, description) {
    var group = document.createElement('div');

    if(label && input.type === 'checkbox') {
      group.className += ' checkbox';
      label.appendChild(input);
      label.style.fontSize = '14px';
      group.style.marginTop = '0';
      group.appendChild(label);
      input.style.position = 'relative';
      input.style.cssFloat = 'left';
    }
    else {
      group.className += ' form-group';
      if(label) {
        label.className += ' control-label';
        group.appendChild(label);
      }
      group.appendChild(input);
    }

    if(description) group.appendChild(description);

    return group;
  },
  getIndentedPanel: function() {
    var el = document.createElement('div');
    el.className = 'well well-sm';
    return el;
  },
  getFormInputDescription: function(text) {
    var el = document.createElement('p');
    el.className = 'help-block';
    el.textContent = text;
    return el;
  },
  getHeaderButtonHolder: function() {
    var el = this.getButtonHolder();
    el.style.marginLeft = '10px';
    return el;
  },
  getButtonHolder: function() {
    var el = document.createElement('div');
    el.className = 'btn-group';
    return el;
  },
  getButton: function(text, icon, title) {
    var el = this._super(text, icon, title);
    el.className += 'btn btn-default';
    return el;
  },
  getTable: function() {
    var el = document.createElement('table');
    el.className = 'table table-bordered';
    el.style.width = 'auto';
    el.style.maxWidth = 'none';
    return el;
  },

  addInputError: function(input,text) {
    if(!input.controlgroup) return;
    input.controlgroup.className += ' has-error';
    if(!input.errmsg) {
      input.errmsg = document.createElement('p');
      input.errmsg.className = 'help-block errormsg';
      input.controlgroup.appendChild(input.errmsg);
    }
    else {
      input.errmsg.style.display = '';
    }

    input.errmsg.textContent = text;
  },
  removeInputError: function(input) {
    if(!input.errmsg) return;
    input.errmsg.style.display = 'none';
    input.controlgroup.className = input.controlgroup.className.replace(/\s?has-error/g,'');
  },
  getTabHolder: function() {
    var el = document.createElement('div');
    el.innerHTML = "<div class='tabs list-group col-md-2'></div><div class='col-md-10'></div>";
    el.className = 'rows';
    return el;
  },
  getTab: function(text) {
    var el = document.createElement('a');
    el.className = 'list-group-item';
    el.setAttribute('href','#');
    el.appendChild(text);
    return el;
  },
  markTabActive: function(tab) {
    tab.className += ' active';
  },
  markTabInactive: function(tab) {
    tab.className = tab.className.replace(/\s?active/g,'');
  },
  getProgressBar: function() {
    var min = 0, max = 100, start = 0;

    var container = document.createElement('div');
    container.className = 'progress';

    var bar = document.createElement('div');
    bar.className = 'progress-bar';
    bar.setAttribute('role', 'progressbar');
    bar.setAttribute('aria-valuenow', start);
    bar.setAttribute('aria-valuemin', min);
    bar.setAttribute('aria-valuenax', max);
    bar.innerHTML = start + "%";
    container.appendChild(bar);

    return container;
  },
  updateProgressBar: function(progressBar, progress) {
    if (!progressBar) return;

    var bar = progressBar.firstChild;
    var percentage = progress + "%";
    bar.setAttribute('aria-valuenow', progress);
    bar.style.width = percentage;
    bar.innerHTML = percentage;
  },
  updateProgressBarUnknown: function(progressBar) {
    if (!progressBar) return;

    var bar = progressBar.firstChild;
    progressBar.className = 'progress progress-striped active';
    bar.removeAttribute('aria-valuenow');
    bar.style.width = '100%';
    bar.innerHTML = '';
  }
});

// Base Foundation theme
JSONEditor.defaults.themes.foundation = JSONEditor.AbstractTheme.extend({
  getChildEditorHolder: function() {
    var el = document.createElement('div');
    el.style.marginBottom = '15px';
    return el;
  },
  getSelectInput: function(options) {
    var el = this._super(options);
    el.style.minWidth = 'none';
    el.style.padding = '5px';
    el.style.marginTop = '3px';
    return el;
  },
  getSwitcher: function(options) {
    var el = this._super(options);
    el.style.paddingRight = '8px';
    return el;
  },
  afterInputReady: function(input) {
    if(this.closest(input,'.compact')) {
      input.style.marginBottom = 0;
    }
    input.group = this.closest(input,'.form-control');
  },
  getFormInputLabel: function(text) {
    var el = this._super(text);
    el.style.display = 'inline-block';
    return el;
  },
  getFormInputField: function(type) {
    var el = this._super(type);
    el.style.width = '100%';
    el.style.marginBottom = type==='checkbox'? '0' : '12px';
    return el;
  },
  getFormInputDescription: function(text) {
    var el = document.createElement('p');
    el.textContent = text;
    el.style.marginTop = '-10px';
    el.style.fontStyle = 'italic';
    return el;
  },
  getIndentedPanel: function() {
    var el = document.createElement('div');
    el.className = 'panel';
    return el;
  },
  getHeaderButtonHolder: function() {
    var el = this.getButtonHolder();
    el.style.display = 'inline-block';
    el.style.marginLeft = '10px';
    el.style.verticalAlign = 'middle';
    return el;
  },
  getButtonHolder: function() {
    var el = document.createElement('div');
    el.className = 'button-group';
    return el;
  },
  getButton: function(text, icon, title) {
    var el = this._super(text, icon, title);
    el.className += ' small button';
    return el;
  },
  addInputError: function(input,text) {
    if(!input.group) return;
    input.group.className += ' error';

    if(!input.errmsg) {
      input.insertAdjacentHTML('afterend','<small class="error"></small>');
      input.errmsg = input.parentNode.getElementsByClassName('error')[0];
    }
    else {
      input.errmsg.style.display = '';
    }

    input.errmsg.textContent = text;
  },
  removeInputError: function(input) {
    if(!input.errmsg) return;
    input.group.className = input.group.className.replace(/ error/g,'');
    input.errmsg.style.display = 'none';
  },
  getProgressBar: function() {
    var progressBar = document.createElement('div');
    progressBar.className = 'progress';

    var meter = document.createElement('span');
    meter.className = 'meter';
    meter.style.width = '0%';
    progressBar.appendChild(meter);
    return progressBar;
  },
  updateProgressBar: function(progressBar, progress) {
    if (!progressBar) return;
    progressBar.firstChild.style.width = progress + '%';
  },
  updateProgressBarUnknown: function(progressBar) {
    if (!progressBar) return;
    progressBar.firstChild.style.width = '100%';
  }
});

// Foundation 3 Specific Theme
JSONEditor.defaults.themes.foundation3 = JSONEditor.defaults.themes.foundation.extend({
  getHeaderButtonHolder: function() {
    var el = this._super();
    el.style.fontSize = '.6em';
    return el;
  },
  getFormInputLabel: function(text) {
    var el = this._super(text);
    el.style.fontWeight = 'bold';
    return el;
  },
  getTabHolder: function() {
    var el = document.createElement('div');
    el.className = 'row';
    el.innerHTML = "<dl class='tabs vertical two columns'></dl><div class='tabs-content ten columns'></div>";
    return el;
  },
  setGridColumnSize: function(el,size) {
    var sizes = ['zero','one','two','three','four','five','six','seven','eight','nine','ten','eleven','twelve'];
    el.className = 'columns '+sizes[size];
  },
  getTab: function(text) {
    var el = document.createElement('dd');
    var a = document.createElement('a');
    a.setAttribute('href','#');
    a.appendChild(text);
    el.appendChild(a);
    return el;
  },
  getTabContentHolder: function(tab_holder) {
    return tab_holder.children[1];
  },
  getTabContent: function() {
    var el = document.createElement('div');
    el.className = 'content active';
    el.style.paddingLeft = '5px';
    return el;
  },
  markTabActive: function(tab) {
    tab.className += ' active';
  },
  markTabInactive: function(tab) {
    tab.className = tab.className.replace(/\s*active/g,'');
  },
  addTab: function(holder, tab) {
    holder.children[0].appendChild(tab);
  }
});

// Foundation 4 Specific Theme
JSONEditor.defaults.themes.foundation4 = JSONEditor.defaults.themes.foundation.extend({
  getHeaderButtonHolder: function() {
    var el = this._super();
    el.style.fontSize = '.6em';
    return el;
  },
  setGridColumnSize: function(el,size) {
    el.className = 'columns large-'+size;
  },
  getFormInputDescription: function(text) {
    var el = this._super(text);
    el.style.fontSize = '.8rem';
    return el;
  },
  getFormInputLabel: function(text) {
    var el = this._super(text);
    el.style.fontWeight = 'bold';
    return el;
  }
});

// Foundation 5 Specific Theme
JSONEditor.defaults.themes.foundation5 = JSONEditor.defaults.themes.foundation.extend({
  getFormInputDescription: function(text) {
    var el = this._super(text);
    el.style.fontSize = '.8rem';
    return el;
  },
  setGridColumnSize: function(el,size) {
    el.className = 'columns medium-'+size;
  },
  getButton: function(text, icon, title) {
    var el = this._super(text,icon,title);
    el.className = el.className.replace(/\s*small/g,'') + ' tiny';
    return el;
  },
  getTabHolder: function() {
    var el = document.createElement('div');
    el.innerHTML = "<dl class='tabs vertical'></dl><div class='tabs-content'></div>";
    return el;
  },
  getTab: function(text) {
    var el = document.createElement('dd');
    var a = document.createElement('a');
    a.setAttribute('href','#');
    a.appendChild(text);
    el.appendChild(a);
    return el;
  },
  getTabContentHolder: function(tab_holder) {
    return tab_holder.children[1];
  },
  getTabContent: function() {
    var el = document.createElement('div');
    el.className = 'content active';
    el.style.paddingLeft = '5px';
    return el;
  },
  markTabActive: function(tab) {
    tab.className += ' active';
  },
  markTabInactive: function(tab) {
    tab.className = tab.className.replace(/\s*active/g,'');
  },
  addTab: function(holder, tab) {
    holder.children[0].appendChild(tab);
  }
});

JSONEditor.defaults.themes.html = JSONEditor.AbstractTheme.extend({
  getFormInputLabel: function(text) {
    var el = this._super(text);
    el.style.display = 'block';
    el.style.marginBottom = '3px';
    el.style.fontWeight = 'bold';
    return el;
  },
  getFormInputDescription: function(text) {
    var el = this._super(text);
    el.style.fontSize = '.8em';
    el.style.margin = 0;
    el.style.display = 'inline-block';
    el.style.fontStyle = 'italic';
    return el;
  },
  getIndentedPanel: function() {
    var el = this._super();
    el.style.border = '1px solid #ddd';
    el.style.padding = '5px';
    el.style.margin = '5px';
    el.style.borderRadius = '3px';
    return el;
  },
  getChildEditorHolder: function() {
    var el = this._super();
    el.style.marginBottom = '8px';
    return el;
  },
  getHeaderButtonHolder: function() {
    var el = this.getButtonHolder();
    el.style.display = 'inline-block';
    el.style.marginLeft = '10px';
    el.style.fontSize = '.8em';
    el.style.verticalAlign = 'middle';
    return el;
  },
  getTable: function() {
    var el = this._super();
    el.style.borderBottom = '1px solid #ccc';
    el.style.marginBottom = '5px';
    return el;
  },
  addInputError: function(input, text) {
    input.style.borderColor = 'red';

    if(!input.errmsg) {
      var group = this.closest(input,'.form-control');
      input.errmsg = document.createElement('div');
      input.errmsg.setAttribute('class','errmsg');
      input.errmsg.style = input.errmsg.style || {};
      input.errmsg.style.color = 'red';
      group.appendChild(input.errmsg);
    }
    else {
      input.errmsg.style.display = 'block';
    }

    input.errmsg.innerHTML = '';
    input.errmsg.appendChild(document.createTextNode(text));
  },
  removeInputError: function(input) {
    input.style.borderColor = '';
    if(input.errmsg) input.errmsg.style.display = 'none';
  },
  getProgressBar: function() {
    var max = 100, start = 0;

    var progressBar = document.createElement('progress');
    progressBar.setAttribute('max', max);
    progressBar.setAttribute('value', start);
    return progressBar;
  },
  updateProgressBar: function(progressBar, progress) {
    if (!progressBar) return;
    progressBar.setAttribute('value', progress);
  },
  updateProgressBarUnknown: function(progressBar) {
    if (!progressBar) return;
    progressBar.removeAttribute('value');
  }
});

JSONEditor.defaults.themes.jqueryui = JSONEditor.AbstractTheme.extend({
  getTable: function() {
    var el = this._super();
    el.setAttribute('cellpadding',5);
    el.setAttribute('cellspacing',0);
    return el;
  },
  getTableHeaderCell: function(text) {
    var el = this._super(text);
    el.className = 'ui-state-active';
    el.style.fontWeight = 'bold';
    return el;
  },
  getTableCell: function() {
    var el = this._super();
    el.className = 'ui-widget-content';
    return el;
  },
  getHeaderButtonHolder: function() {
    var el = this.getButtonHolder();
    el.style.marginLeft = '10px';
    el.style.fontSize = '.6em';
    el.style.display = 'inline-block';
    return el;
  },
  getFormInputDescription: function(text) {
    var el = this.getDescription(text);
    el.style.marginLeft = '10px';
    el.style.display = 'inline-block';
    return el;
  },
  getFormControl: function(label, input, description) {
    var el = this._super(label,input,description);
    if(input.type === 'checkbox') {
      el.style.lineHeight = '25px';

      el.style.padding = '3px 0';
    }
    else {
      el.style.padding = '4px 0 8px 0';
    }
    return el;
  },
  getDescription: function(text) {
    var el = document.createElement('span');
    el.style.fontSize = '.8em';
    el.style.fontStyle = 'italic';
    el.textContent = text;
    return el;
  },
  getButtonHolder: function() {
    var el = document.createElement('div');
    el.className = 'ui-buttonset';
    el.style.fontSize = '.7em';
    return el;
  },
  getFormInputLabel: function(text) {
    var el = document.createElement('label');
    el.style.fontWeight = 'bold';
    el.style.display = 'block';
    el.textContent = text;
    return el;
  },
  getButton: function(text, icon, title) {
    var button = document.createElement("button");
    button.className = 'ui-button ui-widget ui-state-default ui-corner-all';

    // Icon only
    if(icon && !text) {
      button.className += ' ui-button-icon-only';
      icon.className += ' ui-button-icon-primary ui-icon-primary';
      button.appendChild(icon);
    }
    // Icon and Text
    else if(icon) {
      button.className += ' ui-button-text-icon-primary';
      icon.className += ' ui-button-icon-primary ui-icon-primary';
      button.appendChild(icon);
    }
    // Text only
    else {
      button.className += ' ui-button-text-only';
    }

    var el = document.createElement('span');
    el.className = 'ui-button-text';
    el.textContent = text||title||".";
    button.appendChild(el);

    button.setAttribute('title',title);

    return button;
  },
  setButtonText: function(button,text, icon, title) {
    button.innerHTML = '';
    button.className = 'ui-button ui-widget ui-state-default ui-corner-all';

    // Icon only
    if(icon && !text) {
      button.className += ' ui-button-icon-only';
      icon.className += ' ui-button-icon-primary ui-icon-primary';
      button.appendChild(icon);
    }
    // Icon and Text
    else if(icon) {
      button.className += ' ui-button-text-icon-primary';
      icon.className += ' ui-button-icon-primary ui-icon-primary';
      button.appendChild(icon);
    }
    // Text only
    else {
      button.className += ' ui-button-text-only';
    }

    var el = document.createElement('span');
    el.className = 'ui-button-text';
    el.textContent = text||title||".";
    button.appendChild(el);

    button.setAttribute('title',title);
  },
  getIndentedPanel: function() {
    var el = document.createElement('div');
    el.className = 'ui-widget-content ui-corner-all';
    el.style.padding = '1em 1.4em';
    el.style.marginBottom = '20px';
    return el;
  },
  afterInputReady: function(input) {
    if(input.controls) return;
    input.controls = this.closest(input,'.form-control');
  },
  addInputError: function(input,text) {
    if(!input.controls) return;
    if(!input.errmsg) {
      input.errmsg = document.createElement('div');
      input.errmsg.className = 'ui-state-error';
      input.controls.appendChild(input.errmsg);
    }
    else {
      input.errmsg.style.display = '';
    }

    input.errmsg.textContent = text;
  },
  removeInputError: function(input) {
    if(!input.errmsg) return;
    input.errmsg.style.display = 'none';
  },
  markTabActive: function(tab) {
    tab.className = tab.className.replace(/\s*ui-widget-header/g,'')+' ui-state-active';
  },
  markTabInactive: function(tab) {
    tab.className = tab.className.replace(/\s*ui-state-active/g,'')+' ui-widget-header';
  }
});

JSONEditor.AbstractIconLib = Class.extend({
  mapping: {
    collapse: '',
    expand: '',
    delete: '',
    edit: '',
    add: '',
    cancel: '',
    save: '',
    moveup: '',
    movedown: ''
  },
  icon_prefix: '',
  getIconClass: function(key) {
    if(this.mapping[key]) return this.icon_prefix+this.mapping[key];
    else return null;
  },
  getIcon: function(key) {
    var iconclass = this.getIconClass(key);

    if(!iconclass) return null;

    var i = document.createElement('i');
    i.className = iconclass;
    return i;
  }
});

JSONEditor.defaults.iconlibs.bootstrap2 = JSONEditor.AbstractIconLib.extend({
  mapping: {
    collapse: 'chevron-down',
    expand: 'chevron-up',
    delete: 'trash',
    edit: 'pencil',
    add: 'plus',
    cancel: 'ban-circle',
    save: 'ok',
    moveup: 'arrow-up',
    movedown: 'arrow-down'
  },
  icon_prefix: 'icon-'
});

JSONEditor.defaults.iconlibs.bootstrap3 = JSONEditor.AbstractIconLib.extend({
  mapping: {
    collapse: 'chevron-down',
    expand: 'chevron-right',
    delete: 'remove',
    edit: 'pencil',
    add: 'plus',
    cancel: 'floppy-remove',
    save: 'floppy-saved',
    moveup: 'arrow-up',
    movedown: 'arrow-down'
  },
  icon_prefix: 'glyphicon glyphicon-'
});

JSONEditor.defaults.iconlibs.fontawesome3 = JSONEditor.AbstractIconLib.extend({
  mapping: {
    collapse: 'chevron-down',
    expand: 'chevron-right',
    delete: 'remove',
    edit: 'pencil',
    add: 'plus',
    cancel: 'ban-circle',
    save: 'save',
    moveup: 'arrow-up',
    movedown: 'arrow-down'
  },
  icon_prefix: 'icon-'
});

JSONEditor.defaults.iconlibs.fontawesome4 = JSONEditor.AbstractIconLib.extend({
  mapping: {
    collapse: 'caret-square-o-down',
    expand: 'caret-square-o-right',
    delete: 'times',
    edit: 'pencil',
    add: 'plus',
    cancel: 'ban',
    save: 'save',
    moveup: 'arrow-up',
    movedown: 'arrow-down'
  },
  icon_prefix: 'fa fa-'
});

JSONEditor.defaults.iconlibs.foundation2 = JSONEditor.AbstractIconLib.extend({
  mapping: {
    collapse: 'minus',
    expand: 'plus',
    delete: 'remove',
    edit: 'edit',
    add: 'add-doc',
    cancel: 'error',
    save: 'checkmark',
    moveup: 'up-arrow',
    movedown: 'down-arrow'
  },
  icon_prefix: 'foundicon-'
});

JSONEditor.defaults.iconlibs.foundation3 = JSONEditor.AbstractIconLib.extend({
  mapping: {
    collapse: 'minus',
    expand: 'plus',
    delete: 'x',
    edit: 'pencil',
    add: 'page-add',
    cancel: 'x-circle',
    save: 'save',
    moveup: 'arrow-up',
    movedown: 'arrow-down'
  },
  icon_prefix: 'fi-'
});

JSONEditor.defaults.iconlibs.jqueryui = JSONEditor.AbstractIconLib.extend({
  mapping: {
    collapse: 'triangle-1-s',
    expand: 'triangle-1-e',
    delete: 'trash',
    edit: 'pencil',
    add: 'plusthick',
    cancel: 'closethick',
    save: 'disk',
    moveup: 'arrowthick-1-n',
    movedown: 'arrowthick-1-s'
  },
  icon_prefix: 'ui-icon ui-icon-'
});

JSONEditor.defaults.templates.default = function() {
  var expandVars = function(vars) {
    var expanded = {};
    $each(vars, function(i,el) {
      if(typeof el === "object" && el !== null) {
        var tmp = {};
        $each(el, function(j,item) {
          tmp[i+'.'+j] = item;
        });
        $extend(expanded,expandVars(tmp));
      }
      else {
        expanded[i] = el;
      }
    });
    return expanded;
  };

  return {
    compile: function(template) {
      return function (vars) {
        var expanded = expandVars(vars);

        var ret = template+"";
        // Only supports basic {{var}} macro replacement
        $each(expanded,function(key,value) {
          ret = ret.replace(new RegExp('{{\\s*'+key+'\\s*}}','g'),value);
        });
        return ret;
      };
    }
  };
};

JSONEditor.defaults.templates.ejs = function() {
  if(!window.EJS) return false;

  return {
    compile: function(template) {
      var compiled = new window.EJS({
        text: template
      });

      return function(context) {
        return compiled.render(context);
      };
    }
  };
};

JSONEditor.defaults.templates.handlebars = function() {
  return window.Handlebars;
};

JSONEditor.defaults.templates.hogan = function() {
  if(!window.Hogan) return false;

  return {
    compile: function(template) {
      var compiled = window.Hogan.compile(template);
      return function(context) {
        return compiled.render(context);
      };
    }
  };
};

JSONEditor.defaults.templates.markup = function() {
  if(!window.Mark || !window.Mark.up) return false;

  return {
    compile: function(template) {
      return function(context) {
        return window.Mark.up(template,context);
      };
    }
  };
};

JSONEditor.defaults.templates.mustache = function() {
  if(!window.Mustache) return false;

  return {
    compile: function(template) {
      return function(view) {
        return window.Mustache.render(template, view);
      };
    }
  };
};

JSONEditor.defaults.templates.swig = function() {
  return window.swig;
};

JSONEditor.defaults.templates.underscore = function() {
  if(!window._) return false;

  return {
    compile: function(template) {
      return function(context) {
        return window._.template(template, context);
      };
    }
  };
};

// Set the default theme
JSONEditor.defaults.theme = 'html';

// Set the default template engine
JSONEditor.defaults.template = 'default';

// Default options when initializing JSON Editor
JSONEditor.defaults.options = {};

// String translate function
JSONEditor.defaults.translate = function(key, variables) {
  var lang = JSONEditor.defaults.languages[JSONEditor.defaults.language];
  if(!lang) throw "Unknown language "+JSONEditor.defaults.language;

  var string = lang[key] || JSONEditor.defaults.languages[JSONEditor.defaults.default_language][key];

  if(typeof string === "undefined") throw "Unknown translate string "+key;

  if(variables) {
    for(var i=0; i<variables.length; i++) {
      string = string.replace(new RegExp('\\{\\{'+i+'}}','g'),variables[i]);
    }
  }

  return string;
};

// Translation strings and default languages
JSONEditor.defaults.default_language = 'en';
JSONEditor.defaults.language = JSONEditor.defaults.default_language;
JSONEditor.defaults.languages.en = {
  /**
   * When a property is not set
   */
  error_notset: "Property must be set",
  /**
   * When a string must not be empty
   */
  error_notempty: "Value required",
  /**
   * When a value is not one of the enumerated values
   */
  error_enum: "Value must be one of the enumerated values",
  /**
   * When a value doesn't validate any schema of a 'anyOf' combination
   */
  error_anyOf: "Value must validate against at least one of the provided schemas",
  /**
   * When a value doesn't validate
   * @variables This key takes one variable: The number of schemas the value does not validate
   */
  error_oneOf: 'Value must validate against exactly one of the provided schemas. It currently validates against {{0}} of the schemas.',
  /**
   * When a value does not validate a 'not' schema
   */
  error_not: "Value must not validate against the provided schema",
  /**
   * When a value does not match any of the provided types
   */
  error_type_union: "Value must be one of the provided types",
  /**
   * When a value does not match the given type
   * @variables This key takes one variable: The type the value should be of
   */
  error_type: "Value must be of type {{0}}",
  /**
   *  When the value validates one of the disallowed types
   */
  error_disallow_union: "Value must not be one of the provided disallowed types",
  /**
   *  When the value validates a disallowed type
   * @variables This key takes one variable: The type the value should not be of
   */
  error_disallow: "Value must not be of type {{0}}",
  /**
   * When a value is not a multiple of or divisible by a given number
   * @variables This key takes one variable: The number mentioned above
   */
  error_multipleOf: "Value must be a multiple of {{0}}",
  /**
   * When a value is greater than it's supposed to be (exclusive)
   * @variables This key takes one variable: The maximum
   */
  error_maximum_excl: "Value must be less than {{0}}",
  /**
   * When a value is greater than it's supposed to be (inclusive
   * @variables This key takes one variable: The maximum
   */
  error_maximum_incl: "Value must at most {{0}}",
  /**
   * When a value is lesser than it's supposed to be (exclusive)
   * @variables This key takes one variable: The minimum
   */
  error_minimum_excl: "Value must be greater than {{0}}",
  /**
   * When a value is lesser than it's supposed to be (inclusive)
   * @variables This key takes one variable: The minimum
   */
  error_minimum_incl: "Value must be at least {{0}}",
  /**
   * When a value have too many characters
   * @variables This key takes one variable: The maximum character count
   */
  error_maxLength: "Value must be at most {{0}} characters long",
  /**
   * When a value does not have enough characters
   * @variables This key takes one variable: The minimum character count
   */
  error_minLength: "Value must be at least {{0}} characters long",
  /**
   * When a value does not match a given pattern
   */
  error_pattern: "Value must match the provided pattern",
  /**
   * When an array has additional items whereas it is not supposed to
   */
  error_additionalItems: "No additional items allowed in this array",
  /**
   * When there are to many items in an array
   * @variables This key takes one variable: The maximum item count
   */
  error_maxItems: "Value must have at most {{0}} items",
  /**
   * When there are not enough items in an array
   * @variables This key takes one variable: The minimum item count
   */
  error_minItems: "Value must have at least {{0}} items",
  /**
   * When an array is supposed to have unique items but has duplicates
   */
  error_uniqueItems: "Array must have unique items",
  /**
   * When there are too many properties in an object
   * @variables This key takes one variable: The maximum property count
   */
  error_maxProperties: "Object must have at most {{0}} properties",
  /**
   * When there are not enough properties in an object
   * @variables This key takes one variable: The minimum property count
   */
  error_minProperties: "Object must have at least {{0}} properties",
  /**
   * When a required property is not defined
   * @variables This key takes one variable: The name of the missing property
   */
  error_required: "Object is missing the required property '{{0}}'",
  /**
   * When there is an additional property is set whereas there should be none
   * @variables This key takes one variable: The name of the additional property
   */
  error_additional_properties: "No additional properties allowed, but property {{0}} is set",
  /**
   * When a dependency is not resolved
   * @variables This key takes one variable: The name of the missing property for the dependency
   */
  error_dependency: "Must have property {{0}}"
};

// Miscellaneous Plugin Settings
JSONEditor.plugins = {
  ace: {
    theme: ''
  },
  epiceditor: {

  },
  sceditor: {

  },
  select2: {

  }
};

// Default per-editor options
for(var i in JSONEditor.defaults.editors) {
  if(!JSONEditor.defaults.editors.hasOwnProperty(i)) continue;
  JSONEditor.defaults.editors[i].options = JSONEditor.defaults.editors.options || {};
}

// Set the default resolvers
// Use "multiple" as a fall back for everything
JSONEditor.defaults.resolvers.unshift(function(schema) {
  if(typeof schema.type !== "string") return "multiple";
});
// If the type is set and it's a basic type, use the primitive editor
JSONEditor.defaults.resolvers.unshift(function(schema) {
  // If the schema is a simple type
  if(typeof schema.type === "string") return schema.type;
});
// Use the select editor for all boolean values
JSONEditor.defaults.resolvers.unshift(function(schema) {
  if(schema.type === 'boolean') {
    return "select";
  }
});
// Use the multiple editor for schemas where the `type` is set to "any"
JSONEditor.defaults.resolvers.unshift(function(schema) {
  // If the schema can be of any type
  if(schema.type === "any") return "multiple";
});
// Editor for base64 encoded files
JSONEditor.defaults.resolvers.unshift(function(schema) {
  // If the schema can be of any type
  if(schema.type === "string" && schema.media && schema.media.binaryEncoding==="base64") {
    return "base64";
  }
});
// Editor for uploading files
JSONEditor.defaults.resolvers.unshift(function(schema) {
  if(schema.type === "string" && schema.format === "url" && schema.options && schema.options.upload === true) {
    if(window.FileReader) return "upload";
  }
});
// Use the table editor for arrays with the format set to `table`
JSONEditor.defaults.resolvers.unshift(function(schema) {
  // Type `array` with format set to `table`
  if(schema.type == "array" && schema.format == "table") {
    return "table";
  }
});
// Use the `select` editor for dynamic enumSource enums
JSONEditor.defaults.resolvers.unshift(function(schema) {
  if(schema.enumSource) return "select";
});
// Use the `enum` or `select` editors for schemas with enumerated properties
JSONEditor.defaults.resolvers.unshift(function(schema) {
  if(schema.enum) {
    if(schema.type === "array" || schema.type === "object") {
      return "enum";
    }
    else if(schema.type === "number" || schema.type === "integer" || schema.type === "string") {
      return "select";
    }
  }
});
// Use the 'multiselect' editor for arrays of enumerated strings/numbers/integers
JSONEditor.defaults.resolvers.unshift(function(schema) {
  if(schema.type === "array" && schema.items && !(Array.isArray(schema.items)) && schema.uniqueItems && schema.items.enum && ['string','number','integer'].indexOf(schema.items.type) >= 0) {
    return 'multiselect';
  }
});
// Use the multiple editor for schemas with `oneOf` set
JSONEditor.defaults.resolvers.unshift(function(schema) {
  // If this schema uses `oneOf`
  if(schema.oneOf) return "multiple";
});

/**
 * This is a small wrapper for using JSON Editor like a typical jQuery plugin.
 */
(function() {
  if(window.jQuery || window.Zepto) {
    var $ = window.jQuery || window.Zepto;
    $.jsoneditor = JSONEditor.defaults;

    $.fn.jsoneditor = function(options) {
      var self = this;
      var editor = this.data('jsoneditor');
      if(options === 'value') {
        if(!editor) throw "Must initialize jsoneditor before getting/setting the value";

        // Set value
        if(arguments.length > 1) {
          editor.setValue(arguments[1]);
        }
        // Get value
        else {
          return editor.getValue();
        }
      }
      else if(options === 'validate') {
        if(!editor) throw "Must initialize jsoneditor before validating";

        // Validate a specific value
        if(arguments.length > 1) {
          return editor.validate(arguments[1]);
        }
        // Validate current value
        else {
          return editor.validate();
        }
      }
      else if(options === 'destroy') {
        if(editor) {
          editor.destroy();
          this.data('jsoneditor',null);
        }
      }
      else {
        // Destroy first
        if(editor) {
          editor.destroy();
        }

        // Create editor
        editor = new JSONEditor(this.get(0),options);
        this.data('jsoneditor',editor);

        // Setup event listeners
        editor.on('change',function() {
          self.trigger('change');
        });
        editor.on('ready',function() {
          self.trigger('ready');
        });
      }

      return this;
    };
  }
})();

  module.exports = JSONEditor;
})();

},{}],"3pLyGF":[function(require,module,exports){
/*!
 * mustache.js - Logic-less {{mustache}} templates with JavaScript
 * http://github.com/janl/mustache.js
 */

/*global define: false*/

(function (global, factory) {
  if (typeof exports === "object" && exports) {
    factory(exports); // CommonJS
  } else if (typeof define === "function" && define.amd) {
    define(['exports'], factory); // AMD
  } else {
    factory(global.Mustache = {}); // <script>
  }
}(this, function (mustache) {

  var Object_toString = Object.prototype.toString;
  var isArray = Array.isArray || function (object) {
    return Object_toString.call(object) === '[object Array]';
  };

  function isFunction(object) {
    return typeof object === 'function';
  }

  function escapeRegExp(string) {
    return string.replace(/[\-\[\]{}()*+?.,\\\^$|#\s]/g, "\\$&");
  }

  // Workaround for https://issues.apache.org/jira/browse/COUCHDB-577
  // See https://github.com/janl/mustache.js/issues/189
  var RegExp_test = RegExp.prototype.test;
  function testRegExp(re, string) {
    return RegExp_test.call(re, string);
  }

  var nonSpaceRe = /\S/;
  function isWhitespace(string) {
    return !testRegExp(nonSpaceRe, string);
  }

  var entityMap = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': '&quot;',
    "'": '&#39;',
    "/": '&#x2F;'
  };

  function escapeHtml(string) {
    return String(string).replace(/[&<>"'\/]/g, function (s) {
      return entityMap[s];
    });
  }

  var whiteRe = /\s*/;
  var spaceRe = /\s+/;
  var equalsRe = /\s*=/;
  var curlyRe = /\s*\}/;
  var tagRe = /#|\^|\/|>|\{|&|=|!/;

  /**
   * Breaks up the given `template` string into a tree of tokens. If the `tags`
   * argument is given here it must be an array with two string values: the
   * opening and closing tags used in the template (e.g. [ "<%", "%>" ]). Of
   * course, the default is to use mustaches (i.e. mustache.tags).
   *
   * A token is an array with at least 4 elements. The first element is the
   * mustache symbol that was used inside the tag, e.g. "#" or "&". If the tag
   * did not contain a symbol (i.e. {{myValue}}) this element is "name". For
   * all text that appears outside a symbol this element is "text".
   *
   * The second element of a token is its "value". For mustache tags this is
   * whatever else was inside the tag besides the opening symbol. For text tokens
   * this is the text itself.
   *
   * The third and fourth elements of the token are the start and end indices,
   * respectively, of the token in the original template.
   *
   * Tokens that are the root node of a subtree contain two more elements: 1) an
   * array of tokens in the subtree and 2) the index in the original template at
   * which the closing tag for that section begins.
   */
  function parseTemplate(template, tags) {
    if (!template)
      return [];

    var sections = [];     // Stack to hold section tokens
    var tokens = [];       // Buffer to hold the tokens
    var spaces = [];       // Indices of whitespace tokens on the current line
    var hasTag = false;    // Is there a {{tag}} on the current line?
    var nonSpace = false;  // Is there a non-space char on the current line?

    // Strips all whitespace tokens array for the current line
    // if there was a {{#tag}} on it and otherwise only space.
    function stripSpace() {
      if (hasTag && !nonSpace) {
        while (spaces.length)
          delete tokens[spaces.pop()];
      } else {
        spaces = [];
      }

      hasTag = false;
      nonSpace = false;
    }

    var openingTagRe, closingTagRe, closingCurlyRe;
    function compileTags(tags) {
      if (typeof tags === 'string')
        tags = tags.split(spaceRe, 2);

      if (!isArray(tags) || tags.length !== 2)
        throw new Error('Invalid tags: ' + tags);

      openingTagRe = new RegExp(escapeRegExp(tags[0]) + '\\s*');
      closingTagRe = new RegExp('\\s*' + escapeRegExp(tags[1]));
      closingCurlyRe = new RegExp('\\s*' + escapeRegExp('}' + tags[1]));
    }

    compileTags(tags || mustache.tags);

    var scanner = new Scanner(template);

    var start, type, value, chr, token, openSection;
    while (!scanner.eos()) {
      start = scanner.pos;

      // Match any text between tags.
      value = scanner.scanUntil(openingTagRe);

      if (value) {
        for (var i = 0, valueLength = value.length; i < valueLength; ++i) {
          chr = value.charAt(i);

          if (isWhitespace(chr)) {
            spaces.push(tokens.length);
          } else {
            nonSpace = true;
          }

          tokens.push([ 'text', chr, start, start + 1 ]);
          start += 1;

          // Check for whitespace on the current line.
          if (chr === '\n')
            stripSpace();
        }
      }

      // Match the opening tag.
      if (!scanner.scan(openingTagRe))
        break;

      hasTag = true;

      // Get the tag type.
      type = scanner.scan(tagRe) || 'name';
      scanner.scan(whiteRe);

      // Get the tag value.
      if (type === '=') {
        value = scanner.scanUntil(equalsRe);
        scanner.scan(equalsRe);
        scanner.scanUntil(closingTagRe);
      } else if (type === '{') {
        value = scanner.scanUntil(closingCurlyRe);
        scanner.scan(curlyRe);
        scanner.scanUntil(closingTagRe);
        type = '&';
      } else {
        value = scanner.scanUntil(closingTagRe);
      }

      // Match the closing tag.
      if (!scanner.scan(closingTagRe))
        throw new Error('Unclosed tag at ' + scanner.pos);

      token = [ type, value, start, scanner.pos ];
      tokens.push(token);

      if (type === '#' || type === '^') {
        sections.push(token);
      } else if (type === '/') {
        // Check section nesting.
        openSection = sections.pop();

        if (!openSection)
          throw new Error('Unopened section "' + value + '" at ' + start);

        if (openSection[1] !== value)
          throw new Error('Unclosed section "' + openSection[1] + '" at ' + start);
      } else if (type === 'name' || type === '{' || type === '&') {
        nonSpace = true;
      } else if (type === '=') {
        // Set the tags for the next time around.
        compileTags(value);
      }
    }

    // Make sure there are no open sections when we're done.
    openSection = sections.pop();

    if (openSection)
      throw new Error('Unclosed section "' + openSection[1] + '" at ' + scanner.pos);

    return nestTokens(squashTokens(tokens));
  }

  /**
   * Combines the values of consecutive text tokens in the given `tokens` array
   * to a single token.
   */
  function squashTokens(tokens) {
    var squashedTokens = [];

    var token, lastToken;
    for (var i = 0, numTokens = tokens.length; i < numTokens; ++i) {
      token = tokens[i];

      if (token) {
        if (token[0] === 'text' && lastToken && lastToken[0] === 'text') {
          lastToken[1] += token[1];
          lastToken[3] = token[3];
        } else {
          squashedTokens.push(token);
          lastToken = token;
        }
      }
    }

    return squashedTokens;
  }

  /**
   * Forms the given array of `tokens` into a nested tree structure where
   * tokens that represent a section have two additional items: 1) an array of
   * all tokens that appear in that section and 2) the index in the original
   * template that represents the end of that section.
   */
  function nestTokens(tokens) {
    var nestedTokens = [];
    var collector = nestedTokens;
    var sections = [];

    var token, section;
    for (var i = 0, numTokens = tokens.length; i < numTokens; ++i) {
      token = tokens[i];

      switch (token[0]) {
      case '#':
      case '^':
        collector.push(token);
        sections.push(token);
        collector = token[4] = [];
        break;
      case '/':
        section = sections.pop();
        section[5] = token[2];
        collector = sections.length > 0 ? sections[sections.length - 1][4] : nestedTokens;
        break;
      default:
        collector.push(token);
      }
    }

    return nestedTokens;
  }

  /**
   * A simple string scanner that is used by the template parser to find
   * tokens in template strings.
   */
  function Scanner(string) {
    this.string = string;
    this.tail = string;
    this.pos = 0;
  }

  /**
   * Returns `true` if the tail is empty (end of string).
   */
  Scanner.prototype.eos = function () {
    return this.tail === "";
  };

  /**
   * Tries to match the given regular expression at the current position.
   * Returns the matched text if it can match, the empty string otherwise.
   */
  Scanner.prototype.scan = function (re) {
    var match = this.tail.match(re);

    if (!match || match.index !== 0)
      return '';

    var string = match[0];

    this.tail = this.tail.substring(string.length);
    this.pos += string.length;

    return string;
  };

  /**
   * Skips all text until the given regular expression can be matched. Returns
   * the skipped string, which is the entire tail if no match can be made.
   */
  Scanner.prototype.scanUntil = function (re) {
    var index = this.tail.search(re), match;

    switch (index) {
    case -1:
      match = this.tail;
      this.tail = "";
      break;
    case 0:
      match = "";
      break;
    default:
      match = this.tail.substring(0, index);
      this.tail = this.tail.substring(index);
    }

    this.pos += match.length;

    return match;
  };

  /**
   * Represents a rendering context by wrapping a view object and
   * maintaining a reference to the parent context.
   */
  function Context(view, parentContext) {
    this.view = view == null ? {} : view;
    this.cache = { '.': this.view };
    this.parent = parentContext;
  }

  /**
   * Creates a new context using the given view with this context
   * as the parent.
   */
  Context.prototype.push = function (view) {
    return new Context(view, this);
  };

  /**
   * Returns the value of the given name in this context, traversing
   * up the context hierarchy if the value is absent in this context's view.
   */
  Context.prototype.lookup = function (name) {
    var cache = this.cache;

    var value;
    if (name in cache) {
      value = cache[name];
    } else {
      var context = this, names, index;

      while (context) {
        if (name.indexOf('.') > 0) {
          value = context.view;
          names = name.split('.');
          index = 0;

          while (value != null && index < names.length)
            value = value[names[index++]];
        } else if (typeof context.view == 'object') {
          value = context.view[name];
        }

        if (value != null)
          break;

        context = context.parent;
      }

      cache[name] = value;
    }

    if (isFunction(value))
      value = value.call(this.view);

    return value;
  };

  /**
   * A Writer knows how to take a stream of tokens and render them to a
   * string, given a context. It also maintains a cache of templates to
   * avoid the need to parse the same template twice.
   */
  function Writer() {
    this.cache = {};
  }

  /**
   * Clears all cached templates in this writer.
   */
  Writer.prototype.clearCache = function () {
    this.cache = {};
  };

  /**
   * Parses and caches the given `template` and returns the array of tokens
   * that is generated from the parse.
   */
  Writer.prototype.parse = function (template, tags) {
    var cache = this.cache;
    var tokens = cache[template];

    if (tokens == null)
      tokens = cache[template] = parseTemplate(template, tags);

    return tokens;
  };

  /**
   * High-level method that is used to render the given `template` with
   * the given `view`.
   *
   * The optional `partials` argument may be an object that contains the
   * names and templates of partials that are used in the template. It may
   * also be a function that is used to load partial templates on the fly
   * that takes a single argument: the name of the partial.
   */
  Writer.prototype.render = function (template, view, partials) {
    var tokens = this.parse(template);
    var context = (view instanceof Context) ? view : new Context(view);
    return this.renderTokens(tokens, context, partials, template);
  };

  /**
   * Low-level method that renders the given array of `tokens` using
   * the given `context` and `partials`.
   *
   * Note: The `originalTemplate` is only ever used to extract the portion
   * of the original template that was contained in a higher-order section.
   * If the template doesn't use higher-order sections, this argument may
   * be omitted.
   */
  Writer.prototype.renderTokens = function (tokens, context, partials, originalTemplate) {
    var buffer = '';

    // This function is used to render an arbitrary template
    // in the current context by higher-order sections.
    var self = this;
    function subRender(template) {
      return self.render(template, context, partials);
    }

    var token, value;
    for (var i = 0, numTokens = tokens.length; i < numTokens; ++i) {
      token = tokens[i];

      switch (token[0]) {
      case '#':
        value = context.lookup(token[1]);

        if (!value)
          continue;

        if (isArray(value)) {
          for (var j = 0, valueLength = value.length; j < valueLength; ++j) {
            buffer += this.renderTokens(token[4], context.push(value[j]), partials, originalTemplate);
          }
        } else if (typeof value === 'object' || typeof value === 'string') {
          buffer += this.renderTokens(token[4], context.push(value), partials, originalTemplate);
        } else if (isFunction(value)) {
          if (typeof originalTemplate !== 'string')
            throw new Error('Cannot use higher-order sections without the original template');

          // Extract the portion of the original template that the section contains.
          value = value.call(context.view, originalTemplate.slice(token[3], token[5]), subRender);

          if (value != null)
            buffer += value;
        } else {
          buffer += this.renderTokens(token[4], context, partials, originalTemplate);
        }

        break;
      case '^':
        value = context.lookup(token[1]);

        // Use JavaScript's definition of falsy. Include empty arrays.
        // See https://github.com/janl/mustache.js/issues/186
        if (!value || (isArray(value) && value.length === 0))
          buffer += this.renderTokens(token[4], context, partials, originalTemplate);

        break;
      case '>':
        if (!partials)
          continue;

        value = isFunction(partials) ? partials(token[1]) : partials[token[1]];

        if (value != null)
          buffer += this.renderTokens(this.parse(value), context, partials, value);

        break;
      case '&':
        value = context.lookup(token[1]);

        if (value != null)
          buffer += value;

        break;
      case 'name':
        value = context.lookup(token[1]);

        if (value != null)
          buffer += mustache.escape(value);

        break;
      case 'text':
        buffer += token[1];
        break;
      }
    }

    return buffer;
  };

  mustache.name = "mustache.js";
  mustache.version = "1.0.0";
  mustache.tags = [ "{{", "}}" ];

  // All high-level mustache.* functions use this writer.
  var defaultWriter = new Writer();

  /**
   * Clears all cached templates in the default writer.
   */
  mustache.clearCache = function () {
    return defaultWriter.clearCache();
  };

  /**
   * Parses and caches the given template in the default writer and returns the
   * array of tokens it contains. Doing this ahead of time avoids the need to
   * parse templates on the fly as they are rendered.
   */
  mustache.parse = function (template, tags) {
    return defaultWriter.parse(template, tags);
  };

  /**
   * Renders the `template` with the given `view` and `partials` using the
   * default writer.
   */
  mustache.render = function (template, view, partials) {
    return defaultWriter.render(template, view, partials);
  };

  // This is here for backwards compatibility with 0.4.x.
  mustache.to_html = function (template, view, partials, send) {
    var result = mustache.render(template, view, partials);

    if (isFunction(send)) {
      send(result);
    } else {
      return result;
    }
  };

  // Export the escaping function so that the user may override it.
  // See https://github.com/janl/mustache.js/issues/244
  mustache.escape = escapeHtml;

  // Export these mainly for testing, but also for advanced usage.
  mustache.Scanner = Scanner;
  mustache.Context = Context;
  mustache.Writer = Writer;

}));

},{}],"mustache":[function(require,module,exports){
module.exports=require('3pLyGF');
},{}],"underscore":[function(require,module,exports){
module.exports=require('ZKusGn');
},{}],"ZKusGn":[function(require,module,exports){
//     Underscore.js 1.7.0
//     http://underscorejs.org
//     (c) 2009-2014 Jeremy Ashkenas, DocumentCloud and Investigative Reporters & Editors
//     Underscore may be freely distributed under the MIT license.

(function() {

  // Baseline setup
  // --------------

  // Establish the root object, `window` in the browser, or `exports` on the server.
  var root = this;

  // Save the previous value of the `_` variable.
  var previousUnderscore = root._;

  // Save bytes in the minified (but not gzipped) version:
  var ArrayProto = Array.prototype, ObjProto = Object.prototype, FuncProto = Function.prototype;

  // Create quick reference variables for speed access to core prototypes.
  var
    push             = ArrayProto.push,
    slice            = ArrayProto.slice,
    concat           = ArrayProto.concat,
    toString         = ObjProto.toString,
    hasOwnProperty   = ObjProto.hasOwnProperty;

  // All **ECMAScript 5** native function implementations that we hope to use
  // are declared here.
  var
    nativeIsArray      = Array.isArray,
    nativeKeys         = Object.keys,
    nativeBind         = FuncProto.bind;

  // Create a safe reference to the Underscore object for use below.
  var _ = function(obj) {
    if (obj instanceof _) return obj;
    if (!(this instanceof _)) return new _(obj);
    this._wrapped = obj;
  };

  // Export the Underscore object for **Node.js**, with
  // backwards-compatibility for the old `require()` API. If we're in
  // the browser, add `_` as a global object.
  if (typeof exports !== 'undefined') {
    if (typeof module !== 'undefined' && module.exports) {
      exports = module.exports = _;
    }
    exports._ = _;
  } else {
    root._ = _;
  }

  // Current version.
  _.VERSION = '1.7.0';

  // Internal function that returns an efficient (for current engines) version
  // of the passed-in callback, to be repeatedly applied in other Underscore
  // functions.
  var createCallback = function(func, context, argCount) {
    if (context === void 0) return func;
    switch (argCount == null ? 3 : argCount) {
      case 1: return function(value) {
        return func.call(context, value);
      };
      case 2: return function(value, other) {
        return func.call(context, value, other);
      };
      case 3: return function(value, index, collection) {
        return func.call(context, value, index, collection);
      };
      case 4: return function(accumulator, value, index, collection) {
        return func.call(context, accumulator, value, index, collection);
      };
    }
    return function() {
      return func.apply(context, arguments);
    };
  };

  // A mostly-internal function to generate callbacks that can be applied
  // to each element in a collection, returning the desired result — either
  // identity, an arbitrary callback, a property matcher, or a property accessor.
  _.iteratee = function(value, context, argCount) {
    if (value == null) return _.identity;
    if (_.isFunction(value)) return createCallback(value, context, argCount);
    if (_.isObject(value)) return _.matches(value);
    return _.property(value);
  };

  // Collection Functions
  // --------------------

  // The cornerstone, an `each` implementation, aka `forEach`.
  // Handles raw objects in addition to array-likes. Treats all
  // sparse array-likes as if they were dense.
  _.each = _.forEach = function(obj, iteratee, context) {
    if (obj == null) return obj;
    iteratee = createCallback(iteratee, context);
    var i, length = obj.length;
    if (length === +length) {
      for (i = 0; i < length; i++) {
        iteratee(obj[i], i, obj);
      }
    } else {
      var keys = _.keys(obj);
      for (i = 0, length = keys.length; i < length; i++) {
        iteratee(obj[keys[i]], keys[i], obj);
      }
    }
    return obj;
  };

  // Return the results of applying the iteratee to each element.
  _.map = _.collect = function(obj, iteratee, context) {
    if (obj == null) return [];
    iteratee = _.iteratee(iteratee, context);
    var keys = obj.length !== +obj.length && _.keys(obj),
        length = (keys || obj).length,
        results = Array(length),
        currentKey;
    for (var index = 0; index < length; index++) {
      currentKey = keys ? keys[index] : index;
      results[index] = iteratee(obj[currentKey], currentKey, obj);
    }
    return results;
  };

  var reduceError = 'Reduce of empty array with no initial value';

  // **Reduce** builds up a single result from a list of values, aka `inject`,
  // or `foldl`.
  _.reduce = _.foldl = _.inject = function(obj, iteratee, memo, context) {
    if (obj == null) obj = [];
    iteratee = createCallback(iteratee, context, 4);
    var keys = obj.length !== +obj.length && _.keys(obj),
        length = (keys || obj).length,
        index = 0, currentKey;
    if (arguments.length < 3) {
      if (!length) throw new TypeError(reduceError);
      memo = obj[keys ? keys[index++] : index++];
    }
    for (; index < length; index++) {
      currentKey = keys ? keys[index] : index;
      memo = iteratee(memo, obj[currentKey], currentKey, obj);
    }
    return memo;
  };

  // The right-associative version of reduce, also known as `foldr`.
  _.reduceRight = _.foldr = function(obj, iteratee, memo, context) {
    if (obj == null) obj = [];
    iteratee = createCallback(iteratee, context, 4);
    var keys = obj.length !== + obj.length && _.keys(obj),
        index = (keys || obj).length,
        currentKey;
    if (arguments.length < 3) {
      if (!index) throw new TypeError(reduceError);
      memo = obj[keys ? keys[--index] : --index];
    }
    while (index--) {
      currentKey = keys ? keys[index] : index;
      memo = iteratee(memo, obj[currentKey], currentKey, obj);
    }
    return memo;
  };

  // Return the first value which passes a truth test. Aliased as `detect`.
  _.find = _.detect = function(obj, predicate, context) {
    var result;
    predicate = _.iteratee(predicate, context);
    _.some(obj, function(value, index, list) {
      if (predicate(value, index, list)) {
        result = value;
        return true;
      }
    });
    return result;
  };

  // Return all the elements that pass a truth test.
  // Aliased as `select`.
  _.filter = _.select = function(obj, predicate, context) {
    var results = [];
    if (obj == null) return results;
    predicate = _.iteratee(predicate, context);
    _.each(obj, function(value, index, list) {
      if (predicate(value, index, list)) results.push(value);
    });
    return results;
  };

  // Return all the elements for which a truth test fails.
  _.reject = function(obj, predicate, context) {
    return _.filter(obj, _.negate(_.iteratee(predicate)), context);
  };

  // Determine whether all of the elements match a truth test.
  // Aliased as `all`.
  _.every = _.all = function(obj, predicate, context) {
    if (obj == null) return true;
    predicate = _.iteratee(predicate, context);
    var keys = obj.length !== +obj.length && _.keys(obj),
        length = (keys || obj).length,
        index, currentKey;
    for (index = 0; index < length; index++) {
      currentKey = keys ? keys[index] : index;
      if (!predicate(obj[currentKey], currentKey, obj)) return false;
    }
    return true;
  };

  // Determine if at least one element in the object matches a truth test.
  // Aliased as `any`.
  _.some = _.any = function(obj, predicate, context) {
    if (obj == null) return false;
    predicate = _.iteratee(predicate, context);
    var keys = obj.length !== +obj.length && _.keys(obj),
        length = (keys || obj).length,
        index, currentKey;
    for (index = 0; index < length; index++) {
      currentKey = keys ? keys[index] : index;
      if (predicate(obj[currentKey], currentKey, obj)) return true;
    }
    return false;
  };

  // Determine if the array or object contains a given value (using `===`).
  // Aliased as `include`.
  _.contains = _.include = function(obj, target) {
    if (obj == null) return false;
    if (obj.length !== +obj.length) obj = _.values(obj);
    return _.indexOf(obj, target) >= 0;
  };

  // Invoke a method (with arguments) on every item in a collection.
  _.invoke = function(obj, method) {
    var args = slice.call(arguments, 2);
    var isFunc = _.isFunction(method);
    return _.map(obj, function(value) {
      return (isFunc ? method : value[method]).apply(value, args);
    });
  };

  // Convenience version of a common use case of `map`: fetching a property.
  _.pluck = function(obj, key) {
    return _.map(obj, _.property(key));
  };

  // Convenience version of a common use case of `filter`: selecting only objects
  // containing specific `key:value` pairs.
  _.where = function(obj, attrs) {
    return _.filter(obj, _.matches(attrs));
  };

  // Convenience version of a common use case of `find`: getting the first object
  // containing specific `key:value` pairs.
  _.findWhere = function(obj, attrs) {
    return _.find(obj, _.matches(attrs));
  };

  // Return the maximum element (or element-based computation).
  _.max = function(obj, iteratee, context) {
    var result = -Infinity, lastComputed = -Infinity,
        value, computed;
    if (iteratee == null && obj != null) {
      obj = obj.length === +obj.length ? obj : _.values(obj);
      for (var i = 0, length = obj.length; i < length; i++) {
        value = obj[i];
        if (value > result) {
          result = value;
        }
      }
    } else {
      iteratee = _.iteratee(iteratee, context);
      _.each(obj, function(value, index, list) {
        computed = iteratee(value, index, list);
        if (computed > lastComputed || computed === -Infinity && result === -Infinity) {
          result = value;
          lastComputed = computed;
        }
      });
    }
    return result;
  };

  // Return the minimum element (or element-based computation).
  _.min = function(obj, iteratee, context) {
    var result = Infinity, lastComputed = Infinity,
        value, computed;
    if (iteratee == null && obj != null) {
      obj = obj.length === +obj.length ? obj : _.values(obj);
      for (var i = 0, length = obj.length; i < length; i++) {
        value = obj[i];
        if (value < result) {
          result = value;
        }
      }
    } else {
      iteratee = _.iteratee(iteratee, context);
      _.each(obj, function(value, index, list) {
        computed = iteratee(value, index, list);
        if (computed < lastComputed || computed === Infinity && result === Infinity) {
          result = value;
          lastComputed = computed;
        }
      });
    }
    return result;
  };

  // Shuffle a collection, using the modern version of the
  // [Fisher-Yates shuffle](http://en.wikipedia.org/wiki/Fisher–Yates_shuffle).
  _.shuffle = function(obj) {
    var set = obj && obj.length === +obj.length ? obj : _.values(obj);
    var length = set.length;
    var shuffled = Array(length);
    for (var index = 0, rand; index < length; index++) {
      rand = _.random(0, index);
      if (rand !== index) shuffled[index] = shuffled[rand];
      shuffled[rand] = set[index];
    }
    return shuffled;
  };

  // Sample **n** random values from a collection.
  // If **n** is not specified, returns a single random element.
  // The internal `guard` argument allows it to work with `map`.
  _.sample = function(obj, n, guard) {
    if (n == null || guard) {
      if (obj.length !== +obj.length) obj = _.values(obj);
      return obj[_.random(obj.length - 1)];
    }
    return _.shuffle(obj).slice(0, Math.max(0, n));
  };

  // Sort the object's values by a criterion produced by an iteratee.
  _.sortBy = function(obj, iteratee, context) {
    iteratee = _.iteratee(iteratee, context);
    return _.pluck(_.map(obj, function(value, index, list) {
      return {
        value: value,
        index: index,
        criteria: iteratee(value, index, list)
      };
    }).sort(function(left, right) {
      var a = left.criteria;
      var b = right.criteria;
      if (a !== b) {
        if (a > b || a === void 0) return 1;
        if (a < b || b === void 0) return -1;
      }
      return left.index - right.index;
    }), 'value');
  };

  // An internal function used for aggregate "group by" operations.
  var group = function(behavior) {
    return function(obj, iteratee, context) {
      var result = {};
      iteratee = _.iteratee(iteratee, context);
      _.each(obj, function(value, index) {
        var key = iteratee(value, index, obj);
        behavior(result, value, key);
      });
      return result;
    };
  };

  // Groups the object's values by a criterion. Pass either a string attribute
  // to group by, or a function that returns the criterion.
  _.groupBy = group(function(result, value, key) {
    if (_.has(result, key)) result[key].push(value); else result[key] = [value];
  });

  // Indexes the object's values by a criterion, similar to `groupBy`, but for
  // when you know that your index values will be unique.
  _.indexBy = group(function(result, value, key) {
    result[key] = value;
  });

  // Counts instances of an object that group by a certain criterion. Pass
  // either a string attribute to count by, or a function that returns the
  // criterion.
  _.countBy = group(function(result, value, key) {
    if (_.has(result, key)) result[key]++; else result[key] = 1;
  });

  // Use a comparator function to figure out the smallest index at which
  // an object should be inserted so as to maintain order. Uses binary search.
  _.sortedIndex = function(array, obj, iteratee, context) {
    iteratee = _.iteratee(iteratee, context, 1);
    var value = iteratee(obj);
    var low = 0, high = array.length;
    while (low < high) {
      var mid = low + high >>> 1;
      if (iteratee(array[mid]) < value) low = mid + 1; else high = mid;
    }
    return low;
  };

  // Safely create a real, live array from anything iterable.
  _.toArray = function(obj) {
    if (!obj) return [];
    if (_.isArray(obj)) return slice.call(obj);
    if (obj.length === +obj.length) return _.map(obj, _.identity);
    return _.values(obj);
  };

  // Return the number of elements in an object.
  _.size = function(obj) {
    if (obj == null) return 0;
    return obj.length === +obj.length ? obj.length : _.keys(obj).length;
  };

  // Split a collection into two arrays: one whose elements all satisfy the given
  // predicate, and one whose elements all do not satisfy the predicate.
  _.partition = function(obj, predicate, context) {
    predicate = _.iteratee(predicate, context);
    var pass = [], fail = [];
    _.each(obj, function(value, key, obj) {
      (predicate(value, key, obj) ? pass : fail).push(value);
    });
    return [pass, fail];
  };

  // Array Functions
  // ---------------

  // Get the first element of an array. Passing **n** will return the first N
  // values in the array. Aliased as `head` and `take`. The **guard** check
  // allows it to work with `_.map`.
  _.first = _.head = _.take = function(array, n, guard) {
    if (array == null) return void 0;
    if (n == null || guard) return array[0];
    if (n < 0) return [];
    return slice.call(array, 0, n);
  };

  // Returns everything but the last entry of the array. Especially useful on
  // the arguments object. Passing **n** will return all the values in
  // the array, excluding the last N. The **guard** check allows it to work with
  // `_.map`.
  _.initial = function(array, n, guard) {
    return slice.call(array, 0, Math.max(0, array.length - (n == null || guard ? 1 : n)));
  };

  // Get the last element of an array. Passing **n** will return the last N
  // values in the array. The **guard** check allows it to work with `_.map`.
  _.last = function(array, n, guard) {
    if (array == null) return void 0;
    if (n == null || guard) return array[array.length - 1];
    return slice.call(array, Math.max(array.length - n, 0));
  };

  // Returns everything but the first entry of the array. Aliased as `tail` and `drop`.
  // Especially useful on the arguments object. Passing an **n** will return
  // the rest N values in the array. The **guard**
  // check allows it to work with `_.map`.
  _.rest = _.tail = _.drop = function(array, n, guard) {
    return slice.call(array, n == null || guard ? 1 : n);
  };

  // Trim out all falsy values from an array.
  _.compact = function(array) {
    return _.filter(array, _.identity);
  };

  // Internal implementation of a recursive `flatten` function.
  var flatten = function(input, shallow, strict, output) {
    if (shallow && _.every(input, _.isArray)) {
      return concat.apply(output, input);
    }
    for (var i = 0, length = input.length; i < length; i++) {
      var value = input[i];
      if (!_.isArray(value) && !_.isArguments(value)) {
        if (!strict) output.push(value);
      } else if (shallow) {
        push.apply(output, value);
      } else {
        flatten(value, shallow, strict, output);
      }
    }
    return output;
  };

  // Flatten out an array, either recursively (by default), or just one level.
  _.flatten = function(array, shallow) {
    return flatten(array, shallow, false, []);
  };

  // Return a version of the array that does not contain the specified value(s).
  _.without = function(array) {
    return _.difference(array, slice.call(arguments, 1));
  };

  // Produce a duplicate-free version of the array. If the array has already
  // been sorted, you have the option of using a faster algorithm.
  // Aliased as `unique`.
  _.uniq = _.unique = function(array, isSorted, iteratee, context) {
    if (array == null) return [];
    if (!_.isBoolean(isSorted)) {
      context = iteratee;
      iteratee = isSorted;
      isSorted = false;
    }
    if (iteratee != null) iteratee = _.iteratee(iteratee, context);
    var result = [];
    var seen = [];
    for (var i = 0, length = array.length; i < length; i++) {
      var value = array[i];
      if (isSorted) {
        if (!i || seen !== value) result.push(value);
        seen = value;
      } else if (iteratee) {
        var computed = iteratee(value, i, array);
        if (_.indexOf(seen, computed) < 0) {
          seen.push(computed);
          result.push(value);
        }
      } else if (_.indexOf(result, value) < 0) {
        result.push(value);
      }
    }
    return result;
  };

  // Produce an array that contains the union: each distinct element from all of
  // the passed-in arrays.
  _.union = function() {
    return _.uniq(flatten(arguments, true, true, []));
  };

  // Produce an array that contains every item shared between all the
  // passed-in arrays.
  _.intersection = function(array) {
    if (array == null) return [];
    var result = [];
    var argsLength = arguments.length;
    for (var i = 0, length = array.length; i < length; i++) {
      var item = array[i];
      if (_.contains(result, item)) continue;
      for (var j = 1; j < argsLength; j++) {
        if (!_.contains(arguments[j], item)) break;
      }
      if (j === argsLength) result.push(item);
    }
    return result;
  };

  // Take the difference between one array and a number of other arrays.
  // Only the elements present in just the first array will remain.
  _.difference = function(array) {
    var rest = flatten(slice.call(arguments, 1), true, true, []);
    return _.filter(array, function(value){
      return !_.contains(rest, value);
    });
  };

  // Zip together multiple lists into a single array -- elements that share
  // an index go together.
  _.zip = function(array) {
    if (array == null) return [];
    var length = _.max(arguments, 'length').length;
    var results = Array(length);
    for (var i = 0; i < length; i++) {
      results[i] = _.pluck(arguments, i);
    }
    return results;
  };

  // Converts lists into objects. Pass either a single array of `[key, value]`
  // pairs, or two parallel arrays of the same length -- one of keys, and one of
  // the corresponding values.
  _.object = function(list, values) {
    if (list == null) return {};
    var result = {};
    for (var i = 0, length = list.length; i < length; i++) {
      if (values) {
        result[list[i]] = values[i];
      } else {
        result[list[i][0]] = list[i][1];
      }
    }
    return result;
  };

  // Return the position of the first occurrence of an item in an array,
  // or -1 if the item is not included in the array.
  // If the array is large and already in sort order, pass `true`
  // for **isSorted** to use binary search.
  _.indexOf = function(array, item, isSorted) {
    if (array == null) return -1;
    var i = 0, length = array.length;
    if (isSorted) {
      if (typeof isSorted == 'number') {
        i = isSorted < 0 ? Math.max(0, length + isSorted) : isSorted;
      } else {
        i = _.sortedIndex(array, item);
        return array[i] === item ? i : -1;
      }
    }
    for (; i < length; i++) if (array[i] === item) return i;
    return -1;
  };

  _.lastIndexOf = function(array, item, from) {
    if (array == null) return -1;
    var idx = array.length;
    if (typeof from == 'number') {
      idx = from < 0 ? idx + from + 1 : Math.min(idx, from + 1);
    }
    while (--idx >= 0) if (array[idx] === item) return idx;
    return -1;
  };

  // Generate an integer Array containing an arithmetic progression. A port of
  // the native Python `range()` function. See
  // [the Python documentation](http://docs.python.org/library/functions.html#range).
  _.range = function(start, stop, step) {
    if (arguments.length <= 1) {
      stop = start || 0;
      start = 0;
    }
    step = step || 1;

    var length = Math.max(Math.ceil((stop - start) / step), 0);
    var range = Array(length);

    for (var idx = 0; idx < length; idx++, start += step) {
      range[idx] = start;
    }

    return range;
  };

  // Function (ahem) Functions
  // ------------------

  // Reusable constructor function for prototype setting.
  var Ctor = function(){};

  // Create a function bound to a given object (assigning `this`, and arguments,
  // optionally). Delegates to **ECMAScript 5**'s native `Function.bind` if
  // available.
  _.bind = function(func, context) {
    var args, bound;
    if (nativeBind && func.bind === nativeBind) return nativeBind.apply(func, slice.call(arguments, 1));
    if (!_.isFunction(func)) throw new TypeError('Bind must be called on a function');
    args = slice.call(arguments, 2);
    bound = function() {
      if (!(this instanceof bound)) return func.apply(context, args.concat(slice.call(arguments)));
      Ctor.prototype = func.prototype;
      var self = new Ctor;
      Ctor.prototype = null;
      var result = func.apply(self, args.concat(slice.call(arguments)));
      if (_.isObject(result)) return result;
      return self;
    };
    return bound;
  };

  // Partially apply a function by creating a version that has had some of its
  // arguments pre-filled, without changing its dynamic `this` context. _ acts
  // as a placeholder, allowing any combination of arguments to be pre-filled.
  _.partial = function(func) {
    var boundArgs = slice.call(arguments, 1);
    return function() {
      var position = 0;
      var args = boundArgs.slice();
      for (var i = 0, length = args.length; i < length; i++) {
        if (args[i] === _) args[i] = arguments[position++];
      }
      while (position < arguments.length) args.push(arguments[position++]);
      return func.apply(this, args);
    };
  };

  // Bind a number of an object's methods to that object. Remaining arguments
  // are the method names to be bound. Useful for ensuring that all callbacks
  // defined on an object belong to it.
  _.bindAll = function(obj) {
    var i, length = arguments.length, key;
    if (length <= 1) throw new Error('bindAll must be passed function names');
    for (i = 1; i < length; i++) {
      key = arguments[i];
      obj[key] = _.bind(obj[key], obj);
    }
    return obj;
  };

  // Memoize an expensive function by storing its results.
  _.memoize = function(func, hasher) {
    var memoize = function(key) {
      var cache = memoize.cache;
      var address = hasher ? hasher.apply(this, arguments) : key;
      if (!_.has(cache, address)) cache[address] = func.apply(this, arguments);
      return cache[address];
    };
    memoize.cache = {};
    return memoize;
  };

  // Delays a function for the given number of milliseconds, and then calls
  // it with the arguments supplied.
  _.delay = function(func, wait) {
    var args = slice.call(arguments, 2);
    return setTimeout(function(){
      return func.apply(null, args);
    }, wait);
  };

  // Defers a function, scheduling it to run after the current call stack has
  // cleared.
  _.defer = function(func) {
    return _.delay.apply(_, [func, 1].concat(slice.call(arguments, 1)));
  };

  // Returns a function, that, when invoked, will only be triggered at most once
  // during a given window of time. Normally, the throttled function will run
  // as much as it can, without ever going more than once per `wait` duration;
  // but if you'd like to disable the execution on the leading edge, pass
  // `{leading: false}`. To disable execution on the trailing edge, ditto.
  _.throttle = function(func, wait, options) {
    var context, args, result;
    var timeout = null;
    var previous = 0;
    if (!options) options = {};
    var later = function() {
      previous = options.leading === false ? 0 : _.now();
      timeout = null;
      result = func.apply(context, args);
      if (!timeout) context = args = null;
    };
    return function() {
      var now = _.now();
      if (!previous && options.leading === false) previous = now;
      var remaining = wait - (now - previous);
      context = this;
      args = arguments;
      if (remaining <= 0 || remaining > wait) {
        clearTimeout(timeout);
        timeout = null;
        previous = now;
        result = func.apply(context, args);
        if (!timeout) context = args = null;
      } else if (!timeout && options.trailing !== false) {
        timeout = setTimeout(later, remaining);
      }
      return result;
    };
  };

  // Returns a function, that, as long as it continues to be invoked, will not
  // be triggered. The function will be called after it stops being called for
  // N milliseconds. If `immediate` is passed, trigger the function on the
  // leading edge, instead of the trailing.
  _.debounce = function(func, wait, immediate) {
    var timeout, args, context, timestamp, result;

    var later = function() {
      var last = _.now() - timestamp;

      if (last < wait && last > 0) {
        timeout = setTimeout(later, wait - last);
      } else {
        timeout = null;
        if (!immediate) {
          result = func.apply(context, args);
          if (!timeout) context = args = null;
        }
      }
    };

    return function() {
      context = this;
      args = arguments;
      timestamp = _.now();
      var callNow = immediate && !timeout;
      if (!timeout) timeout = setTimeout(later, wait);
      if (callNow) {
        result = func.apply(context, args);
        context = args = null;
      }

      return result;
    };
  };

  // Returns the first function passed as an argument to the second,
  // allowing you to adjust arguments, run code before and after, and
  // conditionally execute the original function.
  _.wrap = function(func, wrapper) {
    return _.partial(wrapper, func);
  };

  // Returns a negated version of the passed-in predicate.
  _.negate = function(predicate) {
    return function() {
      return !predicate.apply(this, arguments);
    };
  };

  // Returns a function that is the composition of a list of functions, each
  // consuming the return value of the function that follows.
  _.compose = function() {
    var args = arguments;
    var start = args.length - 1;
    return function() {
      var i = start;
      var result = args[start].apply(this, arguments);
      while (i--) result = args[i].call(this, result);
      return result;
    };
  };

  // Returns a function that will only be executed after being called N times.
  _.after = function(times, func) {
    return function() {
      if (--times < 1) {
        return func.apply(this, arguments);
      }
    };
  };

  // Returns a function that will only be executed before being called N times.
  _.before = function(times, func) {
    var memo;
    return function() {
      if (--times > 0) {
        memo = func.apply(this, arguments);
      } else {
        func = null;
      }
      return memo;
    };
  };

  // Returns a function that will be executed at most one time, no matter how
  // often you call it. Useful for lazy initialization.
  _.once = _.partial(_.before, 2);

  // Object Functions
  // ----------------

  // Retrieve the names of an object's properties.
  // Delegates to **ECMAScript 5**'s native `Object.keys`
  _.keys = function(obj) {
    if (!_.isObject(obj)) return [];
    if (nativeKeys) return nativeKeys(obj);
    var keys = [];
    for (var key in obj) if (_.has(obj, key)) keys.push(key);
    return keys;
  };

  // Retrieve the values of an object's properties.
  _.values = function(obj) {
    var keys = _.keys(obj);
    var length = keys.length;
    var values = Array(length);
    for (var i = 0; i < length; i++) {
      values[i] = obj[keys[i]];
    }
    return values;
  };

  // Convert an object into a list of `[key, value]` pairs.
  _.pairs = function(obj) {
    var keys = _.keys(obj);
    var length = keys.length;
    var pairs = Array(length);
    for (var i = 0; i < length; i++) {
      pairs[i] = [keys[i], obj[keys[i]]];
    }
    return pairs;
  };

  // Invert the keys and values of an object. The values must be serializable.
  _.invert = function(obj) {
    var result = {};
    var keys = _.keys(obj);
    for (var i = 0, length = keys.length; i < length; i++) {
      result[obj[keys[i]]] = keys[i];
    }
    return result;
  };

  // Return a sorted list of the function names available on the object.
  // Aliased as `methods`
  _.functions = _.methods = function(obj) {
    var names = [];
    for (var key in obj) {
      if (_.isFunction(obj[key])) names.push(key);
    }
    return names.sort();
  };

  // Extend a given object with all the properties in passed-in object(s).
  _.extend = function(obj) {
    if (!_.isObject(obj)) return obj;
    var source, prop;
    for (var i = 1, length = arguments.length; i < length; i++) {
      source = arguments[i];
      for (prop in source) {
        if (hasOwnProperty.call(source, prop)) {
            obj[prop] = source[prop];
        }
      }
    }
    return obj;
  };

  // Return a copy of the object only containing the whitelisted properties.
  _.pick = function(obj, iteratee, context) {
    var result = {}, key;
    if (obj == null) return result;
    if (_.isFunction(iteratee)) {
      iteratee = createCallback(iteratee, context);
      for (key in obj) {
        var value = obj[key];
        if (iteratee(value, key, obj)) result[key] = value;
      }
    } else {
      var keys = concat.apply([], slice.call(arguments, 1));
      obj = new Object(obj);
      for (var i = 0, length = keys.length; i < length; i++) {
        key = keys[i];
        if (key in obj) result[key] = obj[key];
      }
    }
    return result;
  };

   // Return a copy of the object without the blacklisted properties.
  _.omit = function(obj, iteratee, context) {
    if (_.isFunction(iteratee)) {
      iteratee = _.negate(iteratee);
    } else {
      var keys = _.map(concat.apply([], slice.call(arguments, 1)), String);
      iteratee = function(value, key) {
        return !_.contains(keys, key);
      };
    }
    return _.pick(obj, iteratee, context);
  };

  // Fill in a given object with default properties.
  _.defaults = function(obj) {
    if (!_.isObject(obj)) return obj;
    for (var i = 1, length = arguments.length; i < length; i++) {
      var source = arguments[i];
      for (var prop in source) {
        if (obj[prop] === void 0) obj[prop] = source[prop];
      }
    }
    return obj;
  };

  // Create a (shallow-cloned) duplicate of an object.
  _.clone = function(obj) {
    if (!_.isObject(obj)) return obj;
    return _.isArray(obj) ? obj.slice() : _.extend({}, obj);
  };

  // Invokes interceptor with the obj, and then returns obj.
  // The primary purpose of this method is to "tap into" a method chain, in
  // order to perform operations on intermediate results within the chain.
  _.tap = function(obj, interceptor) {
    interceptor(obj);
    return obj;
  };

  // Internal recursive comparison function for `isEqual`.
  var eq = function(a, b, aStack, bStack) {
    // Identical objects are equal. `0 === -0`, but they aren't identical.
    // See the [Harmony `egal` proposal](http://wiki.ecmascript.org/doku.php?id=harmony:egal).
    if (a === b) return a !== 0 || 1 / a === 1 / b;
    // A strict comparison is necessary because `null == undefined`.
    if (a == null || b == null) return a === b;
    // Unwrap any wrapped objects.
    if (a instanceof _) a = a._wrapped;
    if (b instanceof _) b = b._wrapped;
    // Compare `[[Class]]` names.
    var className = toString.call(a);
    if (className !== toString.call(b)) return false;
    switch (className) {
      // Strings, numbers, regular expressions, dates, and booleans are compared by value.
      case '[object RegExp]':
      // RegExps are coerced to strings for comparison (Note: '' + /a/i === '/a/i')
      case '[object String]':
        // Primitives and their corresponding object wrappers are equivalent; thus, `"5"` is
        // equivalent to `new String("5")`.
        return '' + a === '' + b;
      case '[object Number]':
        // `NaN`s are equivalent, but non-reflexive.
        // Object(NaN) is equivalent to NaN
        if (+a !== +a) return +b !== +b;
        // An `egal` comparison is performed for other numeric values.
        return +a === 0 ? 1 / +a === 1 / b : +a === +b;
      case '[object Date]':
      case '[object Boolean]':
        // Coerce dates and booleans to numeric primitive values. Dates are compared by their
        // millisecond representations. Note that invalid dates with millisecond representations
        // of `NaN` are not equivalent.
        return +a === +b;
    }
    if (typeof a != 'object' || typeof b != 'object') return false;
    // Assume equality for cyclic structures. The algorithm for detecting cyclic
    // structures is adapted from ES 5.1 section 15.12.3, abstract operation `JO`.
    var length = aStack.length;
    while (length--) {
      // Linear search. Performance is inversely proportional to the number of
      // unique nested structures.
      if (aStack[length] === a) return bStack[length] === b;
    }
    // Objects with different constructors are not equivalent, but `Object`s
    // from different frames are.
    var aCtor = a.constructor, bCtor = b.constructor;
    if (
      aCtor !== bCtor &&
      // Handle Object.create(x) cases
      'constructor' in a && 'constructor' in b &&
      !(_.isFunction(aCtor) && aCtor instanceof aCtor &&
        _.isFunction(bCtor) && bCtor instanceof bCtor)
    ) {
      return false;
    }
    // Add the first object to the stack of traversed objects.
    aStack.push(a);
    bStack.push(b);
    var size, result;
    // Recursively compare objects and arrays.
    if (className === '[object Array]') {
      // Compare array lengths to determine if a deep comparison is necessary.
      size = a.length;
      result = size === b.length;
      if (result) {
        // Deep compare the contents, ignoring non-numeric properties.
        while (size--) {
          if (!(result = eq(a[size], b[size], aStack, bStack))) break;
        }
      }
    } else {
      // Deep compare objects.
      var keys = _.keys(a), key;
      size = keys.length;
      // Ensure that both objects contain the same number of properties before comparing deep equality.
      result = _.keys(b).length === size;
      if (result) {
        while (size--) {
          // Deep compare each member
          key = keys[size];
          if (!(result = _.has(b, key) && eq(a[key], b[key], aStack, bStack))) break;
        }
      }
    }
    // Remove the first object from the stack of traversed objects.
    aStack.pop();
    bStack.pop();
    return result;
  };

  // Perform a deep comparison to check if two objects are equal.
  _.isEqual = function(a, b) {
    return eq(a, b, [], []);
  };

  // Is a given array, string, or object empty?
  // An "empty" object has no enumerable own-properties.
  _.isEmpty = function(obj) {
    if (obj == null) return true;
    if (_.isArray(obj) || _.isString(obj) || _.isArguments(obj)) return obj.length === 0;
    for (var key in obj) if (_.has(obj, key)) return false;
    return true;
  };

  // Is a given value a DOM element?
  _.isElement = function(obj) {
    return !!(obj && obj.nodeType === 1);
  };

  // Is a given value an array?
  // Delegates to ECMA5's native Array.isArray
  _.isArray = nativeIsArray || function(obj) {
    return toString.call(obj) === '[object Array]';
  };

  // Is a given variable an object?
  _.isObject = function(obj) {
    var type = typeof obj;
    return type === 'function' || type === 'object' && !!obj;
  };

  // Add some isType methods: isArguments, isFunction, isString, isNumber, isDate, isRegExp.
  _.each(['Arguments', 'Function', 'String', 'Number', 'Date', 'RegExp'], function(name) {
    _['is' + name] = function(obj) {
      return toString.call(obj) === '[object ' + name + ']';
    };
  });

  // Define a fallback version of the method in browsers (ahem, IE), where
  // there isn't any inspectable "Arguments" type.
  if (!_.isArguments(arguments)) {
    _.isArguments = function(obj) {
      return _.has(obj, 'callee');
    };
  }

  // Optimize `isFunction` if appropriate. Work around an IE 11 bug.
  if (typeof /./ !== 'function') {
    _.isFunction = function(obj) {
      return typeof obj == 'function' || false;
    };
  }

  // Is a given object a finite number?
  _.isFinite = function(obj) {
    return isFinite(obj) && !isNaN(parseFloat(obj));
  };

  // Is the given value `NaN`? (NaN is the only number which does not equal itself).
  _.isNaN = function(obj) {
    return _.isNumber(obj) && obj !== +obj;
  };

  // Is a given value a boolean?
  _.isBoolean = function(obj) {
    return obj === true || obj === false || toString.call(obj) === '[object Boolean]';
  };

  // Is a given value equal to null?
  _.isNull = function(obj) {
    return obj === null;
  };

  // Is a given variable undefined?
  _.isUndefined = function(obj) {
    return obj === void 0;
  };

  // Shortcut function for checking if an object has a given property directly
  // on itself (in other words, not on a prototype).
  _.has = function(obj, key) {
    return obj != null && hasOwnProperty.call(obj, key);
  };

  // Utility Functions
  // -----------------

  // Run Underscore.js in *noConflict* mode, returning the `_` variable to its
  // previous owner. Returns a reference to the Underscore object.
  _.noConflict = function() {
    root._ = previousUnderscore;
    return this;
  };

  // Keep the identity function around for default iteratees.
  _.identity = function(value) {
    return value;
  };

  _.constant = function(value) {
    return function() {
      return value;
    };
  };

  _.noop = function(){};

  _.property = function(key) {
    return function(obj) {
      return obj[key];
    };
  };

  // Returns a predicate for checking whether an object has a given set of `key:value` pairs.
  _.matches = function(attrs) {
    var pairs = _.pairs(attrs), length = pairs.length;
    return function(obj) {
      if (obj == null) return !length;
      obj = new Object(obj);
      for (var i = 0; i < length; i++) {
        var pair = pairs[i], key = pair[0];
        if (pair[1] !== obj[key] || !(key in obj)) return false;
      }
      return true;
    };
  };

  // Run a function **n** times.
  _.times = function(n, iteratee, context) {
    var accum = Array(Math.max(0, n));
    iteratee = createCallback(iteratee, context, 1);
    for (var i = 0; i < n; i++) accum[i] = iteratee(i);
    return accum;
  };

  // Return a random integer between min and max (inclusive).
  _.random = function(min, max) {
    if (max == null) {
      max = min;
      min = 0;
    }
    return min + Math.floor(Math.random() * (max - min + 1));
  };

  // A (possibly faster) way to get the current timestamp as an integer.
  _.now = Date.now || function() {
    return new Date().getTime();
  };

   // List of HTML entities for escaping.
  var escapeMap = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#x27;',
    '`': '&#x60;'
  };
  var unescapeMap = _.invert(escapeMap);

  // Functions for escaping and unescaping strings to/from HTML interpolation.
  var createEscaper = function(map) {
    var escaper = function(match) {
      return map[match];
    };
    // Regexes for identifying a key that needs to be escaped
    var source = '(?:' + _.keys(map).join('|') + ')';
    var testRegexp = RegExp(source);
    var replaceRegexp = RegExp(source, 'g');
    return function(string) {
      string = string == null ? '' : '' + string;
      return testRegexp.test(string) ? string.replace(replaceRegexp, escaper) : string;
    };
  };
  _.escape = createEscaper(escapeMap);
  _.unescape = createEscaper(unescapeMap);

  // If the value of the named `property` is a function then invoke it with the
  // `object` as context; otherwise, return it.
  _.result = function(object, property) {
    if (object == null) return void 0;
    var value = object[property];
    return _.isFunction(value) ? object[property]() : value;
  };

  // Generate a unique integer id (unique within the entire client session).
  // Useful for temporary DOM ids.
  var idCounter = 0;
  _.uniqueId = function(prefix) {
    var id = ++idCounter + '';
    return prefix ? prefix + id : id;
  };

  // By default, Underscore uses ERB-style template delimiters, change the
  // following template settings to use alternative delimiters.
  _.templateSettings = {
    evaluate    : /<%([\s\S]+?)%>/g,
    interpolate : /<%=([\s\S]+?)%>/g,
    escape      : /<%-([\s\S]+?)%>/g
  };

  // When customizing `templateSettings`, if you don't want to define an
  // interpolation, evaluation or escaping regex, we need one that is
  // guaranteed not to match.
  var noMatch = /(.)^/;

  // Certain characters need to be escaped so that they can be put into a
  // string literal.
  var escapes = {
    "'":      "'",
    '\\':     '\\',
    '\r':     'r',
    '\n':     'n',
    '\u2028': 'u2028',
    '\u2029': 'u2029'
  };

  var escaper = /\\|'|\r|\n|\u2028|\u2029/g;

  var escapeChar = function(match) {
    return '\\' + escapes[match];
  };

  // JavaScript micro-templating, similar to John Resig's implementation.
  // Underscore templating handles arbitrary delimiters, preserves whitespace,
  // and correctly escapes quotes within interpolated code.
  // NB: `oldSettings` only exists for backwards compatibility.
  _.template = function(text, settings, oldSettings) {
    if (!settings && oldSettings) settings = oldSettings;
    settings = _.defaults({}, settings, _.templateSettings);

    // Combine delimiters into one regular expression via alternation.
    var matcher = RegExp([
      (settings.escape || noMatch).source,
      (settings.interpolate || noMatch).source,
      (settings.evaluate || noMatch).source
    ].join('|') + '|$', 'g');

    // Compile the template source, escaping string literals appropriately.
    var index = 0;
    var source = "__p+='";
    text.replace(matcher, function(match, escape, interpolate, evaluate, offset) {
      source += text.slice(index, offset).replace(escaper, escapeChar);
      index = offset + match.length;

      if (escape) {
        source += "'+\n((__t=(" + escape + "))==null?'':_.escape(__t))+\n'";
      } else if (interpolate) {
        source += "'+\n((__t=(" + interpolate + "))==null?'':__t)+\n'";
      } else if (evaluate) {
        source += "';\n" + evaluate + "\n__p+='";
      }

      // Adobe VMs need the match returned to produce the correct offest.
      return match;
    });
    source += "';\n";

    // If a variable is not specified, place data values in local scope.
    if (!settings.variable) source = 'with(obj||{}){\n' + source + '}\n';

    source = "var __t,__p='',__j=Array.prototype.join," +
      "print=function(){__p+=__j.call(arguments,'');};\n" +
      source + 'return __p;\n';

    try {
      var render = new Function(settings.variable || 'obj', '_', source);
    } catch (e) {
      e.source = source;
      throw e;
    }

    var template = function(data) {
      return render.call(this, data, _);
    };

    // Provide the compiled source as a convenience for precompilation.
    var argument = settings.variable || 'obj';
    template.source = 'function(' + argument + '){\n' + source + '}';

    return template;
  };

  // Add a "chain" function. Start chaining a wrapped Underscore object.
  _.chain = function(obj) {
    var instance = _(obj);
    instance._chain = true;
    return instance;
  };

  // OOP
  // ---------------
  // If Underscore is called as a function, it returns a wrapped object that
  // can be used OO-style. This wrapper holds altered versions of all the
  // underscore functions. Wrapped objects may be chained.

  // Helper function to continue chaining intermediate results.
  var result = function(obj) {
    return this._chain ? _(obj).chain() : obj;
  };

  // Add your own custom functions to the Underscore object.
  _.mixin = function(obj) {
    _.each(_.functions(obj), function(name) {
      var func = _[name] = obj[name];
      _.prototype[name] = function() {
        var args = [this._wrapped];
        push.apply(args, arguments);
        return result.call(this, func.apply(_, args));
      };
    });
  };

  // Add all of the Underscore functions to the wrapper object.
  _.mixin(_);

  // Add all mutator Array functions to the wrapper.
  _.each(['pop', 'push', 'reverse', 'shift', 'sort', 'splice', 'unshift'], function(name) {
    var method = ArrayProto[name];
    _.prototype[name] = function() {
      var obj = this._wrapped;
      method.apply(obj, arguments);
      if ((name === 'shift' || name === 'splice') && obj.length === 0) delete obj[0];
      return result.call(this, obj);
    };
  });

  // Add all accessor Array functions to the wrapper.
  _.each(['concat', 'join', 'slice'], function(name) {
    var method = ArrayProto[name];
    _.prototype[name] = function() {
      return result.call(this, method.apply(this._wrapped, arguments));
    };
  });

  // Extracts the result from a wrapped and chained object.
  _.prototype.value = function() {
    return this._wrapped;
  };

  // AMD registration happens at the end for compatibility with AMD loaders
  // that may not enforce next-turn semantics on modules. Even though general
  // practice for AMD registration is to be anonymous, underscore registers
  // as a named module because, like jQuery, it is a base library that is
  // popular enough to be bundled in a third party lib, but not be part of
  // an AMD load request. Those cases could generate an error when an
  // anonymous define() is called outside of a loader request.
  if (typeof define === 'function' && define.amd) {
    define('underscore', [], function() {
      return _;
    });
  }
}.call(this));

},{}],"protocol":[function(require,module,exports){
module.exports=require('gXiLoN');
},{}],"gXiLoN":[function(require,module,exports){
var Loader = function() {

  // will be replaced with the json.
  this.dependencies = {"npm":{"mustache":"latest","domify":"latest","json-editor":"latest","underscore":"1.x.x","dot-object":"0.x.x"}};
  //this.nodes = ;
  this.nodeDefinitions = {"./graph/{ns}/{name}.fbp":{"models":{"model":{"id":"MyModel","type":"flow","nodes":[{"id":"72da22ac-624b-4e40-bebd-5e6edf6e678c","title":"Commands","ns":"object","name":"keys"},{"id":"42552c8c-70e2-4180-8d7e-1493ff06a574","title":"CommandsPicker","ns":"data","name":"pick"},{"id":"31165667-1f07-44f3-9d43-f608dc72acb5","title":"ProtocolSchemas","ns":"object","name":"create","context":{"in":{"network":{"title":"Network protocol","description":"Protocol for starting and stopping FBP networks, and finding out about their state.","output":{"stopped":{"title":"Stopped","description":"Inform that a given network has stopped.","type":"object","properties":{"time":{"title":"Time","type":"string","format":"date-time","description":"time when the network was stopped"},"uptime":{"title":"Uptime","type":"string","format":"date-time","description":"time the network was running, in seconds"},"graph":{"title":"Graph","type":"string","description":"graph the action targets"}}},"started":{"title":"Started","description":"Inform that a given network has been started.","type":"object","properties":{"time":{"title":"Time","type":"string","format":"date-time","description":"time when the network was started"},"graph":{"title":"Graph","type":"string","description":"graph the action targets"}}},"status":{"title":"Status","description":"Response to a getstatus message.","type":"object","properties":{"running":{"title":"Running","type":"boolean","description":"boolean tells whether the network is running or not"},"graph":{"title":"Graph","type":"string","description":"graph the action targets"},"uptime":{"title":"Uptime","type":"string","format":"date-time","description":"(optional) time the network has been running, in seconds"}}},"output":{"description":"An output message from a running network, roughly similar to STDOUT output of a Unix process, or a line of console.log in JavaScript. Output can also be used for passing images from the runtime to the UI.","properties":{"message":{"type":"string","description":"contents of the output line"},"type":{"type":"string","enum":["message","previewurl"],"description":"(optional) type of output, either message or previewurl"},"url":{"type":"string","format":"uri","description":"(optional) URL for an image generated by the runtime"}}},"error":{"description":"An error from a running network, roughly similar to STDERR output of a Unix process, or a line of console.error in JavaScript.","properties":{"message":{"type":"any","description":"contents of the error message"}}},"icon":{"description":"Icon of a component instance has changed.","properties":{"id":{"type":"string","description":"identifier of the node"},"icon":{"type":"string","description":"new icon for the component instance"},"graph":{"type":"string","description":"graph the action targets"}}},"connect":{"description":"Beginning of transmission on an edge.","properties":{"id":{"type":"string","description":"textual edge identifier, usually in form of a FBP language line"},"src":{"type":"object","description":"source node for the edge","properties":{"node":{"type":"string","description":"node identifier"},"port":{"type":"string","description":"port name"}}},"tgt":{"type":"object","description":"target node for the edge","properties":{"node":{"type":"string","description":"node identifier"},"port":{"type":"string","description":"port name"}}},"graph":{"type":"string","description":"graph the action targets"},"subgraph":{"type":"string","description":"(optional): subgraph identifier for the event. An array of node IDs"}}},"begingroup":{"description":"Beginning of a group (bracket IP) on an edge.","properties":{"id":{"type":"string","description":"textual edge identifier, usually in form of a FBP language line"},"src":{"description":"source node for the edge","properties":{"node":{"type":"string","description":"node identifier"},"port":{"type":"string","description":"port name"}}},"tgt":{"description":"target node for the edge","properties":{"node":{"type":"string","description":"node identifier"},"port":{"type":"string","description":"port name"}}},"group":{"description":"group name","type":"string"},"graph":{"type":"string","description":"graph the action targets"},"subgraph":{"type":"array","description":"(optional): subgraph identifier for the event. An array of node IDs"}}},"data":{"description":"Data transmission on an edge.","properties":{"id":{"type":"string","description":"textual edge identifier, usually in form of a FBP language line"},"src":{"type":"object","description":"source node for the edge","properties":{"node":{"type":"string","description":"node identifier"},"port":{"type":"string","description":"port name"}}},"tgt":{"type":"object","description":"target node for the edge","properties":{"node":{"type":"string","description":"node identifier"},"port":{"type":"string","description":"port name"}}},"data":{"type":"any","description":"actual data being transmitted, encoded in a way that can be carried over the protocol transport"},"graph":{"type":"string","description":"graph the action targets"},"subgraph":{"type":"string","description":"(optional): subgraph identifier for the event. An array of node IDs"}}},"endgroup":{"description":"Ending of a group (bracket IP) on an edge.","properties":{"id":{"type":"string","description":"textual edge identifier, usually in form of a FBP language line"},"src":{"description":"source node for the edge","properties":{"node":{"type":"string","description":"node identifier"},"port":{"type":"string","description":"port name"}}},"tgt":{"description":"target node for the edge","properties":{"node":{"type":"string","description":"node identifier"},"port":{"type":"string","description":"port name"}}},"group":{"description":"group name","type":"string"},"graph":{"description":"graph the action targets","type":"string"},"subgraph":{"type":"array","description":"(optional): subgraph identifier for the event. An array of node IDs"}}},"disconnect":{"description":"End of transmission on an edge.","properties":{"id":{"description":"textual edge identifier, usually in form of a FBP language line"},"src":{"type":"object","description":"source node for the edge","properties":{"node":{"type":"string","description":"node identifier"},"port":{"type":"string","description":"port name"}}},"tgt":{"type":"object","description":"target node for the edge","properties":{"node":{"type":"string","description":"node identifier"},"port":{"type":"string","description":"port name"}}},"graph":{"type":"string","description":"graph the action targets"},"subgraph":{"type":"string","description":"(optional): subgraph identifier for the event. An array of node IDs"}}}},"input":{"error":{"description":"Network error"},"start":{"description":"Start execution of a FBP network based on a given graph.","properties":{"graph":{"type":"string","description":"graph the action targets"}}},"getstatus":{"description":"Get the current status of the runtime. The runtime should respond with a status message.","properties":{"graph":{"type":"string","description":"graph the action targets"}}},"stop":{"description":"Stop execution of a FBP network based on a given graph.","properties":{"graph":{"type":"string","description":"graph the action targets"}}},"edges":{"description":"List of edges user has selected for inspection in a user interface or debugger, sent from UI to a runtime.","edges":{"type":"array","description":"list of selected edges, each containing","properties":{"src":{"type":"object","description":"source node for the edge","properties":{"node":{"type":"string","description":"node identifier"},"port":{"type":"string","description":"port name"}}},"tgt":{"type":"object","description":"target node for the edge","properties":{"node":{"type":"string","description":"node identifier"},"port":{"type":"string","description":"port name"},"graph":{"type":"string","description":"graph the action targets"}}}}}}}},"component":{"title":"Component protocol","description":"Protocol for handling the component registry.","output":{"error":{"description":"Component error"},"component":{"title":"Component","description":"Transmit the metadata about a component instance.","type":"object","properties":{"name":{"title":"Name","type":"string","description":"component name in format that can be used in graphs"},"description":{"title":"Description","type":"string","description":"(optional) textual description on what the component does"},"icon":{"title":"Icon","type":"string","description":"(optional): visual icon for the component, matching icon names in [Font Awesome](http://fortawesome.github.io/Font-Awesome/icons/)"},"subgraph":{"title":"Subgraph","type":"boolean","description":"boolean telling whether the component is a subgraph"},"inPorts":{"title":"Input Ports","description":"list of input ports, each containing:","type":"object","properties":{"id":{"title":"ID","type":"string","description":"port name"},"type":{"title":"Type","type":"string","description":"port datatype, for example `boolean`"},"description":{"title":"Description","type":"string","description":"textual description of the port"},"addressable":{"title":"Addressable","type":"boolean","description":"boolean telling whether the port is an ArrayPort"},"required":{"title":"Required","type":"boolean","description":"boolean telling whether the port needs to be connected for the component to work"},"values":{"title":"Values","type":"array","description":"(optional) array of the values that the port accepts for enum ports"},"default":{"title":"Default","type":"any","description":"(optional) the default value received by the port"}}},"outPorts":{"description":"list of output ports","type":"object","properties":{"id":{"title":"ID","type":"string","description":"port name"},"type":{"title":"Type","type":"string","description":"port datatype, for example `boolean`"},"description":{"title":"Description","type":"string","description":"textual description of the port"},"addressable":{"title":"Addressable","type":"boolean","description":"boolean telling whether the port is an ArrayPort"},"required":{"title":"Required","type":"boolean","description":"boolean telling whether the port needs to be connected for the component to work"}}}}},"source":{"description":"Source code for a component. In cases where a runtime receives a `source` message, it should do whatever operations are needed for making that component available for graphs, including possible compilation.","type":"object","properties":{"name":{"title":"Name","type":"string","description":"Name of the component"},"language":{"title":"Language","type":"string","description":"The programming language used for the component code, for example `coffeescript`"},"library":{"title":"Library","type":"string","description":"(optional) Component library identifier"},"code":{"title":"Code","type":"string","description":"Component source code"},"tests":{"title":"Tests","type":"string","description":"(optional) unit tests for the component"}}}},"input":{"error":{"title":"Error","description":"Component error","type":"object"},"list":{"title":"List","description":"Request a list of currently available components. Will be responded with a set of `component` messages.","type":"object"},"getsource":{"title":"Get Source","description":"Request for the source code of a given component. Will be responded with a `source` message.","type":"object","properties":{"name":{"type":"string","description":"Name of the component to get source code for"}}},"source":{"title":"Source code","description":"Source code for a component. In cases where a runtime receives a `source` message, it should do whatever operations are needed for making that component available for graphs, including possible compilation.","type":"object","properties":{"name":{"title":"Name","type":"string","description":"Name of the component"},"language":{"title":"Language","type":"string","description":"The programming language used for the component code, for example `coffeescript`"},"library":{"title":"Library","type":"string","description":"(optional) Component library identifier"},"code":{"title":"Code","type":"string","description":"Component source code"},"tests":{"title":"Tests","type":"string","description":"(optional) unit tests for the component"}}}}},"runtime":{"title":"Runtime protocol","description":"When a client connects to a FBP procotol it may choose to discover the capabilities and other information about the runtime.","input":{"error":{"title":"Error","description":"Runtime error","type":"object"},"getruntime":{"title":"Get runtime","description":"Request the information about the runtime. When receiving this message the runtime should response with a runtime message.","type":"object"},"packet":{"title":"Packet","description":"Runtimes that can be used as remote subgraphs (i.e. ones that have reported supporting the protocol:runtime capability) need to be able to receive and transmit information packets at their exposed ports.\nThese packets can be send from the client to the runtime's input ports, or from runtime's output ports to the client.","type":"object","properties":{"port":{"title":"Port","type":"string","description":"port name for the input or output port"},"event":{"title":"Event","type":"string","enum":["connect","begingroup","data","endgroup","disconnect"],"description":"packet event"},"graph":{"title":"Graph","type":"string","description":"graph the action targets"},"payload":{"title":"Payload","type":"object","description":"(optional) payload for the packet. Used only with begingroup (for group names) and data packets"}}}},"output":{"error":{"title":"Error","description":"Runtime error","type":"object"},"ports":{"title":"Ports","description":"Message sent by the runtime to signal its available ports. The runtime is responsible for sending the up-to-date list of available ports back to client whenever it changes.","type":"object","properties":{"graph":{"title":"Graph","type":"string","description":"ID of the currently configured main graph running on the runtime"},"inPorts":{"title":"Input ports","description":"list of input ports","type":"array","items":{"type":"object","properties":{"addressable":{"title":"addressable","type":"boolean","description":"boolean telling whether the port is an ArrayPort"},"id":{"title":"ID","type":"string","description":"port name"},"type":{"title":"Type","description":"port datatype, for example boolean","type":"string"},"required":{"title":"Required","description":"boolean telling whether the port needs to be connected for the component to work","type":"boolean"},"description":{"title":"Description","type":"string","description":"textual description of the port"}}}},"outPorts":{"title":"Output ports","description":"list of output ports","type":"array","items":{"type":"object","properties":{"description":{"type":"string","description":"textual description of the port"},"required":{"type":"boolean","description":"boolean telling whether the port needs to be connected for the component to work"},"type":{"description":"port datatype, for example boolean","type":"string"},"id":{"description":"port name","type":"string"},"addressable":{"description":"boolean telling whether the port is an ArrayPort","type":"boolean"}}}}}},"runtime":{"title":"Runtime","description":"Response from the runtime to the getruntime request.","type":"object","properties":{"id":{"title":"ID","type":"string","required":false,"description":"(optional) runtime ID used with Flowhub Registry"},"label":{"title":"Label","description":"(optional) Human-readable description of the runtime","type":"string","required":false},"version":{"title":"Version","description":"version of the runtime protocol that the runtime supports, for example 0.4","type":"string"},"capabilities":{"title":"Capabilities","type":"array","items":{"protocol:network":{"description":"the runtime is able to control and introspect its running networks using the Network protocol"},"protocol:component":{"description":"the runtime is able to list and modify its components using the Component protocol"},"protocol:runtime":{"description":"the runtime is able to expose the ports of its main graph using the Runtime protocol and transmit packet information to/from them"},"component:getsource":{"description":"runtime is able to read and send component source code back to client"},"network:persist":{"description":"runtime is able to *flash* a running graph setup into itself, making it persistent across reboots"},"protocol:graph":{"description":"the runtime is able to modify its graphs using the Graph protocol"},"component:setsource":{"description":"runtime is able to compile and run custom components sent as source code strings"}},"description":"array of capability strings for things the runtime is able to do\nIf the runtime is currently running a graph and it is able to speak the full Runtime protocol, it should follow up with a ports message."},"graph":{"title":"Graph","description":"(optional) ID of the currently configured main graph running on the runtime, if any","type":"string","required":false},"type":{"title":"Type","description":"type of the runtime, for example noflo-nodejs or microflo","type":"string"}}}}},"graph":{"title":"Graph protocol","description":"This protocol is utilized for communicating about graph changes in both directions.","output":{"error":{"description":"Graph error","type":"object"},"addnode":{"description":"Add node to a graph.","type":"object","properties":{"id":{"title":"ID","type":"string","description":"identifier for the node","required":true},"component":{"title":"Component","type":"string","description":"component name used for the node","required":true},"metadata":{"title":"Metadata","type":"object","description":"(optional): structure of key-value pairs for node metadata"},"graph":{"title":"Graph","type":"string","description":"graph the action targets","required":true}}},"removenode":{"description":"Remove a node from a graph.","type":"object","properties":{"id":{"title":"ID","type":"string","description":"identifier for the node","required":true},"graph":{"title":"Graph","type":"string","description":"graph the action targets","required":true}}},"renamenode":{"description":"Change the ID of a node in the graph","type":"object","properties":{"from":{"title":"From","type":"string","description":"original identifier for the node","required":true},"to":{"title":"To","type":"string","description":"new identifier for the node","required":true},"graph":{"title":"Graph","type":"string","description":"graph the action targets","required":true}}},"changenode":{"title":"Change node","description":"Change the metadata associated to a node in the graph","type":"object","properties":{"id":{"title":"ID","type":"string","description":"identifier for the node","required":true},"metadata":{"title":"Metadata","type":"object","description":"structure of key-value pairs for node metadata","required":true},"graph":{"title":"Graph","type":"string","description":"graph the action targets","required":true}}},"addedge":{"description":"Add an edge to the graph","type":"object","properties":{"src":{"title":"Source","type":"object","description":"source node for the edge","required":true,"properties":{"node":{"title":"Node","type":"string","description":"node identifier","required":true},"port":{"title":"Port","type":"string","description":"port name","required":true},"index":{"title":"Index","type":["string","number"],"description":"connection index (optional, for addressable ports)"}}},"tgt":{"title":"Target","type":"object","description":"target node for the edge","required":true,"properties":{"node":{"title":"Node","type":"string","description":"node identifier","required":true},"port":{"title":"Port","type":"string","description":"port name","required":true},"index":{"title":"Index","type":"string","description":"connection index (optional, for addressable ports)"}}},"metadata":{"title":"Metadata","type":"object","description":"(optional): structure of key-value pairs for edge metadata"},"graph":{"title":"Graph","type":"string","description":"graph the action targets","required":true}}},"removeedge":{"title":"Remove edge","description":"Remove an edge from the graph","type":"object","properties":{"graph":{"title":"Graph","type":"string","description":"graph the action targets","required":true},"src":{"title":"Source","type":"object","description":"source node for the edge","required":true,"properties":{"node":{"title":"Node","type":"string","description":"node identifier"},"port":{"title":"Port","type":"string","description":"port name"}}},"tgt":{"title":"Target","type":"object","description":"target node for the edge","required":true,"properties":{"node":{"title":"Node","type":"string","description":"node identifier"},"port":{"title":"Port","type":"string","description":"port name"}}}}},"changeedge":{"title":"Change edge","description":"Change an edge's metadata","type":"object","properties":{"graph":{"title":"Graph","type":"string","description":"graph the action targets","required":true},"metadata":{"title":"Metadata","type":"object","description":"struct of key-value pairs for edge metadata"},"src":{"title":"Source","type":"object","description":"source node for the edge","properties":{"node":{"title":"Node","type":"string","description":"node identifier"},"port":{"title":"Port","type":"string","description":"port name"}}},"tgt":{"title":"Target","type":"object","description":"target node for the edge","properties":{"node":{"title":"Node","type":"string","description":"node identifier"},"port":{"title":"Port","type":"string","description":"port name"}}}}},"addinitial":{"title":"Add initial","description":"Add an IIP to the graph","type":"object","properties":{"graph":{"title":"Graph","type":"string","description":"graph the action targets"},"metadata":{"title":"Metadata","type":"object","description":"(optional): structure of key-value pairs for edge metadata"},"src":{"title":"Source","type":"object","properties":{"data":{"title":"Data","type":"any","description":"IIP value in its actual data type"}}},"tgt":{"title":"Target","type":"object","description":"target node for the edge","properties":{"node":{"title":"Node","type":"string","description":"node identifier"},"port":{"title":"Port","type":"string","description":"port name"},"index":{"title":"Index","type":["string","number"],"description":"connection index (optional, for addressable ports)"}}}}},"removeinitial":{"title":"Remove initial","description":"Remove an IIP from the graph","type":"object","properties":{"tgt":{"title":"Target","type":"object","properties":{"node":{"title":"Node","type":"string","description":"node identifier"},"port":{"title":"Port","type":"string","description":"port name"}},"description":"target node for the edge"},"graph":{"title":"Graph","type":"string","description":"graph the action targets"}}},"addinport":{"title":"Add inport","description":"Add an exported inport to the graph.","type":"object","properties":{"public":{"title":"Public","type":"string","description":"the exported name of the port"},"node":{"title":"Node","type":"string","description":"node identifier"},"port":{"title":"Port","type":"string","description":"internal port name"},"metadata":{"title":"Metadata","type":"object","description":"(optional): structure of key-value pairs for node metadata"},"graph":{"title":"Graph","type":"string","description":"graph the action targets"}}},"removeinport":{"title":"Remove inport","description":"Remove an exported port from the graph","type":"object","properties":{"public":{"title":"Public","type":"string","description":"the exported name of the port to remove"},"graph":{"title":"Graph","type":"string","description":"graph the action targets"}}},"renameinport":{"title":"Rename inport","description":"Rename an exported port in the graph","type":"object","properties":{"from":{"title":"From","type":"string","description":"original exported port name"},"to":{"title":"To","type":"string","description":"new exported port name"},"graph":{"title":"Graph","type":"string","description":"graph the action targets"}}},"addoutport":{"title":"Add outport","description":"Add an exported outport to the graph.","type":"object","properties":{"public":{"title":"Public","type":"string","description":"the exported name of the port"},"node":{"title":"Node","type":"string","description":"node identifier"},"port":{"title":"Port","type":"string","description":"internal port name"},"metadata":{"title":"Metadata","type":"object","description":"(optional): structure of key-value pairs for port metadata"},"graph":{"title":"Graph","type":"string","description":"graph the action targets"}}},"removeoutport":{"title":"Remove outport","description":"Remove an exported port from the graph","type":"object","properties":{"public":{"title":"Public","type":"string","description":"the exported name of the port to remove"},"graph":{"title":"Graph","type":"string","description":"graph the action targets"}}},"renameoutport":{"title":"Rename outport","description":"Rename an exported port in the graph","type":"object","properties":{"from":{"title":"From","type":"string","description":"original exported port name"},"to":{"title":"To","type":"string","description":"new exported port name"},"graph":{"title":"Graph","type":"string","description":"graph the action targets"}}},"addgroup":{"title":"Add group","description":"Add a group to the graph","type":"object","properties":{"name":{"title":"Name","type":"string","description":"the group name"},"nodes":{"title":"Nodes","type":"array","description":"an array of node ids part of the group"},"metadata":{"title":"Metadata","type":"object","description":"(optional): structure of key-value pairs for group metadata"},"graph":{"title":"Graph","type":"string","description":"graph the action targets"}}},"removegroup":{"title":"Remove group","description":"Remove a group from the graph","type":"object","properties":{"name":{"title":"Name","type":"string","description":"the group name"},"graph":{"title":"Graph","type":"string","description":"graph the action targets"}}},"renamegroup":{"title":"Rename group","description":"Rename a group in the graph.","type":"object","properties":{"from":{"title":"From","type":"string","description":"original group name"},"to":{"title":"To","type":"string","description":"new group name"},"graph":{"title":"Graph","type":"string","description":"graph the action targets"}}},"changegroup":{"title":"Change group","description":"Change a group's metadata","type":"object","properties":{"name":{"title":"Name","type":"string","description":"the group name","required":true},"metadata":{"title":"Metadata","type":"object","description":"structure of key-value pairs for group metadata"},"graph":{"title":"Graph","type":"string","description":"graph the action targets","required":true}}}},"input":{"error":{"title":"Error","description":"Graph error","type":"object"},"clear":{"title":"Clear","description":"Initialize an empty graph.","type":"object","properties":{"id":{"title":"ID","type":"string","description":"identifier for the graph being created. Used for all subsequent messages related to the graph instance","required":true},"name":{"title":"Name","type":"string","description":"(optional) Human-readable label for the graph"},"library":{"title":"Library","type":"string","description":"(optional) Component library identifier"},"main":{"title":"Main","type":"boolean","description":"(optional) Identifies the graph as a main graph of a project that should not be registered as a component\nGraphs registered in this way should also be available for use as subgraphs in other graphs. Therefore a graph registration and later changes to it may cause component messages of the Component protocol to be sent back to the client informing of possible changes in the ports of the subgraph component."}}},"subscribe":{"title":"Subscribe","description":"Subscribe to a graph.","type":"object","properties":{"graph":{"title":"Graph","type":"string","description":"graph to subscribe to","required":true}}},"unsubscribe":{"title":"Unsubscribe","description":"Unsubscribe to a graph.","type":"object","properties":{"graph":{"title":"Graph","type":"string","description":"graph to unsubscribe from","required":true}}},"addnode":{"title":"Add node","description":"Add node to a graph.","type":"object","properties":{"id":{"title":"ID","type":"string","description":"identifier for the node","required":true},"component":{"title":"Component","type":"string","description":"component name used for the node","required":true},"metadata":{"title":"Metadata","type":"object","description":"(optional): structure of key-value pairs for node metadata"},"graph":{"title":"Graph","type":"string","description":"graph the action targets","required":true}}},"removenode":{"title":"Removenode","description":"Remove a node from a graph.","type":"object","properties":{"id":{"title":"ID","type":"string","description":"identifier for the node","required":true},"graph":{"title":"Graph","type":"string","description":"graph the action targets","required":true}}},"renamenode":{"title":"Rename node","description":"Change the ID of a node in the graph","type":"object","properties":{"from":{"title":"From","type":"string","description":"original identifier for the node","required":true},"to":{"title":"To","type":"string","description":"new identifier for the node","required":true},"graph":{"title":"Graph","type":"string","description":"graph the action targets","required":true}}},"changenode":{"title":"Change node","description":"Change the metadata associated to a node in the graph","type":"object","properties":{"id":{"title":"ID","type":"string","description":"identifier for the node","required":true},"metadata":{"title":"Metadata","type":"object","description":"structure of key-value pairs for node metadata","required":true},"graph":{"title":"Graph","type":"string","description":"graph the action targets","required":true}}},"addedge":{"title":"Add edge","description":"Add an edge to the graph","type":"object","properties":{"src":{"title":"Source","type":"object","description":"source node for the edge","properties":{"node":{"title":"Node","type":"string","description":"node identifier"},"port":{"title":"Port","type":"string","description":"port name"},"index":{"title":"Index","type":["string","number"],"description":"connection index (optional, for addressable ports)"}}},"tgt":{"title":"Target","type":"object","description":"target node for the edge","properties":{"node":{"title":"Node","type":"string","description":"node identifier"},"port":{"title":"Port","type":"string","description":"port name"},"index":{"title":"Index","type":["string","number"],"description":"connection index (optional, for addressable ports)"}}},"metadata":{"title":"Metadata","type":"object","description":"(optional): structure of key-value pairs for edge metadata"},"graph":{"title":"Graph","description":"graph the action targets"}}},"removeedge":{"title":"Remove edge","description":"Remove an edge from the graph","type":"object","properties":{"graph":{"titile":"Graph","type":"string","description":"graph the action targets"},"src":{"titile":"Source","type":"object","description":"source node for the edge","properties":{"node":{"title":"Node","type":"string","description":"node identifier"},"port":{"title":"Port","type":"string","description":"port name"}}},"tgt":{"title":"Target","type":"object","description":"target node for the edge","properties":{"node":{"title":"Node","type":"string","description":"node identifier"},"port":{"title":"Port","type":"string","description":"port name"}}}}},"changeedge":{"title":"Change edge","description":"Change an edge's metadata","type":"object","properties":{"graph":{"title":"Graph","type":"string","description":"graph the action targets"},"metadata":{"title":"Metadata","type":"object","description":"struct of key-value pairs for edge metadata"},"src":{"title":"Source","type":"object","description":"source node for the edge","properties":{"node":{"title":"Node","type":"string","description":"node identifier"},"port":{"title":"Port","type":"string","description":"port name"}}},"tgt":{"title":"Target","type":"object","description":"target node for the edge","properties":{"node":{"title":"Node","type":"string","description":"node identifier"},"port":{"title":"Port","type":"string","description":"port name"}}}}},"addinitial":{"title":"Add initial","description":"Add an IIP to the graph","type":"object","properties":{"graph":{"title":"Graph","type":"string","description":"graph the action targets"},"metadata":{"title":"Metadata","type":"object","description":"(optional): structure of key-value pairs for edge metadata"},"src":{"title":"Source","type":"object","properties":{"data":{"title":"Data","type":"any","description":"IIP value in its actual data type"}}},"tgt":{"title":"Target","type":"object","description":"target node for the edge","properties":{"node":{"title":"Node","type":"string","description":"node identifier"},"port":{"title":"Port","type":"string","description":"port name"},"index":{"title":"Index","type":["string","number"],"description":"connection index (optional, for addressable ports)"}}}}},"removeinitial":{"title":"Remove initial","description":"Remove an IIP from the graph","type":"object","properties":{"tgt":{"title":"Target","type":"object","properties":{"node":{"title":"Node","type":"string","description":"node identifier"},"port":{"title":"Port","type":"string","description":"port name"}},"description":"target node for the edge"},"graph":{"title":"Graph","type":"string","description":"graph the action targets"}}},"addinport":{"title":"Add inport","description":"Add an exported inport to the graph.","type":"object","properties":{"public":{"title":"Public","type":"string","description":"the exported name of the port"},"node":{"title":"Node","type":"string","description":"node identifier"},"port":{"title":"Port","type":"string","description":"internal port name"},"metadata":{"title":"Metadata","type":"object","description":"(optional): structure of key-value pairs for node metadata"},"graph":{"title":"Graph","type":"string","description":"graph the action targets"}}},"removeinport":{"title":"Remove inport","description":"Remove an exported port from the graph","type":"object","properties":{"public":{"title":"Public","type":"string","description":"the exported name of the port to remove"},"graph":{"title":"Graph","type":"string","description":"graph the action targets"}}},"renameinport":{"title":"Rename inport","description":"Rename an exported port in the graph","type":"object","properties":{"from":{"title":"Rename inport","type":"string","description":"original exported port name"},"to":{"title":"To","type":"string","description":"new exported port name"},"graph":{"title":"Graph","type":"string","description":"graph the action targets"}}},"addoutport":{"title":"Add outport","description":"Add an exported outport to the graph.","type":"object","properties":{"public":{"title":"Public","type":"string","description":"the exported name of the port"},"node":{"title":"Node","type":"string","description":"node identifier"},"port":{"title":"Port","type":"string","description":"internal port name"},"metadata":{"title":"Metadata","type":"object","description":"(optional): structure of key-value pairs for port metadata"},"graph":{"title":"Graph","type":"string","description":"graph the action targets"}}},"removeoutport":{"title":"Remove outport","description":"Remove an exported port from the graph","type":"object","properties":{"public":{"title":"Public","type":"string","description":"the exported name of the port to remove"},"graph":{"title":"Graph","type":"string","description":"graph the action targets"}}},"renameoutport":{"title":"Rename outport","description":"Rename an exported port in the graph","type":"object","properties":{"from":{"title":"From","type":"string","description":"original exported port name"},"to":{"title":"To","type":"string","description":"new exported port name"},"graph":{"title":"Graph","type":"string","description":"graph the action targets"}}},"addgroup":{"title":"Add group","description":"Add a group to the graph","type":"object","properties":{"name":{"title":"Name","type":"string","description":"the group name"},"nodes":{"title":"Nodes","type":"array","description":"an array of node ids part of the group"},"metadata":{"title":"Metadata","type":"object","description":"(optional): structure of key-value pairs for group metadata"},"graph":{"type":"string","description":"graph the action targets"}}},"removegroup":{"title":"Remove group","description":"Remove a group from the graph","type":"object","properties":{"name":{"title":"Name","type":"string","description":"the group name"},"graph":{"title":"Graph","type":"string","description":"graph the action targets"}}},"renamegroup":{"title":"Rename group","description":"Rename a group in the graph.","type":"object","properties":{"from":{"title":"From","type":"string","description":"original group name"},"to":{"title":"To","type":"string","description":"new group name"},"graph":{"title":"Graph","type":"string","description":"graph the action targets"}}},"changegroup":{"title":"Change group","description":"Change a group's metadata","type":"object","properties":{"name":{"title":"Name","type":"string","description":"the group name"},"metadata":{"title":"Metadata","type":"object","description":"structure of key-value pairs for group metadata"},"graph":{"title":"Graph","type":"string","description":"graph the action targets"}}}}}}}},{"id":"fb0c7c11-9c0f-4881-a3c5-1a95216dabaa","title":"Log","ns":"console","name":"log"},{"id":"bad99492-417f-47a8-bc54-2d7a7d409c19","title":"CommandKey","ns":"object","name":"keys"},{"id":"5d19859e-e0f5-4333-bd01-0673f146e6f9","title":"GetCommands","ns":"object","name":"keys"},{"id":"a7d82ce7-bc5d-4df2-81b3-6aefdc1f7a69","title":"BuildPath","ns":"string","name":"append","context":{"append":".input"}},{"id":"c2c70116-ef5f-4352-b196-74885b2402e2","title":"PrepareCommand","ns":"array","name":"map","context":{"fn":"\n return {\n   label: val,\n   value: val\n }\n"}},{"id":"91a9bffc-c234-4bb3-82f4-7a0aca9bc409","title":"PickSchema","ns":"data","name":"pick"}],"links":[{"id":"0fce904e-c9be-4e9e-b6d9-b10ee5ad03f3","source":{"id":"5d19859e-e0f5-4333-bd01-0673f146e6f9","port":"out","setting":{"index":0}},"target":{"id":"a7d82ce7-bc5d-4df2-81b3-6aefdc1f7a69","port":"in"},"metadata":{"title":"GetCommands out -> in BuildPath"}},{"id":"1950ddbf-f28d-43ad-ba91-d9769c99e67e","source":{"id":"a7d82ce7-bc5d-4df2-81b3-6aefdc1f7a69","port":"out"},"target":{"id":"42552c8c-70e2-4180-8d7e-1493ff06a574","port":"path"},"metadata":{"title":"BuildPath out -> path CommandsPicker"}},{"id":"5524118b-3fa1-465e-a0bc-274e0275c6c6","source":{"id":"42552c8c-70e2-4180-8d7e-1493ff06a574","port":"out"},"target":{"id":"fb0c7c11-9c0f-4881-a3c5-1a95216dabaa","port":"msg"},"metadata":{"title":"CommandsPicker out -> msg Log"}},{"id":"2be309c0-f1cc-409d-86f0-a3008d365f85","source":{"id":"a7d82ce7-bc5d-4df2-81b3-6aefdc1f7a69","port":"out"},"target":{"id":"fb0c7c11-9c0f-4881-a3c5-1a95216dabaa","port":"msg"},"metadata":{"title":"BuildPath out -> msg Log"}},{"id":"1baddc2c-8667-4dab-ab22-ced833dd7602","source":{"id":"31165667-1f07-44f3-9d43-f608dc72acb5","port":"out"},"target":{"id":"42552c8c-70e2-4180-8d7e-1493ff06a574","port":"in","setting":{"persist":true}},"metadata":{"title":"ProtocolSchemas out -> in CommandsPicker"}},{"id":"49d824fc-a0e4-4218-8172-3d7bb8ba03ed","source":{"id":"42552c8c-70e2-4180-8d7e-1493ff06a574","port":"out"},"target":{"id":"72da22ac-624b-4e40-bebd-5e6edf6e678c","port":"in"},"metadata":{"title":"CommandsPicker out -> in Commands"}},{"id":"dc71e42f-90c1-4ccd-a6fe-aeac5377cc53","source":{"id":"72da22ac-624b-4e40-bebd-5e6edf6e678c","port":"out"},"target":{"id":"fb0c7c11-9c0f-4881-a3c5-1a95216dabaa","port":"msg"},"metadata":{"title":"Commands out -> msg Log"}},{"id":"38a085aa-fd77-4b81-96d4-21718cf93077","source":{"id":"72da22ac-624b-4e40-bebd-5e6edf6e678c","port":"out"},"target":{"id":"c2c70116-ef5f-4352-b196-74885b2402e2","port":"in"},"metadata":{"title":"Commands out -> in PrepareCommand"}},{"id":"9d04451a-5627-4423-850b-46388af85996","source":{"id":"42552c8c-70e2-4180-8d7e-1493ff06a574","port":"out"},"target":{"id":"fb0c7c11-9c0f-4881-a3c5-1a95216dabaa","port":"msg"},"metadata":{"title":"CommandsPicker out -> msg Log"}},{"id":"51b7b93d-b944-40c1-a9b5-e72a2eb4625b","source":{"id":"42552c8c-70e2-4180-8d7e-1493ff06a574","port":"out"},"target":{"id":"91a9bffc-c234-4bb3-82f4-7a0aca9bc409","port":"in","setting":{"persist":true}},"metadata":{"title":"CommandsPicker out -> in PickSchema"}},{"id":"99c87803-4bb7-4a23-bf21-e51287df8e7e","source":{"id":"bad99492-417f-47a8-bc54-2d7a7d409c19","port":"out","setting":{"index":0}},"target":{"id":"91a9bffc-c234-4bb3-82f4-7a0aca9bc409","port":"path"},"metadata":{"title":"CommandKey out -> path PickSchema"}},{"id":"5e74a4c1-3c12-4738-8fc3-e67964e6c275","source":{"id":"bad99492-417f-47a8-bc54-2d7a7d409c19","port":"out"},"target":{"id":"fb0c7c11-9c0f-4881-a3c5-1a95216dabaa","port":"msg"},"metadata":{"title":"CommandKey out -> msg Log"}}],"title":"Modelling","ns":"models","name":"model","ports":{"input":{"command":{"nodeId":"bad99492-417f-47a8-bc54-2d7a7d409c19","title":"Command","name":"in"},"in":{"nodeId":"5d19859e-e0f5-4333-bd01-0673f146e6f9","title":"In","name":"in"}},"output":{"schema":{"nodeId":"91a9bffc-c234-4bb3-82f4-7a0aca9bc409","title":"Schema","name":"out"},"options":{"nodeId":"c2c70116-ef5f-4352-b196-74885b2402e2","title":"Options","name":"out"}}},"providers":{"@":{"url":"https://serve-chix.rhcloud.com/nodes/{ns}/{name}"}},"provider":"./graph/{ns}/{name}.fbp"}}},"https://serve-chix.rhcloud.com/nodes/{ns}/{name}":{"console":{"log":{"_id":"52645993df5da0102500004e","name":"log","ns":"console","description":"Console log","async":true,"phrases":{"active":"Logging to console"},"ports":{"input":{"msg":{"type":"any","title":"Log message","description":"Logs a message to the console","async":true,"required":true}},"output":{"out":{"type":"any","title":"Log message"}}},"fn":"on.input.msg = function() {\n  console.log(data);\n  output( { out: data });\n}\n","provider":"https://serve-chix.rhcloud.com/nodes/{ns}/{name}"}},"dom":{"querySelector":{"_id":"527299bb30b8af4b8910216b","name":"querySelector","ns":"dom","title":"querySelector","description":"[Document query selector](https://developer.mozilla.org/en-US/docs/Web/API/document.querySelector)","expose":["document"],"phrases":{"active":"Gathering elements matching criteria: {{input.selector}}"},"ports":{"input":{"element":{"title":"Element","type":"HTMLElement","default":null},"selector":{"title":"Selector","type":"string"}},"output":{"element":{"title":"Element","type":"HTMLElement"},"selection":{"title":"Selection","type":"HTMLElement"},"error":{"title":"Error","type":"Error"}}},"fn":"var el = input.element ? input.element : document;\noutput = {\n  element: el\n};\n\nvar selection = el.querySelector(input.selector);\nif(selection) {\n  output.selection = selection;\n} else {\n  output.error = Error('Selector ' + input.selector + ' did not match');\n}\n","provider":"https://serve-chix.rhcloud.com/nodes/{ns}/{name}"},"setHtml":{"_id":"52be32d46a14bb6fbd924a24","name":"setHtml","ns":"dom","description":"dom setHtml","async":true,"phrases":{"active":"Adding html"},"ports":{"input":{"element":{"type":"HTMLElement","title":"Dom Element"},"html":{"type":"string","format":"html","title":"html","async":true}},"output":{"element":{"type":"HTMLElement","title":"Dom Element"}}},"fn":"on.input.html = function(data) {\n  input.element.innerHTML = data;\n  output({ element: input.element });\n};\n","provider":"https://serve-chix.rhcloud.com/nodes/{ns}/{name}"}},"bootstrap":{"select":{"_id":"54b74927fa15e75e679fd19c","name":"select","ns":"bootstrap","title":"Select","description":"Bootstrap - select","async":true,"dependencies":{"npm":{"mustache":"latest","domify":"latest"}},"ports":{"input":{"element":{"type":"HTMLElement","title":"Parent Element","async":true},"template":{"title":"Template","type":"string","default":"<div>{{#label}}<label>{{label}}</label>{{/label}}<select id=\"{{id}}\" class=\"form-control\">{{#options}}<option value=\"{{value}}\">{{label}}</option>{{/options}}</select></div>","format":"html"},"id":{"type":"string","title":"ID","default":""},"label":{"type":"string","title":"Label","default":""},"options":{"title":"Variables","type":"array","items":{"type":"object","properties":{"label":{"type":"string","title":"Label"},"value":{"type":"string","title":"Value"},"additionalProperties":false}}}},"output":{"element":{"title":"Element","type":"HTMLFragment"},"out":{"title":"Value","type":"object","properties":{"label":{"type":"string","title":"Label"},"value":{"type":"string","title":"Value"}}}}},"fn":"state.select = null;\nstate.view = {};\nstate.changed = function () {\n\n  var out = {};\n  var self = this;\n\n  out[this.value] = state.view.options.filter(function(opt) {\n    return opt.value === self.value;\n  }).pop();\n\n  output({out: out});\n};\n\non.input.element = function () {\n\n  if (state.select) {\n    state.select.removeEventListener('change', state.changed);\n    input.element.innerHTML = null;\n  }\n\n  state.view = {\n    id: input.id,\n    label: input.label,\n    options: input.options\n  };\n\n  var el = domify(mustache.render(input.template, state.view));\n\n  input.element.appendChild(el);\n\n  state.select = input.element.querySelector('select');\n  state.select.addEventListener('change', state.changed);\n\n  output({\n    element: input.element\n  });\n\n};\n","provider":"https://serve-chix.rhcloud.com/nodes/{ns}/{name}"},"button":{"_id":"54bc6765fa15e75e679fd1ac","name":"button","ns":"bootstrap","title":"Button","description":"Bootstrap - button","async":true,"ports":{"input":{"element":{"title":"Parent Element","type":"HTMLElement","async":true},"classList":{"title":"Class list","type":"string","default":"btn btn-default"},"in":{"type":"any","description":"Input to send to output when clicked","title":"Input","async":true},"label":{"type":"string","title":"Label","default":"Click!"},"attr":{"title":"Attributes","type":"object","default":{}}},"output":{"element":{"title":"Element","type":"HTMLElement"},"error":{"title":"Error","type":"Error"},"event":{"title":"Event","type":"object"},"out":{"title":"Output","type":"any"}}},"fn":"state.el = null;\nstate.clickHandler = function(ev) {\n  output({\n    event: ev,\n    out: state.in\n  });\n};\n\non.input.element = function() {\n  if (state.el) {\n    state.el.removeEventListener('click', state.clickHandler);\n    state.el.innerHTML = null;\n  }\n  state.el = document.createElement('button');\n  state.el.setAttribute('type', 'button');\n  state.el.innerHTML = input.label;\n  state.el.className = input.classList;\n  Object.keys(input.attr).forEach(function(name) {\n    state.el.setAttribute(name, input.attr[name]);\n  });\n  state.el.addEventListener('click', state.clickHandler);\n  input.element.appendChild(state.el);\n  output({\n    element: input.element\n  });\n};\n\non.input.in = function () {\n  state.in = data;\n};\n","provider":"https://serve-chix.rhcloud.com/nodes/{ns}/{name}"}},"json-editor":{"editor":{"_id":"54b36348b314b122580582fa","name":"editor","ns":"json-editor","title":"JSON Editor","description":"JSON Editor","async":true,"phrases":{"active":"Creating JSON Editor"},"dependencies":{"npm":{"json-editor":"latest"}},"ports":{"input":{"element":{"title":"Element","description":"Element","type":"HTMLElement"},"in":{"title":"Json","type":"object","description":"JSON Object","async":true},"schema":{"title":"Schema","type":"object","description":"A valid JSON Schema to use for the editor. Version 3 and Version 4 of the draft specification are supported.","async":true},"enable":{"title":"Enable","description":"Enable","async":true},"disable":{"title":"Disable","description":"Disable","async":true},"options":{"title":"Options","type":"object","properties":{"ajax":{"title":"Ajax","description":"If true, JSON Editor will load external URLs in $ref via ajax.","default":false},"disable_array_add":{"title":"Disable array add","description":"If true, remove all `add row` buttons from arrays.","default":false},"disable_array_delete":{"title":"Disable array delete","description":"If true, remove all `delete row` buttons from arrays.","default":false},"disable_array_reorder":{"title":"Disable array reorder","description":"If true, remove all `move up` and `move down` buttons from arrays.","default":false},"disable_collapse":{"title":"Disable collapse","description":"If true, remove all collapse buttons from objects and arrays.","default":false},"disable_edit_json":{"title":"Disable edit json","description":"If true, remove all Edit JSON buttons from objects.","default":false},"disable_properties":{"title":"Disable properties","description":"If true, remove all Edit Properties buttons from objects.","default":false},"form_name_root":{"title":"Form name root","description":"The first part of the `name` attribute of form inputs in the editor. An full example name is `root[person][name]` where `root` is the form_name_root.","default":"root"},"iconlib":{"title":"Iconlib","description":"The icon library to use for the editor. See the CSS Integration section below for more info.","default":null},"no_additional_properties":{"title":"No additional properties","description":"If true, objects can only contain properties defined with the properties keyword.","default":false},"refs":{"title":"Refs","description":"An object containing schema definitions for URLs. Allows you to pre-define external schemas.","default":{}},"required_by_default":{"title":"Required by default","description":"If true, all schemas that don't explicitly set the required property will be required.","default":false},"show_errors":{"title":"Show errors","description":"When to show validation errors in the UI. Valid values are interaction, change, always, and never.","default":"interaction"},"startval":{"title":"Start value","description":" Seed the editor with an initial value. This should be valid against the editor's schema.","default":null},"template":{"title":"Template","description":"The JS template engine to use. See the Templates and Variables section below for more info.","default":"default"},"theme":{"title":"Theme","description":"The CSS theme to use. See the CSS Integration section below for more info.","default":"html"}}}},"output":{"out":{"title":"out","type":"string"},"editor":{"title":"Editor","type":"JSONEditor"}}},"fn":"state.jsonEditor = null;\nstate.changeHandler = function() {\n    output({out: state.jsonEditor.getValue()});\n};\n\non.input.in = function() {\n  state.in = data;\n  if (state.jsonEditor) {\n    state.jsonEditor.setValue(state.in);\n  }\n};\n\non.input.schema = function() {\n  state.schema = input.options.schema = input.schema;\n  if (state.jsonEditor) {\n    state.jsonEditor.off('change', state.changeHandler);\n    state.jsonEditor.destroy();\n  }\n  state.jsonEditor = new json_editor(input.element, input.options);\n  // problem if state.in is not about this schema..\n  if (state.in) {\n    state.jsonEditor.setValue(state.in);\n  }\n  state.jsonEditor.on('change', state.changeHandler);\n  output({editor: state.jsonEditor});\n};\n\non.input.enable = function() {\n  if (state.jsonEditor) {\n    state.jsonEditor.enable();\n  }\n};\n\non.input.disable = function() {\n  if (state.jsonEditor) {\n    state.jsonEditor.disable();\n  }\n};\n","provider":"https://serve-chix.rhcloud.com/nodes/{ns}/{name}"},"validate":{"_id":"54bc6c5cfa15e75e679fd1ad","name":"validate","ns":"json-editor","title":"JSON Editor Validate","description":"JSON Editor Validate","async":true,"phrases":{"active":"Validating form"},"ports":{"input":{"in":{"title":"Json","type":"object","description":"JSON Object","async":true},"editor":{"title":"Editor","type":"function","description":"JSONEditor instance"}},"output":{"out":{"title":"Output","type":"string"},"errors":{"title":"Errors","type":"array","items":{"type":"object","properties":{"path":{"title":"Path","description":"a dot separated path into the JSON object (e.g. `root.path.to.field`)","type":"string"},"property":{"title":"Property","description":"schema keyword that triggered the validation error (e.g. `minLength`)","type":"string"},"message":{"title":"Message","type":"string"}}}}}},"fn":"on.input.in = function() {\n  var errors = input.editor.validate(data);\n  if(errors.length) {\n    output({errors: errors});\n  } else {\n    output({out: data});\n  }\n};\n","provider":"https://serve-chix.rhcloud.com/nodes/{ns}/{name}"}},"object":{"keys":{"_id":"52ef3630cf8e1bab142d5394","name":"keys","ns":"object","async":true,"description":"Retrieve all the names of the object's properties","phrases":{"active":"Retrieving object properties"},"ports":{"input":{"in":{"title":"Object","type":"object","async":true},"path":{"title":"Path","type":"string","default":null}},"output":{"out":{"title":"out","type":"array"}}},"dependencies":{"npm":{"underscore":"1.x.x","dot-object":"0.x.x"}},"fn":"on.input.in = function() {\n  var val = input.path ? dot_object().pick(input.path, data) : data;\n  output( { out: underscore.keys(val) } );\n}\n","provider":"https://serve-chix.rhcloud.com/nodes/{ns}/{name}"},"create":{"_id":"52fa908e909495ebbe6ded4c","name":"create","ns":"object","async":true,"description":"Create an object, if input is a direct object it just returns a copy of the object","phrases":{"active":"Creating object"},"ports":{"input":{"in":{"title":"Object","type":"object","async":true}},"output":{"out":{"title":"out","type":"object"}}},"fn":"on.input.in = function(data) { output({out: data}); };\n","provider":"https://serve-chix.rhcloud.com/nodes/{ns}/{name}"}},"data":{"pick":{"_id":"527d857e83f0adcc47800e7c","name":"pick","ns":"data","title":"Pick","async":true,"description":"Pick one value from an object","phrases":{"active":"Picking {{input.path}} from object"},"ports":{"input":{"in":{"title":"Object","description":"An Object, e.g { name: { first: 'John', last: 'Doe' } }","type":"object","async":true},"path":{"title":"Path","description":"Specify a path with . syntax (e.g. name.last )","type":"string","required":true}},"output":{"out":{"title":"Output","type":"any"},"error":{"title":"Error","type":"Error"}}},"dependencies":{"npm":{"dot-object":"0.x.x"}},"fn":"on.input.in = function(data) {\n  // dot_object api should be fixed..\n  var res = dot_object().pick(input.path, data);\n  if(typeof res !== 'undefined') {\n    output({out: res});\n  } else {\n    output({error: Error(input.path + ' not found')});\n  }\n};\n","provider":"https://serve-chix.rhcloud.com/nodes/{ns}/{name}"}},"string":{"append":{"_id":"52ef363bcf8e1bab142d53b7","name":"append","ns":"string","description":"Appends a string to an other string","phrases":{"active":"Appending string"},"ports":{"input":{"in":{"title":"String","type":"string","required":true},"append":{"title":"Other String","type":"string","required":true}},"output":{"out":{"title":"String","type":"string"}}},"fn":"output.out = input.in + input.append\n","provider":"https://serve-chix.rhcloud.com/nodes/{ns}/{name}"}},"array":{"map":{"_id":"54b8835afa15e75e679fd19d","name":"map","ns":"array","async":true,"description":"Creates new array output with the results of calling the provided function on every element in this array","phrases":{"active":"Mapping array"},"ports":{"input":{"in":{"title":"Value","type":"array","async":true},"fn":{"title":"Function","type":"function","args":["val","index","array"]}},"output":{"out":{"title":"Output","type":"array"}}},"fn":"on.input.in = function() {\n  output({\n    out: data.map(input.fn)\n  });\n};\n","provider":"https://serve-chix.rhcloud.com/nodes/{ns}/{name}"}}}};

};

Loader.prototype.hasNodeDefinition = function(nodeId) {

  return !!this.nodes[nodeId];

};

Loader.prototype.getNodeDefinition = function(node, map) {

  if (!this.nodeDefinitions[node.provider]) {

    // needed for subgraphs
    if (map.providers && map.providers[node.provider]) {
      node.provider = map.providers[node.provider].path ||
        map.providers[node.provider].url;
    } else if (map.providers && map.providers['@']) {
      node.provider = map.providers['@'].path ||
        map.providers['@'].url;
    } else {
      throw new Error('Node Provider not found for ' + node.name);
    }
  }

  return this.nodeDefinitions[node.provider][node.ns][node.name];

};

var Flow = require('chix-flow').Flow;
var loader = new Loader();

var map = {"type":"flow","nodes":[{"id":"Log","title":"Log","ns":"console","name":"log"},{"id":"ProtocolEl","title":"ProtocolEl","ns":"dom","name":"querySelector","context":{"selector":"#protocol"}},{"id":"CommandEl","title":"CommandEl","ns":"dom","name":"querySelector","context":{"selector":"#command"}},{"id":"EditorEl","title":"EditorEl","ns":"dom","name":"querySelector","context":{"selector":"#editor"}},{"id":"ButtonEl","title":"ButtonEl","ns":"dom","name":"querySelector","context":{"selector":"#button"}},{"id":"SelectProtocol","title":"SelectProtocol","ns":"bootstrap","name":"select","context":{"label":"Protocol","options":[{"label":"Select..","value":"clear"},{"label":"Graph","value":"graph"},{"label":"Network","value":"network"},{"label":"Runtime","value":"runtime"},{"label":"Component","value":"component"}]}},{"id":"SelectCommand","title":"SelectCommand","ns":"bootstrap","name":"select","context":{"label":"Command"}},{"id":"ClearCommands","title":"ClearCommands","ns":"dom","name":"setHtml","context":{"html":""}},{"id":"ClearEditor","title":"ClearEditor","ns":"dom","name":"setHtml","context":{"html":""}},{"id":"CommandEditor","title":"CommandEditor","ns":"json-editor","name":"editor","context":{"options":{"theme":"bootstrap3","disable_edit_json":true,"disable_collapse":true,"disable_properties":true,"required_by_default":true,"show_errors":"always"}}},{"id":"Validate","title":"Validate","ns":"json-editor","name":"validate"},{"id":"Button","title":"Button","ns":"bootstrap","name":"button","context":{"label":"Save"}},{"id":"GraphCommands","title":"GraphCommands","ns":"models","name":"model","provider":"x"}],"links":[{"source":{"id":"ProtocolEl","port":"selection"},"target":{"id":"SelectProtocol","port":"element"},"metadata":{"title":"ProtocolEl selection -> element SelectProtocol"}},{"source":{"id":"CommandEl","port":"selection"},"target":{"id":"SelectCommand","port":"element","setting":{"persist":true}},"metadata":{"title":"CommandEl selection -> element SelectCommand"}},{"source":{"id":"EditorEl","port":"selection"},"target":{"id":"CommandEditor","port":"element","setting":{"persist":true}},"metadata":{"title":"EditorEl selection -> element CommandEditor"}},{"source":{"id":"ButtonEl","port":"selection"},"target":{"id":"Button","port":"element"},"metadata":{"title":"ButtonEl selection -> element Button"}},{"source":{"id":"CommandEl","port":"selection"},"target":{"id":"ClearCommands","port":"element","setting":{"persist":true}},"metadata":{"title":"CommandEl selection -> element ClearCommands"}},{"source":{"id":"EditorEl","port":"selection"},"target":{"id":"ClearEditor","port":"element","setting":{"persist":true}},"metadata":{"title":"EditorEl selection -> element ClearEditor"}},{"source":{"id":"SelectProtocol","port":"out"},"target":{"id":"GraphCommands","port":"in"},"metadata":{"title":"SelectProtocol out -> in GraphCommands"}},{"source":{"id":"SelectProtocol","port":"out","setting":{"index":"clear"}},"target":{"id":"ClearCommands","port":":start"},"metadata":{"title":"SelectProtocol out -> :start ClearCommands"}},{"source":{"id":"SelectProtocol","port":"out"},"target":{"id":"ClearEditor","port":":start"},"metadata":{"title":"SelectProtocol out -> :start ClearEditor"}},{"source":{"id":"GraphCommands","port":"options"},"target":{"id":"SelectCommand","port":"options"},"metadata":{"title":"GraphCommands options -> options SelectCommand"}},{"source":{"id":"CommandEditor","port":"out"},"target":{"id":"Button","port":"in"},"metadata":{"title":"CommandEditor out -> in Button"}},{"source":{"id":"CommandEditor","port":"editor"},"target":{"id":"Validate","port":"editor"},"metadata":{"title":"CommandEditor editor -> editor Validate"}},{"source":{"id":"Button","port":"out"},"target":{"id":"Log","port":"msg"},"metadata":{"title":"Button out -> msg Log"}},{"source":{"id":"Button","port":"out"},"target":{"id":"Validate","port":"in"},"metadata":{"title":"Button out -> in Validate"}},{"source":{"id":"Validate","port":"errors"},"target":{"id":"Log","port":"msg"},"metadata":{"title":"Validate errors -> msg Log"}},{"source":{"id":"Validate","port":"out"},"target":{"id":"Log","port":"msg"},"metadata":{"title":"Validate out -> msg Log"}},{"source":{"id":"SelectCommand","port":"out"},"target":{"id":"GraphCommands","port":"command"},"metadata":{"title":"SelectCommand out -> command GraphCommands"}},{"source":{"id":"GraphCommands","port":"schema"},"target":{"id":"CommandEditor","port":"schema"},"metadata":{"title":"GraphCommands schema -> schema CommandEditor"}},{"source":{"id":"GraphCommands","port":"schema"},"target":{"id":"Log","port":"msg"},"metadata":{"title":"GraphCommands schema -> msg Log"}}],"title":"Protocol Selectbox","ns":"json-editor","name":"protocol","id":"MyProtocol","providers":{"x":{"path":"./graph/{ns}/{name}.fbp","name":"x"},"@":{"url":"https://serve-chix.rhcloud.com/nodes/{ns}/{name}"}}};

var actor;
window.Actor = actor = Flow.create(map, loader);

var monitor = require('chix-monitor-npmlog').Actor;
monitor(console, actor);

function onDeviceReady() {
actor.run();
actor.push();
actor.sendIIPs([]);

};

if (navigator.userAgent.match(/(iPhone|iPod|iPad|Android|BlackBerry|IEMobile)/)) {
  document.addEventListener("deviceready", onDeviceReady, false);
} else {
  document.addEventListener("DOMContentLoaded" , onDeviceReady); //this is the browser
}

// for entry it doesn't really matter what is the module.
// as long as this module is loaded.
module.exports = actor;

},{"chix-flow":"jXAsbI","chix-monitor-npmlog":"HNG52E"}]},{},["gXiLoN"])