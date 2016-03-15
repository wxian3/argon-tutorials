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

var deferredCapabilities = {}

export default function ready(capability) {
  if (!capability) return Promise.reject(new Error("capability is required"))
  if (!deferredCapabilities[capability]) deferredCapabilities[capability] = Promise.defer()
  return deferredCapabilities[capability].promise
}

// @param {(Array.<string>|string)} capabilities
export function setReady(capabilities) {
  if (!Array.isArray(capabilities)) capabilities = [capabilities]

  capabilities.forEach(function(c) {
    if (!deferredCapabilities[c]) deferredCapabilities[c] = Promise.defer()
    deferredCapabilities[c].resolve()
  })
}

// @param {(Array.<string>|string)} capabilities
export function setUnavailable(capabilities) {
  if (!Array.isArray(capabilities)) capabilities = [capabilities]

  capabilities.forEach(function(c) {
    deferredCapabilities[c].reject(new Error(c + ' capability is not available on this platform'))
  })
}

export function getCapabilities() {
  return Object.keys(deferredCapabilities).map(function(k) {
    var capability = deferredCapabilities[k].promise
    return (!capability.isPending) ? capability.value() : undefined
  })
}

setTimeout(function() {
  if (window.Argon_CAPABILITIES) setReady(window.Argon_CAPABILITIES)
}, 0)
