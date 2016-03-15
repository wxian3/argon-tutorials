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

describe('dataSource', function() {
  var content = null
  var channel = null
  var Cartesian3 = Argon.Cesium.Cartesian3
  var JulianDate = Argon.Cesium.JulianDate

  before(function() {
    channel = new Argon.Channel
  })

  beforeEach(function() {
    content = []
    content.push(window.Argon_HEAD_CONTENT)
  })

  after(function() {channel.destroy()})

  it('publishEntity works with ConstantProperty', function(done) {
    content.push("<script>")
    content.push("var e = new Argon.Cesium.Entity({id:'test', position: Argon.Cesium.Cartesian3.UNIT_X})")
    content.push("Argon.dataSource.publishEntity(e).then(function() {Argon.managerPort.emit('done')})")
    content.push("</script>")
    var b = new Blob([content.join('\n')], { type: 'text/html' })
    channel.setURL(URL.createObjectURL(b))
    channel.port.once('done', function() {
      var entity = Argon.dataSource.entities.getById('test')
      var expectedValue = Cartesian3.UNIT_X
      var sameValue = entity.position.getValue(JulianDate.now()).equals(expectedValue)
      sameValue.should.equal(true)
      done()
    })
  })

  it('published entities are removed when the channel unloads', function(done) {
    content.push("<script>")
    content.push("var e = new Argon.Cesium.Entity({id:'test2'})")
    content.push("Argon.dataSource.publishEntity(e)")
    content.push("</script>")
    var b = new Blob([content.join('\n')], { type: 'text/html' })
    channel.setURL(URL.createObjectURL(b))
    var removeListener = Argon.dataSource.entities.collectionChanged.addEventListener(function(collection, added, removed, changed) {
      for (var i=0; i < added.length; i++) {
        var e = added[i]
        if (e.id === 'test2') {
          channel.setURL(undefined) // unload the channel
        }
      }
      for (var i=0; i < removed.length; i++) {
        var e = removed[i]
        if (e.id === 'test2') {
          done()
          removeListener()
        }
      }
    })
  })

  it('subscribeToEntityById works', function(done) {
    content.push("<script>")
    content.push("Argon.dataSource.subscribeToEntityById('test3').then(function(entity) {")
    content.push("  var result = entity.position.getValue(Argon.Cesium.JulianDate.now())")
    content.push("  Argon.managerPort.emit('result', result)")
    content.push("})")
    content.push("</script>")
    var b = new Blob([content.join('\n')], { type: 'text/html' })
    channel.port.once('result', function(result) {
      Argon.Cesium.Cartesian3.UNIT_Y.equals(result).should.equal(true)
      done()
    })
    Argon.dataSource.entities.add({
      id: 'test3',
      position: Argon.Cesium.Cartesian3.UNIT_Y
    })
    channel.setURL(URL.createObjectURL(b))
  })

  it('subscribeToEntityById works with SampledProperty', function(done) {
    content.push("<script>")
    content.push("Argon.dataSource.subscribeToEntityById('test4').then(function(entity) {")
    content.push("  entity.definitionChanged.addEventListener(function(entity, propertyName, newValue, oldValue) {")
    content.push("    if (propertyName === 'position') {")
    content.push("      var time = Argon.Cesium.JulianDate.fromIso8601('1989-11-20T05:00:00Z')")
    content.push("      var position = newValue.getValue(time)")
    content.push("      if (Argon.Cesium.Cartesian3.UNIT_Z.equals(position))")
    content.push("        Argon.managerPort.emit('done')")
    content.push("    }")
    content.push("  })")
    content.push("  Argon.managerPort.emit('addSample')")
    content.push("})")
    content.push("</script>")
    var b = new Blob([content.join('\n')], { type: 'text/html' })
    var e = Argon.dataSource.entities.add({
      id:'test4',
      position: new Argon.Cesium.SampledPositionProperty()
    })
    channel.setURL(URL.createObjectURL(b))
    channel.once('connect', function() {
      channel.port.once('done', function() {done()})
      channel.port.once('addSample', function() {
        e.position.addSample(
          Argon.Cesium.JulianDate.fromIso8601("1989-11-20T05:00:00Z"),
          Argon.Cesium.Cartesian3.UNIT_Z
        )
      })
    })
  })

})
