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

import Cesium from '../cesium/CesiumImports'
import {isChannel, isManager} from '../Platform'
import Channel from '../Channel'
import managerPort from '../managerPort'
import dataSource from '../dataSource'

var deviceEntity = dataSource.entities.add({
  id: 'DEVICE',
  name: 'DEVICE'
})

deviceEntity.position = new Cesium.ConstantPositionProperty(Cesium.Cartesian3.ZERO, null)
deviceEntity.orientation = new Cesium.ConstantProperty(Cesium.Quaternion.IDENTITY)

export default deviceEntity

function updateDisplay() {
  var o = window.orientation || 0
  var verticalDirection = (o === 90 || o === -90) ? 0 : 1
  deviceEntity.display = {
    size: [window.screen.width, window.screen.height],
    orientation: o,
    verticalDirection: verticalDirection,
    horizontalDirection: +!verticalDirection,
  }
  if (isManager) Channel.port.trigger('deviceEntity.display', deviceEntity.display)
}
updateDisplay()

window.addEventListener('orientationchange', updateDisplay)

if (isChannel) {
  dataSource.subscribeToEntityById('DEVICE')

  managerPort.whenConnected.then(function() {
    window.removeEventListener('orientationchange', updateDisplay)
  })
  managerPort.on('deviceEntity.display', function(display) {
    deviceEntity.display = display
  })
}
