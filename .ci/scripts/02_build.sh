#!/bin/bash

mkdir dist

cd frontend
npm ci
npx webpack --env production
cd ..

npm ci
npx webpack --env production

cp -r node_modules dist