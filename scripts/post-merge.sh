#!/bin/bash
set -e
npm ci
npm run --workspace=@workspace/db push
