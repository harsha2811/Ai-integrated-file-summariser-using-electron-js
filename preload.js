const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    getFunctionResult: (resultText,level) => ipcRenderer.invoke('get-function-result',resultText,level),
    getTextResult: (filePath) => ipcRenderer.invoke('get-text-result', filePath),
    createPdf: (text,fileName_pth,level) => ipcRenderer.invoke('create-pdf', text,fileName_pth,level)
});

// console.log('Preload script loaded');
