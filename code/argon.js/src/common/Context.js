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

import {isChannel, isManager} from './Platform'
import Reality from './Reality'
import RealityView from './RealityView'
import Util from './Util'
import Cesium from './cesium/CesiumImports'
import Promise from 'bluebird'
import dataSource from './dataSource'
import 'javascript-detect-element-resize'

const Matrix3 = Cesium.Matrix3
const Matrix4 = Cesium.Matrix4
const Transforms = Cesium.Transforms
const Cartesian3 = Cesium.Cartesian3
const Quaternion = Cesium.Quaternion
const JulianDate = Cesium.JulianDate
const OrientationProperty = Cesium.OrientationProperty
const ReferenceFrame = Cesium.ReferenceFrame
const getValueOrUndefined = Cesium.Property.getValueOrUndefined
const defined = Cesium.defined
const defaultValue = Cesium.defaultValue

const scratchMatrix3 = new Cesium.Matrix3
const scratchMatrix4 = new Matrix4
const scratchCartesian3 = new Cartesian3
const scratchQuaternion = new Quaternion
const scratchOriginCartesian3 = new Cartesian3

function framesEqual(frame1, frame2) {
  return frame1 && frame1.id ?
      frame1.id === (frame2 && frame2.id) :
      frame1 === frame2;
}

function rootReferenceFrame(frame) {
    var frames = [];
    while (defined(frame) && frame !== null) {
        frames.unshift(frame);
        frame = frame.position && frame.position.referenceFrame;
    }
    return frames[0];
}

/**
 * @class Argon.Context
 * @description Contexts are 2D regions of 3D graphics registered
 * against a representation of reality.
 */
class Context {

  constructor(args) {

    this.id = Util.cuid()
    Util.mixinInputOutputEventHandlers(this)
    Util.mixinOptionsManager(this)
    Context.collection[this.id] = this

    /**
     * This context's DOM element
     * @type Element
     */
    this.element = document.createElement('div')
    this.element.classList.add('argon-context')
    this.element.style.position = 'absolute'
    this.element.style.height = '100%'
    this.element.style.width = '100%'
    this.element.style.left = 0
    this.element.style.top = 0
    this.element.style.margin = 0
    this.element.style.zIndex = -1

    // By default, the containing element is the documentElement
    var container = document.documentElement
    if (args && args.container) container = args.container
    container.appendChild(this.element)

    // the eye (a.k.a. the camera)
    // The scene is always rendered from this viewpoint.
    this.eye = new Cesium.Entity({
      name: 'eye',
      position: new Cesium.ConstantPositionProperty(),
      orientation: new Cesium.ConstantProperty()
    })

    // an origin centered at the eye, in the North-East-Up
    // coordinate system
    this.eyeOrigin = new Cesium.Entity({
      name: 'eyeOrigin',
      position: new Cesium.ConstantPositionProperty(),
      orientation: new Cesium.ConstantProperty()
    })

    // an origin near the eye which doesn't change very often,
    // in the North-East-Up coordinate system
    this.localOrigin = new Cesium.Entity({
      name: 'origin',
      position: new Cesium.ConstantPositionProperty(),
      orientation: new Cesium.ConstantProperty()
    })

    // the localOrigin rotated by 90° around X such that it is
    // in the East-Up-South coordinate system.
    // This is useful for converting to the Y-Up convention
    // in some libraries, such as three.js.
    this.localOriginEastUpSouth = new Cesium.Entity({
      name: 'originEastUpSouth',
      position: new Cesium.ConstantPositionProperty(Cesium.Cartesian3.ZERO, this.localOrigin),
      orientation: new Cesium.ConstantProperty(Quaternion.fromAxisAngle(Cartesian3.UNIT_X, -Math.PI/2))
      // XXX: Gheric - I'm a bit confused here... I feel like the sign should be positive due to
      // right hand rule, but then y appears to be upside-down on desktop..
    })

    // The fov, aspectRatio, and projection matrix of the eye
    this.frustum = new Cesium.PerspectiveFrustum

    // The realityView is responsible for rendering the requested reality
    // While running in a multi-channel environment, the realityView is
    // disabled for each channel's immersiveContext, with the manager instead
    // supplying it's own realityView which is rendered behind all other
    // channels (while Argon takes responsibility for updating each
    // channel's immersiveContext)
    this.realityView = new RealityView
    this.element.appendChild(this.realityView.element)
    this.realityView.on('update', this.update.bind(this))
    this._currentReality = undefined

    // Each channel can provide a set of capabilities and referenceFrames
    // it requires (the manager will try to provide these, but there
    // is no gaurantee)
    this._requiredCapabilities = undefined
    this._requiredReferenceFrames = undefined

    this.resize()

    // seal for better debugging
    if (args && args.seal !== false) {
      Object.seal(this)
      Object.seal(this.realityView)
    }

    this.setRequiredReality(undefined)
  }

