import catalog from '../../data/forecast/catalog.v1.json' with {type:'json'};
import {createForecastGenerator} from './engine.mjs';
let configuredGenerator;
export function generateForecast(sign,day,locale='ru') {
  configuredGenerator??=createForecastGenerator(catalog);
  return configuredGenerator(sign,day,locale);
}
