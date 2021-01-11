const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const path = require('path');
const webpack = require('webpack');

module.exports = {
  plugins: [new MiniCssExtractPlugin({
    filename: "styles.css"
  })],
  mode: 'development',
  entry: './src/index.tsx',
  devtool: 'source-map',

  module: {
    rules: [
      {
        test: /\.less$/i,
        exclude: /node_modules/,
        enforce: 'pre',
        use: [
          MiniCssExtractPlugin.loader,
          {
            loader: "@teamsupercell/typings-for-css-modules-loader",
          },
          {
            loader: "css-loader",
            options: {
              esModule: true,
              modules: true
            }
          },
          "less-loader"
        ]
      },
      {
        test: /\.tsx?$/,
        use: 'ts-loader',
        exclude: /node_modules/,
      },
    ],
  },
  resolve: {
    extensions: ['.ts', '.tsx', '.js', '.less'],
    modules: ['node_modules', 'src'],
  },
  output: {
    filename: 'index.js',
    path: path.resolve(__dirname, 'dist'),
  },
  target: 'web',
};