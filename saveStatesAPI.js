export default async function saveState (subscriber, message){
    //Enviar los datos actualizados a la API, para que se guarde en la bbdd 
    if ((message == "state:on") || (message == "state:off")) {
        const req = await fetch("http://localhost:3000/devices/updateStatus/" + subscriber, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                status: message.slice(6)
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
    }
}