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
import Channel from './Channel'
import {isManager, isChannel} from './Platform'
import managerPort from './managerPort'
import nativePort from './nativePort'
import dataSource from './dataSource'
import device from './entities/device'
import Cesium from './cesium/CesiumImports'
import Reality from './Reality'
import ready, {setReady, setUnavailable} from './ready'
import alert from './alert'
import Argon from './Argon'

const JulianDate = Cesium.JulianDate

function entityIdFromTrackableInfo(trackableInfo) {
  return 'VuforiaTrackable.' + trackableInfo.id + '.' + trackableInfo.name
}

const Vuforia = {}
Util.mixinInputOutputEventHandlers(Vuforia)

export default Vuforia

if (isChannel) {

  const vuforiaReady = ready('Vuforia')

  if (navigator.userAgent.indexOf('Vuforia') > -1) {
    setReady('Vuforia')
  } else {
    vuforiaReady.timeout(100).catch(Promise.TimeoutError, e => {
      setUnavailable('Vuforia')
    })
  }

  class VuforiaDataSet {
    constructor(info) {
      this.url = info.url
      this.trackables = info.trackables.reduce(function(dict, trackableInfo) {
        const entityId = entityIdFromTrackableInfo(trackableInfo)
        dict[trackableInfo.name] = dataSource.entities.getOrCreateEntity(entityId)
        dataSource.subscribeToEntityById(entityId)
        return dict
      }, {})
      // TODO: trackables do not have a position/orientation property yet,
      // so we have to listen for changes to each trackable and wait until
      // those properties are added before we can set the extrapolation settings
      this._forwardExtrapolationType = Cesium.ExtrapolationType.HOLD
      this._forwardExtrapolationDuration = 1/15
    }

    /**
     * Set forwardExtrapolationType for all trackables
     */
    setForwardExtrapolationType(extrapolationType) {
      this._forwardExtrapolationType = extrapolationType
      for (const name in this.trackables) {
        const t = this.trackables[name]
        if (t.position && t.position.addSample)
          t.position.forwardExtrapolationType = extrapolationType
        if (t.orientation && t.orientation.addSample)
          t.orientation.forwardExtrapolationType = extrapolationType
      }
    }

    /**
     * Set forwardExtrapolationDuration for all trackables
     */
    setForwardExtrapolationDuration(extrapolationDuration) {
      this._forwardExtrapolationDuration = extrapolationDuration
      for (const name in this.trackables) {
        const t = this.trackables[name]
        if (t.position && t.position.addSample)
          t.position.forwardExtrapolationDuration = extrapolationDuration
        if (t.orientation && t.orientation.addSample)
          t.orientation.forwardExtrapolationDuration = extrapolationDuration
      }
    }

    /**
     * Unloads a DataSet
     *
     * @return {Promise.<null, Error>}
     */
    unload() {
      return managerPort.request('Vuforia.unloadDataSet', {url: this.url})
    }

    /**
     * Returns a Promise that fulfills if the DataSet can be sucessfully activated.
     *
     * @return {Promise<null, Error>}
     */
    activate() {
      return managerPort.request('Vuforia.activateDataSet', {url: this.url})
    }

    /**
     * Returns a Promise that fulfills if the DataSet can be sucessfully deactivated.
     *
     * @return {Promise<null, Error>}
     */
    deactivate() {
      return managerPort.request('Vuforia.deactivateDataSet', {url: this.url})
    }
  }

  class VuforiaAPI {
    /**
     * Loads and returns a (Promised) DataSet from the specified url
     *
     * @param {string} url The url of a dataset xml file
     *
     * @typedef {{url: string, trackables: Object.<string,Entity>}} DataSet
     *
     * @return {Promise.<DataSet, Error>} The loaded DataSet (Promise)
     */
    loadDataSetFromURL(url) {
      return managerPort.request('Vuforia.loadDataSet', {url: Util.resolveURL(url)})
        .then(dataSetInfo => new VuforiaDataSet(dataSetInfo))
    }

    /**
     * Start the camera
     *
     * @return {Promise<null, Error>}
     */
    startCamera() {
      return managerPort.request('Vuforia.startCamera')
    }

    /**
     * Stop the camera
     *
     * @return {Promise<null, Error>}
     */
    stopCamera() {
      return managerPort.request('Vuforia.stopCamera')
    }

    /**
     * Start the object tracker
     *
     * @return {Promise<null, Error>}
     */
    startObjectTracker() {
      return managerPort.request('Vuforia.startObjectTracker')
    }

    /**
     * Stop the object tracker
     *
     * @return {Promise<null, Error>}
     */
    stopObjectTracker() {
      return managerPort.request('Vuforia.stopObjectTracker')
    }

    /**
     * Hint max simultaneous image targets
     *
     * @return {Promise<null, Error>}
     */
     hintMaxSimultaneousImageTargets(max) {
      return managerPort.request('Vuforia.hintMaxSimultaneousImageTargets', {max})
    }

  }

  const vuforiaAPI = new VuforiaAPI


  /**
   * Returns a promise that fulfills on successful initialization.
   *
   * @return {Promise.<VuforiaAPI, Error>}
   */
  Vuforia.initialize = function(options={}) {
    return vuforiaReady
      .then(() => managerPort.request('Vuforia.initialize', options))
      .then(() => vuforiaAPI).catch(e=>{
        alert('Vuforia: ' + JSON.parse(e.message).description)
        throw e
      })
  }

  /**
   * Returns a promise that fulfills on successful deinitialization.
   *
   * @return {Promise.<null, Error>}
   */
  Vuforia.deinitialize = function() {
    return vuforiaReady
      .then(() => managerPort.request('Vuforia.deinitialize'))
  }


}

