import sketch from 'sketch/dom'
import UI from 'sketch/ui'
import Settings from 'sketch/settings'
import BrowserWindow from 'sketch-module-web-view'
import { getWebview } from 'sketch-module-web-view/remote'
import {
  isSketchSupportedVersion,
  isOneLayerSelected,
  isLayerShape,
  setLayerName,
  makeProviderImageUrl,
  getImageFromURL,
  fillLayer
} from './common'

const doc = sketch.getSelectedDocument()
const webviewIdentifier = 'sketch-map-generator.webview'

const closeWebView = () => {
  const existingWebview = getWebview(webviewIdentifier)
  if (existingWebview) {
    existingWebview.close()
  }
}

// When the plugin is shutdown by Sketch (for example when the user disable the plugin)
// we need to close the webview if it's open
export const onShutdown = () => {
  closeWebView()
}

export const onGoogleRun = () => {
  createMapUI('google')
}

export const onMapboxRun = () => {
  createMapUI('mapbox')
}

export const onSettingsRun = () => {
  createMapUI()
}

const saveSettings = (data) => {
  Settings.setSettingForKey(
    'google.token',
    data.googleApiKey
  )
  Settings.setSettingForKey(
    'mapbox.username',
    data.mapboxUsername
  )
  Settings.setSettingForKey(
    'mapbox.publictoken',
    data.mapboxPublicToken
  )
  Settings.setSettingForKey(
    'mapbox.token',
    data.mapboxSecretToken
  )
}

const generateMap = (data) => {
  Settings.setSettingForKey(
    'map.lastprovider',
    data.provider
  )
  Settings.setSettingForKey(
    'map.address',
    data.address
  )
  Settings.setSettingForKey(
    'map.zoom',
    data.zoom
  )
  Settings.setSettingForKey(
    'google.style',
    data.googleStyle
  )
  Settings.setSettingForKey(
    'mapbox.style',
    data.mapboxStyle
  )
  Settings.setSettingForKey(
    'google.snazzy',
    data.snazzy
  )
  Settings.setSettingForKey(
    'mapbox.location',
    data.location
  )

  closeWebView()

  const selection = doc.selectedLayers

  if (!isOneLayerSelected(selection)) {
    UI.message('⚠️ Please select one layer.')
    return
  }

  const layer = selection.layers[0]

  if (!isLayerShape(layer)) {
    UI.message('⚠️ Please select a shape layer.')
    return
  }

  const requestURL = makeProviderImageUrl(data.provider, data, layer)

  if (!requestURL && data.provider === 'mapbox') {
    UI.message('⚠️ Couldn\'t find the location. Please try another one and also check that your secret token is correct.')
    return
  }

  UI.message('⏰ Generating map...')

  getImageFromURL(requestURL, data.provider)
    .then((imageData) => {
      fillLayer(layer, imageData)
      setLayerName(layer, data.address, data.zoom)
      UI.message('🎉 Map generated!')
    })
    .catch((error) => {
      UI.message(`⚠️ ${error}`)
    })
}

const createMapUI = (provider = '') => {
  if (!isSketchSupportedVersion()) {
    UI.message('⚠️ This plugin only works on Sketch 53 or above.')
    return
  }

  const googleApiKey = Settings.settingForKey('google.token')
  const mapboxUsername = Settings.settingForKey('mapbox.username')
  const mapboxPublicToken = Settings.settingForKey('mapbox.publictoken')
  const mapboxSecretToken = Settings.settingForKey('mapbox.token')
  const remember = Settings.settingForKey('map.remember')
  const address = Settings.settingForKey('map.address')
  const zoom = Settings.settingForKey('map.zoom')
  const googleStyle = Settings.settingForKey('google.style')
  const mapboxStyle = Settings.settingForKey('mapbox.style')
  const snazzy = Settings.settingForKey('google.snazzy')

  const data = {
    provider,
    googleApiKey,
    mapboxUsername,
    mapboxPublicToken,
    mapboxSecretToken,
    remember,
    address,
    zoom,
    googleStyle,
    mapboxStyle,
    snazzy
  }

  const windowOptions = {
    identifier: webviewIdentifier,
    parent: doc,
    width: 1160,
    minWidth: 900,
    maxWidth: 1320,
    height: 800,
    minHeight: 620,
    maxHeight: 900,
    titleBarStyle: 'hidden',
    show: false,
    fullscreenable: false,
    hidesOnDeactivate: false,
    remembersWindowFrame: true,
    webPreferences: {
      devTools: true
    }
  }

  const browserWindow = new BrowserWindow(windowOptions)

  // only show the window when the page has loaded to avoid a white flash
  browserWindow.once('ready-to-show', () => {
    browserWindow.show()
  })

  const webContents = browserWindow.webContents

  webContents.on('externalLinkClicked', (url) => {
    NSWorkspace.sharedWorkspace().openURL(NSURL.URLWithString(url))
  })

  webContents.on('closeWindow', () => {
    closeWebView()
  })

  webContents.on('generateMap', (data) => {
    generateMap(data)
  })

  webContents.on('toggleRemember', (status) => {
    Settings.setSettingForKey(
      'map.remember',
      status
    )
  })

  webContents.on('saveSettings', (data) => {
    saveSettings(data)
  })

  webContents.executeJavaScript(
    `createMapUI(
      ${JSON.stringify(data)}
    )`
  )
    .then((res) => {
      console.log(res)
    })
    .catch((error) => {
      console.log(error)
    })

  browserWindow.loadURL(require('../resources/webview.html'))
}
