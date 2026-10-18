import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';

// Static computational graph. Shapes describe the inspected configuration, not a verified run.
const node = (id,x,y,w,h,labels,kind='rect') => {
  const shape=kind==='encoder'?`<path d="M${x} ${y}H${x+w*.35}L${x+w} ${y+12}V${y+h-12}L${x+w*.35} ${y+h}H${x}Z"/>`:`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="3"/>`;
  return `<g data-node="${id}">${shape}<text text-anchor="middle">${labels.map((s,i)=>`<tspan class="${i===0?'node-title':'node-label'}" x="${x+w/2}" y="${y+h/2-(labels.length-1)*11+6+i*22}">${s}</tspan>`).join('')}</text></g>`;
};
const label=(x,y,s,anchor='middle')=>`<text class="edge-label" x="${x}" y="${y}" text-anchor="${anchor}">${s}</text>`;
const edge=(panel,id,from,to,d,kind='signal')=>`<path data-edge="${id}" data-from="${from}" data-to="${to}" class="network-edge ${kind}" d="${d}" marker-end="url(#network-arrow-${panel})"/>`;
const sample=(id,x,y,up=false)=>`<g data-node="${id}"><path class="sampling" d="M${x-45} ${y}H${x+45}L${x+25} ${y+38}H${x-25}Z"/>${label(x,y+25,up?'↑ 2':'↓ 2')}</g>`;
const svg=(id,height,title,description,body)=>`<div class="network-scroll" tabindex="0" role="region" aria-label="${title} — horizontally scrollable"><svg class="network-svg" data-network-panel="${id}" viewBox="0 0 960 ${height}" width="960" height="${height}" role="img" aria-labelledby="network-title-${id}" aria-describedby="network-description-${id}"><title id="network-title-${id}">${title}</title><desc id="network-description-${id}">${description}</desc><defs><marker id="network-arrow-${id}" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="8" markerHeight="8" orient="auto"><path d="M0 0L8 4L0 8Z"/></marker></defs>${body}</svg></div>`;

let observation='';
for(const [i,camera]of ['Left','Center','Right'].entries()) {
  const y=48+i*100;
  observation+=node(`rgb-${i}`,20,y+7,150,64,[`${camera} RGB`,'3 × 288 × 288']);
  observation+=node(`encoder-${i}`,200,y,210,78,['ResNet34','feature map','512 × 9 × 9'],'encoder');
  observation+=node(`projection-${i}`,445,y,200,78,['Spatial softmax','64 coordinate pairs','Linear + ReLU → 128']);
  observation+=edge('a',`image-${i}`,`rgb-${i}`,`encoder-${i}`,`M170 ${y+39}H200`);
  observation+=edge('a',`features-${i}`,`encoder-${i}`,`projection-${i}`,`M410 ${y+39}H445`);
  observation+=`<path class="network-edge signal" d="M645 ${y+39}H680"/>`;
}
observation+=node('state',445,355,200,78,['TCP + task state','18 values','position · rot6 · task']);
observation+=`<path class="network-edge signal" d="M645 394H680V87"/>`;
observation+=node('concat-observations',700,167,40,40,['cat']);
observation+=edge('a','fusion','projection-state','concat-observations','M680 187H700');
observation+=edge('a','observation','concat-observations','observation-vector','M740 187H765');
observation+=node('observation-vector',765,152,175,70,['402 / observation','3 × 128 + 18']);
observation+=edge('a','history','observation-vector','history','M852 222V285');
observation+=node('history',765,285,175,78,['History × 3','flatten observations','c_obs = 1,206']);
observation+=label(852,402,'To conditioning in B');