  /**
   * Called interally, either in response to this context's realityView
   * `update` event, or (in the case of the immersiveContext), in response to the
   * manager's `update` event
   */
  update(frameState) {
    // frameState is associated with the currently displayed reality,
    // which is not necessarily this context's required reality.
    const time = frameState.time
    const position = frameState.position.cartesian
    const orientation = frameState.orientation.unitQuaternion

    // frameState.referenceFrame refers to the root referenceFrame  of the
    // current reality's eye, which is either going to be the FIXED frame
    // (usually) or an Entity (which itself would have a null referenceFrame)
    const frameStateReferenceFrame = frameState.referenceFrame
    let frame = this.eye.position.referenceFrame
    if (!framesEqual(frame, frameStateReferenceFrame)) {
      if (frameStateReferenceFrame.id)
        frame = new Cesium.ReferenceEntity(dataSource.entities, frameStateReferenceFrame.id)
      else
        frame = frameStateReferenceFrame
    }

    this.eye.position.setValue(position, frame)
    this.eye.orientation.setValue(orientation)
    this.eyeOrigin.position.setValue(position, frame)
    this.frustum.fov = frameState.frustum.fov
    this.frustum.aspectRatio = frameState.frustum.aspectRatio
    this._updateOrigin(time, position, frame)

    const previousReality = this._currentReality
    const currentReality = frameState.reality
    if (!previousReality || previousReality.id != currentReality.id) {
      const realityInstance = Reality.getById(currentReality.id)
      this._currentReality = realityInstance || currentReality
      this._emit('realityChange', {reality: this._currentReality, previousReality})
    }

    // if we receive an update from a reality that is not our required reality,
    // then we assume there is a global reality view updating this context,
    // and we disable our local reality view.
    if (this.realityView.enabled) {
      const requiredReality = this.getRequiredReality()
      if (requiredReality && requiredReality.id != currentReality.id) {
        this.realityView.enabled = false
      }
    }

    this._emit('update', frameState)
  }

  _updateOrigin(time, position, frame) {
    const originFrame = this.localOrigin.position.referenceFrame
    const originPosition = this.localOrigin.position.getValueInReferenceFrame(time, originFrame, scratchOriginCartesian3)
    if (!originPosition || originFrame !== frame || Cartesian3.magnitudeSquared(Cartesian3.subtract(position, originPosition, scratchOriginCartesian3)) > 25000000) {
      if (frame === ReferenceFrame.FIXED) {
        if (Cartesian3.equals(Cartesian3.ZERO, position)) throw new Error('invalid cartographic position')
        const enuQuaternion = Transforms.headingPitchRollQuaternion(position, 0,0,0, undefined, scratchQuaternion)
        this.localOrigin.position.setValue(position, frame)
        this.localOrigin.orientation.setValue(enuQuaternion)
      } else {
        this.localOrigin.position.setValue(Cartesian3.ZERO, frame)
        this.localOrigin.orientation.setValue(Quaternion.IDENTITY)
      }
      this._emit('originChange')
    }
  }

  /**
  * Require a specific reality
  */
  setRequiredReality(reality) {
    const previousRequiredReality = this.realityView.getReality()
    if (previousRequiredReality === reality) return
    this.realityView.setReality(reality)
    this._emit('requiredReality', {reality, previousRequiredReality})
  }

  /**
  * Get the required reality
  */
  getRequiredReality() {
    return this.realityView.getReality()
  }

