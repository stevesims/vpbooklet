/*
  VPUtils
  A collection of utility methods we find useful

  (c) 2011-13, Steve Sims and Vert Pixels Ltd.
  All Rights Reserved

  Redistribution and use in source and binary forms, with or without modification, are permitted provided that the following conditions are met:

  1) Redistributions of source code must retain the above copyright notice, this list of conditions and the following disclaimer.
  2) Redistributions in binary form must reproduce the above copyright notice, this list of conditions and the following disclaimer in the documentation and/or other materials provided with the distribution.

  THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
*/

window.VPUtils = (function() {
  return {
    isObject: function isObject(object) {
      return Object.prototype.toString.call(object) === "[object Object]";
    },
    
    isFunction: function isFunction(object) {
      return object instanceof Function;
    },
    
    isUndefined: function isUndefined(object) {
      return object === undefined;
    },
    
    isString: function isString(object) {
      return typeof object === 'string' || object instanceof String;
    },
    
    isNumber: function isNumber(object) {
      return typeof object === 'number' || object instanceof Number;
    },
    
    hasMethod: function hasMethod(object, name) {
      return (
        VPUtils.isObject(object) &&
        VPUtils.isFunction(object[name])
      );
    },
    
    hasProperty: function hasProperty(object, name) {
      return (
        VPUtils.isObject(object) &&
        object.hasOwnProperty(name)
      );
    },
    
    delayedCall: function delayedCall(obj, func, delay) {
      if (VPUtils.isString(func)) {
        if (obj) {
          func = obj[func];
        } else {
          throw new TypeError("VPUtils.delayedCall: string function name given with null object");
        }
      }
      if (!VPUtils.isFunction(func)) {
        throw new TypeError("VPUtils.delayedCall: no/bad function argument provided");
      }
      var args = Array.prototype.slice.call(arguments, 3);
      var delayedFunction = function delayedFunction() {
        func.apply(obj, args);
      };
      return setTimeout(delayedFunction, delay);
    },
    
    intervalCall: function delayedCall(obj, func, interval) {
      if (VPUtils.isString(func)) {
        if (obj) {
          func = obj[func];
        } else {
          throw new TypeError("VPUtils.intervalCall: string function name given with null object");
        }
      }
      if (!VPUtils.isFunction(func)) {
        throw new TypeError("VPUtils.intervalCall: no/bad function argument provided");
      }
      var args = Array.prototype.slice.call(arguments, 3);
      var intervalFunction = function intervalFunction() {
        func.apply(obj, args);
      };
      return setInterval(intervalFunction, interval);
    },
    
    callIfExists: function callIfExists(obj, func, context) {
      if (VPUtils.hasMethod(obj, func)) {
        var args = Array.prototype.slice.call(arguments, 3);
        return obj[func].apply(context, args);
      }
    },
    
    applyIfExists: function applyIfExists(obj, func, context, args) {
      if (VPUtils.hasMethod(obj, func)) {
        return obj[func].apply(context, args);
      }
    },
    
    copyProperties: function copyProperties(target, source, ignoreKeys, noOverwrite) {
      ignoreKeys = ignoreKeys || [];
      for (var key in source) {
        if ((ignoreKeys.indexOf(key) === -1) && source.hasOwnProperty(key)) {
          if (target[key] && VPUtils.isFunction(target[key])) {
            debug("Warning: VPUtils.copyProperties ignoring key %o since it's a function in target %o", key, target);
          } else {
            if (!noOverwrite || !VPUtils.hasProperty(target, key)) {
              target[key] = source[key];
            }
          }
        }
      }
      return target;
    },
    
    nameMethods: function nameMethods(className) {
      var classObj = window[className];
      var namePrefix = className + '.';
      for (var i in classObj.prototype) {
        var val = classObj.prototype[i];
        if (VPUtils.isFunction(val)) {
          if (!val.displayName) {
            val.displayName = namePrefix + i;
          }
        }
      }
    },
    
    buildElement: function buildElement(elementDef) {
      if (elementDef instanceof Element) {
        return elementDef;
      }
      
      if (!VPUtils.isObject(elementDef)) {
        return null;
      }
      
      var element = null;
      if (elementDef.type === "textNode") {
        return document.createTextNode(elementDef.textContent || element.innerText || element.innerHTML);
      } else if (elementDef.type === "fragment") {
        element = document.createDocumentFragment();
      } else {
        element = document.createElement(elementDef.type);
        
        var ignoreFields = ['type', 'children', 'element'];
        var valueFields = ['innerHTML', 'innerText', 'textContent'];
        var fieldMap = { 'className': 'class', 'typeAttribute': 'type' };
        // IE9 adds in width and height attributes automatically to img elements
        // so we should remove them if we're not explicitly setting
        var removeAttributes = ['width', 'height'];
        
        for (var key in elementDef) {
          if (ignoreFields.indexOf(key) === -1) {
            var elKey = fieldMap[key] || key;
            if (valueFields.indexOf(key) === -1) {
              element.setAttribute(elKey, elementDef[key]);
            } else {
              element[elKey] = elementDef[key];
            }
          }
        }
        
        removeAttributes.forEach(function(key) {
          if (!VPUtils.hasProperty(elementDef, key)) {
            element.removeAttribute(key);
          }
        });
      }
      
      if (Array.isArray(elementDef.children)) {
        elementDef.children.forEach(function(el) {
          var newEl = VPUtils.buildElement(el);
          if (newEl) {
            element.appendChild(newEl);
          }
        });
      }
      
      return element;
    },
    
    alert: function alert(msg, callback) {
      // call the cordova provided alert if it's there
      if (window.navigator && window.navigator.notification && window.navigator.notification.alert) {
        window.navigator.notification.alert.apply(window.navigator.notification, arguments);
      } else {
        window.alert.apply(window, arguments);
        if (VPUtils.isFunction(callback)) {
          callback();
        }
      }
    },
    
    confirm: function confirm(msg, callback) {
      // call the cordova provided confirm if it's there
      if (window.navigator && window.navigator.notification && window.navigator.notification.confirm) {
        window.navigator.notification.confirm.apply(window.navigator.notification, arguments);
      } else {
        var result = window.confirm.apply(window, arguments);
        if (VPUtils.isFunction(callback)) {
          callback(result);
        }
      }
    }
  };
}());
