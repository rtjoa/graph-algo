<?php
// Sets up access to db
function setupDB() {
	$db = new PDO("mysql:dbname=graphalgo;host=localhost","root");
	$db -> setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
	return $db;
}

// Shorthand for scrubbed queries
function safeQuery($db, $q, $params) {
	$statement = $db -> prepare($q);
	$statement -> execute($params);
}

// Shorthand for scrubbed queries, returns .fetchAll()
function safeSelect($db, $q, $params) {
	$statement = $db -> prepare($q);
	$statement -> execute($params);
	return $statement -> fetchAll();
}

// Checks whether all fields in $_POST are set and not empty
function paramsComplete($method, $fields) {
	foreach ($fields as $field) {
		if ((!isset($method[$field])) || empty($method[$field])) {
			return false;
		}
	}
	return true;
}

// Checks whether $db contains $val in $col of $table
function databaseContains($db, $table, $col, $val) {
	$duplicates = safeSelect($db, "SELECT * FROM " . $table . " WHERE " . $col . "=?", [$val]);
	return count($duplicates) > 0;
}

// Randomly chooses a single character from a string
function randomCharFromStr($str) { 
    return $str[rand(0, strlen($str) - 1)];
}

// Generates a string of a given length from a pool of allowed characters
function randomStr($length, $allowedChars) {
    $str = "";
    for ($i = 0; $i<$length; $i++) {
        $str .= randomCharFromStr($allowedChars);
    }
    return $str;
}

?>