' Starts Loot Ledger with no console window.
'
' The dashboard is a local web server: something has to stay running to serve
' the page, exactly like a program stays open while you use it. This runs that
' server hidden — start.py, the same one command the README gives. Output goes
' to lootledger.log, so a failure is not silent just because there is no window
' to look at.
'
' It always stops an existing server before starting a new one. A second server
' cannot bind a port that is already in use, so without this a second launch
' would quietly exit and the browser would reconnect to the OLD server — still
' running the code from whenever it was started. Restarting costs a couple of
' seconds and guarantees you are always on the current version. start.py
' rebuilds the page first whenever anything under frontend/ has changed.
'
' Use "Stop Loot Ledger.bat" to shut it down, since there is no window to close.

Set fso = CreateObject("Scripting.FileSystemObject")
Set sh  = CreateObject("WScript.Shell")

' This script's own folder, so it still works if the project is moved or run
' from a USB stick. The app is read from here every time — nothing is copied.
here = fso.GetParentFolderName(WScript.ScriptFullName)
sh.CurrentDirectory = here

' Stop whatever is already on 8501, if anything. 0 = hidden, True = wait.
sh.Run "cmd /c for /f ""tokens=5"" %p in ('netstat -ano ^| findstr "":8501"" ^| findstr ""LISTENING""') do taskkill /PID %p /F", 0, True
WScript.Sleep 500

' --no-browser because this script opens the tab itself, once the server
' answers. 0 = hidden window, False = do not wait for it to finish.
sh.Run "cmd /c python start.py --no-browser > lootledger.log 2>&1", 0, False

' Ask the server whether it is ready instead of guessing how long it needs.
' An ordinary start answers in a couple of seconds; the first start after a
' code change also rebuilds the page, and the very first one installs the
' page's packages, so the cap is generous. If it is hit, the browser still
' opens — the page will say the site cannot be reached, and lootledger.log
' will say why.
ready = False
waited = 0
Do While waited < 120000
  WScript.Sleep 250
  waited = waited + 250
  On Error Resume Next
  Set http = CreateObject("MSXML2.XMLHTTP")
  http.Open "GET", "http://127.0.0.1:8501/api/health", False
  http.Send
  If Err.Number = 0 Then
    If http.Status = 200 Then ready = True
  End If
  Err.Clear
  On Error GoTo 0
  If ready Then Exit Do
Loop

sh.Run "http://localhost:8501", 1, False
