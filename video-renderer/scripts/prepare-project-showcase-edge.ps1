param(
  [string]$Manifest = "video-renderer\public\project-showcase\project-showcase-manifest.json",
  [string]$Voice = "zh-CN-YunyangNeural",
  [string]$Rate = "+0%",
  [string]$OutputManifest = "video-renderer\public\project-showcase\project-showcase-manifest-edge.json"
)

$ErrorActionPreference = 'Stop'

function Convert-VttTimeToSeconds {
  param([string]$Time)

  if ($Time -notmatch '^(\d+):(\d{2}):(\d{2})[\.,](\d{3})$') {
    throw "Invalid VTT time: $Time"
  }

  return ([int]$matches[1] * 3600) + ([int]$matches[2] * 60) + [int]$matches[3] + ([int]$matches[4] / 1000)
}

function Get-VttDurationSeconds {
  param([string]$Path)

  $last = 0.0
  $lines = Get-Content -LiteralPath $Path -Encoding UTF8
  foreach ($line in $lines) {
    if ($line -match '-->\s*(\d+:\d{2}:\d{2}[\.,]\d{3})') {
      $seconds = Convert-VttTimeToSeconds $matches[1]
      if ($seconds -gt $last) {
        $last = $seconds
      }
    }
  }

  if ($last -le 0) {
    throw "Cannot determine duration from VTT: $Path"
  }

  return [Math]::Round($last + 0.45, 3)
}

$root = (Resolve-Path -LiteralPath '.').Path
$manifestPath = Resolve-Path -LiteralPath $Manifest
$manifestData = Get-Content -LiteralPath $manifestPath -Raw -Encoding UTF8 | ConvertFrom-Json

$projectDir = Split-Path -Parent $manifestPath
$audioDir = Join-Path $projectDir 'audio-edge'
$tmpDir = Join-Path $projectDir 'tmp-edge'
New-Item -ItemType Directory -Force -Path $audioDir | Out-Null
New-Item -ItemType Directory -Force -Path $tmpDir | Out-Null

$audioSegments = @()
$index = 0
foreach ($scene in $manifestData.scenes) {
  $index++
  $id = [string]$scene.id
  $textPath = Join-Path $tmpDir "$id.txt"
  $mp3Path = Join-Path $audioDir "$id.mp3"
  $vttPath = Join-Path $audioDir "$id.vtt"

  Set-Content -LiteralPath $textPath -Value ([string]$scene.narration) -Encoding UTF8
  python -m edge_tts --file $textPath --voice $Voice --rate $Rate --write-media $mp3Path --write-subtitles $vttPath
  if ($LASTEXITCODE -ne 0) {
    throw "edge-tts failed for $id"
  }

  $duration = Get-VttDurationSeconds -Path $vttPath
  $scene.durationSec = $duration
  $audioSegments += @{
    id = $id
    file_path = $mp3Path
    duration_sec = $duration
    voice = $Voice
  }
  Write-Output ("[{0}/{1}] {2} {3}s" -f $index, $manifestData.scenes.Count, $id, $duration)
}

Remove-Item -LiteralPath $tmpDir -Recurse -Force

$manifestData.audioSegments = $audioSegments
$manifestData.generatedAt = (Get-Date).ToString('s')
if ($manifestData.PSObject.Properties.Name -contains 'voice') {
  $manifestData.voice = @{
    provider = 'edge-tts'
    voice = $Voice
    rate = $Rate
  }
} else {
  $manifestData | Add-Member -NotePropertyName voice -NotePropertyValue @{
  provider = 'edge-tts'
  voice = $Voice
  rate = $Rate
  }
}

$manifestData | ConvertTo-Json -Depth 12 | Set-Content -LiteralPath $OutputManifest -Encoding UTF8

$total = 0.0
foreach ($segment in $audioSegments) {
  $total += [double]$segment.duration_sec
}

[PSCustomObject]@{
  Manifest = (Resolve-Path -LiteralPath $OutputManifest).Path
  Voice = $Voice
  Rate = $Rate
  Scenes = $manifestData.scenes.Count
  DurationSeconds = [Math]::Round($total, 2)
  DurationMinutes = [Math]::Round($total / 60, 2)
}
