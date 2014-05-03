var DEBUG = false;

//JsonTransform.js

//author: Ryan Russell

function escape(s) {
    return s.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
};

var operators = {
	'[].': {
		precedence: 1, 
		getExpression:function(result){
			var b = result.pop();
			var a = result.pop();
			return 'g(d('+a+'),'+b+')';
		},
		expectOp: true
	},
	'(': {precedence: 1000, getExpression:function(){return '';}},
	')': {precedence: 1000, getExpression:function(){return '';}},
	'.': {
		precedence: 1, 
		getExpression: function(result){
			var b = result.pop();
			var a = result.pop();
			return 'g('+a+','+b+')';
		}
	},
	'*.': {
		precedence: 1,
		getExpression: function(result){
			var b = result.pop();
			var a = result.pop();
			return 'k('+a+','+b+')';
		}
	},
	'$.': {
		precedence: 1,
		getExpression: function(result){
			var a = result.pop();
			if( !a ) return '$';
			return 'g($,'+a+')';
		}
	},
	'|': {
		precedence: 8,
		getExpression: function(result){
			var b = result.pop();
			var a = result.pop();
			return '(('+a+')||('+b+'))';
		}
	},
	'&': {
		precedence: 7,
		getExpression: function(result){
			var b = result.pop();
			var a = result.pop();
			return '(('+a+')&&('+b+'))';
		}
	},
	'?': {
		precedence: 1,
		getExpression: function(result){
			var a = result.pop();
			return '(!!('+a+'))';
		}  
	},
	'!sortBy': {
		precedence: 6,
		getExpression: function(result){
			var b = result.pop();
			var a = result.pop();
			return 'srt('+a+',function($_at){return '+b+'})';
		}
	},
	'#': {
		precedence: 1,
		getExpression: function(result){
			var a = result.pop();
			return 's('+a+')';
		},
		expectOp: true
	},
	'!sort': {
		precedence: 6,
		getExpression: function(result){
			var a = result.pop();
			return 'srt('+a+')';
		},
		expectOp: true
	},
	'!map': {
		precedence: 6,
		getExpression: function(result){
			var b = result.pop();
			var a = result.pop();
			return 'm('+a+',function($_at){return '+b+'})';
		}
	},
	'!filter': {
		precedence: 6,
		getExpression: function(result){
			var b = result.pop();
			var a = result.pop();
			return 'fil('+a+',function($_at){return '+b+'})';
		}
	},
	'!json': {
		precedence: 6,
		getExpression: function(result){
			var a = result.pop();
			return 'js('+a+')';
		}
	},
	'+': {
		precedence: 4,
		getExpression: function(result){
			var b = result.pop();
			var a = result.pop();
			return '(('+a+')+('+b+'))';
		}
	},
	'=': {
		precedence: 5,
		getExpression: function(result){
			var b = result.pop();
			var a = result.pop();
			return '(('+a+')===('+b+'))';
		}
	},
	'!': {
		precedence: 1,
		getExpression: function(result){
			var a = result.pop();
			return '(!('+a+'))';
		}  
	},
};

