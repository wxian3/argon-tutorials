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

/**
 * Extends Cesium Entity and several property types to output CZML
 */

import Cesium from './CesiumImports'

// TODO: support TimeIntervalProperty
// XXX: custom properties don't send emit a definitionChanged event
// TODO: support derivative values in SampledProperty

/* Map from cesium entities to related objects. */
var observerMap = new WeakMap
var czmlMap = new WeakMap
var propertyDeltaIntervalsMap = new WeakMap

const CzmlWriter = {}
export default CzmlWriter

/* Returns a czml object which tracks the provided entity */
CzmlWriter.getCzmlFromEntity = function getCzmlFromEntity(entity) {
  let czml = czmlMap.get(entity)

  if (!czml) {
    czml = {id: entity.id}
    czmlMap.set(entity, czml)

    entity.definitionChanged.addEventListener(onEntityDefinitionChanged)

    for (let i = 0; i < entity.propertyNames.length; i++) {
      const name = entity.propertyNames[i]
      const property = entity[name]
      if (property) {
        czml[name] = createCzmlFromProperty(property)
      }
    }
  }

  return czml
}

/* Subscribes the observer to any changes in the entity.
 * Changes will be sent in the form of CZML packets.
 * The first packet sent to an observer will contain the entire state.
 */
CzmlWriter.observeEntity = function observeEntity(entity, observer) {
  // Add the observer to the entity's list of observers
  let observers = observerMap.get(entity)
  if (!observers) {
    observers = new Set
    observerMap.set(entity, observers)
  }
  observers.add(observer)

  observer(CzmlWriter.getCzmlFromEntity(entity))

  return function unobserve() {
    observers.delete(observer)
  }
}

/* Stop sending entity updates to observer. See `observeEntity`. */
CzmlWriter.unobserveEntity = function unobserveEntity(entity, observer) {
  const observers = observerMap.get(entity)
  if (observers) observers.delete(observer)
}

function onEntityDefinitionChanged(entity, propertyName, newValue, oldValue) {
  let czml = czmlMap.get(entity)
  let propertyCzml
  if (newValue !== oldValue ||
      newValue.constructor === Cesium.ConstantProperty ||
      newValue.constructor === Cesium.ConstantPositionProperty) {
    propertyCzml = createCzmlFromProperty(newValue)
    czml[propertyName] = propertyCzml
  } else {
    propertyCzml = getDeltaIntervalsFromProperty(newValue)
    if (!propertyCzml) {
      // TODO: if we have no delta intervals at this point, then something in
      // the property changed, but we are not keeping track of it...
      throw new Error
    }
  }

  const observers = observerMap.get(entity)
  if (propertyCzml && observers.size > 0){
    const czmlPacket = {
      id: entity.id,
      [propertyName]: propertyCzml
    }
    for (let observer of observers) observer(czmlPacket)
  }
}

/*=== Property To CZML =======================================================*/

function createCzmlFromProperty(property) {
  switch (property.constructor) {
    case Cesium.ConstantProperty:
    case Cesium.ConstantPositionProperty:
      return constantPropertyToCzml(property)

    case Cesium.SampledProperty:
    case Cesium.SampledPositionProperty:
      return sampledPropertyToCzml(property)

    case Cesium.ReferenceProperty:
      return referencePropertyToCzml(property)

    default:
      return undefined
  }
}

function getDeltaIntervalsFromProperty(property) {
  const deltaIntervals = propertyDeltaIntervalsMap.get(property)
  propertyDeltaIntervalsMap.set(property, [])
  return (deltaIntervals && deltaIntervals.length > 0) ? deltaIntervals : null
}

function constantPropertyToCzml(property) {
  const value = property._value

  if (value && typeof value.constructor.pack === 'function') {
    const typeName = czmlNameForType(value.constructor)
    const packed = []
    value.constructor.pack(value, packed)

    const propertyCzml = {
      [typeName]: packed
    }

    if (property.referenceFrame !== undefined) {
      propertyCzml.referenceFrame = czmlValueForReferenceFrame(property._referenceFrame)
    }

    return propertyCzml
  }

  return value // should be a primitive value
}

