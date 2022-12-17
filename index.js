import  express, { json, response }  from "express";
import morgan, { token } from "morgan";
import {Server as socketServer} from 'socket.io';
import http, { ClientRequest } from 'http'
import cors from 'cors';
var RuleEngine = require("node-rules");


//Configuraciones del server
const app = express()
const server = http.createServer(app);
const io = new socketServer(server, {
  cors: '*'
});

//Para abortar fetch requests
const controller = new AbortController();
const signal = controller.signal;


//Middleware
app.use(cors());
app.use(morgan("dev"));

//Array of clients JSON
var clients = []

//Inicializar Rule Engine
var R = new RuleEngine();
//Aquí se tiene que hacer una función que añada las reglas desde la BD


io.on("connection",  (socket) => {
    
    //console.log(clients);
  socket.on("CONNECT", async (jsonCONNECT) => {
    let returnCode

    //CONSULTA A LA BD CONSULTANDO EL ID DE USUARIO Y CONTRASEÑA   

    const res = await fetch("http://localhost:3000/users/" + jsonCONNECT['IDUser']);
          if(res.status == 500){
            returnCode = 1;
          }else if(res.status == 202){
            returnCode = 2;
          }else{
            //Recibir de la API  Json {returncode, [{IDRoom, [{IDDevice, Status, Value*}]]}
            returnCode = 0;
          }
          let jsonCONNACK = {
              returnCode
              //Agregar Json
          }
          io.to(socket.id).emit('CONNACK',jsonCONNACK)
  });

  socket.on("SUBSCRIBE", async(jsonSUBSCRIBE) => {
    let returnCode, topic;
    topic = jsonPUBLISH['topic'];
    const res = await fetch("http://localhost:3000/topics/" + topic.replaceAll('/', "-"))
      if (res.status == 500) {
          returnCode = 1;
      } else if (res.status == 202) {
          returnCode = 2
      } else {
        const json = await res.json();
        returnCode = 0;

        const req = await fetch("http://localhost:3000/subscribers/add/", {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            device: jsonSUBSCRIBE['clientID'],
            topic: topic.replaceAll('/', "-")
          })
        })
      }
      let jsonSUBACK = {
        "returnCode": returnCode
      }
      
      io.to(socket.id).emit('SUBACK', jsonSUBACK);
      //Aquí se almacena la suscripción en el log_devices
  });

  
});

//Inicia el server
server.listen(4000)
console.log('Server started in port 4000')