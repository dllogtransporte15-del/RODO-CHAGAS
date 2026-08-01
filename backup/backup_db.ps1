# =============================================================
#  RODO-CHAGAS - Backup Automático do Banco de Dados Supabase
#  Executa todos os dias às 23:30 via Agendador de Tarefas
# =============================================================

# ── CONFIGURAÇÃO ─────────────────────────────────────────────
$DB_HOST     = "aws-0-sa-east-1.pooler.supabase.com"
$DB_PORT     = "5432"
$DB_NAME     = "postgres"
$DB_USER     = "postgres.gyvnhvnuidrfmqzielmv"
$DB_PASSWORD = "SUA_SENHA_AQUI"   # <- substitua pela senha real do Supabase

$BACKUP_DIR  = "$PSScriptRoot\arquivos"
$TOOLS_DIR   = "$PSScriptRoot\tools"
$LOG_FILE    = "$BACKUP_DIR\backup.log"
# ─────────────────────────────────────────────────────────────

function Write-Log($msg) {
    $line = "[$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')] $msg"
    Write-Host $line
    Add-Content -Path $LOG_FILE -Value $line
}

# Cria pastas necessárias
foreach ($dir in @($BACKUP_DIR, $TOOLS_DIR)) {
    if (-not (Test-Path $dir)) { New-Item -ItemType Directory -Path $dir | Out-Null }
}

# ── LOCALIZA OU BAIXA O pg_dump ───────────────────────────────
# Tenta achar pg_dump em locais comuns primeiro
$PG_DUMP = $null
$candidates = @(
    "C:\Program Files\PostgreSQL\17\bin\pg_dump.exe",
    "C:\Program Files\PostgreSQL\16\bin\pg_dump.exe",
    "C:\Program Files\PostgreSQL\15\bin\pg_dump.exe",
    "$TOOLS_DIR\pgsql\bin\pg_dump.exe"
)
foreach ($c in $candidates) {
    if (Test-Path $c) { $PG_DUMP = $c; break }
}

# Se não encontrou, baixa versão portátil (binários Windows x64 do PostgreSQL 16)
if (-not $PG_DUMP) {
    Write-Log "pg_dump nao encontrado. Baixando binario portatil..."
    $ZIP_URL  = "https://get.enterprisedb.com/postgresql/postgresql-16.3-1-windows-x64-binaries.zip"
    $ZIP_PATH = "$TOOLS_DIR\pg_binaries.zip"

    try {
        [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
        Invoke-WebRequest -Uri $ZIP_URL -OutFile $ZIP_PATH -UseBasicParsing
        Expand-Archive -Path $ZIP_PATH -DestinationPath $TOOLS_DIR -Force
        $PG_DUMP = "$TOOLS_DIR\pgsql\bin\pg_dump.exe"
        Remove-Item $ZIP_PATH -Force
        Write-Log "pg_dump baixado em: $PG_DUMP"
    }
    catch {
        Write-Log "ERRO ao baixar pg_dump. Instale o PostgreSQL Client manualmente."
        Write-Log "Download: https://www.postgresql.org/download/windows/"
        exit 1
    }
}

Write-Log "Usando pg_dump: $PG_DUMP"

# ── EXECUTA O BACKUP ──────────────────────────────────────────
$TIMESTAMP   = Get-Date -Format "yyyy-MM-dd_HH-mm-ss"
$BACKUP_FILE = "$BACKUP_DIR\backup_$TIMESTAMP.sql"

$env:PGPASSWORD = $DB_PASSWORD

try {
    Write-Log "Iniciando backup do banco '$DB_NAME'..."

    & "$PG_DUMP" `
        "--host=$DB_HOST" `
        "--port=$DB_PORT" `
        "--username=$DB_USER" `
        "--dbname=$DB_NAME" `
        "--format=plain" `
        "--no-password" `
        "--file=$BACKUP_FILE"

    if ($LASTEXITCODE -eq 0) {
        $SIZE = [math]::Round((Get-Item $BACKUP_FILE).Length / 1MB, 2)
        Write-Log "Backup concluido com sucesso: $BACKUP_FILE ($SIZE MB)"
    } else {
        throw "pg_dump retornou codigo de erro: $LASTEXITCODE"
    }
}
catch {
    Write-Log "ERRO no backup: $_"
}
finally {
    $env:PGPASSWORD = ""
}

# ── LIMPEZA AUTOMÁTICA (30 dias) ──────────────────────────────
$DIAS = 30
Get-ChildItem -Path $BACKUP_DIR -Filter "backup_*.sql" |
    Where-Object { $_.LastWriteTime -lt (Get-Date).AddDays(-$DIAS) } |
    ForEach-Object {
        Remove-Item $_.FullName -Force
        Write-Log "Backup antigo removido: $($_.Name)"
    }
