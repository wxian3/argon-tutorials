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
import Util from './Util'
import EventPort from './EventPort'
import Cesium from './cesium/CesiumImports'
import dataSource from './dataSource'
import Vuforia from './Vuforia'
import {isManager} from './Platform'

const Quaternion = Cesium.Quaternion
const ReferenceFrame = Cesium.ReferenceFrame
const CesiumMath = Cesium.Math
const JulianDate = Cesium.JulianDate
const Transforms = Cesium.Transforms
const CSSClass = 'argon-reality'

const scratchMatrix4 = new Cesium.Matrix4
const scratchMatrix3 = new Cesium.Matrix3

class RealityView {

  constructor(args) {
    Util.mixinInputOutputEventHandlers(this)

    // XXX: allow-same-origin creates a security hole here.
    // need to switch to something like oasis.js for iframe messaging
    this.element = document.createElement('iframe')
    this.element.sandbox = 'allow-scripts allow-same-origin'
    this.element.classList.add(CSSClass)
    this.element.style.position = 'absolute'
    this.element.style.height = '100%'
    this.element.style.width = '100%'
    this.element.style.left = 0
    this.element.style.top = 0
    this.element.style.margin = 0
    this.element.style.zIndex = -2
    this.element.style.border = 0
    this.element.style.pointerEvents = 'none'
    this.element.argonRealityView = this

    // workaround for bug with copy/paste menu over an iframe in UIWebView
    // (I think we can remove the overlayElement when we switch to WKWebView)
    this.overlayElement = document.createElement('div')
    this.overlayElement.style.position = 'absolute'
    this.overlayElement.style.height = '100%'
    this.overlayElement.style.width = '100%'
    this.overlayElement.style.left = 0
    this.overlayElement.style.top = 0
    this.overlayElement.style.zIndex = -1
    this.overlayElement.style.pointerEvents = 'none'

    this.container = (args && args.container) || document.documentElement

    this.resources = null

    this.renderPort = new EventPort
    this.renderPort.input.pipe( (type, event) => {
      var contentWindow = this.element.contentWindow
      if (contentWindow && this.renderPort.connected) {
        var listeners = contentWindow.__listeners[type]
        if (listeners) {
          for (var i=0; i<listeners.length; i++) {
            listeners[i].call(null, event)
          }
        }
      }
    })

    window.addEventListener('message', message => {
      if (message.data._key === this._key) {
        var type = message.data.type
        var event = message.data.event
        if (type === 'connect') {
          this.renderPort.connected = true
          try {
            this.renderPort.input.emit('startRenderScript')
          } catch (e) {
            this._deferredReady.reject(e)
          }
        }
        if (type === 'ready') { this._deferredReady.resolve() }
        this.renderPort.output.emit(type, event)
      }
    })

    this.defaultEyeFrustum = new Cesium.PerspectiveFrustum
    this.defaultEyeFrustum.fov         = Math.PI * 0.4
    this.defaultEyeFrustum.near        = 0.0001
    this.defaultEyeFrustum.far         = 100000000.0

    this._frameState = {
      frameNumber: 0,
      time: undefined,
      referenceFrame: undefined,
      position: {
        cartesian: {},
        cartographicDegrees: {}
      },
      orientation: {
        unitQuaternion: {},
        unitQuaternionRelative: {}
      },
      frustum: undefined,
      reality: undefined
    }

    this._enabled = true
  }

  /**
   * When the reality view is enabled, it becomes responsible
   * for calculating the frameState and rendering it's background,
   * Otherwise, the reality view is effectively does nothing,
   * which means any context that was listening to this reality view
   * should be updated externally. The immersiveContext has a disabled
   * reality view when running in a multi-channel environment, and is updated
   * by the manager.
   * @type {Boolean}
   */
  set enabled(flag) {
    if (this._enabled !== flag) {
      this._enabled = flag
      this._commit()
    }
  }

  get enabled() {
    return this._enabled
  }

  resize(size) {
    // if (isManager && Vuforia.reality && Vuforia.reality.frustum) {
    //   this.defaultEyeFrustum = Vuforia.reality.frustum
    // } else {
      this.defaultEyeFrustum.aspectRatio = size[0]/size[1]
    // }
  }

