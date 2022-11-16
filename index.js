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
        let returnCode; 
        //returnCode: 0 = Accepted
        //            1 = Server Error
        //            2 = Not registered


        //verificacion: si el ID que se esta intentando conectar esta en la tabla device
        //verificacion:  
        
        //Función para temporizar respuesta del server
      
          const res = await fetch("http://localhost:3000/devices/" + jsonCONNECT['clientID']);
          if(res.status == 500){
            returnCode = 1;
          }else if(res.status == 202){
            returnCode = 2;
          }else{
            const json = await res.json();

            returnCode = 0;
            let jsonIDClient = {
              "clientID": jsonCONNECT['clientID'],
              "socketID": socket.id,
              "deviceType": json['deviceType']
            }

            jToken = jwt.sign({
              'clientID':jsonCONNECT['clientID']
            }, 'secretkey', {expiresIn: '24h'});


            clients.push(jsonIDClient);

            let jsonCONNACK = {
              "returnCode": returnCode,
              "jwt": jToken,
              "deviceType": json['deviceType']
            }

            io.to(socket.id).emit('CONNACK',jsonCONNACK);

            return;
          }
          
          let jsonCONNACK = {
            "returnCode": returnCode,
          }

          io.to(socket.id).emit('CONNACK',jsonCONNACK);        
  });

  socket.on("SUBSCRIBE", async(jsonSUBSCRIBE) => {
      let returnCode,topic;
      // Aqui tiene que estar la parte donde se verifica la bbdd mediante la api
      //Verificar topic en Topics
      topic = jsonSUBSCRIBE['topic'];
      //Aquí verifica el token
      try{
        jwt.verify(jsonSUBSCRIBE['token'], 'secretkey', async (err, authData) => {
          if(err) {
            console.log(err);
          } else {
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
              });
            }
            
            let jsonSUBACK = {
              "returnCode": returnCode
            }
            
            io.to(socket.id).emit('SUBACK', jsonSUBACK);
            //Aquí se almacena la suscripción en el log_devices
          }
        })
      }catch(error){

        let jsonERROR = {
          'error': error
        }

        io.to(socket.id).emit('ERROR',jsonERROR);
      }
  });

  socket.on("PUBLISH", async (jsonPUBLISH) => {
    
    let returnCode, topic;
    
    topic = jsonPUBLISH['topic'];
    //Aquí verifica el token
    try{
      jwt.verify(jsonPUBLISH['token'], 'secretkey', async (err, authData) => {
        if(err) {
          console.log(err);
        } else {

          //Aquí hace las consultas a la BD
          const res = await fetch("http://localhost:3000/publishers/isPublisher/"+ jsonPUBLISH['clientID'] + "/" + topic.replaceAll('/', "-")) 
          if(res.status == 500){
            return ;
          }else{
            const json = await res.json();
            if(json['isPublisher'] === 1){
              //Aquí debería consultar por los suscriptores de ese tópico
              const res = await fetch("http://localhost:3000/subscribers/listTopic/" + topic.replaceAll('/', "-"))
              if(res.status == 500){
                returnCode = 1;
              }else if(res.status == 202){
                returnCode = 2
              }else{
                const json = await res.json();
                returnCode = 0;
                //Enviar a cada socket asociado al ID device
                
                for(let i = 0; i < clients.length; i++){ //Deberiamos cambiarle el nombre a clients, es poco claro
                  for(let j = 0; j < json.length; j++){
                    if (json[j]['device'] == clients[i]['clientID']){ 
                      io.to(clients[i]['socketID']).emit("PUBLISH",jsonPUBLISH)                        
                    }
                  }
                }

                let jsonPUBACK = {
                  'returnCode': returnCode,
                }
                io.to(socket.id).emit('PUBACK',jsonPUBACK);
              }
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
      /*if(req.status == 200){
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

      }*/
      
  })

  socket.on('REG-CLIENT', async(jsonREGCLIENT) => {
     const req = await fetch("http://localhost:3000/devices/add/",{
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        id: jsonREGCLIENT['clientID'],
        type: jsonREGCLIENT['deviceType']
      })
    });
    
  })

});

//Inicia el server
server.listen(4000)
console.log('Server started in port 4000')