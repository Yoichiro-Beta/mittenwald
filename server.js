const { driver } = require('@rocket.chat/sdk');
const { api } = require('@rocket.chat/sdk');
const respmap  = require('./reply');
const elevatedUserMap  = require('./users');
const request = require('postman-request');
const http = require('http');


// Environment Setup
const HOST = 'http://192.168.1.129:3000';
const USER = 'nodebot';
const PASS = '12345678';
const BOTNAME = 'nodebot';
const SSL = false;
const ROOMS = ['test-demo'];
const BOTRELEASE = "Mittenwald";
const WEBHOOKPORT = 8080;
var myUserId;

// Bot configuration
const runbot = async () => {
    const conn = await driver.connect({ host: HOST, useSsl: SSL })
    myUserId = await driver.login({ username: USER, password: PASS });
    const roomsJoined = await driver.joinRooms( ROOMS );
    console.log('joined rooms');

    const subscribed = await driver.subscribeToMessages();
    console.log('subscribed');

    const msgloop = await driver.reactToMessages( processMessages );
    console.log('connected and waiting for messages');

    const sent = await driver.sendToRoom( BOTNAME + ' is listening ...', ROOMS[0]);
    console.log('Greeting message sent');
}

// Process messages
const processMessages = async(err, message, messageOptions) => {
    var msg = message[0];
    console.log("****** processMessages "+msg+" - "+err);
if (!err) {
    // empty user or message originates from this bot, ignore this message and stop processing
    if ((msg.u ==null)||(msg.u._id === myUserId)) return;

    // Check if message is posted in the room, which the bot observes
    const roomname = await driver.getRoomName(msg.rid);
    if(roomname!= ROOMS[0]){
        //wrong room, ignore
        return;
    }

    // If the message is directly addressed to the bot, execute some actions
    if(msg.msg.startsWith("@"+BOTNAME)){
        // get the remianing contect of the message
        msg.msg = msg.msg.substring(("@"+BOTNAME).length+1,msg.msg.length);
        console.log("****** direct message: "+msg.msg);
        //console.log("--------- thread: "+msg.tmid)
        //console.log('got message ' + msg.msg +" in "+roomname)

        var response ="";

        //Check if user has elevated rights
        if(msg.u.username in elevatedUserMap){
            var cmd = "do:"; // do: customerID title or summary
            if(msg.msg.startsWith(cmd)){
                msg.msg = msg.msg.substring(cmd.length+1,msg.msg.length);
                response = await handleCmdDo(msg);
            }
        }
        // Process requests which do not require elevated rights
        if(msg.msg.trim() == "help"){
            response = "Available commands:\n*help* : this message\n*do:* _id_ _text_ : do something\n*about* : a simple release test";
        }
        if(msg.msg.trim() == "about"){
            response = "nodebot release "+BOTRELEASE;
        }
        // if no response was fopund, send info message
        if(response == ""){
            response = "No matching command found.\nUse \"@"+BOTNAME+" help\" for a list of commands";
        }

        // prepare response
        var omsg = driver.prepareMessage(response, msg.rid);
        omsg.tmid=msg.tmid;
        const sentmsg = await driver.sendMessage(omsg);
        
        return;
    }
// Generic
    console.log('****** got message ' + msg.msg +" in "+roomname)
    var response;
    if (msg.msg in respmap) {
        response = respmap[msg.msg];
    }else{
        return;
    }
    const sentmsg = await driver.sendToRoomId(response, msg.rid)
    }
}

async function handleCmdDo(msg){
    var rs = await rocketchatAPIPOST("/api/v1/login", JSON.stringify({user:USER,password:PASS }));
    var jrs = JSON.parse(rs);
    const apiuid = jrs.data.userId;
    const  apiauth = jrs.data.authToken;
    //console.log("User-Token: "+apiuid);
    //console.log("AUTH-Token: "+apiauth);
    // Get threads
    rs = await rocketchatAPIGET("/api/v1/chat.getThreadMessages?tmid="+msg.tmid+"&count=0", {'X-Auth-Token':apiauth,'X-User-Id':apiuid,'Content-type':'application/json' });
    jrs = JSON.parse(rs);
    var l = Object.keys(jrs.messages).length
    //console.log("size: "+ l);
    var result = "";

    for(i = 0; i< l; i++){
        result += jrs.messages[i].u.username+": "+jrs.messages[i].msg+"\n";
        //console.log(jrs.messages[i].msg);
    }
    console.log(result);
    return "I did";
}
// now to program the "usual" way
// all you need to do is use async functions and await
// for functions returning promises
async function rocketchatAPIPOST(apicall, params) {
    try {
        const html= await downloadPagePOST(HOST+apicall, params)
        return html;
    } catch (error) {
        console.error('ERROR:');
        console.error(error);
    }
}

// now to program the "usual" way
// all you need to do is use async functions and await
// for functions returning promises
async function rocketchatAPIGET(apicall, params) {
    try {
        const html = await downloadPageGET(HOST+apicall, params)
        return html;
    } catch (error) {
        console.error('ERROR:');
        console.error(error);
    }
}

// wrap a request in an promise
function downloadPagePOST(apicall, params) {
    return new Promise((resolve, reject) => {
        //console.log("****** HOST+apicall: "+HOST+apicall);
        request.post({url: apicall, body: params}, (error, response, body) => {
            if (error) reject(error);
            if (response.statusCode != 200) {
                reject('Invalid status code <' + response.statusCode + '>');
            }
            resolve(body);
        });
    });
}

// wrap a request in an promise
function downloadPageGET(apicall, params) {
    return new Promise((resolve, reject) => {
        console.log("****** apicall: "+apicall);
        request.get({url: apicall, headers: params}, (error, response, body) => {
            if (error) reject(error);
            if (response.statusCode != 200) {
                reject('Invalid status code <' + response.statusCode + '>');
            }
            resolve(body);
        });
    });
}


http.createServer(function (req, res) {
  res.writeHead(200, {'Content-Type': 'text/plain'});
  res.write('Hello World!');
  res.end();
  console.log("============ Received request");
}).listen(WEBHOOKPORT);

runbot()

console.log("**** FINISHED ****");
