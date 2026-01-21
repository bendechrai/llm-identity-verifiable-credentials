#!/bin/bash
set -e

# Drop to ralph user and execute command
exec gosu ralph "$@"
