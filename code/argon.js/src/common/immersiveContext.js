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

import Promise from 'bluebird'
import {isManager, isChannel, isRunningInIFrame} from './Platform'
import managerPort from './managerPort'
import Channel from './Channel'
import Context from './Context'
import Reality from './Reality'
import policy from './policy'
import Platform from './Platform'

var iC = new Context({seal: false})
iC.element.style.position = 'fixed'
iC.element.style.width = '100vw'
iC.element.style.height = '100vh'

window.addEventListener('resize', function() {
  iC.resize([window.screen.width, window.screen.height])
})

if (isManager) {

  iC.setRequiredReality(policy.defaultImmersiveReality())

  iC.requiredRealityMap = {}
  iC.requiredCapabilitiesMap = {}
  iC.requiredReferenceFramesMap = {}
  iC.optionsMap = {}
  Object.seal(iC)

  iC.set('presentationMode', 'immersive')
  iC.set('pageModeAvailable', false)
  iC.on('change:presentationMode', e => {
    Channel.focussedChannel.port.trigger('immersiveContext.presentationMode', {mode: e.value})
  })

  iC.on('update', function(frameState) {
    Channel.port.trigger('immersiveContext.update', frameState)
  })

  Channel.events.on('focus', channel => {
    iC.set('pageModeAvailable', false)
    // TODO: need better options handling (the previous line shouldn't be required)
    iC.setOptions(iC.optionsMap[channel.id])
    iC.setRequiredReality(policy.chooseImmersiveReality(iC, channel))
    // alert('focus')
  })

  Channel.events.on('unload', channel => {
    delete iC.requiredRealityMap[channel.id]
    delete iC.requiredCapabilitiesMap[channel.id]
    delete iC.requiredReferenceFramesMap[channel.id]
    delete iC.optionsMap[channel.id]
    // iC.setRequiredReality(policy.chooseImmersiveReality(iC, channel))
  })

  Channel.port.on('immersiveContext.requiredReality', event => {
    const channel = Channel.eventMap.get(event)
    const configuration = event.configuration
    if (iC.requiredRealityMap[channel.id]) {
      iC.requiredRealityMap[channel.id].destroy()
    }
    if (configuration) {
      let reality = Reality.fromConfiguration(configuration)
      iC.requiredRealityMap[channel.id] = reality
      if (channel.hasFocus) {
        iC.setRequiredReality(policy.chooseImmersiveReality(iC, channel))
      }
      channel.on('unload', () => reality.destroy())
    } else {
      iC.requiredRealityMap[channel.id] = null
      if (channel.hasFocus) {
        iC.reality = policy.chooseImmersiveReality(iC.requiredRealityMap)
      }
    }
  })

  Channel.port.on('immersiveContext.requiredRealityOptionsChange', e => {
    var channel = Channel.eventMap.get(e)
    var reality = iC.requiredRealityMap[channel.id]

    if (reality) reality.set(e.id, e.value)
  })

  Channel.port.on('immersiveContext.options', options => {
    var channel = Channel.eventMap.get(options)
    iC.optionsMap[channel.id] = options
    if (channel.hasFocus) {
      iC.setOptions(options)
    }
  })
}

if (isChannel) {

  document.documentElement.style.position = 'fixed'
  document.documentElement.style.width = '100vw'
  document.documentElement.style.height = '100vh'
  document.documentElement.style.paddingTop = '44px' // TODO: make this dynamic
  document.documentElement.style.boxSizing = 'border-box'

  const sheet = (function() {
    const style = document.createElement("style")
    style.appendChild(document.createTextNode(""))// WebKit hack :(
    document.head.appendChild(style);
    return style.sheet;
  })();
  sheet.insertRule('body { display: none; }')

  Object.seal(iC)

  function _nodeIsContent(node) {
    switch(node.nodeName) {
      case '#text': return node.nodeValue.trim().length > 0
      case '#comment': return false
      case 'SCRIPT': return false
      default: return true
    }
  }

  function _documentHasContent() {
    if (!document.body.hasChildNodes()) return false
    const childNodes = [].slice.call(document.body.childNodes)
    return childNodes.some(_nodeIsContent)
  }

  function _checkBodyContent() {
    if (document.body) {
      var userProvidedImmersiveContextDiv = document.querySelector('#argon-immersive-context')
      if (userProvidedImmersiveContextDiv) {
        iC.element.appendChild(userProvidedImmersiveContextDiv)
      }
      if (!_documentHasContent()) {
        iC.set('pageModeAvailable', false)
        var observer = new MutationObserver(function (mutations) {
          if (_documentHasContent()) {
            iC.set('pageModeAvailable', true)
            observer.disconnect()
          }
        })
        observer.observe(document.body, {childList: true})
      } else {
        iC.set('pageModeAvailable', true)
      }
    } else {
      iC.set('pageModeAvailable', false)
      document.addEventListener("DOMContentLoaded", _checkBodyContent)
    }
  }
  _checkBodyContent()

  const transparentReality = new Reality({autoTick: true})
  function _setChannelDefaultReality() {
    if (!iC.getRequiredReality()) {
      // set the default transparent reality if the user hasn't set one
      iC.realityView.setReality(transparentReality)
      iC.realityView.enabled = true
      managerPort.whenConnected.then(() => {
        // If we eventually connect, disable the realityView
        iC.realityView.enabled = false
      })
    }
  }

  if (isRunningInIFrame) {
    // Disable the realityView incase we are in a multi-channel environment
    iC.realityView.enabled = false
    // If we haven't heard from the manager in half a second, we
    // assume we aren't running in the manager.
	  document.addEventListener('DOMContentLoaded', function (event) {
      managerPort.whenConnected.timeout(500).catch(e => {
        _setChannelDefaultReality()
    })})
  } else {
    if (document.body) _setChannelDefaultReality()
    else document.addEventListener("DOMContentLoaded", _setChannelDefaultReality)
  }

  managerPort.on('immersiveContext.presentationMode', e => {
    if (e.mode === 'page') {
      iC.element.style.display = 'none'
      document.body.style.display = 'block'
      document.documentElement.style.position = ''
    } else if (e.mode === 'immersive') {
      iC.element.style.display = 'block'
      document.body.style.display = 'none'
      document.documentElement.style.position = 'fixed'
    }
  })

  managerPort.on('immersiveContext.update', frameState => {
    iC.update(frameState)
  })

  iC.on('requiredReality', ({reality, previousReality}) => {

    managerPort.trigger('immersiveContext.requiredReality', {
      configuration: reality && reality.configuration || null
    })

    if (previousReality) {
      previousReality.removeListener('change', _realityOptionsChangeListener)
      previousReality.removeListener('tick', _realityTickListener)
    }
    if (reality) {
      reality.on('change', _realityOptionsChangeListener)
      reality.on('tick', _realityTickListener)
    }
  })

  function _realityOptionsChangeListener(e) {
    managerPort.trigger('immersiveContext.requiredRealityOptionsChange', e)
  }

  function _realityTickListener(e) {
    if (iC.currentReality === iC.requiredReality)
      managerPort.trigger('immersiveContext.requiredRealityTick', e)
  }

  iC.on('requiredCapabilities', e => {
    managerPort.trigger('immersiveContext.requiredCapabilities', e)
  })

  iC.on('requiredReferenceFrames', e => {
    managerPort.trigger('immersiveContext.requiredReferenceFrames', e)
  })

  iC.on('change', e => {
    managerPort.trigger('immersiveContext.options', iC.options)
  })

}


export default iC
