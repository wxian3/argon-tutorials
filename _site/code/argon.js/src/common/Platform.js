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

var Platform = {}

/*@const*/
Object.defineProperty(Platform, 'isManager', {
  value: !!window.__ARGON_MANAGER
})
/*@const*/
Object.defineProperty(Platform, 'isChannel', {
  value: !!window.__ARGON_CHANNEL
})
/*@const*/
Object.defineProperty(Platform, 'isRunningInTopFrame', {
  value: window.top === window.self
})
/*@const*/
Object.defineProperty(Platform, 'isRunningInIFrame', {
  value: !Platform.isRunningInTopFrame
})
/*@const*/
Object.defineProperty(Platform, 'isRunningInArgonApp', {
  value: navigator.userAgent.indexOf('Argon') !== -1
})
/*@const*/
Object.defineProperty(Platform, 'isRunningInMobileBrowser', {
  value: navigator.userAgent.indexOf('Mobile') !== -1
})
/*@const*/
Object.defineProperty(Platform, 'isRunningInDesktopBrowser', {
  value: !Platform.isRunningOnMobileDevice
})

Object.defineProperty(Platform, 'supportsDeviceOrientation', {
  value: Platform.isRunningInArgonApp || window.DeviceOrientationEvent
})

export default Platform
