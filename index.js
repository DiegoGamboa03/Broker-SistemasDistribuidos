import  express, { json, response }  from "express";
import morgan, { token } from "morgan";
import {Server as socketServer} from 'socket.io';
import http, { ClientRequest } from 'http'
import cors from 'cors';
import checkRule from "./rules.js";

//Client Array
var clients = []

//Configuraciones del server
const app = express()
const server = http.createServer(app);
const io = new socketServer(server, {
  cors: '*'
});

//Middleware
app.use(cors());
app.use(morgan("dev"));

io.on("connection",  (socket) => {
  console.log(socket.id)
    
    //console.log(clients);
  socket.on("CONNECT", async (jsonCONNECT) => {
    let returnCode, jsonDevices;
    console.log('Connect iniciado')

    //CONSULTA A LA BD CONSULTANDO EL ID DE USUARIO Y CONTRASEÑA   

    const res = await fetch("http://localhost:3000/users/isUser/" + jsonCONNECT['user']+"/"+jsonCONNECT['password']);
          if(res.status == 500){
            returnCode = 1;
          }else if(res.status == 202){
            returnCode = 2;
          }else{
            //Recibir de la API  Json {returncode, [{IDRoom, [{IDDevice, Status, Value*}]]}
            console.log('Luego de verificar User')
            returnCode = 0;
            const res= await fetch("http://localhost:3000/utils/getStatus")//Recibe los datos del json de getStatus
            if(res.status == 500){
              returnCode = 1 ;
            } else if(res.status == 202){
              returnCode = 2;

            }else{
              jsonDevices = await res.json()
              returnCode = 0;
            }

            //Guardar usuario y socketID del cliente en el arreglo
          let jsonClient = {
            "clientUser": jsonCONNECT['user'],
            "socketID" : socket.id
          }
          clients.push(jsonClient);

          //Enviar dispositivos y status
         
          }
          let jsonCONNACK = {
              returnCode,
              jsonDevices
          }
          io.to(socket.id).emit('CONNACK',jsonCONNACK)
          console.log('CONNACK enviado')

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
            device: jsonSUBSCRIBE['deviceID'],
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

  socket.on("PUBLISH", async (jsonPUBLISH) => {
    
    let returnCode, topic, message;
    topic = jsonPUBLISH['topic'];
    message = jsonPUBLISH['message']

    const res = await fetch("http://localhost:3000/publishers/isPublisher/"+ jsonPUBLISH['deviceID'] + "/" + topic.replaceAll('/', "-")) 
    if(res.status == 500){
      return ;
    }else{
      const json = await res.json();
      if(json['isPublisher'] === 1){  
        const res = await fetch("http://localhost:3000/subscribers/listTopic/" + topic.replaceAll('/', "-"))
        if(res.status == 500){
          
          returnCode = 1;

        }else if(res.status == 202){
          
          returnCode = 2;

        }else{

          let jsonSubs = await res.json(); //Lista de subscriptores 
          returnCode = 0;
          

          //const jsonStatus = await res.json()

          //Enviar los datos actualizados a la app, para que procese los datos y los muestre

          let jsonPUBLISH = {
            "Devices": jsonSubs,
            "Message": message
          }

          //Enviar a cada socket asociado IDdevice y el mensaje de publish
          io.emit("PUBLISH", jsonPUBLISH)
          console.log('PUBLISH enviado')

          //Enviar los datos actualizados a la API, para que se guarde en la bbdd 
          if ((message == "state:on") || (message == "state:off")) {
            console.log(Object.keys(jsonSubs).length)
            for (let i = 0; i < Object.keys(jsonSubs).length; i++) {
              const req = await fetch("http://localhost:3000/devices/updateStatus/" + jsonSubs[i]['Device'], {
                method: 'PUT',
                headers: {
                  'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                  status: message.slice(6)
                })
              })
            }
            //Enviar values a la API
          }else if(message.slice(0,4) == 'value'){
            for (let i = 0; i < Object.keys(jsonSubs).length; i++) {
              const req = await fetch("http://localhost:3000/devices/updateValue/" + jsonSubs[i]['Device'], {
                method: 'PUT',
                headers: {
                  'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                  value: message.slice(6)
                })
              })
            }
          }
            
        }
      }
    }
    
  });

});

//Inicia el server
server.listen(4000)
console.log('Server started in port 4000');