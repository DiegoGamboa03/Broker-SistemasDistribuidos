import  express, { json, response }  from "express";
import morgan, { token } from "morgan";
import {Server as socketServer} from 'socket.io';
import http, { ClientRequest } from 'http'
import cors from 'cors';
import jwt from 'jsonwebtoken';
import moment from 'moment';

//Configuraciones del server
const app = express()
const server = http.createServer(app);
const io = new socketServer(server, {
  cors: '*'
});

//Para abortar fetch requests
const controller = new AbortController();
const signal = controller.signal;

//WebToken para autenticar y mantener sesiones
var jToken;

//Middleware
app.use(cors());
app.use(morgan("dev"));

//Array of clients JSON
var clients = []


io.on("connection",  (socket) => {
    
    //console.log(clients);
    socket.on("CONNECT", async (jsonCONNECT) => {
        let sessionPresent, returnCode; 
        //returnCode: 0 = Accepted
        //            1 = Server Error
        //            2 = Not registered


        //verificacion: si el ID que se esta intentando conectar esta en la tabla device
        //verificacion:  
        
        //Función para temporizar respuesta del server
       
        
        sessionPresent = 1;
        try{
          const res = await fetch("http://localhost:3000/devices/" + jsonCONNECT['Client-ID'], {
            signal: AbortSignal.timeout(5000) 
          });
          if(res.status == 500){
            returnCode = 1;
          }else if(res.status == 202){
            returnCode = 2
          }else{
            const json = await res.json();
            returnCode = 0;
            let jsonIDClient = {
              "clientId": jsonCONNECT['Client-ID'],
              "socketId": socket.id,
              "deviceType": json['Type']
            }

            jToken = jwt.sign({
              'clientId':jsonCONNECT['Client-ID']
            }, 'secretkey', {expiresIn: '24h'});

            console.log(jsonIDClient)
            clients.push(jsonIDClient);
            let jsonCONNACK = {
              "sessionPresent": sessionPresent,
              "returnCode": returnCode,
              "token": jToken,
              "type": json['Type']
            }
            io.to(socket.id).emit('CONNACK',jsonCONNACK);
            return;
          }
          let jsonCONNACK = {
            "sessionPresent": sessionPresent,
            "returnCode": returnCode,
            "token": jToken
          }
          io.to(socket.id).emit('CONNACK',jsonCONNACK);
        }catch(err){
          console.log('Se agotó el tiempo de espera de la conexión')  
        }            
    });


    socket.on("SUBSCRIBE", async(jsonSUBSCRIBE) => {
      let returnCode;
      // Aqui tiene que estar la parte donde se verifica la bbdd mediante la api
      //Verificar topic en Topics
      let topic = jsonSUBSCRIBE['Topic'];
      //Aquí verifica el token
      try{
        jwt.verify(jsonSUBSCRIBE['token'], 'secretkey', async (err, authData) => {
          if(err) {
            console.log(err);
          } else {
            try{
              const res = await fetch("http://localhost:3000/topics/" + topic.replaceAll('/', "-"), {
              signal: AbortSignal.timeout(5000)
            })
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
                  Device: jsonSUBSCRIBE['Client-ID'],
                  Topic: topic.replaceAll('/', "-")
                })
              });
            }
            let jsonSUBACK = {
              "returnCode": returnCode
            }
            io.to(socket.id).emit('SUBACK', jsonSUBACK);
            console.log(clients)

            //Aquí se almacena la suscripción en el log_devices
            console.log(jsonSUBSCRIBE['Client-ID'])
            const req = await fetch("http://localhost:3000/log_devices/add/", {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                Device: jsonSUBSCRIBE['Client-ID'],
                Action_done: 'SUBSCRIBE',
                Topic: jsonSUBSCRIBE['Topic'],
                Date_time: moment().format('YYYY-MM-DD HH:mm:ss')
              })
            });
            console.log(moment().format('YYYY-MM-DD HH:mm:ss'));

            }catch(error){
              console.log(error)
              let jsonERROR = {
                'error': error
              }
              io.to(socket.id).emit('ERROR',jsonERROR);
            }
            
          }
        })
      }catch(error){
        console.log(error)
        let jsonERROR = {
          'error': error
        }
        io.to(socket.id).emit('ERROR',jsonERROR);
      }
      
      
    });

  socket.on("PUBLISH", async (jsonPUBLISH) => {
    let returnCode;
    let topic = jsonPUBLISH['Topic'];
    //Aquí verifica el token
    try{
      jwt.verify(jsonPUBLISH['token'], 'secretkey', async (err, authData) => {
        if(err) {
          console.log(err);
        } else {

          //Aquí hace las consultas a la BD
          const res = await fetch("http://localhost:3000/publishers/isPublisher/"+ jsonPUBLISH['Client-ID'] + "/" + topic.replaceAll('/', "-")) 
          if(res.status == 500){
            console.log('error in server');
            return ;
          }else{
            
            const json = await res.json();
            console.log(json);
            if(json['isPublisher'] === 1){
              console.log(topic);
              //Aquí debería consultar por los suscriptores de ese tópico
              const res = await fetch("http://localhost:3000/subscribers/listTopic/" + topic.replaceAll('/', "-"))
              if(res.status == 500){
                returnCode = 1;
              }else if(res.status == 202){
                returnCode = 2
              }else{
                const json = await res.json();
                
                console.log(json);
                returnCode = 0;
                //Enviar a cada socket asociado al ID device
                for(let i = 0; i < clients.length; i++){
                  for(let j = 0; j < json.length; j++){
                    
                    if (json[j]['Device'] == clients[i].clientId){ //<-Revisar esto
                      io.to(clients[i]['socketId']).emit("PUBLISH",jsonPUBLISH)  
                      console.log(jsonPUBLISH['Message']);
                    }
                  }
                }
                let jsonPUBACK = {
                  'returnCode': returnCode,
                }
                io.to(socket.id).emit('PUBACK',jsonPUBACK);
              }

              //Almacenar publicación en el Log
              const req = await fetch("http://localhost:3000/log_devices/add/",{
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    Device: jsonPUBLISH['Client-ID'],
                    Action_done: 'PUBLISH',
                    Topic: jsonPUBLISH['Topic'],
                    Date_time: moment().format('YYYY-MM-DD HH:mm:ss')
                })
              });

              //socket.broadcast.emit('PUBLISH',jsonPUBLISH);  
            }else{
              //En este caso que se hace?
              //io.to(socket.id).emit('ERROR',jsonSUBACK);
            }
          }
        }
      });
    }catch(error){
      console.log(error)
    }  

    //Hay que revisar que el idClient que manda el publish sea publicador de ese topico 
    
  });

  socket.on('REG-TOPIC', async(jsonREGTOPIC) => {
     //Aquí verifica el token
    const req = await fetch("http://localhost:3000/topics/add/",{
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          id: jsonREGTOPIC['topic'].replaceAll('/', "-")
        })

      });
      if(req.status == 200){
        const req1 = await fetch("http://localhost:3000/topics/add/",{
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            id: jsonREGTOPIC['topic'].replaceAll('/', "-") + "$$"
          })
  
        });
      }else{

      }
      
  })

  socket.on('REG-CLIENT', async(jsonREGCLIENT) => {
     const req = await fetch("http://localhost:3000/devices/add/",{
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        id: jsonREGCLIENT['ID'],
        type: jsonREGCLIENT['type']
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
       id: jsonREGPUBLISHER['clientID'],
       topic: jsonREGPUBLISHER['topic']
     })
   });
   
 })
});

//Inicia el server
server.listen(4000)
console.log('Server started in port 4000')