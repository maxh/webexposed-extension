/**
 * @fileoverview The WebExposed Chrome extension allows users to 
 * organize WebKit bugs labeled with the "WebExposed" keyword.
 * @author meh@chromium.org (Max Heinritz)
 */

// Note: this extension script is injected into page's own script.
// To avoid conflating namespaces, we wrap the whole script in a self-executing 
// anonymous function.
(function() {
  var storage = chrome.storage.local;
  
  var loading = false;

  // Stores incremental updates to the input elements before they are sent to
  // the server.
  var update = {};

  // Constants
  var PRIORITIES = ['hidden','normal','important'];
  var SYNC_INTERVAL = 15; // in minutes
  var SEND_UPDATE_INTERVAL = 2; // in seconds

  /**
   * Adds a column corresponding an attribute of a bug.
   * @param {string} name This is the name of the column to add. Typically 
   * corresponds to the name of an attribute in the model (eg 'crbug id').
   * @param {string} type This is the {@code HTML} {@code input} type for the
   *     column. (eg {@code checkbox} for 'hidden')
   */
  function addColumn(name,type) {
    // Note: Bugzilla buglist tables contain at most 100 bugs per table,
    // so there are multiple tables & colgroups per page with >100 bugs.
    var colGroups = document.getElementsByTagName('colgroup');

    for (var i = colGroups.length - 1; i >= 0; i--) {
      var col = document.createElement('col');
      col.className = 'webexposed colgroup ' + name;
      colGroups[i].appendChild(col);
    }

    // Create headers from the attribute's name
    var headerLists = document.getElementsByClassName('bz_buglist_header');
    for (var i = headerLists.length - 1; i >= 0; i--) {
      var th = document.createElement('th');
      th.className = 'webexposed header ' + name;
      th.innerHTML = name.replace(/-/g," ");
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
      td.className = 'webexposed column ' + name;

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

      input.onchange = storeUpdate;
      input.oninput = storeUpdate;
  
      input.id = bugId + ' ' + name;      
      input.name = name;
      input.className = 'webexposed ' + type + ' ' + bugId;

      td.appendChild(input);
      rows[i].appendChild(td);
    }
  }

  /**
   * Saves changes to input elements to a local array in preparation for POST to
   * server. Called when a UI element changes.
   */
  function storeUpdate() {
    var bugId = this.id.split(' ')[0]; // ids are like '{id} {name}'
    var inputName = this.id.split(' ')[1];
    var value = '';
    var name = '';

    // For each checkbox, the value is a boolean (where true means checked).
    if (this.type == 'checkbox') {
      name = 'priority';
      value = this.checked ? this.name : 'normal';
      togglePriorities();
    // For other types of input (right now only textarea and text), the value
    // is the content in the input element.
    } else {
      name = this.name;
      value = this.value;
    }

    // If this storeUpdate was triggered by a programmatic onchange event while
    // we load server data, then we should not send changes back to the server
    if (loading) return;

    // Create an entry in the update for this bug if none exists.
    if (typeof (update[bugId] == 'undefined'))
      update[bugId] = {};

    // Store the value to the array.
    update[bugId][name] = value;

    // Write the update to the console, for reference.
    console.log('storing update');
    console.log(JSON.stringify(update[bugId]));
    console.log(JSON.stringify(update));

    document.getElementById('webexposed_button').disabled = false;

    function togglePriorities() {
      // disable all other priority checkboxes if this one is now checked
      console.log('toggling priorities');
      for (p in PRIORITIES)
        if (inputName !== PRIORITIES[p] && PRIORITIES[p] !== 'normal')
          document.getElementById(bugId + ' ' + PRIORITIES[p]).disabled = 
            (value !== 'normal');
    }
  }

  /**
   * Save the changes to the bug states to the AppEngine backend.
   */
  function sendUpdate() {
    // Check if we have updates to send. If not, don't send the update.
    if (Object.keys(update).length === 0)
      return;

    // Load secret word using the Chrome extension storage API.
    storage.get('secretword',function(items) {
      // Check if the user didn't enter the secret word on the options page
      if (!items['secretword']) {
        alert('Please enter the secret word on the options page.');
      }
      else {
        update = {};
        console.log('sending update');
        // TODO: Send POST request to server
        // TODO: Disable save button once changes are made
      }
    });
  }

  /**
   * Retrieves update from the server and adjusts UI accordingly.
   */
  function loadUpdate() {
    loading = true;

    console.log('loading update');
    var rows = document.getElementsByClassName('bz_bugitem');

    jsonUpdate = []; // TODO: make request to App Engine Backend here

    // Examine each bug and find its entry in the JSON object, if any
    for (var i = rows.length - 1; i >= 0; i--) {
      // Extract the bug id from the link in the first cell in this row
      var bugId = rows[i].cells[0].getElementsByTagName('a')[0].innerHTML;
      
      // Assume that the current information is wrong if it's not consistent
      // with the server; clear it and replace with the server's information
      // TODO: only clear unchanged values; this may flash the changes 
      // to UI elements.
      clearInputElements(bugId);

      // If the update has no information on this bug, we clear its inputs
      if (typeof (jsonUpdate[bugId]) == 'undefined') 
        continue;

      var updatesForThisBug = jsonUpdate[bugId];

      // Print the JSON to the console, for reference
      console.log(bugId + ': ');
      console.log(jsonUpdate[bugId]);

      // Parse the update from the server and update the corresponding UI
      // elements
      for (var j = 0; j < updatesForThisBug.length; j++) {
        var fieldName = updatesForThisBug[j][0];
        var fieldValue = updatesForThisBug[j][1];

        if (fieldName = 'priority')
          document.getElementById(fieldValue + ' ' + bugId).checked = true;
        // For other types of input (right now only textarea and text), the 
        // value is the content in the input element.
        else
          document.getElementById(fieldName + ' ' + bugId).value = fieldValue;
      }
    }

    loading = false;

    /**
     * Clears inputs for a bug with no updates.
     */
    function clearInputElements(bugId) {
      elements = document.getElementsByClassName(bugId);
      for (var i = 0; i < elements.length; i++)
        // For each checkbox, the value is a boolean (false => unchecked)
        if (elements[i].tagName === 'INPUT' && elements[i].type === 'checkbox')
            elements[i].checked = false;
        // For other types of input (right now only textarea and text), clear 
        // the content in the input element.
        else
          elements[i].value = '';
    }
  }

  /**
   * Retrieves data from server after the user has been idle for the 
   * SYNC_INTERVAL (in minutes).
   */
  function syncTimer() {
    var t;
    document.onkeypress = resetTimer;
    document.onmousemove = resetTimer;
    document.onkeypress = resetTimer;

    function sync() {
      console.log("syncing");
      loadUpdate();
    }

    function resetTimer() {
      clearTimeout(t);
      t = setTimeout(sync, SYNC_INTERVAL*1000*60);
    }
  };

  // only run the extension on the WebExposed bug list
  if (document.URL.indexOf('keywords=WebExposed') != -1) {

    // Create checkboxes corresponding to priority changes
    for (var i = 0; i<PRIORITIES.length; i++)
      if (PRIORITIES[i] !== 'normal')
        addColumn(PRIORITIES[i],'checkbox');

    // Addition support fields
    addColumn('crbugId','text');
    addColumn('comment','textarea');

    // Try to send an update to the server every SEND_UPDATE_INTERVAL seconds
    setInterval(sendUpdate, SEND_UPDATE_INTERVAL*1000);

    // Refresh the data on the page if the user is idle
    syncTimer();
  }
})();
// TODO: Only allow one of hidden/important to be selected at a time
