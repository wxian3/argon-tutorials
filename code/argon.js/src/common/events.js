// Copyright 2015 Georgia Tech Research Corporation
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//    http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.
//
// This software was created as part of a research project at the
// Augmented Environments Lab at Georgia Tech.  To support our research, we
// request that if you make use of this software, you let us know how
// you used it by sending mail to Blair MacIntyre (blair@cc.gatech.edu).
//

var EventEmitter = require('famous/core/EventEmitter')
var EventHandler = require('famous/core/EventHandler')
var EventArbiter = require('famous/events/EventArbiter')
var EventFilter = require('famous/events/EventFilter')
var EventMapper = require('famous/events/EventMapper')

var asap = require('asap/browser-raw')

var setOutputHandler = EventHandler.setOutputHandler
EventHandler.setOutputHandler = function(obj, handler) {
  setOutputHandler(obj, handler)
  obj.once = function(type, handler) {
    obj.on(type, function onceHandler(e) {
      handler(e)
      obj.removeListener(type, onceHandler)
    })
  }
}

var removeListener = EventEmitter.prototype.removeListener
EventEmitter.prototype.removeListener = function(type, listener) {
  asap(function() { removeListener.call(this, type, listener) }.bind(this))
}


// re-export Famous event classes

module.exports =  { EventEmitter: EventEmitter
                  , EventHandler: EventHandler
                  , EventArbiter: EventArbiter
                  , EventFilter: EventFilter
                  , EventMapper: EventMapper
                  }
