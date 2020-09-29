<?php
require('utils.php');
if (!isset($_COOKIE['returning'])) {
	setcookie("returning", "1", 2147483647);
}
if (paramsComplete($_GET,['g'])) {
	$db = setupDB();
	$query = "SELECT name, data FROM graphs WHERE url_code=?";
	$params = [$_GET['g']];
	$response = safeSelect($db, $query, $params);
	if (count($response) > 0) {
		$graph = $response[0];
	}
}
?>
<!DOCTYPE html>
<html lang="en">
	<head>
<?php
print("<title>");
if (isset($graph['name'])) {
	print($graph['name']);
} else {
	print("GraphAlgo");
}
print("</title>")
?>
		<link rel="stylesheet" type="text/css" href="css/style.css">
		<link rel="shortcut icon" href="favicon.png" />
		<script src="https://ajax.googleapis.com/ajax/libs/jquery/3.4.1/jquery.min.js"></script>
		<script src="https://cdnjs.cloudflare.com/ajax/libs/pixi.js/5.3.3/pixi.min.js"></script>
		<script src="js/viewport.js"></script>
		<script src="js/fakeHashtable.js"></script>
		<script src="js/vector2D.js"></script>
		<script src="js/visualGraph.js"></script>
		<script src="js/graphAlgo.js"></script>
	</head>
	<body>
<?php
print('<div id="name">');
if (isset($graph['name'])) {
	print($graph['name']);
}
print('</div>');
print('<div id="data">');
if (isset($graph['data'])) {
	print($graph['data']);
}
print('</div>');
?>
		<div id="header" class="unselectable">
			<div id="padded-header">
				Graph<strong>Algo</strong>
<?php
if (isset($graph['name'])) {
	print(" | " . (empty($graph['name']) ? "Untitled Graph" : $graph['name']));
}
?>
				<span id="header-right">
					<a class="header-link" id="toggle-share">Share Graph</a>&nbsp;&nbsp;
					<a class="header-link" id="toggle-help"><strong>?</strong></a>
				</span>
			</div>
		</div>
		<div id="frame">
			<div id="zoom-menu" class="unselectable">
				<div class="vertical-toolbar">
					<div class="tool-button" onclick="zoomIn()">+</div>
					<div class="tool-button" onclick="zoomOut()">&#8211;</div>
				</div>
				<div class="vertical-toolbar">
					<div class="tool-button" onclick="zoomReset()">&#8635;</div>	
				</div>
			</div>
			<div id="bottom-right-menu" class="unselectable">
				<span id="speed-menu">
					<span id="slow-down" class="tool-button">&laquo;</span>
					<span id="speed-container">
						<span id="speed">1</span>x
					</span>
					<span id="speed-up" class="tool-button">&raquo;</span>
				</span>
				<div id="visualize-menu">
					<select id="algo-select">
						<option value="bfs">Breadth-First Search</option>
						<option value="dfs">Depth-First Search</option>
						<option value="aStar">A* Search</option>
						<option value="greedy">Greedy Best-First Search</option>
					</select>
					<div id="visualize" onclick="visualize()">Visualize!</div>
				</div>
			</div>
			<div id="lock" class="unselectable">&#128274;&#xFE0E;</div>
			<div id="help">
				<div class="welcome">
					<span class="header">Welcome to GraphAlgo!</span><br><br>
				</div>
				<div id="help-nav" class="unselectable">
					<span class="help-btn" name="graph">Graph?</span>&nbsp;&nbsp;
					<span class="help-btn" name="algo">Algo?</span>&nbsp;&nbsp;
					<span class="help-btn" name="controls">Controls</span>&nbsp;&nbsp;
					<span class="help-btn" name="examples">Examples</span>
				</div><br>
				<div class="help-page" name="graph">
					<span class="header">Graphs</span><br><br>
					A <a target="_blank" href="https://en.wikipedia.org/wiki/Graph_(discrete_mathematics)">graph</a>
					is a set of nodes (vertices) connected by links (edges). GraphAlgo models <em>directed graphs</em>,
					in which links have directions.
					<br><br>
					Directed graphs can represent relationships such as webpages
					connected via hyperlinks, social media "follows," and road networks.<br>
				</div>
				<div class="help-page" name="algo">
					<span class="header">Pathfinding Algorithms</span><br><br>
					<strong>Breadth-First Search</strong> (Unweighted)
					<div>
						Explores the node that is the fewest steps from source. Optimizes steps.
					</div><br>

					<strong>Depth-First Search</strong> (Unweighted)
					<div>
						Explores the node that is the most steps from source.
					</div><br>

					<strong>A*</strong> (Weighted)
					<div>
						Explores the node with the lowest f cost, as calculated by the sum of the g cost (travel
						distance from source) and the h cost (straight-line distance to target).
						Optimizes travel distance.
					</div><br>

					<strong>Greedy Best-First Search</strong> (Weighted)
					<div>
						Explores the node with the lowest straight-line distance to target.
					</div>
				</div>
				<div class="help-page" name="controls">
					<span class="header">Controls</span><br><br>
					<strong>Add Nodes</strong><br>
					Right-click empty space and click "Add Node."<br><br>
					<strong>Delete Nodes/Change Node Type</strong><br>
					Right-click an existing node.<br><br>
					<strong>Toggle Edges</strong><br>
					While holding <code>Ctrl</code> click and drag from one node to
					another to add an edge. Do this for an existing edge to delete it.<br><br>
					<strong>Navigation</strong><br>
					Click and drag empty space to pan. Scroll or use the <strong>+</strong> and
					<strong>&#8211;</strong> buttons to zoom. Use <strong>&#8635</strong> to
					automatically jump to the graph.
				</div>
				<div class="help-page" name="examples">
					<span class="header">Examples</span><br><br>
					<a href="./?g=tree">Binary Tree</a><br><br>
					<a href="./?g=followers">Follower Communities</a><br><br>
					<a href="./?g=celeb">Follower Communities and a Celebrity</a><br><br>
					<a href="./?g=friends">Friend Communities (Undirected)</a>
				</div>
				<div class="welcome">
					<br><em>Click off this dialogue to dismiss. To re-show, click "?" in the top-right.</em>
				</div><br>
			</div>
			<div id="share">
				<div class="share-page" name="title">
					<div class="header">Share Graph</div><br>
					Title your graph:<br>
					<span class="input-wrapper">
						<input id="share-name" placeholder="Untitled Graph"></input>
						<button id="share-button" onclick="shareGraph()">Next</button>
					</span>
				</div>
				<div class="share-page" name="loading">
					<div class="header">Share Graph</div><br>
					<div id="loading-text">Loading...</div>
				</div>
				<div class="share-page" name="result">
					<div class="header">Share Graph</div><br>
					Share this link:<br>
					<span class="input-wrapper">
						<input id="link" readonly></input>
						<button id="copy-link" onclick="copyLink()">
							<span id="copy-link-text">Copy</span>
						</button>
					</span>
				</div>
			</div>
		</div>
		<div id="menu">
			<ul id="menu-options">
			</ul>
		</div>
<?php
if (!isset($_COOKIE['returning'])) {
	print("<script>newVisitor()</script>");
}
?>
	</body>
</html>