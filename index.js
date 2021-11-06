/*
	See:
	https://learn-next.mydigitalstructure.cloud/learn-function-automation

	This is node app to automate tasks
	https://www.npmjs.com/package/lambda-local:

	lambda-local -l index.js -t 9000 -e event-blockchain-query.json
	lambda-local -l index.js -t 9000 -e event-blockchain-key-categories.json

	https://fjolt.com/article/javascript-export-import-node-js

	Setup:
	See README.md

	BlockFrost API:
	https://github.com/blockfrost/blockfrost-js/wiki/BlockFrostAPI.md
*/

exports.handler = function (event, context, callback)
{
	var mydigitalstructure = require('mydigitalstructure')
	var _ = require('lodash');

	mydigitalstructure.set(
	{
		scope: '_event',
		value: event
	});

	//Event: {"site": "default"}

	mydigitalstructure.set(
	{
		scope: '_context',
		value: context
	});

	mydigitalstructure.set(
	{
		scope: '_callback',
		value: callback
	});

	var settings;

	if (event != undefined)
	{
		if (event.site != undefined)
		{
			settings = event.site;
			//ie use settings-[event.site].json
		}
		else
		{
			settings = event;
		}
	}

	mydigitalstructure._util.message(
	[
		'-',
		'EVENT-SETTINGS:',
		settings
	]);

	mydigitalstructure.init(main, settings)
	mydigitalstructure._util.message('Using mydigitalstructure module version ' + mydigitalstructure.VERSION);
	
	function main(err, data)
	{
		var settings = mydigitalstructure.get({scope: '_settings'});
		var event = mydigitalstructure.get({scope: '_event'});

		mydigitalstructure._util.message(
		[
			'-',
			'SETTINGS:',
			settings
		]);

		var namespace = settings.blockchain.namespace;

		if (event.namespace != undefined)
		{
			namespace = event.namespace;
		}

		if (namespace != undefined)
		{
			mydigitalstructure._util.message(
			[
				'-',
				'NAMESPACE:',
				namespace
			]);

			var blockchainfactory = require('blockchainfactory/blockchainfactory.' + namespace + '.js');
		}

		if (_.has(blockchainfactory, 'init'))
		{
			blockchainfactory.init();
		}

		mydigitalstructure.add(
		{
			name: 'blockchain-query',
			code: function ()
			{
				mydigitalstructure.invoke('blockchain-protect-key-categories');
			}
		});

		mydigitalstructure.add(
		{
			name: 'blockchain-protect-key-categories',
			code: function (param, response)
			{
				if (response == undefined)
				{
					mydigitalstructure.cloud.search(
					{
						object: 'setup_core_protect_key_category',
						fields: [{name:'title'}],
						rows: 9999,
						callback: 'blockchain-protect-key-categories',
						callbackParam: param
					});
				}
				else
				{
					var keyCategories = {}
					_.each(response.data.rows, function (row) {keyCategories[row.title] = row.id})

					mydigitalstructure.set(
					{
						scope: 'blockchain',
						context: 'protect-key-categories',
						value: keyCategories
					});

					mydigitalstructure.invoke('blockchain-query-addresses')
				}
			}
		});

		mydigitalstructure.add(
		{
			name: 'blockchain-query-addresses',
			code: function ()
			{
				var event = mydigitalstructure.get({scope: '_event'});

				if (event.address != undefined)
				{
					mydigitalstructure.set(
					{
						scope: '_event',
						context: 'addresses',
						value: [event.address]
					});

					mydigitalstructure.invoke('blockchain-protect-key-identites');
				}
				else
				{
					mydigitalstructure.invoke('blockchain-protect-key-addresses');
				}
			}
		});

		mydigitalstructure.add(
		{
			name: 'blockchain-protect-key-addresses',
			code: function (param, response)
			{
				var keyCategories = mydigitalstructure.get(
				{
					scope: 'blockchain',
					context: 'protect-key-categories'
				});

				if (response == undefined)
				{
					mydigitalstructure.cloud.search(
					{
						object: 'core_protect_key',
						fields: [{ name: 'key' }],
						filters: 
						[
							{
								field: 'category',
								comparison: 'EQUAL_TO',
								value: keyCategories['Blockchain Address']
							}
						],
						rows: 9999,
						callback: 'blockchain-protect-key-addresses'
					});
				}
				else
				{
					var addresses = mydigitalstructure.set(
					{
						scope: '_event',
						context: 'addresses',
						value: _.map(response.data.rows, 'key')
					});

					console.log(addresses)
					mydigitalstructure.invoke('blockchain-protect-key-identites');
				}
			}
		});

		mydigitalstructure.add(
		{
			name: 'blockchain-protect-key-identites',
			code: function (param, response)
			{
				var keyCategories = mydigitalstructure.get(
				{
					scope: 'blockchain',
					context: 'protect-key-categories'
				});

				if (response == undefined)
				{
					mydigitalstructure.cloud.search(
					{
						object: 'core_protect_key',
						fields: [{ name: 'key' }, { name: 'title'}],
						filters: 
						[
							{
								field: 'category',
								comparison: 'EQUAL_TO',
								value: keyCategories['Identity']
							}
						],
						rows: 9999,
						callback: 'blockchain-protect-key-identites'
					});
				}
				else
				{
					var identites = mydigitalstructure.set(
					{
						scope: 'blockchain',
						context: 'identites',
						value: response.data.rows
					});

					var projectIndentity = _.find(identites, function (identity) {return identity.title == 'BlockFrost Project ID'});

					console.log(projectIndentity)

					if (projectIndentity != undefined)
					{
						mydigitalstructure.set(
						{
							scope: '_event',
							context: 'blockfrostProjectId',
							value: projectIndentity.key
						});
					}

					mydigitalstructure.invoke('blockchain-query-process');
				}
			}
		});

		mydigitalstructure.add(
		{
			name: 'blockchain-query-process',
			code: function ()
			{
				var event = mydigitalstructure.get({scope: '_event'});

				console.log(event)

				if (event.processComplete == undefined)
				{
					event.processComplete = 'blockchain-query-complete'
				}

				// See /blockchainfactory
				mydigitalstructure.invoke('blockchain-blockfrost-query')
			}
		});

		mydigitalstructure.add(
		{
			name: 'blockchain-query-complete',
			code: function (data)
			{
				mydigitalstructure.invoke('util-end', data)
			}
		});
		
		mydigitalstructure.add(
		{
			name: 'util-log',
			code: function (data)
			{
				mydigitalstructure.cloud.save(
				{
					object: 'core_debug_log',
					data: data
				});
			}
		});

		mydigitalstructure.add(
		{
			name: 'util-end',
			code: function (data, error)
			{
				var callback = mydigitalstructure.get(
				{
					scope: '_callback'
				});

				if (error == undefined) {error = null}

				if (callback != undefined)
				{
					callback(error, data);
				}
			}
		});

		/* STARTS HERE! */

		var event = mydigitalstructure.get({scope: '_event'});

		var controller = event.controller;

		if (controller == undefined)
		{
			console.log('!! No controller [event.controller]')
		}
		else
		{
			mydigitalstructure.invoke(controller);
		}
	}
}