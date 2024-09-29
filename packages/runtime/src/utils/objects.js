

export function objectsDiff(oldObj, newObj) {
    const oldKeys = Object.keys(oldObj);
    const newKeys = Object.keys(newObj);

    let added = [];
    let updated = [];
    for(let i=0; i < newKeys.length; i++) {
        let key = newKeys[i];
        if(!(key in oldObj)) 
            added.push(key);

        if(key in oldObj && oldObj[key] !== newObj[key])
            updated.push(key);   
    }
    return {
        added,
        removed: oldKeys.filter((key) => !(key in newObj)),
        updated
    }
}

export function hasOwnProperty(obj, prop) {
    return Object.prototype.hasOwnProperty.call(obj, prop)
}