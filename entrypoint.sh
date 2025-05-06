    #!/bin/sh
    set -e # Exit immediately if a command exits with a non-zero status.

    echo "Running Prisma migrations..."
    npx prisma migrate deploy

    echo "Starting the application..."
    # Execute the command passed as arguments to this script (which will be the Dockerfile's CMD)
    exec "$@"