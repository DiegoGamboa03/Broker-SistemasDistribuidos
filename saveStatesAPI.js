import moment from "moment"

export default async function saveState (subscriber, message, topic){
    //Enviar los datos actualizados a la API, para que se guarde en la bbdd 
    if ((message == "state:on") || (message == "state:off") || (message == "state:open") || (message == "state:closed")) {
        const req = await fetch("http://localhost:3000/devices/updateStatus/" + subscriber, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                status: message.slice(6)
            })
        })

        //Guardar operación en Log Device
        const req1 = await fetch("http://localhost:3000/log_devices/add/", {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                Device: subscriber,
                Action_done: message,
                Topic: topic,
                Date_time: moment().format('YYYY-MM-DD HH:mm:ss')
            })
        })

        //Enviar values a la API
    } else if (message.slice(0, 4) == 'value') {
        const req = await fetch("http://localhost:3000/devices/updateValue/" + subscriber, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                value: message.slice(6)
            })
        })

         //Guardar operación en Log Device
         const req1 = await fetch("http://localhost:3000/log_devices/add/", {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                Device: subscriber,
                Action_done: message,
                Topic: topic,
                Date_time: moment().format('YYYY-MM-DD HH:mm:ss')
            })
        })
    }
}