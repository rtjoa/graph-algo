/*

GraphAlgo was created with the following libraries:

PIXI.JS - MIT License
https://www.pixijs.com/

pixi-viewport - MIT License
https://github.com/davidfig/pixi-viewport/

jQuery - MIT License
https://jquery.org/

Page design inspired by desmos.com.

*/

const MIN_ZOOM = 0.05;
const MAX_ZOOM = 5;

const BG_COLOR = 0xFFFFFF;

// setTimeout for algo visualization frames
let algoTimeout;

// List of speeds for the speed up/slow down buttons
const SPEED_OPTIONS = [0.35, 0.5, 0.75, 1, 1.5, 2, 3.5, 5, 7.5, 10];

// Default frame delay between visualization frames
const DEFAULT_FRAME_DELAY = 500;

// Because steps are minimized, simply increase cost relative to parent
const BREADTH_FIRST = {
	heuristic: (parentData) => ({ cost: parentData.cost + 1 }),
	initData: {cost: 0}
};

// Opposite of breadth first
const DEPTH_FIRST = {
	heuristic: (parentData) => ({ cost: parentData.cost - 1 }),
	initData: {cost: 0}
};

// Calculates f/g/h costs. f cost stored as main cost b/c it decides priority.
const A_STAR = {
	heuristic: (parentData, node, parent, target) => {
		const g = parentData.g + parent.distanceTo(node);
		const h = node.distanceTo(target);
		return { g: g, cost: g + h };
	},
	initData: {g: 0}
};

// Always choose node closest to target
const GREEDY = {
	heuristic: (_, node, __, target) => ({ cost: node.distanceTo(target) })
};

const algos = {
	bfs: BREADTH_FIRST,
	dfs: DEPTH_FIRST,
	aStar: A_STAR,
	greedy: GREEDY
};

const COLOR_CURRENT = 0x00FF00;
const COLOR_CURRENT_ARROW = 0x00AAAA;
const COLOR_OPEN = 0x00FFFF;
const COLOR_CLOSED = 0xAAAAFF;
const COLOR_VISITED_ARROW = 0x0000FF;
const COLOR_SOLUTION_ARROW = 0xFF0000;
const COLOR_SOLUTION = 0xFFAAAA;

// Called when "Reset" is clicked (in visualize() )
function cancelVisualize() {
	$("#visualize").html("Visualize!");
	$("#visualize").css("opacity","1");
	$("#lock").css("display","none");
	clearTimeout(algoTimeout);
	graph.resetVisuals();
	algoTimeout = null;
	viewport.interactiveChildren = true;
}

