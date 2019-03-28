const convert = require('./stringHexConvert');
var hexa = convert.ascii_to_hexa('http://localhost:3001/JouMoer');
   console.log('hex value of URL is '+ hexa);
   console.log('Original URL Value is '+ convert.hexa_to_ascii(hexa));