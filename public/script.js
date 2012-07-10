var doesThings = function (callback, self) {
	setTimeout(function () {
		// debugger;
		callback.call(self)
	}, 1000);
};

var plainHandler = function () {
	console.log('in the plain handler');
}

var Howdy = function () {
	this.foo = 'bar';
};
Howdy.prototype.handler = function () {
	console.log("in Howdy's handler", this.foo, this);
	debugger;
};

function init() {
	var answer = 42;

	doesThings(function () {
		console.log('in the inline handler');
	});

	doesThings(plainHandler);

	var howdy = new Howdy;
	doesThings(howdy.handler, howdy);

	// doesThings(later);
	// later;
}

init();
