const NODE_TYPES = Object.freeze({
	DEFAULT: 0,
	SOURCE: 1,
	TARGET: 2
});

const NODE_COLORS = [];
NODE_COLORS[NODE_TYPES.DEFAULT] = 0x777777;
NODE_COLORS[NODE_TYPES.SOURCE] = 0x3333FF;
NODE_COLORS[NODE_TYPES.TARGET] = 0xFFFF33;
Object.freeze(NODE_COLORS);

const NODE_RADIUS = 15;
const ARROW_SPACING = 4;

const DEFAULT_EDGE_COLOR = 0x000000;
const NODE_STROKE_COLOR = 0x000000;

// Represents a node/vertex
class Node {
	constructor() {
		this.type = NODE_TYPES.DEFAULT;
	}
	setType(type) {
		this.type = type;
	}
}

// Represents a link/edge
class Edge {
	// takes two objects of type Node
	constructor(fromNode, toNode) {
		this.from = fromNode;
		this.to = toNode;
	}
}

// A node with a position and corresponding PIXI object
class VisualNode extends Node {
	constructor(x, y) {
		super();
		this.graphics = new PIXI.Container();
		this.graphics.x = x;
		this.graphics.y = y;
		this._highlighted = false;
		this._color = null;
		this.updateGraphics();
	}

	position() {
		return new Vector2D(this.graphics.x, this.graphics.y);
	}

	distanceTo(node) {
		return this.position().minus(node.position()).magnitude();
	}

	destroyGraphics() {
		this.graphics.removeChildren();
	}
	
	setType(type) {
		super.setType(type);
		this.updateGraphics();
	}

	updateGraphics() {
		let color = this._color;
		if (color == null) color = NODE_COLORS[this.type];
		this.graphics.removeChildren();
		this.graphics.addChild(new PIXI.Graphics()
			.beginFill(color)
			.lineStyle(this._highlighted?3:2, NODE_STROKE_COLOR, 1, 0)
			.drawCircle(0, 0, NODE_RADIUS));
	}

	highlight() {
		this._highlighted = true;
		this.updateGraphics();
	}
	
	dehighlight() {
		this._highlighted = false;
		this.updateGraphics();
	}

	// Set a nodes fill color. Pass in null/undefined to reset.
	setColor(color) {
		if (this.type !== NODE_TYPES.DEFAULT) return; // sources and targets can't be colored
		this._color = color;
		this.updateGraphics();
	}
}

// An edge with a corresponding PIXI object
class VisualEdge extends Edge {
	constructor(fromNode, toNode) {
		super(fromNode, toNode);
		this.color = DEFAULT_EDGE_COLOR;
		this.graphics = new PIXI.Container();
		this.updateGraphics();
	}
	setColor(color) {
		this.color = color;
		this.updateGraphics();
	}
	// Redraw the arrow in the graphics container
	updateGraphics() {
		const vFrom = this.from.position();
		const vTo = this.to.position();
		const direction = vTo.minus(vFrom).unit();
		const arrowStart = vFrom.plus(direction.timesScalar(NODE_RADIUS));
		const arrowEnd = vTo.minus(direction.timesScalar(NODE_RADIUS + ARROW_SPACING));
		
		const edgeArrow = generatePIXIArrow(arrowStart, arrowEnd, this.color);
		edgeArrow.zIndex = 3;

		this.graphics.removeChildren();
		this.graphics.addChild(edgeArrow);
	}
	destroyGraphics() {
		this.graphics.destroy();
	}
}

// Represents a collection of nodes and edges
class Graph {
	constructor() {
		this.nodes = [];
		this.edges = [];
	}

	addNode(node) {
		this.nodes.push(node);
	}

	// Returns the nodes this node points to via an edge
	childrenOf(node) {
		const childEdges = this.edges.filter( e => e.from === node );
		return childEdges.map( e => e.to );
	}

