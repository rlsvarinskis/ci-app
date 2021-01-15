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
cp ../profiles/default.jpeg profiles

cd ../..
mv backend/dist ci-app
zip -r ../output/ci-app.zip ci-app