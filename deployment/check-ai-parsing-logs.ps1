# Check CloudWatch logs for AI parsing errors
# This helps diagnose why AI parsing fails even when the key is set

$LAMBDA_FUNCTION = "hisab-api-v2"
$AWS_REGION = "ap-south-1"

Write-Host "=== Checking AI Parsing Logs ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "Fetching recent Lambda logs (last 10 minutes)..." -ForegroundColor Yellow
Write-Host ""

# Get logs from the last 10 minutes
$logGroup = "/aws/lambda/$LAMBDA_FUNCTION"
$startTime = (Get-Date).AddMinutes(-10).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")

try {
    $logs = aws logs filter-log-events `
        --log-group-name $logGroup `
        --start-time ([DateTimeOffset]::Parse($startTime).ToUnixTimeMilliseconds()) `
        --region $AWS_REGION `
        --output json | ConvertFrom-Json
    
    if ($logs.events) {
        Write-Host "Found $($logs.events.Count) log entries" -ForegroundColor Gray
        Write-Host ""
        
        # Filter for AI-related logs
        $aiLogs = $logs.events | Where-Object {
            $_.message -match "AI|OpenAI|parse-voice|gpt|openai_api_key" -or
            $_.message -match "AI parsing|AI Status|AI Enabled"
        }
        
        if ($aiLogs) {
            Write-Host "=== AI-Related Logs ===" -ForegroundColor Yellow
            Write-Host ""
            foreach ($log in $aiLogs) {
                $timestamp = [DateTimeOffset]::FromUnixTimeMilliseconds($log.timestamp).LocalDateTime.ToString("HH:mm:ss")
                Write-Host "[$timestamp] $($log.message)" -ForegroundColor Gray
            }
        } else {
            Write-Host "No AI-related logs found in the last 10 minutes" -ForegroundColor Yellow
            Write-Host "Try creating a voice expense and then run this script again" -ForegroundColor Gray
        }
        
        # Check for errors
        $errors = $logs.events | Where-Object {
            $_.message -match "ERROR|Exception|Failed|Error" -and
            ($_.message -match "AI|OpenAI|parse" -or $_.message -match "503|500")
        }
        
        if ($errors) {
            Write-Host ""
            Write-Host "=== Errors Found ===" -ForegroundColor Red
            foreach ($error in $errors) {
                $timestamp = [DateTimeOffset]::FromUnixTimeMilliseconds($error.timestamp).LocalDateTime.ToString("HH:mm:ss")
                Write-Host "[$timestamp] $($error.message)" -ForegroundColor Red
            }
        }
    } else {
        Write-Host "No logs found in the last 10 minutes" -ForegroundColor Yellow
        Write-Host "Try creating a voice expense and then run this script again" -ForegroundColor Gray
    }
} catch {
    Write-Host "Error fetching logs: $_" -ForegroundColor Red
    Write-Host ""
    Write-Host "Alternative: Check logs manually in AWS Console:" -ForegroundColor Yellow
    Write-Host "1. Go to CloudWatch > Log groups > /aws/lambda/$LAMBDA_FUNCTION" -ForegroundColor Gray
    Write-Host "2. Open the latest log stream" -ForegroundColor Gray
    Write-Host "3. Search for 'AI' or 'OpenAI'" -ForegroundColor Gray
}

Write-Host ""
Write-Host "=== Quick Test ===" -ForegroundColor Cyan
Write-Host "To test AI parsing, try creating a voice expense and check:" -ForegroundColor Yellow
Write-Host "1. Browser console (F12) - look for 'AI parsing' messages" -ForegroundColor Gray
Write-Host "2. Network tab - check /api/ai/parse-voice-expense response" -ForegroundColor Gray
Write-Host "3. CloudWatch logs - look for errors" -ForegroundColor Gray
Write-Host ""

