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

// handles channelManager <-> channel communication
import Promise from 'bluebird'
import EventPort from './EventPort'
import Util from './Util'
import {isChannel, isRunningInIFrame} from './Platform'
import {setReady} from './ready'

var managerPort

if (isChannel) {
  managerPort = new EventPort
  var _messagePort = null

  var connectDeferred = Promise.defer()
  managerPort.whenConnected = connectDeferred.promise
  managerPort.isConnected = false

  managerPort.input.pipe(function(type, event) {
    if (managerPort.isConnected) {
      if (_messagePort) _messagePort.postMessage({type, event})
    } else {
      managerPort.whenConnected.then(function() {
        managerPort.trigger(type, event)
      })
    }
  })

  managerPort.requests = {}

  managerPort.request = function(type, event) {
    var deferred = Promise.defer()
    var id = Util.cuid()
    managerPort.requests[id] = deferred
    managerPort.trigger('REQUEST', {type, event, id})
    return deferred.promise
  }

  // used by our remote debugger to simulate a connection with the manager
  managerPort.connect = function(config={}) {
    setReady(config.capabilities)
    managerPort.isConnected = true
    connectDeferred.resolve(config)
  }

  managerPort.on('RESPONSE', function onRESPONSE(e) {
    var deferred = managerPort.requests[e.id]
    if (!deferred) {
      console.warn("Unknown RESPONSE received: " + JSON.stringify(e))
      return
    }
    delete managerPort.requests[e.id]
    if (e.reject) {
      const err = new Error(e.reject.message || e.reject.description || e.reject)
      if (e.reject.stack) err.stack = e.reject.stack
      deferred.reject(err)
    }
    else deferred.resolve(e.resolve)
  })

  window.addEventListener('message',function(messageEvent) {
    if( messageEvent.data.msg === 'ARGON_CONNECT' ) {
      _messagePort = messageEvent.ports[0]
      _messagePort.onmessage = function(event) {
        _onmessage(event.data)
      }
      managerPort.connect(messageEvent.data.capabilities)
    }
  },false)

  window.addEventListener('unload', function(event) {
    managerPort.trigger('unload')
  })

  function _onmessage(message) {
    if (message.type === 'MESSAGE_QUEUE') {
      var queue = message.event
      for (var i in queue) {
        var m = queue[i]
        managerPort.output.emit(m.type, m.event)
      }
    } else {
      managerPort.output.emit(message.type, message.event)
    }
  }

}


export default managerPort
