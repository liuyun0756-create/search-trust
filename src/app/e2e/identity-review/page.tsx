import {notFound} from 'next/navigation';
import {isLocalE2ETestMode} from '@/lib/e2e-v22/config';
import {localIdentityArtifact} from './local';
import {IdentityPreview} from './preview';
export const dynamic='force-dynamic';
export const metadata={robots:{index:false,follow:false},title:'Local identity review preview'};
export default async function Page({searchParams}:{searchParams:Promise<{scenario?:string}>}){
 if(!isLocalE2ETestMode())notFound();
 const {scenario='volcanoes-hiking-guides'}=await searchParams;
 if(!['volcanoes-hiking-guides','pr-plumbing-fresno'].includes(scenario))notFound();
 const data=localIdentityArtifact(scenario);
 return <IdentityPreview base={data.base} scenario={scenario}/>;
}
