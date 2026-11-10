import catalog from '../../../data/forecast/catalog.v1.json' with {type:'json'};
import compactCatalog from '../../../data/forecast/editorial.compact.v1.json' with {type:'json'};
import {generateForecast} from '../configured.mjs';
import {validDay} from '../engine.mjs';
import {createCompactForecastGenerator} from './compact.mjs';
let configuredCompactGenerator;
export function compactStartDay(env){
 const start=env.ASTRA_FORECAST_COMPACT_START_DAY;if(start===undefined||start===null||start==='')return null;
 if(!validDay(start))throw Error('Invalid compact forecast start day');return start;
}
export function generateForecastForEnv(env,sign,day,locale='ru'){
 const start=compactStartDay(env);if(!start||day<start)return generateForecast(sign,day,locale);
 configuredCompactGenerator??=createCompactForecastGenerator(catalog,compactCatalog,{generate:generateForecast});
 return configuredCompactGenerator(sign,day,locale);
}
