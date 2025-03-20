#!/bin/bash

# This script is designed to first setup the a particular Node environment
# and then execute particular node scripts

# use NVM to get latest node
export NVM_DIR=$HOME/.nvm;
source $NVM_DIR/nvm.sh;

# Change to the current location
cd "$(dirname "$0")"

# Check if the correct number of arguments is provided
if [ "$#" -ne 1 ]; then
    echo "Usage: $0 <node_script>"
    exit 1
fi

# Assign the argument to a variable
node_script="$1"

git pull

# Run a simple update to update any scripts from the interface
if [ "$1" == "update" ]; then
  if [[ -n $(git status -s ../docs/inventory_updates_log.csv) ]]; then
    git add ../docs/inventory_updates_log.csv
    git commit -m "Updating inventory_updates_log"
    git push
    echo "Changes pushed to GitHub."
  else
    echo "No changes in data files."
  fi
  exit 0
fi

# Check if the Node.js script exists
if [ ! -f "$node_script" ]; then
    echo "Error: Node.js script not found: $node_script"
    exit 1
fi

# Execute the Node.js script
node "$node_script" >> output.log 2>&1

# Run github push when subscriptions file is run...
echo $1
if [ "$1" == "exportPricelistForViewing.js" ]; then
  if [[ -n $(git status -s ../docs/masterPriceList.xlsx) ]]; then
    git add ../docs/masterPriceList.xlsx
    git commit -m "Updating masterPriceList"
    git push
    echo "Changes pushed to GitHub."
  else
    echo "No changes in data files."
  fi
fi

