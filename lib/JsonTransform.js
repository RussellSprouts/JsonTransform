#! /usr/bin/env node

//JsonTransform.js

//author: Ryan Russell
/**

	Full example:
	Input:
	{
		status: 'success',
		pizzasOrdered: [
			{
				name: 'Pepperoni',
				price: 8,
				toppings: [
					{name:'pepperoni'},
					{name:'cheese'}
				]
			},
			{
				name: 'Cheese',
				price: 5,
				toppings: [
					{name:'cheese'}
				]
			}
		],
		
	}

	Template:
	{
		apiVersion: ['literal', 1, 10, 9]
		'.status': true,
		pizzas: [
			'foreach', '.pizzasOrdered', '$pizza',{
				name: '$pizza.name',
				cost: '$pizza.price',
				toppings: '$pizza.toppings[].name'
			}
		]

	}

	Result:
	{
		apiVersion: [1, 10, 9],
		success: true,
		pizzas: [
			{
				name: 'Pepperoni',
				cost: 8,
				toppings: ['pepperoni', 'cheese']
			},
			{
				name: 'Cheese',
				cost: 8,
				toppings: ['cheese']
			}
		]
	}

*/
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
		'	".foo | .bar"      Fallback - equivalent to JavaScript || operator\n\n'+
		'	".foo?"            Converts .foo to a boolean, using JavaScript rules\n\n'+
		'	".foo #"           Set operator - converts a list of primitive types to a set.\n\n'+
		'	{"key":".foo"}     Returns an object with key equal to $.foo\n\n'+
		'	{".foo":true}      Keys can be templates too.\n\n'+
		'	["literal", ...]   An array of templates [...]\n\n'+
		'	["foreach", "<ARR>", "$var",\n		<TEMPLATE>\n	]\n	          Maps each element of ARR to TEMPLATE. $var is the current element.\n\n'+
		'	All operator precedence is the same except |, which is lower. Parens can override.');

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
		'[': {
			precedence: 1, 
			getExpression:function(result){
				var a = result.pop();
				return 'd('+a+')';
			}
		},
		']': {precedence: 1, getExpression:function(result){return result.pop();}},
		'(': {precedence: 1000, getExpression:function(){return '';}},
		'.': {
			precedence: 1, 
			getExpression: function(result){
				var b = result.pop();
				var a = result.pop();
				return 'g('+a+','+b+')';
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
			precedence: 2,
			getExpression: function(result){
				var b = result.pop();
				var a = result.pop();
				return '('+a+')||('+b+')';
			}
		},
		'?': {
			precedence: 1,
			getExpression: function(result){
				var a = result.pop();
				return '(!!'+a+')';
			}
		},
		'sortBy': {
			precedence: 1,
			getExpression: function(result){

			}
		},
		'#': {
			precedence: 1,
			getExpression: function(result){
				var a = result.pop();
				return 's('+a+')';
			}
		}
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

				if( token === ',' ){
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
				} else if( token == ']'){
					expectOp = true;
				} else if( operators[token] ){
					var precedence = operators[token].precedence;
					while( operatorStack.length && operators[operatorStack[operatorStack.length-1]].precedence <= precedence ){
						outputStack.push(operatorStack.pop());
					}
					operatorStack.push(token);
					expectOp = false;
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

		function tokenize(str){
			var tokens = str.split(/([^$@\w])/).map(function(token){
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
					if( key.charAt(0) === '.' || key.charAt(0) === '$' ){
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
				if( template.charAt(0) === '@' ){
					return '"' + template.substring(1) + '"';
				}
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
			}
		}
		var template = 'var _={}, s=this.set,m=this.map, g=this.get, d=this.destructure;\n_.i='+parse(template, '_.i')+';return _.i;';
		if( args['-debug'] ){
			console.log(template);
		}
		return new Function('$',template).bind(functions);
	}

	return JsonTemplate;

}
