#!/bin/bash
# Runs after a merge lands on the Replit project: install, then apply migrations.
# Two things this must get right, both learned the hard way:
#   - `npm ci` needs package-lock.json, which this repo deliberately does not
#     track, so it fails outright. `npm install` is the supported install here.
#   - @workspace/db has no `push` script; the entry point is `migrate`.
set -e
npm install
npm run db:migrate
