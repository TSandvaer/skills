<#
.SYNOPSIS
  Package a Claude Code skill folder into a shareable <skill-name>.zip.

.DESCRIPTION
  Stages the skill into a temp folder, drops eval/workspace/build artifacts,
  then compresses it so the archive's root is the skill folder itself
  (extracts to <skill-name>/). Writes the zip to the skill's parent folder
  by default. Prints the absolute path of the created zip on success.

.PARAMETER SkillDir
  Absolute path to the skill folder to package (the folder containing SKILL.md).

.PARAMETER OutDir
  Optional. Folder to write the zip into. Defaults to the skill's parent folder.

.EXAMPLE
  .\zip-skill.ps1 -SkillDir "C:\Users\538252\.claude\skills\post-pr"
#>
param(
    [Parameter(Mandatory = $true)][string]$SkillDir,
    [string]$OutDir
)

$ErrorActionPreference = 'Stop'

if (-not (Test-Path -LiteralPath $SkillDir)) {
    throw "Skill directory not found: $SkillDir"
}
$skill = Get-Item -LiteralPath $SkillDir
if (-not (Test-Path -LiteralPath (Join-Path $skill.FullName 'SKILL.md'))) {
    throw "No SKILL.md found in: $($skill.FullName)"
}

$name = $skill.Name
if (-not $OutDir) { $OutDir = $skill.Parent.FullName }
if (-not (Test-Path -LiteralPath $OutDir)) {
    New-Item -ItemType Directory -Path $OutDir -Force | Out-Null
}
$zipPath = Join-Path $OutDir ("$name.zip")

# Stage into a temp copy so we can exclude artifacts without touching the source.
$staging = Join-Path ([System.IO.Path]::GetTempPath()) ("skillzip_" + $name + "_" + $PID)
$dest = Join-Path $staging $name
if (Test-Path -LiteralPath $staging) { Remove-Item -LiteralPath $staging -Recurse -Force }
New-Item -ItemType Directory -Path $dest -Force | Out-Null

$excludeDirs  = @('evals', 'eval-viewer', 'skill-snapshot', '.git', 'node_modules', '__pycache__')
$excludeFiles = @('feedback.json', 'benchmark.json', 'benchmark.md', '*.zip')

# robocopy mirrors the tree with excludes. Exit codes 0-7 are success; 8+ is failure.
& robocopy $skill.FullName $dest /E /XD $excludeDirs /XF $excludeFiles /NFL /NDL /NJH /NJS /NP | Out-Null
if ($LASTEXITCODE -ge 8) {
    throw "robocopy failed copying skill files (exit $LASTEXITCODE)."
}

if (Test-Path -LiteralPath $zipPath) { Remove-Item -LiteralPath $zipPath -Force }
Compress-Archive -Path $dest -DestinationPath $zipPath -Force

Remove-Item -LiteralPath $staging -Recurse -Force

if (-not (Test-Path -LiteralPath $zipPath)) {
    throw "Zip was not created at: $zipPath"
}
Write-Output (Resolve-Path -LiteralPath $zipPath).Path

# robocopy sets $LASTEXITCODE to a small non-zero value on success (1 = files copied);
# exit 0 explicitly so callers don't misread a successful run as a failure.
exit 0
