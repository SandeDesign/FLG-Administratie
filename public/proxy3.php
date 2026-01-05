<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    if (!isset($_FILES['file'])) {
        echo json_encode(['success' => false, 'error' => 'No file uploaded']);
        exit();
    }

    // Get parameters from POST
    $companyFolder = isset($_POST['companyFolder']) ? $_POST['companyFolder'] : '';
    $filename = isset($_POST['filename']) ? $_POST['filename'] : $_FILES['file']['name'];

    if (empty($companyFolder)) {
        echo json_encode(['success' => false, 'error' => 'Company folder niet opgegeven']);
        exit();
    }

    // Base directory structure: uploads/FLG-administratie/BEDRIJFSNAAM/Post/inkomend
    $baseDir = __DIR__ . '/uploads/FLG-administratie/';
    $targetDir = $baseDir . $companyFolder . '/Post/inkomend/';
    $targetFile = $targetDir . $filename;

    // Create directory if it doesn't exist
    if (!is_dir($targetDir)) {
        if (!mkdir($targetDir, 0755, true)) {
            echo json_encode(['success' => false, 'error' => 'Kon map niet aanmaken']);
            exit();
        }
    }

    // Move uploaded file
    if (move_uploaded_file($_FILES['file']['tmp_name'], $targetFile)) {
        // Construct public URL
        $url = 'https://internedata.nl/uploads/FLG-administratie/' . $companyFolder . '/Post/inkomend/' . $filename;

        echo json_encode([
            'success' => true,
            'url' => $url,
            'path' => 'FLG-Administratie/' . $companyFolder . '/Post/inkomend/' . $filename
        ]);
    } else {
        echo json_encode(['success' => false, 'error' => 'Upload failed']);
    }
    exit();
}

// Invalid request method
http_response_code(405);
echo json_encode(['success' => false, 'error' => 'Method not allowed']);
