#!/bin/bash

apt update && apt install nodejs npm zip
cd frontend
npm i
npm run build
cd ../backend

npm i
npm run build

cd dist
cp -r ../../frontend/dist/ frontend
mkdir profiles
cp ../res/default.jpeg profiles

cd ../..
cp -r backend/node_modules backend/dist/node_modules
mv backend/dist ci-app
zip -r ../output/ci-app.zip ci-app
