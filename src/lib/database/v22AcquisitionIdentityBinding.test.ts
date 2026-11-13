import {afterAll,beforeAll,expect,it} from 'vitest';
import {readFile} from 'node:fs/promises';
import {database,enrolled,fixture,fix,rpc} from './test-support/acquisition-binding.mjs';
let db:any,b:any,body:any,before:any,after:any;
beforeAll(async()=>{
 db=await database(false);b=await fixture();body=await enrolled(db,b);
 before=(await db.query("select pg_get_functiondef(oid) definition,md5(prosrc) hash,proacl::text acl from pg_proc where oid='check_v22_acquisition_preparation_binding()'::regprocedure")).rows[0];
 expect(before.hash).toBe('a6ac16e7027cf155d3189df52c68dd9d');
},30000);
afterAll(async()=>{await db?.close();});
it('reproduces the production conflict, then commits the identical real v14 freeze with a legacy preparation',async()=>{
 const failure=await rpc(db,'freeze_v22_acquisition_preparation',body).then(()=>null,(error:any)=>error);
 expect(failure).toMatchObject({code:'P0001',message:'CAPABILITY_PREPARATION_CONFLICT'});
 process.stdout.write(`BASELINE real v14 freeze: ${failure.code} ${failure.message}\n`);
 for(const table of ['data_snapshots','analysis_input_manifests','capability_generation_recipes'])expect((await db.query(`select count(*)::int n from ${table}`)).rows[0].n).toBe(0);
 await db.exec(await readFile('supabase/migrations/'+fix,'utf8'));
 after=(await db.query("select pg_get_functiondef(oid) definition,md5(prosrc) hash,proacl::text acl from pg_proc where oid='check_v22_acquisition_preparation_binding()'::regprocedure")).rows[0];
 expect((await rpc(db,'freeze_v22_acquisition_preparation',body)).manifest_id).toBe(b.manifest.id);
 process.stdout.write('PATCHED identical real v14 freeze: committed manifest and recipe\n');
 expect((await db.query('select count(*)::int n from capability_generation_recipes')).rows[0].n).toBe(1);
 expect((await db.query("select request#>>'{analyze_request,business_identity,schema_version}' version from capability_acquisition_preparations")).rows[0].version).toBeNull();
 expect(await rpc(db,'hydrate_v22_capability_generation_input',{p_manifest:b.manifest,p_recipe:b.recipe})).toEqual(b.request);
 expect(after.acl).toBe(before.acl);expect(after.hash).not.toBe(before.hash);
 expect(after.definition.split('  else\n')[0]).toBe(before.definition.split('  else\n')[0]);
});
async function insertRecipe(recipe:any){
 const m=b.manifest;return db.query('insert into capability_generation_recipes(manifest_id,user_id,case_id,generation_input_checksum,recipe) values($1,$2,$3,$4,$5::jsonb)',[m.id,m.user_id,m.case_id,m.generation_input_checksum,JSON.stringify(recipe)]);
}
it.each(['business_name','site_url','normalized_domain','public_gbp_url','country_code'])('rejects a changed v2 identity field: %s',async field=>{
 const recipe=structuredClone(b.recipe);recipe.request.business_identity[field]=field==='country_code'?'GB':'tampered';
 await expect(insertRecipe(recipe)).rejects.toThrow('CAPABILITY_PREPARATION_CONFLICT');
});
it.each(['queries','target_market','competitors'])('keeps the existing %s binding strict',async field=>{
 const recipe=structuredClone(b.recipe);recipe.request.evidence_input.context[field]=field==='target_market'?{display_name:'Elsewhere'}:[];
 await expect(insertRecipe(recipe)).rejects.toThrow('CAPABILITY_PREPARATION_CONFLICT');
});
it.each(['v22_capability_public_v12','v22_capability_public_v13'])('enforces the identity version gate for %s',async ruleset=>{
 const other=await database();try{
  const input=await fixture(ruleset),call=await enrolled(other,input);
  expect((await rpc(other,'freeze_v22_acquisition_preparation',call)).manifest_id).toBe(input.manifest.id);
  if(ruleset.endsWith('v12')){
   const recipe=structuredClone(input.recipe);recipe.request.business_identity=input.convertedIdentity;
   await expect(other.query('insert into capability_generation_recipes(manifest_id,user_id,case_id,generation_input_checksum,recipe) values($1,$2,$3,$4,$5::jsonb)',[input.manifest.id,input.manifest.user_id,input.manifest.case_id,input.manifest.generation_input_checksum,JSON.stringify(recipe)])).rejects.toThrow('CAPABILITY_PREPARATION_CONFLICT');
  }
 }finally{await other.close();}
});
it('keeps legacy whole-object equality and raises on a changed migration baseline',async()=>{
 const other=await database(false);try{
  await other.exec("comment on function public.check_v22_acquisition_preparation_binding() is 'test-only baseline metadata';");
  const def=(await other.query<{definition:string}>("select pg_get_functiondef('check_v22_acquisition_preparation_binding()'::regprocedure) definition")).rows[0].definition;
  await other.exec(def.replace("return new;","return new; -- changed baseline"));
  await expect(other.exec(await readFile('supabase/migrations/'+fix,'utf8'))).rejects.toThrow('P101_PREPARATION_BINDING_BASELINE_MISMATCH');
 }finally{await other.close();}
 const bad=structuredClone(b.recipe);bad.request.business_identity=structuredClone(b.old);bad.request.business_identity.operating_model='hybrid';
 await expect(insertRecipe(bad)).rejects.toThrow('CAPABILITY_PREPARATION_CONFLICT');
});
