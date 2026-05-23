Add-Type -AssemblyName System.IO.Compression.FileSystem

function Get-ColumnName([int]$index) {
  $name = ''
  while ($index -gt 0) {
    $index--
    $name = [char](65 + ($index % 26)) + $name
    $index = [math]::Floor($index / 26)
  }
  return $name
}

function Escape-Xml([string]$value) {
  if ($null -eq $value) { return '' }
  return [System.Security.SecurityElement]::Escape([string]$value)
}

function New-SimpleXlsx($path, $sheetName, $rows) {
  $tempRoot = Join-Path ([System.IO.Path]::GetTempPath()) ([System.Guid]::NewGuid().ToString())
  $xlPath = Join-Path $tempRoot 'xl'
  $relsPath = Join-Path $tempRoot '_rels'
  $xlRelsPath = Join-Path $xlPath '_rels'
  $worksheetsPath = Join-Path $xlPath 'worksheets'
  $docPropsPath = Join-Path $tempRoot 'docProps'
  New-Item -ItemType Directory -Force -Path $xlPath, $relsPath, $xlRelsPath, $worksheetsPath, $docPropsPath | Out-Null

  $sheetRows = New-Object System.Collections.Generic.List[string]
  for ($r = 0; $r -lt $rows.Count; $r++) {
    $row = $rows[$r]
    if ($null -eq $row -or $row.Count -eq 0) {
      $sheetRows.Add("<row r='$($r + 1)'/>")
      continue
    }

    $cells = New-Object System.Collections.Generic.List[string]
    for ($c = 0; $c -lt $row.Count; $c++) {
      $value = Escape-Xml ([string]$row[$c])
      $cellRef = "$(Get-ColumnName ($c + 1))$($r + 1)"
      $cells.Add("<c r='$cellRef' t='inlineStr'><is><t xml:space='preserve'>$value</t></is></c>")
    }
    $sheetRows.Add("<row r='$($r + 1)'>$($cells -join '')</row>")
  }

  $sheetXml = "<?xml version='1.0' encoding='UTF-8' standalone='yes'?><worksheet xmlns='http://schemas.openxmlformats.org/spreadsheetml/2006/main'><sheetData>$($sheetRows -join '')</sheetData></worksheet>"
  $workbookXml = "<?xml version='1.0' encoding='UTF-8' standalone='yes'?><workbook xmlns='http://schemas.openxmlformats.org/spreadsheetml/2006/main' xmlns:r='http://schemas.openxmlformats.org/officeDocument/2006/relationships'><sheets><sheet name='$(Escape-Xml $sheetName)' sheetId='1' r:id='rId1'/></sheets></workbook>"
  $workbookRelsXml = "<?xml version='1.0' encoding='UTF-8' standalone='yes'?><Relationships xmlns='http://schemas.openxmlformats.org/package/2006/relationships'><Relationship Id='rId1' Type='http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet' Target='worksheets/sheet1.xml'/><Relationship Id='rId2' Type='http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles' Target='styles.xml'/></Relationships>"
  $rootRelsXml = "<?xml version='1.0' encoding='UTF-8' standalone='yes'?><Relationships xmlns='http://schemas.openxmlformats.org/package/2006/relationships'><Relationship Id='rId1' Type='http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument' Target='xl/workbook.xml'/><Relationship Id='rId2' Type='http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties' Target='docProps/core.xml'/><Relationship Id='rId3' Type='http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties' Target='docProps/app.xml'/></Relationships>"
  $contentTypesXml = "<?xml version='1.0' encoding='UTF-8' standalone='yes'?><Types xmlns='http://schemas.openxmlformats.org/package/2006/content-types'><Default Extension='rels' ContentType='application/vnd.openxmlformats-package.relationships+xml'/><Default Extension='xml' ContentType='application/xml'/><Override PartName='/xl/workbook.xml' ContentType='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml'/><Override PartName='/xl/worksheets/sheet1.xml' ContentType='application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml'/><Override PartName='/xl/styles.xml' ContentType='application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml'/><Override PartName='/docProps/core.xml' ContentType='application/vnd.openxmlformats-package.core-properties+xml'/><Override PartName='/docProps/app.xml' ContentType='application/vnd.openxmlformats-officedocument.extended-properties+xml'/></Types>"
  $stylesXml = "<?xml version='1.0' encoding='UTF-8' standalone='yes'?><styleSheet xmlns='http://schemas.openxmlformats.org/spreadsheetml/2006/main'><fonts count='1'><font><sz val='11'/><name val='Calibri'/></font></fonts><fills count='1'><fill><patternFill patternType='none'/></fill></fills><borders count='1'><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count='1'><xf numFmtId='0' fontId='0' fillId='0' borderId='0'/></cellStyleXfs><cellXfs count='1'><xf numFmtId='0' fontId='0' fillId='0' borderId='0' xfId='0'/></cellXfs><cellStyles count='1'><cellStyle name='Normal' xfId='0' builtinId='0'/></cellStyles></styleSheet>"
  $coreXml = "<?xml version='1.0' encoding='UTF-8' standalone='yes'?><cp:coreProperties xmlns:cp='http://schemas.openxmlformats.org/package/2006/metadata/core-properties' xmlns:dc='http://purl.org/dc/elements/1.1/' xmlns:dcterms='http://purl.org/dc/terms/' xmlns:dcmitype='http://purl.org/dc/dcmitype/' xmlns:xsi='http://www.w3.org/2001/XMLSchema-instance'><dc:creator>Codex</dc:creator><cp:lastModifiedBy>Codex</cp:lastModifiedBy><dcterms:created xsi:type='dcterms:W3CDTF'>2026-03-16T00:00:00Z</dcterms:created><dcterms:modified xsi:type='dcterms:W3CDTF'>2026-03-16T00:00:00Z</dcterms:modified></cp:coreProperties>"
  $appXml = "<?xml version='1.0' encoding='UTF-8' standalone='yes'?><Properties xmlns='http://schemas.openxmlformats.org/officeDocument/2006/extended-properties' xmlns:vt='http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes'><Application>Microsoft Excel</Application></Properties>"

  $utf8 = New-Object System.Text.UTF8Encoding($false)
  [System.IO.File]::WriteAllText((Join-Path $tempRoot '[Content_Types].xml'), $contentTypesXml, $utf8)
  [System.IO.File]::WriteAllText((Join-Path $relsPath '.rels'), $rootRelsXml, $utf8)
  [System.IO.File]::WriteAllText((Join-Path $xlPath 'workbook.xml'), $workbookXml, $utf8)
  [System.IO.File]::WriteAllText((Join-Path $xlRelsPath 'workbook.xml.rels'), $workbookRelsXml, $utf8)
  [System.IO.File]::WriteAllText((Join-Path $worksheetsPath 'sheet1.xml'), $sheetXml, $utf8)
  [System.IO.File]::WriteAllText((Join-Path $xlPath 'styles.xml'), $stylesXml, $utf8)
  [System.IO.File]::WriteAllText((Join-Path $docPropsPath 'core.xml'), $coreXml, $utf8)
  [System.IO.File]::WriteAllText((Join-Path $docPropsPath 'app.xml'), $appXml, $utf8)

  if (Test-Path $path) { Remove-Item $path -Force }
  [System.IO.Compression.ZipFile]::CreateFromDirectory($tempRoot, $path)
  Remove-Item $tempRoot -Recurse -Force
}

