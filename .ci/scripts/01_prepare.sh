#!/bin/sh

apt-get update && apt-get -y install nodejs npm zip
npm i -g n
n latest