  setReality(reality) {
    var previousReality = this._reality
    if (previousReality) {
      previousReality.removeListener('message', this._realityMessageListener)
      previousReality.removeListener('change', this._realityOptionsChangeListener)
      previousReality.removeListener('tick', this._realityTickListener)
      previousReality.enabled = false
    }

    if (!reality) {
      this.resources = null
      return this._commit()
    }

    reality.enabled = true
    this._reality = reality
    this._setJSResources(reality.getJSResources())
    this._setCSSResources(reality.getCSSResources())
    this._setRenderScript(reality.renderScript)

    this._realityMessageListener = message => {
      if (!this._enabled) return
      this.renderPort.input.emit('message', message)
    }

    this._realityOptionsChangeListener = () => {
      this._sendRealityOptions()
    }

    this._realityTickListener = event => {
      if (!this._enabled) return

      const time = event.time
      const eye = reality.eye

      const rootFrame = Util.rootReferenceFrame(eye)
      const frustum = reality.frustum || this.defaultEyeFrustum

      const frameState = this._frameState
      frameState.frameNumber = CesiumMath.incrementWrap(frameState.frameNumber, 15000000.0, 1.0)
      frameState.time = JulianDate.clone(time, frameState.time)

      if (rootFrame === ReferenceFrame.FIXED) {
        frameState.referenceFrame = ReferenceFrame.FIXED
      } else if (rootFrame.id) {
        frameState.referenceFrame = {id: rootFrame.id}
      } else {
        throw new Error('Unsupported root reference frame: ' + rootFrame)
      }

      // position.cartesian
      const cartesian = frameState.position.cartesian =
        Util.getEntityPositionInReferenceFrame(eye, time, rootFrame, frameState.position.cartesian)
      if (!cartesian) return

      // orientation.unitQuaternion
      const unitQuaternion = frameState.orientation.unitQuaternion =
        Util.getEntityOrientationInReferenceFrame(eye, time, rootFrame, frameState.orientation.unitQuaternion)
      if (!unitQuaternion) return

      // position.cartographicDegrees [long, lat, height]
      if (rootFrame === ReferenceFrame.FIXED) {
        var cart = Cesium.Ellipsoid.WGS84.cartesianToCartographic(cartesian, frameState.position.cartographicDegrees)
        frameState.position.cartographicDegrees = [CesiumMath.toDegrees(cart.longitude), CesiumMath.toDegrees(cart.latitude), cart.height]
      } else {
        frameState.position.cartographicDegrees = undefined
      }

      // orientation.unitQuaternionRelative (orientation relative to the local ENU frame)
      if (rootFrame === ReferenceFrame.FIXED) {
        const enuQuaternion = Transforms.headingPitchRollQuaternion(cartesian, 0,0,0, undefined, frameState.orientation.unitQuaternionRelative)
        const invEnuQuaternion = Quaternion.conjugate(enuQuaternion, enuQuaternion)
        frameState.orientation.unitQuaternionRealtive = Quaternion.multiply(invEnuQuaternion, unitQuaternion, invEnuQuaternion)
      } else {
        frameState.orientation.unitQuaternionRelative = Quaternion.clone(unitQuaternion, frameState.orientation.unitQuaternionRelative)
      }

      frameState.frustum = {fov: frustum.fov, fovy: frustum.fovy, aspectRatio: frustum.aspectRatio}
      frameState.reality = {id: reality.id}

      this.renderPort.input.emit('update', frameState)
      this._emit('update', frameState)
    }

    reality.on('message', this._realityMessageListener)
    reality.on('options', this._realityOptionsChangeListener)
    reality.on('tick', this._realityTickListener)

    return this._commit()
  }

  getReality() {
    return this._reality
  }

  _sendRealityOptions() {
    if (!this._enabled || !this._reality) return
    this.renderPort.input.emit('options', this._reality.options)
  }

  _setCSSResources(cssResources) {
    this.resources = this.resources || {}
    this.resources.css = cssResources
  }

  _setJSResources(jsResources) {
    this.resources = this.resources || {}
    this.resources.js = jsResources
  }

  _setRenderScript(script) {
    this.resources = this.resources || {}
    this.resources.renderScript = script || function() {}
  }

  _commit() {
    if (this._commitPromise && this._commitPromise.isPending())
      this._commitPromise.cancel()

    if (!this.resources || !this._enabled) {
      this.detach()
      return Promise.resolve()
    }

    var resources = [
      this.resources.css,
      this.resources.js,
      this.resources.renderScript
    ]

    this._commitPromise = Promise.all(resources).then( resources => {
      _commitContent.call(this, resources[0], resources[1], resources[2])
      this._deferredReady = Promise.defer()
      return this._deferredReady.promise
    }).then( () => {
      this._sendRealityOptions()
    }).cancellable().catch(Promise.CancellationError, ()=>{})

    return this._commitPromise
  }

  detach() {
    if (this.element.parentNode)
      this.element.parentNode.removeChild(this.element)
  }

}

export default RealityView

var beginScript = '<scr'+'ipt>'
var endScript = '</scr'+'ipt>'

var _commitContent = function(cssResources, jsResources, renderScript) {

  this._key = Util.cuid()

  var content = []

  content.push('<!DOCTYPE html>')

  if (cssResources) cssResources.forEach( css => {
    content.push('<st'+'yle>' + css + '</sty'+'le>') // transpiler parsers were confused
  })

  content.push(beginScript)
  content.push('window.__key = "' + this._key + '"')
  content.push('document.documentElement.style.position = "fixed"')
  content.push('document.documentElement.style.width = "100%"')
  content.push('document.documentElement.style.height = "100%"')
  content.push(endScript)

  content.push('<body></body>')

  if (jsResources) jsResources.forEach( js => {
    content.push(beginScript + js + endScript)
  })

  content.push(beginScript)
  content.push('window.__listeners = {}')
  content.push('var port = {}')
  content.push('port.on = function(type, listener) { __listeners[type] = __listeners[type] || []; __listeners[type].push(listener) }')
  content.push('port.emit = function(type, listener) { window.parent.postMessage({_key:__key, type:type, event:event}, "*") }')
  content.push('port.on("startRenderScript", function() { (' + renderScript + ')(port); port.emit("ready") })')
  content.push('port.emit("connect")')
  content.push(endScript)

  this.renderPort.connected = false
  var b = new Blob([content.join('\n')], { type: 'text/html' })
  this.element.src = URL.createObjectURL(b)
  // this.element.srcdoc = content.join('\n')

  if (!this.element.parentNode) {
    this.container.appendChild(this.element)
    this.container.appendChild(this.overlayElement)
  }

  basket.clear(true) // clear expired files
}
