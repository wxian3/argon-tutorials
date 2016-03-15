'use strict';

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

var EventMapper = require('./events').EventMapper
var EventHandler = require('./events').EventHandler
var EventFilter = require('./events').EventFilter

/**
 * An input & output event mapper/filter.
 * @private
 */
function EventPort(inputHandler, outputHandler) {
  this.input = this._eventInput = new EventHandler
  this.input.subscribe = false
  this.output = this._eventOutput = new EventHandler
  EventHandler.setInputHandler(this, this.input)
  EventHandler.setOutputHandler(this, this.output)
  this.emit = this.trigger
  if (inputHandler) this.input.pipe(inputHandler)
  if (outputHandler) this.output.pipe(outputHandler)
}

module.exports = EventPort
