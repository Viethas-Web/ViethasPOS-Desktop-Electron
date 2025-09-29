import { app, Menu, ipcMain, BrowserWindow } from "electron";
import { createCapacitorElectronApp } from "@capacitor-community/electron";
import { autoUpdater } from "electron-updater";
import { log } from "electron-log";
import { SerialPort } from 'serialport'

let updater;
autoUpdater.autoDownload = false
// The MainWindow object can be accessed via myCapacitorApp.getMainWindow()
const myCapacitorApp = createCapacitorElectronApp({
  mainWindow: {
    windowOptions: { minHeight: 768, minWidth: 1024 ,
      webPreferences: {
        nodeIntegration: true,
        nativeWindowOpen:true,
        //contextIsolation:true
      }}
  }
});


//** phần autoupdate */ 
let win: BrowserWindow;
function createDefaultWindow() {
  return new Promise((resolve) => {
    win = new BrowserWindow({
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
    win.setMenu(null)
    win.setTitle("")

    win.loadURL(`file://${__dirname}/version.html`)
    win.webContents.on('dom-ready', () => {
      win.show();
      ipcMain.on("updateAction", function (event, data) {
        switch (data) {
          case "success": autoUpdater.quitAndInstall(); break;
          case "start": autoUpdater.downloadUpdate(); break;
          default: win.close(); break;
        }
      })

      resolve(win)
    });

    win.on('closed', () => {
      win = null;
    });
  });
}
autoUpdater.on('checking-for-update', () => {
  //log('Checking for update...');
})
autoUpdater.on('update-available', (info) => {
  //log('Update available.');
  createDefaultWindow().then(() => {
    win.webContents.send('message', info)
  });
})
autoUpdater.on('update-not-available', (info) => {
  // log('Update not available.');
})
autoUpdater.on('error', (err) => {
  log('Error in auto-updater. ' + err);
})
autoUpdater.on('download-progress', (progressObj) => {
  let log_message = "Tốc độ tải xuống: " + Math.round(progressObj.bytesPerSecond / (1024 * 1024)) + "MB/s";
  log_message = log_message + ' - Đã tải xuống ' + Math.round(progressObj.percent) + '%';
  log_message = log_message + ' (' + Math.round(progressObj.transferred / (1024 * 1024)) + "MB/" + Math.round(progressObj.total / (1024 * 1024)) + 'MB)';
  // log(log_message);
  win.webContents.send('download_progress', log_message)
})
autoUpdater.on('update-downloaded', (info) => {
  // log('Update downloaded');
  win.webContents.send('download_progress', 'success')
});


//** phần printer */
let print: BrowserWindow // khởi tạo cửa sổ để in, ở chế độ ẩn
function createPrinttWindow() {
  print = new BrowserWindow({
    title: 'Print',
    show: false, // chế độ ẩn
    width: 800,
    height: 600,
    parent: myCapacitorApp.getMainWindow(),
    webPreferences: {
      nodeIntegration: true, //require
    }
  })
  print.loadURL(`file://${__dirname}/print.html`)  // load file này để show dữ liệu html nhận từ angular gửi xuống để custom in

  initPrintEvent()

  print.on('close', () => {
    print = null
  })
}
function initPrintEvent() { // khởi tạo sự kiện in

  //** nhận sự kiện từ angular gửi xuống, để lấy mấy in, lấy dánh sách máy in gửi ngược lại cho angular */
  ipcMain.on('allPrint', () => {
    console.log('received getPrinters msg');
    const printers = print.webContents.getPrinters();
    myCapacitorApp.getMainWindow().webContents.send('printName', printers)
  })

  //** nhận sự kiện in từ angular, rồi gửi qua trang print.html để chỉnh trang in */, bên trang print.html edit xong, gửi lại sự kiên "do" để thực hiện in
  ipcMain.on('print-start', (event, obj) => {
    console.log('print-start')
    print.webContents.send('print-edit', obj);
  })
  //** nhận sự kiện "do" từ print.html để in */
  ipcMain.on('do', (event, printer) => {
    const options = {
      silent: true,
      deviceName: printer.deviceName,
      copies: printer.copies
    }
    print.webContents.print(options, (success, errorType) => {
      if (!success) myCapacitorApp.getMainWindow().webContents.send('print-done', false); // gửi sự kiện lên angular nếu in lỗi
      myCapacitorApp.getMainWindow().webContents.send('print-done', true); // gửi sự kiện lên angular nếu in ok
    })
  })
}


//** phần LED */
var screenController: any;

function scanSerialPort() {
  ipcMain.on('scanPorts', () => {
    SerialPort.list().then((ports: any) => {
      myCapacitorApp.getMainWindow().webContents.send('portsInfor', ports);
    });
  });
}

function connectToScreen() {
  ipcMain.on('openPort', (event: any, value: any) => {
    console.log(value)
    screenController = new SerialPort(
      {
        path: value.port,
        baudRate: value.baudrate,
        dataBits: 8,
        parity: 'none',
      },
      (err: any) => {
        if (err) {
          myCapacitorApp
            .getMainWindow()
            .webContents.send('openComStatus', false);
        } else {
          console.log('Opened');
          myCapacitorApp
            .getMainWindow()
            .webContents.send('openComStatus', true);
        }
      }
    );
  });
}

function checkConnectPort() {
  ipcMain.on('checkConnectPort', (event: any, value: any) => {
    myCapacitorApp
      .getMainWindow()
      .webContents.send('isConnect', screenController.isOpen());
  })
}

function disconnectToScreen() {
  ipcMain.on('closePort', () => {
    screenController.close((err: any) => {
      if (err) {
        myCapacitorApp
          .getMainWindow()
          .webContents.send('closeComStatus', false);
      } else {
        myCapacitorApp.getMainWindow().webContents.send('closeComStatus', true);
      }
    });
  });
}

function writeText() {
  ipcMain.on('write', (event: any, value: any) => {
    console.log("write",value)
    let buffer = Buffer.from(value.text, 'ascii');
    screenController.write(buffer, (err: any) => {
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
  ipcMain.on('clean', () => {
    let buffer = Buffer.from("0C", 'hex');
    screenController.write(buffer, (err: any) => {
      if (err)
        myCapacitorApp
          .getMainWindow()
          .webContents.send('writeStatus', false);
      else myCapacitorApp.getMainWindow().webContents.send('cleanStatus', true);
    });
  });
}

function writeTextAtPosition() {
  ipcMain.on('writeLineAtPos', (event: any, value: any) => {
    console.log("writeLineAtPos",value)
    if (parseInt(value.position) + value.text.length <= 40) {
      let buff_ascii: any = [16, value.position];
      Buffer.from(value.text, 'ascii').forEach(data => { buff_ascii.push(data) });
      screenController.write(buff_ascii, (err: any) => {

        if (err)
          myCapacitorApp
            .getMainWindow()
            .webContents.send('writeLineStatus', false);
        console.log("ok2")
      });
    }
  });
}

function write2LineTextAtPosition() {
  ipcMain.on('writeLinesAtPos', (event: any, value: any) => {
    console.log("writeLinesAtPos",value)
    if (
      parseInt(value.position) + value.textLine1.length <= 20 &&
      parseInt(value.position) + value.textLine2.length <= 20
    ) {
      let buff1_ascii: any = [16, value.position];
      Buffer.from(value.textLine1, 'ascii').forEach(data => { buff1_ascii.push(data) });
      screenController.write(buff1_ascii, (err: any) => {
        if (err)
          myCapacitorApp
            .getMainWindow()
            .webContents.send('writeLinesStatus', false);
      });
      let buff2_ascii: any = [16, (parseInt(value.position) + 20)];
      Buffer.from(value.textLine2, 'ascii').forEach(data => { buff2_ascii.push(data) });
      screenController.write(buff2_ascii, (err: any) => {
        if (err)
          myCapacitorApp
            .getMainWindow()
            .webContents.send('writeLinesStatus', false)
        else
          console.log("ok3")
        myCapacitorApp.getMainWindow().webContents.send('writeLinesStatus', true);
      });
    }
  });
}



app.on('ready', function () {
  myCapacitorApp.init()
  // Create the Menu
  Menu.setApplicationMenu(null);
  autoUpdater.checkForUpdates();
  createPrinttWindow()
  // initPrintEvent()
  scanSerialPort()
  connectToScreen()
  disconnectToScreen()
  cleanAllScreen()
  writeText()
  writeTextAtPosition()
  write2LineTextAtPosition()
  checkConnectPort()
 
});
app.on('window-all-closed', () => {
  app.quit();
});

app.on("activate", function () {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (myCapacitorApp.getMainWindow().isDestroyed()) myCapacitorApp.init();
});

