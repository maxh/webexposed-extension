/** 
 * Copyright (c) 2012 The Chromium Authors. All rights reserved.
 * Use of this source code is governed by a BSD-style license that can be
 * found in the LICENSE file.
 */

/**
 * @fileoverview The WebExposed Chrome extension allows users to 
 * organize WebKit bugs labeled with the "WebExposed" keyword.
 * @author meh@chromium.org (Max Heinritz)
 */

// Note: this extension script is injected into page's existing script.
// To avoid conflating namespaces, we wrap the whole script in a self-executing 
// anonymous function.
(function() {
  var storage = chrome.storage.local;

  // Stores incremental updates to the input elements before they are sent to
  // the server.
  var update = {};

  // Config
  var PRIORITIES = ['hidden','normal','important'];
  var SYNC_INTERVAL = 15; // in minutes
  var SEND_UPDATE_INTERVAL = 2; // in seconds
  //var SERVER_URL = 'http://webexposedextension.appspot.com';
  var SERVER_URL = 'http://localhost:8080';

  /**
   * Adds a column corresponding an attribute of a bug.
   * @param {string} name This is the name of the column to add. Typically 
   * corresponds to the name of an attribute in the model (eg 'crbugId').
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
      }

      input.addEventListener('change',togglePriorities);
      input.addEventListener('change',storeUpdate);
      input.addEventListener('input',storeUpdate);
  
      input.id = bugId + ' ' + name;      
      input.name = name;
      input.className = 'webexposed ' + type + ' ' + bugId;

      td.appendChild(input);
      rows[i].appendChild(td);
    }
  }

  /**
   * Saves changes to input elements to a local object in preparation for POST
   * to server. Called when a UI element changes.
   */
  function storeUpdate() {
    var bugId = this.id.split(' ')[0]; // ids are like '{id} {name}'
    var inputName = this.id.split(' ')[1];
    var value = '';
    var name = '';

    // For each checkbox, the value is a boolean (where true means checked).
    switch(this.name) {
      case 'trackingBugId':
        name = 'trackingBugId';
        value = parseInt(this.value);
        break; 
      case 'hidden': case 'important':
        name = 'priority';
        // If the check box is unchecked, return the priority to 'normal'
        value = this.checked ? this.name : 'normal';
        break;
      default:
        name = this.name;
        value = this.value;
        break;
    }

    // Create an entry in the update for this bug if none exists.
    if (typeof (update[bugId] == 'undefined'))
      update[bugId] = {};

    // Store the value to the JSON.
    update[bugId][name] = value;

    // Write the update to the console, for reference.
    console.log('storing update');
    console.log(JSON.stringify(update[bugId]));
    console.log(JSON.stringify(update));
  }

  function togglePriorities() {
    var bugId = this.id.split(' ')[0]; // ids are like '{id} {name}'
    var inputName = this.id.split(' ')[1];
    var value = this.checked ? this.name : 'normal';

    // disable all other priority checkboxes if this one is now checked
    console.log('toggling priorities');
    for (var i = 0; i<PRIORITIES.length; i++)
      if (inputName !== PRIORITIES[i] && 'normal' !== PRIORITIES[i])
        document.getElementById(bugId + ' ' + PRIORITIES[i]).disabled = 
          (value !== 'normal');
  }

  /**
   * Save the changes to the bug states to the AppEngine backend.
   */
  function sendUpdate() {
    // Check if we have updates to send. If not, don't anything!
    if (Object.keys(update).length === 0)
      return;

    // Load secret word using the Chrome extension storage API.
    storage.get('secretword',function(items) {

      // Check if the user didn't enter the secret word on the options page
      if (!items['secretword']) {
        alert('Please enter the secret word on the options page.');
        return;
      }

      var request = new XMLHttpRequest();
      request.open('POST',
        SERVER_URL + '/update?password=' + 
        items['secretword'], 
        true);
      request.onreadystatechange = function() {
        if(request.readyState != 4)
          return;
        console.log('response text:');
        console.log(request.responseText);
      };
      request.setRequestHeader("Content-type", 
        "application/x-www-form-urlencoded");
      request.send('data='+JSON.stringify(update));

      update = {}; // Clear temporary update storage
    });
  }

  /**
   * Retrieves update from the server and adjusts UI accordingly.
   */


  function requestUpdate()
  {
    var request = new XMLHttpRequest();
    console.log('about to send get request');
    request.open('GET', SERVER_URL + '/state', 
      true);
    request.onreadystatechange = loadUpdate;
    request.send(null);
    console.log('request sent');

    function loadUpdate() {
      // Only load the update if the HTTP response content has finished loading
      if(request.readyState != 4)
        return;

      console.log('response text:');
      console.log(request.responseText);
      jsonUpdate = eval('('+request.responseText+')');
      console.log(jsonUpdate);

      // Examine each bug and find its entry in the JSON object, if any
      var rows = document.getElementsByClassName('bz_bugitem');
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

        // Parse the update from the server and update the corresponding UI
        // elements
        var bugUpdates = jsonUpdate[bugId];

        if (bugUpdates['priority'] != 'normal') {
          var inputElementId = bugId + ' ' + bugUpdates['priority'];
          document.getElementById(inputElementId).checked = true;
          // toggle the other priorities based on this one
          togglePriorities.apply(document.getElementById(inputElementId));
        }

        if (bugUpdates['trackingBugId'] != '-1')
          document.getElementById(bugId + ' trackingBugId').value = 
            bugUpdates['trackingBugId'];
        
        document.getElementById(bugId + ' comments').value =
          bugUpdates['comments'];
      }

      // Clears inputs for a bug.
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

    // CREATE UI
    // Create checkboxes corresponding to priority changes
    for (var i = 0; i<PRIORITIES.length; i++)
      if (PRIORITIES[i] !== 'normal')
        addColumn(PRIORITIES[i],'checkbox');

    // Additional support fields
    addColumn('trackingBugId','text');
    addColumn('comments','textarea');

    // LOAD STATE
    requestUpdate();

    // Try to send an update to the server every SEND_UPDATE_INTERVAL seconds
    setInterval(sendUpdate, SEND_UPDATE_INTERVAL*1000);

    // Refresh the data on the page if the user is idle
    syncTimer();
  }
})();
