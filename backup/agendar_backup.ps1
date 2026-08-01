# =============================================================
#  Registra o backup do Supabase no Agendador de Tarefas do Windows
#  Execute este script UMA VEZ como Administrador
# =============================================================

$TASK_NAME   = "RODO-CHAGAS - Backup Supabase 23h30"
$SCRIPT_PATH = "c:\Users\davis\Documents\RODO-CHAGAS\backup\backup_db.ps1"

# Remove tarefa anterior se existir
if (Get-ScheduledTask -TaskName $TASK_NAME -ErrorAction SilentlyContinue) {
    Unregister-ScheduledTask -TaskName $TASK_NAME -Confirm:$false
    Write-Host "Tarefa anterior removida." -ForegroundColor Yellow
}

# Ação: executar o PowerShell com o script de backup
$action = New-ScheduledTaskAction `
    -Execute "powershell.exe" `
    -Argument "-ExecutionPolicy Bypass -WindowStyle Hidden -File `"$SCRIPT_PATH`""

# Gatilho: diariamente às 23:30
$trigger = New-ScheduledTaskTrigger `
    -Daily `
    -At "23:30"

# Configurações: executar mesmo quando o usuário não estiver logado
$settings = New-ScheduledTaskSettingsSet `
    -ExecutionTimeLimit (New-TimeSpan -Hours 1) `
    -StartWhenAvailable `
    -RunOnlyIfNetworkAvailable

# Registra a tarefa
Register-ScheduledTask `
    -TaskName $TASK_NAME `
    -Action   $action `
    -Trigger  $trigger `
    -Settings $settings `
    -RunLevel Highest `
    -Force

Write-Host ""
Write-Host "Tarefa agendada com sucesso!" -ForegroundColor Green
Write-Host "  Nome:     $TASK_NAME"        -ForegroundColor Cyan
Write-Host "  Horario:  Todos os dias as 23:30" -ForegroundColor Cyan
Write-Host "  Script:   $SCRIPT_PATH"      -ForegroundColor Cyan
Write-Host ""
Write-Host "IMPORTANTE: Antes de tudo, edite o script backup_db.ps1 e preencha:" -ForegroundColor Yellow
Write-Host "  - `$DB_PASSWORD = 'SUA_SENHA_AQUI'  <-- sua senha do Supabase" -ForegroundColor Yellow
Write-Host "  - `$PG_DUMP     = caminho correto do pg_dump no seu PC"         -ForegroundColor Yellow
