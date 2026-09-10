Set oShell = CreateObject("WScript.Shell")
Set oFSO = CreateObject("Scripting.FileSystemObject")

' Find repo root relative to this script location
Dim scriptDir, repoRoot, pythonPath, agentMain
scriptDir = oFSO.GetParentFolderName(WScript.ScriptFullName)
repoRoot = oFSO.GetParentFolderName(oFSO.GetParentFolderName(scriptDir))

' Try .venv first, then system python
If oFSO.FileExists(repoRoot & "\.venv\Scripts\pythonw.exe") Then
    pythonPath = repoRoot & "\.venv\Scripts\pythonw.exe"
ElseIf oFSO.FileExists(repoRoot & "\.venv\Scripts\python.exe") Then
    pythonPath = repoRoot & "\.venv\Scripts\python.exe"
Else
    pythonPath = "pythonw.exe"
End If

agentMain = repoRoot & "\src\pc_agent\main.py"
Dim cmd
cmd = """" & pythonPath & """ """ & agentMain & """"

' Run silently (no console window)
oShell.Run cmd, 0, False
