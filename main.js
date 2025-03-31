const { create } = require('domain');
const { app, BrowserWindow } = require('electron');
const path = require('path');

function createWindow(){
    const win = new BrowserWindow({
        width: 1000,
        height: 700,
        webPreferences: {
            preload: path.join(__dirname, 'renderer.js')
        },
    });

    win.loadFile('index.html');
}

app.whenReady().then(() => {
    createWindow();

    app.on('activate', function(){
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
});

app.on('window-all-closed', function (){
    if (process.platform !== 'darwin') app.quit();
});