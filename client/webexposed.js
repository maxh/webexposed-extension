/**
 * @fileoverview The WebExposed Chrome extension allows users to 
 * organize WebKit bugs labeled with the "WebExposed" keyword.
 * @author meh@chromium.org (Max Heinritz)
 */

/**
 * Adds a column corresponding an attribute of a bug.
 * @param {string} name This is the name of the column to add. Corresponds
 *     to the name of an attribute in the model (eg 'hidden' or 'crbug id').
 * @param {string} type This is the {@code HTML} {@code input} type for the
 *     column. (eg {@code checkbox} for 'hidden')
 */

function addColumn(name,type) {

	// Replace spaces with underscores in the column name
	name = name.replace(/ /g,"-");

	// Create cols for matching CSS to columns
	// Note: Bugzilla buglist tables contain at most 100 bugs per table,
	// so there are multiple tables & colgorups per page with >100 bugs.
	var colGroups = document.getElementsByTagName('colgroup');
	for (var i = colGroups.length - 1; i >= 0; i--) {
		var col = document.createElement('col');
		col.className = 'we_' + name + '_column';
		colGroups[i].appendChild(col);
	}

	// Create headers from the attribute's name
	var headerLists = document.getElementsByClassName('bz_buglist_header');
	for (var i = headerLists.length - 1; i >= 0; i--) {
		var th = document.createElement('th');
		th.className = 'we_' + name + '_header';
		th.innerHTML = name;
		headerLists[i].appendChild(th);
	}

	addUIElementToAllRows(name,type);
}

/**
 * Adds a UI element on each row that corresponds to an attribute of the bug
 * on that row. Different attributes require different input types.
 * @param {string} name This is the name of the column to add. Corresponds
 *     to the name of an attribute in the model (eg 'hidden' or 'crbug id').
 * @param {string} type This is the {@code HTML} {@code input} type for the
 *     attribute. (eg {@code checkbox} for 'hidden')
 */
function addUIElementToAllRows(name,type) {
	// Add UI elements to modify the attribute
	var rows = document.getElementsByClassName('bz_bugitem');

	for (var i = rows.length - 1; i >= 0; i--) {
		// Extract the bug id from the link in the first cell in this row
		var bugId = rows[i].cells[0].getElementsByTagName('a')[0].innerHTML;

		var td = document.createElement('td');
		td.className = 'we_' + name.replace(/ /g,"-") + '_column';
		
		var input;

		// Most inputs will be input elements, except for textareas.
		if (type === 'textarea') {
			input = document.createElement('textarea');
			
		} else {
			input = document.createElement('input');
			input.type = type;
			// Bug ids are typically <=7 digits.
			if (name === 'crbug id') {
				input.size = 7;
			}
		}

		input.name = name + "^"+ bugId;

		td.appendChild(input);
		rows[i].appendChild(td);
	}
}

function addSaveButton() {
	var header = document.getElementById('header');
	var button = document.createElement('input');
	button.type = 'submit';
	button.value = 'Save WebExposed Attributes';
	button.id = 'we_button';

	header.appendChild(button);
}

// only run the extension on the WebExposed bug list
if (document.URL.indexOf('keywords=WebExposed') != -1) {
	addSaveButton();
	addColumn('hidden','checkbox');
	addColumn('important','checkbox');
	addColumn('crbug id','text');
	addColumn('comment','textarea');
}

// TODO
// Only allow one of hidden/important to be selected at a time
