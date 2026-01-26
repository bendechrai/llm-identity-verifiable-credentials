#!/bin/bash
set -e

# If Docker socket exists, ensure ralph can access it
if [ -S /var/run/docker.sock ]; then
    DOCKER_GID=$(stat -c '%g' /var/run/docker.sock)
    if ! getent group "$DOCKER_GID" > /dev/null 2>&1; then
        groupadd -g "$DOCKER_GID" docker-host
    fi
    DOCKER_GROUP=$(getent group "$DOCKER_GID" | cut -d: -f1)
    usermod -aG "$DOCKER_GROUP" ralph
fi

# Drop to ralph user and execute command
exec gosu ralph "$@"
