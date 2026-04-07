# ============================================
# Script de synchronisation web → mobile
# Usage : .\sync-web.ps1
# ============================================

$ErrorActionPreference = "Stop"
$ROOT = $PSScriptRoot
$TARGET = Join-Path $ROOT "targetym-dashboard"

Write-Host ""
Write-Host "===========================================" -ForegroundColor Cyan
Write-Host "  Synchronisation Web -> Mobile" -ForegroundColor Cyan
Write-Host "===========================================" -ForegroundColor Cyan
Write-Host ""

# Fichiers protégés (mobile-only) — ne JAMAIS les écraser
$PROTECTED_FILES = @(
    "capacitor.config.ts",
    "CAPACITOR_SETUP.md",
    "lib/capacitor-plugins.ts",
    "next.config.mjs",
    "package.json",
    "components/BottomNav.tsx",
    "components/Sidebar.tsx",
    "app/layout.tsx",
    "app/globals.css",
    "app/dashboard/layout.tsx",
    "app/dashboard/employees/page.tsx",
    "app/dashboard/leaves/page.tsx",
    "app/dashboard/missions/page.tsx",
    "app/dashboard/my-space/page.tsx",
    "app/dashboard/my-space/documents/page.tsx",
    "app/dashboard/my-space/internal-jobs/page.tsx",
    "app/dashboard/platform-admin/page.tsx",
    "app/dashboard/resources/page.tsx",
    "app/dashboard/talents/succession/page.tsx",
    "app/dashboard/recruitment/page.tsx",
    "components/AIChatBox.tsx",
    "components/EmployeeDocuments.tsx",
    "public/mobile-patch.js"
)

Set-Location $ROOT

# 1. Vérifier que git est dans un état propre
Write-Host "[1/5] Verification de l'etat git..." -ForegroundColor Yellow
$status = git status --porcelain
if ($status) {
    Write-Host "ATTENTION: Vous avez des modifications non commitees:" -ForegroundColor Red
    git status --short
    $confirm = Read-Host "Continuer quand meme ? (o/N)"
    if ($confirm -ne "o") {
        Write-Host "Annule." -ForegroundColor Red
        exit 1
    }
}

# 2. Fetch upstream
Write-Host ""
Write-Host "[2/5] Recuperation des dernieres modifications du repo web..." -ForegroundColor Yellow
git fetch upstream main
if ($LASTEXITCODE -ne 0) {
    Write-Host "Echec du fetch upstream. Verifiez votre connexion." -ForegroundColor Red
    exit 1
}

# 3. Vérifier s'il y a quelque chose de nouveau
$LAST_SYNC_FILE = Join-Path $ROOT ".last-sync-commit"
$LAST_SYNC = ""
if (Test-Path $LAST_SYNC_FILE) {
    $LAST_SYNC = (Get-Content $LAST_SYNC_FILE -Raw).Trim()
}
$CURRENT_WEB = (git rev-parse upstream/main).Trim()

if ($LAST_SYNC -eq $CURRENT_WEB) {
    Write-Host ""
    Write-Host "Deja a jour ! Aucun nouveau commit sur le repo web." -ForegroundColor Green
    exit 0
}

Write-Host ""
Write-Host "[3/5] Nouveaux commits detectes :" -ForegroundColor Yellow
if ($LAST_SYNC) {
    git log --oneline "$LAST_SYNC..$CURRENT_WEB"
} else {
    Write-Host "(premier sync)"
}

# 4. Lister les fichiers modifiés
Write-Host ""
Write-Host "[4/5] Application des changements..." -ForegroundColor Yellow

if ($LAST_SYNC) {
    $CHANGED_FILES = git diff --name-only "$LAST_SYNC" "$CURRENT_WEB" 2>$null
} else {
    $CHANGED_FILES = git ls-tree -r --name-only upstream/main
}

$copied = 0
$skipped = 0

foreach ($file in $CHANGED_FILES) {
    if ([string]::IsNullOrWhiteSpace($file)) { continue }

    $normalized = $file -replace '\\', '/'

    # Vérifier si protégé
    if ($PROTECTED_FILES -contains $normalized) {
        Write-Host "  SKIP (protege)  : $file" -ForegroundColor DarkGray
        $skipped++
        continue
    }

    # Copier le fichier depuis upstream
    $dest = Join-Path $TARGET $file
    $destDir = Split-Path $dest -Parent
    if (-not (Test-Path $destDir)) {
        New-Item -ItemType Directory -Path $destDir -Force | Out-Null
    }

    try {
        $content = git show "upstream/main:$file" 2>$null
        if ($LASTEXITCODE -eq 0) {
            $content | Set-Content -Path $dest -NoNewline
            Write-Host "  COPY            : $file" -ForegroundColor Green
            $copied++
        }
    } catch {
        Write-Host "  WARN (introuvable): $file" -ForegroundColor Yellow
    }
}

Write-Host ""
Write-Host "Resultat : $copied fichiers copies, $skipped fichiers proteges" -ForegroundColor Cyan

# 5. Mettre à jour le marqueur
$CURRENT_WEB | Set-Content -Path $LAST_SYNC_FILE -NoNewline

Write-Host ""
Write-Host "[5/5] Termine !" -ForegroundColor Green
Write-Host ""
Write-Host "===========================================" -ForegroundColor Cyan
Write-Host "  Etapes suivantes :" -ForegroundColor Cyan
Write-Host "===========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "1. Verifier les changements :" -ForegroundColor White
Write-Host "   git status" -ForegroundColor Gray
Write-Host "   git diff" -ForegroundColor Gray
Write-Host ""
Write-Host "2. Tester le build mobile :" -ForegroundColor White
Write-Host "   cd targetym-dashboard" -ForegroundColor Gray
Write-Host "   npm run mobile:build" -ForegroundColor Gray
Write-Host ""
Write-Host "3. Si tout marche, commiter :" -ForegroundColor White
Write-Host "   git add -A" -ForegroundColor Gray
Write-Host "   git commit -m 'sync: maj depuis le repo web'" -ForegroundColor Gray
Write-Host "   git push" -ForegroundColor Gray
Write-Host ""
