<?php
/**
 * fcm-send.php  —  FLG-Administratie push notification proxy
 *
 * Self-contained: alleen openssl + curl + json_* nodig (allemaal standaard PHP).
 * Stuurt FCM HTTP v1 messages namens een Firebase service account.
 *
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║  GEBRUIK                                                                  ║
 * ║                                                                           ║
 * ║  1. Plak je service account JSON tussen de NOWDOC-markers hieronder       ║
 * ║     (gemarkeerd met >>> PLAK_HIER en <<< EINDE_PLAK).                     ║
 * ║  2. Upload dit bestand naar de root van internedata.nl (waar              ║
 * ║     claude-vision-ocr.php ook staat).                                     ║
 * ║  3. Test in browser: GET https://internedata.nl/fcm-send.php              ║
 * ║     -> moet JSON terug geven met "serviceAccountConfigured": true         ║
 * ║                                                                           ║
 * ║  SECURITY                                                                 ║
 * ║                                                                           ║
 * ║  Service account JSON in PHP source is veilig MITS:                       ║
 * ║   - PHP wordt geëxecuteerd door de webserver (niet als plain text         ║
 * ║     uitgeleverd). Op elke werkende PHP host is dit het geval.             ║
 * ║   - .git of source-bestanden niet via HTTP bereikbaar zijn (standaard).   ║
 * ║  Voordeel boven losse JSON file: één bestand, geen pad-issues, geen       ║
 * ║  .htaccess nodig, copy/paste-bestendig.                                   ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 */

// ============================================================================
// CONFIG
// ============================================================================

define('FCM_PROJECT_ID', 'alloon');

$ALLOWED_ORIGINS = [
    'https://app.fl-group.org',
    'http://localhost:5173',
    'http://localhost:3000',
];

// >>> PLAK_HIER  ────────────────────────────────────────────────────────────
// Plak hieronder de COMPLETE inhoud van het service-account JSON-bestand
// dat je downloadt vanuit Firebase Console → Project Settings → Service
// Accounts → "Generate new private key". Niets aanpassen aan de inhoud,
// niets escapen. NOWDOC ('JSON_SERVICE_ACCOUNT') zorgt dat \n in de
// private_key gewoon blijft staan zoals hij hoort.

$SERVICE_ACCOUNT_JSON = <<<'JSON_SERVICE_ACCOUNT'
{
  "type": "service_account",
  "project_id": "alloon",
  "private_key_id": "PASTE_YOUR_KEY_ID_HERE",
  "private_key": "-----BEGIN PRIVATE KEY-----\nPASTE_YOUR_PRIVATE_KEY_HERE\n-----END PRIVATE KEY-----\n",
  "client_email": "PASTE_YOUR_CLIENT_EMAIL_HERE",
  "client_id": "PASTE_YOUR_CLIENT_ID_HERE",
  "auth_uri": "https://accounts.google.com/o/oauth2/auth",
  "token_uri": "https://oauth2.googleapis.com/token",
  "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
  "client_x509_cert_url": "PASTE_YOUR_CERT_URL_HERE"
}
JSON_SERVICE_ACCOUNT;

// <<< EINDE_PLAK ────────────────────────────────────────────────────────────

// ============================================================================
// CORS
// ============================================================================

$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
$originAllowed = in_array($origin, $ALLOWED_ORIGINS, true);

if ($originAllowed) {
    header("Access-Control-Allow-Origin: $origin");
    header('Access-Control-Allow-Headers: Content-Type, Authorization');
    header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
    header('Access-Control-Max-Age: 86400');
    header('Vary: Origin');
}
header('Content-Type: application/json; charset=utf-8');

if (($_SERVER['REQUEST_METHOD'] ?? '') === 'OPTIONS') {
    http_response_code(204);
    exit;
}

// ============================================================================
// HELPERS
// ============================================================================

function jsonOut($status, $payload) {
    http_response_code($status);
    echo json_encode($payload, JSON_UNESCAPED_SLASHES);
    exit;
}

