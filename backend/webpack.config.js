const path = require('path');
const webpack = require('webpack');
const webpackNodeExternals = require('webpack-node-externals');

module.exports = {
  mode: 'production',
  entry: {
    index: './src/main.ts',
    "hook-pre-receive": './src/hooks/pre-receive.ts',
    "hook-update": './src/hooks/update.ts',
  },
  plugins: [],

  module: {
    rules: [
      {
        test: /\.ts$/,
        use: 'ts-loader',
        exclude: /node_modules/,
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