function sampledPropertyToCzml(property) {
  property.addSample = addSampleSpy
  property.addSamples = addSamplesSpy
  property.addSamplesPackedArray = addSamplesPackedArraySpy
  propertyDeltaIntervalsMap.set(property, [])

  const sampledProperty = property._property || property
  const innerDerivativeTypes = sampledProperty._innerDerivativeTypes
  const hasDerivatives = innerDerivativeTypes !== undefined
  const innerType = sampledProperty._innerType
  const derivativesLength = hasDerivatives ? innerDerivativeTypes.length : 0

  const czmlSampledData = []
  const timesLength = sampledProperty._times.length
  const packedLength = sampledProperty._packedLength

  for (let i = 0; i < timesLength; i++) {
    const index = i*(packedLength+1)
    czmlSampledData[index] = Cesium.JulianDate.toIso8601(sampledProperty._times[i], 6)
    copyIntoArray(
      czmlSampledData,
      index+1,
      sampledProperty._values,
      i*packedLength,
      packedLength
    )
  }

  const czmlName = czmlNameForSampledType(innerType, derivativesLength)
  const czmlInterval = {
    [czmlName]: czmlSampledData,
    interpolationAlgorithm: sampledProperty._interpolationAlgorithm.type.toUpperCase(),
    interpolationDegree: sampledProperty._interpolationDegree,
    forwardExtrapolationType: czmlNameForExtrapolationType(sampledProperty._forwardExtrapolationType),
    forwardExtrapolationDuration: sampledProperty._forwardExtrapolationDuration,
    backwardExtrapolationType: czmlNameForExtrapolationType(sampledProperty._backwardExtrapolationType),
    backwardExtrapolationDuration: sampledProperty._backwardExtrapolationDuration
  }

  if (property.referenceFrame !== undefined) {
    czmlInterval.referenceFrame = czmlValueForReferenceFrame(property.referenceFrame)
  }

  return czmlInterval
}

function referencePropertyToCZML(property) {
  propertyDeltaIntervalsMap.set(property, [])

  const czml = {
    reference: property.targetId + '#' + property.targetPropertyNames.join('.')
  }

  property.definitionChanged.addEventListener(function() {
    czml.reference = property.targetId + '#' + property.targetPropertyNames.join('.')
    propertyDeltaIntervalsMap.get(property).push({
      reference: czml.reference
    })
  })

  return czml
}

/*=== SampledProperty Helpers =====================================================*/

function czmlNameForSampledType(type, derivativesLength) {
  if (type === Cesium.Cartesian3) {
    if (derivativesLength === 0) return 'cartesian'
    if (derivativesLength === 1) return 'cartesianVelocity'
    throw new Error('Unhandled CZML Type: ' + type.constructor.name + ' derivatives: ' + derivativesLength)
  }
  return czmlNameForType(type)
}

function addSampleSpy(time, value, derivatives) {
  const property = this._property || this

  const innerDerivativeTypes = property._innerDerivativeTypes
  const hasDerivatives = innerDerivativeTypes !== undefined
  const innerType = property._innerType
  const derivativesLength = hasDerivatives ? innerDerivativeTypes.length : 0
  const data = []
  data.push(Cesium.JulianDate.toIso8601(time, 6))
  innerType.pack(value, data, data.length)
  if (hasDerivatives) {
    for (let x = 0; x < derivativesLength; x++) {
      innerDerivativeTypes[x].pack(derivatives[x], data, data.length);
    }
  }

  const czmlName = czmlNameForSampledType(innerType, derivativesLength)
  const czmlInterval = {}
  czmlInterval[czmlName] = data
  if (this.referenceFrame !== undefined)
    czmlInterval.referenceFrame = czmlValueForReferenceFrame(this.referenceFrame)
  propertyDeltaIntervalsMap.get(this).push(czmlInterval)

  this.constructor.prototype.addSample.call(this, time, value, derivatives)
}

