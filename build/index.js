"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
const electron_2 = require("@capacitor-community/electron");
const electron_updater_1 = require("electron-updater");
const electron_log_1 = require("electron-log");
const serialport_1 = require("serialport");
let updater;
electron_updater_1.autoUpdater.autoDownload = false;
// The MainWindow object can be accessed via myCapacitorApp.getMainWindow()
const myCapacitorApp = electron_2.createCapacitorElectronApp({
    mainWindow: {
        windowOptions: { minHeight: 768, minWidth: 1024,
            webPreferences: {
                nodeIntegration: true,
                nativeWindowOpen: true,
            } }
    }
});
//** phần autoupdate */ 
let win;
function createDefaultWindow() {
    return new Promise((resolve) => {
        win = new electron_1.BrowserWindow({
            height: 400,
            width: 400,
            resizable: false,
            minimizable: false,
            maximizable: false,
            show: true,
            parent: myCapacitorApp.getMainWindow(),
            webPreferences: {
                nodeIntegration: true
            }
        });
        win.setMenu(null);
        win.setTitle("");
        win.loadURL(`file://${__dirname}/version.html`);
        win.webContents.on('dom-ready', () => {
            win.show();
            electron_1.ipcMain.on("updateAction", function (event, data) {
                switch (data) {
                    case "success":
                        electron_updater_1.autoUpdater.quitAndInstall();
                        break;
                    case "start":
                        electron_updater_1.autoUpdater.downloadUpdate();
                        break;
                    default:
                        win.close();
                        break;
                }
            });
            resolve(win);
        });
        win.on('closed', () => {
            win = null;
        });
    });
}
electron_updater_1.autoUpdater.on('checking-for-update', () => {
    //log('Checking for update...');
});
electron_updater_1.autoUpdater.on('update-available', (info) => {
    //log('Update available.');
    createDefaultWindow().then(() => {
        win.webContents.send('message', info);
    });
});
electron_updater_1.autoUpdater.on('update-not-available', (info) => {
    // log('Update not available.');
});
electron_updater_1.autoUpdater.on('error', (err) => {
    electron_log_1.log('Error in auto-updater. ' + err);
});
electron_updater_1.autoUpdater.on('download-progress', (progressObj) => {
    let log_message = "Tốc độ tải xuống: " + Math.round(progressObj.bytesPerSecond / (1024 * 1024)) + "MB/s";
    log_message = log_message + ' - Đã tải xuống ' + Math.round(progressObj.percent) + '%';
    log_message = log_message + ' (' + Math.round(progressObj.transferred / (1024 * 1024)) + "MB/" + Math.round(progressObj.total / (1024 * 1024)) + 'MB)';
    // log(log_message);
    win.webContents.send('download_progress', log_message);
});
electron_updater_1.autoUpdater.on('update-downloaded', (info) => {
    // log('Update downloaded');
    win.webContents.send('download_progress', 'success');
});
//** phần printer */
let print; // khởi tạo cửa sổ để in, ở chế độ ẩn
function createPrinttWindow() {
    print = new electron_1.BrowserWindow({
        title: 'Print',
        show: false,
        width: 800,
        height: 600,
        parent: myCapacitorApp.getMainWindow(),
        webPreferences: {
            nodeIntegration: true,
        }
    });
    print.loadURL(`file://${__dirname}/print.html`); // load file này để show dữ liệu html nhận từ angular gửi xuống để custom in
    initPrintEvent();
    print.on('close', () => {
        print = null;
    });
}
function initPrintEvent() {
    //** nhận sự kiện từ angular gửi xuống, để lấy mấy in, lấy dánh sách máy in gửi ngược lại cho angular */
    electron_1.ipcMain.on('allPrint', () => {
        console.log('received getPrinters msg');
        const printers = print.webContents.getPrinters();
        myCapacitorApp.getMainWindow().webContents.send('printName', printers);
    });
    //** nhận sự kiện in từ angular, rồi gửi qua trang print.html để chỉnh trang in */, bên trang print.html edit xong, gửi lại sự kiên "do" để thực hiện in
    electron_1.ipcMain.on('print-start', (event, obj) => {
        console.log('print-start');
        print.webContents.send('print-edit', obj);
    });
    //** nhận sự kiện "do" từ print.html để in */
    electron_1.ipcMain.on('do', (event, printer) => {
        const options = {
            silent: true,
            deviceName: printer.deviceName,
            copies: printer.copies
        };
        print.webContents.print(options, (success, errorType) => {
            if (!success)
                myCapacitorApp.getMainWindow().webContents.send('print-done', false); // gửi sự kiện lên angular nếu in lỗi
            myCapacitorApp.getMainWindow().webContents.send('print-done', true); // gửi sự kiện lên angular nếu in ok
        });
    });
}
//** phần LED */
var screenController;
function scanSerialPort() {
    electron_1.ipcMain.on('scanPorts', () => {
        serialport_1.SerialPort.list().then((ports) => {
            myCapacitorApp.getMainWindow().webContents.send('portsInfor', ports);
        });
    });
}
function connectToScreen() {
    electron_1.ipcMain.on('openPort', (event, value) => {
        console.log(value);
        screenController = new serialport_1.SerialPort({
            path: value.port,
            baudRate: value.baudrate,
            dataBits: 8,
            parity: 'none',
        }, (err) => {
            if (err) {
                myCapacitorApp
                    .getMainWindow()
                    .webContents.send('openComStatus', false);
            }
            else {
                console.log('Opened');
                myCapacitorApp
                    .getMainWindow()
                    .webContents.send('openComStatus', true);
            }
        });
    });
}
function checkConnectPort() {
    electron_1.ipcMain.on('checkConnectPort', (event, value) => {
        myCapacitorApp
            .getMainWindow()
            .webContents.send('isConnect', screenController.isOpen());
    });
}
function disconnectToScreen() {
    electron_1.ipcMain.on('closePort', () => {
        screenController.close((err) => {
            if (err) {
                myCapacitorApp
                    .getMainWindow()
                    .webContents.send('closeComStatus', false);
            }
            else {
                myCapacitorApp.getMainWindow().webContents.send('closeComStatus', true);
            }
        });
    });
}
function writeText() {
    electron_1.ipcMain.on('write', (event, value) => {
        console.log("write", value);
        let buffer = Buffer.from(value.text, 'ascii');
        screenController.write(buffer, (err) => {
            if (err)
                myCapacitorApp
                    .getMainWindow()
                    .webContents.send('writeStatus', false);
            else
                myCapacitorApp.getMainWindow().webContents.send('writeStatus', true);
        });
    });
}
function cleanAllScreen() {
    electron_1.ipcMain.on('clean', () => {
        let buffer = Buffer.from("0C", 'hex');
        screenController.write(buffer, (err) => {
            if (err)
                myCapacitorApp
                    .getMainWindow()
                    .webContents.send('writeStatus', false);
            else
                myCapacitorApp.getMainWindow().webContents.send('cleanStatus', true);
        });
    });
}
function writeTextAtPosition() {
    electron_1.ipcMain.on('writeLineAtPos', (event, value) => {
        console.log("writeLineAtPos", value);
        if (parseInt(value.position) + value.text.length <= 40) {
            let buff_ascii = [16, value.position];
            Buffer.from(value.text, 'ascii').forEach(data => { buff_ascii.push(data); });
            screenController.write(buff_ascii, (err) => {
                if (err)
                    myCapacitorApp
                        .getMainWindow()
                        .webContents.send('writeLineStatus', false);
                console.log("ok2");
            });
        }
    });
}
function write2LineTextAtPosition() {
    electron_1.ipcMain.on('writeLinesAtPos', (event, value) => {
        console.log("writeLinesAtPos", value);
        if (parseInt(value.position) + value.textLine1.length <= 20 &&
            parseInt(value.position) + value.textLine2.length <= 20) {
            let buff1_ascii = [16, value.position];
            Buffer.from(value.textLine1, 'ascii').forEach(data => { buff1_ascii.push(data); });
            screenController.write(buff1_ascii, (err) => {
                if (err)
                    myCapacitorApp
                        .getMainWindow()
                        .webContents.send('writeLinesStatus', false);
            });
            let buff2_ascii = [16, (parseInt(value.position) + 20)];
            Buffer.from(value.textLine2, 'ascii').forEach(data => { buff2_ascii.push(data); });
            screenController.write(buff2_ascii, (err) => {
                if (err)
                    myCapacitorApp
                        .getMainWindow()
                        .webContents.send('writeLinesStatus', false);
                else
                    console.log("ok3");
                myCapacitorApp.getMainWindow().webContents.send('writeLinesStatus', true);
            });
        }
    });
}
electron_1.app.on('ready', function () {
    myCapacitorApp.init();
    // Create the Menu
    electron_1.Menu.setApplicationMenu(null);
    electron_updater_1.autoUpdater.checkForUpdates();
    createPrinttWindow();
    // initPrintEvent()
    scanSerialPort();
    connectToScreen();
    disconnectToScreen();
    cleanAllScreen();
    writeText();
    writeTextAtPosition();
    write2LineTextAtPosition();
    checkConnectPort();
});
electron_1.app.on('window-all-closed', () => {
    electron_1.app.quit();
});
electron_1.app.on("activate", function () {
    // On OS X it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (myCapacitorApp.getMainWindow().isDestroyed())
        myCapacitorApp.init();
});
