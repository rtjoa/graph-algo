// Vector class to make geometric computations easier
class Vector2D {
    constructor(x, y) {
        this.x = x;
        this.y = y;
    }
    plus(v) {
        return new Vector2D(this.x+v.x, this.y+v.y);
    }
    minus(v) {
        return this.plus(v.timesScalar(-1));
    }
    timesScalar(k) {
        return new Vector2D(this.x*k, this.y*k);
    }
    magnitude() {
        return Math.sqrt(Math.pow(this.x,2) + Math.pow(this.y,2));
    }
    direction() {
        return Math.atan2(this.x, this.y);
    }
    unit() {
        return this.timesScalar(1 / this.magnitude());
    }
    dot(v) {
        return this.x * v.x + this.y * v.y;
    }
    cross(v) {
        return this.x*v.y - this.y*v.x;
    }
    projectedOnto(v) {
        return v.timesScalar(this.dot(v)/Math.pow(v.magnitude(),2));
    }
    rotateBy(radians) {
        return new Vector2D(
            Math.cos(radians)*this.x - Math.sin(radians)*this.y,
            Math.sin(radians)*this.x + Math.cos(radians)*this.y
        );
    }
    rotateAround(v, radians) {
        return this.minus(v).rotateBy(radians).plus(v);
    }
	distanceTo(v) {
		return Math.sqrt( Math.pow(v.x-this.x, 2) + Math.pow(v.y-this.y, 2) );
	}
}