  /**
  * Get the current reality
  */
  getCurrentReality() {
    return this._currentReality
  }

  /**
  * Require a set of capabilities
  */
  setRequiredCapabilities(capabilities) {
    this._requiredCapabilities = capabilities
    this._emit('requiredCapabilities', {capabilities})
  }

  /**
  * Require a set of reference frames
  */
  setRequiredReferenceFrames(referenceFrames) {
    this._requiredReferenceFrames = referenceFrames
    this._emit('requiredReferenceFrames', {referenceFrames})
  }

  /**
   * Get size
   */
  getSize() {
    return this._size
  }

  /**
   * Update the context _size
   */
  resize() {
    var container = this.element.parentNode
    this._size = [container.clientWidth, container.clientHeight]
    this.realityView.resize(this._size)
    this._emit('resize', this._size)
  }

  /**
   * Get screen position.
   * (Does not report the correct position if the element or any ancessors
   * has a transform applied). Performs DOM access, so should be used
   * sparingly XXX: Algorithm for getting correct transform is in Ethereal,
   * but its lengthly, and again, performs a lot of DOM access, so it's not
   * ideal. Also, its probably unlikely that normal webpages would apply css
   * transforms to top-level content. Famo.us webpages, on the other hand...
   * these would allow us to access the true final transform of a surface/view
   * (without accessing the DOM!)
   *
   */
  getScreenBounds() {
    var left = 0
    var top = 0

    var element = this.element
    while(element) {
      // eek DOM access.... need to use famous!
      left += (element.offsetLeft - element.scrollLeft + element.clientLeft)
      top += (element.offsetTop - element.scrollTop + element.clientTop)
      element = element.offsetParent
    }

    var width = this._size[0]
    var height = this._size[1]

    return {left, top, width, height, size:[width, height]}
  }

  destroy() {
    this.realityView.detach()
    delete Context.collection[this.id]
    if (this.element.parentNode)
      this.element.parentNode.removeChild(this.element)
  }

}

Context.collection = {}

Context.className = 'Context'

Context.componentBindHandlers = []

export default Context

if (isChannel) {

  // Context.defaultBackground = new Argon.Background
  // Context.defaultBackground.set
  // Context.defaultBackground.set('fov', 60)

  var _setupPanAndZoomGestures = function(context) {

    var Hammer = require('hammerjs')
    var hammer = new Hammer(this.element)
    var pinch = hammer.get('pinch')
    var pan = hammer.get('pan')
    var doubletap = hammer.get('doubletap')
    pinch.set({ enable: true, threshold:0 })
    pan.set({ enable: true, threshold:0, pointers: 2 }) // two-finger pan
    pan.recognizeWith(pinch)
    pinch.recognizeWith(pan)
    doubletap.recognizeWith(pinch)
    doubletap.recognizeWith(pan)
    doubletap.set({ pointers:2, posThreshold: 100, threshold: 40, interval: 500, time: 350 })

    hammer.on('pinchstart', event => {
      this.backgroundView.trigger('zoomStart')
    })
    hammer.on('pinchmove', event => {
      this.backgroundView.trigger('zoomMove', {
        scale: event.scale
      })
    })
    hammer.on('pinchend', event => {
      this.backgroundView.trigger('zoomEnd')
    })

    hammer.on('panstart', event => {
      this.backgroundView.trigger('panStart')
    })
    hammer.on('panmove', event => {
      this.backgroundView.trigger('panMove', {
        deltaX: event.deltaX,
        deltaY: event.deltaY
      })
    })
    hammer.on('panend', event => {
      this.backgroundView.trigger('panEnd', {
        velocityX: event.velocityX,
        velocityY: event.velocityY
      })
    })

    hammer.on('doubletap', event => {
      this.backgroundView.trigger('zoomReset')
      this.backgroundView.trigger('panReset')
    })

    // this.element.addEventListener('gesturestart', event => {
    //   currentFOV = this.backgroundView.cameraFrame.currentState.fov
    // }, false)
    //
    // this.element.addEventListener('gesturechange', event => {
    //   this.context.set('zoomFOV',
    //     Math.max(Math.min(currentFOV / event.scale, maxFOV), minFOV)
    //   )
    // }, false)
  }

}
