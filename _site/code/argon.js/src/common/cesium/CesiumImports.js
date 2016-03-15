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

// import a subset of Cesium modules
// TODO:  we probably want to import all the Cesium modules in Core and Datasources (so we can easily document what we include)
import binarySearch from 'cesium/Source/Core/binarySearch'
import createGuid from 'cesium/Source/Core/createGuid'
import defined from 'cesium/Source/Core/defined'
import defaultValue from 'cesium/Source/Core/defaultValue'
import Clock from 'cesium/Source/Core/Clock'
import ClockStep from 'cesium/Source/Core/ClockStep'
import Cartesian2 from 'cesium/Source/Core/Cartesian2'
import Cartesian3 from 'cesium/Source/Core/Cartesian3'
import Cartesian4 from 'cesium/Source/Core/Cartesian4'
import Quaternion from 'cesium/Source/Core/Quaternion'
import JulianDate from 'cesium/Source/Core/JulianDate'
import Ellipsoid from 'cesium/Source/Core/Ellipsoid'
import HermitePolynomialApproximation from 'cesium/Source/Core/HermitePolynomialApproximation'
import ExtrapolationType from 'cesium/Source/Core/ExtrapolationType'
import Matrix3 from 'cesium/Source/Core/Matrix3'
import Matrix4 from 'cesium/Source/Core/Matrix4'
import Math from 'cesium/Source/Core/Math'
import Transforms from 'cesium/Source/Core/Transforms'
import ReferenceFrame from 'cesium/Source/Core/ReferenceFrame'
import DeveloperError from 'cesium/Source/Core/DeveloperError'
import GeographicProjection from 'cesium/Source/Core/GeographicProjection'
import CzmlDataSource from 'cesium/Source/DataSources/CzmlDataSource'
import Entity from 'cesium/Source/DataSources/Entity'
import EntityCollection from 'cesium/Source/DataSources/EntityCollection'
import CompositeEntityCollection from 'cesium/Source/DataSources/CompositeEntityCollection'
import Property from 'cesium/Source/DataSources/Property'
import ConstantProperty from 'cesium/Source/DataSources/ConstantProperty'
import CallbackProperty from 'cesium/Source/DataSources/CallbackProperty'
import ReferenceProperty from 'cesium/Source/DataSources/ReferenceProperty'
import ReferenceEntity from 'cesium/Source/DataSources/ReferenceEntity'
import PositionProperty from 'cesium/Source/DataSources/PositionProperty'
import OrientationProperty from 'cesium/Source/DataSources/OrientationProperty'
import ConstantPositionProperty from 'cesium/Source/DataSources/ConstantPositionProperty'
import SampledProperty from 'cesium/Source/DataSources/SampledProperty'
import SampledPositionProperty from 'cesium/Source/DataSources/SampledPositionProperty'
import PerspectiveFrustum from 'cesium/Source/Scene/PerspectiveFrustum'

export default {
  binarySearch,
  createGuid,
  defined,
  defaultValue,
  Clock,
  ClockStep,
  Cartesian2,
  Cartesian3,
  Cartesian4,
  Quaternion,
  JulianDate,
  Ellipsoid,
  HermitePolynomialApproximation,
  ExtrapolationType,
  Matrix3,
  Matrix4,
  Math,
  Transforms,
  ReferenceFrame,
  DeveloperError,
  GeographicProjection,
  CzmlDataSource,
  Entity,
  EntityCollection,
  CompositeEntityCollection,
  Property,
  ConstantProperty,
  CallbackProperty,
  ReferenceProperty,
  ReferenceEntity,
  PositionProperty,
  OrientationProperty,
  ConstantPositionProperty,
  SampledProperty,
  SampledPositionProperty,
  PerspectiveFrustum,
}

window.CESIUM_BASE_URL = ''

Transforms.iau2006XysData._totalSamples = 0
Transforms.iau2006XysData._samples = null

// add a length property so that these classes produce instances that are array-like
Matrix4.prototype.length = 16
Matrix3.prototype.length = 9
