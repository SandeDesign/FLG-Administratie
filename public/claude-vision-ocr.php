<?php
ini_set('memory_limit', '256M');
ini_set('max_execution_time', '120');

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(200); exit(); }
if ($_SERVER['REQUEST_METHOD'] !== 'POST') { http_response_code(405); die(json_encode(['success' => false, 'error' => 'POST only'])); }

$API_KEY = 'JOUW-ANTHROPIC-API-KEY-HIER'; // Vervang op internedata.nl met je echte key

$raw = file_get_contents('php://input');
if (!$raw) { die(json_encode(['success' => false, 'error' => 'Empty body'])); }

$input = json_decode($raw, true);
if (!$input) { die(json_encode(['success' => false, 'error' => 'Invalid JSON'])); }

$base64 = $input['fileBase64'] ?? '';
$mediaType = $input['fileMediaType'] ?? 'application/pdf';
$fileUrl = $input['fileUrl'] ?? '';

// If URL given, download and convert to base64
if ($fileUrl && !$base64) {
    $ch = curl_init($fileUrl);
    curl_setopt_array($ch, [CURLOPT_RETURNTRANSFER => true, CURLOPT_FOLLOWLOCATION => true, CURLOPT_TIMEOUT => 30]);
    $data = curl_exec($ch);
    $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $ct = curl_getinfo($ch, CURLINFO_CONTENT_TYPE);
    curl_close($ch);

    if ($code !== 200 || !$data) { die(json_encode(['success' => false, 'error' => "Download failed: HTTP $code"])); }

    $base64 = base64_encode($data);
    if ($ct) { $mediaType = explode(';', $ct)[0]; }

    // Guess from extension if content-type is generic
    if (in_array($mediaType, ['application/octet-stream', 'binary/octet-stream', ''])) {
        $ext = strtolower(pathinfo(parse_url($fileUrl, PHP_URL_PATH), PATHINFO_EXTENSION));
        $map = ['pdf'=>'application/pdf','png'=>'image/png','jpg'=>'image/jpeg','jpeg'=>'image/jpeg','webp'=>'image/webp'];
        $mediaType = $map[$ext] ?? 'application/pdf';
    }
}

if (!$base64) { die(json_encode(['success' => false, 'error' => 'No file data'])); }

// Build Claude API request
$prompt = "Je bent een expert factuurscanner. Analyseer dit document en extraheer de gegevens.

RETURN ONLY JSON, nothing else:
{\"supplierName\":\"naam\",\"invoiceNumber\":\"nummer\",\"invoiceDate\":\"YYYY-MM-DD\",\"subtotal\":0.00,\"vatAmount\":0.00,\"totalAmount\":0.00,\"description\":\"korte omschrijving\"}

Let op: Nederlandse bedragen met komma (1.234,56). BTW is 21% of 9%.";

if ($mediaType === 'application/pdf') {
    $content = [['type'=>'document','source'=>['type'=>'base64','media_type'=>'application/pdf','data'=>$base64]]];
} else {
    $allowed = ['image/png','image/jpeg','image/webp','image/gif'];
    $type = in_array($mediaType, $allowed) ? $mediaType : 'image/jpeg';
    $content = [['type'=>'image','source'=>['type'=>'base64','media_type'=>$type,'data'=>$base64]]];
}
$content[] = ['type'=>'text','text'=>$prompt];

$body = json_encode([
    'model' => 'claude-sonnet-4-20250514',
    'max_tokens' => 1024,
    'messages' => [['role'=>'user','content'=>$content]]
]);

$ch = curl_init('https://api.anthropic.com/v1/messages');
curl_setopt_array($ch, [
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_POST => true,
    CURLOPT_POSTFIELDS => $body,
    CURLOPT_TIMEOUT => 60,
    CURLOPT_HTTPHEADER => [
        'Content-Type: application/json',
        'x-api-key: ' . $API_KEY,
        'anthropic-version: 2023-06-01'
    ]
]);

$response = curl_exec($ch);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
$err = curl_error($ch);
curl_close($ch);

if ($err) { die(json_encode(['success'=>false,'error'=>"cURL: $err"])); }
if ($httpCode !== 200) { die(json_encode(['success'=>false,'error'=>"Claude API HTTP $httpCode",'details'=>$response])); }

$result = json_decode($response, true);
$text = $result['content'][0]['text'] ?? '';

// Extract JSON from response
$clean = preg_replace('/```json?\s*|\s*```/', '', trim($text));
if (preg_match('/\{[\s\S]*\}/s', $clean, $m)) {
    $invoice = json_decode($m[0], true);
    if ($invoice) {
        echo json_encode(['success'=>true,'invoiceData'=>$invoice]);
    } else {
        echo json_encode(['success'=>false,'error'=>'JSON parse failed','raw'=>$clean]);
    }
} else {
    echo json_encode(['success'=>false,'error'=>'No JSON in Claude response','raw'=>$text]);
}