// Called when the Visualize/Reset button is clicked
function visualize() {

	if (algoTimeout) {
		cancelVisualize();
		return;
	}

	const sources = graph.nodesOfType(NODE_TYPES.SOURCE);
	const targets = graph.nodesOfType(NODE_TYPES.TARGET);
	if (sources.length !== 1) {
		alert("Exactly one source required. "
			+ "This graph has " + sources.length + ".");
		return;
	}
	if (targets.length !== 1) {
		alert("Exactly one target required. "
			+ "This graph has " + targets.length + ".");
		return;
	}

	$("#visualize").html("Reset");
	$("#visualize").css("opacity","0.7");
	$("#lock").css("display","block");
	viewport.interactiveChildren = false; // pause graph editing

	const source = sources[0];
	const target = targets[0];

	const algo = algos[$("#algo-select").val()];
	const heuristic = algo.heuristic;

	// Open list of nodes to consider
	const openList = [source];

	// Closed list of nodes we should no longer consider
	const closedList = [];

	// A Hashtable using nodes as indices of the cheapest known path to each node.
	// It would be more space-efficient to only keep track of each node's parent rather
	// than the entire path to get there, but would make the code slightly less intuitive
	const paths = new FakeHashtable();
	
	// A Hashtable using nodes as indices of node heuristic data.
	const heuristicData = new FakeHashtable();

	// Current node to check
	let curNode = null;

	// Set starting paths/heuristic values
	paths.put(source, [source]);
	heuristicData.put(source, algo.initData)

	const stepAlgo = () => {

		// Reset last frame's current node/edge coloration
		if (curNode) {
			curNode.setColor(COLOR_CLOSED);
			const lastStep = graph.edgeConnecting(paths.get(curNode).slice(-2)[0], curNode);
			if (lastStep) lastStep.setColor(COLOR_VISITED_ARROW);
		}

		// Take the lowest cost node of openList as the current one, add it to closed
		openList.sort( (n1, n2) => heuristicData.get(n1).cost - heuristicData.get(n2).cost );
		curNode = openList.shift();
		closedList.push(curNode);

		// Color the recently selected node and the edge we came from
		curNode.setColor(COLOR_CURRENT);
		const lastStep = graph.edgeConnecting(paths.get(curNode).slice(-2)[0], curNode);
		if (lastStep) lastStep.setColor(COLOR_CURRENT_ARROW);

		// If we've found the target, highlight the solution and stop
		if (curNode.type === NODE_TYPES.TARGET) {
			let solution = paths.get(curNode);
			graph.colorPath(solution, COLOR_SOLUTION_ARROW);
			for (const n of solution) {
				n.setColor(COLOR_SOLUTION);
			}
			clearTimeout(algoTimeout);
			return;
		}

		// Iterate through the current node's children
		for (const child of graph.childrenOf(curNode)) {

			// Only consider nodes not in closed
			if (closedList.includes(child))
				continue;

			// Tentatively calculate this child's heuristic data
			const tentativeData = heuristic(heuristicData.get(curNode), child, curNode, target);

			// If child unexplored or if coming from curNode is cheaper than the known path
			if (!heuristicData.get(child) || tentativeData.cost < heuristicData.get(child).cost) {
				// Add the child to openList and update its path/heuristic data
				openList.push(child);
				const newPath = paths.get(curNode).slice();
				newPath.push(child);
				paths.put(child, newPath);
				heuristicData.put(child, tentativeData);

				// Color child node and the edge we found it from
				graph.edgeConnecting(curNode, child).setColor(COLOR_VISITED_ARROW);
				child.setColor(COLOR_OPEN);
			}
		}

		// Out of nodes to explore
		if (openList.length === 0) {
			alert("No path found.");
			clearTimeout(algoTimeout);
		}

	};

	const eachFrame = () => {
		algoTimeout = setTimeout(eachFrame, DEFAULT_FRAME_DELAY/parseFloat($("#speed").html()));
		stepAlgo();
	};

	eachFrame();
}

const app = new PIXI.Application({
	autoResize: true,
	antialias: true,
	resolution: devicePixelRatio 
});

let viewport;
let graph;