	// Returns the nodes pointing to this node via an edge
	parentsOf(node) {
		const parentEdges = this.edges.filter( e => e.to === node );
		return parentEdges.map( e => e.from );
	}

	nodesOfType(type) {
		return this.nodes.filter( n => n.type === type);
	}

	// Remove a node and all corresponding edges
	removeNode(node) {
		this.nodes = this.nodes.filter(n => n !== node);
		for (const e of this.edgesIncluding(node)) {
			this.removeEdge(e);
		}
	}

	// Given two nodes, creates a connection between them if not existing,
	// otherwise deletes the existing connection
	toggleNodeConnection(from, to) {
		if (this.edgeConnecting(from, to)) {
			this.disconnectNodes(from, to);
		} else {
			this.connectNodes(from, to);
		}
	}

	connectNodes(from, to) {
		if (!this.edgeConnecting(from, to)) {
			this.addEdge(new Edge(from, to));
		}
	}

	disconnectNodes(from, to) {
		this.removeEdge(this.edgeConnecting(from, to));
	}

	addEdge(edge) {
		this.edges.push(edge);
	}

	removeEdge(edge) {
		this.edges = this.edges.filter(e => e !== edge);
	}

	edgesIncluding(node) {
		return this.edges.filter(e => e.from === node || e.to === node);
	}

	edgesFrom(node) {
		return this.edges.filter(e => e.from === node);
	}

	edgesTo(node) {
		return this.edges.filter(e => e.to === node);
	}

	// Gets a specific edge connection two nodes
	edgeConnecting(from, to) {
		const edge = this.edges.filter(e => e.from === from && e.to === to)
		return edge.length?edge[0]:undefined;
	}
}

// Represents a graph of VisualNodes connected by VisualEdges
class VisualGraph extends Graph {
	constructor() {
		super();
		this.graphics = new PIXI.Container();
		this.graphics.sortableChildren = true;

		// Hashtable of interactions relevant to a node (event data, dragging, edge creation...)
		this.nodeInteractions = new FakeHashtable();

		// Temp variables for candidates nodes for new edges
		this.newEdgeFromNode;
		this.newEdgeToNode;

		// Object to keep track of what keys are pressed. Assign in a higher scope.
		this.keys = null;
	}

	static fromString(json) {
		return VisualGraph.fromObject( JSON.parse(json) );
	}

	static fromObject(obj) {
		const newGraph = new VisualGraph();
		
		for (const n of obj.nodes) {
			const newNode = new VisualNode(n.x, n.y);
			newNode.setType(n.type);
			newGraph.addNode(newNode);
		}
		// Edge "from" and "to" nodes are represented by their indices in obj.nodes
		for (const e of obj.edges) {
			newGraph.connectNodes(newGraph.nodes[e.fromIndex], newGraph.nodes[e.toIndex]);
		}
		return newGraph;
	}

	toString() {
		let objNodes = [];
		let objEdges = [];
		for (const n of this.nodes) {
			objNodes.push({
				x: n.graphics.x,
				y: n.graphics.y,
				type: n.type
			});
		}
		// Represent edge "from" and "to" nodes by their indices in this.nodes
		for (const e of this.edges) {
			objEdges.push({
				fromIndex: this.nodes.indexOf(e.from),
				toIndex: this.nodes.indexOf(e.to)
			});
		}
		const obj = {
			nodes: objNodes,
			edges: objEdges
		};
		return JSON.stringify(obj);
	}

	addNode(node) {
		super.addNode(node);
		this.graphics.addChild(node.graphics);
		this._setupNodeInteractivity(node);
	}

	connectNodes(from, to) {
		if (!this.edgeConnecting(from, to)) {
			this.addEdge(new VisualEdge(from, to));
		}
	}

	addEdge(edge) {
		super.addEdge(edge);
		this.graphics.addChild(edge.graphics);
	}

