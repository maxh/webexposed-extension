# Copyright (c) 2012 The Chromium Authors. All rights reserved.
# Use of this source code is governed by a BSD-style license that can be
# found in the LICENSE file.

"""The Bug class provides the necessary operations to create, read and update
the bugs available in the storage. Basic usage:

# Open bug 12345, or create it if it doesn't exist.
bug = Bug.OpenOrCreate(12345);

# Update the comment and write it to the datastore.
bug.comments = "Hello, World!"
bug.put()

# Get a list of all created bugs.
bug_list = Bug.List()

The storage is provided by App Engine's High Replication Datastore (HRD)."""

from google.appengine.ext import db

class Bug(db.Model):
  """Contains the information associated with a single bug. A few static methods
  are provided for opening, creating or listing the stored bugs."""

  # Properties we store for each bug.
  bug_id = db.IntegerProperty(required=True)
  priority = db.StringProperty(required=True,
                               choices=set(["hidden","normal","important"]))
  tracking_bug_id = db.IntegerProperty()
  comments = db.StringProperty()

  def __init__(self, bug_id):
    super(Bug, self).__init__()
    self.bug_id = bug_id
    self.priority = "normal"
    self.tracking_bug_id = -1
    self.comments = ""

  @staticmethod
  def OpenOrCreate(bug_id):
    bug_list = db.GqlQuery('SELECT * FROM Bug WHERE bug_id = :1', bug_id)

    # If we were able to retrieve the bug from the database, return it.
    # Otherwise return a new Bug with the given Id.
    if bug_list.length() == 1:
      return bug_list[0]

    return Bug(bug_id)

  @staticmethod
  def List():
    return db.GqlQuery('SELECT * FROM Bug ORDER BY bug_id DESC')
