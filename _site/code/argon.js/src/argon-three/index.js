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

var Argon = module.exports = require('argon')
var THREE = require('external-three')
THREE.Bootstrap = require('external-threestrap')

if (!THREE) throw new Error("three.js must be loaded before argon-three.js")
if (!THREE.Bootstrap) throw new Error("threestrap.js must be loaded before argon-three.js")

require('./argon-plugin')

var _argonCorePlugins = ['bind', 'renderer', 'size', 'fill', 'time', 'scene', 'camera', 'render', /*'warmup',*/ 'argon']
THREE.Bootstrap.registerAlias('argon-core', _argonCorePlugins)

if (!THREE.CSS3DRenderer) require('./CSS3DRenderer')
if (!THREE.MultiRenderer) require('./MultiRenderer')

THREE.Bootstrap.createArgonOptions = function(context) {
  context = context || Argon.immersiveContext

  var options = {}

  options.plugins = _argonCorePlugins.splice(0)

  options.argon = {
    context: context
  }

  // options.size = {
  //   // maxRenderWidth: window.screen.width/3,
  //   // maxRenderHeight: window.screen.height/3
  //   scale: 1 / window.devicePixelRatio
  // }

  options.element = context.element

  options.renderer = {
    klass: THREE.MultiRenderer,
    parameters: {
      renderers: [THREE.WebGLRenderer, THREE.CSS3DRenderer], // stacked back to front
      parameters: [
        {
          alpha: true,
          depth: true,
          stencil: true,
          preserveDrawingBuffer: true,
          antialias: true,
          logarithmicDepthBuffer: true
        },
        {} // CSS3DRenderer doesn't have any parameters
      ]
    }
  }

  return options
}