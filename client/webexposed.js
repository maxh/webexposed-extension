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
  var COLUMNS = ['hidden','important','trackingBugId','comments'];
  var SYNC_INTERVAL = 15; // in minutes
  var SEND_UPDATE_INTERVAL = 2; // in seconds
  var SERVER_URL = 'http://webexposedextension.appspot.com';

  // Should hidden bugs be displayed?
  var displayHiddenBugs = false;

  /**
   * Adds a column corresponding an attribute of a bug.
   * @param {string} name This is the name of the column to add.
   */
  function addColumns() {
    // Note: Bugzilla buglist tables contain at most 100 bugs per table,
    // so there are multiple tables & colgroups per page with >100 bugs.
    var colGroups = document.getElementsByTagName('colgroup');
    for (var i = colGroups.length - 1; i >= 0; i--) {
      for (var j = 0; j < COLUMNS.length; j++) {
        var col = document.createElement('col');
        col.className = 'webexposed ' + COLUMNS[j];
        colGroups[i].appendChild(col);
      } 
    }

    // Create headers from the attribute's name
    var headerLists = document.getElementsByClassName('bz_buglist_header');
    for (var i = headerLists.length - 1; i >= 0; i--) {
      for (var j = 0; j < COLUMNS.length; j++) {
        var th = document.createElement('th');
        th.className = 'webexposed ' + COLUMNS[j];
        th.innerHTML = COLUMNS[j];
        headerLists[i].appendChild(th);
      }
    }

    // Create cells and individual input elements
    var rows = document.getElementsByClassName('bz_bugitem');
    for (var i = rows.length - 1; i >= 0; i--) {
      // Extract the bug id from the link in the first cell in this row
      var bugId = rows[i].cells[0].getElementsByTagName('a')[0].innerHTML;
      rows[i].className = rows[i].className + ' webexposed_row_' + bugId;

      for (var j = 0; j < COLUMNS.length; j++) {
        var td = document.createElement('td');
        td.className = 'webexposed ' + COLUMNS[j];

        var input;

        switch(COLUMNS[j]) {
          case 'comments':
            input = document.createElement('textarea');
            break;
          case 'hidden': case 'important':
            input = document.createElement('input');
            input.type = 'checkbox';
            input.addEventListener('change',togglePriorities);
            break;
          case 'trackingBugId':
            input = document.createElement('input');
            input.type = 'text';
            break;
        }

        input.addEventListener('change',storeUpdate);
        input.addEventListener('input',storeUpdate);
    
        input.id = bugId + ' ' + COLUMNS[j];      
        input.name = COLUMNS[j];
        input.className = 'webexposed ' + bugId;

        td.appendChild(input);
        rows[i].appendChild(td);
      }
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
  }

  function togglePriorities() {
    var bugId = this.id.split(' ')[0]; // ids are like '{id} {name}'
    var name = this.id.split(' ')[1]; // {'important','hidden'}
    var priority = this.checked ? name : 'normal';

    // Disable all other priority checkboxes if this one is now checked
    console.log('toggling priorities');
    document.getElementById(bugId + ' important').disabled 
      = (priority == 'hidden');
    document.getElementById(bugId + ' hidden').disabled 
      = (priority == 'important');

    // Change color of row by changing CSS class
    var row = document.getElementsByClassName('webexposed_row_' + bugId)[0];
    // Remove the old priority class
    row.className = 
      row.className.replace(/webexposed_row_priority_[a-z]+ */,'');
    // Add new priority class
    row.className = row.className + ' webexposed_row_priority_' + priority;
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
        // Do nothing if the request isn't fully loaded
        if(request.readyState != 4)
          return;
      };
      request.setRequestHeader("Content-type", 
        "application/x-www-form-urlencoded");
      request.send('data='+JSON.stringify(update));

      update = {}; // Clear temporary update storage (assumes request makes it)
    });
  }

  /**
   * Retrieves update from the server and adjusts UI accordingly.
   */
  function requestUpdate()
  {
    console.log('about to send get request');

    var request = new XMLHttpRequest(),
        url = SERVER_URL + '/state';

    if (displayHiddenBugs)
      url += '?shbd=0';

    request.onreadystatechange = loadUpdate;
    request.open('GET', url, true);
    request.send(null);

    console.log('request sent');

    function loadUpdate() {
      // Only load the update if the HTTP response content has finished loading
      if(request.readyState != 4)
        return;

      jsonUpdate = JSON.parse(request.responseText);

      // The _hidden array will be sorted, but in reverse order. Apply a binary
      // search to determine whether entries are listed in there.
      var entryCountInHiddenArray = jsonUpdate['_hidden'].length;
      function hiddenArrayContainsBugId(bugId) {
        if (entryCountInHiddenArray == 0)
          return false;

        var firstIndex = 0, lastIndex = entryCountInHiddenArray - 1,
            middle = Math.floor((lastIndex - firstIndex) / 2);

        while (jsonUpdate['_hidden'][middle] != bugId &&
               firstIndex < lastIndex) {
          if (bugId > jsonUpdate['_hidden'][middle])
            lastIndex = middle - 1;
          else if (bugId < jsonUpdate['_hidden'][middle])
            firstIndex = middle + 1;

          middle = Math.floor((lastIndex + firstIndex) / 2);
        }

        return jsonUpdate['_hidden'][middle] == bugId;
      }


      // Examine each bug and find its entry in the JSON object, if any
      var rows = document.getElementsByClassName('bz_bugitem');
      for (var i = rows.length - 1; i >= 0; i--) {
        // Extract the bug id from the link in the first cell in this row
        var bugId = rows[i].cells[0].getElementsByTagName('a')[0].innerHTML;

        // Bail out more quickly if this bug is hidden per the summarized array.
        if (hiddenArrayContainsBugId(parseInt(bugId, 10))) {
          var inputElement = document.getElementById(bugId + ' hidden');
          inputElement.checked = true;
          togglePriorities.apply(inputElement);
          continue;
        }

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

      document.body.classList.remove('webexposed_display_hidden_bugs');
      if (displayHiddenBugs)
        document.body.classList.add('webexposed_display_hidden_bugs');
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
      document.location.reload(true);
    }

    function resetTimer() {
      clearTimeout(t);
      t = setTimeout(sync, SYNC_INTERVAL*1000*60);
    }
  };

  /**
   * Toggle whether hidden bugs should be displayed in the overview. This will
   * re-request the bug status from the server.
   */
  function toggleDisplayOfHiddenBugs() {
    displayHiddenBugs = !displayHiddenBugs;
    requestUpdate();
  }

  var bugCountElement = document.querySelector('.bz_result_count'),
      anchorElement = document.createElement('a');

  anchorElement.href = '#';
  anchorElement.textContent = 'Toggle display of hidden bugs.';
  anchorElement.onclick = toggleDisplayOfHiddenBugs;
  bugCountElement.appendChild(anchorElement);

  // Only run the extension on the WebExposed bug list
  if (document.URL.indexOf('keywords=WebExposed') != -1) {
    addColumns();
    requestUpdate();
    // Send an update to the server every SEND_UPDATE_INTERVAL seconds
    setInterval(sendUpdate, SEND_UPDATE_INTERVAL*1000);
    // Refresh the page periodically if the user is idle
    syncTimer();
  }
})();
