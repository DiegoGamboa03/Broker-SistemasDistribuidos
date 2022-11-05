import  express, { json, response }  from "express";
import morgan from "morgan";
import {Server as socketServer} from 'socket.io';
import http from 'http'
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

io.on("connection",  (socket) => {
    
    console.log(socket.id);
    
    socket.on("CONNECT", async (jsonCONNECT) => {
        let sessionPresent, returnCode; 
        //returnCode: 0 = Accepted
        //            1 = Server Error
        //            2 = Not registered


        //verificacion: si el ID que se esta intentando conectar esta en la tabla device
        //verificacion:  
        
        console.log(jsonCONNECT);
        
        sessionPresent = 1;
        const res = await fetch("http://localhost:3000/devices/" + jsonCONNECT['Client-ID'])
        if(res.status == 500){
          returnCode = 1;
        }else if(res.status == 202){
          returnCode = 2
        }else{
          const json = await res.json();
          returnCode = 0;
        }

        let jsonCONNACK = {
          "sessionPresent": sessionPresent,
          "returnCode": returnCode
        }
        console.log(jsonCONNACK);
        io.to(socket.id).emit('CONNACK',jsonCONNACK);
        
    });

    socket.on("SUBSCRIBE", async(jsonSUBSCRIBE) => {
      let returnCode;
      console.log(jsonSUBSCRIBE);
      // Aqui tiene que estar la parte donde se verifica la bbdd mediante la api
      console.log(jsonSUBSCRIBE);
      //Verificar topic en Topics
      const res = await fetch("http://localhost:3000/Topics/" + jsonSUBSCRIBE['Topic'])
      if(res.status == 500){
        returnCode = 1;
      }else if(res.status == 202){
        returnCode = 2
      }else{
        const json = await res.json();
        returnCode = 0;
      }

      //si todo esta bien permite la sub si no esta bien, manda error
      if (returnCode == 0){
        //Guardar suscripción
        const res = await fetch("http://localhost:3000/Subscribers/add/",{
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            Device: jsonSUBSCRIBE['Client-ID'],
            Topic: jsonSuBSCRIBE['Topic']
          })
        })
      }
      
      let jsonSUBACK= {
        "sessionPresent":1,
        "returnCode": returnCode
      }
      console.log(jsonSUBACK);

      io.to(socket.id).emit('SUBACK',jsonSUBACK);
      
    });

  socket.on("PUBLISH", (jsonPUBLISH) => {
    console.log(jsonPUBLISH);
    //Revisar que ese topico existe y el cliente sea publicador de ese topico
    
  });
});

//Inicia el server
server.listen(4000)
console.log('Server started in port 4000')