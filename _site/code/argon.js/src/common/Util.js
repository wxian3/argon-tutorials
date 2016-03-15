'use strict';

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

const EventHandler = require('./events').EventHandler
const OptionsManager = require('famous/core/OptionsManager')
const Cesium = require('./cesium/CesiumImports')
const OrientationProperty = Cesium.OrientationProperty
const Quaternion = Cesium.Quaternion
const Cartesian3 = Cesium.Cartesian3
const ReferenceFrame = Cesium.ReferenceFrame
const Transforms = Cesium.Transforms
const Matrix4 = Cesium.Matrix4

const scratchCartesianPositionFIXED = new Cesium.Cartesian3
const scratchMatrix3 = new Cesium.Matrix3
const scratchMatrix4 = new Matrix4

const urlParser  = document.createElement("a")

const Util = {
	cuid: require('cuid'),
	resolveURL: function (inURL) {
		if (inURL === undefined) throw new Error('Expected inURL')
		urlParser.href = null
	  urlParser.href = inURL
	  return urlParser.href
	},
	parseURL: function (inURL) {
		if (inURL === undefined) throw new Error('Expected inURL')
		urlParser.href = null
		urlParser.href = inURL
		return {
			href: urlParser.href,
			protocol: urlParser.protocol,
			hostname: urlParser.hostname,
			port: urlParser.port,
			pathname: urlParser.pathname,
			search: urlParser.search,
			hash: urlParser.hash,
			host: urlParser.host
		}
	},
	resolvePropertyPath: function (path, obj) {
    return [obj || self].concat(path.split('.')).reduce(function(prev, curr) {
      return prev ? prev[curr] : undefined
    })
	},
	dispatch: function() {
		var immediateChannel = new MessageChannel()
		var taskQueue = []
		immediateChannel.port1.onmessage = function () {
			if (taskQueue.length === 0) return
			var q = taskQueue
			taskQueue = []
			while (q.length > 0) {
				q.shift()()
			}
		}
		return function (task) {
			taskQueue.push(task)
			immediateChannel.port2.postMessage(0)
		}
	}(),
	mixinEventHandler: function(obj) {
		obj._eventHandler = new EventHandler()
		EventHandler.setInputHandler(obj, obj._eventHandler)
		EventHandler.setOutputHandler(obj, obj._eventHandler)
		obj.emit = obj._eventHandler.emit.bind(obj._eventHandler)
	},
	mixinInputOutputEventHandlers: function(obj) {
		obj._eventInput = new EventHandler()
		obj._eventOutput = new EventHandler()
		EventHandler.setInputHandler(obj, obj._eventInput)
		EventHandler.setOutputHandler(obj, obj._eventOutput)
		obj._emit = obj._eventOutput.emit.bind(obj._eventOutput)
		obj._on = obj._eventInput.on.bind(obj._eventInput)
	},
	mixinOptionsManager: function(obj) {
		obj.options = {}
		obj._optionsManager = new OptionsManager(obj.options)
		obj._optionsManager.pipe(obj._eventOutput)
		obj.set = obj._optionsManager.set.bind(obj._optionsManager)
		obj.get = obj._optionsManager.get.bind(obj._optionsManager)
		obj.getOptions = obj._optionsManager.getOptions.bind(obj._optionsManager)
		obj.setOptions = obj._optionsManager.setOptions.bind(obj._optionsManager)

		obj._optionsManager.on('change', function(event) {
			obj._emit('change:'+event.id, event)
		})
	},
	ancestorReferenceFrames: function(frame) {
		var frames = []
		while (frame !== undefined && frame !== null) {
				frames.unshift(frame)
				frame = frame.position && frame.position.referenceFrame
		}
		return frames
	},
	rootReferenceFrame: function(frame) {
		return Util.ancestorReferenceFrames(frame)[0]
	},
	getEntityPositionInReferenceFrame: function(entity, time, referenceFrame, result) {
		return entity.position && entity.position.getValueInReferenceFrame(time, referenceFrame, result)
	},
	getEntityOrientationInReferenceFrame: function(entity, time, referenceFrame, result) {
		const entityFrame = entity.position && entity.position.referenceFrame
		if (entityFrame === undefined) return undefined
		let orientation = entity.orientation && entity.orientation.getValue(time, result)
		if (!orientation) {
			const entityPositionFIXED = Util.getEntityPositionInReferenceFrame(entity, time, ReferenceFrame.FIXED, scratchCartesianPositionFIXED)
			if (!entityPositionFIXED) return Quaternion.clone(Quaternion.IDENTITY, result)
			if (Cartesian3.ZERO.equals(entityPositionFIXED)) throw new Error('invalid cartographic position')
			orientation = Transforms.headingPitchRollQuaternion(entityPositionFIXED, 0,0,0, undefined, result)
			return OrientationProperty.convertToReferenceFrame(time, orientation, ReferenceFrame.FIXED, referenceFrame, result)
		}
		return OrientationProperty.convertToReferenceFrame(time, orientation, entityFrame, referenceFrame, result)
	}
}

module.exports = Util
