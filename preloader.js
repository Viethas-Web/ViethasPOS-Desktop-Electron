require('./node_modules/@capacitor-community/electron/dist/electron-bridge.js');

import { contextBridge, ipcRenderer } from 'electron';
contextBridge.exposeInMainWorld('Sales-Viethas"', {
  onFoo: (handler) => ipcRenderer.on('foo', (event, ...args) => handler(...args)),
  doThing: () => ipcRenderer.send('do-thing'),
});