// Set up event functions for the graph
function setupGraphInteractivity(graph, viewport) {

	// Hashtable of interactions relevant to a node (event data, dragging, edge creation...)
	let nodeInteractions = new FakeHashtable();

	// Temp variables for candidates nodes for new edges
	let newEdgeFromNode;
	let newEdgeToNode;

	graph.onNodePointerDown((event, node) => {
		viewport.pause = true; // prevent panning

		nodeInteractions.softPut(node, {});
		const nodeData = nodeInteractions.get(node);

		if (event.data.originalEvent.button === 0) {
			nodeData.data = event.data;
			if (keys['Control']) {
				nodeData.creatingEdge = true;
			}else{
				node.graphics.alpha = 0.5;
				nodeData.dragging = true;
			}
		} else if (event.data.originalEvent.button === 2) {
			// setTimeout so this is added to the end of the stack and overrides the "Add Node" menu
			setTimeout(() => {
				createContextMenu(event.data.originalEvent.pageX,
					event.data.originalEvent.pageY,
					[
						{
							text: "Delete Node",
							onclick: function() { graph.removeNode(node); }
						},
						{
							text: "Set as default",
							onclick: function() { node.setType(NODE_TYPES.DEFAULT); }
						},
						{
							text: "Set as source",
							onclick: function() { node.setType(NODE_TYPES.SOURCE); }
						},
						{
							text: "Set as target",
							onclick: function() { node.setType(NODE_TYPES.TARGET); }
						}
					]);
			},0);
		}
	});

	graph.onNodePointerUp((event, node) => {
		viewport.pause = false; // allow panning again

		nodeInteractions.softPut(node, {});
		const nodeData = nodeInteractions.get(node);

		node.dehighlight();
		if (nodeData.dragging) {
			node.graphics.alpha = 1;
			nodeData.dragging = false;
		}
		if (nodeData.creatingEdge) {
			nodeData.creatingEdge = false;
			if (nodeData.edgePreview) {
				nodeData.edgePreview.removeChildren();
				nodeData.edgePreview = null;
			}
		}
		newEdgeToNode = node;
	});

	graph.onNodePointerUpOutside((event, node) => {
		nodeInteractions.softPut(node, {});
		const nodeData = nodeInteractions.get(node);

		viewport.pause = false;	
		if (nodeData.dragging) {
			node.graphics.alpha = 1;
			nodeData.dragging = false;
		}
		if (nodeData.creatingEdge) {
			newEdgeFromNode = node;
			nodeData.creatingEdge = false;
			if (nodeData.snappedPreview) {
				nodeData.snappedPreview.graphics.destroy();
			}
			if (nodeData.edgePreview) {
				nodeData.edgePreview.removeChildren();
				nodeData.edgePreview = null;
			}
		}
		// setTimeout so this happens after both the parent node's onNodePointerUpOutside and
		// the child node's onNodePointerUp are triggered beforehand
		setTimeout(() =>{
			if (newEdgeToNode && newEdgeFromNode) {
				nodeInteractions.get(newEdgeFromNode).snappedPreview.graphics.destroy();
				graph.toggleNodeConnection(newEdgeFromNode, newEdgeToNode);
			}
			newEdgeFromNode = null;
			newEdgeToNode = null;
		},1);
	});

	graph.onNodePointerMove((event, node) => {
		newEdgeFromNode = null;
		newEdgeToNode = null;

		nodeInteractions.softPut(node, {});
		const nodeData = nodeInteractions.get(node);

		if (!nodeData.data)
			return;

		const x = (nodeData.data.global.x - viewport.x)/viewport.scale.x;
		const y = (nodeData.data.global.y - viewport.y)/viewport.scale.y;

		if (nodeData.dragging) {
			node.graphics.x = x;
			node.graphics.y = y;
			graph.updateNodeEdgeArrows(node);
		}
		if (nodeData.creatingEdge) {
			if (nodeData.edgePreview) {
				nodeData.edgePreview.removeChildren();
			}else{
				nodeData.edgePreview = new PIXI.Container();
				viewport.addChild(nodeData.edgePreview);
			}
			nodeData.edgePreview.addChild(generatePIXIArrow(node.position(), new Vector2D(x,y)));
		}
	});

	graph.onNodePointerOver((event, node) => {
		nodeInteractions.softPut(node, {});

		// Nodes that are creating edges
		const sourceNodes = nodeInteractions.entries()
			.filter( e => e[1].creatingEdge && e[0] !== node )
			.map( e => e[0] );

		if (sourceNodes.length) {

			// Nodes that are creating edges and already have an edge with this node
			const edgeDeletions = sourceNodes.filter( n => graph.edgeConnecting(n, node) );
			
			const sourceData = nodeInteractions.get(sourceNodes[0]);
			sourceData.edgePreview.alpha = 0;
			if (edgeDeletions.length) {
				sourceData.snappedPreview = new VisualEdge(edgeDeletions[0], node);
				sourceData.snappedPreview.setColor(0xFF7777);
				viewport.addChild(sourceData.snappedPreview.graphics);
				sourceData.snappedPreview.graphics.zIndex = 4;
			} else {
				sourceData.snappedPreview = new VisualEdge(sourceNodes[0], node);
				sourceData.snappedPreview.setColor(0x777777);
				viewport.addChild(sourceData.snappedPreview.graphics);
				node.highlight();
			}
		}
	});

	graph.onNodePointerOut((event, node) => {

		node.dehighlight();
		
		// Nodes that are creating edges
		const sourceNodes = nodeInteractions.entries()
			.filter( e => e[1].creatingEdge && e[0] !== node )
			.map( e => e[0] );

		if (sourceNodes.length) {
			const sourceData = nodeInteractions.get(sourceNodes[0]);
			nodeInteractions.get(sourceNodes[0]).edgePreview.alpha = 1;
			sourceData.snappedPreview.graphics.destroy();
		}
	});
}

// Background rectangle
const bg = new PIXI.Graphics().beginFill(BG_COLOR).lineStyle(0).drawRect(0,0,1,1);
app.stage.addChild(bg);

// Set a number's upper and lower bound at once
function clamp(n, min, max) {
	return Math.min(Math.max(n, min), max);
}

$(window).resize(resizeCanvas);

function resizeCanvas() {
	const cWidth = $(window).width();
	const cHeight = $(window).height()-$("#header").height();
	bg.width = cWidth;
	bg.height = cHeight
	viewport.screenWidth = cWidth;
	viewport.screenHeight = cHeight;
	app.renderer.resize(cWidth, cHeight);
}

function zoomIn() {
	_smoothZoom(1.02, 30);
}

function zoomOut() {
	_smoothZoom(0.98, 30);
}