function compile(template){
	function shuntingYard(tokens){
		//see http://en.wikipedia.org/wiki/Shunting-yard_algorithm for info
		var inputQueue = tokens.reverse();
		var operatorStack = [];
		var outputStack = [];
		var expectOp = false;
		while( inputQueue.length ){
			var token = inputQueue.pop();
			if( !expectOp && token == '.' ){
				token = '$.';
			}
			if( token === '@' ){
				outputStack.push('$_at');
				expectOp = true;
			} else if( token === ',' ){
				while( operatorStack[operatorStack.length-1] !== '(' ){
					outputStack.push(operatorStack.pop());
				}
				expectOp = false;
			} else if( token === '('){
				operatorStack.push(token);
				expectOp = false;
			} else if( token === ')' ){
				while( operatorStack[operatorStack.length-1] !== '(' ){
					outputStack.push(operatorStack.pop());
				}
				//discard the '('
				operatorStack.pop();
				expectOp = true;
			} else if( operators[token] ){
				var precedence = operators[token].precedence;
				while( operatorStack.length && operators[operatorStack[operatorStack.length-1]].precedence <= precedence ){
					outputStack.push(operatorStack.pop());
				}
				operatorStack.push(token);
				expectOp = operators[token].expectOp;
			} else {
				outputStack.push(token);
				expectOp = true;
			}
		}
		while( operatorStack.length ){
			outputStack.push(operatorStack.pop());
		}

		return outputStack.reverse();
	}

	function generate(tokens){
		var instructions = shuntingYard(tokens);
		var result = [];
		while( instructions.length ){
			var token = instructions.pop();
			if( operators[token] ){
				var op_info = operators[token];
				result.push(op_info.getExpression(result));
			} else if( token.charAt(0) === '$' ){
				result.push(token);
			} else {
				result.push('"'+token+'"');
			}
		}
		return result;
	}

	var regex = new RegExp("("+Object.keys(operators).map(escape).join("|")+")");
	if( DEBUG ){
		console.log(regex);
	}
	function tokenize(str){
		var tokens = str.split(regex).map(function(token){
		 DEBUG && console.log("Token", token);
			return token.trim();
		}).filter(function(token){
			return token !== '';
		})
		return generate(tokens);
	}

	function parse(template, context){
		if( template instanceof Array ){
			if( template[0] === 'literal' ){
				return '['+template.splice(1).map(function(i){
					return parse(i, context);
				})+']';
			} else if( template[0] === 'foreach' ){
				var inputArr = template[1];
				var name = template[2];
				var replacement = template[3];
				return 'm('+parse(inputArr,context)+',function('+name+'){var f={};f.i='+parse(replacement,'f.i')+';return f.i;})'
			}
		} else if( typeof template === 'object' ){
			var parseResult = '{};\n';
			for( var key in template ){
				var t = template[key];
				if( key.charAt(0) === '.' || key.charAt(0) === '$' || key.charAt(0) === '(' ){
					key = '['+parse(key,context)+']';
				} else if( key.charAt(0) === '\\' ){
					key = key.substring(1);
				} else {
					key = '.' + key;
				}
				parseResult += context+key+'='+parse(t, context+key)+';\n';
			}
			return parseResult;
		} else if( typeof template === 'string' ){
			return tokenize(template);
		} else {
			//just a literal value.
			return template;
		}
	}

	var get = function(a,b){
		if( !a || !b ){
			return null;
		} else if( a instanceof Array && (+b != b) && a.dest ){
			var result = [];
			a.forEach(function(i){
				if( i instanceof Array ){
					i.forEach(function(j){
						result.push(get(j,b));
					});
				} else {
					result.push(get(i,b));
				}
			});
			return result;
		} else if( a instanceof Array ){
			var i = +b;
			if( i < 0 ){ i += a.length }
			return a[i];
		} else {
			return a[b];
		}
	};

	var functions = {
		get: get,
		destructure: function(arr){
			if( arr instanceof Array ){
				arr.dest = true;
			}
			return arr;
		},
		map: function(expr, f){
			if( expr instanceof Array ){
				return expr.map(f);
			}
		},
		set: function(expr){
			var inArray = {};
			expr.forEach(function(i){
				inArray[i] = true;
			});
			return Object.keys(inArray);
		},
		sort: function(expr, f){
			if( f ){
				var sorter = function(a, b){
					return f(a) < f(b) ? -1 : 1;
				};
			} else {
				sorter = function(a, b){
					return a < b ? -1 : 1;
				}
			}
			if( expr instanceof Array ){
				return expr.sort(sorter);
			}
			return null;
		},
		search: function(expr, key){
			var results = [];
			function searchR(expr, key){
				if( typeof expr === 'object' ){
					for( var k in expr ){
						if( expr.hasOwnProperty(k) ){
							if( key === k ){
								results.push(expr[k]);
							}
						}
						searchR(expr[k], key);
					}
				}
			}
			searchR(expr, key);
			return results;
		},
		filter: function(expr, f){
			if( expr instanceof Array ){
				return expr.filter(f);
			} else {
				return null;
			}
		},
		map: function(expr, f){
			if( expr instanceof Array ){
				return expr.map(f);
			} else {
				return null;
			}
		},
		json: function jsonR(expr){
			if( typeof expr === 'string' ){
				try {
					expr = jsonR(JSON.parse(expr));
				} catch(e){

				}
			} else if( expr instanceof Array ){
				return expr.map(function(i){
					try {
						return jsonR(JSON.parse(i));
					} catch(e){
						return jsonR(i);
					}
				});
			} else if( typeof expr === 'object' ){
				var newObj = {};
				for( var key in expr ){
					try {
						newObj[key] = jsonR(JSON.parse(expr[key]));
					} catch(e){
						newObj[key] = jsonR(expr[key]);
					}
				}
				return newObj;
			}
			return expr;
		}
	}
	var template = 'var _={}, js=this.json, fil=this.filter, k=this.search, srt=this.sort, s=this.set,m=this.map, g=this.get, d=this.destructure;\n_.i='+parse(template, '_.i')+';return _.i;';
	if( DEBUG ){
		console.log("Made a template file: ", template);
	}
	return new Function('$',template).bind(functions);
}



module.exports = {
	compile: compile
};