#1/usr/bin/env bash
set -euo pipefail

# Credit to http://stackoverflow.com/a/246128/424301
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

cd "$DIR/../src/"
BUCKET=$(aws s3 ls | awk '/secure-serverless-deployments/{print $3}')
sam validate
sam package --s3-bucket "$BUCKET"
sam deploy --stack-name CustomizeUnicorns --config-env dev 
