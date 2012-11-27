#!/usr/bin/env python
# Copyright (c) 2012 The Chromium Authors. All rights reserved.
# Use of this source code is governed by a BSD-style license that can be
# found in the LICENSE file.

"""Basic script providing a shared storage service for the WebExposed Chrome
extension. The JSON format for the state of a single bug is as follows:

{
  "12345": {
    "priority": "normal",     // one of: important, normal, hidden.
    "trackingBugId": 23456,   // Id of the associated Chromium bug.
    "comments": "Hello!"      // Comments contained for this bug.
  }
}

Submitting a GET request to /state will return a JSON object with all bugs
that have been triaged.

Submitting a POST request to /update, providing an object similar to the
one above, will update the state of a single bug."""

import Bug
import json
import os
import webapp2
import sys

# Which file is used to store the bug update password?
PASSWORD_FILE = os.path.join(os.path.dirname(__file__), "password.txt")

# The password required for updating bug statuses. Since we can't rely on global
# variables, provide a helper function that can read this value. This could be
# implemented in memory cache as well.
def GetBugUpdatePassword():
  assert os.path.exists(PASSWORD_FILE), 'The password file needs to exist.'
  with open(PASSWORD_FILE) as file:
    return file.read().strip()

  assert false, 'Could not open the password file for reading.'
  return ''

class EntryPage(webapp2.RequestHandler):
  def get(self):
    self.response.headers['Content-Type'] = 'text/plain'
    self.response.out.write('Nothing to see here, move along...')

class RequestStateHandler(webapp2.RequestHandler):
  """Handler for retrieving the full stored bug state. The output will be JSON
  with an object for each bug that has entered state."""
  def get(self):
    self.response.headers['Content-Type'] = 'text/plain'
    skip_hidden_bug_data = self.request.get('shbd', '1')

    bug_output_list = {'_hidden': []}
    bug_list = Bug.Bug.List()

    # Compose the output list for all the bugs.
    for bug in bug_list:
      # Don't send a full object if we're not interested in it.
      if skip_hidden_bug_data == '1' and bug.priority == 'hidden':
        bug_output_list['_hidden'].append(bug.bug_id)
        continue

      bug_output_list[bug.bug_id] = {
        "priority": bug.priority,
        "trackingBugId": bug.tracking_bug_id,
        "comments": bug.comments
      }

    # Output the composed list as JSON.
    self.response.out.write(json.dumps(bug_output_list))

class RequestUpdateHandler(webapp2.RequestHandler):
  """Handler for updating the state of a single bug. One JSON object must be
  supplied in the "update" field of the POST request containing the information
  for just a single bug. The "password" request field must also be set."""
  def post(self):
    self.response.headers['Content-Type'] = 'text/plain'
    if GetBugUpdatePassword() != self.request.get('password'):
      self.response.out.write('NO ACCESS')
      return

    data = json.loads(self.request.get('data', '{}'))
    if len(data) == 0:
      self.response.out.write('NO DATA')
      return

    # Iterate over all bugs in the provided update.
    update_count = 0
    for bug_id in data:
      if not isinstance(bug_id, basestring) or bug_id.isnumeric() == False:
        continue

      # And update all the data we've received.
      bug = Bug.Bug.OpenOrCreate(int(bug_id))
      if 'priority' in data[bug_id]:
        bug.priority = data[bug_id]['priority']
      if 'trackingBugId' in data[bug_id]:
        bug.tracking_bug_id = data[bug_id]['trackingBugId']
      if 'comments' in data[bug_id]:
        bug.comments = data[bug_id]['comments']

      update_count += 1
      bug.put()

    self.response.out.write('UPDATED %d BUGS' % update_count)

def InitializeWebExposedService():
  return webapp2.WSGIApplication([
    ('/', EntryPage),
    ('/state', RequestStateHandler),
    ('/update', RequestUpdateHandler)], debug=True)

app = InitializeWebExposedService()
