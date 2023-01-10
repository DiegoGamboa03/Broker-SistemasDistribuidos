import  express, { json, response }  from "express";
import morgan, { token } from "morgan";
import {Server as socketServer} from 'socket.io';
import http, { ClientRequest } from 'http'
import cors from 'cors';
import checkRule from "./rules.js";
import saveState from "./saveStatesAPI.js";
import { readFile } from "fs";

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
  //Prueba envío de imagen
  
  console.log('Connection iniciado')
  socket.on("CONNECT", async (jsonCONNECT) => {
    let returnCode, jsonDevices = [];
    let jsonFloors = [];
    console.log('Connect iniciado')
    var cont = 0;
    //CONSULTA A LA BD CONSULTANDO EL ID DE USUARIO Y CONTRASEÑA   

    const res = await fetch("http://localhost:3000/users/isUser/" + jsonCONNECT['user']+"/"+jsonCONNECT['password']);
          if(res.status == 500){
            returnCode = 1;
          }else if(res.status == 202){
            returnCode = 2;
          }else {
            
            //Recibir de la API  Json con pisos y habitaciones
            returnCode = 0;
            const res1= await fetch("http://localhost:3000/utils/getStatus")//Recibe los datos del json de getStatus
            if(res1.status == 500){
              returnCode = 1 ;
            } else if(res1.status == 202){
              returnCode = 2;

            }else{
              jsonFloors = await res1.json()
              returnCode = 0;

              //Solicitar dispositivos
              const res= await fetch("http://localhost:3000/devices/")
              if(res.status == 500){
                returnCode = 1 ;
              } else if(res.status == 202){
                returnCode = 2;
  
              }else{
                jsonDevices = await res.json()
               
                returnCode = 0;

                //Guardar disp en el arreglo de pisos y hab
                for (let i = 0; i < jsonFloors.length; i++) {
                 
                  for (let j = 0; j < jsonFloors[i].Rooms.length; j++) {
                    for (let k = 0; k < jsonDevices.length; k++) {
                      console.log(jsonDevices[k]['Room'])
                      if (jsonFloors[i].Rooms[j]['IDRoom'] = jsonDevices[k]['Room']) {
                        let jsonDevice = {
                          IDDevice: jsonDevices[k]['ID'],
                          Type: jsonDevices[k]['Type'],
                          Status: jsonDevices[k]['Status'],
                          Value: jsonDevices[k]['Value']
                        }
                        jsonFloors[i].Rooms[j].Devices.push(jsonDevice)
                      }
                    }
                  }
                }

              }

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
              jsonFloors
          }
          console.log(clients);
          console.log(socket.id);
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
      } else{
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
          let newDevicesStates = []
          
          
          for(let i = 0; i < Object.keys(jsonSubs).length; i++){
            //json de dispositivo mensaje
            let jsonDeviceState = {
              "Device": jsonSubs[i]['Device'],
              "Message": ''
            }

            const res2 = await fetch("http://localhost:3000/device_rules/findRule/"+ jsonSubs[i]['Device'] + "/" + topic.replaceAll('/', "-"))
            if(res2.status == 500){
              returnCode = 1;
            }else if(res2.status == 202){
              returnCode = 2;
              //Añadir mensaje sin alterar al dispositivo ya que no está asociado a ninguna regla
              jsonDeviceState.Message = message;
              newDevicesStates.push(jsonDeviceState);
              saveState(jsonSubs[i]['Device'],message)
            }else{ //->Encontró regla asociada al dispositivo
              let jsonDeviceRule =  await res2.json(); //->Esto es un array de json
              console.log(jsonDeviceRule)
              const res = await fetch("http://localhost:3000/rules/getRule/"+ jsonDeviceRule[0]['ID_rule']);
              if(res.status == 500){
                returnCode = 1;
              }else if(res.status == 202){
                returnCode = 2;
              }else{
                let jsonRule = await res.json();
                //Verificar aplicación de reglas
                let flag = checkRule(jsonRule[0]['Fact'], jsonRule[0]['Operator'], jsonRule[0]['Value'], message);
                if(flag){
                  //Agregar device más mensaje alterado de acuerdo a la condición de la regla
                  jsonDeviceState.Message = jsonDeviceRule[0]['message']
                  newDevicesStates.push(jsonDeviceState);
                  saveState(jsonSubs[i]['Device'],jsonDeviceRule[0]['message'])
                }else{ //-->En caso de que exista la regla pero no se cumpla
                  //Agregar device con mensaje sin alterar
                  jsonDeviceState.Message = message;
                  newDevicesStates.push(jsonDeviceState);
                  saveState(jsonSubs[i]['Device'],message)
                }
              }
            }
          }
          let jsonPUBLISH = {
            "Subscribers": newDevicesStates
          }
          //Enviar a cada socket asociado IDdevice y el mensaje de publish
          io.emit("PUBLISH", jsonPUBLISH)
          console.log('PUBLISH enviado') 
        }
      }
    }    
  });
  
  /****************************************************/
  //Operaciones de registro
  socket.on('REG-USER', async(jsonREGUSER) => { 
    const req = await fetch("http://localhost:3000/users/add/",{ 
     method: 'POST', 
     headers: { 
       'Content-Type': 'application/json' 
     }, 
     body: JSON.stringify({ 
       id: jsonREGUSER['userID'], 
       password: jsonREGUSER['password'] 
     }) 
   });  
  }) 
  
  socket.on('REG-DEVICE', async(jsonREGDEVICE) => { 
    const req = await fetch("http://localhost:3000/devices/add/",{ 
     method: 'POST', 
     headers: { 
       'Content-Type': 'application/json' 
     }, 
     body: JSON.stringify({ 
       id: jsonREGDEVICE['deviceID'], 
       type: jsonREGDEVICE['type'],
       status: jsonREGDEVICE['status'],
       room: jsonREGDEVICE['room']
     }) 
   });  
  }) 
  
  socket.on('REG-PUBLISHER', async(jsonREGPUBLISHER) => { 
    const req = await fetch("http://localhost:3000/publishers/add/",{ 
     method: 'POST', 
     headers: { 
       'Content-Type': 'application/json' 
     }, 
     body: JSON.stringify({ 
       id: jsonREGPUBLISHER['deviceID'], 
       topic: jsonREGPUBLISHER['topic'] 
     }) 
   });  
  })
  
  socket.on('REG-ROOM', async(jsonREGROOM) => { 
    const req = await fetch("http://localhost:3000/rooms/add/",{ 
     method: 'POST', 
     headers: { 
       'Content-Type': 'application/json' 
     }, 
     body: JSON.stringify({ 
       id: jsonREGROOM['roomID'], 
       floor: jsonREGROOM['floor'],
       posX: jsonREGROOM['posX'],
       posY: jsonREGROOM['posY']
     }) 
   });  
  })
  
  socket.on('REG-FLOOR', async(jsonREGFLOOR) => { 
    const req = await fetch("http://localhost:3000/floors/add/",{ 
     method: 'POST', 
     headers: { 
       'Content-Type': 'application/json' 
     }, 
     body: JSON.stringify({ 
       id: jsonREGFLOOR['floorID']
     }) 
   });  
  })

});






//Inicia el server
server.listen(4000)
console.log('Server started in port 4000');