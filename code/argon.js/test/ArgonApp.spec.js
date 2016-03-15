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

var should = require('chai/lib/chai').should()

describe('ArgonApp', function() {

  it('ARData event', function() {
    Argon.systemBootTime = Argon.Cesium.JulianDate.now()
    AR.emitEvent({
      eventName: "ARData",
      eventInfo:{
        "trackables":"null",
        "geolocation":{
          "zoneLetter":"S",
          "altitude":0,
          "zoneNumber":16,
          "easting":736015.5343647636,
          "horizontalAccuracy":10,
          "northing":3754326.723982075,
          "verticalAccuracy":6
        },
        "deviceAttitude":[0.09965959936380386,0.9934582710266113,-0.05575583130121231,0,-0.9807214736938477,0.1075388565659523,0.1631587892770767,0,0.168087363243103,0.03842060640454292,0.9850230813026428,0,0,0,0,1],
        "timestamp":60223.267072875
      }
    })
  })

})
