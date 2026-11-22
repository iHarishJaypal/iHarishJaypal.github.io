<?php
declare(strict_types=1);

/**
 * ALIENS / Harish portfolio projects endpoint.
 * Run on PHP 8.1+ hosting; GitHub Pages serves static files and cannot execute PHP.
 */
header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');
header('Cache-Control: public, max-age=300');

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'GET') {
    http_response_code(405);
    header('Allow: GET');
    echo json_encode(['error' => 'Method not allowed']);
    exit;
}

$dataFile = dirname(__DIR__) . '/data/projects.json';
if (!is_file($dataFile) || !is_readable($dataFile)) {
    http_response_code(500);
    echo json_encode(['error' => 'Project data is unavailable']);
    exit;
}

try {
    $projects = json_decode((string) file_get_contents($dataFile), true, 512, JSON_THROW_ON_ERROR);
    if (!is_array($projects)) {
        throw new RuntimeException('Project data must be an array');
    }
    echo json_encode(
        ['success' => true, 'count' => count($projects), 'projects' => $projects],
        JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR
    );
} catch (Throwable $error) {
    http_response_code(500);
    echo json_encode(['error' => 'Unable to read project data']);
}