$base = Join-Path $PSScriptRoot '..\\sample-import-files'

$files = @(
  @{ Name = 'organizations-template.xlsx'; Sheet = 'organizations template'; Rows = @(
    @('Template Instructions'),
    @('Required fields','name, organizationType, email, phone'),
    @('Optional fields','addressLine, city, state, country, pincode, status'),
    @('Mapping fields','none'),
    @('Allowed values: organizationType','logistics, transport, school, taxi, fleet'),
    @('Allowed values: status','active, inactive'),
    @('Note','Do not include parent organization columns.'),
    @('Note','Organization is created under the selected or current organization context where applicable.'),
    @('Note','Phone must be a valid international number with country code.'),
    @(),
    @('name','organizationType','email','phone','addressLine','city','state','country','pincode','status'),
    @('North Fleet Logistics','logistics','northfleet@example.com','+919876543210','101 Industrial Park','Mumbai','Maharashtra','India','400001','active')
  )},
  @{ Name = 'users-template.xlsx'; Sheet = 'users template'; Rows = @(
    @('Template Instructions'),
    @('Required fields','firstName, email, mobile, role, password'),
    @('Optional fields','lastName, status'),
    @('Mapping fields','none'),
    @('Allowed values: role','admin, driver'),
    @('Allowed values: status','active, inactive'),
    @('Note','Do not include organization scope columns.'),
    @('Note','Password must be at least 6 characters.'),
    @(),
    @('firstName','lastName','email','mobile','role','status','password'),
    @('Amit','Sharma','amit.sharma@example.com','+919876543211','admin','active','Secret123')
  )},
  @{ Name = 'vehicles-template.xlsx'; Sheet = 'vehicles template'; Rows = @(
    @('Template Instructions'),
    @('Required fields','vehicleType, vehicleNumber'),
    @('Optional fields','ais140Compliant, ais140CertificateNumber, make, model, year, color, status, runningStatus, lastUpdated, deviceImei'),
    @('Mapping fields','deviceImei'),
    @('Allowed values: vehicleType','car, bus, truck, bike, other'),
    @('Allowed values: status','active, inactive, maintenance, decommissioned'),
    @('Allowed values: runningStatus','running, idle, stopped, inactive'),
    @('Allowed values: ais140Compliant','true, false'),
    @('Note','deviceImei is optional and is used only when you want to link an existing device during import.'),
    @('Note','Do not include organization scope columns.'),
    @(),
    @('vehicleType','vehicleNumber','ais140Compliant','ais140CertificateNumber','make','model','year','color','status','runningStatus','lastUpdated','deviceImei'),
    @('truck','MH12AB1234','true','CERT000001','Tata','Ace Gold','2024','White','active','inactive','2026-03-13T09:30:00.000Z','123456789012345')
  )},
  @{ Name = 'devices-template.xlsx'; Sheet = 'devices template'; Rows = @(
    @('Template Instructions'),
    @('Required fields','imei, softwareVersion'),
    @('Optional fields','vendorId, deviceModel, manufacturer, simNumber, serialNumber, firmwareVersion, hardwareVersion, warrantyExpiry, status, vehicleRegistrationNumber'),
    @('Mapping fields','vehicleRegistrationNumber'),
    @('Allowed values: status','active, inactive, suspended'),
    @('Note','IMEI must be exactly 15 digits.'),
    @('Note','vehicleRegistrationNumber is for mapping or linking only.'),
    @('Note','Do not include organization scope columns or runtime telemetry fields.'),
    @(),
    @('imei','softwareVersion','vendorId','deviceModel','manufacturer','simNumber','serialNumber','firmwareVersion','hardwareVersion','warrantyExpiry','status','vehicleRegistrationNumber'),
    @('123456789012345','1.0.4','ROADRPA','RX-100','Ajiva Devices','+919876543212','SN-0001','1.0.4','HW-2','2027-03-13','active','MH12AB1234')
  )},
  @{ Name = 'drivers-template.xlsx'; Sheet = 'drivers template'; Rows = @(
    @('Template Instructions'),
    @('Required fields','firstName, lastName, email, phone, licenseNumber, password'),
    @('Optional fields','licenseExpiry, status'),
    @('Mapping fields','none'),
    @('Allowed values: status','active, inactive, blocked'),
    @('Note','Do not include organization scope columns.'),
    @('Note','licenseExpiry format should be YYYY-MM-DD.'),
    @('Note','Password must be at least 6 characters.'),
    @(),
    @('firstName','lastName','email','phone','licenseNumber','licenseExpiry','status','password'),
    @('Rohit','Kumar','rohit.kumar@example.com','+919876543213','DL01AB1234','2027-06-01','active','Secret123')
  )},
  @{ Name = 'device-mapping-template.xlsx'; Sheet = 'device mapping template'; Rows = @(
    @('Template Instructions'),
    @('Required fields','vehicleNumber, imei'),
    @('Optional fields','none'),
    @('Mapping fields','vehicleNumber, imei'),
    @('Note','Vehicle must already exist.'),
    @('Note','Device must already exist.'),
    @('Note','Device must be valid for mapping in the current organization scope.'),
    @(),
    @('vehicleNumber','imei'),
    @('DL01AB1234','865342056789012')
  )},
  @{ Name = 'driver-mapping-template.xlsx'; Sheet = 'driver mapping template'; Rows = @(
    @('Template Instructions'),
    @('Required fields','vehicleNumber, driverEmail'),
    @('Optional fields','none'),
    @('Mapping fields','vehicleNumber, driverEmail'),
    @('Note','Vehicle must already exist.'),
    @('Note','Driver must already exist.'),
    @('Note','Driver must be active.'),
    @('Note','Mapping must stay inside the allowed organization scope.'),
    @(),
    @('vehicleNumber','driverEmail'),
    @('DL01AB1234','driver1@test.com')
  )}
)

foreach ($file in $files) {
  New-SimpleXlsx -path (Join-Path $base $file.Name) -sheetName $file.Sheet -rows $file.Rows
}
