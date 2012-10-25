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

var storage = chrome.storage.local;

function addColumn(name,type) {
	// Create cols for matching CSS to columns
	// Note: Bugzilla buglist tables contain at most 100 bugs per table,
	// so there are multiple tables & colgorups per page with >100 bugs.
	var colGroups = document.getElementsByTagName('colgroup');
  var safeName = name.replace(/ _/g,"-");

	for (var i = colGroups.length - 1; i >= 0; i--) {
		var col = document.createElement('col');
		col.className = 'webexposed_colgroup ' + safeName;
		colGroups[i].appendChild(col);
	}

	// Create headers from the attribute's name
	var headerLists = document.getElementsByClassName('bz_buglist_header');
	for (var i = headerLists.length - 1; i >= 0; i--) {
		var th = document.createElement('th');
		th.className = 'webexposed_header ' + safeName;
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
  var safeName = name.replace(/ _/g,"-");

	for (var i = rows.length - 1; i >= 0; i--) {
		// Extract the bug id from the link in the first cell in this row
		var bugId = rows[i].cells[0].getElementsByTagName('a')[0].innerHTML;

		var td = document.createElement('td');
		td.className = 'webexposed_column ' + safeName;
		
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

		input.name = name;
    input.className = 'webexposed_input ' + bugId;

		td.appendChild(input);
		rows[i].appendChild(td);
	}
}

/**
 * Adds a save button.
 */
function addSaveButton() {
	var header = document.getElementById('header');
	var button = document.createElement('input');
	button.type = 'submit';
	button.value = 'Save WebExposed Attributes';
	button.id = 'webexposed_button';
  button.addEventListener('click',saveChanges);

  // Add the button to the header
	header.appendChild(button);
}

/**
 * Save the changes to the bug states to the AppEngine backend.
 */
function saveChanges() {
  // Load secret word using the Chrome extension storage API.
  storage.get('secretword',function(items) {
    // Check if the user didn't enter the secret word on the options page
    if (!items['secretword']) {
      alert('Please enter the secret word on the options page.');
    }
    else {
      constructJsonUpdate();
      // TODO: Send update with secret word to App Engine backend
    }
  });
}

/**
 * Callback for the POST to the App Engine server
 */
function saveChangesCallback() {
  alert('Your changes have been saved.');
}

/**
 * Constructs a JSON array based on the current state of the input elements (eg 
 * checkboxed checked vs not).
 * @return {[bugId]{hidden: boolean, 
 * important: boolean,
 * crbug_id: String,
 * comments: String}} A JSON object with all the updates to send to the server.
 */
function constructJsonUpdate() {
  var rows = document.getElementsByClassName('bz_bugitem');

  var safeName = name.replace(/ _/g,"-");
  jsonUpdate = [];

  // Examine each bug and add an appropriate entry in the array
  // TODO: only send updates for bugs with status changes
  for (var i = rows.length - 1; i >= 0; i--) {
    // Extract the bug id from the link in the first cell in this row
    var bugId = rows[i].cells[0].getElementsByTagName('a')[0].innerHTML;
    var inputsForThisBug = document.getElementsByClassName(
      'webexposed_input ' + bugId);
    jsonUpdate[bugId] = [];

    // Parse the input element states to construct the JSON
    for (var j = 0; j < inputsForThisBug.length; j++) {
      var inputElement = inputsForThisBug[j];
      var varValue = '';

      // For each checkbox, the value is a boolean (where true means checked'
      if (inputElement.tagName === 'INPUT' 
        && inputElement.type === 'checkbox') {
          varValue=inputElement.checked;
      // For other types of input (right now only textarea and text), the value
      // is the content in the input element
      } else {
        if(inputElement.value) {
          varValue = inputElement.value;
        }
      }

      // Add this attribute's value to the array
      jsonUpdate[bugId][inputElement.name] = varValue;
    }

    // Print the JSON to the console, for reference
    console.log(bugId + ': ');
    console.log(jsonUpdate[bugId]);
  }
  return jsonUpdate;
}


// only run the extension on the WebExposed bug list
if (document.URL.indexOf('keywords=WebExposed') != -1) {
	addSaveButton();
	addColumn('hidden','checkbox');
	addColumn('important','checkbox');
	addColumn('crbug id','text');
	addColumn('comment','textarea');
}

// TODO: Only allow one of hidden/important to be selected at a time
