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

describe('Reality', function() {

  var context = null
  beforeEach(function(){ context = new Argon.Context })
  afterEach(function(){ if (context) context.destroy() })

  it('new Reality', function() {
    var reality = new Argon.Reality
  })

  it('reality.clock.tick should emit tick event', function(done) {
    var now = Argon.Cesium.JulianDate.fromDate(new Date)
    var reality = new Argon.Reality
    reality.on('tick', function(event) {
      now.equals(event.time).should.equal(true)
      done()
    })
    reality.clock.currentTime = now
    reality.clock.shouldAnimate = false
    reality.clock.tick()
  })

  it('reality.clock.tick should emit update event on context', function() {
    var now = Argon.Cesium.JulianDate.fromDate(new Date)
    var deferred = Promise.defer()
    context.on('update', function(event) {
      now.equals(event.time).should.equal(true)
      deferred.resolve()
    })
    var reality = new Argon.Reality
    reality.clock.currentTime = now
    reality.clock.shouldAnimate = false
    context.reality = reality
    reality.clock.tick()
  })

  var MyCustomReality
  it('Create a custom reality', function() {
    MyCustomReality = function MyCustomReality() {
      Argon.Reality.call(this, {
        init: function() {},
        renderScript: function(port){}
      })
    }
    MyCustomReality.prototype = Object.create(Argon.Reality.prototype)
  })

  it('custom reality test #1', function() {
    var reality = new MyCustomReality
    context.reality = reality
    context.reality.should.equal(reality)
  })

  it('custom reality test #2', function() {
    var deferred = Promise.defer()
    context._realityView.renderPort.on('YEAH', function() {
      deferred.resolve()
    })

    MyCustomReality2 = function MyCustomReality2() {
      Argon.Reality.call(this, {
        renderScript: function(port){
          port.on('backgroundOptions', function(options) {
            if (options.sayYEAH) {
              port.emit('YEAH')
            }
          })
        }
      })
    }
    MyCustomReality2.prototype = Object.create(Argon.Reality.prototype)

    var reality = new MyCustomReality2
    context.reality = reality
    context.reality.should.equal(reality)
    reality.setOptions({sayYEAH: true})
  })

})
