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

var Argon = require('argon')
var THREE = require('external-three')
THREE.Bootstrap = require('external-threestrap')

var Cesium = Argon.Cesium
var Matrix3 = Cesium.Matrix3
var Matrix4 = Cesium.Matrix4
var Quaternion = Cesium.Quaternion
var Cartesian3 = Cesium.Cartesian3
var Util = Argon.Util

var _v = new THREE.Vector3
var _q = new THREE.Quaternion
var _q2 = new THREE.Quaternion
var _mat = new THREE.Matrix4
var _mat2 = new THREE.Matrix4
var _matrixScratch = new Matrix4

var x90 = Quaternion.fromAxisAngle(Cartesian3.UNIT_X, Math.PI/2)
var x90Rotation = Matrix3.fromQuaternion(x90)
var x90Transform = Matrix4.fromRotationTranslation(x90Rotation, Cartesian3.ZERO)

var scratchMatrix4 = Matrix4.clone(Matrix4.IDENTITY)
var scratch2Matrix4 = Matrix4.clone(Matrix4.IDENTITY)
var scratchQuaternion = Quaternion.clone(Quaternion.IDENTITY)
var scratchCartesian3 = Cartesian3.clone(Cartesian3.ZERO)

function setPose(object, position, orientation) {
  if (!object.parent || object.parent.type === 'Scene') {
    object.position.copy(position)
    object.quaternion.copy(orientation)
    object.updateMatrix()
  } else {
    var localPosition = object.parent.worldToLocal(_v.copy(position))
    var parentWorldQuaternion = object.parent.getWorldQuaternion(_q)
    var inverseParentWorldQuaternion = parentWorldQuaternion.conjugate()
    var localQuaternion = inverseParentWorldQuaternion.multiply(_q2.copy(orientation))
    object.position.copy(localPosition)
    object.quaternion.copy(localQuaternion)
    object.updateMatrix()
  }
  // need to update the matrixWorld in case the programmer wants to look at the world coordinates of objects
  // attached to entities
  object.updateMatrixWorld()
}

