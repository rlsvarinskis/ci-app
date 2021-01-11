#!/bin/bash

npm i
npm run build
mkdir dist/profiles
mv profiles/default.jpeg dist/profiles
mkdir dist/repo
mkdir dist/resources
mv dist ci-app
zip -r ../output/ci-app.zip ci-app