function b64url($data) {
    return rtrim(strtr(base64_encode($data), '+/', '-_'), '=');
}

/**
 * Parse + valideer service account. Returnt [array|null, error|null, debug-array].
 */
function loadServiceAccount($json) {
    $debug = [
        'jsonLength' => strlen($json),
        'hasPlaceholder' => false,
        'jsonParseOk' => false,
        'fieldsPresent' => [],
    ];
    if (strpos($json, 'PASTE_YOUR_') !== false) {
        $debug['hasPlaceholder'] = true;
        return [null, 'service_account_not_configured', $debug];
    }
    $sa = json_decode($json, true);
    if (!is_array($sa)) {
        return [null, 'service_account_invalid_json', $debug];
    }
    $debug['jsonParseOk'] = true;
    $debug['fieldsPresent'] = array_keys($sa);
    foreach (['client_email', 'private_key', 'project_id'] as $req) {
        if (empty($sa[$req])) {
            return [null, "service_account_missing_field:$req", $debug];
        }
    }
    return [$sa, null, $debug];
}

/**
 * Wissel service account in voor een Google OAuth2 access token.
 * Returnt [token|null, error|null, debug-array].
 */
function getAccessToken($sa) {
    $debug = [
        'jwtBuilt' => false,
        'oauthHttpCode' => null,
        'oauthBody' => null,
    ];

    $header = b64url(json_encode(['alg' => 'RS256', 'typ' => 'JWT']));
    $now = time();
    $claims = [
        'iss'   => $sa['client_email'],
        'scope' => 'https://www.googleapis.com/auth/firebase.messaging https://www.googleapis.com/auth/datastore',
        'aud'   => 'https://oauth2.googleapis.com/token',
        'exp'   => $now + 3600,
        'iat'   => $now,
    ];
    $claimsB64 = b64url(json_encode($claims));
    $unsigned = "$header.$claimsB64";

    $privateKey = openssl_pkey_get_private($sa['private_key']);
    if (!$privateKey) {
        return [null, 'openssl_pkey_get_private_failed', $debug];
    }
    $signature = '';
    $ok = openssl_sign($unsigned, $signature, $privateKey, 'SHA256');
    if (!$ok) {
        return [null, 'openssl_sign_failed', $debug];
    }
    $jwt = "$unsigned." . b64url($signature);
    $debug['jwtBuilt'] = true;

    $ch = curl_init('https://oauth2.googleapis.com/token');
    curl_setopt_array($ch, [
        CURLOPT_POST => true,
        CURLOPT_POSTFIELDS => http_build_query([
            'grant_type' => 'urn:ietf:params:oauth:grant-type:jwt-bearer',
            'assertion'  => $jwt,
        ]),
        CURLOPT_HTTPHEADER => ['Content-Type: application/x-www-form-urlencoded'],
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT => 15,
    ]);
    $resp = curl_exec($ch);
    $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    $debug['oauthHttpCode'] = $code;
    if ($code !== 200) {
        $debug['oauthBody'] = substr((string)$resp, 0, 500);
        return [null, "oauth_token_exchange_failed:$code", $debug];
    }
    $data = json_decode($resp, true);
    $token = $data['access_token'] ?? null;
    if (!$token) {
        $debug['oauthBody'] = substr((string)$resp, 0, 500);
        return [null, 'oauth_no_access_token', $debug];
    }
    return [$token, null, $debug];
}

/**
 * Haal alle FCM tokens van een user op uit Firestore subcollectie.
 *
 * BELANGRIJK: We gebruiken runQuery, NIET documents.list.
 * Reden: de client maakt alleen `users/{uid}/fcmTokens/{token}` aan, zonder
 * eerst het parent document `users/{uid}` te schrijven. In Firestore heet dit
 * een "missing ancestor" / ghost parent. De REST `documents.list` endpoint
 * geeft dan 200 OK met lege body terug, terwijl de Web SDK de tokens wel
 * gewoon ziet. `runQuery` (structured query) respecteert ghost parents wel
 * en retourneert de documenten zoals verwacht.
 */
