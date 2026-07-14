// 'desktop' when running inside the Electron shell (preload sets window.electronAPI),
// 'web' in any regular browser. Drives which transcription engine is used.
export default function usePlatform() {
  return window.electronAPI?.isDesktop ? 'desktop' : 'web';
}
