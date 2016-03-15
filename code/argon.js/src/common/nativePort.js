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

import EventPort from './EventPort'
import Promise from 'bluebird'

// native <-> channel manager communication

const nativePort = new EventPort
const requests = {}

nativePort.afterResponse = function(requestId) {
  var deferred = Promise.defer()
  requests[requestId] = deferred
  return deferred.promise
}

nativePort.on('RESPONSE', function responseHandler(e) {
  let requestId = e.userData
  let request = requests[requestId]
  if (request) {
    delete requests[requestId]
    if (e.eventInfo && e.eventInfo.error) {
      console.log('native error: ' + JSON.stringify(e.eventInfo.error))
      var err = new Error(JSON.stringify(e.eventInfo.error))
      return request.reject(err)
    }
    return request.resolve(e.eventInfo)
  }
})

var readyDeferred = Promise.defer()
nativePort.whenReady = readyDeferred.promise

nativePort.on('pluginsReady', function() {
  readyDeferred.resolve()
})

export default nativePort
