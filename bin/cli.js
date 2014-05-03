#! /usr/bin/env node

var program = require('commander');
var JsonTransform = require('../lib');
var fs = require('fs');

function tab(n, str) {
	var spaces = ' ';
	for(var i=0; i<n; i++) {
		spaces += ' ';
	}
	return spaces + str.replace(/\n/gm, '\n' + spaces)
}

program
	.option('-h, --help', 'Show more help', function() {
		console.log(program.helpInformation())
		console.log(tab(2, [
			"A template is a valid JSON object. It defines how the input JSON should be transformed.\n"+
			"Booleans, null, Numbers, and most Strings are treated as literals. Strings that start with\n"+
			"'.' or '$', Objects, and Arrays are treated as templates.\n\n",
			"Template syntax:\n"+
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
		'	".foo !json"       Recursively parses a string as JSON - useful for comments fields\n\n'+
		'	{"key":".foo"}     Returns an object with key equal to $.foo\n\n'+
		'	{".foo":true}      Keys can be templates too.\n\n'+
		'	["literal", ...]   An array of templates [...]\n\n'+
		'	["foreach", "<ARR>", "$var",\n		<TEMPLATE>\n	]\n	          Maps each element of ARR to TEMPLATE. $var is the current element.\n\n'+
		'	Operator precedence should work as expected. Use () to override.'
		].join('\n')));
		process.exit(0);
	})

program
	.version('JsonTransform 0.2.0')
	.usage('[options] <template>')
	.option('-t, --template <f>', 'File to load as a template')
	.option('-i, --input <f>', 'File to load as an input')
	.option('-w, --whitespace <i>', 'Indentation level in spaces', parseInt)
	.parse(process.argv);

var templates = [];
if( program.template ){
	try {
		var file = fs.readFileSync(program.template);
		templates.push(JSON.parse(''+file));
	} catch(e) {
		console.error("Error while opening or parsing template file", e);
		process.exit(1);
	}
}
templates.push(program.args.join(' '));

var input = '';
if( program.input ){
	try {
		var file = fs.readFileSync(program.input);
		input = JSON.parse(''+file);
	} catch(e) {
		console.error("Error while opening or parsing input file", e);
		process.exit(1);
	}
	processInput(input);
} else {
	process.stdin.on('readable', function(chunk) {
		var chunk = process.stdin.read();
		if (chunk !== null) {
			input += '' + chunk;
			try {
				var parsed = JSON.parse(''+input);
			} catch(e) { }
			processInput(parsed);
		}
	});
}

function processInput(input) {
	templates.forEach(function(template) {
		if( template.length ){
			try {
				var transformer = JsonTransform.compile(template);
				if( transformer ){
					input = transformer(input);
				}
			} catch(e) {
				console.log("Error ")
			}
		}
	});
	console.log(JSON.stringify(input, null, program.whitespace));
}

/*
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
		'	".foo !json"       Recursively parses a string as JSON - useful for comments fields\n\n'+
		'	{"key":".foo"}     Returns an object with key equal to $.foo\n\n'+
		'	{".foo":true}      Keys can be templates too.\n\n'+
		'	["literal", ...]   An array of templates [...]\n\n'+
		'	["foreach", "<ARR>", "$var",\n		<TEMPLATE>\n	]\n	          Maps each element of ARR to TEMPLATE. $var is the current element.\n\n'+
		'	Operator precedence should work as expected. Use () to override.');

	process.exit(0);
}
*/


/*
var transform = JsonTransform().compile(template);

function output(data){
	process.stdout.write(JSON.stringify(transform(data)||"undefined", null, +args.w));
}
*/