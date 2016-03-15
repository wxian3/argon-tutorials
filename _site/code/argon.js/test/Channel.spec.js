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

describe('Channel', function() {
  var content = null
  var channel = null

  before(function() {
    channel = new Argon.Channel
  })

  beforeEach(function() {
    content = []
    content.push(window.Argon_HEAD_CONTENT)
  })

  after(function() {
    channel.destroy()
  })

  it('new Channel', function() {
    should.exist(channel)
    should.exist(channel.element)
  })

  it('empty argon channel', function(done) {
    content.push("I'm a Channel")
    var b = new Blob(content, { type: 'text/html' })
    channel.once('connect', function onConnect() {
      done()
    })
    channel.setURL(URL.createObjectURL(b))
  })

  it('unload event from navigation', function(done) {
    content.push("<script>Argon.managerPort.whenConnected.then(function() {window.location.href='about:blank'})</script>")
    var b = new Blob(content, { type: 'text/html' })
    channel.once('connect', function onConnect() {
      channel.once('unload', function onUnload() {
        done()
      })
    })
    channel.setURL(URL.createObjectURL(b))
  })

  it('unload event from changing url', function(done) {
    content.push("Hi")
    var b = new Blob(content, { type: 'text/html' })
    channel.once('connect', function onConnect() {
      channel.once('unload', function onUnload() {
        done()
      })
      channel.setURL(undefined)
    })
    channel.setURL(URL.createObjectURL(b))
  })

  it('receive message via channel port (manager port in channel)', function(done) {
    content.push("<script>")
    content.push("Argon.managerPort.trigger('hello manager')")
    content.push("</script>")
    var b = new Blob([content.join('\n')], { type: 'text/html' })
    channel.port.once('hello manager', function(e) {
      done()
    })
    channel.setURL(URL.createObjectURL(b))
  })

  it('send/receive messages', function(done) {
    content.push("<script>")
    content.push("Argon.managerPort.on('get it?', function(e) {")
    content.push("  if (e.it) Argon.managerPort.trigger('got it.', {what: 'good!'})")
    content.push("})")
    content.push("</script>")
    var b = new Blob([content.join('\n')], { type: 'text/html' })
    channel.setURL(URL.createObjectURL(b))
    channel.once('connect', function() {
      channel.port.trigger('get it?', {it: true})
    })
    channel.port.once('got it.', function(e) {
      e.what.should.equal('good!')
      done()
    })
  })

  it('requestHandler can resolve requests', function(done) {
    content.push("<script>")
    content.push("Argon.managerPort.request('money', {ammount:1000}).then(function(money) {")
    content.push("  if (money === 1000) Argon.managerPort.trigger('thanks!')")
    content.push("})")
    content.push("</script>")
    var b = new Blob([content.join('\n')], { type: 'text/html' })

    Argon.Channel.requestHandler['money'] = function(e) {
      e.data.ammount.should.equal(1000)
      return Promise.resolve(e.data.ammount)
    }

    channel.setURL(URL.createObjectURL(b))
    channel.port.once('thanks!', function(e) {
      done()
    })
  })

  it('requestHandler can reject requests', function(done) {
    content.push("<script>")
    content.push("Argon.managerPort.request('moreMoney', {ammount:2000}).catch(function(e) {")
    content.push("  Argon.managerPort.trigger('done', e.toJSON())")
    content.push("})")
    content.push("</script>")
    var b = new Blob([content.join('\n')], { type: 'text/html' })

    Argon.Channel.requestHandler['moreMoney'] = function(e) {
      e.data.ammount.should.equal(2000)
      return Promise.reject("No more money for you!")
    }

    channel.setURL(URL.createObjectURL(b))
    channel.port.once('done', function(e) {
      e.message.should.equal('No more money for you!')
      done()
    })
  })

  it('require immersive reality from channel', function(done) {
    content.push("<script>")
    content.push("var reality = new Argon.Reality.Color")
    content.push("Argon.immersiveContext.setRequiredReality(reality)")
    content.push("</script>")
    var b = new Blob([content.join('\n')], { type: 'text/html' })
    Argon.immersiveContext.once('requiredReality', function(e) {
      var reality = Argon.immersiveContext.requiredRealityMap[channel.id]
      reality.type.should.equal('Color')
      reality.id.should.equal(e.reality.id)
      done()
    })
    channel.setURL(URL.createObjectURL(b))
    channel.focus()
  })

  it('options set on immersive reality should be received in manager', function(done) {
    content.push("<script>")
    content.push("var reality = new Argon.Reality.Color")
    content.push("Argon.immersiveContext.setRequiredReality(reality)")
    content.push("reality.set('hello', 'world')")
    content.push("Argon.managerPort.on('sayGoodbye', function() { reality.setOptions({goodbye: 'world'})})")
    content.push("</script>")
    var b = new Blob([content.join('\n')], { type: 'text/html' })
    Argon.immersiveContext.on('requiredReality', function(e) {
      var reality = Argon.immersiveContext.requiredRealityMap[channel.id]
      reality.id.should.equal(e.reality.id)
      reality.options.hello.should.equal('world')
      reality.on('change', function(e) {
        if (e.id === 'goodbye') {
          e.value.should.equal('world')
          done()
        }
      })
      channel.port.trigger('sayGoodbye')
    })
    channel.setURL(URL.createObjectURL(b))
    channel.focus()
  })

})
