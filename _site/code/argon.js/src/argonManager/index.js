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

window.__ARGON_MANAGER = true

var asap = require('asap/browser-raw')

var Argon = module.exports = require('../')

Argon.alert = content => setTimeout(() => window.alert(content), 0)

var oldOnError = window.onerror
window.onerror = function(message, url, lineNumber, colNumber, error) {
  if (oldOnError) oldOnError(message, url, lineNumber, colNumber, error)
  if (error) Argon.alert(error.stack)
  else Argon.alert(JSON.stringify({message:message, url:url, lineNumber:lineNumber}))
  return false
}

Argon.nativePort.on('systemBootTime', function(e) {
  Argon.systemBootTime = JulianDate.fromDate(new Date(e.eventInfo.systemBootTime*1000))
})

Argon.createChannel = function(config) {
  new Argon.Channel(config)
}

var JulianDate = Argon.Cesium.JulianDate
var Quaternion = Argon.Cesium.Quaternion
var Cartesian3 = Argon.Cesium.Cartesian3
var Matrix3    = Argon.Cesium.Matrix3
var Matrix4    = Argon.Cesium.Matrix4
var Transforms = Argon.Cesium.Transforms
var PositionProperty = Argon.Cesium.PositionProperty
var ReferenceFrame = Argon.ReferenceFrame

var screenOrientation
function updateScreenOrientation() {
  var angle = -window.orientation * Math.PI / 180
  screenOrientation = Quaternion.fromAxisAngle(Cartesian3.UNIT_Z, angle)
}
updateScreenOrientation()
window.addEventListener('orientationchange', updateScreenOrientation)


var scratchJulianDate = new JulianDate()
var scratchQuaternion = new Quaternion()
var scratchECEFQuaternion = new Quaternion()
var scratchCartesian3 = new Cartesian3()
var scratchMatrix3 = new Matrix3()
var scratchMatrix4 = new Matrix4()
var nwu2enu = Quaternion.fromAxisAngle(Cartesian3.UNIT_Z, Math.PI/2)

var x90Rotation = Matrix4.fromTranslationQuaternionRotationScale(
  Cartesian3.ZERO,
  Quaternion.fromAxisAngle(Cartesian3.UNIT_X, Math.PI/2),
  new Cartesian3(1,1,1)
)

var x90 = Quaternion.fromAxisAngle(Cartesian3.UNIT_X, Math.PI/2)

var scratchQuaternionTrackable = new Quaternion()
var scratchCartesian3Trackable = new Cartesian3()
var scratchMatrix3Trackable = new Matrix3()
var scratchMatrix4Trackable = new Matrix4()

Argon.nativePort.on('ARState', _handleARState)

