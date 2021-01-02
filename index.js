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
const redis = require("redis");
const redisScan = require('redisscan');
const { parse } = require('path');

var channels = [];
var app = express();
var server = require('http').createServer(app);
var io = require('socket.io')(server);
var port = env.port ? env.port : 443;
var port_redis = env.REDIS_PORT ? env.REDIS_PORT : 6379;
const redisClient = redis.createClient(port_redis);

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

let messageQueue = [];
setInterval(async() => {
  console.log('===== set interval =====');
  // messageQueue = await getMessageQueue();
  redisClient.get('messageQueue', (err, data) => {
    console.log('===messageQueue in ser interval===', data);

    if(data) {
      let parseData = JSON.parse(data);
      // return parseData;
      messageQueue = parseData;
    console.log("***messageQueue?****&",messageQueue);
  
    
    }
    redisClient.keys('usr:*', function (err, keys) {
      if (err) return console.log(err);
      
      for(let key of keys) {
        console.log(key);
        let usrSockets = [];
        redisClient.get(key, async(err, data) => {
          console.log('===##data usr @@====', data);
          if(data) {
            let parsedData = JSON.parse(data);
            usrSockets = parsedData.sockets;
            // console.log('===###usrSockets###===', usrSockets);
            for(let socket of usrSockets) {
              // console.log('===socket===', socket);
              let mid =  Date.now() + '-' + socket.id;
              
              let payloadObj = {
                message: 'test message to ' + socket.username + ':: socketId- ' + socket.id + ' at ' +  Date(),
                username: socket.username,
                mid: mid
              };
              let msgObject = {
                'mid': mid,
                'uid': key,
                'sid': socket.id,
                'payload': payloadObj,
                'dateSent': Date.now()
              };
              messageQueue.push(msgObject);
              // console.log('===messageQueue===', messageQueue);
              redisClient.setex('messageQueue', 3600, JSON.stringify(messageQueue));

              // send test payload 
              // and on call back delete it from message queue
              io.to(socket.id).emit('testPayload', payloadObj); // => { //, (callbackData) => {
              //   console.log('===callbackData===', callbackData);
              //   let mid = callbackData.mid;
              //   messageQueue = getMessageQueue();
              //   messageQueue = messageQueue.filter((msg) => {
              //     return msg.mid !== mid;
              //   })
              // });
              // =============================================
            }
          }
        });
        // console.log('===usrSockets===', usrSockets);
      }
  });

  });

}, 20000);  


io.on('connection', async (socket) => {
  console.log('server connected');
  redisClient.flushdb( function (err, succeeded) {
    console.log("@@@redis cache cleared@@@",succeeded); // will be true if successfull
  });
  connectToDatabase();
  

  // check pending messages in queue 
  // and resend them
  // setInterval(async() => {
  //   console.log('===== resend set interval =====');
  //   // messageQueue = await getMessageQueue();
  //   await redisClient.get('messageQueue', (err, data) => {
  //     console.log('===messageQueue in resend interval===', data);
  //     let messageQueue  =  [];
  //     if(data) {
  //       let parseData = JSON.parse(data);
  //       messageQueue = parseData;
  //       for(let msg of messageQueue) {
  //         io.to(msg.sid).emit('testPayload', msg.payloadObj); // => { //, (callbackData) => {
  //       }
  //     }
  //   });
  
  // }, 20000);
  // // ==============================

  socket.on('create', async(data) => {
    console.log('==== hello create socket hit ====@@', data);
    let username = data.username;
    // console.log('===username===', username);
    // await updateUser(username, socket.id);
    let userId = data.id; // Buffer.from(username).toString('base64');
    let usrSockets = [];

    await redisClient.get(userId, async(err, data) => {
      // console.log('===redisClient.get userId===', userId);
      console.log('===redisClient.get user data===', data);
      

      if (data) {
        console.log('&&&data.sockets###', data.sockets);
        let p = JSON.parse(data);
        usrSockets = p.sockets;
      }
      usrSockets.push({
        "id": socket.id,
        "state": "live",
        "connectedOn": Date.now(),
        "username": username
        // "lastPingedOn": 44243243223,
        // "lastPongReceived": 43423432423894
      })
      console.log('@@@usrSockets@@@', usrSockets);
      let socketObj = {
        sockets: usrSockets
      };
      // console.log('===')
      redisClient.setex(userId, 3600, JSON.stringify(socketObj))
    }); 

    // after socket create send test payload
    
    // =====================================
  });

  
  // socket.on('message', (msg) => {
  //   // console.log('hello ', msg);
  //   // socket.join(room.userId);
  //   // channels.push(room);
  //   socket.broadcast.emit('sendMsg', msg.userId + ' has send a message: ==='+ msg.message)
  // });

  socket.on('socket_disconnected', async(data) => {

    console.log('@@#### socket_disconnected called @@@@');
    let username = data.username;
    let userId = data.id; // Buffer.from(username).toString('base64');
    // await updateUser(userId, username, socket.id, 'disconnect');
  });

  socket.on('disconnect', (data) => {
    console.log('disconnect data===@@@', data);
    console.log('@@@socket@@@',socket);
    // console.log('===io.sockets@@@', io.sockets);
    // console.log('===io.sockets clients@@@', io.sockets.clients);
    // console.log('===room of a socket===@@@', io.sockets.adapter.sids[socket.id]);
    // console.log('#######disconnect server event @@@@@@@', socket.id);
    // console.log('==@@socket.adapter.sids@@==',socket.adapter.sids);
    // console.log('===@@socket.adapter.rooms===@@', socket.adapter.rooms);
    // console.log('===socket.rooms@####',socket.rooms);


    console.log('@@io.sockets.adapter.rooms@@@', io.sockets.adapter.rooms);
    console.log('===io.sockets.adapter.sids[socket.id]&&9', io.sockets.adapter.sids[socket.id]);
    // var currentRoom = Object.keys(socket.adapter.sids[socket.id]).filter(item => item!=socket.id);

  });
  
  socket.on('testPayload_received', async(data) => {
    // console.log('====test payload received=====', data);
    // console.log('===callbackData===', data);
    console.log('===message id of received message===', data.mid );
    let mid = data.mid;
    let msgque=[];
     redisClient.get('messageQueue', async(err, data) => {
      console.log('===messageQueue in ser interval===', data);

      if(data) {
        let parseData = JSON.parse(data);
        // return parseData;
        msgque = parseData;
        // msgque = msgque.filter((msg) => {
        //                 return msg.mid !== mid;
        // });
        // msgque.splice(msgque.findIndex(a => a.mid === mid) , 1)
        let afterDeleteQue = [];
        for(let msg of msgque) {
          console.log('msg.mid:: '+msg.mid+"*** mid::"+mid);
          if(msg.mid !== mid) {
            afterDeleteQue.push(msg)
          }
        }
        console.log('###===@@@message queue after delete ===@@@###', afterDeleteQue);
        redisClient.setex('messageQueue', 3600, JSON.stringify(afterDeleteQue));

      }
    });
  });

});

