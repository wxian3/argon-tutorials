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

var should = require('chai/lib/chai').should();

describe('RealityView', function() {
  var realityView = null
  after(function() {
    realityView.detach()
  })

  it('new RealityView', function() {
    realityView = new Argon.RealityView
    should.exist(realityView)
    should.exist(realityView.element)
  })

  it('commit with error in renderScript should catch', function(done){
    realityView = new Argon.RealityView
    realityView._setRenderScript(function(port) {blablabla(hi)})
    realityView._commit().catch(function() {
      done()
    })
  })

  it('renderScript should emit events', function(done){
    realityView = new Argon.RealityView
    realityView._setRenderScript(function(port) {
      port.emit('done')
    })
    realityView.renderPort.on('done', function() {
      done()
    })
    realityView._commit()
  })

  it('renderScript should receive events', function(done){
    realityView = new Argon.RealityView
    realityView._setRenderScript(function(port) {
      port.on('hello', function() {
        port.emit('done')
      })
    })
    realityView.renderPort.on('done', function() {
      done()
    })
    realityView._commit().then(function() {
      realityView.renderPort.emit('hello')
    })
  })

})