let unet=node('noisy-actions',60,20,220,62,['Noisy actions xₖ','T32 × C9']);
unet+=node('observation-context',310,20,140,62,['c_obs','1,206']);
unet+=node('timestep',500,20,100,62,['Step k']);
unet+=node('time-embedding',630,20,240,62,['Sinusoid + MLP','128 → 512 → 128']);
unet+=edge('b','time-embedding','timestep','time-embedding','M600 51H630','conditioning');
unet+=node('condition-concat',460,100,40,36,['cat']);
unet+=edge('b','context-conditioning','observation-context','condition-concat','M380 82V118H460','conditioning');
unet+=edge('b','time-conditioning','time-embedding','condition-concat','M750 82V95H520V118H500','conditioning');
unet+=edge('b','condition','condition-concat','film','M480 136V170','conditioning');
unet+=node('film',350,170,260,86,['c = 1,334','FiLM: learned scale + bias','c reused in 12 ResBlocks']);
unet+=edge('b','film-entry','film','down1','M350 213H270','conditioning');
unet+=node('down1',80,170,190,86,['Down 1','T32 · C256','2× ResBlock · FiLM(c)']);
unet+=node('down2',80,350,190,86,['Down 2','T16 · C512','2× ResBlock · FiLM(c)']);
unet+=node('down3',80,530,190,86,['Down 3','T8 · C1024','2× ResBlock · FiLM(c)']);
unet+=node('mid',385,530,190,86,['Bottleneck','T8 · C1024','2× ResBlock · FiLM(c)']);
unet+=node('concat8',625,553,50,40,['cat']);
unet+=node('up8',690,530,190,86,['Up 1','T8 · C2048 → 512','2× ResBlock · FiLM(c)']);
unet+=node('concat16',625,373,50,40,['cat']);
unet+=node('up16',690,350,190,86,['Up 2','T16 · C1024 → 256','2× ResBlock · FiLM(c)']);
unet+=node('noise-head',690,170,190,86,['Noise head','T32 · C256 → 9','Conv1D + 1×1 Conv']);
unet+=node('predicted-noise',695,112,180,38,['εθ · T32 × C9']);
unet+=sample('downsample1',175,285)+sample('downsample2',175,465)+sample('upsample1',785,465,true)+sample('upsample2',785,285,true);
for(const [id,from,to,d]of [
  ['noisy-input','noisy-actions','down1','M170 82V135H175V170'],
  ['down1-stride','down1','downsample1','M175 256V285'],['stride1-down2','downsample1','down2','M175 323V350'],
  ['down2-stride','down2','downsample2','M175 436V465'],['stride2-down3','downsample2','down3','M175 503V530'],
  ['down3-mid','down3','mid','M270 573H385'],['mid-cat8','mid','concat8','M575 573H625'],
  ['cat8-up1','concat8','up8','M675 573H690'],['up1-stride','up8','upsample1','M785 530V503'],
  ['stride1-cat16','upsample1','concat16','M785 465V450H650V413'],['cat16-up2','concat16','up16','M675 393H690'],
  ['up2-stride','up16','upsample2','M785 350V323'],['stride2-head','upsample2','noise-head','M785 285V256'],
  ['noise-output','noise-head','predicted-noise','M785 170V150'],
])unet+=edge('b',id,from,to,d);
unet+=edge('b','skip16','down2','concat16','M270 393H625','skip')+label(445,379,'skip · T16/C512');
unet+=edge('b','skip8','down3','concat8','M175 616V655H650V593','skip')+label(415,642,'skip · T8/C1024');
unet+=label(320,310,'T16/C256')+label(320,490,'T8/C512');
unet+=label(890,310,'T32/C256')+label(890,490,'T16/C512');

let inference=node('initial-noise',20,70,180,90,['Current sample xₖ','32 × 9','Gaussian at start']);
inference+=node('denoiser',250,70,190,90,['U-Net · panel B','Predict noise εθ','Uses k and c']);
inference+=node('scheduler',500,70,190,90,['DDIM scheduler','Current sample + εθ','Next sample x_prev']);
inference+=node('action-chunk',740,70,200,90,['Denoised actions','32 × 9','After 10 updates']);
inference+=node('selected-actions',740,215,200,78,['Select indices 2:10','8 × 9','Absolute TCP poses']);
inference+=edge('c','denoiser-input','initial-noise','denoiser','M200 115H250');
inference+=edge('c','noise-prediction','denoiser','scheduler','M440 115H500');
inference+=edge('c','scheduler-sample','initial-noise','scheduler','M110 70V30H595V70')+label(345,20,'Current noisy sample');
inference+=edge('c','ddim-return','scheduler','initial-noise','M595 160V205H110V160')+label(350,195,'Repeat with the next timestep · 10 DDIM updates');
inference+=edge('c','denoised-chunk','scheduler','action-chunk','M690 115H740');
inference+=edge('c','select-actions','action-chunk','selected-actions','M840 160V215');

