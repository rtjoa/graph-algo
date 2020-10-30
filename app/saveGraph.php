<?php
require("utils.php");

if ($_SERVER['REQUEST_METHOD'] == 'POST') {
    $db = setupDB();

    $ALLOWED_CHARS = "0123456789abcdefghijklmnopqrstuvwxyz";
    $CODE_LENGTH = 6;

    $foundUniqueCode = false;

    // Continually generate codes until we find a unique one
    while (!$foundUniqueCode) {
        $url_code = randomStr($CODE_LENGTH, $ALLOWED_CHARS);
        if (!databaseContains($db, "graphs", "url_code", $url_code)) {
            $foundUniqueCode = true;
        }
    }

    $query = "INSERT INTO graphs (name, url_code, data) VALUES (?, ?, ?)";
    $params = [$_POST['name'], $url_code, $_POST['data']];
    safeQuery($db, $query, $params);
    print($url_code);
}
?>