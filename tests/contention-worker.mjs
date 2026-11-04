import {parentPort,workerData} from 'node:worker_threads';
import {DatabaseSync} from 'node:sqlite';
const db=new DatabaseSync(workerData.file);
try {
  db.exec('PRAGMA busy_timeout=10000');
  db.prepare("INSERT OR IGNORE INTO astra_operations(operation_id,telegram_id,reason,delta,result) VALUES(?,1,'tarot',-3,'saved')").run(workerData.key);
  parentPort.postMessage('ok');
} finally {db.close();}
