[CmdletBinding()]
param(
    [Parameter(Mandatory = $true, HelpMessage = "Mensagem de commit a ser usada")]
    [string]$CommitMessage,

    [Parameter(HelpMessage = "Título do pull request. Padrão: usa a mesma mensagem do commit.")]
    [string]$PrTitle,

    [Parameter(HelpMessage = "Corpo do pull request. Pode usar Markdown.")]
    [string]$PrBody = "Atualização enviada via scripts/auto-pr-deploy.ps1.",

    [Parameter(HelpMessage = "Branch de destino para o PR")]
    [string]$BaseBranch = "main",

    [Parameter(HelpMessage = "Ignora npm run build antes de commitar")]
    [switch]$SkipBuild,

    [Parameter(HelpMessage = "Se definido, já faz merge do PR após a criação, acionando o deploy")]
    [switch]$AutoMerge
)

$ErrorActionPreference = 'Stop'

function Assert-Command {
    param([string]$Name)
    if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
        throw "O comando '$Name' não foi encontrado no PATH. Instale/configure antes de continuar."
    }
}

function Invoke-Step {
    param(
        [string]$Label,
        [scriptblock]$Action
    )
    Write-Host "==> $Label" -ForegroundColor Cyan
    & $Action
    if ($LASTEXITCODE -ne 0) {
        throw "Falha ao executar etapa '$Label'. Código de saída: $LASTEXITCODE"
    }
}

if (-not (Test-Path .git)) {
    throw "Execute este script na raiz do repositório (onde está a pasta .git)."
}

Assert-Command git
Assert-Command npm
Assert-Command gh

if (-not $PrTitle) { $PrTitle = $CommitMessage }

$pendingChanges = git status --porcelain
if (-not $pendingChanges) {
    throw "Não há alterações para commitar."
}

$currentBranch = (git rev-parse --abbrev-ref HEAD).Trim()
$timestamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$branchName = "auto/$timestamp"

try {
    Invoke-Step "Criar branch de trabalho ($branchName)" { git switch -c $branchName | Out-Host }

    if ($SkipBuild) {
        Write-Host "Etapa de build ignorada (--SkipBuild)." -ForegroundColor Yellow
    } else {
        Invoke-Step "Executar npm run build" { npm run build }
    }

    Invoke-Step "Preparar arquivos" { git add -A }
    Invoke-Step "Criar commit" { git commit -m $CommitMessage }
    Invoke-Step "Enviar branch para origin" { git push -u origin $branchName }

    Write-Host "Criando pull request..." -ForegroundColor Cyan
    $prJson = gh pr create --title $PrTitle --body $PrBody --base $BaseBranch --head $branchName --json number,url
    $prData = $prJson | ConvertFrom-Json
    if ($prData -is [System.Array]) { $prData = $prData[0] }

    Write-Host "PR criado: $($prData.url)" -ForegroundColor Green

    if ($AutoMerge) {
        Write-Host "Mesclando PR para acionar deploy..." -ForegroundColor Cyan
        gh pr merge $prData.number --merge --delete-branch --yes
        Write-Host "Merge solicitado. Acompanhe o workflow de deploy no GitHub Actions." -ForegroundColor Green
    } else {
        Write-Host "Revise o PR e faça o merge quando desejar disparar o deploy." -ForegroundColor Yellow
    }
}
finally {
    git switch $currentBranch | Out-Null
}
