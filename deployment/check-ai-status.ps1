# Check AI Status in Lambda
# This script checks if OPENAI_API_KEY is set and tests the AI status endpoint

$LAMBDA_FUNCTION = "hisab-api-v2"
$AWS_REGION = "ap-south-1"
$API_URL = "https://e65w7up0h8.execute-api.ap-south-1.amazonaws.com"

Write-Host "=== Checking AI Status ===" -ForegroundColor Cyan
Write-Host ""

# Step 1: Check Lambda environment variables
Write-Host "1. Checking Lambda environment variables..." -ForegroundColor Yellow
$config = aws lambda get-function-configuration --function-name $LAMBDA_FUNCTION --region $AWS_REGION --output json | ConvertFrom-Json
$envVars = $config.Environment.Variables

$hasOpenAIKey = $false
$openAIKeyValue = $null

foreach ($key in $envVars.PSObject.Properties.Name) {
    if ($key -eq "OPENAI_API_KEY" -or $key -eq "openai_api_key") {
        $hasOpenAIKey = $true
        $openAIKeyValue = $envVars[$key]
        Write-Host "   ✅ Found: $key" -ForegroundColor Green
        if ($openAIKeyValue) {
            if ($openAIKeyValue.Length -gt 10) {
                $preview = $openAIKeyValue.Substring(0, 10) + "..."
            } else {
                $preview = $openAIKeyValue
            }
            Write-Host "      Value preview: $preview" -ForegroundColor Gray
            Write-Host "      Length: $($openAIKeyValue.Length) characters" -ForegroundColor Gray
        } else {
            Write-Host "      Warning: Value is empty!" -ForegroundColor Red
        }
    }
}

if (-not $hasOpenAIKey) {
    Write-Host "   ❌ OPENAI_API_KEY not found in environment variables!" -ForegroundColor Red
    Write-Host ""
    Write-Host "   To add it:" -ForegroundColor Yellow
    Write-Host "   aws lambda update-function-configuration \`" -ForegroundColor Gray
    Write-Host "       --function-name $LAMBDA_FUNCTION \`" -ForegroundColor Gray
    Write-Host "       --environment 'Variables={OPENAI_API_KEY=sk-your-key-here,...}' \`" -ForegroundColor Gray
    Write-Host "       --region $AWS_REGION" -ForegroundColor Gray
}

Write-Host ""

# Step 2: Test the AI status endpoint
Write-Host "2. Testing AI status endpoint..." -ForegroundColor Yellow
try {
    $response = Invoke-RestMethod -Uri "$API_URL/api/ai/status" -Method Get -ContentType "application/json"
    Write-Host "   Response:" -ForegroundColor Gray
    Write-Host "   - AI Enabled: $($response.ai_enabled)" -ForegroundColor $(if ($response.ai_enabled) { "Green" } else { "Red" })
    Write-Host "   - Model: $($response.model)" -ForegroundColor Gray
    
    if ($response.debug) {
        Write-Host "   Debug info:" -ForegroundColor Gray
        Write-Host "   - Has key: $($response.debug.has_key)" -ForegroundColor Gray
        Write-Host "   - Key length: $($response.debug.key_length)" -ForegroundColor Gray
        Write-Host "   - Key preview: $($response.debug.key_preview)" -ForegroundColor Gray
    }
} catch {
    Write-Host "   ❌ Failed to call status endpoint: $_" -ForegroundColor Red
    Write-Host "   Make sure you're logged in and the API is accessible" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "=== Summary ===" -ForegroundColor Cyan
Write-Host ""
if ($hasOpenAIKey -and $openAIKeyValue) {
    Write-Host "✅ OPENAI_API_KEY is set in Lambda" -ForegroundColor Green
} else {
    Write-Host "❌ OPENAI_API_KEY is missing or empty" -ForegroundColor Red
}

Write-Host ""
Write-Host "Note: If the key is set but AI still doesn't work:" -ForegroundColor Yellow
Write-Host "1. Check CloudWatch logs for AI parsing errors" -ForegroundColor Gray
Write-Host "2. Verify the API key is valid (starts with 'sk-')" -ForegroundColor Gray
Write-Host "3. Check if OpenAI API is accessible from Lambda" -ForegroundColor Gray
Write-Host ""

