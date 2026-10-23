from pathlib import Path
from PIL import Image,ImageStat
import json
root=Path('/tmp/lwe-pr121-trim-evidence')
for variant in ['before','trimmed','trimmed-4x']:
 p=root/variant
 if not (p/'capture.json').exists():continue
 d=json.loads((p/'capture.json').read_text()); rows=[]
 for f in d['frames']:
  im=Image.open(p/f['file']).convert('L')
  rows.append({**f,'background':ImageStat.Stat(im.crop((600,300,1000,700))).mean[0],'preview':ImageStat.Stat(im.crop((1300,350,1450,500))).mean[0]})
 summary=[]
 for i,a in enumerate(d['actions']):
  end=d['actions'][i+1]['t'] if i+1<len(d['actions']) else rows[-1]['ts']+.01
  part=[r for r in rows if a['t']<=r['ts']<end]
  vals=[r['background'] for r in part]; prior=vals[0]; reversal=0
  for v in vals:
   reversal=max(reversal,prior-v if a['kind']=='open' else v-prior)
   prior=max(prior,v) if a['kind']=='open' else min(prior,v)
  summary.append({'phase':a['kind'],'frames':len(part),'background_range':[min(vals),max(vals)],'max_background_reversal':round(reversal,3)})
 (p/'pixels.json').write_text(json.dumps({'phases':summary,'frames':rows},indent=2))
 print(variant,json.dumps(summary))
 # Preserve actual capture timing instead of implying a constant capture frame rate.
 with (p/'frames.ffconcat').open('w') as out:
  out.write('ffconcat version 1.0\n')
  for i,r in enumerate(rows):
   out.write(f"file '{r['file']}'\n")
   if i+1<len(rows):out.write(f"duration {rows[i+1]['ts']-r['ts']:.6f}\n")
