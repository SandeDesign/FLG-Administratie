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
$fileUrl = $input['fileUrl'] ?? '';
$fileBase64 = $input['fileBase64'] ?? '';
$fileMediaType = $input['fileMediaType'] ?? 'application/pdf';

if (!$fileUrl && !$fileBase64) {
    echo json_encode(['success' => false, 'error' => 'fileUrl or fileBase64 is required']);
    exit();
}

// Download file if URL provided
if ($fileUrl && !$fileBase64) {
    $ch = curl_init($fileUrl);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_FOLLOWLOCATION, true);
    curl_setopt($ch, CURLOPT_TIMEOUT, 30);
    $fileData = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $contentType = curl_getinfo($ch, CURLINFO_CONTENT_TYPE);
    curl_close($ch);

    if ($httpCode !== 200 || !$fileData) {
        echo json_encode(['success' => false, 'error' => 'Failed to download file: HTTP ' . $httpCode]);
        exit();
    }

    $fileBase64 = base64_encode($fileData);

    // Determine media type
    if ($contentType && strpos($contentType, 'application/') !== false) {
        $fileMediaType = explode(';', $contentType)[0];
    }

    // Guess from URL extension if needed
    if ($fileMediaType === 'application/octet-stream' || !$fileMediaType) {
        $ext = strtolower(pathinfo(parse_url($fileUrl, PHP_URL_PATH), PATHINFO_EXTENSION));
        $typeMap = ['pdf' => 'application/pdf', 'png' => 'image/png', 'jpg' => 'image/jpeg', 'jpeg' => 'image/jpeg', 'webp' => 'image/webp', 'gif' => 'image/gif'];
        $fileMediaType = $typeMap[$ext] ?? 'application/pdf';
    }
}

// Build content block for Claude
$extractionPrompt = "Je bent een expert Nederlandse factuur-scanner. Analyseer dit document (factuur, bon, of kassabon) en extraheer alle financiële gegevens.\n\nLet op:\n- Nederlandse bedragen gebruiken komma als decimaalteken (€ 1.234,56)\n- BTW is meestal 21% of 9%\n- Zoek naar: factuurnummer, factuurdatum, vervaldatum, bedragen, leveranciersnaam\n- Als je iets niet kunt vinden, gebruik null\n\nBELANGRIJK: Retourneer ALLEEN een JSON object, geen uitleg, geen tekst ervoor of erna:\n{\"supplierName\": \"bedrijfsnaam leverancier\", \"invoiceNumber\": \"factuurnummer\", \"invoiceDate\": \"YYYY-MM-DD\", \"dueDate\": \"YYYY-MM-DD of null\", \"subtotal\": 100.00, \"vatAmount\": 21.00, \"totalAmount\": 121.00, \"description\": \"korte omschrijving van de factuur\"}";

if ($fileMediaType === 'application/pdf') {
    $fileContent = [
        'type' => 'document',
        'source' => [
            'type' => 'base64',
            'media_type' => 'application/pdf',
            'data' => $fileBase64,
        ],
    ];
} else {
    $allowedImageTypes = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];
    $imageType = in_array($fileMediaType, $allowedImageTypes) ? $fileMediaType : 'image/jpeg';
    $fileContent = [
        'type' => 'image',
        'source' => [
            'type' => 'base64',
            'media_type' => $imageType,
            'data' => $fileBase64,
        ],
    ];
}

$requestBody = json_encode([
    'model' => 'claude-sonnet-4-5-20250514',
    'max_tokens' => 1000,
    'messages' => [[
        'role' => 'user',
        'content' => [
            $fileContent,
            ['type' => 'text', 'text' => $extractionPrompt],
        ],
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
curl_setopt($ch, CURLOPT_TIMEOUT, 60);

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

// Parse JSON from response
if (preg_match('/\{[\s\S]*\}/s', $clean, $matches)) {
    $invoiceData = json_decode($matches[0], true);
    if ($invoiceData) {
        echo json_encode(['success' => true, 'invoiceData' => $invoiceData]);
    } else {
        echo json_encode(['success' => false, 'error' => 'Invalid JSON in response', 'raw' => $clean]);
    }
} else {
    echo json_encode(['success' => false, 'error' => 'No JSON found in response', 'raw' => $clean]);
}
