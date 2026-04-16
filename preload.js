// preload.js — se ejecuta con privilegios de Node ANTES de que cargue la página
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // Activa/desactiva "siempre al frente"
  togglePin: () => ipcRenderer.invoke('toggle-pin'),

  // Devuelve [ancho, alto] de la ventana actual
  getWindowSize: () => ipcRenderer.invoke('get-window-size'),

  // Pide a main.js que redimensione la ventana
  resizeWindow: (width, height) => ipcRenderer.send('resize-window', width, height),

  // Cierre seguro
  closeWindow: () => ipcRenderer.send('close-window'),
});
