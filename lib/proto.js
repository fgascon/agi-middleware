var fastagi = require('fastagi');
var parseUrl = require('parseurl');

var app = module.exports = {};

app.use = function(route, fn){
	if ('string' != typeof route){
		fn = route;
		route = '/';
	}
	
	// wrap sub-apps
	if ('function' == typeof fn.handle) {
		var server = fn;
		server.route = route;
		fn = function(req, res, next) {
			server.handle(req, res, next);
		};
	}
	
	// strip trailing slash
	if ('/' == route[route.length - 1]) {
		route = route.slice(0, -1);
	}
	
	// add the middleware
	//debug('use %s %s', route || '/', fn.name || 'anonymous');
	this.stack.push({
		route: route,
		handle: fn
	});
	
	return this;
};

app.handle = function(req, res, out) {
	var stack = this.stack,
		search = 1 + req.url.indexOf('?'),
		pathlength = search ? search - 1 : req.url.length,
		fqdn = 1 + req.url.substr(0, pathlength).indexOf('://'),
		protohost = fqdn ? req.url.substr(0, req.url.indexOf('/', 2 + fqdn)) : '',
		removed = '',
		slashAdded = false,
		index = 0,
		instance = this;
	
	function next(err){
		var layer, path, c;
		
		if (slashAdded){
			req.url = req.url.substr(1);
			slashAdded = false;
		}
		
		req.url = protohost + removed + req.url.substr(protohost.length);
		req.originalUrl = req.originalUrl || req.url;
		removed = '';
		
		// next callback
		layer = stack[index++];
		
		// all done
		if(!layer || res.done){
			// delegate to parent
			if(out)
				return out(err);
			
			// unhandled error
			if(err){
				instance.emit('error', err);
			} else {
				instance.emit('unhandled', req.originalUrl);
			}
			res.end();
			return;
		}
		
		try{
			path = parseUrl(req).pathname;
			if(undefined == path)
				path = '/';
			
			// skip this layer if the route doesn't match.
			if(0 != path.toLowerCase().indexOf(layer.route.toLowerCase()))
				return next(err);
			
			c = path[layer.route.length];
			if(c && '/' != c && '.' != c)
				return next(err);
			
			// Call the layer handler
			// Trim off the part of the url that matches the route
			removed = layer.route;
			req.url = protohost + req.url.substr(protohost.length + removed.length);
			
			// Ensure leading slash
			if(!fqdn && '/' != req.url[0]){
				req.url = '/' + req.url;
				slashAdded = true;
			}
			
			//debug('%s %s : %s', layer.handle.name || 'anonymous', layer.route, req.originalUrl);
			var arity = layer.handle.length;
			if(err){
				if(arity === 4){
					layer.handle(err, req, res, next);
				}else{
					next(err);
				}
			}else if(arity < 4){
				layer.handle(req, res, next);
			}else{
				next();
			}
		}catch(e){
			next(e);
		}
	}
	next();
};

app.listen = function(){
	var server = fastagi.createServer(this);
	return server.listen.apply(server, arguments);
};