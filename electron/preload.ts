import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('api', {
  // Placeholder — will be filled in Task 3
  ping: () => ipcRenderer.invoke('ping'),
})