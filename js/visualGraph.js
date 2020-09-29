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

		// All event functions empty by default
		this._onNodePointerDown = () => {};
		this._onNodePointerUp = () => {};
		this._onNodePointerUpOutside = () => {};
		this._onNodePointerMove = () => {};
		this._onNodePointerOver = () => {};
		this._onNodePointerOut = () => {};
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

	onNodePointerDown(callback) {
		this._onNodePointerDown = callback;
	}

	onNodePointerUp(callback) {
		this._onNodePointerUp = callback;
	}

	onNodePointerUpOutside(callback) {
		this._onNodePointerUpOutside = callback;
	}

	onNodePointerMove(callback) {
		this._onNodePointerMove = callback;
	}

	onNodePointerOver(callback) {
		this._onNodePointerOver = callback;
	}

	onNodePointerOut(callback) {
		this._onNodePointerOut = callback;
	}

	_setupNodeInteractivity(node) {
		const thisGraph = this;
		node.graphics.interactive = true;
		node.graphics.buttonMode = true;
		node.graphics.zIndex = 1;
		node.graphics
			.on('pointerdown', event => thisGraph._onNodePointerDown(event, node) )
			.on('pointerup', event => thisGraph._onNodePointerUp(event, node) )
			.on('pointerupoutside', event => thisGraph._onNodePointerUpOutside(event, node) )
			.on('pointermove', event => thisGraph._onNodePointerMove(event, node) )
			.on('pointerover', event => thisGraph._onNodePointerOver(event, node) )
			.on('pointerout', event => thisGraph._onNodePointerOut(event, node) );
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