const html=`<figure class="technical-flow policy-architecture" aria-labelledby="architecture-caption">
<header class="network-heading"><strong>Vision-conditioned Diffusion Policy</strong></header>
<p class="network-scroll-hint">On narrow screens, scroll panels horizontally. The full text equivalent follows.</p>
<div class="network-legend"><span class="signal">Signal / action flow</span><span class="conditioning">Conditioning</span><span class="skip">Skip connection</span><span>cat = concatenate · T = time positions · C = channels</span></div>
<div class="network-panel-label">A · Visual features and observation history</div>
${svg('a',455,'Visual features and observation history','Three independent trainable ResNet34 encoders each produce 128 values after spatial softmax and projection. Concatenate these with 18 state values. Flatten three observations to 1,206 context values.',observation)}
<p class="network-note">The three ResNet34 encoders have separate, trainable ImageNet-initialized weights. Resizing, cropping and normalization precede visual feature extraction.</p>
<div class="network-panel-label">B · Conditional temporal U-Net</div>
${svg('b',680,'Conditional temporal U-Net','Noisy 32 by 9 actions pass through three down stages, two bottleneck residual blocks and two up stages. Only two stages downsample and two stages upsample. Skip features from Down 3 and Down 2 concatenate before Up 1 and Up 2. Observation context and a timestep embedding supply FiLM conditioning to all twelve residual blocks, but not the final noise head.',unet)}
<p class="network-note">Each ResBlock receives the same c through its own learned FiLM transform. Skip taps precede downsampling. Down 3 has no further downsampling. There is no skip from Down 1.</p>
<div class="network-panel-label">C · DDIM inference and action selection</div>
${svg('c',315,'DDIM inference and action selection','Start from Gaussian noise and reuse the same U-Net for ten DDIM updates. The scheduler receives both the current sample and predicted noise. Select zero-based indices two through nine from the denoised 32 by 9 sequence.',inference)}
<p class="network-note">With three observations, action selection starts at n_obs_steps − 1 = 2, aligned with the current observation. The slice 2:10 selects eight actions from the 32-step prediction.</p>
<p class="network-note"><strong>Execution:</strong> Undo action normalization → convert rotation6 to a quaternion → execute absolute TCP targets with the Cartesian controller at nominal 20 Hz.</p>
<figcaption id="architecture-caption">Architecture of the inspected vision-conditioned Diffusion Policy, not a language-conditioned VLA. Dimensions describe the configuration, not an independently verified competition checkpoint.</figcaption>
<div class="network-equivalent"><strong>Complete text equivalent</strong><ol>
<li>Three RGB crops, each 3 × 288 × 288, enter separate trainable ResNet34 encoders. Each produces a 512 × 9 × 9 feature map. Spatial softmax produces 64 coordinate pairs. A linear layer and ReLU produce 128 values per camera.</li>
<li>The 18-value state contains position 3, rotation6 6, connector 2, rail 5 and port 2. Concatenation gives 402 values per observation. Three observations flatten to c_obs = 1,206.</li>
<li>The diffusion timestep uses a sinusoidal embedding and a 128 → 512 → 128 MLP. Concatenation with c_obs gives c = 1,334. FiLM supplies learned scale and bias to all 12 conditional residual blocks.</li>
<li>The noisy action sequence is T32 × C9. Down 1 produces T32/C256, then downsamples to T16. Down 2 produces T16/C512, then downsamples to T8. Down 3 produces T8/C1024 without another downsample. Two bottleneck residual blocks preserve T8/C1024.</li>
<li>Concatenate the T8/C1024 bottleneck and Down 3 skip to get T8/C2048. Up 1 produces T8/C512, then upsamples to T16. Concatenate with the T16/C512 Down 2 skip to get T16/C1024. Up 2 produces T16/C256, then upsamples to T32. A convolutional head predicts T32 × C9 noise. The final head has no FiLM input.</li>
<li>Inference starts from newly sampled Gaussian noise. The DDIM scheduler uses the current actions and predicted noise across ten updates of the same U-Net. The resulting action sequence contains 32 × 9 values. The start index is n_obs_steps − 1 = 2, aligned with the current observation. Zero-based indices 2:10 select eight poses. Each pose has three position values and six rotation values. Postprocessing restores action units and converts rotation6 to a quaternion before nominal 20 Hz Cartesian execution.</li>
</ol></div>
<p class="network-training"><strong>Training only:</strong> Sample from 100 DDPM noise timesteps and minimize mean-squared noise-prediction error. This loss is not an inference stage.</p>
</figure>`;
const output={html,skipConnections:[['down3','concat8'],['down2','concat16']],downsampleStages:2,upsampleStages:2,context:1206,conditioning:1334,actionShape:[32,9],selectedIndices:[2,3,4,5,6,7,8,9]};
const target='src/data/policy-architecture.json';
if(process.argv.includes('--check'))assert.equal(readFileSync(target,'utf8'),JSON.stringify(output)+'\n','Stored diagram matches its source');
else writeFileSync(target,JSON.stringify(output)+'\n');
console.log('Conventional architecture: three independent encoders, two down/up sampling operations, two verified skip connections.');
