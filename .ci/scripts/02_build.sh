#!/bin/bash

mkdir dist
cd frontend
npm ci
npm run build
cd ..

npm ci
npm run build

mkdir profiles
cp res/default.jpeg dist/profiles

cp -r node_modules dist
mv dist ci-app
zip -r ../output/ci-app.zip ci-app
