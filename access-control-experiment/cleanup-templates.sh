#!/bin/bash

# Check if a filename argument was provided
if [ $# -eq 0 ] 
  then
    echo "Usage: $0 <filename>"
    exit 1
fi

# Save the filename argument to a variable 
filename=$1

# Open the file 
while read line; do
  # Do something with $line 
  echo "========================================"
  echo "Deleting experiment id $line"
  echo "========================================"
  # Example print each line
  aws fis delete-experiment-template --id $line

done < "$filename"