	removeEdge(edge) {
		super.removeEdge(edge);
		edge.destroyGraphics();
	}

	removeNode(node) {
		super.removeNode(node);
		node.destroyGraphics();
	}

	updateNodeEdgeArrows(node) {
		for (const e of this.edgesIncluding(node)) {
			e.updateGraphics();
		}
	}

	colorPath(path, color) {
		for (let i = 0; i < path.length - 1; i++) {
			this.edgeConnecting(path[i], path[i+1]).setColor(color);
		}
	}

	// Undo any node/edge color changes
	resetVisuals() {
		for (const n of this.nodes) {
			n.setColor();
		}
		for (const e of this.edges) {
			e.setColor(DEFAULT_EDGE_COLOR);
		}
	}

	onNodePointerDown(event, node) {
		this.nodeInteractions.softPut(node, {});
		const nodeData = this.nodeInteractions.get(node);

		if (event.data.originalEvent.button === 0) {
			nodeData.data = event.data;
			if (this.keys && this.keys['Control']) {
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
							onclick: () => { this.removeNode(node); }
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
	}

	onNodePointerUp(event, node) {
		this.nodeInteractions.softPut(node, {});
		const nodeData = this.nodeInteractions.get(node);

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
		this.newEdgeToNode = node;
	}

	onNodePointerUpOutside(event, node) {
		this.nodeInteractions.softPut(node, {});
		const nodeData = this.nodeInteractions.get(node);

		if (nodeData.dragging) {
			node.graphics.alpha = 1;
			nodeData.dragging = false;
		}
		if (nodeData.creatingEdge) {
			this.newEdgeFromNode = node;
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
			if (this.newEdgeToNode && this.newEdgeFromNode) {
				this.nodeInteractions.get(this.newEdgeFromNode).snappedPreview.graphics.destroy();
				this.toggleNodeConnection(this.newEdgeFromNode, this.newEdgeToNode);
			}
			this.newEdgeFromNode = null;
			this.newEdgeToNode = null;
		},1);
	}

	onNodePointerMove(event, node) {
		this.newEdgeFromNode = null;
		this.newEdgeToNode = null;

		this.nodeInteractions.softPut(node, {});
		const nodeData = this.nodeInteractions.get(node);

		if (!nodeData.data)
			return;

		const wt = this.graphics.worldTransform;
		// Calculate global position, even if parent is moved/scaled.
		let x = (nodeData.data.global.x - wt.tx) / wt.a;
		let y = (nodeData.data.global.y - wt.ty) / wt.d;
		if (nodeData.dragging) {
			node.graphics.x = x;
			node.graphics.y = y;
			this.updateNodeEdgeArrows(node);
		}
		if (nodeData.creatingEdge) {
			if (nodeData.edgePreview) {
				nodeData.edgePreview.removeChildren();
			} else {
				nodeData.edgePreview = new PIXI.Container();
				nodeData.edgePreview.zIndex = 0;
				this.graphics.addChild(nodeData.edgePreview);
			}
			nodeData.edgePreview.addChild(generatePIXIArrow(node.position(), new Vector2D(x,y)));
		}
	}

	onNodePointerOver(event, node) {
		this.nodeInteractions.softPut(node, {});

		// Nodes that are creating edges
		const sourceNodes = this.nodeInteractions.entries()
			.filter( e => e[1].creatingEdge && e[0] !== node )
			.map( e => e[0] );

		if (sourceNodes.length) {

			// Nodes that are creating edges and already have an edge with this node
			const edgeDeletions = sourceNodes.filter( n => graph.edgeConnecting(n, node) );
			
			const sourceData = this.nodeInteractions.get(sourceNodes[0]);
			sourceData.edgePreview.alpha = 0;
			if (edgeDeletions.length) {
				sourceData.snappedPreview = new VisualEdge(edgeDeletions[0], node);
				sourceData.snappedPreview.setColor(0xFF7777);
				this.graphics.addChild(sourceData.snappedPreview.graphics);
				sourceData.snappedPreview.graphics.zIndex = 4;
			} else {
				sourceData.snappedPreview = new VisualEdge(sourceNodes[0], node);
				sourceData.snappedPreview.setColor(0x777777);
				this.graphics.addChild(sourceData.snappedPreview.graphics);
				node.highlight();
			}
		}
	}

	onNodePointerOut(event, node) {
		node.dehighlight();
		
		// Nodes that are creating edges
		const sourceNodes = this.nodeInteractions.entries()
			.filter( e => e[1].creatingEdge && e[0] !== node )
			.map( e => e[0] );

		if (sourceNodes.length) {
			const sourceData = this.nodeInteractions.get(sourceNodes[0]);
			this.nodeInteractions.get(sourceNodes[0]).edgePreview.alpha = 1;
			sourceData.snappedPreview.graphics.destroy();
		}
	}

	_setupNodeInteractivity(node) {
		node.graphics.interactive = true;
		node.graphics.buttonMode = true;
		node.graphics.zIndex = 1;
		node.graphics
			.on('pointerdown', event => this.onNodePointerDown(event, node) )
			.on('pointerup', event => this.onNodePointerUp(event, node) )
			.on('pointerupoutside', event => this.onNodePointerUpOutside(event, node) )
			.on('pointermove', event => this.onNodePointerMove(event, node) )
			.on('pointerover', event => this.onNodePointerOver(event, node) )
			.on('pointerout', event => this.onNodePointerOut(event, node) );
	}
}

// Generate an arrow in a PIXI.Container given two Vector2Ds and a color (optional)
function generatePIXIArrow(fromVector, toVector, color) {
	const arrowColor = color || 0x000000;
	const arrow = new PIXI.Container();
	arrow.addChild(new PIXI.Graphics().lineStyle(2, arrowColor)
		.moveTo(fromVector.x, fromVector.y)	
		.lineTo(toVector.x, toVector.y));
	const head = new PIXI.Graphics().beginFill(arrowColor).lineStyle(2,arrowColor).drawPolygon([0,0,-8,14,8,14]);
	head.x = toVector.x;
	head.y = toVector.y;
	head.rotation = Math.PI-toVector.minus(fromVector).direction();
	arrow.addChild(head);
	return arrow;
}

function createContextMenu(x,y,items) {
	const menu = $('<div/>');
	menu.css("left",`${x}px`);
	menu.css("top",`${y}px`);
	menu.css("width", "120px");
	menu.css("box-shadow", "0 3px 4px 2px rgba(0, 0, 0, .2)");
	menu.css("background", "white");
	menu.css("position", "fixed");
	menu.contextmenu( e => e.preventDefault() );
	const menuOptions = $('<ul/>');	
	menuOptions.css("list-style", "none");
	menuOptions.css("margin", "5px 0px");
	menuOptions.css("padding", "0");
	
	for (const item of items) {
		const li = $('<li/>',{
			text: item.text
		});
		li.css("font-family", "Arial, sans-serif");
		li.css("font-size", "12px");
		li.css("padding", "10px 20px 10px 20px");
		li.css("cursor", "pointer");
		li.mouseenter(function(){
			$(this).css("background", "rgba(0, 0, 0, .2)");
		});
		li.mouseleave(function(){
			$(this).css("background", "");
		});
		li.click(() => {
			item.onclick();
			removeMenu();
		});
		li.appendTo(menuOptions);
	}
	menuOptions.appendTo(menu);
	menu.appendTo("body");
	const removeMenu = (e) => {
		const clickedMenu = e && e.path.includes(menu[0])
		if (!clickedMenu) {
			menu.remove();
			window.removeEventListener("mousedown", removeMenu);
		}
	};
	setTimeout(() => {
		window.addEventListener("mousedown", removeMenu);
	}, 0);
}