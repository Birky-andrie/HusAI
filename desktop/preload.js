const { contextBridge, ipcRenderer } = require('electron');

// The frontend's usePlatform() hook keys off this to pick the transcription
// engine (Whisper on desktop — the Web Speech API doesn't work in Electron).
contextBridge.exposeInMainWorld('electronAPI', {
  isDesktop: true,
  // Float the app window above other applications while a call is active.
  setFloat: (enabled) => ipcRenderer.send('husai:set-float', enabled),
});
