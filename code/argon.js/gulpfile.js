'use strict'

var gulp = require('gulp')
var merge = require('merge-stream')
var webpack = require('webpack')
var WebpackDevServer = require('webpack-dev-server')
var argv = require('yargs').alias('p', 'production').argv
var exec = require('child_process').exec
var ghPages = require('gulp-gh-pages')
var fs = require('fs')
var path = require('path')
var express = require('express')
var serveIndex = require('serve-index')
var spawn = require('child_process').spawn
var del = require('del')

// Load gulp plugins
var $ = require('gulp-load-plugins')()

// Clean
gulp.task('clean', function (cb) {
  del('dist/*.js', function(err, paths) {
    cb(err)
  })
})

// Build
gulp.task('build', ['clean'], function() {
  // run webpack
  return gulp.src('')
    .pipe($.webpack(require('./webpack.config')))
    .pipe(gulp.dest('dist'))
})

gulp.task('webpack-dev-server', function(cb) {
  var port = 9090

  var config = Object.create(require('./webpack.config'))
  config.devTool = '#cheap-module-eval-source-map'
  var compiler = webpack(config)
  compiler.watch({},
    function(err, stats) {
      if(err) throw new $.util.PluginError( 'webpack-dev-server', err);
      $.util.log("[webpack-dev-server]", stats.toString({
        colors: true,
        chunks: false
      }))
    }
  );

  var testConfig = {
    entry: "mocha!./test/test.js",
    output: {
      path: __dirname,
      filename: 'testBundle.js'
    },
    devTool: '#cheap-module-eval-source-map'
  }

  // TODO: var compiler = webpack([testConfig, config])

  var testCompiler = webpack(testConfig)
  var server = new WebpackDevServer(testCompiler, {
    stats: {
      colors: true,
      chunks: false
    },
    contentBase: false, // needs to be false to configure the routing ourselves
    publicPath: '/build/'
  })

  compiler.plugin('done', function() {
    server.io.sockets.emit('ok')
  })

  server.app.all('*', function(req, res, next) {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "X-Requested-With");
    next()
  })

  server.app.get('*', express.static(__dirname + '/dist'), serveIndex(__dirname + '/dist', {view: 'details'}) )

  server.app.get('/test', function (req, res) {
    res.sendFile(__dirname + '/test/test.html')
  })

  server.app.get('/dev', function (req, res) {
    res.sendFile(__dirname + '/dev.html')
  })

  server.listen(port, function(err) {
    if(err) throw new $.util.PluginError('webpack-dev-server', err)
    $.util.log('[webpack-dev-server]', 'http://localhost:'+port+'/webpack-dev-server/dev/')
    spawn('open', ['http://localhost:'+port+'/webpack-dev-server/dev/']);
  })

})

// for local development w/ argon-browser-ui repo...
gulp.task('copyToOtherArgonRepos', function(cb) {
  // copy the build into varous argon repos (should be siblings to this repo)
  // TODO: check if the repos are actually there,
  // and only copy into the ones that are...
  return gulp.src('dist/argonManager.js')
    .pipe(gulp.dest('../argon-ui/vendor'))
})

// Watch
gulp.task('watchThenCopy', function () {
  return gulp.watch('dist/*.js', ['copyToOtherArgonRepos'])
    .on('error', function(error) {
      $.util.log("[watch]", error)
    })
})

// Dev
gulp.task('dev', ['webpack-dev-server' , 'watchThenCopy'])

// Default task
gulp.task('default', ['build'])


/**
 * Semver tasks
 */

// Bump major
gulp.task('bump-major', function(){
  gulp.src('./package.json')
  .pipe($.bump({type:'major'}))
  .pipe(gulp.dest('./'));
});

// Bump minor
gulp.task('bump-minor', function(){
  gulp.src('./package.json')
  .pipe($.bump({type:'minor'}))
  .pipe(gulp.dest('./'));
});

// Bump patch
gulp.task('bump', function(){
  gulp.src('./package.json')
  .pipe($.bump())
  .pipe(gulp.dest('./'));
});


/**
 * Documentation tasks
 */


gulp.task('jsdoc', function(cb){
  exec('./node_modules/.bin/jsdoc src/ -r -t ./node_modules/ink-docstrap/template -c ./node_modules/jsdoc/conf.json -d docs', function (err, stdout, stderr) {
    $.util.log(stdout);
    if (err) $.util.log($.util.colors.red(stderr), err.message)
    cb(err);
  });
});

// gulp.task('yuidoc', function(cb){
//   exec('./node_modules/.bin/yuidoc src/ -C -o docs', function (err, stdout, stderr) {
//     $.util.log(stdout);
//     if (err) $.util.log($.util.colors.red(stderr), err.message)
//     cb(err);
//   });
// });

gulp.task('yuidoc', function(cb){
  exec('./node_modules/.bin/yuidoc src/ -C -t ./node_modules/yuidoc-bootstrap-theme -H ./node_modules/yuidoc-bootstrap-theme/helpers/helpers.js -o docs', function (err, stdout, stderr) {
    $.util.log(stdout);
    if (err) $.util.log($.util.colors.red(stderr), err.message)
    cb(err);
  });
});

gulp.task('docs', ['yuidoc'])

gulp.task('push-docs', ['docs'], function() {
  return gulp.src("./docs/**/*")
          .pipe(ghPages())
})