function fetchTokensForUser($uid, $accessToken, &$debug) {
    $projectId = FCM_PROJECT_ID;

    // POST naar runQuery op de parent `users/{uid}`, met een structured
    // query die de subcollectie `fcmTokens` selecteert.
    $parent = "projects/$projectId/databases/(default)/documents/users/" . rawurlencode($uid);
    $url = "https://firestore.googleapis.com/v1/$parent:runQuery";

    $query = [
        'structuredQuery' => [
            'from' => [['collectionId' => 'fcmTokens']],
            'limit' => 100,
        ],
    ];

    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_POST => true,
        CURLOPT_POSTFIELDS => json_encode($query),
        CURLOPT_HTTPHEADER => [
            "Authorization: Bearer $accessToken",
            'Content-Type: application/json',
        ],
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT => 15,
    ]);
    $resp = curl_exec($ch);
    $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    $debug['firestoreHttpCode'] = $code;
    $debug['firestoreUrl'] = $url;

    if ($code !== 200) {
        $debug['firestoreError'] = substr((string)$resp, 0, 500);
        return [];
    }

    // runQuery retourneert een array van objecten met { document: {...} }
    // (en eventueel een leeg object als er 0 hits zijn).
    $data = json_decode($resp, true);
    $out = [];
    if (is_array($data)) {
        foreach ($data as $entry) {
            $doc = $entry['document'] ?? null;
            if (!$doc) continue;
            $name = $doc['name'] ?? '';
            $token = $doc['fields']['token']['stringValue'] ?? null;
            if (!$token && preg_match('#/fcmTokens/([^/]+)$#', $name, $m)) {
                $token = $m[1];
            }
            if ($token) {
                $out[] = ['token' => $token, 'docName' => $name];
            }
        }
    }
    $debug['tokensParsed'] = count($out);
    return $out;
}

function deleteFirestoreDoc($docName, $accessToken) {
    $url = "https://firestore.googleapis.com/v1/$docName";
    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_CUSTOMREQUEST => 'DELETE',
        CURLOPT_HTTPHEADER => ["Authorization: Bearer $accessToken"],
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT => 10,
    ]);
    curl_exec($ch);
    curl_close($ch);
}

function sendFcm($token, $payload, $accessToken) {
    $projectId = FCM_PROJECT_ID;
    $url = "https://fcm.googleapis.com/v1/projects/$projectId/messages:send";
    $message = [
        'message' => [
            'token' => $token,
            'notification' => [
                'title' => $payload['title'],
                'body'  => $payload['body'],
            ],
            'data' => [
                'url'      => (string)($payload['url'] ?? '/'),
                'taskId'   => (string)($payload['taskId'] ?? ''),
                'category' => (string)($payload['category'] ?? ''),
            ],
            'webpush' => [
                'fcm_options' => ['link' => (string)($payload['url'] ?? '/')],
                'notification' => [
                    'icon'  => '/Logo-192.png',
                    'badge' => '/Logo-192.png',
                    'tag'   => (string)($payload['tag'] ?? 'flg'),
                ],
            ],
            'apns' => [
                'headers' => ['apns-priority' => '10'],
                'payload' => ['aps' => ['sound' => 'default']],
            ],
        ],
    ];
    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_POST => true,
        CURLOPT_POSTFIELDS => json_encode($message),
        CURLOPT_HTTPHEADER => [
            "Authorization: Bearer $accessToken",
            'Content-Type: application/json',
        ],
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT => 15,
    ]);
    $resp = curl_exec($ch);
    $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    return ['status' => $code, 'body' => $resp];
}

/**
 * Bepaal of een FCM error duidt op een 'dood' token (verwijderen).
 */
