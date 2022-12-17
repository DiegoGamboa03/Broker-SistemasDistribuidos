export default function checkRule(condition,publisherMessage){
    
    let fact,operator,value,ruleTopic,message;

    let conditionSplit = String(condition).split('-');

    fact = conditionSplit[0];
    operator = conditionSplit[1];
    value = conditionSplit[2];
    ruleTopic = conditionSplit[3];
    message = conditionSplit[4];

    let publisherMessageSplit = String(publisherMessage).split('-')
    
    let publisherMessageFact = publisherMessageSplit[0];

    let publisherMessageValue = publisherMessageSplit[1];

    console.log(publisherMessageValue);

    let regexpTime = RegExp('^([0-1]?[0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9]$'); 
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
        console.log('El valor de la flag es ' + flag)
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