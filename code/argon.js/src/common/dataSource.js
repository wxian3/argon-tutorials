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

import Cesium from './cesium/CesiumImports'
import asap from 'asap/browser-raw'
import Promise from 'bluebird'
import {isChannel, isManager} from './Platform'
import managerPort from './managerPort'
import Channel from './Channel'
import CzmlWriter from './cesium/CzmlWriter'

var dataSource = new Cesium.CzmlDataSource()
dataSource.load({
  id: 'document',
  name: 'argonDataSource',
  version: '1.0',
  clock: {}
})
dataSource.clock.canAnimate = false

export default dataSource

if (isChannel) {

  const publicationRequests = new WeakMap
  const subscriptionRequests = new WeakMap

  dataSource.publishEntity = function publishEntity(entity) {
    let request = publicationRequests.get(entity)
    if (!request) {
      request = managerPort.request('dataSource.publish', {id: entity.id})
        .then(() => {
          CzmlWriter.observeEntity(entity, function(packet) {
            managerPort.emit('dataSource.packet', {packet})
          })
        })
        .then(() => entity)
      publicationRequests.set(entity, request)
    }
    return request
  }

  dataSource.subscribeToEntityById = function subscribeToEntityById(entityId) {
    const entity = dataSource.entities.getOrCreateEntity(entityId)
    let request = publicationRequests.get(entity)
    if (!request) {
      request = managerPort.request('dataSource.subscribe', {id: entity.id})
        .then(() => entity)
      publicationRequests.set(entity, request)
    }
    return request
  }

  managerPort.on('dataSource.packet', function(e) {
    dataSource.process(e.packet)
  })
}

if (isManager) {

  const ownerMap = new WeakMap
  const subscriptionMap = {}

  Channel.port.on('dataSource.packet', function(e) {
    const channel = Channel.eventMap.get(e)
    const packet = e.packet

    dataSource.entities.suspendEvents()
    if (Array.isArray(packet)) {
      for (p of packet) tryProcessPacket(channel, p)
    } else {
      tryProcessPacket(channel, packet)
    }
    dataSource.entities.resumeEvents()
  })

  Channel.requestHandler['dataSource.subscribe'] = function({channel, data}) {
    const entityId = data.id
    const entity = dataSource.entities.getById(entityId)
    if (entity) {
      const subscriptions = subscriptionMap[channel.id] = subscriptionMap[channel.id] || {}
      const channelHasSubscription = subscriptions[entityId]
      if (!channelHasSubscription) {
        const unobserve = CzmlWriter.observeEntity(entity, function(packet) {
          channel.port.emit('dataSource.packet', {packet})
        })
        channel.once('unload', function() {
          unobserve()
          delete subscriptions[entityId]
        })
        subscriptions[entityId] = true
      }
      return Promise.resolve()
    }
    return Promise.reject('Unable to subscribe to Entity. EntityId \'' + entityId + '\' has not been published')
  }

  Channel.requestHandler['dataSource.publish'] = function({channel, data}) {
    const entityId = data.id
    const existingEntity = dataSource.entities.getById(entityId)
    if (existingEntity) {
      return Promise.reject('Unable to publish Entity. EntityId: \'' + entityId + '\' has already been published')
    }
    const entity = dataSource.entities.add({id: entityId})
    ownerMap.set(entity, channel)
    channel.once('unload', function removeEntity() {
      dataSource.entities.remove(entity)
    })
  }

  const tryProcessPacket = function tryProcessPacket(channel, packet) {
    const entityId = packet.id
    const entity = dataSource.entities.getById(entityId)
    const owner = ownerMap.get(entity)
    const isOwner = owner === channel
    if (isOwner) {
      dataSource.process(packet)
    } else if (entity) {
      channel.port.emit('dataSource.processPacketError', {
        message: 'Entity ' + entityId + ' is not owned by this channel.'
      })
    } else {
      channel.port.emit('dataSource.processPacketError', {
        message: 'Entity ' + entityId + ' has not been published by any channels.'
      })
    }
  }
}
