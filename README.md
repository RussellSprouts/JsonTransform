# JsonTransform

Transforms JSON to JSON using JSON

# Installation

1. Clone the repository to your local machine.
2. Navigate to the repository folder, and execute `npm install -g ./`
   (You may need to use `sudo`.)  
3. Now you have the commandline tool `jstr` on your PATH.
4. Type `jstr --help` for usage information.

# Examples

## The Basics

data.json

	{"key": "value", "arr": []}

`jstr -f data.json -t "$.key"` => `"value"`  
`jstr -f data.json -t "$.arr"` => `[]`

---
data.json

	{"key": "value", "arr": []}

template.json
	
	{"newKey": "$.key"}

`jstr -f data.json -tf template.json` => `{"newKey":"value"}`

## Full Example

data.json

	{
			"minorVersion": 1
			"status": "success",
			"pizzasOrdered": [
			{
				"name": "Pepperoni",
				"price": 8,
				"toppings": [
					{"name":"pepperoni"},
					{"name":"cheese", "vegetarian": true}
				]
			},
			{
				"name": "Cheese",
				"price": 5,
				"toppings": [
					{"name":"cheese", "vegetarian":true}
				]
			}
		],
		
	}

template.json

	{
		"apiVersion": ["literal", 2, 10, ".minorVersion"]
		".status": true,
		"pizzas": [
			"foreach", ".pizzasOrdered", "$pizza",{
				"name": "$pizza.name",
				"cost": "$pizza.price",
				"toppings": "$pizza.toppings[].name"
			}
		]

	}

`jstr -f data.json -tf template.json`

result

	{
		"apiVersion": [2, 10, 1],
		"success": true,
		"pizzas": [
			{
				"name": "Pepperoni",
				"cost": 8,
				"toppings": ["pepperoni", "cheese"]
			},
			{
				"name": "Cheese",
				"cost": 8,
				"toppings": ["cheese"]
			}
		]
	}