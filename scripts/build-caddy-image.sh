#!/bin/bash

# Build the custom Caddy image with certificate tools
docker build -t gredice-caddy-dev scripts/dev/

echo "Custom Caddy development image built successfully!"
echo "The image includes libnss3-tools for certificate management."