function isDeadTokenError($responseBody) {
    $parsed = json_decode($responseBody, true);
    if (!is_array($parsed)) return false;
    $errStatus = $parsed['error']['status']  ?? '';
    if (in_array($errStatus, ['NOT_FOUND', 'UNREGISTERED', 'INVALID_ARGUMENT'], true)) {
        return true;
    }
    foreach (($parsed['error']['details'] ?? []) as $d) {
        $code = $d['errorCode'] ?? '';
        if (in_array($code, ['UNREGISTERED', 'INVALID_ARGUMENT', 'NOT_FOUND'], true)) {
            return true;
        }
    }
    return false;
}

// ============================================================================
// REQUEST DISPATCH
// ============================================================================

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

// Voor POST verlangen we een whitelisted origin (voorkom misbruik vanaf
// random sites). GET (health-check) accepteren we vanaf elke origin zodat
// monitoring en handmatige checks werken.
if ($method === 'POST' && !$originAllowed) {
    jsonOut(403, [
        'error' => 'origin_not_allowed',
        'message' => "Origin '$origin' is niet whitelisted in fcm-send.php",
        'debug' => ['receivedOrigin' => $origin, 'allowedOrigins' => $ALLOWED_ORIGINS],
    ]);
}

// ───────────────────────────────────────────────────────────────────────────
// GET: health-check
// ───────────────────────────────────────────────────────────────────────────

if ($method === 'GET') {
    $health = [
        'ok' => false,
        'phpVersion' => PHP_VERSION,
        'opensslAvailable' => function_exists('openssl_sign'),
        'curlAvailable' => function_exists('curl_init'),
        'serviceAccountConfigured' => false,
        'oauthOk' => false,
        'firestoreOk' => false,
        'projectId' => FCM_PROJECT_ID,
        'allowedOrigins' => $ALLOWED_ORIGINS,
    ];

    list($sa, $saErr, $saDebug) = loadServiceAccount($SERVICE_ACCOUNT_JSON);
    $health['serviceAccount'] = $saDebug;
    if (!$sa) {
        $health['error'] = $saErr;
        jsonOut(200, $health);
    }
    $health['serviceAccountConfigured'] = true;
    $health['serviceAccountEmail'] = $sa['client_email'];
    $health['serviceAccountProjectId'] = $sa['project_id'];

    list($accessToken, $tokErr, $tokDebug) = getAccessToken($sa);
    $health['oauth'] = $tokDebug;
    if (!$accessToken) {
        $health['error'] = $tokErr;
        jsonOut(200, $health);
    }
    $health['oauthOk'] = true;

    // Probeer Firestore database metadata op te vragen — bewijs dat scope
    // datastore werkt. NB: de '/documents' endpoint zonder collection-ID
    // geeft altijd 404 (je moet een collection specificeren). In plaats
    // daarvan gebruiken we projects.databases.get wat metadata retourneert.
    $fsUrl = "https://firestore.googleapis.com/v1/projects/" . FCM_PROJECT_ID . "/databases/(default)";
    $ch = curl_init($fsUrl);
    curl_setopt_array($ch, [
        CURLOPT_HTTPHEADER => ["Authorization: Bearer $accessToken"],
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT => 10,
    ]);
    $fsResp = curl_exec($ch);
    $fsCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    $health['firestoreHttpCode'] = $fsCode;
    $health['firestoreUrl'] = $fsUrl;
    $health['firestoreOk'] = ($fsCode === 200);
    if ($fsCode !== 200) {
        $health['firestoreError'] = substr((string)$fsResp, 0, 300);
    }

    $health['ok'] = $health['serviceAccountConfigured'] && $health['oauthOk'] && $health['firestoreOk'];
    jsonOut(200, $health);
}

// ───────────────────────────────────────────────────────────────────────────
// POST: send push
// ───────────────────────────────────────────────────────────────────────────

