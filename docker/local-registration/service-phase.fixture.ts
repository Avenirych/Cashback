import { AdmissionInput, AdmissionPolicy, configDigest } from './admission';
import { REGISTRATION_PHONE_EXPECTED as E, registrationNetworkFingerprint, registrationPeerFingerprint } from './legacy-source/src/docker-phone-registration-target';
const now = 200000;
// Synthetic only; never runtime approval or observations.
export function serviceFixture(){
  const primary='a'.repeat(64),controlId='b'.repeat(64),controlName=E.project+'-authority';
  const volume={Name:E.volume,Driver:'local',Options:null,Mountpoint:'/var/lib/docker/volumes/'+E.volume+'/_data',Labels:{'com.docker.compose.project':E.project}};
  const postgres={Id:E.containerId,Name:'/'+E.container,Image:'sha256:'+'3'.repeat(64),Config:{Image:E.image,Labels:{'com.docker.compose.project':E.project,'com.docker.compose.service':'postgres-test'}},
    HostConfig:{PublishAllPorts:false,PortBindings:{}},State:{Status:'running',Health:{Status:'healthy'}},Mounts:[{Type:'volume',Name:E.volume,Source:volume.Mountpoint,Destination:'/var/lib/postgresql/data'}],
    NetworkSettings:{Ports:{},Networks:{[E.network]:{NetworkID:primary,IPAddress:'172.30.0.2'}}}};
  const network={Id:primary,Name:E.network,Driver:'bridge',Internal:true,Labels:{'com.docker.compose.project':E.project},IPAM:{},Options:{},Containers:{[E.containerId]:{IPv4Address:'172.30.0.2/24'}} as Record<string,any>};
  const control={Id:controlId,Name:controlName,Driver:'bridge',Internal:true,Labels:{'com.docker.compose.project':E.project},IPAM:{},Options:{},Containers:{}} as Record<string,any>;
  const peers=['migration-executor','observer'].map((service,i)=>{
    const id=String(i+1).repeat(64),image='registration-worker@sha256:'+'c'.repeat(64),name=E.project+'-'+service+'-1';
    const container={Id:id,Name:'/'+name,Image:'sha256:'+String(i+4).repeat(64),Config:{Image:image,Labels:{'com.docker.compose.project':E.project,'com.docker.compose.service':service}},
      State:{Status:'running'},HostConfig:{PublishAllPorts:false,PortBindings:{},CapAdd:[]},Mounts:[],NetworkSettings:{Ports:{},Networks:{[E.network]:{NetworkID:primary,IPAddress:'172.30.0.'+(i+3)},[controlName]:{NetworkID:controlId,IPAddress:'172.31.0.'+(i+3)}}}};
    network.Containers[id]={IPv4Address:'172.30.0.'+(i+3)+'/24'};control.Containers[id]={IPv4Address:'172.31.0.'+(i+3)+'/24'};
    return {container,image:{Id:container.Image,Os:'linux',Architecture:'amd64',Descriptor:{digest:image.split('@')[1]}}};
  });
  const effective={services:Object.fromEntries(peers.map(o=>[o.container.Config.Labels['com.docker.compose.service'],{image:o.container.Config.Image,networks:['database','authority'],ports:[]}]))};
  const file='docker/local-registration/service-peers.reviewed.json';
  const phasePolicy:AdmissionPolicy={context:E.context,daemonId:E.daemonId,postgresImage:E.image,platform:E.platform,servicePhase:{phase:'phone',file,
    peers:peers.map(o=>({id:o.container.Id,name:o.container.Name.slice(1),service:o.container.Config.Labels['com.docker.compose.service'] as 'observer'|'migration-executor',image:o.container.Config.Image,configurationSha256:registrationPeerFingerprint(o.container)})),
    controlNetwork:{name:controlName,id:controlId,configurationSha256:registrationNetworkFingerprint(control)},
    templateSha256:configDigest(effective),effectiveSha256:configDigest(effective),postgresSha256:registrationPeerFingerprint(postgres),networkSha256:registrationNetworkFingerprint(network),volumeSha256:configDigest(volume)}};
  const input:AdmissionInput={template:structuredClone(effective),effectiveConfig:effective,environment:{},invocation:{files:[file],project:E.project,profiles:[],overrides:[],services:['migration-executor','observer']},
    inventory:{context:E.context,daemonId:E.daemonId,complete:true,observedAt:now,
      containers:[E.container,...phasePolicy.servicePhase!.peers.map(p=>p.name)].map(name=>({name,composeProject:E.project})),
      networks:[E.network,controlName].map(name=>({name,composeProject:E.project})),volumes:[{name:E.volume,composeProject:E.project}]},
    image:{reference:E.image,platform:E.platform,postgresMajor:17,digestVerified:true,observedAt:now},
    servicePhase:{phase:'phone',observedAt:now,postgres,postgresImage:{Id:postgres.Image,Os:'linux',Architecture:'amd64',Descriptor:{digest:E.image.split('@')[1]}},network,volume,controlNetwork:control,peers}};
  return {input,policy:phasePolicy};
}
