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

var EventPort = require('./EventPort')
var EventHandler = require('./events').EventHandler
var Util = require('./Util')
var VersionTransformer = require('./VersionTransformer')
var asap = require('asap/browser-raw')
var Promise = require('bluebird')
var {getCapabilities} = require('./ready')

var ArgonSemver = require('./version').semver
var ArgonVersion = require('./version').version

var CSSClass = 'argon-channel'

class Channel {

  constructor(options={}) {

    this.id = Util.cuid()
    Channel.collection[this.id] = this
    Util.mixinInputOutputEventHandlers(this)

    this._url = null
    this._history = []
    this._messagePort = null

    this.port = new EventPort(_sendToChannel.bind(this), function output(type, event) {
      Channel.port.output.emit(type, event)
      return true
    }.bind(this))

    this.element = options.element || document.createElement('iframe')
    this.element.webkitallowfullscreen = false
    this.element.sandbox = 'allow-forms allow-scripts allow-same-origin'
    this.element.classList.add(CSSClass)
    this.element.id = CSSClass + '-' + this.id
    this.element.channel = this

    if (!options.element) {
      var container = document.documentElement
      if (options && options.container) container = options.container
      container.appendChild(this.element)
    }

    // 'unload' event from argon.js
    this.port.on('unload', _unload.bind(this))
    this.element.onload = _load.bind(this)
    this.loaded = false
    this.inLoad = false

    if (options.src) this.setURL(options.src)

    this.on('connect', () => {
      if (this._hasFocus) {
        this.port.trigger('focus')
      } else {
        this.port.trigger('blur')
      }
    })
  }

  setURL(url) {
    asap(() => {
      _setURL.call(this, url)
      if (this._url) {
        this.element.src = this._url
      } else {
        this.element.src = 'about:blank'
      }
      this._waitingForLoad = true
    })
  }

  setSrcDoc(doc) {
    asap(() => {
      _setURL.call(this, ' ')
      this.element.src = undefined
      this.element.srcdoc = doc
      this._waitingForLoad = true
    })
  }

  getURL() {
    return this._url
  }

  getHistory() {
    return this._history
  }

  focus() {
    this._hasFocus = true
    for (var id in Channel.collection) {
      var channel = Channel.collection[id]
      if (this !== channel) {
        channel._hasFocus = false
        channel.port.trigger('blur')
        channel._emit('blur')
      }
    }
    Channel.focussedChannel = this
    this.port.trigger('focus')
    this._emit('focus')
    Channel.events.emit('focus', this)
  }

  whenFocussed() {
    var deferred = Promise.defer()
    if (this._hasFocus) {
      deferred.resolve()
    } else {
      this.once('focus', () => {
        deferred.resolve()
      })
    }
    return deferred.promise
  }

  get hasFocus() {
    return this._hasFocus
  }

  destroy() {
    _unload.call(this)
    delete Channel.collection[this.id]
    if (this.element.parentNode)
      this.element.parentNode.removeChild(this.element)
  }

}

Channel.collection = {}
Channel.eventMap = new WeakMap
Channel.events = new EventHandler()
Channel.focussedChannel = undefined

Channel.hideBlurredChannels = function() {
  for (const id in Channel.collection) {
    const c = Channel.collection[id]
    if (!c.hasFocus) c.element.style.display = 'none'
  }
}

Channel.showAllChannels = function() {
  for (const id in Channel.collection) {
    const c = Channel.collection[id]
    c.element.style.display = ''
  }
}

// channel manager <-> channel communication
Channel.port = new EventPort
Channel.port.input.pipe(function(type, event) {
  for (var id in Channel.collection) {
    Channel.collection[id].port.trigger(type, event)
  }
})

Channel.requestHandler = {}