if ($method !== 'POST') {
    jsonOut(405, ['error' => 'method_not_allowed', 'allowed' => ['GET', 'POST', 'OPTIONS']]);
}

$raw = file_get_contents('php://input');
$body = json_decode($raw, true);
if (!is_array($body)) {
    jsonOut(400, [
        'error' => 'invalid_json_body',
        'debug' => ['receivedLength' => strlen((string)$raw)],
    ]);
}

$userIds = $body['userIds'] ?? [];
$title   = $body['title']   ?? '';
$msgBody = $body['body']    ?? '';
if (!is_array($userIds) || count($userIds) === 0 || !is_string($title) || $title === '' || !is_string($msgBody)) {
    jsonOut(400, [
        'error' => 'missing_required_fields',
        'message' => 'userIds (non-empty array), title (non-empty string), body (string) zijn verplicht',
        'debug' => [
            'userIdsType' => gettype($userIds),
            'userIdsCount' => is_array($userIds) ? count($userIds) : 0,
            'titleType' => gettype($title),
            'bodyType' => gettype($msgBody),
        ],
    ]);
}

list($sa, $saErr, $saDebug) = loadServiceAccount($SERVICE_ACCOUNT_JSON);
if (!$sa) {
    jsonOut(503, [
        'error' => $saErr,
        'message' => 'Service account in fcm-send.php is niet (correct) geconfigureerd. Plak je JSON tussen de NOWDOC markers.',
        'debug' => ['serviceAccount' => $saDebug],
    ]);
}

list($accessToken, $tokErr, $tokDebug) = getAccessToken($sa);
if (!$accessToken) {
    jsonOut(502, [
        'error' => $tokErr,
        'message' => 'Kon geen Google access token verkrijgen.',
        'debug' => ['oauth' => $tokDebug, 'serviceAccountEmail' => $sa['client_email']],
    ]);
}

$payload = [
    'title'    => $title,
    'body'     => $msgBody,
    'url'      => $body['url']      ?? '/',
    'taskId'   => $body['taskId']   ?? null,
    'category' => $body['category'] ?? null,
    'tag'      => $body['tag']      ?? ($body['category'] ?? 'flg'),
];

$sent = 0;
$failed = 0;
$deletedTokenIds = [];
$fcmResponses = [];
$firestoreDebug = [];
$tokensFoundPerUser = [];

$uniqueUids = array_values(array_unique(array_filter($userIds, 'is_string')));
foreach ($uniqueUids as $uid) {
    $userDebug = ['firestoreHttpCode' => null, 'firestoreError' => null];
    $tokens = fetchTokensForUser($uid, $accessToken, $userDebug);
    $firestoreDebug[$uid] = $userDebug;
    $tokensFoundPerUser[$uid] = count($tokens);

    foreach ($tokens as $t) {
        $res = sendFcm($t['token'], $payload, $accessToken);
        $fcmResponses[] = [
            'uid' => $uid,
            'tokenPreview' => substr($t['token'], 0, 16) . '…',
            'httpCode' => $res['status'],
        ];
        if ($res['status'] === 200) {
            $sent++;
        } else {
            $failed++;
            if (isDeadTokenError($res['body'])) {
                deleteFirestoreDoc($t['docName'], $accessToken);
                $deletedTokenIds[] = $t['docName'];
            } else {
                // Voeg fout-body toe aan debug zodat de client ziet wat er mis is
                $fcmResponses[count($fcmResponses) - 1]['errorBody'] = substr((string)$res['body'], 0, 400);
            }
        }
    }
}

jsonOut(200, [
    'ok' => true,
    'sent' => $sent,
    'failed' => $failed,
    'deletedTokens' => count($deletedTokenIds),
    'debug' => [
        'requestedUserIds' => $uniqueUids,
        'tokensFoundPerUser' => $tokensFoundPerUser,
        'firestore' => $firestoreDebug,
        'fcmResponses' => $fcmResponses,
        'deletedTokenIds' => $deletedTokenIds,
    ],
]);