THREE.Bootstrap.registerPlugin('argon', {

  defaults: {
    start: true,
    context: Argon.immersiveContext
  },

  listen: ['ready'],

  install: function (three) {

    var argonContext = this.options.context

    var objects = new Set
    var entityMap = new WeakMap

    function updateEntityFromObject(object, entity) {
      const pos = object.getWorldPosition();
      const objectPos = new Cesium.Cartesian3(pos.x, pos.y, pos.z)

      entity.position.setValue(objectPos, argonContext.localOriginEastUpSouth)
      entity.orientation.setValue(Cesium.Quaternion.clone(object.quaternion))

      // use the last saved argon update time
      const time = three.argon.time

      if (entity.isAvailable(time)) {
        const cartesian = Util.getEntityPositionInReferenceFrame(entity, time, argonContext.eye.position.referenceFrame, scratchCartesian3)
        if (cartesian) {
          const quaternion = Util.getEntityOrientationInReferenceFrame(entity, time, argonContext.eye.position.referenceFrame, scratchQuaternion)

          if (cartesian && quaternion) {
            Quaternion.multiply(x90, quaternion, quaternion)
            entity.position.setValue(cartesian, argonContext.eye.position.referenceFrame);
            entity.orientation.setValue(quaternion);
          }
        }
      }
    }

    function updateObjectFromEntity(object, entity, time) {
      let position, orientation
      if (entity.isAvailable(time)) {
        position = Util.getEntityPositionInReferenceFrame(entity, time, argonContext.localOriginEastUpSouth, scratchCartesian3)
        if (position) {
          orientation = Util.getEntityOrientationInReferenceFrame(entity, time, argonContext.localOriginEastUpSouth, scratchQuaternion)
        }
      }

      if (position && orientation) {
        // rotate the transform so that Y means "local up"
        Quaternion.multiply(orientation, x90, orientation)
        setPose(object, position, orientation)
        if (!object.__argonFound) {
          object.__argonFound = true
          object.dispatchEvent( { type: 'argon:found' } )
        }
      } else {
        if (object.__argonFound) {
          object.__argonFound = false
          object.dispatchEvent( { type: 'argon:lost' } )
        }
      }
    }

    three.argon = {
	    time: Cesium.JulianDate.now,  // we are going to save the time passed to update
      deltaTime: 0,  // time since last update

      objectFromEntity: (entity, klass) => {
        if (!entity) throw new Error('entity is required')
        if (!klass) klass = THREE.Object3D
        const object3D = new klass
        object3D.matrixAutoUpdate = false
        object3D.name = entity.name
        three.scene.add(object3D)

        objects.add(object3D)
        entityMap.set(object3D, entity)

        // set the objects initial pose, just it case the programer wants to use it
        updateObjectFromEntity(object3D, entity, three.argon.time)
        return object3D
      },
      entityFromObject: (object) => {
        var context = argonContext
        var entity = entityMap.get(object)
        if (entity) {
           return entity;
        }
        // create a new one
        entity = new Cesium.Entity({
          name: object.name || object.uuid,
          position: new Cesium.ConstantPositionProperty(),
          orientation: new Cesium.ConstantProperty()
        })

        updateEntityFromObject(object, entity)

        objects.add(object)
        entityMap.set(object, entity)
        return entity;
      },
      updateEntityFromObject: (object) => {
        const entity = entityMap.get(object)
        if (entity) {
          updateEntityFromObject(object, entity)
        }
      },
      createObjectFromCartographicDegrees: (name, lla, klass) => {
        var entity = new Cesium.Entity({
            name: name,
            position: Cesium.Cartesian3.fromDegrees(lla[0], lla[1], lla[2])
          })
        return three.argon.objectFromEntity(entity, klass)
      },
      createObjectFromCartesian: (name, cart, klass) => {
        var entity = new Cesium.Entity({
            name: name,
            position: cart
          })        
        return three.argon.objectFromEntity(entity, klass)
      },
      getCartographicDegreesFromEntity: (entity) => {
        if (entity.isAvailable(three.argon.time)) {
          var position = entity.position.getValue(three.argon.time);
          if (position) {
            var pos = Cesium.Ellipsoid.WGS84.cartesianToCartographic(position);
            if (pos) {
              return [Cesium.Math.toDegrees(pos.longitude), Cesium.Math.toDegrees(pos.latitude), pos.height];
            }
          }
        }
        return undefined
      },
      getEntity: (object) => {
        return entityMap.get(object);
      }
  	}

    var trigger = three.trigger.bind(three)
    var newReality = undefined;
    var newOrigin = false;

    argonContext.on('originChange', function() {
       newOrigin = true
    })

    argonContext.on('realityChange', state => {
      newReality = state
    })

    argonContext.on('update', state => {
      const time = state.time
      const origin = argonContext.localOriginEastUpSouth
      const eye = argonContext.eye
      const frustum = argonContext.frustum

		  // save a copy of argon time and compute delta time
		  three.argon.deltaTime = Cesium.JulianDate.secondsDifference(time, three.argon.time)
		  three.argon.time = state.time;

      var eyePosition = Util.getEntityPositionInReferenceFrame(eye, time, origin, scratchCartesian3)
      var eyeOrientation = Util.getEntityOrientationInReferenceFrame(eye, time, origin, scratchQuaternion)
      setPose(three.camera, eyePosition, eyeOrientation)

      three.camera.fov = frustum.fovy * 180 / Math.PI
      three.camera.aspect = frustum.aspectRatio
      // three.camera.updateProjectionMatrix()
      three.camera.projectionMatrix.fromArray(frustum.infiniteProjectionMatrix)

      // update all the objects
      // BUG: at some point, we may want to optimize this, but checking if the Entity values have changed
      // since the last time we updated the object.  For now, we'll just be safe and inefficient
      for (const o of objects) {
        const e = entityMap.get(o)
        updateObjectFromEntity(o, e, time)
      }

      // trigger the various threestrap events, plus any addition argon events
      three.trigger({type: 'pre'});

      if (newOrigin) {
        newOrigin = false
        three.trigger({type: 'argon:originChange'});
      }
      if (newReality) {
        three.trigger({type: 'argon:realityChange', reality: newReality.reality, previousReality: newReality.previousReality})
        newReality = undefined
      }
      three.trigger({type: 'update', argonState: state})
      three.trigger({type: 'render'})
      three.trigger({type: 'post'})
    })
  },

  uninstall: function (three) {

  },

  ready: function (event, three) {
    three.camera.near = 0.5
    three.camera.far = 1e10
    three.camera.updateProjectionMatrix()
    three.scene.add(three.camera)
  },

});