const updateQue =  async() =>{
  
}
// const getMessageQueue = async() => {
//   console.log('===@@@@@getMessageQueue@@@@');
//   // Get message queue
//   // let messageQueue = [];
//   let messageQueue = await redisClient.get('messageQueue', (err, data) => {
//     if(data) {
//       console.log('===data===', data);
//       let parseData = JSON.parse(data);
//       return parseData;
//       // if(parseData) messageQueue = parseData;
//       // console.log('===@@@messageQueue===@@@', messageQueue);
//       // return messageQueue;
//     }
//     if(err) {
//       console.log('===err===', err);
//       return [];
//     }
//   });
//   return messageQueue;
//   // });
//   // =================
// }

// const updateUser = async(userId, username, socketId = 0, op = 'connect', msgReceivedCounter = 0) => {
//   // console.log('#### update user counter @@@@@', msgReceivedCounter)
//   // console.log('in update user'+ 'userId:: '+userId+'socketId:: '+ socketId);
//   console.log('===op===', op);
//   // console.log('===@@@socketId@@@###', socketId);
//   let filterParams = {userId: userId};
  
//   let userdetails = await findOne(filterParams, userModel);
//   // console.log('userdetails:: ', userdetails);
//   let socketIdArr =  (userdetails !== null) ? userdetails.socketId: [];
//   let msgSentCounter;
//   // let msgSentCounter = (userdetails !== null && userdetails.msgSentCounter)? userdetails.msgSentCounter : 0;
//   console.log('%%@@msgSentCounter@@', msgSentCounter)
//   // let msgReceivedCounter = (userdetails !== null && userdetails.msgReceivedCounter)? userdetails.msgReceivedCounter: 0;
//   // msgSentCounter++;

//   if (op === 'msgReceivedCounter') {
//     for (let socket of socketIdArr) {
//         if(socket.id === socketId) {
//           // console.log('===match found===@@@@@');
//           let counter = socket.msgReceivedCounter ? socket.msgReceivedCounter : 1;
//           // console.log('===##msgReceivedCounter###', counter);
//           counter = counter + 1
//           socket.msgReceivedCounter =  msgReceivedCounter;
//         }
//       }
//   }


//   if(socketId != 0) {
//     if(op === 'connect') {
//       socketIdArr.push({id: socketId, state: 'connected', msgReceivedCounter: 0});
//     } else if(op === 'disconnect') {
//       for (let socket of socketIdArr) {
//         if(socket.id === socketId) {
//           socket.state =  'disconnected'
//         }
//       }
//     } 
//   } else {
//     // if(op === 'msgSentCounter') {
//     //   msgSentCounter++;
//     // } else if(op === 'msgReceivedCounter') {
//       // msgReceivedCounter++;
//     // }
//   }
  
  
//   if(channels.length == 0) {
//     msgSentCounter = 0;
//     channels.push({userId: userId,
//        username: username, 
//        socketId: socketIdArr, 
//        msgSentCounter: 0, 
//       //  msgReceivedCounter: msgReceivedCounter
//       });
//   } else {
//     let userIdFound = 0;
//     for(let chan of channels) {
//       if (chan.userId === userId) {
//         chan.socketId = socketIdArr;
//         userIdFound = 1;
//         msgSentCounter = chan.msgSentCounter;
//         // chan.msgSentCounter = msgSentCounter;
//       }
//     }
//     console.log('===userIdFound===', userIdFound);
//     if(userIdFound === 0) {
//       msgSentCounter = 0;
//       channels.push({userId: userId, 
//         username: username, 
//         socketId: socketIdArr,
//         msgSentCounter: 0, 
//         // msgReceivedCounter: msgReceivedCounter
//       });
//     }
//   }
//   let newUser = {
//     user: username,
//     id: userId,
//     socketId: socketIdArr,
//     msgSentCounter: msgSentCounter,
//     // msgReceivedCounter: msgReceivedCounter
//   };
//   console.log('===new user===', newUser);

//   await upsert(filterParams, newUser, userModel);
//   // console.log('===channels after connections =====', channels); 
// }
module.exports = {app: app, server: server};
