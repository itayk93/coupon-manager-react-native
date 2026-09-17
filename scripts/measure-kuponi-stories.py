"""Measure every used atlas cell, excluding blank padding cells.

Alpha bounds include props. Blue-body bounds isolate the largest connected
cobalt component so the ledger/check/coupons are not mistaken for the head.
These are reproducible raster measurements, not anatomical rig coordinates.
"""
from pathlib import Path
import json
import cv2
import numpy as np
from PIL import Image

root = Path(__file__).resolve().parents[1]
folder = root / 'assets/mascot/stories'
manifest = json.loads((folder/'manifest.json').read_text())
results = {}
proof = Image.new('RGB', (256*4, 256*4), '#182238')
for row, (name, meta) in enumerate(manifest.items()):
    atlas = np.asarray(Image.open(folder/meta['atlas']).convert('RGBA'))
    size = meta['cellSize']
    measurements = []
    for frame in range(meta['frameCount']):
        x, y = frame % meta['columns']*size, frame // meta['columns']*size
        cell = atlas[y:y+size,x:x+size]
        r,g,b,a = [cell[:,:,i].astype('int16') for i in range(4)]
        visible = a >= 32
        blue = (visible & (b-r >= 35) & (b-g >= 15) & (b >= 80)).astype('uint8')
        n, labels, stats, _ = cv2.connectedComponentsWithStats(blue, 8)
        assert n > 1, (name,frame)
        body = labels == (1+np.argmax(stats[1:,cv2.CC_STAT_AREA]))
        by,bx = np.where(body)
        ay,ax = np.where(visible)
        zy,zx = np.where(a > 0)
        measurements.append({'frame':frame,'headTopPx':int(by.min()),'belowFeetPx':int(size-1-by.max()),'allArtTopPx':int(ay.min()),'allArtBottomPx':int(size-1-ay.max()),'strictAlphaTopPx':int(zy.min()),'strictAlphaBottomPx':int(size-1-zy.max())})
    entry={'cellSize':size,'frameCount':meta['frameCount'],'atlasWidth':atlas.shape[1],'atlasHeight':atlas.shape[0],
           'decodedBytes':int(atlas.shape[1]*atlas.shape[0]*4),'residentPlusStoryBytes':int(atlas.shape[1]*atlas.shape[0]*4+1536*1536*4),'bounds':{},'frames':measurements}
    for key in ['headTopPx','belowFeetPx','allArtTopPx','allArtBottomPx','strictAlphaTopPx','strictAlphaBottomPx']:
        vals=[m[key] for m in measurements]
        entry['bounds'][key]={'min':min(vals),'max':max(vals),'minFraction':min(vals)/size,'maxFraction':max(vals)/size,'minFrame':vals.index(min(vals)),'maxFrame':vals.index(max(vals))}
    for col,key in enumerate(['headTopPx','headTopPx','belowFeetPx','belowFeetPx']):
        frame=entry['bounds'][key]['minFrame' if col%2==0 else 'maxFrame']
        x,y=frame%meta['columns']*size,frame//meta['columns']*size
        im=Image.fromarray(atlas[y:y+size,x:x+size]).resize((256,256))
        proof.paste(im,(col*256,row*256),im)
    results[name]=entry
    print(name,json.dumps({k:v for k,v in entry.items() if k!='frames'}),flush=True)
report={'method':{'alphaThreshold':32,'bodyRule':'largest connected component with B-R >= 35, B-G >= 15, B >= 80; alpha >= 32','units':'pixels in delivered 160px atlas cells; belowFeet = 159 - last body row','caveat':'Blue-body silhouette estimate; excludes detached props. Alpha bounds include all props. Not a mouth/rig anchor. Optical-flow edges and highlights can shift the estimate.'},'atlases':results}
(folder/'frame-measurements.json').write_text(json.dumps(report,indent=2)+'\n')
proof.save(folder/'framing-extremes.jpg',quality=93)