// Zoom by a multiplier some number of times repeatedly
function _smoothZoom(multiplier, counter) {
	viewport.scaled *= multiplier;
	if (counter > 0)
       	setTimeout(() => _smoothZoom(multiplier, counter-1), 1);
}

// Auto-zoom to focus on the graph
function zoomReset() {
	if (graph.nodes.length === 0) {
		return;
	}
	const nodeXVals = graph.nodes.map( n => n.graphics.x );
	const nodeYVals = graph.nodes.map( n => n.graphics.y );
	const minX = Math.min(...nodeXVals);
	const maxX = Math.max(...nodeXVals);
	const minY = Math.min(...nodeYVals);
	const maxY = Math.max(...nodeYVals);
	const cWidth = $(window).width();
	const cHeight = $(window).height()-$("#header").height();
	let scale = 0.8 * Math.min( cWidth / (maxX-minX), cHeight / (maxY-minY));
	if (graph.nodes.length === 1) {
		scale = 1;
	}
	scale = clamp(scale, MIN_ZOOM, 1);
	viewport.scale.x = scale;
	viewport.scale.y = scale;
	viewport.position.x = cWidth/2 - (minX + maxX)/2*scale;
	viewport.position.y = cHeight/2 - (minY + maxY)/2*scale;

}

function createContextMenu(x,y,items) {
	$("#menu").css("left",`${x}px`);
	$("#menu").css("top",`${y}px`);
	$("#menu-options").empty();
	for (const item of items) {
		const li = $('<li/>',{
			text: item.text,
			class: 'menu-option'
		});
		li.click(item.onclick);
		li.appendTo('#menu-options');
	}
	menuVisibility(true);
}

function menuVisibility(visible) {
	$("#menu").css("display", visible ? "block" : "none");
}


window.addEventListener("click", () => menuVisibility(false));

let helpVisible = false;
let shareVisible = false;
let welcomeVisible = false;

function setHelpVisibility(visible) {
	if (!visible || !welcomeVisible) {
		welcomeVisible = false;
		$("#help").css({
			"top": "1px",
			"right": "3px",
			"transform": "none",
			"width": "350px"
		});
		$(".welcome").css("display", "none");
	}
	helpVisible = visible;
	$("#help").css("display", helpVisible ? "block" : "none");
	if (helpVisible) {
		$("#toggle-help").addClass("header-link-active");
	}else{
		$("#toggle-help").removeClass("header-link-active");
	}
	setHelpPage("graph");
	viewport.pause = helpVisible || shareVisible;
}

function setShareVisibility(visible) {
	shareVisible = visible;
	$("#share").css("display", shareVisible ? "block" : "none");
	if (shareVisible) {
		$("#toggle-share").addClass("header-link-active");
	}else{
		$("#toggle-share").removeClass("header-link-active");
	}
	setSharePage("title");
	$("#share-name").focus();
	viewport.pause = helpVisible || shareVisible;
}

let loadingInterval;

function shareGraph() {
	if (loadingInterval) {
		clearInterval(loadingInterval);
		loadingInterval = null;
	}

	$("#loading-text").fadeIn(0);
	loadingInterval = setInterval(()=>$("#loading-text").fadeOut(500).fadeIn(700),1400);

	const shareName = $("#share-name").val();

	let xmlhttp = new XMLHttpRequest();
	xmlhttp.onreadystatechange = function() {
		if (this.readyState == 4 && this.status == 200) {
			const url = window.location.origin + window.location.pathname + "?g=" + this.responseText;
			setSharePage("result");
			$("#link").val(url);
		}
	};

	xmlhttp.open("POST","saveGraph.php",true);
	xmlhttp.setRequestHeader("Content-Type", "application/x-www-form-urlencoded");
	xmlhttp.send(`data=${graph.toString()}&name=${encodeURIComponent(shareName)}`);

	setSharePage("loading");
}

function setHelpPage(name) {
	$(".help-page").css("display", "none");
	$(`.help-page[name="${name}"]`).css("display", "block");

	$(".help-btn").addClass('help-btn-enabled');
	$(".help-btn").removeClass('help-btn-disabled');

	$(`.help-btn[name="${name}"]`).addClass('help-btn-disabled');
	$(`.help-btn[name="${name}"]`).removeClass('help-btn-enabled');
}

function setSharePage(name) {
	$(".share-page").css("display", "none");
	$(`.share-page[name="${name}"]`).css("display", "block");
	$("#share-name").val($("#name").html());
	$("#copy-link-text").text("Copy");
	clearTimeout(copyFadeTimeout);
}

