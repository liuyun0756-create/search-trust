// Test-only NDJSON adapter: Python orchestration -> real local PGlite RPCs.
import {createInterface} from 'node:readline';
import {database,rpc,seed} from '../src/lib/database/test-support/acquisition-binding.mjs';
let db;
for await(const line of createInterface({input:process.stdin})){
 try{
  const request=JSON.parse(line);let result;
  if(request.op==='init'){
   db=await database(request.includeFix);await seed(db,request.seed);result={ready:true};
  }else if(request.op==='rpc')result=await rpc(db,request.name,request.body);
  else if(request.op==='inspect')result={
   manifests:(await db.query('select payload from analysis_input_manifests')).rows,
   preparations:(await db.query('select request from capability_acquisition_preparations')).rows,
   recipes:(await db.query('select recipe from capability_generation_recipes')).rows,
   credits:(await db.query('select credit_balance from users')).rows,
   ledger:(await db.query('select kind,delta from credit_ledger')).rows,
  };
  else if(request.op==='close'){await db.close();process.stdout.write(JSON.stringify({result:true})+'\n',()=>process.exit(0));break;}
  else throw Error('unsupported test operation');
  process.stdout.write(JSON.stringify({result})+'\n');
 }catch(error){process.stdout.write(JSON.stringify({error:error.message,code:error.code??null})+'\n');}
}
