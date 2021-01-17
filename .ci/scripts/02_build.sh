#!/bin/bash

npm config set user 0
npm config set unsafe-perm true

mkdir dist

cd frontend
npm ci
npm run build
cd ..

npm ci
npm run build

cp -r node_modules dist