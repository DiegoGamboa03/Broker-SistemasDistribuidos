import  express, { json, response }  from "express";
import morgan from "morgan";
import {Server as socketServer} from 'socket.io';
import http, { ClientRequest } from 'http'
import cors from 'cors'

//Configuraciones del server
const app = express()
const server = http.createServer(app);
const io = new socketServer(server, {
  cors: '*'
});

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
        
      
        
        sessionPresent = 1;
        const res = await fetch("http://localhost:3000/devices/" + jsonCONNECT['Client-ID'])
        if(res.status == 500){
          returnCode = 1;
        }else if(res.status == 202){
          returnCode = 2
        }else{
          const json = await res.json();
          returnCode = 0;
          console.log(socket.id);
          let jsonIDClient = {
            "clientId": jsonCONNECT['Client-ID'],
            "socketId": socket.id
          }
          clients.push(jsonIDClient);
        }
        console.log(clients);
        let jsonCONNACK = {
          "sessionPresent": sessionPresent,
          "returnCode": returnCode
        }
        console.log(jsonCONNACK);
        io.to(socket.id).emit('CONNACK',jsonCONNACK);
        
    });

    socket.on("SUBSCRIBE", async(jsonSUBSCRIBE) => {
      let returnCode;
      // Aqui tiene que estar la parte donde se verifica la bbdd mediante la api
      console.log(jsonSUBSCRIBE);
      //Verificar topic en Topics
      let topic = jsonSUBSCRIBE['Topic'];
      const res = await fetch("http://localhost:3000/topics/" + topic.replaceAll('/', "-"))
      if(res.status == 500){
        returnCode = 1;
      }else if(res.status == 202){
        returnCode = 2
      }else{ 
        const json = await res.json();
        console.log(json);
        returnCode = 0;

        const req = await fetch("http://localhost:3000/subscribers/add/",{
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
      
      let jsonSUBACK= {
        "returnCode": returnCode
      }
      console.log(jsonSUBACK);

      io.to(socket.id).emit('SUBACK',jsonSUBACK);
      
    });

  socket.on("PUBLISH", async (jsonPUBLISH) => {
    let returnCode;
    let topic = jsonPUBLISH['Topic'];

    const res = await fetch("http://localhost:3000/publishers/isPublisher/"+ jsonPUBLISH['Client-ID'] + "/" + topic.replaceAll('/', "-")) 
    if(res.status == 500){
      console.log('error in server');
      return ;
    }else{
      const json = await res.json();
      console.log(json);
      if(json['isPublisher'] === 1){
        console.log('HOLAAA');
        console.log(topic);
        //Aquí debería consultar por los suscriptores de ese tópico
        const res = await fetch("http://localhost:3000/subscribers/listTopic/" + topic.replaceAll('/', "-"))
        if(res.status == 500){
          returnCode = 1;
        }else if(res.status == 202){
          returnCode = 2
        }else{
          const json = await res.json();
          console.log(json[0]['Device'] +"="+ clients[0]["clientId"])
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
        }
        //socket.broadcast.emit('PUBLISH',jsonPUBLISH);  
      }else{
        //En este caso que se hace?
        //io.to(socket.id).emit('ERROR',jsonSUBACK);
      }
    }



    //Hay que revisar que el idClient que manda el publish sea publicador de ese topico
    
    
  });
});

//Inicia el server
server.listen(4000)
console.log('Server started in port 4000')