function _handleARState(e) {
  const ar_data = e.eventInfo

  if (ar_data && Argon.systemBootTime) {

    const deviceLocation = ar_data.location
    const deviceOrientation = ar_data.orientation
    let deviceUpdate

    let position
    if (deviceLocation) {
      const positionTime = JulianDate.addSeconds(Argon.systemBootTime, deviceLocation.timestamp, scratchJulianDate)
      position = Cartesian3.fromDegrees(deviceLocation.longitude, deviceLocation.latitude, deviceLocation.altitude, undefined, scratchCartesian3)
      deviceUpdate = {
        id:'DEVICE',
        position: {
          cartesian: [
            JulianDate.toIso8601(positionTime, 6),
            position.x,
            position.y,
            position.z
          ],
          forwardExtrapolationType: 'HOLD'
        }
      }
    }

    if (deviceLocation && deviceOrientation) {
      const orientationTime = JulianDate.addSeconds(Argon.systemBootTime, deviceOrientation.timestamp, scratchJulianDate)

      // First convert device orientation to be relative to the screen orientation
      const orientation = Quaternion.multiply(deviceOrientation.quaternion, screenOrientation, scratchQuaternion)
      // Apple's orientation is reported in NWU, so convert to ENU by rotating 90° around z
      Quaternion.multiply(nwu2enu, orientation, orientation)
      // // Finally, convert from local ENU to ECEF (Earth-Centered-Earth-Fixed)
      var enu2ecef = Transforms.eastNorthUpToFixedFrame(position, undefined, scratchMatrix4)
      var enu2ecefRot = Matrix4.getRotation(enu2ecef, scratchMatrix3)
      var enu2ecefQuat = Quaternion.fromRotationMatrix(enu2ecefRot, scratchECEFQuaternion)
      Quaternion.multiply(enu2ecefQuat, orientation, orientation)

      deviceUpdate.orientation = {
        unitQuaternion: [
          JulianDate.toIso8601(orientationTime, 6),
          orientation.x,
          orientation.y,
          orientation.z,
          orientation.w
        ],
        forwardExtrapolationType: 'HOLD'
      }
    }

    if (deviceUpdate) Argon.dataSource.process(deviceUpdate)

    var frameTime = JulianDate.addSeconds(Argon.systemBootTime, ar_data.frameTimestamp, scratchJulianDate)
    var frameTimeIso8601 = JulianDate.toIso8601(frameTime, 6)

    var trackables = ar_data.trackables

    if (trackables) {
      const trackableUpdates = []
      for (var i=0; i< trackables.length; i++) {
        var trackable = trackables[i]
        // Vuforia trackable modelViewMatrix is reported in a row-major matrix
        var trackablePose = Matrix4.fromRowMajorArray(trackable.pose, scratchMatrix4Trackable)
        // get the position and orientation out of the modelViewMatrix
        var trackablePosition = Matrix4.getTranslation(trackablePose, scratchCartesian3Trackable)
        var trackableOrientation = Quaternion.fromRotationMatrix(Matrix4.getRotation(trackablePose, scratchMatrix3Trackable), scratchQuaternionTrackable)

        trackableUpdates.push({
          id: 'VuforiaTrackable.'+trackable.id+'.'+trackable.name,
          name: trackable.name,
          position: {
            cartesian: [
              frameTimeIso8601,
              trackablePosition.x,
              trackablePosition.y,
              trackablePosition.z
            ],
            referenceFrame: '#DEVICE'
          },
          orientation: {
            unitQuaternion: [
              frameTimeIso8601,
              trackableOrientation.x,
              trackableOrientation.y,
              trackableOrientation.z,
              trackableOrientation.w
            ]
          }
        })
      }
      Argon.dataSource.process(trackableUpdates)
    }

    Argon.emit('VuforiaVideoFrameTime', frameTime)
  }
}


//
// Entry points from native code
//

var tasks = []
// Argon.dispatch = function(task) {
//   tasks.push(task)
//   asap(function() {
//     if (tasks.length === 0) return
//     var q = tasks; tasks = []
//     var task
//     try {
//       while (q.length > 0) {
//         task = q.shift()
//         task()
//       }
//     } catch (e) { asap.requestFlush(); Argon.alert(task.toString()); throw e }
//   })
// }
Argon.dispatch = function(task) { task() }

window.AR = {}

// // messageChannel dispatcher
// Argon.dispatch = function() {
//   var immediateChannel = new MessageChannel()
//   var taskQueue = []
//   immediateChannel.port1.onmessage = function () {
//     if (taskQueue.length === 0) return
//     // console.time('dispatch')
//     var q = taskQueue
//     taskQueue = []
//     // console.time('dispatchTasks')
//     while (q.length > 0) {
//       q.shift()()
//     }
//     // console.timeEnd('dispatchTasks')
//     _handleARState()
//     // console.timeEnd('dispatch')
//   }
//   return function (task) {
//     // console.time('dispatch')
//     taskQueue.push(task)
//     immediateChannel.port2.postMessage(0)
//     // console.timeEnd('dispatch')
//   }
// }()

AR.emitEvent = function(event) {
  Argon.nativePort.output.emit(event.eventName, event)
}

AR.setSplashURL = function() { // TODO: deprecate? setFeaturedChannelsURL ?

}

AR.applicationRequestedLaunchURL = function(url) { // TODO: replace with emitEvent event
  setTimeout(function() {
    Argon.emit('openURL', url)
  },0)
}


// notify Argon when DOM is loaded, so that plugin scripts can be injected
if (navigator.userAgent.indexOf('Argon') !== -1) {
  document.addEventListener('DOMContentLoaded', function(event) {
    document.location = 'arc://ready'
  })
}
