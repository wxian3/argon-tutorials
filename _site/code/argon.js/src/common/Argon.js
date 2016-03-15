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
//
// @module Argon
//

var Argon = module.exports = {}

Argon.version = require('./version').version
Argon.semver = require('./version').semver

// XXX: oasis.js exports Oasis, oasis, and RSVP on the global object
// Argon._oasisScript = require('raw!oasis.min')
// new Function(Argon._oasisScript).call(window)

// XXX: basket.js exports basket on the global object
Argon._basketScript = require('raw!basket.js/dist/basket.full.min')
new Function(Argon._basketScript).call(window)

Argon.Promise = require('bluebird')
Argon.Promise.onPossiblyUnhandledRejection(function(e) {
  console.error(e.message + e.stack)
})

Argon.alert = require('./alert')

var events = require('./events')
Argon.Util = require('./Util')
Argon.Util.mixinEventHandler(Argon)
Argon.EventHandler = events.EventHandler
Argon.EventMapper = events.EventMapper
Argon.EventFilter = events.EventFilter
Argon.EventPort = require('./EventPort')

Argon.Cesium          = require('./cesium/CesiumImports')
require('./cesium/SampledProperty#removeBeforeDate')

Argon.Platform        = require('./Platform')
Argon.Context         = require('./Context')
Argon.Reality      = require('./Reality')
Argon.RealityView  = require('./RealityView')

Argon.dataSource       = require('./dataSource')
Argon.immersiveContext = require('./immersiveContext')

Argon.Vuforia         = require('./Vuforia')

require('./realities/Color')
require('./realities/Panorama')

Argon.getPresentationMode = () => {
  return Argon.immersiveContext.options.presentationMode
}
Argon.setPresentationMode = mode => {
  if (mode === 'page' && Argon.isPageModeAvailable() === false) return
  Argon.immersiveContext.set('presentationMode', mode)
}
Argon.isPageModeAvailable = function(mode) {
  return Argon.immersiveContext.options.pageModeAvailable
}


if (Argon.Platform.isManager) {
  Argon.Channel = require('./Channel')
  Argon.channels = Argon.Channel.collection
  Argon.policy = require('./policy')
  Argon.nativePort = require('./nativePort')
} else {
  Argon.ready = require('./ready').default
  Argon.setReady = require('./ready').setReady
  Argon.setUnavailable = require('./ready').setUnavailable
  Argon.managerPort = require('./managerPort')
}

require('array.prototype.find')
require('./ErrorToJSON')
