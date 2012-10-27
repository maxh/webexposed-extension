#!/usr/bin/env python
# Copyright (c) 2012 The Chromium Authors. All rights reserved.
# Use of this source code is governed by a BSD-style license that can be
# found in the LICENSE file.

"""Basic script providing a shared storage service for the WebExposed Chrome
extension. The JSON format for the state of a single bug is as follows:

{
  "12345": {
    "priority": "normal",        // one of: important, normal, hidden.
    "tracking_bug_id": 23456,    // Id of the associated Chromium bug.
    "comments": "Hello!"         // Comments contained for this bug.
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

# The password required for updating bug statuses. Will be set in the
# InitializeWebExposedService() method.
bug_update_password = ""

class EntryPage(webapp2.RequestHandler):
  def get(self):
    self.response.headers['Content-Type'] = 'text/plain'
    self.response.out.write('Nothing to see here, move along...')

class RequestStateHandler(webapp2.RequestHandler):
  """Handler for retrieving the full stored bug state. The output will be JSON
  with an object for each bug that has entered state."""
  def get(self):
    self.response.headers['Content-Type'] = 'text/plain'

    bug_output_list = {}
    bug_list = Bug.Bug.List()

    # Compose the output list for all the bugs.
    for bug in bug_list:
      bug_output_list[bug.bug_id] = {
        "priority": bug.priority,
        "tracking_bug_id": bug.tracking_bug_id,
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
    if bug_update_password != self.request.get('password'):
      self.response.out.write('NO ACCESS')
      return

    # TODO: Implement parsing the request JSON
    self.response.out.write('NOT IMPLEMENTED')

def InitializeWebExposedService():
  if not os.path.exists('password.txt'):
    sys.exit('Unable to read the password.txt file.')

  with open('password.txt') as file:
    bug_update_password = file.read().strip()

  return webapp2.WSGIApplication([
    ('/', EntryPage),
    ('/state', RequestStateHandler),
    ('/update', RequestUpdateHandler)], debug=True)

app = InitializeWebExposedService()
