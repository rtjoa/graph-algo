// A structure allowing nodes as keys eliminates the need for node id's
class FakeHashtable {
	constructor() {
		this.keys = [];
		this.values = [];
	}

	get(key) {
		return this.values[this.keys.indexOf(key)];
	}

	// Returns an array of all entries as [key, value]
	entries() {
		return this.keys.map( k => [k, this.get(k)] );
	}

	put(key, value) {
		const i = this.keys.indexOf(key);
		if (i !== -1) {
			this.keys[i] = key;
			this.values[i] = value;
		} else {
			this.keys.push(key);
			this.values.push(value);
		}
	}

	containsKey(key) {
		return this.keys.indexOf(key) !== -1;
	}

	softPut(key, value) { // puts if key doesn't already exist
		if (!this.containsKey(key)) this.put(key, value);
	}
}