/**
 * Adds a column that corresponds to an attribute of a bug, including UI
 * elements to modify that attribute.
 * @param {string} name This is the name of the column to add. Corresponds
 *     to the name of an attribute in the model (eg 'hidden' or 'crbug id').
 * @param {string} type This is the {@code HTML} {@code input} type for the
 *     column. (eg {@code checkbox} for 'hidden')
 */

function addColumn(name,type) {

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
		th.className = 'we_' + name.replace(/ /g,"-") + '_header';
		th.innerHTML = name;
		headerLists[i].appendChild(th);
	}

	// Add UI elements to modify the attribut
	var rows = document.getElementsByClassName('bz_bugitem');

	for (var i = rows.length - 1; i >= 0; i--) {
		var td = document.createElement('td');
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

		td.appendChild(input);
		rows[i].appendChild(td);
	}
}

if (document.URL.indexOf('keywords=WebExposed') != -1) {
	addColumn('hidden','checkbox');
	addColumn('important','checkbox');
	addColumn('crbug id','text');
	addColumn('comment','textarea');
}

// TODO
// Only allow one of hidden/important to be selected at a time