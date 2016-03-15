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

import Reality from '../Reality'
import Util from '../Util'
import Cesium from '../cesium/CesiumImports'
import dataSource from '../dataSource'

// Use:
// var pano = {
//   type: 'skybox'
//   source: {up: down: north: east: south: west:},
//   headingOffset: 0,
//   cartographicDegrees: [lat, long, alt]
// }
// var reality = new Argon.Reality.Panorama
// reality.setPanoramaEntity(panoEntity)

// TODO: support transitioning between panoramas


/**
 * [PanoramaReality description]
 * @type {[type]}
 */
Reality.Panorama = class PanoramaReality extends Reality {
  constructor() {
    super({
      type: 'Panorama',
      autoTick: true,
      jsDeps: ['https://cdnjs.cloudflare.com/ajax/libs/three.js/r71/three.min.js',
              'https://cdn.rawgit.com/unconed/threestrap/0.0.10/build/threestrap.min.js'],
      renderScript: function(port) {

        var three = THREE.Bootstrap({
          element: this.element
        })

        var blankCanvas = document.createElement( 'canvas' );
        blankCanvas.width = 256;
        blankCanvas.height = 256;

        var texture = new THREE.Texture( blankCanvas );
        texture.needsUpdate = true;

        var sphereGeometry = new THREE.SphereGeometry( 50, 60, 40 )
        sphereGeometry.applyMatrix( new THREE.Matrix4().makeScale( -1, 1, 1 ) )
        var sphereMaterial = new THREE.MeshBasicMaterial({map: texture})

        var sphereMesh = new THREE.Mesh( sphereGeometry, sphereMaterial )
        three.scene.add(sphereMesh)

        var materials = [];
        for (var i = 0; i < 6; i++) {
          materials.push(new THREE.MeshBasicMaterial({map: texture}))
        }
        directions = ['west', 'east', 'up', 'down', 'south', 'north']

        var boxMesh = new THREE.Mesh(new THREE.BoxGeometry(100, 100, 100), new THREE.MeshFaceMaterial(materials))
        three.scene.add(boxMesh)
        boxMesh.scale.set(-1,1,1)

        sphereMesh.visible = false
        boxMesh.visible = false
        //
        // port.on('resize', () => {
        //   three.plugins.size.queue(null, three)
        // })

        window.addEventListener('resize', function() {
          three.plugins.size.queue(null, three)
        })

        three.camera.matrixAutoUpdate = false

        var x90 = new THREE.Quaternion();
        x90.setFromAxisAngle( new THREE.Vector3(1, 0, 0), -Math.PI / 2 );
        port.on('update', function(state) {
          three.camera.fov = state.frustum.fovy * 180 / Math.PI
          three.camera.aspect = state.frustum.aspectRatio
          three.camera.updateProjectionMatrix()
          three.camera.quaternion.copy(state.orientation.unitQuaternionRelative || state.orientation.unitQuaternion)
          three.camera.quaternion.multiplyQuaternions(x90, three.camera.quaternion)
          three.camera.updateMatrix()
        })

        var options
        port.on('options', o => {
          options = o
          if (options.panorama) _loadPanorama(options.panorama)
        })

        var currentPanorama
        var _loadPanorama = function(panorama) {
          if (!currentPanorama || currentPanorama.id !== panorama.id) {
            currentPanorama = panorama
            switch (panorama.type) {
              case 'skybox': _loadSkybox(panorama); break;
              case 'equirectangular': _loadEquirectangular(panorama); break;
            }
          }
        }

        THREE.ImageUtils.crossOrigin = 'anonymous';

        var _loadSkybox = function(panorama) {
          var source = panorama.source

          for (var i=0; i<6; i++) {
            var url = source[directions[i]]
            var texture = THREE.ImageUtils.loadTexture( url )
            materials[i] = new THREE.MeshBasicMaterial({map: texture})
          }
          boxMesh.visible = true
          sphereMesh.visible = false
        }

        var _loadEquirectangular = function(panorama) {
          var url = panorama.source
          sphereMaterial.map = THREE.ImageUtils.loadTexture( url,
            undefined, function() {
            sphereMaterial.needsUpdate = true
          })
          boxMesh.visible = false
          sphereMesh.visible = true
        }
      }
    })
  }

  /**
   *
   */
  setPanorama(panorama) {
    if (!panorama) throw new Error('Expected a panorama property')

    if (!panorama.id) {
      panorama.id = Util.cuid()
      const type = panorama.type

      // debugger
      if (type === 'equirectangular') {
        panorama.source = Util.resolveURL(panorama.source)
      }

      if (type === 'skybox') {
        const source = panorama.source
        source.up = Util.resolveURL(source.up)
        source.down = Util.resolveURL(source.down)
        source.north = Util.resolveURL(source.north)
        source.south = Util.resolveURL(source.south)
        source.east = Util.resolveURL(source.east)
        source.west = Util.resolveURL(source.west)
      }
    }

    this.set('panorama', panorama)

    const lla = panorama.cartographicDegrees
    if (lla) {
      const position = Cesium.Cartesian3.fromDegrees(lla[0], lla[1], lla[2])
      this.eye.position.setValue(position, Argon.Cesium.FIXED)
      this.eye.orientation.setValue(Cesium.Quaternion.IDENTITY)
    } else {
      const deviceEntity = dataSource.entities.getById('DEVICE')
      this.eye.position.setValue(Cesium.Cartesian3.ZERO, deviceEntity)
      this.eye.orientation.setValue(Cesium.Quaternion.IDENTITY)
    }
  }

}
