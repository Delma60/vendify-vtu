
export function env(key:string, defaultValue?:unknown):unknown{
    const value = process.env[key];
    if(value === undefined){
        if(defaultValue !== undefined) return defaultValue;
        throw new Error(`Environment variable ${key} is not set`);
    }
    return value;
}