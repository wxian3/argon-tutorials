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

import Promise from 'bluebird'

window.__ARGON_CHANNEL = true
var Argon = module.exports = require('../')

// Let Argon Channel Manager know that this is an Argon channel (vs a regular webpage).
if (document.readyState === 'complete') {
  notifyParent()
} else {
  window.addEventListener('load', function load() {
    notifyParent()
  }, false)
}

function notifyParent() {
  window.parent.postMessage({
    ARGON_URL: window.location.href,
    ARGON_VERSION_STRING: Argon.version
  }, '*')
}

var _channelHasFocus = false
Object.defineProperty(Argon, 'channelHasFocus', {
  get: function() {
    return _channelHasFocus
  }
})

function _setFocus(bool) {
  if (bool && !_channelHasFocus) {
    _channelHasFocus = true
    Argon.emit('focus')
  } else if (!bool && _channelHasFocus) {
    _channelHasFocus = false
    Argon.emit('blur')
  }
}

Argon.managerPort.on('focus', function() {
  _setFocus(true)
})

Argon.managerPort.on('blur', function() {
  _setFocus(false)
})

Argon.managerPort.whenConnected.then(e => {
  _setFocus(e.focus)
  Argon.emit('connect')
}).timeout(500).catch(error => {
  if (!Argon.Platform.isRunningInArgonApp && !Argon.managerPort.isConnected)
    _setFocus(true)
})
