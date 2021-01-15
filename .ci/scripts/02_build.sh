#!/bin/bash

mkdir dist

cd frontend
npm ci
npm run build
cd ..

npm ci
npm run build

cp -r node_modules dist