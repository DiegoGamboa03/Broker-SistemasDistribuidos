///fact: tipo de variable a evaluar (state, time, temperature)
//value: valor con el que se compara la condición 
///operator: operador que compara value y valor de publisherMessage 
//publisherMessage: mensaje del publicador (xxxxxxx:xxxxxx)


export default function checkRule(fact, operator, value,publisherMessage){
    
    let publisherMessageSplit = String(publisherMessage).split(':')
    
    let publisherMessageFact = publisherMessageSplit[0];

    let publisherMessageValue = publisherMessageSplit[1];

    console.log(publisherMessageValue);

    let regexpTime = RegExp('^([0-1]?[0-9]|2[0-3])-[0-5][0-9]-[0-5][0-9]$'); 
    let regexpNumber = RegExp('^[0-9]*$') 
    let regexpString = RegExp('^[a-zA-Z]+$')

    let flag; 

    if(fact == publisherMessageFact){ //Revisas que el fact sea igual (facts: temperature, time, state)
        if(value.match(regexpTime) && publisherMessageValue.match(regexpTime)){ //Tiene formato para tiempo
            flag = checkOperator(operator,publisherMessageValue,value)
        }else if(value.match(regexpNumber) && publisherMessageValue.match(regexpNumber)){ //Formato numeros
            flag = checkOperator(operator,publisherMessageValue,value)
        }else if(value.match(regexpString) && publisherMessageValue.match(regexpString)){ //Formato para letras
            flag = checkOperator(operator,publisherMessageValue,value) //nada mas deberiamos permitir que el operator de un string sea = o !=
        }
        return flag;
    }
}

function checkOperator(operator,value,valueToCompare){
    
    if(operator == '='){
        return value == valueToCompare; 
    }else if(operator == '>'){
        return value > valueToCompare;
    }else if(operator == '>='){
        return value >= valueToCompare;
    }else if(operator == '<'){
        return value < valueToCompare;
    }else if(operator == '<='){
        return value <= valueToCompare;
    }
}