if (isManager) {

  var waitForCalibrationDefer = Promise.defer();

  nativePort.on('Vuforia.cameraCalibration', function(e) {
    const cameraCalibration = {}
    const frameSize = e.eventInfo.frameSize
    const focalLength = e.eventInfo.focalLength
    const fovH = 2 * Math.atan( frameSize[0] / ( focalLength[0] * 2 ) ) * 180/Math.PI
    const fovV = 2 * Math.atan( frameSize[1] / ( focalLength[0] * 2 ) ) * 180/Math.PI
    cameraCalibration.frameSize = frameSize
    cameraCalibration.focalLength = focalLength
    cameraCalibration.fov = [fovH, fovV]
    Vuforia.cameraCalibration = cameraCalibration
    waitForCalibrationDefer.resolve();
  })

  nativePort.on('pluginsReady', function() {

    Vuforia.states = {}
    Vuforia.currentState = undefined

    // wrap VuforiaPlugin with nicer Promise-based api
    // TODO: all native webscriptplugins should expose a promise api
    Object.keys(window.VuforiaPlugin).forEach(command => {
      const fn = window.VuforiaPlugin[command]
      VuforiaPlugin[command] = function(options) {
        var requestId = Util.cuid()
        fn({userData: requestId, options})
        const response = nativePort.afterResponse(requestId)
        response.then(response => {
          console.log('succeed: ' + command + ' ' + JSON.stringify(options) + ' ' + JSON.stringify(response) )
        }).catch(e => {
          console.log('fail: ' + command + ' ' + JSON.stringify(options) + ' ' + JSON.stringify(e) )
          throw e
        })
        return response
      }
    })

    const dataSetPromiseMap = {}

    const initialize = VuforiaPlugin.initialize
    VuforiaPlugin.initialize = function(options) {
      return VuforiaPlugin.deinitialize()
        .then(() => initialize(options))
        .then(() => waitForCalibrationDefer.promise)
        .then(() => {
          calculateVideoBackgroundConfig()
        })
    }

    const loadDataSet = VuforiaPlugin.loadDataSet
    VuforiaPlugin.loadDataSet = function(options) {
      // if we already know about this dataSet... don't load it again
      let dataSetPromise = dataSetPromiseMap[options.url]
      if (dataSetPromise) return dataSetPromise
      dataSetPromise = dataSetPromiseMap[options.url] = loadDataSet(options)
      // add entities to our dataSource for each trackable that the channel can subscribe to
      dataSetPromise.then(dataSet => {
        dataSet.trackables.forEach(trackableInfo => {
          const e = dataSource.entities.add({id: entityIdFromTrackableInfo(trackableInfo)})
        })
      })
      return dataSetPromise
    }

    const unloadDataSet = VuforiaPlugin.unloadDataSet
    VuforiaPlugin.unloadDataSet = function(options) {
      const unloadPromise = unloadDataSet(options).then(() => {
        // remove the entities we added to our dataSource and delete the dataSource
        return dataSetPromiseMap[options.url].then(dataSet => {
          dataSet.trackables.forEach(trackableInfo => {
            dataSource.entities.removeById(entityIdFromTrackableInfo(trackableInfo))
          })
          delete dataSetPromiseMap[options.url]
        })
      })
      return unloadPromise
    }

    const deinitialize = VuforiaPlugin.deinitialize
    VuforiaPlugin.deinitialize = function() {
      return deinitialize().then(() => {
        // the native deinitialize function takes care of unloading and deactivaing all datasets
        // so we need to remove all references to our trackable entities
        for (const url in dataSetPromiseMap) {
          dataSetPromiseMap[url].then(function(dataSet) {
            dataSet.trackables.forEach(trackableInfo => {
              dataSource.entities.removeById(entityIdFromTrackableInfo(trackableInfo))
            })
            delete dataSetPromiseMap[url]
          })
        }
      })
    }

  })

  let videoEyeFrustum = undefined
  let videoBackgroundConfig = undefined

  function calculateVideoBackgroundConfig() {
    const cameraCalibration = Vuforia.cameraCalibration
    if (!cameraCalibration) throw new Error("Camera calibration is required");

    const frameSize = cameraCalibration.frameSize
    const displaySize = device.display.size

    const ratio = Math.max(
      displaySize[0] / frameSize[0],
      displaySize[1] / frameSize[1]
    ) // Math.max = ASPECT FILL, Math.min = ASPECT FIT

    videoBackgroundConfig = {
      size: [frameSize[0]*ratio, frameSize[1]*ratio],
      position: [0,0]
    }
    VuforiaPlugin.setVideoBackgroundConfig(videoBackgroundConfig)

    calculateVideoEyeFrustum()
  }

  function calculateVideoEyeFrustum() {
    if (!videoBackgroundConfig || !Vuforia.cameraCalibration) return

    const cameraFov = Vuforia.cameraCalibration.fov
    const videoBackgroundSize = videoBackgroundConfig.size
    const displaySize = device.display.size

    const h = device.display.horizontalDirection
    const v = device.display.verticalDirection

    const aspectRatio = displaySize[h] / displaySize[v]

    const fov = aspectRatio > 1 ?
      cameraFov[h] * (displaySize[h] / videoBackgroundSize[h]) :
      cameraFov[v] * (displaySize[v] / videoBackgroundSize[v])

    videoEyeFrustum = {
      fov: fov * Math.PI / 180,
      aspectRatio: aspectRatio,
    }
  }

  window.addEventListener('orientationchange', function() {
    calculateVideoEyeFrustum()
  })

  function initializeDefault() {
    return nativePort.whenReady
      .then(() => VuforiaPlugin.initialize({startCamera: true}))
      .catch(error => {
        const code = JSON.parse(error.message).code
        switch (code) {
          case -1: alert('Vuforia: Error during initialization'); break;
          case -2: alert('Vuforia: The device is not supported'); break;
          case -3: alert('Vuforia: Cannot access the camera'); break;
          case -4: alert('Vuforia: License key is missing'); break;
          case -5: alert('Vuforia: Invalid license key passed to SDK'); break;
          case -6: alert('Vuforia: Unable to verify license key due to network (Permanent error)'); break;
          case -7: alert('Vuforia: Unable to verify license key due to network (Transient error)'); break;
          case -8: alert('Vuforia: Provided key is no longer valid'); break;
          case -9: alert('Vuforia: Dependent external device not detected/plugged in'); break;
          default: alert('Vuforia: Unknown initialization error. ' + error.message);
        }
      })
  }

  Channel.events.on('unload', channel => {
    if (Vuforia.states) {
      const state = Vuforia.states[channel.id]
      if (state) {
        delete Vuforia.states[channel.id]
        if (!channel.inLoad) initializeDefault()
      }
    }
  })

  Channel.events.on('focus', channel => {
    if (Vuforia.states) {
      if (Vuforia.states[channel.id]) {
        _setStateForChannel(channel).catch(function(e) {
          alert('Unable to restore Vuforia state', e)
          // TODO: (if we have an error here, it is most likely our fault -
          // we are doing something wrong)... either way, notify the channel that
          // their Vuforia state was unable to be recreated for some reason
        })
      }
    }
  })

  let _setStateForChannel = function(channel) {
    return channel.whenFocussed().then(()=> {
      var state = Vuforia.states[channel.id]
      if (!state) return Promise.reject(new Error("Must call Vuforia.initialize() first"))

      if (state !== Vuforia.currentState) {
        Vuforia.currentState = state
        return _initializeFromState(Vuforia.currentState)
      }

      return state
    })
  }

  let _initializeFromState = function(state) {
    return VuforiaPlugin.initialize(state.initializationOptions).then(() => {
        if (state.initializationOptions.startCamera) {
          state.cameraStarted = true
          return state
        }
        return _setCameraFromState(state)
      }).then(_loadDataSetsFromState)
        .then(_activateDataSetsFromState)
        .then(_setObjectTrackerFromState)
        .then(_setHintMaxSimultaneousImageTargetsFromState)
  }

  let _setCameraFromState = function(state) {
    return state.cameraStarted ? VuforiaPlugin.startCamera().then(() => state) : state
  }

  let _loadDataSetsFromState = function(state) {
    if (state.loadedDataSetUrls) {
      return Promise.all(
        Object.keys(state.loadedDataSetUrls)
          .map(url => VuforiaPlugin.loadDataSet({url}))
      )
      .then(() => state)
    }
    return state
  }

  let _activateDataSetsFromState = function(state) {
    if (state.activatedDataSetUrls) {
      return Promise.all(
        Object.keys(state.activatedDataSetUrls)
          .map(url => VuforiaPlugin.activateDataSet({url}))
      )
      .then(() => state)
    }
    return state
  }

  let _setObjectTrackerFromState = function(state) {
    return state.objectTrackerStarted ? VuforiaPlugin.startObjectTracker().then(() => state) : state
  }

  let _setHintMaxSimultaneousImageTargetsFromState = function(state) {
    const max = state.hintMaxSimultaneousImageTargets
    return max !== undefined ? VuforiaPlugin.hintMaxSimultaneousImageTargets({max}) : state
  }

  Channel.requestHandler['Vuforia.initialize'] = function({channel, data}) {
    let state = Vuforia.states[channel.id]
    let options = data
    options.url = channel.getURL()

    if (!state) {
      state = Vuforia.states[channel.id] = {
        initializationOptions: options,
        cameraStarted: false,
        loadedDataSetUrls: {},
        activatedDataSetUrls: {}
      }
    }

    return _setStateForChannel(channel)
  }

  Channel.requestHandler['Vuforia.deinitialize'] = function({channel, data}) {
    return _setStateForChannel(channel).then(() => {
      delete Vuforia.states[channel.id]
      VuforiaPlugin.deinitialize()
    })
  }

  Channel.requestHandler['Vuforia.loadDataSet'] = function({channel, data}) {
    return _setStateForChannel(channel).then(state => {
      let url = data.url
      let dataSetPromise = VuforiaPlugin.loadDataSet({url})
      return dataSetPromise.then(dataSet => {
        state.loadedDataSetUrls[url] = true
      }).then(() => dataSetPromise)
    })
  }

  Channel.requestHandler['Vuforia.unloadDataSet'] = function({channel, data}) {
    return _setStateForChannel(channel).then(state => {
      let url = data.url
      return VuforiaPlugin.unloadDataSet({url}).then(() => {
        delete state.loadedDataSetUrls[url]
      })
    })
  }

  Channel.requestHandler['Vuforia.activateDataSet'] = function({channel, data}) {
    return _setStateForChannel(channel).then(state => {
      let url = data.url
      return VuforiaPlugin.activateDataSet({url}).then(() => {
        state.activatedDataSetUrls[url] = true
      })
    })
  }

  Channel.requestHandler['Vuforia.deactivateDataSet'] = function({channel, data}) {
    return _setStateForChannel(channel).then(state => {
      let url = data.url
      return VuforiaPlugin.deactivateDataSet({url}).then(() => {
        delete state.activatedDataSet[url]
      })
    })
  }

  Channel.requestHandler['Vuforia.startCamera'] = function({channel, data}) {
    return _setStateForChannel(channel).then(state => {
      return VuforiaPlugin.startCamera().then(() => {
        state.cameraStarted = true
      })
    })
  }

  Channel.requestHandler['Vuforia.stopCamera'] = function({channel, data}) {
    return _setStateForChannel(channel).then(state => {
      return VuforiaPlugin.stopCamera().then(() => {
        state.cameraStarted = false
      })
    })
  }

  Channel.requestHandler['Vuforia.startObjectTracker'] = function({channel, data}) {
    return _setStateForChannel(channel).then(state => {
      return VuforiaPlugin.startObjectTracker().then(() => {
        state.objectTrackerStarted = true
      })
    })
  }

  Channel.requestHandler['Vuforia.stopObjectTracker'] = function({channel, data}) {
    return _setStateForChannel(channel).then(state => {
      return VuforiaPlugin.stopObjectTracker().then(() => {
        state.objectTrackerStarted = false
      })
    })
  }

  Channel.requestHandler['Vuforia.hintMaxSimultaneousImageTargets'] = function({channel, data}) {
    return _setStateForChannel(channel).then(state => {
      const max = data.max
      return VuforiaPlugin.hintMaxSimultaneousImageTargets({max}).then(() => {
        state.hintMaxSimultaneousImageTargets = max
      })
    })
  }

  class VuforiaVideoReality extends Reality {
    constructor() {
      super({
        type: 'VuforiaVideo',
        referenceFrame: device,
        autoTick: false
      })
      const epsilon = -0.0001
      Argon.on('VuforiaVideoFrameTime', frameTime => {
        if (!videoEyeFrustum) return
        this.frustum = videoEyeFrustum
        JulianDate.addSeconds(frameTime, epsilon, this.clock.currentTime)
        this.clock.tick()
      })

      this.on('change:enabled', e => {
        if (e.value) {
          initializeDefault()
        } else {
          VuforiaPlugin.deinitialize()
        }
      })
    }
  }

  Vuforia.reality = new VuforiaVideoReality

}