function newVisitor() {
	welcomeVisible = true;
	$(document).ready(() => {
		setHelpVisibility(true);
		$(".welcome").css("display", "block");
		$("#help").css({
			"top": "20px",
			"right": "50%",
			"transform": "translateX(50%)",
			"width": "500px"
		});
	});
}
$(document).click(function(event) {
	const clickedInfoWindow = !!$(event.target).closest("#help").length;
	const clickedHelpBtn = !!$(event.target).closest("#toggle-help").length;

	if (clickedHelpBtn) {
		setHelpVisibility(!helpVisible);
	} else if (!clickedInfoWindow) 
		setHelpVisibility(false);{
	}
	
	const clickedShareWindow = !!$(event.target).closest("#share").length;
	const clickedShareBtn = !!$(event.target).closest("#toggle-share").length;

	if (clickedShareBtn) {
		setShareVisibility(!shareVisible);
	} else if (!clickedShareWindow) 
		setShareVisibility(false);{
	}
});

let keys = {};

$(document).keydown(function(e) {
	keys[e.key] = true;
});

$(document).keyup(function(e) {
	keys[e.key] = false;
});

$(window).focus(function() {
	keys = {};
});

$(document).ready(function() {

	initializeViewport();
	app.stage.addChild(viewport);
	initializeGraph();
	viewport.addChild(graph.graphics);
	setupGraphInteractivity(graph, viewport);
	graph.graphics.zIndex = 2;

	document.querySelector("#frame").appendChild(app.view);
	resizeCanvas();

	$("#menu, canvas").contextmenu( e => e.preventDefault() );

	$("#speed-up").click(() => changeSpeed(1));
	$("#slow-down").click(() => changeSpeed(-1));
	$(".help-btn").click( e => setHelpPage( $(e.target).attr("name") ) );

	$("#link").click(() => $("#link").select());

	$("#share-name").keydown( e => {
		if (e.key==="Enter") shareGraph();
	} );
});

let copyFadeTimeout;

function copyLink() {
	$("#link").select();

	try {
		let success = document.execCommand('copy');
		if (!success) throw new Exception();

		if ($("#copy-link-text").text() === "\u2714") {
			return;
		}

		$("#copy-link-text").fadeOut(100)
			.fadeIn(100);
		
		setTimeout(() => $("#copy-link-text").text("\u2714"), 100);
		setTimeout(() => $("#copy-link-text").text("Copy"), 5400);
		copyFadeTimeout = setTimeout(() =>
			$("#copy-link-text").fadeOut(200).fadeIn(200),
			5200);

	} catch (e) {
		console.log('Copy unsuccessful.');
		console.log(e);
	}
}

const changeSpeed = d => {
	const currentIndex = SPEED_OPTIONS.indexOf(parseFloat($("#speed").html()));
	let newIndex = clamp(currentIndex+d,0,SPEED_OPTIONS.length);
	$("#speed").html(SPEED_OPTIONS[newIndex]);
}

function initializeViewport() {
	const s = 1000;

	viewport = new Viewport.Viewport({
		screenWidth: window.innerWidth,
		screenHeight: window.innerHeight,
		worldWidth: s,
		worldHeight: s,
		interaction: app.renderer.plugins.interaction
	});

	viewport.drag({ clampWheel: true })
		.wheel({ smooth: 3 })
		.pinch({ percent: 8 })
		.decelerate({ friction: 0.93 })
		.clampZoom({
			minWidth: MIN_ZOOM * s,
			minHeight: MIN_ZOOM * s,
			maxWidth: MAX_ZOOM * s,
			maxHeight: MAX_ZOOM * s });

	viewport.on('pointerdown', (event) => {
		if (event.data.originalEvent.button === 2 && !algoTimeout) {
			const x = (event.data.global.x - viewport.x)/viewport.scale.x;
			const y = (event.data.global.y - viewport.y)/viewport.scale.y;
			createContextMenu(event.data.originalEvent.pageX,
				event.data.originalEvent.pageY,
				[
					{
						text: "Add Node",
						onclick: () => {
							graph.addNode(new VisualNode(x, y));
						}
					}
				]);
		}
	});
	viewport.sortableChildren = true; // Allows z-index to take effect
}

function initializeGraph() {
	const data = $("#data").html();
	if (data.length > 0) {
		try{
			graph = VisualGraph.fromString(data);
			zoomReset();
		} catch(e) {
			console.log("Failed to load graph.");
			console.log(e);
			graph = new VisualGraph();
		}
	} else {
		graph = new VisualGraph();
	}
}