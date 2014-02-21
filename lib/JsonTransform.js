#! /usr/bin/env node

//JsonTransform.js

//author: Ryan Russell
RegExp.prototype.escape= function(s) {
    return s.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
};

var template;

var args = {};
for( var i = 2; i<process.argv.length; i++ ){
	var arg = process.argv[i];
	if( arg.charAt(0) == '-' ){
		args[arg.substring(1)] = process.argv[i+1] || true;
		i++;
	} else {
		console.error("Bad arguments");
	}
}

var fs = require('fs');

if( args.tf ){
	var templateFile = args.tf

	template = JSON.parse(fs.readFileSync(templateFile));
} else {
	try {
		template = JSON.parse(args.t);
	} catch(e){
		template = args.t
	}
}

if( args['-help'] || process.argv.length == 2 ){
	process.stdout.write("This tool transforms JSON using a template syntax that is also JSON.\n")
	process.stdout.write("Usage:\n"+
		"	-f [file]	a file to load as input. If not specified, stdin is used.\n"+
		"	-t [file]	a transforming template to use.\n"+
		"	-tf [file]	loads a template from the file\n"+
		"	-w [number]	the tab width for pretty printing, defaults to none.\n"+
		"	--help		display this help\n"+
		"	--debug		display debug information."+

	"\n---------------------------------------------------------------------\n\n");
	process.stdout.write("A template is a valid JSON object. It defines how the input JSON should be transformed.\n"+
						 "Booleans, null, Numbers, and most Strings are treated as literals. Strings that start with\n"+
						 "'.' or '$', Objects, and Arrays are treated as templates.\n\n");
	process.stdout.write("Template syntax:\n"+
		'	"$"                The root element of the input\n\n'+
		'	"$.foo.bar"        Safe navigation - no errors if any in chain are undefined.\n\n'+
		'	".foo"             Shorthand for $.foo\n\n'+
		'	"foo" or "\\\\.foo"  Literal strings "foo" and ".foo"\n\n'+
		'	"$[].bar"          Array mapping operator - applies .bar to each element in $\n\n'+
		'	"$*.foo"           Searches $ recursively, returning an array of all values with key foo\n\n'+
		'	".foo | .bar"      Fallback - equivalent to JavaScript || operator\n\n'+
		'	".foo=bar"         Identity - equivalent to JavaScript === operator\n\n'+
		'	".foo?"            Converts .foo to a boolean, using JavaScript rules\n\n'+
		'	".foo!"            Negates .foo, according to JavaScript rules\n\n'+
		'	".foo #"           Set operator - converts a list of primitive types to a set.\n\n'+
		'	"$ !sort"          Sorts an array of primitives\n\n'+
		'	"$ !sortBy @.foo"  Sorts the array of objects $ by evaluating @.foo for each element @.\n\n'+
		'	"$ !filter @.foo"  Filters the array by the result of @.foo for each element @\n\n'+
		'	{"key":".foo"}     Returns an object with key equal to $.foo\n\n'+
		'	{".foo":true}      Keys can be templates too.\n\n'+
		'	["literal", ...]   An array of templates [...]\n\n'+
		'	["foreach", "<ARR>", "$var",\n		<TEMPLATE>\n	]\n	          Maps each element of ARR to TEMPLATE. $var is the current element.\n\n'+
		'	Operator precedence should work as expected. Use () to override.');

	process.exit(0);
}

var transform = JsonTransform().compile(template);

function output(data){
	process.stdout.write(JSON.stringify(transform(data)||"undefined", null, +args.w));
}

if( args.f ){
	var input = JSON.parse(fs.readFileSync(args.f));
	output(input);
} else {
	process.stdin.resume();
	process.stdin.setEncoding('utf8');
	var input = '';
	process.stdin.on('data', function(data) {
		input += data;
		try {
			var parsed = JSON.parse(input);
		} catch(e) {
			return;
		}
		
		output(parsed);
	});
}

function JsonTransform(template, input){
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
		'!filter': {
			precedence: 6,
			getExpression: function(result){
				var b = result.pop();
				var a = result.pop();
				return 'fil('+a+',function($_at){return '+b+'})';
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
	var JsonTemplate = {};
	JsonTemplate.compile = function(template){
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

		function compile(tokens){
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

		var regex = new RegExp("("+Object.keys(operators).map(RegExp.prototype.escape).join("|")+")");
		if( args['-debug'] ){
			console.log(regex);
		}
		function tokenize(str){
			var tokens = str.split(regex).map(function(token){
				args['-debug'] && console.log("Token", token);
				return token.trim();
			}).filter(function(token){
				return token !== '';
			})
			return compile(tokens);
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
			}
		}
		var template = 'var _={}, fil=this.filter, k=this.search, srt=this.sort, s=this.set,m=this.map, g=this.get, d=this.destructure;\n_.i='+parse(template, '_.i')+';return _.i;';
		if( args['-debug'] ){
			console.log(template);
		}
		return new Function('$',template).bind(functions);
	}

	return JsonTemplate;

}
