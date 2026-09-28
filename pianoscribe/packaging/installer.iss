; Inno-Setup-Skript für PianoScribe (Inno Setup 6.3 oder neuer).
;
; Erwartet das PyInstaller-Ergebnis in packaging\dist\PianoScribe (siehe build.ps1).
; Aufruf:  iscc /DAppVersion=0.1.0 packaging\installer.iss
; Ergebnis: packaging\Output\PianoScribe-Setup-<Version>.exe plus .bin-Dateien
;           (das Bundle ist wegen der CUDA-Bibliotheken größer als 2 GB, deshalb aufgeteilt;
;           die .bin-Dateien müssen neben der .exe liegen).
;
; Installiert pro Benutzer (keine Administratorrechte) nach %LOCALAPPDATA%\Programs\PianoScribe.
; Die Laufzeitdaten (Modelle, Projekte, Logs) liegen getrennt in %LOCALAPPDATA%\PianoScribe;
; die Deinstallation fragt, ob sie mitgelöscht werden sollen.

#ifndef AppVersion
  #define AppVersion "0.1.0"
#endif
#define AppName "PianoScribe"
#define AppExe "PianoScribe.exe"

[Setup]
AppId={{46E9DD04-FD7B-45F5-8255-FBBF264D9823}
AppName={#AppName}
AppVersion={#AppVersion}
AppVerName={#AppName} {#AppVersion}
AppPublisher={#AppName}
AppComments=Klavier aus Audio isolieren, transkribieren und als Notenblatt ausgeben
DefaultDirName={autopf}\{#AppName}
DefaultGroupName={#AppName}
DisableProgramGroupPage=yes
PrivilegesRequired=lowest
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
MinVersion=10.0
WizardStyle=modern
ShowLanguageDialog=no
SetupIconFile=pianoscribe.ico
UninstallDisplayIcon={app}\{#AppExe}
UninstallDisplayName={#AppName}
OutputDir=Output
OutputBaseFilename=PianoScribe-Setup-{#AppVersion}
Compression=lzma2/max
SolidCompression=yes
LZMAUseSeparateProcess=yes
LZMANumBlockThreads=4
DiskSpanning=yes
DiskSliceSize=max
SetupLogging=yes

[Languages]
Name: "de"; MessagesFile: "compiler:Languages\German.isl"

[Tasks]
Name: "desktopicon"; Description: "{cm:CreateDesktopIcon}"; GroupDescription: "{cm:AdditionalIcons}"; Flags: unchecked

[InstallDelete]
; Reste einer älteren Version entfernen (PyInstaller-Bundles ändern ihre Dateiliste).
Type: filesandordirs; Name: "{app}\_internal"

[Files]
Source: "dist\PianoScribe\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs

[Icons]
Name: "{autoprograms}\{#AppName}"; Filename: "{app}\{#AppExe}"; Comment: "Klavier aus Audio transkribieren"
Name: "{autodesktop}\{#AppName}"; Filename: "{app}\{#AppExe}"; Tasks: desktopicon

[Run]
Filename: "{app}\{#AppExe}"; Description: "{cm:LaunchProgram,{#AppName}}"; Flags: nowait postinstall skipifsilent

[UninstallDelete]
Type: dirifempty; Name: "{app}"

[Code]
const
  WebView2Client = 'Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}';
  WebView2Url = 'https://go.microsoft.com/fwlink/p/?LinkId=2124703';

function IsValidVersion(const Version: String): Boolean;
begin
  Result := (Version <> '') and (Version <> '0.0.0.0');
end;

{ Edge WebView2 Runtime: systemweit (64-bit-Windows), systemweit (32-bit) oder pro Benutzer. }
function WebView2Installed: Boolean;
var
  Version: String;
begin
  Result := False;
  if RegQueryStringValue(HKLM, 'SOFTWARE\WOW6432Node\' + WebView2Client, 'pv', Version) then
    Result := IsValidVersion(Version);
  if (not Result) and RegQueryStringValue(HKLM, 'SOFTWARE\' + WebView2Client, 'pv', Version) then
    Result := IsValidVersion(Version);
  if (not Result) and RegQueryStringValue(HKCU, 'Software\' + WebView2Client, 'pv', Version) then
    Result := IsValidVersion(Version);
end;

function InitializeSetup: Boolean;
var
  ErrorCode: Integer;
begin
  Result := True;
  if WebView2Installed or WizardSilent then
    Exit;
  case MsgBox('PianoScribe braucht die „Microsoft Edge WebView2 Runtime“, die auf diesem ' +
      'Rechner nicht gefunden wurde. Sie ist kostenlos und schnell installiert.' + #13#10#13#10 +
      'Ja: Download-Seite von Microsoft öffnen und PianoScribe trotzdem installieren' + #13#10 +
      'Nein: ohne Download fortfahren' + #13#10 +
      'Abbrechen: Installation beenden', mbConfirmation, MB_YESNOCANCEL) of
    IDYES: ShellExec('open', WebView2Url, '', '', SW_SHOWNORMAL, ewNoWait, ErrorCode);
    IDCANCEL: Result := False;
  end;
end;

procedure CurUninstallStepChanged(CurUninstallStep: TUninstallStep);
var
  DataDir: String;
begin
  if CurUninstallStep <> usPostUninstall then
    Exit;
  DataDir := ExpandConstant('{localappdata}\PianoScribe');
  if (not DirExists(DataDir)) or UninstallSilent then
    Exit;
  if MsgBox('Sollen auch die Projekte, die heruntergeladenen Modelle (ca. 300 MB), die ' +
      'Einstellungen und die Logs gelöscht werden?' + #13#10#13#10 + DataDir + #13#10#13#10 +
      'Bei „Nein“ bleiben sie für eine spätere Installation erhalten.',
      mbConfirmation, MB_YESNO or MB_DEFBUTTON2) = IDYES then
    DelTree(DataDir, True, True, True);
end;
