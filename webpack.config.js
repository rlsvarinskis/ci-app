const path = require('path');
const webpack = require('webpack');
const webpackNodeExternals = require('webpack-node-externals');
const CopyPlugin = require("copy-webpack-plugin");

module.exports = {
  mode: 'development',
  devtool: 'inline-source-map',
  entry: {
    index: './src/main.ts',
    "hooks/pre-receive": './src/hooks/pre-receive.ts',
    "hooks/update": './src/hooks/update.ts',
  },
  plugins: [new CopyPlugin({
    patterns: [
      {from: "res", to: "dist"}
    ]
  })],

  module: {
    rules: [
      {
        test: /\.ts$/,
        use: 'ts-loader',
        exclude: [
          /node_modules/,
          /frontend/,
          /dist/,
        ],
      }
    ]
  },
  resolve: {
    extensions: ['.ts', '.js'],
    modules: ['node_modules', 'src'],
  },
  output: {
    filename: '[name].js',
    path: path.resolve(__dirname, 'dist'),
  },
  externals: [webpackNodeExternals()],
  target: 'node',
};