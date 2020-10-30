const dotenv = require('dotenv');
dotenv.config();
var connectToDatabase = require('./configs/db.js');
const { aggregateWithGroupBy, findOne, updateAll, create, upsert} = require('./services/database.js');
const userModel = require('./models/user.js');
var express = require('express');
var path = require('path');
var favicon = require('serve-favicon');
var logger = require('morgan');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');

var routes = require('./routes/index');
var users = require('./routes/users');
var message = require('./routes/msgToAll');
const { env } = require('process');

var channels = [];
var app = express();
var server = require('http').createServer(app);
var io = require('socket.io')(server);
var port = env.port ? env.port : 443;

console.log('===port====', port);


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

server.listen(port, function () {
  console.log('===server is listening=====');
 
});

setInterval(() => {
  console.log('===channels===', channels);
  for(let chan of channels) {
    if (chan.username !== undefined)
      io.to(chan.userId).emit('testPayload', 'test message to '+ chan.username +' at ' + Date());
    else
      io.sockets.emit('testPayload', 'test message outer');
  }

}, 10000);

io.on('connection', function (socket) {
  console.log('server connected');
  connectToDatabase();

  socket.on('create', async(data) => {
    console.log('==== hello create socket hit ====@@', data);
    let username = data.username;
    console.log('===username===', username);
    // await updateUser(username, socket.id);
    let userId = Buffer.from(username).toString('base64');
    socket.join(userId);
    updateUser(userId, username, socket.id, 'connect');
  });

  socket.on('message', (msg) => {
    console.log('hello ', msg);
    // socket.join(room.userId);
    // channels.push(room);
    socket.broadcast.emit('sendMsg', msg.userId + ' has send a message: ==='+ msg.message)
  });

  socket.on('socket_disconnected', (data) => {
    let username = data.username;
    let userId = Buffer.from(username).toString('base64');
    updateUser(userId, username, socket.id, 'disconnect');
  });
  
});

const updateUser = async(userId, username, socketId, op = 'connect') => {
  console.log('in update user'+ 'userId:: '+userId+'socketId:: '+ socketId);
  console.log('===op===', op);
  // let userId = Buffer.from(username).toString('base64');
  let filterParams = {userId: userId};
  let userdetails = await findOne(filterParams, userModel);
  console.log('userdetails:: ', userdetails);
  let socketIdArr =  (userdetails !== null) ? userdetails.socketId: [];
  if(op === 'connect') {
    socketIdArr.push({id: socketId, state: 'connected'});
  } else if(op === 'disconnect') {
    for (let socket of socketIdArr) {
      if(socket.id === socketId) {
        socket.state =  'disconnected'
      }
    }
  }
  
  let newUser = {
    user: username,
    id: userId,
    socketId: socketIdArr
  };
  console.log('===new user===', newUser);

  await upsert(filterParams, newUser, userModel);
  if(channels.length == 0) {
    channels.push({userId: userId, username: username, socketId: socketIdArr});
  } else {
    let userIdFound = 0;
    for(let chan of channels) {
      if (chan.userId === userId) {
        chan.socketId = socketIdArr;
        userIdFound = 1;
      }
    }
    if(userIdFound == 0) {
      channels.push({userId: userId, username: username, socketId: socketIdArr});
    }
  }
  console.log('===channels after connections =====', channels);

  
}



module.exports = {app: app, server: server};
