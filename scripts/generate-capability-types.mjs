/** Types describe the structural shape; runtime AJV keeps conditional validation. */
import {readFile,writeFile} from 'node:fs/promises';
import {compile} from 'json-schema-to-typescript';
const input='src/lib/report-capability/contracts/capability.schema.json';
const schema=JSON.parse(await readFile(input,'utf8'));
function structure(value){
 if(Array.isArray(value))return value.map(structure);
 if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value)
  .filter(([key])=>!['if','then','else'].includes(key))
  .filter(([key,item])=>key!=='allOf'||!item.every(branch=>'if' in branch))
  .map(([key,item])=>[key,structure(item)]));
 return value;
}
const result=await compile(structure(schema),'CapabilityContracts',{
 additionalProperties:false,unknownAny:true,unreachableDefinitions:true,maxItems:5,
});
const output='src/lib/report-capability/generated/types.ts';
if(process.argv.includes('--check')){
 if(await readFile(output,'utf8')!==result)throw new Error('Capability generated type drift');
 console.log('Capability structural types match; runtime conditionals unchanged.');
}else{
 await writeFile(output,result);
 console.log('Capability structural types generated; runtime conditionals unchanged.');
}
