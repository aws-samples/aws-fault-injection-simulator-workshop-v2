#!/bin/bash
# change directory to the folder with CloudFormation
cd ../cfn/

# Copy buildspec-build.yml to buildspec.yml
cp buildspec-build.yml buildspec.yml

# Create zip file containing buildspec.yml to build the workshop
zip build.zip buildspec.yml

# removing buildspec
rm -f buildspec.yml

# Copy buildspec-destroy.yml to buildspec.yml
cp buildspec-destroy.yml buildspec.yml

# Create zip file containing buildspec.yml to destroy the workshop
zip destroy.zip buildspec.yml

# removing buildspec
rm -f buildspec.yml
