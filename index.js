var express = require('express');
var path = require('path');
var favicon = require('serve-favicon');
var logger = require('morgan');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');

var routes = require('./routes/index');
var users = require('./routes/users');
var message = require('./routes/msgToAll');

var channels = [];
var app = express();
var server = require('http').createServer(app);
var io = require('socket.io')(server);


// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'jade');

// uncomment after placing your favicon in /public
//app.use(favicon(path.join(__dirname, 'public', 'favicon.ico')));
app.use(function(req, res, next){
  res.io = io;
  // io.on('create', (msg) => {
  //   console.log('user created', msg);
  //   // res.send('respond with a resource...'+ msg);  
  // });
  next();
});
app.use(logger('dev'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

app.use('/', routes);
app.use('/users', users);
app.use('/message', message);

// catch 404 and forward to error handler
app.use(function(req, res, next) {
  var err = new Error('Not Found');
  err.status = 404;
  next(err);
});

// error handlers

// development error handler
// will print stacktrace
if (app.get('env') === 'development') {
  app.use(function(err, req, res, next) {
    res.status(err.status || 500);
    res.render('error', {
      message: err.message,
      error: err
    });
  });
}

// production error handler
// no stacktraces leaked to user
app.use(function(err, req, res, next) {
  res.status(err.status || 500);
  res.render('error', {
    message: err.message,
    error: {}
  });
});

server.listen(3000, function () {
  console.log('===server is listening=====');
});

io.on('connection', function (socket) {
  console.log('server connected');

  socket.on('create', function(room) {
    console.log('hello ', room);
    socket.join(room.userId);
    channels.push(room);
    socket.broadcast.emit('new_user', room.username + ' has joined with userId..'+ room.userId)
  });

  socket.on('message', function(msg) {
    console.log('hello ', msg);
    // socket.join(room.userId);
    // channels.push(room);
    socket.broadcast.emit('sendMsg', msg.userId + ' has send a message: ==='+ msg.message)
  });

});



module.exports = {app: app, server: server};
