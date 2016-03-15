var webpack = require('webpack')
var packageJSON = require('./package.json')
var path = require('path')

module.exports = {
  entry: {
    "argonManager": ["./src/argonManager"],
    "argon":   ["./src/argon"],
    "argon-three": "./src/argon-three",
    "argon-famous": "./src/argon-famous",
  },
  output: {
    path: __dirname + "/dist",
    filename: "[name].js",
    library: "Argon",
    libraryTarget: "umd"
  },
  externals: [
    {
      "argon": {
        root: "Argon",
        commonjs2: "./argon",
        commonjs: ["./argon", "Argon"],
        amd: "argon"
      },
      "external-three": {
        root: "THREE",
        commonjs2: "three"
      },
      "external-threestrap": {
        root: ["THREE","Bootstrap"],
        commonjs2: "threestrap"
      }
    }
  ],
  resolve: {
    root:  __dirname + "/vendor",
    modulesDirectories: ["node_modules"]
  },
  resolveLoader: {
    root: path.join(__dirname, "node_modules")
  },
  plugins: [
    new webpack.optimize.DedupePlugin(),
    new webpack.optimize.OccurenceOrderPlugin(),
    new webpack.DefinePlugin({
      VERSION: '"' + packageJSON.version + '"'
    }),
    new webpack.ContextReplacementPlugin(/.*$/, /a^/) // disallow dynamic requires
    // new webpack.BannerPlugin("'use strict'; // enable strict mode everywhere!!", {raw: true})
  ],
  module: {
    loaders: [
      {
        test: /\.js$/,
        include: [
          path.resolve(__dirname, "src"),
          path.resolve(__dirname, "test")
        ],
        loader: 'babel-loader?optional=runtime&loose=all'
      },
      { test: /\.json$/, loader: 'json' }
    ]
  },
  resolve: {
      extensions: ["", ".webpack.js", ".web.js", ".js"],
  },
}
