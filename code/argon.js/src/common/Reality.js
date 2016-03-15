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

import Argon from './Argon'
import Promise from 'bluebird'
import Util from './Util'
import Cesium from './cesium/CesiumImports'
import {isManager, isChannel} from './Platform'
import dataSource from './dataSource'
import defaultEye from './entities/eye'

function startLoop(reality) {
  reality._loopRunning = true
  let lastFrameTime = 0
  function step(frameTime) {
    if (reality._autoTick) {
      if (reality.enabled) {
        const targetFrameRate = reality._targetFrameRate
        if (!targetFrameRate) {
          reality.clock.tick()
          requestAnimationFrame(step)
        } else {
          const interval = 1000.0 / targetFrameRate
          const delta = frameTime - lastFrameTime
  
          if (delta > interval) {
            reality.clock.tick()
            lastFrameTime = frameTime - (delta % interval)
          }
          requestAnimationFrame(step)
        }        
      } else {
        // if we are disabled, we'll keep going, but not tick()
        requestAnimationFrame(step)        
      }
    } else {
      reality._loopRunning = false;
    }
  }

  requestAnimationFrame(step);
}

function rootReferenceFrame(frame) {
    const frames = [];
    while (defined(frame) && frame !== null) {
        frames.unshift(frame);
        frame = frame.position && frame.position.referenceFrame;
    }
    return frames[0];
}

class Reality {
  constructor(config={}) {
    Util.mixinInputOutputEventHandlers(this)
    Util.mixinOptionsManager(this)

    this.id = config.id || Util.cuid()
    Reality.collection[this.id] = this

    this.type = config.type || undefined
    this.frustum = config.frustum || undefined

    this.eye = new Cesium.Entity({
      position: new Cesium.ConstantPositionProperty(Cesium.Cartesian3.ZERO, defaultEye),
      orientation: new Cesium.ConstantProperty(Cesium.Quaternion.IDENTITY)
    })
    if (isChannel) dataSource.publishEntity(this.eye)

    this.clock = new Cesium.Clock
    this.clock.canAnimate = false
    this.clock.clockStep = Cesium.ClockStep.SYSTEM_CLOCK
    this.clock.onTick.addEventListener( clock => {
      if (this.options.enabled)
        this._emit('tick', {time: clock.currentTime})
    })

    this.cssDeps = config.cssDeps
    this.jsDeps = config.jsDeps
    this.renderScript = (config.renderScript || function() {}).toString()

    if (config.options) this.setOptions(config.options)
    if (config.init instanceof Function) config.init.call(this, Argon)

    this.autoTick = !!config.autoTick
    this.trusted = true
  }

  set enabled (value) {
    this.set('enabled', value)
  }

  get enabled() {
    return this.options.enabled
  }

  set autoTick (value) {
    if (this._autoTick !== value) {
      this._autoTick = value
      this.clock.canAnimate = value
      if (value) {
        startLoop(this)
      }
    }
  }

  get autoTick () {
    return this._autoTick
  }

  getCSSResources() {
    return getResources(this.cssDeps)
  }

  getJSResources() {
    return getResources(this.jsDeps)
  }

  get configuration() {
    return {
      id: this.id,
      type: this.type,
      cssDeps: this.cssDeps,
      jsDeps: this.jsDeps,
      renderScript: this.renderScript,
      options: this.options
    }
  }

  destroy() {
    delete Reality.collection[this.id]
  }

}

export default Reality

Reality.collection = {}

Reality.query = function(identifier) {
  // TODO
  // const results = []
  // for (const b in Reality.collection) {
  //   if (b.type === identifier.type) results.push(b)
  // }
  return Object.values(Reality.collection)
}

Reality.getById = function(id) {
  return Reality.collection[id]
}

Reality.getOrCreate = function(id) {
  return Reality.collection[id] || new Reality({id: id})
}

Reality.fromConfiguration = function(config) {
  const id = config.id
  const type = config.type
  let reality = Reality.collection[id]
  if (!reality) {
    const RealityType = Reality[type]
    if (RealityType) {
      reality = new RealityType(config)
    } else {
      reality = new Reality(config)
      reality.trusted = false // unknown type, so use slower but secure messaging
    }
  }
  return reality
}

function getResources(deps=[]) {
  basket.clear(true) // clear expired files
  return Promise.resolve(basket.require.apply(basket, deps.map(dep => {
    return {url: dep, execute:false}
  }))).then(function() {
    return deps.map(dep => basket.get(dep).data)
  }).catch(function(e) {
    throw new Error('Unable to load resources: ' + e.toString())
  })
}
