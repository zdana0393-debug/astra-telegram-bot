import{parentPort,workerData}from'node:worker_threads';import{DatabaseSync}from'node:sqlite';
const db=new DatabaseSync(workerData.file);db.exec('PRAGMA busy_timeout=10000;PRAGMA foreign_keys=ON');
try{db.prepare('INSERT INTO astra_admin_grants25(update_id,operator_id,operator_generation,target_id,target_generation,amount,message_id,message_date,request_mac)VALUES(?,?,?,?,?,?,?,?,?)ON CONFLICT(update_id)DO NOTHING').run(...workerData.args);parentPort.postMessage({ok:true});}catch(e){parentPort.postMessage({ok:false,code:e.message});}finally{db.close();}
