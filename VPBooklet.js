/*
  VPBooklet
  A light-weight, extensible, HTML5/JS/CSS3 application framework

  (c) 2011-13, Steve Sims and Vert Pixels Ltd.
  All Rights Reserved

  Redistribution and use in source and binary forms, with or without modification, are permitted provided that the following conditions are met:

  1) Redistributions of source code must retain the above copyright notice, this list of conditions and the following disclaimer.
  2) Redistributions in binary form must reproduce the above copyright notice, this list of conditions and the following disclaimer in the documentation and/or other materials provided with the distribution.

  THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.

  NB this code relies on the following libraries:
  VPUtils.js
  sprintf.js
  Modernizr  (with support for detecting CSS3 Animations)
  PrefixFree
*/

window.VPController = (function() {
  "use strict";

  // Config flags:
  // flag to enable click emulation on touch devices
  var emulatedClick = true;
  // flag to make debug function global
  var globalizeDebug = true;
  
  // Detect touch support
  (function touchDetect() {
    window.iNativeTouch = "ontouchstart" in window;
  }());
  
  var DEBUG = window.DEBUG || false;
  var SHOW_TRACE = window.DEBUG || false;
  var TIMESTAMP = window.DEBUG || false;
  
  var debug = function debug() {
    if ((globalizeDebug ? window.DEBUG : DEBUG) === true && window.console && window.console.log) {
      var args = Array.prototype.slice.call(arguments);
      if ((globalizeDebug ? window.SHOW_TRACE : SHOW_TRACE) && window.console && window.console.trace) {
        console.trace();
      }
      if ((globalizeDebug ? window.TIMESTAMP : TIMESTAMP)) {
        args[0] = "DEBUG @ " + Date.now() + ": " + args[0];
      } else {
        args[0] = "DEBUG: " + args[0];
      }
      if (console.log.apply) {
        console.log.apply(console, args);
      } else {
        // fallback for some versions of IE
        console.log(args[0], args[1] || '', args[2] || '', args[3] || '', args[4] || '', args[5] || '', args[6] || '', args[7] || '');
      }
    }
  };
  
  if (globalizeDebug) {
    if (window.debug && window.debug !== debug) {
      if (DEBUG) {
        console.log("VPController didn't globalize debug function, as one already existed");
      }
    } else {
      window.debug = debug;
      window.DEBUG = window.DEBUG || DEBUG;
      window.SHOW_TRACE = window.SHOW_TRACE || SHOW_TRACE;
      window.TIMESTAMP = window.TIMESTAMP || TIMESTAMP;
    }
  }
  
  // global private variables for all controllers
  var controllers = {};
  
  // global private controller methods
  var privateMethods = {};
  
  // global controller event delegates - privateMethods will be the first
  var delegates = [ privateMethods ];
  
  // setup for emulated click
  var kTouchThreshold = 20;
  var kTouchClickTime = 300;
  
  // constants for events
  // These events are used for view lifecycle:
  var kViewListeners = ['didLoad', 'didProcessOutlets', 'didProcessActions',
    'willAppear', 'didAppear', 'willDisappear', 'didDisappear'];
  // Artificial event used as a protocol to indicate DOM modification
  var kDOMListeners = ['DOMModified'];
  
  // Animation style info, made platform-neutral
  var kAnimStyles = [
    PrefixFree.prefixCSS("animation-name: 0").replace(": 0", ""),
    PrefixFree.prefixCSS("animation-duration: 0").replace(": 0", ""),
    PrefixFree.prefixCSS("animation-delay: 0").replace(": 0", ""),
    PrefixFree.prefixCSS("animation-timing-function: 0").replace(": 0", ""),
    PrefixFree.prefixCSS("animation-fill-mode: 0").replace(": 0", "")
  ];
  var kAnimEndEventNames = {
      'WebkitAnimation' : 'webkitAnimationEnd',
      'MozAnimation'    : 'animationend',
      'OAnimation'      : 'oAnimationEnd',
      'msAnimation'     : 'MSAnimationEnd',
      'animation'       : 'animationend'
  };
  var kAnimEndEventName = kAnimEndEventNames[ Modernizr.prefixed('animation') ];
  
  var controller = function VPController(params) {
    if (window && this === window) {
      throw new TypeError("not calling as constructor");
    }
    
    if (params) {
      VPController.addController(params.name, this);
    }
    
    this.init(params);
  };
  
  controller.prototype.priorityParams = ['actions', 'outlets'];
  
  controller.prototype.init = function init(params) {
    this._outlets = [];
    this._actions = [];
    this._view = null;
    this.parentSelector = '#navigation';
    this.aliases = [];

    if (VPUtils.isObject(params)) {
      this.priorityParams.forEach(function(param) {
        if (params.hasOwnProperty(param)) {
          this[param] = params[param];
        }
      }, this);
      
      VPUtils.copyProperties(this, params, this.priorityParams);
    }
  };
  
  Object.defineProperty(controller.prototype, 'outlets', {
    get: function getOutlets() {
      return this._outlets;
    },
    set: function setOutlets(outlets) {
      if (!Array.isArray(outlets)) {
        throw new TypeError("outlets should be an array");
      }
      this.clearOutlets();
      outlets.forEach(function(outlet) {
        this.addOutlet(outlet);
      }, this);
      this.handleEvent({type: 'didSetOutlets'});
    }
  });
  
  controller.prototype.clearOutlets = function clearOutlets(deleteOnly) {
    this._outlets.forEach(function(outlet) {
      this[outlet.name] = null;
      delete this[outlet.name];
    }, this);
    if (!deleteOnly) {
      this._outlets = [];
    }
  };
  
  controller.prototype.addOutlet = function addOutlet(outlet) {
    // adds an outlet definition to the list
    // actual outlet values won't be set until view (or sub-view) loaded
    if (!VPUtils.isObject(outlet) || !outlet.name || !outlet.selector) {
      debug("Duff outlet detected in controller %o, outlet %o", this, outlet);
      throw new TypeError("outlet definition not an object or poorly defined");
    }

    if (this[outlet.name] && VPUtils.isFunction(this[outlet.name])) {
      throw new TypeError("outlet named '" + outlet.name + "' cannot be used because it is a controller function");
    }
    
    if (this._outlets.some(function(obj) { return outlet.name === obj.name })) {
      throw new TypeError("outlet named '" + outlet.name + "' was already defined");
    }

    // if outlet is array type then make an empty array for its results to go into
    if (outlet.asArray) {
      this[outlet.name] = [];
    }
    
    this._outlets.push(outlet);
    
    if (this.viewElement) {
      processOutlets.call(this, [outlet]);
    }
  };
  
  // private call to update outlets
  function processOutlets(outlets, oldView) {
    if (this.viewElement) {
      outlets.forEach(function(outlet) {
        var els = (outlet.global ? document : this.viewElement).querySelectorAll(outlet.selector);
        if (outlet.asArray) {
          this[outlet.name] = [];
          for (var i = 0; i < els.length; i++) {
            if (this[outlet.name].indexOf(els[i]) === -1) {
              this[outlet.name].push(els[i]);
            }
          }
        } else {
          if (els.length > 1) {
            debug("Warning: Multiple elements found for outlet %o, using first", outlet);
          }
          if (els.length === 0) {
            debug("Warning: No elements found for outlet %o", outlet);
            delete this[outlet.name];
            return;
          }
          this[outlet.name] = els[0];
        }
      }, this);
      this.sendEvent('didProcessOutlets', this.viewElement);
    } else if (oldView) {
      debug("no view element, so cannot process outlets, but we had a view before so we should bin existing ones");
      this.clearOutlets(this);
      this.clearActions(this);
      this.sendEvent('didProcessOutlets', oldView);
    }
  };
  
  Object.defineProperty(controller.prototype, 'actions', {
    get: function getActions() {
      return this._actions;
    },
    set: function setActions(actions) {
      if (!Array.isArray(actions)) {
        throw new TypeError("actions should be an array");
      }
      this.clearActions();
      actions.forEach(function(action) {
        this.addAction(action, true);
      }, this);
      this.handleEvent({type: 'didSetActions'});
      if (this.viewElement) {
        processActions.call(this, this._actions);
      }
    }
  });
  
  controller.prototype.clearActions = function clearActions(deleteOnly) {
    // go through this._actions, remove event listeners, and action data from els
    this._actions.forEach(function(action) {
      action.elements.forEach(function(el) {
        action.onEvents.forEach(function(event) {
          el.removeEventListener(event, this, false);
        }, this);
        delete el.vpActions;
      }, this);
      action.elements = [];
    }, this);
    if (!deleteOnly) {
      this._actions = [];
    }
  };
  
  controller.prototype.addAction = function addAction(action, noProcess) {
    // adds an action definition to the list
    // actual actions on DOM elements aren't set until view (or sub-view) loaded
    // action-less actions will just trigger corresponding event handler
    if (!VPUtils.isObject(action)) {
      debug("action definition %o bad", action);
      throw new TypeError("action definition not an object or poorly defined");
    }
    
    var events = [];
    if (action.onEvent) {
      events.push(action.onEvent);
    } else if (Array.isArray(action.onEvents)) {
      events = events.concat(action.onEvents);
    } else {
      if (window.iNativeTouch && emulatedClick) {
        events.push("touchstart");
        events.push("touchmove");
        events.push("touchend");
        events.push("click");
      } else {
        events.push("click");
      }
    }
    
    var newAction = {
      action:     action.action,
      global:     !!action.global, 
      selector:   action.selector,
      arguments:  action.arguments,
      sendEvent:  action.sendEvent,
      target:     action.target,
      onEvents:   events,
      elements:   []
    };

    this._actions.push(newAction);
    
    if (!noProcess && this.viewElement) {
      processActions.call(this, [newAction]);
    }
  };
  
  function processActions(actions) {
    actions.forEach(function(action) {
      if (VPUtils.isString(action.action)) {
        var target = this;
        if (action.target) {
          if (VPUtils.isString(action.target)) {
            target = controllers[action.target] || window[action.target] || this;
          } else if (VPUtils.isObject(action.target)) {
            target = action.target;
          }
        }
        if (!VPUtils.hasMethod(target, action.action)) {
          debug("Warning - action named %o in action definition %o from controller %o isn't defined in target %o", action.action, action, this, target);
        }
      }
      var rawEls;
      if (action.selector === undefined) {
        rawEls = [this.view];
      } else {
        rawEls = (action.global ? document : this.view).querySelectorAll(action.selector);
      }
      var els = [];
      for (var i = 0; i < rawEls.length; i++) {
        els.push(rawEls[i]);
      }
      
      // need to remove this action from existing elements associated with the action
      // if they're no longer in the view
      // so filter action.els for elements *not* in els
      var filteredEls = action.elements.filter(function(el) { return els.indexOf(el) === -1 });
      // remove event listener and relevant action data from filtered els
      filteredEls.forEach(function(el) {
        var actionIndex = el.vpActions.indexOf(action);
        if (actionIndex !== -1) {
          el.vpActions.splice(actionIndex, 1);
          action.onEvents.forEach(function(event) {
            el.removeEventListener(event, this, false);
          }, this);
        }
        if (el.vpActions.length === 0) {
          delete el.vpActions;
        }
        var index = action.elements.indexOf(el);
        if (index !== -1) {
          action.elements.splice(index, 1);
        }
      }, this);
      
      // add actions, but only if not already done
      els.forEach(function(el) {
        if (!Array.isArray(el.vpActions)) {
          el.vpActions = [];
        }
        if (el.vpActions.indexOf(action) === -1) {
          el.vpActions.push(action);
          if (action.elements.indexOf(el) === -1) {
            action.elements.push(el);
            action.onEvents.forEach(function(event) {
              el.addEventListener(event, this, false);
            }, this);
          }
        }
      }, this);
    }, this);
    this.sendEvent('didProcessActions', this.view);
  };
  
  
  // Generic event handling system
  // calls methods named _preventEventtype, preventEventtype, _handleEventtype, handleEventtype
  // if a "prevent" call returns true then we're preventing the event from being handled by this controller and go no further
  // delegates will be checked first, then controller methods
  controller.prototype.handleEvent = function handleEvent(event) {
    var methodName = "_prevent" + event.type[0].toUpperCase() + event.type.slice(1);
    var preventing;
    for (var i = 0; i < delegates.length; i++) {
      preventing = VPUtils.callIfExists(delegates[i], methodName, this, event) || VPUtils.callIfExists(delegates[i], methodName.slice(1), this, event);
      if (preventing) {
        break;
      }
    }
    preventing = preventing || VPUtils.callIfExists(this, methodName, this, event) || VPUtils.callIfExists(this, methodName.slice(1), this, event);
    if (!preventing) {
      methodName = methodName.replace('_prevent', 'handle');
      for (var i = 0; i < delegates.length; i++) {
        VPUtils.callIfExists(delegates[i], methodName, this, event);
      }
      methodName = "_" + methodName;
      VPUtils.callIfExists(this, methodName, this, event);
      methodName = methodName.slice(1);
      VPUtils.callIfExists(this, methodName, this, event);
    }
    
    return false;
  };
  
  // handleClick
  // deals with 'click' events, which will call through to an appropriate action, if there is one
  privateMethods.handleClick = function handleClick(event) {
    if (event.currentTarget && Array.isArray(event.currentTarget.vpActions)) {
      var acted = false;
      event.currentTarget.vpActions.forEach(function(action) {
        if (action.action) {
          var args = [];
          var target = this;
          if (action.sendEvent) {
            args.push(event);
          }
          if (action.arguments) {
            args = args.concat(action.arguments);
          }
          if (action.target) {
            if (VPUtils.isString(action.target)) {
              target = controllers[action.target] || this[action.target] || window[action.target];
              if (!target) {
                debug("action %o target %o not found - reverting to current controller", action, action.target);
                target = this;
              }
            } else if (VPUtils.isObject(action.target)) {
              target = action.target;
            }
          }
          if (VPUtils.isFunction(action.action)) {
            action.action.apply(target, args);
          } else {
            debug("Attempting to call " + action.action + " with args %o on target %o", args, target);
            VPUtils.applyIfExists(target, action.action, target, args);
          }
          acted = true;
        }
      }, this);
      if (acted) { event.stopPropagation(); }
    }
  };
  
  // emulated click handling code
  privateMethods.handleTouchstart = function handleTouchstart(event) {
    // add touch info to target
    if (emulatedClick && event.currentTarget.vpActions) {
      event.currentTarget.touchInfo = {
        time: Date.now(),
        x: event.touches[0].clientX,
        y: event.touches[0].clientY
      };
    }
  };
  
  privateMethods.handleTouchmove = function handleTouchmove(event) {
    // remove touch info from target if we've moved too far
    if (emulatedClick && event.currentTarget.touchInfo) {
      if (
        (Math.abs(event.touches[0].clientX - event.currentTarget.touchInfo.x) > kTouchThreshold)
        || (Math.abs(event.touches[0].clientY - event.currentTarget.touchInfo.y) > kTouchThreshold)
      ) {
        delete event.currentTarget.touchInfo;
      }
    }
  };
  
  privateMethods.handleTouchend = function handleTouchend(event) {
    // if we've still got touch info, and we're within time
    // then call click
    if (emulatedClick && event.currentTarget.touchInfo) {
      if ((Date.now() - event.currentTarget.touchInfo.time) < kTouchClickTime) {
        debug("emulating click");
        // TODO: we need to track when this happens so we can prevent OS-initiated click
        // since bloody Android doesn't obey this preventDefault
        // stop the default stuff happening (i.e. native click)
        event.preventDefault();
        // send a new click event manually
        var newEvent = document.createEvent('MouseEvents');
        newEvent.initMouseEvent('click', event.bubbles, event.cancelable, event.view, 
          event.detail, event.screenX, event.screenY, event.clientX, event.clientY, 
          event.ctrlKey, event.altKey, event.shiftKey, event.metaKey, 
          0, event.relatedTarget);
        event.currentTarget.dispatchEvent(newEvent);

        // TODO: code in Revok just did a preventDefault then the following:
        // privateMethods.handleClick.call(this, event);
        // need to check this out deeper
      }
      delete event.currentTarget.touchInfo;
    }
  };
  
  
  privateMethods.handleDOMModified = function handleDOMModified(event) {
    processOutlets.call(this, this.outlets);
    processActions.call(this, this.actions);
  };
  
  privateMethods.handleAnimationend = function handleAnimationend(event) {
    if (event.currentTarget.VPAnimating) {
      var appearing = event.currentTarget.appearing;
      if (!appearing) {
        event.currentTarget.parentNode.removeChild(event.currentTarget);
        delete event.currentTarget.removing;
      } else {
        delete event.currentTarget.appearing;
      }
      if (!appearing) {
        this.removeAnimation(event.currentTarget);
      }
      delete event.currentTarget.VPAnimating;
      this.sendEvent(appearing ? 'didAppear' : 'didDisappear', event.currentTarget);
    }
  };
  
  if (kAnimEndEventName && (kAnimEndEventName !== "animationend")) {
    privateMethods["handle" + kAnimEndEventName[0].toUpperCase() + kAnimEndEventName.slice(1)] = privateMethods.handleAnimationend;
  }
  
  
  // view stuff...
  
  Object.defineProperty(controller.prototype, 'parentElement', {
    get: function getParentElement() {
      if (this._parentElement) {
        return this._parentElement;
      } else {
        if (this.parentSelector) {
          this._parentElement = document.querySelector(this.parentSelector);
          if (!this._parentElement) {
            debug("parentElement not found - is parentSelector %o right?", this.parentSelector);
          }
        }
        // if there's no parentElement we default to body
        return this._parentElement || document.body;
      }
    },
    set: function setParentElement(view) {
      if (VPUtils.isString(view)) {
        var newView = document.querySelector(view);
        if (newView) {
          view = newView;
        } else {
          debug("warning: view not found when setting parentElement to %o", view);
          this._parentElement = null;
          this.parentSelector = view;
          return;
        }
      }
      this._parentElement = view;
    }
  });
  
  Object.defineProperty(controller.prototype, 'parentSelector', {
    get: function getParentSelector() {
      return this._parentSelector;
    },
    set: function setParentSelector(selector) {
      if (VPUtils.isString(selector)) {
        this._parentSelector = selector;
        this._parentElement = undefined;
        var els = document.querySelectorAll(selector);
        if (els.length !== 0) {
          if (els.length > 1) {
            debug("Warning: parentSelector %o set in controller %o: Multiple elements found with selector - using first", selector, this);
          }
          this._parentElement = els[0];
        }
      } else {
        throw new TypeError("parentSelector must be a selector string");
      }
    }
  });
  
  
  Object.defineProperty(controller.prototype, 'viewElement', {
    get: function getViewElement() {
      return this._viewElement;
    },
    set: function setViewElement(view) {
      var oldView = this._viewElement;
      if (oldView) {
        kDOMListeners.forEach(function(event) {
          oldView.removeEventListener(event, this, false);
        }, this);
      }
      if (VPUtils.isString(view)) {
        var newView = document.querySelector(view);
        if (newView) {
          view = newView;
        } else {
          debug("view not found when setting viewElement to %o", view);
          view = null;
        }
      }
      this._viewElement = view;
      // listen for DOM modification events
      if (view) {
        kDOMListeners.forEach(function(event) {
          this._viewElement.addEventListener(event, this, false);
        }, this);
      }
      processOutlets.call(this, this.outlets, oldView);
      oldView = null;
    }
  });
  
  Object.defineProperty(controller.prototype, 'view', {
    get: function getView() {
      if (!this.viewElement) {
        if (this.viewDefinition) {
          this.viewElement = VPUtils.buildElement(this.viewDefinition);
          this.viewElement = setViewParams.call(this, this.viewElement);
          this.addViewListeners(this.viewElement);
        } else {
          debug("no view element found - loading");
          this.viewElement = this.loadView(undefined, undefined, true);
        }
        if (this.viewElement) {
          this.sendEvent('didLoad', this.viewElement);
        }
      }
      return this.viewElement;
    },
    set: function setView(view) {
      // we don't support setting view this way - use viewElement instead
    }
  });
  
  Object.defineProperty(controller.prototype, 'visible', {
    get: function getVisible() {
      return (this.viewElement && this.viewElement.parentNode) != undefined;
    }
  });
  
  // reallyVisible is a convenience to deal with controllers hidden with display: none via CSS media queries
  Object.defineProperty(controller.prototype, 'reallyVisible', {
    get: function getReallyVisible() {
      var visible = this.visible;
      if (this.viewElement) {
        var style = window.getComputedStyle(this.viewElement);
        visible = style.getPropertyValue('display') != 'none';
      }
      return visible;
    }
  });

  // insert view into a target element
  controller.prototype.insertView = function insertView(view, parentElement, animation) {
    view = view || this.view;
    if (!view) {
      throw new TypeError("No view defined for this controller");
    }
    var parent = parentElement || this.parentElement;
    if (VPUtils.isString(parentElement)) {
      parent = document.querySelectorAll(parentElement);
      if (parent.length === 0) {
        throw new TypeError("Parent element selector '" + parentElement + "' not found");
      }
      if (parent.length > 1) {
        debug("Warning: insertView found multiple elements matching %o in controller %o", parentElement, this);
      }
      parent = parent[0];
    }
    
    if (view.removing || (view.parentNode !== parent)) {
      this.sendEvent('willAppear', view);
      
      delete view.removing;
      
      var animating = false;
      if (animation !== null) {
        animation = animation || this.showAnimation;
        if (VPUtils.isObject(animation)) {
          animating = animationExists(animation.name);
          if (animating) {
            this.setAnimation(view, animation);
            view.appearing = true;
          } else {
            debug("Warning: Duff animation definition %o when inserting view %o in controller %o", animation, view, this);
          }
        }
      }
      
      parent.appendChild(view);
      this.sendEvent('DOMModified', view);
      
      if (!animating) {
        this.sendEvent('didAppear', view);
      }
    } else {
      debug("Warning: view %o already inside parent in controller %o - ignoring", view, this);
    }
  };
  
  controller.prototype.removeView = function removeView(view, animation) {
    view = view || this.viewElement;
    if (view && view.parentNode) {
      this.sendEvent('willDisappear', view);
      
      delete view.appearing;
      
      var animating = false;
      if (animation !== null) {
        animation = animation || this.hideAnimation;
        if (VPUtils.isObject(animation)) {
          animating = animationExists(animation.name);
          if (animating) {
            view.removing = true;
            this.setAnimation(view, animation);
          } else {
            debug("Duff animation definition %o", animation);
          }
        }
      }
      
      if (!animating) {
        view.parentNode.removeChild(view);
        this.sendEvent('didDisappear', view);
      }
    } else {
      debug("removeView - view doesn't have a parentNode", view);
    }
  };

  // load a view file up and DOM-ify it
  controller.prototype.loadView = function loadView(file, options, noEvent) {
    var filename = file || ("views/" + (this.template ? this.template : this.name) + ".html");
    debug("Loading view, file %o", filename);
    
    var fail;
    var request = new XMLHttpRequest();
    request.open('GET', filename, false);
    try {
      request.send();
    } catch (e) {
      debug("XMLHttpRequest.send in loadView for filename %o failed in controller %o", filename, this);
      fail = true;
    }
    
    if (!fail && ((request.status <= 0 && request.responseText !== '') || request.status === 200)) {
      var el = document.createElement('div');
      el.innerHTML = request.responseText;
      el = setViewParams.call(this, el, file, options);
      this.addViewListeners(el);
      if (!noEvent) {
        this.sendEvent('didLoad', el);
      }
      return el;
    } else {
      debug("Failed to get view %o", file);
      return null;
    }
  };
  
  function setViewParams(el, file, options) {
    var id, style, classNames = [];
    if (!file) {
      if (this.viewID)        { id = this.viewID; }
      if (this.viewClassName) {
        this.viewClassName.split(/\s+/).forEach(function(className) {
          classNames.push(className);
        });
      }
    }
    if (VPUtils.isObject(options)) {
      if (options.id)         { id = options.id; }
      if (options.style)      { style = options.style; }
      if (options.className)  {
        options.className.split(/\s+/).forEach(function(className) {
          classNames.push(className);
        });
      }
    }
    if (id && el.querySelector('#' + id)) {
      el = el.querySelector('#' + id);
    }
    if (id)                       { el.id = id; }
    if (style)                    { el.style = options.style; };
    if (classNames.length !== 0)  {
      classNames.forEach(function(className) { el.classList.add(className); });
    }
    return el;
  };
  
  controller.prototype.addViewListeners = function addViewListeners(element) {
    kViewListeners.forEach(function(name) { element.addEventListener(name, this, false); }, this);
  };
  
  controller.prototype.removeViewListeners = function removeViewListeners(element) {
    kViewListeners.forEach(function(name) { element.removeEventListener(name, this, false); }, this);
  };
  
  controller.prototype.sendEvent = function sendEvent(eventName, element, params) {
    if (element) {
      if (!(element instanceof Element)) {
        debug("Warning: attempting to sendEvent, but view %o is not an element in controller %o", element, this);
        if (window.console && console.trace) {
          console.trace();
        }
      }
      
      var event = document.createEvent('Event');
      event.initEvent(eventName, true, true);
      // add in custom event stuff here
      for (var param in (params || {})) {
        if (params.hasOwnProperty(param)) {
          if (event[param] && VPUtils.isFunction(event[param])) {
            debug("Ignoring param key %o since it's an event function", param);
          } else {
            event[param] = params[param];
          }
        }
      }
      element.dispatchEvent(event);
    } else {
      debug("Warning: ignored attempt to send event %o without an element in controller %o", eventName, this);
    }
  };
  
  // cross-controller stuff
  controller.prototype.show = function show(options) {
    // show another controller
    // options control whether new controller's view replaces this one
    // or sits inside a sub-view
    
    // if no options provided, this is a show of current controller
    if (!options) {
      this.hideByReference(this.displayReference, true);
      if (Array.isArray(this.hideReferences)) {
        this.hideReferences.forEach(function(ref) {
          this.hideByReference(ref);
        }, this);
      }
      this.insertView();
      return;
    }
    
    // simplest options case
    // - 'options' as a string indicating new controller name - replace current controller
    var newController,
        controllerName,
        replaces = true,
        parentEl;
    
    if (VPUtils.isString(options)) {
      controllerName = options;
    } else if (VPUtils.isObject(options)) {
      controllerName = options.controller;
      replaces = !options.keepParent;
      parentEl = options.parentEl || options.parentElement;
    }
    newController = controllers[controllerName];
    
    if (!newController) {
      debug("Warning show: controller not found %o (called in controller %o)", options, this);
      return;
    }
    
    if (newController.overlay) {
      replaces = false;
    }
    
    if (options.setParentController) {
      replaces = false;
      newController.parentController = this;
    }
    
    if (options.displayReference) {
      if (newController.displayReference && (newController.displayReference !== options.displayReference)) {
        debug("warning: overriding old displayReference %o in controller %o with %o", newController.displayReference, newController, options.displayReference);
      }
      newController.displayReference = options.displayReference;
    }
    
    if (parentEl) {
      newController.parentElement = parentEl;
    }
    
    // Hmm - when to show new controller if we've got 'replace' turned on...
    // immediately, or when existing controller's view has gone?
    // going for former
    if (replaces) {
      this.removeView();
    }
    newController.show();
  };
  
  controller.prototype.hideByReference = function hideByReference(reference, ignoreThis, anim) {
    if (!reference) {
      return;
    }
    Object.keys(controllers).forEach(function(name) {
      var controller = controllers[name];
      if (controller.visible && (controller.displayReference == reference)) {
        if (!ignoreThis || this !== controller) {
          controller.removeView(undefined, anim);
        }
      }
    }, this);
  };
  
  // set an "alias" name for this controller
  controller.prototype.setAlias = function setAlias(name, override) {
    // set/add controller to the list
    var aliasedController = controller.getController(name);
    if (aliasedController && (aliasedController !== this)) {
      if (aliasedController.hasAlias(name)) {
        // this controller is an alias with the given name
        // if we're overriding then we remove that alias
        if (override) {
          aliasedController.removeAlias(name);
        } else {
          throw new Error("Alias already used");
        }
      } else {
        throw new Error("Alias name already used as a real controller name");
      }
    }
    
    if (!this.hasAlias(name)) {
      this.aliases.push(name);
    }
    
    controllers[name] = this;
  };
  
  controller.prototype.hasAlias = function hasAlias(name) {
    return this.aliases.indexOf(name) !== -1;
  };
  
  controller.prototype.removeAlias = function removeAlias(name) {
    if (this.hasAlias(name)) {
      this.aliases.splice(this.aliases.indexOf(name), 1);
    }
    if (controllers[name]) {
      delete controllers[name];
    }
  };
  
  // animation stuff
  controller.prototype.setAnimation = function setAnimation(view, animation) {
    // TODO: are we already animating? if so what do we do?
    // currently this scenario is ignored - we just blat the animation
    view.VPAnimating = true;
    view.style[Modernizr.prefixed("animationName")] = animation.name;
    view.style[Modernizr.prefixed("animationDuration")] = (animation.duration || 1) + 's';
    view.style[Modernizr.prefixed("animationDelay")] = (animation.delay || 0) + 's';
    view.style[Modernizr.prefixed("animationFillMode")] =
      animation.fillMode || (animation.delay && (animation.delay > 0)) ? "backwards" : "none";
    view.style[Modernizr.prefixed("animationTimingFunction")] = animation.timingFunction || "ease";
    view.addEventListener(kAnimEndEventName, this, false);
  };
  
  controller.prototype.removeAnimation = function removeAnimation(view) {
    view.removeEventListener(kAnimEndEventName, this, false);
    delete view.VPAnimating;
    kAnimStyles.forEach(function(style) {
      view.style.removeProperty(style);
    });
  };
  
  function animationExists(animName) {
    var found = false;
    if (animName) {
      var stylesheets = document.styleSheets;
      for (var i = 0; i < stylesheets.length; i++) {
        var sheet = stylesheets[i];
        var rules = sheet.cssRules;
        for (var j = 0; j < rules.length; j++) {
          var rule = rules[j];
          if ((rule.type === CSSRule.KEYFRAMES_RULE) || (rule.type === CSSRule.WEBKIT_KEYFRAMES_RULE) || (rule.type === CSSRule.MOZ_KEYFRAMES_RULE)) {
            if (rule.name === animName) {
              found = true;
              break;
            }
          }
        }
        if (found === true) {
          break;
        }
      }
    }
    return found;
  }
  
  
  // Low Memory condition handler - for controller classes to implement
  // NB this requires native code to call it
  controller.prototype._lowMemory = function _lowMemory() {
    // simplistic - if we're not visible then we can bin our view
    if (this.visible && !this.reallyVisible) {
      debug("View is not really visible");
      this.removeView(undefined, null);
    }
    
    if (!this.visible) {
      this.viewElement = null;
    }
  };
  
  // empty default function for controller implementations to override
  controller.prototype.lowMemory = function lowMemory() {};
  
  // Generic number padding method
  controller.prototype.padNum = function padNum(number, digits) {
    if (!VPUtils.isNumber(number)) {
      debug("Warning:   in padNum, number %o is not a number", number);
      number = 0;
    }
    
    if (!digits) {
      digits = 2;
    }
    
    var retNum = '';
    var workingNum = number;
    for (var i = 0; i < digits; i++) {
      var digit = workingNum % 10;
      workingNum = Math.floor(workingNum / 10);
      retNum = digit + retNum;
    }
    
    if (workingNum !== 0) {
      return number.toString();
    } else {
      return retNum;
    }
  };
  
  
  // global controller things
  controller.addController = function addController(name, controller) {
    if (name) {
      if (VPUtils.hasProperty(controllers, name)) {
        throw new TypeError("controller named " + name + " already exists");
      }
      controllers[name] = controller;
    } else {
      throw new TypeError("Cannot add controller without a name");
    }
  };
  
  controller.getController = function getController(name) {
    return controllers[name];
  };
  
  controller.getControllersByReference = function getControllerByReference(ref, onlyVisible) {
    var results = [];
    Object.keys(controllers).forEach(function(name) {
      var controller = controllers[name];
      if (controller.displayReference === ref) {
        if (onlyVisible) {
          if (controller.visible) {
            results.push(controller);
          }
        } else {
          results.push(controller);
        }
      }
    });

    return results;
  }
  
  controller.haveController = function haveController(name) {
    if (name) {
      return VPUtils.hasProperty(controllers, name);
    } else {
      return false;
    }
  };
  
  Object.defineProperty(controller, 'visible', {
    get: function getVisible() {
      // return the names of controllers that are visible
      var visible = [];
      
      Object.keys(controllers).forEach(function(name) {
        if (controllers[name].visible) {
          visible.push(name);
        }
      });
      
      return visible;
    }
  });
  
  // Methods to add remove VPController delegates
  controller.addDelegate = function addDelegate(delegate) {
    if (delegates.indexOf(delegate) === -1) {
      delegates.push(delegate);
    }
  };
  
  controller.removeDelegate = function removeDelegate(delegate) {
    var index = delegates.indexOf(delegate);
    if (index !== -1) {
      delegates.splice(index, 1);
    }
  };
  
  Object.defineProperty(controller, 'controllers', {
    get: function getControllers() {
      return controllers;
    }
  });
  
  // lowMemory signalling system
  // requires native code to call this
  controller.lowMemory = function lowMemory() {
    debug("Low memory signal received");
    for (var name in controllers) {
      debug("Sending lowMemory signals to %o", name);
      var controller = controllers[name];
      try {
        controller._lowMemory();
      } catch(e) {
        debug("_lowMemory error %o on controller %o", e, name);
      }
      try {
        controller.lowMemory();
      } catch(e) {
        debug("lowMemory error %o on controller %o", e, name);
      }
    }
  };
  
  controller.kAnimEndEventName = kAnimEndEventName;
  
  var startup = controller.startup = function startup() {
    // automatically show any controllers set to autoStart
    for (var name in controllers) {
      var controller = controllers[name];
      if (controller.autoStart) {
        controller.show();
      }
    }
  }
  
  function loaded() {
    if (window.iNativeApp) {
      window.setTimeout(function() {debug("we're native!"); }, 5000);
      debug("we're native");
      document.addEventListener('deviceready', startup, false);
    } else {
      window.setTimeout(function() {debug("not native, instantly firing startup"); }, 5000);
      window.setTimeout(startup, 100);
    }
  }
  
  window.addEventListener('DOMContentLoaded', loaded, false);
  
  return controller;
}());
VPUtils.nameMethods('VPController');
