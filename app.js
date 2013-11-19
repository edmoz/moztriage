#!/usr/bin/env node

var http = require('http');
var path = require('path');

var express = require('express');
var routes = require('./routes/index');

var app = express();
// all environments
app.set('port', process.env.PORT || 3000);
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'jade');
app.use(express.favicon());
app.use(express.logger('dev'));
app.use(express.json());
app.use(express.urlencoded());
app.use(express.methodOverride());
app.use(app.router);
app.use(express.static(path.join(__dirname, 'public')));
// development only
if ('development' === app.get('env')) {
  app.use(express.errorHandler());
  app.locals.pretty = true;
}
// routes
app.get('/', routes.index);
app.get('/triage', routes.index);
app.get('/triage/:org/:repo', routes.triage);
app.get('/cache/:org/:repo', routes.cache);

app.listen(app.get('port'), function () {
  console.log('Express server listening on port ' + app.get('port'));
});