Channel.port.on('REQUEST', function(request) {
  var channel = Channel.eventMap.get(request)
  if (Channel.requestHandler[request.type]) {
    Promise.resolve({channel, data: request.event})
    .then(Channel.requestHandler[request.type])
    .then(function(e) {
      channel.port.trigger('RESPONSE', {id: request.id, resolve: e})
    }).catch(function(e) {
      var reason = e.toJSON ? e.toJSON() : e
      channel.port.trigger('RESPONSE', {id: request.id, reject: reason})
    })
  } else {
    channel.port.trigger('RESPONSE', {id: request.id, reject:{message: 'unhandled request'}})
  }
})

function _unload() {
  if (!this.loaded) return
  if (this._messagePort) this._messagePort.close()
  this._messagePort = null
  this._messageQueue = []
  this._url = null
  this.version = null
  this.semver = null
  this._emit('unload')
  Channel.events.emit('unload', this)
  this.loaded = false
}

function _load() {
  this.inLoad = true
  _unload.call(this)
  if (this._waitingForLoad) {
    // this page load was expected
    this._waitingForLoad = false
  } else {
    // this page load was not expected
    // (we do not know where we are now)
    _setURL.call(this, '***')
  }
  this.loaded = true
  this._emit('load')
  Channel.events.emit('load', {channel: this})
  // if we already have focus, then send focus events again
  if (this._hasFocus) this.focus()
  this.inLoad = false
}

function _parseVersion(version) {
  var tokens = version.split('.')
  return {
    major: tokens[0],
    minor: tokens[1],
    patch: tokens[2]
  }
}

function _onconnect(channelInfo) {
  this.version = channelInfo.ARGON_VERSION_STRING
  this.semver = _parseVersion(this.version)

  // TODO: Once argon.js is beyond major version 0, only
  // check major & minor versions here. Also, maybe should
  // use a semver library for comparing semvers.
  // TODO: backwards compatability
  if (this.semver.major > ArgonSemver.major ||
      this.semver.minor > ArgonSemver.minor ||
      this.semver.patch > ArgonSemver.patch) {
    alert('The channel at ' + this._url + ' requires a newer version of Argon (' + this.version + '). You are currently running version ' + ArgonVersion + '. Please update Argon in order to open this channel.')
    _unload.call(this)
    _setURL.call(this, null)
    return
  } else if (this.semver.major < ArgonSemver.major ||
             this.semver.minor < ArgonSemver.minor ||
             this.semver.patch < ArgonSemver.patch) {
    alert('The channel at ' + this._url + ' uses an older version argon.js, which may not work be compatible with your version of Argon ('+ArgonVersion+'). Please update the channel to the latest argon.js')
    _unload.call(this)
    _setURL.call(this, null)
    return
  }

  _setURL.call(this, channelInfo.ARGON_URL)

  var mc = new MessageChannel()
  var connectMessage = {msg:'ARGON_CONNECT', capabilities: getCapabilities(), focus: this.hasFocus}
  this.element.contentWindow.postMessage(connectMessage, '*', [mc.port2])
  this._messagePort = mc.port1

  this._messagePort.onmessage = (message) => {
    var data = message.data
    var event = data.event || {}
    // associate the event to the source channel via a weakmap
    Channel.eventMap.set(event, this)
    this.port.output.emit(data.type, event)
  }

}

function _sendToChannel(type, event) {
  if (!this._messagePort) return
  // transform outgoing messages for backwards compatability
  var message = VersionTransformer.toChannel(type, event, this.semver)
  this._messagePort.postMessage(message)
  // TODO: In iOS 8, with native WKWebview APIs, we should be able to detect
  // iframe navigation, and then we can notify the appropriate channel.
}

function _setURL(url) {
  if (this._url != url) {
    if (url && url !== '***') this._history.push(url)
    this._url = url
    this._emit('navigation', {url: this._url})
  }
}

window.addEventListener('message', function (event) {
  if (event.data.ARGON_URL) {
    for (var i in Channel.collection) {
      var channel = Channel.collection[i]
      if (channel.element.contentWindow === event.source) {
        _onconnect.call(channel, event.data)
        channel._emit('connect')
        Channel.events.emit('connection', channel)
        return
      }
    }
  }
}, true)

module.exports = Channel
