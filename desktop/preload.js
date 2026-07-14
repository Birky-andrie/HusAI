const { contextBridge } = require('electron');

// The frontend's usePlatform() hook keys off this to pick the transcription
// engine (Whisper on desktop — the Web Speech API doesn't work in Electron).
contextBridge.exposeInMainWorld('electronAPI', {
  isDesktop: true,
});
