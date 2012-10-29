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
  bug_id = db.IntegerProperty()
  priority = db.StringProperty(choices=set(["hidden","normal","important"]))
  tracking_bug_id = db.IntegerProperty()
  comments = db.StringProperty()

  @staticmethod
  def OpenOrCreate(bug_id):
    bug_query = db.GqlQuery('SELECT * FROM Bug WHERE bug_id = :1', bug_id)
    for bug in bug_query.run(limit=1):
      return bug

    return Bug(bug_id = bug_id, priority = 'normal', tracking_bug_id = -1,
        comments = '')

  @staticmethod
  def List():
    return db.GqlQuery('SELECT * FROM Bug ORDER BY bug_id DESC')