function addSamplesSpy(times, values, derivativeValues) {
  const property = this._property || this

  const innerDerivativeTypes = property._innerDerivativeTypes
  const hasDerivatives = defined(innerDerivativeTypes)
  const innerType = property._innerType
  const derivativesLength = hasDerivatives ? innerDerivativeTypes.length : 0
  const length = times.length;
  const data = []
  for (let i=0; i < length; i++) {
    data.push(Cesium.JulianDate.toIso8601(times[i], 6))
    innerType.pack(values[i], data, data.length)
    if (hasDerivatives) {
      let derivatives = derivativeValues[i]
      for (var x = 0; x < derivativesLength; x++) {
        innerDerivativeTypes[x].pack(derivatives[x], data, data.length);
      }
    }
  }

  const czmlName = czmlNameForSampledType(innerType, derivativesLength)
  const czmlInterval = {}
  czmlInterval[czmlName] = data
  if (this.referenceFrame !== undefined)
    czmlInterval.referenceFrame = czmlValueForReferenceFrame(this.referenceFrame)
  propertyDeltaIntervalsMap.get(this).push(czmlInterval)

  this.constructor.prototype.addSamples.call(this, times, values, derivativeValues)
}

function addSamplesPackedArraySpy(packedSamples, epoch) {
  const property = this._property || this

  const innerDerivativeTypes = property._innerDerivativeTypes
  const numDerivatives = innerDerivativeTypes ? innerDerivativeTypes.length : 0

  const czmlName = czmlNameForSampledType(property._innerType, numDerivatives)
  const czmlInterval = {}
  czmlInterval[czmlName] = packedSamples
  if (epoch) czmlInterval.epoch = Cesium.JulianDate.toIso8601(epoch)
  if (this.referenceFrame !== undefined)
    czmlInterval.referenceFrame = czmlValueForReferenceFrame(this.referenceFrame)
  propertyDeltaIntervalsMap.get(this).push(czmlInterval)

  this.constructor.prototype.addSamplesPackedArray.call(this, packedSamples, epoch)
}

/*=== Util ===================================================================*/


function copyIntoArray(array, arrayIndex, items, itemsIndex, ammount) {
  itemsIndex = itemsIndex || 0
  ammount = ammount || items.length
  for (var i = 0; i < ammount; i++) {
    array[arrayIndex++] = items[itemsIndex++];
  }
}

function czmlNameForType(type) {
  switch (type) {
    case Number: return 'number'
    case Cesium.Cartesian2: return 'cartesian2'
    case Cesium.Cartesian3: return 'cartesian'
    case Cesium.Cartesian4: return 'cartesian4'
    case Cesium.Color: return 'rgba'
    case Cesium.Quaternion: return 'unitQuaternion'
    default: throw new Cesium.DeveloperError('Unhandled CZML Type: ' + type.constructor.name)
  }
}

function czmlNameForExtrapolationType(type) {
  switch (type) {
    case Cesium.ExtrapolationType.NONE: return 'NONE'
    case Cesium.ExtrapolationType.HOLD: return 'HOLD'
    case Cesium.ExtrapolationType.EXTRAPOLATE: return 'EXTRAPOLATE'
    default: throw new Cesium.DeveloperError('Unhandled ExtrapolationType: ' + type)
  }
}

function czmlValueForReferenceFrame(referenceFrame) {
  switch(referenceFrame) {
    case null: return null
    case Cesium.ReferenceFrame.FIXED: return 'FIXED'
    case Cesium.ReferenceFrame.INERTIAL: return 'INERTIAL'
    default: return '#' + referenceFrame.id
  }
}
