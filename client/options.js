function saveSecretWord() {
  // Get secret word from the textbox.
  var secretword = document.getElementById('secretword').value;
  // Check that there's a word there.
  if (!secretword) {
    alert('Error: No value specified');
    return;
  }

  // Save it using the Chrome extension storage API.
  chrome.storage.local.set({'secretword': secretword}, function() {
    // Notify that we saved.
    alert('Secret word saved!');
  });
}

window.onload = function() {
  // Call the saveSecretWord function when the user clicks the Save button
  document.getElementById('btnSaveSecretWord')
      .addEventListener('click',saveSecretWord);
}
