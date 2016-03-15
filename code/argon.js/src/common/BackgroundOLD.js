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

var Argon = require('./Argon')

class Background {

  constructor() {
    this.id = Argon.Util.cuid()
    Argon.Util.mixinInputOutputEventHandlers(this)
    Argon.Util.mixinStateManager(this)
    Background.collection[this.id] = this
  }

  getPose() {
    return this.state.pose
  }

  getFOV() {
    return this.state.fov
  }

}


Background.collection = {}

Background.className = 'Background'

Background.query = function(backgroundSelector) {
  var matchingBackgrounds = []

  if (backgroundSelector.id) {
    matchingBackgrounds.push(Argon.Background.collection[backgroundSelector.id])
  } else if (backgroundSelector.type) {
    var BackgroundConstructor = Argon.Util.resolvePropertyPath(backgroundSelector.type, Argon)
    var backgroundObjects = Argon.Background.collection
    for (var id in backgroundObjects) {
      var background = backgroundObjects[id]
      if (background instanceof BackgroundConstructor)
        matchingBackgrounds.push(background)
    }
  }

  return matchingBackgrounds
}

Background.Controller = class Controller {

  constructor() {

    Argon.Util.mixinInputOutputEventHandlers(this)
    Argon.Util.mixinStateManager(this)

    this.element = document.createElement('div')
    this.element.classList.add('argon-background-controller')
    this.element.style.position = 'fixed'
    this.element.style.height = '100%'
    this.element.style.width = '100%'
    this.element.style.left = 0
    this.element.style.top = 0
    this.element.style.margin = 0
    this.element.style.zIndex = -2
    var onResize = () => {
      this.size = [this.element.clientWidth, this.element.clientHeight]
      this.aspect = this.size[0]/this.size[1]
      this._emit('resize')
    }
    window.addResizeListener(this.element, onResize)

    this.size = [undefined, undefined]
    this.aspect = undefined

    this.background = null
    this.backgroundEvents = new Argon.EventHandler
    this.backgroundEvents.subscribe = false
    this.backgroundEvents.on('change', event => {
      this.set(event.key, event.value)
    })

    this.cameraFrame = new Argon.SG.ReferenceFrame

    this.pan = null
    this.panSupported = true
    _bindPanEvents.call(this)

    this.zoom = null
    this.zoomSupported = true
    _bindZoomEvents.call(this)

  }

  setBackground(background) {
    if (this.background) this.background.unpipe(this.backgroundEvents)
    this.background = background
    this.background.pipe(this.backgroundEvents)
    this.setState(JSON.parse(JSON.stringify(this.background.state)))
    this._emit('backgroundChange')
  }

  getPose() {
    return this.background && this.background.getPose()
  }

  getFOV() {
    return this.background && this.background.getFOV()
  }

  applyPan(state) {
    var Transform = Argon.SG.Transform
    var Vector = Argon.SG.Vector
    if (this.pan) {
      this.pan[0] -= this.panVelocity[0] * 10
      this.pan[1] -= this.panVelocity[1] * 10
      this.panVelocity[0] *= 0.9
      this.panVelocity[1] *= 0.9
      var phi = this.pan[1] / 180 * Math.PI * 0.5
      var theta = this.pan[0] / 180 * Math.PI * 0.5

      if (state.pose instanceof Array) {
        var spec = Transform.interpret(state.pose)
        var rotationTransform = Transform.rotate.apply(null, spec.rotate)
      } else if (state.pose.orientation) {
        var rotationTransform = Transform.rotate.apply(null, state.pose.orientation)
      }

      var rotationTransform = Transform.multiply(
        Transform.rotateY(theta),
        rotationTransform
      )

      var rotationTransform = Transform.multiply(
        rotationTransform,
        Transform.rotateX(phi)
      )

      if (state.pose instanceof Array) {
        spec.rotate = Transform.interpret(rotationTransform).rotate
        state.pose = Transform.build(spec)
      } else if (state.pose.orientation) {
        state.pose.orientation = Transform.interpret(rotationTransform).rotate
      }
    }
  }

  applyZoom(state) {
    if (state.fov && this.zoom) {
      state.fov = Math.max(Math.min(150, state.fov/this.zoom), 30)
    }
  }

  update() {
    var DeviceVideo = Argon.Background.DeviceVideo
    var state = {}
    var deviceFrame = Argon.SG.ReferenceFrame.get('device')
    state.pose = this.getPose() || deviceFrame.currentState ? deviceFrame.currentState.pose : null
    state.fov = this.getFOV() ||
      (DeviceVideo.background && DeviceVideo.background.getFOV()) || 80
    if (this.panSupported) this.applyPan(state)
    if (this.zoomSupported) this.applyZoom(state)
    this.cameraFrame.pushState(state)
    this.currentState = state
    this.emitStateUpdate()
  }

  emitStateUpdate() {
    this._emit('stateUpdate', {state: this.currentState})
  }

}

Background.Controller.className = 'Background.Controller'

export default Background

var _bindZoomEvents = function() {
  var currentZoom = 1
  this._on('zoomMove', event => {
    this.zoom = Math.max(Math.min(currentZoom * event.scale, 5), 0.25)
  })
  this._on('zoomEnd', event => {
    currentZoom = this.zoom
  })
  this._on('zoomReset', event => {
    currentZoom = 1
    this.zoom = null
  })
}

var _bindPanEvents = function() {
  var currentPan = [0,0]
  this._on('panMove', event => {
    this.pan = [
      currentPan[0] + (event.deltaX * (this.currentState.fov / 170)),
      currentPan[1] + (event.deltaY * (this.currentState.fov / 170)),
    ]
    this.panVelocity = [0,0]
  })
  this._on('panEnd', event => {
    currentPan = this.pan || [0,0]
    this.panVelocity = [event.velocityX, event.velocityY]
  })
  this._on('panReset', event => {
    currentPan = [0,0]
    this.pan = null
    this.panStartTransform = null
  })
}
