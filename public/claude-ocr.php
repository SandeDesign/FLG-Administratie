<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'error' => 'Method not allowed']);
    exit();
}

$apiKey = 'sk-ant-api03-JOUW-KEY-HIER'; // Vervang met je Anthropic API key

$input = json_decode(file_get_contents('php://input'), true);
$ocrText = $input['ocrText'] ?? '';

if (!$ocrText) {
    echo json_encode(['success' => false, 'error' => 'No ocrText']);
    exit();
}

$requestBody = json_encode([
    'model' => 'claude-sonnet-4-5-20250514',
    'max_tokens' => 500,
    'messages' => [[
        'role' => 'user',
        'content' => "Extract invoice data from this Dutch OCR text.\n\nIMPORTANT: Return ONLY a JSON object, no explanations, no text before or after. Just the JSON:\n\n{\"supplierName\": \"company name\", \"invoiceNumber\": \"invoice number\", \"invoiceDate\": \"YYYY-MM-DD\", \"totalAmount\": 123.45, \"subtotalExclVat\": 102.02, \"vatAmount\": 21.43}\n\nOCR TEXT:\n" . $ocrText,
    ]],
]);

$ch = curl_init('https://api.anthropic.com/v1/messages');
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_POST, true);
curl_setopt($ch, CURLOPT_POSTFIELDS, $requestBody);
curl_setopt($ch, CURLOPT_HTTPHEADER, [
    'Content-Type: application/json',
    'x-api-key: ' . $apiKey,
    'anthropic-version: 2023-06-01',
]);
curl_setopt($ch, CURLOPT_TIMEOUT, 30);

$response = curl_exec($ch);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
$curlError = curl_error($ch);
curl_close($ch);

if ($curlError) {
    echo json_encode(['success' => false, 'error' => 'cURL error: ' . $curlError]);
    exit();
}

if ($httpCode !== 200) {
    echo json_encode(['success' => false, 'error' => 'Claude API error: HTTP ' . $httpCode, 'details' => $response]);
    exit();
}

$data = json_decode($response, true);
$text = $data['content'][0]['text'] ?? '';
$clean = preg_replace('/```json?\n?|\n?```/', '', trim($text));

if (preg_match('/\{[\s\S]*\}/s', $clean, $matches)) {
    $invoiceData = json_decode($matches[0], true);
    if ($invoiceData) {
        echo json_encode(['success' => true, 'invoiceData' => $invoiceData]);
    } else {
        echo json_encode(['success' => false, 'error' => 'Invalid JSON in response']);
    }
} else {
    echo json_encode(['success' => false, 'error' => 'No JSON found in response', 'raw' => $clean]);
}
